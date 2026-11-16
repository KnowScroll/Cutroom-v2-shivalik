# Cutroom v2 — LLD · R9: Quality Checks, Review, Diagnostics and Stopping Rules

**Decided:** 14 November 2026
**Status:** DECIDED by the lead session under the user's delegation of 14 Nov 2026. The items under "Decisions for the user" were decided by the user on 15 November 2026 ([integration decisions](11-integration-decisions.md) section 17). The design set was frozen on 15 November 2026 ([R10](10-r10-integration-acceptance-and-build-plan.md) section 6.4); this document may be revised during implementation.
**Baseline:** HLD [A4, A5](../hld/01-phase-a-system-boundaries-and-ownership.md), [B2.6, B3](../hld/02-phase-b-production-lifecycle-and-autonomous-quality.md), [C8, C9](../hld/03-phase-c-integration-contracts.md); [R0](01-r0-framing-decisions.md); [R1](02-r1-foundations.md); the [integration decisions](11-integration-decisions.md); the [spike log](../research/10-spike-evidence-log.md) and the evidence for spikes [S4](../research/evidence/s4-render-host.md), [S3, S5 and S6](../research/evidence/s3-s5-s6-minimax.md), [batch 2a](../research/evidence/b2a-colour-mux-mix.md) and [batch 2c](../research/evidence/b2c-minimax-review.md).
**Web sources** were fetched on 14 November 2026. Type and JSON snippets are illustrative; R3 stores the exact schemas. No product code exists, and of the spikes in section 9 only R9-1 and R9-5 are closed.

## 1. Problem and scope

Cutroom v1 rejected takes with strict gates and had nothing able to inspect and repair them. The HLD replaces that with a **diagnostic-first** Quality System: an instrument that reports what was observed, where, and what might fix it. The Director decides. Only real hard requirements can stop a file being called a successful delivery, and an empty budget never turns a failure into a pass.

R9 designs the check catalogue, the Reviewer protocol, review triggers, the Quality Intent, the Diagnostic Evidence Bundle, the repair loop, the stopping policy, the deliverable record, AI-content disclosure and calibration. Probe collection (R2), storage (R3), job mechanics (R5), the Reviewer's runtime (R6), and audio engines and rights workflows (R7) are out of scope.

Terms. A **probe** is R2's per-frame record of one tagged element: box, visibility, clipping, stacking order, text and optional data. A **check** is a versioned function from pinned inputs to a validation record (R1 §5). A **finding** is one located observation. The **closure** is everything a candidate film depends on. A check's **scope** is `component`, `shot`, `film`, `final` (the exported file), `take`, `claim`, `asset` or `capture_session`. **PSNR** (peak signal-to-noise ratio) compares two images; above about 50 dB they look identical.

## 2. Decisions

### D1. Checks are cached jobs that only write evidence

**Problem.** Checks must be cheap to repeat, must never mutate work, and must be honest about what they looked at.
**Choice.** There is one catalogue, and each check runs as the Scheduler capability `check.run`, which the Quality System's check runner executes. The runner is the only writer of validation records; R2's validation ladder and the bake equivalence test are functions it calls. Inside an author worker's job (R6 D6.2, D6.3) the ladder runs as plain functions, round after round, and repair rounds write no validation records; only the candidate the worker returns is validated through `check.run`, the runner writes that one record, and the worker's result carries a reference to it (K4). A check's work key hashes the check ID and version, its input hashes, and the values of the settings and Quality Intent fields it reads. An unchanged chunk is never re-checked, and a changed claim, setting or Quality Intent field re-keys exactly the checks that read it, deterministic ones included. A check writes one validation record and nothing else. If it crashes, times out or lacks an input, its verdict is `UNKNOWN`, never `PASS`. A crash or timeout is first a `transient` attempt failure, retried up to R5's `retry.transient_max` and writing no record; if the last attempt also crashes or times out, the runner writes the one validation record with verdict `UNKNOWN` and a coverage record naming the failure. That record is the cached result, run again only by `job_retry` or after an input changes. A missing input gives a cached `UNKNOWN` at once (decided: `lld/11` section 18, B:M3-10). Each check also declares, when it is registered in the catalogue (`register_check`), the hard-constraint kinds it can prove (`proves`), which section 3.4 uses (decided: `lld/11` section 18, B:O9).
**Rejected.** Checks embedded in each producer: producers would mark their own work, and thresholds could not be audited in one place.

### D2. The check type decides the effect; no verdict deletes anything or blocks promotion

| Type | A `FAIL` or `UNKNOWN` does this | It never does this |
|---|---|---|
| Observational | Adds a finding with a severity | Blocks a render, preview, promotion or delivery by itself |
| Corrective | Marks the artifact not valid for operations that need valid input (a `frozen` compile then fails with `NOT_READY`); starts bounded local repair | Deletes the artifact or its previews; blocks promotion |
| Hard | Makes the candidate's completion state `blocked` | Stops previews, repairs, promotion or further work |

A preview is kept whatever its findings, and its validation records travel with it.

### D3. Compare declared with observed, and prefer probes to pixels

**Problem.** A black frame, a frozen picture, a silence or an overlap may be a defect or a choice. A fixed threshold cannot tell.
**Choice.** Each detector's output is compared with what is **declared**. The Render Plan's `quality_declarations` part (R4) lists declared hold, black and silent intervals, expected-motion intervals, must-see intervals, `sync_pairs` and `handoffs`. A freeze inside a declared hold is expected; a freeze where motion is expected is a likely stale frame. Geometry is read from probe boxes, which are exact and cover every frame: S4 measured probes at under 1 ms per frame, so R2's `probe.stride` is 1. Pixels answer only what probes cannot: contrast, blankness, encode integrity.
**Limit.** A probe box is a rectangle and over-estimates overlap and occlusion; section 3.1 states which probe checks are definitive. Every bundle names a **fault layer** (`authoring`, `compile`, `render`, `encode`, `observation`, `unknown`), found by comparing project state, probe and pixels ([research 05 §18.3](../research/05-agentic-harness-and-experiment-agent.md)). The source is never edited to hide a renderer fault.

### D4. Text contrast uses the WCAG formula with two captures

