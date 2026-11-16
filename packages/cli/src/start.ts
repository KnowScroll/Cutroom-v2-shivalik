// Design: lld/07 D12 (run), lld/04 §2.6, §2.14, §4, lld/11 A:M0-4, A:M0-10 (start-up stops at the first failure)
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Result } from "@cutroom/foundations";
import { fail, ok } from "@cutroom/foundations";
import { BackupScheduler, type Timers } from "./backup.js";
import {
  type ControlApi,
  type ControlServer,
  probeSocket,
  serveControl,
  socketPathProblem,
  spaceInUse,
} from "./control.js";
import {
  CliFailure,
  checkMount,
  openSpaceDatabase,
  readStatus,
  type StartupEnv,
  spacePaths,
} from "./space.js";

export interface RunEnv extends StartupEnv {
  readonly timers: Timers;
  readonly onBackupError: (error: unknown) => void;
}

export interface RunningSpace {
  readonly socketPath: string;
  readonly backups: BackupScheduler;
  /** Commits, closes the database, removes the socket. Safe to call twice. */
  stop(): Promise<void>;
  /** Resolves when the process has stopped and its socket is gone. */
  readonly closed: Promise<void>;
}

/**
 * Starts serving a Space: mount, socket path length, another server, SQLite version, `quick_check`, migrations,
 * then the one write connection, the socket and the periodic backups. The first failure stops the start and
 * leaves nothing running.
 */
export async function startSpace(dir: string, env: RunEnv): Promise<Result<RunningSpace>> {
  const mount = checkMount(dir, env);
  if (!mount.ok) return mount;
  const paths = spacePaths(dir);
  const long = socketPathProblem(paths.socket);
  if (long !== undefined) return fail(long);
  if (!existsSync(paths.db)) {
    throw new CliFailure(`no Space at ${dir}: run \`cutroom new\` first`);
  }
  if ((await probeSocket(paths.socket)) === "live") return fail(spaceInUse(dir, paths.socket));

  const opened = await openSpaceDatabase(dir, env, { readonly: false });
  if (!opened.ok) return opened;
  const { storage, settings } = opened.value;
  for (const sub of ["blobs", "tmp", "backups"]) mkdirSync(join(dir, sub), { recursive: true });

  const backups = new BackupScheduler({
    storage,
    spaceDir: dir,
    hours: settings.backupHours,
    keep: settings.backupKeep,
    now: env.now,
    timers: env.timers,
    onError: env.onBackupError,
  });
  let server: ControlServer | undefined;
  let stopping: Promise<void> | undefined;
  const stop = (): Promise<void> => {
    stopping ??= (async () => {
      await backups.stop();
      storage.close();
      server?.stopListening();
    })();
    return stopping;
  };
  const api: ControlApi = { status: async () => readStatus(storage), stop };

  const served = await serveControl(dir, paths.socket, api);
  if (!served.ok) {
    storage.close();
    return served;
  }
  server = served.value;
  backups.start();
  return ok({ socketPath: paths.socket, backups, stop, closed: server.closed });
}
