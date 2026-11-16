// Design: M0-01b tests ("a tracked key file fails the integrity check"); impl/01 §1
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { makeWorkspace } from "../lib/tmp-workspace.mjs";
import { ARCHIVE_PATH, checkIntegrity, isKeyFile } from "./integrity.mjs";

const git = (cwd, ...args) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
};

function repo(files) {
  const ws = makeWorkspace(files);
  git(ws.root, "init", "-q");
  git(ws.root, "config", "user.email", "test@example.invalid");
  git(ws.root, "config", "user.name", "test");
  git(ws.root, "config", "core.autocrlf", "false");
  return ws;
}

test("isKeyFile matches key files and spares the example", () => {
  assert.equal(isKeyFile(".env"), true);
  assert.equal(isKeyFile("sub/.env.local"), true);
  assert.equal(isKeyFile(".env.example"), false);
  assert.equal(isKeyFile("docs/environment.md"), false);
});

test("a clean repository passes", () => {
  const ws = repo({ "a.txt": "one\ntwo\n" });
  try {
    git(ws.root, "add", "-A");
    assert.deepEqual(checkIntegrity(ws.root), []);
  } finally {
    ws.cleanup();
  }
});

test("a tracked key file fails", () => {
  const keyName = [".", "env"].join("");
  const ws = repo({ [keyName]: "X=1\n" });
  try {
    git(ws.root, "add", "-f", keyName);
    const out = checkIntegrity(ws.root);
    assert.equal(out.length, 1);
    assert.match(out[0].message, /key file is tracked/);
  } finally {
    ws.cleanup();
  }
});

test("a tracked v3.1 archive fails", () => {
  const ws = repo({ [ARCHIVE_PATH]: "old\n" });
  try {
    git(ws.root, "add", "-f", ARCHIVE_PATH);
    const out = checkIntegrity(ws.root);
    assert.equal(out.length, 1);
    assert.match(out[0].message, /v3\.1 archive is tracked/);
  } finally {
    ws.cleanup();
  }
});

test("a tracked text file with CRLF line endings fails", () => {
  const ws = repo({ "crlf.txt": "one\r\ntwo\r\n" });
  try {
    git(ws.root, "add", "crlf.txt");
    const out = checkIntegrity(ws.root);
    assert.ok(
      out.some((v) => v.file === "crlf.txt" && /not LF/.test(v.message)),
      JSON.stringify(out),
    );
  } finally {
    ws.cleanup();
  }
});

// The real repository's integrity is asserted by the integrity step of `npm run check`, which runs where
// Git exists (Windows and GitHub Actions). A unit test of it would fail in the WSL build mirror, which
// holds no .git by design (impl/02 section 2), so it is not repeated here.
