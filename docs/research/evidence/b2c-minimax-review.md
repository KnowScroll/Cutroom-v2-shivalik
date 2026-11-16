# B2c — MiniMax measurement spikes: inspection clips, Reviewer without thinking, submission without a forced tool call

14 November 2026. Throwaway spikes; the code was deleted, only these results are kept.

## Summary

| Spike | Question | Answer |
|---|---|---|
| 1 | Can MiniMax-M3 see every frame of a clip slowed 6× and sent at `fps: 5`? | Mostly. It named the exact defect frame in 38 of 48 runs on slowed clips, against 0 of 24 at real time. It also reported a glitch that was not there in 5 of 16 control runs. A contact strip image did as well or better (22 of 24) at about one fifth of the tokens. |
| 2 | Does the Reviewer stay accurate with thinking off? | It keeps the easy part: all failed rows were marked correctly in every mode. On visible defects it found 12 of 22 (plain) and 11 of 22 (observe, then judge) against 7 of 11 with thinking. It reported more false defects. It costs about one tenth as much and answers in 3–5 s instead of about 80 s. |
| 3 | Do sub-loops end with a valid `submit_*` call when the call cannot be forced? | Yes. 0 of 90 runs ended in plain text. 78 of 90 submitted valid arguments unaided; the other 12 broke one rule (a 400-character limit) and 10 of those 12 were fixed by one retry with the exact error. |

Total spend: **$0.58** as billed (402 requests). It would have been $0.78 if no input had been served from the cache. The cap was $2.50.

## Setup

- Endpoint: `POST https://api.minimax.io/anthropic/v1/messages`, Anthropic Messages format, `stream: true` on every request.
- Models: `MiniMax-M3` (thinking off unless stated) and `MiniMax-M3.1-Flash` with `output_config: {effort: "low"}`.
- At most 4 requests in flight. 24 requests needed a retry (HTTP 429, a 5xx or a network error; the spike did not record which). All succeeded on retry. No request failed for good.
- Cost is computed from the `usage` fields at list prices. The API served part of the input from a prompt cache without being asked (`cache_read_input_tokens`), which is billed at the cached rate. Where it matters, both figures are given.
- Token counts for video were also read from `POST /anthropic/v1/messages/count_tokens`. That endpoint returned only a token count and is not included in the spend (assumed to be free).
- Test clips were made with FFmpeg 8.1.1 (H.264, yuv420p, no audio).

---

## Spike 1 — single-frame defects in a slowed clip

### Test material

- 8 clips, 540 × 960, 30 fps, 3 s (90 frames, numbered 0–89). A coloured circle moves smoothly down the frame on a sine path. A black strip at the bottom shows `FRAME nn` in large white type.
- 6 clips have one single-frame defect. 2 clips are controls with no defect.

| Clip | Defect | Frame |
|---|---|---|
| c1 | circle jumps 150 px down for one frame | 23 |
| c2 | circle jumps 150 px down for one frame | 61 |
| c3 | circle disappears for one frame | 37 |
| c4 | circle disappears for one frame | 74 |
| c5 | circle turns magenta for one frame | 14 |
| c6 | circle turns magenta for one frame | 54 |
| c7, c8 | none (controls) | — |

- Each clip was sent in these forms:
  - **(a) real time**: the 3 s clip with `fps: 5` (38 KB).
  - **(b) slowed 6×, 30 fps file**: 18 s, every source frame held for 6 output frames, with `fps: 5` (91 KB).
  - **(b2) slowed 6×, 5 fps file**: 18 s, one output frame per source frame, with `fps: 5` (51 KB). Added because it is the cheaper way to make the same clip.
  - **(c) contact strip**: one PNG of 18 consecutive frames in a 6 × 3 grid (1662 × 1464), each cell showing its frame number. The defect sits at a different place in the window for each clip.
- Question, the same in every condition, after one sentence of context: "Is there a single-frame glitch? If so, at which frame number, and what happens?", plus a fixed answer line to parse.
- Thinking off. 4 trials per clip per condition, so each condition has 24 runs on defect clips and 8 runs on control clips.

### Results, thinking off

