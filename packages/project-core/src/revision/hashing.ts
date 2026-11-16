// Design: lld/04 §2.5 (manifest, revision_id, tree_hash, pin_hash), lld/02 §2.2 + Revision 1 item 4
import {
  hashCanonical,
  isEntityId,
  isHashString,
  type JsonValue,
  revisionIdFromHash,
} from "@cutroom/foundations";

/** An entity version: a flat JSON object with at least `id`, `kind`, `v` (lld/04 §2.1). */
export type EntityDocument = Readonly<Record<string, JsonValue>>;

export interface EntityHashes {
  /** Canonical text of the whole document: exactly the hashed text, and what is stored. */
  readonly text: string;
  /** Hash of the whole document; what a manifest lists. */
  readonly hash: string;
  /** Hash of the document without `commitment.readiness`; equals `hash` when there is no commitment. */
  readonly pin_hash: string;
}

function isPlainObject(v: unknown): v is Record<string, JsonValue> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** The document minus `commitment.readiness`; the same object when there is nothing to remove. */
export function withoutReadiness(doc: EntityDocument): EntityDocument {
  const commitment = doc.commitment;
  if (!isPlainObject(commitment) || !("readiness" in commitment)) return doc;
  const { readiness: _removed, ...rest } = commitment;
  return { ...doc, commitment: rest };
}

export function hashEntityVersion(doc: EntityDocument): EntityHashes {
  const whole = hashCanonical(doc);
  const pin = withoutReadiness(doc) === doc ? whole : hashCanonical(withoutReadiness(doc));
  return { text: whole.text, hash: whole.hash, pin_hash: pin.hash };
}

export interface Manifest {
  readonly format: 1;
  readonly project: string;
  readonly parents: readonly string[];
  readonly entities: Readonly<Record<string, string>>;
}

const REVISION_ID = /^rev_[0-9a-f]{64}$/;
export const isRevisionId = (s: unknown): s is string => typeof s === "string" && REVISION_ID.test(s);

export interface ManifestHashes {
  readonly manifest: string;
  readonly revision_id: string;
  readonly tree_hash: string;
}

/**
 * Builds the manifest and hashes it once. Parents are in the manifest, so they are hashed; time, author and
 * origin are not in it. `tree_hash` covers only the entity map. A caller bug (malformed input) throws.
 */
export function hashManifest(input: {
  readonly project: string;
  readonly parents: readonly string[];
  readonly entities: Readonly<Record<string, string>>;
}): ManifestHashes {
  if (!isEntityId(input.project)) throw new TypeError(`project is not an entity ID: ${input.project}`);
  for (const p of input.parents)
    if (!isRevisionId(p)) throw new TypeError(`parent is not a revision ID: ${p}`);
  for (const [id, h] of Object.entries(input.entities)) {
    if (!isEntityId(id)) throw new TypeError(`entities key is not an entity ID: ${id}`);
    if (!isHashString(h)) throw new TypeError(`entities.${id} is not a sha256: hash`);
  }
  const manifest: Manifest = {
    format: 1,
    project: input.project,
    parents: [...input.parents],
    entities: { ...input.entities },
  };
  const hashed = hashCanonical(manifest);
  return {
    manifest: hashed.text,
    revision_id: revisionIdFromHash(hashed.hash),
    tree_hash: hashCanonical(manifest.entities).hash,
  };
}
