// Design: lld/02 §2.2-2.4 (revision IDs, ArtifactRef, work key); lld/04 §2.5 (manifest hashing)
import { hashCanonical, type JsonValue } from "./canonical.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;

/** `sha256:` plus the hash of the bytes, with media type and size (lld/02 §2.3). */
export interface ArtifactRef {
  readonly hash: string;
  readonly media_type: string;
  readonly size: number;
}

export type ArtifactRefResult =
  | { readonly ok: true; readonly value: ArtifactRef }
  | { readonly ok: false; readonly errors: readonly string[] };

export function isHashString(value: unknown): value is string {
  return typeof value === "string" && HASH_PATTERN.test(value);
}

/** Hand-written validator (zod is not yet a foundations dependency). Unknown fields are refused. */
export function parseArtifactRef(input: unknown): ArtifactRefResult {
  const errors: string[] = [];
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: ["expected an object"] };
  }
  const rec = input as Record<string, unknown>;
  if (!isHashString(rec.hash)) errors.push("hash: expected sha256: followed by 64 lowercase hex digits");
  if (typeof rec.media_type !== "string" || !/^[^\s/]+\/[^\s/]+$/.test(rec.media_type)) {
    errors.push("media_type: expected a type/subtype string");
  }
  if (typeof rec.size !== "number" || !Number.isSafeInteger(rec.size) || rec.size < 0) {
    errors.push("size: expected a non-negative safe integer");
  }
  for (const key of Object.keys(rec)) {
    if (key !== "hash" && key !== "media_type" && key !== "size") errors.push(`${key}: unknown field`);
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { hash: rec.hash as string, media_type: rec.media_type as string, size: rec.size as number },
  };
}

/** The four groups of lld/02 §2.4. Their contents per capability are decided later (R4 D6, M2). */
export interface WorkKeyParts {
  readonly capability: string;
  readonly capability_version: string;
  /** Hashes of all pinned inputs, by role name. */
  readonly input_hashes: Readonly<Record<string, string>>;
  readonly parameters: JsonValue;
  readonly environment_hash: string;
}

/** `sha256:` hash of the canonical JSON of the four groups. */
export function workKey(parts: WorkKeyParts): string {
  for (const [role, h] of Object.entries(parts.input_hashes)) {
    if (!isHashString(h)) throw new Error(`workKey: input_hashes.${role} is not a sha256: hash`);
  }
  if (!isHashString(parts.environment_hash))
    throw new Error("workKey: environment_hash is not a sha256: hash");
  return hashCanonical({
    capability: parts.capability,
    capability_version: parts.capability_version,
    input_hashes: parts.input_hashes,
    parameters: parts.parameters,
    environment_hash: parts.environment_hash,
  }).hash;
}

/** `rev_` plus the hex of a `sha256:` hash (lld/02 §2.2). */
export function revisionIdFromHash(hash: string): string {
  if (!isHashString(hash)) throw new Error("revisionIdFromHash: not a sha256: hash");
  return `rev_${hash.slice("sha256:".length)}`;
}

/** Revision ID of a manifest: `rev_` + SHA-256 of its canonical JSON (lld/04 §2.5). */
export function revisionId(manifest: unknown): string {
  return revisionIdFromHash(hashCanonical(manifest).hash);
}
