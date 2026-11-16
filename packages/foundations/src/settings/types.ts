// Design: lld/04 §2.7 and §5 (setting records, ranges), lld/11 A:M0-3 (keyed values, integer-or-listed ranges)

/** Who may write an override: `human` or `director` (G15). A worker acts within the Director's level. */
export type OverrideLevel = "human" | "director";
export type WriterLevel = OverrideLevel;

/** The type of one value. `integer_or_string` is the A:M0-3 form (`audit.retention_days`: days or `keep_all`). */
export type ScalarType =
  | "number"
  | "integer"
  | "string"
  | "boolean"
  | "string_list"
  | "integer_or_string"
  | "number_list";
export type SettingType = ScalarType | "keyed";

export type ScalarValue = number | string | boolean | readonly string[] | readonly number[];
/** `null` is the unset default of a setting whose range is marked `optional` (B2). */
export type SettingValue = ScalarValue | null | Readonly<Record<string, ScalarValue>>;

/** Inclusive numeric bounds. `type: integer` additionally requires a whole number. */
export type NumberRange = { readonly kind: "number_range"; readonly min: number; readonly max: number };
/** A closed list of allowed string values. */
export type ValuesRange = { readonly kind: "values"; readonly values: readonly string[] };
/**
 * Free text for `type: "string"` (B2): at most `max_length` characters, the whole value matching `pattern`
 * (a regular expression source) when given. `optional: true` allows the unset default `null`.
 */
export type TextRange = {
  readonly kind: "text";
  readonly max_length: number;
  readonly pattern?: string;
  readonly optional?: boolean;
};
/**
 * A list of numbers for `type: "number_list"` (B2): each element within `min` to `max` (whole numbers when
 * `integer`), between `min_length` and `max_length` elements, strictly ascending when `ascending`.
 */
export type NumberListRange = {
  readonly kind: "number_list";
  readonly min: number;
  readonly max: number;
  readonly integer?: boolean;
  readonly min_length: number;
  readonly max_length: number;
  readonly ascending?: boolean;
  readonly optional?: boolean;
};
export type BooleanRange = { readonly kind: "boolean" };
/**
 * A list of strings. `members` limits what it may hold (omitted: any string). `add_only` means an
 * override must keep every member of the default and may only add (`rollback.excluded_kinds`).
 */
export type ListRange = {
  readonly kind: "list";
  readonly members?: readonly string[];
  readonly add_only?: boolean;
  /** At least this many members (B2 review: `voice.final_timing` may not be empty). */
  readonly min_length?: number;
};
/** A value accepted if any part accepts it, such as an integer range or listed values. */
export type AnyOfRange = { readonly kind: "any_of"; readonly parts: readonly (NumberRange | ValuesRange)[] };

export type ScalarRange =
  | NumberRange
  | ValuesRange
  | TextRange
  | NumberListRange
  | BooleanRange
  | ListRange
  | AnyOfRange;

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
