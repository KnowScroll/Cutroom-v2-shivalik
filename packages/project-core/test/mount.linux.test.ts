import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { checkSpaceMount } from "../src/index.js";

test("mount (linux): the real /proc/mounts and a real symlink resolve to a type, not 9p, for a temp Space", () => {
  const dir = mkdtempSync(join(tmpdir(), "cutroom-mount-"));
  try {
    mkdirSync(join(dir, "real"));
    symlinkSync(join(dir, "real"), join(dir, "link"));
    const r = checkSpaceMount(join(dir, "link", "not", "created", "yet"));
    // On the WSL build mirror the temp directory is on ext4; on a 9p temp directory this would be refused.
    assert.equal(r.ok, true, JSON.stringify(r));
    if (r.ok) assert.notEqual(r.value.type, "9p");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("mount (linux): /mnt/c, when present, is refused as 9p", (t) => {
  const r = checkSpaceMount("/mnt/c");
  if (r.ok && r.value.mountPoint !== "/mnt/c") {
    t.diagnostic("/mnt/c is not a 9p mount here; nothing to assert");
    return;
  }
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.diagnostics[0]?.code, "SPACE_MOUNT_REFUSED");
});
