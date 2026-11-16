import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { SettingsRegistry } from "@cutroom/foundations";
import {
  BUSY_TIMEOUT_MS,
  type Driver,
  isCorruption,
  isOldSqlite,
  MigrationRegistry,
  type MigrationScript,
  nodeSqliteDriver,
  openDatabase,
  PROJECT_CORE_SETTINGS,
  resolveWriterSettings,
  STORAGE_CODES,
} from "../src/index.js";
import { SETTINGS, spyDriver, tempSpace } from "./storage-helpers.js";

async function open(path: string, extra: Partial<Parameters<typeof openDatabase>[1]> = {}) {
  const r = await openDatabase(path, { ...SETTINGS, ...extra });
  assert.equal(r.ok, true, JSON.stringify(r));
  if (!r.ok) throw new Error("unreachable");
  return r.value;
}

const pragma = (s: { prepare(sql: string): { get(): unknown } }, name: string) =>
  Object.values(s.prepare(`PRAGMA ${name}`).get() as Record<string, unknown>)[0];

test("storage: every code is listed", () => {
  assert.deepEqual(
    [...STORAGE_CODES],
    ["SQLITE_TOO_OLD", "DB_DAMAGED", "MIGRATION_FAILED", "SPACE_MOUNT_REFUSED", "SPACE_MOUNT_UNKNOWN"],
  );
});

test("storage: only driver.ts names node:sqlite or its classes", () => {
  const dir = new URL("../../src/", import.meta.url);
  const hits: string[] = [];
  const walk = (u: URL) => {
    for (const e of readdirSync(u, { withFileTypes: true })) {
      const child = new URL(e.name + (e.isDirectory() ? "/" : ""), u);
      if (e.isDirectory()) walk(child);
      else if (e.name.endsWith(".ts") && e.name !== "driver.ts") {
        const text = readFileSync(child, "utf8");
        // Comments may mention the module; code may not.
        const code = text.replace(/\/\/.*$/gm, "");
        if (/node:sqlite|DatabaseSync|new Database\b/.test(code)) hits.push(e.name);
      }
    }
  };
  walk(dir);
  assert.deepEqual(hits, []);
});

test("storage: the Node class names (Database and DatabaseSync, same class on Node 26)", async () => {
  const sqlite = await import("node:sqlite");
  const names = Object.keys(sqlite);
  assert.ok(names.includes("DatabaseSync"));
  if (names.includes("Database")) {
    assert.equal((sqlite as unknown as Record<string, unknown>).Database, sqlite.DatabaseSync);
  }
  console.log(`node:sqlite exports: ${names.join(", ")}`);
});

test("storage: pragmas read back (wal, foreign keys 1, timeout 5,000, NORMAL)", async () => {
  const t = tempSpace();
  try {
    const s = await open(t.db);
    assert.equal(pragma(s, "journal_mode"), "wal");
    assert.equal(pragma(s, "foreign_keys"), 1);
    assert.equal(pragma(s, "busy_timeout"), 5000);
    assert.equal(BUSY_TIMEOUT_MS, 5000);
    assert.equal(pragma(s, "synchronous"), 1); // NORMAL
    s.close();
    const f = await open(t.db, { synchronous: "FULL" });
    assert.equal(pragma(f, "synchronous"), 2);
    f.close();
  } finally {
    t.cleanup();
  }
});

test("storage: STRICT tables reject a wrong type through the adapter", async () => {
  const t = tempSpace();
  try {
    const s = await open(t.db);
    s.exec("CREATE TABLE p (n INTEGER) STRICT");
    assert.throws(() => s.prepare("INSERT INTO p VALUES (?)").run("text"), /cannot store TEXT/);
    s.close();
  } finally {
    t.cleanup();
  }
});

test("storage: a read-only connection opens, reads and cannot write", async () => {
  const t = tempSpace();
  try {
    const w = await open(t.db);
    w.exec("CREATE TABLE p (n INTEGER) STRICT");
    await w.tx((db) => db.exec("INSERT INTO p VALUES (1)"));
    const r = await open(t.db, { readonly: true });
    assert.equal((r.prepare("SELECT count(*) AS c FROM p").get() as { c: number }).c, 1);
    assert.throws(() => r.exec("INSERT INTO p VALUES (2)"));
    await assert.rejects(
      r.tx(() => 1),
      /read-only/,
    );
    r.close();
    w.close();
  } finally {
    t.cleanup();
  }
});

