// Design: testing §1. A helper for the tools' own tests: a throwaway workspace on disk.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** Creates a temporary folder holding `files` ({ "relative/path": "content" }); returns { root, cleanup }. */
export function makeWorkspace(files = {}) {
  const root = mkdtempSync(join(tmpdir(), "cutroom-fixture-"));
  const write = (path, content) => {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  };
  for (const [path, content] of Object.entries(files)) write(path, content);
  return { root, write, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

/** A two-package workspace: `a` imports nothing, `b` may import `a`. */
export function edgeFixture(extra = {}) {
  const pkg = (name, deps = []) =>
    JSON.stringify({
      name: `@cutroom/${name}`,
      version: "0.0.0",
      dependencies: Object.fromEntries(deps.map((d) => [`@cutroom/${d}`, "0.0.0"])),
    });
  const ts = (refs = []) => JSON.stringify({ references: refs.map((r) => ({ path: `../${r}` })) });
  return makeWorkspace({
    "package.json": JSON.stringify({ devDependencies: { "fast-check": "1.0.0" } }),
    "tools/dependency-edges.json": JSON.stringify({ schema: 1, packages: { a: [], b: ["a"] } }),
    "packages/a/package.json": pkg("a"),
    "packages/a/tsconfig.json": ts(),
    "packages/a/src/index.ts": "export const A = 1;\n",
    "packages/b/package.json": pkg("b", ["a"]),
    "packages/b/tsconfig.json": ts(["a"]),
    "packages/b/src/index.ts": 'import { A } from "@cutroom/a";\nexport const B = A;\n',
    ...extra,
  });
}
