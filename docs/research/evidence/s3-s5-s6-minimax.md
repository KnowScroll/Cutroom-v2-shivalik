# S3, S5, S6 — MiniMax measurement spikes

Date: 2026-11-14. Three throwaway spikes. The spike code has been deleted; only these results are kept.

## Short answers

- **S3 — does validate-and-repair work?** Yes for what the validator can see. 72 of 80 single-shot components passed at round 0 (90%); 77 of 80 after one repair round; 80 of 80 after two. Round 3 (MiniMax-M3) was never needed. But at least 7 of the 72 that passed are visibly broken in ways the validator cannot detect, so "passes validation" is not "usable".
- **S5 — tool calling without a JSON mode?** Arguments were schema-valid in 377 of 381 calls (99.0%). No entity reference was miscopied in 352 trials, with short handles or with long UUIDv7 IDs. Long IDs cost about 885 more input tokens per task (+30%). Prompt caching is automatic, needs no markers, still hit after 25 idle minutes and missed after 32.
- **S6 — controls plus a control track?** Yes. All 3 control tracks were valid JSON on the first try and all 3 contain the glance-right, back, right-again sequence. It is visible on all 5 characters when frames are sampled every 120 ms. It is **not** visible in 12 evenly spaced frames over 4 s: the glance falls between samples. The track was edited (snap 300 ms later) without touching the character file.

## Setup

- Windows 11, Node 22, headless Chrome driven by puppeteer-core, FFmpeg 8.1.
- Frame 1080×1920; screenshots taken at half scale (540×960). All network requests other than the document itself were blocked by request interception.
- API: `https://api.minimax.io/anthropic/v1/messages` (Anthropic Messages format).
  - `MiniMax-M3.1-Flash` with `output_config: {effort: "low"}` (thinking always on).
  - `MiniMax-M3`, thinking off unless stated (`thinking: {type: "adaptive"}`).
- Cost is computed from the `usage` fields at list prices (M3 $0.30 / $1.20 / $0.06 cached; Flash $0.15 / $0.60 / $0.015 cached, per million tokens). `input_tokens` excludes cached tokens (confirmed in the caching test), so cost = input × input price + cached × cached price + output × output price. Output tokens include thinking.
- **Rate limit.** The key is on a "Token Plan". With roughly 10 or more requests in flight (three scripts running at once), the API returned `HTTP 429 rate_limit_error: Token Plan rate limit reached (2062)`. In the first pass, 10 of 20 component generations in one batch and 17 of 192 tool-calling trials failed this way after 4 attempts each; one caching run also stopped at turn 3 and was repeated. They were rerun with at most 3 requests in flight per script and longer back-off, and all succeeded. Numbers below use the rerun results. Wall-clock times measured while other scripts were running may be inflated by back-off.

## S3 — validate-and-repair loop

### What was run

- 40 briefs × 2 independent samples = **80 components**, generated single-shot by Flash (effort low), 4 s duration each.
- Categories (16 each): cartoon character acting, labelled science diagram, bar/line/donut chart with exact values, kinetic typography, abstract beat-synced motion. Representations: SVG 34, Canvas 24, HTML/CSS 22.
- Validator (deterministic, headless Chrome):
  1. static scan for forbidden APIs and external URLs;
  2. page loads; `window.__seek` is a function;
  3. no page errors, no `console.error`, no exception while seeking at t = 0, 0.8, 1.6, 2.4, 3.2, 4.0;
  4. order independence: after seeking 3.2, 0.8, 4.0, the frame at 1.6 must equal the first frame at 1.6 (identical bytes, or FFmpeg PSNR ≥ 60 dB);
  5. not blank (more than one colour, at least 0.5% of pixels not the dominant colour);
  6. frames change over time (at least 3 distinct images among the 6).
- Repair: a fresh request containing the brief, the format rules, the model's own document and the exact validator messages, asking for the corrected full document. Rounds 1–2 Flash, round 3 M3.

### Round 0 (single shot)

| | Pass / total |
|---|---|
| All | **72 / 80 (90%)** |
| Character | 13 / 16 |
| Diagram | 16 / 16 |
| Chart | 15 / 16 |
| Typography | 14 / 16 |
| Abstract | 14 / 16 |
| SVG | 30 / 34 |
| Canvas | 23 / 24 |
| HTML/CSS | 19 / 22 |

