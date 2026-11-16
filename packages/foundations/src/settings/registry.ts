// Design: lld/04 §2.7 and §5 (settings), lld/11 G15, G21, A:M0-3, A:M0-11, B:O8a (registry, override check, layers)

import { type Diagnostic, fail, type Result } from "../vocab/diagnostic.js";
import type { ScalarValue, SettingRecord, SettingsLayer, SettingValue, WriterLevel } from "./types.js";
import { rangeProblem, validateScalar, validateValue } from "./validate.js";

const NAME_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** The `project.settings` patch path of a setting, plus its key when the value is keyed (B:O8a, A:M0-3). */
export function settingPath(name: string, key?: string): string {
  return key === undefined ? `settings.${name}` : `settings.${name}.${key}`;
}

function clone<T>(v: T): T {
  return structuredClone(v);
}

export class SettingsRegistry {
  private readonly records = new Map<string, SettingRecord>();

  /**
   * Registers a package's settings, all or none. Refuses a record without `override_by` or `range`, a
   * duplicate, a name that is not `area.snake_case`, a default outside its range, and a name that is a
   * prefix of another by dot-separated segments (so a value and a map never share a key).
   */
  register(owner: string, records: readonly SettingRecord[]): Result<readonly SettingRecord[]> {
    const problems: Diagnostic[] = [];
    const accepted: SettingRecord[] = [];
    const taken = new Set<string>(this.records.keys());
    if (typeof owner !== "string" || owner === "") {
      problems.push({
        code: "SETTING_RECORD_INCOMPLETE",
        path: "owner",
        expected: "a non-empty owner",
        got: owner,
      });
    }
    for (const rec of records) {
      const raw: Record<string, unknown> = { ...rec };
      const name = typeof raw.name === "string" ? raw.name : "";
      const at = name === "" ? "settings" : name;
      if (!NAME_RE.test(name)) {
        problems.push({ code: "SETTING_NAME_INVALID", path: at, expected: "area.snake_case", got: raw.name });
        continue;
      }
      if (raw.owner !== owner) {
        problems.push({
          code: "SETTING_RECORD_INCOMPLETE",
          path: at,
          expected: `owner ${owner}`,
          got: raw.owner,
        });
        continue;
      }
      if (raw.override_by !== "human" && raw.override_by !== "director") {
        problems.push({
          code: "SETTING_RECORD_INCOMPLETE",
          path: at,
          expected: "override_by: human|director",
          got: raw.override_by,
        });
        continue;
      }
      if (raw.range === undefined || raw.range === null) {
        problems.push({ code: "SETTING_RECORD_INCOMPLETE", path: at, expected: "a range", got: raw.range });
        continue;
      }
      if (typeof raw.type !== "string" || raw.default === undefined) {
        problems.push({
          code: "SETTING_RECORD_INCOMPLETE",
          path: at,
          expected: "a type and a default",
          got: raw.type,
        });
        continue;
      }
      const bad = rangeProblem(rec.type, rec.range);
      if (bad !== undefined) {
        problems.push({ code: "SETTING_RECORD_INCOMPLETE", path: at, expected: bad, got: rec.range });
        continue;
      }
      if (taken.has(name)) {
        problems.push({ code: "SETTING_DUPLICATE", path: at, got: name });
        continue;
      }
      const clash = [...taken].find((other) => other.startsWith(`${name}.`) || name.startsWith(`${other}.`));
      if (clash !== undefined) {
        problems.push({
          code: "SETTING_NAME_PREFIX",
          path: at,
          expected: "no name that is a dot-segment prefix of another",
          got: name,
          candidates: [clash],
        });
        continue;
      }
      const outside = validateValue(rec.type, rec.range, rec.default, at, { requireAllKeys: true });
      if (outside.length > 0) {
        problems.push(...outside);
        continue;
      }
      taken.add(name);
      accepted.push(clone(rec));
    }
    if (problems.length > 0) return fail(...problems);
    for (const rec of accepted) this.records.set(rec.name, rec);
    return { ok: true, value: accepted };
  }

  get(name: string): SettingRecord | undefined {
    return this.records.get(name);
  }

  /** Every record, or one owner's, in name order. */
  list(owner?: string): readonly SettingRecord[] {
    return [...this.records.values()]
      .filter((r) => owner === undefined || r.owner === owner)
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }

