// Design: L18 (Linux-only unit tests live in *.linux.test.ts and run by npm run test:linux)
// A real test, and the proof that the split works: npm test never runs this file; npm run test:linux does.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("this file runs only on Linux, where /proc exists", () => {
  assert.equal(process.platform, "linux");
  const mounts = readFileSync("/proc/mounts", "utf8");
  assert.ok(mounts.length > 0);
});
