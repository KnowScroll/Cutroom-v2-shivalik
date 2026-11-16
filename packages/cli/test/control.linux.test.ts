import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { serveControl } from "../src/control.js";
import { type ControlApi, runCli, type SpaceStatus, startSpace } from "../src/index.js";
import { fakeTimers, testEnv } from "./helpers.js";

// Temporary Spaces live under the home directory (ext4 in WSL), never under /mnt/c.
function tempHome(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(homedir(), ".cutroom-cli-test-"));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

// Real /proc/mounts: no injected table in this file.
function realEnv() {
  const env = testEnv();
  return { ...env, mount: undefined, timers: fakeTimers() };
}
const runEnv = (env: ReturnType<typeof realEnv>) => ({ ...env, onBackupError: () => undefined });

test("run, status over the socket, stop (real /proc/mounts, real Unix socket)", async () => {
  const t = tempHome();
  try {
    const env = realEnv();
    assert.equal(await runCli(["new", t.dir], env), 0, env.errLines.join("\n"));
    const started = await startSpace(t.dir, runEnv(env));
    assert.equal(started.ok, true, JSON.stringify(started));
    if (!started.ok) return;
    assert.equal(existsSync(join(t.dir, "control.sock")), true);
    env.outLines.length = 0;
    assert.equal(await runCli(["status", t.dir], env), 0, env.errLines.join("\n"));
    const s = JSON.parse(env.outLines[0] ?? "{}");
    assert.equal(s.served, true);
    assert.equal(s.accepted_head, null);
    assert.equal(await runCli(["stop", t.dir], env), 0, env.errLines.join("\n"));
    await started.value.closed;
    assert.equal(existsSync(join(t.dir, "control.sock")), false);
    // Stopped: status falls back to the read-only path.
    env.outLines.length = 0;
    assert.equal(await runCli(["status", t.dir], env), 0);
    assert.equal(JSON.parse(env.outLines[0] ?? "{}").served, false);
  } finally {
    t.cleanup();
  }
});

test("a second run is refused with SPACE_IN_USE", async () => {
  const t = tempHome();
  try {
    const env = realEnv();
    assert.equal(await runCli(["new", t.dir], env), 0);
    const first = await startSpace(t.dir, runEnv(env));
    assert.equal(first.ok, true);
    if (!first.ok) return;
    try {
      const second = await startSpace(t.dir, runEnv(env));
      assert.equal(second.ok, false);
      if (!second.ok) assert.equal(second.diagnostics[0]?.code, "SPACE_IN_USE");
      // The race path: binding over a live socket gives the same code.
      const stub: ControlApi = { status: async () => ({}) as SpaceStatus, stop: async () => undefined };
      const raced = await serveControl(t.dir, join(t.dir, "control.sock"), stub);
      assert.equal(raced.ok, false);
      if (!raced.ok) assert.equal(raced.diagnostics[0]?.code, "SPACE_IN_USE");
    } finally {
      await first.value.stop();
      await first.value.closed;
    }
  } finally {
    t.cleanup();
  }
});

test("a stale socket file left by a killed process is replaced", async () => {
  const t = tempHome();
  try {
    const env = realEnv();
    assert.equal(await runCli(["new", t.dir], env), 0);
    // A socket file with no listener: bind and kill without unlinking.
    const child = spawnSync(process.execPath, [
      "-e",
      `const s=require("node:net").createServer();s.listen(${JSON.stringify(join(t.dir, "control.sock"))},()=>process.kill(process.pid,"SIGKILL"))`,
    ]);
    assert.notEqual(child.status, 0);
    assert.equal(existsSync(join(t.dir, "control.sock")), true);
    const started = await startSpace(t.dir, runEnv(env));
    assert.equal(started.ok, true, JSON.stringify(started));
    if (started.ok) {
      await started.value.stop();
      await started.value.closed;
    }
  } finally {
    t.cleanup();
  }
});

test("status and stop go through a stub ControlApi (M4 supplies the real one)", async () => {
  const t = tempHome();
  try {
    mkdirSync(t.dir, { recursive: true });
    const calls: string[] = [];
    const stub: ControlApi = {
      status: async () => {
        calls.push("status");
        return { schema_version: 9, accepted_head: null, accepted_p: null, blob_count: 0, blob_bytes: 0 };
      },
      stop: async () => {
        calls.push("stop");
      },
    };
    const socket = join(t.dir, "control.sock");
    const served = await serveControl(t.dir, socket, stub);
    assert.equal(served.ok, true);
    if (!served.ok) return;
    const { sendControl } = await import("../src/control.js");
    assert.equal(((await sendControl(socket, { op: "status" })) as SpaceStatus).schema_version, 9);
    await sendControl(socket, { op: "stop" });
    assert.deepEqual(calls, ["status", "stop"]);
    served.value.stopListening();
    await served.value.closed;
    assert.equal(await sendControl(socket, { op: "status" }), "unreachable");
  } finally {
    t.cleanup();
  }
});

test("new on a home symlink into /mnt/c is refused by the real mount check", async (t) => {
  if (!existsSync("/mnt/c")) {
    t.diagnostic("no /mnt/c here; nothing to assert");
    return;
  }
  const home = tempHome();
  try {
    const link = join(home.dir, "winlink");
    symlinkSync("/mnt/c", link);
    const env = realEnv();
    const target = join(link, "cutroom-cli-test-not-created");
    assert.equal(await runCli(["new", target], env), 1);
    const err = env.errLines.join("\n");
    assert.match(err, /SPACE_MOUNT_REFUSED/);
    assert.match(err, /9p/);
    assert.equal(existsSync("/mnt/c/cutroom-cli-test-not-created"), false);
  } finally {
    home.cleanup();
  }
});

test("the built bin runs end to end: new, run in the background, status, stop", async () => {
  const t = tempHome();
  try {
    const bin = fileURLToPath(new URL("../src/bin.js", import.meta.url));
    const cli = (...args: string[]) => spawnSync(process.execPath, [bin, ...args], { encoding: "utf8" });
    const created = cli("new", t.dir);
    assert.equal(created.status, 0, created.stderr);
    const server = spawn(process.execPath, [bin, "run", t.dir], { stdio: ["ignore", "pipe", "pipe"] });
    try {
      await new Promise<void>((resolve, reject) => {
        server.stdout.on("data", (d: Buffer) => {
          if (String(d).includes("serving")) resolve();
        });
        server.once("exit", () => reject(new Error("run exited early")));
      });
      const status = cli("status", t.dir);
      assert.equal(status.status, 0, status.stderr);
      assert.equal(JSON.parse(status.stdout).served, true);
      const second = cli("run", t.dir);
      assert.equal(second.status, 1);
      assert.match(second.stderr, /SPACE_IN_USE/);
      const stopped = cli("stop", t.dir);
      assert.equal(stopped.status, 0, stopped.stderr);
      const code = await new Promise<number | null>((resolve) => server.once("exit", resolve));
      assert.equal(code, 0);
      assert.equal(existsSync(join(t.dir, "control.sock")), false);
    } finally {
      server.kill("SIGKILL");
    }
    const unbuilt = cli("lock");
    assert.notEqual(unbuilt.status, 0);
    assert.match(unbuilt.stderr, /milestone M2/);
  } finally {
    t.cleanup();
  }
});
