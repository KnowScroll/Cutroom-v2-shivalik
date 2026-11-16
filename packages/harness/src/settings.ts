// Design: lld/07 §5 (R6 named settings), lld/04 §2.7 (G15), lld/11 K5, G22, A:M0-3 (keyed values, audit.retention_days)
import type { SettingRecord } from "@cutroom/foundations";

const OWNER = "harness";
const DERIVED = "range derived (M0-05)";
const NO_MAX = Number.MAX_SAFE_INTEGER;

const int = (name: string, def: number, min: number, max: number = NO_MAX): SettingRecord => ({
  name,
  owner: OWNER,
  type: "integer",
  default: def,
  override_by: "director",
  range: { kind: "number_range", min, max },
  note: DERIVED,
});

const intKey = (min: number) => ({
  type: "integer" as const,
  range: { kind: "number_range" as const, min, max: NO_MAX },
});

const numKeys = (min: number) => intKey(min);

export const HARNESS_SETTINGS: readonly SettingRecord[] = [
  int("context.compact_at_tokens", 180000, 1),
  int("context.hard_max_tokens", 400000, 1),
  {
    name: "tool.result_max_tokens",
    owner: OWNER,
    type: "keyed",
    default: { default: 2000, project_read: 4000, web_fetch: 8000 },
    override_by: "director",
    range: {
      kind: "keyed",
      keys: { default: intKey(1), project_read: intKey(1), web_fetch: intKey(1) },
    },
    note: DERIVED,
  },
  int("tool.repair_attempts_max", 3, 0),
  int("tool.repair_hard_stop", 2, 0),
  int("director.event_coalesce_ms", 5000, 0),
  int("director.stall_nudges_max", 2, 0),
  int("director.images_per_run_max", 6, 0),
  int("director.max_output_tokens", 16000, 1),
  int("subloop.max_depth", 2, 1),
  int("subloop.submit_nudges_max", 2, 0),
  int("subloop.max_output_tokens", 8000, 1),
  {
    name: "subloop.max_concurrent",
    owner: OWNER,
    type: "keyed",
    default: { authors: 6, reviewers: 3, researchers: 2, experiments: 1, treatments: 1 },
    override_by: "director",
    range: {
      kind: "keyed",
      keys: {
        authors: numKeys(1),
        reviewers: numKeys(1),
        researchers: numKeys(1),
        experiments: numKeys(1),
        treatments: numKeys(1),
      },
    },
    note: DERIVED,
  },
  int("author.candidates", 1, 1),
  int("author.repair_attempts_max", 3, 0),
  int("author.escalation_attempts", 1, 0),
  int("author.visual_repair_rounds", 1, 0),
  int("author.max_output_tokens", 32000, 1),
  {
    name: "reviewer.thinking",
    owner: OWNER,
    type: "keyed",
    default: { shot: "adaptive", film: "adaptive" },
    override_by: "director",
    range: {
      kind: "keyed",
      keys: {
        shot: { type: "string", range: { kind: "values", values: ["adaptive", "off"] } },
        film: { type: "string", range: { kind: "values", values: ["adaptive", "off"] } },
      },
    },
    note: `${DERIVED}; "off" is the alternative lld/11 batch 2c measured`,
  },
  {
    name: "reviewer.max_output_tokens",
    owner: OWNER,
    type: "keyed",
    default: { shot: 16000, film: 24000 },
    override_by: "director",
    range: { kind: "keyed", keys: { shot: intKey(1), film: intKey(1) } },
    note: DERIVED,
  },
  {
    name: "reviewer.retry_output_factor",
    owner: OWNER,
    type: "number",
    default: 2,
    override_by: "director",
    range: { kind: "number_range", min: 1, max: NO_MAX },
    note: DERIVED,
  },
  int("treatment.candidates", 3, 1),
  int("treatment.animatic_candidates", 2, 0),
  {
    name: "treatment.budget_fraction",
    owner: OWNER,
    type: "number",
    default: 0.2,
    override_by: "director",
    range: { kind: "number_range", min: 0, max: 1 },
    note: DERIVED,
  },
  {
    name: "audit.retention_days",
    owner: OWNER,
    type: "integer_or_string",
    default: "keep_all",
    override_by: "human",
    range: {
      kind: "any_of",
      parts: [
        { kind: "number_range", min: 1, max: NO_MAX },
        { kind: "values", values: ["keep_all"] },
      ],
    },
    note: `${DERIVED}; the days part`,
  },
  {
    name: "audit.max_gb",
    owner: OWNER,
    type: "number",
    default: 5,
    override_by: "human",
    range: { kind: "number_range", min: 0.1, max: NO_MAX },
    note: DERIVED,
  },
];
