// Design: lld/04 §2.7 (ranges), lld/11 A:M0-3 (keyed values, integer-or-listed ranges), G15 (range required)
import type { Diagnostic } from "../vocab/diagnostic.js";
import type { ScalarRange, ScalarType, SettingRange, SettingType } from "./types.js";

export const SCALAR_TYPES: readonly ScalarType[] = [
  "number",
  "integer",
  "string",
  "boolean",
  "string_list",
  "integer_or_string",
  "number_list",
];

const RANGE_KINDS_FOR_TYPE: Record<ScalarType, readonly string[]> = {
  number: ["number_range"],
  integer: ["number_range"],
  string: ["values", "text"],
  boolean: ["boolean"],
  string_list: ["list"],
  integer_or_string: ["any_of"],
  number_list: ["number_list"],
};

export function isScalarType(t: unknown): t is ScalarType {
  return typeof t === "string" && (SCALAR_TYPES as readonly string[]).includes(t);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Describes a range for the `expected` field of a diagnostic. */
export function describeRange(range: ScalarRange): string {
  switch (range.kind) {
    case "number_range":
      return `${range.min} to ${range.max}`;
    case "values":
      return `one of ${range.values.join(", ")}`;
    case "text":
      return `text of at most ${range.max_length} characters${range.pattern === undefined ? "" : ` matching ${range.pattern}`}`;
    case "number_list":
      return `${range.min_length} to ${range.max_length} ${range.integer === true ? "whole numbers" : "numbers"} in ${range.min} to ${range.max}${range.ascending === true ? ", ascending" : ""}`;
    case "boolean":
      return "true or false";
    case "list":
      return range.members ? `a list of ${range.members.join(", ")}` : "a list of strings";
    case "any_of":
      return range.parts.map(describeRange).join(" or ");
  }
}

function acceptsScalar(type: ScalarType, range: ScalarRange, value: unknown): boolean {
  if (value === null) return "optional" in range && range.optional === true;
  switch (range.kind) {
    case "text":
      return (
        typeof value === "string" &&
        value.length <= range.max_length &&
        (range.pattern === undefined || new RegExp(`^(?:${range.pattern})$`, "u").test(value))
      );
    case "number_list": {
      if (!Array.isArray(value)) return false;
      if (value.length < range.min_length || value.length > range.max_length) return false;
      const inRange = value.every(
        (n) =>
          typeof n === "number" &&
          Number.isFinite(n) &&
          (range.integer !== true || Number.isInteger(n)) &&
          n >= range.min &&
          n <= range.max,
      );
      if (!inRange) return false;
      return range.ascending !== true || value.every((n, i) => i === 0 || n > value[i - 1]);
    }
    case "number_range":
      return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        (type !== "integer" || Number.isInteger(value)) &&
        value >= range.min &&
        value <= range.max
      );
    case "values":
      return typeof value === "string" && range.values.includes(value);
    case "boolean":
      return typeof value === "boolean";
    case "list": {
      if (!Array.isArray(value)) return false;
      const members = range.members;
      if (range.min_length !== undefined && value.length < range.min_length) return false;
      return value.every((m) => typeof m === "string" && (members === undefined || members.includes(m)));
    }
    case "any_of":
      // In an any_of, a number part always means whole days/counts only when the type says integer; the
      // mixed type is "integer_or_string", so its number part is an integer.
      return range.parts.some((p) =>
        p.kind === "number_range"
          ? typeof value === "number" && Number.isInteger(value) && acceptsScalar("number", p, value)
          : acceptsScalar("string", p, value),
      );
  }
}

/** Checks one scalar value against its type and range. Empty result means accepted. */
export function validateScalar(
  type: ScalarType,
  range: ScalarRange,
  value: unknown,
  path: string,
): Diagnostic[] {
  if (acceptsScalar(type, range, value)) return [];
  return [{ code: "VALUE_OUT_OF_RANGE", path, expected: describeRange(range), got: value }];
}

