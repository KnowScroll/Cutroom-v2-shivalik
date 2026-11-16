import assert from "node:assert/strict";
import { test } from "node:test";
import { COMPILER_SETTINGS } from "@cutroom/compiler";
import { SettingsRegistry } from "@cutroom/foundations";
import { HARNESS_SETTINGS } from "@cutroom/harness";
import { PROJECT_CORE_SETTINGS } from "@cutroom/project-core";
import { QUALITY_SETTINGS } from "@cutroom/quality";
import { RENDER_SETTINGS } from "@cutroom/render";
import { SCHEDULER_SETTINGS } from "@cutroom/scheduler";
import { STUDIO_SETTINGS } from "@cutroom/studio";
import { CLI_SETTINGS } from "../src/index.js";

test("cli: owns no named setting; every package's catalogue registers into one registry (each name once)", () => {
  assert.equal(CLI_SETTINGS.length, 0);
  const reg = new SettingsRegistry();
  const all = [
    ["render", RENDER_SETTINGS],
    ["project-core", PROJECT_CORE_SETTINGS],
    ["compiler", COMPILER_SETTINGS],
    ["scheduler", SCHEDULER_SETTINGS],
    ["quality", QUALITY_SETTINGS],
    ["harness", HARNESS_SETTINGS],
    ["studio", STUDIO_SETTINGS],
    ["cli", CLI_SETTINGS],
  ] as const;
  for (const [owner, records] of all) {
    const result = reg.register(owner, records);
    assert.equal(result.ok, true, `${owner}: ${JSON.stringify(result)}`);
  }
  // Names the design gives to one owner and uses by name elsewhere (H1, H9, H10, G4).
  for (const [name, owner] of [
    ["pixi.max_per_unit", "compiler"],
    ["pixi.unit_browsers", "scheduler"],
    ["capture.max_buffered_frames", "render"],
    ["follow.max_depth", "compiler"],
    ["staging.handoff_tolerance_du", "compiler"],
  ] as const)
    assert.equal(reg.get(name)?.owner, owner, name);
});

test("cli: the names lld/07 §5 lists as gone are not registered", () => {
  const reg = new SettingsRegistry();
  for (const [owner, records] of [
    ["render", RENDER_SETTINGS],
    ["project-core", PROJECT_CORE_SETTINGS],
    ["compiler", COMPILER_SETTINGS],
    ["scheduler", SCHEDULER_SETTINGS],
    ["quality", QUALITY_SETTINGS],
    ["harness", HARNESS_SETTINGS],
    ["studio", STUDIO_SETTINGS],
  ] as const)
    assert.equal(reg.register(owner, records).ok, true, owner);
  for (const gone of [
    "llm.rpm_ceiling",
    "llm.tpm_ceiling",
    "llm.max_concurrent_requests",
    "llm.retry_max",
    "budget.wrapup_reserve_usd",
    "budget.thresholds",
    "fetch.max_text_tokens",
  ])
    assert.equal(reg.get(gone), undefined, gone);
});
