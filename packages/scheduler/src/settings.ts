// Design: lld/06 §5 (R5 named settings), lld/04 §2.7 (G15), lld/11 K5, K7, U11, B:M3-7, B:M3-11-resend, B:M3-12
import type { SettingRecord } from "@cutroom/foundations";

const OWNER = "scheduler";
const DERIVED = "range derived (M0-05)";
const NO_MAX = Number.MAX_SAFE_INTEGER;

type Opts = { readonly human?: boolean; readonly given?: boolean; readonly note?: string };

function note(o: Opts): { note?: string } {
  const parts = [o.given === true ? undefined : DERIVED, o.note].filter((s) => s !== undefined);
  return parts.length === 0 ? {} : { note: parts.join("; ") };
}

const int = (name: string, def: number, min: number, max: number, o: Opts = {}): SettingRecord => ({
  name,
  owner: OWNER,
  type: "integer",
  default: def,
  override_by: o.human === true ? "human" : "director",
  range: { kind: "number_range", min, max },
  ...note(o),
});

const num = (name: string, def: number, min: number, max: number, o: Opts = {}): SettingRecord => ({
  ...int(name, def, min, max, o),
  type: "number",
});

const H = { human: true } as const;

export const SCHEDULER_SETTINGS: readonly SettingRecord[] = [
  int("db.commit_tick_ms", 20, 1, NO_MAX, H),
  int("lease.flush_s", 15, 1, NO_MAX),
  int("stall.capture_s", 60, 1, NO_MAX),
  int("stall.model_stream_s", 120, 1, NO_MAX),
  int("stall.ffmpeg_s", 60, 1, NO_MAX),
  int("retry.transient_max", 3, 0, NO_MAX, { note: "the design's 4 for HTTP 529 is not a separate setting" }),
  num("retry.backoff_base_s", 2, 0, NO_MAX),
  num("retry.backoff_cap_s", 60, 0, NO_MAX),
  int("unknown.resend_max", 1, 0, NO_MAX, H),
  num("budget.duplicate_spend_usd", 0.5, 0, NO_MAX, H),
  num("budget.hard_cap_usd", 15, 0, NO_MAX, H),
  num("budget.soft_target_usd", 5, 0, NO_MAX, H),
  num("budget.revision_cycle_usd", 0.75, 0, NO_MAX, H),
  num("budget.delivery_reserve_usd", 0.5, 0, NO_MAX, H),
  num("compute.usd_per_hour", 0, 0, NO_MAX, H),
  int("browser.max", 6, 1, NO_MAX),
  int("browser.mem_budget_mb", 950, 1, NO_MAX),
  int("pixi.unit_browsers", 1, 1, NO_MAX),
  int("capture_browser.max", 1, 1, NO_MAX),
  int("capture_browser.mem_budget_mb", 1500, 1, NO_MAX),
  int("mem.reserve_mb", 4000, 0, NO_MAX),
  int("mem.low_water_mb", 1500, 0, NO_MAX),
  int("mem.critical_mb", 700, 0, NO_MAX),
  int("ffmpeg.heavy_max", 2, 1, NO_MAX),
  int("ffmpeg.piped_threads", 2, 1, NO_MAX),
  num("llm.limit_fraction", 0.6, 0.01, 1),
  int("llm.max_concurrent", 8, 1, 8, { human: true, given: true }),
  int("llm.start_concurrent", 2, 1, 8, { note: "upper bound is llm.max_concurrent's" }),
  int("llm.recover_interval_s", 30, 1, NO_MAX),
  num("llm.recover_rate_fraction", 0.1, 0.01, 1),
  int("tts.max_concurrent", 3, 1, NO_MAX),
  int("stt.max_concurrent", 1, 1, NO_MAX),
  int("net.per_host_concurrent", 2, 1, NO_MAX, H),
  int("net.max_concurrent", 8, 1, NO_MAX, H),
  num("spec.max_fraction", 0.25, 0, 1),
  int("orphan.finish_max_s", 30, 0, NO_MAX),
  int("cancel.grace_s", 5, 0, NO_MAX),
  int("priority.age_step_s", 300, 1, NO_MAX),
  int("breaker.open_s", 60, 1, NO_MAX),
  int("breaker.failure_count", 5, 1, NO_MAX),
  num("cache.max_gb", 20, 0.1, NO_MAX, H),
  num("disk.low_water_gb", 5, 0, NO_MAX),
  int("retention.irreproducible_days", 90, 1, NO_MAX, H),
  int("retention.derived_final_days", 30, 1, NO_MAX, H),
  int("retention.derived_cheap_days", 7, 1, NO_MAX, H),
  int("retention.logs_days", 14, 1, NO_MAX, H),
];
