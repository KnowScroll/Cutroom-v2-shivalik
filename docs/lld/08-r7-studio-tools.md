# Cutroom v2 — LLD · R7: Production Studio tools

**Decided:** 14 November 2026
**Status:** DECIDED by the lead session under the user's delegation of 14 Nov 2026. The items under "Decisions for the user" were decided by the user on 15 November 2026 ([integration decisions](11-integration-decisions.md) section 17). The design set was frozen on 15 November 2026 ([R10](10-r10-integration-acceptance-and-build-plan.md) section 6.4); this document may be revised during implementation.
**Baseline:** HLD [A6](../hld/01-phase-a-system-boundaries-and-ownership.md), [B2.2](../hld/02-phase-b-production-lifecycle-and-autonomous-quality.md), [C3, C5](../hld/03-phase-c-integration-contracts.md) · [roadmap](00-design-process-and-roadmap.md) · [R0](01-r0-framing-decisions.md) · [R1](02-r1-foundations.md) · [integration decisions](11-integration-decisions.md) · research [03](../research/03-animation-behavior-and-capability-growth.md), [04](../research/04-asset-retrieval-rights-and-preparation.md), [11](../research/11-provider-cost-and-audio-research.md) · spike evidence [log](../research/10-spike-evidence-log.md), [S3, S5, S6](../research/evidence/s3-s5-s6-minimax.md), [S4](../research/evidence/s4-render-host.md), [batch 2a](../research/evidence/b2a-colour-mux-mix.md), [S7](../research/evidence/s7-pixi-hardening-follow.md)
**Engines, decided by the user on 15 November 2026:** the voice engine is `hexgrad/kokoro-82m` through OpenRouter's Text-to-Speech API (U17, which replaces MiniMax speech-2.8, U1); music and sound effects are code-rendered music and procedural effects, with no AI music or sound-effect provider (U2). The adapters stay provider-neutral; §2.2.4 lists the candidates and the choice.

Persisted names are `snake_case`. Snippets are illustrative; R3 writes the schemas. Bare `S1`–`S7` are spikes in the evidence log; batch 2a is recorded in the integration decisions (§12) and the mastering spike M1 in the evidence log. R1 references include its Revision 1.

## 1. Problem and scope

The Production Studio is the HLD responsibility that makes a film's content. R7 designs the tools the Director and its workers call to build sound, direct character acting, acquire real media, research facts, bind data to charts and capture software screens. Audio, captions and character performance are designed in full; media acquisition, capture and charts at interface level (roadmap §1.5). Engine choice and publishing are out of scope.

Three rules apply to every tool.

1. **The Studio prepares, Project Core records, Rendering executes** (HLD A6).
2. **Every call is a capability invocation** (HLD C1) with pinned inputs and a work key (R1 §2.4).
3. **A model never produces trusted structure.** Our code validates every model output and repairs it from exact errors; in S5 an exact error fixed 4 of 4 invalid tool calls.

## 2. Decisions

### 2.1 One adapter shape for every external engine

An adapter is a plugin that wraps one provider or local engine behind a neutral interface.

```ts
// Illustrative
interface ProviderAdapter<Req, Res> {
  describe(): AdapterInfo;           // features, limits, licence, local or hosted
  estimate(req: Req): CostEstimate;  // before any spend
  submit(req: Req, work_key: string): Promise<Res>;   // work_key is the idempotency key
  reconcile(work_key: string): Promise<Res | "not_found" | "cannot_tell">;
}
```

- R7 owns seven families: `VoiceEngine`, `MusicEngine`, `SfxEngine`, `Aligner`, `Transcriber`, `MediaProvider` and `SearchProvider`.
- **Alignment is the capability `voice.align`** in R5's single catalogue, owned by R7 beside `voice.synthesize`. Its effect class is set by the adapter as for `transcribe`: `pure` for a local engine, which the chosen aligner is (§2.2.4), and `paid` for a hosted one. Its work key covers the audio hash, the exact text sent to the voice engine, the language, the adapter version and the model (as in §2.2.10), and R7 declares its resource vector, which is CPU work rather than the browser pool (decided: `lld/11` section 18, C:M5-O1c).
- Most audio engines are not repeatable, so a request carries a `variant` number; raising it changes the work key and bypasses the cache.
- A result carries an ArtifactRef. Ingest creates the `asset` entity that stored records reference.
- When `reconcile` answers `cannot_tell`, the job stays in the state `unknown_outcome` and R5's rule applies (R1 §4.3): adopt a complete response from the local spool, or else book the call as presumed charged and resend at most once.
- An engine whose licence forbids commercial use cannot be registered.

### 2.2 Audio

#### 2.2.1 Voice

A **voice line** is one stretch of speech by one speaker. A **take** is one performance of a line.

```ts
// Illustrative. The adapter's request and result; the voice_request tool adds the target (§2.9).
type VoiceRequest = {
  spoken_text: string; language: string; voice: Handle;   // a voice_profile
  direction?: Direction;                                   // style, pace, emphasis, tags
  pronunciations?: { token: number; say: string }[];
  variant: number;
};
type VoiceResult = {
  audio: ArtifactRef;
  samples: number; sample_rate: { num: number; den: number };   // measured by decoding
  words: { token: number; text: string; start: Flicks; end: Flicks; confidence?: number }[];
  timing: "native" | "aligned" | "estimated";
  engine: { adapter: string; adapter_version: string; model: string;
            voice: string; params: object; seed?: number };
  cost_usd: number;
};
```

**Word timing is labelled, not promised,** because several candidate engines return no word timestamps (research 11 §5.1). `timing` names the method for the whole take: `native` (from the engine), `aligned` (a forced aligner fitted the known script to the waveform) or `estimated` (spread by syllable count). `confidence` is a separate per-word value. A `final` compile requires `native` or `aligned` (`voice.final_timing`). When the aligner fails outright (an error, or words it cannot place), ingest still creates the take with `timing: estimated` and attaches the failure as evidence: previews and phrase captions keep working, a `final` compile refuses the take with `TAKE_TIMING_ESTIMATED`, and the Director repairs with a new variant or a pronunciation (§4). No confidence threshold is set, because spike V1 found that the per-word score flags a wrong word but scores correct names almost as low (decided: `lld/11` section 18, C:M5-O1d).

**Native timing is declared as `word_accurate` or `coarse` (K3).** A voice adapter declares which of the two its native timing is. The voice engine the user chose, Kokoro-82M through OpenRouter (U17, §2.2.4), returns no timing, so none of its takes is `native`: every take is `aligned` (U18). The `coarse` rule was written for MiniMax speech-2.8, which spike T1 measured and which is no longer the engine; it stays for any adapter that declares `coarse`. A `native` take from a `coarse` adapter has three consequences: its captions are cut at phrase level with word-by-word highlighting off (§2.2.7); its mouth shapes use the flap tier, tier 0 (§2.2.8); and the word-level part of R9's check A-02 reports `UNKNOWN` with a coverage record instead of a finding.

**Display and spoken text.** A line stores `display_text`, `spoken_text`, `bindings: {name: {ref, member}}` and a `token_map` between display and spoken tokens, so word times on spoken tokens reach display tokens. Neither text holds a factual figure as a literal: each uses a `{name}` placeholder resolved through `voice_line.bindings` to a claim or dataset value, which the one formatter renders ("$4.2M" shown, "four point two million dollars" spoken), so chart, caption and voice cannot disagree. Pronunciations are addressed by token; a word-wide rule is authoring sugar.

**Data** (R3 entity kinds).

| Entity | Main fields |
|---|---|
| `voice_profile` | origin (`preset`, `designed`, `procedural`), engine voice ID, design prompt, `rights`, owning character |
| `voice_line` | speaker, `display_text`, `spoken_text`, `bindings`, `token_map`, language, direction, pronunciations, claim references, `selected_take`, commitment |
| `take` | voice line, audio asset, `samples`, `sample_rate`, `words`, `timing`, `engine`, measured loudness |
| `music_cue` | `request` block (§2.2.2) or score, audio asset, stems, sections, beat grid, placement, gain keyframes |
| `sfx_cue` | `request` block (§2.2.3), asset, anchor event plus offset, `sync_point`, `sync`, gain, pan |

Cues carry no licence field: a licence lives only in the referenced asset's `rights` record.

**Takes as timing anchors.**

- Selecting a take is a patch (`take_select`). There is no separate acceptance fact: the accepted take is the one selected in the revision being compiled. A `final` compile also needs the line's commitment to be `frozen`.
- A take's duration is exact: `samples` times the flicks per sample (the flick is R1's time unit). Each line publishes `line.start`, `line.end` and one anchor per word (HLD C3), with a `provisional` duration estimated from its text until a take is selected.
- A text change supersedes the take and invalidates its captions, mouth track and anchored acting through their work keys. So does a corrected claim value, which changes the spoken text; a new take is then requested. A changed head pose does not.

#### 2.2.2 Music

A **beat grid** is the list of times at which beats fall, stored as a tempo map with a `source` and a `verified` flag. A `detected` grid also stores `beat_grid.beats`, the beat times in flicks from the cue's start.

- The cue's `request` block is R3's `{mood, target_duration, tempo_range: {min, max}, section_plan[], hit_points}`; `hit_points` are event references. `music_request` reads it.
- **The score.** `music_request` runs a deterministic generator, not a model, that writes an `audio_score` component (`music_cue.score`) from the cue's `request` block and renders it. A score component written by the Director or a human through a patch is validated and rendered instead; a failure is `SCORE_INVALID` with the validator's exact message. The score document is a constrained JSON score whose schema R7 owns: a tempo map, metre, sections, notes per instrument, instruments from a pinned CC0 sample set, and hit markers. The grid it implies is `authored`. Whether it renders through Tone.js offline or MIDI plus FluidSynth (run as a separate process) is chosen at M5 by a byte-repeatability test and licence registration. A model-written score would need a new worker role and is left for later (decided: `lld/11` section 18, C:M5-O3).
- `source` is `authored` (code-rendered music from a validated score, so the grid is exact), `declared` (a generative engine was told a tempo) or `detected` (beat tracking). An independent beat-tracking pass that agrees within `music.grid_tolerance_ms` makes a grid `verified`.
- Visuals may freeze only against an `authored` or `verified` grid; otherwise a `final` compile raises the compiler's `BEAT_GRID_UNVERIFIED`.
- Every cue enters the Render Plan as a frozen WAV artifact.

