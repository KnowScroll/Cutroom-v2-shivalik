// Design: lld/04 §5 (db.synchronous, db.backup_hours, db.backup_keep), lld/06 (db.commit_tick_ms), lld/11 A:M0-5
// The CLI registers every package's settings catalogue and reads the values it needs from the registry; no
// tunable number lives in code.
import { COMPILER_SETTINGS } from "@cutroom/compiler";
import { FOUNDATIONS_SETTINGS, fail, ok, type Result, SettingsRegistry } from "@cutroom/foundations";
import { HARNESS_SETTINGS } from "@cutroom/harness";
import {
  MigrationRegistry,
  PROJECT_CORE_MIGRATIONS,
  PROJECT_CORE_SETTINGS,
  resolveWriterSettings,
  type WriterSettings,
} from "@cutroom/project-core";
import { QUALITY_SETTINGS } from "@cutroom/quality";
import { RENDER_SETTINGS } from "@cutroom/render";
import { SCHEDULER_SETTINGS } from "@cutroom/scheduler";
import { STUDIO_SETTINGS } from "@cutroom/studio";
import { CLI_SETTINGS } from "./settings.js";

export function buildSettingsRegistry(): SettingsRegistry {
  const registry = new SettingsRegistry();
  const catalogues = [
    ["foundations", FOUNDATIONS_SETTINGS],
    ["project-core", PROJECT_CORE_SETTINGS],
    ["compiler", COMPILER_SETTINGS],
    ["scheduler", SCHEDULER_SETTINGS],
    ["render", RENDER_SETTINGS],
    ["harness", HARNESS_SETTINGS],
    ["studio", STUDIO_SETTINGS],
    ["quality", QUALITY_SETTINGS],
    ["cli", CLI_SETTINGS],
  ] as const;
  for (const [owner, records] of catalogues) {
    const registered = registry.register(owner, records);
    // A catalogue that does not register is a build defect, not a user error.
    if (!registered.ok) throw new Error(`settings of ${owner}: ${JSON.stringify(registered.diagnostics)}`);
  }
  return registry;
}

/** The scripts every package registers; M0 has Project Core's only. */
export function buildMigrationRegistry(): MigrationRegistry {
  const registry = new MigrationRegistry();
  registry.registerMigrations("project-core", PROJECT_CORE_MIGRATIONS);
  return registry;
}

export interface SpaceSettings {
  readonly writer: WriterSettings;
  /** `db.backup_hours` */
  readonly backupHours: number;
  /** `db.backup_keep` */
  readonly backupKeep: number;
}

export function resolveSpaceSettings(registry: SettingsRegistry): Result<SpaceSettings> {
  const writer = resolveWriterSettings(registry);
  if (!writer.ok) return writer;
  const hours = registry.resolve("db.backup_hours", []);
  if (!hours.ok) return hours;
  const keep = registry.resolve("db.backup_keep", []);
  if (!keep.ok) return keep;
  if (typeof hours.value !== "number") {
    return fail({ code: "VALUE_OUT_OF_RANGE", path: "db.backup_hours", got: hours.value });
  }
  if (typeof keep.value !== "number") {
    return fail({ code: "VALUE_OUT_OF_RANGE", path: "db.backup_keep", got: keep.value });
  }
  return ok({ writer: writer.value, backupHours: hours.value, backupKeep: keep.value });
}
