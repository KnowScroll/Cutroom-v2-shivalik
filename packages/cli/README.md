# @cutroom/cli

The command-line entry point: `cutroom new | run | status | stop`, the Space socket and the `ControlApi`.

- **Entry point:** `packages/cli/src/index.ts`, built to `dist/src/index.js`. Other packages import only `@cutroom/cli`, never a file inside it.
- **Design:** `lld/07` D12.
- **May import:** `@cutroom/foundations`, `@cutroom/project-core`, `@cutroom/compiler`, `@cutroom/scheduler`, `@cutroom/render`, `@cutroom/harness`, `@cutroom/studio`, `@cutroom/quality` (`tools/dependency-edges.json`).
- **Focused test command:** `npm test -w @cutroom/cli` (builds, then runs this package's unit tests; from the repository root).

## Capabilities

States: `planned`, `implemented`, `tested`, `render-verified`, `live-verified`.

| Capability                       | Work package | State   |
| -------------------------------- | ------------ | ------- |
| CLI skeleton and Space lifecycle | M0-10        | planned |
| Director loop wiring             | M4-07        | planned |
