import assert from "node:assert/strict";
import { test } from "node:test";
import { SettingsRegistry } from "@cutroom/foundations";
import { RENDER_SETTINGS } from "../src/index.js";

const HUMAN: readonly string[] = [
  "chrome.build_id",
  "capture.warmup_frames",
  "canvas.max_backing_pixels",
  "encode.color_trc",
];

function fresh(): SettingsRegistry {
  const reg = new SettingsRegistry();
  const result = reg.register("render", RENDER_SETTINGS);
  assert.equal(result.ok, true, JSON.stringify(result));
  return reg;
}

test("render: every record registers without diagnostics", () => {
  const reg = fresh();
  assert.equal(reg.list("render").length, RENDER_SETTINGS.length);
});

test("render: the human rows are human and no other row is", () => {
  const reg = fresh();
  for (const name of HUMAN) assert.equal(reg.get(name)?.override_by, "human", name);
  const actual = reg
    .list("render")
    .filter((s) => s.override_by === "human")
    .map((s) => s.name);
  assert.deepEqual([...actual].sort(), [...HUMAN].sort());
});

test("render: sampled defaults match the design text", () => {
  const reg = fresh();
  const want: ReadonlyArray<readonly [string, unknown]> = [
    ["chrome.build_id", "157.0.8103.78"], // lld/03 §5 row chrome.build_id
    ["capture.max_buffered_frames", 8], // lld/03 §5 row capture.max_buffered_frames (H9)
    ["capture.cdp_timeout_ms", 30000], // lld/03 §5 row capture.init_timeout_ms, seek_timeout_ms, cdp_timeout_ms (third value)
    ["rung.final.crf", 18], // lld/03 §2.12 table, final row (x264 medium, CRF 18)
    ["encode.aac_bitrate_kbps", 192], // lld/03 §5 row encode.aac_bitrate_kbps (A:M1-3)
  ];
  for (const [name, value] of want) assert.deepEqual(reg.get(name)?.default, value, name);
});