| Condition | Said there is a glitch (defect clips) | Exact frame number | Exact frame and right kind of defect | False alarms on controls | Input tokens | Latency, median (range) | Cost per request |
|---|---|---|---|---|---|---|---|
| (a) real time, `fps: 5` | 14 of 24 | **0 of 24** | 0 of 24 | **7 of 8** | 3,037 | 1.8 s (0.8–3.6) | $0.0009 |
| (b) slowed 6×, 30 fps file | 19 of 24 | **18 of 24** | 16 of 24 | 2 of 8 | 15,846 | 4.7 s (0.7–6.0) | $0.0048 |
| (b2) slowed 6×, 5 fps file | 22 of 24 | **20 of 24** | 19 of 24 | 3 of 8 | 15,846 | 4.6 s (0.7–8.9) | $0.0048 |
| (c) contact strip, 18 frames | 22 of 24 | **22 of 24** | 22 of 24 | 4 of 8 | about 3,450 | 1.9 s (0.9–12.8) | $0.0011 |

Cost is the list price with no cached input. In these runs about half of the input was served from the cache on repeat sends of the same clip, which brought the billed average down to $0.0005, $0.0029, $0.0029 and $0.0007. Latency includes those cached repeats; first sends of a slowed clip took 5–6 s.

Per trial of 6 defect clips, exact frame numbers were: (a) 0, 0, 0, 0; (b) 4, 3, 5, 6; (b2) 6, 5, 4, 5; (c) 6, 5, 6, 5.

By kind of defect, exact frame, both slowed forms together: jump 12 of 16, disappear 11 of 16, colour flash 15 of 16.

What the errors looked like:

- **Real time.** Every "glitch" answer named a frame that was not the defect (24, 47, 59, 71 and 12) and described something that did not happen ("the circle splits into two", "turns a duller teal"). The model said the same kind of thing about the controls. These frame numbers are frames the sampler actually showed it, so the model was reading real labels and inventing the event.
- **Slowed.** 7 of the 48 runs said "no glitch". 3 named the frame one too early (36 for 37, 22 for 23). 3 runs with the right frame described the wrong event (for example "jumps" or "shrinks to a dot" for a circle that disappeared).
- **False alarms.** On controls the model invented a jump, a deformation or a reversal at a specific frame. Control c8 drew most of them (7 of its 12 runs across b, b2 and c); c7 drew 2 of 12.
- The two slowed forms (30 fps file and 5 fps file) are not distinguishable at this sample size.

### Thinking on (one trial, for comparison)

`thinking: {type: "adaptive"}`, `max_tokens: 8000`, 8 clips, one trial.

| Condition | Exact frame | False alarms | No answer (used all 8,000 tokens thinking) | Latency | Cost, average |
|---|---|---|---|---|---|
| (b) slowed 6×, 30 fps file | 4 of 6 | 0 of 2 | 4 of 8 (two defect clips, both controls) | 4–7 s when it answered, 48–79 s when it did not | $0.0098 |
| (c) contact strip | 6 of 6 (one answer cut off after it had named the frame) | 0 of 2 | 3 of 8 (one defect clip cut off, both controls) | 2–28 s when it answered, 58–81 s when it did not | $0.0054 |

With thinking on, the model did not finish on any of the 4 control runs. A clip with nothing wrong sent it into a long check that hit the output limit.

### Did the API accept the video block as documented?

Yes, with three differences from the documentation and task notes.

The request shape that worked:

```json
{
  "model": "MiniMax-M3",
  "max_tokens": 1200,
  "stream": true,
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "video",
          "source": {
            "type": "base64",
            "media_type": "video/mp4",
            "data": "<base64 of the MP4 file>",
            "fps": 5
          }
        },
        { "type": "text", "text": "<context and question>" }
      ]
    }
  ]
}
```

Headers: `Authorization: Bearer <key>`, `Content-Type: application/json`, `anthropic-version: 2023-06-01`.

