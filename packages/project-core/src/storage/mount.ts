// Design: lld/04 §2.6 (where a Space lives, C6), lld/11 A:M0-4; b2b §6 (read /proc/mounts, never stat)
import { readFileSync, realpathSync } from "node:fs";
import { posix } from "node:path";
import type { Result } from "@cutroom/foundations";
import { fail, ok } from "@cutroom/foundations";

/** Mount types WAL does not work over. `/mnt/c` reports `9p` (b2b §6). */
const REFUSED_TYPES: readonly string[] = ["9p"];

export interface MountInfo {
  readonly mountPoint: string;
  readonly type: string;
}

export interface MountCheckOptions {
  /** The text of the mounts table; the default reads `/proc/mounts`. Injected in unit tests. */
  readonly readMounts?: () => string;
  /** The default is `fs.realpathSync`. Injected in unit tests. */
  readonly realpath?: (path: string) => string;
}

// The kernel escapes space, tab, newline and backslash in a mount point as octal (`\040`).
function unescapeMount(field: string): string {
  return field.replace(/\\([0-7]{3})/g, (_m, oct: string) => String.fromCharCode(Number.parseInt(oct, 8)));
}

export function parseMounts(table: string): MountInfo[] {
  const out: MountInfo[] = [];
  for (const line of table.split("\n")) {
    const fields = line.trim().split(/\s+/);
    if (fields.length < 3 || fields[0] === "" || fields[0]?.startsWith("#")) continue;
    out.push({ mountPoint: unescapeMount(fields[1] ?? ""), type: fields[2] ?? "" });
  }
  return out;
}

function holds(mountPoint: string, path: string): boolean {
  if (mountPoint === "/") return true;
  return path === mountPoint || path.startsWith(`${mountPoint}/`);
}

function missing(error: unknown): boolean {
  const code = (error as { code?: unknown }).code;
  return code === "ENOENT" || code === "ENOTDIR";
}

/** The real path of `dir`, or of its nearest existing ancestor when it is not created yet. */
function realOrAncestor(dir: string, realpath: (p: string) => string): string {
  let at = posix.resolve(dir);
  for (;;) {
    try {
      return realpath(at);
    } catch (error) {
      const parent = posix.dirname(at);
      if (!missing(error) || parent === at) throw error;
      at = parent;
    }
  }
}

/**
 * Refuses a Space on a mount type WAL does not work over. Reads the type field of the mount table for the
 * longest mount point that holds the real path. An unreadable table, or a path no mount holds, is
 * SPACE_MOUNT_UNKNOWN because nothing else would fail by itself (A:M0-4).
 */
export function checkSpaceMount(dir: string, options: MountCheckOptions = {}): Result<MountInfo> {
  const readMounts = options.readMounts ?? (() => readFileSync("/proc/mounts", "utf8"));
  const realpath = options.realpath ?? ((p: string) => realpathSync(p));
  let mounts: MountInfo[];
  let real: string;
  try {
    mounts = parseMounts(readMounts());
    real = realOrAncestor(dir, realpath);
  } catch (error) {
    return fail({
      code: "SPACE_MOUNT_UNKNOWN",
      path: dir,
      expected: "a readable /proc/mounts and a resolvable path",
      got: error instanceof Error ? error.message : String(error),
    });
  }
  let best: MountInfo | undefined;
  for (const m of mounts) {
    // Later lines win ties: a later mount on the same point is on top.
    if (holds(m.mountPoint, real) && (best === undefined || m.mountPoint.length >= best.mountPoint.length)) {
      best = m;
    }
  }
  if (best === undefined) {
    return fail({
      code: "SPACE_MOUNT_UNKNOWN",
      path: dir,
      expected: "a mount point that holds the path",
      got: real,
    });
  }
  if (REFUSED_TYPES.includes(best.type)) {
    return fail({
      code: "SPACE_MOUNT_REFUSED",
      path: dir,
      expected: "a Linux filesystem such as ext4, not a network or drvfs mount",
      got: { mount_point: best.mountPoint, type: best.type },
    });
  }
  return ok(best);
}
