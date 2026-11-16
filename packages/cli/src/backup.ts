// Design: lld/04 §2.14 "Backups", §5 (db.backup_hours, db.backup_keep), lld/11 A:M0-10
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { backupFileName, type Storage } from "@cutroom/project-core";

/** Unit conversion for `db.backup_hours`, not a setting. */
const MS_PER_HOUR = 3_600_000;

/** Tests drive a manual clock through this instead of waiting. */
export interface Timers {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export const realTimers: Timers = {
  setInterval: (fn, ms) => {
    const handle = setInterval(fn, ms);
    handle.unref();
    return handle;
  },
  clearInterval: (handle) => clearInterval(handle as NodeJS.Timeout),
};

export interface BackupOptions {
  readonly storage: Storage;
  readonly spaceDir: string;
  /** `db.backup_hours` */
  readonly hours: number;
  /** `db.backup_keep` */
  readonly keep: number;
  readonly now: () => Date;
  readonly timers: Timers;
  readonly onError: (error: unknown) => void;
}

/**
 * A periodic online `backup()` into `backups/`, named by UTC time and `user_version`. After each one the
 * newest `keep` periodic backups stay, and the newest pre-migration backup in any case (A:M0-10); older
 * pre-migration backups go. This guards against database damage, not against losing the disk.
 */
export class BackupScheduler {
  private handle: unknown;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly options: BackupOptions) {}

  start(): void {
    if (this.handle !== undefined) return;
    this.handle = this.options.timers.setInterval(() => {
      this.backupNow().catch(this.options.onError);
    }, this.options.hours * MS_PER_HOUR);
  }

  /** Stops the timer and waits for a backup in flight. */
  async stop(): Promise<void> {
    if (this.handle !== undefined) this.options.timers.clearInterval(this.handle);
    this.handle = undefined;
    await this.chain.catch(() => undefined);
  }

  /** Writes one periodic backup and prunes; resolves with the file's path. Backups never overlap. */
  backupNow(): Promise<string> {
    const run = this.chain
      .catch(() => undefined)
      .then(async () => {
        const { storage, spaceDir, now } = this.options;
        const dir = join(spaceDir, "backups");
        mkdirSync(dir, { recursive: true });
        const path = join(dir, backupFileName("periodic", now(), storage.userVersion));
        await storage.backup(path);
        this.prune(dir);
        return path;
      });
    this.chain = run;
    return run;
  }

  private prune(dir: string): void {
    const names = readdirSync(dir);
    // The UTC stamp is fixed-width, so names of one kind sort by time.
    const newestFirst = (prefix: string): string[] =>
      names
        .filter((n) => n.startsWith(`${prefix}-`) && n.endsWith(".sqlite"))
        .sort()
        .reverse();
    for (const name of newestFirst("periodic").slice(this.options.keep))
      rmSync(join(dir, name), { force: true });
    for (const name of newestFirst("pre-migration").slice(1)) rmSync(join(dir, name), { force: true });
  }
}