- **`fps` must be inside `source`.** An `fps` field next to `type` and `source` is accepted and silently ignored: the token count stayed at the default.
- **The default sampling rate is 2 fps, not 1.** Omitting `fps` gave exactly the same token count as `fps: 2` (1,215 tokens for the 3 s clip; `fps: 1` gave 869).
- **`fps` above 5 is rejected**: HTTP 400, "invalid params, fps param should be in [0.2,5] (2013)".
- `detail` and `max_long_side_pixel` also go inside `source` and do change the token count (table below).
- No size or duration errors. Real requests used clips of 37–93 KB and 3–18 s. The token-count endpoint also accepted a 60 s clip (0.3 MB) and a 200 s clip (1.0 MB) at `fps: 5`. Nothing near the 50 MB limit was tried.

### Video token cost

Measured with the token-count endpoint on a 540 × 960 clip and a two-letter text prompt, and confirmed by `usage` on real requests.

| Clip | `fps` | Frames sampled | Input tokens |
|---|---|---|---|
| 3 s | 1 | 4 | 869 |
| 3 s | 2 (also the default) | 6 | 1,215 |
| 3 s | 3 | 8 | 1,561 |
| 3 s | 4 | 12 | 2,253 |
| 3 s | 5 | 16 | 2,945 |
| 18 s | 0.2 | 4 | 869 |
| 18 s | 1 | 18 | 3,291 |
| 18 s | 2 | 36 | 6,405 |
| 18 s | 5 | 90 | 15,747 |
| 60 s | 5 | 300 | 52,077 |
| 200 s | 5 | 1,000 | 173,177 |

- **Formula that fits every row: about 177 + 173 × frames**, where frames = duration × fps rounded to an even number. That is **173 tokens per sampled frame** at the default detail for a 540 × 960 frame, or about $0.000052 per frame.
- The frame counts in the table are inferred from the token counts. The model's own frame lists confirmed the 6-frame and 16-frame rows.
- Tokens are charged in steps of 346, which is two frames. The count is the same for the 30 fps file and the 5 fps file.
- No cap on frame count was seen up to 1,000 frames.
- Other settings, same 3 s clip at `fps: 5`: `detail: "low"` 104 tokens per frame; `detail: "high"` 355; `max_long_side_pixel: 480` 90; `max_long_side_pixel: 1920` 355.
- A 3 s inspection window slowed 6× therefore costs about 15,750 input tokens, **$0.0047**, at default detail.
- The contact strip image cost 3,359 tokens at default or high detail and 707 at low detail.

### Frames reach the model in pairs

- Asked to list every frame number it could see in the 3 s real-time clip at `fps: 5`, the model answered "00, 12, 24, 36, 47, 59, 71, 83". Sixteen evenly spaced frames from 0 to 89 are 0, 6, 12, 18, 24, 30, 36, 42, 47, 53, 59, 65, 71, 77, 83, 89. The model listed the first frame of each pair.
- With the default rate it listed all six sampled frames (0, 18, 36, 53, 71, 89), so the second frame of a pair is not always lost.
- The three off-by-one answers on slowed clips named the first frame of the pair (36 for 37, 22 for 23).
- Sampling covers the whole clip from first frame to last, evenly spaced. It does not start a fixed grid at time zero.
- The pairing is an inference from token steps and these answers. The API does not document it.

### Did the model read the printed frame numbers?

Yes. On slowed clips and strips it returned the exact printed number in 60 of 72 runs. At real time the numbers it gave were ones that had been sampled. It also made up one number that was not in the clip (94 in an 89-frame clip) when asked to list frames.

### Limits of Spike 1

- Synthetic scene: one flat circle on a plain background. Real renders are busier and the defects subtler.
- Defects were large (150 px jump, full disappearance, strong colour change).
- 6 defect clips and 2 controls, 4 trials each. The trials of one clip are not independent samples of content.
- One prompt wording, and the question itself suggests a glitch might exist. False-alarm rates may change with wording.
- Thinking on was run once per clip with an 8,000-token limit.
- Default detail only for the measured runs. `detail: "high"` was priced but not tested for accuracy.
- The contact strip covered 18 of the 90 frames. A full 3 s window needs 5 strips, about 17,000 tokens, which is no cheaper than the slowed clip.

---

## Spike 2 — Reviewer accuracy with thinking off

### Material and ground truth

Eight contact sheets: the five from S2 (rows A–F are six candidates, six time points each) and the three from S6 (two rows of cells each). Ground truth was written before any review, from direct inspection of each sheet and enlarged crops.

