// Design: impl/02 §6 (fonts come from release zips; WSL has no unzip, so this reads stored and deflated entries)
// A minimal zip reader over a Buffer: no zip64, no encryption, which is all the font releases use.
import { inflateRawSync } from "node:zlib";

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

/** Lists the entries of a zip as { name, offset, method, compressedSize, size }. */
export function listZip(buffer) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip: no end-of-central-directory record");
  const count = buffer.readUInt16LE(eocd + 10);
  let pos = buffer.readUInt32LE(eocd + 16);
  const entries = [];
  for (let n = 0; n < count; n++) {
    if (buffer.readUInt32LE(pos) !== CENTRAL) throw new Error("zip: bad central directory");
    const method = buffer.readUInt16LE(pos + 10);
    const compressedSize = buffer.readUInt32LE(pos + 20);
    const size = buffer.readUInt32LE(pos + 24);
    const nameLength = buffer.readUInt16LE(pos + 28);
    const extraLength = buffer.readUInt16LE(pos + 30);
    const commentLength = buffer.readUInt16LE(pos + 32);
    const offset = buffer.readUInt32LE(pos + 42);
    const name = buffer.toString("utf8", pos + 46, pos + 46 + nameLength);
    entries.push({ name, offset, method, compressedSize, size });
    pos += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** Returns the bytes of one entry. */
export function readZipEntry(buffer, entry) {
  if (buffer.readUInt32LE(entry.offset) !== LOCAL) throw new Error(`zip: bad local header for ${entry.name}`);
  const nameLength = buffer.readUInt16LE(entry.offset + 26);
  const extraLength = buffer.readUInt16LE(entry.offset + 28);
  const start = entry.offset + 30 + nameLength + extraLength;
  const raw = buffer.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return Buffer.from(raw);
  if (entry.method === 8) return inflateRawSync(raw);
  throw new Error(`zip: unsupported method ${entry.method} for ${entry.name}`);
}
