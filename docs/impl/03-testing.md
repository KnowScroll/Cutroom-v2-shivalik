# Cutroom v2 — Implementation · Testing

**Written:** 15 November 2026
**Status:** In force for the build. Test conventions, not design. Every threshold is quoted with its source; where the design gave none, section 10 records the decision that supplies it. Revised on 15 November 2026 for U19 to U35 ([integration decisions](../lld/11-integration-decisions.md), section 17.3): where each level runs, the known-failures registry, and the role of GitHub Actions.
**Read with:** [orchestration rules](00-orchestration.md) · [conventions](01-repo-and-conventions.md) · [environment](02-environment.md) · [spend](04-spend.md) · [integration decisions](../lld/11-integration-decisions.md), section 18

## 1. Test levels

| Level | Command | Files | Runs on | Uses |
|---|---|---|---|---|
| Unit and property | `npm test` | each package; the tests of the guard hook and of `tools/`; on Windows, every file except `*.linux.test.ts` | Windows, working tree. Also GitHub Actions (Ubuntu) | Node only: no browser, FFmpeg, network or key; under about a minute. `fast-check` for the timing solver, canonical JSON and merge; harness tests on recorded or hand-written replies |
| Linux-only unit | `npm run test:linux` | files named `*.linux.test.ts` anywhere | WSL, mirror. Also GitHub Actions (Ubuntu) | Unit tests that need Linux process behaviour: sockets, `/proc`, kill signals. No browser, FFmpeg, network or key (L18) |
| Render | `npm run test:render` | package render tests | WSL, mirror | The pinned Chrome and FFmpeg |
| Acceptance | `npm run test:accept` | `tests/acceptance/` | WSL, mirror | As render, plus the fault helpers of section 4 |
| Claims | `npm run test:claims` | `tests/claims/` | WSL, mirror | As render; no live calls |
| Live | `npm run test:live` | files named `*.live.test.ts` anywhere under `tests/` | WSL, mirror | The keys, `CUTROOM_LIVE=1`, a ledger line in [spend](04-spend.md) |

- Tests are TypeScript, built with the rest and run by `node --test` on the output (conventions §3).
- Live tests are kept out of the other commands by file name, not skipped. One started without `CUTROOM_LIVE=1` fails at once and says why.
- Linux-only unit tests are kept out of `npm test` on Windows the same way, by file name, never by skipping. They count toward "done" like any other test: a work package that has them is not done until `npm run test:linux` passes in WSL on a freshly synced mirror (L18; [conventions](01-repo-and-conventions.md), section 6).
- The render, acceptance and claim commands run `env:check` first, take the machine-wide render lock, and run their files one at a time ([environment](02-environment.md), sections 9 and 10).
- A failing property test prints its seed, and that seed becomes a fixed case.

**Where each level runs, and why** (U22: speed first; U27). The type check (`npm run check`) and the unit and property tests run on Windows-native Node 26, straight from the working tree, because that loop has no sync step: an implementer edits a file and runs them at once. The render, acceptance, claim and live levels, and every run of the product, need Linux (headless Chrome with BeginFrame, FFmpeg, `/proc`, process groups, a Space on ext4), so they run in WSL on the build mirror after `npm run wsl:sync` ([environment](02-environment.md), section 2). So do the unit tests that need Linux itself, through `npm run test:linux` (L18). Each worktree syncs to its own mirror, and render, acceptance and claim runs from different worktrees never run at the same time (L19). **This placement is a reasoned default, not yet a measurement.**

**The measurement** (M0-01b). On the M0-01b workspace, the wall time of `npm ci`, the build, `npm run check` and `npm test` is measured in three layouts: (1) Windows-native on the working tree; (2) WSL on the mirror, including the `wsl:sync` that precedes it; (3) WSL directly on `/mnt/c`, in a throwaway worktree under `.worktrees/` so that WSL's Linux `node_modules` never replaces the Windows ones in the working tree, and removed afterwards. Each is timed from cold and after a one-file change. The numbers go into the M0-01b pull request and the M0 report. The same timing script runs again at the end of M2, and its numbers go into the M2 report (L43). If a different layout is clearly faster for a level, the orchestrator moves that level, records it in [conventions](01-repo-and-conventions.md) section 9, and updates this table. SQLite is never opened on `/mnt/c`, in this measurement or anywhere else.

