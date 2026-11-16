# Cutroom v2 — LLD · R10: Integration Acceptance, Spike Register and Build Plan

**Decided:** 14 November 2026
**Status:** DECIDED by the lead session under the user's delegation of 14 Nov 2026. Section 6 records the design freeze review. Implementation starts only after the user's explicit approval.
**Baseline:** HLD B4, B5, C11, C12 · [process and roadmap](00-design-process-and-roadmap.md) · stage LLDs [R1](02-r1-foundations.md), [R2](03-r2-components-and-rendering.md), [R3](04-r3-project-model-and-storage.md), [R4](05-r4-compiler-and-render-plan.md), [R5](06-r5-scheduler-and-recovery.md), [R6](07-r6-harness.md), [R7](08-r7-studio-tools.md), [R9](09-r9-quality.md) · [integration decisions](11-integration-decisions.md) · [spike evidence](../research/10-spike-evidence-log.md)

## 1. Purpose

This document closes the design phase. It states what has been proved, what has not and how each unproved claim is contained; how the finished system will be shown to work as a whole; and the order in which it is built. The build starts with one thin film end to end and then widens (process document §1.7).

## 2. Spike register

### 2.1 Spikes run during design

| Spike | What it settled |
|---|---|
| S1 | Headless Chrome capture speed and parallelism on Windows; captures are repeatable to a tolerance, not to the byte |
| S1c | BeginFrame capture on Linux is faster than screenshots and needs no GPU |
| S2 | MiniMax writes rule-following visual components; about two thirds usable in one shot; MiniMax-M3 can review a contact sheet |
| S3 | A validate-and-repair loop takes components from 90% to 100% validator pass in two rounds; search/replace repairs are as effective and far cheaper |
| S4 | The sandboxed-iframe host page with seek, acknowledge, capture is correct and affordable; isolation is by origin; cross-component effects, zoom, probes, fonts and preview scaling behave as designed |
| S5 | Tool calling is 99% schema-valid without a JSON mode when the tool schema is fully typed (batch 3); handles save tokens; the prefix cache is automatic and lasts about half an hour |
| S6 | Controls plus a control track achieve acting that one-shot components could not; acting needs dense frames to be seen |
| S7 | PixiJS works and is deterministic but is slower than Canvas 2D under software rendering; the shim needs the one-script hash rule; anchor-follow is accurate and nearly free |
| Segment join | Separately encoded segments join by stream copy with exact frame count and unchanged quality |
| Batch 2a | The colour chain is accurate once tags are set explicitly; the mux adds no audio offset; `loudnorm` mastering is unreliable |
| Spike M1 | Static-gain mastering reaches the loudness target and keeps peaks under the ceiling after AAC |
| Batch 2b | `node:sqlite` on Node 26 is fast enough and survives 400 forced kills; durable commits can stall the main thread; the Windows mount gives no error by itself |
| Batch 2c | Still strips beat video for frame-level inspection; the Reviewer needs thinking on; workers reliably end with a structured submit call |
| Spike T1 | MiniMax speech-2.8 returns timing below sentence level, as sub-word tokens on a 42.67 ms grid that can be merged into words by character offsets; it is enough to cut caption cues at phrase level, and in one sample its pauses were 0.1 to 0.5 s from the audio's, so it is not shown accurate enough for lip-sync (G14). MiniMax speech-2.8 is no longer the voice engine (U17); the result stays as evidence about it |
| Batch 3 | Patch authoring on a 184-entity project and the Director's segment restart: the operation set holds when `ops` travels as JSON text, the MiniMax endpoint damages free-form structured tool arguments, and a restart lost no state at small scale but needs the working notes (section 2.3) |
| Spike V1 | OpenRouter's Kokoro-82M returns signed 16-bit little-endian 24 kHz mono PCM, can be pinned to one provider, is billed exactly as its generation look-up reports and repeats its timing but not its bytes, while CTC forced alignment in Node placed word starts after pauses within −40/+60 ms in 69 of 72 cases and Whisper `small.en` in Node gave good transcripts but poor word times, on Windows ([evidence](../research/evidence/v1-openrouter-kokoro-and-alignment.md); decided: `lld/11` section 18, L9 to L13) |

### 2.2 Claims still unverified, and how each is contained

No claim below blocks the design: each has a stated fallback, and each becomes an automated acceptance test at the milestone named. The identifiers are the stage-local ones in the stage LLDs.

