import assert from "node:assert/strict";
import { test } from "node:test";
import { SettingsRegistry } from "@cutroom/foundations";
import { QUALITY_SETTINGS } from "../src/index.js";

const HUMAN: readonly string[] = [
  "loud.tolerance_lu",
  "sync.mux_early_ms",
  "sync.mux_late_ms",
  "final.match_psnr_min_db",
  "final.match_samples",
  "final.min_integrated_lufs",
  "review.final_max_unseen_gap_ms",
  "review.hard_proof_votes",
];

function fresh(): SettingsRegistry {
  const reg = new SettingsRegistry();
  const result = reg.register("quality", QUALITY_SETTINGS);
  assert.equal(result.ok, true, JSON.stringify(result));
  return reg;
}

test("quality: every record registers without diagnostics", () => {
  const reg = fresh();
  assert.equal(reg.list("quality").length, QUALITY_SETTINGS.length);
});

test("quality: the human rows are human and no other row is", () => {
  const reg = fresh();
  for (const name of HUMAN) assert.equal(reg.get(name)?.override_by, "human", name);
  const actual = reg
    .list("quality")
    .filter((s) => s.override_by === "human")
    .map((s) => s.name);
  assert.deepEqual([...actual].sort(), [...HUMAN].sort());
});

test("quality: sampled defaults match the design text", () => {
  const reg = fresh();
  const want: ReadonlyArray<readonly [string, unknown]> = [
    ["contrast.min_ratio", 4.5], // lld/09 §5 row contrast.min_ratio / large_min_ratio / large_du / bg_percentile
    ["stt.short_take_words", 10], // lld/09 §5 row stt.short_take_words (L13)
    ["review.max_calls_per_film", 50], // lld/09 §5 row review.max_calls_per_film
    ["stop.time_soft_limit_min", 150], // lld/09 §5 row stop.time_soft_limit_min
    ["sync.event_late_ms", 60], // lld/09 §5 row sync.event_early_ms / sync.event_late_ms
  ];
  for (const [name, value] of want) assert.deepEqual(reg.get(name)?.default, value, name);
});
