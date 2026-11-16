import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Driver, nodeSqliteDriver, type RawDb } from "../src/index.js";

/** A temporary Space directory, removed by `cleanup`. */
export function tempSpace(): { dir: string; db: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "cutroom-storage-"));
  return { dir, db: join(dir, "space.db"), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** The real driver, recording every `exec` in order and optionally faking the SQLite version. */
export function spyDriver(version?: string): { driver: Driver; log: string[] } {
  const log: string[] = [];
  const driver: Driver = {
    open(path, options) {
      const real = nodeSqliteDriver.open(path, options);
      const spy: RawDb = {
        exec(sql) {
          log.push(sql);
          real.exec(sql);
        },
        prepare: (sql) => real.prepare(sql),
        get isTransaction() {
          return real.isTransaction;
        },
        sqliteVersion: () => version ?? real.sqliteVersion(),
        backupTo: (dest) => real.backupTo(dest),
        close: () => real.close(),
      };
      return spy;
    },
  };
  return { driver, log };
}

export const SETTINGS = { synchronous: "NORMAL", commitTickMs: 20 } as const;
