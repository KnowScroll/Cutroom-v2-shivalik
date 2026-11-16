// Design: lld/09 §5 (R9 named settings, bundle quality_settings@1), lld/04 §2.7 (G15), lld/11 L13, L40, G22, A:M0-11
import type { SettingRecord } from "@cutroom/foundations";

const OWNER = "quality";
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

const flag = (name: string): SettingRecord => ({
  name,
  owner: OWNER,
  type: "boolean",
  default: true,
  override_by: "director",
  range: { kind: "boolean" },
});

const H = { human: true } as const;
const FRACTION_NOTE = "stored as a fraction";

export const QUALITY_SETTINGS: readonly SettingRecord[] = [
  num("control.response_min_fraction", 0.001, 0, 1, { note: `0.001 of pixels, ${FRACTION_NOTE}` }),
  int("component.min_distinct_frames", 3, 1, NO_MAX),
  num("overlap.max_fraction", 0.15, 0, 1),
  int("overlap.min_frames", 3, 1, NO_MAX),
  num("text.min_size_du", 36, 0, NO_MAX),
  num("text.caption_min_size_du", 48, 0, NO_MAX),
  num("contrast.min_ratio", 4.5, 1, 21),
  num("contrast.large_min_ratio", 3, 1, 21),
  num("contrast.large_du", 66, 0, NO_MAX),
  int("contrast.bg_percentile", 5, 0, 100),
  num("occlusion.min_visible_fraction", 0.9, 0, 1),
  int("occlusion.min_visible_ms", 400, 0, NO_MAX),
  num("motion.jump_factor", 6, 1, NO_MAX),
  num("motion.jump_min_du", 40, 0, NO_MAX),
  num("chart.geometry_tolerance_fraction", 0.02, 0, 1),
  num("black.min_s", 0.5, 0, NO_MAX),
  num("freeze.min_s", 1, 0, NO_MAX),
  num("freeze.noise", 0.001, 0, 1),
  num("silence.noise_db", -50, -120, 0),
  num("silence.min_s", 1.5, 0, NO_MAX),
  num("loud.tolerance_lu", 1, 0, NO_MAX, H),
  num("stt.wer_max_take", 0.1, 0, 1),
  num("stt.wer_max_final", 0.15, 0, 1),
  int("stt.short_take_words", 10, 1, 30, {
    given: true,
    note: "director until A-01 is required for delivery, then human (L40)",
  }),
  int("stt.short_take_max_errors", 1, 0, 5, {
    given: true,
    note: "director until A-01 is required for delivery, then human (L40)",
  }),
  int("sync.event_early_ms", 40, 0, NO_MAX),
  int("sync.event_late_ms", 60, 0, NO_MAX),
  int("sync.mux_early_ms", 5, 0, NO_MAX, H),
  int("sync.mux_late_ms", 15, 0, NO_MAX, H),
  num("final.match_psnr_min_db", 35, 0, NO_MAX, H),
  int("final.match_samples", 30, 1, NO_MAX, H),
  num("final.min_integrated_lufs", -40, -120, 0, H),
  num("regress.psnr_min_db", 50, 0, NO_MAX),
  int("sheet.max_cells", 16, 1, NO_MAX),
  num("sheet.film_interval_s", 2, 0.1, NO_MAX),
  int("sheet.strip_spacing_ms", 100, 1, NO_MAX),
  int("sheet.strip_max_cells", 12, 1, NO_MAX),
  int("sheet.frame_strip_cells", 18, 1, NO_MAX),
  num("clip.inspect_window_s", 3, 0.1, NO_MAX),
  num("clip.sample_fps", 5, 0.1, NO_MAX),
  flag("review.trigger_t2"),
  flag("review.trigger_t3"),
  flag("review.trigger_t4"),
  flag("review.trigger_t5"),
  flag("review.trigger_t6"),
  flag("review.trigger_t7"),
  flag("review.trigger_t8"),
  int("review.final_max_unseen_gap_ms", 1000, 0, NO_MAX, H),
  int("review.hard_proof_votes", 3, 1, NO_MAX, H),
  int("review.max_calls_per_film", 50, 0, NO_MAX),
  int("review.max_calls_per_cycle", 6, 0, NO_MAX),
  int("review.max_retrievals", 6, 0, NO_MAX),
  int("review.max_output_repairs", 2, 0, NO_MAX),
  int("revision.max_cycles_per_finding", 2, 1, NO_MAX),
  int("revision.max_cycles_per_film", 6, 1, NO_MAX),
  int("revision.same_signature_limit", 2, 1, NO_MAX),
  int("stop.max_polish_cycles", 2, 0, NO_MAX),
  int("stop.no_gain_cycles", 1, 1, NO_MAX),
  num("stop.time_soft_limit_min", 150, 1, NO_MAX),
  num("stop.polish_budget_fraction", 0.15, 0, 1),
  int("notify.summary_max_tokens", 200, 1, NO_MAX),
];
