// Design: lld/04 §5 (R3 named settings), §2.7 (override rule, G15), lld/11 K5, G20, H7, A:M0-10 (db.backup_keep)
import type { SettingRecord } from "@cutroom/foundations";

const OWNER = "project-core";

// Every range in R3's table is given by the design, so no record carries a "derived" note.
const int = (name: string, def: number, min: number, max: number, human: boolean): SettingRecord => ({
  name,
  owner: OWNER,
  type: "integer",
  default: def,
  override_by: human ? "human" : "director",
  range: { kind: "number_range", min, max },
});

const str = (name: string, def: string, values: readonly string[]): SettingRecord => ({
  name,
  owner: OWNER,
  type: "string",
  default: def,
  override_by: "human",
  range: { kind: "values", values },
});

export const PROJECT_CORE_SETTINGS: readonly SettingRecord[] = [
  int("store.number_decimals", 6, 3, 9, true),
  int("handle.alias_grace_revisions", 50, 10, 500, false),
  str("db.synchronous", "NORMAL", ["NORMAL", "FULL"]),
  int("db.backup_hours", 6, 1, 24, true),
  int("db.backup_keep", 4, 1, 48, true),
  str("blob.verify_on_read", "final_render_only", ["final_render_only", "always"]),
  int("blob.grace_hours", 24, 1, 168, true),
  int("retention.prune_intermediate_days", 7, 1, 90, true),
  {
    name: "rollback.excluded_kinds",
    owner: OWNER,
    type: "string_list",
    default: ["lock", "decision"],
    override_by: "human",
    range: { kind: "list", add_only: true },
  },
];
