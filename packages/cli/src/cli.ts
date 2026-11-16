// Design: lld/07 D12 (the commands; those no milestone built here exit non-zero naming theirs), lld/11 A:M0-4

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { Diagnostic } from "@cutroom/foundations";
import { realTimers, type Timers } from "./backup.js";
import { type SpaceStatus, sendControl, socketPathProblem } from "./control.js";
import {
  CliFailure,
  checkMount,
  createSpace,
  openSpaceDatabase,
  readStatus,
  type StartupEnv,
  spacePaths,
} from "./space.js";
import { startSpace } from "./start.js";

/** D12's commands, with the milestone that builds each one that this package does not. */
export const COMMANDS = {
  new: null,
  run: null,
  status: null,
  stop: null,
  say: "M4",
  events: "M3",
  pause: "M4",
  lock: "M2",
  export: "M6",
  audit: "M4",
} as const satisfies Record<string, string | null>;

export interface CliEnv extends StartupEnv {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
  readonly home: () => string;
  readonly timers: Timers;
  /** Stop serving on SIGINT and SIGTERM. Off in tests. */
  readonly handleSignals: boolean;
}

export function defaultEnv(): CliEnv {
  return {
    out: (t) => process.stdout.write(`${t}\n`),
    err: (t) => process.stderr.write(`${t}\n`),
    home: homedir,
    now: () => new Date(),
    timers: realTimers,
    handleSignals: true,
  };
}

const USAGE = `usage: cutroom <command> [dir]\ncommands: ${Object.keys(COMMANDS).join(", ")}`;

function describe(d: Diagnostic): string {
  const detail = JSON.stringify({ expected: d.expected, got: d.got });
  return `${d.code} at ${d.path} ${detail}`;
}

function failWith(env: CliEnv, diagnostics: readonly Diagnostic[]): number {
  for (const d of diagnostics) env.err(`error: ${describe(d)}`);
  return 1;
}

function spaceDir(env: CliEnv, arg: string | undefined): string {
  return resolve(arg ?? join(env.home(), "cutroom-space"));
}

async function status(env: CliEnv, dir: string): Promise<number> {
  const mount = checkMount(dir, env);
  if (!mount.ok) return failWith(env, mount.diagnostics);
  const paths = spacePaths(dir);
  const long = socketPathProblem(paths.socket);
  if (long !== undefined) return failWith(env, [long]);
  const served = (await sendControl(paths.socket, { op: "status" })) as SpaceStatus | "unreachable";
  if (served !== "unreachable") {
    env.out(JSON.stringify({ served: true, ...served }));
    return 0;
  }
  if (!existsSync(paths.db)) throw new CliFailure(`no Space at ${dir}: run \`cutroom new\` first`);
  const opened = await openSpaceDatabase(dir, env, { readonly: true });
  if (!opened.ok) return failWith(env, opened.diagnostics);
  try {
    env.out(JSON.stringify({ served: false, ...readStatus(opened.value.storage) }));
  } finally {
    opened.value.storage.close();
  }
  return 0;
}

async function stop(env: CliEnv, dir: string): Promise<number> {
  const mount = checkMount(dir, env);
  if (!mount.ok) return failWith(env, mount.diagnostics);
  const paths = spacePaths(dir);
  const long = socketPathProblem(paths.socket);
  if (long !== undefined) return failWith(env, [long]);
  const reply = await sendControl(paths.socket, { op: "stop" });
  if (reply === "unreachable") throw new CliFailure(`no process serves ${dir}`);
  env.out(`stopped ${dir}`);
  return 0;
}

async function run(env: CliEnv, dir: string): Promise<number> {
  const started = await startSpace(dir, {
    ...env,
    onBackupError: (error) => env.err(`backup failed: ${String(error)}`),
  });
  if (!started.ok) return failWith(env, started.diagnostics);
  const space = started.value;
  const onSignal = (): void => {
    void space.stop();
  };
  if (env.handleSignals) {
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
  }
  env.out(`serving ${dir} on ${space.socketPath}`);
  await space.closed;
  if (env.handleSignals) {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
  }
  env.out(`stopped ${dir}`);
  return 0;
}

async function create(env: CliEnv, dir: string): Promise<number> {
  const created = await createSpace(dir, env);
  if (!created.ok) return failWith(env, created.diagnostics);
  env.out(`created ${dir} at schema version ${created.value.schemaVersion}`);
  return 0;
}

/** Runs one invocation and returns its exit status: 0 done, 1 refused or failed, 2 usage or not built yet. */
export async function runCli(argv: readonly string[], env: CliEnv = defaultEnv()): Promise<number> {
  const [command, arg] = argv;
  if (command === undefined || command === "--help" || command === "-h") {
    env.err(USAGE);
    return command === undefined ? 2 : 0;
  }
  if (!Object.hasOwn(COMMANDS, command)) {
    env.err(`unknown command "${command}"\n${USAGE}`);
    return 2;
  }
  const milestone = COMMANDS[command as keyof typeof COMMANDS];
  if (milestone !== null) {
    env.err(`cutroom ${command} is not built yet: milestone ${milestone}`);
    return 2;
  }
  const dir = spaceDir(env, arg);
  try {
    switch (command) {
      case "new":
        return await create(env, dir);
      case "run":
        return await run(env, dir);
      case "status":
        return await status(env, dir);
      default:
        return await stop(env, dir);
    }
  } catch (error) {
    if (error instanceof CliFailure) {
      env.err(`error: ${error.message}`);
      return 1;
    }
    throw error;
  }
}
