// Design: lld/04 §1 (the Space), §2.6 "Where a Space lives", §2.12, §4 "Database damage"; lld/11 A:M0-4, A:M0-10
// Start-up order, stopping at the first failure: mount check, SQLite version, quick_check, migrations.
// `openDatabase` does not check the mount, so every opener here calls `checkSpaceMount` first (issue #11).
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Result } from "@cutroom/foundations";
import { ok } from "@cutroom/foundations";
import {
  checkSpaceMount,
  type Driver,
  type MountCheckOptions,
  openDatabase,
  RevisionStore,
  type Storage,
} from "@cutroom/project-core";
import type { SpaceStatus } from "./control.js";
import {
  buildMigrationRegistry,
  buildSettingsRegistry,
  resolveSpaceSettings,
  type SpaceSettings,
} from "./registry.js";

export const SPACE_DB_FILE = "space.db";
export const SOCKET_FILE = "control.sock";

/** A failure that is not one of the design's codes: a plain message and exit status 1. */
export class CliFailure extends Error {}

export interface StartupEnv {
  readonly mount?: MountCheckOptions;
  readonly driver?: Driver;
  readonly now: () => Date;
}

export function spacePaths(dir: string): { db: string; socket: string; backups: string } {
  return { db: join(dir, SPACE_DB_FILE), socket: join(dir, SOCKET_FILE), backups: join(dir, "backups") };
}

/** Refuses a Space on `9p`, or on a mount that cannot be read. Writes nothing and creates nothing. */
export function checkMount(dir: string, env: StartupEnv): Result<undefined> {
  const mount = checkSpaceMount(dir, env.mount);
  return mount.ok ? ok(undefined) : mount;
}

export function loadSettings(): Result<SpaceSettings> {
  return resolveSpaceSettings(buildSettingsRegistry());
}

/** SQLite version, `quick_check`, pragmas and migrations (with the pre-migration backup) via Project Core. */
export async function openSpaceDatabase(
  dir: string,
  env: StartupEnv,
  options: { readonly readonly: boolean },
): Promise<Result<{ storage: Storage; settings: SpaceSettings }>> {
  const settings = loadSettings();
  if (!settings.ok) return settings;
  const storage = await openDatabase(spacePaths(dir).db, {
    ...settings.value.writer,
    readonly: options.readonly,
    ...(options.readonly ? {} : { migrations: buildMigrationRegistry() }),
    ...(env.driver === undefined ? {} : { driver: env.driver }),
    now: env.now,
  });
  if (!storage.ok) return storage;
  return ok({ storage: storage.value, settings: settings.value });
}

/** Creates the layout and the database at the current schema. The mount is checked before anything exists. */
export async function createSpace(dir: string, env: StartupEnv): Promise<Result<{ schemaVersion: number }>> {
  const mount = checkMount(dir, env);
  if (!mount.ok) return mount;
  if (existsSync(spacePaths(dir).db)) throw new CliFailure(`${dir} already holds a Space (${SPACE_DB_FILE})`);
  mkdirSync(dir, { recursive: true });
  for (const sub of ["blobs", "tmp", "backups"]) mkdirSync(join(dir, sub), { recursive: true });
  const opened = await openSpaceDatabase(dir, env, { readonly: false });
  if (!opened.ok) return opened;
  const schemaVersion = opened.value.storage.userVersion;
  opened.value.storage.close();
  return ok({ schemaVersion });
}

/** Schema version, accepted head and P number, blob count and bytes. */
export function readStatus(storage: Storage): SpaceStatus {
  const tables = new Set(
    storage
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((r) => String(r.name)),
  );
  let head: string | null = null;
  let p: number | null = null;
  if (tables.has("branch")) {
    const main = new RevisionStore(storage).getBranch("main");
    if (main.ok) head = main.value.head;
  }
  if (tables.has("accepted_log")) {
    const row = storage.prepare("SELECT max(seq) AS p FROM accepted_log").get();
    if (row !== undefined && row.p !== null) p = Number(row.p);
  }
  let count = 0;
  let bytes = 0;
  if (tables.has("blob")) {
    const row = storage
      .prepare("SELECT count(*) AS n, coalesce(sum(size), 0) AS b FROM blob WHERE state = 'present'")
      .get();
    count = Number(row?.n ?? 0);
    bytes = Number(row?.b ?? 0);
  }
  return {
    schema_version: storage.userVersion,
    accepted_head: head,
    accepted_p: p,
    blob_count: count,
    blob_bytes: bytes,
  };
}
