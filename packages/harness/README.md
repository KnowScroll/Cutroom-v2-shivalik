# @cutroom/harness

`ModelClient` and the MiniMax adapter, the Director loop, the tool catalogue and boundary, sub-loops, plugin registration and the audit log. It holds no authority: it calls the other modules and never writes their data directly (`lld/07` D10).

- **Entry point:** `packages/harness/src/index.ts`, built to `dist/src/index.js`. Other packages import only `@cutroom/harness`, never a file inside it.
- **Design:** `lld/07` (R6).
- **May import:** `@cutroom/foundations`, `@cutroom/project-core`, `@cutroom/compiler`, `@cutroom/scheduler`, `@cutroom/render`, `@cutroom/quality` (`tools/dependency-edges.json`).
- **Focused test command:** `npm test -w @cutroom/harness` (builds, then runs this package's unit tests; from the repository root).

## Capabilities

States: `planned`, `implemented`, `tested`, `render-verified`, `live-verified`.

| Capability                                          | Work package | State   |
| --------------------------------------------------- | ------------ | ------- |
| Record-and-replay transport, reply builders         | M4-01        | planned |
| `ModelClient` and the MiniMax adapter               | M4-02        | planned |
| Tool registry, plugin API, M4 catalogue             | M4-03        | planned |
| Tool boundary: validation and repair                | M4-05        | planned |
| Session runtime and Director loop                   | M4-06, M4-07 | planned |
| Sub-loops and workers (treatment, component author) | M4-10, M4-11 | planned |
| Settings catalogue (`src/settings.ts`, records of its stage) | M0-05 | tested |