| Sheet | Failed rows | Clear defects | Clean rows |
|---|---|---|---|
| S2 character | D | B: no head or face. E: face and hair malformed. | A, C, F |
| S2 kinetic | A | B: no text at all. C: words duplicated and overlapping. E: "never" cut off at the right edge. | D, F |
| S2 chart | C | E: month labels under the bars are missing. | A, B, D |
| S2 diagram | none | A: label cut off at the right edge. B: labels drawn over the train. D: title cut off at the right edge. F: title struck through by a bar and overlapped; F: label cut off at the right edge. | C |
| S2 abstract | A, E, F | none | C, D |
| S6 controls at extremes | none | none | row 1 |
| S6 dense frames | none | none | rows 1, 2 |
| S6 even frames | none | none | rows 1, 2 |

- Totals: 6 failed rows, 30 rendered rows, **11 clear defects**, 16 clean rows.
- Five rows have a small real flaw that was left out of the scoring in both directions (for example shapes touching the frame edge in abstract B, bars starting below the axis line in chart F, a label partly covering a magnet in diagram E). A reviewer reporting one of these was not counted as wrong, and missing one was not counted as a miss.
- A "false defect" is a reported defect that could not be seen in the row, even in an enlarged crop.

### Modes

All three used the same sheet description, the same brief line, the same three questions per row (status, defects by type, verdict) and the same JSON shape.

1. **Off, plain**: thinking off, "reply with one JSON object and nothing else". 2 passes over the 8 sheets.
2. **Off, observe then judge**: thinking off; first a section that describes what is visible in each row, then the JSON. 2 passes.
3. **Adaptive**: `thinking: {type: "adaptive"}`, plain prompt. 1 pass.

### Accuracy

| Mode | Reviews | Clear defects found | Missed | False defects reported | Clean rows not passed | Failed rows marked failed and unknown | Rendered rows wrongly marked failed | Valid JSON |
|---|---|---|---|---|---|---|---|---|
| Off, plain | 16 | **12 of 22** (7 and 5 per pass) | 10 | 9 | 3 of 32 | 12 of 12 | 0 of 60 | 15 of 16 |
| Off, observe then judge | 16 | **11 of 22** (6 and 5) | 11 | 12 | 4 of 32 | 12 of 12 | 6 of 60 | 16 of 16 |
| Adaptive | 8 | **7 of 11** | 4 | 3 | 1 of 16 | 6 of 6 | 0 of 30 | 8 of 8 |

Per defect (found / passes):

| Defect | Off, plain | Off, observe | Adaptive |
|---|---|---|---|
| Character B: no head | 2 / 2 | 1 / 2 | 1 / 1 |
| Character E: malformed face and hair | 1 / 2 | 1 / 2 | 0 / 1 |
| Kinetic B: no text | 2 / 2 | 2 / 2 | 1 / 1 |
| Kinetic C: duplicated words | 2 / 2 | 0 / 2 | 1 / 1 |
| Kinetic E: word cut off | 2 / 2 | 2 / 2 | 1 / 1 |
| Chart E: month labels missing | 0 / 2 | 0 / 2 | 0 / 1 |
| Diagram A: label cut off | 1 / 2 | 2 / 2 | 1 / 1 |
| Diagram B: labels over the train | 1 / 2 | 0 / 2 | 1 / 1 |
| Diagram D: title cut off | 1 / 2 | 2 / 2 | 1 / 1 |
| Diagram F: title struck through | 0 / 2 | 1 / 2 | 0 / 1 |
| Diagram F: label cut off | 0 / 2 | 0 / 2 | 0 / 1 |

Notes on the scoring:

