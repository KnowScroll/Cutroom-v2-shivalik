# V1 — OpenRouter Kokoro-82M and word timing (15 Nov 2026)

**Questions.** (A) What does OpenRouter's speech endpoint for `hexgrad/kokoro-82m` actually return: PCM format, headers, cost, repeatability? (B) Where can each take's word start and end times and its transcript come from, on Node, and how accurate are they?

**Design context read:** [lld/08](../../lld/08-r7-studio-tools.md) §2.2.1 (takes, `timing` label), §2.2.4 (the voice adapter), §2.2.7 (captions), §2.2.10 (`Transcriber`); [lld/09](../../lld/09-r9-quality.md) D5 (speech-to-text: MiniMax `asr-1.0` as starting default, local whisper.cpp as fallback; forced alignment alone rejected because it assumes the words are right; checks A-01 WER ≤ 0.10 per take, A-02 WER ≤ 0.15 and −40/+60 ms on the final file), D6, spikes `R7-A2` and `R9-3`; [research 11](../11-provider-cost-and-audio-research.md) §5.2 (aligner options: ctc-forced-aligner with a permissive model, Montreal Forced Aligner, whisper.cpp, transformers.js).

The spike code was throwaway and has been deleted; only these results are kept.

---

## 1. Setup

| Item | Value |
|---|---|
| Machine | Windows 11, AMD Ryzen 7 5800H (8 cores, 16 threads), 15.3 GB RAM, CPU only. Production is Node 26 on Linux; **no timing here was measured on Linux** |
| Node side | Node 22.23.4; `@huggingface/transformers` 3.8.1 (bundles `onnxruntime-node` 1.21.0); FFmpeg 8.1.1 for decoding and resampling |
| Python side (reference only) | Python 3.12.1 venv inside the scratch folder; torch 2.5.1+cpu, torchaudio 2.5.1+cpu |
| Speech requests | 19 to `POST /api/v1/audio/speech` (18 succeeded, 1 rejected with 400), at most 3 in flight, no 429 seen |
| Other OpenRouter calls | 1 transcription attempt (rejected, 402); 19 generation look-ups and 6 key-usage reads (free); 6 public model listings without the key |
| Clips used in Part B | 10 DeepInfra PCM takes: 3 two-sentence lines (voices `af_heart`, `am_onyx`, `bf_emma`), 3 number/abbreviation/name lines (`bm_george` ×2, `af_heart`), 2 very short lines ("Yes.", "Look out!"), a 914-character passage (52.0 s) and a 1,518-character passage (90.2 s). 575 script words in total (after expanding numbers). Plus the one Together take and repeats for the format and determinism checks |
| Network | One network drop part-way through; no speech request was repeated because of it |

---

## 2. Part A — the OpenRouter Kokoro API, as measured

### 2.1 Calls

