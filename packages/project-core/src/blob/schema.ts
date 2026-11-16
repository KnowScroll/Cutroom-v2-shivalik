// Design: lld/04 §2.6 (the `blob` table: hash PK, size, media_type, durable, state, stored_at, purged_reason), A:M0-9
import type { MigrationScript } from "../storage/index.js";

/**
 * Script 1 of the shared sequence. `hash` is the `sha256:` string of an ArtifactRef. `state` is `present`, or
 * `deleting` while the sweep unlinks the file (R3 §2.14). `stored_at` is the UTC time of the latest ingest of
 * these bytes: it is what the grace period counts from.
 */
export const BLOB_MIGRATIONS: readonly MigrationScript[] = [
  {
    number: 1,
    name: "blob",
    sql: `CREATE TABLE blob (
  hash TEXT NOT NULL PRIMARY KEY CHECK (length(hash) = 71 AND substr(hash, 1, 7) = 'sha256:'),
  size INTEGER NOT NULL CHECK (size >= 0),
  media_type TEXT NOT NULL,
  durable INTEGER NOT NULL CHECK (durable IN (0, 1)),
  state TEXT NOT NULL CHECK (state IN ('present', 'deleting')),
  stored_at TEXT NOT NULL,
  purged_reason TEXT
) STRICT;`,
  },
];
