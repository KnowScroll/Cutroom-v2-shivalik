// Design: lld/04 §2.6 (durability and grouped commits), lld/11 L2 (a FULL member closes a NORMAL group), R5 §2.1
import type { RawDb } from "./driver.js";

export type Synchronous = "NORMAL" | "FULL";
export type Durability = "normal" | "full";

export interface WriterSettings {
  /** `db.synchronous` */
  readonly synchronous: Synchronous;
  /** `db.commit_tick_ms` */
  readonly commitTickMs: number;
}

interface Member {
  readonly resolve: () => void;
  readonly reject: (error: unknown) => void;
}

interface Group {
  readonly level: Durability;
  readonly members: Member[];
  readonly timer: ReturnType<typeof setTimeout>;
}

function isThenable(value: unknown): boolean {
  return (
    typeof value === "object" && value !== null && typeof (value as { then?: unknown }).then === "function"
  );
}

/**
 * The one write connection's grouped writer. The first member opens `BEGIN IMMEDIATE` and a
 * `commitTickMs` timer; later members run inside their own `SAVEPOINT`. A promise resolves only after the
 * group's `COMMIT`. The function of a member runs at once and synchronously, so there is no queue to drain:
 * each group is committed by its own timer callback, which yields to the event loop between groups (b2b §3,
 * run A froze the process for 7.3 s by draining a queue in one turn).
 *
 * Members cannot nest: a `tx` call from inside a member function is rejected. Deferred constraints are not
 * supported inside members: a failure at `COMMIT` rejects every member of the group, the transaction is
 * rolled back and the writer carries on; a caller must be able to repeat a request anyway (R5 §2.1).
 */
export class GroupedWriter {
  private group: Group | undefined;
  private savepoint = 0;
  private closed = false;
  private running = false;

  constructor(
    private readonly db: RawDb,
    private readonly settings: WriterSettings,
  ) {
    if (!Number.isInteger(settings.commitTickMs) || settings.commitTickMs < 1) {
      throw new RangeError(`db.commit_tick_ms must be a positive integer, got ${settings.commitTickMs}`);
    }
  }

  get openGroupLevel(): Durability | undefined {
    return this.group?.level;
  }

  tx<T>(fn: (db: RawDb) => T, durability: Durability = "normal"): Promise<T> {
    // A member function that calls `tx` would join or commit the group from inside another member, so one
    // member's rollback could undo another's write, or its partial write could be committed. It is a bug in
    // the caller: refuse it and leave the running member exactly as if the call had not happened.
    if (this.running) {
      return Promise.reject(new Error("tx called from inside a transaction function: members cannot nest"));
    }
    if (this.closed) return Promise.reject(new Error("storage is closed"));
    const level: Durability =
      durability === "full" || this.settings.synchronous === "FULL" ? "full" : "normal";
    // A FULL member never joins a group opened at NORMAL: SQLite refuses to change `synchronous` inside a
    // transaction, so the NORMAL group commits first and the member opens a group of its own (L2).
    if (this.group !== undefined && level === "full" && this.group.level === "normal") this.commitGroup();
    try {
      return this.run(fn, level);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  private run<T>(fn: (db: RawDb) => T, level: Durability): Promise<T> {
    const first = this.group === undefined;
    if (first) this.openGroup(level);
    const group = this.group as Group;
    const name = `m${++this.savepoint}`;
    if (!first) this.db.exec(`SAVEPOINT ${name}`);
    let value: T;
    try {
      this.running = true;
      value = fn(this.db);
      if (isThenable(value)) throw new TypeError("a transaction function must be synchronous");
    } catch (error) {
      this.running = false;
      if (first || !this.db.isTransaction) {
        // Nobody else joined yet, or SQLite already ended the transaction: the whole group goes.
        this.abortGroup(error);
      } else {
        this.db.exec(`ROLLBACK TO ${name}`);
        this.db.exec(`RELEASE ${name}`);
      }
      return Promise.reject(error);
    }
    this.running = false;
    if (!first) this.db.exec(`RELEASE ${name}`);
    return new Promise<T>((resolve, reject) => {
      group.members.push({ resolve: () => resolve(value), reject });
    });
  }

  private openGroup(level: Durability): void {
    const raise = level === "full" && this.settings.synchronous === "NORMAL";
    // `synchronous` is set outside any transaction, and put back after the group ends.
    if (raise) this.db.exec("PRAGMA synchronous=FULL");
    try {
      this.db.exec("BEGIN IMMEDIATE");
    } catch (error) {
      if (raise) this.db.exec(`PRAGMA synchronous=${this.settings.synchronous}`);
      throw error;
    }
    const timer = setTimeout(() => this.commitGroup(), this.settings.commitTickMs);
    this.group = { level, members: [], timer };
  }

  private restoreLevel(group: Group): void {
    if (group.level === "full" && this.settings.synchronous === "NORMAL") {
      this.db.exec("PRAGMA synchronous=NORMAL");
    }
  }

  private abortGroup(error: unknown): void {
    const group = this.group as Group;
    clearTimeout(group.timer);
    this.group = undefined;
    try {
      if (this.db.isTransaction) this.db.exec("ROLLBACK");
    } finally {
      this.restoreLevel(group);
    }
    for (const m of group.members) m.reject(error);
  }

  /** Commits the open group, if any. Safe to call from the timer, from `tx` and from `close`. */
  commitGroup(): void {
    const group = this.group;
    if (group === undefined) return;
    clearTimeout(group.timer);
    this.group = undefined;
    try {
      this.db.exec("COMMIT");
    } catch (error) {
      try {
        if (this.db.isTransaction) this.db.exec("ROLLBACK");
      } catch {
        // The commit error is the one to report.
      }
      this.restoreLevel(group);
      for (const m of group.members) m.reject(error);
      return;
    }
    this.restoreLevel(group);
    for (const m of group.members) m.resolve();
  }

  close(): void {
    this.commitGroup();
    this.closed = true;
  }
}
