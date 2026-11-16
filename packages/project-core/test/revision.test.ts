import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalJson, type JsonValue, newEntityId, sha256Hex } from "@cutroom/foundations";
import {
  type EntityDocument,
  MigrationRegistry,
  openDatabase,
  REVISION_CODES,
  REVISION_MIGRATIONS,
  type RevisionStore,
  type Storage,
  RevisionStore as Store,
} from "../src/index.js";
import { SETTINGS, spyDriver, tempSpace } from "./storage-helpers.js";

type Opts = { driver?: Parameters<typeof openDatabase>[1]["driver"] };

// Number 1 belongs to M0-07's `blob` table; a placeholder keeps the shared sequence gap-free here.
function registry(): MigrationRegistry {
  const r = new MigrationRegistry();
  r.registerMigrations("test", [{ number: 1, name: "placeholder", sql: "SELECT 1" }]);
  r.registerMigrations("project-core", REVISION_MIGRATIONS);
  return r;
}

async function withStore(
  fn: (s: RevisionStore, storage: Storage) => Promise<void>,
  opts: Opts = {},
): Promise<void> {
  const space = tempSpace();
  const r = await openDatabase(space.db, { ...SETTINGS, migrations: registry(), ...opts });
  assert.equal(r.ok, true, JSON.stringify(r));
  if (!r.ok) throw new Error("unreachable");
  try {
    await fn(new Store(r.value), r.value);
  } finally {
    r.value.close();
    space.cleanup();
  }
}

const project = newEntityId();
const doc = (id: string, extra: Record<string, JsonValue> = {}): EntityDocument => ({
  id,
  kind: "shot",
  v: 1,
  handle: "shot1",
  ...extra,
});

async function genesis(s: RevisionStore): Promise<string> {
  const e = await s.putEntityVersion(doc(project, { kind: "project" }));
  const rev = await s.putRevision({
    project,
    parents: [],
    entities: { [project]: e.hash },
    origin: "genesis",
  });
  return rev.revision_id;
}

test("revision: codes are listed and each is asserted below", () => {
  assert.deepEqual([...REVISION_CODES], ["STALE_BASE", "UNKNOWN_REVISION", "UNKNOWN_BRANCH"]);
});

test("revision: same content gives the same ID; time is not hashed", async () => {
  await withStore(async (_s, storage) => {
    let t = 0;
    const s = new Store(storage, { now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, t++)) });
    const e = await s.putEntityVersion(doc(project));
    const a = await s.putRevision({
      project,
      parents: [],
      entities: { [project]: e.hash },
      origin: "genesis",
    });
    const b = await s.putRevision({
      project,
      parents: [],
      entities: { [project]: e.hash },
      origin: "genesis",
    });
    assert.equal(a.revision_id, b.revision_id);
    assert.match(a.revision_id, /^rev_[0-9a-f]{64}$/);
    const n = storage.prepare("SELECT count(*) AS n FROM revision").get();
    assert.equal(Number(n?.n), 1);
    // the first created_at stays
    const rec = s.getRevision(a.revision_id);
    assert.ok(rec.ok && rec.value.created_at === "2026-01-01T00:00:00.000Z");
  });
});

test("revision: new parents give a new ID and the same tree_hash (retry same, rollback new)", async () => {
  await withStore(async (s) => {
    const e = await s.putEntityVersion(doc(project));
    const entities = { [project]: e.hash };
    const g = await s.putRevision({ project, parents: [], entities, origin: "genesis" });
    const p1 = await s.putRevision({ project, parents: [g.revision_id], entities, origin: "patch" });
    const p1again = await s.putRevision({ project, parents: [g.revision_id], entities, origin: "merge" });
    const p2 = await s.putRevision({ project, parents: [p1.revision_id], entities, origin: "restore" });
    assert.equal(p1.revision_id, p1again.revision_id);
    assert.notEqual(g.revision_id, p1.revision_id);
    assert.notEqual(p1.revision_id, p2.revision_id);
    assert.equal(g.tree_hash, p1.tree_hash);
    assert.equal(p1.tree_hash, p2.tree_hash);
    // tree_hash covers only the entity map
    assert.equal(g.tree_hash, `sha256:${sha256Hex(canonicalJson(entities))}`);
  });
});

