import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, readFileSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  BLOB_CODES,
  BLOB_MIGRATIONS,
  type BlobRootProvider,
  nodeBlobFs,
  PROJECT_CORE_MIGRATIONS,
} from "../src/index.js";
import { bytes, chunks, listTmp, setupBlobs, spyFs } from "./blob-helpers.js";

const reasonOf = (d: readonly { got?: unknown }[]): string | undefined =>
  (d[0]?.got as { reason?: string } | undefined)?.reason;
const HOUR = 3_600_000;
const sha = (b: Uint8Array) => `sha256:${createHash("sha256").update(b).digest("hex")}`;
const rowOf = (s: { prepare(sql: string): { get(...p: string[]): unknown } }, hash: string) =>
  s.prepare("SELECT * FROM blob WHERE hash = ?").get(hash) as
    | { size: number; durable: number; state: string; stored_at: string; purged_reason: string | null }
    | undefined;
const rowCount = (s: { prepare(sql: string): { get(): unknown } }) =>
  (s.prepare("SELECT count(*) AS c FROM blob").get() as { c: number }).c;
const rooted = (...hashes: string[]): BlobRootProvider => ({ name: "test", blobRoots: () => hashes });

test("blob: codes and migration", () => {
  assert.deepEqual([...BLOB_CODES], ["BLOB_MISSING"]);
  assert.equal(BLOB_MIGRATIONS[0]?.number, 1);
  assert.equal(BLOB_MIGRATIONS[0]?.name, "blob");
  assert.match(BLOB_MIGRATIONS[0]?.sql ?? "", /\) STRICT;/);
  assert.deepEqual(PROJECT_CORE_MIGRATIONS, [...BLOB_MIGRATIONS]);
});

test("blob: a 1 MB ingest has the right path and hash, is read-only, and leaves tmp/ empty", async () => {
  const { t, store, storage, cleanup } = await setupBlobs();
  try {
    const data = bytes(1_048_576);
    const ref = await store.ingest(chunks(data), { durable: false, media_type: "application/octet-stream" });
    assert.deepEqual(ref, { hash: sha(data), media_type: "application/octet-stream", size: 1_048_576 });
    const hex = ref.hash.slice("sha256:".length);
    const path = join(t.dir, "blobs", "sha256", hex.slice(0, 2), hex);
    assert.equal(store.pathOf(ref.hash), path);
    assert.deepEqual(readFileSync(path), Buffer.from(data));
    assert.equal(statSync(path).mode & 0o222, 0, "no write bit");
    assert.deepEqual(listTmp(t.dir), []);
    assert.equal(rowOf(storage, ref.hash)?.state, "present");
    assert.equal(rowOf(storage, ref.hash)?.size, 1_048_576);
    assert.equal(rowOf(storage, ref.hash)?.durable, 0);
  } finally {
    cleanup();
  }
});

test("blob: tmp/ is on the same filesystem as blobs/", async () => {
  const { t, store, cleanup } = await setupBlobs();
  try {
    await store.ingest(chunks(bytes(10)), { durable: false, media_type: "a/b" });
    assert.equal(statSync(join(t.dir, "tmp")).dev, statSync(join(t.dir, "blobs", "sha256")).dev);
  } finally {
    cleanup();
  }
});

test("blob: a duplicate ingest keeps one file and one row, discards its temporary file and renews stored_at", async () => {
  let clock = new Date("2026-01-01T00:00:00Z");
  const { t, store, storage, cleanup } = await setupBlobs({ now: () => clock });
  try {
    const data = bytes(5000);
    const a = await store.ingest(chunks(data), { durable: false, media_type: "a/b" });
    const first = rowOf(storage, a.hash)?.stored_at;
    clock = new Date("2026-01-02T00:00:00Z");
    const b = await store.ingest(chunks(data), { durable: false, media_type: "a/b" });
    assert.deepEqual(a, b);
    assert.equal(rowCount(storage), 1);
    assert.deepEqual(listTmp(t.dir), []);
    assert.notEqual(rowOf(storage, a.hash)?.stored_at, first);
    assert.equal(rowOf(storage, a.hash)?.stored_at, clock.toISOString());
  } finally {
    cleanup();
  }
});