| Claim (spike ID) | If it is wrong | Verified at |
|---|---|---|
| Request interception can serve the host page under frame control with no network (`R2-S8`) | Load the host with `Page.setDocumentContent` and `data:` URLs, as the spikes did | M1 |
| A private fontconfig gives identical text on two machines (`R2-S9`) | Text differs slightly between laptop and VM; comparisons already use a tolerance | M1, M11 |
| A reused browser gives the same pixels as a fresh one (`R2-S10`) | Use a fresh browser per chunk (`capture.browser_max_chunks` = 1); about a second of start-up per chunk | M1 |
| Frame mapping for variable-rate footage is exact (`R2-S11`) | Caught by the burnt-in frame-number test before any real footage is used | M9 |
| `backdrop-filter`, diagnostic captures and large prepared assets work across sandboxed frames (`R2-S12`) | Fewer host-level effects; isolation-only diagnostics; assets inlined up to the size limit | M1, M6 |
| Anchor-follow holds under camera zoom, on a transformed leader, and in a chain of two (`R2-S12`) | The prop is drawn inside the character component | M7 |
| Patch authoring also holds for vague, Director-style requests, and paging works when a read reaches the page cap (residual of `R3-K2` after batch 3; paging with `R3-K4`) | Change the view format; validate-and-repair bounds the damage | M4: the first golden brief |
| Project views fit their token targets (`R3-K4`) | Lower the page size; cursors already exist | M4 |
| `synchronous=FULL` survives power loss on the deployment disk; a grouped commit rolls back cleanly (section 15, H12) | The affected transactions move to their own commit | M3: the grouped-rollback test, and an abrupt-stop drill in which WSL is terminated from the Windows side under a write load and the database is checked on restart, labelled "abrupt VM stop", not power loss. True power loss on a deployment disk stays ASSUMED until M11, when a VM exists (decided: `lld/11` section 18, L1) |
| The timing solver is correct and fast at 1,000 points (`R4-SP1`) | The algorithms are textbook; a slow solve lowers `timing.max_points` | M2 |
| A sliced render unit gives the same pixels as the whole unit (`R4-SP2`) | Key the whole unit; less reuse on long shots | M2 |
| MiniMax-M3 can repair timing from a conflict witness (`R4-SP5`) | Reword the witness; the solver is unaffected | M4 |
| A baked static layer equals the live one and saves time (`R4-SP6`) | Baking stays off; a re-authored element re-renders its shot's chunks | M7 |
| MiniMax does not bill refused requests, and bills aborted streams only for tokens produced (`R5-2`) | The ledger under-counts by a bounded amount; the hard cap has a reserve | M4. The session asks the user once for the plan's usage figure before and after the probe; if the user does not supply it, the billing half is recorded `UNKNOWN` and the build continues (decided: `lld/11` section 18, L17) |
| Rate limits apply per account and model (`R5-3`) | The adaptive limiter slows down on 429 regardless | M4, on the subscription key the user kept (U11): a burst of tiny Flash requests, never more than 8 in flight, records the 429s, headers and recovery time. The pay-as-you-go claim stays ASSUMED (decided: `lld/11` section 18, A:testing-5) |
| Restart recovery kills orphaned child processes and salvages spools (`R5-5`) | A leaked browser is caught by the memory guard | M3 |
| The researcher resists planted instructions (`R6-S9`) | It holds no project, spending or code tool, so an injection can only bias its report | M8 |
| The Director's working notes stay good when written from a context of 150,000 tokens or more, and in open-ended work (residual of `R6-S10` after batch 3) | Raise the restart threshold, which MiniMax's one-million-token context allows | M6: the first long real session, a restarted run compared with a non-restarted one |
| Transport details S5 did not measure: the `2026-10-21` version header, streamed tool input, how moderation surfaces, cache hits with images and thinking blocks, and dropping old thinking blocks; and the transport conformance test, which checks type by type that every tool's arguments arrive as sent (`R6-S11`) | Override the header or call the endpoint with plain `fetch`; add a detector in the adapter; lower the compaction threshold if cache hits fail; keep thinking blocks until the segment boundary; a parameter that arrives changed travels as JSON text (R6 D7) | M4, and the conformance test again at every model pin change. No refusal is provoked: the adapter detects the documented moderation signals, the moderation part is recorded "not observed" unless one occurs, and it stays ASSUMED with its fallback (decided: `lld/11` section 18, C:M4-O7) |
| Forced alignment is accurate enough for captions and mouth shapes, within R1's tolerance (`R7-A2`) | Word-by-word caption highlighting stays off, and mouth shapes use tier 0 or 2 (R7) | M5, where the forced aligner is built because the voice engine returns no timing (U17, U18): the aligned word starts against signal onsets after pauses, as spike V1 did, because Whisper's word times are less accurate than the aligner's (decided: `lld/11` section 18, L11), one measurement that also serves as the word-time half of `R9-3` (K3). It decides whether word-by-word highlighting may be on: it passes when at least `align.lipsync_min_fraction` (0.95) of word starts fall within 40 ms early and 60 ms late; spike V1 measured 69 of 72 (decided: `lld/11` section 18, L9) |
| Spelling-based mouth shapes read acceptably (`R7-A3`) | Use the simpler flap tier | M7 |
| A model can add a control without changing a character's look (`R7-A4`) | Extension becomes re-authoring; the regression check catches drift | M7 |
| Exact chart checks work on model-written charts (`R7-A5`) | Charts are built on a trusted base chart component | M8 |
| Scripted capture is reliable and its log matches the pixels (`R7-A6`) | Capture stays limited to simple flows | M10 |
| The egress rules hold against redirects and rebinding (`R7-A7`) | Fetching runs behind a filtering proxy in a network-less container | M8 |
| Search isolation holds (`R7-A8`) | As `R6-S9` | M8 |
| A probe check catches wrongly drawn arm controls (`R7-A9`) | The contact-sheet look catches them, at a model call's cost | M7 |
| Probe checks find planted defects with few false alarms (`R9-2`) | Thresholds move; they are named settings | M6 |
| Speech-to-text error thresholds separate good takes from bad (`R9-3`; its word-time half is the `R7-A2` measurement above, run once) | Thresholds move | M5: the one normaliser for numbers, times, abbreviations and names, and the short-take rule (`stt.short_take_words` 10, `stt.short_take_max_errors` 1), are calibrated; A-01 does not gate delivery until the normaliser's tests pass (decided: `lld/11` section 18, L13) |
| The aligner and the Whisper models run on Linux in WSL (spike V1 ran them on Windows) | Run both on the WASM backend | M5, checked by the first M5 work package (decided: `lld/11` section 18, L10) |
| Reviewer recall by evidence type (`R9-4`) | Batch 2c gave a first measurement; the evidence mix is a setting | M6 |
| C2PA signing leaves the final-file checks passing (`R9-6`) | Labelling stays at the always-on record and sidecar | Not run, because the user decided against embedded signing (U7) |
| A film-scope review judges a whole reel usefully (`R9-7`) | Film-level judgement rests on shot reviews and deterministic checks, and the limitation is recorded on every deliverable | M6 |