**GitHub Actions** (U27). One workflow, `.github/workflows/checks.yml`, runs `npm ci`, `npm run check`, `npm test` and `npm run test:linux` in a single job on Ubuntu (L18). It is a second record of each pull request and the guard that the code also passes on Linux and from a clean checkout (a file never committed shows up there). It runs on pull requests to `main`, on pushed milestone tags (`m*-done`) and by hand (`workflow_dispatch`), with `concurrency` set to cancel a superseded run, `permissions: contents: read`, Node 26 with the npm cache, a ten-minute timeout, actions pinned by commit SHA, and no secrets ([study](research/knowscroll-workflow.md), "What to copy", row 4). **Nobody waits for it** (orchestration §9): the organisation is on GitHub Free with a private repository, so there are no required checks and the Actions minutes are a monthly quota shared with the organisation's other private repositories. Its estimated cost is about 4 to 6 billed minutes per pull request (inferred in the study, not measured). Render, acceptance, claim and live tests never run on GitHub: they need the pinned environment, reference frames stamped with its hash (section 3), and the keys. Nothing from the study's "What not to copy" list runs there either (U35).

## 2. Recorded model replies

**The rule.** Harness tests run against recordings or hand-written replies, never the live model, except in work packages whose header lists live calls (standing rule 7). The replay client is its own implementation of `ModelClient` (lld/07 D7) with no network code; the live adapter refuses to construct without `CUTROOM_LIVE=1`. A test cannot call out by mistake.

**A recording** is one JSON file per model call under `tests/fixtures/recordings/<suite>/`, holding:
- the request as sent: model, role, headers, and the body as canonical JSON, whose hash is the lookup key (the request hash the harness gives the Scheduler, lld/07 D7 step 1);
- the response: status, headers, every streamed event in order, and the assembled reply with `usage` and `request_id`;
- provenance: date, work package, model pin, SDK version, thinking on or off.

**Secrets.** The recorder removes the `authorization`, `x-api-key` and any `cookie` header before anything is written, at the point where the adapter redacts (conventions §5). A unit test records a call made with a fake key and asserts that the fake key appears nowhere in the file; the real keys are never used to test this. `env:check` scans recordings for both real keys ([environment](02-environment.md), section 8).

**A missing recording** makes the replay client throw an error naming the request hash, the suite and the command that would record it. The test fails. It never falls through to the network or uses the nearest match.

**Hand-written replies** cover what a live model will not produce on demand. Each is marked `handwritten: true` with the evidence it imitates: batch 3's argument damage (numbers as strings, arrays as `{"item": …}`, empty containers as `""`); a tool call returned as text (J3); unparseable JSON text sent twice (J2); a reply cut off at `max_tokens`; a moderation flag or code 1026 or 1027 (lld/07 D13); HTTP 429 with code 2062 (S5); `pause_turn`; a stream that fails after its first bytes. Director-loop tests use scripted conversations of hand-written replies matched by turn order, so a prompt change does not invalidate them. Exact-hash recordings are kept for transport tests.

**Refreshing** happens only inside a live work package (`CUTROOM_LIVE=1 npm run test:live -- --record <suite>`), with its cost in the ledger and the new files in their own commit. When a model version pin changes, that model's recordings are refreshed and the transport conformance test runs again (J4, `R6-S11`).

## 3. Render tests

**Pixels are compared with a tolerance, never by byte equality** (lld/02 §5). S1 found the same frame captured twice not byte-identical (77.6 dB with GPU rasterisation, 82.7 dB without); S1c measured 82.66 dB between a fresh browser and a long run; S4 found same-history browsers byte-identical and a different history about 82 dB (lld/03 §2.8). A byte match counts as a pass, but no pixel test requires one. Hashes are compared exactly only where the design makes them exact: work keys, canonical JSON, content addresses.