#### 2.2.3 Sound effects

The cue's `request` block is R3's `{description, category, max_duration, preferred_origin}`, with `preferred_origin` of `procedural`, `library` or `generated`; `sfx_request` reads it. The result carries a **sync point**: the offset of the moment, such as an impact, that should land on the event.

`request.category` is a closed list that R7 publishes in the `sfx_request` schema, drawn from the procedural engine's preset families; an unknown category gives `SFX_UNAVAILABLE`, and `description` is recorded but not interpreted. The preset and a random source seeded from `variant` fix the parameters, so the output is byte-identical for each request and variant. The `sync_point` is the end of the generated envelope's attack, which the parameters fix exactly, so nothing has to be measured (decided: `lld/11` section 18, C:M5-O4).

A picture event appears on the first frame at or after its time (R1 §1.5), so a sound at the exact event time could lead its picture by up to a frame. `sfx_cue.sync` therefore defaults to `presented_frame` when the anchor is a visual event: the reference is the start of the frame on which the event appears. Music hit points on visual events do the same. Otherwise `sync` is `sample` and the reference is the event time, as for voice. The clip starts at sample `round((reference − sync_point) / flicks_per_sample)`.

#### 2.2.4 Candidate engines and the user's choice

All entries come from research 11. On 15 November 2026 the user chose MiniMax speech-2.8 for voice (U1) and then replaced it with `hexgrad/kokoro-82m` through OpenRouter (U17), and chose code-rendered music and procedural effects, with no AI music or sound-effect provider (U2); only the code-rendered music and effect engines are built. The other entries stay as candidates for the provider-neutral adapters and must be re-verified if the user changes a decision.

| Need | Candidates |
|---|---|
| Voice, hosted | Kokoro-82M through OpenRouter (chosen, U17); MiniMax speech-2.8-hd or turbo (measured in spike T1; no longer the engine) |
| Voice, local | Kokoro-82M, Pocket TTS, Chatterbox Turbo or Nano, Phonon 31M, Qwen3-TTS, Dia or Dia2, IndexTTS-2.5 |
| Voice, procedural | Babble voices, pink-trombone-mod, eSpeak NG as a separate process |
| Alignment | CTC forced alignment in Node with a wav2vec2-base model through ONNX (chosen, L10); Montreal Forced Aligner, ctc-forced-aligner with a permissive model, whisper.cpp, transformers.js |
| Music | Code-rendered scores (Tone.js offline, MIDI plus FluidSynth) with CC0 samples; ACE-Step 1.5; Stable Audio 3; a paid API |
| Sound effects | jsfxr, ZzFX; Kenney, Freesound CC0, Sonniss; Stable Audio 3 Small SFX, MOSS-SoundEffect v2.0 |

