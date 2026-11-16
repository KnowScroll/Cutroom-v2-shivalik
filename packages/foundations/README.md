# @cutroom/foundations

Time in flicks, IDs and handles, hashing and canonical JSON, artifact references, work keys, failure classes, the evidence convention and the settings registry; `Predicate` and `Need`, whose meaning R5 keeps (B:SD1).

- **Entry point:** `packages/foundations/src/index.ts`, built to `dist/src/index.js`. Other packages import only `@cutroom/foundations`, never a file inside it.
- **Design:** `lld/02` (R1); `lld/04` §2.5, §2.7 (settings rule); `lld/06` §2.4 (`Predicate`, `Need`).
- **May import:** no other package (`tools/dependency-edges.json`).
- **Focused test command:** `npm test -w @cutroom/foundations` (builds, then runs this package's unit tests; from the repository root).

## Capabilities

States: `planned`, `implemented`, `tested`, `render-verified`, `live-verified`.

| Capability                                                   | Work package | State   |
| ------------------------------------------------------------ | ------------ | ------- |
| Flick time, rounding half up, `parseTime`, `formatTime`      | M0-02        | tested  |
| IDs (`newEntityId`, `newJobId`) and `isHandle`               | M0-02        | tested  |
| R1 vocabularies, `Predicate`, `Need`, `Diagnostic`, `Result` | M0-02        | tested  |
| Canonical JSON, `hashCanonical`, `ArtifactRef`, `workKey`    | M0-03        | tested  |
| `SettingsRegistry` with override levels, keyed values, text, unset and number-list ranges | M0-04, M0-05 | tested  |
| Settings catalogue of the package (`src/settings.ts`, empty: R1 owns no setting) | M0-05 | tested  |

## Settings registry (M0-04)

`new SettingsRegistry()` holds the named settings of every package (`src/settings/`). Persisted names are `snake_case`; a name is `area.snake_case` with two or more dot segments.

- `register(owner, records)` takes `SettingRecord {name, owner, type, default, override_by, range, note?}` all or none, and returns `{ok, value}` or `{ok: false, diagnostics}`. It refuses: a missing `override_by` or `range` (`SETTING_RECORD_INCOMPLETE`), a bad name (`SETTING_NAME_INVALID`), a duplicate (`SETTING_DUPLICATE`), a name that is a dot-segment prefix of another (`SETTING_NAME_PREFIX`, B:O8a) and a default outside its range or a keyed default lacking a key (`VALUE_OUT_OF_RANGE`).
- Types and ranges: `number` and `integer` with `{kind: "number_range", min, max}`; `string` with `{kind: "values", values}`; `boolean`; `string_list` with `{kind: "list", members?, add_only?}`; `integer_or_string` with `{kind: "any_of", parts}` (`audit.retention_days`: an integer range plus `keep_all`); `keyed` with `{kind: "keyed", keys: {key: {type, range}}}` and a default object holding every key (A:M0-3).
- Range forms added by B2 (M0-05): `string` with `{kind: "text", max_length, pattern?, optional?}` (free text; `pattern` must match the whole value); `number_list` (type `number_list`) with `{kind: "number_list", min, max, integer?, min_length, max_length, ascending?, optional?}` (strictly ascending when `ascending`). An unset default is `default: null`, allowed only where the range has `optional: true` (otherwise `register` returns `VALUE_OUT_OF_RANGE`); `resolve` returns `null` when no layer overrides it, and a layer may set `null` on an optional setting.
- `get(name)`, `list(owner?)` (name order).
- `checkOverride(name, value, writer_level, key?)`: `FIELD_AUTHORITY` for a `director` writer on a `human` setting (wherever it is written, G21), then `VALUE_OUT_OF_RANGE`. For a keyed setting pass `key` with that key's value, or an object of keys without `key`. An `add_only` list must keep every default member.
- `resolve(name, layers)`: default, then each layer in order, later wins; pass `project.settings` as `{source, form: "nested", values}` and `quality_intent.settings_overrides` as `{source, form: "flat", values}`, in that order (A:M0-11). Keyed values merge key by key. It checks ranges, not authority.
- `settingPath(name, key?)` gives the patch path (`settings.tool.result_max_tokens.project_read`).
- `SETTINGS_CODES` lists the codes; failures use the shared `Diagnostic` and `Result`.