  /**
   * May this writer set this value? A `human` setting written by a `director` is FIELD_AUTHORITY, wherever the
   * override is written (G21); then the value must lie in the range (VALUE_OUT_OF_RANGE). For a keyed
   * setting, `key` names the one key written (`value` is that key's value); without `key`, `value` is an
   * object of keys. An add-only list refuses an override that drops a default member.
   */
  checkOverride(name: string, value: unknown, writer_level: WriterLevel, key?: string): Result<undefined> {
    const rec = this.records.get(name);
    if (rec === undefined) {
      return fail({
        code: "SETTING_UNKNOWN",
        path: settingPath(name, key),
        got: name,
        candidates: this.nearest(name),
      });
    }
    const path = settingPath(name, key);
    if (rec.override_by === "human" && writer_level !== "human") {
      return fail({ code: "FIELD_AUTHORITY", path, expected: "level human", got: writer_level });
    }
    let problems: Diagnostic[];
    if (key !== undefined) {
      if (rec.type !== "keyed" || rec.range.kind !== "keyed") {
        return fail({ code: "VALUE_OUT_OF_RANGE", path, expected: "a setting that is not keyed", got: key });
      }
      const spec = rec.range.keys[key];
      problems =
        spec === undefined
          ? [
              {
                code: "VALUE_OUT_OF_RANGE",
                path,
                expected: "a known key",
                got: key,
                candidates: Object.keys(rec.range.keys).sort(),
              },
            ]
          : [
              ...validateScalar(spec.type, spec.range, value, path),
              ...this.addOnly(spec.range, rec, path, value, key),
            ];
    } else {
      problems = validateValue(rec.type, rec.range, value, path);
      if (problems.length === 0 && rec.type !== "keyed") {
        problems = this.addOnly(rec.range, rec, path, value);
      }
      if (problems.length === 0 && rec.type === "keyed" && isRecord(value) && rec.range.kind === "keyed") {
        for (const [k, v] of Object.entries(value)) {
          const spec = rec.range.keys[k];
          if (spec) problems.push(...this.addOnly(spec.range, rec, `${path}.${k}`, v, k));
        }
      }
    }
    return problems.length > 0 ? fail(...problems) : { ok: true, value: undefined };
  }

  /**
   * The effective value: the registered default, then each layer in order, the later winning (default,
   * `project.settings`, `quality_intent.settings_overrides`; A:M0-11). A keyed value merges key by key.
   * It validates ranges, not authority; authority is `checkOverride`'s job at the write.
   */
  resolve(name: string, layers: readonly SettingsLayer[]): Result<SettingValue> {
    const rec = this.records.get(name);
    if (rec === undefined) {
      return fail({
        code: "SETTING_UNKNOWN",
        path: settingPath(name),
        got: name,
        candidates: this.nearest(name),
      });
    }
    let value: SettingValue = clone(rec.default);
    for (const layer of layers) {
      const found = this.fromLayer(name, layer);
      if (found === undefined) continue;
      const bad = validateValue(rec.type, rec.range, found, `${layer.source}:${name}`);
      if (bad.length > 0) return fail(...bad);
      if (rec.type === "keyed" && isRecord(value) && isRecord(found)) {
        value = { ...value, ...(clone(found) as Record<string, ScalarValue>) };
      } else {
        value = clone(found as SettingValue);
      }
    }
    return { ok: true, value };
  }

  private addOnly(
    range: { readonly kind: string; readonly add_only?: boolean },
    rec: SettingRecord,
    path: string,
    value: unknown,
    key?: string,
  ): Diagnostic[] {
    if (range.kind !== "list" || range.add_only !== true || !Array.isArray(value)) return [];
    const base =
      key === undefined
        ? rec.default
        : isRecord(rec.default)
          ? (rec.default as Record<string, ScalarValue>)[key]
          : undefined;
    if (!Array.isArray(base)) return [];
    const missing = base.filter((m) => !value.includes(m));
    if (missing.length === 0) return [];
    return [
      {
        code: "VALUE_OUT_OF_RANGE",
        path,
        expected: `a list that keeps ${missing.join(", ")} (add-only)`,
        got: value,
      },
    ];
  }

  private fromLayer(name: string, layer: SettingsLayer): unknown {
    if (layer.form === "flat") return layer.values[name];
    let node: unknown = layer.values;
    for (const segment of name.split(".")) {
      if (!isRecord(node) || !(segment in node)) return undefined;
      node = node[segment];
    }
    return node;
  }

  private nearest(name: string): readonly string[] {
    const area = name.split(".")[0];
    const sameArea = [...this.records.keys()].filter((n) => n.split(".")[0] === area);
    return (sameArea.length > 0 ? sameArea : [...this.records.keys()]).sort().slice(0, 5);
  }
}
