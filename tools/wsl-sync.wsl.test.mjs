// Design: L19, L45; M0-01b tests, run from Windows by `npm run test:wsl` (it drives wsl.exe and needs
// a built mirror): an uncommitted new file reaches the mirror after wsl:sync, an ignored file such as
// the key file does not, and a file deleted in the working tree is deleted in the mirror.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { wslBash } from "./lib/wsl.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const probe = join(root, "tools", "zz-sync-probe.txt");
const childEnv = () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return env;
};
const sync = () =>
  spawnSync(
    process.execPath,
    [join(root, "tools", "wsl-sync.mjs"), "--quiet", "--no-install", "--no-build"],
    {
      encoding: "utf8",
      env: childEnv(),
    },
  );
const inMirror = (command) => wslBash(`cd "$HOME/.cutroom-build/main"\n${command}\n`).stdout.trim();

test("an uncommitted new file reaches the mirror; the key file and the archive never do; a deleted file goes", () => {
  try {
    writeFileSync(probe, "probe\n");
    const first = sync();
    assert.equal(first.status, 0, first.stdout + first.stderr);
    assert.equal(inMirror("test -f tools/zz-sync-probe.txt && echo yes || echo no"), "yes");
    const key = [".", "env"].join("");
    assert.equal(inMirror(`test -e ${key} && echo present || echo absent`), "absent");
    assert.equal(inMirror("test -e docs/archive && echo present || echo absent"), "absent");
    assert.equal(inMirror("test -e .git && echo present || echo absent"), "absent");
    assert.match(inMirror("cat .cutroom-root"), /^\/mnt\/[a-z]\//);

    rmSync(probe);
    const second = sync();
    assert.equal(second.status, 0, second.stdout + second.stderr);
    assert.equal(inMirror("test -f tools/zz-sync-probe.txt && echo yes || echo no"), "no");
  } finally {
    if (existsSync(probe)) rmSync(probe);
  }
});
