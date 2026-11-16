// Design: lld/04 §2.5 (canonical JSON, RFC 8785; the only importer of `canonicalize`); lld/02 §2.5 (hash choice)
import { createHash } from "node:crypto";
import canonicalize from "canonicalize";

/** A value that survives a JSON round trip unchanged (apart from -0, which canonical JSON writes as 0). */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/** Thrown when a value is not plain JSON. `path` is a JSON-pointer-like location of the offending value. */
export class CanonicalJsonError extends Error {
  readonly path: string;
  readonly reason: string;
  constructor(path: string, reason: string) {
    super(`not canonicalisable at ${path === "" ? "(root)" : path}: ${reason}`);
    this.name = "CanonicalJsonError";
    this.path = path;
    this.reason = reason;
  }
}

/** The canonical text and its hash. The text is exactly what was hashed (lld/04 §2.5: one hash re-checks integrity). */
export interface HashedCanonical {
  readonly text: string;
  readonly hash: string;
}

function hasLoneSurrogate(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = s.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        i++;
        continue;
      }
      return true;
    }
    if (c >= 0xdc00 && c <= 0xdfff) return true;
  }
  return false;
}

function pointer(path: string, key: string | number): string {
  return `${path}/${String(key).replaceAll("~", "~0").replaceAll("/", "~1")}`;
}

function guard(value: unknown, path: string, ancestors: Set<object>): void {
  if (value === null) return;
  switch (typeof value) {
    case "boolean":
      return;
    case "string":
      if (hasLoneSurrogate(value)) throw new CanonicalJsonError(path, "string holds a lone surrogate");
      return;
    case "number":
      if (!Number.isFinite(value)) throw new CanonicalJsonError(path, "number is not finite");
      return;
    case "undefined":
      throw new CanonicalJsonError(path, "undefined is not JSON");
    case "bigint":
      throw new CanonicalJsonError(path, "BigInt is not JSON");
    case "function":
      throw new CanonicalJsonError(path, "function is not JSON");
    case "symbol":
      throw new CanonicalJsonError(path, "symbol is not JSON");
    default:
      break;
  }
  const obj = value as object;
  if (ancestors.has(obj)) throw new CanonicalJsonError(path, "cycle");
  ancestors.add(obj);
  if (Array.isArray(obj)) {
    if (Object.getPrototypeOf(obj) !== Array.prototype) {
      throw new CanonicalJsonError(path, "array subclass is not plain JSON");
    }
    for (let i = 0; i < obj.length; i++) {
      if (!(i in obj)) throw new CanonicalJsonError(pointer(path, i), "sparse array hole");
      guard(obj[i], pointer(path, i), ancestors);
    }
    if (Object.keys(obj).length !== obj.length) {
      throw new CanonicalJsonError(path, "array has extra properties");
    }
  } else {
    const proto = Object.getPrototypeOf(obj);
    if (proto !== Object.prototype && proto !== null) {
      throw new CanonicalJsonError(path, "not a plain object (Date, Map, class instance, ...)");
    }
    if (Object.getOwnPropertySymbols(obj).length > 0) {
      throw new CanonicalJsonError(path, "symbol-keyed property");
    }
    for (const key of Object.keys(obj)) {
      if (hasLoneSurrogate(key))
        throw new CanonicalJsonError(pointer(path, key), "key holds a lone surrogate");
      guard((obj as Record<string, unknown>)[key], pointer(path, key), ancestors);
    }
  }
  ancestors.delete(obj);
}

/**
 * RFC 8785 canonical text of a plain JSON value. Refuses (throws CanonicalJsonError) anything `canonicalize`
 * would silently change: undefined, Date, BigInt, lone surrogates, NaN, Infinity, cycles, class instances.
 * -0 is accepted and written as 0, which is what RFC 8785 requires.
 */
export function canonicalJson(value: unknown): string {
  guard(value, "", new Set());
  const text = canonicalize(value);
  if (text === undefined) throw new CanonicalJsonError("", "value has no JSON form");
  return text;
}

/** SHA-256 of a string (UTF-8) or bytes, as lowercase hex without a prefix. */
export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Canonical text plus `sha256:<hex>` of exactly that text. */
export function hashCanonical(value: unknown): HashedCanonical {
  const text = canonicalJson(value);
  return { text, hash: `sha256:${sha256Hex(text)}` };
}
