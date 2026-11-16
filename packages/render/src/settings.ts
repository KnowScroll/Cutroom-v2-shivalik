// Design: lld/03 §5 (R2 named settings), lld/04 §2.7 (override rule, G15), lld/11 H1, H9, H10, K6, A:M1-3 (what R2 owns)
import type { SettingRecord } from "@cutroom/foundations";

const OWNER = "render";
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

const str = (name: string, def: string, values: readonly string[], o: Opts = {}): SettingRecord => ({
  name,
  owner: OWNER,
  type: "string",
  default: def,
  override_by: o.human === true ? "human" : "director",
  range: { kind: "values", values },
  ...note(o),
});

const X264_PRESETS = [
  "ultrafast",
  "superfast",
  "veryfast",
  "faster",
  "fast",
  "medium",
  "slow",
  "slower",
  "veryslow",
] as const;

/** `rung.<name>.*` cells of the table in lld/03 §2.12; a cell the table leaves empty is not a setting. */
const RUNG_SETTINGS: readonly SettingRecord[] = [
  num("rung.still.scale", 0.5, 0.01, 1),
  str("rung.still.intermediate", "jpeg", ["jpeg", "png"]),
  int("rung.still.quality", 85, 1, 100),
  num("rung.draft.scale", 0.5, 0.01, 1),
  int("rung.draft.step", 2, 1, NO_MAX),
  str("rung.draft.intermediate", "jpeg", ["jpeg", "png"]),
  int("rung.draft.quality", 80, 1, 100),
  str("rung.draft.preset", "veryfast", X264_PRESETS),
  int("rung.draft.crf", 28, 0, 51),
  num("rung.review.scale", 2 / 3, 0.01, 1),
  int("rung.review.step", 1, 1, NO_MAX),
  str("rung.review.intermediate", "jpeg", ["jpeg", "png"]),
  int("rung.review.quality", 90, 1, 100),
  str("rung.review.preset", "fast", X264_PRESETS),
  int("rung.review.crf", 23, 0, 51),
  num("rung.final.scale", 1, 1, 1, {
    note: "listed value 1 only: lld/03 §2.12 final is 1 to 1080 x 1920, delivery",
  }),
  int("rung.final.step", 1, 1, NO_MAX),
  str("rung.final.intermediate", "png", ["jpeg", "png"]),
  str("rung.final.preset", "medium", X264_PRESETS),
  int("rung.final.crf", 18, 0, 51),
];

export const RENDER_SETTINGS: readonly SettingRecord[] = [
  str("chrome.build_id", "157.0.8103.78", ["157.0.8103.78"], {
    human: true,
    note: "the registry has no free-text string range, so the range lists the pinned build only",
  }),
  int("host.max_layers", 24, 1, NO_MAX),
  int("capture.browser_max_chunks", 20, 1, NO_MAX),
  int("capture.warmup_frames", 10, 0, NO_MAX, { human: true }),
  int("capture.max_buffered_frames", 8, 1, NO_MAX),
  int("capture.init_timeout_ms", 5000, 1, NO_MAX),
  int("capture.seek_timeout_ms", 2000, 1, NO_MAX),
  int("capture.cdp_timeout_ms", 30000, 1, NO_MAX),
  int("capture.seek_soft_ms", 50, 0, NO_MAX),
  int("capture.retry", 2, 0, NO_MAX),
  int("probe.stride", 1, 1, NO_MAX),
  int("component.max_bytes", 512000, 1, NO_MAX),
  int("component.inline_asset_max_bytes", 2000000, 1, NO_MAX, { note: "2 MB read as 2,000,000 bytes" }),
  int("canvas.max_backing_pixels", 16000000, 1, NO_MAX, { human: true }),
  int("validation.sample_times", 8, 1, NO_MAX),
  num("validation.order_independence_min_psnr_db", 70, 0, NO_MAX),
  num("validation.repeat_min_psnr_db", 50, 0, NO_MAX),
  num("validation.blank_min_coverage", 0.005, 0, 1, { note: "0.5% of pixels, stored as a fraction" }),
  num("validation.bake_equivalence_min_psnr_db", 45, 0, NO_MAX),
  ...RUNG_SETTINGS,
  str("encode.color_trc", "bt709", ["bt709", "iec61966-2-1"], { human: true }),
  int("encode.aac_bitrate_kbps", 192, 128, 320, { given: true }),
];
