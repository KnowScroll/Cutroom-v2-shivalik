# Spike Evidence Log

**Cutroom v2 | Evidence | Started 14 November 2026**
**Status:** EVIDENCE. These are measurements from throwaway spikes run under the [spike rules](../lld/00-design-process-and-roadmap.md#13-spike-rules). The spike code was deleted. Each entry states its limits. A spike result is not a product benchmark.

**Test machine:** AMD Ryzen 7 5800H (8 cores / 16 threads), 15.3 GB RAM, NVIDIA RTX 3050 Laptop GPU (4 GB), Windows 11 Home, WSL2 Ubuntu 22.04.

**Reading PSNR values:** PSNR compares two images. Above about 50 dB they look identical. "Identical" below means byte-identical. Two different consecutive frames of the test scene score about 27 dB.

---

## S1 — Headless Chrome capture speed, Windows native (14 Nov 2026)

**Question:** how fast is seek-and-capture at 1080 × 1920, how well does it parallelise, and is it repeatable?

**Setup:** Chrome 157.0.8103.78 (new headless), Node 22.23.4, puppeteer-core, FFmpeg 8.1.1. Capture through `Page.captureScreenshot`. Test page: gradient background, 40 moving SVG shapes, an SVG character of about 170 nodes with a blur shadow, 300 seeded canvas particles, HTML caption text. All state is set by a pure `seek(t)`. 300 frames per configuration.

| Configuration | Effective ms per frame | Frames per second | Chrome memory |
|---|---|---|---|
| 1 browser, PNG | 104 | 9.6 | about 490 MB |
| 1 browser, JPEG q90 | 55 | 18.1 | about 490 MB |
| 2 tabs in one headless window | hung | — | — |
| 2 browser contexts, 1 browser | 29.8 | 33.6 | 584 MB |
| 4 browser contexts, 1 browser | 28.6 | 35.0 | 1.0 GB |
| 2 browsers | 30.8 | 32.5 | 1.2 GB |
| 4 browsers | 19.4 | 51.5 | 2.6 GB |
| 6 browsers | 14.8 | 67.6 | 3.8 GB |
| 1 browser, forced GPU flags | 54.9 | 18.2 | about 490 MB |
| 4 browsers, forced GPU flags | 17.4 | 57.5 | 2.6 GB |

**Findings:**
- Two tabs in one headless window hang, because the background tab gets no frames. Parallel capture needs separate browser contexts or separate browsers.
- Separate browsers scale better than contexts in one browser.
- Forcing GPU flags changed nothing. GPU rasterisation was already on.
- **Repeatability:** the same frame captured twice is not byte-identical. PSNR was 77.6 dB with GPU rasterisation and 82.7 dB with `--disable-gpu`. No stale or wrong frames were seen.
- **Encoding 300 PNG frames:** libx264 (medium, CRF 18) 3.44 s; h264_nvenc (p5, CQ 19) 1.62 s. Quality settings were not equalised.
- **Extrapolated to a 2,700-frame film:** about 40–55 s to capture with 4–6 browsers; about 31 s to encode with x264, about 15 s with NVENC.

**Limits:** a light-to-moderate scene; heavy filters will be slower. Windows screenshot path only.

---

## S1c — Capture on Linux in WSL2, screenshot versus BeginFrame (14 Nov 2026)

**Question:** how does the Linux path that production will use compare, and does BeginFrame give byte-exact frames?

**Setup:** WSL2 Ubuntu 22.04 with 7.6 GB RAM at the time, `chrome-headless-shell` 157.0.8103.78, Node 22.23.5, a static FFmpeg build. Chrome used SwiftShader software rendering (no GPU in WSL2 for Chrome). Same test page as S1. BeginFrame used `--enable-begin-frame-control`, `--run-all-compositor-stages-before-draw` and related flags, with `HeadlessExperimental.beginFrame`.

| Configuration | Effective ms per frame | Frames per second |
|---|---|---|
| Screenshot, PNG, 1 browser | 214 | 4.7 |
| Screenshot, JPEG, 1 browser | 138 | 7.3 |
| BeginFrame, PNG, 1 browser | 140 | 7.2 |
| BeginFrame, JPEG, 1 browser | 72 | 13.9 |
| Screenshot, JPEG, 4 browsers | 31.8 | 31.5 |
| BeginFrame, JPEG, 4 browsers | 24.5 | 40.9 |
| BeginFrame, JPEG, 6 browsers | 19.7 | 50.8 |

**Findings:**
- BeginFrame is 1.3–1.9× faster than the screenshot path on Linux.
- Linux software rendering is about 25–35% slower than the Windows GPU path at the same parallelism. A 2,700-frame film still captures in about 53 s with 6 browsers.
- **Repeatability, both paths:** within one page, seeking to a frame out of order gives byte-identical pixels. A fresh browser compared with a long sequential run differs slightly (PSNR 82.66 dB, the same value as Windows with GPU off).
- **HYPOTHESIS, not verified:** pixels depend on how many frames the page has already drawn (for example through compositor layer decisions), not only on the time value. A pure `seek(t)` is therefore not enough to guarantee byte-identical pixels across pages.
- libx264 took 3.9 s per 300 frames.
- h264_nvenc failed in WSL: that FFmpeg build needs NVENC API 13.1 (driver 610 or newer); the installed driver 592.82 provides 13.0.
- `chrome-headless-shell` needed `libnss3`, `libnspr4` and `libasound2`, which a stock WSL Ubuntu lacks.

**Limits:** the memory figures from this run were unreliable and are not reported. Same scene as S1.

---

## S2 — MiniMax authoring fitness for seekable visual components (14 Nov 2026)

**Question:** can MiniMax models write a self-contained, seekable, deterministic visual component in one attempt, in which representation, and can MiniMax-M3 review the result from a contact sheet?

**Setup:**
- 5 tasks: cartoon presenter doing a double-take; maglev cross-section diagram; animated bar chart with exact values; kinetic typography; abstract beat-synced motion graphic.
- 3 representations: inline SVG, Canvas 2D, HTML/CSS.
- 2 models: MiniMax-M3 (thinking off) and MiniMax-M3.1-Flash at `effort: low`.
- 30 single-shot generations, one per cell, through the Anthropic-compatible endpoint with streaming. No repair loop.
- The prompt required a `window.__seek(t)` that sets the whole state for time `t`, and banned timers, CSS animations, `Date`, `Math.random` and external URLs.
- Each result was loaded in headless Chrome with network access blocked, rendered at 6 time points, and re-captured after out-of-order seeks.
- MiniMax-M3 (thinking on) then reviewed one contact sheet per task (6 candidates × 6 frames).
- Total spend: **$0.20**.

**Generation:**

| | MiniMax-M3 | M3.1-Flash (low effort) |
|---|---|---|
| Median time per component | 24 s (max 66 s) | 22 s (max 124 s) |
| Median output tokens | 4,431 | 5,469 |
| Average cost per component | $0.0056 | $0.0033 |

**Rule compliance:** 30 of 30 returned one extractable HTML document, used no banned API, made no external request, and kept to the requested representation.

**Render outcomes (first attempt, no repair):**

| Outcome | Count | Detail |
|---|---|---|
| Clean render | 22 of 30 | |
| Hard failure (script error, nothing drawn) | 6 of 30 | M3: 4 of 15; Flash: 2 of 15. Three syntax errors, three runtime errors |
| Rendered with console errors | 2 of 30 | Invalid SVG path or transform strings. In one, all text was missing |
| Rendered without errors but visibly broken | at least 1 | A character drawn with no face |

- About two thirds of single-shot components were usable.
- Hard failures by representation: SVG 2 (plus the 2 console-error cases), Canvas 2, HTML 2. With 10 samples each, no representation is a clear winner.
- **Order independence:** of the 24 that rendered, 22 gave identical or near-identical pixels (79 dB or better) when a frame was revisited after out-of-order seeks. Two HTML components scored 54.6 dB and 65.2 dB, which means state leaked between seeks.
- **Quality, from direct inspection of two contact sheets:** the best outputs are clean flat-vector graphics that would be acceptable in a reel. Characters are simple but readable. Nuanced acting was not achieved in one shot: no candidate showed the requested glance-right, return, glance-right sequence. Several outputs had layout defects such as a word overflowing the safe area or a duplicated word.

**Reviewer (MiniMax-M3 with thinking, one contact sheet per call):**
- About 3,400 input tokens per call (a 1560 × 2604 image plus the prompt).
- 10,000–12,000 output tokens per call, of which about 95% were thinking tokens.
- 75–97 s per call; about $0.014 per call.
- It identified every failed row and marked those scores `UNKNOWN`.
- Its listed defects matched direct inspection on the two sheets checked: the faceless character, the missing glance, the duplicated word, the word outside the safe area, and the candidate with no text.

**What this means for the design:**
- A validate-and-repair loop for component code is mandatory. Loading the component and calling `__seek` at a few times catches the hard failures cheaply, before any model review.
- An out-of-order seek check belongs in component validation.
- Console errors must be treated as failures, because they hid missing content.
- Generating several candidates and selecting among them is affordable at these prices.
- The Reviewer's thinking tokens cost about ten times the earlier estimate per call. A review is still about one cent.
- Complex acting needs more than a one-shot prompt: decomposition into poses and beats, or iteration with the Reviewer.

**Limits:** one sample per cell; one prompt design; no repair loop; Flash tested only at low effort; rendered on the Windows screenshot path, not the WSL2 BeginFrame path; the Reviewer's accuracy was spot-checked on two of five sheets, not measured against human ratings.

**Kept evidence:** the five contact sheets are in [evidence/s2-contact-sheets/](evidence/s2-contact-sheets/). Rows A–F are SVG/M3, SVG/Flash, Canvas/M3, Canvas/Flash, HTML/M3, HTML/Flash. Columns are six time points from start to end.

---

## S3 — Validate-and-repair loop with MiniMax (14 Nov 2026)

**Question:** how often does feeding exact validation errors back to the model fix a failed component?

**Full results:** [evidence/s3-s5-s6-minimax.md](evidence/s3-s5-s6-minimax.md). Run on the Windows screenshot path with MiniMax-M3.1-Flash at low effort.

- 80 components were generated single-shot. The validator passed 72 (90%) at once, 77 (96%) after one repair round and 80 (100%) after two. The third round, on MiniMax-M3, was never needed.
- A whole-document repair on Flash averaged 4,240 output tokens, 19 s and $0.0032.
- Search/replace repairs fixed as many of the same failures (5 of 8 in one round) with 683 output tokens, 6.6 s and $0.0011.
- MiniMax-M3 as the first repairer fixed 6 of 8, at 74 s and $0.011 each.
- No repair broke a check that was passing.
- **At least 7 of the 72 validator-passing components were visibly broken** (near-zero chart bars, invisible text, off-frame characters). Usable output was roughly 81% single-shot and 91% after repair.
- One of the 8 failures was a validator false alarm: six sample times missed a short motion.

**Limits:** one prompt design; visual usability was judged by the spike agent's own inspection, not by measured human ratings.

---

## S4 — Sandboxed-iframe host page with BeginFrame (14 Nov 2026)

**Question:** does the proposed composition method (one trusted host page, each component in its own sandboxed iframe, seek all, wait for acknowledgements, capture once) work, and what does it cost?

**Full results:** [evidence/s4-render-host.md](evidence/s4-render-host.md). WSL2 Ubuntu 22.04, `chrome-headless-shell` 157, software rendering, 1080 × 1920.

- **Correctness:** with seek, acknowledge, then BeginFrame, 0 of 900 captures showed a wrong frame. Without waiting for acknowledgements, 299 of 300 were wrong.
- **Speed:** about 33, 50 and 80 ms per frame with 1, 5 and 15 components in one browser. The same 15 components in a single document took 75 ms. Four browsers gave about 30 ms per frame effective.
- **Memory:** 575, 718 and 921 MB (resident) for 1, 5 and 15 components; 3.6 GB for four browsers.
- **Process isolation is not available.** Under BeginFrame control the iframes share the host's renderer process, and `--site-per-process` is refused. Isolation is by origin.
- **Sandbox and content policy:** fetch, image loads and WebSocket are blocked by the component's content security policy; parent access, storage and cookies are blocked by the sandbox.
- **Two leaks got past the component policy:** self-navigation to an external URL, and WebRTC STUN over UDP. A host-page `frame-src 'none'` closed the first and `--force-webrtc-ip-handling-policy=disable_non_proxied_udp` closed the second.
- **Shim gaps:** a nested `srcdoc` iframe gets native timers and clocks; `new Date()` and `crypto.getRandomValues` bypass the overrides. No fix was tested in S4 (see S7).
- **Compositing across iframes:** opacity, two blend modes, a mask, a clip path and z-order all gave the expected pixels.
- **Zoom:** SVG and text under a 2× CSS scale were pixel-identical to native 2× rendering. Canvas was blurry unless drawn at 2×. `will-change: transform` on the zoom container made content blurry.
- **Probes:** collecting bounding boxes for 20 tagged elements added under 1 ms per frame.
- **Fonts:** a font installed in the user's font directory worked by family name inside the sandbox.
- **Preview scale:** `deviceScaleFactor` below 1 had no effect. A smaller window plus a host-page CSS scale gave 41 ms (half size) and 30 ms (one third), against 79 ms.
- **Intermediates:** PNG 98–103 ms, JPEG q95 76–79 ms, JPEG q100 83–85 ms per frame. Video encoded from JPEG q95 frames scored 40.6 dB (SSIM 0.987) against video encoded from PNG frames.
- **Chunk seam:** frame 150 rendered in two browsers differed slightly (81.95 dB, 133 pixels), all in an HTML caption. Browsers given the same render history were byte-identical.

**Limits:** test components were written by the spike agent, not by a model; `backdrop-filter` and group filters were not tested.

---

## S5 — MiniMax tool calling, handles and caching (14 Nov 2026)

**Question:** is tool calling reliable without a JSON-schema mode, do short handles beat long IDs, and how does the prefix cache behave?

**Full results:** [evidence/s3-s5-s6-minimax.md](evidence/s3-s5-s6-minimax.md). 352 scripted trials across MiniMax-M3 and M3.1-Flash.

- 377 of 381 tool calls (99.0%) were valid against their schemas.
- No entity reference was miscopied, with handles or with long IDs. Long IDs cost about 885 more input tokens per task (30% more).
- Fully correct trials: Flash 87 and 85 of 88; M3 77 of 88 in both modes. M3 often re-read the project before editing.
- Parallel tool calls occurred in 31 of 32 trials that needed them.
- After an exact schema error, 4 of 4 naturally invalid calls were fixed on the next turn. In a deliberate trap test, 9 of 15 became valid, 5 became a text explanation and 1 stayed invalid.
- Caching is automatic: about 99% of input was read from cache from the second turn. It still hit after 25 idle minutes and missed after 32.
- The spike key is on a MiniMax subscription plan and returned HTTP 429 at about 10 concurrent requests.

**Limits:** canned tool results and a small fictional project; rate limits on a pay-as-you-go key were not measured.

---

## S6 — Controls plus a control track, against one-shot acting (14 Nov 2026)

**Question:** does separating a character's drawing (a component with controls) from its acting (keyframes over those controls) achieve the acting that single-shot components could not?

**Full results:** [evidence/s3-s5-s6-minimax.md](evidence/s3-s5-s6-minimax.md); contact sheets in [evidence/s6-contact-sheets/](evidence/s6-contact-sheets/).

- Characters with controls (Flash): 4 of 5 passed the control check first time, 5 of 5 after one repair. Arm controls were wrong on 2 of 5.
- Control tracks (M3, thinking on): 3 of 3 valid on the first attempt, at $0.004–0.006 and 38–62 s each.
- **The double-take (glance right, back to camera, snap right) was visible on 5 of 5 characters** when frames were spaced 120 ms apart. In S2 no single-shot component achieved it.
- It was invisible in 12 evenly spaced frames (0 of 15 sheets).
- MiniMax-M3 as judge agreed with direct inspection on 12 of 15 sheets and gave 1 false positive in 10 control sheets.
- Shifting the snap 300 ms by editing only the track worked, with the character file's hash unchanged. A clean delay needed an added hold keyframe.

**Limits:** five characters, one acting brief, linear or eased interpolation in the spike's own harness.

---

## Segment join — stream-copy concatenation of H.264 segments (14 Nov 2026)

**Question:** can separately encoded chunk segments be joined without a second encode?

**Setup:** FFmpeg 8.1.1 on Windows. A 390-frame 1080 × 1920 test pattern at 30 fps was encoded as one file and as three segments (150, 90 and 150 frames) with identical `libx264` settings (medium, CRF 18, `yuv420p`, BT.709 tags). The segments were joined with the concat demuxer and `-c copy`.

- The joined file had exactly 390 frames, a duration of 13.000 s and a uniform timestamp step.
- Its size matched the single encode (17.39 MB against 17.38 MB).
- PSNR against a lossless reference was the same for both to within 0.001 dB on average, with the same minimum.
- Muxing a 48 kHz mix with AAC gave equal video and audio stream durations.
- A coarse onset measurement (`silencedetect`) put the audio about 13 ms late. The method's resolution is about one AAC frame (21 ms), so this is an upper bound, not a measurement.

**Limits:** a synthetic test pattern. The precise mux offset was measured afterwards in batch 2a.

---

## S7 — PixiJS as a trusted library, shim hardening, anchor-follow (14 Nov 2026)

**Full results:** [evidence/s7-pixi-hardening-follow.md](evidence/s7-pixi-hardening-follow.md). WSL2, `chrome-headless-shell` 157, software rendering.

**PixiJS 8.23.0**
- It initialises inside the sandboxed iframe with no change to the content security policy, on WebGL 2 through software rendering. It needs its `unsafe-eval` add-on module inlined, both tickers stopped, manual rendering on seek, and textures made from an image element or a canvas. `Assets.load` hangs silently under the policy. WebGPU did not work.
- 0 wrong frames in 2,100 random-order captures. A frame was byte-identical on re-seek, across fresh browsers and across different render histories.
- It was slower than hand-written Canvas 2D in every comparison: 178–220 ms against 70–79 ms per frame for 200 sprites with a full-frame blur and text; 57–63 ms against 44–47 ms with no filter; 35 ms against 27.5 ms for a small sprite-sheet and IK component.
- One PixiJS browser used about 10 cores, so four browsers gave 1.5× throughput, against 3.1× for Canvas 2D.
- A sprite-sheet animation and a two-bone inverse-kinematics arm were deterministic in PixiJS, Canvas 2D and SVG.

**Shim hardening**
- A nested `srcdoc` iframe inherits the host's content security policy. `frame-src 'none'` and `child-src 'none'` did not stop nested frames reaching a native clock (20 of 24 routes still worked).
- A guard based on a document-level mutation observer was beaten through shadow roots.
- Two measures blocked every route tried: extending the guard to shadow roots, and setting `script-src` to the hash of one inline script holding the shim, the library and the component.
- Replacing `Date` alone was not enough. `performance.timeOrigin`, event timestamps, `Intl` formatters, `Temporal` and `document.timeline` each needed an override; with all of them, no real time was reachable.
- Still not repeatable: tick loops built on self-`postMessage` or image `onerror`, `navigator.connection.downlink`, and images created during a render.
- The two leak fixes from S4 hold with the final policy: no navigation requests and no UDP packets.

**Anchor-follow**
- A follower layer placed from the leader's probe point within the same frame was at most 0.27 px off in 300 captures. The extra round trip cost under 0.1 ms per frame.

**Limits:** another spike shared the machine for part of the run, so the first two timing batches are noisier than the rest; PSNR was computed in Node, not FFmpeg.

---

## Batch 2a — colour chain, mux offset and mastering (14 Nov 2026)

**Full results:** [evidence/b2a-colour-mux-mix.md](evidence/b2a-colour-mux-mix.md). FFmpeg 8.1.1 on Windows.

**Colour**
- With the explicit BT.709 matrix and range options, decoded pixel values differed from the source by at most 1 level (mean 0.208) over 24 patches.
- The command as first written left `color_primaries` and `color_transfer` untagged. Appending `setparams=color_primaries=bt709:color_trc=bt709` tags them.
- With no colour options the encode used BT.601 and was wrong by up to 39 levels.
- `bt709` and `iec61966-2-1` transfer tags gave identical pixels in FFmpeg and identical Chrome screenshots.

**Mux offset**
- Audio lag after muxing was 0 samples. Deliberate offsets of +20 ms and −50 ms were recovered exactly. A video made of three joined segments also gave 0.
- The result relies on the MP4 edit list; ignoring it gives +21.33 ms.
- Decoded AAC audio was 256 samples longer than the 480,000-sample mix.

**Mastering with two-pass `loudnorm`**
- It fell back to dynamic mode when the measured loudness range was 0, or when true peak minus loudness exceeded 12.5 dB. The proposed peak guard did not restore linear mode without extra margin.
- Linear mode missed the target by 0.7 LU on a sparse mix.
- AAC encoding raised true peak by up to 1.5 dB on peak-limited material; one master went from −2.0 to −0.6 dBTP.
- Ducking with `sidechaincompress` lowered music by 6.4 dB under speech and 0 dB in pauses. `adelay` with the `S` suffix and `amix=normalize=0` were exact.

## M1 — static-gain mastering (14 Nov 2026)

**Question:** does "measure, apply one static gain, limit, verify" reach the loudness target where `loudnorm` did not?

**Setup:** FFmpeg 8.1.1. Three synthetic 20-second mixes (gated noise over a tone; a dense loud mix; a quiet tone with one sharp transient), each 960,000 samples. Target −14 LUFS; oversampled `alimiter` at −2.5 dBTP and at −3.0 dBTP; AAC at 192 kb/s.

| Mix | Passes | Master loudness / true peak | After AAC, loudness / true peak |
|---|---|---|---|
| Gated noise over tone (−2.5 ceiling) | 1 | −14.08 LUFS / −2.47 dBTP | −14.36 / −2.29 |
| Dense loud mix (−2.5 ceiling) | 1 | −14.06 / −3.50 | −14.33 / −3.71 |
| Sparse with transient (−2.5 ceiling) | 2 | −14.05 / −2.42 | −14.05 / −2.51 |
| Same three at a −3.0 ceiling | 1, 1, 2 | −14.05 to −14.10 / −2.90 to −3.46 | −14.05 to −14.37 / no higher than −2.55 |

- Every master was exactly 960,000 samples; decoded AAC was 960,512.

**Limits:** synthetic material; the largest AAC peak rise seen here was 0.35 dB, against 1.5 dB in batch 2a, which is why the design uses the −3.0 ceiling.

---

## Batch 2b — SQLite on Node 26 (14 Nov 2026)

**Full results:** [evidence/b2b-sqlite-node.md](evidence/b2b-sqlite-node.md). WSL2 ext4, Node 26.13.1, bundled SQLite 3.54.1.

- `node:sqlite` loads with no flag and no warning. Write-ahead logging, strict tables, `BEGIN IMMEDIATE`, prepared statements, `json_each` and online backup all work.
- 500 revisions of an 800-entity project: 49.9 MB (94% manifests). A warm snapshot load took 1.7 ms; a diff took 0.5 ms.
- Commit latency with `synchronous=FULL`: median about 5 ms, 99th percentile 12–28 ms, maximum 94–192 ms. The longest main-thread stall equalled the longest commit. With `NORMAL` the longest stall was 25–30 ms. Ungrouped commits fell 2.4 s behind at 50 writes per second; grouped commits did not.
- 400 SIGKILLs during a promotion loop: no integrity failure, the head always matched the log, and no acknowledged commit was lost. About 9 in 10 kills left one committed but unacknowledged transaction.
- Blob ingest of 2,700 one-megabyte files: 177–329 MB/s without a sync per file, 36–41 MB/s with one.
- A database on `/mnt/c` gave no error, including under two processes and 200 kills. It was slower: reopen after a kill took 72 ms against 2 ms. `/proc/mounts` reports that mount as `9p` and the Linux home as `ext4`.
- `canonicalize` 5.1.0 passed the RFC 8785 number table and sorting example and matched a reference on 10,000 random objects. `uuid` 14.0.3 `v7()` gave 100,000 unique IDs in generation order; Node's built-in `crypto.randomUUIDv7()` is not ordered within a millisecond.

**Limits:** most runs overlapped heavy load from another spike, so latency tails are noisy; process death was tested, power loss was not.

---

## Batch 2c — MiniMax review behaviour (14 Nov 2026)

**Full results:** [evidence/b2c-minimax-review.md](evidence/b2c-minimax-review.md). MiniMax-M3 and M3.1-Flash; $0.58 spent over 402 requests.

**Finding a single-frame defect**

| Evidence shown to M3 | Exact frame named | False alarms on clean material |
|---|---|---|
| Real-time clip at `fps: 5` | 0 of 24 | 7 of 8 |
| Clip slowed 6× at `fps: 5` | 38 of 48 | 5 of 16 |
| Still strip of 18 consecutive frames | 22 of 24 | 4 of 8 |

- The still strip used about a fifth of the tokens of the slowed clip.
- Video input cost 173 tokens per sampled frame at 540 × 960. `fps` must sit inside the `source` object; at block level it is silently ignored. With no `fps`, the endpoint sampled at 2 frames per second, not the documented 1.

**Reviewer accuracy against thinking**

| Mode | Defects found | False defects | Cost per review | Latency |
|---|---|---|---|---|
| Thinking off, plain prompt | 12 of 22 | 9 | $0.0012 | 2.7 s |
| Thinking off, observe then judge | 11 of 22 | 12 | $0.0016 | 4.5 s |
| Thinking adaptive | 7 of 11 | 3 | $0.0105 | 64 s |

- Failed rows were marked correctly in every mode. JSON was valid in 39 of 40 reviews.
- With thinking on, M3 used an 8,000-token limit without answering on 4 control runs.

**Structured submission without a forced tool call**
- M3: 26 of 30 runs ended with a schema-valid `submit_findings` call unaided; the other 4 were schema-invalid and all were fixed by one exact-error retry.
- Flash: 25 of 30 unaided; 4 of the 5 invalid ones were fixed by one retry.
- No run ended in plain text. Every schema failure was a 400-character length limit on a summary field.

**Limits:** small samples; ground truth for the Reviewer comparison came from the spike agent's own inspection of the sheets.

## T1 — MiniMax speech-2.8 word timestamps (14 Nov 2026)

**Question:** does MiniMax speech-2.8 return word-level timestamps, so that a development default voice adapter needs no forced aligner?

**Method:** one synchronous call to `POST https://api.minimax.io/v1/t2a_v2` with `model: speech-2.8-hd`, `subtitle_enable: true`, `subtitle_type: "word"`, a two-sentence English line of 101 characters, WAV output at 32 kHz. The returned pauses were compared with FFmpeg `silencedetect` (−35 dB, 0.12 s) on the returned audio. Cost: 101 characters, about one cent. The spike code was deleted.

**Results:**

- The call succeeded on the current subscription key (4.8 s for 7.2 s of audio).
- The response carries `data.subtitle_file`, a JSON file with one segment and a `timestamped_words` list.
- **The entries are tokens, not words.** The line produced 45 entries: sub-word pieces ("M" + "arch", "sal" + "es"), and separate entries for each space and punctuation mark. Each entry has character offsets into the text (`word_begin`, `word_end`), so pieces can be merged back into words.
- **Times sit on a grid of 42.67 ms.** Every start time was a multiple of it. That is coarser than one frame at 30 fps (33.3 ms).
- **Accuracy against the audio looks rough.** In this one sample:

| Pause in the audio (silence detection) | Nearest pause in the timestamps | Difference |
|---|---|---|
| 0.70–1.01 s | 0.43–0.64 s (the comma after "March") | about 0.3 s early |
| 3.08–3.63 s | 2.77–3.07 s (the full stop), with "That" placed at 3.07–3.29 s, inside the detected silence | 0.3–0.5 s |
| 5.64–5.96 s | 5.76–5.93 s (before "yet") | about 0.1 s |
| 6.99 s to end | 6.74–7.04 s (the final full stop) | about 0.25 s early |

**Conclusion:** native word timing exists and is enough to cut caption cues at phrase level. On this evidence it is not accurate enough for lip-sync, which R1 holds to 40 ms early and 60 ms late, and it is doubtful for word-by-word caption highlighting.

**Limits:** one line, one voice, one call. Silence detection is a crude reference and cannot place individual words. A proper measurement against a forced aligner or speech-to-text word times is still needed (claim `R7-A2`).

## Batch 3 — patch authoring at project scale and segment restart (14 Nov 2026)

**Questions:** can MiniMax write and repair the full patch format on a realistic project (`R3-K2`)? Does a new Director segment lose working state (`R6-S10`)?

**Detail:** [evidence/b3-patches-and-restart.md](evidence/b3-patches-and-restart.md). Spend: $1.09 at list prices over 2,888 requests (cap $3.50). The spike code was deleted.

**Patch authoring** (40 tasks, 184-entity synthetic project, 588 runs, final project state compared exactly):

| Transport of `ops` | Runs correct | First patch valid |
|---|---|---|
| Structured arguments, strict validator (as first designed) | 54/70 (77%) | 71% |
| Structured arguments, validator repairs types | 133/140 (95%) | 88% |
| One string of JSON text | 199/210 (95%) | 88%; 96% within one repair, 98% within two |

- **The MiniMax endpoint damages free-form structured arguments.** 31–59% of structured patch calls arrived with numbers as strings, arrays as `{"item": ...}`, empty containers as `""`, or nested keys moved up one level. The model re-sent the same damaged call up to five times. With JSON text: 0 damaged calls of 312, and 6 JSON syntax errors (1.9%).
- Cost per edit: $0.0015 on M3, $0.0006 on Flash, about 4 turns. The two models were within three points of each other.
- Impossible tasks: 58 of 60 runs left the project unchanged; 51 of 60 reported the problem cleanly; M3 substituted a near match twice.
- About 1 run in 10 guessed a field or handle; diagnostics repaired 27 of 36.
- No read reached the 2,000-token page cap in 1,291 reads, so paging is untested.
- RFC 6902 on 10 tasks: 41/48 correct against 45/48 for entity operations, with 75–85% more uncached input.

**Segment restart** (3 sessions on M3 with adaptive thinking; 9 restart runs, 6 control runs, 4 runs without notes):

- Restart runs: 0 repeated steps, 0 skipped, 0 contradictions, 0 wrong job or finding handles.
- Without working notes, a half-finished step caused rework and a wrongly reasoned waiver in 2 of 2 runs.
- The context at the boundary was only 13,000–17,000 tokens, so behaviour after a very long segment is not shown.

**Conclusions:** decisions J1 to J12 in the [integration decisions](../lld/11-integration-decisions.md), section 16.5.

**Limits:** one synthetic project; tasks mostly name their handles; canned tool results in the restart test; the transport damage was measured on one day on one endpoint.

## V1 — OpenRouter Kokoro-82M and word timing (15 Nov 2026)

**Question:** what does OpenRouter's speech endpoint for `hexgrad/kokoro-82m` return (PCM format, cost, repeatability), and where can each take's word times and transcript come from on Node, how accurately?

**Method:** 19 speech requests (18 billed) over 5 voices and 10 lines up to 1,518 characters, PCM and MP3, read back through `GET /api/v1/generation`. Word starts from Whisper in Node (transformers.js base.en, small.en, large-v3-turbo 8-bit) and from CTC forced alignment in Node (wav2vec2-base-960h ONNX plus a short Viterbi), checked against torchaudio's `forced_align` and the non-commercial MMS_FA model. Compared with each other and with energy onsets after 72 pauses; WER against the script. The spike code was deleted.

**Results:**

- **PCM is s16le, 24 kHz, mono** (Content-Type `audio/pcm;rate=24000;channels=1`, duration against the decoded MP3, byte-order test, transcription). MP3 adds about 85 ms of silence per sentence join, so timings must come from PCM. No timing, usage or rate-limit headers; `voice` is required (400 without it).
- **Spend:** `total_cost` from `/api/v1/generation` equalled characters × list price exactly for 18 of 18 generations. Unpinned routing sent 1 of 15 requests to Together at 6.45 times the DeepInfra price, with different audio; `provider.only` pinning worked 3 of 3.
- **Repeatability:** identical timing in 3 of 3 repeats, not identical bytes (waveform correlation 0.995).
- **Word starts after pauses** (72): CTC in Node median 24 ms, 95th percentile 59 ms, worst 72 ms, 69 of 72 within −40/+60 ms, no drift to 90 s; MMS_FA (non-commercial reference) 71 of 72. Whisper small.en median 71 ms, 90th percentile 427 ms; base and small put the first word of every clip at 0 s (0.23–0.40 s early). CTC word ends are 83 ms early (median).
- **Transcripts:** Whisper small.en normalised WER 1.6% over 575 words of correct takes; but correct short lines with numbers, times, abbreviations and names scored 0.08–0.30. Turbo 8-bit hallucinated a 3 s span at a chunk join.
- Node CTC runs at 0.04–0.06 × real time; Whisper base.en 0.11 ×, small.en 0.29 × (Windows laptop CPU). Hosted transcription through OpenRouter was refused (402: $0.50 minimum balance).
- Spend: $0.0031 (cap $0.25).

**Detail:** [evidence/v1-openrouter-kokoro-and-alignment.md](evidence/v1-openrouter-kokoro-and-alignment.md).

**Limits:** ten clips, English only, clean synthetic speech; the signal check covers only words after pauses (72 of about 545) and uses an energy threshold, not hand labels; word ends, phoneme timing and words without a preceding pause have no ground truth; speeds measured on Windows, not Node 26 on Linux; hosted transcription, MiniMax `asr-1.0`, whisper.cpp and larger permissive CTC models not measured.