test("blob: a durable ingest syncs the file before the rename and the directory after it; non-durable syncs nothing", async () => {
  const spy = spyFs();
  const { t, store, cleanup } = await setupBlobs({ fs: spy.fs });
  try {
    const d = await store.ingest(chunks(bytes(3000)), { durable: true, media_type: "a/b" });
    const ops = spy.calls.map((c) => c.op);
    assert.ok(ops.includes("syncWriter"));
    assert.ok(ops.indexOf("syncWriter") < ops.indexOf("rename"), "file synced before rename");
    const shard = join(t.dir, "blobs", "sha256", d.hash.slice(7, 9));
    const dirSyncs = spy.calls.filter((c) => c.op === "syncDir").map((c) => c.path);
    assert.ok(dirSyncs.includes(shard), "shard directory synced");
    assert.ok(
      dirSyncs.includes(join(t.dir, "blobs")),
      "newly created ancestors synced up to the first one made",
    );
    assert.ok(dirSyncs.includes(t.dir), "the parent of the first created directory is synced");
    assert.ok(ops.lastIndexOf("syncDir") > ops.indexOf("rename"), "directory synced after rename");

    spy.calls.length = 0;
    await store.ingest(chunks(bytes(3000)), { durable: false, media_type: "a/b" });
    const syncs = spy.calls.filter((c) => ["syncWriter", "syncFile", "syncDir"].includes(c.op));
    assert.deepEqual(syncs, []);
  } finally {
    cleanup();
  }
});

test("blob: a durable re-ingest of known bytes syncs the existing file and upgrades the row", async () => {
  const spy = spyFs();
  const { store, storage, cleanup } = await setupBlobs({ fs: spy.fs });
  try {
    const data = bytes(2000);
    const ref = await store.ingest(chunks(data), { durable: false, media_type: "a/b" });
    spy.calls.length = 0;
    await store.ingest(chunks(data), { durable: true, media_type: "a/b" });
    assert.ok(spy.calls.some((c) => c.op === "syncFile" && c.path === store.pathOf(ref.hash)));
    assert.ok(spy.calls.some((c) => c.op === "syncDir"));
    assert.equal(rowOf(storage, ref.hash)?.durable, 1);
  } finally {
    cleanup();
  }
});

test("blob: a failing input stream leaves no temporary file and no row", async () => {
  const { t, store, storage, cleanup } = await setupBlobs();
  try {
    async function* broken() {
      yield bytes(100);
      throw new Error("input broke");
    }
    await assert.rejects(store.ingest(broken(), { durable: false, media_type: "a/b" }), /input broke/);
    assert.deepEqual(listTmp(t.dir), []);
    assert.equal(rowCount(storage), 0);
    await assert.rejects(store.ingest(chunks(bytes(1)), { durable: false, media_type: "nonsense" }));
  } finally {
    cleanup();
  }
});

test("blob: a crash between rename and insert leaves a file without a row, kept within grace and removed after", async () => {
  const crash = new Error("simulated crash");
  const spy = spyFs((call) => {
    if (call.op === "rename") throw crash;
  });
  const { t, store, storage, cleanup } = await setupBlobs({ fs: spy.fs });
  try {
    const data = bytes(4000);
    await assert.rejects(store.ingest(chunks(data), { durable: true, media_type: "a/b" }), crash);
    const hash = sha(data);
    const path = store.pathOf(hash);
    assert.ok(existsSync(path), "the file is there");
    assert.equal(rowOf(storage, hash), undefined, "and has no row");
    assert.equal(
      spy.calls.some((c) => c.op === "unlink" && c.path === path),
      false,
      "a failed ingest after the rename never unlinks the blob",
    );

    const mtime = statSync(path).mtimeMs;
    const within = await store.sweep({ now: new Date(mtime + 23 * HOUR) });
    assert.deepEqual(within.rowlessRemoved, []);
    assert.equal(within.protectedByGrace, 1);
    assert.ok(existsSync(path));

    const after = await store.sweep({ now: new Date(mtime + 25 * HOUR) });
    assert.deepEqual(after.rowlessRemoved, [hash]);
    assert.equal(existsSync(path), false);
    assert.ok(t.dir);
  } finally {
    cleanup();
  }
});