test("storage: SQLite 3.51.2 (faked) is refused with SQLITE_TOO_OLD, 3.51.3 is not", async () => {
  const t = tempSpace();
  try {
    const old = spyDriver("3.51.2");
    const r = await openDatabase(t.db, { ...SETTINGS, driver: old.driver });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.diagnostics[0]?.code, "SQLITE_TOO_OLD");
      assert.equal(r.diagnostics[0]?.got, "3.51.2");
    }
    const edge = await openDatabase(t.db, { ...SETTINGS, driver: spyDriver("3.51.3").driver });
    assert.equal(edge.ok, true);
    if (edge.ok) edge.value.close();
    assert.equal(isOldSqlite("3.9.9"), true);
    assert.equal(isOldSqlite("3.54.1"), false);
    assert.equal(isOldSqlite("4.0.0"), false);
    assert.equal(isOldSqlite("garbage"), true);
  } finally {
    t.cleanup();
  }
});

test("storage: a file that is not a database gives DB_DAMAGED with the output", async () => {
  const t = tempSpace();
  try {
    writeFileSync(t.db, "this is not a sqlite database, ".repeat(200));
    const r = await openDatabase(t.db, SETTINGS);
    assert.equal(r.ok, false);
    if (!r.ok) {
      const d = r.diagnostics[0];
      assert.equal(d?.code, "DB_DAMAGED");
      const got = d?.got as { quick_check: string[]; newest_backup: string | null };
      assert.ok(got.quick_check.length > 0 && got.quick_check[0] !== "ok");
      assert.equal(got.newest_backup, null);
    }
  } finally {
    t.cleanup();
  }
});

test("storage: a corrupted page gives DB_DAMAGED with the quick_check output and names the newest backup", async () => {
  const t = tempSpace();
  try {
    const s = await open(t.db);
    s.exec("CREATE TABLE p (id INTEGER PRIMARY KEY, v TEXT) STRICT; CREATE INDEX pv ON p(v)");
    await s.tx((db) => {
      const ins = db.prepare("INSERT INTO p (v) VALUES (?)");
      for (let i = 0; i < 2000; i++) ins.run(`value-${i}-${"x".repeat(40)}`);
    });
    mkdirSync(join(t.dir, "backups"));
    const backup = join(t.dir, "backups", "pre-migration-20260101T000000000Z-v0.sqlite");
    await s.backup(backup);
    s.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    s.close();
    const bytes = readFileSync(t.db);
    // Overwrite pages 3 to 6 (index and table leaves) with garbage, leaving the header page intact.
    for (let i = 4096 * 2; i < 4096 * 6 && i < bytes.length; i++) bytes[i] = 0xff;
    writeFileSync(t.db, bytes);
    const r = await openDatabase(t.db, SETTINGS);
    assert.equal(r.ok, false);
    if (!r.ok) {
      const d = r.diagnostics[0];
      assert.equal(d?.code, "DB_DAMAGED");
      const got = d?.got as { quick_check: string[]; newest_backup: string | null };
      assert.ok(got.quick_check.length > 0 && got.quick_check[0] !== "ok");
      assert.equal(got.newest_backup, backup);
    }
  } finally {
    t.cleanup();
  }
});

const m = (number: number, name: string, sql: string): MigrationScript => ({ number, name, sql });

