// Design: impl/02 §2, §3.1, §11 (every WSL step is driven from Windows through wsl.exe)
// Helpers to run bash in the WSL distribution. The script travels on stdin to `bash -s`, so no Windows
// quoting reaches it (wsl.exe would otherwise expand $VARIABLES in an argument before bash sees them),
// and the build's Node is put first on PATH by sourcing the mirror's tools/env.sh inside the script.
import { spawnSync } from "node:child_process";

export const DISTRO = process.env.CUTROOM_WSL_DISTRO || "Ubuntu";

/** C:\Users\me\project -> /mnt/c/Users/me/project */
export function toWslPath(winPath) {
  const m = /^([A-Za-z]):[\\/](.*)$/.exec(winPath);
  if (!m) throw new Error(`not a Windows drive path: ${winPath}`);
  return `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, "/")}`;
}

/** wsl.exe prints its own warnings in UTF-16 (a NUL after each character); strip them. */
function clean(text) {
  return text.replace(/\0/g, "");
}

function noise(line) {
  return /^wsl: /.test(line);
}

/**
 * Runs a bash script in WSL. Returns { status, stdout, stderr } with wsl.exe's own warnings removed.
 * `script` is passed on stdin to `bash -s`; `args` become $1, $2, ...
 */
export function wslBash(script, { args = [], maxBuffer = 256 * 1024 * 1024 } = {}) {
  const result = spawnSync("wsl.exe", ["-d", DISTRO, "--", "bash", "-s", "--", ...args], {
    input: Buffer.from(script, "utf8"),
    encoding: "buffer",
    maxBuffer,
  });
  if (result.error) throw result.error;
  const stderr = clean(result.stderr.toString("utf8"))
    .split("\n")
    .filter((line) => !noise(line))
    .join("\n");
  return { status: result.status, stdout: result.stdout.toString("utf8"), stderr };
}

/** Runs a command inside a mirror with tools/env.sh sourced first (impl/02 §3.1). */
export function wslInMirror(mirror, command, options = {}) {
  // The command must not read the rest of the script from stdin, so it gets /dev/null.
  const script = `set -e\ncd "${mirror}"\n. ./tools/env.sh\n{\n${command}\n} </dev/null\n`;
  return wslBash(script, options);
}

/** The folder name of the mirror for a working tree: "main", or the worktree's folder name (L45). */
export function mirrorName(treeRoot, mainTreeRoot) {
  const norm = (p) =>
    p
      .replace(/[\\/]+$/, "")
      .replace(/\\/g, "/")
      .toLowerCase();
  if (norm(treeRoot) === norm(mainTreeRoot)) return "main";
  return treeRoot
    .replace(/[\\/]+$/, "")
    .split(/[\\/]/)
    .pop();
}
