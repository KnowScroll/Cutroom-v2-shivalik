// Design: lld/10 §4.2 (M0: the 200-kill promotion drill on real code); b2b §4; lld/11 U27 (claims run in WSL)
// What the drill's parent and its writer share: the migration registry (the real Project Core scripts, then the
// drill's own script 3, a test-only event table) and the writer settings. Nothing here re-implements a transaction.
import { SettingsRegistry } from "@cutroom/foundations";
import {
  MigrationRegistry,
  PROJECT_CORE_MIGRATIONS,
  PROJECT_CORE_SETTINGS,
  resolveWriterSettings,
  type WriterSettings,
} from "@cutroom/project-core";
import { SCHEDULER_SETTINGS } from "@cutroom/scheduler";

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

/** Grouping on: both writer settings are read from the registry, at their registered defaults. */
export function drillWriterSettings(): WriterSettings {
  const settings = new SettingsRegistry();
  for (const [owner, records] of [
    ["project-core", PROJECT_CORE_SETTINGS],
    ["scheduler", SCHEDULER_SETTINGS],
  ] as const) {
    const registered = settings.register(owner, records);
    if (!registered.ok) throw new Error(`settings of ${owner} refused: ${JSON.stringify(registered)}`);
  }
  const resolved = resolveWriterSettings(settings);
  if (!resolved.ok) throw new Error(`writer settings: ${JSON.stringify(resolved)}`);
  return resolved.value;
}
