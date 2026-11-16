// Design: impl/02 §9 (tools/pins.json is the single record of both environments, filled by measurement)
// Usage (Windows): npm run pins:record
// Measures the Windows Node here and the WSL environment through the build mirror (run `npm run wsl:sync`
// first), then writes tools/pins.json. After M0-01b, changing the Chrome build, its flags or the fonts goes
// to the user (G15 class (e)); other pin changes are recorded in the pull request that makes them.
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { wslInMirror } from "./lib/wsl.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const win = spawnSync(process.execPath, [join(root, "tools", "env-check", "cli.mjs"), "--measure"], {
  encoding: "utf8",
});
if (win.status !== 0) {
  console.error(`measuring Windows failed:\n${win.stdout}${win.stderr}`);
  process.exit(1);
}
const linux = wslInMirror("$HOME/.cutroom-build/main", "node tools/env-check/cli.mjs --measure --launch", {
  maxBuffer: 256 * 1024 * 1024,
});
if (linux.status !== 0) {
  console.error(`measuring WSL failed (exit ${linux.status}):\n${linux.stderr}`);
  process.exit(1);
}
const lastLine = (text) => text.trim().split("\n").pop();
const pins = { schema: 1, ...JSON.parse(lastLine(linux.stdout)), ...JSON.parse(lastLine(win.stdout)) };
const ordered = {
  schema: pins.schema,
  os: pins.os,
  node: pins.node,
  node_windows: pins.node_windows,
  chrome: pins.chrome,
  ffmpeg: pins.ffmpeg,
  fonts: pins.fonts,
};
writeFileSync(join(root, "tools", "pins.json"), `${JSON.stringify(ordered, null, 2)}\n`);
console.log("tools/pins.json written");