### 2.3 Batch 3

Batch 3 ran the two spikes the freeze required (FR11): patch authoring on a 184-entity project (`R3-K2`, 588 runs) and the Director's segment restart (`R6-S10`). The patch operations hold up: with `ops` sent as JSON text, 95% of runs reached the expected project state, 88% of first patches were valid and 98% were valid within two repairs, at $0.0006 to $0.0015 per edit. But the MiniMax endpoint builds tool arguments using the tool schema, so values the schema leaves untyped lose their type: 31% to 59% of structured patch calls were damaged, and the model cannot repair damage it never sees. JSON text removed it entirely. The restart lost no state in 9 of 9 runs at 13,000 to 17,000 tokens of context, but without the working notes a half-finished step led to rework in 2 of 2 runs. One contained design change followed: tool arguments are encoded per provider by the model adapter (J1 to J5). Full results are in the [evidence file](../research/evidence/b3-patches-and-restart.md); the decisions are J1 to J12 in the [integration decisions](11-integration-decisions.md), section 16.5.

## 3. Integration acceptance plan

### 3.1 Golden briefs

One fixed brief per domain, kept under version control with its expected properties. Each golden brief also carries its expected constraints: the hard constraints a correct Quality Intent derives from it, against which the Director's derived constraints are compared at M6 (G19). Each is run end to end at the milestone that first supports it and again at M11. From M6 onwards every run must also show a treatment search: at least two distinct treatments, a recorded comparison, and a `decision` naming the alternatives.

| Domain | Brief (summary) | First run at |
|---|---|---|
| Abstract motion graphics | A 30-second beat-synced geometric piece, no narration | M4 |
| Data reel | A 60-second reel on five monthly figures with narration and captions. The brief supplies its own figures as invented test data, labelled as such in the brief, with a source of type `user`; no real-world statistic is claimed (decided: `lld/11` section 18, L15) | M6, with verified figures at M8 |
| Historical comedy | A 75-second two-character scene with a late double-take and a prop hand-off | M7 |
| Science documentary | A 90-second explainer of maglev levitation with a diagram and one real clip | M9 |
| Art history | A 75-second look at one public-domain painting with anchored annotations | M9 |
| Software tutorial | A 60-second walkthrough of a five-step flow in a public web application | M10 |

The science and art-history briefs use NASA and museum open-access sources, which need neither a contact identity nor a ShareAlike decision.

### 3.2 Required cases

Each case is an automated test with an injected fault. "Observable" is what the test asserts. Cases A1–A12 cover the HLD lists in B4 and C11; A13 and A14 cover the two blocking findings of the freeze review.