- **Failed rows were never missed** and never judged: 30 of 30 across all modes.
- **The observe format did not help.** It found no more defects, reported more false ones, and in one diagram review its own observation text said each row was "marked no frame in the first column", after which it marked all six rendered rows as failed.
- One observe pass missed the headless character (it reported only that some text was hidden).
- Kinetic C in one observe pass was flagged for garbled letters in another word, which is real, but the duplicated words were not reported. That is counted as a miss with no false defect.
- **Most false defects came from the diagram sheet**, the one with small text: 6 of the 9 in plain mode (all in the review whose JSON was invalid, which called small text "blurred and illegible" in five rows) and 10 of the 12 in observe mode (labels said to be cut off that are not).
- The adaptive pass also invented defects: text said to disappear in character F that is present in all six frames, and two edge-clipping claims on the diagram.
- **No mode found the missing month labels or the cut-off label in diagram F.** Both are small at sheet scale (each cell is 240 × 427 px).
- The one invalid JSON reply (plain mode, diagram) had a dropped `{"` in the middle of the array. It was complete, not cut off. Its content is included in the defect counts above; without it plain mode found 10 of 17 with 3 false defects.
- In observe mode the JSON always followed the observation text, as asked, and always parsed once extracted.
- The S6 sheets (no defects) passed cleanly in 11 of 12 thinking-off reviews and 3 of 3 with thinking. One observe pass failed both rows of the dense sheet for "arms overlapping the tie", which is the pose.

### Tokens, latency and cost per review

| Mode | Input tokens, average | Output tokens, average (range) | Thinking tokens | Latency, median (range) | Cost, average (max) |
|---|---|---|---|---|---|
| Off, plain | 3,317 | 148 (43–434) | 0 | 2.7 s (0.7–10.6) | $0.0012 ($0.0016) |
| Off, observe then judge | 3,419 | 508 (279–952) | 0 | 4.5 s (1.7–7.5) | $0.0016 ($0.0023) |
| Adaptive, all 8 sheets | 3,338 | 7,968 (766–15,150) | 7,805 (98% of output) | 64 s (5.8–157.8) | $0.0105 ($0.0193) |
| Adaptive, the five S2 sheets only | 3,717 | 11,526 (5,264–15,150) | 11,292 (98%) | 81 s (59–158) | $0.0149 ($0.0193) |

- Cost is the list price with no cached input. With the cache reads that occurred, the billed averages were $0.0009, $0.0012 and $0.0105.
- Thinking tokens are reported in `usage.output_tokens_details.thinking_tokens`. The field is present only when thinking is on.
- The adaptive figures on the S2 sheets match the earlier spike (about $0.014 and 75–97 s).
- On the defect-free S6 sheets, adaptive thinking was short on two (0.8–0.9 k tokens, 6 s) and long on one (4.5 k tokens, 63 s).

### Limits of Spike 2

- The ground truth is one reader's judgement from the sheets and crops, not from the source components.
- 11 clear defects on four sheets. One sheet (diagram) holds 5 of them and most of the false defects.
- Adaptive was run once; thinking off twice. The two thinking-off passes differed from each other (7 against 5, 6 against 5), so single-pass differences between modes are within the noise.
- One prompt per mode. A different observe format might do better.
- Sheets were sent whole at default image detail. Sending rows separately or at higher detail was not tried, and is the obvious thing to try for the small-text misses.
- Scoring "found" required the description to match the visible problem; a bare "fail" on the right row did not count.

---

## Spike 3 — structured submission without a forced tool call

### Setup

- 30 tasks: "Review scene Snn for defects and submit your findings." Each scene has a manifest and a render report with 0–3 planted problems (text overflow warning, missing asset, element running past the scene end, audio offset beyond tolerance). 6 scenes have none.
- Tools: `read_scene_manifest` and `read_render_report` return the canned JSON; `submit_findings` ends the task. `tool_choice: {type: "auto"}`.
- `submit_findings` schema: `scene_id` (pattern), `overall` (3-value enum), `summary` (1–400 characters), `findings` (array, up to 12). Each finding: `id` (pattern), `severity` (enum of 3), `category` (enum of 6), `element_id`, `time_range` (object of two numbers ≥ 0), `confidence` (number 0–1), `evidence` (array of at least one object with `source` enum, `ref`, optional integer `line`), `suggested_fix`. No extra properties allowed at any level.
- The system prompt says the task ends only when `submit_findings` is called, that results must not be given as plain text, and that a clean scene still needs a call with an empty array.
- If a run ended in plain text: one nudge, "Call submit_findings now with your findings." If the arguments failed validation: the exact validator errors were returned as an error tool result, once.
- `max_tokens`: 4,000 for M3 (thinking off), 6,000 for Flash (effort low). The same 30 tasks ran on both models.

### Results