**The voice adapter (Kokoro-82M through OpenRouter, U17).** The build uses `hexgrad/kokoro-82m` through OpenRouter's Text-to-Speech API, the engine the user chose on 15 November 2026 in place of MiniMax speech-2.8. The adapter sends `POST https://openrouter.ai/api/v1/audio/speech` with the headers `Authorization: Bearer` followed by the OpenRouter key (U18) and `Content-Type: application/json`, and a body of `model` (`"hexgrad/kokoro-82m"`), `input` (the text), `voice` (the voice profile's engine voice ID, one of the 54 stock voices the provider lists, such as `af_heart`, `am_onyx`, `bf_emma` or `bm_george`) and `response_format` (`voice.response_format`, `"pcm"`), plus `provider` (`{only: [voice.provider_only], allow_fallbacks: false}`), which pins the serving provider (decided: `lld/11` section 18, L12). The request has no other fields. The reply is raw audio bytes, not JSON: `Content-Type` gives the encoding (`audio/mpeg` or `audio/pcm`) and `X-Generation-Id` identifies the billed generation. Errors are JSON `{"error": {"code", "message"}}` with status 400, 401, 402, 403, 404, 429 or 502; on 429 the adapter backs off and retries, and a 502 is an upstream failure that is not billed. These facts are VERIFIED by source (OpenRouter's document, supplied by the user on 15 November 2026), and spike V1 confirmed them in 19 calls. V1 also measured the PCM format, signed 16-bit little-endian at 24 kHz, mono, and showed that pinning works, while unpinned routing once reached the dearer provider with different audio; the maximum input length and the rate limits stay ASSUMED (U18; decided: `lld/11` section 18, L12). **Spend** for each generation is read from OpenRouter's generation look-up (`GET /api/v1/generation?id=<X-Generation-Id>`, field `total_cost`), which satisfies U15 for speech. The intent reserves the characters times the pinned price beforehand, the key-level counter, which lags, is not used, and the pinned provider enters the `voice.synthesize` work key (decided: `lld/11` section 18, L12, C:M5-O8a). Output is not byte-repeatable, so a take is stored once and never regenerated to reproduce it (decided: `lld/11` section 18, L12). **Direction cannot reach this engine.** The adapter's `describe()` declares direction unsupported; `voice_request` accepts a line with direction, sends only the engine's fields, returns a warning that direction was not applied and records that in the take's `engine.params`. Direction stays out of this adapter's `voice.synthesize` work key, because it changes nothing that is sent (decided: `lld/11` section 18, C:M5-O5a). How pronunciations reach this text-only engine is left to the adapter's implementer, as `lld/11` section 18 leaves implementation details; the aligner aligns against the exact text sent. **The reply carries no timing of any kind,** so every take from this engine is `aligned`: the forced aligner is on the thin-film path and is built at M5, and the caption cues are cut from its word times. Whether word-by-word highlighting may be on is decided by the M5 alignment measurement (`R7-A2`). **Word timing and the transcript.** Word timing comes from CTC forced alignment in Node: a wav2vec2-base model (Apache-2.0) run through ONNX, with our own trellis alignment of the known script. The transcript R9's checks read comes from Whisper `small.en`, also in Node through ONNX. Both run locally, with no Python worker and no hosted speech-to-text; MiniMax's `asr-1.0` is not used. Their model files are never committed. Published ONNX conversions often state no licence of their own, so the build does not depend on them: the wav2vec2-base and Whisper `small.en` ONNX files are exported once from the original weights (Apache-2.0 and MIT) by a pinned export script during environment set-up, and the exported files are pinned by hash in `tools/pins.json` (decided: `lld/11` section 18, C:M5-O1a, L27 revised). The export is a one-time set-up step, the first task of build work package M5-03, run in WSL: the pinned script under `tools/models/` runs in a throwaway Python virtual environment inside the WSL tool folder, with its packages pinned, and produces the two ONNX files; later set-ups check the hash and skip the export when the files are present. This Python is a set-up tool only: the product's run time stays Node, and the Python worker of R0 is still not built (decided: `lld/11` section 18, L38). Spike V1 ran both on Windows; that they run on Linux in WSL is ASSUMED and checked by the first M5 work package, with the WASM backend as the fallback. CTC word ends came out about 83 ms early in V1, so a word's end is taken as the earlier of the next word's start and the aligned end plus `align.word_end_offset_ms` (80, calibrated at M5) (decided: `lld/11` section 18, L10). **MiniMax speech-2.8, kept as evidence.** Spike T1 found that MiniMax speech-2.8 returns timing below sentence level as sub-word tokens on a 42.67 ms grid, which could be merged into words by their character offsets, and in its one sample placed pauses 0.1 to 0.5 s from the pauses in the audio; under K3 that engine would be `coarse`. It is no longer the engine, and no MiniMax speech adapter is built (U18). The beat tracker is built with the first music engine that lacks an authored grid.

#### 2.2.5 Loudness targets

**LUFS** measures loudness as heard over a whole programme. **True peak** (dBTP) is the highest level the reconstructed waveform reaches between samples. No platform publishes an upload loudness target; third-party sources agree that YouTube normalises playback towards about −14 LUFS.

**Decision:** one short-form master at **−14 LUFS integrated**, limited to **−3.0 dBTP** and verified at no more than −1.0 dBTP after AAC encoding, which raises peaks (§2.2.6). The mix and the delivered audio are fixed at 48 kHz in v2; a delivery profile with another sample rate is rejected. R7 owns these targets as delivery-profile data (`delivery.audio.*`) and the tighter mastering tolerance `mix.master_tolerance_lu`. R9 owns the check tolerance, `loud.tolerance_lu`.

#### 2.2.6 The mix graph

The compiler writes the mix plan into the Render Plan: clips with source sample bounds, an output start sample, gain keyframes, fades and a bus. R7 lowers the plan to an FFmpeg filter graph, which the `audio.mix` capability executes.

1. **Prepare.** Decode each source once to 48 kHz floating-point stereo WAV and apply a fixed gain: takes to `mix.voice_line_lufs`, music and effects to their own levels.
2. **Place each clip to the sample** with `atrim`, `volume`, `afade` and `adelay` with the `S` suffix, which delays by an exact sample count (`all=1` is needed to delay every channel). Sum each bus with `amix=normalize=0`; the default rescales inputs.
3. **Duck the music under speech.** Ducking lowers one signal while another is present. `asplit` copies the speech bus: one copy is heard, the other keys `sidechaincompress` on the music, whose `mix` option bounds the drop (settings `mix.duck_*`). Batch 2a verified steps 2 and 3 (§8).
4. **Sum the buses,** then pad and cut (`apad`, `atrim`) to exactly `round(N·T / flicks_per_sample)` samples. `N·T` is the film's duration in flicks (R1 §1.4); a 48 kHz sample is 14,700 flicks. Stems are kept, so a changed effect re-runs only its bus and the master.
5. **Master with one static gain and a limiter.** Measure integrated loudness with `ebur128`. Apply one `volume` gain to reach `delivery.audio.loudness_lufs`. Limit with an oversampled `alimiter` (`aresample=192000`, `alimiter` with `level=false`, `aresample=48000`) at `delivery.audio.limit_dbtp`. Measure again and correct the gain until the master is within `mix.master_tolerance_lu`, for at most `mix.master_max_passes` passes. Then encode.
6. **Verify.** Measure the encoded file's decoded audio with `ebur128=peak=true` against `delivery.audio.verify_max_dbtp` and R9's `loud.tolerance_lu`. Loudness and true peak are corrective checks on the assembled film (R9 M-04) and hard checks on the final file. Decoded AAC may be up to one AAC frame (1,024 samples) longer than the mix, and the container duration may differ from the audio length by as much (R9 F-01).

**Two-pass `loudnorm` is not used.** On batch 2a's five synthetic mixes it fell back to dynamic mode, which varies gain over time, on four; in its linear mode it missed the target by 0.7 LU on a sparse mix; and AAC raised true peak by up to 1.5 dB on peak-limited material. Spike M1 (three synthetic mixes, FFmpeg 8.1.1; the spike M1 entry in the [evidence log](../research/10-spike-evidence-log.md)) verified the static-gain master: −14.05 to −14.10 LUFS, true peak at the ceiling and exactly 960,000 samples; after AAC, −14.05 to −14.37 LUFS and no higher than −2.29 dBTP with a −2.5 dBTP ceiling. The −3.0 default leaves room for the 1.5 dB rise.

MiniMax models cannot hear (R0 §4), so audio review rests on measurements and transcripts (§10).

#### 2.2.7 Captions

R7 owns the `captions.*` settings and the caption segmenter; R9's caption check (A-03) reads the settings. The segmenter builds cues from the selected takes' word times and the lines' `display_text`, so the text always comes from the script. A `derived` caption track stores no cues: the compiler calls the segmenter, a pure function, when it lowers the caption plan. `captions_build` runs it on request and, with `materialise`, stores the cues as an `authored` track for a human or the Director to edit.

**Segmentation rules, in order.**

1. A change of speaker, the end of a sentence, or a silence longer than `captions.pause_break_ms` ends a caption.
2. A caption holds at most `captions.max_lines` lines of `captions.max_chars_per_line` characters and `captions.max_words` words.
3. Lines break after punctuation or before a conjunction or preposition, and never split an article from its noun, a name, a number from its unit, or a verb from its auxiliary (Netflix style guide).
4. A caption runs from its first word to its last word plus `captions.linger_ms`, never past the next caption's start. A gap shorter than `captions.merge_gap_ms` is closed.
5. A caption shorter than `captions.min_duration_ms` merges with a neighbour where rules 1 and 2 allow.
6. Reading speed above `captions.max_cps` characters per second (`captions.max_cps_children` for a children's audience) raises a diagnostic. Captions are verbatim, so the repair is a slower take or a shorter line.

**Diagnostics and audience.** The segmenter's diagnostics are R7's codes `CAPTION_READING_SPEED`, `CAPTION_TOO_SHORT` and `CAPTION_TIMING_ESTIMATED`, which R4 relays unchanged when it calls the segmenter. Each is `material` with `blocks: none`, because A-03 is the corrective check that judges captions. A track's audience is `caption_track.audience`, `general` or `children` (default `general`), a `director` field under K6 because A-03 is corrective; the children's limits apply when it is `children` (decided: `lld/11` section 18, C:M5-O7).

**Cues and style.** A compiled cue carries its times, text, line breaks, word records, text direction, language and source take. An authored project cue is R3's `{start, end, line, tokens, direction?, language?}`; `tokens` is a display-token range `[from, to]`, and its text derives from the line. Style is trusted data, not a component reference: a preset (`phrase`, `word_pop` or `highlight`) and its parameters. The thin film cuts its cues from the takes' aligned word times, because the voice engine returns no timing (U17, U18); whether word-by-word highlighting may be on is decided by the M5 alignment measurement (`R7-A2`, §2.2.4). It may be on when at least `align.lipsync_min_fraction` (0.95) of the measured word starts fall within 40 ms early and 60 ms late; spike V1 measured 69 of 72 (decided: `lld/11` section 18, L9). Until the M5 measurement passes, cues stay phrase-level and highlighting stays off; mouth shapes are M7's decision (decided: `lld/11` section 18, C:M5-O2b). `caption_track.suppress` lists intervals, as event references, that the compiler clips out of the burned-in cues; sidecars keep the full cues.

**Burn-in and sidecar.** Burned-in captions are pixels in the video; a sidecar is a separate timed-text file. Both come from the same track. R2's trusted caption component draws burn-in on a screen-locked layer in the normal render path, so caption boxes are probed (a **probe** is R2's per-frame measurement of a tagged element), checked against safe zones and published as a region other producers avoid. FFmpeg's `subtitles` filter would add a second text engine with no probe data. `delivery_profile.captions` is `{burn_in, sidecars}`; the short-form default is burn-in on with WebVTT and SRT sidecars, because TikTok and Instagram reportedly accept no caption file and YouTube accepts both formats.

#### 2.2.8 Coarse mouth shapes

A **viseme** is a mouth shape that stands for a group of speech sounds. The `mouth` control takes Rhubarb Lip Sync's seven values, so a later audio-driven upgrade emits the same track: `A` closed, `B` slightly open, `C` open, `D` wide open, `E` rounded, `F` puckered, `X` at rest.

Deterministic code writes the mouth track, on the `derived` layer (§2.3.3), in the `take_select` patch. Tier 0 alternates `C` and `B` once per syllable. Tier 1, the default except for `native` takes from a `coarse` adapter (§2.2.1), splits words into syllables by spelling rules and maps letter groups to shapes across each word's interval. Tier 2, for later, runs Rhubarb (MIT) or a phoneme aligner on the frozen waveform. A shape holds for at least `mouth.min_hold_frames`, a gap longer than `mouth.closed_gap_ms` returns to `X`, and shapes lead the audio by `mouth.lead_ms`.

#### 2.2.9 Voice policy — decided by the user

This is not legal advice. On 15 November 2026 the user decided that there is no voice cloning at all, including the user's own voice, so this candidate policy is now the voice policy (U9, §10).
1. **No cloning.** A voice profile is `preset`, `designed` from a text description, or `procedural`; adapter cloning features are disabled.
2. **No imitation.** Direction text and design prompts are screened for names of real people; a match is a `policy` failure. With the Kokoro adapter this rule is met by refusal, not screening: only listed stock voice IDs are accepted, any other voice or a `designed` profile is refused with `VOICE_UNAVAILABLE`, no direction text reaches the engine (§2.2.4) and the engine has no cloning (U9). Screening of direction text and design prompts is built with the first adapter that accepts either (decided: `lld/11` section 18, C:M5-O5c).
3. **Historical figures** flagged `depicts_real_person` get a plainly invented voice.
4. **Disclosure and provenance.** Every deliverable records which audio is synthetic and which engine made it; each voice profile and take records its engine, licence and request. YouTube requires disclosure of realistic synthetic content, and TikTok is reported to. R9 owns the disclosure record.

Legal context (SECONDARY): EU AI Act Article 50 and Tennessee's ELVIS Act.

#### 2.2.10 The `Transcriber` adapter family

R7 owns the speech-to-text adapters. R9 uses them to check each selected take and the final file against the script.

```ts
// Illustrative
type TranscribeRequest = { audio: ArtifactRef; language: string; hints?: string[]; want_words: boolean };
type Transcript = {
  text: string;                                    // as returned; not normalised
  words?: { text: string; start: Flicks; end: Flicks; confidence?: number }[];
  engine: { adapter: string; adapter_version: string; model: string; params: object };
  cost_usd: number;
};
```

- Times are flicks from the start of the submitted audio; `hints` carries names from the project lexicon.
- The adapter returns raw text; normalising and scoring it belong to R9.
- `describe()` states the engine's duration and size limits. Longer audio is split at silences and the word times are offset.
- The `transcribe` capability's work key covers the audio hash, language, hints, adapter version and model, so a repeated check is a cache hit.
- An unsupported language or oversized file is a `capability` failure; a lost reply follows §2.1.
- R9 chose MiniMax `asr-1.0` as the starting default and whisper.cpp as the local fallback. The transcriber is now Whisper `small.en`, run locally in Node through ONNX (§2.2.4); `asr-1.0` is not used and no hosted speech-to-text is used (decided: `lld/11` section 18, L10).

### 2.3 Character performance

#### 2.3.1 Drawing and acting are separate

- A **character component** is the drawing: an R2 component whose `meta` declares **controls**, named and typed inputs such as gaze or mouth shape.
- A **control track** is the acting: keyframes over those controls, stored in the project. The compiler evaluates every track once, into per-frame tables in the Render Plan; at render time the host and the components interpolate nothing.

**Evidence.** In S2 no one-shot component produced the requested glance, return, glance sequence. In S6, with five characters exposing controls and three tracks written by MiniMax-M3, the double-take was visible on 5 of 5 characters with one track reused unchanged. Limits: one acting brief, judged on still frames.

**Decision.** `controls_track` is the default acting technique; `baked_performance` stays registered as a fallback.

#### 2.3.2 Starting controls vocabulary (`perf-vocab/1`)

| Control | Type | Values | Meaning |
|---|---|---|---|
| `pose` | enum | component-declared; includes `neutral` | Whole-body pose switch |
| `facing` | enum | `left`, `front`, `right` | Body orientation |
| `expression` | enum | `neutral`, `happy`, `sad`, `angry`, `surprised`, `skeptical`, `worried`, plus extras | Face preset |
| `mouth` | enum | `A`–`F`, `X` | Mouth shape (§2.2.8) |
| `gaze` | point | x, y in [−1, 1] | +x screen-right, +y down, zero looks at the viewer |
| `head_turn` | number | [−1, 1] | −1 fully left, +1 fully right |
| `brows` | number, nullable | [−1, 1] | −1 furrowed, +1 raised |
| `eyes_open` | number, nullable | [0, 1] | 0 is closed |
| `arm_l`, `arm_r` | enum | `down`, `hip`, `point`, `raise`, `wave`, `hold`, `shrug`, plus extras | Arm pose switch |
| `hand_l_target`, `hand_r_target` | point, nullable | component coordinates | Optional. Where a hand should be, on a rig that uses the IK helper (§2.3.7) |
| `lean` | number | [−1, 1] | −1 back, +1 towards the facing side |

- **Core set:** `pose`, `facing`, `expression`, and `mouth` if the character speaks. A component that offers any other control must use these names and meanings, so a track ports between characters.
- **Simple pose switches stay valid.** A character with only the core set has a track of enum channels; this is the cheapest technique and often the right one.
- **Controls are always passed complete.** Every declared control is passed on every `seek`. An unkeyed control receives its `meta` default, or `null` if declared `nullable: true`; `null` means automatic.
- **Face layering.** `expression` supplies the face. A keyed `brows` or `eyes_open` replaces that feature, and `null` lets the expression decide. `mouth` at `X` is the expression's resting mouth.
- **Placement is not a control.** Position, scale, rotation and opacity are `transform.*` channels on the layer, so spatial contracts and probes see them.
- Component-specific extras take an `x_` prefix and are not portable.

**Every declared control gets a response check** in R2's validation ladder (step V3; R9's check C-07), the optional hand targets included. S6's automated check measured only whether pixels changed, and it passed arm controls that were wrong on 2 of 5 characters: an arm crossed the body, left the frame or hid behind the torso. The check has four parts.