| # | Case | Injection | Observable |
|---|---|---|---|
| A1 | A stale worker completes after an upstream revision (B4, C11) | Hold a component-author job, promote a patch that changes an entity it read, release the job | The artifact is cached under its own work key. Project Core refuses the patch proposal for merge because its read set, compared by `pin_hash`, changed on the target head, and lists the changed entities. Nothing is promoted. A second run, where the promoted patch touches nothing the job read, merges cleanly |
| A2 | Two file-disjoint edits conflict semantically (C11) | Branch A retimes a reaction; branch B enlarges the object it reacts to; merge | The field merge succeeds; `COUPLED_CHANGE` lists the revalidation set; the checks on that set declare the artifacts they need, the Scheduler requests those renders as dependencies, and the checks report the conflict |
| A3 | A provisional scene bound changes (B4, C11) | Supersede a scene context that two layers pinned | Exactly those consumers are flagged; unrelated chunks keep their work keys |
| A4 | A cross-layer effect needs grouped execution (B4, C11) | Declare a glow from one layer onto another; separately, ask for one live component as another's matte | The glow is present in the rendered pixels of the unit. The matte request is refused with `CROSS_COMPONENT_EFFECT_UNSUPPORTED` |
| A5 | A failed experiment is rolled back (B4, C11) | Run an experiment whose variants both fail review; separately, promote a change and then `restore` the earlier state | The accepted head never moved during the experiment; branches and evidence remain; an identical trial returns the earlier evidence. The `restore` produces a new accepted revision whose content equals the earlier one. That equality holds because no module wrote in between: a path the caller may not write keeps its base value and is reported in one `RESTORE_PATH_KEPT` warning (decided: `lld/11` section 18, B:O7) |
| A6 | A known defect is preserved in a provisional preview (B4, C11) | Render a preview with a clipped label | The preview is stored and playable with its finding attached; promotion is not blocked |
| A7 | A worker crashes after an external effect, before reporting (C11) | (a) Kill the process after a paid voice call returned bytes but before commit. (b) Drop the reply entirely | (a) On restart the job is `unknown_outcome`, the spooled response is adopted and the ledger shows one charge. (b) The call is booked as presumed charged and resent once; a second loss ends the job `failed` |
| A8 | The final MP4 is missing audio (B4, C11) | Make the mux drop the audio stream | The mux job succeeds and returns its file; F-02 fails hard; the result is quarantined and the mux re-runs once; if it fails again the state is `blocked` and a deliverable record with that state is written |
| A9 | A corrected fact invalidates several artifact types (B4) | Change one figure in a claim after the first render | The chart, the caption and the narration change together; the old take is superseded and a new one requested; the exported file shows and speaks the new value; styling and other shots keep their keys |
| A10 | A repaired but still imperfect preview (B4) | A repair fixes one finding and leaves another | The comparison record shows one resolved and one remaining; the Director may promote |
| A11 | Cancellation races completion | Cancel a chunk job as it completes | Either order leaves a consistent state; the released consumer is never resolved; nothing is promoted |
| A12 | Budget runs out with material findings open | Set the hard cap just above the cost of a first render. The test sets this `human` setting inside its own temporary Space, acting with the `human` level there; the real Space is never touched by a test (decided: `lld/11` section 18, L8) | The film is exported as `incomplete` with its findings listed; no delivery is reported |
| A13 | The Director cannot write its own passes | Have the Director's session patch `rights.status`, a claim's `support`, a brief-derived hard constraint and `budget.hard_cap_usd` | Each patch is refused with `FIELD_AUTHORITY`; the completion state is unchanged |
| A14 | Different treatments are searched | Run the data-reel brief | At least two treatments differ in a stated way; one blind comparison is recorded; a `decision` lists the alternatives and why they lost; the budget share is `treatment.budget_fraction` of `budget.soft_target_usd`, and crossing it notifies the Director without stopping the phase (G2) |

### 3.3 Measures

The HLD's performance goals (B5) are measured on every golden-brief run from M6 onwards and compared with the R0 targets.

| Measure | Source | R0 target |
|---|---|---|
| Time to first useful preview | Event table: brief accepted to first `draft` rung segment | within 20 minutes |
| Time to accepted film | Event table: brief accepted to delivery record | within 2.5 hours, typical |
| Cost per film, all-in | Budget ledger | about $5 typical; $15 hard cap |
| Cost per revision cycle | Budget ledger by scope | at most $0.75 |
| Cache hit rate and speculative waste | Job table | reported, no target yet |
| Retries by failure class; repeated known failures | Job and experience tables | reported |
| Reviewer findings later dismissed, and defects a person found that the system missed | Evidence table; user ratings on the first ten films | reported; feeds calibration |

The treatment search adds cost that the R0 estimate did not include: three text treatments and up to two animatics. Its budget share is 20% of `budget.soft_target_usd`, about one dollar on a typical film; crossing it notifies the Director without stopping the phase. The typical-film target may need revisiting once M6 measures it.