| Call | Chars | Format | Status | First byte | Total | Bytes | Audio | Provider (from look-up) | Cost (USD) |
|---|---|---|---|---|---|---|---|---|---|
| L1, `af_heart` (a) | 91 | pcm | 200 | 1.06 s | 1.11 s | 271,770 | 5.66 s | **Together** | 0.000364 |
| L1, `af_heart` (a) | 91 | mp3 | 200 | 2.60 s | 3.26 s | 42,768 | 5.98 s decoded | DeepInfra | 0.00005642 |
| LONG, `af_heart` | 914 | pcm | 200 | 2.46 s | 17.37 s | 2,497,200 | 52.03 s | DeepInfra | 0.00056668 |
| LONG, `af_heart` | 914 | mp3 | 200 | 2.76 s | 4.93 s | 391,608 | 52.87 s decoded | DeepInfra | 0.00056668 |
| L2, `am_onyx` | 103 | pcm | 200 | 3.79 s | 4.87 s | 348,000 | 7.25 s | DeepInfra | 0.00006386 |
| L2, `am_onyx` | 103 | mp3 | 200 | 1.46 s | 1.96 s | 49,032 | 7.35 s decoded | DeepInfra | 0.00006386 |
| L3, `bf_emma` | 84 | pcm | 200 | 1.26 s | 2.27 s | 231,600 | 4.83 s | DeepInfra | 0.00005208 |
| NUM, `bm_george` | 43 | pcm | 200 | 0.80 s | 1.99 s | 284,400 | 5.93 s | DeepInfra | 0.00002666 |
| NUMSP (spelled out), `bm_george` | 75 | pcm | 200 | 8.34 s | 9.32 s | 255,600 | 5.33 s | DeepInfra | 0.0000465 |
| NUM2, `af_heart` | 72 | pcm | 200 | 8.08 s | 9.43 s | 390,000 | 8.13 s | DeepInfra | 0.00004464 |
| "Yes.", `af_heart` | 4 | pcm | 200 | 2.24 s | 2.76 s | 52,800 | 1.10 s | DeepInfra | 0.00000248 |
| "Look out!", `am_onyx` | 9 | pcm | 200 | 1.01 s | 1.27 s | 38,400 | 0.80 s | DeepInfra | 0.00000558 |
| XLONG, `bf_emma` | 1,518 | pcm | 200 | 1.49 s | 27.24 s | 4,327,200 | 90.15 s | DeepInfra | 0.00094116 |
| L3, no `voice`, no format | 84 | — | **400** | 0.27 s | — | 87 | — | — | not billed (no generation id) |
| L1 repeat (b) | 91 | pcm | 200 | 8.13 s | 9.10 s | 282,000 | 5.88 s | DeepInfra | 0.00005642 |
| L1 repeat (b) | 91 | mp3 | 200 | 8.24 s | 8.49 s | 42,576 | 5.98 s decoded | DeepInfra | 0.00005642 |
| L1, pinned to DeepInfra (1) | 91 | pcm | 200 | 4.01 s | 5.17 s | 282,000 | 5.88 s | DeepInfra | 0.00005642 |
| L1, pinned to DeepInfra (2) | 91 | pcm | 200 | 1.76 s | 2.76 s | 282,000 | 5.88 s | DeepInfra | 0.00005642 |
| L3, `bf_emma`, no format, pinned | 84 | default | 200 | 2.62 s | 3.60 s | 231,600 | 4.83 s | DeepInfra | 0.00005208 |

Texts: L1 "The river had been rising for three days. By Friday morning, the old stone bridge was gone."; NUM "Dr. Rao measured 4.2 million in Q3, up 18%."; NUMSP "Doctor Rao measured four point two million in Q three, up eighteen percent."; NUM2 "On 14 March, Siobhan Nguyen paid $1,250 for the U.N. report at 7:45 p.m."; LONG and XLONG are plain narrative passages.

### 2.2 Facts, each labelled

| Fact | Status | Evidence |
|---|---|---|
| Success returns raw audio, `Content-Type: audio/pcm;rate=24000;channels=1` for PCM and `audio/mpeg` for MP3 | **Measured** (18/18) | Header on every 200 reply |
| Omitting `response_format` gives PCM | **Measured** (1) | Same Content-Type, same length and same word times as the PCM take of the same line |
| `voice` is required on this route | **Measured** (1) | Without it: HTTP 400, `{"error":{"message":"An explicit voice is required for this TTS provider.","code":400}}`, header `x-openrouter-error-origin: client` |
| Response headers | **Measured** | Every reply had exactly: `access-control-allow-origin`, `access-control-expose-headers`, `alt-svc`, `cf-ray`, `connection`, `content-type`, `date`, `permissions-policy`, `referrer-policy`, `server: cloudflare`, `set-cookie` (value not recorded), `transfer-encoding: chunked`, `x-content-type-options`, and on success `x-generation-id` (form `gen-tts-<digits>-<20 chars>`). **No** `content-length`, no usage, cost, character-count, provider or rate-limit header. `access-control-expose-headers` names `X-Provider-Name` and `request-id`, but neither was ever sent |
| PCM format: signed 16-bit little-endian, 24,000 Hz, mono | **Measured, high confidence** | See 2.3 |
| Providers behind the model | **Measured** | Public `GET /api/v1/models/hexgrad/kokoro-82m/endpoints`: DeepInfra at $0.00000062 per character and Together at $0.000004 per character; context length 4,096, `max_completion_tokens` 3,686 |
| Unpinned routing can pick Together | **Measured** | 1 of 15 successful unpinned requests went to Together, at 6.45 times the price, with different audio (lead silence 49 ms instead of 324 ms; 0.21 s shorter; every word 280–380 ms earlier) |
| A provider can be pinned | **Measured** (3/3) | Body field `provider: {only: ["deepinfra"], allow_fallbacks: false}`; the generation look-up confirmed DeepInfra for all 3 |
| Spend can be read back per generation | **Measured** | See 2.5 |
| Repeatability | **Measured** | Same timing, not the same bytes; see 2.6 |
| MP3 has a different timeline from PCM | **Measured** | ~85 ms extra silence per sentence join; see 2.4 |
| Maximum input length | **Not determined** | Longest tried: 1,518 characters, one request, 90.15 s of audio, complete (transcript WER 0.7%) |
| Rate limits | **Not determined** | No rate-limit headers; no 429 at 3 in flight. Requests sent together waited: first byte up to 8.3 s, and the look-up's `latency` field showed 7.8–8.1 s for those, so the wait is upstream |
| PCM is slower to finish than MP3 | **Measured, small sample** | Same 914 characters: PCM 17.4 s total (`generation_time` 14.9 s), MP3 4.9 s (1.9 s). Lines of 43–103 characters: PCM `generation_time` 0.95–1.18 s, MP3 0.25–0.51 s. PCM arrives chunked over the generation time |

