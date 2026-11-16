import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { openDatabase, PROJECT_CORE_MIGRATIONS } from "@cutroom/project-core";
import { BackupScheduler, CODES, COMMANDS, MAX_SOCKET_PATH_BYTES, runCli, startSpace } from "../src/index.js";
import { buildMigrationRegistry } from "../src/registry.js";
import { loadSettings } from "../src/space.js";
import { EXT4_TABLE, fakeTimers, NINEP_TABLE, oldSqliteDriver, tempDir, testEnv } from "./helpers.js";

const SCHEMA = PROJECT_CORE_MIGRATIONS.length;
const runEnv = (env: ReturnType<typeof testEnv>) => ({
  ...env,
  timers: env.timers,
  onBackupError: () => undefined,
});

test("the CLI's codes are the two the design names", () => {
  assert.deepEqual([...CODES], ["SPACE_IN_USE", "SOCKET_PATH_TOO_LONG"]);
});

test("settings: the registry resolves db.backup_hours and db.backup_keep to the R3 defaults", () => {
  const s = loadSettings();
  assert.equal(s.ok, true);
  if (s.ok) {
    assert.equal(s.value.backupHours, 6);
    assert.equal(s.value.backupKeep, 4);
  }
});

test("new: creates the layout and the database at the current schema", async () => {
  const t = tempDir();
  try {
    const dir = join(t.dir, "space");
    const env = testEnv();
    assert.equal(await runCli(["new", dir], env), 0, env.errLines.join("\n"));
    for (const sub of ["blobs", "tmp", "backups"]) assert.equal(existsSync(join(dir, sub)), true, sub);
    assert.equal(existsSync(join(dir, "space.db")), true);
    const db = await openDatabase(join(dir, "space.db"), {
      synchronous: "NORMAL",
      commitTickMs: 20,
      readonly: true,
    });
    assert.equal(db.ok, true);
    if (db.ok) {
      assert.equal(db.value.userVersion, SCHEMA);
      assert.ok(SCHEMA >= 2);
      db.value.close();
    }
  } finally {
    t.cleanup();
  }
});

test("new: a 9p mount is refused with SPACE_MOUNT_REFUSED and nothing is created", async () => {
  const t = tempDir();
  try {
    const dir = join(t.dir, "not", "created");
    const env = testEnv({ table: NINEP_TABLE, real: "/mnt/c/Users/u/space" });
    assert.equal(await runCli(["new", dir], env), 1);
    const err = env.errLines.join("\n");
    assert.match(err, /SPACE_MOUNT_REFUSED/);
    assert.match(err, /9p/);
    assert.equal(existsSync(join(t.dir, "not")), false);
  } finally {
    t.cleanup();
  }
});

test("new: an unreadable mounts table refuses with SPACE_MOUNT_UNKNOWN", async () => {
  const t = tempDir();
  try {
    const env = testEnv();
    const unreadable = {
      ...env,
      mount: {
        readMounts: () => {
          throw new Error("no /proc/mounts");
        },
      },
    };
    assert.equal(await runCli(["new", join(t.dir, "s")], unreadable), 1);
    assert.match(env.errLines.join("\n"), /SPACE_MOUNT_UNKNOWN/);
    assert.equal(existsSync(join(t.dir, "s")), false);
  } finally {
    t.cleanup();
  }
});

test("new: the default directory is ~/cutroom-space of the injected home", async () => {
  const t = tempDir();
  try {
    const env = testEnv({ home: t.dir });
    assert.equal(await runCli(["new"], env), 0, env.errLines.join("\n"));
    assert.equal(existsSync(join(t.dir, "cutroom-space", "space.db")), true);
  } finally {
    t.cleanup();
  }
});

test("new: an existing Space is not overwritten", async () => {
  const t = tempDir();
  try {
    const env = testEnv();
    assert.equal(await runCli(["new", t.dir], env), 0);
    assert.equal(await runCli(["new", t.dir], env), 1);
    assert.match(env.errLines.join("\n"), /already holds a Space/);
  } finally {
    t.cleanup();
  }
});