## 4. Build plan

### 4.1 Principles

- **Thin film first.** Milestones M0–M6 build the narrowest path from a brief to a delivered film. Later milestones widen it one domain at a time.
- **Every milestone ends with its acceptance tests passing,** including the unverified claims assigned to it in section 2.2.
- **A design change found during the build** is recorded as a revision to the stage LLD (as R1 Revision 1 was) before the code that depends on it is written. A change to the accepted HLD goes back to the user.
- **Who writes the code.** One orchestrator session, a single main Claude Code session, decides and coordinates; subagents implement, test and review. The session starts from `handoff.md` and follows the documents under `impl/` (U12). The orchestrator, and the subagents that review, plan and investigate, run on Opus 5.5; the subagents that implement and write tests run on Sonnet 5.5; nothing runs on Fable (U36, replacing U24). Codex may stand in for an Opus reviewer. Design-sensitive parts (the shim and sealer, the capture engine, patch validation with write authority and merge, the timing solver, the paid-call protocol, the Director loop) are written and reviewed at high care.
- **Where the session runs.** The project lives at `C:\Users\XZNON\cutroom-v2`, the one working tree (U19). Claude Code runs on Windows in that folder, and subagents edit files there (U25). Linux-only steps run through `wsl.exe` on a disposable build mirror on the WSL ext4 disk, refreshed by `npm run wsl:sync`; the Space lives on the WSL ext4 disk, never under `/mnt/c` (U26). Speed decides where each test runs (U22): type checks and unit tests on Windows-native Node; render, acceptance, claim and live tests and every run of the product in WSL on the mirror. This is a reasoned default that work package M0-01 measures (U27).
- **How work is merged.** The GitHub home is `KnowScroll/Cutroom-v2-shivalik`, private, default branch `main` (U20). The build follows the working method of `KnowScroll/knowscroll` (U21): one issue per work package, one branch and one squash-merged pull request per work package, merged by the orchestrator when the local tests are green and, for high care, the review is closed (U28, U29). No direct pushes to `main` and no force pushes; because the plan offers no branch protection, a Claude Code hook enforces this (U30). One small GitHub Actions workflow re-runs the type check and unit tests on Linux as a record that nobody waits for; render, acceptance, claim and live tests never run on GitHub (U27). Briefs start from a pointer command (U31). The first act of the build is a bootstrap step that makes the first push (U34).
- **How far it goes without waiting.** The session builds M0 to M6 without waiting, reports at each milestone, and stops when the thin film is delivered end to end. It also stops for anything only the user can decide. M7 to M11 start only on the user's word (U14). Live-call spend through M6 is capped at 10 US dollars at list prices, counted from the `usage` fields of real responses and never estimated; the session keeps a ledger and stops to ask before going over (U15).
- **Environment.** Node 26 LTS on Windows for the type check and unit tests, and in WSL2 for everything else; the Space on the WSL ext4 disk; `chrome-headless-shell` and fonts pinned by hash. The API keys are read at run time from the project's `.env`, which Git ignores (U23).

### 4.2 Milestones