test("migrations: run in order after a backup in backups/, one shared user_version", async () => {
  const t = tempSpace();
  try {
    const reg = new MigrationRegistry();
    // Registered out of order and by two owners.
    reg.registerMigrations("scheduler", [m(2, "job", "CREATE TABLE job (id INTEGER PRIMARY KEY) STRICT")]);
    reg.registerMigrations("project-core", [
      m(1, "event", "CREATE TABLE event (seq INTEGER PRIMARY KEY) STRICT"),
      m(3, "later", "INSERT INTO job (id) VALUES (7)"),
    ]);
    const s = await open(t.db, { migrations: reg, now: () => new Date("2026-11-16T10:15:00.123Z") });
    assert.equal(s.userVersion, 3);
    assert.equal((s.prepare("SELECT id FROM job").get() as { id: number }).id, 7);
    const files = readdirSync(join(t.dir, "backups"));
    assert.deepEqual(files, ["pre-migration-20261116T101500123Z-v0.sqlite"]);
    s.close();

    // A second open with a newer script backs up at user_version 3 and applies only the new one.
    reg.registerMigrations("scheduler", [m(4, "more", "CREATE TABLE more (id INTEGER PRIMARY KEY) STRICT")]);
    const again = await open(t.db, { migrations: reg, now: () => new Date("2026-11-16T10:16:00.000Z") });
    assert.equal(again.userVersion, 4);
    assert.deepEqual(readdirSync(join(t.dir, "backups")).sort(), [
      "pre-migration-20261116T101500123Z-v0.sqlite",
      "pre-migration-20261116T101600000Z-v3.sqlite",
    ]);
    again.close();

    // Nothing pending: no new backup.
    const third = await open(t.db, { migrations: reg });
    assert.equal(readdirSync(join(t.dir, "backups")).length, 2);
    third.close();
  } finally {
    t.cleanup();
  }
});

test("migrations: a failing script gives MIGRATION_FAILED and leaves user_version unchanged", async () => {
  const t = tempSpace();
  try {
    const good = new MigrationRegistry();
    good.registerMigrations("project-core", [
      m(1, "event", "CREATE TABLE event (seq INTEGER PRIMARY KEY) STRICT"),
    ]);
    (await open(t.db, { migrations: good })).close();

    const bad = new MigrationRegistry();
    bad.registerMigrations("project-core", [
      m(1, "event", "CREATE TABLE event (seq INTEGER PRIMARY KEY) STRICT"),
    ]);
    bad.registerMigrations("scheduler", [
      m(2, "ok", "CREATE TABLE a (id INTEGER) STRICT"),
      m(3, "broken", "CREATE TABLE b (id INTEGER) STRICT; INSERT INTO nowhere VALUES (1)"),
    ]);
    const r = await openDatabase(t.db, { ...SETTINGS, migrations: bad });
    assert.equal(r.ok, false);
    if (!r.ok) {
      const d = r.diagnostics[0];
      assert.equal(d?.code, "MIGRATION_FAILED");
      const got = d?.got as { owner: string; script: string; error: string };
      assert.equal(got.owner, "scheduler");
      assert.equal(got.script, "broken");
      assert.match(got.error, /nowhere/);
    }
    const check = await open(t.db, { readonly: true });
    assert.equal(check.userVersion, 1);
    // Neither table of the rolled-back transaction exists.
    const tables = check.prepare("SELECT name FROM sqlite_master WHERE name IN ('a','b')").all();
    assert.equal(tables.length, 0);
    check.close();
  } finally {
    t.cleanup();
  }
});

test("migrations: a gap or a duplicate script number is refused before any backup", async () => {
  const t = tempSpace();
  try {
    const gap = new MigrationRegistry();
    gap.registerMigrations("a", [m(1, "one", "SELECT 1")]);
    gap.registerMigrations("b", [m(3, "three", "SELECT 1")]);
    const g = await openDatabase(t.db, { ...SETTINGS, migrations: gap });
    assert.equal(g.ok, false);
    if (!g.ok) assert.match(JSON.stringify(g.diagnostics[0]), /gap/);

    const dup = new MigrationRegistry();
    dup.registerMigrations("a", [m(1, "one", "SELECT 1"), m(2, "two", "SELECT 1")]);
    dup.registerMigrations("b", [m(2, "two-again", "SELECT 1")]);
    const d = await openDatabase(t.db, { ...SETTINGS, migrations: dup });
    assert.equal(d.ok, false);
    if (!d.ok) {
      assert.equal(d.diagnostics[0]?.code, "MIGRATION_FAILED");
      assert.match(JSON.stringify(d.diagnostics[0]), /duplicate/);
    }
    assert.equal(readdirSync(t.dir).includes("backups"), false);
  } finally {
    t.cleanup();
  }
});