| Comparison | Pass | Source |
|---|---|---|
| A frame revisited after out-of-order seeks | ≥ `validation.order_independence_min_psnr_db` (70 dB) | lld/03 §2.13, rule 1 |
| A fresh page reproduces a frame | ≥ `validation.repeat_min_psnr_db` (50 dB) | lld/03 §2.13, rule 4 |
| Reference frames, "same" against "changed" | ≥ `regress.psnr_min_db` (50 dB) | lld/09 §5 |
| Exported frames against the accepted render | 30 frames at ≥ 35 dB | F-04 |
| Stale frames with the acknowledge protocol | 0 wrong captures | S4 C: 0 of 900 |
| Colour chart | Final chain within 1 level of 255, JPEG chain within 2; all four colour tags as set | lld/03 §2.9; batch 2a |
| Mux offset | Within −5 / +15 ms | F-03; batch 2a measured 0 samples |
| Frame counts | Exact per chunk and in the joined file, uniform timestamps; `nb_read_frames` = N | M-05; F-01 |
| Decoded audio length | At most 1,024 samples over `round(N·T / flicks_per_sample)` | F-01 |
| Isolation and leaks | Nothing reaches a local listener; 0 UDP packets | S4 D; S7 B4 |

**Every check must be able to fail.** Each render test carries a control the check must catch: the no-acknowledge capture (S4: 299 of 300 wrong; S7: 5 of 300), planted +20 ms and −50 ms mux offsets (batch 2a recovered both exactly), an untagged encode, a component without the sandbox. A leak test run only inside the empty network namespace proves nothing, because the listener is unreachable by construction (S4 D); it also runs the CSP and the WebRTC flag without the namespace.

**Reference frames** live under `tests/fixtures/render/` as PNG files, each stamped with the environment hash it was made under. A test that finds another environment hash fails rather than compare. References are remade only by the qualification run R2 requires when the environment changes (lld/03 §2.8), recorded in the pull request that remakes them. This is also why render tests cannot run on a GitHub runner: its environment hash differs, so they would fail by design.

**Memory.** One render, acceptance or claim run at a time on the machine, from whichever worktree, behind the lock (L19), with R5's pool and memory guard ([environment](02-environment.md), section 10). An after-all hook fails the file if a `chrome-headless-shell` it started is still alive.

## 4. Fault injection

M3 builds these helpers under `tests/fixtures/faults/`. The acceptance cases and the `R5-5` and `H12` claim tests use them.

- **Kill points.** Named points in the code under test where the test kills the process with SIGKILL. The code runs in a child process; when the environment names a kill point, the hook there kills the child, and otherwise it does nothing. Names are `snake_case`, fixed in M3's work package: for example, after a paid response is spooled and before its commit (A7a); inside a grouped commit (`H12`, `R5-5`); during capture, encode and a model stream (`R5-5`). Where the hook lives is the implementer's choice; one function in `packages/foundations`, which every package already imports, is recommended. It reads one environment variable, never project data or model output, and a reviewer confirms that (A:testing-10).
- **An abrupt VM stop.** A driver on Windows runs a write load in WSL, terminates WSL with `wsl.exe --terminate` at a seeded random moment, restarts it and checks the database (H12 at M3; L1). Terminating WSL ends every WSL process, so the drill runs with nothing else using WSL. Its result is labelled "abrupt VM stop", never power loss.
- **Held jobs.** A stub capability that waits on latches the test releases: before running, and after its result is ready but before completion commits. A1 holds a component-author job across a promotion; A11 cancels at the second latch, in both orders.
- **Dropped replies.** A fake paid adapter that sends, then loses the reply after the request went out, once or twice (A7b).
- **A mux that drops audio.** A `film.mux` adapter that exits cleanly with a file lacking its audio stream, for a set number of attempts: once (the re-run succeeds) and twice (the state becomes `blocked`) (A8).
- **Stubs:** the fake author and fake paid adapter R10 names for M3, and a fake clock for watchdogs, coalescing windows and heartbeats.

