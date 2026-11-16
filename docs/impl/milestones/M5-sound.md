# Cutroom v2 — Implementation · Milestone M5: Sound

**Written:** 15 November 2026
**Status:** Build plan; it adds no design. Shape: [conventions](../01-repo-and-conventions.md) §7–8.

Short names: R0 `lld/01`, R1 `lld/02`, R2 `lld/03`, R3 `lld/04`, R4 `lld/05`, R5 `lld/06`, R6 `lld/07`, R7 `lld/08`, R9 `lld/09`, R10 `lld/10`; FR5, U17 and the like are `lld/11` rows; "b2a" is `research/evidence/b2a-colour-mux-mix.md`, "log" `research/10-spike-evidence-log.md`, "r11" `research/11-provider-cost-and-audio-research.md`. **Signatures and function names are illustrative unless the design fixes them.**

## 1. Goal

R10 §4.2 builds "the voice adapter for `hexgrad/kokoro-82m` through OpenRouter … which returns no timing; the forced aligner, so that every take is `aligned` (U18); takes; static-gain mastering; music and effects interfaces, each with its one engine …; captions cut from the aligned word times, with word-by-word highlighting on only if the M5 alignment measurement allows it". It is done when "a narrated film renders with captions; loudness, peak, sample-count and transcript checks pass on the exported file; A7 passes with the real adapter; the first live speech call has recorded the PCM format and confirmed the response shape (U18); `R7-A2` has measured the aligned word times against speech-to-text word times and decided whether word-by-word highlighting may be on."

U17 replaces MiniMax speech-2.8; **no MiniMax speech adapter is built**, and K3's `coarse` rule does not apply to the default engine (U18). The engine's reply is raw audio with an `X-Generation-Id` header and **no timing**; errors are JSON (400, 401, 402, 403, 404, 429, 502); failed generations are not billed (R7 §2.2.4). Spike V1 ([evidence](../../research/evidence/v1-openrouter-kokoro-and-alignment.md)) measured the rest: the PCM format is signed 16-bit little-endian, 24 kHz, mono; the provider can be pinned, and an unpinned request once went to a provider 6.45 times dearer; spend per generation can be read back; takes repeat their timing but not their bytes (L12). The input limit and the rate limits are still not determined (V1 §2.2). U2 (code-rendered music and procedural effects only; a film may ship without music) and U9 (no cloning) stand. **The aligner and the speech-to-text engine are decided** (L10): CTC forced alignment in Node with a wav2vec2-base model through ONNX and our own trellis alignment of the known script, and Whisper `small.en` in Node through ONNX, both local, with no Python worker and no hosted speech-to-text. `R7-A2` is measured against signal onsets after pauses, not against speech-to-text word times, because Whisper's word times are less accurate than the aligner's (L11).

## 2. Provides to later milestones

- **`packages/studio`:** families `VoiceEngine`, `MusicEngine`, `SfxEngine`, `Aligner`, `Transcriber`, and interfaces `MediaProvider` (M9), `SearchProvider` (M8); the Kokoro-82M adapter, pinned to one provider; the CTC forced aligner (wav2vec2-base through ONNX) and the Whisper `small.en` transcriber (L10); one music and one effects engine; tools `voice_request`, `take_select`, `music_request`, `sfx_request`, `captions_build`; executors `voice.synthesize`, `transcribe`, `voice.align` (C:M5-O1c), `music.generate`, `sfx.generate`, `audio.mix`; `formatValue`, `tokenize`, `buildTokenMap`, `segmentCaptions`, `takeIsCurrent`, `lowerMixPlan`, `masterMix`; sidecar writers; all R7 §5 settings, with `align.word_end_offset_ms` (L10), `align.lipsync_min_fraction` (L9) and `voice.provider_only` (L12).
- **`packages/quality`:** A-01, A-02, A-03, M-03, M-04, F-01, F-02, F-03, F-09; the WER measure and its transcript normaliser (L13); `quality_settings@1`, with `stt.short_take_words` and `stt.short_take_max_errors` (L13).
- **`packages/compiler`:** the mix plan with sound, `sync_pairs` and the caption plan, which M2 deferred to M5 (M2 §4); the relay of R7's `TAKE_SUPERSEDED` (C:M5-O6).
- **`packages/project-core`:** the field `caption_track.audience` (C:M5-O7).
- **Model files:** the aligner and transcriber models in ONNX form, exported once from the original weights by the pinned script under `tools/models/` and pinned by hash in `tools/pins.json` (L27 revised, L38).
- **`packages/render`:** the trusted `caption` layer, if M1 lacks it.
- **`R7-A2`'s result** for M7's mouth shapes; M7 no longer builds the aligner.

## 3. What must already exist

- **M0:** `packages/foundations` (flicks, IDs, `ArtifactRef`, `workKey`, failure classes, the `SettingsRegistry` with `override_by` and `range`); the `StorageAdapter`; `tools/dependency-edges.json` and `tools/pins.json` with `env:check`.
- **M1:** `chunkRender`, `stillRender`, `filmConcat`, and `filmMux`, which encodes AAC without `-shortest` and always returns its file; M3 wraps them as `chunk.render`, `still.render`, `film.concat`, `film.mux`.
- **M2:** schemas for every R3 kind with per-field write authority; the compiler's Resolve pass, measured take durations, presented-frame sync in the solver, the mix plan of a silent film and `quality_declarations`, calling the formatter and segmenter through the declared interfaces `ValueFormatter` and `CaptionSegmenter`. M2 defers the mix plan with sound, the caption plan and `sync_pairs` to M5 (M2 §4); M5-06 and M5-07 build them.
- **M3:** `register_capability`, `PaidAdapter`, intents, spool, reconciler, ledger, paid-API limiter, speculative gate; the fake paid adapter and A7 against it; the check runner (`register_check`), which alone writes validation records.
- **M4:** `ModelClient`; the record-and-replay transport; the tool boundary `runToolCall` with grants; the plugin API (`ctx.tool`, `ctx.capability`, `ctx.role`, `ctx.setting`); the session runtime's audit log; the staged `delivery_finalize` (C:C1.1, L23).
- **Keys:** `MINIMAX_API_KEY` and `OPENROUTER_API_KEY` in `C:\Users\XZNON\cutroom-v2\.env`, which Git ignores (U23; both confirmed present on 15 November 2026), read in WSL through the path `CUTROOM_ENV_FILE` names (L19).
- **Spike V1's results,** which L9 to L13 rule on.

Missing items are added first or stubbed. Every point the plan raised is resolved (section 8).

## 4. Dependency sketch

```
M5-01 ─► M5-02 ─► M5-03 ─► M5-04 ─► M5-05 ─► M5-06 ─► M5-07 ──┐
  └────► M5-08 ─► M5-09 ───────────────────────────────────────┴─► M5-10
```

M5-01 to M5-07 share `packages/studio` and run in order; M5-08 and M5-09 (`packages/quality`) run beside them.

## 5. Work packages

