// Design: lld/04 §2.6 "Blob store", §2.14 "Blobs"; lld/06 §2.12 (blob_roots)
// Same shape as src/blob/roots.ts (M0-07); unified at merge.
/** A source of blob hashes that the sweep must keep (R3 §2.14; R5 supplies one through blob_roots()). */
export interface BlobRootProvider {
  /** Stable name, used in sweep reports. */
  readonly name: string;
  /** Every blob hash (`sha256:` + 64 lowercase hex) this provider keeps alive, read now. */
  blobRoots(): Iterable<string> | Promise<Iterable<string>>;
}
