// Design: lld/04 §2.6 "Blob store", §2.14 "Blobs", §4 (crash mid-ingest), §5 (blob.*); lld/06 §2.12; lld/11 H7, A:M0-4
import { createHash, randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import type { ArtifactRef, Result, SettingsLayer, SettingsRegistry } from "@cutroom/foundations";
import { ArtifactRefSchema, fail, isHashString, ok } from "@cutroom/foundations";
import type { Storage } from "../storage/index.js";
import { type BlobFs, type BlobStat, nodeBlobFs } from "./fs.js";
import type { BlobRootProvider } from "./roots.js";

export type VerifyOnRead = "final_render_only" | "always";
/** `final_render` always verifies the hash (R3 §5, `blob.verify_on_read`); other purposes only under `always`. */
export type OpenPurpose = "final_render" | "other";

export interface BlobSettings {
  /** `blob.verify_on_read` */
  readonly verifyOnRead: VerifyOnRead;
  /** `blob.grace_hours` */
  readonly graceHours: number;
}

/** Resolves `blob.verify_on_read` and `blob.grace_hours` from the registry; no default lives here. */
export function resolveBlobSettings(
  registry: SettingsRegistry,
  layers: readonly SettingsLayer[] = [],
): Result<BlobSettings> {
  const verify = registry.resolve("blob.verify_on_read", layers);
  if (!verify.ok) return verify;
  const grace = registry.resolve("blob.grace_hours", layers);
  if (!grace.ok) return grace;
  if (verify.value !== "final_render_only" && verify.value !== "always") {
    return fail({ code: "VALUE_OUT_OF_RANGE", path: "blob.verify_on_read", got: verify.value });
  }
  if (typeof grace.value !== "number") {
    return fail({ code: "VALUE_OUT_OF_RANGE", path: "blob.grace_hours", got: grace.value });
  }
  return ok({ verifyOnRead: verify.value, graceHours: grace.value });
}

export interface BlobStoreOptions extends BlobSettings {
  /** The Space directory: `blobs/` and `tmp/` live in it, on one filesystem (R3 §8). */
  readonly spaceDir: string;
  readonly storage: Storage;
  /** Time source for `stored_at`; sweeps take their own `now`. */
  readonly now?: () => Date;
  readonly fs?: BlobFs;
}

export interface IngestOptions {
  /** True for bytes that cannot be made again: file and directory are synced before `ingest` resolves. */
  readonly durable: boolean;
  readonly media_type: string;
}

/** An opened blob: read the bytes from `path` (read-only). */
export interface OpenedBlob {
  readonly ref: ArtifactRef;
  readonly path: string;
}

export interface SweepReport {
  /** Hashes unlinked and removed from the table this sweep (including interrupted ones it finished). */
  readonly removed: readonly string[];
  /** The subset of `removed` that an earlier, interrupted sweep had already marked `deleting`. */
  readonly finished: readonly string[];
  /** Unrooted blobs kept because they are younger than the grace period. */
  readonly protectedByGrace: number;
  /** Files without a row removed (older than the grace period, by modification time). */
  readonly rowlessRemoved: readonly string[];
  /** Files left in `tmp/` by a crash, removed after the grace period. */
  readonly tmpRemoved: readonly string[];
  readonly roots: readonly { readonly provider: string; readonly count: number }[];
}

interface BlobRow {
  hash: string;
  size: number;
  media_type: string;
  durable: number;
  state: string;
  stored_at: string;
}

const HASH_PREFIX = "sha256:";
const HEX_NAME = /^[0-9a-f]{64}$/;
const MS_PER_HOUR = 3_600_000;

const hexOf = (hash: string): string => hash.slice(HASH_PREFIX.length);

/** A tiny async mutex: ingest's rename-and-insert and the whole sweep never interleave. */
class Lock {
  private tail: Promise<unknown> = Promise.resolve();
  run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(fn, fn);
    this.tail = result.catch(() => undefined);
    return result;
  }
}

/** The explicit pins: a root provider of its own, consulted first by the sweep (R3 §2.14). */
export class BlobPins implements BlobRootProvider {
  readonly name = "pins";
  private readonly hashes = new Set<string>();
  pin(hash: string): void {
    if (!isHashString(hash)) throw new Error(`pin: not a sha256: hash: ${hash}`);
    this.hashes.add(hash);
  }
  unpin(hash: string): void {
    this.hashes.delete(hash);
  }
  blobRoots(): Iterable<string> {
    return [...this.hashes];
  }
}

