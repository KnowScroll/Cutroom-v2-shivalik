# Cutroom v2 — Implementation · Milestone M6: Quality and Delivery

**Written:** 15 November 2026
**Status:** Build plan; it adds no design. Shape: [conventions](../01-repo-and-conventions.md) §7–8.

Short names: R2 `lld/03`, R3 `lld/04`, R4 `lld/05`, R5 `lld/06`, R6 `lld/07`, R7 `lld/08`, R9 `lld/09`, R10 `lld/10`; identifiers such as FR1, G19, K11 and U3 are rows of `lld/11`. Evidence: "b2c" is `research/evidence/b2c-minimax-review.md`, "log" `research/10-spike-evidence-log.md`. **Signatures and function names here are illustrative unless the design fixes them;** persisted names are the design's.

## 1. Goal

R10 §4.2: M6 builds "probe checks; diagnostic captures; Reviewer protocol including the blind treatment comparison; completion state; the rights rule table seeded for authored-only films; `delivery_finalize`; deliverable record". It is done when "**the thin film is complete:** the data-reel brief goes from brief to a delivered file with its record, autonomously, after comparing at least two treatments. Cases A6, A8, A10, A12, A13 and A14 pass. The first cost and time measures are taken. For each golden brief, the hard constraints the Director derives, as printed in the deliverable record's `brief_constraints` field (R9 §3.7, K11), are compared with the brief's expected constraints (G19)."

User decisions bind it: nothing listens to the audio, so voice performance and music fit are `UNKNOWN`, a limitation on every deliverable (U3); no embedded C2PA, so F-08 is not built and `R9-6` not run (U7); no visible AI notice by default, with a per-film switch, `quality_intent.disclosure.visible_notice` (U10, its wording corrected by L16). The voice is Kokoro-82M through OpenRouter, pinned to one provider, so every take is `aligned` (U17, U18, L12); A-02's word-level sync part reports `UNKNOWN` with a coverage record (L11). **After M6 the build stops and waits for the user** ([orchestration](../00-orchestration.md) §7; U14).

## 2. Provides to later milestones

- **`packages/quality`:** section 4's M6 checks; `completionState`; the required-evidence table (C:C1.3); the comparison record; `buildDeliverableRecord`, `briefConstraints`; the Reviewer protocol (`buildBundle`, `contactSheet`, `eventStrip`, `frameStrip`, `crop`, `realTimeClip`, `inspectionClip`, validator, coverage); T2 to T9 with hard-proof voting by strict majority (C:C1.6).
- **`packages/render`:** diagnostic modes `hide`, `isolate`, `tint`; `DIAG_UNSUPPORTED`; `DIAGNOSTIC_IN_DELIVERY`.
- **`packages/harness`:** the Reviewer role; tools `review_request`, `evidence_view`, `submit_findings`, and `delivery_finalize` as the designed chain; `research_request` and `submit_research` in their brief-only form, to which M8 adds the web tools (C:M6-O2).
- **`packages/studio`:** the rights state machine and rule table, seeded for authored-only films and Kokoro speech (C:M6-O6a, L14); the quote check for `user` sources (C:M6-O2).
- **`packages/project-core`:** every Quality Intent write rule; the brief's `user` source (C:M6-O2).
- **`packages/compiler`:** the `CAPABILITY_BLOCKED` guard for a switched-on visible notice (L16).
- **Tests and tools:** six golden briefs with expected constraints; the planted-defect set, which M11 extends; `tools/measures`.

## 3. What must already exist

- **M5:** everything in M5 §2; the keys in `C:\Users\XZNON\cutroom-v2\.env` (U23).
- **M1:** `stillRender` (as `still.render`), the probe sidecar format, rungs and `RungBundle`, `filmConcat` and `filmMux` (as `film.concat`, `film.mux`), `LINT.CLAIM_BOUND_CANVAS`.
- **M2:** kinds `quality_intent`, `brief`, `decision`, `treatment`, `claim`, `source`; field write levels, including one-time `from_brief` creation; `restore`; `rights_closure`; `system_write` with the module actors (B:O11); grades, `quality_declarations`, the execution part, after-render staging codes (R4 D9).
- **M3:** budget scopes, the delivery reserve (`budget.delivery_reserve_usd`), the hard cap, `quarantine`, the `event` table's `subscribe`; the check runner (`register_check`, which declares `proves`, B:O9) behind `check.run`; the `evidence` table and `closure_hash` (M3-07; L5).
- **M4:** the Director loop with the treatment phase first; `treatment_propose` and `submit_treatments`, whose pairwise differences sit in the worker's evidence bundle (C:C1.2); `component_author` with the T1 look; the contact-sheet and event-strip builders in `packages/render` (A:M1-2); `subloop.run`; `evidence_read`; `director_report_blocked` writing a `decision` (C:M4-O10b); `cutroom new` creating the primary `delivery_profile` (C:M4-O10a); the staged `delivery_finalize`, which M6-09 replaces (C:C1.1, L23); segments with working notes (J8); record-and-replay; the abstract golden brief.

A missing item is added first or stubbed. Every point the plan raised is resolved (section 9).

## 4. The check catalogue: what M6 builds and what waits

| Check | Built at | Note |
|---|---|---|
| C-00 to C-05, C-08, C-09 | Ladder functions at M1, run through `check.run` from M4 | Assumed from M1 and M4 |
| C-06 | Component scope at M1 and M4; shot scope M6-01 | |
| C-07 | Ladder function at M1; probe expectations at M7 | Needs the controls vocabulary |
| P-01, P-05 | M6-01, decided by M6-02 | Hypotheses until a tint capture |
| P-02, P-03, P-06, P-07, P-09, P-10 | M6-01 | |
| P-04 | M6-02 | Two captures |
| P-08 | M6-01 files R4's `ANCHOR_DRIFT` | First real subject: annotated media, M9 |
| P-11 | M7 | Hand-offs |
| M-01, M-02, M-05 | M6-03 | |
| M-03, M-04, A-01, A-02, A-03 | M5 | A-02's word-level sync part reports `UNKNOWN` with a coverage record (L11); A-01 uses M5-09's normaliser and short-take rule (L13) |
| R-01 | M6-04a, authored-only seed with the Kokoro speech entry (L14) | Media rules M9 |
| K-01 | M8; its `user`-source part at M6-04b (C:M6-O2) | |
| K-02, K-04 | M8 | Charts and bindings |
| K-03 | M8 (claims), M9 (media) | |
| K-05 | M9 | Identity |
| S-01 | M10 | Capture |
| F-01, F-02, F-03, F-09 | M5 | |
| F-04, F-05 | M6-03 | |
| F-06 | M6-04a | Evaluates `duration`, `aspect` and `language` itself (C:C1.5) |
| F-07 | M6-07 | |
| F-08 | Not built | Corrective, not hard (L28). U7: with embedded labelling off it has no subject, so it is not required |

## 5. Dependency sketch

```
M5 ─► M6-01 ─► M6-02 ─► M6-03 ─► M6-04a ─► M6-04b ─► M6-05 ─► M6-06 ─► M6-07 ─► M6-08 ─► M6-09 ─► M6-10 ─┐
                                   │                                    └──► M6-12 ──────────────────────┤
      M6-11 (files from the start; live derivation after M6-04b and M6-08) ─────────────────────────────┴─► M6-13
```

M6-01 to M6-09 all touch `packages/quality` and run in order; M6-11 and M6-12 change only tests and tools.

## 6. Work packages

### M6-01 — Probe checks

- **Care:** normal
- **Package:** `packages/quality`
- **Depends on:** M5 done     **Parallel with:** M6-11 (files)
- **Live calls:** none

**Goal.** Probe checks run on sidecars at component and shot scope, with R4's after-render codes filed under them.