### 2.3 How the PCM format was established

1. **Content-Type** says `rate=24000;channels=1` on all 14 PCM replies, from both providers. OpenRouter's [API reference](https://openrouter.ai/docs/api/api-reference/tts/create-speech) says "audio/pcm for pcm — 16-bit little-endian"; it gives no rate or channel count.
2. **Endianness and depth.** The same bytes read as s16le give speech-like signal (lag-1 autocorrelation 0.91, peak 0.46 of full scale, no clipping); as s16be, noise (autocorrelation 0.08, 414 clipped samples, and all three Whisper models transcribe it as "*static*", "[static]" or "you"); as float32, 9,166 non-finite values.
3. **Rate, against the MP3 of the same line.** The MP3 header says 24 kHz mono. `ffprobe` reports 6.475 s for the L1 MP3, but FFmpeg warns "Estimating duration from bitrate, this may be inaccurate"; decoding gives 143,471 samples = 5.978 s. Read as s16le at 24 kHz, the PCM is 5.875 s; at 22.05 kHz it would be 6.39 s, at 48 kHz or as float32 2.94 s. Inside the first sentence the two files agree to 2 ms (speech starts at 0.3245 s in both; the first pause starts at 2.3585 s in the PCM and 2.3568 s in the MP3), which a 22.05 kHz reading (9% stretch) could not do. The 0.10 s difference in total length is extra silence at the sentence join in the MP3 (2.4).
4. **Intelligibility.** Decoded as s16le 24 kHz mono, the clips transcribe with WER 0 on the plain lines (all three Whisper models).

DeepInfra PCM lengths were all whole multiples of 600 samples (25 ms); the Together take (135,885 samples) was not.

### 2.4 The MP3 timeline is not the PCM timeline

On the 914-character passage, the MP3 decodes 0.849 s longer than the PCM. Pause positions from FFmpeg `silencedetect` match within 1 ms up to the first sentence end, then the MP3 is later by 0.080, 0.170, 0.247, 0.334, 0.411, 0.50, 0.57, 0.65, 0.74 and 0.83 s after successive sentence ends: about 85 ms more per sentence join, with no change inside sentences. The MP3 looks like separately encoded sentences joined together (its Xing header counts only 109 frames). **Word times measured on one format do not apply to the other.**

### 2.5 How spend can be counted

