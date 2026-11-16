// Design: lld/11 A:M0-4 (Project Core's start-up codes), lld/04 §2.6, §2.12, §4
// Every code listed here must be asserted by a test, or `npm run check` fails.
export const STORAGE_CODES = [
  "SQLITE_TOO_OLD",
  "DB_DAMAGED",
  "MIGRATION_FAILED",
  "SPACE_MOUNT_REFUSED",
  "SPACE_MOUNT_UNKNOWN",
] as const;
export type StorageCode = (typeof STORAGE_CODES)[number];