| Milestone | Builds (stage LLD) | Done when |
|---|---|---|
| **M0 Foundations** | Repository and packages; settings registry with override levels; R1 types (flicks, IDs, hashes); storage adapter over `node:sqlite`; blob store; CLI skeleton (R3, R6) | Canonical-JSON vectors pass; the 200-kill promotion drill passes on real code; start-up refuses a `9p` mount |
| **M1 Render core** | Shim and sealer; host page; capture engine; `chunk.render`, `still.render`, `film.concat`, `film.mux`; the component validation functions; preview rungs (R2) | The stale-frame, isolation, leak, colour-chart, mux-offset and repeatability tests pass as automated tests; a hand-written three-component shot renders to an MP4 |
| **M2 Project and compiler** | Core entity kinds; patches with per-field write authority; revisions, branches, merge, promotion, `restore`; compiler passes; timing solver; Render Plan; work keys; `plan_diff` (R3, R4) | Solver property tests pass; sliced and whole renders match; a hand-authored project compiles and renders through M1; case A13 passes at the patch level |
| **M3 Scheduler** | Jobs, work-key cache, futures, pools, intents and reconciliation, budget ledger, `plan_to_jobs`, the check runner (R5, R9); the `evidence` table and `closure_hash` in project-core, built before the check runner writes records (decided: `lld/11` section 18, L5) | Cases A1, A7 and A11 pass against stub capabilities (a fake author and a fake paid adapter); a killed render resumes; orphaned browsers are removed; the grouped-rollback test passes, and the abrupt-stop drill (WSL terminated from Windows under a write load) leaves a sound database, recorded as "abrupt VM stop", not power loss, which stays ASSUMED until M11 (decided: `lld/11` section 18, L1) |
| **M4 Harness and first light** | `ModelClient` for MiniMax, with per-provider tool-argument encoding (JSON text for every parameter not typed to every leaf); Director loop; tool boundary; component-author worker with repair; treatment worker and text-level treatment proposals; project and compile tools, including `project_schema` (R6) | The abstract motion-graphics brief produces a silent film with no human input, its run ending with the staged `delivery_finalize` at grade `preview`, which writes no deliverable record (decided: `lld/11` section 18, L23); A1 passes with the real author; the transport conformance test passes for every tool; view sizes, the transport facts, billing and rate-limit probes are recorded, the billing half as `UNKNOWN` if the user does not supply the usage figure (decided: `lld/11` section 18, L17) |
| **M5 Sound** | The voice adapter for `hexgrad/kokoro-82m` through OpenRouter, the chosen engine (U17), which returns no timing, requesting PCM and pinned to one provider by `voice.provider_only` (decided: `lld/11` section 18, L12); the forced aligner, so that every take is `aligned` (U18): CTC forced alignment in Node with a wav2vec2-base model, and the Whisper `small.en` transcriber in Node, both local, with model files pinned by hash (decided: `lld/11` section 18, L10); takes; static-gain mastering; music and effects interfaces, each with its one engine: the code-rendered music engine and procedural effects (U2); captions cut from the aligned word times, with word-by-word highlighting on only if the M5 alignment measurement allows it (R7) | A narrated film renders with captions, its run ending with the staged `delivery_finalize` at grade `preview` (L23); loudness, peak, sample-count and transcript checks pass on the exported file, and the transcript normaliser's tests pass (L13); A7 passes with the real adapter; the adapter's replies match the PCM format and response shape that spike V1 recorded (U18, L12); the aligner and Whisper run on Linux in WSL, or on the WASM backend (L10); `R7-A2` has measured the aligned word starts against signal onsets after pauses (L11) and decided, by `align.lipsync_min_fraction`, whether word-by-word highlighting may be on (L9) (decided: `lld/11` section 18, L9 to L13, L23) |
| **M6 Quality and delivery** | Probe checks; diagnostic captures; Reviewer protocol including the blind treatment comparison; completion state; the rights rule table seeded for authored-only films, with an entry that makes Kokoro-82M speech through the pinned provider `eligible` (decided: `lld/11` section 18, L14); the brief-only part of research, so that the brief's figures get quote-checked support (decided: `lld/11` section 18, C:M6-O2); `delivery_finalize`, which replaces the staged form of M4 and M5 (L23); deliverable record (R9, R7) | **The thin film is complete:** the data-reel brief, whose figures are invented test data with a source of type `user` (L15), goes from brief to a delivered file with its record, autonomously, after comparing at least two treatments. Cases A6, A8, A10, A12, A13 and A14 pass. The first cost and time measures are taken. For each golden brief, the hard constraints the Director derives, as printed in the deliverable record's `brief_constraints` field (R9 §3.7, K11), are compared with the brief's expected constraints (G19) |
| **M7 Characters** | Controls vocabulary; performance author; control response checks; anchor-follow with a keyed leader and the hand-off check; recipes; the bake test. The forced aligner is no longer built here: M5 builds it (U18) (R7, R2, R4, R9) | The historical-comedy brief passes, including the prop hand-off; a reaction is retimed by a track edit alone |
| **M8 Research, claims and charts** | Researcher sub-loop, adding the web tools to M6's brief-only research path (C:M6-O2); claims and sources with system-written support; datasets and bindings; chart checks; fetch transport (R6, R7, R9) | Case A9 passes; injection and egress tests pass; the data reel uses verified figures |
| **M9 Real media** | Media needs, provider adapters, rights rules, downloader, media layers and the trusted media source, `media_annotate`, the identity check (R7, R2, R4, R9) | The science and art-history briefs pass; an ineligible asset blocks delivery and not promotion; evidence footage with an unconfirmed identity blocks delivery |
| **M10 Experiments and tutorials** | Experiment Agent; experience search; scripted capture and the pre-delivery assertion check (R6, R3, R7, R9) | Cases A2, A3, A4 and A5 pass; the tutorial brief passes |
| **M11 Hardening and deployment** | Full acceptance suite; planted-defect calibration set; Linux VM image with Chrome's sandbox on, which waits for the user's choice of VM provider and image (U8); operating notes | All fourteen cases and all six golden briefs pass on the VM; measures are reported against the R0 targets; the first calibration review is done |

