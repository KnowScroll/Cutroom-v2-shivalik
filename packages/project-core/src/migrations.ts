// Design: lld/04 §2.6, §2.12; lld/11 A:M0-9 (one shared migration number sequence, owner "project-core")
import { BLOB_MIGRATIONS } from "./blob/schema.js";
import { REVISION_MIGRATIONS } from "./revision/schema.js";
import type { MigrationScript } from "./storage/migrations.js";

/** Every script Project Core registers, in number order: 1 `blob` (M0-07), 2 `revision` (M0-08). */
export const PROJECT_CORE_MIGRATIONS: readonly MigrationScript[] = [
  ...BLOB_MIGRATIONS,
  ...REVISION_MIGRATIONS,
];
