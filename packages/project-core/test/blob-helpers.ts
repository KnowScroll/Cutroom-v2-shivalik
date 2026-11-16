import { randomBytes } from "node:crypto";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { SettingsRegistry } from "@cutroom/foundations";
import {
  BLOB_MIGRATIONS,
  type BlobFs,
  BlobStore,
  type BlobStoreOptions,
  MigrationRegistry,
  nodeBlobFs,
  openDatabase,
  PROJECT_CORE_SETTINGS,
  resolveBlobSettings,
  type Storage,
} from "../src/index.js";
import { SETTINGS, tempSpace } from "./storage-helpers.js";

export interface FsCall {
  readonly op: string;
  readonly path: string;
}

/** The real fs, recording every call; `after` may throw to stop a run just after a step (a simulated crash). */
export function spyFs(after?: (call: FsCall) => void): { fs: BlobFs; calls: FsCall[] } {
  const calls: FsCall[] = [];
  const note = (op: string, path: string) => calls.push({ op, path });
  const fs: BlobFs = {
    ...nodeBlobFs,
    async openWrite(path) {
      const w = await nodeBlobFs.openWrite(path);
      return {
        write: (c) => w.write(c),
        async sync() {
          note("syncWriter", path);
          await w.sync();
        },
        close: () => w.close(),
      };
    },
    async syncFile(path) {
      note("syncFile", path);
      await nodeBlobFs.syncFile(path);
    },
    async syncDir(path) {
      note("syncDir", path);
      await nodeBlobFs.syncDir(path);
    },
    async rename(from, to) {
      await nodeBlobFs.rename(from, to);
      note("rename", to);
      after?.({ op: "rename", path: to });
    },
    async makeReadOnly(path) {
      note("makeReadOnly", path);
      await nodeBlobFs.makeReadOnly(path);
    },
    async unlink(path) {
      note("unlink", path);
      return await nodeBlobFs.unlink(path);
    },
  };
  return { fs, calls };
}

export async function setupBlobs(
  extra: Partial<BlobStoreOptions> & { fs?: BlobFs } = {},
  settings: Record<string, string | number> = {},
) {
  const t = tempSpace();
  const migrations = new MigrationRegistry();
  migrations.registerMigrations("project-core", BLOB_MIGRATIONS);
  const opened = await openDatabase(t.db, { ...SETTINGS, migrations });
  if (!opened.ok) throw new Error(JSON.stringify(opened));
  const storage: Storage = opened.value;
  const registry = new SettingsRegistry();
  registry.register("project-core", PROJECT_CORE_SETTINGS);
  const resolved = resolveBlobSettings(registry, [{ source: "test", form: "flat", values: settings }]);
  if (!resolved.ok) throw new Error(JSON.stringify(resolved));
  const store = new BlobStore({ spaceDir: t.dir, storage, ...resolved.value, ...extra });
  return {
    t,
    storage,
    store,
    cleanup() {
      storage.close();
      t.cleanup();
    },
  };
}

export const bytes = (n: number): Uint8Array => new Uint8Array(randomBytes(n));

/** The input as a stream of 64 KB chunks. */
export async function* chunks(data: Uint8Array, size = 65_536): AsyncGenerator<Uint8Array> {
  for (let i = 0; i < data.length; i += size) yield data.subarray(i, i + size);
}

export const listTmp = (dir: string): string[] => {
  try {
    return readdirSync(join(dir, "tmp"));
  } catch {
    return [];
  }
};
