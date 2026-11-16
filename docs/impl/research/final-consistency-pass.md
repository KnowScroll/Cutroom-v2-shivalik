# Final consistency pass (15 November 2026)

## Summary

This pass recorded the lead's follow-up rulings L24 to L46 (sections 4 to 7 of [lead-decisions](lead-decisions.md)) in `lld/11` as **section 18.5**, with L27 given once, in its revised form. It also added the U26 pointer (L36) and the notes on the split work packages in 18.1 and 18.4 (L41). It then applied the rulings to the stage designs (R3, R4, R5, R7, R9) and to the build documents (`impl/00` to `impl/04`, the seven milestone documents, `CLAUDE.md`, `AGENT.md`). It fixed the stale references the earlier writers reported, and cross-checked the milestone documents against each other.

- **71 fixes**, listed below. Every edit was made in place; nothing was deleted except stale text inside the edited sentences.
- **Nothing was assigned.** Every item a milestone assumes is provided by an earlier milestone's list or work package. Three mismatches were on the naming side and were fixed: `Predicate`/`Need` were attributed to M3 in M4; M2 and M3 used capability names for M1's functions; `LINT.CLAIM_BOUND_CANVAS` was not named in M1.
- **9 points need a decision** (below). Where a ruling's text and the evidence it cites disagree, the ruling was applied and the disagreement is listed.
- One slip, corrected at once: while editing 18.1, a duplicate L22 row was inserted after L19 and immediately removed. L22 appears once (checked).
- **The v3.1 archive was never opened, read or searched.** One `ls docs/archive` at the start listed the file's name only. Every later search either named files explicitly or pruned or excluded `docs/archive`. `.env` was never read. Nothing under `C:\Users\XZNON\Cutroom` was touched.

## Fixed