WCAG, the Web Content Accessibility Guidelines, defines relative luminance as `L = 0.2126·R + 0.7152·G + 0.0722·B`, each channel linearised as `c/12.92` if `c ≤ 0.04045`, else `((c + 0.055)/1.055)^2.4`, and the contrast ratio as `(L1 + 0.05)/(L2 + 0.05)`. The minimum is 4.5:1, or 3:1 for large text (18 pt, or 14 pt bold) ([WCAG 2.2](https://www.w3.org/TR/WCAG22/), [technique G18](https://www.w3.org/WAI/WCAG22/Techniques/general/G18)). We borrow the formula and claim no conformance.

**Method.** The host captures a sampled frame twice: normally, and in R2's "hide one element" mode with the text hidden, which gives the true background, including gradients and footage. The check uses the probe's text colour and the background pixel at the `contrast.bg_percentile` nearest the text in luminance, so a small bad patch still counts. WCAG's 18 pt is about 66 design units on a phone 390 CSS pixels wide; that mapping is ASSUMED.

### D5. The script is checked against the audio by speech-to-text, at two points

**Problem.** MiniMax models accept no audio (R0 §4), so nothing "listens", and the user decided on 15 November 2026 that nothing is added to listen (U3, D10).
**Choice.** Speech-to-text runs behind the provider-neutral `Transcriber` interface, which R7 owns; R9 uses it through the capability `transcribe` and requires word-level times. The starting default was MiniMax `asr-1.0`: $0.38 per hour, word-level timestamps, at most 500 seconds and 50 MB per file ([API reference](https://platform.minimax.io/docs/api-reference/speech-to-text.md), [pricing](https://platform.minimax.io/docs/guides/pricing)). A 120-second reel would have cost about $0.013. Local whisper.cpp is the fallback. **The transcriber is Whisper `small.en`, run locally in Node through ONNX** (R7 §2.2.4); `asr-1.0` is not used and no hosted speech-to-text is used (decided: `lld/11` section 18, L10). It and the CTC aligner are different models and methods, so they are independent, as `R7-A2` requires (decided: `lld/11` section 18, C:M5-O1a). Forced alignment alone was rejected because it assumes the words are right. Transcription runs on each accepted voice take (A-01) and on the exported file's audio (A-02).
**Measure.** Word error rate (WER) is `(S + D + I) / N`: substitutions, deletions and insertions over the reference word count ([jiwer](https://jitsi.github.io/jiwer/usage/)), after normalising case, punctuation, numerals and names. Before comparing, both the script and the transcript pass through one normaliser for numbers, times, abbreviations and names. A take of at most `stt.short_take_words` (10) script words passes with at most `stt.short_take_max_errors` (1) word errors; longer takes use `stt.wer_max_take` as before. Both are starting values calibrated at M5 (`R9-3`), because spike V1 measured a normalised WER of 0.08 to 0.30 on correct short takes with numbers, times, abbreviations and names. A-01 does not gate delivery until the normaliser's tests pass (decided: `lld/11` section 18, L13). A high WER is a hypothesis, not proof: the transcriber may be wrong. Deliberate gibberish voices return `NOT_APPLICABLE`.

### D6. Sync is checked in three layers

1. **Mux offset (hard, final file).** The exported audio, decoded with the MP4 edit list applied, is cross-correlated with the frozen master mix to find the lag. The tolerance is 5 ms early to 15 ms late, the per-stage figure of the European Broadcasting Union's recommendation [EBU R37-2007](https://tech.ebu.ch/docs/r/r037.pdf). Batch 2a measured a lag of 0 samples. A player that ignores the edit list plays audio 21.33 ms late, a stated limitation.
2. **Planned pairs (observational, shot).** The compiler builds `sync_pairs` from authored `event.probe` bindings (`layer`, `cut_id`, and a `predicate` of `visible` or `moved`). The check compares the first frame on which the predicate holds with the event's planned frame and the paired audio cue; an event with no binding gives `UNKNOWN`. A sound anchored to a visual event is placed at that event's presented frame (R1 Revision 1), so a correct pair has no planned offset.
3. **Perceived sync (observational, final file).** Word times from the final transcript are compared with planned word times. The voice engine, Kokoro-82M through OpenRouter, returns no timing, so every take is `aligned` and the planned word times come from the forced aligner (U17, U18). A voice adapter declares its native timing as `word_accurate` or `coarse` (R7 §2.2.1). For a `native` take from a `coarse` adapter, of which there are none by default, the word-level part of this layer reports `UNKNOWN` with a coverage record instead of a finding (K3). Because Whisper's word times are less accurate than the aligner's (spike V1: the first word of every clip at 0.00 s, and onsets after pauses missed by a median of 71 ms), the word-level part reports `UNKNOWN` with a coverage record for every take, until a better source of final-file word times exists (decided: `lld/11` section 18, L11).

Layers 2 and 3 use 40 ms early and 60 ms late, the end-to-end limit in the same recommendation, which R1 §1.8 had held as an assumption.

### D7. The Reviewer sees a pinned bundle, the system computes its coverage, and its answers are fallible

**Problem.** A model reviewer can claim to have seen what it was never shown, and can misread what it was shown.
**Choice.** The Quality System builds the bundle and computes the coverage record from the harness's log of what was served (R6); the Reviewer never reports its own coverage. A validator rewrites any `PASS` whose required evidence was absent to `UNKNOWN`, and demotes any finding that cites no evidence ID to an uncited hypothesis.
**Fallibility.** In S6 the MiniMax-M3 judge agreed with direct inspection on 12 of 15 sheets and, on ten sheets with the action removed, reported the action once. In batch 2c it found at best two thirds of the visible defects (section 3.2). So deterministic checks carry most of the load: Reviewer findings are observational, a hard constraint's proof must be `by: check` wherever a deterministic check can prove it, and a reviewer-proved one is decided by up to three fresh reviews (section 3.4). Questions ask for per-frame observations before a choice among stated alternatives: S6's per-frame labels were accurate, its open judgments of a pose were not.

### D8. Repair is bounded by attempts and by progress

The loop (section 3.5) uses a **failure signature**: a hash of check ID, error class and location. Director-led revision that reproduces the same signature `revision.same_signature_limit` times has made no progress and escalates early.

### D9. The completion state is computed, not asserted

**Problem.** The Director must be autonomous without being able to argue a failed requirement into a pass.
**Choice.** A pure function computes the state from evidence and settings, and the Director chooses among the actions that state permits (section 3.6). Of the project's facts, the function reads only validation records and `system` fields, which only the owning module's code writes (R3), so no model patch can move a hard gate. A Director that simply declared the film ready would hold its authority by prompt, not in a module.

### D10. Audio that nothing can hear is reported as unknown

Transcripts, loudness and sync are checked, but no model hears voice performance, music fit or comic delivery. Every review records `audio_heard: false`; those dimensions return `UNKNOWN` and appear as known limitations. A provider-neutral `AudioReviewer` slot is defined but left empty: on 15 November 2026 the user decided that nothing listens to the audio and no second provider with audio input is added (U3, section 10). This is recorded as a known limitation on every deliverable.

## 3. Interfaces to other stages

### 3.1 Check catalogue

This table is the single canonical list of checks; other stages refer to these IDs. Every check emits a validation record with a verdict, located findings, coverage and the evidence that shows the finding. A default owned by another stage names that stage. **LUFS** measures loudness over a whole programme, and **dBTP** measures true peak. **AAC** is the audio codec of the exported file.

| ID | Type | Scope | Method | Default |
|---|---|---|---|---|
| C-00 | corrective | component | One HTML document can be extracted from the model output | one |
| C-01 | corrective | component | R2's lint rules, including nested frames | R2 rules |
| C-02 | corrective | component | Loads in the sandbox; `ready` arrives; no faults | R2 timeouts |
| C-03 | corrective | component | Seek sweep at uniform points, every declared event time and each control's extremes; a console error fails | `validation.sample_times` 8 (R2) |
| C-04 | corrective | component | R2's determinism rules: order independence, control purity, time invariance, repeatability | `validation.order_independence_min_psnr_db` 70 (R2) |
| C-05 | corrective | component | Not one flat colour, unless `meta.may_be_blank` | R2's blank floor |
| C-06 | observational | component, shot | Promised probe IDs appear; boxes stay inside the declared footprint (the component's box, or the staged footprint at shot scope); text uses declared fonts | `staging.tolerance_du` 8 (R4) |
| C-07 | corrective | component | Control response: each declared control, at its minimum and maximum, changes a probe item or the picture against the default pose and meets its probe expectation; optional `hand_l_target` and `hand_r_target` point controls included | `control.response_min_fraction` 0.001 |
| C-08 | observational | component | Frames differ over time, unless `meta.time_invariant` | `component.min_distinct_frames` 3 |
| C-09 | observational | component | Seek and capture time within R2's budget | R2 |
| P-01 | observational | shot | Unrelated objects' boxes overlap, or a box enters another owner's avoid region | > 15% of the smaller box, ≥ 3 frames |
| P-02 | observational | shot | Text, faces and must-see elements inside the profile's safe region | 0 units |
| P-03 | observational | component, shot | Text height after all transforms (`text.size_du`) | ≥ 36 units; captions ≥ 48 |
| P-04 | observational | component, shot | WCAG contrast from two captures (D4); `NOT_APPLICABLE` for component text over transparency | ≥ 4.5; large ≥ 3.0 |
| P-05 | observational | shot | Must-see elements are occluded: visible fraction and duration | ≥ 0.9; ≥ 400 ms |
| P-06 | observational | shot | A probe centre jumps with no declared event | > 6× local median and > 40 units |
| P-07 | corrective | component, shot | Rendered text equals bound text | exact |
| P-08 | observational, `material` | shot | Anchor drift: pointer tip against the reprojected anchor | `staging.anchor_tolerance_du` 6 (R4) |
| P-09 | observational | shot | Planned pairs from `sync_pairs` (D6); no binding gives `UNKNOWN` | −40 / +60 ms |
| P-10 | observational | component, shot | Text overflows its container | none |
| P-11 | observational | shot | Reads R4's `quality_declarations.handoffs` list of `{layer, frame, from, to}`, with `from` and `to` each `{layer, anchor}`; either may be empty (`null`) when a follower gains its first leader or lets go (G18). With both ends present it measures the distance between the old and new leader anchors at the switch frame; with either end empty, the follower's own displacement between the frame before the switch and the switch frame, against the same tolerance | `staging.handoff_tolerance_du` 24 (R4) |
| M-01 | observational | shot, film | `blackdetect` against declared black | 0.5 s; 0.98; 0.10 |
| M-02 | observational | shot, film | `freezedetect` against declared holds and expected motion | noise 0.001; 1.0 s |
| M-03 | observational | film | `silencedetect` against declared silence | −50 dB; 1.5 s |
| M-04 | corrective | film | Loudness and true peak of the master mix, as F-09 | as F-09 |
| M-05 | corrective | shot | Each chunk's frame count; uniform timestamps in the joined file | exact |
| A-01 | corrective | take | Transcript of the take against the script, both through the one normaliser (D5); it does not gate delivery until the normaliser's tests pass (L13) | WER ≤ 0.10; a take of at most 10 words passes with at most 1 word error (L13) |
| A-02 | observational | final | The same on the file's audio; perceived sync (D6) against the takes' aligned word times (U17). For `native` takes from a `coarse` voice adapter, of which there are none by default, the word-level part reports `UNKNOWN` with a coverage record instead of a finding (K3); with Whisper's word times as the reference, it does so for every take (D6; decided: `lld/11` section 18, L11) | WER ≤ 0.15; −40 / +60 ms |
| A-03 | corrective | film | Caption text equals script (R4's `CAPTION_TEXT_MISMATCH` blocks a `frozen` compile and is a material note in `plan` mode); each caption overlaps its words; reading speed, line and duration limits for the track's style and audience | R7's `captions.*` |
| R-01 | hard | film | Every asset, font, library, sample and voice profile in the closure has a `rights` record in state `eligible` for the delivery scope, with original hash, declared crop or trim, and attribution | all |
| K-01 | hard if essential, else observational | film | Each claim has a status and, unless `fiction`, a source binding; numeric and essential claims need two independent sources, others one; a source of type `user` is accepted for a figure the brief supplies | `research.min_sources_for_numbers` 2 (R7) |
| K-02 | corrective | component, shot, film | Rendered figures (probe text and chart `data.value`) and spoken figures (transcript) equal the claim value they are bound to, through the shared `format` record | exact after normalising |
| K-03 | observational | claim, asset | Reviewer: the excerpt supports the claim; the media shows what its record says | once per version |
| K-04 | observational, `material` | component, shot | Chart geometry: each mark's `rect_local` agrees with its reported value through the chart's `scale` item, in component-local pixels | `chart.geometry_tolerance_fraction` 0.02 |
| K-05 | hard | film | `identity.verdict` is `confirmed` for every asset whose media need has `factual_role: evidence` | all |
| S-01 | corrective | capture_session | The session's stored assertions, re-run before delivery | all pass |
| F-01 | hard | final | ffprobe container and streams match the profile; `color_range`, `color_space`, `color_transfer` and `color_primaries` equal R2's encode settings; video `nb_read_frames` = N exactly; mix length `round(N·T / flicks_per_sample)` samples, and the decoded AAC audio exceeds it by at most one AAC frame (1,024 samples); container duration within one AAC frame of N·T; full decode | exact; 0 errors |
| F-02 | hard | final | Audio present and audible when the profile needs audio | > −40 LUFS |
| F-03 | hard | final | Mux offset against the master mix, with the edit list applied (D6) | −5 / +15 ms |
| F-04 | hard | final | Sampled exported frames match the accepted render | 30 frames; ≥ 35 dB |
| F-05 | hard | final | Every work key in the delivered file's lineage is requested by the accepted plan's execution part, and the consumer records the accepted revision; grade (input readiness) and rung (output fidelity) are `final` | exact |
| F-06 | hard | final | Every hard constraint in the Quality Intent has its named proof, and it is `PASS`. A proof `{by: check, check: X}` with X other than F-06 is X's validation record on the exported file or its closure, and X joins the required evidence (section 3.6). A proof naming F-06 itself, allowed only for kinds `duration`, `aspect` and `language`, is evaluated by F-06 from the exported file and the plan with the `params` shapes of section 3.4. A reviewer proof is the vote verdict of section 3.4 (decided: `lld/11` section 18, C:C1.5) | all |
| F-07 | hard | final | A whole-film review of the exported file exists, and its answers cover every `must_communicate` question | unseen gap ≤ 1 s |
| F-08 | corrective | final | Content-credentials manifest validates (only when embedded labelling is on) | valid |
| F-09 | hard | final | The file's decoded audio: integrated loudness within `loud.tolerance_lu` of `delivery.audio.loudness_lufs`; true peak at or below `delivery.audio.verify_max_dbtp` | −14 ± 1.0 LUFS; ≤ −1.0 dBTP (R7) |

**Notes.**

- **Loudness.** M-04 and F-09 measure with `ebur128=peak=true` and read the delivery profile, never a copy. The profile's `audio.loudness_lufs` and `audio.verify_max_dbtp` are `human` fields, because they are thresholds of the hard check F-09: they take the values of R7's `delivery.audio.*` settings when the profile is created, and after that only a human may change them (R3 §2.7, K1). `loud.tolerance_lu` (1.0) is the check tolerance. R7 owns the mastering method, which no longer uses `loudnorm`: it aims tighter under `mix.master_tolerance_lu` (0.5), and limits at `delivery.audio.limit_dbtp` (−3.0) because AAC encoding raised true peak by up to 1.5 dB in batch 2a.
- **Charts.** A mark reports `data.value` and a chart one `scale` item (domain, pixel range, baseline) through `cut.mark(id, rect, {text?, data?})`; without them K-02 and K-04 are `UNKNOWN`. Both rely on SVG or HTML elements that the shim measures itself; R2's `LINT.CLAIM_BOUND_CANVAS` rejects a claim-bound Canvas component. K-04 finds the near-zero bars that passed every other test in S3.
- **Controls.** C-07 proves only that a control does something: in S6, arm controls that were wrong on 2 of 5 characters still changed pixels. The control-extremes cells of review rule T1 show whether a control does the right thing.
- **Frames differ.** In S3 six sample times missed a short motion and a correct component failed, so C-08 is observational and C-03 samples every declared event time.
- **Figures the brief supplies.** K-01 needs supported claims, and only R7's quote check may write `claim.support` and the `supported` status (K2). So the brief-only part of research is built at M6: Project Core creates a `source` with `type: user` whose `snapshot` is the brief's `text`; `research_request` runs a researcher sub-loop whose grant holds only `submit_research`, with no `web_search` or `web_fetch`; its proposed claims quote the brief, and the quote check writes `support` and `supported`. M8 adds the web tools to the same path (decided: `lld/11` section 18, C:M6-O2). The data-reel golden brief supplies its own five monthly figures as invented test data, labelled as such in the brief, with a source of type `user`; no real-world statistic is claimed (decided: `lld/11` section 18, L15).

**Component validation.** At least 7 of 72 components that passed S3's load-and-seek ladder were visibly broken (near-zero bars, invisible text, off-frame characters). Component validation therefore also runs C-06, P-03, P-04, P-10, K-02 and K-04 at component scope, and one contact-sheet look (review rule T1).

**R2's validation ladder** labels each step with the checks it produces: V0 is C-00, V1 C-01, V2 C-02, V3 C-03, C-07 and C-08, V4 C-04, V5 C-05 and C-06 (its probes also feed the component-scope probe checks), V6 C-09, and V7 is review rule T1.

**R4's after-render codes.** The Quality System runs R4's staging verification as a check and relays R4's code unchanged in `origin.code`. `FOOTPRINT_EXCEEDED` is filed under C-06 at shot scope and `ANCHOR_DRIFT` under P-08, each as `FAIL` with severity `material`. A footprint not marked conservative is measured and noted, not judged. `AVOID_REGION_ENTERED` is filed under P-01 and follows P-01's rule below. `PROBE_MISSING` gives `UNKNOWN`, severity `note`, on the check that needed the probe (C-06 for a promised ID).

**Which probe checks are definitive.** C-06 for footprints marked conservative and P-07 are definitive from probes alone: containment in a conservative region and equality of a string need no pixel. P-01 and P-05 are hypotheses until a diagnostic capture confirms them, because rectangles over-estimate overlap and occlusion. Each check requests a "tint one element" capture for its candidate frames and decides from the visible pixel count, with severity `material` on a `FAIL`. If the capture cannot run, the verdict is `UNKNOWN` and the statement sits under `hypotheses`. For a Canvas mark hide and tint always return `DIAG_UNSUPPORTED`, so P-01, P-04 and P-05 are `UNKNOWN` there; only layer isolation works for every technique. The other probe checks report the value they measured. A probe item of `kind: canvas` is the component's own report through `cut.mark`, and a `PASS` resting on such items says so in its coverage record.

**FFmpeg facts relied on** were read from the source: [`blackdetect`](https://github.com/FFmpeg/FFmpeg/blob/master/libavfilter/vf_blackdetect.c) has `d`, `pic_th` (0.98) and `pix_th` (0.10); [`freezedetect`](https://github.com/FFmpeg/FFmpeg/blob/master/libavfilter/vf_freezedetect.c) has `n` (0.001) and `d`, and calls a frame frozen when its mean absolute difference from the reference is at or below `n`; [`silencedetect`](https://github.com/FFmpeg/FFmpeg/blob/master/libavfilter/af_silencedetect.c) has `n` and `d`; [`ebur128`](https://github.com/FFmpeg/FFmpeg/blob/master/libavfilter/f_ebur128.c) with `peak=true` reports integrated loudness and true peak. Each writes `lavfi.*` metadata. The ffprobe fields F-01 reads exist ([ffprobe.xsd](https://github.com/FFmpeg/FFmpeg/blob/master/doc/ffprobe.xsd)).

**Supplied by other stages.** R2 supplies the probe sidecar, a file stored beside each rendered chunk with one JSON line per item per sampled frame, `{unit, frame, stride, layer, id, kind, rect_local, rect_screen, visible, opacity, clipped, stack_order, text?, fill?, data?}`, and three **diagnostic capture modes**: hide one element, isolate one layer, tint one element. A mode is requested per capture, changes the work key, and can never appear in a delivery render. R4 supplies `quality_declarations` and the closure; R5 the scheduling of `check.run` and the capability `transcribe`; R6 the Reviewer's runtime and the tools `check_run`, `review_request`, `evidence_read`, `evidence_view` and `delivery_finalize`; R7 takes, the master mix, caption tracks, rights records, capture sessions and the `Transcriber` adapters.

### 3.2 Reviewer protocol

**Pinned bundle.** A manifest of content hashes: the brief and Quality Intent; the acceptance criteria and accepted decisions for the entities under review; ground truth (source excerpts, data values, rights records, the frozen transcript); output evidence; deterministic check results; and earlier adjudicated findings, so settled points are not raised again. It never includes the Director's conversation, and web text is labelled untrusted.

**Contact sheet.** Cells are 360 × 640 pixels, in four columns and up to four rows; a strip under each cell prints frame number, time and shot handle. Frames are chosen at each planned event and the frame before it, then filled uniformly; a whole-film sheet uses one frame per `sheet.film_interval_s`. A sheet answers questions of layout, legibility and continuity: S2's, at about 3,400 input tokens, was enough to find a missing face and a duplicated word.

**Event strip.** Dense still strips are the primary evidence for frame-level inspection: acting, hand-offs and event timing are never judged from an evenly spaced sheet. An event-centred strip shows frames `sheet.strip_spacing_ms` apart, centred on the event's interval (for acting, the control track's first key to its last), up to `sheet.strip_max_cells`; a longer interval gets several strips. When single frames are in question, a frame strip shows `sheet.frame_strip_cells` consecutive frames. In S6 a half-second double-take was visible at 120 ms spacing and invisible in 12 frames spread evenly over four seconds. The default is 100 ms, three frames at 30 fps. In batch 2c a strip of 18 consecutive frames named the exact frame of a planted single-frame defect in 22 of 24 runs, a clip slowed 6× in 38 of 48 and a real-time clip in 0 of 24. False alarms on clean material were high in every form (4 of 8, 5 of 16, 7 of 8), so a single-frame defect reported by the Reviewer is a hypothesis until P-06 or a diagnostic capture confirms it. A question about acting or event timing that was served no strip or inspection clip covering the event is rewritten to `UNKNOWN`. The sheet of review rule T1 adds control-extremes cells: the default pose and each control at its minimum and maximum.

**Zoomed crops.** A region at full output resolution with 15% padding, for text and small features.

**Clips.** MiniMax-M3 accepts video up to 50 MB inline or 512 MB through the Files API and samples it at an `fps` of 0.2 to 5; no maximum duration or audio handling is documented ([API reference](https://platform.minimax.io/docs/api-reference/text-chat-anthropic)). Batch 2c measured the rest: `fps` is ignored unless it sits inside the `source` object, where the bundle builder always sets it; the default is 2 frames per second; and a sampled frame costs 173 tokens at 540 × 960. A **real-time clip** plays at normal speed and is for pacing only: at 5 samples per second the model sees one frame in six of a 30 fps clip, so it is never asked about single-frame defects. An **inspection clip** is optional. It holds at most `clip.inspect_window_s` of film, slowed by frame rate ÷ 5 and sent with `fps: 5`, with frame numbers in a margin strip and a prompt that forbids pacing judgments. Clips are silent H.264.

**Audio.** The word-timed transcript, cue list, loudness per three seconds, silence intervals and sync table.

**Prompt structure,** in a fixed order so that MiniMax's automatic prefix cache applies: role, rules and output schema; brief and Quality Intent; one bounded question set; ground truth; evidence items, each with an ID; earlier adjudicated findings. Rules: cite evidence IDs; keep observation, hypothesis and suggestion apart; observe before judging; answer `UNKNOWN` when evidence is missing and `NOT_APPLICABLE` when a question does not apply.

**Validated output.** The Reviewer submits through R6's `submit_findings` tool, which validates the call and returns the exact error for repair, up to `review.max_output_repairs` times. In S5, 99.0% of tool calls were schema-valid without a schema mode; batch 3 showed that this holds only for inputs typed down to every leaf, which `submit_findings` is (R6 D7).

```ts
// illustrative
type ReviewOutput = {
  answers: { question_id: string; verdict: "PASS" | "FAIL" | "UNKNOWN" | "NOT_APPLICABLE";
             confidence: "low" | "medium" | "high"; basis: string[] }[];   // evidence IDs
  observed: { statement: string; severity: "blocking" | "material" | "minor" | "note";
              evidence: string[]; t_start_s?: number; t_end_s?: number; element?: string }[];
  hypotheses: { cause: string; confidence: "low" | "medium" | "high"; test?: string }[];
  suggestions: { change: string; targets: string[] }[];
  could_not_assess: string[];
};
```

**Times** are submitted in seconds, read from the cell labels. Validation converts them to flicks for the stored location (R1 §5) and keeps the submitted values for audit. A time outside the served coverage turns the finding into a hypothesis.

**Coverage record** (system-computed): frames seen, frame fraction, largest unseen gap, intervals seen in real time and as strips, resolution, composite or isolated layer, probe stride, `audio_heard`.

**Retrieval.** The retrieval operations are `evidence_read(ref, section, cursor)` and `evidence_view`, both scoped to the Reviewer's pinned bundle. Retrievals are capped by `review.max_retrievals`, and each extends the coverage record.

**Models.** R6 owns routing and the Reviewer's thinking and output-cap settings (`reviewer.*`). Shot reviews, film reviews and disputed facts run on MiniMax-M3 with `reviewer.thinking` set to `adaptive`; the component look runs on MiniMax-M3.1-Flash. In batch 2c the Reviewer found 12 of 22 visible defects with 9 false ones at $0.0012 a sheet with thinking off, and 7 of 11 with 3 false ones at $0.0105 and 64 s with adaptive thinking.

### 3.3 Review trigger policy

Deterministic checks always run first. A Reviewer call is made only when a rule below fires and the caps allow.

| Rule | Fires when | Review |
|---|---|---|
| T1 | A component version first passes its corrective checks | One sheet on Flash, with control-extremes cells |
| T2 | A shot is first assembled, or its `acting` control tracks change, and it has interacting objects, acting, a planned pair, annotated real media or on-screen facts | Sheet, crops, event strips; an inspection clip is optional |
| T3 | A claim or media use is new or its version changed | K-03 |
| T4 | A check returns `UNKNOWN` on a material question, or state, probe and pixels disagree | Targeted question |
| T5 | A repair claims to fix a finding | Baseline and candidate side by side, that finding only |
| T6 | The film is first fully assembled | Film sheets, real-time clip, transcript |
| T7 | The final file is exported | The same, on the file itself, with every `must_communicate` question (F-07) |
| T8 | The Director asks, through `review_request` | As asked, within caps |
| T9 | The treatment phase has two or more animatics to compare (R6) | A blind film-scope comparison of the treatment animatics against the Quality Intent. Labels are randomised; the output is a ranking with reasons |

Rules T2 to T8 are on/off settings (`review.trigger_t2` to `review.trigger_t8`, all on by default), except that T7 cannot be turned off because F-07 requires it. Rule T1 has no setting and cannot be turned off: it is one call, shared with R2's step V7 and the visual check in R6's author loop, and the authoring job pays for it, outside the caps. **No review** fires when a patch changes only label text, styling or non-acting control values inside declared ranges, and the deterministic checks pass. Caps: 50 calls per film and 6 per revision cycle. T7 is paid from the delivery reserve.

### 3.4 Quality Intent

This document defines the canonical shape of the Quality Intent, and R3 stores it as the `quality_intent` entity. It is small and versioned, the Director derives it from the brief and treatment, and it holds no universal score.

```ts
// illustrative
type Scope = { level: "component" | "shot" | "film"; target?: string };   // target is a handle
type Proof = { by: "check"; check: string }
           | { by: "reviewer"; question: string; max_unseen_gap_ms: number };
type QualityIntent = {
  derived_from: string;                                                   // the brief
  purpose: string; audience: string;
  must_communicate: Record<string, { statement: string; proof: Proof }>;
  hard_constraints: Record<string, {
    kind: "duration" | "aspect" | "language" | "must_include" | "must_not_include"
        | "rights_scope" | "essential_claim" | "custom";
    params: unknown; proof: Proof; from_brief?: string }>;
  facts: { essential_claims: string[] };
  key_aims: Record<string, { scope: Scope; aim: string; review_question: string }>;
  must_see: Record<string, { element: { layer: string; cut_id: string }; from: string; to: string }>;
                                                   // element: a layer reference and probe ID; from, to: event references
  waivers: Record<string, { check: string; scope: Scope; reason: string }>;  // intended overlap, black, stillness
  audio: { stt_exempt: string[]; lexicon: Record<string, string[]> };
  settings_overrides: Record<string, number | boolean | string>;
  disclosure: { visible_notice: boolean; c2pa: "off" | "test_cert" | "production" };
};
```

The five `Record` fields are maps keyed by entry ID, so two branches that edit different entries merge at field level.

Rules enforced on write:

- Every hard constraint names its proof, so none is unprovable. Where a deterministic check can prove the constraint, the proof must be `by: check` (D7).
- The write is checked against the installed catalogue, using each check's `proves` list (D1). When a registered check proves the constraint's kind, a `by: reviewer` proof is refused with `PROOF_REQUIRED`, whose `expected` names those checks, and a `by: check` proof must name a registered check (decided: `lld/11` section 18, B:O9). The starting mapping: `duration`, `aspect` and `language` to F-06, which evaluates them itself; `rights_scope` to R-01; `essential_claim` to K-01 (and K-02 from M8). `must_include`, `must_not_include` and `custom` name a check where one proves the constraint, and otherwise take a reviewer proof. A proof that names a check absent from the installed catalogue, or names F-06 for any other kind, is refused when the Quality Intent is written (decided: `lld/11` section 18, C:C1.5); a proof naming an unregistered check is refused with Project Core's `UNKNOWN_CHECK` (decided: `lld/11` section 18, L32).
- For the kinds F-06 evaluates, `params` has a fixed shape: `duration` `{max_s?, min_s?}`, compared with the file's duration N·T; `aspect` `{w, h}`, compared with the file's displayed width and height (ffprobe, with the sample aspect ratio); `language` `{code}`, compared with the `language` of every `voice_line` and `caption_track` in the closure (decided: `lld/11` section 18, C:C1.5).
- Every hard constraint in the brief is covered by a hard constraint with a proof and `from_brief` naming the brief key; an uncovered key fails with Project Core's `BRIEF_CONSTRAINT_UNCOVERED`. The Director first creates these constraints, one or more with a proof for each brief hard constraint, and code stamps `from_brief` with the brief constraint's key and checks coverage (G19). Creation is allowed once for each brief constraint key; from then on only a human may change or delete that constraint. "Once" is judged against the patch's base revision, or the merged base when `rebase` runs: a Director patch may create constraints with `from_brief: k` only when the base's Quality Intent has none for `k`, so every constraint for one key arrives in one patch (decided: `lld/11` section 18, B:O5). Any later Director patch to one fails with Project Core's `FIELD_AUTHORITY`, whether it would weaken the constraint or not; no weakening test is needed (G11). The Director may always add constraints. Whether a derived constraint and its proof capture the brief is ASSUMED, since code cannot verify it: every deliverable record prints each brief constraint beside its derived constraint and proof, in its `brief_constraints` field (section 3.7, K11), and each golden brief's expected constraints are compared at M6 (R10).
- Waivers apply only to observational checks.
- `settings_overrides` may name only settings this document owns, inside each setting's allowed range, and only settings whose `override_by` is `director`: an override of a `human` setting is refused with `FIELD_AUTHORITY` unless a human wrote it (G21). Other settings are overridden in the project's `settings` (R3). An entry naming a setting this document does not own is refused with Project Core's `UNKNOWN_FIELD`, with path `settings_overrides`, `got` the setting name, `candidates` the nearest R9 settings, and a message saying that other settings belong in `project.settings` (decided: `lld/11` section 18, B:O8-code). R9's settings resolve in this order: the registered default, then `project.settings`, then `quality_intent.settings_overrides`, so the more specific statement of the film's aims wins (decided: `lld/11` section 18, A:M0-11).
- `quality_intent.disclosure` and `delivery_profile.ai_disclosure` are `human` fields (G12). They are different things: `quality_intent.disclosure.visible_notice` is the on-screen notice switch (L16), and `delivery_profile.ai_disclosure` holds the platform disclosure label and the suggested disclosure text for upload (decided: `lld/11` section 18, L24, L37).
- The compiler lowers `must_see` into the must-see intervals of `quality_declarations`. `must_see.element` is `{layer, cut_id}`: a typed reference to a layer plus a probe ID, with the same shape and names as `event.probe` (H11), so a handle rename cannot break it. The compiler resolves it to the sidecar's `layer` stack path and `probe_id`, as it does for sync pairs (decided: `lld/11` section 18, B:O14-must_see).
- A change is a new revision and re-keys every check that reads a changed field.

Each `must_communicate` item's proof is evaluated. A `FAIL` or `UNKNOWN` is a `material` finding, and is hard only if the item is also a hard constraint. `key_aims` are the question set of the film-scope reviews (T6, T7 and T9).

For a hard constraint proved by the Reviewer, one `FAIL` or `UNKNOWN` triggers up to two more reviews with fresh context, and the verdict is the majority of three (`review.hard_proof_votes`). Exactly: a first `PASS` stands. After a first `FAIL` or `UNKNOWN`, up to `review.hard_proof_votes` − 1 further reviews run, each a fresh Reviewer sub-loop on the same pinned bundle, and they stop as soon as one value holds a strict majority of `review.hard_proof_votes`. The verdict is that value; with no strict majority (for example `FAIL`, `PASS`, `UNKNOWN`) it is `UNKNOWN`. A `NOT_APPLICABLE` answer to a hard-proof question counts as `UNKNOWN`, because a hard constraint applies by definition. Either `FAIL` or `UNKNOWN` leaves F-06 failing and the state `blocked`. The validation record keeps every vote. Votes on a proof evaluated at T7 belong to T7: they sit outside the per-cycle cap and are paid from the delivery reserve, so a cap cannot block delivery; if the reserve cannot pay for them, the verdict stays `UNKNOWN` (decided: `lld/11` section 18, C:C1.6). A human may adjudicate; the Director cannot overrule.

### 3.5 Diagnostic Evidence Bundle, notification and repair loop

This document owns the bundle schema. R6's `WorkerOutcome.evidence_bundle` and R3's `evidence` table refer to it, and R3's table stores `fault_layer` and `signature`.

```ts
// illustrative
type DiagnosticEvidenceBundle = {
  id: string; signature: string;
  subject: { entities: string[]; revision: string; artifact?: string; job?: string };
  origin: { kind: "check" | "worker" | "reviewer" | "experiment";
            check?: string; check_version?: string; code?: string;   // the raising module's own code
            settings_version: string };
  type: "observational" | "corrective" | "hard";
  verdict: "PASS" | "FAIL" | "UNKNOWN" | "NOT_APPLICABLE";
  severity: "blocking" | "material" | "minor" | "note";
  fault_layer: "authoring" | "compile" | "render" | "encode" | "observation" | "unknown";
  expected: string;
  observed: { statement: string; location: Location; evidence: string[] }[];  // R1 §5; times in flicks
  hypotheses: { cause: string; confidence: "low" | "medium" | "high"; test?: string }[];
  suggestions: { change: string; write_scope: string[]; invalidates: string[]; est_cost_usd?: number }[];
  attempts: { n: number; change: string; result: string; cost_usd: number }[];
  coverage: CoverageRecord; unknowns: string[]; prior_similar: string[]; cost_usd: number;
};
```

A trivial failure fills only the fields that mean something (HLD C8).

**Two-level notification.** The Director receives a summary of at most `notify.summary_max_tokens`, written with handles and seconds: the bundle ID, status, scope, time range, check, severity, fault layer, one observed statement, one suggested next step and the number of local repairs tried. The full bundle stays in the evidence store. The Director reads chosen sections through `evidence_read(ref, section, cursor)` and views frames through `evidence_view`, so logs and images stay out of its context until needed.

**Repair loop.**

1. **Local repair.** For a component this is the component-author repair loop, which R6 owns (`author.*`): the author receives the exact errors and may change only its own write scope. S3 set its limits: three attempts on Flash, with search/replace edits first, then one on MiniMax-M3. Other artifacts use the owning tool's bounded retry. A repeated failure signature does not escalate this loop before the Flash attempts are used up.
2. **Director-led revision,** when local repair is exhausted or the fix touches story, layout, a source, an identity, the global camera or audio timing (HLD B3.4). The Director makes the smallest sufficient change on a candidate branch, within `revision.max_cycles_per_finding` and `revision.max_cycles_per_film`. `revision.same_signature_limit` applies only here (D8).
3. **Experiment Agent,** whenever the Director judges an alternative worth testing, including when two distinct approaches have failed on one finding or the options differ materially in cost (FR2).

**Regression comparison.** Every candidate is compared with the accepted baseline. Deterministic checks re-run on the affected scope and the two verdict sets are diffed; unaffected chunks are cache hits, and after a `project_merge` the tool handler requests the checks on the candidate's `revalidate` set. Frames outside the declared change scope must match the baseline at `regress.psnr_min_db`; a mismatch is an "unintended change" finding. Rule T5 shows the Reviewer both versions. The resulting comparison record lists resolved, new and unchanged findings, the hard-check difference and cost. It informs the Director, who promotes or rejects.

**Promotion is not gated by checks.** Project Core promotes a structurally valid candidate when the actor has the authority; no compile, check or review result is required, and open findings of any type do not prevent it. A corrective failure instead makes the affected artifact unusable where valid input is needed, so a `frozen` compile fails with `NOT_READY`. Delivery is what requires the check results to exist and every hard check to pass. Rejected candidates and their evidence are kept.

### 3.6 Stopping policy

`completion_state(candidate)` is a pure function of validation records, `system`-written facts, adjudications and settings (D9).

| State | Condition |
|---|---|
| `blocked` | Any hard check is `FAIL` or `UNKNOWN`, or evidence that delivery requires is missing |
| `needs_material_revision` | Not blocked; at least one open finding of severity `material` or `blocking`, or an open corrective failure |
| `eligible` | Not blocked; no open material finding |
| `deliver` | Eligible; every hard final-file check (F-01 to F-07 and F-09) passes on the actual exported file; a stop condition holds |

The final-file checks exist only after an export: an `eligible` candidate is exported, and those checks move it to `deliver` or `blocked`.

**Required evidence.** Code computes the evidence an export requires from the installed check catalogue (`quality_settings@1`) and the plan's closure. (1) Every hard check: R-01; K-01 when an essential claim is in the closure; K-05; F-01 to F-07; F-09. Each must be `PASS`, and a hard check whose scope has no subject in the closure is recorded `NOT_APPLICABLE` (K-05 with no `evidence` media need). F-08 is not a hard check: the catalogue classes it corrective, and while embedded labelling is off (U7) it has no subject in the closure, so it is not required (decided: `lld/11` section 18, L28). (2) Every check named by a hard constraint's proof (F-06's inputs, section 3.1), and the reviewer votes of section 3.4. (3) Every corrective check whose scope has a subject in the closure; for the thin film these are C-00 to C-05 and C-07 for each component, P-07 and M-05 for each shot, A-01 for each selected take, and M-04 and A-03 for the film. An open failure or an `UNKNOWN` among them gives `needs_material_revision` (D2). (4) The T7 review of the exported file (F-07). `delivery_finalize` requests every missing record as a `check.run` job; records that already exist are cache hits, and a record that cannot be produced is `UNKNOWN`. A check absent from the installed catalogue (at M6: K-02, K-03, K-04, P-11 and S-01) is not required; where its scope has a subject in the closure, the deliverable record's `known_limitations` names it. Observational checks are never required (decided: `lld/11` section 18, C:C1.3). A-01 joins this set only once the normaliser's tests pass (D5, L13).

**Adjudication.** A finding is open until fixed or adjudicated. The Director may dismiss or accept an **observational** finding with a recorded reason; subjective criticism does not force another cycle. Corrective failures must be fixed, or the affected element removed. Hard checks cannot be adjudicated: only changed inputs clear them, or a changed brief, which is a new Quality Intent revision. The one exception is a reviewer-proved hard constraint, which a human may adjudicate (section 3.4).

**Stop conditions for optional polish** (any one): the polish budget (`stop.polish_budget_fraction` of the film's budget) is used; `stop.max_polish_cycles` is reached; the last `stop.no_gain_cycles` cycles resolved nothing or regressed; `stop.time_soft_limit_min` has passed. No numeric quality score is used. These are upper bounds that end optional polish. The Director's own judgement is also a stop, as HLD B3.5's "Deliver" condition has it: calling `delivery_finalize` on an `eligible` candidate is a stop condition, and so is the automatic export when the budget runs out (below). The call is a fact in the audit log written by the harness, not a field the Director can write, so D9 holds (decided: `lld/11` section 18, C:C1.4).

**Budget.** R5 holds back one reserve, `budget.delivery_reserve_usd`, for the final export, the final-file checks, review T7 and the Director's wrap-up, so a film can always be validated. `delivery_finalize` opens a child budget scope `delivery`, whose jobs draw on it; the Director session's own model calls may draw on it once the film's other spend has reached the hard cap less the reserve, or once that scope is open (R5 §2.10) (decided: `lld/11` section 18, B:M3-9-draw). This document defines no reserve of its own. When the rest is spent:

- An `eligible` candidate is exported, validated and delivered.
- A candidate in `needs_material_revision` is exported as `incomplete` with the open findings listed. That is not a delivery.
- A `blocked` candidate makes no delivery claim; the Director calls `director_report_blocked` with the evidence and the cheapest known remedy.

Nothing in the budget path can change a verdict. An adjudication made after the working budget ran out is flagged.

**The deliverable record's `completion_state`** is `delivered` for state `deliver` with no material finding accepted in place of a fix and no flagged adjudication; `delivered_with_limitations` for `deliver` with either of those; `incomplete` as above; and `blocked` when a hard check failed or is unknown. A missing whole-film review of the exported file (F-07) is one such case: an unreviewed export never counts as delivered. A blocked or incomplete export still gets a deliverable record in that state; it is never reported as a successful delivery.

### 3.7 Final deliverable record (HLD C9)

```json
{
  "deliverable": "dlv_…", "supersedes": null,
  "completion_state": "delivered | delivered_with_limitations | incomplete | blocked",
  "file": { "ref": "sha256:…", "bytes": 0, "ffprobe": "sha256:…" },
  "project_revision": "rev_…", "render_plan": "sha256:…", "closure": "sha256:…",
  "toolchain": { "chrome": "…", "ffmpeg": "…", "fonts": "sha256:…", "models": {} },
  "quality_intent": "sha256:…", "quality_settings": "quality_settings@1",
  "brief_constraints": [{ "brief_key": "…", "statement": "…", "derived": ["…"], "proofs": [], "verdict": "PASS" }],
  "hard_checks": [{ "check": "F-02", "verdict": "PASS", "record": "…" }],
  "open_findings": [], "adjudications": [],
  "coverage": { "deterministic_frame_fraction": 1.0, "review": { "max_unseen_gap_ms": 500, "audio_heard": false } },
  "sources_and_rights": [], "attribution_text": "…",
  "known_limitations": ["Voice performance was not heard by any reviewer"],
  "ai_disclosure": { "visuals": "LLM-authored code, conventionally rendered", "voice": "…", "music": "…", "real_media": [] },
  "cost": { "usd": 0, "wall_clock_s": 0 }
}
```

`known_limitations` also names each check absent from the installed catalogue whose scope had a subject in the closure, for example "K-02 was not run: not in this build" (section 3.6) (decided: `lld/11` section 18, C:C1.3).

`brief_constraints` has one entry per hard constraint of the brief: its `brief_key` and `statement`, `derived` naming the Quality Intent constraints that cover it, their `proofs`, and the `verdict`. This is how G19's audit is printed (K11).

A re-export or later edit is a new record that points to the one it supersedes. Evidence referenced by any record is exempt from garbage collection.

### 3.8 AI-content disclosure and machine-readable labelling

**Verified facts.**

- **EU AI Act Article 50:** providers of AI systems that generate synthetic audio, image, video or text must mark outputs in a machine-readable format, and deployers must disclose deep fakes, with lighter duties for evidently artistic or fictional work. It applies from 2 August 2026 ([text](https://artificialintelligenceact.eu/article/50/)).
- **Platforms:** YouTube requires disclosure of realistic synthetic content and exempts animation. It labels content carrying C2PA metadata automatically, and that label "can not be adjusted" ([help page](https://support.google.com/youtube/answer/14328491)). TikTok is reported to do the same (SECONDARY).
- **C2PA** (Coalition for Content Provenance and Authenticity): `@contentauth/c2pa-node` needs Node 22 or later and signs through a local or callback signer ([README](https://github.com/contentauth/c2pa-js/blob/main/packages/c2pa-node/README.md)); `c2patool` is the command-line equivalent ([repository](https://github.com/contentauth/c2patool)); the library supports `mp4` ([formats](https://github.com/contentauth/c2pa-rs/blob/main/docs/supported-formats.md)). A conforming product must sign with a certificate from the C2PA trust list ([guide](https://opensource.contentauthenticity.org/docs/signing/get-cert)); the test certificate "is only suitable for development" ([signing guide](https://github.com/contentauth/c2patool/blob/main/docs/signing.md)). The IPTC [source-type list](https://cv.iptc.org/newscodes/digitalsourcetype/) separates generative AI from "pure algorithmic media" and "data-driven media".

**Three levels.**

1. **Always on (DECIDED):** the `ai_disclosure` block in the deliverable record, a sidecar JSON beside the MP4, and a suggested platform disclosure answer per delivery profile. That answer is a fixed table in the disclosure sidecar, per delivery profile, derived only from the record's `ai_disclosure` facts. When a synthetic voice is present it suggests disclosing the video as containing AI-generated or altered content; otherwise it says that animation usually needs no disclosure and that the decision rests with the uploader. It leans towards disclosure on purpose, because the platform facts here are SECONDARY or were read on one date, and it says that it is not legal advice (decided: `lld/11` section 18, C:M6-O7c). Its wording is a proposal, and the user may reword it (decided: `lld/11` section 18, L16). The delivery profile's own `ai_disclosure` field, which only a human writes, holds the platform disclosure label and the suggested disclosure text for upload for that output (decided: `lld/11` section 18, L24, L37).
2. **Off by default, switchable per film (decided by the user, U10):** a visible notice for synthetic voices. It can be switched on for one film. The switch is `quality_intent.disclosure.visible_notice`, a `human` field, not a delivery-profile field; this corrects U10's wording. Turning it on before the notice overlay exists reports R4's `CAPABILITY_BLOCKED`, naming the notice, so a switched-on notice is never dropped silently; the overlay is not on the thin-film path (decided: `lld/11` section 18, L16). When it is built, its form is a fixed caption line on the existing trusted caption layer, which leaves the film's length, and so any `duration` hard constraint, unchanged; its wording is for the user to approve (decided: `lld/11` section 18, C:M6-O7b).
3. **Off (decided by the user, U7):** an embedded C2PA manifest, added by a finishing step **before** the final-file checks, because signing changes the file's bytes. F-08 validates it. On 15 November 2026 the user decided against embedded signing, so spike `R9-6` is not run. Turning it on later would be a change to that decision and would need a trust-list certificate, a key held outside the Space directory behind a callback or remote signer, a rule mapping each film to a source type, and acceptance of permanent platform AI labels.

Whether Cutroom is a "provider" under Article 50 is a legal question left open here.

## 4. Failure handling

| Failure | Handling |
|---|---|
| **A known defect preserved in a provisional preview** (C11) | The preview stays stored and playable with the open finding in its records. The finding stays open until fixed or adjudicated, and reaches the deliverable record if it survives |
| **A final MP4 missing audio** (C11) | `film.mux` succeeds whenever FFmpeg exits cleanly and always returns its file, which F-01 and F-02 judge. F-02 fails: `blocked`, fault layer `encode`; `delivery_finalize` returns `HARD_CHECK_FAILED`. The Quality System quarantines the result, which permits one re-run of the mux from the cached video and master mix; all final-file checks re-run on the new file. A second failure leaves the state `blocked` with the diagnostic |
| A stale worker finishes after an upstream revision | Its result attaches when, and only when, the accepted plan still requests its work key. F-05 catches a stale chunk that reaches an export |
| A corrected fact | The claim's new version re-keys K-01 to K-04 and every P-07, A-01 and A-03 that reads the value; unrelated shots stay cache hits |
| A provisional scene bound changes | C-06, P-01 and P-02 re-key for the consumers of that region only |
| A cross-layer effect | Shot checks run on the composite; isolated-layer evidence cannot prove a composite property |
| A failed experiment is rolled back | Its bundles are kept and linked through `prior_similar`, so the same signature is recognised next time |
| The Reviewer returns invalid output or cites unseen evidence | Repair up to the limit, then `UNKNOWN` with the raw text kept. An uncited finding becomes a hypothesis |
| A Reviewer reply is cut off by the output cap | Retried once at R6's `reviewer.retry_output_factor` (2) times the cap; `UNKNOWN` if cut off again |
| The Reviewer is unavailable at T7 | F-07 is `UNKNOWN`: `blocked` for missing evidence, not for a defect |
| Probe data is missing, or a check crashes | `UNKNOWN`; rule T4 may request a targeted review |
| State, probe and pixels disagree | Fault layer `render` or `encode`; routed to rendering, not patched in the source. `artifact_quarantine` stops the cache serving the bad artifact again |

## 5. Named settings, calibration and metrics

Each setting has one owner. This table lists the settings this document owns; they form the content-hashed bundle `quality_settings@1`, which every validation and deliverable record pins. Every default is a starting value.

Override authority and ranges follow the shared rule in R3 §2.7 (G15); settings requiring `human` authority are marked below. A test may set any `human` setting inside its own temporary Space, acting with the `human` level there; the real Space is never touched by a test (decided: `lld/11` section 18, L8).

| Setting | Default | Calibrated against |
|---|---|---|
| `control.response_min_fraction` | 0.001 of pixels | Planted dead controls. ASSUMED |
| `component.min_distinct_frames` | 3 | S3's validator |
| `overlap.max_fraction` / `overlap.min_frames` | 0.15 / 3 | Share of P-01 findings dismissed |
| `text.min_size_du` / `text.caption_min_size_du` | 36 / 48 | Legibility ratings on a phone |
| `contrast.min_ratio` / `contrast.large_min_ratio` / `contrast.large_du` / `contrast.bg_percentile` | 4.5 / 3.0 / 66 / 5 | The same ratings |
| `occlusion.min_visible_fraction` / `occlusion.min_visible_ms` | 0.9 / 400 | Missed-event reports |
| `motion.jump_factor` / `motion.jump_min_du` | 6 / 40 | Planted jumps |
| `chart.geometry_tolerance_fraction` | 0.02 of the scale's pixel range | Planted wrong bars. ASSUMED |
| `black.min_s` / `freeze.min_s` / `freeze.noise` | 0.5 / 1.0 / 0.001 | Share of undeclared intervals that are real defects |
| `silence.noise_db` / `silence.min_s` | −50 / 1.5 | The same |
| `loud.tolerance_lu` | 1.0 (`human`) | Spike M1 |
| `stt.wer_max_take` / `stt.wer_max_final` | 0.10 / 0.15 | Spike R9-3 |
| `stt.short_take_words` / `stt.short_take_max_errors` | 10 / 1: a take of at most 10 script words passes with at most 1 word error (D5) (decided: `lld/11` section 18, L13). Ranges 1 to 30 and 0 to 5. `director` until A-01 joins the required set for delivery, then `human`, as thresholds of a hard check under G15 (b) (decided: `lld/11` section 18, L40) | Spike R9-3, at M5 |
| `sync.event_early_ms` / `sync.event_late_ms` | 40 / 60 | EBU R37 end-to-end limit |
| `sync.mux_early_ms` / `sync.mux_late_ms` | 5 / 15 (`human`) | EBU R37 per-stage limit; batch 2a |
| `final.match_psnr_min_db` / `final.match_samples` / `final.min_integrated_lufs` | 35 dB / 30 / −40 (`human`) | Real encodes |
| `regress.psnr_min_db` | 50 | S1 and S4: repeat renders 77 dB or better; different frames about 27 dB |
| `sheet.cell_px` / `sheet.max_cells` / `sheet.film_interval_s` | 360×640 / 16 / 2 | Spike R9-4 |
| `sheet.strip_spacing_ms` / `sheet.strip_max_cells` (event-centred strips) | 100 / 12 | S6: acting visible at 120 ms in 12 cells |
| `sheet.frame_strip_cells` (consecutive-frame strips) | 18 | Batch 2c: the length tested |
| `clip.inspect_window_s` / `clip.sample_fps` | 3 / 5 | Batch 2c |
| `review.trigger_t2` … `review.trigger_t8` | on | Findings per call, by rule |
| `review.final_max_unseen_gap_ms` | 1000 (`human`) | Defects missed by final reviews |
| `review.hard_proof_votes` | 3 (`human`) | Share of split votes |
| `review.max_calls_per_film` / `review.max_calls_per_cycle` / `review.max_retrievals` / `review.max_output_repairs` | 50 / 6 / 6 / 2 | Cost per useful finding |
| `revision.max_cycles_per_finding` / `revision.max_cycles_per_film` / `revision.same_signature_limit` | 2 / 6 / 2 | Findings resolved per cycle |
| `stop.max_polish_cycles` / `stop.no_gain_cycles` / `stop.time_soft_limit_min` / `stop.polish_budget_fraction` | 2 / 1 / 150 / 0.15 | Gain per polish cycle |
| `notify.summary_max_tokens` | 200 | Director context use |

**Settings that checks read and other stages own** (the draft's copies are removed): R2's `validation.sample_times`, `validation.order_independence_min_psnr_db` and `probe.stride`; R4's `staging.tolerance_du`, `staging.anchor_tolerance_du` and `staging.handoff_tolerance_du`; R5's `budget.delivery_reserve_usd`, the single delivery reserve; R6's `author.*` (the one author repair loop) and `reviewer.*`, including `reviewer.retry_output_factor`; R7's `captions.*`, `delivery.audio.loudness_lufs`, `delivery.audio.limit_dbtp`, `delivery.audio.verify_max_dbtp` and `research.min_sources_for_numbers`; and the delivery profile's safe zones (R1 §3.5).

### 5.1 Calibration plan

1. **At the milestones R10 names:** spikes R9-2 to R9-4 replace the paper defaults they cover.
2. **Planted-defect set** (owned with R10): clean components and shots from all six domains with seeded defects, from overlap and low contrast to a dead control, a wrong bar, a wrong word and missing audio. It gives recall and false-alarm rates per check and per review evidence type, and is re-run on every settings change.
3. **First ten films:** the user rates a sample of findings as right or wrong, lists defects the system missed, and rates text legibility on a phone.
4. **Changing a value:** only as a new settings version with its evidence recorded, after re-checking stored artifacts under it. Nothing tunes itself in v2. Review points are after 10 and 30 films.

### 5.2 Metrics logged from day one

- **Per check:** runs, verdict counts, duration, cost and each finding's fate (fixed, dismissed, accepted). The dismissal rate is the first false-alarm signal.
- **Per review:** trigger rule, model, tokens, latency, cost, output repairs, cut-off replies, uncited findings and coverage. Reviewer recall on the planted-defect set is a calibration metric.
- **Per repair:** attempts per failure signature, success by attempt number, escalations and regressions.
- **Per film:** the completion-state timeline, cycles, budget at each transition, time to first preview and to delivery, and defects a person found that the system missed.

## 6. Cross-domain check

| Domain | Checks that carry the load | Gap or caution |
|---|---|---|
| Historical comedy | P-06 finds the prop jump; P-11 measures a hand-off; P-05 a hidden reaction; event strips show a double-take or handoff frame by frame; C-07 finds a dead acting control | Whether a pause is funny needs sound (D10). Deliberate holds must be declared or M-02 flags them |
| Science documentary | K-01 to K-03 bind claims and footage identity; R-01 and K-05 are hard; a corrected source re-keys diagrams, labels and narration together | K-03 is only as good as the source record |
| Art history | P-08 reprojects anchors after a crop change; R-01 demands the original hash and crop mapping; P-04 handles text over a painting | What a painting depicts is K-03's question, not a probe's |
| Software tutorial | P-07 checks callout text; P-09 ties cursor events to narration; M-02 expects long static screens; S-01 re-runs the capture assertions before delivery | A failed S-01 is repaired by R7's recapture |
| Data reel | K-02 compares rendered and spoken figures with the claim values they are bound to; K-04 compares bar geometry with the scale | A chart that reports no `data.value` or `scale` gives `UNKNOWN` |
| Abstract motion graphics | P-09 checks accents against the beat grid; waivers cover intended black, overlap and stillness | Few named elements, so strips, clips and the film review carry more weight |

## 7. Decisions that differ from the first working draft

1. **Clips** are split into real-time clips, for pacing only, and optional slowed inspection clips, because MiniMax caps `fps` at 5.
2. **Contact sheets** are kept for layout and continuity. Frame-level questions, acting and event timing go to dense strips.
3. **Sync tolerance (R1 §1.8)** keeps 40/60 ms for perceived sync and adds 5/15 ms for the mux offset. R1 Revision 1 records both.
4. **Speech-to-text** also runs on each voice take, because a bad take found only in the final file wastes every render made in between.

Everything else follows the [integration decisions](11-integration-decisions.md).

## 8. Claims table

| Claim | Label | Evidence or consequence |
|---|---|---|
| WCAG formulas and thresholds; FFmpeg filter options and ffprobe fields; MiniMax-M3 video input and `asr-1.0` price and limits; EBU R37 sync limits (40/60 ms end to end, 5/15 ms per stage) | VERIFIED by source | Linked in D4 to D6, 3.1 and 3.2. The EBU figure closes R1's ASSUMED claim |
| WCAG "large text" is about 66 design units | ASSUMED | If wrong, only the large-text threshold moves |
| Probes are affordable on every frame | VERIFIED by spike | S4: under 1 ms per frame |
| Same-history renders are byte-identical; a different history costs about 82 dB, so 50 dB separates "same" from "changed" | VERIFIED by spike | S1, S1c, S4 |
| Stream-copy joins keep the exact frame count and equal stream durations | VERIFIED by spike | Segment-join check; supports F-01 and M-05 |
| Passing the load-and-seek ladder does not make a component usable; a sampled "frames differ" test gives false alarms | VERIFIED by spike | S3: at least 7 of 72 passing components visibly broken; one false alarm |
| A response test finds dead controls but cannot judge a pose; acting is visible at 120 ms spacing and invisible in 12 evenly spaced frames | VERIFIED by spike (limited) | S6: five characters, one brief, stills only; arms wrong on 2 of 5 still passed |
| M3 finds visible defects on a sheet, with errors | VERIFIED by spike (limited) | S2: two of five sheets checked. S6: agreed with inspection on 12 of 15; one false positive in ten |
| Validated tool output works without a schema mode; a fixed prompt prefix is cached | VERIFIED by spike | S5: 99.0% schema-valid, for fully typed inputs only (batch 3; R6 D7); about 99% of input cached from the second turn |
| Adaptive thinking finds about two thirds of visible defects, with false ones, at about nine times the cost of thinking off | VERIFIED by spike (limited) | Batch 2c, one adaptive pass (section 3.2). Closes R6's `R6-S7` |
| A whole-film review judges accurately whether the film communicates what it must | ASSUMED | No evidence covers film-level judgement. Spike R9-7, on real reels at M6 |
| Probe checks find the defects S3 saw with few false alarms | ASSUMED, critical path | Spike R9-2. If wrong, the look of review rule T1 carries component quality alone |
| R2's diagnostic capture modes work on DOM and SVG elements | ASSUMED, critical path | Not run in S4. Spike R9-2. If wrong, P-01 and P-05 stay hypotheses and P-04 estimates the background from the composite |
| A dense still strip finds a single-frame defect more often than a slowed clip, and a real-time clip never does; every form gives false alarms | VERIFIED by spike (limited) | Batch 2c, synthetic clips with large defects (section 3.2). Closes R9-1 |
| MiniMax video input: `fps` placement, default rate and token cost (section 3.2) | VERIFIED by spike | Batch 2c |
| WER on a correct take is below 0.10, and below 0.15 over music | ASSUMED | Spike R9-3. If wrong, thresholds move, or A-02 runs on the dialogue stem. Spike V1, Whisper `small.en` on dry Kokoro takes: 1.6% normalised overall, but 0.08 to 0.30 on correct short lines with numbers, times, abbreviations and names, hence the one normaliser and the short-take rule (D5, L13) |
| Cross-correlation on audio decoded with the edit list applied measures the mux offset to one sample, and the real offset is 0 | VERIFIED by spike | Batch 2a, also on a three-segment join. Closes R9-5 |
| The colour chain keeps pixel values within 1 level and writes all four colour tags; decoded AAC audio is 256 to 512 samples longer than the mix | VERIFIED by spike | Batch 2a (F-01) |
| A 1.0 LU check tolerance and a −1.0 dBTP ceiling suit static-gain masters after AAC encoding | VERIFIED by spike (limited) | Spike M1, three synthetic mixes: −14.05 to −14.37 LUFS and at most −2.29 dBTP after AAC |
| C2PA tools run on Linux and support MP4, and a conforming product needs a trust-list certificate; YouTube labels C2PA content irreversibly; EU AI Act Article 50 text and date | VERIFIED by source | Signing from Node is untested; spike R9-6 is not run, because signing is off (U7). TikTok is SECONDARY. Whether Article 50 binds Cutroom is undetermined |

## 9. Spikes wanted

R9-1 and R9-5 are closed. The other four keep their numbers, with methods narrowed to what is still unknown, and R9-7 is new. The unified register is in the R10 document, which names the milestone for each.

| ID | Claim | Method |
|---|---|---|
| R9-1 | **Closed** by batch 2c | M3 sees most frames of a slowed clip, not all; a 3-second window costs about 15,750 input tokens (section 3.2) |
| R9-2 | Probe checks find planted defects with few false alarms; the diagnostic captures work; two-capture contrast is right | Plant overlap, safe-zone, contrast, occlusion, jump, dead-control and wrong-bar defects in the S3 and S6 components; run the probe checks and the hide and tint captures on DOM and SVG, and confirm `DIAG_UNSUPPORTED` on Canvas; count hits and false alarms; compare D4 with hand-measured contrast |
| R9-3 | WER thresholds and word-time accuracy | Synthesize 10 lines; transcribe dry and over music, then with planted word and number swaps; calibrate the normaliser, `stt.short_take_words` and `stt.short_take_max_errors` on short lines with numbers, times, abbreviations and names (L13). Cap $0.50. The word-time half is the same M5 measurement as `R7-A2` and is run once, with it (K3): the takes' aligned word starts against signal onsets after pauses, not against transcript word times, which are less accurate than the aligner's (decided: `lld/11` section 18, L11) |
| R9-4 | Reviewer recall and false alarms by evidence type, on real renders | Batch 2c gave a baseline on whole sheets and synthetic clips. Still open: 20 real shots with known defects; compare sheet only, with crops, and with an event strip; count hits, false and uncited findings. Cap $2 |
| R9-5 | **Closed** by batch 2a | F-03's method measured 0 samples on an unshifted mux and recovered +20 and −50 ms exactly |
| R9-6 | C2PA signing in the pipeline | **Not run,** because the user decided against embedded signing (U7). If signing is ever turned on: sign an exported MP4 with the test certificate; confirm the hard final-file checks still pass and the manifest validates |
| R9-7 | A whole-film review judges a real reel accurately | Whole-film reviews of real reels, at M6 |

## 10. Decisions for the user

The user decided both on 15 November 2026 ([integration decisions](11-integration-decisions.md) section 17.1). Each can be changed later by the user; a change is recorded as a revision.

1. **Should anything listen to the audio?** No MiniMax model accepts audio. Either voice performance, music fit and comic delivery stay `UNKNOWN` and are stated as a limitation of v2, or a second provider with audio input is approved for the `AudioReviewer` slot. This decides whether comedy timing can be reviewed at all. **Decided (U3):** nothing listens, and no second provider with audio input is added. Voice performance, music fit and comic delivery stay `UNKNOWN` and are listed as a limitation on every deliverable; the speech-to-text and loudness checks still run.
2. **AI-content labelling and C2PA.** Keep embedded C2PA signing off, or turn it on. Turning it on needs a trust-list certificate, and YouTube then applies an AI label that cannot be removed. Also: should a visible notice for synthetic voices be the default? The position under EU AI Act Article 50 needs someone qualified. **Decided:** no embedded C2PA signing, so `R9-6` is not run (U7); no visible on-screen notice by default, and it can be switched on for one film (U10) through `quality_intent.disclosure.visible_notice`, not a delivery-profile field (decided: `lld/11` section 18, L16). The disclosure record and sidecar are always written.
