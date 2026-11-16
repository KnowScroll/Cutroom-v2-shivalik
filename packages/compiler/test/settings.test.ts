import assert from "node:assert/strict";
import { test } from "node:test";
import { SettingsRegistry } from "@cutroom/foundations";
import { COMPILER_SETTINGS } from "../src/index.js";

const HUMAN: readonly string[] = [];

function fresh(): SettingsRegistry {
  const reg = new SettingsRegistry();
  const result = reg.register("compiler", COMPILER_SETTINGS);
  assert.equal(result.ok, true, JSON.stringify(result));
  return reg;
}

test("compiler: every record registers without diagnostics", () => {
  const reg = fresh();
  assert.equal(reg.list("compiler").length, COMPILER_SETTINGS.length);
});

test("compiler: the human rows are human and no other row is", () => {
  const reg = fresh();
  for (const name of HUMAN) assert.equal(reg.get(name)?.override_by, "human", name);
  const actual = reg
    .list("compiler")
    .filter((s) => s.override_by === "human")
    .map((s) => s.name);
  assert.deepEqual([...actual].sort(), [...HUMAN].sort());
});

test("compiler: sampled defaults match the design text", () => {
  const reg = fresh();
  const want: ReadonlyArray<readonly [string, unknown]> = [
    ["timing.max_points", 1000], // lld/05 §5 row timing.max_points
    ["staging.handoff_tolerance_du", 24], // lld/05 §5 row staging.handoff_tolerance_du (G4)
    ["bake.mode", "off"], // lld/05 §5 row bake.mode
    ["camera.zoom_max", 8], // lld/05 §5 row camera.zoom_min, camera.zoom_max (second value)
  ];
  for (const [name, value] of want) assert.deepEqual(reg.get(name)?.default, value, name);
});