### M5-01 — Audio foundations: settings, adapter families, formatter and tokens

- **Care:** normal
- **Package:** `packages/studio`; `packages/project-core` (delivery-profile defaults only)
- **Depends on:** M4 done     **Parallel with:** none
- **Live calls:** none

**Goal.** R7's settings and adapter interfaces exist, and the shared pure functions (formatter, tokenizer, token map) are wired into the compiler's Resolve pass.

**Read first.** R7 §2.1, §2.2.1, §2.6 (`format`), §5; R3 §2.2 (`voice_line`, `take`, `delivery_profile`, note "Voice (FR5)"), §2.7 (settings rule); R4 D5 ("Data bindings"); FR5, G15, G16, G20, K1, K6, K7, U4, U6, and §18 of `lld/11`: L9, L10, L12, L40.

**Build.** Every R7 §5 setting with default, `override_by` and `range`, including the three the rulings add: `align.word_end_offset_ms` = 80, `director`, range 0 to 200 (L10, L40), `align.lipsync_min_fraction` = 0.95, `director`, range 0.5 to 1 (L9, L40), and `voice.provider_only` = `deepinfra`, the provider as spike V1 names it, `human` because it changes the price (L12); `ProviderAdapter<Req, Res>` (`describe`, `estimate`, `submit(req, work_key)`, `reconcile(work_key)`) and the families, a `VoiceEngine` stating whether it returns word times; `formatValue(value, format, form)`, `tokenize`, `buildTokenMap`, and `renderLine`, which resolves `{name}` placeholders through `voice_line.bindings`. A new delivery profile copies the three `delivery.audio.*` values.

**Rules that are easy to get wrong.**
- `human` rows are those R7 §5 marks, plus `rights.share_alike_ok` (false, U4), `screen_capture.allowed_origins` (empty, U6), `fetch.contact_identity` (G12), and `voice.provider_only` (L12). `voice.default_takes` (range 1 to 5, G16), `capability.budget_usd` (K7), `align.lipsync_min_fraction` (L9) and `align.word_end_offset_ms` (L40) are `director`. The two `align.*` values are starting values that M5-10(b) calibrates.
- After creation the profile's `audio.loudness_lufs` and `audio.verify_max_dbtp` are `human` (K1); any rate but 48 kHz gives `VALUE_OUT_OF_RANGE` (R3 §2.2).
- An unbound placeholder is `UNKNOWN_MEMBER`; chart, caption and voice read one `Format` (FR5); "$4.2M" maps to five spoken tokens (R3 §2.2).
- The compiler reaches the formatter only through its declared interface; add no edge outside `tools/dependency-edges.json`.

**Tests.** Display and spoken forms with `decimals`, `unit`, `rounding`; the "$4.2M" token map; `UNKNOWN_MEMBER`; a Director override of `delivery.audio.loudness_lufs` gives `FIELD_AUTHORITY`; `voice.default_takes` = 6 gives `VALUE_OUT_OF_RANGE`; a new profile holds −14 / −3.0 / −1.0 and refuses 44.1 kHz; the compiler resolves a bound line.

**Done when.** `npm run check` and `npm test` pass; every R7 §5 setting is registered as designed, the three new ones included.

**Out of scope.** Claims and datasets (M8); spoken forms in other languages.

### M5-02 — The voice adapter: Kokoro-82M through OpenRouter

- **Care:** normal
- **Package:** `packages/studio`; `tests/fixtures/recorded`
- **Depends on:** M5-01     **Parallel with:** M5-08, M5-09
- **Live calls:** fixture recording, at most 2,000 characters in two stock voices, with their generation look-ups (free). Ceiling **$0.02**.

**Goal.** The Kokoro-82M adapter serves `voice.synthesize`, pinned to one provider, books each generation's spend from OpenRouter's look-up, and passes against recorded replies.

**Read first.** R7 §2.1, §2.2.1, §2.2.4 ("The voice adapter"), §2.2.9, §5 (`voice.*`), §8; R5 §2.2, §2.5, §2.6, §2.8; R6 §4, D9; F17, U15, U17, U18, and §18 of `lld/11`: L12, C:M5-O5a, C:M5-O8a; report C §6 items 1 and 2; V1 §2; [spend](../04-spend.md) §1–2.

