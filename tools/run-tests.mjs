// Design: impl/01 §4; testing §1 (levels), §8 rule 5 (known failures); L18 (Linux-only tests)
// Usage: node tools/run-tests.mjs <unit|linux|render|accept|claims|live|wsl> [--package <name>]
// Chooses test files by folder and file name, never by skipping, runs them with Node's test runner,
// and judges the results against tests/known-failures.ts. The render, accept and claims levels run
// env:check first and take the machine-wide render lock; live refuses to start without CUTROOM_LIVE=1.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { run } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { listFiles, rel } from "./lib/files.mjs";
import { evaluate, validateRegistry } from "./lib/known-failures.mjs";
import { selectFiles } from "./lib/test-files.mjs";

const args = process.argv.slice(2);
// --root is for the runner's own tests, which run it on a fixture workspace.
const rootIndex = args.indexOf("--root");
const root =
  rootIndex >= 0 ? resolve(args[rootIndex + 1]) : resolve(dirname(fileURLToPath(import.meta.url)), "..");
const level = args[0];
const pkgIndex = args.indexOf("--package");
const pkg = pkgIndex >= 0 ? args[pkgIndex + 1] : undefined;
const levels = ["unit", "linux", "render", "accept", "claims", "live", "wsl"];

if (!levels.includes(level)) {
  console.error(`usage: node tools/run-tests.mjs <${levels.join("|")}> [--package <name>]`);
  process.exit(2);
}

if (level === "live" && process.env.CUTROOM_LIVE !== "1") {
  console.error(
    "test:live refuses to start without CUTROOM_LIVE=1: these tests call MiniMax or OpenRouter, cost money and need a line in docs/impl/04-spend.md.",
  );
  process.exit(1);
}

if (level === "linux" && process.platform !== "linux") {
  console.error(
    `test:linux runs the *.linux.test.* files, which need Linux: run it in WSL on the build mirror, not on ${process.platform} (L18).`,
  );
  process.exit(1);
}
if (level === "wsl" && process.platform !== "win32") {
  console.error("test:wsl drives wsl.exe and runs on Windows only.");
  process.exit(1);
}

const needsEnvironment = ["render", "accept", "claims"].includes(level);
if (needsEnvironment && process.env.CUTROOM_RENDER_LOCK_HELD !== "1") {
  if (process.platform !== "linux") {
    console.error(`test:${level} runs in WSL on the build mirror (impl/01 §4), not on ${process.platform}.`);
    process.exit(1);
  }
  const tools = process.env.CUTROOM_TOOLS;
  if (!tools) {
    console.error("CUTROOM_TOOLS is not set: source tools/env.sh first (impl/02 §3.1).");
    process.exit(1);
  }
  const envCheck = spawnSync(process.execPath, [join(root, "tools", "env-check", "cli.mjs")], {
    cwd: root,
    stdio: "inherit",
  });
  if (envCheck.status !== 0) {
    console.error(`test:${level} refuses to start: env:check failed.`);
    process.exit(1);
  }
  // The render lock is machine-wide: a second run waits here until the first has finished (L19).
  const locked = spawnSync(
    "flock",
    [join(tools, "render.lock"), process.execPath, ...process.argv.slice(1)],
    {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, CUTROOM_RENDER_LOCK_HELD: "1" },
    },
  );
  process.exit(locked.status ?? 1);
}

const files = selectFiles(root, level, { pkg, listFiles }).map((f) => rel(root, f));
const registryPath = join(root, "tests", "known-failures.ts");
let registry = [];
if (existsSync(registryPath)) {
  try {
    registry = (await import(pathToFileURL(registryPath).href)).knownFailures;
  } catch (error) {
    console.error(`cannot load tests/known-failures.ts: ${error.message}`);
    process.exit(1);
  }
}
const registryProblems = validateRegistry(registry);
if (registryProblems.length > 0) {
  console.error(`tests/known-failures.ts is malformed:\n${registryProblems.map((p) => `  ${p}`).join("\n")}`);
  process.exit(1);
}

if (files.length === 0) {
  console.log(`test:${level}: no test files found${pkg ? ` for package ${pkg}` : ""}`);
  process.exit(0);
}

const started = Date.now();
const results = [];
const stacks = new Map();
const stream = run({
  files: files.map((f) => join(root, f)),
  cwd: root,
  concurrency: level === "unit" || level === "linux" ? true : 1,
});
const idOf = (data) => {
  const file = rel(root, data.file ?? "");
  const stack = stacks.get(file) ?? [];
  const names = stack.slice(0, data.nesting + 1);
  names[data.nesting] = data.name;
  return `${file}::${names.join(" > ")}`;
};
stream.on("test:start", (data) => {
  const file = rel(root, data.file ?? "");
  const stack = stacks.get(file) ?? [];
  stack.length = data.nesting;
  stack[data.nesting] = data.name;
  stacks.set(file, stack);
});
stream.on("test:pass", (data) => {
  if (data.details?.type === "suite") return;
  results.push({ id: idOf(data), file: rel(root, data.file ?? ""), status: "pass", message: "" });
});
stream.on("test:fail", (data) => {
  if (data.details?.type === "suite") return;
  const error = data.details?.error;
  if (error?.failureType === "subtestsFailed") return;
  const cause = error?.cause ?? error;
  const message = [cause?.code, cause?.message, error?.message].filter(Boolean).join(" | ") || "failed";
  results.push({ id: idOf(data), file: rel(root, data.file ?? ""), status: "fail", message });
});
// Draining the stream is what makes it run.
for await (const _event of stream) void _event;

const { failures, counts } = evaluate(results, registry, files);
const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(`test:${level}: ${files.length} file(s), ${results.length} test(s) in ${seconds}s`);
console.log(
  `  passed ${counts.passed}, failed ${counts.failed}, known-failing ${counts.knownFailing}, quarantined 0`,
);
if (failures.length > 0) {
  console.log("FAILURES:");
  for (const failure of failures) console.log(`  ${failure}`);
  process.exit(1);
}
