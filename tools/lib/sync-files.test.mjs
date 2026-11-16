// Design: L19; M0-01b tests ("an uncommitted new file in the working tree reaches the mirror after
// wsl:sync, and an ignored file such as the key file does not")
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { listSyncFiles, staleFiles } from "./sync-files.mjs";
import { makeWorkspace } from "./tmp-workspace.mjs";
import { mirrorName } from "./wsl.mjs";

const git = (cwd, ...args) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
};
const KEY = [".", "env"].join("");

function repo() {
  const ws = makeWorkspace({
    ".gitignore": `${KEY}\n${KEY}.*\n!${KEY}.example\nnode_modules/\ndist/\n`,
    "tracked.txt": "t\n",
    "gone.txt": "g\n",
    "src/a.ts": "a\n",
  });
  git(ws.root, "init", "-q");
  git(ws.root, "config", "user.email", "t@example.invalid");
  git(ws.root, "config", "user.name", "t");
  git(ws.root, "add", "-A");
  git(ws.root, "commit", "-q", "-m", "init");
  return ws;
}

test("the file list is the working tree as it is: uncommitted new files in, ignored files out", () => {
  const ws = repo();
  try {
    ws.write("new-uncommitted.txt", "n\n");
    ws.write("src/b.ts", "b\n");
    ws.write(KEY, "SECRET=1\n");
    ws.write(`${KEY}.local`, "SECRET=2\n");
    ws.write(`${KEY}.example`, "EXAMPLE=\n");
    ws.write("node_modules/x/index.js", "x\n");
    ws.write("dist/out.js", "o\n");
    const files = listSyncFiles(ws.root);
    assert.ok(files.includes("new-uncommitted.txt"));
    assert.ok(files.includes("src/b.ts"));
    assert.ok(files.includes("tracked.txt"));
    assert.ok(files.includes(`${KEY}.example`));
    for (const absent of [KEY, `${KEY}.local`, "node_modules/x/index.js", "dist/out.js"]) {
      assert.ok(!files.includes(absent), `${absent} must not be copied`);
    }
    assert.ok(!files.some((f) => f.startsWith(".git/")));
  } finally {
    ws.cleanup();
  }
});

test("a file deleted in the working tree is not listed and is stale in the mirror; ignored mirror files are kept", () => {
  const ws = repo();
  try {
    ws.write("keep-new.txt", "k\n");
    rmSync(join(ws.root, "gone.txt"));
    const files = listSyncFiles(ws.root);
    assert.ok(!files.includes("gone.txt"));
    const mirror = [
      "tracked.txt",
      "gone.txt",
      "node_modules/p/i.js",
      "packages/p/dist/x.js",
      ".cutroom-root",
      "orphan.txt",
      "src/a.ts",
    ];
    const stale = staleFiles(ws.root, mirror, files, [".cutroom-root"]);
    assert.deepEqual(stale.sort(), ["gone.txt", "orphan.txt"]);
  } finally {
    ws.cleanup();
  }
});

test("a key file that is not ignored makes the sync refuse rather than copy it", () => {
  const ws = repo();
  try {
    ws.write(".gitignore", "node_modules/\n");
    ws.write(KEY, "SECRET=1\n");
    assert.throws(() => listSyncFiles(ws.root), /refusing to sync a key file/);
  } finally {
    ws.cleanup();
  }
});

test("the main working tree syncs to main/, a worktree to its own folder name (L45)", () => {
  assert.equal(mirrorName("C:\\Users\\me\\cutroom-v2", "C:\\Users\\me\\cutroom-v2"), "main");
  assert.equal(mirrorName("C:/Users/me/cutroom-v2/", "c:\\users\\me\\cutroom-v2"), "main");
  assert.equal(
    mirrorName("C:\\Users\\me\\cutroom-v2\\.worktrees\\m0-02-time", "C:\\Users\\me\\cutroom-v2"),
    "m0-02-time",
  );
});
