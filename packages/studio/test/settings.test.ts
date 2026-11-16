import assert from "node:assert/strict";
import { test } from "node:test";
import { SettingsRegistry } from "@cutroom/foundations";
import { STUDIO_SETTINGS } from "../src/index.js";

const HUMAN: readonly string[] = [
  "delivery.audio.loudness_lufs",
  "delivery.audio.verify_max_dbtp",
  "voice.final_timing",
  "voice.engine",
  "voice.provider_only",
  "music.grid_tolerance_ms",
  "rights.share_alike_ok",
  "fetch.contact_identity",
  "fetch.max_bytes_image",
  "fetch.max_bytes_video",
  "fetch.max_bytes_document",
  "fetch.max_redirects",
  "fetch.per_host_interval_ms",
  "research.min_sources_for_numbers",
  "screen_capture.allowed_origins",
];

function fresh(): SettingsRegistry {
  const reg = new SettingsRegistry();
  const result = reg.register("studio", STUDIO_SETTINGS);
  assert.equal(result.ok, true, JSON.stringify(result));
  return reg;
}

test("studio: every record registers without diagnostics", () => {
  const reg = fresh();
  assert.equal(reg.list("studio").length, STUDIO_SETTINGS.length);
});

test("studio: the human rows are human and no other row is", () => {
  const reg = fresh();
  for (const name of HUMAN) assert.equal(reg.get(name)?.override_by, "human", name);
  const actual = reg
    .list("studio")
    .filter((s) => s.override_by === "human")
    .map((s) => s.name);
  assert.deepEqual([...actual].sort(), [...HUMAN].sort());
});

test("studio: sampled defaults match the design text", () => {
  const reg = fresh();
  const want: ReadonlyArray<readonly [string, unknown]> = [
    ["delivery.audio.limit_dbtp", -3], // lld/08 §5 row delivery.audio.limit_dbtp (-3.0; lld/11 §6 says -1.5, the later lld/11 §12.2 (1.5 dB AAC true-peak rise) and A:M1-3 win)
    ["rights.share_alike_ok", false], // lld/08 §5 row rights.share_alike_ok (U4)
    ["fetch.contact_identity", null], // lld/08 §5 row fetch.contact_identity (unset, U5)
    ["screen_capture.viewport_px", [1280, 800]], // lld/08 §5 row screen_capture.viewport_px
    ["screen_capture.allowed_origins", []], // lld/08 §5 row screen_capture.allowed_origins (U6)
    ["align.word_end_offset_ms", 80], // lld/08 §5 row align.word_end_offset_ms (L10)
    ["captions.min_duration_ms", { phrase: 700, word_pop: 400, highlight: 400 }], // lld/08 §5 row captions.min_duration_ms
  ];
  for (const [name, value] of want) assert.deepEqual(reg.get(name)?.default, value, name);
});
