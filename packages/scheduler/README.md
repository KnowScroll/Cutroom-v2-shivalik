# @cutroom/scheduler

Jobs, the work-key cache, futures, resource pools, intents and reconciliation, the budget ledger and `plan_to_jobs`.

- **Entry point:** `packages/scheduler/src/index.ts`, built to `dist/src/index.js`. Other packages import only `@cutroom/scheduler`, never a file inside it.
- **Design:** `lld/06` (R5).
- **May import:** `@cutroom/foundations`, `@cutroom/project-core`, `@cutroom/compiler`, `@cutroom/render` (`tools/dependency-edges.json`).
- **Focused test command:** `npm test -w @cutroom/scheduler` (builds, then runs this package's unit tests; from the repository root).

## Capabilities

States: `planned`, `implemented`, `tested`, `render-verified`, `live-verified`.

| Capability                                               | Work package | State   |
| -------------------------------------------------------- | ------------ | ------- |
| Scheduler store, single instance, grouped writer, events | M3-01        | planned |
| Jobs, work-key cache, futures, `plan_to_jobs`            | M3-02        | planned |
| Readiness, attempts, executors, dispatch                 | M3-03        | planned |
| Resource pools and limiters                              | M3-04        | planned |
| Budget ledger and the paid-call protocol                 | M3-05        | planned |
| Cancellation, supersession, restart recovery             | M3-06        | planned |
| Settings catalogue (`src/settings.ts`, records of its stage) | M0-05 | tested |
