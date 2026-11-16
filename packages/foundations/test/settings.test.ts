import assert from "node:assert/strict";
import { test } from "node:test";
import type { SettingRecord } from "../src/index.js";
import { SETTINGS_CODES, SettingsRegistry, settingPath } from "../src/index.js";

const num = (
  name: string,
  def: number,
  min: number,
  max: number,
  by: "human" | "director" = "director",
): SettingRecord => ({
  name,
  owner: "test",
  type: "integer",
  default: def,
  override_by: by,
  range: { kind: "number_range", min, max },
});

const rollback: SettingRecord = {
  name: "rollback.excluded_kinds",
  owner: "test",
  type: "string_list",
  default: ["lock", "decision"],
  override_by: "human",
  range: { kind: "list", add_only: true },
};

const retention: SettingRecord = {
  name: "audit.retention_days",
  owner: "test",
  type: "integer_or_string",
  default: "keep_all",
  override_by: "human",
  range: {
    kind: "any_of",
    parts: [
      { kind: "number_range", min: 1, max: 3650 },
      { kind: "values", values: ["keep_all"] },
    ],
  },
};

const keyed: SettingRecord = {
  name: "tool.result_max_tokens",
  owner: "test",
  type: "keyed",
  default: { default: 4000, project_read: 8000, web_fetch: 2000 },
  override_by: "director",
  range: {
    kind: "keyed",
    keys: {
      default: { type: "integer", range: { kind: "number_range", min: 500, max: 20000 } },
      project_read: { type: "integer", range: { kind: "number_range", min: 500, max: 20000 } },
      web_fetch: { type: "integer", range: { kind: "number_range", min: 500, max: 20000 } },
    },
  },
};

function codesOf(r: { ok: boolean; diagnostics?: readonly { code: string }[] }): string[] {
  return r.ok ? [] : (r.diagnostics ?? []).map((d) => d.code);
}

function full(): SettingsRegistry {
  const reg = new SettingsRegistry();
  const r = reg.register("test", [
    num("handle.alias_grace_revisions", 50, 10, 500),
    num("db.backup_hours", 6, 1, 24, "human"),
    rollback,
    retention,
    keyed,
  ]);
  assert.equal(r.ok, true);
  return reg;
}

test("the code list names every code the registry returns", () => {
  assert.deepEqual([...SETTINGS_CODES].sort(), [
    "FIELD_AUTHORITY",
    "SETTING_DUPLICATE",
    "SETTING_NAME_INVALID",
    "SETTING_NAME_PREFIX",
    "SETTING_RECORD_INCOMPLETE",
    "SETTING_UNKNOWN",
    "VALUE_OUT_OF_RANGE",
  ]);
});

test("register refuses a record without override_by", () => {
  const bad = { ...num("a.b", 1, 0, 5), override_by: undefined } as unknown as SettingRecord;
  assert.deepEqual(codesOf(new SettingsRegistry().register("test", [bad])), ["SETTING_RECORD_INCOMPLETE"]);
});

test("register refuses a record without range", () => {
  const bad = { ...num("a.b", 1, 0, 5), range: undefined } as unknown as SettingRecord;
  assert.deepEqual(codesOf(new SettingsRegistry().register("test", [bad])), ["SETTING_RECORD_INCOMPLETE"]);
});

test("register refuses a range that does not fit the type", () => {
  const bad = { ...num("a.b", 1, 0, 5), range: { kind: "boolean" } } as SettingRecord;
  assert.deepEqual(codesOf(new SettingsRegistry().register("test", [bad])), ["SETTING_RECORD_INCOMPLETE"]);
});

test("register refuses names that are not area.snake_case", () => {
  for (const name of ["nodot", "Area.name", "area.Name", "area..name", "area.na-me", "area.name."]) {
    assert.deepEqual(
      codesOf(new SettingsRegistry().register("test", [num(name, 1, 0, 5)])),
      ["SETTING_NAME_INVALID"],
      name,
    );
  }
});

test("register refuses a duplicate, in a later call and in the same call", () => {
  const reg = new SettingsRegistry();
  assert.equal(reg.register("test", [num("a.b", 1, 0, 5)]).ok, true);
  assert.deepEqual(codesOf(reg.register("test", [num("a.b", 2, 0, 5)])), ["SETTING_DUPLICATE"]);
  assert.deepEqual(
    codesOf(new SettingsRegistry().register("test", [num("a.c", 1, 0, 5), num("a.c", 1, 0, 5)])),
    ["SETTING_DUPLICATE"],
  );
});