test("blob: open returns the file; an unknown hash is BLOB_MISSING", async () => {
  const { store, cleanup } = await setupBlobs();
  try {
    const data = bytes(777);
    const ref = await store.ingest(chunks(data), { durable: false, media_type: "a/b" });
    const opened = await store.open(ref, { purpose: "other" });
    assert.equal(opened.ok, true);
    if (opened.ok) assert.deepEqual(readFileSync(opened.value.path), Buffer.from(data));
    const unknown = await store.open(
      { hash: sha(bytes(8)), media_type: "a/b", size: 8 },
      { purpose: "other" },
    );
    assert.equal(unknown.ok, false);
    if (!unknown.ok) assert.equal(unknown.diagnostics[0]?.code, "BLOB_MISSING");
  } finally {
    cleanup();
  }
});

test("blob: a truncated non-durable file makes open remove the row and return BLOB_MISSING", async () => {
  const { store, storage, cleanup } = await setupBlobs();
  try {
    const ref = await store.ingest(chunks(bytes(9000)), { durable: false, media_type: "a/b" });
    const path = store.pathOf(ref.hash);
    chmodSync(path, 0o644);
    writeFileSync(path, bytes(100)); // what a power loss can leave behind
    const r = await store.open(ref, { purpose: "other" });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.diagnostics[0]?.code, "BLOB_MISSING");
      assert.deepEqual(reasonOf(r.diagnostics), "size_mismatch");
    }
    assert.equal(rowOf(storage, ref.hash), undefined, "row removed: treated as evicted");
  } finally {
    cleanup();
  }
});

test("blob: a short durable file is BLOB_MISSING but its row stays", async () => {
  const { store, storage, cleanup } = await setupBlobs();
  try {
    const ref = await store.ingest(chunks(bytes(9000)), { durable: true, media_type: "a/b" });
    const path = store.pathOf(ref.hash);
    chmodSync(path, 0o644);
    writeFileSync(path, bytes(100));
    const r = await store.open(ref, { purpose: "other" });
    assert.equal(r.ok, false);
    assert.ok(rowOf(storage, ref.hash), "irreproducible bytes keep their row for the caller to see");
  } finally {
    cleanup();
  }
});

function flip(path: string) {
  chmodSync(path, 0o644);
  const b = readFileSync(path);
  b[10] = (b[10] as number) ^ 1;
  writeFileSync(path, b);
}

