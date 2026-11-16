// Design: lld/04 §2.5, §2.6 (tables, "Atomic accepted-head update"), §2.7 (Branch, Promotion); b2b §2, §4
import type { Diagnostic, Result } from "@cutroom/foundations";
import { fail, isHashString, ok } from "@cutroom/foundations";
import type { BlobRootProvider } from "../blob/roots.js";
import type { RawDb } from "../storage/driver.js";
import type { Storage } from "../storage/index.js";
import { type EntityDocument, hashEntityVersion, hashManifest, isRevisionId } from "./hashing.js";

export type RevisionOrigin = "patch" | "merge" | "restore" | "migration" | "genesis";
export type BranchType = "accepted" | "candidate" | "worker" | "experiment";
export type BranchState = "open" | "merged" | "abandoned";

export interface RevisionRecord {
  readonly id: string;
  readonly tree_hash: string;
  readonly parents: readonly string[];
  /** The stored text: exactly the text that was hashed into `id`. */
  /** Null once the revision is pruned (R3 §2.14: the row stays, the manifest is dropped). */
  readonly manifest: string | null;
  readonly origin: RevisionOrigin;
  readonly patch_id: string | null;
  readonly pruned: boolean;
  readonly created_at: string;
}

export interface BranchRecord {
  readonly name: string;
  readonly head: string;
  readonly fork_point: string | null;
  readonly type: BranchType;
  readonly state: BranchState;
  readonly owner_job: string | null;
}

export interface SnapshotEntity {
  readonly entity_id: string;
  readonly hash: string;
  readonly doc: EntityDocument;
}

export interface SwapInput {
  readonly expected_base: string;
  readonly candidate: string;
  readonly from_branch: string;
  readonly decision: string | null;
  readonly by: string;
}

/** What the swap hands the caller's hook: it runs in the same transaction function, not in a nested `tx`. */
export interface SwapInfo {
  readonly seq: number;
  readonly revision: string;
  readonly previous: string;
}

/** Writes the caller's rows (for example the head-accepted event, M2-05). Synchronous; a throw rolls the swap back. */
export type SwapHook = (db: RawDb, info: SwapInfo) => void;

/** The accepted head is the branch row with this name (lld/04 §2.6). */
export const ACCEPTED_BRANCH = "main";

/** Thrown inside the transaction function to roll back; caught at the `tx` boundary and turned into a Result. */
class Refusal extends Error {
  constructor(readonly diagnostic: Diagnostic) {
    super(diagnostic.code);
  }
}

const str = (v: unknown): string => String(v);
const strOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

/**
 * Revisions, entity versions, branches and the accepted-head swap over one `Storage`.
 *
 * After a restart the caller must read the head again (`getBranch("main")`): in about 9 kills in 10 the last
 * swap was committed but never acknowledged (b2b §4). Nothing acknowledged is ever lost.
 */
export class RevisionStore {
  private readonly now: () => Date;

  constructor(
    private readonly storage: Storage,
    options: { readonly now?: () => Date } = {},
  ) {
    this.now = options.now ?? (() => new Date());
  }

  /**
   * Insert-only and idempotent: the same document gives the same `hash` and changes nothing the second time.
   * `blobs` are the blob hashes the document refers to; they become `version_blob` rows.
   * Throws on a malformed document or blob hash (a caller bug).
   */
  async putEntityVersion(
    doc: EntityDocument,
    blobs: readonly string[] = [],
  ): Promise<{ readonly hash: string; readonly pin_hash: string }> {
    const { id, kind, v, handle } = doc;
    if (typeof id !== "string" || typeof kind !== "string" || typeof v !== "number" || !Number.isInteger(v)) {
      throw new TypeError("entity document needs string id, string kind and integer v");
    }
    if (handle !== undefined && typeof handle !== "string") throw new TypeError("handle must be a string");
    for (const b of blobs) if (!isHashString(b)) throw new TypeError(`blob is not a sha256: hash: ${b}`);
    const h = hashEntityVersion(doc);
    await this.storage.tx((db) => {
      db.prepare(
        "INSERT INTO entity_version(hash, pin_hash, entity_id, kind, v, handle, doc) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(hash) DO NOTHING",
      ).run(h.hash, h.pin_hash, id, kind, v, handle ?? null, h.text);
      const link = db.prepare(
        "INSERT INTO version_blob(version_hash, blob_hash) VALUES (?, ?) ON CONFLICT(version_hash, blob_hash) DO NOTHING",
      );
      for (const b of blobs) link.run(h.hash, b);
    });
    return { hash: h.hash, pin_hash: h.pin_hash };
  }

