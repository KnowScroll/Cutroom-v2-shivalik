// Design: M0-01b "docs/impl/DEPENDENCIES.md matches package-lock.json"
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { makeWorkspace } from "../lib/tmp-workspace.mjs";
import { checkDependencies } from "./dependencies.mjs";

const files = (overrides = {}) => ({
  "package.json": JSON.stringify({ devDependencies: { "left-pad": "1.3.0" } }),
  "package-lock.json": JSON.stringify({ packages: { "node_modules/left-pad": { version: "1.3.0" } } }),
  "docs/impl/DEPENDENCIES.md":
    "| Name | Version |\n|---|---|\n| `left-pad` | 1.3.0 | padding | 2026-11-16 |\n",
  ...overrides,
});
const messages = (ws) => checkDependencies(ws.root).map((v) => `${v.file}:${v.line}: ${v.message}`);

test("a consistent record passes", () => {
  const ws = makeWorkspace(files());
  try {
    assert.deepEqual(messages(ws), []);
  } finally {
    ws.cleanup();
  }
});

test("a range, a missing row, a stale version and an orphan row each fail", () => {
  const ws = makeWorkspace(
    files({
      "package.json": JSON.stringify({ devDependencies: { "left-pad": "^1.3.0", other: "2.0.0" } }),
      "docs/impl/DEPENDENCIES.md": "| `left-pad` | 1.2.0 | x | d |\n| `ghost` | 1.0.0 | x | d |\n",
    }),
  );
  try {
    const out = messages(ws).join("\n");
    assert.match(out, /left-pad is not pinned exactly/);
    assert.match(out, /other has no row/);
    assert.match(out, /left-pad: the table says 1\.2\.0, package-lock\.json holds 1\.3\.0/);
    assert.match(out, /ghost is listed but no package\.json declares it/);
  } finally {
    ws.cleanup();
  }
});

test("the real record matches the real lockfile", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  assert.deepEqual(checkDependencies(root), []);
});
