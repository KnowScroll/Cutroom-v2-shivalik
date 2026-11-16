# Cutroom v2 — Implementation · Milestone M1: Render core

**Written:** 15 November 2026
**Status:** Build plan, following [orchestration](../00-orchestration.md) and [conventions](../01-repo-and-conventions.md) §7–8.
**Read with:** [environment](../02-environment.md) · [testing](../03-testing.md) · [M0](M0-foundations.md)

Signatures, type shapes and file names are illustrative unless the design fixes them; persisted names, codes and settings are the design's. R1 is `lld/02`, R2 `lld/03`, R4 `lld/05`, R5 `lld/06`, R9 `lld/09`. S4, S7 and b2a are the evidence files `s4-render-host.md`, `s7-pixi-hardening-follow.md`, `b2a-colour-mux-mix.md`; S1, S1c and the segment-join check are in the spike evidence log. "Milestone M1" is never spike M1 (K9).

## Goal

R10 §4.2: M1 builds the "shim and sealer; host page; capture engine; `chunk.render`, `still.render`, `film.concat`, `film.mux`; the component validation functions; preview rungs (R2)". It is done when "the stale-frame, isolation, leak, colour-chart, mux-offset and repeatability tests pass as automated tests; a hand-written three-component shot renders to an MP4".

## Provides to later milestones

- `Meta`, `Control`, `ProbeItem`, the messages and R2's codes (the six of A:M1-4 included), with `META_INVALID` parsing; project-core imports the three schemas (A:M0-2).
- The `fill`, `effect` and `Gradient` records of the trusted layers, which R2 owns, M2-01's `layer.source` uses and M2-09 lowers (L7).
- `RenderUnit` and `FramePacket`, declared here for M2's compiler to produce; the frame-packet builder is the compiler's (M2-09; A:M1-8a); `RungBundle` and its hash.
- `sealComponent`, `SHIM_VERSION`, `buildHostPage` and the host bundle hash.
- `chunkRender`, `stillRender`, `filmConcat`, `filmMux` with `AbortSignal`, progress callback and process groups, returning R2 §2.9's records, for M3 to wrap.
- `environmentRecord()`, `environmentHash()` (R2 §2.8), `engineVersionHash()` (R4 D6 item 1).
- `BlobSource` and `ArtifactSink`, declared and stubbed here; M3 implements them over the blob store.
- Validation functions V0–V6 (C-00 to C-09), with every lint rule of R2 §2.13 (`LINT.CLAIM_BOUND_CANVAS` included, which M6 relies on; M1-07), `applyEdits`, the probe sidecar format (with the measured-set field of L30, M1-04), the leftover-browser test hook.

## What must already exist

`m0-done`, with every stage's settings (M0-05), the edge table, `tools/pins.json`, `tools/fonts.conf`, the render lock and `env:check --launch` (environment §§4–6, 9–10). The open points this document raised are resolved (section "Resolved points").

## Dependency sketch

```
M1-01 contract and render input
  ├── M1-02 shim, sealer (high) ── M1-03 host page ── M1-04 capture engine (high) ──┐
  ├── M1-05 encoder, concat, mux ────────────────────────────────────────────────────┴── M1-06 executors and rungs
  └── M1-07 lint and edits (V0–V1)                                                         ├── M1-08 runtime ladder
                                                                                           ├── M1-09 six named tests
                                                                                           └── M1-10 claims and shot
```

Parallel, in separate folders: M1-02, M1-05 and M1-07 after M1-01, with M1-05 and M1-07 continuing beside M1-03 and M1-04; then M1-08, M1-09 and M1-10. Render runs queue on the machine-wide lock (environment §10).

## Work packages

### M1-01 — Component contract and render input

- **Care:** normal
- **Package:** `packages/render` (`src/contract`); render defines the three schemas and project-core imports them (A:M0-2)
- **Depends on:** M0     **Parallel with:** none
- **Live calls:** none

**Goal.** The shapes every later render package uses exist as Zod schemas and types.

**Read first.** R2 §2.2, §2.3, §2.4, §2.6 first five bullets and "Trusted layers", §2.9 "Chunk result" and "Rung settings bundle", §2.12 table; R2 §3; R3 §3 (R2 row); R4 D5 "Frame packets", "Layer sources", D6, D10 last paragraph, §3; `lld/11` FR15, G5, G8, I1, I4, L7, A:M1-1, A:M1-4.

**Build.**
- `Meta` and `Control` exactly as R2 §2.2; `ProbeItem`, sidecar and `placement` records (§2.4); the messages of §2.3.
- The trusted-layer records R2 owns (L7; A:M1-1): **`fill`**, a `size` [w, h] in design units and either `color` (an sRGB CSS colour string, as for a `color` control) or `gradient`; **`effect`**, a `size` and `backdrop_filter`, a list of the same filter functions `layer.filter` uses; **`Gradient`** {`kind` `linear` or `radial`, `angle_deg`?, `stops` [{`at` 0 to 1, `color`}]}, which R3's `MaskSpec` gradient also uses.
- R2's codes: the twelve of §2.3, `FONT_UNREGISTERED`, `LIBRARY_UNREGISTERED`, `PREPARE_TIMEOUT`, `SEEK_TIMEOUT`, `EDIT_NO_MATCH`, `DIAGNOSTIC_IN_DELIVERY`, §2.13's `LINT.*` IDs, and the six of A:M1-4 with their classes: `BROWSER_CRASHED` (`transient`; `deterministic` on a second failure at the same frame), `CDP_TIMEOUT` (`transient`), `SCREENSHOT_MISSING` (`transient`), `ENCODE_FAILED` and `FRAME_COUNT_MISMATCH` (`transient`, then `deterministic`), `LAYER_LIMIT_EXCEEDED` (`deterministic`).
- `RenderUnit` and `FramePacket` with the fields of R2 §2.3 and §2.6 and R4 D5 "Frame packets" (stack paths, `params`, `seed`, `zoom_max`; per frame `t_flicks`, `t`, controls, final matrix, opacity, blend, filter, mask), and no entity ID or handle.
- `RungBundle` (R2 §2.9) from the `rung.<name>.*` settings, hashed with `hashCanonical`.

