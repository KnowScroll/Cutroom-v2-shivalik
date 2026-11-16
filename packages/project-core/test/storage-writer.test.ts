import assert from "node:assert/strict";
import { test } from "node:test";
import { type OpenOptions, openDatabase, type Storage } from "../src/index.js";
import { SETTINGS, spyDriver, tempSpace } from "./storage-helpers.js";

async function setup(extra: Partial<OpenOptions> = {}) {
  const t = tempSpace();
  const spy = spyDriver();
  const r = await openDatabase(t.db, { ...SETTINGS, driver: spy.driver, ...extra });
  if (!r.ok) throw new Error(JSON.stringify(r));
  const s: Storage = r.value;
  s.exec("CREATE TABLE p (n INTEGER) STRICT");
  spy.log.length = 0;
  return { s, log: spy.log, t };
}

const count = (s: Storage) => (s.prepare("SELECT count(*) AS c FROM p").get() as { c: number }).c;
const commits = (log: string[]) => log.filter((l) => l === "COMMIT").length;

test("writer: ten transactions in one tick make one COMMIT, each promise resolving after it", async () => {
  const { s, log, t } = await setup();
  try {
    const promises: Promise<number>[] = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        s
          .tx((db) => {
            db.prepare("INSERT INTO p VALUES (?)").run(i);
            return i;
          })
          .then((v) => {
            log.push(`resolved:${v}`);
            return v;
          }),
      );
    }
    assert.equal(commits(log), 0, "nothing commits before the tick");
    assert.equal(log.filter((l) => l === "BEGIN IMMEDIATE").length, 1);
    assert.equal(log.filter((l) => l.startsWith("SAVEPOINT")).length, 9, "later members join in savepoints");
    assert.deepEqual(await Promise.all(promises), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.equal(commits(log), 1);
    const commitAt = log.indexOf("COMMIT");
    for (let i = 0; i < 10; i++)
      assert.ok(log.indexOf(`resolved:${i}`) > commitAt, `resolved:${i} after COMMIT`);
    assert.equal(count(s), 10);
  } finally {
    s.close();
    t.cleanup();
  }
});

test("writer: members arriving in different ticks make separate groups, committed in separate turns", async () => {
  const { s, log, t } = await setup();
  try {
    const a = s.tx((db) => db.exec("INSERT INTO p VALUES (1)"));
    await a;
    log.push("turn-boundary");
    const b = s.tx((db) => db.exec("INSERT INTO p VALUES (2)"));
    await b;
    assert.equal(commits(log), 2);
    assert.ok(log.indexOf("turn-boundary") > log.indexOf("COMMIT"));
    assert.ok(log.lastIndexOf("COMMIT") > log.indexOf("turn-boundary"));
  } finally {
    s.close();
    t.cleanup();
  }
});

test("writer: commits never run inside the caller's turn, so a flood cannot freeze the loop (b2b run A)", async () => {
  const { s, log, t } = await setup();
  try {
    const turn: Promise<unknown>[] = [];
    for (let i = 0; i < 500; i++) turn.push(s.tx((db) => db.exec(`INSERT INTO p VALUES (${i})`)));
    assert.equal(commits(log), 0);
    let yielded = false;
    setImmediate(() => {
      yielded = true;
    });
    // The loop is free to run other callbacks before the group's timer commits.
    await new Promise((r) => setTimeout(r, 1));
    assert.equal(yielded, true);
    await Promise.all(turn);
    assert.equal(commits(log), 1);
  } finally {
    s.close();
    t.cleanup();
  }
});

test("writer: a full member arriving while a NORMAL group is open closes it and commits alone at FULL", async () => {
  const { s, log, t } = await setup();
  try {
    const n1 = s.tx((db) => db.exec("INSERT INTO p VALUES (1)")).then(() => log.push("n1 resolved"));
    const n2 = s.tx((db) => db.exec("INSERT INTO p VALUES (2)")).then(() => log.push("n2 resolved"));
    const f = s
      .tx((db) => db.exec("INSERT INTO p VALUES (3)"), { durability: "full" })
      .then(() => log.push("f resolved"));
    // The NORMAL group committed at once, synchronously, before the full member began.
    const first = log.indexOf("COMMIT");
    const raise = log.indexOf("PRAGMA synchronous=FULL");
    const begins = log.flatMap((l, i) => (l === "BEGIN IMMEDIATE" ? [i] : []));
    assert.equal(begins.length, 2);
    assert.ok(first > -1 && first < raise && raise < (begins[1] as number), "COMMIT, then FULL, then BEGIN");
    assert.equal(commits(log), 1);
    // A later normal member may join the FULL group (still committed at FULL).
    const n3 = s.tx((db) => db.exec("INSERT INTO p VALUES (4)")).then(() => log.push("n3 resolved"));
    await Promise.all([n1, n2, f, n3]);
    assert.equal(commits(log), 2);
    assert.ok(log.indexOf("n1 resolved") > first && log.indexOf("n2 resolved") > first);
    assert.ok(log.indexOf("f resolved") > log.lastIndexOf("COMMIT"));
    assert.ok(log.indexOf("n3 resolved") > log.lastIndexOf("COMMIT"));
    // The level is back at NORMAL (1) after the FULL group.
    assert.equal(log.at(-1) === "n3 resolved" || log.includes("PRAGMA synchronous=NORMAL"), true);
    assert.equal(Object.values(s.prepare("PRAGMA synchronous").get() as Record<string, unknown>)[0], 1);
    assert.equal(count(s), 4);
  } finally {
    s.close();
    t.cleanup();
  }
});