test("revision: pin_hash ignores commitment.readiness and equals hash without a commitment", async () => {
  await withStore(async (s) => {
    const c = (readiness: string) => ({ readiness, assumptions: ["a"], unknowns: [] });
    const prov = await s.putEntityVersion(doc(project, { commitment: c("provisional") }));
    const frozen = await s.putEntityVersion(doc(project, { commitment: c("frozen") }));
    assert.notEqual(prov.hash, frozen.hash);
    assert.equal(prov.pin_hash, frozen.pin_hash);
    const other = await s.putEntityVersion(
      doc(project, { commitment: { ...c("frozen"), assumptions: ["b"] } }),
    );
    assert.notEqual(other.pin_hash, frozen.pin_hash);
    const plain = await s.putEntityVersion(doc(project));
    assert.equal(plain.pin_hash, plain.hash);
  });
});

test("revision: putEntityVersion is idempotent and insert-only; version_blob rows follow", async () => {
  await withStore(async (s, storage) => {
    const b1 = `sha256:${"1".repeat(64)}`;
    const b2 = `sha256:${"2".repeat(64)}`;
    const a = await s.putEntityVersion(doc(project), [b1, b2]);
    const b = await s.putEntityVersion(doc(project), [b1]);
    assert.deepEqual(a, b);
    assert.equal(Number(storage.prepare("SELECT count(*) AS n FROM entity_version").get()?.n), 1);
    assert.deepEqual([...(await s.blobRootProvider().blobRoots())], [b1, b2]);
    assert.equal(s.blobRootProvider().name, "version_blob");
    assert.throws(() => storage.prepare("UPDATE entity_version SET kind = 'x'").run(), /insert-only/);
    assert.throws(() => storage.prepare("DELETE FROM entity_version").run(), /insert-only/);
    await assert.rejects(s.putEntityVersion(doc(project), ["nope"]), TypeError);
    await assert.rejects(s.putEntityVersion({ kind: "shot", v: 1 } as never), TypeError);
  });
});

test("revision: the stored manifest re-hashes to its ID", async () => {
  await withStore(async (s) => {
    const e = await s.putEntityVersion(doc(project));
    const r = await s.putRevision({
      project,
      parents: [],
      entities: { [project]: e.hash },
      origin: "genesis",
    });
    const rec = s.getRevision(r.revision_id);
    assert.ok(rec.ok);
    if (!rec.ok) return;
    assert.equal(`rev_${sha256Hex(rec.value.manifest)}`, r.revision_id);
    assert.equal(rec.value.manifest, canonicalJson(JSON.parse(rec.value.manifest)));
    const u = s.getRevision(`rev_${"0".repeat(64)}`);
    assert.ok(!u.ok && u.diagnostics[0]?.code === "UNKNOWN_REVISION");
  });
});

test("revision: branches, and UNKNOWN_BRANCH / UNKNOWN_REVISION", async () => {
  await withStore(async (s) => {
    const g = await genesis(s);
    const b = await s.createBranch({ name: "main", head: g, type: "accepted" });
    assert.ok(b.ok && b.value.state === "open" && b.value.head === g && b.value.fork_point === null);
    const w = await s.createBranch({ name: "w/1", head: g, fork_point: g, type: "worker", owner_job: "j" });
    assert.ok(w.ok && w.value.fork_point === g && w.value.owner_job === "j");
    const missing = s.getBranch("nope");
    assert.ok(!missing.ok && missing.diagnostics[0]?.code === "UNKNOWN_BRANCH");
    const bad = await s.createBranch({ name: "x", head: `rev_${"0".repeat(64)}`, type: "worker" });
    assert.ok(!bad.ok && bad.diagnostics[0]?.code === "UNKNOWN_REVISION");
    await assert.rejects(s.createBranch({ name: "main", head: g, type: "accepted" }));
    const snap = s.snapshot(`rev_${"0".repeat(64)}`);
    assert.ok(!snap.ok && snap.diagnostics[0]?.code === "UNKNOWN_REVISION");
  });
});

