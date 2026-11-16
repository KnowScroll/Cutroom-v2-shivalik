// Design: testing §8 rule 5; M0-01b tests (the known-failures registry; the linux split, L18)
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { listFiles } from "./files.mjs";
import { evaluate, validateRegistry } from "./known-failures.mjs";
import { selectFiles } from "./test-files.mjs";
import { makeWorkspace } from "./tmp-workspace.mjs";

const here = dirname(fileURLToPath(import.meta.url));
// A child runner must not inherit this run's test context, or Node refuses to start a nested run.
const childEnv = () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return env;
};
const entry = { test: "f.js::t", reason: "r", issue: 7, workPackage: "M9-99", matches: "EXPECTED_CODE" };
const fail = (message) => ({ id: "f.js::t", file: "f.js", status: "fail", message });

test("an unlisted failure fails the run", () => {
  const { failures, counts } = evaluate([fail("boom")], [], ["f.js"]);
  assert.equal(counts.failed, 1);
  assert.match(failures[0], /failed and is not in tests\/known-failures\.ts/);
});

test("a listed test failing with its expected code is known-failing, not a failure", () => {
  const { failures, counts } = evaluate([fail("EXPECTED_CODE | something")], [entry], ["f.js"]);
  assert.deepEqual(failures, []);
  assert.equal(counts.knownFailing, 1);
});

test("a listed test failing with another code fails the run", () => {
  const { failures } = evaluate([fail("OTHER_CODE")], [entry], ["f.js"]);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /another reason/);
});

test("a listed test that passes fails the run until its entry is removed", () => {
  const { failures } = evaluate(
    [{ id: "f.js::t", file: "f.js", status: "pass", message: "" }],
    [entry],
    ["f.js"],
  );
  assert.equal(failures.length, 1);
  assert.match(failures[0], /it passes; remove the entry/);
});

test("an entry whose file ran but whose test did not appear fails; one for another level's file is ignored", () => {
  assert.equal(evaluate([], [entry], ["f.js"]).failures.length, 1);
  assert.deepEqual(evaluate([], [entry], ["other.js"]).failures, []);
});

test("a malformed entry is reported", () => {
  const problems = validateRegistry([
    { test: "a::b", reason: "", issue: 0, workPackage: "M0", matches: "x" },
  ]);
  assert.equal(problems.length, 2);
});

test("the runner applies the registry end to end on a fixture workspace", () => {
  const ws = makeWorkspace({
    "tools/a.test.mjs":
      'import { test } from "node:test";\ntest("listed", () => { throw new Error("EXPECTED_CODE here"); });\ntest("good", () => {});\n',
    "tests/known-failures.ts":
      'export const knownFailures = [{ test: "tools/a.test.mjs::listed", reason: "r", issue: 1, workPackage: "M9-99", matches: "EXPECTED_CODE" }];\n',
  });
  try {
    const run = (extra) =>
      spawnSync(process.execPath, [join(here, "..", "run-tests.mjs"), "unit", "--root", ws.root, ...extra], {
        encoding: "utf8",
        env: childEnv(),
      });
    const ok = run([]);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /passed 1, failed 0, known-failing 1/);

    ws.write(
      "tools/b.test.mjs",
      'import { test } from "node:test";\ntest("unlisted", () => { throw new Error("nope"); });\n',
    );
    const bad = run([]);
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /tools\/b\.test\.mjs::unlisted: failed and is not in tests\/known-failures\.ts/);

    ws.write("tools/b.test.mjs", 'import { test } from "node:test";\ntest("fine", () => {});\n');
    ws.write("tools/a.test.mjs", 'import { test } from "node:test";\ntest("listed", () => {});\n');
    const passing = run([]);
    assert.equal(passing.status, 1);
    assert.match(passing.stdout, /but it passes; remove the entry/);
  } finally {
    ws.cleanup();
  }
});

test("*.linux.test files are left out of unit and belong to the linux level (L18)", () => {
  const ws = makeWorkspace({
    "tools/plain.test.mjs": "",
    "tools/proc.linux.test.mjs": "",
    "tools/drv.wsl.test.mjs": "",
    "packages/p/dist/test/x.test.js": "",
    "packages/p/dist/test/sock.linux.test.js": "",
    "packages/p/dist/test/named/chrome.test.js": "",
    "tests/claims/c.test.ts": "",
    "tests/acceptance/a.test.ts": "",
    "tests/acceptance/a.live.test.ts": "",
  });
  try {
    const names = (level) =>
      selectFiles(ws.root, level, { listFiles }).map((f) => f.replace(ws.root, "").replace(/\\/g, "/"));
    assert.deepEqual(names("unit").sort(), ["/packages/p/dist/test/x.test.js", "/tools/plain.test.mjs"]);
    assert.deepEqual(names("linux").sort(), [
      "/packages/p/dist/test/sock.linux.test.js",
      "/tools/proc.linux.test.mjs",
    ]);
    assert.deepEqual(names("render"), ["/packages/p/dist/test/named/chrome.test.js"]);
    assert.deepEqual(names("claims"), ["/tests/claims/c.test.ts"]);
    assert.deepEqual(names("accept"), ["/tests/acceptance/a.test.ts"]);
    assert.deepEqual(names("live"), ["/tests/acceptance/a.live.test.ts"]);
    assert.deepEqual(names("wsl"), ["/tools/drv.wsl.test.mjs"]);
  } finally {
    ws.cleanup();
  }
});

test("test:live refuses to start without CUTROOM_LIVE=1", () => {
  const env = childEnv();
  delete env.CUTROOM_LIVE;
  const r = spawnSync(process.execPath, [resolve(here, "..", "run-tests.mjs"), "live"], {
    encoding: "utf8",
    env,
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /refuses to start without CUTROOM_LIVE=1/);
});