test("writer: a FULL group commits while synchronous is FULL", async () => {
  const { s, t } = await setup();
  try {
    let seen: unknown;
    await s.tx(
      () => {
        // Inside the transaction the level is the one the group was opened at.
        seen = Object.values(s.prepare("PRAGMA synchronous").get() as Record<string, unknown>)[0];
      },
      { durability: "full" },
    );
    assert.equal(seen, 2);
  } finally {
    s.close();
    t.cleanup();
  }
});

test("writer: with db.synchronous=FULL every group is FULL and nothing is closed early", async () => {
  const { s, log, t } = await setup({ synchronous: "FULL" });
  try {
    const a = s.tx((db) => db.exec("INSERT INTO p VALUES (1)"));
    const b = s.tx((db) => db.exec("INSERT INTO p VALUES (2)"), { durability: "full" });
    await Promise.all([a, b]);
    assert.equal(commits(log), 1);
    assert.equal(log.includes("PRAGMA synchronous=FULL"), false, "already FULL, no change");
  } finally {
    s.close();
    t.cleanup();
  }
});

test("writer: a throwing member rolls back alone", async () => {
  const { s, t } = await setup();
  try {
    const a = s.tx((db) => db.exec("INSERT INTO p VALUES (1)"));
    const bad = s.tx((db) => {
      db.exec("INSERT INTO p VALUES (2)");
      throw new Error("member failed");
    });
    const c = s.tx((db) => db.exec("INSERT INTO p VALUES (3)"));
    await assert.rejects(bad, /member failed/);
    await Promise.all([a, c]);
    assert.deepEqual(
      s
        .prepare("SELECT n FROM p ORDER BY n")
        .all()
        .map((r) => r.n),
      [1, 3],
    );
  } finally {
    s.close();
    t.cleanup();
  }
});

test("writer: a SQL error in a member rolls back alone; a first member that throws leaves no open group", async () => {
  const { s, log, t } = await setup();
  try {
    await assert.rejects(
      s.tx((db) => db.exec("INSERT INTO nowhere VALUES (1)")),
      /nowhere/,
    );
    assert.equal(log.at(-1), "ROLLBACK");
    // A fresh group works afterwards.
    await s.tx((db) => db.exec("INSERT INTO p VALUES (5)"));
    assert.equal(count(s), 1);
    const a = s.tx((db) => db.exec("INSERT INTO p VALUES (6)"));
    const bad = s.tx((db) => db.exec("INSERT INTO nowhere VALUES (1)"));
    await assert.rejects(bad, /nowhere/);
    await a;
    assert.equal(count(s), 2);
  } finally {
    s.close();
    t.cleanup();
  }
});

test("writer: an asynchronous member function is refused", async () => {
  const { s, t } = await setup();
  try {
    await assert.rejects(s.tx((async () => 1) as never), /synchronous/);
    assert.equal(count(s), 0);
  } finally {
    s.close();
    t.cleanup();
  }
});

test("writer: close() commits the open group first and resolves its promises", async () => {
  const { s, log, t } = await setup();
  try {
    const p = s.tx((db) => db.exec("INSERT INTO p VALUES (1)"));
    s.close();
    await p;
    assert.equal(commits(log), 1);
    await assert.rejects(
      s.tx(() => 1),
      /closed/,
    );
  } finally {
    t.cleanup();
  }
});

test("writer: whether SQLite lets synchronous change inside a transaction (the observed result)", async () => {
  const { s, t } = await setup();
  try {
    s.exec("BEGIN IMMEDIATE");
    let outcome: string;
    try {
      s.exec("PRAGMA synchronous=FULL");
      const level = Object.values(s.prepare("PRAGMA synchronous").get() as Record<string, unknown>)[0];
      outcome = `allowed; level reads ${level}`;
    } catch (e) {
      outcome = `refused: ${(e as Error).message}`;
    }
    const level = Object.values(s.prepare("PRAGMA synchronous").get() as Record<string, unknown>)[0];
    s.exec("ROLLBACK");
    console.log(`synchronous inside an open transaction: ${outcome}; level after attempt = ${level}`);
    // Observed on SQLite 3.54.1: the statement fails and the level stays at NORMAL (1). The writer's rule
    // holds either way; this assertion pins what was seen so a change is noticed.
    assert.match(outcome, /^refused: Safety level may not be changed inside a transaction/);
    assert.equal(level, 1);
  } finally {
    s.close();
    t.cleanup();
  }
});

