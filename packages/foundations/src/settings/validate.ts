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
];

const RANGE_KINDS_FOR_TYPE: Record<ScalarType, readonly string[]> = {
  number: ["number_range"],
  integer: ["number_range"],
  string: ["values"],
  boolean: ["boolean"],
  string_list: ["list"],
  integer_or_string: ["any_of"],
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
    case "boolean":
      return "true or false";
    case "list":
      return range.members ? `a list of ${range.members.join(", ")}` : "a list of strings";
    case "any_of":
      return range.parts.map(describeRange).join(" or ");
  }
}

function acceptsScalar(type: ScalarType, range: ScalarRange, value: unknown): boolean {
  switch (range.kind) {
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