**Rules that are easy to get wrong.**
- Controls arrive complete; `null` only for a nullable control (R2 §2.2; R4 D5 item 4).
- `meta` durations are seconds; flicks exist only in R3's copy (R2 §2.2).
- `scale` = output scale × the unit's highest camera zoom (R2 §2.3).
- No frame-packet builder: R4 D5 and D10 put it in the compiler, which builds it at M2-09 (A:M1-8a; B:O1a). Fixtures write packets in test code.
- The host may not reuse R4's `UNIT_TOO_LARGE` for too many layers: each module raises its own codes (C3; A:M1-4).

**Tests.** Valid and invalid `meta` (a default outside min–max, an unknown technique); a packet missing a declared control refused; `RungBundle` hash independent of key order; a `fill` with both `color` and `gradient`, or neither, refused; a `Gradient` stop outside 0 to 1 refused.

**Done when.**
- [ ] `npm run check` and `npm test` pass with these tests.

**Out of scope.** R3's `component` kind; the frame-packet builder (M2).

### M1-02 — Runtime shim and sealer

- **Care:** high
- **Package:** `packages/render` (`src/shim`, `src/seal`)
- **Depends on:** M1-01     **Parallel with:** M1-05, M1-07
- **Live calls:** none

**Goal.** The trusted shim, and a sealer making each component a `srcdoc` whose only runnable script is shim, libraries and component together, under R2's component CSP.

**Read first.** R2 §2.2 "Trusted library registry", §2.3, §2.4 (`cut.mark`), §2.5, §2.7 "Component CSP"; `lld/11` §14.2; S7 B1–B3 and the A1 rows on `ResizeObserver` and tickers; S4 §E, §H.