The voice engine, `hexgrad/kokoro-82m` through OpenRouter (U17), returns no timing of any kind, so every take is `aligned` and the forced aligner is on the thin-film path: it is built at M5, and the caption cues are cut from its word times. Whether word-by-word highlighting may be on is decided by the M5 alignment measurement (`R7-A2`). This is the rule G14 and FR11 already gave for an engine without native timestamps (U18). Spike T1's findings about MiniMax speech-2.8 (sub-word tokens on a 42.67 ms grid; pauses 0.1 to 0.5 s from the audio's in one sample) stay as evidence about an engine that is no longer used. The beat tracker is built with the first music engine that lacks an authored beat grid; it is not on the thin-film path.

### 4.3 Decisions the user made on 15 November 2026

The user's decisions are recorded in the [integration decisions](11-integration-decisions.md), section 17.1.

| Decision | Needed by | Decided |
|---|---|---|
| A pay-as-you-go MiniMax key (the current key is on a subscription plan and rejects about 10 concurrent requests) | M4 | U11: the current MiniMax key is kept, with at most 8 model requests in flight |
| The voice engine | M5 | U17 (replaces U1, MiniMax speech-2.8): `hexgrad/kokoro-82m` through OpenRouter's Text-to-Speech API. It returns no timing, so every take is `aligned` and the forced aligner is built at M5; whether word-by-word highlighting may be on is decided by the M5 alignment measurement (U18) |
| The OpenRouter key (`OPENROUTER_API_KEY`) for the voice engine | M5 | U23: it is in `C:\Users\XZNON\cutroom-v2\.env`, with the MiniMax key, a file Git ignores. It follows the MiniMax key's rules: read at run time, never printed, logged, copied or committed. OpenRouter's rate limits are unknown; the adapter backs off on 429 (U18) |
| The music and sound-effect engines | M5 | U2: code-rendered music and procedural effects; no AI music or sound-effect provider; a film may ship without music. The music and effect adapters stay provider-neutral; only the code-rendered engines are built |
| The voice policy, including whether the creator's own voice may be cloned with consent | M5 | U9: no voice cloning at all, including the user's own voice. The candidate policy in R7 is now decided: no cloning or imitation, stylised voices for historical figures, disclosure and provenance |
| Whether anything should listen to the audio (a second provider with audio input) | M6 | U3: nothing listens, and no second provider with audio input is used. Voice performance and music fit are `UNKNOWN` and listed as a limitation on every deliverable; speech-to-text and loudness checks still run |
| AI-content labelling: whether embedded C2PA signing is turned on, and whether a visible notice for synthetic voices is the default | M6 for the notice; M11 for signing | U7: no embedded C2PA signing, so `R9-6` is not run. U10: no visible on-screen notice by default; it can be switched on for one film, by `quality_intent.disclosure.visible_notice`, a `human` field, which corrects U10's "in its delivery profile" (decided: `lld/11` section 18, L16). The disclosure record and sidecar are always written |
| Whether ShareAlike media is acceptable | M9 | U4: not accepted; `rights.share_alike_ok` is false |
| A contact identity for the Wikimedia and Art Institute of Chicago request headers | M9 | U5: no contact address is sent to any service, so those two adapters stay off. The science and art-history briefs use sources that need no contact identity |
| The basis for capturing third-party software screens | M10 | U6: no capture of third-party software; the capture allow-list (`screen_capture.allowed_origins`) is empty |
| The production VM provider and image | M11 | U8: no production VM yet; development and use stay in WSL2 on the user's machine |

Two things still need the user later. The tutorial brief at M10 cannot run until the user adds a site to the capture allow-list (U6). M11's deployment work waits until the user chooses the VM provider and image (U8). A third, where the OpenRouter key is stored, is settled (U23). The `R5-2` probe at M4 also asks the user once, optionally, for the plan's usage figure (decided: `lld/11` section 18, L17). Any of these decisions can be changed by the user; a change is recorded as a revision to the integration decisions.

## 5. Deployment requirements recorded during design

- Linux with Chrome's own sandbox enabled: Ubuntu 22.04, or a later release with an AppArmor profile for the pinned `chrome-headless-shell`.
- No GPU is needed. Rendering is software; capture throughput scales with CPU cores, and a PixiJS render unit uses about ten cores by itself.
- The render processes run with no network interface.
- About 1 GB of memory per render browser, plus the Node process and the optional Python worker.
- The Space directory on a local Linux filesystem.

## 6. Design freeze review

The review has three parts (process document §1.6).

### 6.1 Mechanical consistency

Four passes by Codex (gpt-6.1-sol, medium effort): [pass 1](../research/evidence/codex-consistency-pass1.md) found 145 mismatches in the drafts, [pass 2](../research/evidence/codex-consistency-pass2.md) found 40 in the final documents, [pass 3](../research/evidence/codex-consistency-pass3.md) found 25 after the second-pass fixes, none of them structural, and [pass 4](../research/evidence/codex-consistency-pass4.md) made 41 corrections and left six open points, all decided in sections 16.4 and 16.5. A [fifth pass](../research/evidence/consistency-pass5.md), run on 15 November 2026 at the user's request after sections 16.3 to 16.5 had been applied, is the pass J12 scheduled for M0: it made 9 corrections and left 11 points, all decided in section 16.6 (K10). Every finding is answered in the [integration decisions](11-integration-decisions.md), sections 10, 13, 16.2, 16.4, 16.5 and 16.6.