test("every D12 command is registered; those not built here exit non-zero naming their milestone", async () => {
  for (const name of ["new", "run", "status", "stop", "say", "events", "pause", "lock", "export", "audit"]) {
    assert.ok(Object.hasOwn(COMMANDS, name), name);
  }
  const unbuilt = { say: "M4", events: "M3", pause: "M4", lock: "M2", export: "M6", audit: "M4" };
  for (const [name, milestone] of Object.entries(unbuilt)) {
    const env = testEnv();
    const status = await runCli([name], env);
    assert.notEqual(status, 0, name);
    assert.match(env.errLines.join("\n"), new RegExp(`milestone ${milestone}`), name);
  }
  const env = testEnv();
  assert.equal(await runCli(["frobnicate"], env), 2);
});

test("status without a process reads the database read-only", async () => {
  const t = tempDir();
  try {
    const env = testEnv();
    assert.equal(await runCli(["new", t.dir], env), 0);
    env.outLines.length = 0;
    assert.equal(await runCli(["status", t.dir], env), 0, env.errLines.join("\n"));
    const s = JSON.parse(env.outLines[0] ?? "{}");
    assert.deepEqual(s, {
      served: false,
      schema_version: SCHEMA,
      accepted_head: null,
      accepted_p: null,
      blob_count: 0,
      blob_bytes: 0,
    });
  } finally {
    t.cleanup();
  }
});

test("status reports the accepted head, the P number, the blob count and bytes", async () => {
  const t = tempDir();
  try {
    const env = testEnv();
    assert.equal(await runCli(["new", t.dir], env), 0);
    const db = await openDatabase(join(t.dir, "space.db"), { synchronous: "NORMAL", commitTickMs: 20 });
    assert.equal(db.ok, true);
    if (!db.ok) return;
    const rev = `rev_${"a".repeat(64)}`;
    await db.value.tx((d) => {
      d.prepare(
        "INSERT INTO revision(id, tree_hash, parents, manifest, origin, created_at) VALUES (?, 'h', '[]', '{}', 'genesis', 't')",
      ).run(rev);
      d.prepare("INSERT INTO branch(name, head, type) VALUES ('main', ?, 'accepted')").run(rev);
      d.prepare(
        "INSERT INTO accepted_log(revision, previous, from_branch, by, at) VALUES (?, ?, 'main', 'human', 't')",
      ).run(rev, rev);
      for (const [hex, size] of [
        ["1", 5],
        ["2", 7],
      ] as const) {
        d.prepare(
          "INSERT INTO blob(hash, size, media_type, durable, state, stored_at) VALUES (?, ?, 'text/plain', 1, 'present', 't')",
        ).run(`sha256:${hex.repeat(64)}`, size);
      }
    });
    db.value.close();
    env.outLines.length = 0;
    assert.equal(await runCli(["status", t.dir], env), 0, env.errLines.join("\n"));
    const s = JSON.parse(env.outLines[0] ?? "{}");
    assert.equal(s.accepted_head, rev);
    assert.equal(s.accepted_p, 1);
    assert.equal(s.blob_count, 2);
    assert.equal(s.blob_bytes, 12);
  } finally {
    t.cleanup();
  }
});

test("stop without a process fails and says so", async () => {
  const t = tempDir();
  try {
    const env = testEnv();
    assert.equal(await runCli(["new", t.dir], env), 0);
    assert.equal(await runCli(["stop", t.dir], env), 1);
    assert.match(env.errLines.join("\n"), /no process serves/);
  } finally {
    t.cleanup();
  }
});

test("run: a socket path over 107 bytes is SOCKET_PATH_TOO_LONG and nothing starts", async () => {
  const t = tempDir();
  try {
    const dir = join(t.dir, "d".repeat(MAX_SOCKET_PATH_BYTES));
    const env = testEnv();
    const r = await startSpace(dir, runEnv(env));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.diagnostics[0]?.code, "SOCKET_PATH_TOO_LONG");
    assert.equal(existsSync(dir), false);
    assert.equal(await runCli(["status", dir], env), 1);
    assert.match(env.errLines.join("\n"), /SOCKET_PATH_TOO_LONG/);
  } finally {
    t.cleanup();
  }
});

