// Design: lld/04 §2.6 "Blob store" (file and directory syncs, atomic rename, read-only files), §8 (same filesystem)
import { constants, createReadStream } from "node:fs";
import { chmod, mkdir, open, readdir, rename, stat, unlink } from "node:fs/promises";

/** An exclusively created file being written. */
export interface BlobWriter {
  write(chunk: Uint8Array): Promise<void>;
  /** `fsync` of this file. */
  sync(): Promise<void>;
  close(): Promise<void>;
}

/** What entry of a directory listing or `stat` the store needs. */
export interface BlobStat {
  readonly size: number;
  readonly mtimeMs: number;
}

/**
 * Every file system operation of the blob store. Tests wrap it to see which paths are synced and to stop a
 * run between two steps; production uses `nodeBlobFs`.
 */
export interface BlobFs {
  /** Creates the directory and its parents; returns the first directory created, or undefined if it existed. */
  mkdirp(path: string): Promise<string | undefined>;
  /** Creates a new file; it is an error if the path exists. */
  openWrite(path: string): Promise<BlobWriter>;
  /** `fsync` of an existing file. */
  syncFile(path: string): Promise<void>;
  /** `fsync` of a directory, which makes the entries in it (a rename, a creation) durable. */
  syncDir(path: string): Promise<void>;
  /** Atomic on one filesystem; replaces the target if it exists. */
  rename(from: string, to: string): Promise<void>;
  /** Mode 0444. */
  makeReadOnly(path: string): Promise<void>;
  /** Returns false if the file did not exist. */
  unlink(path: string): Promise<boolean>;
  /** Undefined if the path does not exist. */
  stat(path: string): Promise<BlobStat | undefined>;
  /** Entry names; empty if the directory does not exist. */
  readdir(path: string): Promise<string[]>;
  read(path: string): AsyncIterable<Uint8Array>;
}

const READ_ONLY_MODE = 0o444;

const isMissing = (error: unknown): boolean => (error as { code?: unknown } | null)?.code === "ENOENT";

/** A directory cannot be opened on Windows, where there is nothing to sync; Linux (the product) always syncs. */
const mayNotSyncDirectories = (error: unknown): boolean => {
  const code = (error as { code?: unknown } | null)?.code;
  return process.platform === "win32" && (code === "EPERM" || code === "EISDIR" || code === "EACCES");
};

export const nodeBlobFs: BlobFs = {
  async mkdirp(path) {
    return await mkdir(path, { recursive: true });
  },

  async openWrite(path) {
    const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o644);
    return {
      async write(chunk) {
        let offset = 0;
        while (offset < chunk.length) {
          const { bytesWritten } = await handle.write(chunk, offset, chunk.length - offset);
          offset += bytesWritten;
        }
      },
      sync: () => handle.sync(),
      close: () => handle.close(),
    };
  },

  async syncFile(path) {
    const handle = await open(path, constants.O_RDONLY);
    try {
      await handle.sync();
    } catch (error) {
      // Windows refuses fsync on a read-only handle; Linux (the product) never does.
      if (!mayNotSyncDirectories(error)) throw error;
    } finally {
      await handle.close();
    }
  },

  async syncDir(path) {
    let handle: Awaited<ReturnType<typeof open>>;
    try {
      handle = await open(path, constants.O_RDONLY);
    } catch (error) {
      if (mayNotSyncDirectories(error)) return;
      throw error;
    }
    try {
      await handle.sync();
    } catch (error) {
      if (!mayNotSyncDirectories(error)) throw error;
    } finally {
      await handle.close();
    }
  },

  async rename(from, to) {
    try {
      await rename(from, to);
    } catch (error) {
      // Windows will not replace a read-only file; Linux (the product) does.
      const code = (error as { code?: unknown } | null)?.code;
      if (process.platform !== "win32" || (code !== "EPERM" && code !== "EACCES")) throw error;
      await chmod(to, 0o666);
      await rename(from, to);
    }
  },
  makeReadOnly: (path) => chmod(path, READ_ONLY_MODE),

  async unlink(path) {
    try {
      await unlink(path);
      return true;
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
  },

  async stat(path) {
    try {
      const s = await stat(path);
      return { size: s.size, mtimeMs: s.mtimeMs };
    } catch (error) {
      if (isMissing(error)) return undefined;
      throw error;
    }
  },

  async readdir(path) {
    try {
      return await readdir(path);
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }
  },

  read: (path) => createReadStream(path),
};