test("register refuses a default outside its range", () => {
  assert.deepEqual(codesOf(new SettingsRegistry().register("test", [num("a.b", 9, 0, 5)])), [
    "VALUE_OUT_OF_RANGE",
  ]);
  const fractional = num("a.c", 1.5, 0, 5);
  assert.deepEqual(codesOf(new SettingsRegistry().register("test", [fractional])), ["VALUE_OUT_OF_RANGE"]);
});

test("register refuses a name that is a dot-segment prefix of another, in either order", () => {
  const inner = num("delivery.audio.loudness_lufs", 1, 0, 5);
  const outer = num("delivery.audio", 1, 0, 5);
  const a = new SettingsRegistry();
  assert.equal(a.register("test", [inner]).ok, true);
  assert.deepEqual(codesOf(a.register("test", [outer])), ["SETTING_NAME_PREFIX"]);
  const b = new SettingsRegistry();
  assert.equal(b.register("test", [outer]).ok, true);
  assert.deepEqual(codesOf(b.register("test", [inner])), ["SETTING_NAME_PREFIX"]);
  assert.deepEqual(codesOf(new SettingsRegistry().register("test", [outer, inner])), ["SETTING_NAME_PREFIX"]);
});

test("a string prefix that is not a segment prefix is allowed", () => {
  const reg = new SettingsRegistry();
  assert.equal(
    reg.register("test", [num("delivery.audio", 1, 0, 5), num("delivery.audio_x", 1, 0, 5)]).ok,
    true,
  );
});

test("register is all or none", () => {
  const reg = new SettingsRegistry();
  assert.equal(reg.register("test", [num("a.b", 1, 0, 5), num("a.c", 9, 0, 5)]).ok, false);
  assert.equal(reg.get("a.b"), undefined);
});

test("register refuses a keyed default missing a key and a keyed range with a dotted key", () => {
  const missing = { ...keyed, default: { default: 4000 } } as SettingRecord;
  assert.deepEqual(codesOf(new SettingsRegistry().register("test", [missing])), [
    "VALUE_OUT_OF_RANGE",
    "VALUE_OUT_OF_RANGE",
  ]);
  const dotted = {
    ...keyed,
    range: {
      kind: "keyed",
      keys: { "a.b": keyed.range.kind === "keyed" ? keyed.range.keys.default : undefined },
    },
    default: { "a.b": 1 },
  } as unknown as SettingRecord;
  assert.deepEqual(codesOf(new SettingsRegistry().register("test", [dotted])), ["SETTING_RECORD_INCOMPLETE"]);
});

test("get and list; list is by owner and in name order", () => {
  const reg = full();
  assert.equal(reg.get("db.backup_hours")?.override_by, "human");
  assert.equal(reg.get("nope.nothing"), undefined);
  assert.deepEqual(
    reg.list("test").map((r) => r.name),
    [
      "audit.retention_days",
      "db.backup_hours",
      "handle.alias_grace_revisions",
      "rollback.excluded_kinds",
      "tool.result_max_tokens",
    ],
  );
  assert.deepEqual(reg.list("other"), []);
});

test("resolve: default without override, and with a project.settings override", () => {
  const reg = full();
  const none = reg.resolve("handle.alias_grace_revisions", []);
  assert.deepEqual(none, { ok: true, value: 50 });
  const layer = {
    source: "project.settings",
    form: "nested",
    values: { handle: { alias_grace_revisions: 100 } },
  } as const;
  assert.deepEqual(reg.resolve("handle.alias_grace_revisions", [layer]), { ok: true, value: 100 });
  assert.deepEqual(reg.resolve("db.backup_hours", [layer]), { ok: true, value: 6 });
});

test("resolve: quality_intent.settings_overrides wins over project.settings, whatever the key order", () => {
  const reg = full();
  const project = {
    source: "project.settings",
    form: "nested",
    values: { handle: { alias_grace_revisions: 100 } },
  } as const;
  const intent = {
    source: "quality_intent.settings_overrides",
    form: "flat",
    values: { "handle.alias_grace_revisions": 200 },
  } as const;
  assert.deepEqual(reg.resolve("handle.alias_grace_revisions", [project, intent]), { ok: true, value: 200 });
  const flatOnly = reg.resolve("handle.alias_grace_revisions", [intent]);
  assert.deepEqual(flatOnly, { ok: true, value: 200 });
});

