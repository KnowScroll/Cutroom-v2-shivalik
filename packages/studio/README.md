# @cutroom/studio

Audio adapters and mastering, captions, character controls and performance, media, research, charts and capture.

- **Entry point:** `packages/studio/src/index.ts`, built to `dist/src/index.js`. Other packages import only `@cutroom/studio`, never a file inside it.
- **Design:** `lld/08` (R7).
- **May import:** `@cutroom/foundations`, `@cutroom/project-core`, `@cutroom/compiler`, `@cutroom/scheduler`, `@cutroom/render`, `@cutroom/harness` (`tools/dependency-edges.json`).
- **Focused test command:** `npm test -w @cutroom/studio` (builds, then runs this package's unit tests; from the repository root).

## Capabilities

States: `planned`, `implemented`, `tested`, `render-verified`, `live-verified`.

| Capability                                             | Work package | State   |
| ------------------------------------------------------ | ------------ | ------- |
| Audio foundations, adapter families, formatter, tokens | M5-01        | planned |
| Voice adapter: Kokoro-82M through OpenRouter           | M5-02        | planned |
| Forced aligner and Whisper transcriber                 | M5-03        | planned |
| Takes and voice tools                                  | M5-04        | planned |
| Code-rendered music, procedural effects, mix graph     | M5-05, M5-06 | planned |
| Captions: segmenter, `captions_build`                  | M5-07        | planned |
| Settings catalogue (`src/settings.ts`, records of its stage) | M0-05 | tested |
