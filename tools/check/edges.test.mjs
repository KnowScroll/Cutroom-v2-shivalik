// Design: M0-01b tests ("an allowed import passes; a forbidden import, an undeclared dependency and a deep
// import each fail, naming file and line"); knowscroll-workflow "What to copy" row 15 (the check can fail)
import assert from "node:assert/strict";
import { test } from "node:test";
import { edgeFixture } from "../lib/tmp-workspace.mjs";
import { checkEdges, findImports } from "./edges.mjs";

const messages = (violations) => violations.map((v) => `${v.file}:${v.line}: ${v.message}`);

test("a clean workspace with an allowed import passes", () => {
  const ws = edgeFixture();
  try {
    assert.deepEqual(checkEdges(ws.root), []);
  } finally {
    ws.cleanup();
  }
});

test("a forbidden import fails, naming file and line", () => {
  const ws = edgeFixture({
    "packages/a/src/index.ts": 'export const X = 1;\nimport { B } from "@cutroom/b";\nexport const A = B;\n',
  });
  try {
    const out = messages(checkEdges(ws.root));
    assert.equal(out.length, 1);
    assert.match(out[0], /^packages\/a\/src\/index\.ts:2: forbidden import: a may not import @cutroom\/b/);
  } finally {
    ws.cleanup();
  }
});

test("a deep import by package name fails", () => {
  const ws = edgeFixture({
    "packages/b/src/index.ts": 'import { A } from "@cutroom/a/src/index.js";\nexport const B = A;\n',
  });
  try {
    const out = messages(checkEdges(ws.root));
    assert.equal(out.length, 1);
    assert.match(out[0], /^packages\/b\/src\/index\.ts:1: deep import '@cutroom\/a\/src\/index\.js'/);
  } finally {
    ws.cleanup();
  }
});

test("a deep import by relative path into another package fails", () => {
  const ws = edgeFixture({
    "packages/b/src/index.ts": 'import { A } from "../../a/src/index.js";\nexport const B = A;\n',
  });
  try {
    const out = messages(checkEdges(ws.root));
    assert.equal(out.length, 1);
    assert.match(
      out[0],
      /^packages\/b\/src\/index\.ts:1: deep import '\.\.\/\.\.\/a\/src\/index\.js' reaches into package 'a'/,
    );
  } finally {
    ws.cleanup();
  }
});

test("an import of a package no package.json declares fails as an undeclared dependency", () => {
  const ws = edgeFixture({
    "packages/a/src/index.ts": 'import { thing } from "left-pad";\nexport const A = thing;\n',
  });
  try {
    const out = messages(checkEdges(ws.root));
    assert.equal(out.length, 1);
    assert.match(out[0], /^packages\/a\/src\/index\.ts:1: undeclared dependency: left-pad/);
  } finally {
    ws.cleanup();
  }
});

test("a root dev dependency such as fast-check may be imported by any package's tests", () => {
  const ws = edgeFixture({
    "packages/a/test/x.test.ts": 'import fc from "fast-check";\nexport const T = fc;\n',
  });
  try {
    assert.deepEqual(checkEdges(ws.root), []);
  } finally {
    ws.cleanup();
  }
});

test("a package.json dependency that is not an allowed edge fails, as does a missing allowed one", () => {
  const ws = edgeFixture({
    "packages/a/package.json": JSON.stringify({
      name: "@cutroom/a",
      dependencies: { "@cutroom/b": "0.0.0" },
    }),
    "packages/b/package.json": JSON.stringify({ name: "@cutroom/b", dependencies: {} }),
  });
  try {
    const out = messages(checkEdges(ws.root));
    assert.ok(
      out.some((m) =>
        /packages\/a\/package\.json:\d+: a depends on @cutroom\/b, which is not an allowed edge/.test(m),
      ),
      out.join("\n"),
    );
    assert.ok(
      out.some((m) =>
        /packages\/b\/package\.json:1: b does not declare its allowed dependency @cutroom\/a/.test(m),
      ),
      out.join("\n"),
    );
  } finally {
    ws.cleanup();
  }
});

test("a tsconfig reference that is not an allowed edge fails", () => {
  const ws = edgeFixture({ "packages/a/tsconfig.json": JSON.stringify({ references: [{ path: "../b" }] }) });
  try {
    const out = messages(checkEdges(ws.root));
    assert.ok(
      out.some((m) =>
        /packages\/a\/tsconfig\.json:\d+: a references b, which is not an allowed edge/.test(m),
      ),
      out.join("\n"),
    );
  } finally {
    ws.cleanup();
  }
});

test("dynamic imports and re-exports are found; commented imports are not", () => {
  const found = findImports(
    'export { x } from "./x.js";\nconst y = await import("./y.js");\n// import("./z.js")\n',
  );
  assert.deepEqual(
    found.map((f) => [f.specifier, f.line]),
    [
      ["./x.js", 1],
      ["./y.js", 2],
    ],
  );
});

test("the real workspace has no edge violations", async () => {
  const { dirname, resolve } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  assert.deepEqual(messages(checkEdges(root)), []);
});