**Build.** `POST https://openrouter.ai/api/v1/audio/speech` with `model`, `input`, `voice` (the profile's stock voice ID), `response_format` (`voice.response_format`, `pcm`) and `provider` = `{only: [voice.provider_only], allow_fallbacks: false}`, and no other field (L12; V1 §2.2). It returns audio, `samples` and `sample_rate` but no words, which the aligner supplies (M5-03). The pinned provider enters the `voice.synthesize` work key; direction does not, because nothing about it is sent (C:M5-O5a, C:M5-O8a). **Spend:** for each generation the adapter reads `GET https://openrouter.ai/api/v1/generation?id=<X-Generation-Id>` and books its `total_cost`, which meets U15 for speech (L12). Before the call, the intent reserves the characters sent times the pinned provider's list price; the key-level usage counter, which lags, is not used (C:M5-O8a). `describe()` states no word times, no direction, stock voices only, and the format and limits recorded.

**Rules that are easy to get wrong.**
- **The PCM format is VERIFIED by spike V1:** signed 16-bit little-endian, 24,000 Hz, mono (L12; V1 §2.3). The first live call confirms the reply's shape (`Content-Type: audio/pcm;rate=24000;channels=1`, `X-Generation-Id`) and writes it to `describe()` and the fixture (U18 (6)); code never guesses it. **No MP3 cross-check on lines of more than one sentence:** the MP3 timeline gains about 85 ms of silence at each sentence join, so word times always come from the PCM (V1 §2.4; report C §6 item 1).
- Count `samples` from the byte count and the recorded format (R7 §2.2.1).
- 401 and 403 are `policy`; 402 (no credit) is `policy`, like insufficient balance (R6 §4); 404 is `capability`; 429 and 502 are `transient`; other 4xx are `deterministic` (F17). `voice` is required: without it the route answers 400 (V1 §2.2). An error before content is "definitely unsent" and unbilled; a timeout or reset after bytes began is ambiguous (R5 §2.6).
- **A take is stored once and never regenerated to reproduce it:** output repeats its timing but not its bytes, and another provider gives a different take (L12; V1 §2.6). So the spool holds the bytes and `X-Generation-Id` before confirmation. With the ID spooled, `reconcile` asks the generation look-up whether the call was billed; only a reply lost before the ID arrived answers `cannot_tell` (R5 §2.6; report C §6 item 2).
- Rate limits are unknown (V1 saw no 429 at 3 in flight): back off on 429 (U18 (4)).
- `OPENROUTER_API_KEY` is read at run time from `C:\Users\XZNON\cutroom-v2\.env` (in WSL through `CUTROOM_ENV_FILE`, L19) and never reaches a fixture, log, command line or other endpoint (U18 (3); U23; standing rule 3). A request carries the line's text and nothing about the user (L22).

**Tests.** A recorded reply decodes as s16le at 24 kHz, mono, and `samples` = bytes ÷ 2; a fake transport maps each status as above; every request body carries exactly `model`, `input`, `voice`, `response_format` and `provider`, with `provider.only` equal to `voice.provider_only` and `allow_fallbacks` false, and never direction (report C §6 item 1); changing `voice.provider_only` changes the work key; on recorded look-ups the booked spend equals `total_cost`, which V1 found equal to characters × $0.62 per million on every DeepInfra generation (V1 §2.5, a starting check). Live: the format record is written; two speech calls are recorded with their look-ups, and each look-up names the pinned provider.

**Done when.** `npm test` passes on recordings; the live test passed once, with ledger lines whose dollars come from the look-ups.

**Out of scope.** Alignment and transcription; takes; A7.

### M5-03 — The CTC forced aligner and the Whisper transcriber, in Node

- **Care:** normal
- **Package:** `packages/studio`; `tools/models/` (the pinned export script), `tools/pins.json` and the environment set-up (the model files)
- **Depends on:** M5-02     **Parallel with:** M5-08, M5-09
- **Live calls:** none. Both engines run locally; the fixtures are M5-02's recorded takes.

**Goal.** An `Aligner` makes every take `timing: aligned` by CTC forced alignment of the known script, and a `Transcriber` serves `transcribe` with Whisper `small.en`; both run in Node through ONNX on Linux in WSL (L10).

**Read first.** R7 §2.1, §2.2.1, §2.2.4, §2.2.10, §7 item 1; R9 D5; R3 §2.2 (`Word`, `take`), §2.7; R5 §2.5, §2.6; r11 §5.2; U18 (1); §18 of `lld/11`: L10, L27 (revised), L38, C:M5-O1a, C:M5-O1c; report C's row C:M5-O1b; V1 §3, §4, §7; [environment](../02-environment.md) §9.

**Build.**
- **Then the Linux check.** That both models run on Linux in WSL under the pinned Node is ASSUMED, because spike V1 ran on Windows (L10). The first task shows both loading and running in WSL on the mirror. If the native ONNX Runtime backend does not run there, use ONNX Runtime's WASM backend, the ruled fallback (L10). The pull request records which backend ran and each engine's real-time factor beside V1's Windows figures (aligner 0.04 to 0.06 × real time, Whisper `small.en` 0.29 ×), as measurements, not gates.
- **Before the Linux check, the one-time export of the model files** (L27 revised, L38). `wav2vec2-base-960h` and Whisper `small.en` in ONNX form are **exported once from the original weights** (`facebook/wav2vec2-base-960h`, `openai/whisper-small.en`; Apache-2.0 and MIT), not taken from the published ONNX conversions, whose cards state no licence (C:M5-O1a). A pinned export script under `tools/models/` runs in WSL, in a throwaway Python virtual environment inside the WSL tool folder (`~/.cutroom-build/.tools`, L19) with its packages pinned, and produces the two ONNX files. Their hashes go into `tools/pins.json`; a later set-up checks the hash and skips the export when the files are present; `env:check` checks them; they are never committed (L10). This Python is a set-up tool only: the product's run time stays Node, and no Python worker is built (L38). Spike V1 used `@huggingface/transformers` 3.8.1, which bundles `onnxruntime-node`; adding a dependency follows [conventions](../01-repo-and-conventions.md) §3.
- **The `Aligner`:** the wav2vec2-base CTC model gives letter probabilities per 20 ms frame, and our own trellis alignment (a Viterbi pass with blank states) fits the known script to them, then maps letters to words and words to spoken tokens (L10; V1 §3). **Word ends:** a word's end is the earlier of the next word's start and the aligned end plus `align.word_end_offset_ms` (80), because uncorrected CTC ends came out a median 83 ms early (L10; V1 §4.3).
- **The `Transcriber`:** Whisper `small.en` in Node through ONNX, returning raw text with word times (L10).
- **The capability `voice.align`** in R5's catalogue, owned by R7 beside `voice.synthesize`, with effect class `pure` for this local engine (it would be `paid` for a hosted one). Its work key covers the audio hash, the exact text sent to the voice engine, the language, the adapter version and the model; R7 declares its resource vector, which is CPU work, not the browser pool (C:M5-O1c). `transcribe` is `pure` for the same reason.
- Word records on spoken-token indices with `confidence`; a fake of each interface for other packages' tests.

**Rules that are easy to get wrong.**
- Alignment fits the known script and never transcribes (R7 §2.2.1). Align against the exact text sent to the voice engine, pronunciations substituted, then map to spoken tokens. Times are flicks from the take's start; `confidence` is separate from the method (R3 §2.2). The per-word score flags a wrong word but scores correct names almost as low, so no confidence threshold is set (V1 §4.6; C:M5-O1d).
- The transcriber returns raw text; R9 scores it. Its work key covers audio hash, language, hints, adapter version and model; audio beyond `describe()`'s limits is split at silences, offsets added (R7 §2.2.10). Its errors are larger near its 30-second chunk joins (V1 §4.4).
- **No Python worker, no hosted speech-to-text;** MiniMax `asr-1.0` is not used (L10). How inference is kept off the main Node thread is the implementer's choice; batch 2b measured main-thread stalls under load (C:M5-O1b).
- A model licensed against commercial use cannot be registered (R7 §2.1). The original weights' cards say Apache-2.0 for both models, and Whisper's code is MIT, which is why the files are exported from them (V1 §3; C:M5-O1a; L27 revised). The pin records the original's identifier, its licence and the exported file's hash.
- The aligner and `R7-A2`'s reference are independent: the reference is the signal's onsets after pauses (L11).

**Tests** (with the models: `npm run test:render` in WSL, since the aligner decodes with FFmpeg; with the fakes: `npm test`).
- Both models load and run in WSL on the mirror; the backend used is recorded.
- On M5-02's recorded takes, every script word is aligned, in order. For words that follow a pause, the aligned start lies within 40 ms early and 60 ms late of the signal onset (a 5 ms RMS window first above −45 dBFS after at least 150 ms below, V1 §4.2) for at least `align.lipsync_min_fraction` (0.95) of them, the worst within 72 ms. These are V1's figures (69 of 72, worst 72 ms), used as starting values.
- The word-end rule: with a fake aligner, an end is the earlier of the next start and the aligned end plus `align.word_end_offset_ms`.
- The transcript of a plain fixture line equals its script after case and punctuation are removed (V1: WER 0 on plain lines). A recorded transcript keeps its raw text; an over-long fixture splits with offsets; repeats are cache hits; a non-commercial model is refused.

**Done when.** `npm test` passes with the fakes; the model tests pass in WSL on a freshly synced mirror; both model files are pinned in `tools/pins.json` and `env:check` verifies them; both interfaces have fakes; the pull request records the Linux run.

**Out of scope.** Mouth tracks (M7); accuracy over many lines and the calibration of the `align.*` settings (M5-10).

### M5-04 — Takes and the voice tools

- **Care:** normal
- **Package:** `packages/studio`; `packages/compiler` (the relay of `TAKE_SUPERSEDED`)
- **Depends on:** M5-03     **Parallel with:** M5-08, M5-09
- **Live calls:** none

**Goal.** `voice_request` makes unselected, aligned takes; `take_select` selects one by patch; a changed spoken text supersedes a take, and a `frozen` compile refuses a stale selected take.

**Read first.** R7 §2.2.1 ("Takes as timing anchors"), §2.2.4, §2.2.9, §2.9, §4; R3 §2.2 (`take`, `voice_profile`, `voice_line`), §2.7, §2.10; R4 D2 (relayed codes, `CAPTION_TEXT_MISMATCH`), D4; R5 §2.9; R6 D4; FR5, FR10, G16, U9, C3, §13 #3, §10 #112 of `lld/11`, and its §18: L12, C:M5-O1d, C:M5-O5a, C:M5-O5c, C:M5-O6; report C's row C:M5-O5b.

**Build.** `voice_request` (effect `external_paid`) and `take_select` (effect `propose`); the chain `voice.synthesize`, `voice.align`, then ingest of an audio `asset` (`provider_audio`, `disclosure: ai_generated`) and a `take` with `timing: aligned`; `takeIsCurrent`, which the compiler's Resolve pass calls through its declared interface for each selected take (C:M5-O6). Codes: `VOICE_UNAVAILABLE`, `VOICE_POLICY`, `LINE_NOT_SPEAKABLE`, `TAKE_NOT_FOR_LINE`, `TAKE_SUPERSEDED`.

**Rules that are easy to get wrong.**
- With no count given, a request gets `voice.default_takes` (2) takes, variants 0 and 1, each under its own work key (G16). Each take is stored once and never regenerated to reproduce it (L12).
- Measured take fields are `system` fields written by ingest; a Director patch gets `FIELD_AUTHORITY` (R3 §2.7). Duration is exactly `samples` at `sample_rate`.
- **A failed alignment still gives a take** (an error, or words the aligner cannot place): ingest creates it with `timing: estimated`, "spread by syllable count" (R7 §2.2.1), and attaches the failure as evidence. Previews and phrase captions keep working; a `final` compile refuses the take with `TAKE_TIMING_ESTIMATED` (§13 #3), and the Director repairs with a new variant or a pronunciation (R7 §4). No confidence threshold is set (C:M5-O1d).
- Paid audio is `expensive`: on a `provisional` line the job waits in `declared` unless `allow_speculative` is set (R5 §2.9). A late artifact merges only if its read set, by `pin_hash`, is unchanged (FR10).
- When the rendered spoken text no longer matches `take.spoken_text`, the take is superseded: `TAKE_SUPERSEDED` (FR5). **At compile time** the Resolve pass relays R7's `TAKE_SUPERSEDED` unchanged, as R4 relays R2's `FONT_UNREGISTERED` (C3): `blocking/frozen`, and `material` in `plan` mode, as `CAPTION_TEXT_MISMATCH` is. It is not `NOT_READY`, and no system patch clears `selected_take` (C:M5-O6).
- **Direction** cannot reach Kokoro: `voice_request` accepts a line with direction, sends only the engine's fields, returns a warning that direction was not applied, and records that in the take's `engine.params`. It does not refuse with `VOICE_UNAVAILABLE` (C:M5-O5a).
- **Voices:** only listed stock voice IDs are accepted; any other voice, or a `designed` profile, is refused with `VOICE_UNAVAILABLE`. With no direction reaching the engine and no cloning (U9), R7 §2.2.9 rule 2's name screening has no input to guard; it is built with the first adapter that accepts direction text or design prompts (C:M5-O5c).
- **Pronunciations** are token-addressed `[{token, say}]` (§10 #112); how the adapter substitutes each `say` into `input` is the implementer's choice (C:M5-O5b). Kokoro reads the full stop in "Dr." and "U.N." as a sentence end, so `spoken_text` spells abbreviations out while the token map keeps them in the display text; a respelled name's spellings belong in `quality_intent.audio.lexicon` (V1 §2.7).

**Tests.** With the fake adapter and aligner: two aligned takes per request; a Director patch to `take.samples` is refused; another line's take gives `TAKE_NOT_FOR_LINE`; a changed bound claim value gives `TAKE_SUPERSEDED` and a new work key; failed alignment gives an `estimated` take with the failure as evidence, which a `final` compile refuses with `TAKE_TIMING_ESTIMATED`; a stale selected take gives `TAKE_SUPERSEDED` as `blocking` in a `frozen` compile and `material` in a `plan` compile; a line with direction gives a warning, the same request body and the same work key as without; a non-stock voice gives `VOICE_UNAVAILABLE`; a provisional line waits in `declared`; a repeat is a cache hit.

**Done when.** `npm run check` and `npm test` pass, with the five codes as named.

**Out of scope.** Mouth tracks (M7).

### M5-05 — Code-rendered music and procedural effects

- **Care:** normal
- **Package:** `packages/studio`
- **Depends on:** M5-04     **Parallel with:** M5-08, M5-09
- **Live calls:** none

**Goal.** One local engine each for music and effects; `music_request` and `sfx_request` produce frozen 48 kHz WAV assets, an `authored` beat grid and a `sync_point`.

**Read first.** R7 §2.2.2 to §2.2.4, §2.9; R3 §2.2 (`music_cue`, `sfx_cue`, `component`); R4 D3; R5 §2.5; r11 §4.1, §4.4; U2, H11, F4, I2, and §18 of `lld/11`: L31, C:M5-O3, C:M5-O4.

**Build.**
- **First, a build revision to R2** (L31): before the code, this work package defines in R2 the `meta` fields of an `audio_score` component, using the score format below (C:M5-O3), and records the revision in section 18 of `lld/11` (orchestration §6).
- **Music** (C:M5-O3). A score lives where the project model puts it: `music_cue.score?: Ref<component>`, a component with representation `audio_score` (R3 §2.2; I2). `music_request` runs a deterministic generator, not a model, that writes an `audio_score` component from the cue's `request` block and renders it. A score component written by the Director or a human through a patch is validated and rendered instead. The score document is a constrained JSON score whose schema R7 owns: a tempo map, metre, sections, notes per instrument, instruments from a pinned CC0 sample set, and hit markers. The renderer is Tone.js offline in the pinned Chrome or MIDI plus FluidSynth run as a separate process, chosen by a byte-repeatability test and licence registration (r11 §4.1).
- **Effects** (C:M5-O4). One of r11 §4.4's procedural engines, jsfxr (Unlicense) or ZzFX (MIT), with its licence registered. `sfx_cue.request.category` is a closed list that R7 publishes in the `sfx_request` schema, drawn from the engine's preset families; `description` is recorded but not interpreted. The preset and a random source seeded from `variant` fix the parameters.
- The tools; executors `music.generate` and `sfx.generate`; codes `MUSIC_UNAVAILABLE`, `SCORE_INVALID`, `SFX_UNAVAILABLE`.

**Rules that are easy to get wrong.**
- A grid from a validated score is `authored` and exact; `beat_grid.verified` is a `system` field only beat tracking sets, and none exists (R3 §2.7).
- A score that fails validation gives `SCORE_INVALID` with the validator's exact message (C:M5-O3). A model-written score would need a new worker role, which crosses R6, and is not built.
- An unknown effect category gives `SFX_UNAVAILABLE`; `preferred_origin` `library` or `generated` gives `SFX_UNAVAILABLE` (U2; C:M5-O4). Cues carry no licence; assets do (F4).
- `sync_point` is the end of the generated envelope's attack, which the parameters fix exactly, so nothing is measured (C:M5-O4).
- The tools keep effect `external_paid` at zero cost (R7 §2.9); the capabilities are `pure` (R5 §2.5); `variant` changes the work key. Output is byte-identical per request and variant, so randomness is seeded (r11 §4.4).

**Tests.** A repeat gives identical bytes and a cache hit; variant 1 a new key. At 120 bpm beat n lies at exactly n × 352,800,000 flicks. A generated score is an `audio_score` component that validates; a hand-written invalid score gives `SCORE_INVALID` with the exact error. An unknown category gives `SFX_UNAVAILABLE`. An effect's `sync_point` equals the end of its attack in samples. Outputs are 48 kHz, within `max_duration`.

**Done when.** `npm test` passes; licences are declared.

**Out of scope.** Beat tracking; AI engines (U2).

### M5-06 — The mix graph and static-gain mastering

- **Care:** high
- **Package:** `packages/studio`; `packages/compiler` (the mix plan with sound and `sync_pairs`)
- **Depends on:** M5-05     **Parallel with:** M5-08, M5-09
- **Live calls:** none

**Goal.** `audio.mix` runs the mix plan as an FFmpeg graph and returns stems and a master of exactly `round(N·T / 14,700)` samples at −14 LUFS, limited at −3.0 dBTP.

**Read first.** R7 §2.2.5, §2.2.6, §4; R4 D5 ("Audio mix plan"), D3; R1 §1.4; b2a, spike 3; log, M1; §12.2 of `lld/11`, H4, F28, FR13.

**Build.** In the compiler, the mix plan with sound and `sync_pairs`, which M2 deferred to M5 (M2 §4; R4 D5 "Audio mix plan"); `lowerMixPlan`; the `audio.mix` executor (prepare, place, duck, sum, pad and cut, master); one stem per bus; `masterMix`.

**Rules that are easy to get wrong.**
- **Never `loudnorm`:** on batch 2a's five mixes it fell to dynamic mode on four and missed by 0.7 LU in linear mode (§12.2). Measure with `ebur128`; apply one static `volume` gain; limit with `aresample=192000,alimiter=…:level=false,aresample=48000` at `delivery.audio.limit_dbtp`; measure again; correct for at most 3 passes until within 0.5 LU (R7 §2.2.6 step 5). Verification after AAC is F-09's (M5-08).
- Gain precedes the limiter, keeping the limit at −3.0 dBTP (`alimiter` rejects limits below 0.0625); the limiter must not shift timing, which held at lag 0 with `latency=true` (b2a, "The guard").
- Place with `adelay` (`S` suffix, `all=1`); sum with `amix=normalize=0`, since the default rescales (b2a).
- **Sound lands on the presented frame:** positions come from the plan, which applied that rule (R4 D3); never recompute them. Length comes from the absolute end time (R1 §1.4).
- Prepare: takes to −18 LUFS, music −24 LUFS, effects −10 dBFS peak; the duck key is the prepared speech bus (b2a, "Ducking"). Mastering writes no validation record (FR13).

**Tests** (`npm run test:render`). A click lands at sample 96,000 on both channels; sums are bit-identical. An effect on a visual event at 1.01 s, 30 fps, starts at sample 31 × 1,600 minus its `sync_point`. Ducking: lower under speech, within 1 dB of unducked late in a 1.5-second pause, never over 14 dB down. Spike M1's three pre-masters and b2a's spiky speech master to −14 ± 0.5 LUFS in at most 3 passes, exactly 960,000 samples, lag 0; after AAC at 192 kb/s, −14 ± 1.0 LUFS and ≤ −1.0 dBTP. No graph contains `loudnorm`.

**Done when.** The render tests pass; a reviewer has closed the review (care: high).

**Out of scope.** Final-file checks; muxing.

### M5-07 — Captions: segmenter, `captions_build`, sidecars and the caption layer

- **Care:** normal
- **Package:** `packages/studio`; `packages/compiler` (the caption plan); `packages/project-core` (the field `caption_track.audience`); `packages/render` (the caption layer, if M1 lacks it)
- **Depends on:** M5-06     **Parallel with:** M5-09
- **Live calls:** none

**Goal.** Cues come from aligned word times and `display_text`; sidecars are written; a trusted `caption` layer burns cues in, with probes.

**Read first.** R7 §2.2.4 ("until timing is measured"), §2.2.7, §2.9; R2 §2.15; R4 D2, D5 ("Caption plan"); R3 §2.2 (`caption_track`); R9 §3.1 (A-03); F21, F22, C3, K6, §10 #142, §13 #22 of `lld/11`, and its §18: C:M5-O7, L9.

**Build.** In the compiler, the caption plan, which M2 deferred to M5 (M2 §4); `segmentCaptions`, wired into the compiler's `CaptionSegmenter` interface; `captions_build` (effect `propose`, code `CAPTION_SOURCE_MISSING`); sidecar writers; the caption layer. **Caption diagnostics** (C:M5-O7): R7 names `CAPTION_READING_SPEED`, `CAPTION_TOO_SHORT` and `CAPTION_TIMING_ESTIMATED`, which R4 relays when it calls the segmenter; each is `material` with `blocks: none`, because A-03 is the corrective check that judges captions. **`caption_track.audience`** (`general` or `children`, default `general`) is added to R3's `caption_track` as a `director` field under K6, so that A-03 and the segmenter read limits for the track's audience; no M5 or M6 golden brief targets children (C:M5-O7).

**Rules that are easy to get wrong.**
- Cue text comes from the script, never a transcript (R7 §2.2.7).
- Until `R7-A2`'s outcome is recorded, cues are phrase-level with highlighting off for every preset: highlighting stays off "until timing is measured" (R7 §2.2.4). M5-10(b) decides it by L9's rule.
- A cue is visible on frame n when start ≤ t_n < end; starts round up (R2 §2.15). Suppressed intervals leave burn-in only; sidecars keep full cues (§13 #22).
- Burn-in uses the trusted layer, never FFmpeg's `subtitles` filter, so boxes are probed (R7 §2.2.7). Materialised cues are token ranges, not text (R3 §2.2).

**Tests.** One fixture per rule at the defaults: a speaker change ends a cue; at most 2 lines of 26 characters and 7 words; no article–noun or number–unit break; linger 150 ms, never past the next cue; gaps under 120 ms closed; cues under 700 ms merged; above 20 characters per second, or 17 when `caption_track.audience` is `children`, gives `CAPTION_READING_SPEED`; `CAPTION_TOO_SHORT` and `CAPTION_TIMING_ESTIMATED` each have a fixture in the case R7 §2.2.7 gives; all three are `material` and block nothing. A burned-in render shows each cue on exactly the rule's frames; sidecars match; no selected take gives `CAPTION_SOURCE_MISSING`.

**Done when.** `npm test` and the caption render test pass.

**Out of scope.** Highlighting before `R7-A2` passes; A-03.

### M5-08 — Final-file audio checks

- **Care:** high
- **Package:** `packages/quality`
- **Depends on:** M5-01     **Parallel with:** M5-02 to M5-06
- **Live calls:** none

**Goal.** F-01, F-02, F-03, F-09 (hard), M-04 (corrective) and M-03 (observational) run through `check.run`; R9's settings are registered.

**Read first.** R9 D1, D2, D6; §3.1 (rows M-03, M-04, F-01 to F-03, F-09; notes "Loudness", "FFmpeg facts relied on"); §4; §5; R2 §2.9 ("Audio mux"); R1 §1.4, §1.8; b2a, spike 2 and "After AAC 192k"; FR9, FR13, K1, F28.

**Build.** The six checks, and every R9 §5 setting not already registered.

**Rules that are easy to get wrong.**
- Read thresholds from the delivery profile, never a copy (K1); `loud.tolerance_lu`, `sync.mux_*` and `final.min_integrated_lufs` are `human`.
- **Verify after AAC:** F-09 measures the decoded file with `ebur128=peak=true`, since AAC raised true peak by up to 1.5 dB (b2a). Decode with the edit list applied; `-ignore_editlist` shifts audio by 1,024 samples, 21.33 ms.
- **The sample-count rule (F-01):** `nb_read_frames` equals N; the mix is `round(N·T / flicks_per_sample)` samples and the decoded audio exceeds it by 0 to 1,024; container duration within one AAC frame of N·T; four colour tags match; a full decode has no errors.
- F-03 cross-correlates the decoded audio with the frozen master; positive lag is late audio. A file without audio is not a failed mux job; F-02 fails it, fault layer `encode` (FR9).
- A crash, timeout or missing input gives `UNKNOWN`, never `PASS` (D1); only the runner writes records (FR13).

**Tests** (`npm run test:render`, on `film.mux` output). A clean file passes all six. Dropped audio fails F-02 (`encode`) and F-01. Audio moved +20 ms fails F-03 (−5 / +15 ms), measured within 0.03 ms; −50 ms is recovered. −12.5 LUFS and −0.6 dBTP fail F-09; −14.9 LUFS passes. N − 1 frames or missing colour tags fail F-01. An undeclared 2-second silence is an M-03 finding; a declared one is not. A crashed `ffprobe` gives `UNKNOWN`. Changing `loud.tolerance_lu` re-keys only F-09 and M-04.

**Done when.** The render tests pass; a reviewer has closed the review (care: high).

**Out of scope.** Quarantine, the mux re-run, F-04 to F-07 (M6).

### M5-09 — Transcript and caption checks: A-01, A-02, A-03

- **Care:** normal
- **Package:** `packages/quality`
- **Depends on:** M5-08     **Parallel with:** M5-03 to M5-07
- **Live calls:** none

**Goal.** A-01 (corrective, take), A-02 (observational, final) and A-03 (corrective, film) run with the WER measure on transcripts from `transcribe`, after one normaliser for script and transcript alike.

**Read first.** R9 D5, D6; §3.1 (rows A-01 to A-03); §3.4 (`audio`); §5 (`stt.*`, `sync.event_*`); R7 §2.2.7, §2.2.10; R5 §2.5; K3, F21, and §18 of `lld/11`: L11, L13, L29, L40; V1 §4.5.

**Build.** A WER function with one normaliser that both the script and the transcript pass through before comparing, for numbers, times, abbreviations and names (L13); the short-take rule; the three checks; the R9 settings `stt.short_take_words` = 10 (range 1 to 30) and `stt.short_take_max_errors` = 1 (range 0 to 5), starting values calibrated at M5-10(b) (`R9-3`; L13, L40). Both are `director` while A-01 does not gate delivery, and become `human` once A-01 joins the required set, as thresholds of a hard check (G15 (b); L40).

**Rules that are easy to get wrong.**
- A check declares the transcript it needs and the Scheduler runs `transcribe` as a dependency; the check never calls an adapter (R5 §2.5).
- WER is (S + D + I) / N after the normaliser; a high WER is a hypothesis; gibberish voices give `NOT_APPLICABLE`; `stt_exempt` lines are skipped (D5). The normaliser covers the differences V1 found on correct takes: digits and symbols ("4.2", "18%", "$1,250", "Q3"), times ("7:45" against "7.45"), abbreviations ("U.N." against "UN", "Dr." against "Doctor"), lexicon names, and spelling variants ("behaviour" against "behavior") (V1 §4.5; L13).
- **Short takes:** a take of at most `stt.short_take_words` (10) script words passes A-01 with at most `stt.short_take_max_errors` (1) word errors; a longer take uses `stt.wer_max_take` (0.10) as before (L13). On V1's correct short lines with numbers and names, WER was 0.08 to 0.30 before such a rule.
- **A-01 does not gate delivery until the normaliser's tests pass** (L13).
- **A-02's word-level part reports `UNKNOWN` with a coverage record,** as K3 provides for `coarse` timing, here for every take: Whisper's word times are less accurate than the aligner's (V1 §4.2: the first word of every clip at 0.00 s, misses after pauses of a median 71 ms), so comparing them would flag most words (L11). A-02's WER part is unchanged (≤ 0.15).

**Tests.** A correct take passes A-01 (≤ 0.10); one swapped word in 12 (0.083) passes, three (0.25) fail; "4.2 million" equals "four point two million". Each pair of V1's kinds above normalises to equal, through the one normaliser applied to both sides. A take of 9 words with one wrong word passes, with two fails. A-02 passes WER 0.12 (≤ 0.15), and its word-level part is `UNKNOWN` with a coverage record. A-03 reports 25 characters per second. A repeat hits the `transcribe` cache.

**Done when.** `npm test` passes, the normaliser's tests included.

**Out of scope.** K-02 (M8).

### M5-10 — Milestone acceptance: A7 with the real adapter, `R7-A2` and `R9-3`, the narrated film

- **Care:** normal. Written by a **test author** who implemented none of M5-02 to M5-09.
- **Package:** `tests/acceptance`, `tests/claims`, `tests/fixtures`
- **Depends on:** M5-01 to M5-09     **Parallel with:** none
- **Live calls:** speech only; transcription is local (L10). (a) A7, ceiling **$0.02**; (b) `R7-A2` and `R9-3`, ceiling **$0.15**; (c) the narrated film, ceiling **$0.10** (section 7).

**Goal.** The three proofs of R10's "done when" pass.

**Read first.** R10 §2.2, §3.2 (A7); R7 §9; R9 §9; R5 §2.6; R4 D4; R1 §1.8; FR10, K3, U18, and §18 of `lld/11`: L9, L10, L11, L12, L13, L23, L39, L40, C:C1.1, C:M5-O2a, C:M5-O2b; V1 §4.

**Build.**
- **(a) A7 with the Kokoro adapter.** Kill the process after the reply is spooled, before confirmation: on restart the job is `unknown_outcome`, the spool is adopted, and the ledger shows one charge. Drop the reply: it is booked as presumed charged and resent once; a second loss ends the job `failed`.
- **(b) `R7-A2` and `R9-3`, run once (K3), on Linux in WSL with the built aligner.** Ten lines with numbers, units, months and a lexicon name, in two stock voices, each aligned and transcribed dry and over the code-rendered music bed; ten planted variants (one word or number changed, scored against the original script). **The reference is the signal, not the transcript** (L11): for each word that follows a pause, record d = t_aligned − t_onset, where t_onset is the signal onset measured on the dry take as V1 §4.2 did (a 5 ms RMS window first above −45 dBFS after at least 150 ms below). For each word before a pause, record its end, with `align.word_end_offset_ms` applied, minus the start of the measured silence (L10). No second CTC model is used: none is named or needed (L39). Record WER per line, with the short-take rule (L13).
- **(c) The narrated film.** About 30 seconds: three shots of hand-written components; four lines in one voice, commitments `frozen`; a `derived` phrase caption track, burned in, with sidecars; one ducked music cue; one effect on a visual event. It is driven through the tool boundary with the Director's grant: `voice_request`, A-01, `take_select`, then the staged `delivery_finalize` (L23; C:C1.1), whose chain renders, concatenates, mixes and muxes, then `check_run` for the final-file checks.

**Rules that are easy to get wrong.**
- Grade `final` needs every asset `eligible` (R4 D4), and the rights table arrives at M6, so the film compiles at grade `preview`, rung `final`, as the staged `delivery_finalize` does (C:C1.1). Never hand-write `rights.status` (FR1).
- Kokoro has no native timing, so this run measures forced alignment against signal onsets after pauses (L11). Words joined to their neighbours have no ground truth here (V1 §6). The result decides caption highlighting by L9's rule, and the orchestrator records it in the milestone report; mouth shapes are M7's decision.
- Every live call goes into the ledger, with dollars from the generation look-up (L12); stop before a ceiling ([spend](../04-spend.md) §1).

**Tests.** (a) `tests/acceptance/a07-real-adapter.live.test.ts`: R10 §3.2's observables. (b) `tests/claims/R7-A2.live.test.ts` reports the median, 95th percentile, maximum and share of d within −40 / +60 ms (R1 §1.8). **`R7-A2` passes when that share is at least `align.lipsync_min_fraction` (0.95)** (L9); spike V1 measured 69 of 72 (96%), median 24 ms, 95th percentile 59 ms, worst 72 ms, the starting figures. It also reports the corrected word ends (median, 95th percentile, share within −40 / +60 ms); `align.word_end_offset_ms` is calibrated from the measured median shortfall (V1: 83 ms uncorrected; starting value 80), and a changed value of either `align.*` setting is a build revision. If `R7-A2` fails, M5 may choose another aligner model only after a licence check recorded in the M5 report (L39). `R9-3.live.test.ts` reports WER per take against `stt.wer_max_take` (0.10) and `stt.wer_max_final` (0.15), and short takes against `stt.short_take_words` (10) and `stt.short_take_max_errors` (1): how many correct takes pass and how many planted variants fail. (c) `tests/acceptance/m5-narrated-film.live.test.ts`: F-01, F-02, F-03, F-09, M-04, A-03 and each take's A-01 pass; A-02's WER ≤ 0.15, its word-level part `UNKNOWN` with a coverage record (L11); sidecars hold the burned-in cues.

**Done when.** All three passed once live; reports and ledger lines exist; the milestone report records `R7-A2`'s outcome against `align.lipsync_min_fraction`, whether highlighting may be on, and the calibrated `align.*` and `stt.short_take_*` values.

**Out of scope.** Director-driven narration (M6).

## 6. Claims of R10 §2.2 assigned to M5

| Claim | Where tested | Fallback if it fails |
|---|---|---|
| `R7-A2`: forced alignment is accurate enough for captions and mouth shapes (the native half does not apply to Kokoro). Measured against signal onsets after pauses (L11); passes when at least `align.lipsync_min_fraction` (0.95) of word starts fall within −40 / +60 ms (L9) | M5-10 (b) | Captions stay phrase-level, highlighting off; at M7, mouth shapes use tier 0 or 2 (R10 §2.2) |
| `R9-3`: WER thresholds separate good takes from bad; word-time half in the same run (K3) | M5-10 (b) | `stt.wer_max_take`, `stt.wer_max_final`, `stt.short_take_words` and `stt.short_take_max_errors` move, by build revision (L13) |

## 7. Live-call budget

| Work package | What | Ceiling | Basis |
|---|---|---|---|
| M5-02 | Speech fixtures | $0.02 | 2,000 characters at the pinned DeepInfra price of $0.62 per million is about $0.0012. **Measured** by spike V1: `total_cost` equalled characters × list price on all 18 generations (V1 §2.5) |
| M5-03 | None | $0.00 | Both engines are local (L10); the fixtures are M5-02's takes |
| M5-10 (a) | A7 | $0.02 | Five calls of at most 60 characters |
| M5-10 (b) | `R7-A2`, `R9-3` | $0.15 | About 2,400 characters, under $0.002 at the measured price; transcription is local and costs nothing (L10); counts estimated |
| M5-10 (c) | Narrated film | $0.10 | About 1,000 characters with retakes, under a cent; transcription is local; estimated |
| **Total** | | **$0.29** | M5's ceiling ([spend](../04-spend.md) §1) |

## 8. Resolved points

Every point the plan raised is closed by the lead's rulings and the research report C, recorded in section 18 of [`lld/11`](../../lld/11-integration-decisions.md). Identifiers follow section 18: `L<n>` is a lead ruling; `C:M5-O1a` is report C's row for M5's point O1, part a. Rows classed ANSWERED or IMPLEMENTATION DETAIL, and report C's other findings (its section 6), have no row in section 18 and are cited to the [report](../research/open-points-C.md) itself.

| Point | What it was | Resolution |
|---|---|---|
| O1a | Which aligner and which speech-to-text engine | **Decided** (L10; C:M5-O1a). CTC forced alignment in Node with wav2vec2-base through ONNX and our own trellis alignment of the known script; Whisper `small.en` in Node through ONNX; both local; the ONNX files are exported once from the original weights (Apache-2.0 and MIT) by a pinned script in a throwaway Python virtual environment in WSL, as the first task of M5-03, and pinned by hash (L27 revised, L38). MiniMax `asr-1.0` is not used. That both run on Linux in WSL is ASSUMED and is M5-03's first task; the fallback is the WASM backend. |
| O1b | Where the aligner runs, since R0's Python worker has no designed protocol | **Left to the implementer** (C:M5-O1b). Safe because both engines run in Node, so no Python worker is needed, and R0 §3 already bounds one if it ever is. Keeping inference off the main thread is the implementer's choice (M5-03). |
| O1c | The capability ID and effect class for alignment | **Decided** (C:M5-O1c). `voice.align` in R5's catalogue, owned by R7, `pure` for a local engine; its work key adds the exact text sent and the model (M5-03). |
| O1d | Whether a failed alignment gives an `estimated` take | **Decided** (C:M5-O1d). Yes, with the failure as evidence; a `final` compile refuses it with `TAKE_TIMING_ESTIMATED`; no confidence threshold (M5-04). |
| O2a | How `R7-A2` measures alignment accuracy | **Decided** (L11; C:M5-O2a). Against signal onsets after pauses, as spike V1 did; no second CTC model is named or needed, and another aligner model is chosen only if the M5 calibration fails, after a licence check recorded in the M5 report (L39); word ends after L10's end rule. The word-level part of A-02 reports `UNKNOWN` with a coverage record (M5-09, M5-10). |
| O2b | What "accurate enough" means for word-by-word highlighting | **Measurement with a ruled rule** (L9; C:M5-O2b). `align.lipsync_min_fraction` = 0.95 (`director`) of word starts within −40 / +60 ms, a starting value calibrated by M5-10(b) on Linux; V1 measured 69 of 72. Until the result is recorded, cues stay phrase-level and highlighting stays off (R7 §2.2.4). Mouth shapes are M7's decision. |
| O3 | Music engine, score format, and who writes a score | **Decided** (C:M5-O3). A deterministic generator writes an `audio_score` component from the cue's `request` block; Director or human scores are validated and rendered; R7 owns the JSON score schema; M5-05 picks Tone.js offline or MIDI plus FluidSynth by a byte-repeatability test and licence registration. |
| O4 | Procedural effects: parameters from a `request`, and `sync_point` | **Decided** (C:M5-O4). A closed category list in the `sfx_request` schema, `SFX_UNAVAILABLE` for an unknown one; the preset and a seed from `variant` fix the parameters; `sync_point` is the end of the attack (M5-05). |
| O5a | `direction` cannot reach Kokoro | **Decided** (C:M5-O5a). Not sent and not refused: a warning, recorded in `engine.params`, and kept out of the work key (M5-02, M5-04). |
| O5b | Pronunciations through `input` | **Left to the implementer** (C:M5-O5b). Safe because the aligner aligns against the exact text sent and maps back to spoken tokens, so nothing outside the adapter changes. V1's notes on abbreviations and lexicon spellings are in M5-04. |
| O5c | R7 §2.2.9 rule 2's name screening has no mechanism | **Decided** (C:M5-O5c). The policy is met by refusal: only listed stock voices; any other voice or a `designed` profile gives `VOICE_UNAVAILABLE`; screening is built with the first adapter that accepts direction or design prompts (M5-04). |
| O6 | A stale selected take at compile time | **Decided** (C:M5-O6). The Resolve pass checks each selected take with `takeIsCurrent` and relays R7's `TAKE_SUPERSEDED`, `blocking/frozen` and `material` in `plan` mode (M5-04). |
| O7 | Caption diagnostics have no codes; no way to recognise a children's audience | **Decided** (C:M5-O7). `CAPTION_READING_SPEED`, `CAPTION_TOO_SHORT` and `CAPTION_TIMING_ESTIMATED`, `material` with `blocks: none`; the new `director` field `caption_track.audience`, default `general` (M5-07). |
| O8a | How OpenRouter speech spend is counted | **Decided** (L12; C:M5-O8a). From the generation look-up's `total_cost`, which satisfies U15; the provider is pinned through `voice.provider_only` (`human`), because an unpinned request went to a provider 6.45 times dearer in V1; PCM is requested; a take is stored once (M5-02, [spend](../04-spend.md) §1). |
| O8b | Which file holds both keys | **Decided** (lead, section 3 of the rulings; U23). The key location is `C:\Users\XZNON\cutroom-v2\.env`, which holds both `MINIMAX_API_KEY` and `OPENROUTER_API_KEY`, as confirmed on 15 November 2026 by listing variable names only. |
| report C §6 item 1 | M5-02's MP3 cross-check would fail on multi-sentence lines | **Decided** with L12, which records the PCM format as VERIFIED by V1: no MP3 cross-check on lines of more than one sentence, and the request-body test allows the `provider` field (M5-02). |
| report C §6 item 2 | Kokoro's takes are not byte-repeatable | **Decided** (L12): a take is stored once and never regenerated; with `X-Generation-Id` spooled, `reconcile` confirms billing through the look-up (M5-02). |

## 9. Acceptance list

| # | Command | Expected result |
|---|---|---|
| 1 | `npm run check` | Passes, with no dependency-edge violation |
| 2 | `npm test` | Passes with no network and no key, with the aligner and transcriber fakes and the normaliser's tests |
| 3 | `npm run test:render` | Placement, ducking, mastering (−14 ± 0.5 LUFS, exact sample count; after AAC −14 ± 1.0 LUFS, ≤ −1.0 dBTP; no `loudnorm`), burn-in, and F-01, F-02, F-03, F-09, M-03, M-04 on clean and faulty files pass; the aligner and transcriber run on Linux in WSL with the pinned models (M5-03) |
| 4 | `npm run test:accept` | A7 against the fake adapter and every earlier case still pass |
| 5 | `CUTROOM_LIVE=1 npm run test:live -- --test-name-pattern=A7` | Kokoro adapter: one charge after the kill; one presumed charge and one resend after a dropped reply; `failed` after a second loss |
| 6 | `CUTROOM_LIVE=1 npm run test:live -- --test-name-pattern="R7-A2\|R9-3"` | Both reports exist; the milestone report records `R7-A2`'s share against `align.lipsync_min_fraction` (L9), whether highlighting may be turned on, and the calibrated `align.word_end_offset_ms` and short-take settings |
| 7 | `CUTROOM_LIVE=1 npm run test:live -- --test-name-pattern=narrated` | The film exports through the staged `delivery_finalize` with aligned takes; F-01, F-02, F-03, F-09, M-04, A-01, A-03 pass; A-02's WER ≤ 0.15, its word-level part `UNKNOWN` with coverage (L11); sidecars exist; cues sit on the right frames |
| 8 | The first live speech fixture | Holds the PCM rate, sample format, channels and reply shape, and its look-up names the pinned provider |
| 9 | Ledger | M5 at most $0.29, each package within its ceiling, dollars for speech from the generation look-up; running total within $10 |