**Build.**
- The shim as import-free browser JavaScript in one string whose hash is `SHIM_VERSION`, with everything R2 §2.5 "Provides" lists; fault capture (`error`, `unhandledrejection`, `securitypolicyviolation`, `console.error`); `SEEK_ASYNC` when `seek` returns a thenable; probe measurement after each seek.
- Every row of R2 §2.5's override table; the frame guard over the document and every shadow root, checked before each acknowledgement; animations, transitions and SMIL paused at the seek time around every seek, with `ANIMATION_RUNNING` from `getAnimations()`.
- `sealComponent({html, libraries, assets})` → `{srcdoc, script_hash, shim_hash, library_hashes}`: one inline script (shim, libraries in declared order, the component's inline script text in document order); R2 §2.7's CSP `<meta>` with that script's `sha256-` hash; images inlined as `data:` URLs up to `component.inline_asset_max_bytes`.

**Rules that are easy to get wrong.**
- The one-inline-script hash rule: with two scripts and two hashes a nested frame ran the component without the shim; with one, 0 of 25 routes reached a real clock (S7 B1, d1 against d2).
- `frame-src 'none'` and `child-src 'none'` do not stop `srcdoc` frames, and a document-only guard loses through shadow roots; S7 B1 (b+) lists what the guard must patch.
- Replacing `Date` is not enough: S7 B2 lists every clock, including `Reflect.construct`, the prototype getters and `Intl.DateTimeFormat` without an argument. Animations and `document.timeline` follow the BeginFrame clock, hence the pausing.
- Delete removed globals, never set them to `undefined` (S7 A1). Keep the shim's own port in its closure before deleting `MessageChannel`.
- Reset the seeded generator before `prepare` and every `seek` (R2 §2.5); make overrides non-configurable (S4 §E).
- A `srcdoc` frame inherits the host CSP too; relaxing only the component's changes nothing (S7 A1).
- The shim is a determinism aid, not a security boundary (R2 §2.5).

**Tests.** `npm test`: the CSP hash equals the SHA-256 of the script's bytes; one script element plus `cut-meta`; an over-limit asset refused. `test:render`: each S7 B2 clock repeats at frame 30 three times and changes at 60; S7 B3's random sources fixed or removed; `setTimeout`, a promise from `seek` and a running animation give `BANNED_API`, `SEEK_ASYNC`, `ANIMATION_RUNNING`; five nested-frame routes, one through a closed shadow root, refused; an SVG probe box correct.

**Done when.**
- [ ] `npm run check`, `npm test` and `npm run test:render` pass; the review is closed.

**Out of scope.** Hide and tint modes (M6; A:testing-4); PixiJS registration (no R10 row names it; a fixture library tests the sealer); lint (M1-07).

### M1-03 — Host page

- **Care:** normal (its acknowledgement path is reviewed with M1-04)
- **Package:** `packages/render` (`src/host`)
- **Depends on:** M1-02     **Parallel with:** M1-05, M1-07
- **Live calls:** none

**Goal.** The trusted page that stacks a unit's layers, applies each packet, and resolves `applyFrame` only when every active layer has answered.

**Read first.** R2 §2.3, §2.4 "Sidecar", §2.6 (not anchor-follow), §2.7 "What the origin rules do", §2.12 "How a rung is produced"; R4 D10 last paragraph; `lld/11` L7, A:M1-4, B:O1b; S4 §F, §G, §H, §J.

**Build.**
- `buildHostPage(unit, rung)` → document and host bundle hash: R2 §2.6's host CSP exactly; opaque background; a window of the rung's size with `transform: scale(s)` on the root.
- Layers in DOM order as R2 §2.6 gives them: sandboxed `srcdoc` iframes sized to `meta.size`, `isolation: isolate` groups, trusted `fill` layers (a colour or a `Gradient` over their `size`) and `effect` layers (their `backdrop_filter` over their `size`), from M1-01's records (L7), masks, and each packet's opacity, blend, filter and final matrix.
- One `MessageChannel` per component (R2 §2.3); messages off the port ignored.
- `applyFrame(packet)`: `seek` to every active layer; resolve when each answered `seeked` or `fault` for that `seq`; `rect_screen`, folded opacity and `size_du` per R2 §2.4. More than `host.max_layers` refused with `LAYER_LIMIT_EXCEEDED`, carrying the limit and the actual count (A:M1-4).

**Rules that are easy to get wrong.**
- Every layer box has `transform-origin: 0 0`, so the packet's matrix is applied exactly as the compiler built it; the matrix itself turns and scales the box about its centre (B:O1b).
- Never `will-change`: under a changing zoom it blurred SVG and text to 21–31 dB (S4 §G).
- No world container; the host decides nothing; layout stays at design size on every rung (R2 §2.6, §2.12).
- Probe boxes arrive in component coordinates; the host adds position and transform (S4 §H).
- The host's `frame-src 'none'` stops self-navigation while `srcdoc` frames still load (S4 §D).

**Tests** (`test:render`, plain screenshots; BeginFrame is M1-04's). `applyFrame` waits for an answer 8 ms late; a message off the port is ignored; `rect_screen` of a translated, scaled, rotated layer within 0.01 du; S4 §F's eight compositing cases within 1 level; a `fill` with a colour and one with a linear `Gradient` match their known pixels within 1 level; 25 layers give `LAYER_LIMIT_EXCEEDED`.

**Done when.**
- [ ] `npm run check`, `npm test` and `npm run test:render` pass.

**Out of scope.** Anchor-follow (M7); `media`, `caption`, `baked`, `cursor`, `placeholder` layers (M9, M5, M7, M10, M2); diagnostic isolation (M6).

### M1-04 — Capture engine

- **Care:** high
- **Package:** `packages/render` (`src/capture`)
- **Depends on:** M1-03     **Parallel with:** M1-05, M1-07
- **Live calls:** none

**Goal.** Node launches the pinned `chrome-headless-shell` without network, loads the host under BeginFrame control and captures frame-exact screenshots, with timeouts, recycling and clean failure.

**Read first.** R2 §2.3 "Timeouts", §2.6 "Serving", §2.7 last two paragraphs, §2.8, §2.9 first paragraph, §2.10, §4 rows 2–4; R5 §2.5 "Restart", §2.7 cancellation bullet; environment §4, §9 "The environment hash"; R2 §2.4 "Sidecar"; `lld/11` A:M1-4, A:env-3, L30, B:O14-measured; S1, S1c; S4 "Setup", §A "Process model", §C, §D namespace row, §J, §L.

**Build.**
- **First, a build revision to R2** (L30): before the code, this work package writes into R2 §2.4 the field in which the capture engine records the measured set (the compositing features verified across sandboxed iframes behind `unknown_test_required`, B:O14-measured) in the probe sidecar, beside the probe values it already records, and records the revision in section 18 of `lld/11` (orchestration §6). The capture engine then writes that field; M2-08 reads the set through `CompileFacts.capabilities`.
- Launcher: binary, flags and environment of environment §4.3 (R2 §2.8); a fresh user-data directory on ext4; an empty network namespace (`unshare`, no sudo, S4 §D); its own process group; Chrome's sandbox on. `puppeteer-core` only launches and opens raw CDP sessions.
- Per chunk, R2 §2.8's CDP sequence: a fresh context and a target with `enableBeginFrameControl: true`; viewport at the rung size, device scale factor 1; `Fetch` interception serving `/host/<hash>` and `/asset/sha256/<hex>` on `https://render.cutroom.invalid` from `BlobSource` and failing the rest, with `Page.setDocumentContent` behind one switch (the `R2-S8` fallback); `capture.warmup_frames` warm-up frames; per frame `applyFrame` under a `capture.seek_timeout_ms` watchdog, then `beginFrame` with `frameTimeTicks` one interval higher, retried `capture.retry` times without `screenshotData`, then `SCREENSHOT_MISSING` (A:M1-4); frames to a sink with backpressure at `capture.max_buffered_frames`.
- Lifecycle: recycle after `capture.browser_max_chunks`, above `browser.mem_budget_mb`, or after any fault. Crash, closed pipe, CDP timeout or watchdog: kill the process group, discard the chunk, report `transient` with its code: `BROWSER_CRASHED` for a crash event or closed pipe (`deterministic` on a second failure at the same frame), `CDP_TIMEOUT` for a call over `capture.cdp_timeout_ms`, and `PREPARE_TIMEOUT` or `SEEK_TIMEOUT` where they apply (A:M1-4).
- `AbortSignal` stops after the current frame (R5 §2.7); process groups reported with PID and start time (R5 §2.5). How the Scheduler records a reused browser's group is left to M3's implementer (B:M3-5).
- `environmentRecord()`, `environmentHash()` (from `pins.json` plus R2 §2.8's code and settings inputs), `engineVersionHash()`, `platformFontsFor(node)` by `CSS.getPlatformFontsForNode`. The operating-system half of the hash is defined by content, not by version strings or paths (A:env-3): the distribution ID and `VERSION_ID`, the glibc version, the raster mode, and the SHA-256 of every shared library `ldd` resolves for `chrome-headless-shell` under its launch environment. The kernel is recorded but left out. A path-valued flag is hashed as a fixed token (`--user-data-dir=<tmp>`); `LD_LIBRARY_PATH` counts through the hashes of the libraries it supplies, and `FONTCONFIG_FILE` through the hash of `fonts.conf`.
- Test helpers: the leftover-browser after-all hook (testing §3); a decoder for S4 §C's frame-number squares.

**Rules that are easy to get wrong.**
- Background tabs get no frames: two tabs in one headless window hang (S1). One page per browser and one browser context per capture; parallelism across browsers (R2 §2.8).
- Acknowledge, then BeginFrame: 0 wrong in 900 with waiting, 299 of 300 torn without (S4 §C).
- Fresh context and fixed warm-up per chunk: pixels depend slightly on render history, about 82 dB (S4 §L).
- `deviceScaleFactor` does nothing to BeginFrame output (S4 §J). Never `--site-per-process` (S4 §A) or `--no-sandbox` (R2 §2.7).
- Only `--force-webrtc-ip-handling-policy=disable_non_proxied_udp` stops WebRTC; without `force-`, or as a CSP directive, nothing happens (S4 §D).
- Timeouts belong to Node: a looping component blocks the whole page (R2 §2.3).
- The namespace hides any 127.0.0.1 listener too, so leak tests need a test-only launch without it (testing §3), unreachable from executor arguments.

**Tests** (`test:render`). 30 frames at each rung size (1080 × 1920, 720 × 1280, 540 × 960); a 60-frame random-order frame-number check, 0 wrong; a component looping in `seek` gives `SEEK_TIMEOUT` and its process group is gone; a killed renderer gives `BROWSER_CRASHED`, `transient`; a CDP call held past `capture.cdp_timeout_ms` gives `CDP_TIMEOUT`; a capture that never returns `screenshotData` gives `SCREENSHOT_MISSING` after `capture.retry`; abort stops after the current frame; `environmentHash` changes with `capture.warmup_frames`, `fonts.conf` or one library hash, and not with an unrelated setting, the kernel version or the tool folder's path (A:env-3); the interception log holds only allowed URLs.

**Done when.**
- [ ] `npm run check`, `npm test` and `npm run test:render` pass with no browser left; the review is closed.

**Out of scope.** Pool size and scheduling (M3); encoding (M1-05); chunk assembly (M1-06).

### M1-05 — Segment encoder, `film.concat` and `film.mux`

- **Care:** normal
- **Package:** `packages/render` (`src/encode`)
- **Depends on:** M1-01     **Parallel with:** M1-02, M1-03, M1-04, M1-07
- **Live calls:** none

**Goal.** Frames become closed-GOP H.264 segments carrying all four BT.709 tags; segments join by stream copy; audio is muxed without offset.

**Read first.** R2 §2.9; R4 D6 rows `film.concat`, `film.mux`; R5 §2.7 cancellation bullet; R9 §3.1 rows M-05, F-01, F-03; `lld/11` FR9, A:M1-3, A:M1-4; b2a spike 1 "Finding 1", corrected command, "Error summary"; b2a spike 2; the segment-join entry; environment §5.

**Build.**
- `encodeSegment(frames, bundle)`: `image2pipe` from the frame sink; the final chain is R2 §2.9's command exactly; the JPEG chain declares BT.601 full-range input (b2a, row "JPEG q95 + proposed JPEG chain") and ends with the same `setparams`; rate `fps`, or `fps/k` at step k; frames counted with `ffprobe` after close, a wrong count giving `FRAME_COUNT_MISMATCH` with the expected and actual counts; a non-zero FFmpeg exit giving `ENCODE_FAILED` with its status (A:M1-4).
- `filmConcat(segments)`: concat demuxer, `-c copy`; refuses mixed bundles, and a `diagnostic: true` segment with `DIAGNOSTIC_IN_DELIVERY`.
- `filmMux(video, mix)`: video copied; audio through FFmpeg's native `aac` encoder (LC profile) at `encode.aac_bitrate_kbps` (192, `director`, range 128 to 320), which enters `film.mux`'s work-key parameters when M2-10 builds the keys (A:M1-3); `-movflags +faststart`; no `-shortest`; succeeds whenever FFmpeg exits cleanly, returning the file; refuses a diagnostic segment.
- FFmpeg in its own process group; abort sends SIGTERM, then SIGKILL after `cancel.grace_s`.

**Rules that are easy to get wrong.**
- BT.709 tags must be set explicitly with `setparams`: FFmpeg 8.1.1 silently overrides `-color_primaries` and `-color_trc` (b2a finding 1). Read all four back with `ffprobe`. Without colour options the encode is BT.601, up to 39 levels off; Chrome's JPEG frames are BT.601 full range (b2a; R2 §2.9).
- The mux judges nothing; F-01 and F-02 judge its file at M6 (FR9). Decoded AAC exceeds the mix (256 samples at 10 s, 512 at 20 s); up to 1,024 is allowed (F-01).
- The encoder and `+faststart` are fixed, as libx264 is for video; only the bitrate is a setting. The −3.0 dBTP ceiling was chosen against the true-peak rise measured with the native encoder at 192 kb/s, and another encoder or bitrate was not measured (b2a "Limits"; A:M1-3).
- One bundle per plan, so concat sees one codec and time base (R2 §2.9).
- No Linux FFmpeg has repeated batch 2a yet (environment §5); M1-09 does.

**Tests** (`test:render`). 30 generated PNG frames give `tv`, `bt709`, `bt709`, `bt709` and 30 frames; segments of 150, 90 and 150 join to exactly 390 frames with uniform timestamps and PSNR against a lossless reference within 0.001 dB of a single encode; concat and mux refuse a diagnostic segment; a 48 kHz mix on 300 frames gives one AAC LC stream at the set bitrate decoding to at most 1,024 samples over the mix; a short frame stream gives `FRAME_COUNT_MISMATCH` and a broken FFmpeg argument `ENCODE_FAILED`; abort leaves no FFmpeg.

**Done when.**
- [ ] `npm run check`, `npm test` and `npm run test:render` pass.

**Out of scope.** Colour-chart and mux-offset tests (M1-09); mixing and mastering (M5).

### M1-06 — `chunk.render`, `still.render` and the preview rungs

- **Care:** normal
- **Package:** `packages/render` (`src/exec`)
- **Depends on:** M1-04, M1-05     **Parallel with:** none
- **Live calls:** none

**Goal.** The executors run at every rung, store outputs atomically, and return the records later milestones key and cache.

**Read first.** R2 §2.4 "Sidecar", "Stride"; §2.9 "Chunk result", "Stills"; §2.12; R4 D6 items 1–5 and "Chunk result", D7 "Rung"; R1 §1.4–1.5.

**Build.** `chunkRender({unit, range, rung}, {source, sink, signal, onProgress})` → `{segment, frames, fps, probe_sidecar, rung, diagnostic}`, written to `ArtifactSink` only once the segment is complete and counted (`diagnostic` false until M6); `stillRender({unit, frames})` → images and probe records; R2 §2.12's four rungs. The frame packets come from the caller: the compiler builds them (M2-09) and the caller of `chunkRender` and `stillRender` passes them in, which is M3-03's executor or M2-11's `run_plan_direct`; at M1 test code supplies them (B:O1a; A:M1-8a).

**Rules that are easy to get wrong.**
- Half-open frame intervals, sampled at their start; events round up (R1 §1.4–1.5). At step k the frames are 0, k, 2k… from the unit's own frame 0, never the chunk start or film position, encoded at fps/k (R2 §2.12; R4 D6).
- Atomic: an aborted or failed chunk leaves nothing in the sink (R2 §2.9).
- `rect_screen` is the same at every rung for one frame (R2 §2.4).

**Tests** (`test:render`). Draft over unit frames [11, 71) at 30 fps gives frames 12, 14, … 70 at 15 fps; `rect_screen` at draft equals final; `still.render` returns its frames in order; abort leaves the sink empty; the review rung is 720 × 1280.

**Done when.**
- [ ] `npm run check`, `npm test` and `npm run test:render` pass.

**Out of scope.** Chunking (M2); keys and caching (M2, M3); diagnostic modes (M6); `media.extract_frames` (M9); `component.bake` (M7).

### M1-07 — Validation V0–V1: extraction, edits and lint

- **Care:** normal
- **Package:** `packages/render` (`src/lint`)
- **Depends on:** M1-01     **Parallel with:** M1-02 to M1-06
- **Live calls:** none

**Goal.** The static ladder steps as plain functions with exact evidence.

**Read first.** R2 §2.2, §2.10 "Checking", §2.13 rows V0–V1, "Lint rules", "Repair"; R9 §3.1 rows C-00, C-01; `lld/11` FR8, FR13, K4.

**Build.** `extractComponent(model_output)` (C-00); `applyEdits(doc, edits)` (each search text matches exactly once, else `EDIT_NO_MATCH`); `lintComponent(doc, ctx)` with every rule of R2 §2.13, `ctx` holding the font and library registries and whether parameters are claim-bound. Results: R1 §5 evidence with rule ID, exact message and line.

**Rules that are easy to get wrong.**
- Every lint rule is an error (R2 §2.13). Messages and lines must be exact: repair sends them to the model and search/replace depends on them (R2 §2.13 "Evidence out"; S3).
- Plain functions; no validation record (K4, FR13).
- Inline event-handler attributes are banned (S7 B1); `will-change` is `LINT.CSS_ANIMATION` (R2 §2.6); `Assets.load` only with PixiJS declared; images created inside `seek` and `navigator.connection` are banned (S7 B3).
- Parsers are the implementer's choice, since only the rules, their IDs and exact messages and lines are fixed (A:M1-5). `parse5`, `acorn` and `css-tree` are recommended: each reports source locations and is pure JavaScript, which matters because `npm test`, lint included, runs on Windows. Each goes through the orchestrator and `impl/DEPENDENCIES.md`, its licence read at install (conventions §3).

**Tests** (`npm test`). One fixture per rule, triggering exactly that rule on the right line; a clean component passes; `EDIT_NO_MATCH` for zero and two matches; a multi-edit repair applies in order.

**Done when.**
- [ ] `npm run check` and `npm test` pass with these tests.

**Out of scope.** Runtime steps (M1-08); V7, the same model call as R6's visual check, at M4 (A:M1-9).

### M1-08 — Validation V2–V6: the runtime ladder

- **Care:** normal
- **Package:** `packages/render` (`src/validate`)
- **Depends on:** M1-06, M1-07     **Parallel with:** M1-09, M1-10
- **Live calls:** none

**Goal.** The runtime ladder steps as plain functions on the real capture path.

**Read first.** R2 §2.13 rows V2–V6, "Sample times", "Control response", "Determinism rules" and the bullets after; §2.10 "Checking"; §2.4 "Strength of evidence"; R9 §3.1 rows C-02 to C-09; `lld/11` FR13, K4.

**Build.** One function per check, each returning R1 §5 evidence with a coverage record, with R2 §2.13's samples and thresholds: C-02 (loads alone); C-03 (seek sweep to `validation.sample_times`); C-07 (control extremes against `control.response_min_fraction` and the caller's probe expectation, including `hand_l_target` and `hand_r_target`); C-08 (`component.min_distinct_frames`); C-04 (the five determinism rules); C-05 (`validation.blank_min_coverage`); C-06 (probes, boxes, clipping, overflow, fonts); C-09 (`capture.seek_soft_ms`).

**Rules that are easy to get wrong.**
- A missing promised probe is `UNKNOWN`, not `FAIL` (R2 §2.13 V5); C-08 is observational (S3); probe overlap is a hypothesis (R2 §2.4).
- Ask Chrome which fonts drew the text: `document.fonts.check` called a missing font available (S4 §I); never await `document.fonts.ready` (R2 §2.10).
- PSNR on decoded RGB, never bytes (R1 §5). Functions only; the check runner writes records (FR13). PNG decoding is the implementer's choice; `pngjs`, which S4 and S7 used, is recommended (A:M1-5).

**Tests** (`test:render`). A clean fixture passes all; a component carrying state between seeks fails C-04 below 70 dB (S2 and S3 measured 46–65 dB); a blank fixture fails C-05 unless `may_be_blank`; a missing probe gives `UNKNOWN`; a dead control fails C-07; an unpinned font raises a C-06 finding; `setTimeout` gives a C-02 fault.

**Done when.**
- [ ] `npm run check`, `npm test` and `npm run test:render` pass.

**Out of scope.** Records and `check.run` (M3); V7 (M4; A:M1-9); the contact-sheet and event-strip builders, which R2 owns and which are built in `packages/render` at M4 (A:M1-2).

### M1-09 — The six named render tests

- **Care:** normal (by a test author who did not implement M1-02 to M1-06)
- **Package:** `packages/render/test/named/`
- **Depends on:** M1-06     **Parallel with:** M1-08, M1-10
- **Live calls:** none

**Goal.** R10's six tests exist by name in `test:render` and pass, each with a control that proves it can fail (testing §3).

**Read first.** S4 §C, §D, §L; S7 A4, B1–B4; b2a spikes 1 and 2; R2 §2.3, §2.5, §2.7, §2.9, §2.12, §2.13 "Determinism rules"; R1 §1.8, §5; `lld/11` A:M1-6; testing §3.

**Build and pass criteria.**
1. **stale-frame:** 15 components (SVG, Canvas 2D, HTML) draw the frame number as 10 black and white squares; 300 PNG frames in seeded random order. **Pass:** 0 wrong in each of three runs (two orders; components 8 ms slow), 0 of 900 (S4 §C). Control: skipping acknowledgement must give wrong captures (S4: 299 of 300; S7: 5 of 300).
2. **isolation:** S4 §D's attempts, S7 B1's 25 nested-frame routes, S7 B2's clocks, S7 B3's random sources, `file:` URLs. **Pass:** nothing reaches a local HTTP, WebSocket or UDP listener; parent, storage, cookies blocked; 0 of 25 routes reach a native clock; clocks repeat at frame 30 three times and change at 60; random sources fixed or removed. Control: without the `sandbox` attribute, parent and storage access succeed (S4 §D).
3. **leak:** S7 B4's thirteen outbound requests, six of them self-navigation, and WebRTC directly and from a nested frame, namespace off. **Pass** with both CSPs and the WebRTC flag: 0 navigations, 0 TCP connections, 0 UDP packets, the normal component still rendering. Control: without host CSP and flag the leaks appear (S7: 6 navigations, 10 UDP packets). Repeated with the namespace on.
4. **colour-chart:** b2a's 24 flat patches and 256-step grey ramp, captured at the final rung, encoded, decoded BT.709 limited to full. **Pass:** each patch interior (32 px inset) within 1 level per channel; ramp monotonic, 0 to 0, 255 to 255; tags `tv`, `bt709`, `bt709`, `bt709`; the JPEG chain at q95 within 2. **Measured, not gated** (A:M1-6): the same patches and ramp through the JPEG chain at each preview quality (q85 `still`, q80 `draft`, q90 `review`, R2 §2.12), recording the largest per-channel error of each rung for the M1 report. Until a gate is set from those figures as a build revision, the q95 gate of 2 levels is the one that applies; delivery needs rung `final`, gated at 1 level. Control: an encode without `setparams` fails the tag check.
5. **mux-offset:** 300 frames at 30 fps from three 100-frame segments, frame 150 white; a 48 kHz mix of 480,000 samples with a click at 240,000. **Pass:** lag within 5 ms early and 15 ms late (R1 §1.8; F-03), expected 0 samples (b2a); white frame at 5.000 s; 300 frames; decoded audio at most 481,024 samples. Control: clicks moved +20 and −50 ms measure +960 and −2,400 samples. The edit list must be applied (ignored, it adds 21.33 ms).
6. **repeatability:** a frame re-sought after out-of-order seeks ≥ 70 dB, byte-identical for SVG and Canvas (S1c; S7 A4); a fresh page ≥ 50 dB (`validation.repeat_min_psnr_db`; 76–83 dB measured); two fresh browsers with one history byte-identical (S4 §L); a chunk's first frame against the same frame drawn after its predecessor ≥ 50 dB (S4: 81.95). Control: a component keeping state between seeks falls below 70 dB.

**Rules that are easy to get wrong.**
- Observe at the listener, never by return values: `sendBeacon` returns true when blocked; `WebSocket` does not throw (S4 §D).
- Test-only switches (no acknowledgement, namespace or interception) are reachable only from tests. "Leak" means R2 §2.7's two network leaks, which S7 B4 re-tested; state carried between seeks is covered by test 6 and C-04 (A:M1-7).

**Done when.**
- [ ] `npm run test:render` passes all six by name, each control failing as it must.

**Out of scope.** Claim tests (M1-10); diagnostic modes (M6).

### M1-10 — Claim tests and the three-component shot

- **Care:** normal (by a test author)
- **Package:** `tests/claims/`, `tests/fixtures/render/`, `packages/render/test/e2e/`
- **Depends on:** M1-06     **Parallel with:** M1-08, M1-09
- **Live calls:** none

**Goal.** M1's claims are tested, with measurements in `docs/impl/reports/claims/<ID>.json` (testing §6); the hand-written shot renders to an MP4.

**Read first.** R10 §2.2 rows `R2-S8`, `R2-S9`, `R2-S10`, `R2-S12`; R2 §8 (those rows), §9, §10, §2.6 "Serving" and "Cross-component effects", §2.10; `lld/11` A:testing-1a, A:testing-1b, A:testing-1c, A:M1-8b; S4 §F, §I, §L; testing §6, §10.

**Build.** The four claim files (`R2-S9` one machine, the comparison waiting for M11, A:testing-3; `R2-S12` M1 part, the diagnostic modes at M6, A:testing-4) and the shot: SVG, Canvas 2D (`cut.canvas`) and HTML components, one control each, 90 frames at 30 fps in two final-rung chunks, `film.concat`, `film.mux` with a 48 kHz mix of round(90 × 23,520,000 / 14,700) = 144,000 samples; also at the draft rung.

**Rules that are easy to get wrong.** The pass criteria below are section 18's (A:testing-1a to A:testing-1c); a fallback taken is recorded as a build revision (orchestration §6). Whether `/asset/` is admitted to the component CSP waits for this package's `R2-S12` asset result: the lead decides at M1, before M2 caches anything, and reports it to the user, since it concerns the sandbox. Until then the component CSP is unchanged and assets are inlined up to `component.inline_asset_max_bytes`, which is also the fallback (A:M1-8b).

**Tests.**
- `R2-S8`: under interception, BeginFrame and the empty namespace, a 300-frame stale-frame check is correct; nothing is served but `/host/<hash>` and `/asset/sha256/<hex>`; `file:` attempts (image, fetch, nested frame, navigation) and S7's navigation routes fail.
- `R2-S9` (A:testing-1a): for Latin, CJK, Arabic, Hebrew and emoji samples, `CSS.getPlatformFontsForNode` reports only pinned families; a font placed in the user's font directory is never reported; two fresh browsers agree at or above `validation.repeat_min_psnr_db` (50 dB), byte identity being recorded but not required (R1 §5).
- `R2-S10` (A:testing-1b): every frame of the reused browser's tenth chunk is at or above `validation.repeat_min_psnr_db` (50 dB) against a fresh browser's render of the same chunk; 24 layers for 1,500 frames give 0 wrong frames on the frame-number check, 0 missing screenshots after `capture.retry`, and peak resident memory at or below `browser.mem_budget_mb` (950). A failure applies R10's fallback.
- `R2-S12` (A:testing-1c): a `backdrop-filter` blur in an `effect` layer over two iframes is within 1 level per channel of the same scene drawn in one plain document, outside a border as wide as the blur radius (S4 §F's measure); a sprite sheet over the inline limit, served from `/asset/sha256/<hex>` under a test-only CSP, is at or above 50 dB against the same sheet inlined as `data:`, and is expected to be identical.
- Shot: 90 frames; four tags as M1-09; one audio stream decoding to at most 145,024 samples; all three components visible in the sidecar at frames 0, 45, 89; the draft file 45 frames at 15 fps.

**Done when.**
- [ ] `npm run test:claims` and `npm run test:render` pass, or each failed claim has its fallback applied and recorded.
- [ ] The `R2-S12` asset result is in the pull request, and the lead's decision on `/asset/` in the component CSP is recorded before M2 starts (A:M1-8b).

**Out of scope.** `R2-S9`'s second machine (M11); `R2-S12`'s diagnostic modes (M6) and follow cases (M7).

## Claims of R10 §2.2 assigned to M1

| Claim | Tested in | Fallback if wrong |
|---|---|---|
| `R2-S8`: interception serves the host under frame control with no network | M1-10 | `Page.setDocumentContent` and `data:` URLs (M1-04's switch) |
| `R2-S9`: a private fontconfig gives identical text on two machines (one-machine half) | M1-10 | Text differs slightly; comparisons use a tolerance |
| `R2-S10`: a reused browser matches a fresh one; 24 layers and long chunks hold | M1-10 | `capture.browser_max_chunks` = 1; a lower `host.max_layers` |
| `R2-S12`, M1 part: `backdrop-filter` and large assets across sandboxed frames | M1-10 | Fewer host-level effects; assets inlined up to the limit |

## Acceptance cases and live calls

No case of A1 to A14 is assigned to M1. No live calls; the budget is zero.

## Acceptance list

| # | Command | Expected result | Proves |
|---|---|---|---|
| 1 | `npm run check` | Exit 0 | Types, lint, edges, codes |
| 2 | `npm test` | Pass offline in about a minute, V0–V1 and the sealer included | Validation functions, static part |
| 3 | `npm run env:check -- --launch` | Exit 0 | Pinned environment |
| 4 | `npm run test:render` | The six named tests pass by M1-09's criteria, each control failing as it must; V2–V6 as M1-08 states | The six named tests; validation functions |
| 5 | `ffprobe -count_frames` on the shot | 90 frames; `tv`, `bt709`, `bt709`, `bt709`; one audio stream | The three-component shot renders to an MP4 |
| 6 | `npm run test:claims` | The four claims pass, or each fallback is applied and recorded | The M1 claims |
| 7 | `pgrep -f chrome-headless-shell; pgrep -x ffmpeg` afterwards | No output | Clean teardown |

## Resolved points

Every point this document raised is closed by section 18 of the [integration decisions](../../lld/11-integration-decisions.md), with the classes of `impl/research/open-points-A.md` (rows `A:M1-1` to `A:M1-9`) as the lead ruled on them. The points this document borrowed from others are closed there: M0's points 1, 2 and 8 (A:M0-1, A:M0-2, A:M0-8), the machine half of the environment hash (A:env-3, in M1-04), and testing's points 1, 3 and 4 (A:testing-1a to A:testing-1c, A:testing-3, A:testing-4, in M1-10).

| # | Point | Resolution |
|---|---|---|
| 1 | **`fill` and `effect` parameters** | Decided (L7; A:M1-1): R2 owns three records, `fill`, `effect` and `Gradient`, declared in M1-01 and drawn by M1-03; R3 adds `{fill}` and `{effect}` to `layer.source` (M2-01), and R4 lowers them (M2-09) |
| 2 | **Contact-sheet and event-strip builders** | ANSWERED (A:M1-2): R2 owns them (R6 §3; R2 §3, §2.13 V7; F23). They are built in `packages/render` at M4, where the component-author worker's visual check first needs them, reading R9's `sheet.*` and `clip.*` settings by name |
| 3 | **AAC settings** | Decided (A:M1-3): FFmpeg's native `aac` encoder (LC) and `+faststart` are fixed; the bitrate is the new R2 setting `encode.aac_bitrate_kbps` = 192, `director`, range 128 to 320, in `film.mux`'s work-key parameters. M1-05 builds it; M0-05 registers it; M2-10 keys it |
| 4 | **Unnamed codes** | Decided (A:M1-4): `BROWSER_CRASHED`, `CDP_TIMEOUT`, `SCREENSHOT_MISSING` (M1-04), `ENCODE_FAILED`, `FRAME_COUNT_MISMATCH` (M1-05) and `LAYER_LIMIT_EXCEEDED` (M1-03), with the classes M1-01 lists, each with a test that produces it. The report's optional change of R4's `UNIT_TOO_LARGE` to `blocking/frozen` is not made: `UNIT_TOO_LARGE` stays as the design states it and does not block a `frozen` compile (L33) |
| 5 | **Dependencies** for lint and PNG decoding | IMPLEMENTATION DETAIL (A:M1-5), left to the implementer: only the lint rules, their IDs and exact messages and lines (R2 §2.13) and PSNR on decoded RGB (R1 §5) are fixed. `parse5`, `acorn`, `css-tree` and `pngjs` are recommended, each agreed by the orchestrator and listed in `impl/DEPENDENCIES.md` (M1-07, M1-08) |
| 6 | **JPEG rung colour tolerance** | NEEDS MEASUREMENT (A:M1-6): M1-09's colour-chart test measures the largest per-channel error at q85 (`still`), q80 (`draft`) and q90 (`review`) and puts the three figures in the M1 report. Until then the q95 gate of 2 levels applies; the preview rungs need no gate of their own, because delivery uses rung `final`, gated at 1 level. A gate, if wanted, is set from the figures as a build revision |
| 7 | **"Leak"** | ANSWERED (A:M1-7): R2 §2.7's two network leaks, re-tested in S7 B4; state carried between seeks is covered by M1-09 test 6 and C-04 |
| 8 | **Frame-packet builder; `/asset/` in the component CSP** | The builder: ANSWERED (A:M1-8a). The compiler builds it (R4 §3, D5, D10; I4), at M2-09; M1 declares `RenderUnit` and `FramePacket`, and the caller passes packets in (B:O1a). The CSP: NEEDS MEASUREMENT (A:M1-8b), waiting for one named event, M1-10's `R2-S12` asset result: the lead decides at M1, before M2 caches anything, and reports it to the user. Until then the component CSP is unchanged and assets are inlined up to 2 MB, which is also the fallback |
| 9 | **V7** | ANSWERED (A:M1-9): it is one model call, the same as R6's visual check (R2 §2.13; F23), built with R6's component-author loop at M4; nothing at M1 needs it (K4) |

Decisions on other documents' points that also change this milestone: B:O1b (M1-03's `transform-origin`), B:M3-5 (M1-04's process groups).