test("blob: verify_on_read = always catches one changed byte; final_render_only catches it only for a final render", async () => {
  const always = await setupBlobs({}, { "blob.verify_on_read": "always" });
  try {
    const ref = await always.store.ingest(chunks(bytes(5000)), { durable: true, media_type: "a/b" });
    flip(always.store.pathOf(ref.hash));
    const r = await always.store.open(ref, { purpose: "other" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(reasonOf(r.diagnostics), "hash_mismatch");
  } finally {
    always.cleanup();
  }
  const lazy = await setupBlobs();
  try {
    const ref = await lazy.store.ingest(chunks(bytes(5000)), { durable: false, media_type: "a/b" });
    flip(lazy.store.pathOf(ref.hash));
    assert.equal((await lazy.store.open(ref, { purpose: "other" })).ok, true, "same size, not verified");
    const r = await lazy.store.open(ref, { purpose: "final_render" });
    assert.equal(r.ok, false);
    assert.equal(rowOf(lazy.storage, ref.hash), undefined, "a damaged derived blob is treated as evicted");
  } finally {
    lazy.cleanup();
  }
});

test("blob: the sweep keeps a rooted old blob and removes an unrooted old one, in order deleting, unlink, delete row", async () => {
  const clock = new Date("2026-03-01T00:00:00Z");
  const spy = spyFs();
  const { store, storage, cleanup } = await setupBlobs({ now: () => clock, fs: spy.fs });
  try {
    const keep = await store.ingest(chunks(bytes(100)), { durable: false, media_type: "a/b" });
    const drop = await store.ingest(chunks(bytes(100)), { durable: false, media_type: "a/b" });
    const pinned = await store.ingest(chunks(bytes(100)), { durable: false, media_type: "a/b" });
    store.registerRootProvider(rooted(keep.hash));
    store.pins.pin(pinned.hash);
    const later = new Date(clock.getTime() + 25 * HOUR);
    spy.calls.length = 0;
    const report = await store.sweep({ now: later });
    assert.deepEqual(report.removed, [drop.hash]);
    assert.deepEqual(report.roots, [
      { provider: "pins", count: 1 },
      { provider: "test", count: 1 },
    ]);
    assert.ok(rowOf(storage, keep.hash));
    assert.ok(rowOf(storage, pinned.hash));
    assert.equal(rowOf(storage, drop.hash), undefined);
    assert.equal(existsSync(store.pathOf(drop.hash)), false);
    assert.ok(existsSync(store.pathOf(keep.hash)));
    assert.deepEqual(
      spy.calls.filter((c) => c.op === "unlink").map((c) => c.path),
      [store.pathOf(drop.hash)],
      "only the unrooted blob is unlinked",
    );
  } finally {
    cleanup();
  }
});

test("blob: the grace period protects an unrooted blob with a row; blob.grace_hours comes from the registry", async () => {
  const clock = new Date("2026-03-01T00:00:00Z");
  const { store, storage, cleanup } = await setupBlobs({ now: () => clock }, { "blob.grace_hours": 2 });
  try {
    const ref = await store.ingest(chunks(bytes(100)), { durable: false, media_type: "a/b" });
    const young = await store.sweep({ now: new Date(clock.getTime() + 1 * HOUR) });
    assert.deepEqual(young.removed, []);
    assert.equal(young.protectedByGrace, 1);
    assert.ok(rowOf(storage, ref.hash));
    const old = await store.sweep({ now: new Date(clock.getTime() + 3 * HOUR) });
    assert.deepEqual(old.removed, [ref.hash]);
  } finally {
    cleanup();
  }
});

test("blob: an interrupted sweep is completed by the next one", async () => {
  const clock = new Date("2026-03-01T00:00:00Z");
  let armed = false;
  const spy = spyFs();
  const fs = {
    ...spy.fs,
    async unlink(path: string) {
      if (armed && path.includes("blobs")) throw new Error("crash during unlink");
      return await spy.fs.unlink(path);
    },
  };
  const { store, storage, cleanup } = await setupBlobs({ now: () => clock, fs });
  try {
    const ref = await store.ingest(chunks(bytes(100)), { durable: false, media_type: "a/b" });
    const later = new Date(clock.getTime() + 25 * HOUR);
    armed = true;
    await assert.rejects(store.sweep({ now: later }), /crash during unlink/);
    assert.equal(rowOf(storage, ref.hash)?.state, "deleting");
    assert.ok(existsSync(store.pathOf(ref.hash)));
    // a row marked deleting is not openable
    assert.equal((await store.open(ref, { purpose: "other" })).ok, false);
    armed = false;
    const second = await store.sweep({ now: later });
    assert.deepEqual(second.finished, [ref.hash]);
    assert.equal(rowOf(storage, ref.hash), undefined);
    assert.equal(existsSync(store.pathOf(ref.hash)), false);
  } finally {
    cleanup();
  }
});

test("blob: a sweep interrupted after the unlink (row still deleting, file gone) is finished", async () => {
  const clock = new Date("2026-03-01T00:00:00Z");
  const { store, storage, cleanup } = await setupBlobs({ now: () => clock });
  try {
    const ref = await store.ingest(chunks(bytes(100)), { durable: false, media_type: "a/b" });
    storage.exec(`UPDATE blob SET state = 'deleting' WHERE hash = '${ref.hash}'`);
    chmodSync(store.pathOf(ref.hash), 0o644);
    await nodeBlobFs.unlink(store.pathOf(ref.hash));
    const r = await store.sweep({ now: clock });
    assert.deepEqual(r.finished, [ref.hash]);
    assert.equal(rowCount(storage), 0);
  } finally {
    cleanup();
  }
});

test("blob: ingesting the bytes of a blob marked deleting revives it", async () => {
  const clock = new Date("2026-03-01T00:00:00Z");
  const { store, storage, cleanup } = await setupBlobs({ now: () => clock });
  try {
    const data = bytes(100);
    const ref = await store.ingest(chunks(data), { durable: false, media_type: "a/b" });
    storage.exec(`UPDATE blob SET state = 'deleting' WHERE hash = '${ref.hash}'`);
    await store.ingest(chunks(data), { durable: false, media_type: "a/b" });
    assert.equal(rowOf(storage, ref.hash)?.state, "present");
    const r = await store.sweep({ now: new Date(clock.getTime() + 1 * HOUR) });
    assert.deepEqual(r.removed, []);
  } finally {
    cleanup();
  }
});

test("blob: a row marked deleting that is rooted again, file still present, is kept", async () => {
  const clock = new Date("2026-03-01T00:00:00Z");
  const { store, storage, cleanup } = await setupBlobs({ now: () => clock });
  try {
    const ref = await store.ingest(chunks(bytes(100)), { durable: false, media_type: "a/b" });
    storage.exec(`UPDATE blob SET state = 'deleting' WHERE hash = '${ref.hash}'`);
    store.registerRootProvider(rooted(ref.hash));
    const r = await store.sweep({ now: new Date(clock.getTime() + 48 * HOUR) });
    assert.deepEqual(r.removed, []);
    assert.equal(rowOf(storage, ref.hash)?.state, "present");
  } finally {
    cleanup();
  }
});

test("blob: a rowless file that is rooted is kept even when old; stale tmp files go after grace", async () => {
  const { t, store, cleanup } = await setupBlobs();
  try {
    const crash = spyFs((c) => {
      if (c.op === "rename") throw new Error("crash");
    });
    const second = await setupBlobs({ fs: crash.fs });
    try {
      const data = bytes(300);
      await assert.rejects(second.store.ingest(chunks(data), { durable: false, media_type: "a/b" }));
      second.store.registerRootProvider(rooted(sha(data)));
      const far = new Date(Date.now() + 100 * HOUR);
      const r = await second.store.sweep({ now: far });
      assert.deepEqual(r.rowlessRemoved, []);
      assert.ok(existsSync(second.store.pathOf(sha(data))));
    } finally {
      second.cleanup();
    }
    // a temporary file a crash left behind
    await nodeBlobFs.mkdirp(join(t.dir, "tmp"));
    const stale = join(t.dir, "tmp", "left-over");
    writeFileSync(stale, "x");
    const old = new Date("2026-01-01T00:00:00Z");
    utimesSync(stale, old, old);
    const young = await store.sweep({ now: new Date("2026-01-01T12:00:00Z") });
    assert.deepEqual(young.tmpRemoved, []);
    const r = await store.sweep({ now: new Date("2026-01-03T00:00:00Z") });
    assert.deepEqual(r.tmpRemoved, ["left-over"]);
  } finally {
    cleanup();
  }
});

test("blob: a failing root provider aborts the sweep before anything is removed; a non-hash root is refused", async () => {
  const clock = new Date("2026-03-01T00:00:00Z");
  const { store, storage, cleanup } = await setupBlobs({ now: () => clock });
  try {
    const ref = await store.ingest(chunks(bytes(100)), { durable: false, media_type: "a/b" });
    store.registerRootProvider({
      name: "broken",
      blobRoots: () => Promise.reject(new Error("provider down")),
    });
    const later = new Date(clock.getTime() + 48 * HOUR);
    await assert.rejects(store.sweep({ now: later }), /root provider broken failed/);
    assert.ok(rowOf(storage, ref.hash));
    assert.ok(existsSync(store.pathOf(ref.hash)));
  } finally {
    cleanup();
  }
  const bad = await setupBlobs({ now: () => clock });
  try {
    bad.store.registerRootProvider(rooted("not-a-hash"));
    await assert.rejects(bad.store.sweep({ now: clock }), /non-hash/);
  } finally {
    bad.cleanup();
  }
});

test("blob: a root provider may be asynchronous", async () => {
  const clock = new Date("2026-03-01T00:00:00Z");
  const { store, cleanup } = await setupBlobs({ now: () => clock });
  try {
    const ref = await store.ingest(chunks(bytes(100)), { durable: false, media_type: "a/b" });
    store.registerRootProvider({ name: "async", blobRoots: async () => new Set([ref.hash]) });
    const r = await store.sweep({ now: new Date(clock.getTime() + 48 * HOUR) });
    assert.deepEqual(r.removed, []);
  } finally {
    cleanup();
  }
});
