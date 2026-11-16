// Design: lld/04 §2.6, §2.12 (ordered scripts on one PRAGMA user_version), lld/11 A:M0-4, A:M0-9, A:M0-10
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Diagnostic, Result } from "@cutroom/foundations";
import { fail, ok } from "@cutroom/foundations";
import type { RawDb } from "./driver.js";

export interface MigrationScript {
  /** Position in the one number sequence every owner shares; it only grows and is never renumbered. */
  readonly number: number;
  readonly name: string;
  readonly sql: string;
}

interface Registered extends MigrationScript {
  readonly owner: string;
}

/** Each owner registers its scripts from its own package; the runner applies all of them in number order. */
export class MigrationRegistry {
  private readonly scripts: Registered[] = [];

  registerMigrations(owner: string, scripts: readonly MigrationScript[]): void {
    for (const s of scripts) this.scripts.push({ ...s, owner });
  }

  /** The registered scripts in number order; a gap or a duplicate is MIGRATION_FAILED. */
  ordered(): Result<readonly Registered[]> {
    const sorted = [...this.scripts].sort((a, b) => a.number - b.number);
    let expected = 1;
    for (const s of sorted) {
      if (!Number.isInteger(s.number) || s.number < 1) {
        return fail(failure(s, `script number must be a positive integer, got ${s.number}`));
      }
      if (s.number < expected) {
        const first = sorted.find((o) => o.number === s.number);
        return fail(failure(s, `duplicate script number ${s.number} (also ${first?.owner}/${first?.name})`));
      }
      if (s.number > expected) {
        return fail(failure(s, `gap in script numbers: expected ${expected}, found ${s.number}`));
      }
      expected++;
    }
    return ok(sorted);
  }
}

function failure(s: Registered, error: string): Diagnostic {
  return {
    code: "MIGRATION_FAILED",
    path: `migration.${s.owner}.${s.number}`,
    got: { owner: s.owner, script: s.name, error },
  };
}

export function userVersion(db: RawDb): number {
  return Number((db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version);
}

/** `<kind>-<UTC time>-v<user_version>.sqlite`, for example `pre-migration-20261116T101500123Z-v3.sqlite` (A:M0-10). */
export function backupFileName(kind: string, at: Date, version: number): string {
  const stamp = at.toISOString().replace(/[-:]/g, "").replace(".", "");
  return `${kind}-${stamp}-v${version}.sqlite`;
}

export interface MigrateContext {
  readonly db: RawDb;
  readonly spaceDir: string;
  readonly now: () => Date;
}

/**
 * Backs up into `backups/`, then runs every pending script in one transaction. A failing script rolls
 * everything back, so `user_version` is unchanged (A:M0-4). Nothing is touched when nothing is pending.
 */
export async function migrate(ctx: MigrateContext, registry: MigrationRegistry): Promise<Result<number>> {
  const ordered = registry.ordered();
  if (!ordered.ok) return ordered;
  const scripts = ordered.value;
  const current = userVersion(ctx.db);
  const newest = scripts.length;
  if (current > newest) {
    return fail({
      code: "MIGRATION_FAILED",
      path: "user_version",
      expected: `at most ${newest}, the newest registered script`,
      got: { owner: null, script: null, error: `database user_version ${current} is newer than this build` },
    });
  }
  if (current === newest) return ok(current);

  const backups = join(ctx.spaceDir, "backups");
  mkdirSync(backups, { recursive: true });
  await ctx.db.backupTo(join(backups, backupFileName("pre-migration", ctx.now(), current)));

  let running: Registered | undefined;
  ctx.db.exec("BEGIN IMMEDIATE");
  try {
    // Another process may have migrated while the backup ran.
    const start = userVersion(ctx.db);
    for (const s of scripts.filter((x) => x.number > start)) {
      running = s;
      ctx.db.exec(s.sql);
      ctx.db.exec(`PRAGMA user_version=${s.number}`);
    }
    ctx.db.exec("COMMIT");
  } catch (error) {
    if (ctx.db.isTransaction) ctx.db.exec("ROLLBACK");
    const message = error instanceof Error ? error.message : String(error);
    return fail(
      running === undefined
        ? {
            code: "MIGRATION_FAILED",
            path: "user_version",
            got: { owner: null, script: null, error: message },
          }
        : failure(running, message),
    );
  }
  return ok(userVersion(ctx.db));
}
