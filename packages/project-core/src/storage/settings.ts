// Design: lld/04 §5 (db.synchronous), lld/06 (R5 db.commit_tick_ms); settings are read, never defaulted here
import type { Result, SettingsLayer, SettingsRegistry } from "@cutroom/foundations";
import { fail, ok } from "@cutroom/foundations";
import type { WriterSettings } from "./writer.js";

/**
 * Resolves the two settings the writer needs. `db.commit_tick_ms` is registered by the Scheduler package
 * (R5), so the registry must hold it; an unregistered name is the registry's own SETTING_UNKNOWN.
 */
export function resolveWriterSettings(
  registry: SettingsRegistry,
  layers: readonly SettingsLayer[] = [],
): Result<WriterSettings> {
  const sync = registry.resolve("db.synchronous", layers);
  if (!sync.ok) return sync;
  const tick = registry.resolve("db.commit_tick_ms", layers);
  if (!tick.ok) return tick;
  if (sync.value !== "NORMAL" && sync.value !== "FULL") {
    return fail({ code: "VALUE_OUT_OF_RANGE", path: "db.synchronous", got: sync.value });
  }
  if (typeof tick.value !== "number") {
    return fail({ code: "VALUE_OUT_OF_RANGE", path: "db.commit_tick_ms", got: tick.value });
  }
  return ok({ synchronous: sync.value, commitTickMs: tick.value });
}