- The speech reply carries no usage or cost.
- `GET https://openrouter.ai/api/v1/generation?id=<X-Generation-Id>` (with the API key) works for TTS generations. Fields returned for a generation: `total_cost`, `usage` (USD, equal to `total_cost`), `upstream_inference_cost` (0), `cache_discount` (null), `tokens_prompt` and `native_tokens_prompt` (229 for 914 characters, so these are **not** characters), `provider_name`, `provider_responses[]` (`endpoint_id`, `id`, `is_byok`, `latency`, `model_permaslug`, `provider_name`, `status`), `latency`, `generation_time`, `api_type: "tts"`, `streamed: false`, `num_input_audio_prompt: 0`, `created_at`, `model`, plus account and routing fields. **There is no character-count field.**
- **`total_cost` equalled characters × the chosen provider's list price exactly for all 18 generations** (17 at $0.62 per million on DeepInfra, 1 at $4 per million on Together). The cost can therefore be computed locally from `input.length` once the provider is pinned, and confirmed afterwards by the look-up.
- The key-level counter (`GET /api/v1/key`, field `usage`) lags: 15 s after a batch it showed $0.00186 of $0.00291; for a second batch it showed $0 after 20 s and exactly the batch's $0.00016492 after 60 s.

### 2.6 Repeatability

- **DeepInfra, three identical PCM requests:** identical length (141,000 samples), identical silences, and identical word times from the aligner (0 ms difference on all 17 words), but not identical bytes: waveform correlation 0.9945–0.9961, difference about 20 dB below the signal (19.6–21.1 dB). The same held for two MP3 requests (identical decoded length, correlation 0.9936) and for the default-format L3 against the PCM L3 (same length, same word times, correlation 0.992).
- So **timing repeated exactly, waveform did not** (n = 3 lines). A take cannot be reproduced bit-for-bit by re-requesting it, and a re-request through the other provider gives a different take.

### 2.7 Other observations

