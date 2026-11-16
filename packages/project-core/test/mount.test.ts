import assert from "node:assert/strict";
import { test } from "node:test";
import { checkSpaceMount, parseMounts } from "../src/index.js";

const TABLE = [
  "/dev/sdd / ext4 rw,relatime,discard,errors=remount-ro,data=ordered 0 0",
  "proc /proc proc rw,nosuid 0 0",
  "C:\\134 /mnt/c 9p rw,noatime,aname=drvfs;path=C:\\;uid=1000;gid=1000 0 0",
  "tmpfs /home/u/fast tmpfs rw 0 0",
  "/dev/sde /mnt/c/Users/u/linux-disk ext4 rw 0 0",
  "/dev/sdf /home/u/with\\040space ext4 rw 0 0",
].join("\n");

// Real paths of fixtures; anything else does not exist.
function fakeRealpath(links: Record<string, string>, existing: readonly string[]) {
  return (p: string): string => {
    const target = links[p] ?? p;
    if (existing.some((e) => e === target || e.startsWith(`${target}/`))) return target;
    throw Object.assign(new Error(`ENOENT ${p}`), { code: "ENOENT" });
  };
}

const EXISTING = [
  "/",
  "/home/u",
  "/home/u/fast",
  "/mnt/c/Users/u",
  "/mnt/c/Users/u/linux-disk",
  "/home/u/with space",
];

test("mount: ext4 / is accepted", () => {
  const r = checkSpaceMount("/home/u/spaces/a", {
    readMounts: () => TABLE,
    realpath: fakeRealpath({}, EXISTING),
  });
  assert.deepEqual(r.ok && r.value, { mountPoint: "/", type: "ext4" });
});

test("mount: 9p /mnt/c is refused with SPACE_MOUNT_REFUSED naming mount point and type", () => {
  const r = checkSpaceMount("/mnt/c/Users/u/space", {
    readMounts: () => TABLE,
    realpath: fakeRealpath({}, EXISTING),
  });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.diagnostics[0]?.code, "SPACE_MOUNT_REFUSED");
    assert.deepEqual(r.diagnostics[0]?.got, { mount_point: "/mnt/c", type: "9p" });
  }
});

test("mount: a home symlink to /mnt/c is refused (the real path is checked)", () => {
  const r = checkSpaceMount("/home/u/winlink/space", {
    readMounts: () => TABLE,
    realpath: fakeRealpath({ "/home/u/winlink": "/mnt/c/Users/u" }, [...EXISTING, "/home/u/winlink"]),
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.diagnostics[0]?.code, "SPACE_MOUNT_REFUSED");
});

test("mount: nested mounts are decided by the longest mount point", () => {
  const inner = checkSpaceMount("/mnt/c/Users/u/linux-disk/space", {
    readMounts: () => TABLE,
    realpath: fakeRealpath({}, EXISTING),
  });
  assert.deepEqual(inner.ok && inner.value, { mountPoint: "/mnt/c/Users/u/linux-disk", type: "ext4" });
  const tmp = checkSpaceMount("/home/u/fast", {
    readMounts: () => TABLE,
    realpath: fakeRealpath({}, EXISTING),
  });
  assert.deepEqual(tmp.ok && tmp.value, { mountPoint: "/home/u/fast", type: "tmpfs" });
  // /mnt/cx is not under /mnt/c: a prefix must end at a path separator.
  const near = checkSpaceMount("/mnt/cx", {
    readMounts: () => TABLE,
    realpath: fakeRealpath({}, [...EXISTING, "/mnt/cx"]),
  });
  assert.deepEqual(near.ok && near.value, { mountPoint: "/", type: "ext4" });
});

test("mount: an escaped mount point (\\040) is decoded", () => {
  assert.equal(
    parseMounts(TABLE).some((m) => m.mountPoint === "/home/u/with space"),
    true,
  );
  const r = checkSpaceMount("/home/u/with space/x", {
    readMounts: () => TABLE,
    realpath: fakeRealpath({}, EXISTING),
  });
  assert.deepEqual(r.ok && r.value, { mountPoint: "/home/u/with space", type: "ext4" });
});

test("mount: a path not yet created is checked through its nearest existing ancestor", () => {
  const r = checkSpaceMount("/mnt/c/Users/u/not/yet/created", {
    readMounts: () => TABLE,
    realpath: fakeRealpath({}, EXISTING),
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.diagnostics[0]?.code, "SPACE_MOUNT_REFUSED");
});

test("mount: an unreadable table gives SPACE_MOUNT_UNKNOWN", () => {
  const r = checkSpaceMount("/home/u/space", {
    readMounts: () => {
      throw Object.assign(new Error("ENOENT: /proc/mounts"), { code: "ENOENT" });
    },
    realpath: fakeRealpath({}, EXISTING),
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.diagnostics[0]?.code, "SPACE_MOUNT_UNKNOWN");
});

test("mount: a table that holds no mount for the path gives SPACE_MOUNT_UNKNOWN", () => {
  const r = checkSpaceMount("/home/u", { readMounts: () => "", realpath: fakeRealpath({}, EXISTING) });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.diagnostics[0]?.code, "SPACE_MOUNT_UNKNOWN");
});
