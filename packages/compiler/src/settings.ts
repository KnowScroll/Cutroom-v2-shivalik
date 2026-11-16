// Design: lld/05 §5 (R4 named settings; none is `human`), lld/04 §2.7 (G15), lld/11 K6, H1, H10, G4 (what R4 owns)
import type { SettingRecord } from "@cutroom/foundations";

const OWNER = "compiler";
const DERIVED = "range derived (M0-05)";
const NO_MAX = Number.MAX_SAFE_INTEGER;

const int = (name: string, def: number, min: number, max: number): SettingRecord => ({
  name,
  owner: OWNER,
  type: "integer",
  default: def,
  override_by: "director",
  range: { kind: "number_range", min, max },
  note: DERIVED,
});

const num = (name: string, def: number, min: number, max: number): SettingRecord => ({
  ...int(name, def, min, max),
  type: "number",
});

// Every numeric range is derived (note); `bake.mode` lists the values the design gives; the boolean has no range to derive.
export const COMPILER_SETTINGS: readonly SettingRecord[] = [
  int("timing.max_witnesses", 3, 1, NO_MAX),
  int("timing.max_points", 1000, 1, NO_MAX),
  int("timing.est_word_ms", 400, 1, NO_MAX),
  num("plan.quantum", 1e-5, 1e-12, 1),
  int("chunk.max_frames", 150, 1, NO_MAX),
  int("chunk.frames", 90, 1, NO_MAX),
  int("chunk.min_frames", 30, 1, NO_MAX),
  num("staging.tolerance_du", 8, 0, NO_MAX),
  num("staging.anchor_tolerance_du", 6, 0, NO_MAX),
  num("staging.handoff_tolerance_du", 24, 0, NO_MAX),
  {
    name: "staging.follow_enabled",
    owner: OWNER,
    type: "boolean",
    default: true,
    override_by: "director",
    range: { kind: "boolean" },
  },
  int("follow.max_depth", 2, 1, NO_MAX),
  int("pixi.max_per_unit", 1, 1, NO_MAX),
  num("camera.zoom_min", 0.25, 0.01, 1),
  num("camera.zoom_max", 8, 1, NO_MAX),
  num("camera.shake_hz", 12, 0, NO_MAX),
  {
    name: "bake.mode",
    owner: OWNER,
    type: "string",
    default: "off",
    override_by: "director",
    range: { kind: "values", values: ["off", "opaque_only", "any"] },
  },
  int("bake.max_pixels", 16000000, 1, NO_MAX),
  int("compile.budget_ms", 3000, 1, NO_MAX),
];
