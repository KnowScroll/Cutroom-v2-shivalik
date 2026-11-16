// Design: lld/04 §2.6 (tables entity_version, revision, branch, accepted_log, version_blob; STRICT), §2.5
import type { MigrationScript } from "../storage/migrations.js";

// Insert-only and append-only are enforced by triggers, so no later code path can break them by accident.
// `branch.head` and `accepted_log.revision` are foreign keys to `revision`; the swap checks the candidate first
// so a caller gets UNKNOWN_REVISION and not a constraint error.
const REVISION_SQL = `
CREATE TABLE entity_version (
  hash      TEXT PRIMARY KEY CHECK (hash GLOB 'sha256:*' AND length(hash) = 71),
  pin_hash  TEXT NOT NULL CHECK (pin_hash GLOB 'sha256:*' AND length(pin_hash) = 71),
  entity_id TEXT NOT NULL,
  kind      TEXT NOT NULL,
  v         INTEGER NOT NULL,
  handle    TEXT,
  doc       TEXT NOT NULL
) STRICT;
CREATE INDEX entity_version_entity ON entity_version(entity_id);
CREATE INDEX entity_version_pin ON entity_version(pin_hash);
CREATE TRIGGER entity_version_no_update BEFORE UPDATE ON entity_version
  BEGIN SELECT RAISE(ABORT, 'entity_version is insert-only'); END;
CREATE TRIGGER entity_version_no_delete BEFORE DELETE ON entity_version
  BEGIN SELECT RAISE(ABORT, 'entity_version is insert-only'); END;

CREATE TABLE revision (
  id         TEXT PRIMARY KEY CHECK (id GLOB 'rev_*'),
  tree_hash  TEXT NOT NULL,
  parents    TEXT NOT NULL,
  manifest   TEXT NOT NULL,
  origin     TEXT NOT NULL CHECK (origin IN ('patch', 'merge', 'restore', 'migration', 'genesis')),
  patch_id   TEXT,
  revalidate TEXT,
  pruned     INTEGER NOT NULL DEFAULT 0 CHECK (pruned IN (0, 1)),
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE branch (
  name       TEXT PRIMARY KEY,
  head       TEXT NOT NULL REFERENCES revision(id),
  fork_point TEXT REFERENCES revision(id),
  type       TEXT NOT NULL CHECK (type IN ('accepted', 'candidate', 'worker', 'experiment')),
  state      TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'merged', 'abandoned')),
  owner_job  TEXT
) STRICT;

CREATE TABLE accepted_log (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  revision    TEXT NOT NULL REFERENCES revision(id),
  previous    TEXT NOT NULL REFERENCES revision(id),
  from_branch TEXT NOT NULL REFERENCES branch(name),
  decision    TEXT,
  by          TEXT NOT NULL,
  at          TEXT NOT NULL
) STRICT;
CREATE TRIGGER accepted_log_no_update BEFORE UPDATE ON accepted_log
  BEGIN SELECT RAISE(ABORT, 'accepted_log is append-only'); END;
CREATE TRIGGER accepted_log_no_delete BEFORE DELETE ON accepted_log
  BEGIN SELECT RAISE(ABORT, 'accepted_log is append-only'); END;

CREATE TABLE version_blob (
  version_hash TEXT NOT NULL REFERENCES entity_version(hash),
  blob_hash    TEXT NOT NULL,
  PRIMARY KEY (version_hash, blob_hash)
) STRICT;
CREATE INDEX version_blob_blob ON version_blob(blob_hash);
`;

/** Script number 2 of the shared sequence (M0-07's `blob` table is number 1). */
export const REVISION_MIGRATIONS: readonly MigrationScript[] = [
  { number: 2, name: "revision", sql: REVISION_SQL },
];
