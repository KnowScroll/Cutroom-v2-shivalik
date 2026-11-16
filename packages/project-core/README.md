# @cutroom/project-core

Entity schemas, patches and validation, write authority, revisions, branches, merge, promotion, views, the storage adapter over `node:sqlite` and the blob store.

- **Entry point:** `packages/project-core/src/index.ts`, built to `dist/src/index.js`. Other packages import only `@cutroom/project-core`, never a file inside it.
- **Design:** `lld/04` (R3).
- **May import:** `@cutroom/foundations`, `@cutroom/render` (`tools/dependency-edges.json`).
- **Focused test command:** `npm test -w @cutroom/project-core` (builds, then runs this package's unit tests; from the repository root).

## Capabilities

States: `planned`, `implemented`, `tested`, `render-verified`, `live-verified`.

| Capability                                                      | Work package   | State   |
| --------------------------------------------------------------- | -------------- | ------- |
| Storage adapter, grouped commits, migrations, Space mount check | M0-06          | planned |
| Blob store (`ingest`, `open`, `sweep`)                          | M0-07          | planned |
| Revision store and the accepted-head swap                       | M0-08          | planned |
| Entity schemas, write levels, kind descriptions                 | M2-01          | planned |
| Patch envelope, authority, invariants, branches, merge          | M2-03 to M2-06 | planned |
| Views and `project_find`                                        | M4-08a         | planned |