/** Checks a whole value, keyed or not. A keyed value must name only known keys; it may omit keys. */
export function validateValue(
  type: SettingType,
  range: SettingRange,
  value: unknown,
  path: string,
  options: { requireAllKeys?: boolean } = {},
): Diagnostic[] {
  if (type !== "keyed") {
    if (range.kind === "keyed") return [{ code: "VALUE_OUT_OF_RANGE", path, got: value }];
    return validateScalar(type, range, value, path);
  }
  if (range.kind !== "keyed") return [{ code: "VALUE_OUT_OF_RANGE", path, got: value }];
  const keys = Object.keys(range.keys).sort();
  if (!isRecord(value)) {
    return [
      { code: "VALUE_OUT_OF_RANGE", path, expected: `an object with keys ${keys.join(", ")}`, got: value },
    ];
  }
  const out: Diagnostic[] = [];
  for (const key of Object.keys(value).sort()) {
    const spec = range.keys[key];
    if (spec === undefined) {
      out.push({
        code: "VALUE_OUT_OF_RANGE",
        path: `${path}.${key}`,
        expected: "a known key",
        got: key,
        candidates: keys,
      });
      continue;
    }
    out.push(...validateScalar(spec.type, spec.range, value[key], `${path}.${key}`));
  }
  if (options.requireAllKeys) {
    for (const key of keys) {
      if (!(key in value))
        out.push({
          code: "VALUE_OUT_OF_RANGE",
          path: `${path}.${key}`,
          expected: "a value for every key",
          got: undefined,
        });
    }
  }
  return out;
}

/** Reports why a range is not well formed for its type, or undefined when it is. */
export function rangeProblem(type: SettingType, range: unknown): string | undefined {
  if (!isRecord(range) || typeof range.kind !== "string") return "range is missing";
  if (type === "keyed") {
    if (range.kind !== "keyed") return "a keyed setting needs a keyed range";
    const keys = range.keys;
    if (!isRecord(keys) || Object.keys(keys).length === 0) return "a keyed range needs at least one key";
    for (const [key, spec] of Object.entries(keys)) {
      if (!/^[a-z][a-z0-9_]*$/.test(key)) return `key ${key} is not snake_case without dots`;
      if (!isRecord(spec) || !isScalarType(spec.type)) return `key ${key} needs a scalar type`;
      const p = rangeProblem(spec.type, spec.range);
      if (p) return `key ${key}: ${p}`;
    }
    return undefined;
  }
  if (!isScalarType(type)) return `unknown type ${String(type)}`;
  if (!RANGE_KINDS_FOR_TYPE[type].includes(range.kind))
    return `range kind ${range.kind} does not fit type ${type}`;
  switch (range.kind) {
    case "number_range":
      if (
        typeof range.min !== "number" ||
        typeof range.max !== "number" ||
        !Number.isFinite(range.min) ||
        !Number.isFinite(range.max) ||
        range.min > range.max
      )
        return "number range needs finite min <= max";
      return undefined;
    case "values":
      return Array.isArray(range.values) && range.values.length > 0
        ? undefined
        : "values range needs a non-empty list";
    case "text":
      if (!Number.isInteger(range.max_length) || (range.max_length as number) < 1)
        return "text needs an integer max_length of at least 1";
      if (range.pattern !== undefined) {
        try {
          new RegExp(`^(?:${String(range.pattern)})$`, "u");
        } catch {
          return "text pattern is not a regular expression";
        }
      }
      return undefined;
    case "number_list":
      if (
        typeof range.min !== "number" ||
        typeof range.max !== "number" ||
        !Number.isFinite(range.min) ||
        !Number.isFinite(range.max) ||
        range.min > range.max
      )
        return "number_list needs finite min <= max";
      if (
        !Number.isInteger(range.min_length) ||
        !Number.isInteger(range.max_length) ||
        (range.min_length as number) < 0 ||
        (range.min_length as number) > (range.max_length as number)
      )
        return "number_list needs integer lengths with 0 <= min_length <= max_length";
      return undefined;
    case "list":
      return range.members === undefined || (Array.isArray(range.members) && range.members.length > 0)
        ? undefined
        : "list members must be non-empty when given";
    case "any_of": {
      const parts = range.parts;
      if (!Array.isArray(parts) || parts.length === 0) return "any_of needs parts";
      for (const part of parts) {
        const p = rangeProblem(isRecord(part) && part.kind === "number_range" ? "number" : "string", part);
        if (p) return p;
      }
      return undefined;
    }
    default:
      return undefined;
  }
}