1. **Test values** are each control's extremes, including every option of an enum.
2. **Change and return.** Each test value changes the picture, and the neutral pose rendered afterwards matches the first.
3. **Probe expectations,** which R7 supplies for each vocabulary control. Tagged parts respond as the vocabulary says: pupils move with `gaze`, brows rise with `brows`, the eye closes with `eyes_open`, and a hand is visible, unclipped, in frame and where the arm pose or its hand target puts it. Whether this catches arm faults is ASSUMED (spike R7-A9).
4. **A response sheet** of the neutral pose beside every test value goes to the Reviewer as the control-extremes cells of R9's first component review. S6's arm faults were found by reading such a sheet.

#### 2.3.3 The control track

**Authoring form.** The performance author writes times in R1 authoring units (`eruption.start+650ms`), may give a time relative to the previous key with a leading `+` (`+80ms`), and names an object (`presenter`) as `target`. All of this is authoring sugar that the tool layer resolves before storing.

**Stored form.** A track targets a layer or a camera; `"presenter"` resolves to that object's layer in the shot. Key times are flick offsets from the track's `origin` event. Channel keys are nested by namespace: `channels.controls.gaze`, `channels.transform.x`, `channels.filter.blur`, and `channels.camera.x` on a camera. A layer has three namespaces: `controls.*` for component controls, `transform.*` (`x`, `y`, `scale`, `rotation`, `opacity`) for placement and `filter.*`, whose static value is `layer.filter`. A layer may also carry the step channel `follow.leader` (§2.3.8).

```jsonc
// Illustrative; two keys shown. 80 ms is 56,448,000 flicks.
{ "kind": "control_track", "target": "<the presenter's layer>", "layer": "acting", "label": "double-take",
  "origin": {"event": "eruption.start", "offset": 458640000},
  "channels": { "controls": { "gaze": { "interp": "linear", "keys": [
      {"at": 0, "value": [0, 0]}, {"at": 56448000, "value": [0.9, -0.1], "ease": "out"} ] } } } }
```

- **One easing schema,** owned by R4's evaluator: `step`, `linear`, `cubic_bezier(x1, y1, x2, y2)` and named presets that alias cubic-bezier curves. A key's `ease` shapes the segment arriving at it; enum channels step. Overshoot presets such as `out_back` are allowed, and a bounded control is clamped to its range after easing.
- **Four layers.** `base` (seeded idle blink and breathing), `derived` (mouth from the take, gaze following an anchor), `acting` (authored) and `override` (a locked edit). The highest layer with a key wins. Two tracks on one layer writing one control in overlapping intervals raise `CONTROL_CONFLICT` at compile. Deterministic code writes `base` and `derived`; a model writes only `acting`.
- **The `shift` mode** of `performance_author` takes a `track` handle, `from` and `delta`. It inserts on every channel a hold key at `from` that repeats the value there, then moves all later keys by `delta`. S6 showed why: an M3 edit that changed only key times made the move slower, not later, while the hold-key edit left 17 of 17 compared frames pixel-identical at the shifted time.

#### 2.3.4 Authoring a track against the brief and the event schedule

1. The Director writes a performance direction for a beat, as plain text plus event references, and calls `performance_author`.
2. A worker on MiniMax-M3 with thinking on receives a pinned bundle: the control manifest, the response sheet, the shot's solved event schedule with word anchors, the character's on-screen size, the direction and matching recipes.
3. It answers once: acting beats (anticipation, action, hold, settle), each tied to an event, then keyframes. In S6, 3 of 3 tracks were valid at the first attempt, for about half a cent each.
4. **Validation.** Controls and enum values exist; values are in range; times resolve in order; no key falls in a locked interval; holds last at least `acting.min_hold_ms`; each channel stays under `acting.max_keys_per_second`. Exact errors return to the author, up to `acting.repair_attempts` times.
5. **Probe checks on a low-resolution render.** The pupil box moves as the gaze keys ask and the mouth box follows the mouth track. Eyes smaller on screen than `acting.min_eye_units` make gaze keys a readability warning.
6. **Review (R9), then bounded repair.** The evidence is R9's event strip, consecutive frames `sheet.strip_spacing_ms` apart centred on each acting beat, or optionally a slowed inspection clip. Evenly spaced contact sheets are not used: in S6 the double-take was visible at 120 ms spacing and invisible on all 15 such sheets. The Reviewer is fallible evidence (§8).

The Render Plan holds the evaluated track; the renderer never invents choreography (HLD C7).

#### 2.3.5 Recipes and the acting-technique registry

A **recipe** (an R3 entity kind) is a reusable, parameterised piece of acting: semantic tags (`double_take`), required controls, parameters, a keyframe template relative to a trigger, a fallback for pose-only characters, evidence and a status (`seed`, `candidate`, `validated`, `retired`). The author looks recipes up by tag and may adjust them; outcomes are written back as evidence. The registry is advice, and fresh authoring is always allowed.

Registered acting techniques: `controls_track` (the default), `pose_switch`, `baked_performance` (acting written inside the component, driven by event times passed as parameters) and `prop_or_camera_substitute`.

#### 2.3.6 The capability-gap flow

A gap is a track or recipe needing a control or enum value the component does not declare. It reaches the Director as the compiler's `CAPABILITY_GAP` diagnostic, which carries the feasibility state and is not a failed job, or as a performance-author outcome that is `blocked` with class `capability`. The Director chooses, in rising order of cost:

1. **Substitute:** existing controls or the recipe's fallback.
2. **Extend:** `component_author` on a candidate branch, given the current code and a control specification. It returns search/replace edits, which applied cleanly in S3. The new version must pass R2's validation ladder with the response check, a **regression check** (at stored test values of the old controls it matches the old version within `capability.regression_psnr_db`; PSNR measures how close two images are) and a Reviewer comparison with accepted poses.
3. **Change technique:** a prop move, a camera move or a cutaway.
4. **Ask the Experiment Agent** when the outcome is unclear.
5. **Report unresolved,** with evidence, once `capability.extend_attempts` or `capability.budget_usd` is used up.

The accepted head keeps the old component hash until the branch is merged. S6 did not test extension, so "without drift" is ASSUMED (spike R7-A4).

#### 2.3.7 Character techniques

The component contract is technique-neutral: anything that runs behind `seek(t, controls)` in the sandboxed page is allowed, and `meta.technique` tags what a component uses. Every technique exposes the same vocabulary, so a track does not depend on how the character is drawn.

| Technique (`meta.technique`) | What it is | The right choice when |
|---|---|---|
| Pose switch (`svg`, `html`, `canvas2d`) | A few whole drawings selected by enum controls | Reactions and holds, small characters, tight budgets. Start here |
| Sprite sheet (`sprite_sheet`) | One image holding many frames or poses; `cut.sprite(sheet, frame)` draws one | Frame-by-frame cycles such as a walk, or drawings too detailed to parametrise. Sheets are baked from code-authored drawings or imported with rights records, never image-generated. A sheet up to `component.inline_asset_max_bytes` (2 MB) is inlined into the sealed component as a `data:` URL |
| Puppet rig (`puppet_rig`) | Parts joined at pivots. Inverse kinematics (IK) finds the joint angles that put a limb's end on a target; `cut.ik.two_bone` solves an arm or leg | A hand or foot must reach a point: pointing at a diagram, holding a prop, a contact. The track keys a hand target |
| PixiJS scene (`pixi_scene`) | A WebGL scene drawn by a library from R2's trusted library registry | Ready-made filters save hand-written code. Optional, never the default |