- No component broke a format rule (0 of 80 used a forbidden API or an external URL; all 80 returned one complete `html` block).
- Generation cost: mean 4,801 output tokens (median 4,763), mean 34 s (median 25 s), mean $0.0029 per component, mean document size 9.7 KB.

### Pass rate by round (cumulative, n = 80)

| Round | Model | Attempts | Fixed | Cumulative pass |
|---|---|---|---|---|
| 0 | Flash | 80 | – | 72 / 80 (90.0%) |
| 1 | Flash | 8 | 5 | 77 / 80 (96.3%) |
| 2 | Flash | 3 | 3 | 80 / 80 (100%) |
| 3 | M3 | 0 | – | not needed |

### Cost of a repair

| Repair type | n | Fixed | Mean input tokens | Mean output tokens | Mean time | Mean cost |
|---|---|---|---|---|---|---|
| Flash, full document (rounds 1–2) | 11 | 8 (73%) | 4,506 | 4,240 | 19 s (range 9–49 s) | $0.0032 |
| Flash, search/replace blocks (one round, same 8 failures) | 8 | 5 (63%) | 4,308 | 683 | 6.6 s | $0.0011 |
| M3 with thinking, full document (one round, same 8 failures; extra test because round 3 was never reached) | 8 | 6 (75%) | 4,318 | 8,056 | 74 s (max 232 s) | $0.0109 |

A full-document repair costs about the same as generating the component again. On the same 8 failures and one round each, Flash full-document fixed 5, Flash search/replace fixed 5, M3 fixed 6.

### Which errors were repaired

| # | Round-0 failure | Flash full doc | Flash search/replace | M3 full doc |
|---|---|---|---|---|
| 1 | console error: malformed SVG path `d` (character) | fixed in round 1 | fixed | fixed |
| 2 | console error: `scale(NaN NaN)` transform (character) | same error after round 1; fixed in round 2 | fixed | fixed |
| 3 | page error: `el is not defined`, every seek throws (typography) | fixed in round 1 | fixed | fixed |
| 4 | console error: `translate(x NaN)` transform (abstract) | fixed in round 1 | fixed | fixed |
| 5 | page error: `null.style`, `__seek` never defined (chart) | fixed in round 1 | not fixed (a different null error) | fixed |
| 6 | "frames do not change" (character) — **validator false alarm**, see below | unchanged after round 1; passed in round 2 | passed | passed |
| 7 | order dependence, PSNR 46 dB (typography, 3D letter flip) | fixed in round 1 | not fixed (same error) | not fixed (same error, after 232 s and 21k output tokens) |
| 8 | syntax error, script never runs (abstract) | round 1 exposed a second bug (`glowRadius is not defined`); fixed in round 2 | second bug exposed, not fixed | second bug exposed, not fixed |

- Repaired by Flash within two rounds: every type seen (console errors from NaN attributes, reference and null errors, syntax error, order dependence).
- **Did repairs introduce new failures?** No repair broke a check that had passed before. One repair (row 8) fixed a syntax error and thereby exposed a second bug that was already in the round-0 code but could not run before; this looks like a new failure in the log and needs a further round. All 13 search/replace blocks applied cleanly (each search text matched exactly once).
- I looked at the 8 repaired components at two times each: all 8 look reasonable, and none lost content.

### What the validator does not catch

I looked at one frame (t = 3 s) of all 80 round-0 components at thumbnail size, and re-checked suspects at other times and at full resolution.

- **At least 7 of the 72 passing components are visibly broken:** a bar chart whose bars are almost zero height; a two-character scene with one character cut off at the corner and the other missing; two "BOUNCE" typography pieces with invisible or 11-pixel letters; a starfield showing one dot instead of 150 stars; a Lissajous curve that is never drawn; a diagram drawn over its own title. Minor defects also seen: a missing space in lyrics, a label clipped at the frame edge.
- So a rough estimate of usable output is 65 of 80 (81%) single-shot and 73 of 80 (91%) after repair. This is a lower bound on breakage: one small frame per component cannot show timing or acting errors.
- **One validator false alarm** (row 6): the owl component animates correctly (15 distinct images in 41 samples) but its motions are short and fell between the 6 sample times. The repair loop "fixed" a component that was not broken. Six samples are too few for short events.
- The validator itself is repeatable: re-validating all 80 round-0 files gave the same verdict for 80 of 80, and the order-dependence failure reproduced with the same PSNR in 3 of 3 re-runs.