  /**
   * Stores the manifest text exactly as hashed. The same content and parents give the same ID and change
   * nothing (the first `created_at` and origin stay). `created_at` is not hashed.
   */
  async putRevision(input: {
    readonly project: string;
    readonly parents: readonly string[];
    readonly entities: Readonly<Record<string, string>>;
    readonly origin: RevisionOrigin;
    readonly patch_id?: string;
    readonly revalidate?: readonly string[];
  }): Promise<{ readonly revision_id: string; readonly tree_hash: string }> {
    const m = hashManifest(input);
    if (new Set(input.parents).size !== input.parents.length) throw new TypeError("duplicate parents");
    const at = this.now().toISOString();
    await this.storage.tx((db) => {
      // A listed hash that is not stored is a caller bug (R3 stage 6 integrity is M2); the first one is named.
      const missing = db
        .prepare(
          `SELECT j.value AS hash FROM json_each(?, '$.entities') j
             LEFT JOIN entity_version ev ON ev.hash = j.value
            WHERE ev.hash IS NULL ORDER BY j.key LIMIT 1`,
        )
        .get(m.manifest);
      if (missing !== undefined) throw new TypeError(`entity version not stored: ${str(missing.hash)}`);
      db.prepare(
        "INSERT INTO revision(id, tree_hash, parents, manifest, origin, patch_id, revalidate, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
      ).run(
        m.revision_id,
        m.tree_hash,
        JSON.stringify(input.parents),
        m.manifest,
        input.origin,
        input.patch_id ?? null,
        input.revalidate === undefined ? null : JSON.stringify(input.revalidate),
        at,
      );
    });
    return { revision_id: m.revision_id, tree_hash: m.tree_hash };
  }

  getRevision(id: string): Result<RevisionRecord> {
    const r = this.storage.prepare("SELECT * FROM revision WHERE id = ?").get(id);
    if (r === undefined) return fail(unknownRevision(id, "id"));
    return ok({
      id: str(r.id),
      tree_hash: str(r.tree_hash),
      parents: JSON.parse(str(r.parents)) as string[],
      manifest: strOrNull(r.manifest),
      origin: str(r.origin) as RevisionOrigin,
      patch_id: strOrNull(r.patch_id),
      pruned: Number(r.pruned) === 1,
      created_at: str(r.created_at),
    });
  }

  /**
   * The documents of a revision in one query: the manifest through `json_each` joined to `entity_version`
   * (b2b §2). An entry with no stored document is a corrupted store and throws.
   */
  snapshot(revisionId: string): Result<readonly SnapshotEntity[]> {
    const rev = this.storage.prepare("SELECT manifest FROM revision WHERE id = ?").get(revisionId);
    if (rev === undefined) return fail(unknownRevision(revisionId, "revision_id"));
    if (rev.manifest === null) throw new Error(`revision ${revisionId} is pruned: its manifest is dropped`);
    const rows = this.storage
      .prepare(
        `SELECT j.key AS entity_id, j.value AS hash, ev.doc AS doc
           FROM revision r, json_each(r.manifest, '$.entities') j
           LEFT JOIN entity_version ev ON ev.hash = j.value
          WHERE r.id = ? ORDER BY j.key`,
      )
      .all(revisionId);
    return ok(
      rows.map((row) => {
        if (row.doc === null) {
          throw new Error(
            `revision ${revisionId} lists ${str(row.entity_id)} at ${str(row.hash)}, which is not stored`,
          );
        }
        return {
          entity_id: str(row.entity_id),
          hash: str(row.hash),
          doc: JSON.parse(str(row.doc)) as EntityDocument,
        };
      }),
    );
  }

  /** Creates an open branch at `head`. A name that exists throws (SQLite constraint); a patch never creates a branch. */
  async createBranch(input: {
    readonly name: string;
    readonly head: string;
    readonly fork_point?: string;
    readonly type: BranchType;
    readonly owner_job?: string;
  }): Promise<Result<BranchRecord>> {
    if (!isRevisionId(input.head)) throw new TypeError(`head is not a revision ID: ${input.head}`);
    try {
      await this.storage.tx((db) => {
        if (db.prepare("SELECT 1 AS x FROM branch WHERE name = ?").get(input.name) !== undefined) {
          throw new Refusal({ code: "BRANCH_EXISTS", path: "name", got: input.name });
        }
        if (db.prepare("SELECT 1 AS x FROM revision WHERE id = ?").get(input.head) === undefined) {
          throw new Refusal(unknownRevision(input.head, "head"));
        }
        if (
          input.fork_point !== undefined &&
          db.prepare("SELECT 1 AS x FROM revision WHERE id = ?").get(input.fork_point) === undefined
        ) {
          throw new Refusal(unknownRevision(input.fork_point, "fork_point"));
        }
        db.prepare("INSERT INTO branch(name, head, fork_point, type, owner_job) VALUES (?, ?, ?, ?, ?)").run(
          input.name,
          input.head,
          input.fork_point ?? null,
          input.type,
          input.owner_job ?? null,
        );
      });
    } catch (e) {
      if (e instanceof Refusal) return fail(e.diagnostic);
      throw e;
    }
    return this.getBranch(input.name);
  }

  getBranch(name: string): Result<BranchRecord> {
    const r = this.storage.prepare("SELECT * FROM branch WHERE name = ?").get(name);
    if (r === undefined) return fail(unknownBranch(name, "name"));
    return ok({
      name: str(r.name),
      head: str(r.head),
      fork_point: strOrNull(r.fork_point),
      type: str(r.type) as BranchType,
      state: str(r.state) as BranchState,
      owner_job: strOrNull(r.owner_job),
    });
  }

