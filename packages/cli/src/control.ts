// Design: lld/07 D12 (a second invocation reaches the Space process over a Unix socket; one ControlApi),
// lld/11 A:M0-4 (SPACE_IN_USE, SOCKET_PATH_TOO_LONG), lld/04 §1 (one process serves one Space; no network)
import { lstatSync, rmSync } from "node:fs";
import { connect, createServer, type Server, type Socket } from "node:net";
import { type Diagnostic, fail, ok, type Result } from "@cutroom/foundations";

/** `sun_path` holds 108 bytes including the terminating NUL; the design fixes the limit at 107 (A:M0-4). */
export const MAX_SOCKET_PATH_BYTES = 107;

export interface SpaceStatus {
  readonly schema_version: number;
  /** The accepted head revision (branch `main`), or null before genesis. */
  readonly accepted_head: string | null;
  /** The `P` number: the newest `accepted_log.seq`, or null before genesis. */
  readonly accepted_p: number | null;
  readonly blob_count: number;
  readonly blob_bytes: number;
}

/** What a second invocation can ask of the Space process. M4's harness supplies the real, larger one. */
export interface ControlApi {
  status(): Promise<SpaceStatus>;
  /** Commits, closes the database and stops listening; resolves when that is done. */
  stop(): Promise<void>;
}

export type ControlRequest = { readonly op: "status" } | { readonly op: "stop" };

export function socketPathProblem(path: string): Diagnostic | undefined {
  const bytes = Buffer.byteLength(path);
  if (bytes <= MAX_SOCKET_PATH_BYTES) return undefined;
  return {
    code: "SOCKET_PATH_TOO_LONG",
    path,
    expected: `at most ${MAX_SOCKET_PATH_BYTES} bytes`,
    got: bytes,
  };
}

function isSocketFile(path: string): boolean {
  try {
    return lstatSync(path).isSocket();
  } catch {
    return false;
  }
}

/** `live`: a process accepts connections; `stale`: a socket file nobody listens on; `absent`: nothing there. */
export function probeSocket(path: string): Promise<"live" | "stale" | "absent"> {
  return new Promise((resolve, reject) => {
    const s = connect(path);
    s.once("connect", () => {
      s.destroy();
      resolve("live");
    });
    s.once("error", (error: NodeJS.ErrnoException) => {
      s.destroy();
      if (error.code === "ENOENT") resolve("absent");
      else if (error.code === "ECONNREFUSED" && isSocketFile(path)) resolve("stale");
      else reject(error);
    });
  });
}

const spaceInUse = (dir: string, socketPath: string): Diagnostic => ({
  code: "SPACE_IN_USE",
  path: dir,
  expected: "no other process serving the Space",
  got: socketPath,
});

export { spaceInUse };

export interface ControlServer {
  /** Stops listening and removes the socket file; open connections finish their reply. */
  stopListening(): void;
  /** Resolves when the server is closed and every connection has ended. */
  readonly closed: Promise<void>;
}

function respond(socket: Socket, body: unknown): void {
  socket.end(`${JSON.stringify(body)}\n`);
}

async function dispatch(api: ControlApi, line: string): Promise<unknown> {
  let request: unknown;
  try {
    request = JSON.parse(line);
  } catch {
    return { ok: false, error: "request is not JSON" };
  }
  const op = (request as { op?: unknown } | null)?.op;
  try {
    if (op === "status") return { ok: true, value: await api.status() };
    if (op === "stop") {
      await api.stop();
      return { ok: true, value: null };
    }
  } catch (error) {
    return { ok: false, error: `${String(op)} failed: ${String(error)}` };
  }
  return { ok: false, error: `unknown op ${JSON.stringify(op)}; expected status or stop` };
}

/**
 * Serves `api` on a Unix socket at `socketPath`, one JSON request per line, one reply, then the connection
 * ends. A socket file nobody listens on is removed and replaced; one a live process holds is SPACE_IN_USE.
 */
export async function serveControl(
  dir: string,
  socketPath: string,
  api: ControlApi,
): Promise<Result<ControlServer>> {
  const long = socketPathProblem(socketPath);
  if (long !== undefined) return fail(long);
  const server: Server = createServer((socket) => {
    let buffer = "";
    socket.setEncoding("utf8");
    socket.on("error", () => socket.destroy());
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      const end = buffer.indexOf("\n");
      if (end < 0) return;
      const line = buffer.slice(0, end);
      buffer = "";
      void dispatch(api, line).then((body) => respond(socket, body));
    });
  });
  const listen = (): Promise<void> =>
    new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(socketPath, () => {
        server.off("error", reject);
        resolve();
      });
    });
  try {
    await listen();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
    if ((await probeSocket(socketPath)) === "live") return fail(spaceInUse(dir, socketPath));
    rmSync(socketPath, { force: true });
    try {
      await listen();
    } catch (again) {
      if ((again as NodeJS.ErrnoException).code === "EADDRINUSE") return fail(spaceInUse(dir, socketPath));
      throw again;
    }
  }
  const closed = new Promise<void>((resolve) => server.once("close", resolve));
  return ok({
    closed,
    stopListening: () => {
      server.close();
      rmSync(socketPath, { force: true });
    },
  });
}

/**
 * Sends one request to the Space process and resolves with the reply's value. `unreachable` means nothing
 * is serving the socket. A refused request rejects with the process's message.
 */
export function sendControl(socketPath: string, request: ControlRequest): Promise<unknown | "unreachable"> {
  return new Promise((resolve, reject) => {
    const s = connect(socketPath);
    let buffer = "";
    s.setEncoding("utf8");
    s.once("connect", () => s.write(`${JSON.stringify(request)}\n`));
    s.on("data", (chunk: string) => {
      buffer += chunk;
    });
    s.once("end", () => {
      try {
        const reply = JSON.parse(buffer) as { ok: boolean; value?: unknown; error?: string };
        if (reply.ok) resolve(reply.value ?? null);
        else reject(new Error(reply.error ?? "request refused"));
      } catch (error) {
        reject(error);
      }
    });
    s.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT" || error.code === "ECONNREFUSED") resolve("unreachable");
      else reject(error);
    });
  });
}
