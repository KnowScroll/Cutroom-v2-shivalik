// Design: lld/04 §2.6, §2.12; lld/11 A:M0-9 (one migration number sequence, owner "project-core")
import { REVISION_MIGRATIONS } from "./revision/schema.js";
import type { MigrationScript } from "./storage/migrations.js";

/** Every script Project Core registers, in number order. M0-07 adds its `blob` script (number 1) at merge. */
export const PROJECT_CORE_MIGRATIONS: readonly MigrationScript[] = [...REVISION_MIGRATIONS];
