import assert from "node:assert/strict";
import { test } from "node:test";
import { FOUNDATIONS_SETTINGS, SettingsRegistry } from "../src/index.js";

test("foundations: owns no named setting and registers an empty catalogue", () => {
  assert.equal(FOUNDATIONS_SETTINGS.length, 0);
  assert.equal(new SettingsRegistry().register("foundations", FOUNDATIONS_SETTINGS).ok, true);
});