**Read first.** R9 D3; §3.1 (rows C-06, P-01 to P-10, and its notes); §5; R2 §2.4; R4 D5 ("Quality declarations"), D9; F8, G5.

**Build.** A sidecar reader; C-06 at shot scope; P-01, P-02, P-03, P-05 to P-10; component-scope C-06, P-03 and P-10 inside validation.

**Rules that are easy to get wrong.**
- C-06 on a conservative footprint and P-07 are definitive from probes. P-01 and P-05 only nominate frames and never `FAIL` from probes, because rectangles over-estimate overlap; M6-02 decides them (R9 §3.1).
- `PROBE_MISSING` gives `UNKNOWN`, severity `note`. `FOOTPRINT_EXCEEDED` files under C-06, `ANCHOR_DRIFT` under P-08, `AVOID_REGION_ENTERED` under P-01, with R4's code in `origin.code`. A `PASS` resting on `kind: canvas` items says so in coverage.
- P-09: no probe binding gives `UNKNOWN`; a correct pair has no planned offset. P-06 ignores declared events. Waivers cover observational checks only (R9 §3.4).

**Tests.** On sidecar fixtures: 20% of the smaller box for 3 frames nominates P-01, 10% does not; text at 30 du or a caption at 46 du fails P-03; text 1 du outside the safe region fails P-02; a jump of 7× the local median and 50 du is P-06, but not at a declared event; P-07 fails "4.2" against "4.20"; a missing probe gives `UNKNOWN`; P-09 passes 50 ms late, finds 70 ms late, and is `UNKNOWN` without a binding.

**Done when.** `npm run check` and `npm test` pass.

**Out of scope.** Pixel confirmation and P-04 (M6-02); P-11, K-02, K-04.

### M6-02 — Diagnostic captures, contrast and confirmation

- **Care:** normal
- **Package:** `packages/render`, then `packages/quality`
- **Depends on:** M6-01     **Parallel with:** M6-11
- **Live calls:** none

**Goal.** Three diagnostic modes work; P-04 measures contrast from two captures; tint captures decide P-01 and P-05.

**Read first.** R2 §2.16, §2.4 ("Strength of evidence"), §2.13 (V5); R9 D4; §3.1 (rows P-01, P-04, P-05; note "Which probe checks are definitive"); R6 D4 (row `render_request`); F25, H3, FR15, §13 #29.

**Build.** A `diagnostic` parameter (`hide`, `isolate` or `tint`, with a target) on `chunk.render` and `still.render`; `DIAG_UNSUPPORTED`; `DIAGNOSTIC_IN_DELIVERY` in `film.concat` and `film.mux`; P-04; the tint decision.

