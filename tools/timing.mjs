// Design: testing §1 ("The measurement"); U27; L43 (the script runs again at the end of M2)
// Usage (Windows, from the main working tree, with the build's Node first on PATH):
//   node tools/timing.mjs [--layout 1|2|3|all]
// Measures the wall time of npm ci, the build, npm run check and npm test, from cold and after a one-file
// change, in three layouts:
//   1. Windows-native, on the working tree;
//   2. WSL on the build mirror, including the wsl:sync that precedes it;
//   3. WSL directly on /mnt/c, in a throwaway worktree under .worktrees/ (so that WSL's Linux node_modules
//      never replace the Windows ones in the working tree), removed afterwards. No SQLite database is opened.
// Prints one markdown table row per step. The one-file change to the working tree is undone at the end.
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { toWslPath, wslBash } from "./lib/wsl.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = process.argv.indexOf("--layout");
const which = arg >= 0 ? process.argv[arg + 1] : "all";
const probeFile = join(root, "packages", "foundations", "src", "codes.ts");
const rows = [];

function timed(layout, step, run) {
  const started = performance.now();
  const result = run();
  const seconds = (performance.now() - started) / 1000;
  rows.push({ layout, step, seconds, status: result.status });
  console.log(
    `  layout ${layout}  ${step.padEnd(34)} ${seconds.toFixed(1).padStart(7)} s  exit ${result.status}`,
  );
  return result;
}

const win = (command, cwd = root) => {
  const r = spawnSync(command, { cwd, shell: true, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
};

function wsl(dirLinux, command) {
  const script = `cd "${dirLinux}"\n. ./tools/env.sh\n{\n${command}\n} </dev/null\n`;
  const r = wslBash(script);
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

function layout1() {
  console.log("layout 1: Windows-native, working tree");
  rmSync(join(root, "node_modules"), { recursive: true, force: true });
  timed(1, "cold: npm ci", () => win("npm ci --no-audit --no-fund"));
  win("npx tsc --build --clean");
  timed(1, "cold: build", () => win("npm run build"));
  timed(1, "cold: npm run check", () => win("npm run check"));
  timed(1, "cold: npm test (incl. build)", () => win("npm test"));
  appendFileSync(probeFile, "\n// timing probe\n");
  timed(1, "one-file change: build", () => win("npm run build"));
  timed(1, "one-file change: npm run check", () => win("npm run check"));
  timed(1, "one-file change: npm test", () => win("npm test"));
}

function layout2() {
  console.log("layout 2: WSL on the build mirror, including wsl:sync");
  const mirror = "$HOME/.cutroom-build/main";
  wsl(mirror, "rm -rf node_modules packages/*/dist");
  const sync = () => win("node tools/wsl-sync.mjs --quiet --no-install --no-build");
  timed(2, "cold: wsl:sync (rsync only)", sync);
  timed(2, "cold: npm ci", () => wsl(mirror, "npm ci --no-audit --no-fund"));
  timed(2, "cold: build", () => wsl(mirror, "npm run build"));
  timed(2, "cold: npm run check", () => wsl(mirror, "npm run check"));
  timed(2, "cold: npm test (incl. build)", () => wsl(mirror, "npm test"));
  appendFileSync(probeFile, "\n// timing probe 2\n");
  timed(2, "one-file change: wsl:sync (rsync only)", sync);
  timed(2, "one-file change: build", () => wsl(mirror, "npm run build"));
  timed(2, "one-file change: npm run check", () => wsl(mirror, "npm run check"));
  timed(2, "one-file change: npm test", () => wsl(mirror, "npm test"));
}

function layout3() {
  console.log("layout 3: WSL directly on /mnt/c, in a throwaway worktree under .worktrees/");
  const name = `timing-${Date.now()}`;
  const tree = join(root, ".worktrees", name);
  const add = win(`git worktree add --detach "${tree}" HEAD`);
  if (add.status !== 0) throw new Error(`git worktree add failed:\n${add.out}`);
  try {
    const dir = toWslPath(tree);
    timed(3, "cold: npm ci", () => wsl(dir, "npm ci --no-audit --no-fund"));
    timed(3, "cold: build", () => wsl(dir, "npm run build"));
    timed(3, "cold: npm run check", () => wsl(dir, "npm run check"));
    timed(3, "cold: npm test (incl. build)", () => wsl(dir, "npm test"));
    appendFileSync(join(tree, "packages", "foundations", "src", "codes.ts"), "\n// timing probe 3\n");
    timed(3, "one-file change: build", () => wsl(dir, "npm run build"));
    timed(3, "one-file change: npm run check", () => wsl(dir, "npm run check"));
    timed(3, "one-file change: npm test", () => wsl(dir, "npm test"));
  } finally {
    // Only the worktree this run created is removed, by Git.
    const removed = win(`git worktree remove --force "${tree}"`);
    console.log(`  worktree removed: exit ${removed.status}, still on disk: ${existsSync(tree)}`);
  }
}

const original = readFileSync(probeFile, "utf8");
try {
  if (which === "1" || which === "all") layout1();
  writeFileSync(probeFile, original);
  if (which === "2" || which === "all") layout2();
  writeFileSync(probeFile, original);
  if (which === "3" || which === "all") layout3();
} finally {
  writeFileSync(probeFile, original);
}

console.log("\n| Layout | Step | Seconds | Exit |\n|---|---|---|---|");
for (const r of rows) console.log(`| ${r.layout} | ${r.step} | ${r.seconds.toFixed(1)} | ${r.status} |`);