### 6.2 Independent review

An agent with no knowledge of the design discussions read the vision, the accepted HLD, every LLD and the evidence log. It checked conformance to the nine Phase C contracts and the C0 invariants, walked six productions from brief to delivered file, traced every B4 and C11 failure case, and looked for unsound claims.

- **Verdict:** ready to freeze after the listed fixes.
- **Conforming as written:** Experiment Agent isolation, the ban on generation models, frozen plan inputs, Director autonomy. No circular module dependency was found.
- **Two blocking findings:** hard delivery gates rested on fields and settings the Director could write; and nothing searched for different treatments, which the vision requires.
- **Nine material findings:** the whole-film judgement was not wired to the Quality Intent; one fallible review could block a hard constraint; a figure had four homes; real media, anchors and identity were under-specified; a prop hand-off could not be expressed or checked; Canvas charts could vouch for themselves; the missing-audio path contradicted itself; five acceptance tests would pass a wrong implementation; the build order had errors.
- **Six minor findings.**

Every finding is answered in the [integration decisions](11-integration-decisions.md), section 16.1, and applied to the stage LLDs and to this document.

### 6.3 Walkthrough of the six domains and the HLD failure cases

The independent review performed both walkthroughs. Every B4 and C11 case maps to a test in section 3.2. The gaps the walkthroughs exposed are the material findings listed above; after the section 16 changes, each of the six productions has a stated path from brief to delivered file, with these recorded limits:

- **Historical comedy:** whether a pause is funny cannot be judged while nothing listens to the audio.
- **Science documentary and art history:** real media depends on which provider adapters the user enables.
- **Software tutorial:** web applications only, with no logins.
- **Data reel and abstract motion graphics:** no limit beyond the general ones.

### 6.4 Outcome

The design set is frozen as of 15 November 2026.

- Every finding of the review has a recorded answer in the [integration decisions](11-integration-decisions.md), and each answer is applied to the stage documents.
- Both spikes required before the freeze (FR11) ran in batch 3 (section 2.3). They led to one design change, the per-provider encoding of tool arguments with its guards, the `project_schema` tool and the transport conformance test (J1 to J5), which is contained in the model adapter and the tool registry (J11).
- What remains unverified is listed in section 2.2, each claim with a fallback and the milestone that tests it.
- A full mechanical pass was run after the last decisions (G14 to G22 and J1 to J12), on 15 November 2026 (section 6.1). Its open points are decided in the [integration decisions](11-integration-decisions.md), section 16.6 (K1 to K12), and applied to the stage documents.
- Implementation starts only on the user's explicit approval.

### 6.5 Pre-build pass

While the build was being planned under `impl/` on 15 November 2026, the milestone, environment and testing documents raised about 130 open points where the design did not say enough. Three research reports proposed an answer for each, the lead ruled on them (rulings L1 to L23 and a general ruling that accepts every design-gap proposal unless a ruling changes it), and the batch is recorded in the [integration decisions](11-integration-decisions.md), section 18, and applied to the stage documents. One ruling touches the user-accepted R1: every "round to nearest" in R1 and R3 rounds half up, computed exactly on integers. It is recorded as **R1 Revision 3** and reported to the user (decided: `lld/11` section 18, L6).

## 7. Claims this document relies on

| Claim | Label | Evidence or consequence |
|---|---|---|
| Every HLD acceptance case in B4 and C11 maps to a test in section 3.2 | VERIFIED by source | Confirmed by the independent review |
| The acceptance tests would detect a wrong implementation | ASSUMED | Five were strengthened after the review; a test can still be too weak. Each is reviewed again when it is written |
| The milestone order respects the stage dependencies | ASSUMED | Corrected once after the independent review. If a dependency is still wrong, the work moves earlier; no design changes |
| The thin film (M0–M6) can be built with the decisions in section 4.3 | ASSUMED | If a decision proves unworkable, the session stops and asks the user (U14), and the affected milestone waits; a change is recorded as a revision |
| The hard constraints and proofs the Director derives from a brief capture that brief's hard constraints | ASSUMED | A model judgement that code cannot verify (G19). Every deliverable record prints each brief constraint beside its derived constraint and proof in its `brief_constraints` field (K11), and at M6 each golden brief's derived constraints are compared with its expected constraints |
| The R0 budget and time targets are achievable, including the treatment search | ASSUMED | Measured from M6. The levers are model routing, review caps, candidate counts and the treatment budget share, all of which are settings |
