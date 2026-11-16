// Design: lld/08 §5 (R7 named settings), lld/04 §2.7 (G15), lld/11 G16, G20, G22, K7, U4, U6, A:M0-3, L9, L10, L12, L40
import type { SettingRecord } from "@cutroom/foundations";

const OWNER = "studio";
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

const H = { human: true } as const;
const NO_TEXT = "the registry has no free-text string range, so the range lists the design's value only";

export const STUDIO_SETTINGS: readonly SettingRecord[] = [
  num("delivery.audio.loudness_lufs", -14, -70, 0, H),
  num("delivery.audio.limit_dbtp", -3, -20, 0),
  num("delivery.audio.verify_max_dbtp", -1, -20, 0, H),
  num("mix.master_tolerance_lu", 0.5, 0, NO_MAX),
  int("mix.master_max_passes", 3, 1, NO_MAX),
  num("mix.voice_line_lufs", -18, -70, 0),
  num("mix.music_lufs", -24, -70, 0),
  num("mix.sfx_peak_dbfs", -10, -60, 0),
  num("mix.duck_threshold", 0.05, 0, 1),
  num("mix.duck_ratio", 6, 1, NO_MAX),
  int("mix.duck_attack_ms", 20, 0, NO_MAX),
  int("mix.duck_release_ms", 300, 0, NO_MAX),
  num("mix.duck_mix", 0.8, 0, 1),
  {
    name: "voice.final_timing",
    owner: OWNER,
    type: "string_list",
    default: ["native", "aligned"],
    override_by: "human",
    range: { kind: "list", members: ["native", "aligned"] },
    note: `${DERIVED}; the design gives no default, read as the set of take timings a final compile accepts`,
  },
  int("voice.default_takes", 2, 1, 5, { given: true }),
  str("voice.engine", "hexgrad/kokoro-82m", ["hexgrad/kokoro-82m"], { ...H, note: NO_TEXT }),
  str("voice.response_format", "pcm", ["pcm"], { note: NO_TEXT }),
  str("voice.provider_only", "deepinfra", ["deepinfra"], { ...H, note: NO_TEXT }),
  num("align.lipsync_min_fraction", 0.95, 0.5, 1, { given: true }),
  int("align.word_end_offset_ms", 80, 0, 200, { given: true }),
  int("music.grid_tolerance_ms", 20, 0, NO_MAX, H),
  int("captions.max_lines", 2, 1, NO_MAX),
  int("captions.max_chars_per_line", 26, 1, NO_MAX),
  int("captions.max_words", 7, 1, NO_MAX),
  int("captions.pause_break_ms", 350, 0, NO_MAX),
  int("captions.linger_ms", 150, 0, NO_MAX),
  int("captions.merge_gap_ms", 120, 0, NO_MAX),
  {
    name: "captions.min_duration_ms",
    owner: OWNER,
    type: "keyed",
    default: { phrase: 700, word_pop: 400, highlight: 400 },
    override_by: "director",
    range: {
      kind: "keyed",
      keys: {
        phrase: { type: "integer", range: { kind: "number_range", min: 1, max: NO_MAX } },
        word_pop: { type: "integer", range: { kind: "number_range", min: 1, max: NO_MAX } },
        highlight: { type: "integer", range: { kind: "number_range", min: 1, max: NO_MAX } },
      },
    },
    note: DERIVED,
  },
  num("captions.max_cps", 20, 1, NO_MAX),
  num("captions.max_cps_children", 17, 1, NO_MAX),
  int("mouth.tier", 1, 0, 2, { note: "tiers 0 to 2 are the ones lld/08 §2.3.3 describes" }),
  int("mouth.min_hold_frames", 2, 1, NO_MAX),
  int("mouth.closed_gap_ms", 120, 0, NO_MAX),
  int("mouth.lead_ms", 30, 0, NO_MAX),
  int("acting.min_hold_ms", 150, 0, NO_MAX),
  int("acting.max_keys_per_second", 6, 1, NO_MAX),
  int("acting.min_eye_units", 24, 0, NO_MAX),
  int("acting.repair_attempts", 3, 0, NO_MAX),
  int("capability.extend_attempts", 3, 0, NO_MAX),
  num("capability.budget_usd", 0.15, 0, NO_MAX),
  num("capability.regression_psnr_db", 50, 0, NO_MAX),
  {
    name: "rights.share_alike_ok",
    owner: OWNER,
    type: "boolean",
    default: false,
    override_by: "human",
    range: { kind: "boolean" },
  },
  int("fetch.max_bytes_image", 50000000, 1, NO_MAX, { ...H, note: "50 MB read as decimal bytes" }),
  int("fetch.max_bytes_video", 500000000, 1, NO_MAX, { ...H, note: "500 MB read as decimal bytes" }),
  int("fetch.max_bytes_document", 5000000, 1, NO_MAX, { ...H, note: "5 MB read as decimal bytes" }),
  int("fetch.max_redirects", 3, 0, NO_MAX, H),
  int("fetch.per_host_interval_ms", 1000, 0, NO_MAX, H),
  int("research.min_sources_for_numbers", 2, 1, NO_MAX, H),
  num("screen_capture.device_scale", 2, 1, NO_MAX),
  int("screen_capture.settle_ms", 500, 0, NO_MAX),
  {
    name: "screen_capture.allowed_origins",
    owner: OWNER,
    type: "string_list",
    default: [],
    override_by: "human",
    range: { kind: "list" },
  },
];