test("resolve refuses an unknown setting and an out-of-range layer value", () => {
  const reg = full();
  assert.deepEqual(codesOf(reg.resolve("nope.nothing", [])), ["SETTING_UNKNOWN"]);
  const layer = {
    source: "project.settings",
    form: "nested",
    values: { handle: { alias_grace_revisions: 5000 } },
  } as const;
  assert.deepEqual(codesOf(reg.resolve("handle.alias_grace_revisions", [layer])), ["VALUE_OUT_OF_RANGE"]);
});

test("checkOverride: VALUE_OUT_OF_RANGE at both bounds, accepted on the bounds", () => {
  const reg = full();
  const name = "handle.alias_grace_revisions";
  assert.equal(reg.checkOverride(name, 10, "director").ok, true);
  assert.equal(reg.checkOverride(name, 500, "director").ok, true);
  assert.deepEqual(codesOf(reg.checkOverride(name, 9, "director")), ["VALUE_OUT_OF_RANGE"]);
  assert.deepEqual(codesOf(reg.checkOverride(name, 501, "director")), ["VALUE_OUT_OF_RANGE"]);
  assert.deepEqual(codesOf(reg.checkOverride(name, 12.5, "director")), ["VALUE_OUT_OF_RANGE"]);
  assert.deepEqual(codesOf(reg.checkOverride(name, "100", "director")), ["VALUE_OUT_OF_RANGE"]);
});

test("checkOverride: FIELD_AUTHORITY for a director on a human setting, accepted for a human", () => {
  const reg = full();
  const denied = reg.checkOverride("db.backup_hours", 12, "director");
  assert.deepEqual(codesOf(denied), ["FIELD_AUTHORITY"]);
  assert.equal(reg.checkOverride("db.backup_hours", 12, "human").ok, true);
  assert.deepEqual(codesOf(reg.checkOverride("db.backup_hours", 99, "human")), ["VALUE_OUT_OF_RANGE"]);
});

test("checkOverride refuses an unknown setting", () => {
  assert.deepEqual(codesOf(full().checkOverride("nope.nothing", 1, "human")), ["SETTING_UNKNOWN"]);
});

test("add-only list: removing a default member is refused, adding is accepted", () => {
  const reg = full();
  assert.deepEqual(codesOf(reg.checkOverride("rollback.excluded_kinds", ["lock"], "human")), [
    "VALUE_OUT_OF_RANGE",
  ]);
  assert.deepEqual(
    codesOf(reg.checkOverride("rollback.excluded_kinds", ["lock", "decision"].slice(1), "human")),
    ["VALUE_OUT_OF_RANGE"],
  );
  assert.equal(reg.checkOverride("rollback.excluded_kinds", ["lock", "decision", "claim"], "human").ok, true);
  assert.equal(reg.checkOverride("rollback.excluded_kinds", ["lock", "decision"], "human").ok, true);
  assert.deepEqual(
    codesOf(reg.checkOverride("rollback.excluded_kinds", ["lock", "decision", "claim"], "director")),
    ["FIELD_AUTHORITY"],
  );
});

test("keyed setting: one key overridden, the others keep their defaults", () => {
  const reg = full();
  assert.equal(reg.checkOverride("tool.result_max_tokens", 9000, "director", "project_read").ok, true);
  const layer = {
    source: "project.settings",
    form: "nested",
    values: { tool: { result_max_tokens: { project_read: 9000 } } },
  } as const;
  assert.deepEqual(reg.resolve("tool.result_max_tokens", [layer]), {
    ok: true,
    value: { default: 4000, project_read: 9000, web_fetch: 2000 },
  });
  assert.equal(
    settingPath("tool.result_max_tokens", "project_read"),
    "settings.tool.result_max_tokens.project_read",
  );
  assert.equal(settingPath("delivery.audio.loudness_lufs"), "settings.delivery.audio.loudness_lufs");
});