### Limits of S3

- One model, one effort level, 4-second components, briefs written for this test.
- 8 failures is a small sample; per-error-type results are single cases.
- Round 3 with M3 was never exercised in sequence. The M3 row above is M3 as a first-round repairer, which is a different question.
- Search/replace was tried for one round only.
- The validator checks health, not quality or whether the brief was met.

## S5 — tool calling, handles versus long IDs, caching

### What was run

- 10 tools: `project_get`, `project_patch`, `compile`, `render_preview`, `review_request`, `job_status`, `job_cancel`, `web_search`, `component_author`, `budget_get`. Schemas use `additionalProperties: false`, enums, integer types, patterns, and nested objects (`ops[].fields.timing.anchor`, `style`). Tool results were canned.
- Project state in the first user message: 13 entities (3 shots, 2 characters, 3 events, 3 captions, 2 voice lines) and 2 jobs.
- 22 tasks with a known correct tool call, plus 2 questions that need no tool. Each task was run 4 times per model per addressing mode, each in a fresh conversation: **88 tool-task trials per cell, 352 in total**, plus 32 no-tool trials.
- Addressing modes: short handles (`presenter`, `shot02.eruption`) and long IDs (`ent_` + UUIDv7; the IDs share long prefixes, as real UUIDv7 values created close together do).
- Arguments validated with Ajv against the same schemas the model was shown.

### Results

| | M3, handles | M3, long IDs | Flash, handles | Flash, long IDs |
|---|---|---|---|---|
| Tool calls made | 96 | 94 | 97 | 94 |
| Schema-valid calls | 96 (100%) | 92 (97.9%) | 96 (99.0%) | 93 (98.9%) |
| Trials with the wrong tool | 8 / 88 (9.1%) | 6 / 88 (6.8%) | 0 / 88 | 1 / 88 (1.1%) |
| Trials with a miscopied entity reference | 0 / 88 | 0 / 88 | 0 / 88 | 0 / 88 |
| Trials answered in text instead of a call | 3 / 88 | 3 / 88 | 0 / 88 | 1 / 88 |
| Trials fully correct (right tool, valid, right values) | 77 / 88 (87.5%) | 77 / 88 (87.5%) | 87 / 88 (98.9%) | 85 / 88 (96.6%) |
| No-tool questions answered without a tool | 8 / 8 | 8 / 8 | 8 / 8 | 8 / 8 |
| Mean input tokens per task (uncached + cached) | 2,915 (663 + 2,252) | 3,799 (1,168 + 2,631) | 2,941 (787 + 2,154) | 3,829 (939 + 2,890) |
| Mean output tokens per task | 76 | 113 | 99 | 124 |
| Median latency | 1.6 s | 1.7 s | 1.8 s | 2.2 s |
| Approximate cost per task | $0.00043 | $0.00064 | $0.00021 | $0.00026 |

Totals: 377 of 381 calls schema-valid (99.0%).

