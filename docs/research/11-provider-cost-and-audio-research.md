# Provider, Cost, Language and Audio Research

**Cutroom v2 | Research findings | 14 November 2026**
**Status:** RESEARCH FINDINGS. Decisions taken from these findings are recorded in [R0](../lld/01-r0-framing-decisions.md). Sections 4 and 5 (audio) inform a decision the user has deferred.
**Method:** research agents fetched primary sources on 14 Nov 2026. The lead session did not independently re-check every item. Prices, licences and model line-ups change quickly, so re-verify before relying on any single fact. "Secondary" marks facts that come only from third-party sources.

---

## 1. Language and runtime

**Finding:** a TypeScript core with a thin Python worker fits best. Python-only and Rust-core fit poorly.

- **Deterministic BeginFrame capture works only on Linux.** HeyGen states that on macOS and Windows HyperFrames falls back to screenshots, which it calls "not how you want to run production" ([source](https://www.heygen.com/research/html-to-video)).
- **HyperFrames** needs Node 22+ and FFmpeg and has no Python bindings ([source](https://github.com/heygen-com/hyperframes)).
- **Remotion** requires a paid Company License above a small headcount, and automated rendering counts under its terms ([source](https://www.remotion.dev/docs/license/faq)).
- **Pi SDK** runs in-process only from Node or Bun ([source](https://docs.pi.dev/latest/sdk)).
- **Durable job libraries:** DBOS for TypeScript supports Postgres only; DBOS for Python supports SQLite; Inngest self-hosts as one binary with SQLite; Restate is one binary with TypeScript, Python and Rust SDKs.
- **Schemas:** Zod exports JSON Schema ([source](https://zod.dev/json-schema)); `datamodel-code-generator` generates Pydantic models from JSON Schema.
- **Sandboxing LLM-written JavaScript outside the browser:** `node:vm` is not a security boundary, vm2 should be avoided, and QuickJS compiled to WebAssembly gives the strongest in-process isolation ([source](https://github.com/simonw/research/tree/main/javascript-sandboxing-research)). Inside the browser the boundary is a fresh profile, blocked network access and an unprivileged user or container.
- **Rust:** the frame bottlenecks (Chrome rasterising, FFmpeg encoding) are already native code. The main agent framework is pre-1.0, `ffmpeg-next` is in maintenance mode, and `vello_cpu` is not production-ready.
- **Python's real advantages** are forced alignment, learned shot detection and embedding models. None of these is needed for a first film without real footage.

---

## 2. MiniMax (the chosen LLM provider)

Sources: [pricing](https://platform.minimax.io/docs/guides/pricing), [Anthropic-compatible API](https://platform.minimax.io/docs/api-reference/text-chat-anthropic), [model list](https://platform.minimax.io/docs/faq/models), [rate limits](https://platform.minimax.io/docs/guides/rate-limits).

| | MiniMax-M3 | MiniMax-M3.1-Flash |
|---|---|---|
| Input / output per million tokens | $0.30 / $1.20 (doubles above 512K input) | $0.15 / $0.60 |
| Cached input per million tokens | $0.06 | $0.015 |
| Context window | 1,000,000 | 1,000,000 |
| Thinking | Off by default; `thinking: {type: "adaptive"}` turns it on | Always on; `output_config.effort` low to max, default max |
| Image and video input | Yes | Yes |
| Audio input | No | No |

- **Endpoints:** Anthropic-compatible `https://api.minimax.io/anthropic/v1/messages` (recommended) and OpenAI-compatible `/v1`.
- **Caching:** automatic prefix caching with no write charge. Explicit cache breakpoints are not supported. The cache lifetime is not documented.
- **No JSON-schema output mode. `tool_choice` accepts only `auto`.** Temperature and top-p are fixed.
- **Web search:** a server-side tool at $0.01 per request.
- **Rate limits:** 200 requests per minute and 10M tokens per minute per model.
- **Model churn:** the M2 family closed to new users on 19 Oct 2026 and retires on 18 Nov 2026.
- **Subscription plans** are for individual interactive use; pay-as-you-go is recommended for production.
- **Data use:** the terms let MiniMax use inputs and outputs to improve its services; no opt-out was found. The contracting entity is in Singapore. (Accepted by the user in R0.)
- **Flash hallucination (secondary):** a third-party review reports a very high hallucination rate for M3.1-Flash and a much lower one for M3. This is the reason facts, direction and review stay on M3.
- **Speech:** speech-2.8-hd costs $100 per million characters, speech-2.8-turbo $60. Both return sentence- or word-level timestamps. Voice design costs $3 per voice and rapid cloning $1.50. Speech-to-text costs $0.38 per hour.
- **Music:** the music API has been closed to new users since 20 Aug 2026.
- **Sound effects:** there is no sound-effects generation API.

Measured behaviour of both models is in [spike S2](10-spike-evidence-log.md).

---

## 3. Cost model

All token counts are assumptions. The typical case assumes 25 components at 1.8 attempts each, 45 Director turns at an average 80K context with a high cache-hit rate, 2 revision cycles and 2 small experiments.

### 3.1 LLM cost per typical film

| Model split | LLM cost |
|---|---|
| M3 for Director, research, script, review; Flash for code (the accepted split) | about $1.8, up to $2.5 if reasoning tokens run long |
| M3 everywhere | about $2.6 |
| Flash everywhere | about $1.3 |

For reference, the same token model priced on Claude (Opus 5.5 Director, Sonnet 5.5 workers, Haiku 5.5 checks) came to about $17 in LLM cost.

### 3.2 Other costs per typical film

- **Voice:** MiniMax speech-2.8-hd, about 8,000 characters across 5 takes: about $0.80.
- **Music:** three candidates from a paid API: $0.25–0.70. Code-generated music costs nothing per track.
- **Sound effects:** $0.10–0.80 from a paid API; nothing if procedural or from a library.
- **Compute:** under $0.50 on a CPU VM (about $0.39 per hour for 8 vCPU / 32 GB at the large clouds, about half that at Hetzner; secondary). A GPU VM is not worth it for SVG/CSS capture, which runs on the CPU.

### 3.3 Totals

- About **$4** per typical film; about $1 low; about $15–20 high.
- About $0.3–0.6 per revision cycle.
- Wall-clock time is set by model latency, not rendering: about 1.5–2.5 hours typical (assumption).

### 3.4 What S2 changes

- Component generation cost $0.003–0.006 each, in line with the model.
- A Reviewer call cost about $0.014, roughly ten times the per-check assumption, because thinking tokens dominated. At 50 review calls per film this adds about $0.60.
- About one third of single-shot components needed repair, consistent with the 1.8-attempt assumption.

### 3.5 Main levers

- Keep the Director's history append-only so the automatic prefix cache keeps hitting.
- Validate code deterministically before any model review.
- Send contact-sheet thumbnails, not full-resolution frames, to the Reviewer.
- Cap revisions and experiments per film.

---

## 4. Music and sound effects without a commercial music API

**Status:** findings only; the user has deferred the audio decision.

### 4.1 Code-generated music

- **Shape:** the LLM writes a constrained cue sheet or score (tempo, bars, sections, stingers tied to scene timestamps). A deterministic checker validates it. An engine renders it.
- **Engines:**
  - **Tone.js** renders offline through `OfflineAudioContext` inside headless Chrome, which Cutroom already runs ([source](https://tonejs.github.io/docs/15.1.22/functions/Offline.html)).
  - **MIDI plus FluidSynth** (LGPL-2.1) is the other deterministic route.
  - Strudel is AGPL-3.0 and some of its default sample banks state no licence.
  - Sonic Pi and TidalCycles have no documented headless render.
- **LLMs write music code badly unless checked.** A study of 4,000 Strudel generations found 81% compiled but only 16% met every hard constraint; feeding back localised counterexamples raised repair success by 11–15 points ([StruSpec, Aug 2026](https://engrxiv.org/preprint/view/7995)).
- **Honest quality:** good for electronic, lo-fi, ambient and pulse-synth beds. Orchestral parts on General MIDI sounds resemble 1990s game music.
- **Fit with the architecture:** deterministic, exact duration, one section editable without regenerating the rest, and an exactly known beat grid for visuals to sync to.

### 4.2 Sample libraries

| Library | Licence | Verdict |
|---|---|---|
| VSCO 2 Community Edition | CC0 | Use |
| VCSL | CC0 | Use |
| Salamander Grand Piano | CC-BY-3.0 | Use, with credit |
| Philharmonia samples | Allowed in commercial works; not resold as samples | Use |
| GeneralUser GS | Free for commercial music | Use |
| Sonatina Symphonic Orchestra | CC Sampling+ 1.0, which forbids promotional use | Avoid for promo reels |

### 4.3 Open-weight music models

| Model | Weights licence | Hardware | Notes |
|---|---|---|---|
| ACE-Step 1.5 | MIT | Vendor claims under 4 GB of video memory | Duration, BPM, key and section control; local "repaint" editing. Untested by us |
| Stable Audio 3 Small / Medium | Stability Community License: free under $1M annual revenue | Medium needs a larger GPU | Trained on licensed data; inpainting |
| MiniMax-Music3 | Custom: commercial use allowed, but "MiniMax-Music3" must be shown in the product UI | Under 24 GB | Best quality reputation (secondary) |
| HeartMuLa 3B, DiffRhythm 1.2 | Apache-2.0 | 8 GB or more | Weaker quality (secondary) |
| MusicGen / AudioCraft, YuE2 | Non-commercial | — | Avoid |

### 4.4 Sound effects

- **Procedural:** jsfxr (Unlicense), ZzFX (MIT, needs a seeded random source), and synth recipes cover whooshes, risers, impacts and interface clicks. Realistic foley cannot be made this way.
- **Libraries:** Kenney (CC0), Freesound filtered to CC0, Sonniss GDC bundles (commercial use allowed, AI training banned). Every file needs a licence record.
- **Open models usable commercially:** Stable Audio 3 Small SFX; MOSS-SoundEffect v2.0 (Apache-2.0 on its model card).
- **Avoid (non-commercial):** TangoFlux, AudioLDM 2, MMAudio, AudioGen.

---

## 5. Voices and dialogue beyond a commercial TTS API

**Status:** findings only; the user has deferred the audio decision. MiniMax speech-2.8 remains available (section 2).

### 5.1 Open models that allow commercial use

| Model | Licence | Hardware | Strengths | Limits |
|---|---|---|---|---|
| Kokoro-82M | Apache-2.0 | CPU | Native word timestamps in Python; runs in Node through kokoro-js | Neutral delivery; preset voices only |
| Pocket TTS (Kyutai) | MIT code, CC-BY-4.0 weights | CPU, faster than real time | Saves a reusable voice embedding | Moderate expressiveness |
| Chatterbox Turbo / Nano | MIT | CPU for Nano | Laugh and cough tags; exaggeration control | Project retired Aug 2026; pin a version |
| Phonon 31M | Apache-2.0 | CPU or browser; npm package | Node-native | No timestamps |
| Qwen3-TTS | Apache-2.0 | Rented GPU for the larger model | Designs a voice from a text description | No timestamps |
| Dia / Dia2 | Apache-2.0 | GPU | Two-speaker dialogue with non-verbal tags; Dia2 gives word timestamps | English only |
| IndexTTS-2.5 | Free below very large usage thresholds | Rented GPU | A duration factor for timing | — |

- **Quality gap:** the open CPU models score about 1060–1110 on the Artificial Analysis text-to-speech leaderboard, against 1175 for MiniMax speech-2.8-hd. They lack sarcasm and laughter.
- **Avoid (non-commercial weights):** F5-TTS, MaskGCT, XTTS-v2, VibeVoice, Fish S2-Pro.

### 5.2 Word timestamps

- The script is known, so aligning it to the audio is better than transcribing.
- Options: ctc-forced-aligner (its default model is non-commercial; a permissive model must be swapped in), Montreal Forced Aligner (MIT), or in Node, whisper.cpp or transformers.js word timestamps matched back to the script.

### 5.3 Procedural voices

- **Babble or gibberish character voices** with subtitles: one syllable blip per subtitle syllable, with pitch and timbre fixed per character from a seed. Deterministic, with timestamps for free. Suited to comedy.
- **Articulatory synthesis** (pink-trombone-mod, MIT): the same parameters could drive mouth animation.
- **eSpeak NG** (GPL-3.0): robot and retro voices. Run it as a separate process because of the licence.

### 5.4 Legal and policy points

- **EU AI Act Article 50** has applied since 2 Aug 2026: disclose deepfake-style audio and mark outputs in a machine-readable way.
- **Tennessee's ELVIS Act and California AB 1836** protect people's voices, including after death.
- **Platforms** require labels on realistic synthetic content.
- **Candidate policy for a later decision:** never clone or imitate a real person's voice; voice historical figures as clearly stylised archetypes; always disclose AI voices; keep a provenance record for every voice.

### 5.5 Kokoro-82M through OpenRouter (added 15 November 2026)

On 15 November 2026 the user chose `hexgrad/kokoro-82m` through OpenRouter's Text-to-Speech API as the voice engine ([integration decisions](../lld/11-integration-decisions.md), U17 and U18). The facts below are VERIFIED by source: OpenRouter's document, supplied by the user on that date. No call has been made yet. The findings above are unchanged.

- **Endpoint:** `POST https://openrouter.ai/api/v1/audio/speech`, with the headers `Authorization: Bearer $OPENROUTER_API_KEY` and `Content-Type: application/json`.
- **Request:** `model` (required, `"hexgrad/kokoro-82m"`), `input` (required, the text), `voice` (optional, a provider voice identifier such as `af_heart`, `am_onyx`, `bf_emma` or `bm_george`; 54 voices are listed, with prefixes for American, British, Spanish, French, Hindi, Italian, Japanese, Portuguese and Chinese voices) and `response_format` (`"mp3"` or `"pcm"`, default `pcm`).
- **Response:** raw audio bytes, not JSON. `Content-Type` gives the encoding (`audio/mpeg` or `audio/pcm`), and `X-Generation-Id` identifies the billed generation. **The response carries no timing information of any kind,** so the "native word timestamps in Python" of section 5.1 are not available through this endpoint, and every take needs forced alignment (section 5.2). Section 1's point that forced alignment is not needed for a first film therefore no longer holds.
- **Errors:** JSON `{"error": {"code", "message"}}` with status 400 (malformed or unsupported option), 401, 402 (insufficient credits), 403 (spend limit, key disabled), 404, 429 (rate limited; retry with backoff) or 502 (upstream failure; failed generations are not billed).
- **Price:** $0.62 per million characters through DeepInfra and $4 per million through Together, pay as you go. At the DeepInfra price the 8,000 characters of section 3.2 cost about half a cent, against about $0.80 at MiniMax speech-2.8-hd.
- **ASSUMED until the first call measures them,** because the document does not state them: the PCM sample rate, bit depth and channel count; the maximum input length; the rate limits; and whether a provider can be pinned.

---

## 6. Design ideas raised by this research (PROPOSED, not decided)

- **Treat audio like visuals in the project model.** A music cue, a sound effect or a voice line would be a time-addressable component: either code-rendered (a score played by an engine) or a media asset (a generated or recorded file).
- **One validate-and-repair pattern for all LLM-written artefacts:** visual code, music scores and project patches all get a constrained format, a deterministic checker and targeted error feedback.
- **Machine-readable AI labelling of exports** (for example C2PA content credentials) as a possible delivery requirement, to be considered in R9/R10.
