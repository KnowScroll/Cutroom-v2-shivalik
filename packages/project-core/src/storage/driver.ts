// Design: lld/04 §2.6 (the storage adapter; the only file that names `node:sqlite` and its class)
// `better-sqlite3` stays a one-file fallback: replace this file and nothing else changes.
import * as sqlite from "node:sqlite";

/**
 * The busy timeout of every connection, in milliseconds. R3 §2.6 fixes it at 5 s ("busy timeout 5 s"); it is
 * a constant of the driver, not a setting (A:M0-5).
 */
export const BUSY_TIMEOUT_MS = 5000;

export type SqlValue = null | number | bigint | string | Uint8Array;
export type SqlParam = SqlValue | Readonly<Record<string, SqlValue>>;
export type Row = Readonly<Record<string, SqlValue>>;
export interface RunInfo {
  readonly changes: number | bigint;
  readonly lastInsertRowid: number | bigint;
}

export interface Statement {
  run(...params: SqlParam[]): RunInfo;
  get(...params: SqlParam[]): Row | undefined;
  all(...params: SqlParam[]): Row[];
}

/** What the rest of the storage code may do with one connection. */
export interface RawDb {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  readonly isTransaction: boolean;
  sqliteVersion(): string;
  /** Online backup of this connection's database into a new file. */
  backupTo(destination: string): Promise<void>;
  close(): void;
}

export interface OpenOptions {
  readonly readonly: boolean;
  readonly timeoutMs: number;
}

/** Tests wrap or replace the driver to spy on SQL or to fake the SQLite version. */
export interface Driver {
  open(path: string, options: OpenOptions): RawDb;
}

// Node 26.11.0 renamed `DatabaseSync` to `Database` and kept the old name as an alias; Node 24 has only the
// old name. Resolve whichever exists, so a later removal of the alias breaks nothing.
type DatabaseClass = typeof sqlite.DatabaseSync;
const DatabaseCtor: DatabaseClass =
  (sqlite as unknown as { Database?: DatabaseClass }).Database ?? sqlite.DatabaseSync;

type Db = InstanceType<DatabaseClass>;

// Asked of a scratch in-memory database: on a damaged file even `SELECT sqlite_version()` fails, and that
// failure must reach the caller as DB_DAMAGED, not as an exception from the version check.
function libraryVersion(): string {
  const scratch = new DatabaseCtor(":memory:");
  try {
    return String((scratch.prepare("SELECT sqlite_version() AS v").get() as { v: string }).v);
  } finally {
    scratch.close();
  }
}

function wrap(db: Db): RawDb {
  return {
    exec: (sql) => db.exec(sql),
    prepare: (sql) => {
      const st = db.prepare(sql);
      return {
        run: (...p) => st.run(...(p as sqlite.SQLInputValue[])),
        get: (...p) => st.get(...(p as sqlite.SQLInputValue[])) as Row | undefined,
        all: (...p) => st.all(...(p as sqlite.SQLInputValue[])) as Row[],
      };
    },
    get isTransaction() {
      return db.isTransaction;
    },
    sqliteVersion: libraryVersion,
    backupTo: async (destination) => {
      await sqlite.backup(db, destination);
    },
    close: () => db.close(),
  };
}

export const nodeSqliteDriver: Driver = {
  open(path, options) {
    return wrap(
      new DatabaseCtor(path, {
        readOnly: options.readonly,
        timeout: options.timeoutMs,
        enableForeignKeyConstraints: true,
      }),
    );
  },
};