test("keyed setting: an unknown key is refused with the known keys as candidates, and range applies per key", () => {
  const reg = full();
  const unknown = reg.checkOverride("tool.result_max_tokens", 9000, "director", "nope");
  assert.deepEqual(codesOf(unknown), ["VALUE_OUT_OF_RANGE"]);
  if (!unknown.ok)
    assert.deepEqual(unknown.diagnostics[0]?.candidates, ["default", "project_read", "web_fetch"]);
  assert.deepEqual(codesOf(reg.checkOverride("tool.result_max_tokens", 100, "director", "web_fetch")), [
    "VALUE_OUT_OF_RANGE",
  ]);
  assert.deepEqual(codesOf(reg.checkOverride("tool.result_max_tokens", { web_fetch: 100 }, "director")), [
    "VALUE_OUT_OF_RANGE",
  ]);
  assert.deepEqual(codesOf(reg.checkOverride("tool.result_max_tokens", { nope: 1000 }, "director")), [
    "VALUE_OUT_OF_RANGE",
  ]);
  assert.equal(reg.checkOverride("tool.result_max_tokens", { web_fetch: 1000 }, "director").ok, true);
  assert.deepEqual(codesOf(reg.checkOverride("db.backup_hours", 3, "human", "x")), ["VALUE_OUT_OF_RANGE"]);
});

test("audit.retention_days accepts days and keep_all and refuses another word", () => {
  const reg = full();
  assert.equal(reg.checkOverride("audit.retention_days", 30, "human").ok, true);
  assert.equal(reg.checkOverride("audit.retention_days", "keep_all", "human").ok, true);
  assert.deepEqual(codesOf(reg.checkOverride("audit.retention_days", "forever", "human")), [
    "VALUE_OUT_OF_RANGE",
  ]);
  assert.deepEqual(codesOf(reg.checkOverride("audit.retention_days", 0, "human")), ["VALUE_OUT_OF_RANGE"]);
  assert.deepEqual(codesOf(reg.checkOverride("audit.retention_days", 1.5, "human")), ["VALUE_OUT_OF_RANGE"]);
});

test("an R9 setting set in both layers resolves to the Quality Intent's value", () => {
  const reg = new SettingsRegistry();
  assert.equal(reg.register("test", [num("review.hard_proof_votes", 3, 1, 9)]).ok, true);
  const project = {
    source: "project.settings",
    form: "nested",
    values: { review: { hard_proof_votes: 5 } },
  } as const;
  const intent = {
    source: "quality_intent.settings_overrides",
    form: "flat",
    values: { "review.hard_proof_votes": 7 },
  } as const;
  assert.deepEqual(reg.resolve("review.hard_proof_votes", [project, intent]), { ok: true, value: 7 });
});

test("boolean, enum and number-range types", () => {
  const reg = new SettingsRegistry();
  const r = reg.register("test", [
    {
      name: "x.flag",
      owner: "test",
      type: "boolean",
      default: true,
      override_by: "director",
      range: { kind: "boolean" },
    },
    {
      name: "x.mode",
      owner: "test",
      type: "string",
      default: "a",
      override_by: "director",
      range: { kind: "values", values: ["a", "b"] },
    },
    {
      name: "x.ratio",
      owner: "test",
      type: "number",
      default: 0.5,
      override_by: "director",
      range: { kind: "number_range", min: 0, max: 1 },
    },
  ]);
  assert.equal(r.ok, true);
  assert.equal(reg.checkOverride("x.flag", false, "director").ok, true);
  assert.deepEqual(codesOf(reg.checkOverride("x.flag", "no", "director")), ["VALUE_OUT_OF_RANGE"]);
  assert.deepEqual(codesOf(reg.checkOverride("x.mode", "c", "director")), ["VALUE_OUT_OF_RANGE"]);
  assert.equal(reg.checkOverride("x.ratio", 0.25, "director").ok, true);
  assert.deepEqual(codesOf(reg.checkOverride("x.ratio", Number.NaN, "director")), ["VALUE_OUT_OF_RANGE"]);
});

const contact: SettingRecord = {
  name: "fetch.contact_identity",
  owner: "test",
  type: "string",
  default: null,
  override_by: "human",
  range: { kind: "text", max_length: 8, pattern: "[a-z@.]+", optional: true },
};
const wake: SettingRecord = {
  name: "director.budget_wake_fractions",
  owner: "test",
  type: "number_list",
  default: [0.5, 0.8, 0.95],
  override_by: "director",
  range: { kind: "number_list", min: 0.01, max: 0.99, min_length: 1, max_length: 4, ascending: true },
};
const size: SettingRecord = {
  name: "screen_capture.viewport_px",
  owner: "test",
  type: "number_list",
  default: [1280, 800],
  override_by: "director",
  range: { kind: "number_list", min: 1, max: 100000, integer: true, min_length: 2, max_length: 2 },
};