export class BlobStore {
  readonly pins = new BlobPins();
  private readonly providers: BlobRootProvider[] = [];
  private readonly fs: BlobFs;
  private readonly now: () => Date;
  private readonly lock = new Lock();
  private readonly blobsDir: string;
  private readonly tmpDir: string;

  constructor(private readonly options: BlobStoreOptions) {
    this.fs = options.fs ?? nodeBlobFs;
    this.now = options.now ?? (() => new Date());
    this.blobsDir = join(options.spaceDir, "blobs", "sha256");
    this.tmpDir = join(options.spaceDir, "tmp");
  }

  /** The file of a blob: `blobs/sha256/<first two hex>/<64 hex>`. */
  pathOf(hash: string): string {
    const hex = hexOf(hash);
    return join(this.blobsDir, hex.slice(0, 2), hex);
  }

  registerRootProvider(provider: BlobRootProvider): void {
    this.providers.push(provider);
  }

  /**
   * Streams to `tmp/<uuid>` while hashing, makes the file read-only, renames it into place, then inserts the
   * row. A durable ingest syncs the file before the rename and the directory after it, all before resolving,
   * so a crash may leave a file without a row, never a row without a file. A known hash discards the
   * temporary file. I/O errors are thrown; a failed ingest before the rename leaves no temporary file.
   */
  async ingest(stream: AsyncIterable<Uint8Array>, options: IngestOptions): Promise<ArtifactRef> {
    const mediaType = ArtifactRefSchema.shape.media_type.parse(options.media_type);
    const { fs } = this;
    await fs.mkdirp(this.tmpDir);
    const tmp = join(this.tmpDir, randomUUID());
    const hasher = createHash("sha256");
    let size = 0;
    let renamed = false;
    try {
      const writer = await fs.openWrite(tmp);
      try {
        for await (const chunk of stream) {
          hasher.update(chunk);
          size += chunk.length;
          await writer.write(chunk);
        }
        if (options.durable) await writer.sync();
      } finally {
        await writer.close();
      }
      const hash = `${HASH_PREFIX}${hasher.digest("hex")}`;
      const ref: ArtifactRef = { hash, media_type: mediaType, size };
      await fs.makeReadOnly(tmp);
      // The lock covers the rename and the transaction function, not the wait for the commit tick: a failed
      // commit leaves a file without a row, which the design allows (R3 §4).
      const { commit } = await this.lock.run(async () => {
        const finalPath = this.pathOf(hash);
        const shard = dirname(finalPath);
        const created = await fs.mkdirp(shard);
        // Always replace: the bytes just hashed are the right ones, and the file already there may be damaged
        // (same size, other bytes) or short. Rename is atomic and replaces a read-only file on Linux.
        await fs.rename(tmp, finalPath);
        renamed = true;
        // A directory this ingest created is made durable whoever made it, so a later durable ingest into it
        // has a durable directory entry; a durable ingest also syncs the directory holding the renamed file.
        if (options.durable || created !== undefined) await this.syncDirs(shard, created);
        return { commit: this.upsert(ref, options.durable) };
      });
      await commit;
      return ref;
    } catch (error) {
      // Before the rename nothing of this ingest may remain; after it the file stays for the sweep (R3 §4).
      if (!renamed) await fs.unlink(tmp).catch(() => false);
      throw error;
    }
  }

  /**
   * Finds the blob and checks it. A missing or short file, and under `blob.verify_on_read` a wrong hash,
   * is `BLOB_MISSING`: for a non-durable blob the row is removed first (treated as evicted), so the caller
   * re-runs the job that made it (R3 §2.6, A:M0-4).
   */
  async open(ref: ArtifactRef, options: { readonly purpose: OpenPurpose }): Promise<Result<OpenedBlob>> {
    const row = this.row(ref.hash);
    const path = this.pathOf(ref.hash);
    if (row === undefined || row.state !== "present") {
      return this.missing(ref, "no_row", undefined);
    }
    const found = await this.fs.stat(path);
    if (found === undefined || found.size !== row.size) {
      await this.evictIfStillBad(row, found);
      return this.missing(ref, found === undefined ? "file_missing" : "size_mismatch", row);
    }
    if (options.purpose === "final_render" || this.options.verifyOnRead === "always") {
      const actual = await this.hashFile(path);
      if (actual !== ref.hash) {
        await this.evictIfStillBad(row, found);
        return this.missing(ref, "hash_mismatch", row);
      }
    }
    return ok({ ref: { hash: row.hash, media_type: ref.media_type, size: row.size }, path });
  }

