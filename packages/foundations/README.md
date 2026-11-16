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
| Canonical JSON, `hashCanonical`, `ArtifactRef`, `workKey`    | M0-03        | planned |
| `SettingsRegistry` with override levels and keyed values     | M0-04        | planned |
| Settings catalogue of the package (`src/settings.ts`)        | M0-05        | planned |
