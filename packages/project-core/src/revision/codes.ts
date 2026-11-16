// Design: lld/04 §2.6 "Atomic accepted-head update" (STALE_BASE), §2.4 stage 2 (UNKNOWN_REVISION, UNKNOWN_BRANCH)
// Every code listed here must be asserted by a test, or `npm run check` fails.
export const REVISION_CODES = ["STALE_BASE", "UNKNOWN_REVISION", "UNKNOWN_BRANCH"] as const;
export type RevisionCode = (typeof REVISION_CODES)[number];