  /**
   * One mark-and-sweep (R3 §2.14). Roots are the explicit pins first, then each registered provider. A
   * provider that fails aborts the sweep before anything is removed. For each blob no root reaches: younger
   * than `blob.grace_hours` (by `stored_at`, or by file modification time when there is no row) it stays;
   * otherwise the row is marked `deleting`, the file unlinked, then the row deleted. A `deleting` row left
   * by an interrupted sweep is finished the same way. Only this method unlinks blob files.
   */
  async sweep(options: { readonly now: Date }): Promise<SweepReport> {
    return await this.lock.run(() => this.sweepLocked(options.now));
  }

  // ---------------------------------------------------------------------------------------------------

  private async sweepLocked(now: Date): Promise<SweepReport> {
    const graceMs = this.options.graceHours * MS_PER_HOUR;
    const reached = new Set<string>();
    const rootCounts: { provider: string; count: number }[] = [];
    for (const provider of [this.pins, ...this.providers]) {
      let hashes: Iterable<string>;
      try {
        hashes = await provider.blobRoots();
      } catch (error) {
        throw new Error(`sweep aborted: root provider ${provider.name} failed`, { cause: error });
      }
      let count = 0;
      for (const h of hashes) {
        if (!isHashString(h)) {
          throw new Error(`sweep aborted: root provider ${provider.name} returned a non-hash: ${String(h)}`);
        }
        reached.add(h);
        count++;
      }
      rootCounts.push({ provider: provider.name, count });
    }

    const removed: string[] = [];
    const finished: string[] = [];
    let protectedByGrace = 0;
    const rows = this.options.storage.prepare("SELECT * FROM blob").all() as unknown as BlobRow[];
    const rowHashes = new Set(rows.map((r) => r.hash));

    // Plan first, then three batched steps in R3 §2.14's order: mark `deleting`, unlink, delete the rows.
    const mark: string[] = [];
    const rescue: string[] = [];
    const finishing: string[] = [];
    for (const row of rows) {
      if (row.state === "deleting") {
        if (reached.has(row.hash) && (await this.fs.stat(this.pathOf(row.hash))) !== undefined) {
          rescue.push(row.hash); // rooted again while marked, file still there: keep it
        } else {
          finishing.push(row.hash);
          finished.push(row.hash);
        }
        continue;
      }
      if (reached.has(row.hash)) continue;
      if (now.getTime() - Date.parse(row.stored_at) < graceMs) {
        protectedByGrace++;
        continue;
      }
      mark.push(row.hash);
    }
    if (mark.length > 0 || rescue.length > 0) {
      await this.options.storage.tx((db) => {
        const setState = db.prepare("UPDATE blob SET state = ?, purged_reason = ? WHERE hash = ?");
        for (const h of mark) setState.run("deleting", "unrooted", h);
        for (const h of rescue) setState.run("present", null, h);
      });
    }
    const doomed = [...mark, ...finishing];
    for (const h of doomed) await this.fs.unlink(this.pathOf(h));
    if (doomed.length > 0) {
      await this.options.storage.tx((db) => {
        const del = db.prepare("DELETE FROM blob WHERE hash = ? AND state = 'deleting'");
        for (const h of doomed) del.run(h);
      });
    }
    removed.push(...doomed);

    const rowlessRemoved: string[] = [];
    for (const shard of await this.fs.readdir(this.blobsDir)) {
      for (const name of await this.fs.readdir(join(this.blobsDir, shard))) {
        const hash = `${HASH_PREFIX}${name}`;
        if (!HEX_NAME.test(name) || name.slice(0, 2) !== shard || rowHashes.has(hash)) continue;
        if (reached.has(hash)) continue;
        const path = join(this.blobsDir, shard, name);
        const st = await this.fs.stat(path);
        if (st === undefined) continue;
        if (now.getTime() - st.mtimeMs < graceMs) {
          protectedByGrace++;
          continue;
        }
        await this.fs.unlink(path);
        rowlessRemoved.push(hash);
      }
    }

    const tmpRemoved: string[] = [];
    for (const name of await this.fs.readdir(this.tmpDir)) {
      const path = join(this.tmpDir, name);
      const st = await this.fs.stat(path);
      if (st !== undefined && now.getTime() - st.mtimeMs >= graceMs) {
        await this.fs.unlink(path);
        tmpRemoved.push(name);
      }
    }

    return { removed, finished, protectedByGrace, rowlessRemoved, tmpRemoved, roots: rootCounts };
  }

