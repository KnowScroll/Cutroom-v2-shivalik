// Design: lld/04 §2.6, §2.12, lld/11 A:M0-9 (one shared migration number sequence)
import { BLOB_MIGRATIONS } from "./blob/schema.js";

export const PROJECT_CORE_MIGRATIONS = [...BLOB_MIGRATIONS];