- **Invalid calls (4).** Three added an `order` property that the schema does not allow when creating a caption (the project state shows captions with an `order` field, the schema does not accept it); all three were in long-ID mode. One Flash call wrote a job id as `job_k3x9θ2`, with a Greek theta in place of `q`. A fifth invalid call (an extra `kind` property on a delete op, M3, long IDs) was seen in the first pass in a trial that then hit the rate limit and was rerun; the rerun was valid, so it is not in the table.
- **Reference errors.** No entity handle or long ID was wrong or miscopied in 352 trials. The only miscopy was the job id above.
- **Wrong tool.** For M3 (thinking off), all 14 cases were the same behaviour: calling `project_get` to re-read the project before a timing edit ("650 ms after the eruption", "last 2.5 seconds", "400 ms earlier", "start at the same moment as the caption"), although the state was already in the prompt. Flash worked out the value and patched directly; its one wrong-tool case was calling `compile` before a preview.
- **Text instead of a tool.** All 7 cases were the task "What's the status of the preview render job?": the model answered "running" from the project state. The task was ambiguous, so these are arguably not errors. Without that task, text-instead-of-tool is 0 of 336.
- **Parallel tool calls occur.** For the two tasks that need two independent calls, both calls came in one turn in 31 of 32 trials. Both models also sometimes issued two web searches at once. Edits that belong together were sent as one `project_patch` with two ops, as instructed.
- **Handles versus long IDs.** Long IDs added about 885 input tokens per task (+30%; the project state and schemas are longer) and 25–37 output tokens per task. Accuracy was the same for M3 and slightly lower for Flash (87 versus 85 of 88, not a meaningful difference at this sample size). The cost difference is +49% per task for M3 and +23% for Flash.

### Repair at the tool boundary

The invalid call was answered with a `tool_result` error giving the exact Ajv message; the assistant turn was replayed unchanged.

- **Natural invalid calls: 4 of 4 valid on the next call** (the three `order` cases removed the property; the job id was retyped correctly).
- Because natural failures were so rare, I added a trap test: 4 tasks where the schema shown to the model was looser than the one used for validation (scale as any number, focus as any string, start time as any number, colour as any string), 3 runs per model, handles only. This produced 15 invalid first calls out of 24 (the colour trap produced none: both models wrote `#ff0000` unprompted).

| After one error message | M3 (8 invalid) | Flash (7 invalid) |
|---|---|---|
| Next call valid | 4 | 5 |
| Stopped and explained in text that the value is not supported | 4 | 1 |
| Invalid again | 0 | 1 |

- Overall, 13 of 19 invalid calls became a valid call after one retry, 5 became a sensible text explanation, and 1 was invalid again (Flash, a malformed nested `timing` object).
- Note: when the requested value was impossible ("40% scale", "colour grading" focus), a valid retry means the model silently substituted an allowed value (0.5; "continuity"). M3 more often stopped and asked, which may be the better behaviour.

### Caching

Test: MiniMax-M3, system prompt plus the 10 tool definitions totalling about 6,140 tokens, a 10-turn append-only loop (one `job_status` call per turn). Each run used a unique line at the start of the system prompt so the first request could not hit an older cache.

| Turn | Uncached `input_tokens` | `cache_read_input_tokens` |
|---|---|---|
| 1 | 5,982 | 159 |
| 2 | 76 | 6,141 |
| 3 | 80 | 6,217 |
| 4 | 80 | 6,297 |
| 5 | 81 | 6,377 |
| 6 | 81 | 6,458 |
| 7 | 81 | 6,539 |
| 8 | 79 | 6,620 |
| 9 | 80 | 6,699 |
| 10 | 81 | 6,779 |

- **Caching is automatic.** No `cache_control` marker was sent. A second run with a marker on the system block gave the same pattern (turn 1: 5,980 uncached; turns 2–10: 80–84 uncached, 6,139 rising to 6,792 cached). `cache_creation_input_tokens` was always 0.
- From turn 2 on, about 99% of the input is read from cache; only the newest tool result is uncached. For this loop the input cost is about $0.0055 instead of $0.0195 with no caching (72% less).
- The cache also hits across separate conversations that share the system prompt and tools: in the main S5 runs about 2,100–2,900 of the 2,900–3,800 input tokens per fresh conversation were cache reads.
- Latency in clean runs: 1.3–2.4 s cold, 0.7–1.5 s warm.

**Cache lifetime.**

| Test | Pause | Result |
|---|---|---|
| Repeat the final request of the loop | none | hit: 1 uncached, 6,859 cached |
| Same request again | 60 s | hit: 1 / 6,859 |
| Same request again | a further 360 s | hit: 1 / 6,859 |
| Fresh prefix, sent twice, then left untouched | 60 s | hit: 1 / 6,069 |
| Fresh prefix, sent twice, then left untouched | 360 s | hit: 1 / 6,136 |
| Fresh prefix, sent twice, then left untouched | 720 s | hit: 1 / 6,069 |
| Fresh prefix, sent twice, then left untouched | 1,500 s (25 min) | hit: 66 / 6,016 (identical to its warm request) |
| Fresh prefix, sent twice, then left untouched | 1,920 s (32 min) | **miss**: 5,908 uncached, 159 cached |

