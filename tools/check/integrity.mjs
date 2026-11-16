// Design: impl/01 §1; environment §8; M0-01b "the integrity check"
// Git must track neither a key file (.env, .env.*) nor the v3.1 archive, and every tracked text file must
// be LF, in the index and in the working tree. It asks Git only; it never opens the archive or a key file.
import { spawnSync } from "node:child_process";

export const ARCHIVE_PATH = "docs/archive/cutroom-v3.1-full-system-architecture.md";

function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.error}`);
  return result.stdout;
}

/** True for a file name that is a key file: .env, .env.local, ... but not .env.example. */
export function isKeyFile(path) {
  const base = path.split("/").pop() ?? "";
  return base === ".env" || (base.startsWith(".env.") && base !== ".env.example");
}

export function checkIntegrity(root) {
  const violations = [];
  const tracked = git(root, ["ls-files", "-z"]).split("\0").filter(Boolean);
  for (const path of tracked) {
    if (isKeyFile(path)) violations.push({ file: path, line: 1, message: "a key file is tracked by Git" });
    if (path.toLowerCase() === ARCHIVE_PATH)
      violations.push({ file: path, line: 1, message: "the v3.1 archive is tracked by Git" });
  }
  const eol = git(root, ["ls-files", "--eol", "-z"]).split("\0").filter(Boolean);
  for (const entry of eol) {
    const tab = entry.indexOf("\t");
    const path = entry.slice(tab + 1);
    const [index, work] = entry.slice(0, tab).trim().split(/\s+/);
    for (const [where, value] of [
      ["index", index],
      ["working tree", work],
    ]) {
      if (value === "i/crlf" || value === "w/crlf" || value === "i/mixed" || value === "w/mixed") {
        violations.push({ file: path, line: 1, message: `text file is not LF in the ${where} (${value})` });
      }
    }
  }
  return violations;
}