- Use the simplest technique that reads on screen (AGENT.md).
- Libraries are declared in `meta.libraries` and never loaded from the network; hand-written WebGL stays a lint error.
- **Measured in S7.** Sprite-sheet animation and a two-bone IK arm are deterministic and cost about 27 ms per frame in Canvas 2D or SVG with no library, so `cut.sprite` and `cut.ik.two_bone` are plain helpers. PixiJS (8.23.0, pinned in R2's registry; `Assets.load` is a lint error) is admitted but optional: under software rendering it was slower than hand-written Canvas 2D in every comparison, and a render unit holds at most one PixiJS component (`pixi.max_per_unit`).
- Model-written rigs and sprite sheets are untested (ASSUMED). Pose switches and plain controls, which S6 tested, are the safe path.

#### 2.3.8 Held props and anchor-follow layers

A held prop needs the character's hand anchor on every frame. Two choices are valid.

- **Its own component (DECIDED; VERIFIED by S7).** The prop's layer carries the `follow` step channel (`channels.follow.leader`), each key a `{layer, anchor}` or none, and follows the current leader's anchor. Within one frame the host seeks the leader, reads its probe anchor, places the follower, seeks it and captures. S7 found the placement exact at negligible cost (§8). Chains stop at `follow.max_depth` (2).
- **Inside the character component,** the simpler choice: the component draws the held prop itself, switched by an `x_` control or a parameter.

**A prop hand-off** is a key on the `follow` channel: at the hand-off event the prop changes leader. R9's P-11 measures the distance between the old and new anchors at the switch frame.

### 2.4 Media acquisition and rights (interface level)

**Media need.** A `media_need` entity records what is wanted, not a search string: content class, subject, visible action, factual role (`evidence` or `atmosphere`), minimum length, framing, things to avoid, and a **use profile** (commercial, derivative, and ShareAlike acceptable or not, copied from the `human` setting `rights.share_alike_ok`).

**`MediaProvider` contract.** Three calls, none of which downloads media: `search(need)` returns candidates with the provider's metadata copied verbatim; `inspect(candidate)` returns rights evidence (licence identifier, creator, attribution text, public-domain flag, record URL) and the renditions; `plan(candidate, rendition)` returns one URL, the expected type, a size ceiling, required headers and the provider's rate rule.

**The rights state machine is the single rights vocabulary.** R3, R4 and R9 use these six states and no others: `candidate → evidence_collected → eligible | restricted | unresolved`, and from any state `revoked`.

- A **rule table** computes the state from the licence identifier and the use profile. `rights.status` is a `system` field (R3): only the rule table's code writes it. A model extracts evidence fields and never sets the status. The rule table writes as the module actor `rights`; the research module's quote check (§2.5) writes as `research` and the beat tracker (§2.2.2) as `beat_tracking`, each through Project Core's `system_write` (decided: `lld/11` section 18, B:O11).
- Starting rules: CC0, public-domain marks and CC BY (with attribution) are `eligible`; CC BY-SA is `restricted` unless the profile accepts ShareAlike; non-commercial and no-derivatives licences are `restricted`; an unknown licence is `unresolved`.
- Further starting rules for an authored-only closure: OFL-1.1 (every pinned font), MIT and Apache-2.0 (trusted libraries such as PixiJS 8.23.0) are `eligible`, and so is a system-generated origin, with no attribution, which covers code-rendered music and procedural-effect assets made by a registered engine (§2.1 already requires its licence to allow commercial use). Each R-01 record still carries its original hash and attribution. Rights rules are `human` (G15 (d)), so this seed is reported to the user together with the next entry (decided: `lld/11` section 18, C:M6-O6a).
- Kokoro-82M speech through the pinned provider (`voice.provider_only`) is `eligible`, on the model's Apache-2.0 licence (research 11). That the provider's terms place no further limit on the output is ASSUMED and reported to the user (decided: `lld/11` section 18, L14).
- **Fields each state requires** (Project Core's `RIGHTS_FIELDS_REQUIRED`). `candidate` and `revoked` require nothing more; a takedown keeps the record. `evidence_collected`, `restricted` and `unresolved` require `licence.id` (the value `unknown` is allowed) and at least one `basis` source. `eligible` requires those and also `attribution.required`, `attribution.text` when attribution is required, `scope.commercial` and `scope.modify`. This is the starting rule; it is confirmed or corrected when the rule table is seeded at M6 (decided: `lld/11` section 18, B:O10, L3).
- An identifiable person, a trademark or a photograph of a three-dimensional artwork makes a record `unresolved`, which no rule upgrades silently. An `unresolved` asset is resolved by a human decision or by substituting another asset.
- Any asset not `revoked` may stand in as a layout proxy. Delivery requires `eligible` for every imported asset, as a hard check (HLD C5); promotion is unaffected.
- **Identity is separate from rights.** An asset used as evidence carries an identity claim with a verdict; a museum's own object record is strong evidence and a free-text description is weak.
**One fetch transport, two policies.** **Server-side request forgery (SSRF)** makes a server fetch an address an attacker chose, often an internal one. Every outbound Studio request goes through one transport that follows OWASP's guidance:

- `GET` over `https` only, or `http` where a provider needs it, with credentials from a broker.
- Resolve every address record, reject private, loopback, link-local and metadata addresses, and connect only to the validated address while keeping the hostname for TLS. This defeats DNS rebinding.
- Re-validate every redirect hop, up to `fetch.max_redirects`.
- Enforce a byte ceiling (`fetch.max_bytes_*`) and timeouts while streaming. R5's per-host limiter applies the provider's rate rule, or `fetch.per_host_interval_ms`.

Two policies sit on the transport.

- **`document`** (`fetch.document`; the researcher's `web_fetch` and provider API calls) accepts HTML, plain text and JSON. Nothing is executed or rendered; HTML is reduced to plain text and stored as a snapshot.
- **`media`** (`fetch.media`; `media_acquire` only) accepts media types confirmed by file signature that match the adapter's `plan`, and refuses HTML, SVG, archives and playlists. FFmpeg decodes in a child process with resource limits and no network.

The capture browser's requests pass the same address rules.

**Provenance and selection.** A provenance record holds the provider's record URL, the hash of the original bytes, the retrieval time, the rights evidence, the identity claim and each derived file with its tool and settings. Attribution lines go into a credits manifest shipped with the deliverable. A video gets in and out points, proposed by a model from sampled frames and stored in the source's timebase (R1 §1.7).

**Placing real media.** A real image, clip or capture is placed with `layer.source`: `{media, crop?, fit}` or `{capture, steps}`; `fit` is `contain`, `cover` or `fill`. The display crop is `layer.source.crop`, in source pixels (R1 §3.4), applied once. A crop change is a new layer version, not a new asset; derived assets exist only for destructive preparation such as transcoding. Named anchors on an asset come from `media_annotate` (§2.9).

**Four open-access sources, checked 14 November 2026.** None needs a key.

- **Wikimedia Commons** (MediaWiki API): per-file licence in `extmetadata`, with no warranty, so each file is verified. A User-Agent with contact details is required.
- **The Met Collection API:** use only objects whose `isPublicDomain` is true; at most 80 requests per second.
- **Art Institute of Chicago API:** `is_public_domain`; 60 requests per minute; a contact email header is requested.
- **NASA Image and Video Library:** NASA's media guidelines apply: no implied endorsement, protected insignia, and permission needed to use identifiable people commercially.

A contact identity is personal information and is never sent without the user's say. On 15 November 2026 the user decided that no contact address is sent to any service (U5, §10), so `fetch.contact_identity` stays unset and the Commons and Art Institute adapters are registered but disabled. The user also decided that ShareAlike media is not accepted (U4). The science and art-history golden briefs use NASA and museum sources, which need no contact identity and no ShareAlike licence.

### 2.5 Research tools

**Claims and sources are project entities.**

- A `source` records its URL, retrieval time, text snapshot and `quality_tier` (`primary`, `reputable`, `tertiary`, `unknown`). Entities created from web text carry `trust: untrusted_web`. A source of type `user` covers figures the brief supplies.
- A `claim` records its statement, its `values`, supporting quotes and a status: `supported`, `simplification`, `interpretation`, `fiction`, `unverified` (no adequate support yet), `disputed` (sources disagree) or `refuted` (the evidence contradicts it).
- `claim.values` is the single home of a factual figure. Lines, dataset cells and labels bind to it by reference, so a corrected value changes the chart and caption at the next compile and supersedes the take (§2.2.1).

**Workflow.**

1. The Director has no web search or fetch tool; it calls `research_request`.
2. A researcher sub-loop searches through a `SearchProvider` and fetches pages with `web_fetch` under the `document` policy.
3. It proposes claims, each with a quoted span. Our code confirms each quote appears verbatim in the snapshot, or rejects the claim. This quote check is an operation of R7's research module, which the researcher sub-loop in R6 calls; the check writes `claim.support` and the `supported` status, and the harness does not write them (K2).
4. A numeric or essential claim needs `research.min_sources_for_numbers` independent sources (two); other claims need one. Two pages from one publisher count once. R9's K-01 enforces the same rule, and a `user` source satisfies it.
5. The Director accepts claims by patch.

**Search.** The default `SearchProvider` is MiniMax's `web_search` server tool (type `web_search_20250305` on the Anthropic-compatible endpoint). It runs on MiniMax's servers, returns results inside the model turn, is in Beta and may stop with `pause_turn`.

**Untrusted content.** Fetched text is capped and returned as tool-result data inside markers naming its origin. Search results reach the model before our code sees them, so labelling is not enough: only the researcher sub-loop sees web text, and it can only propose claims and sources.

### 2.6 Data charts (interface level)

- A `dataset` entity is a typed table in canonical JSON with column types, units, source and claim references. A cell is a literal value for non-factual data only, or `{ref, member}` referencing a claim value (R3).
- A chart component declares its data parameters in `meta.params` (R2's schema of a component's fixed inputs) and never holds data as literals. The **binding** is the layer's `params`: member references into a `dataset` or a `claim`, plus a shared `format` record (decimals, unit, rounding) that captions and spoken numbers also use. The compiler resolves the references to values in the Render Plan, so a changed figure changes the work key and the chart re-renders.
- A chart or label bound to a claim or dataset must be an `svg` or `html` component, whose elements R2's shim measures itself (`LINT.CLAIM_BOUND_CANVAS`).
- **Probe payload.** R2's probe item has an optional typed `data` payload, which a chart supplies through `cut.mark(id, rect, {text?, data?})`. Each mark reports `data.value`. Each chart reports one `scale` item: the domain, the pixel range and the baseline.
- **Checks** on the final frame of the reveal, run by R9:
  - each mark's `data.value` equals its bound value (K-02), and each label's text equals the formatter's output (P-07);
  - each mark's measured length or position matches its value projected through the `scale` item, within R9's `chart.geometry_tolerance_fraction` (K-04);
  - a bar chart's baseline is zero unless the binding declares otherwise;
  - order matches the binding, and stated totals sum.

The geometry check matters most: one of S3's validator-passing charts drew bars of almost zero height. Probes cost under 1 ms per frame (S4), so the checks can run on every frame.

### 2.7 Software-tutorial capture (interface level)

- **Input:** a validated list of steps, not model-written code: `goto`, `click`, `fill`, `type`, `press`, `hover`, `scroll`, `wait_for`, `assert_text`, `snapshot`.
- **Execution:** the `capture_run` tool has effect `job`: it submits the `capture.run` capability, which drives `puppeteer-core` in R5's `capture_browser` pool. Puppeteer's Locator API waits until a target is visible, enabled and stable. The capability's effect class is `external_interactive`, because the run clicks and types on real sites. An interrupted attempt is repeated automatically only if its script declares itself repeat-safe; otherwise it ends `failed` with class `policy`.
- **Session timing.** A `capture_session` stores its frames as `{pts, ArtifactRef}` on a 1/1000-second timebase: `pts` is whole milliseconds from the session start, and one millisecond is exactly 705,600 flicks. A frame is shown until the next frame's `pts`. Step events carry the same timestamps, with the action, selector, the target's box in capture pixels, URL and viewport.
- **Frames:** one lossless still after each step settles (`screen_capture.settle_ms`), and one per character for `type`.
- **In the film:** R2's trusted media component shows the frame set. Each step is a named event that a time map (R1 §1.6) places and retimes, so narration, callouts and zooms are written as "event plus offset". Callouts anchor to logged boxes (R1 §3.4). A trusted component draws the cursor from the log, so cursor timing changes without recapturing.
- **Revision:** each step stores assertions, which are re-run before delivery (R9's corrective check S-01); when the product changes, the failed step and its dependants are recaptured.
- **Permission.** On 15 November 2026 the user decided that no third-party software is captured (U6, §10). `capture_run` refuses any origin not in `screen_capture.allowed_origins`, a `human` setting that is empty; the tutorial brief at M10 needs the user to add a site first.
- **Limits:** browser-reachable web applications, no logins by default; live sites are not repeatable.

### 2.8 Short guidance for kinetic typography and diagrams

**Kinetic typography.** Text is a parameter, never a literal in code, so an edit or translation is a patch. Each word carries `data-cut-id`; probes check overflow, safe zones and minimum size, and rendered tokens are compared exactly with the parameter text. S3 produced invisible and 11-pixel letters in components that passed the validator. Timing comes from word anchors or the beat grid. Where on-screen type shows the spoken words verbatim, the interval goes into `caption_track.suppress`.

**Diagrams.** Each labelled part is a tagged element whose anchor is published in the scene context, so pointers and callouts can target it (HLD C3). Label text is a parameter and binds to a claim where it states a fact (§2.6). Build-up is an integer `step` control keyed to narration anchors.

### 2.9 The Studio tools

These eleven tools are registered through R6's plugin model. R6 owns the catalogue; R7 owns each contract below.

- **Every request names its target entity and a base revision.** A job artifact is cached under its work key. Its patch proposal is merged only if the worker's read set, compared by `pin_hash`, is unchanged on the target head; Project Core returns the changed entities otherwise (FR10).
- **Effect classes** are R6's: `propose` writes a patch within the caller's grant, `job` submits Scheduler work, `external_paid` spends only through a Scheduler job with an intent record, and `network` uses the fetch transport. `external_interactive` is a capability's class, not a tool's (§2.7).
- **Errors.** The table lists R7's codes. Every tool can also return harness codes (`SCHEMA_INVALID`, `BUDGET_EXCEEDED`) and Project Core codes (`UNKNOWN_ENTITY`, `STALE_BASE`, `LOCKED`). R7's fetch module defines `URL_NOT_ALLOWED`, `FETCH_FAILED`, `TOO_LARGE` and `MEDIA_TYPE_MISMATCH`; R6 relays them unchanged, so `web_fetch` returns the same codes.
- The Director and the Experiment Agent may call all eleven; the researcher none.
- A parameter that is not typed down to every leaf, such as `dataset_register`'s table, whose cells are literals or claim references, travels as JSON text on MiniMax under R6 D7's encoding rule.

| Tool | Target and input | Output | Effect | R7 errors |
|---|---|---|---|---|
| `voice_request` | `voice_line`; `variant`; optional voice and direction overrides | Job; then an unselected `take` on the line | `external_paid` | `VOICE_UNAVAILABLE`, `VOICE_POLICY`, `LINE_NOT_SPEAKABLE` |
| `take_select` | `voice_line`; `take` | Revision with `selected_take` and derived mouth tracks; the invalidated captions and tracks | `propose` | `TAKE_NOT_FOR_LINE`, `TAKE_SUPERSEDED` |
| `music_request` | `music_cue`, whose `request` block it reads; `variant` | Job; then the audio asset, stems and beat grid | `external_paid` | `MUSIC_UNAVAILABLE`, `SCORE_INVALID` |
| `sfx_request` | `sfx_cue`, whose `request` block it reads; `variant` | Job; then the audio asset and `sync_point` | `external_paid` | `SFX_UNAVAILABLE` |
| `captions_build` | `caption_track`; `materialise` | The cues, with diagnostics for reading speed, short cues and `estimated` timing (`CAPTION_READING_SPEED`, `CAPTION_TOO_SHORT`, `CAPTION_TIMING_ESTIMATED`, §2.2.7). With `materialise`, a revision that stores them and sets the track to `authored` | `propose` | `CAPTION_SOURCE_MISSING` |
| `performance_author` | `mode: author`: a layer, a direction and event references. `mode: shift`: a `track` handle, `from` and `delta` | `author`: job, then a proposed `acting` track with evidence. `shift`: the patch, with no model call | `job` | `KEY_IN_LOCKED_INTERVAL`, `SHIFT_NO_ROOM`; relays R4's `UNKNOWN_CONTROL` |
| `media_search` | `media_need`; providers; limit | Candidates with verbatim metadata, rights evidence and a computed rights state | `network` | `PROVIDER_DISABLED`, `PROVIDER_FAILED` |
| `media_acquire` | `media_need`; candidate; rendition | Job; then an `asset` with provenance, rights state and identity claim | `network` | `RIGHTS_EVIDENCE_MISSING`, `URL_NOT_ALLOWED`, `TOO_LARGE`, `MEDIA_TYPE_MISMATCH`, `FETCH_FAILED` |
| `media_annotate` | `asset`; the anchors wanted | Job; then named anchors on the asset, proposed by a vision worker and stored after a crop review confirms them | `job` | No codes of its own; relays Project Core's and the worker's (G13) |
| `dataset_register` | `dataset`; table, column types, units, source and claim references | Revision with the dataset | `propose` | `DATASET_INVALID`, `DATASET_SOURCE_MISSING` |
| `capture_run` | `capture_session`; script, with its repeat-safe declaration if any; viewport | Job; then the frame set, event log and assertion results | `job` | `CAPTURE_SCRIPT_INVALID`, `CAPTURE_ORIGIN_NOT_ALLOWED`, `CAPTURE_ASSERTION_FAILED` |

`TAKE_SUPERSEDED` is also raised at compile time: the compiler's Resolve pass checks each selected take with R7's `takeIsCurrent` through its declared interface, and relays the code unchanged for a take whose `spoken_text` no longer matches its line. It is `blocking`/`frozen`, and `material` in `plan` mode, as `CAPTION_TEXT_MISMATCH` is; the selected take is not cleared, so the cause stays visible until a new take is selected (decided: `lld/11` section 18, C:M5-O6).

`take_select` and `captions_build` are conveniences over `project_patch` that add derived data and checks. A local engine costs nothing but takes the same `external_paid` path. `shift` refuses a negative `delta` that would make keys cross.

## 3. Interfaces to other stages

| Stage | R7 needs from it | R7 gives it |
|---|---|---|
| R2 | `nullable` controls; `meta.params`; the response check; the probe `data` payload; `cut.sprite`, `cut.ik.two_bone`, inlined sprite sheets, the library registry; anchor-follow layers; trusted media, caption and cursor components | The controls vocabulary with test values and probe expectations; caption cues and styles; capture frame sets |
| R3 | The four new entity kinds; the fields named in §2; the claim, rights and recipe vocabularies | Engine results in those shapes |
| R4 | Track evaluation; the easing schema; `CONTROL_CONFLICT`, `BEAT_GRID_UNVERIFIED`, `CAPABILITY_GAP`; `sync: presented_frame`; the mix and caption plans | Anchor names; take durations; caption regions; the caption segmenter as a pure function; the FFmpeg lowering of the mix plan |
| R5 | Intent records and the lost-reply rule; the per-host limiter; the `capture_browser` pool; the `external_interactive` capability class and its interrupted-attempt rule | Adapter `estimate` and `reconcile`; provider rate rules |
| R6 | The plugin model; the researcher sub-loop; `research_request`, `component_author`, `web_fetch` | The tools in §2.9; the fetch transport and its error codes; `SearchProvider` |
| R9 | Reviews and event strips; the loudness and chart-geometry tolerances; checks P-11 and S-01 | The `Transcriber` family; `captions.*` and `delivery.audio.*`; audio measurements; rights states; response sheets and acting strips |

## 4. Failure handling

Classes are those of R1 §4.3. `unknown_outcome` is a job state, not a class.

| Failure | Class | Handling | HLD case |
|---|---|---|---|
| Paid audio call: reply lost | None; job state `unknown_outcome` | `reconcile`, then R5's rule (§2.1) | C11 crash after external effect |
| Take misreads the script or lacks word times; master misses its targets | `creative`, `capability`, `deterministic` | New variant or pronunciation; aligner; a gain correction within `mix.master_max_passes` | — |
| Line text changes after a take is selected | — | Take superseded; captions, mouth and anchored acting invalidated | B4 comedy |
| Final file has no audio or the wrong audio length | None; the mux returns its file | F-01 or F-02 fails on the file. Quality quarantines it, which permits one re-run; a second failure leaves `blocked` (R9 §4) | C11 missing audio |
| Visuals reference an unverified beat grid | Diagnostic `BEAT_GRID_UNVERIFIED` | Verify the grid or repair the time map | C11 abstract |
| Track needs a missing control | Diagnostic `CAPABILITY_GAP` | Gap flow; a failed branch is discarded, evidence kept | B4 failed experiment |
| A control fails its response check | `deterministic` | Repair through R6's author loop | — |
| Acting correct but unreadable | `creative` | Change pose, framing or timing | C11 comedy |
| Footage shows the wrong subject | `policy` | Identity refuted; dependent claims and labels flagged | B4 maglev |
| Imported asset not `eligible` at delivery | `policy` (hard) | Substitute or change treatment, or a human resolves an `unresolved` asset; a non-`eligible` asset is never delivered. Promotion is unaffected | C5 |
| A claim value is corrected | — | The chart and caption change at the next compile; the take is superseded | B4 data reel |
| Artwork crop changes | — | A new layer version; anchors re-projected; rights and audio kept | C11 art history |
| Captured product changed | `deterministic` | Recapture the failed step and its dependants (R9's S-01 re-checks before delivery) | C11 tutorial |
| A `capture.run` attempt is interrupted and is not declared repeat-safe | `policy` | The attempt ends `failed` and is not repeated automatically | — |
| Web text contains instructions, or a fetch breaks the transport rules | `policy` | Text is data; the fetch is refused and logged | C5 |

## 5. Named settings and defaults

R7 owns every setting below. All values are starting defaults to tune on real films (roadmap §1.4). The `delivery.audio.*` values are fields of the delivery profile. When a delivery profile is created, `delivery_profile.audio.loudness_lufs` and `delivery_profile.audio.verify_max_dbtp` take the values of `delivery.audio.loudness_lufs` and `delivery.audio.verify_max_dbtp`; they are `human` fields, thresholds of the hard check F-09, so after that only a human may change them (R3 §2.7, K1). Override authority and range registration follow R3 §2.7's shared rule (G15); `human` settings are marked below.

| Setting | Default |
|---|---|
| `delivery.audio.loudness_lufs` | −14 (`human`) |
| `delivery.audio.limit_dbtp` / `delivery.audio.verify_max_dbtp` | −3.0 / −1.0 (`human` for `verify_max_dbtp`) |
| `mix.master_tolerance_lu` / `mix.master_max_passes` | 0.5 / 3 |
| `mix.voice_line_lufs` / `mix.music_lufs` / `mix.sfx_peak_dbfs` | −18 / −24 / −10 |
| `mix.duck_threshold` / `mix.duck_ratio` / `mix.duck_attack_ms` / `mix.duck_release_ms` / `mix.duck_mix` | 0.05 / 6 / 20 / 300 / 0.8 |
| `voice.final_timing` | `native` or `aligned` (`human`: it gates a `final` compile) |
| `voice.default_takes` | 2 (`director`, range 1 to 5); takes requested per voice line when the request does not say (G16) |
| `voice.engine` | `hexgrad/kokoro-82m` through OpenRouter's Text-to-Speech API (`human`; decided by the user, U17) |
| `voice.default_voice` | unset: the Director chooses each voice profile's engine voice ID from the engine's listed stock voices (U17, U9) |
| `voice.response_format` | `pcm`: signed 16-bit little-endian, 24 kHz, mono, as spike V1 measured (L12) |
| `voice.provider_only` | `deepinfra`, the DeepInfra provider as spike V1 names it (`human`, because it changes the price) (decided: `lld/11` section 18, L12) |
| `align.lipsync_min_fraction` | 0.95 (`director`, range 0.5 to 1, as the threshold of an observational check): the share of word starts within 40 ms early and 60 ms late that `R7-A2` requires; a starting value calibrated at M5 (decided: `lld/11` section 18, L9, L40) |
| `align.word_end_offset_ms` | 80 (`director`, range 0 to 200): added to a CTC word's aligned end, unless the next word starts earlier; a starting value calibrated at M5 (decided: `lld/11` section 18, L10, L40) |
| `music.grid_tolerance_ms` | 20 (`human`: it decides `beat_grid.verified`) |
| `captions.max_lines` / `captions.max_chars_per_line` / `captions.max_words` | 2 / 26 / 7 |
| `captions.pause_break_ms` / `captions.linger_ms` / `captions.merge_gap_ms` | 350 / 150 / 120 |
| `captions.min_duration_ms` | 700 for `phrase`; 400 for `word_pop` and `highlight` (one setting with a keyed value, keys `phrase`, `word_pop` and `highlight`, each with its own range; decided: `lld/11` section 18, A:M0-3) |
| `captions.max_cps` / `captions.max_cps_children` | 20 / 17 |
| `mouth.tier` / `mouth.min_hold_frames` / `mouth.closed_gap_ms` / `mouth.lead_ms` | 1 / 2 / 120 / 30 |
| `acting.min_hold_ms` | 150 (S6's clearest track held each glance 150–200 ms) |
| `acting.max_keys_per_second` / `acting.min_eye_units` / `acting.repair_attempts` | 6 per channel / 24 / 3 |
| `capability.extend_attempts` / `capability.budget_usd` / `capability.regression_psnr_db` | 3 / 0.15 / 50 (`capability.budget_usd` is `director`: an allocation inside the caps, as G22, K7) |
| `rights.share_alike_ok` | false (`human`; decided by the user, U4) |
| `fetch.max_bytes_image` / `fetch.max_bytes_video` / `fetch.max_bytes_document` | 50 MB / 500 MB / 5 MB (`human`) |
| `fetch.max_redirects` / `fetch.per_host_interval_ms` | 3 / 1000 (`human`) |
| `fetch.contact_identity` | unset (`human`; decided by the user, U5, so the Wikimedia and Art Institute of Chicago adapters stay disabled) |
| `research.min_sources_for_numbers` | 2 (numeric and essential claims; `human`) |
| `screen_capture.viewport_px` / `screen_capture.device_scale` / `screen_capture.settle_ms` | 1280 × 800 / 2 / 500 |
| `screen_capture.allowed_origins` | empty (`human`; decided by the user, U6) |

Settings that hold a user decision (`rights.share_alike_ok`, `screen_capture.allowed_origins`, `fetch.contact_identity`, the voice policy) and the fields `quality_intent.disclosure` and `delivery_profile.ai_disclosure` are `human`: the Director cannot change them (G12). `delivery_profile.ai_disclosure` holds the platform disclosure label and the suggested disclosure text for upload; the on-screen notice switch is `quality_intent.disclosure.visible_notice`, a different field (decided: `lld/11` section 18, L16, L24, L37). The user made these decisions on 15 November 2026 ([integration decisions](11-integration-decisions.md) section 17.1): ShareAlike media is not accepted (U4); no contact identity is sent, so the Wikimedia and Art Institute of Chicago adapters stay disabled (U5); the capture allow-list is empty (U6); and the voice policy is §2.2.9's, with no voice cloning at all (U9).

The tutorial-capture settings use the namespace `screen_capture.*`, because `capture.*` is R2's frame capture and `capture_browser.*` is R5's pool. R9 owns the chart geometry tolerance and the loudness check tolerance; `delivery.audio.tolerance_lu` is removed.

## 6. Cross-domain check

| Domain | What R7 provides | Residual risk |
|---|---|---|
| Historical comedy | Stylised voices; acting tracks on word and event anchors; pose switches; `shift` for timing | Acting was judged on stills; no model hears delivery |
| Science documentary | Quote-checked claims with a two-source rule; NASA and Commons adapters; identity claims | Interval selection in long footage is untested |
| Art history | Met and Art Institute adapters; anchors in source pixels; credits manifest | Artwork and photograph rights can differ and stay `unresolved` |
| Software tutorial | Scripted capture with timed frames and an event log; synthetic cursor | Web only; no origin allowed until the user adds a site (U6) |
| Data reel | Dataset binding; `data` and `scale` probe items; one number formatter | Other chart types need their own probe rules |
| Abstract motion graphics | Authored beat grid; beats as time units | Music quality depends on the code-rendered music engine (U2) |

## 7. Decisions that differ from the first working draft

The lead accepted all four.

1. **Voice output.** Word timing carries a method label and alignment is a separate stage; the draft assumed every engine returns word timestamps.
2. **Research.** The draft relied on labelling web text. The Director instead holds only `research_request`, and a researcher sub-loop with no write tools searches.
3. **Entity kinds.** R3 adds `voice_profile`, `dataset`, `media_need` and `capture_session`.
4. **Controls.** R7 adds `pose`, a required core and two optional hand targets to the draft's list, and moves placement into `transform.*` channels.

## 8. Claims table

| Claim | Label | Evidence, or what breaks |
|---|---|---|
| `adelay` with the `S` suffix places a clip to the sample; `amix=normalize=0` sums without rescaling; `sidechaincompress` ducks music under speech | VERIFIED by spike | Batch 2a: placement exact, sums bit-identical, music 6.4 dB lower under speech and 0 dB in pauses. [FFmpeg filters](https://ffmpeg.org/ffmpeg-filters.html) |
| Two-pass `loudnorm` is unreliable for mastering; the static-gain master meets the targets after AAC with the exact sample count; decoded AAC is longer than the mix | VERIFIED by spike | Batch 2a and the evidence log's spike M1 entry, with the numbers in §2.2.6; 256 to 512 extra samples after decoding. Synthetic mixes only |
| YouTube normalises towards about −14 LUFS; TikTok and Instagram publish no loudness target and accept no caption file | SECONDARY | [Production Advice](https://productionadvice.co.uk/stats-for-nerds/), [OpenClip](https://openclip.app/learn/audio-normalization), vendor guides. Both are profile data |
| Netflix line-break rules and reading speeds; YouTube accepts SRT and WebVTT and requires disclosure of realistic synthetic content; Rhubarb is MIT-licensed and defines these shapes | VERIFIED by source | [Netflix style guide](https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-Timed-Text-Style-Guide); YouTube Help on [captions](https://support.google.com/youtube/answer/2734698) and [disclosure](https://support.google.com/youtube/answer/14328491); [Rhubarb](https://github.com/DanielSWolf/rhubarb-lip-sync) |
| Forced alignment is accurate enough for captions and mouth shapes; spelling-based mouth shapes read acceptably | ASSUMED | Spikes R7-A2 (at M5, where the aligner is built, U18) and R7-A3. If wrong, timing still needs measurement against R1's tolerance; use mouth tier 0 or 2. Spike V1, on Windows: CTC word starts after pauses fell within −40/+60 ms in 69 of 72 cases with no drift to 90 s, and word ends came out a median 83 ms early (L9, L10) |
| OpenRouter's speech endpoint for `hexgrad/kokoro-82m` takes the request and returns the reply, errors and prices given in §2.2.4, and the reply carries no timing of any kind | VERIFIED by source | OpenRouter's document, supplied by the user on 15 November 2026 (U17). Spike V1 confirmed it in 19 calls |
| The PCM reply is signed 16-bit little-endian, 24 kHz, mono; `provider.only` with `allow_fallbacks: false` pins the provider; `total_cost` from the generation look-up equals characters times the pinned provider's price; takes repeat their timing but not their bytes | VERIFIED by spike | Spike V1: 18 generations; pinning 3 of 3; unpinned routing reached Together once in 15 requests, at 6.45 times the price and with different audio (decided: `lld/11` section 18, L12) |
| The maximum input length; OpenRouter's rate limits | ASSUMED | Not stated in OpenRouter's document, and not determined by spike V1 (longest input tried 1,518 characters; no 429 at 3 in flight). The PCM format and pinning, once listed here, are now VERIFIED (row above) |
| The aligner and the Whisper models run on Linux in WSL | ASSUMED | Spike V1 ran them on Windows. Checked by the first M5 work package; the fallback is the WASM backend (decided: `lld/11` section 18, L10) |
| The pinned provider's terms place no further limit on Kokoro-82M output beyond the model's Apache-2.0 licence | ASSUMED | Reported to the user. If wrong, the rights entry for synthetic speech changes and R-01 blocks narrated films until it is resolved (decided: `lld/11` section 18, L14) |
| MiniMax speech-2.8 returns timing below sentence level as sub-word tokens on a 42.67 ms grid | VERIFIED by spike | Spike T1 in the [evidence log](../research/10-spike-evidence-log.md): one line, one voice and one call. The tokens can be merged into words by character offsets. Kept as evidence: MiniMax speech-2.8 is no longer the engine and no adapter for it is built (U17, U18) |
| MiniMax speech-2.8's native timing accuracy is insufficient for lip-sync | ASSUMED | Spike T1's pauses differed from audio pauses by 0.1 to 0.5 s; silence detection cannot locate individual words. Not measured further, because MiniMax speech-2.8 is no longer the engine (U18) |
| Candidate engine licences and features other than the timing measured in spike T1 | SECONDARY | Research 11. The engines are now chosen (U2, U17, L10): Kokoro-82M's Apache-2.0 licence is research 11's reading (L14); the aligner's and transcriber's weights are Apache-2.0 by their model cards (Whisper's code is MIT), and the ONNX conversions state no licence (spike V1), so the ONNX files are exported from the original weights (L27 revised, L38); the music and effect engines' licences are registered at M5 (§2.1). Other candidates are re-verified only if a decision changes |
| MiniMax `asr-1.0` returns word-level timestamps | VERIFIED by source, as read by R9 | [API reference](https://platform.minimax.io/docs/api-reference/speech-to-text.md). If wrong, whisper.cpp is the default. No longer relied on: `asr-1.0` is not used, and the transcriber is Whisper `small.en` in Node (L10) |
| Controls plus a track produce acting that one-shot components did not; MiniMax-M3 writes valid tracks in one call; a hold-key shift moves timing without touching the drawing | VERIFIED by spike | S6: visible on 5 of 5 characters; 3 of 3 tracks valid; 17 of 17 frames identical after the shift. S2: 0 one-shot components |
| A pixel-change check does not prove a control right; acting shows in frames 120 ms apart and not in evenly spaced sheets; the Reviewer is fallible on acting | VERIFIED by spike | S6: arms wrong on 2 of 5 passing characters; 0 of 15 even sheets; judge agreed on 12 of 15, with one false positive in ten |
| Probe expectations catch wrong arm poses; a model can add a control without changing the character's look; model-written charts report values well enough for exact checks | ASSUMED | Spikes R7-A9, R7-A4, R7-A5. If wrong: the response sheet and the Reviewer are the only guard; extension means re-authoring; charts are built on a trusted base component |
| Overshoot presets read well; models can write sprite-sheet and rigged characters | ASSUMED | Untested. If wrong, the presets are dropped, and pose switches and plain controls remain |
| Sprites and a two-bone IK arm are deterministic without a library; PixiJS is deterministic but slower than Canvas 2D under software rendering; anchor-follow layers are exact at negligible cost | VERIFIED by spike | S7: 0 of 60 frames differed across seek orders and browsers in each technology; 178–220 ms against 70–79 ms per frame for 200 sprites with a full-frame blur; a follower at most 0.27 px off in 300 captures, for under 0.1 ms per frame. One machine, software rendering only; a zoomed or transformed leader was not tested |
| Exact errors repair invalid tool calls; validator-passing components can be visibly broken; search/replace edits apply cleanly; probes are cheap | VERIFIED by spike | S5: 4 of 4 repaired. S3: at least 7 of 72 broken; 13 of 13 edit blocks applied. S4: under 1 ms per frame |
| Commons, Met, Art Institute and NASA terms as given in §2.4 | VERIFIED by source | Commons [Licensing](https://commons.wikimedia.org/wiki/Commons:Licensing), [Reuse](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia), [User-Agent policy](https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy); [Met API](https://metmuseum.github.io/); Art Institute [documentation](https://api.artic.edu/docs/) and [source text](https://github.com/art-institute-of-chicago/data-aggregator/blob/master/docs/.sections/preface.md); [NASA guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/). The Met's image policy page and the Art Institute's Terms page could not be read |
| SSRF defences; MiniMax `web_search` is server-side, in Beta, with `pause_turn`; Puppeteer locators auto-wait | VERIFIED by source | [OWASP cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [MiniMax server tools](https://platform.minimax.io/docs/guides/server-tools), [Puppeteer guide](https://pptr.dev/guides/page-interactions) |
| The transport rules can be implemented in Node and FFmpeg; `chrome-headless-shell` renders target web applications faithfully | ASSUMED | Spikes R7-A7, R7-A6. If wrong, use a filtering proxy and a network-less container; capture stays limited to simple flows (R10 §2.2) |
| NASA's image API needs no key; TikTok's disclosure rule; EU AI Act Article 50; ELVIS Act | SECONDARY | NASA [API document](https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf), seen in excerpts; [TikTok Help](https://support.tiktok.com/en/using-tiktok/creating-videos/ai-generated-content), which R9 could not fetch; [Article 50 text](https://artificialintelligenceact.eu/article/50/); [WSGR](https://www.wsgr.com/en/insights/the-elvis-act-setting-the-stage-for-policing-unauthorized-use-of-ai-generated-sound-and-likeness.html) |

## 9. Spikes wanted

S6 settled the acting question. Batch 2a and spike M1 closed R7-A1. The draft's other seven spikes stay; R7-A9 is new. R10 holds the unified register.

| ID | Claim to test | Method |
|---|---|---|
| R7-A2 | Forced alignment is accurate enough for captions and mouth shapes, within R1's tolerance | At M5, where the forced aligner is built because the voice engine returns no timing (U18), measure the aligned word starts of Kokoro-82M takes against signal onsets after pauses, as spike V1 did, because Whisper's word times are less accurate than the aligner's (decided: `lld/11` section 18, L11). No second CTC model is named or needed: wav2vec2-base (Apache-2.0) is the aligner's model, and only if this calibration fails does M5 choose another, after a licence check recorded in the M5 report (decided: `lld/11` section 18, L39). Word ends are measured only after the end correction of `align.word_end_offset_ms`, which this run calibrates (C:M5-O2a, L10). It passes when at least `align.lipsync_min_fraction` (0.95) of the word starts fall within 40 ms early and 60 ms late (L9). The result decides whether word-by-word caption highlighting may be on. The M5 measurement is also the word-time half of R9's `R9-3`, run once (K3). Ten lines from the chosen engine, Kokoro-82M through the pinned provider, in several of its stock voices. Cap $1 |
| R7-A3 | Tier 1 mouth shapes read better than tier 0 | Both tiers on one character, viewed as clips |
| R7-A4 | A model can add a control without visual drift | Extend three characters by search/replace edits; PSNR at old test values |
| R7-A5 | Exact chart checks work on model-written charts | Ten generated charts; count passes and false alarms |
| R7-A6 | Scripted capture is reliable and its log matches the pixels | A five-step flow on a public web application, three runs |
| R7-A7 | The transport rules hold | Redirects to private addresses, DNS rebinding, a playlist file, a capture page requesting a private address |
| R7-A8 | `web_search` isolation holds | A planted page with instructions. Cap $0.50. Overlaps R6's injection spike |
| R7-A9 | Probe expectations catch wrong arm poses | Five characters, some with wrong arms; compare with a reading of the response sheet |

## 10. Decisions for the user

The integration decisions answered every design question the draft raised. The decisions below belong to the user, who made them on 15 November 2026 ([integration decisions](11-integration-decisions.md) section 17.1). Each can be changed later by the user; a change is recorded as a revision.

1. **Audio engines** for voice, music and sound effects. Decided: `hexgrad/kokoro-82m` through OpenRouter for voice (U17, which replaces MiniMax speech-2.8, U1); it returns no timing, so every take is `aligned` and the forced aligner is built at M5 (U18); code-rendered music and procedural effects, with no AI music or sound-effect provider, and a film may ship without music (U2). The adapters stay provider-neutral (§2.2.4).
2. **Listening.** No MiniMax model accepts audio. Decided: nothing listens, and no second provider with audio input is added (U3). Voice performance and music fit stay `UNKNOWN`.
3. **Voice policy** (§2.2.9), including whether the creator's own voice may be cloned with consent. Decided: no voice cloning at all, including the user's own voice (U9).
4. **ShareAlike media** (CC BY-SA): acceptable or not. Decided: not accepted; `rights.share_alike_ok` is false (U4).
5. **A contact identity** for the User-Agent that Wikimedia requires and the Art Institute of Chicago requests. Decided: no contact address is sent to any service, so both adapters stay disabled (U5).
6. **Capturing third-party software screens:** on what basis. Decided: no capture of third-party software; `screen_capture.allowed_origins` is empty, and the tutorial brief at M10 needs the user to add a site first (U6).
7. **The MiniMax key.** Decided: the current key is kept, with at most 8 model requests in flight (U11). The voice engine needs a second key, `OPENROUTER_API_KEY`, read at run time from a file the user names and never printed, logged, copied or committed. It is stored with the MiniMax key in `C:\Users\XZNON\cutroom-v2\.env` (U23, which answers U18 (3)). U11's limit concerns MiniMax model calls; OpenRouter's limits are unknown, and the voice adapter backs off on 429.
