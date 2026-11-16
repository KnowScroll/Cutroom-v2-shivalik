# Lead decisions on the open points (15 November 2026)

Three research reports proposed an answer for every open point the milestone writers raised:
[open-points-A](open-points-A.md) (M0, M1, environment, testing), [open-points-B](open-points-B.md) (M2, M3) and [open-points-C](open-points-C.md) (M4, M5, M6). This file is the lead's ruling on them. It is the input for the writers who apply the decisions; the binding record is section 18 of `lld/11-integration-decisions.md`, which is written from it.

## 1. The general ruling

- **Every proposal classed DESIGN GAP in the three reports is accepted as proposed,** unless section 2 below changes it.
- **ANSWERED** points need no decision: the milestone documents cite the design section the report names.
- **IMPLEMENTATION DETAIL** points are left to the implementer; the milestone documents say so.
- **NEEDS MEASUREMENT** points are accepted as the reports state them: the measurement, the work package that makes it, and what applies until then.
- **NEEDS THE USER** points are ruled on in section 3.
- Where two reports decide the same thing differently, report B's "SD" decisions win for shared types, codes and tables, and section 2 wins over everything.

## 2. Rulings that add to or change the proposals

| # | Subject | Ruling |
|---|---|---|
| L1 | Power loss (B: M3 point 2; A: testing 2; H12) | At M3 the build runs an abrupt-stop drill: WSL is terminated from the Windows side while a write load runs, and the database is checked on restart. The result is labelled "abrupt VM stop", not power loss. True power loss on a deployment disk stays ASSUMED until M11, when a VM exists. No user action. |
| L2 | Grouped commits (B: SD4, X1; A's last observation) | Project Core owns the grouped writer; M3-01 wraps it. A `FULL` member closes any open `NORMAL` group and commits in its own group at `FULL`. M0-06 keeps its test of whether SQLite allows the level to change inside a transaction and records the result; the rule above is correct either way. |
| L3 | Rights fields per status (B: O10, low confidence) | Accepted as the starting rule. It is confirmed or corrected when the rights rule table is seeded at M6. |
| L4 | Shot contiguity and `TIMELINE_GAP` (B: O13) | Accepted: consecutive shots are contiguous; `TIMELINE_GAP` is raised only for sound, cues or events solved after the last shot ends. |
| L5 | The `evidence` table and `closure_hash` (B: X2) | Built by M3-07 in project-core, before it writes records. |
| L6 | Rounding ties (A: M0 point 7) | Round half up, computed exactly on integers, at every "round to nearest" in R1 and R3. Recorded as **R1 Revision 3** and reported to the user. |
| L7 | `fill`, `effect`, `Gradient` and the two new `layer.source` kinds (A: M1 point 1) | Accepted. R2 owns the three records; R3 adds `{fill}` and `{effect}` to `layer.source`; R4 lowers them. |
| L8 | Lowering `budget.hard_cap_usd` in tests (A: testing 9) | Tests may set any `human` setting inside their own temporary Space, acting with the `human` level there. The real Space is never touched by a test. |
| L9 | Lip-sync fitness (A: testing 1e; C: M5 O2b) | New R7 setting `align.lipsync_min_fraction` = 0.95 (`director`): the share of words whose start falls within 40 ms early and 60 ms late. It is a starting value calibrated at M5 (`R7-A2`). Spike V1 measured 69 of 72. |
| L10 | Word timing and speech-to-text (C: M5 O1a; spike V1) | **Word timing:** CTC forced alignment in Node with a wav2vec2-base model (Apache-2.0) run through ONNX, with our own trellis alignment of the known script. **Transcript:** Whisper `small.en` in Node through ONNX. Both run locally; no Python worker; no hosted speech-to-text. The MiniMax speech-to-text named earlier (`asr-1.0`) is not used. Model files are pinned by hash in `tools/pins.json` and downloaded during environment set-up, never committed. That both run on Linux in WSL is ASSUMED (the spike ran on Windows) and is checked by the first M5 work package; the fallback is the WASM backend. Word ends came out about 83 ms early in the spike: a word's end is taken as the earlier of the next word's start and the aligned end plus a measured offset setting `align.word_end_offset_ms` (starting value 80, calibrated at M5). |
| L11 | The reference for `R7-A2` and what A-02 can say (C: M5 O2a) | `R7-A2` is measured against signal onsets after pauses, as spike V1 did, because Whisper's word times are less accurate than the aligner's. The word-level part of A-02 reports `UNKNOWN` with a coverage record. |
| L12 | Kokoro request details (C: M5 O8a; spike V1) | The adapter requests `response_format: "pcm"` (signed 16-bit little-endian, 24 kHz, mono: VERIFIED by spike V1) and pins the provider with a `provider.only` field, set by a new R7 setting `voice.provider_only` = the DeepInfra provider as spike V1 names it (`human`, because it changes the price). Spend for each generation is read from OpenRouter's generation look-up (`total_cost`), which satisfies U15 for speech. Output is not byte-repeatable, so a take is stored once and never regenerated to reproduce it. |
| L13 | Transcript check on short lines (C; spike V1) | Before comparing, both the script and the transcript pass through one normaliser for numbers, times, abbreviations and names. Two new R9 settings give the starting rule for short takes, calibrated at M5 (`R9-3`): `stt.short_take_words` = 10 and `stt.short_take_max_errors` = 1; longer takes use `stt.wer_max_take` as before. A-01 does not gate delivery until the normaliser's tests pass. |
| L14 | Rights for synthetic speech (C: M6 O6a, O6b) | The rule table seeded at M6 has an entry that makes Kokoro-82M speech through the pinned provider `eligible`. Basis: the model's Apache-2.0 licence (research 11). That the provider's terms place no further limit on the output is ASSUMED and reported to the user. |
| L15 | Figures in the data-reel golden brief (C: M6 O9) | The brief supplies its own five monthly figures as invented test data, labelled as such in the brief, with a source of type `user`. No real-world statistic is claimed and no research is needed until M8. |
| L16 | Visible AI notice (C: M6 O7a, O7b, O7c) | The switch is `quality_intent.disclosure.visible_notice` (a `human` field), not a delivery-profile field; U10's wording is corrected. Turning it on before the notice overlay exists reports `CAPABILITY_BLOCKED`. The overlay is not on the thin-film path. The suggested platform-disclosure sentence is the report's proposal and may be reworded by the user. |
| L17 | MiniMax billing probe (A: testing 6; C: M4 O5) | The session asks the user once, at M4, for the plan's usage figure before and after the probe. If the user does not supply it, the billing half of `R5-2` is recorded `UNKNOWN` and the build continues. |
| L18 | Linux-only unit tests | Tests that need Linux process behaviour (sockets, `/proc`, kill signals) live in files named `*.linux.test.ts`. They are left out of `npm test` on Windows, run by `npm run test:linux` in WSL on the mirror and in the GitHub Ubuntu job, and count toward "done". |
| L19 | The WSL mirror | The tool folder is `~/.cutroom-build/.tools`. The key file's path is passed in the environment variable `CUTROOM_ENV_FILE`. `wsl:sync` copies the working tree as it is, including uncommitted changes, honouring `.gitignore`. Each Git worktree syncs to its own mirror folder under `~/.cutroom-build/`. Render tests from different worktrees do not run at the same time. |
| L20 | `impl/STATE.md` | It changes only at the end of a milestone and at a stop, in a small pull request of its own. Per-package status lives in the issues. |
| L21 | The guard hook | It also refuses `git clean` with `-x` or `-X` (which would delete `.env`), and any command that names a path under `C:\Users\XZNON\Cutroom`. The bootstrap push of documents to `main` is the one push made before the hook exists. If Claude Code needs a restart or an approval to load the hook, the session stops and asks. |
| L22 | Standing rule on user details | Nothing about the user goes into a request to a model, speech or web service. GitHub is the project's chosen home; the documents pushed there are the project's own. |
| L23 | Staged delivery before M6 (C: C1.1) | Accepted: at M4 and M5 a run ends with a staged `delivery_finalize` at grade `preview` that writes no deliverable record. |

## 3. Points marked for the user

| Point | Ruling |
|---|---|
| Power-loss method | Decided by the lead (L1). |
| Budget cap in tests | Decided by the lead (L8). |
| Both keys present in `C:\Users\XZNON\cutroom-v2\.env` | Confirmed on 15 November 2026 by listing variable names only. Any document that still names another key path is corrected. |
| MiniMax usage figure for `R5-2` | Optional; asked once at M4 (L17). |
| Rights entry for Kokoro speech | Decided by the lead (L14); the unverified part is reported to the user. |
| Data-reel figures | Decided by the lead (L15). |
| Actions on GitHub appear under the user's own account | Reported to the user; the user asked for this set-up. |

## 4. Follow-up rulings (after the first apply pass)

The writer applying the batch to R5–R10 raised six points. Rulings:

| # | Subject | Ruling |
|---|---|---|
| L24 | `delivery_profile.ai_disclosure` after L16 | It stays a `human` field with the shape report C proposed (C:M6-O7a): the platform disclosure label and the suggested disclosure text for upload. The on-screen notice switch is `quality_intent.disclosure.visible_notice` (L16). The two are different things. |
| L25 | L15 versus C:M6-O2 | L15 means no web research before M8. The brief-only research request at M6 reads claims and figures from the brief and makes no web call. |
| L26 | Verified figures at M8 | The data reel's real, verified figures are chosen by the M8 milestone document, which is written after the thin film. Until then the data reel uses the invented figures of L15. |
| L27 | Where the model files come from (C:M5-O1a) | Published ONNX exports are downloaded and pinned by hash. If no published export exists for a model, it is exported once from the original weights by a pinned script during environment set-up, and the result is pinned by hash. Model files are never committed. |
| L28 | F-08's class | The check catalogue wins: F-08 is corrective. C1.3's required-evidence table is corrected to match. |
| L29 | A-01 in the required set | Accepted as the writer applied it: A-01 joins the required set for delivery once the normaliser's tests pass (L13). |

## 5. Second follow-up rulings

The writer of section 18 and of R1–R4 raised these. Rulings:

| # | Subject | Ruling |
|---|---|---|
| L27 (revised) | Where the model files come from | **Replaces L27.** Published ONNX conversions often state no licence of their own, so we do not depend on them. The wav2vec2-base and Whisper `small.en` ONNX files are exported once from the original weights (Apache-2.0 and MIT) by a pinned export script during environment set-up, and the exported files are pinned by hash in `tools/pins.json`. Model files are never committed. |
| L30 | Who records the measured set (B:O14-measured) | The capture engine records it in the probe sidecar, beside the probe values it already records. The M1 work package for the capture engine writes the field into R2 as a build revision before the code. |
| L31 | `meta` fields of an `audio_score` component (C:M5-O3) | The M5 work package for music defines them in R2 as a build revision before the code, using the score format decided in report C. |
| L32 | Refusal code for a proof that names an unregistered check (C:C1.5, B:O9) | `UNKNOWN_CHECK`, owned by Project Core (validation stage 4), in the pattern of `UNKNOWN_CONTROL`. |
| L33 | `UNIT_TOO_LARGE` | Stays as the design states it. It does not block a `frozen` compile. |
| L34 | Other roundings (R4's formulas, R3 rule 3) | L6 applies to every "round to nearest" in the design, including R4's position formulas and R3 rule 3's decimal places: exact halves round up (towards +∞). |
| L35 | Identifiers | Section 18 of `lld/11` is canonical. Milestone documents may keep their letter-suffixed labels, and section 18.3 lists them as aliases. A citation of an ANSWERED or IMPLEMENTATION DETAIL point cites the report row (for example `impl/research/open-points-A.md`, A:M0-2). The descriptive labels in `lld/07` and `lld/09` (such as "B:M3-9 (who draws)") are normalised to section 18's form. |
| L36 | U26 and L19 | L19 refines U26: `wsl:sync` copies the working tree as it is, honouring `.gitignore`, not only tracked files. Section 17.3's U26 gets a pointer to L19. |
| L37 | `delivery_profile.ai_disclosure` | As L24: it holds the platform disclosure label and the suggested disclosure text, with the shape report C proposed (C:M6-O7a). |

## 6. Third follow-up rulings (from the M4–M6 writer)

| # | Subject | Ruling |
|---|---|---|
| L38 | How and where the ONNX export runs (L27 revised) | It is a one-time set-up step, the first task of M5-03, run in WSL. A pinned export script under `tools/models/` runs in a throwaway Python virtual environment inside the WSL tool folder, with its packages pinned. It produces the two ONNX files, whose hashes go into `tools/pins.json`; later set-ups check the hash and skip the export if the files are present. This Python is a set-up tool only: the product's run time stays Node, and the design's Python worker is still not built. |
| L39 | A second permissive CTC model | None is named or needed. wav2vec2-base (Apache-2.0) is the aligner's model. Only if the M5 calibration fails does M5 choose another, after a licence check recorded in the M5 report. |
| L40 | Levels and ranges of the new settings | `align.word_end_offset_ms`: `director`, range 0 to 200. `align.lipsync_min_fraction`: `director`, range 0.5 to 1 (it is the threshold of an observational check). `stt.short_take_words` and `stt.short_take_max_errors`: `human` once A-01 joins the required set (thresholds of a hard check, G15 (b)), ranges 1 to 30 and 0 to 5. Until then they are `director`. |
| L41 | Splits made by the writers | M4-08 is now M4-08a and M4-08b; M6-04 is now M6-04a and M6-04b. Every reference to the old identifiers, including in section 18 of `lld/11`, means the split pair as the milestone documents assign the work. |

## 7. Fourth follow-up rulings (from the M0–M3 writer)

| # | Subject | Ruling |
|---|---|---|
| L42 | L20 against the bootstrap plan | `impl/STATE.md`, with its links to the issues, is written in the bootstrap commit, which is the one direct push to `main` (L21). No work package's pull request edits `STATE.md`; M0-01a's text is corrected. After that, L20 applies. |
| L43 | Re-measuring the three layouts (testing point 12) | The timing script from M0-01b is run again at the end of M2, when the code base is large enough to matter, and the numbers go into the M2 report. A test level moves to a different layout only if it is clearly faster there; the change is noted in conventions section 9. |
| L44 | Unnamed values | The event written when the accepted head moves has `type` `head_accepted`. The `wipe` transition is lowered in M2, by the work package that lowers the other transitions. |
| L45 | One mirror per working tree (L19) | Confirmed: the main working tree syncs to `~/.cutroom-build/main/`, and each Git worktree to `~/.cutroom-build/<worktree name>/`. |
| L46 | Corrections in files that writer could not edit | `CLAUDE.md` rule 11 and its command list gain `test:linux` and one mirror per working tree; `impl/04` records L8; R2 §2.6 states `transform-origin` as decided; R3 places `ingest` in project-core as M2-05 builds it; R6 relays `STALE_READ_SET`. These are applied in the final consistency pass. |