## 5. Acceptance cases A1 to A14

Each case asserts R10's "Observable" text (lld/10 §3.2) and is written by a test author, never the implementer.

| Case | First passes | File in `tests/acceptance/` |
|---|---|---|
| A1 stale worker | M3 with a fake author; M4 with the real author (FR11) | `a01-stale-worker.test.ts` |
| A2 coupled change | M10 | `a02-coupled-change.test.ts` |
| A3 provisional bound changes | M10 | `a03-provisional-bound.test.ts` |
| A4 cross-layer effect | M10 | `a04-cross-layer-effect.test.ts` |
| A5 experiment rollback, `restore` | M10 | `a05-experiment-rollback.test.ts` |
| A6 defect kept in a preview | M6 | `a06-preview-defect.test.ts` |
| A7 crash after a paid call; lost reply | M3 with a fake paid adapter; M5 with the real voice adapter (FR11) | `a07-paid-crash.test.ts` |
| A8 missing audio | M6 | `a08-missing-audio.test.ts` |
| A9 corrected fact | M8 | `a09-corrected-fact.test.ts` |
| A10 repaired, still imperfect | M6 | `a10-partial-repair.test.ts` |
| A11 cancellation races completion | M3, against stubs | `a11-cancel-race.test.ts` |
| A12 budget runs out | M6 | `a12-budget-exhausted.test.ts` |
| A13 Director cannot write its own passes | M2 at the patch level; M6 in full, through the Director's session | `a13-field-authority.test.ts` |
| A14 treatment search | M6, on the live data-reel run | `a14-treatment-search.live.test.ts` |

Stub and real-part runs of one case are separate suites in one file. A passing case runs at every later milestone. Whether a real-part run is live or replayed is left to its work package, since it changes no module, persisted name or specified behaviour (A:testing-7): A1 runs once live with the real `component_author` at M4 and keeps a replay variant (M4-12); A7 runs live with the Kokoro adapter at M5, within a $0.02 ceiling (M5-10); later milestones replay. A11 needs no real-chunk run: R10 assigns it to M3 against stubs, and its latches already force the timing race.

## 6. Claim tests