async function setup(s: RevisionStore, n: number): Promise<string[]> {
  const g = await genesis(s);
  await s.createBranch({ name: "main", head: g, type: "accepted" });
  await s.createBranch({ name: "d/1", head: g, fork_point: g, type: "candidate" });
  const e = await s.putEntityVersion(doc(project));
  const ids = [g];
  for (let i = 0; i < n; i++) {
    const r = await s.putRevision({
      project,
      parents: [ids[i] as string],
      entities: { [project]: e.hash },
      origin: "patch",
    });
    ids.push(r.revision_id);
  }
  return ids;
}

test("swap: ten swaps give seq 1..10 and the head follows", async () => {
  await withStore(async (s, storage) => {
    const ids = await setup(s, 10);
    for (let i = 0; i < 10; i++) {
      const r = await s.swapAcceptedHead({
        expected_base: ids[i] as string,
        candidate: ids[i + 1] as string,
        from_branch: "d/1",
        decision: null,
        by: "director",
      });
      assert.ok(r.ok);
      if (r.ok) assert.equal(r.value.seq, i + 1);
    }
    const head = s.getBranch("main");
    assert.ok(head.ok && head.value.head === ids[10]);
    const rows = storage.prepare("SELECT seq, revision, previous FROM accepted_log ORDER BY seq").all();
    assert.deepEqual(
      rows.map((r) => Number(r.seq)),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    );
    assert.equal(rows[3]?.previous, ids[3]);
    assert.throws(() => storage.prepare("DELETE FROM accepted_log").run(), /append-only/);
    assert.throws(() => storage.prepare("UPDATE accepted_log SET by = 'x'").run(), /append-only/);
  });
});

test("swap: STALE_BASE changes nothing and reports the current head", async () => {
  await withStore(async (s, storage) => {
    const ids = await setup(s, 3);
    let hookRan = false;
    const r = await s.swapAcceptedHead(
      {
        expected_base: ids[2] as string,
        candidate: ids[3] as string,
        from_branch: "d/1",
        decision: "d",
        by: "x",
      },
      () => {
        hookRan = true;
      },
    );
    assert.ok(!r.ok);
    if (r.ok) return;
    assert.equal(r.diagnostics[0]?.code, "STALE_BASE");
    assert.equal(r.diagnostics[0]?.got, ids[0]);
    assert.equal(hookRan, false);
    assert.equal(Number(storage.prepare("SELECT count(*) AS n FROM accepted_log").get()?.n), 0);
    const head = s.getBranch("main");
    assert.ok(head.ok && head.value.head === ids[0]);
    // the store is still usable and the next seq is 1
    const ok1 = await s.swapAcceptedHead({
      expected_base: ids[0] as string,
      candidate: ids[1] as string,
      from_branch: "d/1",
      decision: null,
      by: "x",
    });
    assert.ok(ok1.ok && ok1.value.seq === 1);
  });
});

test("swap: unknown candidate, branch and missing main are refused without writing", async () => {
  await withStore(async (s, storage) => {
    const ids = await setup(s, 1);
    const base = { expected_base: ids[0] as string, candidate: ids[1] as string, decision: null, by: "x" };
    const a = await s.swapAcceptedHead({ ...base, from_branch: "nope" });
    assert.ok(!a.ok && a.diagnostics[0]?.code === "UNKNOWN_BRANCH");
    const b = await s.swapAcceptedHead({ ...base, candidate: `rev_${"0".repeat(64)}`, from_branch: "d/1" });
    assert.ok(!b.ok && b.diagnostics[0]?.code === "UNKNOWN_REVISION");
    assert.equal(Number(storage.prepare("SELECT count(*) AS n FROM accepted_log").get()?.n), 0);
  });
  await withStore(async (s) => {
    const g = await genesis(s);
    const r = await s.swapAcceptedHead({
      expected_base: g,
      candidate: g,
      from_branch: "main",
      decision: null,
      by: "x",
    });
    assert.ok(!r.ok && r.diagnostics[0]?.code === "UNKNOWN_BRANCH");
  });
});

