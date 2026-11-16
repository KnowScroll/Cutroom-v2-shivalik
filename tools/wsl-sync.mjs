// Design: impl/02 §2; L19 (what wsl:sync copies); L45 (one mirror per working tree)
// Usage (Windows, from a working tree): npm run wsl:sync [-- --no-install] [-- --no-build]
// Refreshes this working tree's WSL build mirror (~/.cutroom-build/main/ for the main tree,
// ~/.cutroom-build/<worktree name>/ for a Git worktree) with one rsync of the working tree as it is,
// uncommitted changes included. Git names the files, so .gitignore is honoured and .git, key files,
// node_modules, dist/, .tools/ and .worktrees/ never travel. Files deleted in the working tree are deleted
// in the mirror; the mirror's own node_modules and build output are kept. Then, when package-lock.json
// changed, the mirror runs its own Linux npm ci, and it builds.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listSyncFiles, staleFiles } from "./lib/sync-files.mjs";
import { mirrorName, toWslPath, wslBash, wslInMirror } from "./lib/wsl.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = process.argv.slice(2);
const noInstall = args.includes("--no-install");
const noBuild = args.includes("--no-build");
const quiet = args.includes("--quiet");
const log = (message) => {
  if (!quiet) console.log(message);
};

function git(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
}

/** The folder of the main working tree, found from Git's common directory (a worktree has its own folder). */
export function mainTreeRoot() {
  const common = git(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  return resolve(common, "..");
}

const times = {};
const timed = (label, fn) => {
  const started = Date.now();
  const value = fn();
  times[label] = (Date.now() - started) / 1000;
  return value;
};

const treeRoot = resolve(git(["rev-parse", "--show-toplevel"]));
const mainRoot = mainTreeRoot();
const name = mirrorName(treeRoot, mainRoot);
const mirror = `$HOME/.cutroom-build/${name}`;
const source = toWslPath(treeRoot);
const keyRoot = toWslPath(mainRoot);
log(`wsl:sync ${treeRoot} -> ~/.cutroom-build/${name}/`);

const files = timed("list files (git)", () => listSyncFiles(treeRoot));
const scratch = mkdtempSync(join(tmpdir(), "cutroom-sync-"));
try {
  const listFile = join(scratch, "files.list");
  writeFileSync(listFile, `${files.join("\0")}\0`);

  const copy = timed("rsync", () =>
    wslBash(
      [
        "set -e",
        `mkdir -p "${mirror}"`,
        `rsync -a --no-owner --no-group --files-from="${toWslPath(listFile)}" --from0 "${source}/" "${mirror}/"`,
        `cd "${mirror}"`,
        "find . \\( -name node_modules -o -name dist -o -name .git \\) -prune -o -type f -print0",
      ].join("\n"),
    ),
  );
  if (copy.status !== 0) throw new Error(`rsync failed:\n${copy.stderr}`);

  const mirrorFiles = copy.stdout
    .split("\0")
    .filter(Boolean)
    .map((f) => f.replace(/^\.\//, ""));
  const keep = [".cutroom-root"];
  const stale = timed("stale files", () => staleFiles(treeRoot, mirrorFiles, files, keep));
  if (stale.length > 0) {
    const staleList = join(scratch, "stale.list");
    writeFileSync(staleList, `${stale.join("\0")}\0`);
    const removed = wslBash(
      [
        "set -e",
        `cd "${mirror}"`,
        `xargs -0 -a "${toWslPath(staleList)}" rm -f --`,
        "find . \\( -name node_modules -o -name dist \\) -prune -o -type d -empty -not -path . -print0 | xargs -0 -r rmdir --ignore-fail-on-non-empty",
      ].join("\n"),
    );
    if (removed.status !== 0) throw new Error(`removing stale files failed:\n${removed.stderr}`);
  }
  log(`  ${files.length} files copied, ${stale.length} stale removed`);

  // The key file is always the one in the main working tree; the mirror only learns its folder.
  const rootNote = wslBash(`printf '%s' '${keyRoot}' > "${mirror}/.cutroom-root"`);
  if (rootNote.status !== 0) throw new Error(`writing .cutroom-root failed:\n${rootNote.stderr}`);

  const lockHash = readLockHash(treeRoot);
  if (!noInstall) {
    const stamp = `node_modules/.cutroom-lock-sha256`;
    const install = timed("npm ci (only if the lockfile changed)", () =>
      wslInMirror(
        mirror,
        [
          `want='${lockHash}'`,
          `have=$(cat ${stamp} 2>/dev/null || true)`,
          `if [ ! -d node_modules ] || [ "$have" != "$want" ]; then echo 'npm ci' && npm ci --no-audit --no-fund && printf '%s' "$want" > ${stamp}; else echo 'npm ci skipped (lockfile unchanged)'; fi`,
        ].join("\n"),
      ),
    );
    if (install.status !== 0)
      throw new Error(`npm ci in the mirror failed:\n${install.stdout}\n${install.stderr}`);
    log(`  ${install.stdout.trim().split("\n").pop()}`);
  }
  if (!noBuild) {
    const build = timed("build (tsc --build)", () => wslInMirror(mirror, "npm run build --silent"));
    if (build.status !== 0) throw new Error(`build in the mirror failed:\n${build.stdout}\n${build.stderr}`);
    log("  build ok");
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
if (!quiet) {
  console.log("wsl:sync timings (s):");
  for (const [label, seconds] of Object.entries(times))
    console.log(`  ${seconds.toFixed(1).padStart(6)}  ${label}`);
}

function readLockHash(dir) {
  return createHash("sha256")
    .update(readFileSync(join(dir, "package-lock.json")))
    .digest("hex");
}
