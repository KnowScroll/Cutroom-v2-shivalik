// Design: lld/02 §2.2-2.5 (hashing, canonical JSON, artifact references, work keys)
export {
  CanonicalJsonError,
  canonicalJson,
  type HashedCanonical,
  hashCanonical,
  type JsonValue,
  sha256Hex,
} from "./canonical.js";
export {
  type ArtifactRef,
  type ArtifactRefResult,
  isHashString,
  parseArtifactRef,
  revisionId,
  revisionIdFromHash,
  type WorkKeyParts,
  workKey,
} from "./refs.js";