test("writer: a non-positive commit tick is refused", async () => {
  const t = tempSpace();
  try {
    await assert.rejects(openDatabase(t.db, { synchronous: "NORMAL", commitTickMs: 0 }), /commit_tick_ms/);
  } finally {
    t.cleanup();
  }
});

function settle(p: Promise<unknown>): () => string {
  let s = "pending";
  p.then(
    () => {
      s = "resolved";
    },
    (e: Error) => {
      s = `rejected(${e.message})`;
    },
  );
  return () => s;
}
const rowsOf = (s: Storage) =>
  s
    .prepare("SELECT n FROM p ORDER BY n")
    .all()
    .map((r) => r.n);
const tick = () => new Promise((r) => setTimeout(r, 80));

test("writer re-entrancy A: a first member that nests a tx then throws loses no member", async () => {
  const { s, t } = await setup();
  try {
    let inner: Promise<unknown> = Promise.resolve();
    const outer = s.tx((db) => {
      db.exec("INSERT INTO p VALUES (1)");
      inner = s.tx((d) => d.exec("INSERT INTO p VALUES (2)"));
      throw new Error("outer failed");
    });
    const so = settle(outer);
    const si = settle(inner);
    await tick();
    assert.equal(so(), "rejected(outer failed)");
    assert.match(si(), /^rejected\(tx called from inside/);
    assert.deepEqual(rowsOf(s), []);
  } finally {
    s.close();
    t.cleanup();
  }
});

test("writer re-entrancy B: a rolled-back later member does not resolve through a nested tx", async () => {
  const { s, t } = await setup();
  try {
    const a = s.tx((db) => db.exec("INSERT INTO p VALUES (1)"));
    let inner: Promise<unknown> = Promise.resolve();
    const outer = s.tx((db) => {
      db.exec("INSERT INTO p VALUES (2)");
      inner = s.tx((d) => d.exec("INSERT INTO p VALUES (3)"));
      throw new Error("outer failed");
    });
    const sa = settle(a);
    const so = settle(outer);
    const si = settle(inner);
    await tick();
    assert.equal(sa(), "resolved");
    assert.equal(so(), "rejected(outer failed)");
    assert.match(si(), /^rejected\(tx called from inside/);
    assert.deepEqual(rowsOf(s), [1]);
  } finally {
    s.close();
    t.cleanup();
  }
});

test("writer re-entrancy C: a nested full tx does not commit a throwing member's partial row", async () => {
  const { s, log, t } = await setup();
  try {
    let inner: Promise<unknown> = Promise.resolve();
    const outer = s.tx((db) => {
      db.exec("INSERT INTO p VALUES (1)");
      inner = s.tx((d) => d.exec("INSERT INTO p VALUES (2)"), { durability: "full" });
      db.exec("INSERT INTO p VALUES (3)");
      throw new Error("outer failed after full inner");
    });
    const so = settle(outer);
    const si = settle(inner);
    await tick();
    assert.equal(so(), "rejected(outer failed after full inner)");
    assert.match(si(), /^rejected\(tx called from inside/);
    assert.deepEqual(rowsOf(s), []);
    assert.equal(commits(log), 0);
  } finally {
    s.close();
    t.cleanup();
  }
});

test("writer: a member that throws makes later tx calls work again (the running flag is reset)", async () => {
  const { s, t } = await setup();
  try {
    await assert.rejects(
      s.tx(() => {
        throw new Error("x");
      }),
      /x/,
    );
    await s.tx((db) => db.exec("INSERT INTO p VALUES (1)"));
    assert.deepEqual(rowsOf(s), [1]);
  } finally {
    s.close();
    t.cleanup();
  }
});

test("writer: a COMMIT failure (deferred foreign key) rejects every member, closes the transaction, and the writer recovers", async () => {
  const { s, t } = await setup();
  try {
    s.exec(
      "CREATE TABLE parent (id INTEGER PRIMARY KEY) STRICT; CREATE TABLE child (pid INTEGER REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED) STRICT",
    );
    const good = s.tx((db) => db.exec("INSERT INTO p VALUES (1)"));
    const bad = s.tx((db) => db.exec("INSERT INTO child VALUES (99)"));
    const sg = settle(good);
    const sb = settle(bad);
    await tick();
    assert.match(sg(), /^rejected\(/);
    assert.match(sb(), /^rejected\(/);
    assert.deepEqual(rowsOf(s), []);
    s.exec("BEGIN");
    s.exec("ROLLBACK"); // would throw if a transaction were still open
    await s.tx((db) => db.exec("INSERT INTO p VALUES (7)"));
    assert.deepEqual(rowsOf(s), [7]);
  } finally {
    s.close();
    t.cleanup();
  }
});