- **Silence:** DeepInfra takes start with 229–400 ms of silence (median 296 ms, 13 takes) and end with 0–493 ms (median 241 ms). "Look out!" ended with 0 ms of silence; whether the last sound was cut short is not determined.
- **Level:** peaks −3.8 to −10.5 dBFS, no clipped samples in any take.
- **How the line was read** (from the CTC model's free transcription and the Whisper transcripts):
  - "Dr." → "doctor" **followed by a 416 ms pause, as if a sentence ended**. "U.N." → "U N" followed by a 683 ms pause before "report". The full stops inside abbreviations are read as sentence ends.
  - "4.2 million" → "four point two million"; "Q3" → "cue three"; "18%" → "eighteen per cent"; "14 March" → "fourteen March"; "$1,250" → "one thousand two hundred fifty dollars" (no "and"); "7:45 p.m." → "seven forty five P M", with a 185 ms pause between "seven" and "forty"; "quay" → "key".
  - Names: "Rao" was heard as "Rau" or "Ral"; "Siobhan Nguyen" as "Chivon Nuw Yen" by the letter model and "Chavon" by Whisper base. Whether these are mispronunciations is a listening judgement not made here.
- **Long input:** 1,518 characters in one request gave a complete 90.15 s take with no audible join problems detected by the transcripts.

---

## 3. Part B — the options

| Option | Set up on this machine? | Set-up time | Download | Run time (CPU, this machine) | Licence (code / weights), where read |
|---|---|---|---|---|---|
| **1. Whisper in Node** (`@huggingface/transformers`, `return_timestamps: "word"`, 30 s chunks) | **Yes** | `npm install` 12.5 s (674 MB `node_modules`, including ONNX Runtime binaries); first run with download: 12 s (base.en), 34 s (small.en), 129 s (large-v3-turbo) | `onnx-community/whisper-base.en_timestamped` fp32 291 MB; `whisper-small.en_timestamped` fp32 969 MB; `whisper-large-v3-turbo_timestamped` 8-bit 1,085 MB | base.en: 0.11 × real time on long clips (5.8 s for 52 s), about 0.55 s minimum per call; small.en: 0.29 × (15.4 s for 52 s), about 1.5 s minimum; turbo 8-bit: 0.55–0.85 ×, about 5.5 s minimum | transformers.js Apache-2.0 (its `package.json`); ONNX Runtime MIT (`package.json`); Whisper code MIT ([openai/whisper LICENSE](https://github.com/openai/whisper/blob/main/LICENSE)); weights: Hugging Face cards `openai/whisper-base.en` and `openai/whisper-small.en` say `apache-2.0`, `openai/whisper-large-v3-turbo` says `mit`. The onnx-community conversion cards state no licence, only `base_model` |
| **2. CTC forced alignment in Node** (wav2vec2 CTC model through ONNX, own Viterbi over the known script) | **Yes** | Same install; the Viterbi with blank states and word mapping is about 40 lines; the number/abbreviation expander about 40 more | `Xenova/wav2vec2-base-960h` fp32 378 MB (8-bit variant 95 MB, not tested) | 0.04–0.06 × real time (2.9 s for 52 s, 5.3 s for 90 s, 0.05 s for 1 s); the Viterbi itself 0–92 ms; model load 0.45 s once cached | Weights: Hugging Face card `facebook/wav2vec2-base-960h` says `apache-2.0`; torchaudio's documentation of the same model says "MIT License" (fairseq). The Xenova conversion card states no licence |
| **3. Hosted speech-to-text via OpenRouter** | **No — blocked** | — | — | — | OpenRouter documents `POST /api/v1/audio/transcriptions` with `response_format: "verbose_json"` and `timestamp_granularities: ["word"]`, returning `words[{word, start, end, confidence?}]` and `usage.cost`. Listed per-second prices include `openai/whisper-large-v3` $0.0000075 (DeepInfra; Together $0.000025, Groq $0.0000308) and `whisper-large-v3-turbo` $0.00000333. **The one attempt returned 402: "This request requires at least $0.50 in balance for audio"**, although speech requests succeeded. Not retried, and no credit was added |
| **4. Python references** | **Partly** | venv + torch/torchaudio CPU wheels: 125 s (1.4 GB venv) | torchaudio wav2vec2 base 378 MB; MMS_FA 1.26 GB | torchaudio `forced_align`, wav2vec2 base: 0.06–0.09 ×; MMS_FA: 0.14–0.21 × | torch BSD-3-Clause (wheel metadata); torchaudio BSD 2-Clause (wheel LICENSE). **MMS_FA weights are CC-BY-NC 4.0** (torchaudio documentation), so it is a reference only, not usable in the product. `ctc-forced-aligner` has no binary wheel on PyPI (only a source package for 1.0.1/1.0.2, needing a C++ build), so it was not installed; its default model is the same MMS forced-alignment family. Montreal Forced Aligner's PyPI wheel needs Kaldi binaries from conda; not attempted |

whisper.cpp (the design's fallback) and MiniMax `asr-1.0` (the design's starting default) were not tested: the first needs a native build, the second is outside this spike's one-provider rule.

**Check on the Node aligner.** torchaudio's own `forced_align`, run on the same model, gave the same word starts as the Node implementation on 545 of 545 words, with a largest difference of one frame (20 ms) on one word. The Node trellis is therefore correct; the accuracy below belongs to the model and CTC alignment, not to a bug.

---

## 4. Comparison

Word starts are mapped to script words. Whisper words are matched to script words by an edit-distance alignment after expanding numbers. Differences are in milliseconds, method minus reference. "In tolerance" means within 40 ms early and 60 ms late, the design's mouth-shape tolerance.

### 4.1 Agreement between methods (word starts, all words)

| Pair | Words | Median | 90th pct | 95th pct | Worst | Signed median | Within −40/+60 |
|---|---|---|---|---|---|---|---|
| Whisper small.en − CTC (wav2vec2 base) | 542 | 80 | 180 | 279 | 980 | −60 | 201 (37%) |
| Whisper base.en − CTC | 542 | 120 | 280 | 320 | 840 | −120 | 26 (5%) |
| Whisper turbo 8-bit − CTC | 539 | 100 | 264 | 420 | 2,580 | −100 | 96 (18%) |
| Whisper small.en − Whisper base.en | 542 | 60 | 140 | 180 | 840 | +60 | 183 |
| CTC (wav2vec2 base) − MMS_FA (reference) | 545 | 20 | 20 | 40 | 60 | +20 | 545 (100%) |
| CTC Node − torchaudio `forced_align`, same model | 545 | 0 | 0 | 0 | 20 | 0 | 545 |

Worst Whisper-small/CTC cases: "7:45" (980 ms, Whisper wrote "7.45"), "for" in NUM2 (−700), "Rao" (−600, Whisper small heard "DOCTO - Rao"), "percent" (−560), and "and" in the 90 s passage at 30.9 s and 36.4 s (−540, −520), next to 30 s chunk boundaries. The two CTC models, with different training data, agree on every word within one or two 20 ms frames.

### 4.2 Agreement with the signal: words after a clear pause

**This checks only words that follow a pause** (72 of about 545 words, in all 10 clips; pauses 230–898 ms, median 427 ms). The onset is where a 5 ms RMS window first rises above −45 dBFS after at least 150 ms below it (1 ms steps). The word after each pause is taken from the script, at the word boundary that the methods place nearest the pause (one pause, inside "7:45", was left unmatched).

| Method | Pauses | Median | 90th pct | 95th pct | Worst | Signed median | Within −40/+60 |
|---|---|---|---|---|---|---|---|
| **CTC, wav2vec2 base, Node** | 72 | **24** | **50** | **59** | **72** | +7 | **69 (96%)** |
| MMS_FA via torchaudio (non-commercial; reference) | 72 | 19 | 34 | 41 | 52 | −5 | 71 (99%) |
| Whisper small.en, Node | 72 | 71 | 427 | 503 | 581 | −54 | 25 (35%) |
| Whisper base.en, Node | 72 | 112 | 400 | 553 | 739 | −109 | 10 (14%) |
| Whisper turbo 8-bit, Node | 72 | 276 | 570 | 648 | 1,973 | −276 | 5 (7%) |

- **First word of each clip** (10): CTC median 31 ms late, worst 59 ms, 10 of 10 in tolerance. Whisper base and small put the first word at 0.00 s in 10 of 10 clips, 229–401 ms before the speech starts.
- **Pauses inside clips** (62): CTC median 23, 95th percentile 59, worst 72 ms, 59 of 62 in tolerance. The three misses: "Nobody" +65 ms, "One" +72 ms, "who" −50 ms.
- **Reference sensitivity:** with the threshold at −40 or −50 dBFS instead of −45, the CTC percentiles change by at most 3 ms and its signed median moves between +3 and +13 ms. The CTC times sit on a 20 ms grid, which alone contributes up to ±10 ms.

### 4.3 Word ends before a pause

End of the word before a pause, minus the start of the measured silence (62 pauses):

| Method | Median | 90th pct | 95th pct | Worst | Signed median | Within −40/+60 |
|---|---|---|---|---|---|---|
| CTC, wav2vec2 base | 83 | 123 | 126 | 268 | −83 | 2 |
| MMS_FA (reference) | 51 | 101 | 121 | 228 | −51 | 17 |
| Whisper small.en | 78 | 168 | 195 | 274 | −71 | 14 |
| Whisper base.en | 191 | 367 | 392 | 562 | −190 | 0 |

CTC word ends are early, because the model marks a letter in its first frames and the tail of the word falls into blank frames. Without a correction step (for example extending each end to the next silence or the next word), **ends do not meet the 40/60 ms tolerance on this evidence.**

### 4.4 Drift over long passages

Words after pauses in the 52 s and 90 s passages, by position:

| Method | Before 30 s (25) | 30–60 s (21) | After 60 s (9) |
|---|---|---|---|
| CTC, wav2vec2 base: median / worst / in tolerance | 24 / 60 / 24 | 19 / 65 / 20 | 21 / 72 / 8 |
| Whisper small.en: median / worst / in tolerance | 54 / 459 / 12 | 64 / 543 / 6 | 70 / 323 / 4 |

No drift was seen for CTC up to 90 s (the audio was processed in 30 s windows with 2 s of context). Whisper's errors do not grow steadily but are larger near its 30 s chunk joins.

### 4.5 Transcript quality (word error rate on correct takes)

WER = (S + D + I) / N. "Plain" normalises only case and punctuation; "normalised" also expands digits, "%", "$", "Dr." and British spellings in both texts (575 reference words).

| Model | Plain WER | Normalised WER | Errors left after normalising |
|---|---|---|---|
| Whisper small.en | 3.4% | **1.6%** (9 of 575) | "Dr."→"Docto"/"Dr" (2), "U.N."→"UN" (2), "7:45"→"7.45" (2), "quay"→"key", "behaviour"→"behavior", "path"→"pass" |
| Whisper base.en | 3.9% | 2.1% (12) | "Siobhan"→"Chavon", "Rao"→"Rau", "U.N."→"UN", "7:45"→"7.45" (several), "quay"→"key", "band"→"ban", "logbook"→"log book" |
| Whisper turbo 8-bit | 4.5% | 2.6% (15) | Names, numbers and times all correct on the short lines (including "7:45 p.m." and "Siobhan Nguyen"), but **a 3-second hallucination** on the 52 s passage at 26–29 s ("a full-time, and a full-time, a full …", zero-length words), replacing about 10 real words, next to the first 30 s chunk boundary |

Per clip, the plain lines scored 0 and the long passages 0.6–0.7% (small.en), but **the short lines with numbers, abbreviations and names scored 0.08–0.30 normalised on correct takes** (up to 0.62 plain; NUM2 normalised: 0.17 small.en, 0.30 base.en, 0.09 turbo), above the design's per-take threshold of 0.10 (`stt.wer_max_take`). Kinds of difference:

- **Numerals written as digits** ("60", "4.2", "18%", "$1,250", "Q3"): disappear after expansion.
- **Times:** "7:45" transcribed as "7.45" by base and small, which expands to a different reading.
- **Abbreviations:** "U.N." → "UN" (one token against two), "Dr." → "Doctor", "Dr" or "DOCTO".
- **Names:** "Siobhan" → "Chavon", "Rao" → "Rau".
- **Spelling:** US spellings ("harbor", "meter", "color", "behavior"); compound splits ("log book").
- **Homophones:** "quay" → "key".

### 4.6 Planted script errors (aligner only, no new audio)

The aligner was run with three wrong scripts: "old" → "new" (L1), "sixty" → "seventy" (L2), and an extra word "quickly" (L3). The wrong word scored a mean letter probability of about 0 in 3 of 3 cases, against 0.80–1.00 for every other word in those lines; the timing of the other words did not move in the two substitution cases; in the insertion case the token holding the extra word moved 140 ms and its neighbour 20 ms. On clean takes, though, names and unusual words scored as low as 0.013 ("path"), 0.014 ("Siobhan") and 0.034 ("quay"). The per-word score flags script/audio mismatches, but on this evidence it cannot tell a wrong word from an unusual pronunciation.

### 4.7 What breaks

| Case | CTC alignment (Node) | Whisper word times (Node) |
|---|---|---|
| Numbers, symbols | Needs the spoken form. Kokoro's readings in 2.7 were matched by a small expander; a wrong expansion leaves a low-score word but here did not move its neighbours | Writes digits; "7:45" → "7.45"; the worst start errors (up to 980 ms) are on number tokens |
| Abbreviations | Letter names ("Q", spoken "cue") score low (0.09); their timing was not checked against the signal. "Dr." and "U.N." made Kokoro pause as at a sentence end | "Dr." merged or split oddly ("DOCTO - Rao") |
| Names | Low score (0.01–0.14), timing still within the pause-onset tolerance where checked ("Siobhan" +42 ms, "Rao" +18 ms) | Base mis-hears names |
| Long passages, drift | None seen to 90 s | Larger errors near 30 s chunk joins; turbo hallucinated a 3 s span |
| Very short lines ("Yes.", "Look out!") | Correct (+38, +59 ms) | First word at 0.00 s (−401, −241 ms) |
| First word of every clip | Correct (worst +59 ms) | 0.00 s in 10 of 10 clips |
| Word ends | 83 ms early (median) | 71–190 ms early |

---

## 5. Spend and how it was counted

| Item | Count | Cost (USD) |
|---|---|---|
| Speech, billed generations | 18 | **0.00307836**, the sum of `total_cost` from `GET /api/v1/generation` for each `X-Generation-Id` |
| Speech, rejected (400, no generation id) | 1 | 0 (not billed according to the documentation; no id to look up) |
| Transcription attempt (402) | 1 | 0 |
| Generation look-ups (19), key-usage reads (6), public model listings (6) | 31 | 0 |
| **Total** | | **about $0.0031**, 1.2% of the $0.25 cap |

The independent check: the key-level `usage` rose by exactly the look-up sum for the second batch ($0.00016492, read 60 s after it). For the first batch it was read too early (after 15 s) and was incomplete.

---

## 6. Limits of the test

- **Ten clips, five voices, all English, one provider's take of each,** one day. Kokoro takes are clean synthetic speech without noise or music; real recordings or takes over music were not tested.
- **The signal check covers only words after pauses** (72 of about 545 words). Words joined to their neighbours have no ground truth here; for them there is only agreement between methods.
- **No hand-labelled reference.** The onset reference is an energy threshold with about ±5 ms precision; weak starting sounds ("h", "f", "th") may begin below it.
- **Speeds are Windows on an 8-core laptop CPU,** not Node 26 on Linux. Whisper ran through transformers.js only, at the precisions listed; whisper.cpp, other transformers.js versions and quantised wav2vec2 were not tested.
- **MMS_FA's better figures cannot be used in the product** (CC-BY-NC 4.0). A larger permissively licensed English CTC model (for example `facebook/wav2vec2-large-960h-lv60-self`, Apache-2.0) was not tested.
- **Phoneme-level timing** (what mouth shapes ultimately need inside a word) was not measured; only word starts and ends.
- **Hosted transcription was not measured** (402: $0.50 minimum balance). MiniMax `asr-1.0`, the design's starting default, was out of scope.
- The WER normaliser was written for this spike; a different normaliser would move the figures for numbers, times and abbreviations.
- MP3/PCM latency figures are single samples.

---

## 7. What the evidence supports

- **Format and engine facts.** PCM from this route is s16le, 24 kHz, mono (high confidence). MP3 adds about 85 ms of silence per sentence join, so word times must be taken from the PCM. Unpinned routing reached the dearer provider once in 15 successful requests, with different audio; pinning with `provider.only` and `allow_fallbacks: false` worked 3 of 3 times. Cost is exactly characters × the pinned provider's price and can be confirmed per generation through `/api/v1/generation`. The engine repeats timing exactly but not bytes.
- **Captions.** CTC forced alignment in Node (the wav2vec2-base-960h ONNX model with a short Viterbi, no Python) placed word starts within 72 ms of the measured onset at every one of 72 pauses, with no drift to 90 s, and agreed with a different CTC model within 60 ms on all 545 words. That supports cutting caption cues and probably word-by-word highlighting. Whisper word timestamps from transformers.js put the first word of every clip 0.23–0.40 s early and had a 90th percentile of 400–570 ms at pauses, so on this evidence they do not support word-by-word highlighting without further correction.
- **Mouth-shape tolerance (40 ms early, 60 ms late).** CTC with the permissive base model met it for **word starts after pauses** in 69 of 72 cases (worst 72 ms late). It did **not** meet it for word ends (median 83 ms early) without an end-correction step that was not tested. Starts of words that do not follow a pause, and timing inside words, are **unmeasured**. The non-commercial MMS model did better (71 of 72; worst 52 ms), which suggests model choice matters; no permissive larger model was tested.
- **Transcript check.** Whisper in Node runs without Python at 0.1–0.3 × real time and transcribed correct takes with 1.6–2.1% normalised WER overall. On short lines with numbers, abbreviations, times and names, correct takes scored 0.08–0.30, above the 0.10 per-take threshold, because of digit formats, "7:45"/"7.45", "U.N."/"UN" and names. The check's normalisation rules (or its threshold for short lines) decide whether such takes are flagged. Turbo 8-bit gave the best short-line transcripts but hallucinated once at a chunk join on a long passage.
- **Using the aligner as a mismatch detector.** Planted wrong words scored about 0 in 3 of 3 cases, but correct names scored nearly as low, so on this evidence it does not replace speech-to-text for the transcript check.
- **Still unmeasured:** hosted transcription through OpenRouter (blocked by its $0.50 minimum balance); MiniMax `asr-1.0`; whisper.cpp; speeds on Node 26 on Linux; a larger permissive CTC model; quantised models; word ends after correction; word starts not after pauses; phoneme timing; non-English voices; inputs above 1,518 characters; rate limits.
