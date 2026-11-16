# @cutroom/project-core

Entity schemas, patches and validation, write authority, revisions, branches, merge, promotion, views, the storage adapter over `node:sqlite` and the blob store.

- **Entry point:** `packages/project-core/src/index.ts`, built to `dist/src/index.js`. Other packages import only `@cutroom/project-core`, never a file inside it.
- **Design:** `lld/04` (R3).
- **May import:** `@cutroom/foundations`, `@cutroom/render` (`tools/dependency-edges.json`).
- **Focused test command:** `npm test -w @cutroom/project-core` (builds, then runs this package's unit tests; from the repository root).

## Storage notes

- Grouped writer members are synchronous functions and cannot nest: a `tx` call from inside a member is rejected.
- Deferred constraints are not supported inside members. A failure at `COMMIT` rejects every member of the group (the transaction is rolled back and the writer carries on), so every caller must be able to repeat a request (R5 section 2.1).
- `openDatabase` does not check the mount; start-up (M0-10) calls `checkSpaceMount` first.
- `DB_DAMAGED` is returned only for corruption (SQLite result codes 11 and 26, extended codes included); any other error from `quick_check`, such as busy, is thrown.

## Capabilities

States: `planned`, `implemented`, `tested`, `render-verified`, `live-verified`.

| Capability                                                      | Work package   | State   |
| --------------------------------------------------------------- | -------------- | ------- |
| Storage adapter, grouped commits, migrations, Space mount check | M0-06          | tested  |
| Blob store (`ingest`, `open`, `sweep`)                          | M0-07          | planned |
| Revision store and the accepted-head swap                       | M0-08          | planned |
| Entity schemas, write levels, kind descriptions                 | M2-01          | planned |
| Patch envelope, authority, invariants, branches, merge          | M2-03 to M2-06 | planned |
| Views and `project_find`                                        | M4-08a         | planned |
| Settings catalogue (`src/settings.ts`, records of its stage) | M0-05 | tested |