**Rules that are easy to get wrong.**
- The parameter changes the work key; chunk results carry `diagnostic`; the `final` rung refuses it; concat and mux reject a diagnostic segment (R2 §2.16; §13 #29).
- Hide and tint on a Canvas mark return `DIAG_UNSUPPORTED` at once, from `meta` (H3), leaving P-01, P-04 and P-05 `UNKNOWN`. Isolation works for every technique.
- P-04 uses WCAG's formulas exactly, the probe's text colour, and the hide capture's background pixel at the 5th percentile nearest the text. Large text starts at 66 du (ASSUMED). Component text over transparency is `NOT_APPLICABLE` (D4).
- A capture that cannot run gives `UNKNOWN` with a hypothesis, never `PASS`; a tint `FAIL` is `material`.

**Tests** (`npm run test:render`, known-pixel DOM and SVG fixtures). Hide removes exactly the element's pixels; tint colours exactly its visible pixels; isolate shows one layer; Canvas gives `DIAG_UNSUPPORTED`; the `final` rung refuses; muxing a diagnostic segment gives `DIAGNOSTIC_IN_DELIVERY`. White on #777777 gives 4.48 and fails 4.5; black on white gives 21.0. Overlapping boxes with disjoint pixels pass P-01 after tinting.

**Done when.** The render tests pass.

**Out of scope.** M1's half of `R2-S12`.

### M6-03 — Film detectors and lineage checks

- **Care:** normal
- **Package:** `packages/quality`
- **Depends on:** M6-02     **Parallel with:** M6-11
- **Live calls:** none

**Goal.** M-01, M-02, M-05, F-04 and F-05 run on assembled and exported films.

**Read first.** R9 D3; §3.1 (rows M-01, M-02, M-05, F-04, F-05; FFmpeg note); §4; R4 D5; R2 §2.12; FR14, §13 #11–12.

**Build.** The five checks over FFmpeg's `blackdetect` and `freezedetect`, ffprobe timestamps, sampled frames and the plan's execution part.

**Rules that are easy to get wrong.**
- M-05 checks each chunk's exact frame count and uniform timestamps in the joined file. There is no PSNR across seams (FR14).
- M-01 and M-02 compare detector output with the declared black, holds and expected motion; waivers apply.
- F-05: every work key in the delivered file's lineage is requested by the accepted plan's execution part, the consumer records the accepted revision, and grade and rung are both `final`. A stale chunk that reaches an export fails here (R9 §4).
- F-04 compares 30 sampled exported frames with the accepted render at 35 dB or more.

**Tests.** An undeclared 0.6-second black is an M-01 finding; a declared one is not. A 1.2-second freeze in expected motion is M-02. A 149-frame chunk planned at 150 fails M-05. One shot from another render fails F-04. A work key absent from the plan, or grade `preview`, fails F-05.

**Done when.** `npm test` and the render tests pass.

**Out of scope.** Sync checks (P-09 in M6-01; F-03 in M5).

### M6-04a — Rights rule table, Quality Intent rules, R-01 and F-06

- **Care:** normal
- **Package:** `packages/studio` (rights), `packages/project-core` (Quality Intent rules), `packages/quality` (R-01, F-06)
- **Depends on:** M6-03     **Parallel with:** M6-11
- **Live calls:** none

**Goal.** The seeded rights table writes `rights.status`; Project Core enforces the Quality Intent rules; R-01 and F-06 run, F-06 evaluating `duration`, `aspect` and `language` itself.

**Read first.** R7 §2.1, §2.4; R2 §8 (font licences); R3 §2.2 (`quality_intent`), §2.4 (stage 7), §2.7 (write levels, "Quality Intent (G19)"), §2.10; R9 D1, §3.4 ("Rules enforced on write"), §3.1 (R-01, F-06); R4 D4, D2; FR1, G11, G12, G15, G19, G21, U4, U17, §13 #6, #33, and §18 of `lld/11`: L3, L14, L32, C:C1.5, C:M6-O6a, B:O9, B:O10.

**Build.** The rights state machine and rule table with the seed below; the Quality Intent write rules; R-01 and F-06, each registered through `register_check` with the constraint kinds it `proves` (B:O9).

- **The seed** adds, in the form R7 §2.4's starting rules take (C:M6-O6a): OFL-1.1 is `eligible` (every pinned font; R2 §8 records them as OFL 1.1, VERIFIED for the linked families and ASSUMED for the rest); MIT and Apache-2.0 are `eligible` (trusted libraries such as PixiJS 8.23.0); a system-generated origin is `eligible` with no attribution, covering code-rendered music and procedural effects made by a registered engine, whose licence R7 §2.1 already requires to allow commercial use. CC0 samples are already `eligible`.
- **Kokoro speech** (L14): an entry makes Kokoro-82M speech through the pinned provider (`voice.provider_only`) `eligible`, on the basis of the model's Apache-2.0 licence (research 11 §5.1). It covers the stock `voice_profile` and each take's audio asset (C:M6-O6b). That the provider's terms place no further limit on the output is ASSUMED, and the M6 report states it to the user.
- **F-06 by kind** (C:C1.5). F-06 passes when the proof of every Quality Intent hard constraint is `PASS`: for `{by: check, check: X}` with X other than F-06, X's validation record on the exported file or its closure; for `{by: reviewer, …}`, M6-07's vote verdict; for `{by: check, check: "F-06"}`, allowed only for kinds `duration`, `aspect` and `language`, F-06 evaluates the constraint itself from the exported file and the plan. The `params` shapes are `duration` `{max_s?, min_s?}`, compared with the file's duration N·T; `aspect` `{w, h}`, compared with the file's displayed width and height (ffprobe, with the sample aspect ratio); `language` `{code}`, compared with the `language` of every `voice_line` and `caption_track` in the closure. So F-06 registers `proves: [duration, aspect, language]` and R-01 `[rights_scope]`; K-01 registers `[essential_claim]` in M6-04b (B:O9).

**Rules that are easy to get wrong.**
- Only the rule table writes `rights.status`, through the rights module's actor; a model never sets it (FR1). Six states; `unresolved` clears only by a human decision or substitution. Delivery needs `eligible`; promotion is unaffected.
- The fields `RIGHTS_FIELDS_REQUIRED` requires per status are the starting rule of B:O10; seeding the table confirms or corrects it, and the result is recorded (L3).
- R-01 covers every asset, font, library, sample and voice profile in the closure, with original hash, crop or trim, and attribution (§13 #6).
- A brief-derived constraint is created once per key, `from_brief` stamped by code; any later Director patch is `FIELD_AUTHORITY`, even a strengthening one (G11). An uncovered key gives `BRIEF_CONSTRAINT_UNCOVERED` (G19).
- `settings_overrides` may name only R9 `director` settings, in range, unless a human wrote them (G21). Waivers cover observational checks only; `disclosure` is `human` (G12).
- **Proofs on write** (stage 7, through the `CheckCatalogue`). Where a registered check proves the constraint's kind, a `by: reviewer` proof is refused with `PROOF_REQUIRED`, `expected` naming those checks (D7; B:O9). A proof that names a check absent from the installed catalogue, or names F-06 for a kind other than the three, is refused when the Quality Intent is written (C:C1.5); a proof naming an unregistered check gets Project Core's `UNKNOWN_CHECK`, with the nearest registered checks (L32; R3 §2.4). Every other kind maps onto a check that exists, or takes a reviewer proof: `rights_scope` R-01, `essential_claim` K-01, and `must_include`, `must_not_include` and `custom` a named check where one proves the constraint (C:C1.5). No new check ID is added.
- F-06 passes only when every hard constraint's proof is `PASS`; a reviewer proof takes M6-07's vote. Where M2 already enforces a rule, add tests only.

**Tests.** CC0, public-domain marks and CC BY are `eligible`; CC BY-SA is `restricted` while `rights.share_alike_ok` is false (U4); non-commercial is `restricted`; unknown is `unresolved`; OFL-1.1, MIT, Apache-2.0, a system-generated origin and Kokoro speech through the pinned provider are `eligible`, the last only through that provider. A Director patch to `rights.status` is refused. R-01 fails on one `candidate` font. An uncovered key, a second write to a `from_brief` constraint, an override of `loud.tolerance_lu` and a waiver of F-09 are refused. A `by: reviewer` proof of a `duration` constraint gives `PROOF_REQUIRED`; a proof naming F-06 for `must_include`, or naming K-02, is refused on write, the one naming K-02 (not installed at M6) with `UNKNOWN_CHECK` (L32). F-06 fails when one proof fails; it fails a 61-second file against `{max_s: 60}`, a 16:9 file against `{w: 9, h: 16}`, and a `caption_track` in another language against `{code}`.

**Done when.** `npm run check` and `npm test` pass; the confirmed or corrected rights fields per status are in the pull request.

**Out of scope.** Media and identity (M9); the brief-only research path and K-01's `user` part (M6-04b).

### M6-04b — Brief-only research: the `user` source, the quote check and K-01's `user` part

- **Care:** normal
- **Package:** `packages/project-core` (the `user` source), `packages/harness` (`research_request`, the researcher sub-loop, `submit_research`), `packages/studio` (the quote check), `packages/quality` (K-01's `user` part)
- **Depends on:** M6-04a     **Parallel with:** M6-11
- **Live calls:** none

**Goal.** Figures that a brief supplies can become `supported` claims at M6, through the brief-only part of research, before M8 adds web research (C:M6-O2).

**Read first.** R7 §2.5; R6 D4 (rows `research_request`, `submit_research`), D6, D6.6; R3 §2.2 (`claim`, `source`), §2.7 (the `system` table); R9 §3.1 (K-01); FR1, FR5, K2, and §18 of `lld/11`: C:M6-O2, L15, L25, L26, B:O11.

**Build.** Project Core creates a `source` with `type: user` whose `snapshot` is the brief's `text`. `research_request` runs a researcher sub-loop whose grant holds only `submit_research`, with no `web_search` or `web_fetch`; its proposed claims quote the brief. R7's quote check writes `claim.support` and the `supported` status. K-01's part for `user` sources, registered with `proves: [essential_claim]` (C:M6-O2; B:O9).

**Rules that are easy to get wrong.**
- Only R7's quote check writes `claim.support` and the `supported` status (K2), through the `research` module actor (B:O11); the researcher proposes and never sets them.
- FR5 forbids literal figures in lines, so a figure reaches narration and screen through a supported claim; K-01 is hard for an essential claim.
- The data reel's figures are invented test data, labelled as such in its brief, with a source of type `user`; no real-world statistic is claimed (L15). No web research happens before M8: the brief-only research request reads claims and figures from the brief and makes no web call (L25). The data reel's real, verified figures are chosen by the M8 milestone document (L26).
- M8 adds `web_search` and `web_fetch` to this same path; nothing here is built twice.

**Tests** (replayed). A brief's `user` source holds its text as the snapshot; a researcher with this grant cannot call `web_search` or `web_fetch`; a claim quoting the brief exactly becomes `supported`; one whose quote is not in the snapshot does not; a Director patch to `claim.support` gets `FIELD_AUTHORITY`; K-01 passes on a supported essential claim and fails on an unsupported one.

**Done when.** `npm run check` and `npm test` pass.

**Out of scope.** Web research, `dataset_register` and K-02 (M8).

### M6-05 — Evidence forms and the pinned bundle

- **Care:** high
- **Package:** `packages/quality`
- **Depends on:** M6-04b     **Parallel with:** M6-11
- **Live calls:** none

**Goal.** An immutable, content-hashed bundle with every evidence form at the design's sizes, in cache order.

**Read first.** R9 §3.2 (from "Pinned bundle" to "Prompt structure"), D10, §5 (`sheet.*`, `clip.*`); R6 §3, D6.4, D13; b2c, spike 1; H6, §12.3, U3; report A's row A:M1-2.

**Build.** `buildBundle` and its manifest; the six evidence forms of section 2, built from `still.render` frames, the sheet and event-strip images coming from M4-11's builders in `packages/render` (A:M1-2); audio evidence; the prompt assembler.

**Rules that are easy to get wrong.**
- **The Reviewer gets a pinned bundle and dense still strips, not real-time video, for frame-level questions.** A real-time clip is for pacing only: it named the defect frame in 0 of 24 runs, an 18-frame strip in 22 of 24 (b2c; §12.3). A bundle never holds the Director's conversation; web text is fenced as untrusted (R9 §3.2).
- Sheet: 360 × 640 cells, 4 columns, up to 4 rows, labelled with frame, time and shot; each planned event and the frame before, then uniform fill; one frame per 2 s for a film. Event strip: 100 ms spacing centred on the interval, at most 12 cells. Frame strip: 18 consecutive frames (H6). Crops: full resolution, 15% padding. Inspection clip: at most 3 s, slowed by frame rate ÷ 5, `fps: 5`, frame numbers in a margin.
- `fps` goes inside `source`; elsewhere it is ignored (default 2), and above 5 is rejected (b2c). Images up to 10 MB, inline video up to 50 MB, requests up to 64 MB (R6 D13). Clips are silent H.264.
- Audio evidence: transcript, cue list, loudness per 3 s, silences, sync table; `audio_heard` is always false (U3; D10).
- Fixed order: role, rules, schema; brief and Quality Intent; questions; ground truth; evidence with IDs; earlier adjudicated findings.

**Tests.** The same inputs give the same manifest hash; no message rows reach a bundle. Events at frames 30 and 95 put frames 29, 30, 94 and 95 on the sheet. A 1.5-second event gives two strips. `fps` sits inside `source`. An oversize clip is refused before any call. Section order and the fence hold.

**Done when.** `npm test` passes; a reviewer has closed the review (care: high).

**Out of scope.** Running reviews (M6-06).

### M6-06 — Reviewer runtime

- **Care:** normal
- **Package:** `packages/harness`, `packages/quality`
- **Depends on:** M6-05     **Parallel with:** M6-11
- **Live calls:** up to 10 reviews, to record fixtures. Ceiling **$0.15**.

**Goal.** A read-only Reviewer sub-loop submits through `submit_findings`; the Quality System validates output and computes coverage from what was served.

**Read first.** R6 D4 (rows `review_request`, `evidence_read`, `evidence_view`), D5, D6.4, D7, §4, §5; R9 D7; §3.2 (from "Validated output" to "Models"); §4; H2, §12.3, J1, J10.

**Build.** The Reviewer role and sub-loop; `review_request`, `evidence_view`, `submit_findings`; the validator; coverage from the served log.

**Rules that are easy to get wrong.**
- **The Reviewer needs adaptive thinking:** MiniMax-M3, `reviewer.thinking` `adaptive`, output caps `reviewer.max_output_tokens` 16,000 (key `shot`) and 24,000 (key `film`); both settings are keyed by `shot` and `film` (A:M0-3). With thinking on it sometimes spent 8,000 tokens without answering, so a cut-off reply is retried once at twice the cap, then `UNKNOWN` (H2; §12.3).
- No mutating tool; an empty write scope (R6 D6.4). Coverage comes from the log of served evidence, never from the model (D7).
- The validator makes a `PASS` without its required evidence `UNKNOWN`; an uncited finding, or one outside served coverage, a hypothesis; an acting or timing question without a covering strip or inspection clip `UNKNOWN`. Seconds convert to flicks; submitted values are kept (R9 §3.2).
- At most 6 retrievals and 2 output repairs, then `UNKNOWN` with raw text kept. `submit_findings` is typed to every leaf, with no tight length limits; over-long text is truncated and recorded (J1; §12.3).

**Tests** (replayed). A valid submission is stored; an invalid one gets the exact error and is repaired; a third failure gives `UNKNOWN`. A cut-off reply is retried at 32,000, then `UNKNOWN`. A `PASS` without its strip becomes `UNKNOWN`; uncited and out-of-coverage findings become hypotheses. Coverage equals the served log. A patch from the Reviewer's actor gets `OUT_OF_SCOPE`. Live: up to 10 recordings.

**Done when.** `npm test` passes on replays; recordings and ledger lines exist.

**Out of scope.** When reviews fire (M6-07).

### M6-07 — Review policy: triggers, caps, votes, film scope and T9

- **Care:** normal
- **Package:** `packages/quality`; `packages/harness` (T9 in the treatment phase)
- **Depends on:** M6-06     **Parallel with:** M6-11
- **Live calls:** none

**Goal.** T2 to T9 fire within caps; reviewer-proved constraints take up to three votes, decided by strict majority; film reviews answer `must_communicate` and `key_aims`; F-07 and T9 run.

**Read first.** R9 D1; §3.3; §3.4 (last two paragraphs); §3.1 (F-07); §3.5; §3.6 ("Adjudication"); §4; §5 (`review.*`); R6 D2, D6.4, D6.5 ("Fair comparison"); FR2, FR3, FR4, G1, G2, G13, and §18 of `lld/11`: C:C1.6.

**Build.** The trigger policy with `review.trigger_*` and caps; hard-proof voting; film-scope question sets; F-07; T9.

**Rules that are easy to get wrong.**
- Deterministic checks run first; a review needs a firing rule and room in the caps (50 per film, 6 per cycle). T1 is outside the caps; T7 is always on, paid from the delivery reserve. Label, styling or in-range non-acting control changes with checks passing fire nothing.
- **A reviewer-proved hard constraint takes up to `review.hard_proof_votes` (3, `human`) fresh reviews, decided by strict majority** (C:C1.6). A first `PASS` stands. After a first `FAIL` or `UNKNOWN`, up to `review.hard_proof_votes` − 1 further reviews run, each a fresh Reviewer sub-loop on the same pinned bundle (R6 D6.4), and they stop as soon as one value holds a strict majority of `review.hard_proof_votes`. The verdict is that value; with no strict majority (for example `FAIL`, `PASS`, `UNKNOWN`) it is `UNKNOWN`. A `NOT_APPLICABLE` answer counts as `UNKNOWN`, because a hard constraint applies by definition. `FAIL` or `UNKNOWN` leaves F-06 failing and the state `blocked`. The validation record keeps every vote, for G13's calibration of split votes. The Director cannot overrule; a human may adjudicate (FR4).
- **Votes on a proof evaluated at T7 belong to T7:** they sit outside the per-cycle cap and are paid from the delivery reserve, so a cap cannot block delivery; if the reserve cannot pay for them, the verdict stays `UNKNOWN` (R9 §3.3; C:C1.6).
- Each `must_communicate` proof is evaluated; `FAIL` or `UNKNOWN` is `material`, and hard only if the item is also a hard constraint. `key_aims` are the questions of T6, T7 and T9 (FR3).
- F-07 needs a review of the exported file answering every `must_communicate` question with a largest unseen gap of at most 1,000 ms; a film sheet alone (one frame per 2 s) cannot meet that, so T7's bundle includes the real-time clip. No Reviewer at T7 makes F-07 `UNKNOWN`, which blocks (R9 §4).
- T9 runs when there are two or more animatics: blind, labels randomised, no branch or treatment name in the prompt, a ranking with reasons (FR2, G13).

**Tests** (replayed). The firing matrix; no seventh review in a cycle. A first `PASS` ends the vote; votes `FAIL`, `PASS`, `PASS` give `PASS`; `FAIL`, `FAIL` decide after two; `FAIL`, `PASS`, `UNKNOWN` give `UNKNOWN`; a `NOT_APPLICABLE` vote counts as `UNKNOWN`; the record keeps every vote; votes at T7 do not count against the per-cycle cap, and with the reserve spent the verdict is `UNKNOWN`. F-07 on sheets alone is `UNKNOWN`, with the clip it passes. T9's labels vary between runs. A `must_communicate` `UNKNOWN` is a `material` finding.

**Done when.** `npm test` passes.

**Out of scope.** K-03; the `AudioReviewer` slot stays empty (U3).

### M6-08 — Completion state, comparison record and deliverable record

- **Care:** high
- **Package:** `packages/quality`
- **Depends on:** M6-07     **Parallel with:** M6-12
- **Live calls:** none

**Goal.** `completion_state` is computed; adjudications and comparisons are recorded; every export can get a deliverable record and disclosure sidecar.

**Read first.** `hld/02` B3.5; R9 D2, D8, D9; §3.1; §3.5 ("Regression comparison", "Promotion is not gated by checks"); §3.6; §3.7; §3.8 ("Three levels"); §5.2; R5 §2.10; R2 §2.9 ("Audio mux"); K11, G19, I19, U3, U7, U10, §10 #144, §13 #13, §14.4, and §18 of `lld/11`: C:C1.3, C:C1.4, L13, L16, L24, L28, L29, L37, C:M6-O7c.

**Build.** `completionState(candidate)`; the required-evidence table; `buildDeliverableRecord`; `briefConstraints`; the comparison record; per-film metrics (R9 §5.2); the suggested platform-disclosure answer in the disclosure sidecar. **The required-evidence table** is computed by code from the installed check catalogue (`quality_settings@1`) and the plan's closure (C:C1.3):

1. **Every hard check:** R-01; K-01 when an essential claim is in the closure; K-05; F-01 to F-07; F-09. Each must be `PASS`. A hard check whose scope has no subject in the closure is recorded `NOT_APPLICABLE` (K-05 with no `evidence` media need). F-08 is not in this list: the catalogue classes it corrective (L28), and with embedded labelling off (U7) it has no subject, so it is not required.
2. **Every check named by a hard constraint's proof** (F-06's inputs, C:C1.5), and the reviewer votes of C:C1.6.
3. **Every corrective check whose scope has a subject in the closure.** For the thin film: C-00 to C-05 and C-07 for each component, P-07 and M-05 for each shot, A-01 for each selected take, and M-04 and A-03 for the film. An open failure or an `UNKNOWN` among them gives `needs_material_revision`.
4. **The T7 review of the exported file** (F-07).

A check absent from the installed catalogue (at M6: K-02, K-03, K-04, P-11 and S-01) is not required; where its scope has a subject in the closure, `known_limitations` names it, for example "K-02 was not run: not in this build". Observational checks are never required.

**Rules that are easy to get wrong.**
- **The completion state is computed from system-written facts, never asserted:** a pure function of validation records, `system` fields, adjudications and settings, reading no Director-writable field as a gate (D9).
- **Only hard checks block delivery outright.** `blocked`: a hard check `FAIL` or `UNKNOWN`, or required evidence missing. `needs_material_revision`: an open `material` or `blocking` finding, or an open corrective failure, `UNKNOWN` included (D2). `deliver`: eligible, every hard final-file check (F-01 to F-07, F-09) `PASS` on the actual exported file, and a stop condition. **Calling `delivery_finalize` on an `eligible` candidate is a stop condition**, as is the automatic export when the budget runs out; the call is a fact in the audit log written by the harness, not a Director-writable field, so D9 holds (`hld/02` B3.5; C:C1.4).
- A-01 counts as required evidence only once M5-09's normaliser tests pass (L13, L29).
- Observational findings may be dismissed or accepted with a reason; corrective failures must be fixed or removed; hard checks cannot be adjudicated, except a reviewer-proved constraint by a human (§3.6).
- `delivered_with_limitations` means a material finding was accepted in place of a fix, or an adjudication was flagged after the working budget ran out. An unreviewed export is never delivered. Every export gets a record; only the two delivered states are ever reported as delivery (§13 #13).
- `brief_constraints`: one `{brief_key, statement, derived, proofs, verdict}` per brief hard constraint (K11).
- `known_limitations` always says voice performance and music fit were not heard (U3) and that players ignoring the edit list play audio 21.33 ms late (R2 §2.9), and names each required check not in the installed catalogue that had a subject (C:C1.3). `ai_disclosure` and its sidecar are always written; no C2PA (U7); no visible notice unless `quality_intent.disclosure.visible_notice` is on (U10; L16). That switch is not `delivery_profile.ai_disclosure`, a `human` field holding the platform disclosure label and the suggested disclosure text for upload (L24, L37).
- **The suggested platform-disclosure answer** (level 1, "Always on", R9 §3.8) is a fixed table in the disclosure sidecar, per delivery profile, derived only from the record's `ai_disclosure` facts. When a synthetic voice is present it suggests disclosing the video as containing AI-generated or altered content; otherwise it says animation usually needs no disclosure and that the decision rests with the uploader. It says it is not legal advice. The wording is the report's proposal, and the user may reword it (C:M6-O7c; L16).
- Records commit with `FULL` durability (§14.4), chain by `supersedes`, and protect their evidence from collection. The comparison lists resolved, new and unchanged findings, the hard-check difference and cost; frames outside the change scope match the baseline at 50 dB.

**Tests.** Table-driven over R9 §3.6; a corrective `UNKNOWN` gives `needs_material_revision`; a Director-writable change leaves the state unchanged; one record per state, with `brief_constraints` for a three-key brief; a comparison with one finding resolved and one remaining. The required-evidence table for a thin-film fixture lists exactly the checks of items 1 to 4; a hard check with no subject is `NOT_APPLICABLE`; a missing required record gives `blocked`; a closure with a bound chart names K-04 in `known_limitations` and does not require it; an observational check is never required. The disclosure sidecar suggests disclosure when a take is present, and not when none is.

**Done when.** `npm test` passes; a reviewer has closed the review (care: high).

**Out of scope.** Running the export (M6-09).

### M6-09 — `delivery_finalize`

- **Care:** high
- **Package:** `packages/harness` (tool), `packages/quality` (job chain), `packages/compiler` (the visible-notice guard)
- **Depends on:** M6-08     **Parallel with:** M6-12
- **Live calls:** none

**Goal.** `delivery_finalize(delivery_profile, expected_head)` runs the designed delivery chain, replacing M4's staged form, and ends with a deliverable record in the computed state.

**Read first.** R6 D2, D4 (rows `delivery_finalize`, `director_report_blocked`, `artifact_quarantine`), D8, D10, §4; R9 §3.3, §3.6 ("Budget"), §3.7, §3.8, §4; R4 D2 (`CAPABILITY_BLOCKED`); R2 §2.9, §4; R5 §2.7, §2.10; FR9, G9, H3, §13 #13, #29, and §18 of `lld/11`: C:C1.1, C:C1.3, C:M4-O10b, L16, B:M3-9-draw.

**Build.** Head check; inline `frozen` compile at grade and rung `final`; `plan_to_jobs(plan, "delivery")`; final chunks, concat, `audio.mix`, mux; the required-evidence table's missing records requested as `check.run` jobs, existing ones being cache hits and a record that cannot be produced `UNKNOWN` (C:C1.3); T7; `completionState`; record; sidecars (WebVTT, SRT, disclosure, credits). **The visible-notice guard:** a `final` compile with `quality_intent.disclosure.visible_notice` on raises R4's `CAPABILITY_BLOCKED`, naming the notice, until the notice overlay exists; the overlay is not on the thin-film path (L16).

**Rules that are easy to get wrong.**
- `STALE_BASE` and `NOT_READY` return at once; `HARD_CHECK_FAILED` and `DIAGNOSTIC_IN_DELIVERY` arrive as job results (H3).
- **The mux always returns its file and F-02 judges it.** On an F-01 or F-02 failure the Quality System quarantines the result through the Scheduler, permitting one mux re-run from the cached video and master; every final-file check re-runs; a second failure leaves `blocked` with the diagnostic and a record (FR9). No other hard failure re-runs by itself.
- **The delivery scope** (B:M3-9-draw). `delivery_finalize` opens a child budget scope `delivery` under the film root. Its jobs, the final export, the final-file checks and T7 with its votes (C:C1.6), may draw on `budget.delivery_reserve_usd` ($0.50). The Director session's own `model.call` jobs may draw on it once the film's other spend has reached `budget.hard_cap_usd` − `budget.delivery_reserve_usd`, or once the delivery scope is open, so the Director can still call `delivery_finalize` or `director_report_blocked`. No other job may. At the hard cap an eligible candidate still delivers, `needs_material_revision` exports as `incomplete`, and `blocked` leads to `director_report_blocked` (R9 §3.6).
- Production ends only with a delivered state or `director_report_blocked`; the tool result and CLI state `completion_state` and never call an incomplete or blocked export delivered (R6 D10). A `blocked` or `incomplete` record, or a hard failure on export, wakes the Director at once, and the Director repairs or calls `director_report_blocked` (R6 D2; C:C1.1). From here the `decision` that `director_report_blocked` writes also names the blocked export's deliverable record in `evidence` (C:M4-O10b).

**Tests** (replayed, `npm run test:render`). An eligible fixture is `delivered`; a moved head gives `STALE_BASE`; unready input gives `NOT_READY`. F-02 failing once leads to quarantine, one re-run and delivery; twice, a `blocked` record, the Director woken, and its `director_report_blocked` decision citing that record. At the cap, eligible delivers from the reserve; `needs_material_revision` gives `incomplete`; a job outside the delivery scope cannot draw on the reserve. A missing required record is requested as a `check.run` job; an existing one is a cache hit. With `visible_notice` on, the `final` compile gives `CAPABILITY_BLOCKED` naming the notice.

**Done when.** The tests pass; a reviewer has closed the review (care: high).

**Out of scope.** C2PA signing (U7); the visible-notice overlay itself, whose cheapest form when built is a fixed caption line on the trusted caption layer, worded with the user's approval (L16; C:M6-O7b).

### M6-10 — Acceptance cases A6, A8, A10, A12, A13 and the deterministic half of A14

- **Care:** normal. Written by a **test author** who implemented none of M6-01 to M6-09.
- **Package:** `tests/acceptance`
- **Depends on:** M6-09     **Parallel with:** M6-12
- **Live calls:** none

**Goal.** Each case's injection and observable from R10 §3.2 is an automated test.

**Read first.** R10 §3.2; R9 §3.5, §3.6, §4; R6 D2, D10; R5 §2.10; FR1, FR9, FR10, G2, G11, and §18 of `lld/11`: L8.

**Build.** A6: a preview with a clipped label is stored and playable with its finding; promotion succeeds. A8: a seam drops the audio; the mux job succeeds and returns its file, F-02 fails hard, the result is quarantined and re-run once, and a second failure writes a `blocked` record. A10: a repair fixes one of two findings; the comparison shows one resolved, one remaining; promotion is allowed. A12: a human sets `budget.hard_cap_usd` just above a first render's cost with material findings open; the record is `incomplete`, listing them, and no delivery is reported. A13: Director-grant patches to `rights.status`, a claim's `support`, a brief-derived constraint and `budget.hard_cap_usd` each get `FIELD_AUTHORITY`; the completion state is unchanged. A14's deterministic half: crossing $1.00 (`treatment.budget_fraction` × `budget.soft_target_usd`) notifies the Director and the phase continues (G2).

**Rules that are easy to get wrong.** Inject only through test seams a delivery render cannot reach; write as a human only through the human path, and only inside the test's own temporary Space, never the real one (L8); never special-case a test ([orchestration](../00-orchestration.md) §5).

**Tests.** Six files under `tests/acceptance/`.

**Done when.** `npm run test:accept` passes, with A1, A7 and A11 still passing.

**Out of scope.** A14's run half (M6-13).

### M6-11 — Golden briefs, expected constraints and the derivation comparison

- **Care:** normal
- **Package:** `tests/golden`, `tools/measures`
- **Depends on:** files from the start; the live part after M6-04b and M6-08     **Parallel with:** M6-01 to M6-10
- **Live calls:** Director sessions that derive the Quality Intent of each of six briefs and stop. Ceiling **$0.20**.

**Goal.** Six golden briefs carry expected constraints; the Director's derived constraints are compared with them; `tools/measures` reports R10 §3.3.

**Read first.** R10 §3.1, §3.3, §4.2, §7; R9 §3.4, §3.7; R3 §2.2 (`brief`), §2.7 ("Quality Intent (G19)"); R6 D10 ("Initial Quality Intent"); G19, K11, U4, U5, U6, and §18 of `lld/11`: L15, L26, C:C1.5; report C's row C:M6-O8.

**Build.** `tests/golden/<domain>/brief.json` (R3's `brief`) and `expected.json` (`expected_properties`; `expected_constraints` with `brief_key`, `kind`, `params`, proof form): the data reel as M6-13 states, the others per R10 §3.1, the M4 brief completed. A runner that stops each session once its Quality Intent is accepted; a comparison writer; `tools/measures` over the event, job, ledger, experience and evidence tables.

**Rules that are easy to get wrong.**
- **All six briefs get the derivation comparison at M6** (R10 §3.1; G19; C:M6-O8). For a brief not delivered at M6, the comparison applies the deliverable record's `briefConstraints` builder (K11) to the derived Quality Intent.
- Briefs use only user decisions: no ShareAlike (U4), NASA and museum sources (U5), no tutorial site until the user allows one (U6). A placeholder, such as which painting, may not change a hard constraint. The data reel's figures are invented test data, labelled as such (L15), until the M8 milestone document chooses real, verified ones (L26).
- Expected `duration`, `aspect` and `language` constraints use the `params` shapes of C:C1.5 and a proof `by: check` naming F-06.
- The comparison uses the record's `briefConstraints` builder (K11) and classifies each key as a match, weaker, stronger, of a different kind, or missing. R10 sets no pass mark.

**Tests.** `expected.json` validates; a fixture Quality Intent compares as a match, weaker and missing; `tools/measures` yields every §3.3 row on a fixture run.

**Done when.** Six briefs, `tests/golden/derivation-m6.json` and ledger lines exist.

**Out of scope.** Delivering the other five briefs (M7 to M10).

### M6-12 — Calibration: `R9-2`, the diagnostic half of `R2-S12`, `R9-4` and `R9-7`

- **Care:** normal. Written by a **test author**.
- **Package:** `tests/claims`, `tests/fixtures/planted`
- **Depends on:** M6-07     **Parallel with:** M6-08 to M6-10
- **Live calls:** `R9-4`, 60 reviews, ceiling **$0.85**; `R9-7`, 4 film reviews, ceiling **$0.12**.

**Goal.** The four claims are measured and their reports written.

**Read first.** R9 §5.1, §8, §9 (`R9-2`, `R9-4`, `R9-7`); R2 §9 (`R2-S12`); R10 §2.2; `lld/00` §1.4; b2c, spike 2 (ground truth method); §18 of `lld/11`: C:M6-O10, A:testing-1f.

**Build.** A planted set: clean DOM, SVG and Canvas components and shots, with planted overlap, safe-zone, contrast, occlusion and jump defects. `R9-2` and `R2-S12`: run the probe checks and hide and tint captures, confirm `DIAG_UNSUPPORTED` on Canvas, count hits and false alarms per check, compare P-04 with hand-measured contrast. `R9-4`: 20 real shots with known defects at the `review` rung, reviewed as a sheet, with crops, and with an event strip; count hits, false and uncited findings. `R9-7`: film reviews of the M4 and M5 films, as made and with one `must_communicate` item removed; M6-13 adds the data reel.

**Rules that are easy to get wrong.** Ground truth is written before any review. `R9-2`'s dead-control and wrong-bar parts wait for M7 and M8. **No pass marks exist, by design** (C:M6-O10; A:testing-1f): the measurement must run and its values be in `docs/impl/reports/claims/<ID>.json`, and the reports give hits and false alarms per check (`R9-2`), recall and false and uncited findings by evidence form (`R9-4`), and detection of the removed `must_communicate` item (`R9-7`). R9 §5's defaults stay in force; a fallback of R10 §2.2 is taken only by build revision. The comparison point the design relies on is batch 2c, where about two thirds of visible defects were found.

**Tests.** `tests/claims/R9-2.test.ts`, `R2-S12-diagnostics.test.ts`, `R9-4.live.test.ts` and `R9-7.live.test.ts`, each writing a report.

**Done when.** The four reports exist; ledger lines are written.

**Out of scope.** The full planted set (M11).

### M6-13 — The thin film: the data-reel golden brief, end to end

- **Care:** normal (a run, driven by the orchestrator; the A14 test is by a test author)
- **Package:** `tests/golden/data-reel`, `tests/acceptance/a14-data-reel.live.test.ts`
- **Depends on:** M6-01 to M6-12     **Parallel with:** none
- **Live calls:** the run, ceiling **$2.40**; the `R6-S10` comparison branch, ceiling **$0.20**.

**Goal.** The data reel goes from brief to a delivered file with its record, autonomously, after comparing at least two treatments; the measures, the constraint comparison, `R9-7` and `R6-S10` are recorded; the build stops.

**Read first.** R10 §3.1, §3.2 (A14), §3.3; R9 §3.6, §3.7, §3.8; R6 D2, D12; G19, K11, U3, U17, and §18 of `lld/11`: L14, L15, L16, L25, L26, C:C1.4, C:C1.5, C:M6-O2.

**Build.** The golden files below, the A14 test and the `R6-S10` copy script; then the run on a fresh Space.

**The brief file** (`tests/golden/data-reel/brief.json`, R3's `brief`):
- `text`: a verbatim request for a vertical reel of about 60 seconds on five consecutive monthly figures, narrated and captioned, each value shown and spoken as given. The brief supplies its own five figures as invented test data and says so in its text; it states the values, units and months, so a source of type `user` supports them through M6-04b's brief-only research (K-01; L15; C:M6-O2). No real-world statistic is claimed.
- `audience`, `purpose`, `tone`; `duration_target` `{min: 50 s, max: 60 s}`, a preference.
- `hard_constraints`: `max_length` ("no longer than 60 seconds"), `vertical` ("vertical, 9:16"), `english` ("narration and captions in English"), `all_figures` ("all five figures appear on screen and are spoken, exactly as given"), `captions` ("the narration is captioned, burned in").
- `preferences`: one narrator; a simple chart or counter. `policy`: `budget_usd` 5, `rights_policy` `{commercial: true, derivative: true}`, and the decided voice policy (U9).

**Expected constraints:** `max_length` → `duration` `{max_s: 60}`; `vertical` → `aspect` `{w: 9, h: 16}`; `english` → `language` `{code}` for English; each of these three proved `{by: check, check: "F-06"}` (C:C1.5); `all_figures` → an `essential_claim` per figure, proved by K-01, or a reviewer-proved `must_include`; `captions` → `must_include`. Proofs are `by: check` wherever a registered check proves the kind (B:O9).

**Expected properties:** no human input after start; two or more treatments at `animatic` with a stated difference, one T9 comparison, a `decision` listing the alternatives, treatment spend against $1.00; a delivered state; every hard check `PASS`; −14 ± 1.0 LUFS, ≤ −1.0 dBTP, the sample-count rule, mux offset within −5 / +15 ms; every take `aligned`, A-02's WER ≤ 0.15, and A-02's word-level sync part `UNKNOWN` with a coverage record (observational; L11); burned-in captions from aligned times, highlighted only if `R7-A2` allowed it, with WebVTT and SRT sidecars; at most 60 s; the five figures shown and spoken, each a `supported` claim from the brief's `user` source; an all-`eligible` authored closure, Kokoro speech through the pinned provider included (L14); `ai_disclosure` naming Kokoro-82M through OpenRouter (U17), with the suggested platform-disclosure answer (C:M6-O7c); no visible notice (L16); the U3 limitations.

**How the run is judged.** M6 is done only when all hold: (1) the audit log shows no human message or patch after `run`, and production ended through `delivery_finalize`, the designed chain of M6-09, called on an `eligible` candidate (C:C1.4); (2) `completion_state` is `delivered` or `delivered_with_limitations`, both deliveries under R9 §3.6, the report saying which and why; (3) every `hard_checks` entry is `PASS`, written by the check runner on the exported file; (4) `a14-data-reel.live.test.ts` passes on the run's records; (5) the orchestrator itself confirms, from the caption sidecar and the A-02 transcript, that each figure is shown and spoken as given; (6) spend stays within ceilings. A `blocked` or `incomplete` result is not done: fix and re-run within the three-round rule ([orchestration](../00-orchestration.md) §7) and the cap.

**`R6-S10`.** When the Director's context passes `context.compact_at_tokens` (180,000), copy the Space before the new segment starts and continue the old segment there for 10 turns. Compare with the real run's first 10 turns after the restart: repeated, skipped or contradicted steps, wrong handles, rework of a half-finished step, and whether the notes name the step in progress and what is patched but not closed (J8). If the threshold is never reached, say so; the claim stays ASSUMED.

**The milestone report records:** the run ID, record path, hash and state; the treatments, T9 evidence, `decision` and treatment share against $1.00; every R10 §3.3 measure against its R0 target (first preview within 20 minutes, accepted film within 2.5 hours, about $5 typical and $15 cap, at most $0.75 per revision cycle, cache hits and speculative waste, retries by class, findings later dismissed); the derivation comparison for every golden brief; the outcomes of `R9-2`, `R9-4`, `R9-7`, `R2-S12` and `R6-S10`; open findings, adjudications and known limitations; spend per part; build revisions; what stays unverified, such as user ratings of the first ten films; and, for the user, the rights seed of C:M6-O6a with the Kokoro entry and the ASSUMED part of L14 (that the speech provider's terms place no further limit on the output), and the suggested platform-disclosure wording, which the user may reword (L16). Then merge the report and the `handoff.md` refresh in one pull request, tag its merge commit `m6-done` and push the tag, close the GitHub milestone `M6`, update `impl/STATE.md` in its own small pull request (L20; [orchestration](../00-orchestration.md) §11), and **stop and wait for the user**.

**Done when.** All six judging conditions hold and the report is written.

**Out of scope.** Verified figures, which the M8 milestone document chooses (L26).

## 7. Claims of R10 §2.2 assigned to M6

| Claim | Where tested | Fallback if it fails |
|---|---|---|
| `R2-S12`, second half: diagnostic captures work across sandboxed frames | M6-02, M6-12 | Isolation-only diagnostics: P-01 and P-05 stay hypotheses, P-04 estimates the background from the composite (R9 §8) |
| `R6-S10` residual: notes stay good from 150,000 tokens or more | M6-13 | Raise the restart threshold, which the one-million-token context allows (J9) |
| `R9-2`: probe checks find planted defects with few false alarms | M6-12 | Thresholds move; they are named settings |
| `R9-4`: Reviewer recall by evidence type | M6-12 | The evidence mix is a setting |
| `R9-7`: a film-scope review judges a whole reel usefully | M6-12, M6-13 | Film-level judgement rests on shot reviews and deterministic checks; the limitation goes on every deliverable |

G19's ASSUMED claim (R10 §7) is measured in M6-11 and M6-13.

## 8. Live-call budget

| Work package | What | Ceiling | Basis |
|---|---|---|---|
| M6-06 | Recorded fixtures | $0.15 | Up to 10 reviews at about $0.014: **measured** (S2; b2c adaptive average $0.0105, maximum $0.0193) |
| M6-11 | Six Quality Intent derivations | $0.20 | **Estimate**, from measured units: ten Director turns at 15,000 tokens $0.007 to $0.012; a patch edit $0.0006 to $0.0015 |
| M6-12 | `R9-4`, `R9-7` | $0.97 | 60 reviews at the measured $0.0105 to $0.014 ($0.63 to $0.84); 4 film reviews **estimated** at $0.03 |
| M6-13 | Run and `R6-S10` branch | $2.60 | **Estimate** of $1 to $2.60 per run ([spend](../04-spend.md) §4), from measured units (half a cent per component, 1.4 cents per review) and speech at the pinned provider's price, which spike V1 measured (under a cent per film; L12); the branch, 10 mostly cached turns near 180,000 tokens, an estimated $0.15 to $0.20 |
| **Total** | | **$3.92** | M6's ceiling ([spend](../04-spend.md) §1); past a ceiling, stop and ask |

## 9. Resolved points

Every point the plan raised is closed by the lead's rulings and the research report C, recorded in section 18 of [`lld/11`](../../lld/11-integration-decisions.md). Identifiers follow section 18: `L<n>` is a lead ruling; `C:M6-O6a` is report C's row for M6's point O6, part a; `C:C1.3` is part 3 of report C's decision C1. Rows classed ANSWERED have no row in section 18 and are cited to the [report](../research/open-points-C.md) itself.

| Point | What it was | Resolution |
|---|---|---|
| O1 | Which checks delivery requires | **Decided** (C:C1.3). Code computes the required-evidence table from the installed catalogue and the closure: every applicable hard check, every check a hard constraint's proof names with the reviewer votes, every applicable corrective check, and T7's review. Missing records are requested as `check.run` jobs; a check absent from the installed catalogue is not required and is named in `known_limitations`; observational checks are never required (M6-08, M6-09). |
| O2 | Support for brief-supplied figures before K2's quote check exists | **Decided** (C:M6-O2). The brief-only part of research is built at M6: a `user` source holding the brief's text, a researcher sub-loop with only `submit_research`, R7's quote check writing `support`, and K-01's `user` part; it reads claims and figures from the brief and makes no web call, since L15 means no web research before M8 (L25); M8 adds the web tools to the same path (M6-04b). |
| O3 | How a proof is evaluated by kind | **Decided** (C:C1.5, with B:O9). F-06 evaluates `duration`, `aspect` and `language` itself, with fixed `params` shapes; other kinds name an existing check or take a reviewer proof; a proof naming a check outside the installed catalogue is refused on write, with Project Core's `UNKNOWN_CHECK` (L32); `register_check` declares `proves`. No new check ID (M6-04a). |
| O4 | Whether finalising counts as a stop condition | **Answered** by `hld/02` B3.5 (C:C1.4; C:M6-O4): calling `delivery_finalize` on an `eligible` candidate is the stop, and the call is a fact in the audit log, so D9 holds (M6-08). |
| O5 | A three-way vote has no majority | **Decided** (C:C1.6). The verdict is the value with a strict majority of `review.hard_proof_votes`; otherwise `UNKNOWN`; `NOT_APPLICABLE` counts as `UNKNOWN`; a first `PASS` ends the vote; votes at T7 sit outside the cycle cap and are paid from the delivery reserve (M6-07). |
| O6a | Rights entries for an authored-only closure, other than speech | **Decided** (C:M6-O6a). OFL-1.1, MIT and Apache-2.0 are `eligible`; a system-generated origin is `eligible` with no attribution; the rights fields per status are confirmed or corrected while seeding (L3) (M6-04a). |
| O6b | Rights entry for Kokoro-82M speech through OpenRouter | **Decided by the lead** (L14). An entry makes Kokoro-82M speech through the pinned provider `eligible`, on the model's Apache-2.0 licence; that the provider's terms add no limit is ASSUMED and reported to the user in the M6 report (M6-04a, M6-13). |
| O7a | Two homes for the visible-notice switch | **Decided** (L16). The switch is `quality_intent.disclosure.visible_notice`, a `human` field, not a delivery-profile field; U10's wording is corrected. `delivery_profile.ai_disclosure` stays a `human` field holding the platform disclosure label and the suggested disclosure text for upload, a different thing (L24, L37) (M6-08). |
| O7b | The notice's form | **Decided** (L16; C:M6-O7b). The overlay is not on the thin-film path; switching the notice on before the overlay exists makes a `final` compile report R4's `CAPABILITY_BLOCKED`, naming the notice (M6-09). |
| O7c | The suggested platform-disclosure answer | **Decided** (C:M6-O7c; L16). A fixed table in the disclosure sidecar derived from the record's `ai_disclosure` facts, leaning towards disclosure when a synthetic voice is present, saying it is not legal advice; the user may reword it (M6-08). |
| O8 | Which briefs get the derivation comparison | **Answered** by `lld/10` §3.1 and G19 (C:M6-O8): all six at M6, through the `briefConstraints` builder (K11) for briefs not delivered at M6 (M6-11). |
| O9 | The data reel's figures | **Decided by the lead** (L15). The brief supplies its own five monthly figures as invented test data, labelled as such, with a source of type `user`; no real-world statistic is claimed and no research into one is needed until M8. The figures become `supported` claims through M6-04b's brief-only path (M6-13). The real, verified figures are chosen by the M8 milestone document, written after the thin film (L26). |
| O10 | No pass marks for `R9-2`, `R9-4`, `R9-7` or `R6-S10` | **Measurement** (C:M6-O10). M6-12 measures `R9-2`, `R9-4` and `R9-7`, and M6-13 measures `R9-7` on the data reel and `R6-S10`; no starting pass mark exists by design (`lld/00` §1.4); R9 §5's defaults apply, and a fallback is taken only by build revision, against batch 2c's baseline of about two thirds of visible defects found. |

## 10. Acceptance list

| # | Command | Expected result |
|---|---|---|
| 1 | `npm run check` | Passes, with no dependency-edge violation |
| 2 | `npm test` | Passes with no network and no key |
| 3 | `npm run test:render` | Probe checks, diagnostic modes, contrast, film detectors, F-04, F-05 and the delivery chain pass; M5's audio and final-file tests still pass |
| 4 | `npm run test:accept` | A6, A8, A10, A12, A13 and A14's deterministic half pass; A1, A7 and A11 still pass |
| 5 | `npm run test:claims` | The `R9-2` and `R2-S12` diagnostic reports exist, with hits and false alarms per check |
| 6 | `CUTROOM_LIVE=1 npm run test:live -- --test-name-pattern="R9-4\|R9-7"` | Both reports exist |
| 7 | `CUTROOM_LIVE=1 npm run test:live -- --test-name-pattern=derivation` | `tests/golden/derivation-m6.json` classifies every brief key of every golden brief |
| 8 | `cutroom new --brief tests/golden/data-reel/brief.json`, then `cutroom run` (R6 D12; illustrative) | A record in state `delivered` or `delivered_with_limitations`; every `hard_checks` entry `PASS`; every required record of the required-evidence table present (C:C1.3); five `brief_constraints` entries; disclosure and caption sidecars |
| 9 | `CUTROOM_LIVE=1 npm run test:live -- --test-name-pattern=A14` | On the run's records: two treatments with a stated difference, read from the treatment worker's evidence bundle (C:C1.2), one blind comparison, a `decision` listing the alternatives, treatment spend against $1.00 |
| 10 | `node tools/measures --run <id>` | Every R10 §3.3 measure with its R0 target |
| 11 | Ledger, [spend](../04-spend.md) §5 | M6 total at most $3.92, each package within its ceiling; running total at most $10 |
| 12 | `gh pr view` on the report's pull request; `git ls-remote --tags origin m6-done`; `gh api repos/KnowScroll/Cutroom-v2-shivalik/milestones?state=closed` | The report holds everything M6-13 lists and is merged; the tag `m6-done` is pushed on its merge commit; the GitHub milestone `M6` is closed; the build has stopped for the user |
