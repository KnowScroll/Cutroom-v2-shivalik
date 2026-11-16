// Design: lld/04 §2.7 and §5 (setting records, ranges), lld/11 A:M0-3 (keyed values, integer-or-listed ranges)

/** Who may write an override: `human` or `director` (G15). A worker acts within the Director's level. */
export type OverrideLevel = "human" | "director";
export type WriterLevel = OverrideLevel;

/** The type of one value. `integer_or_string` is the A:M0-3 form (`audit.retention_days`: days or `keep_all`). */
export type ScalarType = "number" | "integer" | "string" | "boolean" | "string_list" | "integer_or_string";
export type SettingType = ScalarType | "keyed";

export type ScalarValue = number | string | boolean | readonly string[];
export type SettingValue = ScalarValue | Readonly<Record<string, ScalarValue>>;

/** Inclusive numeric bounds. `type: integer` additionally requires a whole number. */
export type NumberRange = { readonly kind: "number_range"; readonly min: number; readonly max: number };
/** A closed list of allowed string values. */
export type ValuesRange = { readonly kind: "values"; readonly values: readonly string[] };
export type BooleanRange = { readonly kind: "boolean" };
/**
 * A list of strings. `members` limits what it may hold (omitted: any string). `add_only` means an
 * override must keep every member of the default and may only add (`rollback.excluded_kinds`).
 */
export type ListRange = {
  readonly kind: "list";
  readonly members?: readonly string[];
  readonly add_only?: boolean;
};
/** A value accepted if any part accepts it, such as an integer range or listed values. */
export type AnyOfRange = { readonly kind: "any_of"; readonly parts: readonly (NumberRange | ValuesRange)[] };

export type ScalarRange = NumberRange | ValuesRange | BooleanRange | ListRange | AnyOfRange;

/** One key of a keyed value: its own type and range (A:M0-3). */
export type KeySpec = { readonly type: ScalarType; readonly range: ScalarRange };
/** A keyed value: the owner fixes the set of keys; each key has its own type and range. */
export type KeyedRange = { readonly kind: "keyed"; readonly keys: Readonly<Record<string, KeySpec>> };

export type SettingRange = ScalarRange | KeyedRange;

export type SettingRecord = {
  readonly name: string;
  readonly owner: string;
  readonly type: SettingType;
  readonly default: SettingValue;
  readonly override_by: OverrideLevel;
  readonly range: SettingRange;
  readonly note?: string;
};

/**
 * One override layer. `nested` is the stored form of `project.settings` (every dot segment of the name is a
 * level); `flat` is `quality_intent.settings_overrides` (`{ "setting.name": value }`).
 */
export type SettingsLayer = {
  readonly source: string;
  readonly form: "nested" | "flat";
  readonly values: Readonly<Record<string, unknown>>;
};
