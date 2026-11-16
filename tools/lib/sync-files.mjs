// Design: impl/02 §2 (what wsl:sync copies); L19
// The list of files a mirror holds: the working tree as it is, uncommitted new files included, ignored
// files left out. Git decides, so .gitignore is honoured exactly as Git reads it (rsync's own filter
// rules read a "!" line of .gitignore as "clear the list", which would let a key file through).
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync } from "node:fs";
import { join } from "node:path";
import { ARCHIVE_PATH, isKeyFile } from "../check/integrity.mjs";

function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "buffer", maxBuffer: 256 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.toString("utf8");
}

/** Files to copy: tracked plus untracked-not-ignored, minus deleted ones; forward slashes, sorted. */
export function listSyncFiles(root) {
  const names = git(root, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"])
    .split("\0")
    .filter(Boolean);
  const out = new Set();
  for (const name of names) {
    const full = join(root, name);
    if (!existsSync(full)) continue; // tracked, deleted in the working tree
    const stat = lstatSync(full);
    if (!stat.isFile()) continue;
    if (isKeyFile(name)) throw new Error(`refusing to sync a key file: ${name}`);
    if (name.toLowerCase() === ARCHIVE_PATH) throw new Error("refusing to sync the v3.1 archive");
    if (name === ".git" || name.startsWith(".git/")) continue;
    out.add(name);
  }
  return [...out].sort();
}

/** Of `names`, the ones Git ignores (the names need not exist). */
export function ignoredAmong(root, names) {
  if (names.length === 0) return new Set();
  const result = spawnSync("git", ["check-ignore", "-z", "--stdin", "--no-index"], {
    cwd: root,
    input: Buffer.from(names.join("\0"), "utf8"),
    encoding: "buffer",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.status !== 0 && result.status !== 1)
    throw new Error(`git check-ignore failed: ${result.stderr}`);
  return new Set(result.stdout.toString("utf8").split("\0").filter(Boolean));
}

/** Mirror files that no longer exist in the working tree and are not ignored: what the sync deletes. */
export function staleFiles(root, mirrorFiles, syncFiles, keep = []) {
  const wanted = new Set([...syncFiles, ...keep]);
  const candidates = mirrorFiles.filter((f) => !wanted.has(f));
  const ignored = ignoredAmong(root, candidates);
  return candidates.filter((f) => !ignored.has(f));
}
