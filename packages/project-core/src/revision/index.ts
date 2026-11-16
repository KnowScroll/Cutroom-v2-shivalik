// Design: lld/04 §2.5, §2.6 (revision store exports)
export type { BlobRootProvider } from "./blob-root.js";
export { REVISION_CODES, type RevisionCode } from "./codes.js";
export {
  type EntityDocument,
  type EntityHashes,
  hashEntityVersion,
  hashManifest,
  isRevisionId,
  type Manifest,
  type ManifestHashes,
  withoutReadiness,
} from "./hashing.js";
export { REVISION_MIGRATIONS } from "./schema.js";
export {
  ACCEPTED_BRANCH,
  type BranchRecord,
  type BranchState,
  type BranchType,
  type RevisionOrigin,
  type RevisionRecord,
  RevisionStore,
  type SnapshotEntity,
  type SwapHook,
  type SwapInfo,
  type SwapInput,
} from "./store.js";
