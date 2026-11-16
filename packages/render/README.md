# @cutroom/render

Runtime shim, sealer, host page, capture engine, encode and join, mux, the component validation functions and the preview rungs.

- **Entry point:** `packages/render/src/index.ts`, built to `dist/src/index.js`. Other packages import only `@cutroom/render`, never a file inside it.
- **Design:** `lld/03` (R2).
- **May import:** `@cutroom/foundations` (`tools/dependency-edges.json`).
- **Focused test command:** `npm test -w @cutroom/render` (builds, then runs this package's unit tests; from the repository root).

## Capabilities

States: `planned`, `implemented`, `tested`, `render-verified`, `live-verified`.

| Capability                                                       | Work package | State   |
| ---------------------------------------------------------------- | ------------ | ------- |
| Component contract, `meta`, `Control`, `ProbeItem`, render input | M1-01        | planned |
| Runtime shim and sealer                                          | M1-02        | planned |
| Host page and capture engine                                     | M1-03, M1-04 | planned |
| Segment encoder, `film.concat`, `film.mux`                       | M1-05        | planned |
| `chunk.render`, `still.render`, preview rungs                    | M1-06        | planned |
| Validation ladder V0 to V6                                       | M1-07, M1-08 | planned |
