# @cutroom/quality

The check runner, the check catalogue, the Reviewer protocol, Quality Intent rules, completion state and the deliverable record.

- **Entry point:** `packages/quality/src/index.ts`, built to `dist/src/index.js`. Other packages import only `@cutroom/quality`, never a file inside it.
- **Design:** `lld/09` (R9).
- **May import:** `@cutroom/foundations`, `@cutroom/project-core`, `@cutroom/compiler`, `@cutroom/scheduler`, `@cutroom/render`, `@cutroom/harness`, `@cutroom/studio` (`tools/dependency-edges.json`).
- **Focused test command:** `npm test -w @cutroom/quality` (builds, then runs this package's unit tests; from the repository root).

## Capabilities

States: `planned`, `implemented`, `tested`, `render-verified`, `live-verified`.

| Capability                                          | Work package   | State   |
| --------------------------------------------------- | -------------- | ------- |
| Check runner (`register_check`)                     | M3-07          | planned |
| Final-file audio and transcript checks              | M5-08, M5-09   | planned |
| Probe checks, film detectors, lineage checks        | M6-01 to M6-03 | planned |
| R-01, F-06, evidence forms and the pinned bundle    | M6-04a, M6-05  | planned |
| Review policy, completion state, deliverable record | M6-07, M6-08   | planned |
