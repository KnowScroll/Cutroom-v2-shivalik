import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Driver, nodeSqliteDriver, type RawDb } from "@cutroom/project-core";
import type { CliEnv, Timers } from "../src/index.js";

export const EXT4_TABLE = "/dev/sda / ext4 rw 0 0\n";
export const NINEP_TABLE = "/dev/sda / ext4 rw 0 0\nC:\\134 /mnt/c 9p rw,aname=drvfs 0 0\n";

/** A manual clock: `fire` runs every registered interval callback once. */
export function fakeTimers(): Timers & { fire(): void; readonly intervals: number[] } {
  const callbacks = new Map<number, () => void>();
  const intervals: number[] = [];
  let next = 1;
  return {
    intervals,
    setInterval(fn, ms) {
      const id = next++;
      callbacks.set(id, fn);
      intervals.push(ms);
      return id;
    },
    clearInterval(handle) {
      callbacks.delete(handle as number);
    },
    fire() {
      for (const fn of callbacks.values()) fn();
    },
  };
}

export interface TestEnv extends CliEnv {
  readonly outLines: string[];
  readonly errLines: string[];
  clock: Date;
}

/** An environment whose mounts table and `realpath` are injected, so it runs on Windows too. */
export function testEnv(
  options: { table?: string; real?: string; driver?: Driver; timers?: Timers; home?: string } = {},
): TestEnv {
  const outLines: string[] = [];
  const errLines: string[] = [];
  const env: TestEnv = {
    outLines,
    errLines,
    clock: new Date("2026-11-16T10:00:00.000Z"),
    out: (t) => outLines.push(t),
    err: (t) => errLines.push(t),
    home: () => options.home ?? "/nonexistent-home",
    now: () => env.clock,
    timers: options.timers ?? fakeTimers(),
    handleSignals: false,
    mount: { readMounts: () => options.table ?? EXT4_TABLE, realpath: () => options.real ?? "/home/u/space" },
    ...(options.driver === undefined ? {} : { driver: options.driver }),
  };
  return env;
}

export function tempDir(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "cutroom-cli-"));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** The real driver reporting an old SQLite version. */
export function oldSqliteDriver(version: string): Driver {
  return {
    open(path, options) {
      const real = nodeSqliteDriver.open(path, options);
      const faked: RawDb = {
        exec: (sql) => real.exec(sql),
        prepare: (sql) => real.prepare(sql),
        get isTransaction() {
          return real.isTransaction;
        },
        sqliteVersion: () => version,
        backupTo: (dest) => real.backupTo(dest),
        close: () => real.close(),
      };
      return faked;
    },
  };
}