  private row(hash: string): BlobRow | undefined {
    return this.options.storage.prepare("SELECT * FROM blob WHERE hash = ?").get(hash) as unknown as
      | BlobRow
      | undefined;
  }

  /** Calls `tx` at once (the function runs before this returns) and returns the commit's promise. */
  private upsert(ref: ArtifactRef, durable: boolean): Promise<void> {
    const storedAt = this.now().toISOString();
    return this.options.storage.tx((db) => {
      // A known hash keeps its row and renews `stored_at`, so grace restarts for bytes about to be referenced;
      // a row marked `deleting` is revived. `durable` only ever goes up.
      db.prepare(
        `INSERT INTO blob (hash, size, media_type, durable, state, stored_at, purged_reason)
         VALUES (?, ?, ?, ?, 'present', ?, NULL)
         ON CONFLICT (hash) DO UPDATE SET
           media_type = CASE WHEN blob.state = 'deleting' THEN excluded.media_type ELSE blob.media_type END,
           size = excluded.size,
           durable = max(blob.durable, excluded.durable),
           state = 'present',
           stored_at = excluded.stored_at,
           purged_reason = NULL`,
      ).run(ref.hash, ref.size, ref.media_type, durable ? 1 : 0, storedAt);
    });
  }

  /** Directories whose entries this ingest created or changed: the shard, and any new ancestors up to the first one made. */
  private async syncDirs(shard: string, created: string | undefined): Promise<void> {
    const dirs = [shard];
    if (created !== undefined) {
      const top = dirname(resolve(created));
      for (let d = dirname(resolve(shard)); d !== top && d !== dirname(d); d = dirname(d)) dirs.push(d);
      dirs.push(top);
    }
    for (const d of dirs) await this.fs.syncDir(d);
  }

  /**
   * Removes the row of a damaged non-durable blob (treated as evicted). `open` looked outside the lock, so an
   * ingest may have repaired the blob meanwhile: under the lock the row and the file are read again, and the
   * row goes only if both are as `open` saw them (same row, same size and modification time) or the file is
   * still missing or short.
   */
  private async evictIfStillBad(seen: BlobRow, seenStat: BlobStat | undefined): Promise<void> {
    if (seen.durable === 1) return;
    await this.lock.run(async () => {
      const row = this.row(seen.hash);
      if (row === undefined || row.durable === 1 || row.state !== "present") return;
      if (row.stored_at !== seen.stored_at || row.size !== seen.size) return;
      const now = await this.fs.stat(this.pathOf(seen.hash));
      const stillMissingOrShort = now === undefined || now.size !== row.size;
      const unchanged =
        seenStat !== undefined &&
        now !== undefined &&
        now.size === seenStat.size &&
        now.mtimeMs === seenStat.mtimeMs;
      if (!stillMissingOrShort && !unchanged) return;
      await this.options.storage.tx((db) => {
        db.prepare("DELETE FROM blob WHERE hash = ? AND durable = 0 AND stored_at = ?").run(
          row.hash,
          row.stored_at,
        );
      });
    });
  }

  private async hashFile(path: string): Promise<string> {
    const hasher = createHash("sha256");
    for await (const chunk of this.fs.read(path)) hasher.update(chunk);
    return `${HASH_PREFIX}${hasher.digest("hex")}`;
  }

  private missing(ref: ArtifactRef, reason: string, row: BlobRow | undefined): Result<OpenedBlob> {
    return fail({
      code: "BLOB_MISSING",
      path: ref.hash,
      expected: row === undefined ? { present: true } : { size: row.size },
      got: { reason, durable: row === undefined ? null : row.durable === 1 },
    });
  }
}
