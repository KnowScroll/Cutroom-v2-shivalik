// Design: impl/02 §9 (npm run env:check [-- --launch]); impl/02 §8 (keys: presence only)
// On Windows it checks only `node_windows`. In WSL, on the mirror, it checks the Linux Node, Chrome,
// FFmpeg, fonts and operating-system image against tools/pins.json, and reports each key's presence,
// the memory total and the R5 browser pool size. `--launch` also captures one BeginFrame in an empty
// network namespace. It compares hashes and installs nothing. `--measure` prints what it measured as JSON
// (used by `npm run pins:record`). `--pins <file>` points at another pins file (used by the tests).
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { comparePins, formatMismatch } from "./compare.mjs";
import { measureLinux, measureWindows } from "./measure.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const args = process.argv.slice(2);
const launch = args.includes("--launch");
const measureOnly = args.includes("--measure");
const pinsIndex = args.indexOf("--pins");
const pinsPath = pinsIndex >= 0 ? resolve(args[pinsIndex + 1]) : join(root, "tools", "pins.json");

// R5 section 5 defaults, until M0-05 registers the settings and this reads them from the registry.
const POOL = { browserMax: 6, browserMemBudgetMb: 950, memReserveMb: 4000 };

function launchRunner({ chromeBin, libsRoot, fontsConf }) {
  const uid = String(process.getuid());
  const gid = String(process.getgid());
  const r = spawnSync(
    "unshare",
    [
      "--user",
      `--map-user=${uid}`,
      `--map-group=${gid}`,
      "--net",
      process.execPath,
      join(here, "launch-child.mjs"),
      chromeBin,
      fontsConf,
      libsRoot,
    ],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 120000 },
  );
  const line = (r.stdout ?? "").trim().split("\n").pop() ?? "";
  try {
    return JSON.parse(line);
  } catch {
    return {
      ok: false,
      error: `no result from the launch child (exit ${r.status}): ${(r.stderr ?? "").slice(-400)}`,
    };
  }
}

function keyReport(mirrorRoot) {
  const file = process.env.CUTROOM_ENV_FILE;
  const report = { MINIMAX_API_KEY: "absent", OPENROUTER_API_KEY: "absent" };
  const values = {};
  if (file && existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*(MINIMAX_API_KEY|OPENROUTER_API_KEY)\s*=\s*(.*?)\s*$/.exec(line);
      if (m?.[2]) {
        report[m[1]] = "present";
        values[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
      }
    }
  }
  // Scan the mirror for the values; name any file that holds one, never the value.
  const leaks = [];
  const needles = Object.entries(values).filter(([, v]) => v.length >= 8);
  if (needles.length > 0) {
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && statSync(full).size < 4 * 1024 * 1024) {
          const text = readFileSync(full, "latin1");
          for (const [name, value] of needles) if (text.includes(value)) leaks.push(`${full} holds ${name}`);
        }
      }
    };
    walk(mirrorRoot);
  }
  return { report, leaks };
}

const results = [];
const note = (ok, label, detail = "") => results.push({ ok, label, detail });

if (process.platform === "win32") {
  const { measured, running } = measureWindows(root);
  if (measureOnly) {
    console.log(JSON.stringify(measured));
    process.exit(0);
  }
  if (!existsSync(pinsPath)) {
    console.error(`no pins file at ${pinsPath}: run npm run pins:record`);
    process.exit(1);
  }
  const pins = JSON.parse(readFileSync(pinsPath, "utf8"));
  for (const m of comparePins(pins.node_windows, measured.node_windows, "node_windows"))
    note(false, formatMismatch(m));
  const wanted = join(root, ".tools", "node-win", "node.exe").toLowerCase();
  if (running.execPath.toLowerCase() !== wanted)
    note(
      false,
      "the running node is not the build's Node",
      `expected ${wanted}, got ${running.execPath.toLowerCase()}`,
    );
  if (running.platform !== "win32") note(false, `process.platform is ${running.platform}, expected win32`);
  if (running.whereFirst?.toLowerCase() !== wanted)
    note(
      false,
      "`where node` does not list .tools\\node-win\\node.exe first",
      `expected ${wanted}, got ${running.whereFirst}`,
    );
  if (running.version !== pins.node_windows.version)
    note(false, `node_windows.version: expected ${pins.node_windows.version}, running ${running.version}`);
  if (results.length === 0)
    note(
      true,
      `node_windows ${pins.node_windows.version} (npm ${pins.node_windows.npm}, sqlite ${pins.node_windows.sqlite}) matches the pins`,
    );
} else if (process.platform === "linux") {
  const tools = process.env.CUTROOM_TOOLS ?? join(homedir(), ".cutroom-build", ".tools");
  if (!process.env.CUTROOM_TOOLS)
    note(false, "CUTROOM_TOOLS is not set: source tools/env.sh first (impl/02 §3.1)");
  const { measured, problems, info } = measureLinux(tools, root, { launch, launchRunner });
  if (measureOnly) {
    for (const p of problems) console.error(`problem: ${p}`);
    console.log(JSON.stringify(measured));
    process.exit(problems.length === 0 ? 0 : 1);
  }
  if (!existsSync(pinsPath)) {
    console.error(`no pins file at ${pinsPath}: run npm run pins:record`);
    process.exit(1);
  }
  const pins = JSON.parse(readFileSync(pinsPath, "utf8"));
  for (const section of ["os", "node", "chrome", "ffmpeg", "fonts"]) {
    const expected = { ...pins[section] };
    const actual = { ...measured[section] };
    if (section === "os" && !launch) {
      expected.raster_mode = undefined;
      actual.raster_mode = undefined;
    }
    const mismatches = comparePins(
      JSON.parse(JSON.stringify(expected)),
      JSON.parse(JSON.stringify(actual)),
      section,
    );
    if (mismatches.length === 0) note(true, `${section} matches the pins`);
    for (const m of mismatches) note(false, formatMismatch(m));
  }
  for (const p of problems) note(false, p);
  const runningNode = process.execPath.startsWith(join(tools, "node", "bin"));
  note(
    runningNode,
    runningNode
      ? `running node ${process.version} is the pinned one`
      : `running node ${process.execPath} is not inside ${join(tools, "node", "bin")}`,
  );
  const keys = keyReport(root);
  note(
    true,
    `keys: MINIMAX_API_KEY ${keys.report.MINIMAX_API_KEY}, OPENROUTER_API_KEY ${keys.report.OPENROUTER_API_KEY}`,
  );
  for (const leak of keys.leaks) note(false, `a key value is stored in the mirror: ${leak}`);
  const pool = Math.min(
    POOL.browserMax,
    Math.floor((info.memory_mb - POOL.memReserveMb) / POOL.browserMemBudgetMb),
  );
  note(true, `memory ${info.memory_mb} MB; R5 browser pool size ${pool} (defaults of R5 section 5)`);
  if (launch)
    note(
      true,
      `launch: one BeginFrame captured (${JSON.stringify(info.launch?.png)}), raster ${info.launch?.raster_mode}, network interfaces ${JSON.stringify(info.launch?.interfaces)}`,
    );
} else {
  console.error(`env:check runs on win32 (Windows part) or linux (WSL part), not ${process.platform}`);
  process.exit(1);
}

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.label}${r.detail ? ` (${r.detail})` : ""}`);
}
console.log(failed === 0 ? "env:check: ok" : `env:check: ${failed} problem(s)`);
process.exit(failed === 0 ? 0 : 1);
