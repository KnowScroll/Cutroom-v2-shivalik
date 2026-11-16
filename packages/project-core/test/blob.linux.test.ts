import assert from "node:assert/strict";
import { chmodSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import { bytes, chunks, setupBlobs } from "./blob-helpers.js";

test("blob (linux): a durable ingest with real fsync on files and directories, mode 0444 after rename", async () => {
  const { store, cleanup } = await setupBlobs();
  try {
    const data = bytes(1_048_576);
    const ref = await store.ingest(chunks(data), { durable: true, media_type: "a/b" });
    const path = store.pathOf(ref.hash);
    assert.equal(statSync(path).mode & 0o777, 0o444);
    assert.deepEqual(readFileSync(path), Buffer.from(data));
    if (process.getuid?.() !== 0) {
      assert.throws(() => writeFileSync(path, "x"), /EACCES/);
    }
  } finally {
    cleanup();
  }
});

test("blob (linux): re-ingesting good bytes over a truncated read-only file replaces it atomically", async () => {
  const { store, cleanup } = await setupBlobs();
  try {
    const data = bytes(4000);
    const ref = await store.ingest(chunks(data), { durable: false, media_type: "a/b" });
    const path = store.pathOf(ref.hash);
    chmodSync(path, 0o644);
    writeFileSync(path, bytes(10));
    chmodSync(path, 0o444);
    await store.ingest(chunks(data), { durable: false, media_type: "a/b" });
    assert.deepEqual(readFileSync(path), Buffer.from(data));
    assert.equal(statSync(path).mode & 0o777, 0o444);
    assert.equal((await store.open(ref, { purpose: "final_render" })).ok, true);
  } finally {
    cleanup();
  }
});
