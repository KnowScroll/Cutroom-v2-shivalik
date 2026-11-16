// Design: lld/10 §4.2 (M0: the 200-kill promotion drill on real code); b2b §4; lld/11 U27 (claims run in WSL)
// What the drill's parent and its writer share: the migration registry (the real Project Core scripts, then the
// drill's own script 3, a test-only event table) and the writer settings. Nothing here re-implements a transaction.
import { MigrationRegistry, PROJECT_CORE_MIGRATIONS } from "@cutroom/project-core";

/** The test-only event table: one row per swap, written by the swap's hook inside the swap's transaction. */
export const DRILL_EVENT_MIGRATION = {
  number: PROJECT_CORE_MIGRATIONS.length + 1,
  name: "drill_event",
  sql: "CREATE TABLE drill_event(seq INTEGER PRIMARY KEY, revision TEXT NOT NULL) STRICT;",
} as const;

export function drillRegistry(): MigrationRegistry {
  const registry = new MigrationRegistry();
  registry.registerMigrations("project-core", PROJECT_CORE_MIGRATIONS);
  registry.registerMigrations("drill", [DRILL_EVENT_MIGRATION]);
  return registry;
}

/**
 * Grouping on, at the design default of `db.commit_tick_ms` (20, lld/06 R5). The Scheduler package registers that
 * setting later, so the registry cannot resolve it yet; `synchronous` is the registered default of `db.synchronous`.
 */
export const DRILL_WRITER_SETTINGS = { synchronous: "NORMAL", commitTickMs: 20 } as const;
