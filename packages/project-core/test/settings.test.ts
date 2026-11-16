import assert from "node:assert/strict";
import { test } from "node:test";
import { SettingsRegistry } from "@cutroom/foundations";
import { PROJECT_CORE_SETTINGS } from "../src/index.js";

const HUMAN: readonly string[] = [
  "store.number_decimals",
  "db.synchronous",
  "db.backup_hours",
  "db.backup_keep",
  "blob.verify_on_read",
  "blob.grace_hours",
  "retention.prune_intermediate_days",
  "rollback.excluded_kinds",
];

function fresh(): SettingsRegistry {
  const reg = new SettingsRegistry();
  const result = reg.register("project-core", PROJECT_CORE_SETTINGS);
  assert.equal(result.ok, true, JSON.stringify(result));
  return reg;
}

test("project-core: every record registers without diagnostics", () => {
  const reg = fresh();
  assert.equal(reg.list("project-core").length, PROJECT_CORE_SETTINGS.length);
});

test("project-core: the human rows are human and no other row is", () => {
  const reg = fresh();
  for (const name of HUMAN) assert.equal(reg.get(name)?.override_by, "human", name);
  const actual = reg
    .list("project-core")
    .filter((s) => s.override_by === "human")
    .map((s) => s.name);
  assert.deepEqual([...actual].sort(), [...HUMAN].sort());
});

test("project-core: sampled defaults match the design text", () => {
  const reg = fresh();
  const want: ReadonlyArray<readonly [string, unknown]> = [
    ["store.number_decimals", 6], // lld/04 §5 row store.number_decimals
    ["db.backup_keep", 4], // lld/04 §5 row db.backup_keep (A:M0-10)
    ["rollback.excluded_kinds", ["lock", "decision"]], // lld/04 §5 row rollback.excluded_kinds
  ];
  for (const [name, value] of want) assert.deepEqual(reg.get(name)?.default, value, name);
});