On these single samples the cache survives 25 minutes without use and is gone after 32 minutes; an expiry of about 30 minutes would fit. Whether a cache read restarts the timer was not isolated.

### Limits of S5

- Single-turn tasks with the whole project state in the prompt; 13 entities. Real projects are larger and references will be further from the point of use.
- 4 repetitions per task; rates of a few percent rest on a handful of events.
- One task was ambiguous (job status) and one schema/state mismatch (`order`) caused 3 of the 4 natural invalid calls. Both are test-design effects, and both are also things a real API would do.
- The trap test measures whether the model follows an exact error message, not how often it errs naturally.
- Each cache-lifetime pause was tested once, on one day.

## S6 — controls plus a control track

### Characters (Flash, effort low)

Five SVG presenters were requested, each exposing nine numeric controls through `window.__seek(t, controls)` and not animating by itself. Each was validated by rendering the neutral pose and 13 extreme poses (see contact sheet 01) and measuring the share of pixels that change against neutral; every control had to change the picture, the neutral pose had to be identical after all other poses, and no errors were allowed.

| Character | Automated check | My reading of the contact sheet |
|---|---|---|
| 0 Science presenter (human) | pass | 7 of 9 controls work; both arm controls are wrong (the arm crosses the body or flies off-frame) |
| 1 Robot | fail (neutral pose changed after other poses), **pass after one repair** | 9 of 9 work |
| 2 Cat newscaster | pass | 9 of 9 work (head turn is partly a tilt) |
| 3 Old professor | pass | 9 of 9 work (head turn and brows are subtle) |
| 4 Blob mascot | pass | 7 of 9 work as intended; arms vanish behind the body at the extreme value (they work at 0.8); the mouth is drawn on the torso |

- 4 of 5 passed first time; 5 of 5 after one repair round. Head turn, gaze, blink, brows and mouth worked on all 5.
- The pixel-change check cannot tell a correct arm from a wrong one. Arms were wrong on 2 of 5 characters.
- Cost per character call (6 calls: 5 generations, 1 repair): mean 4,819 output tokens, median 20 s (one call took 134 s), mean $0.0031. Total for five kept characters: $0.019.

### Control track (M3, thinking on)

The model saw only the control definitions and the brief, not any character. Format: per-control keyframes `{t, v, ease}` over 4 s. Three tracks were requested to see variation.

| Track | Valid first try | Keyframes | Output tokens | Time | Cost | Glance → back → right-again present when sampled at 30 fps | Present in 12 evenly spaced samples |
|---|---|---|---|---|---|---|---|
| 0 | yes | 56 | 3,645 | 38 s | $0.0044 | yes (glance peak 1.67 s, back 1.87 s, snap 2.07 s) | no |
| 1 | yes | 83 | 5,196 | 62 s | $0.0064 | yes (glance held 1.62–1.82 s, back 2.00–2.13 s, snap 2.32 s) | no |
| 2 | yes | 59 | 3,712 | 51 s | $0.0045 | yes (glance peak 1.60 s, back 1.77 s, snap 2.03 s) | no |

- 3 of 3 valid against the JSON Schema and the ordering rules on the first try; no repair was needed.
- All three also include idle motion, one blink before 1.5 s, raised brows, open mouth and raised arms on the snap, and hold the final pose to 4 s.

### Is the double-take visible?

Each track was interpolated in the harness and rendered on each character twice: 12 evenly spaced frames over 0–4 s (364 ms apart), and 12 frames from 1.40 to 2.72 s (120 ms apart).

**12 evenly spaced frames (what the brief asked for): not visible.** The sheet shows six frames facing camera, then six frames in the shocked pose (contact sheet 03). The whole double-take lasts about 0.5 s and falls between samples. I viewed 2 of the 15 sheets; the sampled control values show the same for all 15. The M3 judge chose "double-take" for 0 of 15 (14 chose another description; 1 answer ran out of output tokens before choosing).

