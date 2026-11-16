# @cutroom/compiler

The compile passes, the timing solver, the Render Plan, work keys, `plan_diff` and `timing_explain`.

- **Entry point:** `packages/compiler/src/index.ts`, built to `dist/src/index.js`. Other packages import only `@cutroom/compiler`, never a file inside it.
- **Design:** `lld/05` (R4).
- **May import:** `@cutroom/foundations`, `@cutroom/project-core`, `@cutroom/render` (`tools/dependency-edges.json`).
- **Focused test command:** `npm test -w @cutroom/compiler` (builds, then runs this package's unit tests; from the repository root).

## Capabilities

States: `planned`, `implemented`, `tested`, `render-verified`, `live-verified`.

| Capability                                                       | Work package | State   |
| ---------------------------------------------------------------- | ------------ | ------- |
| Timing solver and timing pass                                    | M2-07        | planned |
| Compiler front end: request, facts, resolve, validate, readiness | M2-08        | planned |
| Track evaluator, camera, render units                            | M2-09        | planned |
| Staging, declarations, chunks, work keys, emit, `plan_diff`      | M2-10        | planned |