  /**
   * The compare-and-swap of the accepted head: one `full` transaction holding the branch update, the
   * `accepted_log` row and the caller's rows (`alsoInTransaction`). If `changes()` is not 1 the transaction rolls
   * back and the result is `STALE_BASE` (with the current head); nothing is written. A throwing hook rolls the
   * whole swap back and the error reaches the caller. This is the swap, not promotion: grants, validation and
   * the ancestor check are the caller's (M2).
   */
  async swapAcceptedHead(
    input: SwapInput,
    alsoInTransaction?: SwapHook,
  ): Promise<Result<{ readonly seq: number }>> {
    const at = this.now().toISOString();
    try {
      const seq = await this.storage.tx(
        (db) => {
          const head = db.prepare("SELECT head FROM branch WHERE name = ?").get(ACCEPTED_BRANCH);
          if (head === undefined) throw new Refusal(unknownBranch(ACCEPTED_BRANCH, "name"));
          if (db.prepare("SELECT 1 AS x FROM branch WHERE name = ?").get(input.from_branch) === undefined) {
            throw new Refusal(unknownBranch(input.from_branch, "from_branch"));
          }
          if (db.prepare("SELECT 1 AS x FROM revision WHERE id = ?").get(input.candidate) === undefined) {
            throw new Refusal(unknownRevision(input.candidate, "candidate"));
          }
          if (input.candidate === input.expected_base) {
            throw new TypeError("candidate is the expected base: a swap must move the head");
          }
          if (
            db.prepare("SELECT 1 AS x FROM accepted_log WHERE revision = ?").get(input.candidate) !==
            undefined
          ) {
            throw new TypeError(
              `revision already accepted: ${input.candidate} (a rollback is a new revision, R3 §2.5)`,
            );
          }
          const upd = db
            .prepare("UPDATE branch SET head = ? WHERE name = ? AND head = ?")
            .run(input.candidate, ACCEPTED_BRANCH, input.expected_base);
          if (Number(upd.changes) !== 1) {
            throw new Refusal({
              code: "STALE_BASE",
              path: "expected_base",
              expected: input.expected_base,
              got: str(head.head),
            });
          }
          const ins = db
            .prepare(
              "INSERT INTO accepted_log(revision, previous, from_branch, decision, by, at) VALUES (?, ?, ?, ?, ?, ?)",
            )
            .run(input.candidate, input.expected_base, input.from_branch, input.decision, input.by, at);
          const seq = Number(ins.lastInsertRowid);
          if (alsoInTransaction !== undefined) {
            const sealed = sealDb(db);
            let returned: unknown;
            try {
              returned = alsoInTransaction(sealed.db, {
                seq,
                revision: input.candidate,
                previous: input.expected_base,
              });
            } finally {
              sealed.seal();
            }
            if (returned !== undefined && typeof (returned as { then?: unknown }).then === "function") {
              throw new TypeError("alsoInTransaction must be synchronous");
            }
          }
          return seq;
        },
        { durability: "full" },
      );
      return ok({ seq });
    } catch (e) {
      if (e instanceof Refusal) return fail(e.diagnostic);
      throw e;
    }
  }

  /** The `version_blob` root provider: every blob some stored entity version refers to (R3 §2.14). */
  blobRootProvider(): BlobRootProvider {
    return {
      name: "version_blob",
      blobRoots: () =>
        this.storage
          .prepare("SELECT DISTINCT blob_hash FROM version_blob ORDER BY blob_hash")
          .all()
          .map((r) => str(r.blob_hash)),
    };
  }
}

/** A view of the transaction's connection that refuses every call once the member function has returned. */
function sealDb(db: RawDb): { readonly db: RawDb; readonly seal: () => void } {
  let open = true;
  const check = (): void => {
    if (!open) throw new Error("the transaction has ended: a hook must write synchronously");
  };
  const view: RawDb = {
    exec: (sql) => {
      check();
      db.exec(sql);
    },
    prepare: (sql) => {
      check();
      const st = db.prepare(sql);
      return {
        run: (...p) => {
          check();
          return st.run(...p);
        },
        get: (...p) => {
          check();
          return st.get(...p);
        },
        all: (...p) => {
          check();
          return st.all(...p);
        },
      };
    },
    get isTransaction() {
      return db.isTransaction;
    },
    sqliteVersion: () => db.sqliteVersion(),
    backupTo: (d) => db.backupTo(d),
    close: () => {
      throw new Error("a hook may not close the connection");
    },
  };
  return {
    db: view,
    seal: () => {
      open = false;
    },
  };
}

function unknownRevision(id: string, path: string): Diagnostic {
  return { code: "UNKNOWN_REVISION", path, got: id };
}

function unknownBranch(name: string, path: string): Diagnostic {
  return { code: "UNKNOWN_BRANCH", path, got: name };
}