| File | Section | What was wrong | What changed |
|---|---|---|---|
| `lld/11` | §17.3 U26 | No pointer to L19 (L36) | Pointer to L19, L36 and L45 added |
| `lld/11` | §18.1 (after the table) | L14 cites M6-04, now split (L41) | Note: M4-08 and M6-04 mean the split pairs |
| `lld/11` | §18.4 (after the table) | C:M6-O2 cites M6-04 (L41) | The same note |
| `lld/11` | new §18.5 | L24 to L46 not recorded | 23 rows, each with the documents it changes; L27 (revised) replaces the first L27 |
| `lld/04` R3 | §2.2 `delivery_profile` | `ai_disclosure` had no stated content (L24, L37) | `human` field holding the platform disclosure label and the suggested disclosure text; the notice switch is elsewhere |
| `lld/04` R3 | §2.1 rule 3 | Decimal rounding had no tie rule (L34) | An exact half rounds up |
| `lld/04` R3 | §2.4 stage 4 row | No code for a proof naming an unregistered check (L32) | `UNKNOWN_CHECK` (nearest registered checks) |
| `lld/04` R3 | §2.4 stage 7 rules | "Refused" with no code | Points to `UNKNOWN_CHECK` |
| `lld/04` R3 | §2.7 field write levels | `ingest` placement not tied to M2-05 (L46) | Entry point in project-core, built by M2-05 |
| `lld/05` R4 | D3 "Measured durations" | Rounding ties were not stated for R4's formulas (L34) | Every "round to nearest" in R4 rounds an exact half up |
| `lld/06` R5 | §2.4 "Events" | The head-accepted event's `type` had no name (L44) | `head_accepted` |
| `lld/08` R7 | §2.2.4 | Files "downloaded" or "exported from the Apache-2.0 originals" (old L27) | L27 revised and L38: a pinned export script in a throwaway Python virtual environment in WSL, run once, files pinned by hash; Python is a set-up tool only |
| `lld/08` R7 | §5 table | `align.*` had no level or range (L40) | `director`, 0 to 200 and 0.5 to 1 |
| `lld/08` R7 | §5 paragraph | `ai_disclosure` content was not stated (L24) | Label and suggested text; differs from the notice switch |
| `lld/08` R7 | §8 claims row | The licences row read only "Apache-2.0" | Whisper's code is MIT; files are exported (L27 revised, L38) |
| `lld/08` R7 | §9 `R7-A2` | Required agreement with a second CTC model (L39) | No second model; another model only if calibration fails, after a recorded licence check |
| `lld/09` R9 | §3.4 rules | `ai_disclosure` and `visible_notice` were not told apart (L24) | Both stated as different fields |
| `lld/09` R9 | §3.4 rules | "a code R3 chooses" (L32) | `UNKNOWN_CHECK` for an unregistered check |
| `lld/09` R9 | §3.6 required evidence | F-08 was treated as a hard check (L28) | F-08 is corrective; with U7 it has no subject, so it is not required |
| `lld/09` R9 | §3.8 level 1 | Profile field not described (L24) | Label and suggested text per output |
| `lld/09` R9 | §5 table | `stt.short_take_*` had no level or range (L40) | Ranges 1 to 30 and 0 to 5; `director` until A-01 is required, then `human` |
| `impl/00` | §2 step 6 | Did not say the bootstrap writes `STATE.md` (L42) | Written in the bootstrap commit; no pull request edits it, M0-01a's included |
| `impl/00` | §10 `STATE.md` row | "When" lacked the bootstrap (L42) | First in the bootstrap commit, then L20 |
| `impl/00` | §12 steps 4 to 8 | Issue numbers went into M0-01a's pull request; `docs/history/` was not staged | Issues created first, `STATE.md` written with their links and committed in the bootstrap commit; `docs/history/` staged |
| `impl/01` | §1 tree | Root listed a non-existent `VERIFICATION.md`; `docs/history/` and `tools/models/` were missing | Fixed to the new layout |
| `impl/01` | §1 WSL side | Mirror names not fixed (L45) | `~/.cutroom-build/main/` and `~/.cutroom-build/<worktree name>/` |
| `impl/01` | §3, §4 | "Work package M0-01" (split) | M0-01b |
| `impl/01` | §9 | L38, L45 and L43 not recorded | Dated entry; re-measurement at the end of M2 |
| `impl/02` | §1 tree | `<mirror>` placeholder; no `tools/models/` | Mirror names (L45); `models\` (L38) |
| `impl/02` | §2 build mirrors | "M0-01b fixes the folder names" (L45) | Names stated |
| `impl/02` | §9 speech model files | "downloaded during environment set-up" (old L27) | L27 revised and L38 |
| `impl/02` | §13 row 8 | No folder names | L45 names |
| `impl/03` | §6 `R5-2`, `R5-3`, `R6-S11`, `R9-4` | Caps $0.50, $1, $1, $2, which disagreed with the milestone ceilings | $0.05, $0.15, $0.25 + $0.20 (inside M4-04's $0.80), $0.85 (inside M6-12's $0.97) |
| `impl/03` | §7 | "M4 at most $4.00, M6 at most $4.00" | M4-13 $1.80 of $3.30; M6-13 $2.60 of $3.92 |
| `impl/03` | §1, §9, §10 point 12 | Re-measurement left undecided (L43) | Decided by L43; the M2 report holds the numbers |
| `impl/04` | §1 | L8 not recorded | Tests may set `budget.hard_cap_usd` in their own temporary Space |
| `CLAUDE.md` | rule 11 | No `test:linux`; one mirror (L18, L45) | `test:linux`; one mirror per working tree, with the names |
| `CLAUDE.md` | Commands | No `test:linux` | Added under WSL |
| `AGENT.md` | Read in this order | `lld/drafts/` named with the old path | Says once that `docs/lld/drafts/` was deleted on 14 November 2026 and is not read; there was no reading instruction to remove |
| `AGENT.md` | Known stale passages | `VERIFICATION.md` is now under `docs/history/` | Path and link fixed |
| M0 | Before M0-01: the bootstrap | Bootstrap order and `STATE.md` (L42) | Issues, then `STATE.md`, then the commit and the push; `STATE.md` in the bootstrap commit |
| M0 | M0-01a | Its package, build list and goal included `STATE.md` (L42) | Removed; out of scope with a reason; L20 and L42 added to Read first |
| M0 | M0-01b | "M0-01b fixes the folder names" (L45) | Names stated; L45 added to Read first |
| M0 | M0-02, M0-03, M0-04 | "Depends on: M0-01", which no longer exists | M0-01b |
| M1 | Provides | `LINT.CLAIM_BOUND_CANVAS`, which M6 assumes, was not named | Named (M1-07); measured-set field (L30) |
| M1 | M1-04 | No build revision for the measured-set field (L30) | First bullet: write the field into R2 §2.4 as a build revision |
| M1 | Resolved point 4 | `UNIT_TOO_LARGE` "not ruled on" | L33: stays as designed |
| M2 | §2 Provides | Event type not named | `head_accepted` (L44) |
| M2 | §3 From M1 | Capability names used for M1's functions | `chunkRender` and the others, which M3 wraps |
| M2 | M2-04 | `UNKNOWN_CHECK` placement (L32) | Out of scope; built in M6-04a |
| M2 | M2-05 | Event type (L44) | `head_accepted` in a rule and a test |
| M2 | M2-07 | Rounding tie (L34) | Exact half up, with M0-02's helper |
| M2 | M2-09 | `wipe` was out of scope (L44) | Lowered here, with a test; removed from Out of scope |
| M2 | §9 acceptance | No timing re-run (L43) | Item 7 |
| M2 | §10 O9, O14c | O9 still said "R9 must add a duration check"; O14c said `wipe` may wait | C:C1.5 and L32; L44 |
| M3 | §3 M1 | Capability names used for functions | Function names |
| M4 | What must already exist | `Predicate` and `Need` were under M3 (B:SD1) | Moved to the M0 row (M0-02); the M3 row names the `ReadinessOracle`; SDK and `test:live` traced to M0-01b |
| M5 | §2 | Model files "fetched at set-up" | Exported by `tools/models/` (L27 revised, L38) |
| M5 | M5-01 | No ranges or level for `align.*` (L40) | Added |
| M5 | M5-03 | The export step, its package and the licence wording (L27 revised, L38) | Export first, then the Linux check; `tools/models/`; Apache-2.0 and MIT |
| M5 | M5-05 | No build revision for `audio_score` `meta` (L31) | First bullet; L31 added to Read first |
| M5 | M5-09 | No ranges or levels for `stt.short_take_*` (L40) | Added; L29 and L40 added to Read first |
| M5 | M5-10 | Second CTC model in Build and Tests (L39) | Removed; licence-check rule; L39 and L40 added to Read first |
| M5 | §8 O1a, O2a | Old L27; second model | L27 revised and L38; L39 |
| M6 | §4 F-08 row | "`NOT_APPLICABLE`" as a hard check (L28) | Corrective, not required |
| M6 | M6-04a | "the code R3 gives" (L32) | `UNKNOWN_CHECK`, with a test |
| M6 | M6-04b | L25 and L26 missing | Rule added; Read first updated |
| M6 | M6-08 | F-08 in the hard list (L28); `ai_disclosure` (L24); L29 | Corrected; Read first updated |
| M6 | M6-11, M6-13 | L26 missing | Added (rule, Read first, Out of scope) |
| M6 | §9 O2, O3, O7a, O9 | L25, L32, L24/L37, L26 missing | Added |

## Assigned

| Item | Assumed by | Assigned to |
|---|---|---|
| None | | Every assumed item is provided by an earlier milestone's list or work package. Three naming mismatches were fixed instead (see "Fixed": M4's `Predicate`/`Need`, M2 and M3's names for M1's functions, M1's `LINT.CLAIM_BOUND_CANVAS`) |

## Needs a decision

1. **L24/L37's "shape report C proposed (C:M6-O7a)".** Report C's O7a proposed `{visible_notice: bool}`, which L16 overruled. The rulings' content (the platform disclosure label and the suggested disclosure text) was applied in R3, R7, R9 and M6. Still open: the sub-field names and types, and how a human-written suggested text in the profile relates to the code-derived suggested answer in the sidecar (C:M6-O7c).
2. **L32's "validation stage 4".** `UNKNOWN_CHECK` was put in R3's stage 4 row as ruled. The related `PROOF_REQUIRED` and the proof rules are in stage 7, and "stage 4" may mean R3 §2.4. The lead should confirm the stage.
3. **The code for a proof that names F-06 for another kind** (not `duration`, `aspect` or `language`). It is still unnamed: C:C1.5 says "a code R3 chooses", and L32 covers only unregistered checks.
4. **L40 calls `align.lipsync_min_fraction` "the threshold of an observational check".** It is the pass rule of the claim `R7-A2`, and no check in R9's catalogue reads it. Applied as ruled (`director`, 0.5 to 1).
5. **L27 (revised) says the originals are "Apache-2.0 and MIT".** Spike V1 records both Hugging Face weight cards as `apache-2.0`; Whisper's code is MIT, and torchaudio calls wav2vec2 MIT. The licence each pin records should be confirmed at M5-03.
6. **L42 needs the issues before the first commit.** `impl/00` §12 now creates them first. That GitHub accepts issues on a repository with no commit is ASSUMED, and a stop-and-ask was added in case it does not.
7. **"M0-01" in the design records.** `lld/10` and `lld/11` U27, U30, U31 and U34 still say M0-01. M0's note maps this to M0-01b, but U30's hook is built in M0-01a. These lines were not edited, because no ruling covers them.
8. **Two broken links in history files** cannot be fixed by a path change. `docs/history/…verification.md` links to `Cutroom-v2-HLD-ENTRY.md`, which never existed in this folder. `research/evidence/codex-consistency-pass2.md` links to the deleted `drafts/`.
9. **Stale wording inside 18.3 and 18.4 was left as written,** because the brief allows no other `lld/11` edits. B:O14-measured says "R2 (who records the set: not yet stated)", and C:M5-O3 says "not yet stated" for the `audio_score` `meta`. L30 and L31 in 18.5 settle both.

## Checked and consistent

- **Provides against requires:** 21 "What must already exist" rows across M1 to M6, checked item by item. 3 naming mismatches were fixed and none was unprovided. M2 already names `STALE_READ_SET` and the `event` table. M3 no longer provides `Predicate` and `Need`. M1 no longer provides the contact-sheet and event-strip builders, which M4-11 builds.
- **"Depends on":** 81 work packages, the split ones included (M0-01a/b, M4-08a/b, M6-04a/b). 3 references to the old M0-01 were fixed; every other target exists.
- **"Open points" sections:** none remain in the 7 milestone documents. Every "Resolved points" label cited resolves: 117 section-18 identifiers, plus 61 other labels that are 18.3 aliases, report rows classed ANSWERED, IMPLEMENTATION DETAIL or overtaken, or regex artefacts. Only the L24 to L46 citations were new, and they now exist in 18.5.
- **Names:** 117 upper-case codes in the build documents; 116 appear in the design, and the other, `SHIM_VERSION`, is a constant. 232 dotted names; 200 appear in the design, and the other 32 are file names or field paths of designed kinds.
- **Ceilings:** M4 $3.30 (M4-04 $0.80, M4-12 $0.70, M4-13 $1.80), M5 $0.29 (five rows) and M6 $3.92 (four rows) sum to $7.51, within the $10 cap. Each work package's own figures add up to its row. `impl/04` §1, `impl/03` §6 and §7, and the milestone acceptance lists now agree.
- **Paths:** the build documents, `CLAUDE.md` and `AGENT.md` describe the new layout. No old-layout path remains (searched for root `lld/`, `impl/`, `research/` paths, `~/cutroom/`, `VERIFICATION.md`, and `docs/packages` and the like). Every relative link resolves, except `STATE.md` and `handoff.md`, which the bootstrap creates, and the two history links above.
- **L46 items already in place before this pass:** R2 §2.6 already states `transform-origin: 0 0` as decided (B:O1b). R6 D4's `project_merge` row already relays `STALE_READ_SET` unchanged. Both were checked and left as they were.
- **L29, L33 and L35:** L29 was already applied in R9 §3.6 and is now cited in M5-09 and M6-08. L33 needed no design change. L35 found no descriptive labels left in `lld/07` or `lld/09`.
