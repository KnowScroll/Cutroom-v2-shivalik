import assert from "node:assert/strict";
import { test } from "node:test";
import { SettingsRegistry } from "@cutroom/foundations";
import { SCHEDULER_SETTINGS } from "../src/index.js";

const HUMAN: readonly string[] = [
  "db.commit_tick_ms",
  "unknown.resend_max",
  "budget.duplicate_spend_usd",
  "budget.hard_cap_usd",
  "budget.soft_target_usd",
  "budget.revision_cycle_usd",
  "budget.delivery_reserve_usd",
  "compute.usd_per_hour",
  "llm.max_concurrent",
  "net.per_host_concurrent",
  "net.max_concurrent",
  "cache.max_gb",
  "retention.irreproducible_days",
  "retention.derived_final_days",
  "retention.derived_cheap_days",
  "retention.logs_days",
];

function fresh(): SettingsRegistry {
  const reg = new SettingsRegistry();
  const result = reg.register("scheduler", SCHEDULER_SETTINGS);
  assert.equal(result.ok, true, JSON.stringify(result));
  return reg;
}

test("scheduler: every record registers without diagnostics", () => {
  const reg = fresh();
  assert.equal(reg.list("scheduler").length, SCHEDULER_SETTINGS.length);
});

test("scheduler: the human rows are human and no other row is", () => {
  const reg = fresh();
  for (const name of HUMAN) assert.equal(reg.get(name)?.override_by, "human", name);
  const actual = reg
    .list("scheduler")
    .filter((s) => s.override_by === "human")
    .map((s) => s.name);
  assert.deepEqual([...actual].sort(), [...HUMAN].sort());
});

test("scheduler: sampled defaults match the design text", () => {
  const reg = fresh();
  const want: ReadonlyArray<readonly [string, unknown]> = [
    ["browser.mem_budget_mb", 950], // lld/06 §5 row browser.max / browser.mem_budget_mb
    ["llm.max_concurrent", 8], // lld/06 §5 row llm.limit_fraction / llm.max_concurrent / llm.start_concurrent (U11)
    ["breaker.failure_count", 5], // lld/06 §5 row breaker.open_s / breaker.failure_count (B:M3-7)
    ["budget.hard_cap_usd", 15], // lld/06 §5 row budget.hard_cap_usd / soft_target / revision_cycle
  ];
  for (const [name, value] of want) assert.deepEqual(reg.get(name)?.default, value, name);
});
