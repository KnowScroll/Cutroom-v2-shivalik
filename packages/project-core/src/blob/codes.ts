// Design: lld/04 §2.6, §3 (BLOB_MISSING is Project Core's), lld/11 A:M0-4 (no new code for a wrong-size blob)
// Every code listed here must be asserted by a test, or `npm run check` fails.
export const BLOB_CODES = ["BLOB_MISSING"] as const;
export type BlobCode = (typeof BLOB_CODES)[number];
