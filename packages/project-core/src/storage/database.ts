// Design: lld/04 §2.6 (connection settings, runtime), §2.12, lld/11 A:M0-4 (SQLITE_TOO_OLD, DB_DAMAGED), A:M0-10
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Result } from "@cutroom/foundations";
import { fail, ok } from "@cutroom/foundations";
import { BUSY_TIMEOUT_MS, type Driver, nodeSqliteDriver, type RawDb, type Statement } from "./driver.js";
import { type MigrationRegistry, migrate, userVersion } from "./migrations.js";
import { type Durability, GroupedWriter, type WriterSettings } from "./writer.js";

/** SQLite before this version has a WAL corruption race between two writing connections (R5 §2.1). */
export const MIN_SQLITE_VERSION = "3.51.3";

export interface OpenOptions extends WriterSettings {
  /** Worker threads open read-only connections; they skip the damage check, the writer and migrations. */
  readonly readonly?: boolean;
  readonly migrations?: MigrationRegistry;
  /** Tests inject a spying or version-faking driver. */
  readonly driver?: Driver;
  readonly now?: () => Date;
}

function versionParts(v: string): number[] | undefined {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : undefined;
}

export function isOldSqlite(version: string): boolean {
  const have = versionParts(version);
  const need = versionParts(MIN_SQLITE_VERSION) as number[];
  if (have === undefined) return true;
  for (let i = 0; i < 3; i++) {
    const a = have[i] as number;
    const b = need[i] as number;
    if (a !== b) return a < b;
  }
  return false;
}

function newestBackup(spaceDir: string): string | null {
  const dir = join(spaceDir, "backups");
  if (!existsSync(dir)) return null;
  let best: { path: string; at: number } | undefined;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const at = statSync(path).mtimeMs;
    if (best === undefined || at > best.at) best = { path, at };
  }
  return best?.path ?? null;
}

/** An open Space database. Writes go through `tx`; `exec` and `prepare` are for reads and setup. */
export class Storage {
  private readonly writer: GroupedWriter | undefined;
  private done = false;

  constructor(
    private readonly db: RawDb,
    readonly readonly: boolean,
    settings: WriterSettings,
  ) {
    this.writer = readonly ? undefined : new GroupedWriter(db, settings);
  }

  get userVersion(): number {
    return userVersion(this.db);
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  prepare(sql: string): Statement {
    return this.db.prepare(sql);
  }

  /**
   * Runs `fn` (synchronously) inside the open group, or opens one. Resolves with its value after the group's
   * COMMIT. `full` is for promotions, paid-call intents and confirmations and deliverable records only.
   */
  tx<T>(fn: (db: RawDb) => T, options: { readonly durability?: Durability } = {}): Promise<T> {
    if (this.writer === undefined) return Promise.reject(new Error("read-only connection cannot write"));
    return this.writer.tx(fn, options.durability ?? "normal");
  }

  /** Commits the open group first, so the copy holds every acknowledged and pending write. */
  async backup(destination: string): Promise<void> {
    this.writer?.commitGroup();
    await this.db.backupTo(destination);
  }

  /** Commits the open group first. */
  close(): void {
    if (this.done) return;
    this.done = true;
    this.writer?.close();
    this.db.close();
  }
}

/**
 * Opens a Space database. Refuses SQLite before 3.51.3 (SQLITE_TOO_OLD) and a file whose `quick_check` fails
 * (DB_DAMAGED, naming the newest backup); sets WAL, foreign keys, the busy timeout and `synchronous`; then
 * backs up and migrates when scripts are pending (MIGRATION_FAILED). It does not check the mount: call
 * `checkSpaceMount` first.
 */
export async function openDatabase(path: string, options: OpenOptions): Promise<Result<Storage>> {
  const readonly = options.readonly === true;
  const driver = options.driver ?? nodeSqliteDriver;
  const db = driver.open(path, { readonly, timeoutMs: BUSY_TIMEOUT_MS });
  try {
    const version = db.sqliteVersion();
    if (isOldSqlite(version)) {
      db.close();
      return fail({
        code: "SQLITE_TOO_OLD",
        path,
        expected: `SQLite ${MIN_SQLITE_VERSION} or later`,
        got: version,
      });
    }
    if (readonly) {
      db.exec(`PRAGMA busy_timeout=${BUSY_TIMEOUT_MS}`);
      db.exec("PRAGMA foreign_keys=ON");
      db.exec("PRAGMA query_only=ON");
      return ok(new Storage(db, true, options));
    }
    const spaceDir = dirname(path);
    let output: string[];
    try {
      output = db
        .prepare("PRAGMA quick_check")
        .all()
        .map((r) => String(r.quick_check));
    } catch (error) {
      // A file that is not a database fails on its first read instead of reporting rows.
      output = [error instanceof Error ? error.message : String(error)];
    }
    if (output.length !== 1 || output[0] !== "ok") {
      db.close();
      return fail({
        code: "DB_DAMAGED",
        path,
        expected: "quick_check ok",
        got: { quick_check: output, newest_backup: newestBackup(spaceDir) },
      });
    }
    // Set after quick_check: on a file that is not a database every statement fails, and that is DB_DAMAGED.
    db.exec(`PRAGMA busy_timeout=${BUSY_TIMEOUT_MS}`);
    db.exec("PRAGMA foreign_keys=ON");
    db.exec("PRAGMA journal_mode=WAL");
    db.exec(`PRAGMA synchronous=${options.synchronous}`);
    if (options.migrations !== undefined) {
      const migrated = await migrate(
        { db, spaceDir, now: options.now ?? (() => new Date()) },
        options.migrations,
      );
      if (!migrated.ok) {
        db.close();
        return migrated;
      }
    }
    return ok(new Storage(db, false, options));
  } catch (error) {
    db.close();
    throw error;
  }
}