test("run: start-up checks the mount first, before anything else", async () => {
  const t = tempDir();
  try {
    const env = testEnv({ table: NINEP_TABLE, real: "/mnt/c/x" });
    const r = await startSpace(join(t.dir, "x".repeat(200)), runEnv(env));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.diagnostics[0]?.code, "SPACE_MOUNT_REFUSED");
    const ok = testEnv({ table: EXT4_TABLE });
    assert.equal(await runCli(["run", join(t.dir, "missing")], ok), 1);
    assert.match(ok.errLines.join("\n"), /no Space at/);
  } finally {
    t.cleanup();
  }
});

test("run: SQLite older than 3.51.3 stops start-up with SQLITE_TOO_OLD", async () => {
  const t = tempDir();
  try {
    assert.equal(await runCli(["new", t.dir], testEnv()), 0);
    const env = testEnv({ driver: oldSqliteDriver("3.40.0") });
    const r = await startSpace(t.dir, runEnv(env));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.diagnostics[0]?.code, "SQLITE_TOO_OLD");
  } finally {
    t.cleanup();
  }
});

test("run: a damaged database is refused with DB_DAMAGED naming the newest backup", async () => {
  const t = tempDir();
  try {
    assert.equal(await runCli(["new", t.dir], testEnv()), 0);
    const backups = join(t.dir, "backups");
    mkdirSync(backups, { recursive: true });
    const newest = join(backups, "periodic-20261116T100000000Z-v2.sqlite");
    writeFileSync(newest, "x");
    writeFileSync(join(t.dir, "space.db"), "this is not a database".repeat(200));
    const env = testEnv();
    assert.equal(await runCli(["run", t.dir], env), 1);
    const err = env.errLines.join("\n");
    assert.match(err, /DB_DAMAGED/);
    assert.ok(err.includes(newest.replace(/\\/g, "\\\\")) || err.includes(newest), err);
  } finally {
    t.cleanup();
  }
});

test("backups: the newest db.backup_keep periodic ones and the newest pre-migration one are kept", async () => {
  const t = tempDir();
  try {
    const env = testEnv();
    assert.equal(await runCli(["new", t.dir], env), 0);
    // `new` made one pre-migration backup; add an older one that must go.
    const backups = join(t.dir, "backups");
    writeFileSync(join(backups, "pre-migration-20200101T000000000Z-v0.sqlite"), "old");
    const settings = loadSettings();
    assert.equal(settings.ok, true);
    const db = await openDatabase(join(t.dir, "space.db"), { synchronous: "NORMAL", commitTickMs: 20 });
    assert.equal(db.ok, true);
    if (!settings.ok || !db.ok) return;
    const timers = fakeTimers();
    const scheduler = new BackupScheduler({
      storage: db.value,
      spaceDir: t.dir,
      hours: settings.value.backupHours,
      keep: settings.value.backupKeep,
      now: () => env.clock,
      timers,
      onError: (e) => assert.fail(String(e)),
    });
    try {
      scheduler.start();
      assert.deepEqual(timers.intervals, [6 * 3_600_000]);
      for (let step = 0; step < 7; step++) {
        env.clock = new Date(Date.UTC(2026, 10, 16, 12 + step * 6));
        await scheduler.backupNow();
      }
      const names = readdirSync(backups).sort();
      const periodic = names.filter((n) => n.startsWith("periodic-"));
      assert.equal(periodic.length, 4);
      assert.match(periodic[0] ?? "", /^periodic-20261117T060000000Z-v2.sqlite$/);
      assert.match(periodic[3] ?? "", /^periodic-20261118T000000000Z-v2.sqlite$/);
      const pre = names.filter((n) => n.startsWith("pre-migration-"));
      assert.equal(pre.length, 1);
      assert.notEqual(pre[0], "pre-migration-20200101T000000000Z-v0.sqlite");
      // The timer path runs the same backup.
      env.clock = new Date(Date.UTC(2026, 10, 19));
      timers.fire();
      await scheduler.stop();
      assert.ok(readdirSync(backups).some((n) => n.startsWith("periodic-20261119T")));
    } finally {
      db.value.close();
    }
  } finally {
    t.cleanup();
  }
});

test("migrations registry: Project Core's scripts are registered in order", () => {
  const ordered = buildMigrationRegistry().ordered();
  assert.equal(ordered.ok && ordered.value.length, SCHEMA);
});