test("text range: unset default, resolve returns null, text is length and pattern checked", () => {
  const reg = new SettingsRegistry();
  assert.equal(reg.register("test", [contact]).ok, true);
  const r = reg.resolve("fetch.contact_identity", []);
  assert.deepEqual(r.ok && r.value, null);
  const set = reg.resolve("fetch.contact_identity", [
    { source: "p", form: "nested", values: { fetch: { contact_identity: "a@b.co" } } },
  ]);
  assert.deepEqual(set.ok && set.value, "a@b.co");
  assert.equal(reg.checkOverride("fetch.contact_identity", "a@b.co", "human").ok, true);
  assert.equal(reg.checkOverride("fetch.contact_identity", null, "human").ok, true);
  assert.deepEqual(codesOf(reg.checkOverride("fetch.contact_identity", "a@b.co.uk.x", "human")), [
    "VALUE_OUT_OF_RANGE",
  ]);
  assert.deepEqual(codesOf(reg.checkOverride("fetch.contact_identity", "A B", "human")), [
    "VALUE_OUT_OF_RANGE",
  ]);
  assert.deepEqual(codesOf(reg.checkOverride("fetch.contact_identity", 5, "human")), ["VALUE_OUT_OF_RANGE"]);
});

test("null default is refused where the range is not optional", () => {
  const plain: SettingRecord = {
    ...contact,
    name: "x.text",
    range: { kind: "text", max_length: 8 },
  };
  assert.deepEqual(codesOf(new SettingsRegistry().register("test", [plain])), ["VALUE_OUT_OF_RANGE"]);
  const num = { ...num0(), default: null } as unknown as SettingRecord;
  assert.deepEqual(codesOf(new SettingsRegistry().register("test", [num])), ["VALUE_OUT_OF_RANGE"]);
});

function num0(): SettingRecord {
  return {
    name: "x.n",
    owner: "test",
    type: "integer",
    default: 1,
    override_by: "director",
    range: { kind: "number_range", min: 0, max: 5 },
  };
}

test("number_list range: length, element range, integers and ascending order", () => {
  const reg = new SettingsRegistry();
  assert.equal(reg.register("test", [wake, size]).ok, true);
  assert.equal(reg.checkOverride("director.budget_wake_fractions", [0.3, 0.6], "director").ok, true);
  for (const bad of [[], [0.1, 0.2, 0.3, 0.4, 0.5], [0, 0.5], [0.5, 1], [0.5, 0.5], [0.8, 0.5], ["a"], 0.5]) {
    assert.deepEqual(codesOf(reg.checkOverride("director.budget_wake_fractions", bad, "director")), [
      "VALUE_OUT_OF_RANGE",
    ]);
  }
  assert.equal(reg.checkOverride("screen_capture.viewport_px", [1080, 1920], "director").ok, true);
  for (const bad of [[1080], [1, 2, 3], [1080.5, 1920], [0, 5], [1080, 1e9]]) {
    assert.deepEqual(codesOf(reg.checkOverride("screen_capture.viewport_px", bad, "director")), [
      "VALUE_OUT_OF_RANGE",
    ]);
  }
  const outside = { ...size, name: "x.size", default: [1, 2, 3] };
  assert.deepEqual(codesOf(new SettingsRegistry().register("test", [outside])), ["VALUE_OUT_OF_RANGE"]);
});

test("malformed text and number_list ranges are incomplete records", () => {
  const badText = { ...contact, range: { kind: "text", max_length: 0 } } as unknown as SettingRecord;
  const badPattern = {
    ...contact,
    range: { kind: "text", max_length: 4, pattern: "(" },
  } as unknown as SettingRecord;
  const badList = {
    ...wake,
    range: { kind: "number_list", min: 1, max: 0, min_length: 1, max_length: 2 },
  } as unknown as SettingRecord;
  for (const r of [badText, badPattern, badList])
    assert.deepEqual(codesOf(new SettingsRegistry().register("test", [r])), ["SETTING_RECORD_INCOMPLETE"]);
});

test("list range min_length refuses a shorter list", () => {
  const rec: SettingRecord = {
    name: "voice.final_timing",
    owner: "test",
    type: "string_list",
    default: ["native", "aligned"],
    override_by: "human",
    range: { kind: "list", members: ["native", "aligned"], min_length: 1 },
  };
  const reg = new SettingsRegistry();
  assert.equal(reg.register("test", [rec]).ok, true);
  assert.equal(reg.checkOverride("voice.final_timing", ["aligned"], "human").ok, true);
  assert.deepEqual(codesOf(reg.checkOverride("voice.final_timing", [], "human")), ["VALUE_OUT_OF_RANGE"]);
});
