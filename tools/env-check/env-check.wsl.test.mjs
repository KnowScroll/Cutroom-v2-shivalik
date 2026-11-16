// Design: M0-01b tests ("a pins file with one wrong hash fails env:check, naming entry, expected and
// actual"), end to end on both sides; run from Windows by `npm run test:wsl` (needs the installed environment)
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { toWslPath, wslBash } from "../lib/wsl.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const pins = JSON.parse(readFileSync(join(root, "tools", "pins.json"), "utf8"));
const WRONG = "0".repeat(64);

function withPins(mutate, run) {
  const dir = mkdtempSync(join(tmpdir(), "cutroom-pins-"));
  try {
    const copy = JSON.parse(JSON.stringify(pins));
    mutate(copy);
    const file = join(dir, "pins.json");
    writeFileSync(file, JSON.stringify(copy));
    return run(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("Windows: the real pins pass and a wrong node_windows hash fails, naming entry, expected and actual", () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const cli = join(root, "tools", "env-check", "cli.mjs");
  const ok = spawnSync(process.execPath, [cli], { encoding: "utf8", env });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  const bad = withPins(
    (p) => {
      p.node_windows.binary_sha256 = WRONG;
    },
    (file) => spawnSync(process.execPath, [cli, "--pins", file], { encoding: "utf8", env }),
  );
  assert.equal(bad.status, 1);
  assert.match(
    bad.stdout,
    new RegExp(
      `FAIL  node_windows\\.binary_sha256: expected ${WRONG}, got ${pins.node_windows.binary_sha256}`,
    ),
  );
});

test("WSL: the real pins pass and a wrong ffmpeg hash fails, naming entry, expected and actual", () => {
  const mirror = "$HOME/.cutroom-build/main";
  const run = (pinsArg) =>
    wslBash(`cd "${mirror}"\n. ./tools/env.sh\nnode tools/env-check/cli.mjs ${pinsArg} </dev/null\n`);
  const ok = run("");
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  const bad = withPins(
    (p) => {
      p.ffmpeg.ffmpeg_sha256 = WRONG;
    },
    (file) => run(`--pins "${toWslPath(file)}"`),
  );
  assert.equal(bad.status, 1);
  assert.match(
    bad.stdout,
    new RegExp(`FAIL  ffmpeg\\.ffmpeg_sha256: expected ${WRONG}, got ${pins.ffmpeg.ffmpeg_sha256}`),
  );
});