**12 frames at 120 ms spacing: visible.**

| Character | My judgement (track 0) | M3 judge, track 0 / 1 / 2 |
|---|---|---|
| 0 Science presenter | visible in the eyes and face; arms wrong | yes / no / no |
| 1 Robot | visible | yes / yes / yes |
| 2 Cat | clearly visible, reads as comedy (contact sheet 02) | yes / yes / no |
| 3 Professor | visible, carried mostly by the eyes | yes / yes / yes |
| 4 Blob | visible | yes / yes / yes |

- My judgement: visible on 5 of 5 characters for track 0. I also viewed one render each of the other tracks. Track 1 on the professor: visible, and the clearest of the three because the glance and the return are each held for about 0.15–0.2 s. Track 2 on the robot: visible, but the return to camera lasts one frame at this spacing (about 0.1 s) and may be too fast at normal speed. The other 8 dense sheets were judged only by the model.
- M3 judge (image input, asked to label each frame LEFT/CENTER/RIGHT and pick one of five descriptions): chose "looks right, returns to centre, looks right again" for 12 of 15 dense sheets. Its per-frame labels matched the control values closely.
- **Judge reliability check.** 10 control sheets with the double-take removed (5 with a single turn, 5 with no turn at all): the judge correctly did not choose "double-take" for 9 of 10. It did choose it for 1 (character 0 with no head or eye movement at all), so it can invent the sequence. Its answer to "is the final pose shocked?" was inconsistent across sheets of the same pose and should not be used.
- Judge cost: about 2,550 input tokens per contact sheet (1,676 px wide image), 606 output tokens, 8 s, $0.0015.

Compared with the earlier single-shot result (no candidate achieved the double-take), separating the drawing from the acting made the sequence appear on every character, with the same track reused unchanged across all five.

### Editing the track without touching the character

Task: make the final snap happen 300 ms later.

- **Harness edit (insert a hold keyframe on 8 controls, shift later keyframes by 300 ms).** The snap moved from 2.03 s to 2.33 s. 17 of 17 frames of the edited track at t + 0.3 s were pixel-identical to the original track's frames at t. The character file's SHA-256 was the same before and after. Confirmed by eye on the robot.
- **M3 edit, restricted to changing keyframe times only.** Valid JSON, same keyframes, 8 times changed (2.07 → 2.37 s on 8 controls), 0 values changed; 1,445 output tokens, 58 s, $0.0021. The snap now *arrives* 300 ms later, but it also starts at the same moment as before, so the move became slower (0.5 s instead of 0.2 s) rather than later. With this keyframe format a pure delay needs one added hold keyframe per control; changing times alone cannot do it.

### Limits of S6

- 5 characters, 3 tracks, one brief. One model for each role.
- "Visible" was judged on still frames, not on playback; timing and comic effect are not measured.
- Linear and quadratic easing only; no overshoot or anticipation.
- The automated control check measures pixel change, not correctness of the pose.
- The M3 judge was wrong on 1 of 10 control sheets and on up to 3 of 15 real ones.

## Contact sheets

- `s6-contact-sheets/01-cat-controls-at-extremes.png` — character 2, neutral pose and each control at its extremes (the percentage is the share of pixels that differ from neutral).
- `s6-contact-sheets/02-cat-track0-dense-1.40-2.72s.png` — track 0 on character 2, 120 ms apart: glance right at 1.64 s, back at 1.88 s, snap right from 2.12 s.
- `s6-contact-sheets/03-cat-track0-12-even-frames.png` — the same render at 12 evenly spaced frames: the double-take cannot be seen.

## Spend

| Spike | Calls | Cost at list prices |
|---|---|---|
| S3 (80 generations, 19 Flash repairs, 8 M3 repairs) | 107 | $0.366 |
| S5 tool calling (384 trials, 24 trap trials, retries) | 428 | $0.162 |
| S5 caching | 40 | $0.031 |
| S6 (6 character calls, 4 track calls, 40 judge calls) | 50 | $0.094 |
| Smoke test | 2 | $0.000 |
| **Total** | **627** | **$0.65** |

Cap was $3.00. The key is on a Token Plan, so the amount actually billed may differ from list prices.