test("swap: head, log row and hook rows commit together; a throwing hook rolls all back", async () => {
  await withStore(async (s, storage) => {
    storage.exec("CREATE TABLE hook_rows(seq INTEGER, revision TEXT)");
    const ids = await setup(s, 2);
    const input = (i: number) => ({
      expected_base: ids[i] as string,
      candidate: ids[i + 1] as string,
      from_branch: "d/1",
      decision: null,
      by: "x",
    });
    const good = await s.swapAcceptedHead(input(0), (db, info) => {
      db.prepare("INSERT INTO hook_rows VALUES (?, ?)").run(info.seq, info.revision);
    });
    assert.ok(good.ok);
    assert.equal(Number(storage.prepare("SELECT count(*) AS n FROM hook_rows").get()?.n), 1);

    await assert.rejects(
      s.swapAcceptedHead(input(1), (db) => {
        db.prepare("INSERT INTO hook_rows VALUES (99, 'x')").run();
        throw new Error("hook failed");
      }),
      /hook failed/,
    );
    assert.equal(Number(storage.prepare("SELECT count(*) AS n FROM hook_rows").get()?.n), 1);
    assert.equal(Number(storage.prepare("SELECT count(*) AS n FROM accepted_log").get()?.n), 1);
    const head = s.getBranch("main");
    assert.ok(head.ok && head.value.head === ids[1]);
    // an async hook is refused and rolls back too
    await assert.rejects(s.swapAcceptedHead(input(1), (() => Promise.resolve()) as never), TypeError);
    assert.equal(Number(storage.prepare("SELECT count(*) AS n FROM accepted_log").get()?.n), 1);
    const retry = await s.swapAcceptedHead(input(1));
    assert.ok(retry.ok && retry.value.seq === 2);
  });
});

test("swap: one transaction at FULL durability", async () => {
  const { driver, log } = spyDriver();
  await withStore(
    async (s) => {
      const ids = await setup(s, 1);
      await new Promise((r) => setTimeout(r, 60)); // let setup's NORMAL group commit
      log.length = 0;
      const r = await s.swapAcceptedHead({
        expected_base: ids[0] as string,
        candidate: ids[1] as string,
        from_branch: "d/1",
        decision: null,
        by: "x",
      });
      assert.ok(r.ok);
      const begins = log.filter((l) => l === "BEGIN IMMEDIATE").length;
      assert.equal(begins, 1);
      assert.ok(log.indexOf("PRAGMA synchronous=FULL") < log.indexOf("BEGIN IMMEDIATE"));
      assert.ok(log.indexOf("COMMIT") > log.indexOf("BEGIN IMMEDIATE"));
      assert.ok(log.includes("PRAGMA synchronous=NORMAL"));
    },
    { driver },
  );
});

test("snapshot: 800 entities return 800 documents (time reported only)", async () => {
  await withStore(async (s, storage) => {
    const entities: Record<string, string> = {};
    const want = new Map<string, string>();
    await storage.tx(() => undefined);
    for (let i = 0; i < 800; i++) {
      const id = newEntityId();
      const d = { id, kind: "shot", v: 1, handle: `shot${i}`, text: "x".repeat(500) };
      const e = await s.putEntityVersion(d);
      entities[id] = e.hash;
      want.set(id, e.hash);
    }
    const r = await s.putRevision({ project, parents: [], entities, origin: "genesis" });
    const t0 = performance.now();
    const snap = s.snapshot(r.revision_id);
    const ms = performance.now() - t0;
    console.log(`snapshot of 800 entities: ${ms.toFixed(2)} ms (reported only)`);
    assert.ok(snap.ok);
    if (!snap.ok) return;
    assert.equal(snap.value.length, 800);
    for (const e of snap.value) {
      assert.equal(e.hash, want.get(e.entity_id));
      assert.equal(e.doc.id, e.entity_id);
    }
  });
});

test("snapshot: a manifest entry with no stored document throws", async () => {
  await withStore(async (s) => {
    const r = await s.putRevision({
      project,
      parents: [],
      entities: { [project]: `sha256:${"a".repeat(64)}` },
      origin: "genesis",
    });
    assert.throws(() => s.snapshot(r.revision_id), /not stored/);
  });
});

test("revision: malformed manifest input is refused", async () => {
  await withStore(async (s) => {
    await assert.rejects(
      s.putRevision({ project: "p", parents: [], entities: {}, origin: "genesis" }),
      TypeError,
    );
    await assert.rejects(
      s.putRevision({ project, parents: ["x"], entities: {}, origin: "genesis" }),
      TypeError,
    );
    await assert.rejects(
      s.putRevision({ project, parents: [], entities: { [project]: "h" }, origin: "genesis" }),
      TypeError,
    );
  });
});
