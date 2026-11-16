import assert from "node:assert/strict";
import { test } from "node:test";
import { SettingsRegistry } from "@cutroom/foundations";
import { HARNESS_SETTINGS } from "../src/index.js";

const HUMAN: readonly string[] = ["audit.retention_days", "audit.max_gb"];

function fresh(): SettingsRegistry {
  const reg = new SettingsRegistry();
  const result = reg.register("harness", HARNESS_SETTINGS);
  assert.equal(result.ok, true, JSON.stringify(result));
  return reg;
}

test("harness: every record registers without diagnostics", () => {
  const reg = fresh();
  assert.equal(reg.list("harness").length, HARNESS_SETTINGS.length);
});

test("harness: the human rows are human and no other row is", () => {
  const reg = fresh();
  for (const name of HUMAN) assert.equal(reg.get(name)?.override_by, "human", name);
  const actual = reg
    .list("harness")
    .filter((s) => s.override_by === "human")
    .map((s) => s.name);
  assert.deepEqual([...actual].sort(), [...HUMAN].sort());
});

test("harness: sampled defaults match the design text", () => {
  const reg = fresh();
  const want: ReadonlyArray<readonly [string, unknown]> = [
    ["context.hard_max_tokens", 400000], // lld/07 §5 row context.compact_at_tokens / context.hard_max_tokens
    ["tool.result_max_tokens", { default: 2000, project_read: 4000, web_fetch: 8000 }], // lld/07 §5 row tool.result_max_tokens
    ["audit.retention_days", "keep_all"], // lld/07 §5 row audit.retention_days (A:M0-3)
    ["reviewer.max_output_tokens", { shot: 16000, film: 24000 }], // lld/07 §5 row reviewer.max_output_tokens
  ];
  for (const [name, value] of want) assert.deepEqual(reg.get(name)?.default, value, name);
});
