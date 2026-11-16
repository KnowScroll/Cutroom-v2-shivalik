// Design: testing §1 (GitHub Actions); U35; M0-01b "the workflow has one job, permissions: contents: read,
// no secrets, cancel-in-progress, and no render, live or Windows job"
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const text = readFileSync(join(root, ".github", "workflows", "checks.yml"), "utf8");
const code = text
  .split("\n")
  .filter((line) => !line.trim().startsWith("#"))
  .join("\n");

test("the workflow has exactly one job, on Ubuntu, with a timeout", () => {
  const jobs = code.slice(code.indexOf("\njobs:") + 6);
  const jobNames = [...jobs.matchAll(/^ {2}([\w-]+):\s*$/gm)].map((m) => m[1]);
  assert.deepEqual(jobNames, ["checks"]);
  assert.match(code, /runs-on: ubuntu-latest/);
  assert.match(code, /timeout-minutes: 10/);
  assert.doesNotMatch(code, /windows|macos/i);
});

test("permissions are contents: read and nothing else; no secrets", () => {
  assert.match(code, /^permissions:\n {2}contents: read\n/m);
  assert.equal((code.match(/permissions:/g) ?? []).length, 1);
  assert.doesNotMatch(code, /secrets\./);
  assert.doesNotMatch(code, /GITHUB_TOKEN|MINIMAX|OPENROUTER|CUTROOM_LIVE/);
});

test("a superseded run is cancelled; the triggers are pull requests, milestone tags and by hand", () => {
  assert.match(code, /concurrency:\n {2}group: .+\n {2}cancel-in-progress: true/);
  assert.match(code, /pull_request:\n {4}branches: \[main\]/);
  assert.match(code, /tags: \["m\*-done"\]/);
  assert.match(code, /workflow_dispatch:/);
});

test("it runs npm ci, check, test and test:linux, and none of the render, accept, claims or live levels", () => {
  const runs = [...code.matchAll(/^ +- run: (.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(runs, ["npm ci", "npm run check", "npm test", "npm run test:linux"]);
});

test("every action is pinned by a full commit SHA", () => {
  const uses = [...code.matchAll(/uses: (\S+)/g)].map((m) => m[1]);
  assert.ok(uses.length >= 2);
  for (const u of uses) assert.match(u, /@[0-9a-f]{40}$/, u);
});