test("migrations: a database newer than this build is refused", async () => {
  const t = tempSpace();
  try {
    const two = new MigrationRegistry();
    two.registerMigrations("a", [m(1, "one", "SELECT 1"), m(2, "two", "SELECT 1")]);
    (await open(t.db, { migrations: two })).close();
    const one = new MigrationRegistry();
    one.registerMigrations("a", [m(1, "one", "SELECT 1")]);
    const r = await openDatabase(t.db, { ...SETTINGS, migrations: one });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.diagnostics[0]?.code, "MIGRATION_FAILED");
  } finally {
    t.cleanup();
  }
});

test("storage: a second writer fails busy (errcode 5)", async () => {
  const t = tempSpace();
  try {
    const first = await open(t.db);
    const second = await open(t.db);
    second.exec("PRAGMA busy_timeout=50"); // keep the test fast; the real value is read back above
    first.exec("BEGIN IMMEDIATE");
    await assert.rejects(
      second.tx(() => 1),
      (e: { errcode?: number }) => e.errcode === 5,
    );
    first.exec("ROLLBACK");
    first.close();
    second.close();
  } finally {
    t.cleanup();
  }
});

test("storage: backup(path) copies committed and pending writes", async () => {
  const t = tempSpace();
  try {
    const s = await open(t.db);
    s.exec("CREATE TABLE p (n INTEGER) STRICT");
    const pending = s.tx((db) => db.exec("INSERT INTO p VALUES (1)"));
    const copy = join(t.dir, "copy.sqlite");
    await s.backup(copy);
    await pending;
    const c = await open(copy, { readonly: true });
    assert.equal((c.prepare("SELECT count(*) AS c FROM p").get() as { c: number }).c, 1);
    c.close();
    s.close();
  } finally {
    t.cleanup();
  }
});

test("settings: the writer reads db.synchronous and db.commit_tick_ms from a registry", () => {
  const reg = new SettingsRegistry();
  assert.equal(reg.register("project-core", PROJECT_CORE_SETTINGS).ok, true);
  const missing = resolveWriterSettings(reg);
  assert.equal(missing.ok, false);
  // R5 registers db.commit_tick_ms; a fixture record stands in for it here.
  assert.equal(
    reg.register("scheduler", [
      {
        name: "db.commit_tick_ms",
        owner: "scheduler",
        type: "integer",
        default: 20,
        override_by: "human",
        range: { kind: "number_range", min: 1, max: Number.MAX_SAFE_INTEGER },
      },
    ]).ok,
    true,
  );
  const got = resolveWriterSettings(reg);
  assert.deepEqual(got.ok && got.value, { synchronous: "NORMAL", commitTickMs: 20 });
});

test("storage: an error from quick_check that is not corruption is not DB_DAMAGED", async () => {
  const t = tempSpace();
  try {
    const busy = Object.assign(new Error("database is locked"), { errcode: 5 });
    const driver: Driver = {
      open(path, options) {
        const real = nodeSqliteDriver.open(path, options);
        return {
          exec: (sql) => real.exec(sql),
          prepare: (sql) => {
            if (sql === "PRAGMA quick_check") throw busy;
            return real.prepare(sql);
          },
          get isTransaction() {
            return real.isTransaction;
          },
          sqliteVersion: () => real.sqliteVersion(),
          backupTo: (d) => real.backupTo(d),
          close: () => real.close(),
        };
      },
    };
    await assert.rejects(openDatabase(t.db, { ...SETTINGS, driver }), (e: Error) => e === busy);
    assert.equal(isCorruption(Object.assign(new Error("x"), { errcode: 11 })), true);
    assert.equal(isCorruption(Object.assign(new Error("x"), { errcode: 267 })), true); // SQLITE_CORRUPT_VTAB
    assert.equal(isCorruption(Object.assign(new Error("x"), { errcode: 26 })), true);
    assert.equal(isCorruption(Object.assign(new Error("x"), { errcode: 5 })), false);
    assert.equal(isCorruption(new Error("no code")), false);
  } finally {
    t.cleanup();
  }
});
