// Design: testing §8 rule 4; M0-01b tests ("an exported code that no test asserts fails the check")
import assert from "node:assert/strict";
import { test } from "node:test";
import { makeWorkspace } from "../lib/tmp-workspace.mjs";
import { checkCodes, readCodes } from "./codes.mjs";

const codesFile =
  'export const CODES = [\n  "FIRST_CODE", // a note with an \'apostrophe\'\n  "SECOND_CODE",\n] as const;\n';

test("readCodes lists every code with its line, ignoring comments", () => {
  assert.deepEqual(
    readCodes(codesFile).map((c) => [c.code, c.line]),
    [
      ["FIRST_CODE", 2],
      ["SECOND_CODE", 3],
    ],
  );
});

test("a code that no test asserts fails the check, naming file and line", () => {
  const ws = makeWorkspace({
    "packages/a/src/codes.ts": codesFile,
    "packages/a/test/a.test.ts": 'assert.equal(result.code, "FIRST_CODE");\n',
  });
  try {
    const out = checkCodes(ws.root);
    assert.equal(out.length, 1);
    assert.equal(out[0].file, "packages/a/src/codes.ts");
    assert.equal(out[0].line, 3);
    assert.match(out[0].message, /SECOND_CODE is asserted by no test/);
  } finally {
    ws.cleanup();
  }
});

test("a code asserted in a test of another package, or in tests/, counts", () => {
  const ws = makeWorkspace({
    "packages/a/src/codes.ts": codesFile,
    "packages/b/test/b.test.ts": "assert.equal(x, 'FIRST_CODE');\n",
    "tests/claims/c.test.ts": "assert.equal(y, `SECOND_CODE`);\n",
  });
  try {
    assert.deepEqual(checkCodes(ws.root), []);
  } finally {
    ws.cleanup();
  }
});

test("a code that appears only in a non-test file does not count", () => {
  const ws = makeWorkspace({
    "packages/a/src/codes.ts": 'export const CODES = ["ONLY_HERE"] as const;\n',
    "packages/a/src/use.ts": 'export const x = "ONLY_HERE";\n',
  });
  try {
    assert.equal(checkCodes(ws.root).length, 1);
  } finally {
    ws.cleanup();
  }
});

test("the real workspace passes the code check", async () => {
  const { dirname, resolve } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  assert.deepEqual(checkCodes(root), []);
});