| | MiniMax-M3, thinking off | MiniMax-M3.1-Flash, effort low |
|---|---|---|
| Runs | 30 | 30 |
| Ended with a schema-valid `submit_findings`, unaided | **26** | **25** |
| Ended in plain text | 0 | 0 |
| Valid after one nudge | not exercised | not exercised |
| First `submit_findings` schema-invalid | 4 | 5 |
| Fixed by one exact-error retry | 4 of 4 | 4 of 5 |
| Valid at the end | 30 of 30 | 29 of 30 |
| Turns per run, average (range) | 2.13 (2–3) | 2.17 (2–3) |
| Input tokens per run, average (of which cached) | 3,003 (1,883) | 3,041 (1,933) |
| Output tokens per run, average (max) | 892 (4,053) | 903 (2,152) |
| Cost per run, list price with no cached input | $0.0020 | $0.0010 |
| Cost per run as billed, average (max) | $0.0015 ($0.0064) | $0.0007 ($0.0017) |
| Time per run, average (max) | 6.8 s (27.5) | 7.4 s (25.3) |

- **Every schema failure was the same rule**: `summary` longer than 400 characters. There were no enum, type, missing-field, extra-property or nesting errors in these 60 runs. 6 of the 9 failures were on scenes with nothing wrong, where the model wrote a long justification.
- The one unrepaired run (Flash) sent a summary that was still too long after the error.
- Every run called both read tools first, in one turn, and submitted in the next.
- Findings were not graded for correctness. As a rough check, valid submissions covered all planted problem kinds in 27 of 30 (M3) and 29 of 29 (Flash); on clean scenes M3 reported findings in 1 of 6 and Flash in 2 of 5.

### Supplementary runs

- **Conversational wording** (15 tasks per model, user message "Quick question: is scene Snn OK? Tell me what is wrong with it, if anything."): still 0 plain-text endings. M3: 13 valid unaided, 2 invalid (summary length), 1 fixed by the retry, 1 not. Flash: 14 valid unaided, 1 invalid (summary length), fixed.
- Across all 90 measured runs: 78 valid unaided, 0 plain text, 12 schema-invalid, 10 of 12 fixed by one retry, 88 of 90 valid at the end.
- **Smoke test** (6 runs before the measured sample, with `max_tokens: 2500` for M3 and slightly different canned data; not included above). Two things appeared that the measured sample did not show:
  - One M3 run wrote analysis as plain text until it hit the 2,500-token limit, with no tool call. One nudge then produced a valid call. This is the only data on the nudge: 1 of 1.
  - One M3 run made two `submit_findings` calls in a single turn, both rejected for missing every required top-level field. The raw arguments were not captured.

### Limits of Spike 3

- Short loops: two read calls and a submit. The design's real sub-loops are longer, and the chance of drifting into plain text may rise with length.
- One schema and one system prompt. The schema's only free-text length limit caused all failures; a schema without one might pass more often, and one with more such limits less often.
- The nudge path was not exercised in the measured sample, so its success rate is unknown (1 of 1 in the smoke test).
- The output limit matters for M3 with thinking off, which writes its reasoning as visible text before calling a tool: the plain-text ending appeared at 2,500 tokens and not at 4,000.
- Canned tool data; no tool errors, no long tool results.
- Findings were not checked for truth.

---

## Failures and oddities, all spikes

- No request failed permanently. 24 of 402 needed a retry.
- `fps` outside `source` is ignored without an error.
- Omitting `fps` samples at 2 fps, not 1.
- With thinking on, M3 used its whole 8,000-token output limit without answering in 7 of 16 inspection runs, including all 4 controls.
- One Reviewer reply in 40 was malformed JSON.
- Input is cached automatically on repeat sends of the same media, without `cache_control`. In Spike 1 about half of all input tokens were billed at the cached rate.

## Spend

| Spike | Requests | Billed | List price with no cached input |
|---|---|---|---|
| 1 (including probes) | 148 | $0.345 | $0.497 |
| 2 | 40 | $0.118 | $0.129 |
| 3 (including smoke test and supplementary runs) | 214 | $0.122 | $0.158 |
| **Total** | **402** | **$0.584** | **$0.784** |

Token-count requests (about 30) are not included.