Every row of R10 §2.2 becomes a test or a recorded measurement in `tests/claims/`, named by its claim ID (`R2-S8.test.ts`; `H12-abrupt-vm-stop.test.ts` and `H12-grouped-rollback.test.ts` for H12's two halves, L1; `.live.test.ts` where it calls MiniMax or OpenRouter). Each writes its measured values to `docs/impl/reports/claims/<ID>.json` for the milestone report. A live claim stays inside the cap its stage design gives and inside its work package's ceiling in [spend](04-spend.md).

**Claims due by M6:**

| Claim | At | Measured | Pass criterion |
|---|---|---|---|
| `R2-S8` | M1 | Host and assets served by interception under frame control, in the empty namespace; a component tries `file:` URLs and S7's navigation routes | Correct frames; nothing served but `/host/<hash>` and `/asset/sha256/<hex>`; no attempt succeeds (lld/03 §2.6, §9) |
| `R2-S9` | M1 | Latin, CJK, Arabic, Hebrew and emoji; the fonts Chrome reports | At M1, one machine: `CSS.getPlatformFontsForNode` reports only pinned families, a font in the user's font directory is never reported, and two fresh browsers agree at ≥ `validation.repeat_min_psnr_db` (50 dB), byte identity recorded but not required. At M11: both environments report the same fonts and every frame is ≥ `regress.psnr_min_db` (50 dB) (A:testing-1a) |
| `R2-S10` | M1 | A fresh browser's chunk against a reused browser's tenth; 24 layers for 1,500 frames | Every frame of the tenth chunk ≥ `validation.repeat_min_psnr_db` (50 dB) against the fresh browser's; 0 wrong frames on the frame-number check, 0 missing screenshots after `capture.retry`, peak resident memory ≤ `browser.mem_budget_mb` (950) (A:testing-1b) |
| `R2-S12`, first part | M1, M6 | M1: backdrop blur over two iframes; a sprite sheet from the asset path. M6: hide, isolate and tint against known pixels; `DIAG_UNSUPPORTED` on Canvas | M1: the blur within 1 level per channel of the same scene in one plain document, outside a border as wide as the blur radius; the served sheet ≥ 50 dB against the inlined one. M6: hide, isolate and tint within 1 level of known pixels; a Canvas mark returns `DIAG_UNSUPPORTED` (A:testing-1c) |
| `R4-SP1` | M2 | Property tests of schedules and injected conflicts; time per pass at 300, 800 and 1,000 points, 90-second project | Every property holds; compile within `compile.budget_ms` (3,000), the limit that reopens D8, at `timing.max_points` (1,000) (lld/05 §5, §9) |
| `R4-SP2` | M2 | One unit rendered whole and from pruned slices; PSNR per frame | Every frame ≥ `validation.repeat_min_psnr_db` (50 dB), frame counts equal (A:testing-1d; B:O16) |
| `H12` | M3 | `FULL` commits across an abrupt VM stop: WSL terminated from Windows while a write load runs (L1); one member rolled back in a grouped commit | No acknowledged `FULL` commit lost; the rolled-back member leaves no trace and the rest commit. The result is labelled "abrupt VM stop"; true power loss on a deployment disk stays ASSUMED until M11 (L1) |
| `R5-5` | M3 | Node killed during capture, encode, a model stream and a grouped commit | Orphan process groups removed; spools salvaged (lld/06 §9) |
| `R3-K2`, residual | M4 | Patch validity on the first golden brief's vague requests; paging at the page cap | Recorded, not gated (A:testing-1f); batch 3 measured 88% valid first time, 98% within two repairs |
| `R3-K4` | M4 | Tokens of the `outline`, `card`, `full` and `timeline` views, synthetic 30-shot project | Each page within `tool.result_max_tokens` (2,000; `project_read` 4,000); paging correct (lld/07 §5) |
| `R4-SP5` | M4 | Twenty seeded conflicts given to MiniMax-M3 as witnesses | Share fixed by one patch, recorded, not gated (A:testing-1f); the lead states the rewording rule before the run (C:M4-O4) |
| `R5-2` | M4 | Aborted stream, forced 4xx, repeated request; ceiling $0.05, inside M4-04's $0.80 (M4 §"Live-call budget") | Refused requests unbilled, aborted streams billed for tokens produced, against the plan's usage figure, which the session asks the user for once, before and after the probe. If it is not supplied, the billing half is recorded `UNKNOWN` and the build continues (L17) |
| `R5-3` | M4 | Rate-limit scope and recovery on the subscription key kept by U11: about 300 tiny Flash requests in 60 to 90 s with a trickle of MiniMax-M3, never more than 8 in flight; ceiling $0.15, inside M4-04's $0.80 | Recorded: the 429s, codes, headers and recovery time, and whether MiniMax-M3 is affected. The user is told before the burst (A:testing-5) |
| `R6-S11` | M4; every model pin change | Version header, streamed tool input, moderation, cache hits with images and thinking, dropped thinking blocks; conformance test; ceilings $0.25 for the transport facts and $0.20 for the conformance test, inside M4-04's $0.80 | Every tool's arguments arrive type by type as sent (J4); the rest recorded |
| `R7-A2`, with `R9-3`'s word-time half | M5 | The voice engine, Kokoro-82M through OpenRouter (U17), returns no timing, so every take is `aligned` (U18): the forced aligner's word starts against signal onsets after pauses, as spike V1 measured, because Whisper's word times are less accurate than the aligner's (L11); ten lines. The result decides whether word-by-word caption highlighting may be on | At least `align.lipsync_min_fraction` (0.95) of words start within 40 ms early and 60 ms late (R1 §1.8; L9; A:testing-1e), a starting value calibrated here; spike V1 measured 69 of 72 |
| `R9-3` | M5 | WER on correct takes, dry and over music, and on planted word and number swaps, after one normaliser for numbers, times, abbreviations and names (L13) | Correct takes under `stt.wer_max_take` (0.10) dry and `stt.wer_max_final` (0.15) over music, planted errors above (lld/09 §8; R10 "separate good takes from bad"); a take of at most `stt.short_take_words` (10) words passes with at most `stt.short_take_max_errors` (1) errors, starting values calibrated here (L13) |
| `R9-2` | M6 | Planted defects in the S3 and S6 components; hits, false alarms; contrast against hand measurement | Recorded, not gated (A:testing-1f) |
| `R9-4` | M6 | Reviewer recall on 20 real shots, by evidence type; ceiling $0.85, inside M6-12's $0.97 (M6 §8) | Recorded, not gated (A:testing-1f) |
| `R9-7` | M6 | Whole-film reviews of real reels | Recorded, not gated (A:testing-1f); ASSUMED, its limitation recorded on every deliverable |
| `R6-S10`, residual | M6 | The first long real session, at 150,000 tokens or more: restarted run against non-restarted | As batch 3 judged it: nothing repeated, skipped or contradicted, every handle used correctly (lld/07 §8) |

`R9-6` is not run (U7). The other rows fall due at M7 to M10.

**When a claim fails,** the orchestrator applies the fallback R10 names for that row, records it as a build revision in section 18 of the integration decisions before the dependent code is written, and continues (orchestration rules, section 6). If the fallback fails too, it stops and asks. The fallbacks of the measurements recorded without a gate (`R3-K2`'s residual, `R4-SP5`, `R9-2`, `R9-4`, `R9-7`) are changes of wording or calibration that the lead applies by judgement, recorded as a build revision with the figures that led to them (A:testing-1f). A threshold of a hard check, or any other `human` setting (G15), is moved only by the user. A test is different: inside its own temporary Space it may set any `human` setting, acting with the `human` level there, which changes no default; the real Space is never touched by a test (L8).

## 7. Golden briefs

**Where:** `tests/golden/<domain>/`, one folder per R10 domain: `abstract_motion_graphics`, `data_reel`, `historical_comedy`, `science_documentary`, `art_history`, `software_tutorial`. Each holds:
- `brief.json`, the brief as the system receives it, with its hard constraints;
- `expected_properties.json`, facts about the delivered file and record that code can check: duration, size, narration and captions present or absent, `completion_state`, every hard check on the exported file passing (C9), and from M6 the treatment search (at least two distinct treatments, a recorded comparison, a `decision` naming the alternatives; lld/10 §3.1);
- `expected_constraints.json`, the hard constraints a correct Quality Intent derives from the brief, in R3's `hard_constraints` shape, each with the proof it should carry, `by: check` wherever a deterministic check can prove it (FR4, G19).

The test author writes a brief's expected files before its first run; the orchestrator reviews them. They hold nothing code cannot check.

**A run is judged** on four things:
1. No human input after the brief (R10, M4 and M6).
2. Every expected property holds.
3. The deliverable record's `brief_constraints` (K11) beside `expected_constraints.json`. Coverage is code-checked (`BRIEF_CONSTRAINT_UNCOVERED`). Whether a derived constraint captures the brief is a model judgement code cannot verify (G19), so a reviewer subagent reads the comparison and it goes into the milestone report: the comparison is reported, not gated, and a mismatch does not by itself fail M6 (G19; K11; R10 §7; A:testing-8).
4. From M6, R10 §3.3's measures are recorded against the R0 targets: reported, not gated.

**A full run is a live work package** with a ceiling in [spend](04-spend.md) (M4-13 at most $1.80 of M4's $3.30; M6-13 at most $2.60 of M6's $3.92, $2.40 for the run and $0.20 for the `R6-S10` branch). The orchestrator stops before a run would cross it. A golden run is a test, so it runs in its own temporary Space, never the real one, and may set `budget.hard_cap_usd`, a `human` setting, to the work package's remaining ceiling there, so that the Scheduler enforces the ceiling as well (L8). Golden runs are not part of `npm test` or `test:accept`; A14 is the data-reel run itself.

## 8. Rules

1. **A test is never weakened, skipped or special-cased to pass** (standing rule 5). A wrong test is fixed in its own commit, with the reason in the pull request.
2. **The test author is not the implementer** for acceptance and claim tests (orchestration rules, section 3). The author works from R10 and the design sections, not from the code. The implementer does not edit those files; changes go through the orchestrator.
3. **Flaky tests are fixed or quarantined, never retried until green.** No retries and no sleeps. Each flaky test gets an issue of its own. A quarantined test is listed in `tests/quarantine.json` with its reason, date, work package, issue number and the evidence of the flake; it still runs and is reported on its own line. A quarantined acceptance case or claim test means the milestone is not done.
4. **Every diagnostic code has a test that produces it.** Each package exports the codes it can return, and `npm run check` fails when a code appears in no test assertion.
5. **Known failures are registered, not skipped** (U32). A test that is expected to fail for now, such as an acceptance case or claim test whose code a later work package builds, is listed in `tests/known-failures.ts`. Each entry gives the test, the reason, the issue number, the work package expected to make it pass, and a check that matches the expected failure by its diagnostic code or message, so that only that failure is excused. Every test command consults the registry: an unlisted failure fails the run; a listed test that fails for another reason fails the run; **a listed test that passes fails the run until its entry is removed.** The pull request that makes it pass removes the entry and closes the issue. This lets the whole suite run from M0 on ([study](research/knowscroll-workflow.md), "What to copy", row 7). The milestone report lists the open entries.

## 9. What a milestone report shows

- The commit, the `env:check` result, and the environment hash the tests ran under.
- Every command run, verbatim, where it ran (Windows, WSL mirror), with counts passed, failed, known-failing and quarantined, and duration; `npm run test:linux` included (L18).
- The milestone's pull requests, and the result of the workflow run on the milestone tag.
- The open entries of the known-failures registry, each with its issue.
- For M0 and M2 only: the three-layout timings (M0-01b's, and the re-run at the end of M2, L43) and whether any level moved (section 1).
- The acceptance list item by item, with command and result.
- Each claim due: measured values, outcome, and any fallback with its build-revision number.
- Live spend for the milestone and the running total, from the ledger.
- **What was not run, and why:** for example the two-machine half of `R2-S9` (M11), true power loss on a deployment disk, which the M3 abrupt VM stop does not test (M11; L1), `R9-6` (U7), the billing half of `R5-2` when the user gave no usage figure (L17), or a live test held back by its ceiling.

## 10. Resolved points

The points this document raised are closed by section 18 of the [integration decisions](../lld/11-integration-decisions.md), with the classes of `impl/research/open-points-A.md` (rows `A:testing-1a` to `A:testing-10`) as the lead ruled on them; points 11 and 12 were raised after that report and were ruled on by the lead (L18, L43).

| # | Point | Resolution |
|---|---|---|
| 1a | **`R2-S9`'s pass number** | Decided (A:testing-1a): at M1 on one machine, only pinned families reported and two fresh browsers at ≥ 50 dB; at M11, the same fonts on both environments and every frame ≥ `regress.psnr_min_db` (section 6; M1-10) |
| 1b | **`R2-S10`'s "same pixels"** | Decided (A:testing-1b): every frame of the reused browser's tenth chunk ≥ 50 dB against a fresh one, with the counts and memory limit of section 6 (M1-10) |
| 1c | **`R2-S12`'s known-pixel tolerance** | Decided (A:testing-1c): within 1 level per channel for the backdrop blur and the M6 modes; ≥ 50 dB for the served sprite sheet (section 6; M1-10) |
| 1d | **`R4-SP2`'s "within tolerance"** | Decided (A:testing-1d, with B:O16): every frame ≥ `validation.repeat_min_psnr_db` (50 dB), frame counts equal (section 6; M2-12) |
| 1e | **`R7-A2`'s share of words** | Decided (L9, L11; A:testing-1e): at least `align.lipsync_min_fraction` (0.95) of word starts within −40 / +60 ms of the signal onsets after pauses, a starting value calibrated at M5 (section 6; M5-10) |
| 1f | **Measurements with no criterion** (`R3-K2` residual, `R4-SP5`, `R9-2`, `R9-4`, `R9-7`) | Decided (A:testing-1f): recorded without a gate; the milestone passes when the measurement ran and its values are in `docs/impl/reports/claims/<ID>.json`; fallbacks are applied by the lead's judgement and recorded with their figures (section 6) |
| 2 | **`H12` method** | Decided by the lead (L1), with no user action: the deployment disk is WSL2's ext4 disk on this machine; at M3, WSL is terminated from the Windows side while a write load runs and the database is checked on restart, labelled "abrupt VM stop". True power loss stays ASSUMED until M11 (sections 4 and 6; M3-10) |
| 3 | **`R2-S9` needs a second clean environment** | ANSWERED (A:testing-3): R10 §2.2 places `R2-S9` at M1 and M11, and its fallback reads "between laptop and VM", so the one-machine half is M1's and the comparison waits for the VM at M11 (U8). U27 keeps render tests off GitHub, and a container runtime would be a global install (R2 §9) |
| 4 | **`R2-S12` split** | ANSWERED (A:testing-4): R10 §2.2 assigns `R2-S12` to M1 and M6, and R2 §9 runs it "at M1 and M6 as assigned in R10", so the backdrop and asset parts are M1's and the diagnostic modes M6's, where R10 §4.2 builds them |
| 5 | **`R5-3` and the subscription key** | Decided (A:testing-5): re-scoped to the key kept by U11 (section 6); R5 §8's pay-as-you-go statement stays ASSUMED, and R10's fallback holds either way |
| 6 | **`R5-2`'s billing figure** | Decided by the lead (L17): the session asks the user once, at M4, for the plan's usage figure before and after the probe; without it the billing half is recorded `UNKNOWN` and the build continues (section 6) |
| 7 | **Real-part runs** | IMPLEMENTATION DETAIL (A:testing-7), left to the implementer: live or replayed changes no module, persisted name or specified behaviour; M4-12 and M5-10 have chosen, and A11 needs no real-chunk run (section 5) |
| 8 | **Golden briefs** | ANSWERED (A:testing-8): the constraint comparison is reported, not gated (G19; K11; R10 §7); what code can check is already enforced by `BRIEF_CONSTRAINT_UNCOVERED` (R3 §2.7), and the test author writes the expected properties from R10 §3.1 before the first run (section 7) |
| 9 | **Build-run budget** | Decided by the lead (L8): a test may set any `human` setting, `budget.hard_cap_usd` included, inside its own temporary Space, acting with the `human` level there; the real Space is never touched by a test (sections 6 and 7) |
| 10 | **Kill-point hooks** | IMPLEMENTATION DETAIL (A:testing-10), left to the implementer: while unset the seam has no persisted name and no specified behaviour. One function in `packages/foundations` reading one environment variable is recommended, with point names fixed in M3's work package and a reviewer confirming the variable is read only from the environment (section 4; M3-03) |
| 11 | **Unit tests that need Linux itself** | Decided by the lead (L18): such tests live in `*.linux.test.ts` files, left out of `npm test` on Windows and run by `npm run test:linux` in WSL on the mirror and in the GitHub Ubuntu job; they count toward "done" (section 1). M0's acceptance item 2 runs in WSL |
| 12 | **When to measure the three layouts again** | Decided by the lead (L43): M0-01b's timing script runs again at the end of M2, when the code base is large enough to matter, and the numbers go into the M2 report. A test level moves to a different layout only if it is clearly faster there, and the change is noted in [conventions](01-repo-and-conventions.md) section 9 (section 1; M2's acceptance list) |
