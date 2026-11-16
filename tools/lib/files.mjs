// Design: impl/01 §1 (layout). Shared file walking for the tools.
// The walk never enters docs/, so it can never open the v3.1 archive that sits there; it also skips
// everything the build or Git ignores.
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".tools", ".worktrees", "docs"]);

/** Lists files under `dir` (absolute paths), skipping ignored folders and, optionally, fixtures. */
export function listFiles(dir, { exts = null, skipDirs = SKIP_DIRS, skipFixtures = false } = {}) {
  const out = [];
  const walk = (current) => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        if (skipFixtures && entry.name === "fixtures") continue;
        walk(full);
      } else if (entry.isFile()) {
        if (exts && !exts.some((ext) => entry.name.endsWith(ext))) continue;
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}

/** Path relative to `root` with forward slashes, for messages and for matching. */
export function rel(root, file) {
  return relative(root, file).split(sep).join("/");
}

export function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** 1-based line number of a character offset. */
export function lineOf(text, offset) {
  let line = 1;
  for (let i = 0; i < offset; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}
