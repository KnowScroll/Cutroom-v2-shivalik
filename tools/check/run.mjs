// Design: impl/01 §4 (npm run check); testing §8 rule 4; M0-01b
// Runs, in order: the type check (tsc --build, then tests/), Biome (lint and format), the dependency-edge
// check, the code-coverage check and the integrity check. Every step runs even if an earlier one fails, so
// one run shows everything that is wrong. Exit code 1 if any step failed.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkCodes } from "./codes.mjs";
import { checkDependencies } from "./dependencies.mjs";
import { checkEdges } from "./edges.mjs";
import { checkIntegrity } from "./integrity.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function runNode(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trimEnd();
  return { ok: result.status === 0, output };
}

function fromViolations(violations) {
  if (violations.length === 0) return { ok: true, output: "" };
  return { ok: false, output: violations.map((v) => `${v.file}:${v.line}: ${v.message}`).join("\n") };
}

const tsc = join(root, "node_modules", "typescript", "bin", "tsc");
const biome = join(root, "node_modules", "@biomejs", "biome", "bin", "biome");

const steps = [
  ["type check (tsc --build)", () => runNode(tsc, ["--build"])],
  [
    "type check (tests/)",
    () =>
      existsSync(join(root, "tests", "tsconfig.json"))
        ? runNode(tsc, ["-p", "tests/tsconfig.json"])
        : { ok: true, output: "" },
  ],
  ["lint and format (biome)", () => runNode(biome, ["check", "."])],
  ["dependency edges", () => fromViolations(checkEdges(root))],
  ["dependencies (pinned, recorded, match the lockfile)", () => fromViolations(checkDependencies(root))],
  ["code coverage (every code asserted by a test)", () => fromViolations(checkCodes(root))],
  ["integrity (no key file or archive tracked, LF)", () => fromViolations(checkIntegrity(root))],
];

let failed = 0;
for (const [name, run] of steps) {
  const started = Date.now();
  const { ok, output } = run();
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  (${seconds}s)`);
  if (!ok) {
    failed++;
    if (output)
      console.log(
        output
          .split("\n")
          .map((l) => `    ${l}`)
          .join("\n"),
      );
  }
}
console.log(failed === 0 ? "check: all steps passed" : `check: ${failed} step(s) failed`);
process.exit(failed === 0 ? 0 : 1);
