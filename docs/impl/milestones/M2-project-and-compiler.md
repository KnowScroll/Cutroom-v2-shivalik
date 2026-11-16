# Cutroom v2 — Implementation · Milestone M2: Project and Compiler

**Written:** 15 November 2026
**Status:** Ready for the orchestrator; the design is frozen.
**Read with:** [orchestration](../00-orchestration.md) · [conventions](../01-repo-and-conventions.md) · [R3](../../lld/04-r3-project-model-and-storage.md) · [R4](../../lld/05-r4-compiler-and-render-plan.md) · [R10](../../lld/10-r10-integration-acceptance-and-build-plan.md) §2.2, §3.2, §4.2 · [integration decisions](../../lld/11-integration-decisions.md) §15–17

Signatures and file names are illustrative unless the design fixes them; persisted names, codes and settings are the design's. "Milestone M1" is not spike M1 (K9). R1 is `lld/02`, R2 `lld/03`, R3 `lld/04`, R4 `lld/05`, R5 `lld/06`, R9 `lld/09`; "b3" and "b2b" are files in `research/evidence/`.

## 1. Goal

In R10's words (§4.2): M2 builds the core entity kinds; patches with per-field write authority; revisions, branches, merge, promotion and `restore`; the compiler passes; the timing solver; the Render Plan; work keys; and `plan_diff`. It is done when the solver property tests pass, sliced and whole renders match, a hand-authored project compiles and renders through milestone M1, and case A13 passes at the patch level.

## 2. Provides to later milestones

- **project-core:** the entity schemas and kind registry with `x-cut-ref` and `x-cut-write` metadata; `doc_hash`, `pin_hash`; `describe_kind(kind)`, the data behind `project_schema` (J5); `patch(envelope, caller)`, the `project_patch` operation; `grant_create`; `system_write(module, ops)` under the five module identifiers, and the `ingest` module's entry point (B:O11); `genesis`, `branch_create`, `branch_abandon`, `promote`, `rollback`, `merge`, `propose` (refusing a stale read set with `STALE_READ_SET`, B:SD2); `snapshot`, `impact`, `stale_assumptions`, `rights_closure`, `refs`, `diff`, `history`; `record_read`, `read_set`; the `event` table with `append_event(tx, …)`, to which M3-01 adds subscription, and promotion's `head_accepted` event (B:SD3; L44); Project Core's half of R5's `ReadinessOracle` (`commitment`, `acceptance`).
- **compiler:** `compile(request, facts)` returning a compilation record; `CompilationStore` and the `compilation` index table (B:O4); `timing_explain`; `plan_diff`; `store_plan`; the `RenderPlan` type, built from render's `RenderUnit` type (B:O1a), with the `execution` part for R5's `plan_to_jobs`; the work-key builders; the frame-packet builder (A:M1-8a; B:O1a).
- **Declared and stubbed:** `CompileFacts` (validation records from the check runner and the capability registry, M3; environment record and rung bundles, milestone M1); `ValueFormatter`, `CaptionSegmenter` (R7, M5); `CheckCatalogue`, `EvidenceLookup` (M3). R5's `Predicate` and `Need` are imported from foundations, where M0-02 declares them (B:SD1). M2 calls no Scheduler, check runner or model worker.

## 3. What must already exist

**From M0:** in `packages/foundations`, flicks and flick-exact rates with rounding half up (L6), `ent_` UUIDv7 IDs and the handle check, `sha256:` hashing, RFC 8785 canonical JSON, the work-key helper (R1 §2.4), failure classes, the R1 §5 evidence enums, `Predicate` and `Need` (B:SD1), and the settings registry holding every stage's settings with `override_by` and `range` (R3 §2.7), with keyed values (A:M0-3), nesting by every dot-separated segment and refusing a name that is a prefix of another (B:O8a), including `budget.hard_cap_usd`, `delivery.audio.*` and `voice.final_timing`. In `packages/project-core`, the storage adapter (`exec`, `prepare`, `tx`, `backup`, `close`) with WAL, `STRICT` and grouped commits; `PRAGMA user_version` migrations; the `9p` refusal; the blob store; and R3 §2.6's promotion compare-and-swap over `branch` and `accepted_log`, with a same-transaction hook through which M2-05 writes the `event` row in the same `FULL` transaction (B:SD3). Dependency edges allow compiler → project-core → foundations, and compiler → render and project-core → render (A:M0-1, A:M0-2).

**From milestone M1:** `chunkRender`, `stillRender`, `filmConcat` and `filmMux` (the functions M3 later wraps as `chunk.render`, `still.render`, `film.concat` and `film.mux`) taking a RenderUnit in R4 D5's shape, frames, a rung and its bundle, and returning the I10 result; the sealer; the validation ladder V0–V6 as plain functions; `meta` parsing; the `fill`, `effect` and `Gradient` records (L7); the environment record and R2 §2.8's environment hash; the rung bundles with hashes; the probe sidecar format; and the `RenderUnit` and `FramePacket` types. M1 builds no frame-packet builder: the compiler does, in M2-09, and the caller passes the packets to render (A:M1-8a; B:O1a).

A missing item goes into the first work package that needs it.

## 4. Entity kinds: built now or completed later

Every kind gets its schema, metadata and example in M2-01: integrity, merge and authority need every shape. The table says where each kind's behaviour is finished.

| Kind | In M2 | Completed at | Why |
|---|---|---|---|
| `project`, `brief`, `quality_intent`, `delivery_profile` | Built; Quality Intent rules use a stub `CheckCatalogue` | M3 (catalogue) | A13 and every compile |
| `beat`, `shot`, `object`, `layer` (`component`, `fill` and `effect` sources, L7), `control_track`, `camera`, `event`, `time_constraint`, `lock`, `decision` | Built, with lowering | — | Fixture and solver |
| `component`, `library`, `font` | Built; `uses` filled from `meta` | M3 (validation records) | The fixture renders components |
| `scene_context` | Declared staging checks; `STALE_COMMITMENT` | M6 (`verify_staging`) | R9 runs it with probe checks |
| `layer.source` `media`, `capture` | Schema only | M9, M10 | Needs prepared frames |
| `asset` | Schema; `rights.status` and measured fields `system` | M9 | A13; fonts reference assets |
| `claim`, `source`, `dataset` | Schema, member references, `system` fields, bindings through the stub formatter | M8; formatter M5 | A13 patches `claim.support` |
| `voice_line`, `take` | Schema; timing from samples, estimates and locked takes | M5 | D3's example has a locked take |
| `music_cue`, `sfx_cue` | Schema; placement, beat grids, presented-frame sync in the solver | M5 (mix, `sync_pairs`) | M4's first brief is beat-synced |
| `caption_track`, `voice_profile` | Schema only | M5 | Need R7 |
| `media_need`, `capture_session`, `treatment`, `recipe` | Schema only | M9, M10, M4/M6, M7 | First used there |

Also deferred: the `evidence` table and `closure_hash`, which M3-07 builds in project-core (L5), and the `experience` table and `KNOWN_FAILURE` (M10); the blob sweep (M3); the `project_read` and `project_find` views (M4; B:O17); the mix plan beyond a silent film, the caption plan and `sync_pairs` (M5); `must_see` (M6), whose `element` shape M2-01 fixes (B:O14f); baking (`bake.mode` stays `off`); media frame mapping (M9). A deferred stub throws a plain error naming its milestone, never a diagnostic. Deferred codes: `KNOWN_FAILURE` (M10); `MEDIA_RANGE_EXCEEDED`, `MEDIA_NOT_PREPARED`, asset-crop `ANCHOR_UNRESOLVED` (M9); `CAPTION_TEXT_MISMATCH` (M5); `FOOTPRINT_EXCEEDED`, `AVOID_REGION_ENTERED`, `ANCHOR_DRIFT`, `PROBE_MISSING` (M6); `CROSS_COMPONENT_EFFECT_UNSUPPORTED` (M10), although M2-01 fixes the `matte` request it answers (B:O14g). `TIMELINE_GAP` is no longer deferred: M2-07 raises it (L4).

## 5. Dependency sketch

```
M0 + milestone M1 done
  M2-01 schemas
   ├─► M2-02 versions ─► M2-03 patch ops ─► M2-04 authority ─► M2-05 branches ─► M2-06 merge
   └─► M2-07 timing ─► M2-08 front end ─► M2-09 lowering ─► M2-10 keys, emit
  M2-11 fixture to MP4     needs M2-05, M2-10
  M2-12 claims and A13     needs M2-04, M2-10
```

The two lanes run in parallel once M2-01 is merged; inside a lane the package is shared, so its packages run in sequence (00 §3). M2-11 and M2-12 touch only `tests/` and may run beside M2-06.

## 6. Work packages

Every "Done when" includes 01 §6's baseline and, for care: high, the closed review. Each package keeps one named test per code it introduces (`produces <CODE>`); a coverage test asserts that its code list, minus section 4's deferrals, equals the codes those tests produce.

### M2-01 — Entity schemas, write levels and kind descriptions

- **Care:** normal
- **Package:** `packages/project-core` (`src/schema/`)
- **Depends on:** M0     **Parallel with:** none
- **Live calls:** none

**Goal.** Every R3 kind is a Zod schema with reference, write-level and time metadata, defaults and an upcast slot, and documents can be hashed, snapshotted in memory and described.

**Read first.** R3 §2.1, §2.2 (tables and notes), §2.3, §2.5, §2.7 (`system` table, `human` fields, "Locks"), §2.10, §2.11 (recipe), §2.12, §2.13 (first paragraph); R1 §1.1–1.3, §2.1, §3.6, §4.1; R2 §2.2, §2.6 "Trusted layers"; R4 D5 "Transitions", D9; R9 §3.4; lld/11 FR1, FR5, FR6, FR7, G10, G12, H11, I1, J5, K1, L7, A:M1-1, B:O2, B:O12, B:O14c, B:O14f, B:O14g.

**Build.** `ref(kinds, {role, on_delete})`, member references, `x-cut-write {level, module?, values?}`; shared shapes (`Region`, `TimedRegion`, `MaskSpec`, `Format`, `Word`, `rights`, six `provenance` shapes, `commitment`, and `Meta`, `Control`, `Fill`, `Effect` and `Gradient` imported from render, A:M0-2, L7); 32 kinds at `v` 1 in a `KINDS` registry; `fill_defaults`; `doc_hash`, `pin_hash`; `Snapshot` and `snapshot_from_docs`; `path_resolve(kind, path)`; `describe_kind(kind)`. Shapes the batch fixed now, so no schema version changes later:
- `layer.source` gains `{fill: …}` and `{effect: …}`, holding R2's records (L7); `MaskSpec`'s gradient is R2's `Gradient` (A:M1-1).
- `shot.transition_in` is `{type, duration, direction?}`: `type` is `dissolve` or `wipe`, and `direction` (`left`, `right`, `up` or `down`) is required for a wipe (B:O14c).
- `must_see.element` is `{layer: Ref<layer>, cut_id}`, the shape and names of `event.probe` (H11; B:O14f).
- `scene_context.effects[].kind` gains `matte`, with `from` the matte layer and `onto` the layers it would mask (B:O14g).
- `lock.level` carries `x-cut-write {level: human, values: [brief, creator]}` (B:O12).

**Rules that are easy to get wrong.**
- R3's names are canonical (G10). `layer.source.crop` is in source pixels and is the one display crop, applied once; changing it is a new layer version, never a new asset (FR6). `channels.follow.leader` keys are `{layer, anchor}` or `null` (FR7). There is no `strength` field (R3 §2.2 notes).
- Keyed maps merge per entry; record lists and maps with free-text or dotted keys (`settings_overrides`, keyframes) are one value (R3 §2.1 rule 2). Mark which, for merge and `PATH_INTO_ARRAY`.
- `human` and `system` fields with defaults are filled by code at creation; the delivery profile's audio thresholds come from `delivery.audio.*` (K1).
- `describe_kind` lists unset optional fields and gives an example of every keyed-map shape such as `shot.groups`: batch 3's leftover errors were hidden fields and shapes with no example (J5; b3, "Invented handles and fields").
- Derive the role and `on_delete` of every reference field by B:O2's rules, not case by case: `owns` only on the parent-side ordered membership lists (`project.beats`, `beat.shots`, `beat.lines`, `shot.layers`, `project.delivery_profiles`, `project.treatments`); `fact` for references to `claim`, `dataset` and `source`; `timing` for references to events and clock owners; `spatial` for `shot.scene_context`, the scene-context fields and `follow` leaders; `style` for `font`, `library` and `voice_profile`; `uses` for the rest. `on_delete` is `unset` for an optional single reference that only selects something (`voice_line.selected_take`, `shot.camera`, `shot.scene_context`, `object.default_component`, `media_need.chosen`, `asset.need`) and for `decision.affects`, and `block` everywhere else, `lock.target` included. The table goes in the report, and the orchestrator records it in section 18 before M2-03 (B:O2).

**Tests.** Every example passes its schema; per kind, `describe_kind`'s paths equal those `path_resolve` accepts; `doc_hash` ignores key order and number spelling, `pin_hash` only `commitment.readiness` (fast-check, 500 runs); a 44.1 kHz profile fails; `z.toJSONSchema` keeps both metadata keys; a `wipe` without `direction` fails; a `fill` source and an `effect` source pass; `must_see.element` and a `matte` effect's `from` are references the index sees; every reference field's role and `on_delete` follow B:O2's rules.

**Done when.** Baseline; 32 kinds registered; role table reported.

**Out of scope.** Storage, patch semantics, deferred behaviour.

### M2-02 — Entity versions, revisions and the dependency index

- **Care:** normal
- **Package:** `packages/project-core` (`src/store/`, `src/index/`)
- **Depends on:** M2-01     **Parallel with:** M2-07
- **Live calls:** none

**Goal.** Versions and manifests are stored insert-only with their hashes; snapshots load in one query; edges are derived at insert and answer the index queries.

**Read first.** R3 §2.5, §2.6 (tables and the paragraph after), §2.8, §2.10 (`rights_closure`), §2.13 (`project_refs`, `project_diff`), §3; b2b §2.

**Build.** Migrations for `entity_version`, `revision`, `version_blob`, `dep_edge`, `authored_pin`, `handle_history`; `write_revision({parents, entities, origin, patch_id, revalidate})`; `snapshot`; edges from reference metadata, members, bindings and `depends_on`; `authored_pin` from `provenance.authored_against`; `impact`, `stale_assumptions`, `rights_closure`, `refs`, `diff`.

**Rules that are easy to get wrong.**
- `revision_id = "rev_" + SHA-256(manifest)`; parents are hashed, time and author are not; the stored text is the hashed text. A retried merge keeps its ID; a rollback gets a new ID with an equal `tree_hash` (R3 §2.5).
- A member edge matches only when the changed path overlaps the member; affected entities add their containing shot and `stale_assumptions` (R3 §2.8).

**Tests.** Canonical revision hashing: one manifest built in different orders gives one ID; re-hashing 500 stored manifests reproduces each ID; a parents-only change alters `revision_id`, not `tree_hash`. Impact over member edges, transitive walks, containing shots and certainty labels. `stale_assumptions` catches a changed authored-against `pin_hash` and ignores a readiness-only change. Record the warm snapshot time for 800 entities (b2b: 3.5 ms p50).

**Done when.** Baseline.

**Out of scope.** Patches; `closure_hash` (M3-07; L5).

### M2-03 — Patch envelope, handles and operations

- **Care:** high
- **Package:** `packages/project-core` (`src/patch/`)
- **Depends on:** M2-02     **Parallel with:** M2-07 to M2-10
- **Live calls:** none

**Goal.** `patch(envelope, caller)` applies the eight operations all-or-nothing, runs stages 1, 2, 3, 5 and 6 with hooks for 4 and 7, and writes one candidate revision or one rejected patch row.

**Read first.** R3 §2.3, §2.4, §2.6 (`patch` table, `branch.state`), §2.7 ("Rollback"), §4 ("Crash mid-patch"); R1 §1.3, §2.1; lld/11 J1, J6, J7, F18, L6, B:O7, B:O18b, B:O18c; b3 spike 1 ("Which diagnostics occurred", "Invented handles and fields", "Limits").

**Build.** The envelope `{base, branch, intent, key?, unlock?, rebase?, dry_run?, ops[]}`; base by revision ID, `P` number or branch; handle resolution and automatic `<parent>.<kind><n>` handles; `create`, `update`, `delete`, `rename_handle`, `list_insert`, `list_move`, `list_remove`, `restore`; time literals to flicks, through foundations' rounding half up (L6); rounding to `store.number_decimals`; the result `{revision, changed_handles, warnings, impact}`; the code `UNKNOWN_BRANCH` (B:O18c).

**Rules that are easy to get wrong.**
- A stage reports all its errors and later stages run only if it reports none; authority precedes schema (R3 §2.4).
- The envelope is logical: on MiniMax, R6's adapter parses `ops` from JSON text before Project Core sees it (J1). `MALFORMED_PATCH` reports the JSON path of a shape error.
- Paths are object keys, never indices; arrays are replaced whole; list items are addressed by value (R3 §2.4; J7).
- `delete` clears `owns` entries and `unset` references; any other inbound reference is `STILL_REFERENCED`; `cascade` adds owned entities only, not b3's wider set (R3 §2.4).
- `restore` expands into ordinary operations, which stages 4 to 7 check (R3 §2.4). The rule that the expansion keeps paths the caller may not write needs stage 4's write levels, so M2-04 adds it, with its code (B:O7).
- Time fields accept only the authoring literals (`650ms`, `5.15s`, frames at a stated rate, beats, an event reference plus an offset); a bare number fails with `BAD_TIME_LITERAL`, listing the accepted forms (R1 §1.3; R3 §2.1 rules 3 and 5; B:O18a). Module code writing through `system_write` stores integer flicks directly.
- `IMMUTABLE_FIELD` covers the common fields `id`, `kind` and `v`, and `handle`, which changes only through `rename_handle`; the diagnostic carries that operation as its `fix`. No kind-specific field is immutable (B:O18b).
- A patch to a branch that does not exist fails with `UNKNOWN_BRANCH`, giving the nearest branch names, or the state when the branch is `merged` or `abandoned`; a patch never creates a branch. An unknown branch given as `base` stays `UNKNOWN_REVISION` (B:O18c).
- Handles are never reused, retired ones included (R3 §2.3).
- `UNKNOWN_FIELD` candidates rank paths whose last segments match before edit distance, with `fix` when one matches: the short path was batch 3's commonest repair (b3).
- A repeated `key` returns the first result, accepted or rejected; a kill usually leaves one commit unacknowledged (R3 §4; b2b §4).

**Tests.** Every stage 1, 2, 3, 5 and 6 code, `NO_CHANGE` and `UNKNOWN_REF` (stub lookup). Batch 3's shapes: a shot moved between beats in one patch; a referenced layer deleted with and without `cascade`; a key array replaced; `restore`. An old handle gives `HANDLE_RENAMED` until `handle.alias_grace_revisions` passes, then `UNKNOWN_ENTITY` with five candidates. A failing fifth operation leaves no revision; `dry_run` writes nothing. A bare number in a time field gives `BAD_TIME_LITERAL`; an `update` of `handle` gives `IMMUTABLE_FIELD` with `rename_handle` as its fix; a patch to a missing branch and to an abandoned one each give `UNKNOWN_BRANCH`.

**Done when.** Baseline.

**Out of scope.** Stages 4 and 7 (M2-04); `rebase` (M2-06).

### M2-04 — Write authority and invariants

- **Care:** high
- **Package:** `packages/project-core` (`src/authority/`, `src/invariants/`)
- **Depends on:** M2-03     **Parallel with:** M2-07 to M2-10
- **Live calls:** none

**Goal.** Stage 4 enforces grants, field write levels, setting override levels and locks; stage 7 enforces local invariants and R9's Quality Intent write rules.

**Read first.** R3 §2.4 (stages 4 and 7, the `restore` row), §2.6 (blob `ingest`), §2.7, §2.10, §5; R9 §3.4 ("Rules enforced on write"); R7 §2.4; R10 §3.2 A13; lld/11 FR1, G11, G12, G15, G19–G22, K1, K2, K5, K6, L3, A:M0-11, B:O5, B:O7, B:O8a, B:O8b, B:O9, B:O10, B:O11, B:O12.

**Build.** The `scope_grant` table, `grant_create` with `SCOPE_OVERLAP`; the caller `{actor: human | director | worker | module, module?, job?, grant?}`, where `module` is one of `ingest`, `rights`, `research`, `beat_tracking` and `quality`, the names `x-cut-write.module` also uses (B:O11); `OUT_OF_SCOPE`, `FIELD_AUTHORITY` (field and level), `LOCKED`, `UNLOCK_NOT_PERMITTED`; `system_write`; the `restore` expansion's authority rule and its warning `RESTORE_PATH_KEPT`, in R3's "Other" row (B:O7); settings checks on `project.settings` and `settings_overrides`; the stage 7 codes; `CheckCatalogue` with a stub.

**Rules that are easy to get wrong.**
- Every written path is checked, in `create` as in `update`; no grant raises a level (R3 §2.7).
- `values` makes only listed enum values `system`: the Director may set `claim.status` to `unverified`, not `supported` (R3 §2.7; K2).
- A module actor may `create` the entity it fills and may write its own `system` fields and `director` fields, never `human` fields or another module's `system` fields; `provenance` is written by the creating module, in `create` only. This is required, because an `asset`, `take` or `component` has a required `system` field with no default (B:O11).
- A brief-derived constraint is created once, with code stamping `from_brief`, and is human-only afterwards; no weakening test (G11, G19). "Once" is judged against the patch's base revision, or the merged base under `rebase`: a Director patch may create hard constraints with `from_brief: k` only when the base's Quality Intent has none for `k`, so every constraint for one key comes in one patch, and a later Director patch adding, changing or deleting one for `k` fails with `FIELD_AUTHORITY` (B:O5). `BRIEF_CONSTRAINT_UNCOVERED` applies to patches that write the Quality Intent.
- `settings_overrides` cannot carry `human` settings: compare its entries with the base, and any added, changed or removed `human` entry needs a human (G21). Durability settings are `human` (G20, K5); compiler limits and budget shares stay `director` (K6, G22). A setting nests in `project.settings` by every dot-separated segment of its name, so every level is a keyed map and two branches overriding different settings merge leaf by leaf (B:O8a). A `settings_overrides` entry naming a setting R9 does not own fails with `UNKNOWN_FIELD`: path `settings_overrides`, `got` the setting name, `candidates` the nearest R9 settings, and a message that other settings belong in `project.settings` (B:O8b). Effective values resolve default, then `project.settings`, then `settings_overrides` (A:M0-11).
- Locks need the lock's level and the lock named in `unlock`; `brief` and `creator` locks need a human (R3 §2.7). `lock.level`'s metadata makes `brief` and `creator` human-only, so the Director, or a worker whose grant allows creating `lock`, may create only a `director` lock. Changing or deleting a lock (its `level`, `target`, `paths` or `subtree`) needs authority that reaches its current level, and the new level as well when `level` changes; otherwise `UNLOCK_NOT_PERMITTED` (B:O12).
- `RIGHTS_FIELDS_REQUIRED` requires, by status: nothing more for `candidate` and `revoked`; `licence.id` (the value `unknown` allowed) and at least one `basis` source for `evidence_collected`, `restricted` and `unresolved`; those and `attribution.required`, `attribution.text` when attribution is required, `scope.commercial` and `scope.modify` for `eligible`. This is the starting rule, confirmed or corrected when the rights rule table is seeded at M6 (L3; B:O10). M2 needs only the `eligible` case, for its fixture font.
- Waivers name observational checks only (R9 §3.4). Each check will declare the hard-constraint kinds it proves (`proves`, added to `register_check` at M3-07); M2's stub `CheckCatalogue` proves no kind, so until M3-07 stage 7 checks only that a proof is named (B:O9).

**Tests.** Each R3 §2.7 `system` field is refused for director and worker and accepted through its module's `system_write`. Each `human` field and setting (brief, `disclosure`, `ai_disclosure`, both audio thresholds, a `from_brief` constraint, `budget.hard_cap_usd`) is refused for director and accepted for human. A `human` R9 setting in `settings_overrides` is refused; a non-R9 setting there gives `UNKNOWN_FIELD` with R9 candidates. A patch with an authority error and a type error returns only `FIELD_AUTHORITY`. A module actor `ingest` may create a `component` with its `system` fields and `provenance` through `system_write`; a director cannot create one. A second Director patch adding a constraint for a covered brief key fails with `FIELD_AUTHORITY`. A Director deleting a `creator` lock, or raising a `director` lock to `creator`, gets `UNLOCK_NOT_PERMITTED`. An `eligible` rights record missing `scope.modify` gives `RIGHTS_FIELDS_REQUIRED`. A Director's `restore all` after the rights module changed `rights.status` keeps that field at its base value and returns one `RESTORE_PATH_KEPT` warning. Every stage 4 and 7 code.

**Done when.** Baseline.

**Out of scope.** A13 (M2-12); the rights table and quote check; `UNKNOWN_CHECK`, Project Core's stage 4 refusal of a proof that names an unregistered check (L32), which needs the installed catalogue and is built with the proof rules in M6-04a.

### M2-05 — Branches, promotion, rollback and readiness answers

- **Care:** normal
- **Package:** `packages/project-core` (`src/branch/`)
- **Depends on:** M2-04     **Parallel with:** M2-08 to M2-10
- **Live calls:** none

**Goal.** A Space starts from a genesis revision; branches, promotion, rollback and read sets work; Project Core answers its readiness facts.

**Read first.** R3 §2.2 notes ("ingest creates the asset"), §2.6 ("Atomic accepted-head update", blob `ingest`), §2.7 (branch, promotion, rollback, locks, read sets), §2.13 (`project_branch`, `project_promote`, `project_history`), §3 (R5 row); R5 §2.4 ("Readiness predicates", "Events"); R6 D10 (promotion); lld/11 FR10, B:SD3, B:O11, B:O12, L44.

**Build.** `genesis(project, brief)` by a human, which creates the `brief` lock as a human (B:O12); `branch_create`, `branch_abandon`; `promote(candidate, expected_base, caller)` over M0's compare-and-swap; `rollback`; `history`; `record_read`, `read_set`; the `ReadinessOracle` answers. The `event` table in project-core's migrations, with R5 §2.4's columns `(seq, ts, type, job_id, consumer_id, scope, payload)`, and the helper `append_event(tx, …)` that every module appending events uses (B:SD3). The `ingest` module's entry point, beside the blob store's `ingest`, acting as the module actor `ingest` through `system_write`: studio adapters, the harness's author handlers, the CLI and tests call it, and M2-11 takes its components from it (B:O11).

**Rules that are easy to get wrong.**
- Promotion needs structural validity and authority only: `may_promote`, stages 1–7 passed, the head an ancestor. No compile, check or review is consulted; a moved head is `STALE_BASE` (R3 §2.7, I19; R6 D10).
- The head-accepted event, whose `type` is `head_accepted` (L44), goes in the promotion's `FULL` transaction (R3 §2.6), inserted with `append_event` through M0-08's same-transaction hook. R5 keeps the meaning of `event` and its types (B:SD3); M3-01 adds subscription and the cursor and does not create the table.
- Rollback excludes `rollback.excluded_kinds` by default (R3 §2.7, §5).
- A read records `pin_hash` for validity and `hash` for provenance (FR10).

**Tests.** Promote, then `restore`: a new accepted revision with the earlier `tree_hash` and a new `revision_id`. A candidate that cannot compile is promoted. `STALE_BASE`; `OUT_OF_SCOPE` without `may_promote`; `BRANCH_EXISTS`; an abandoned branch stays readable. Freezing an unchanged commitment keeps `pin_hash` and flips the `commitment` answer to `frozen`. A promotion appends exactly one `event` row of `type` `head_accepted` in its transaction, and a swap that fails with `STALE_BASE` or a throwing hook leaves none; `seq` grows by one per append. The `ingest` entry creates an `asset` and a `component` with their `system` fields and `provenance`, written once at creation.

**Done when.** Baseline.

**Out of scope.** Merge; views (M4; B:O17); event subscription (M3-01).

### M2-06 — Three-way merge and the late-result rule

- **Care:** high
- **Package:** `packages/project-core` (`src/merge/`)
- **Depends on:** M2-05     **Parallel with:** M2-10, M2-11, M2-12
- **Live calls:** none

**Goal.** `merge` writes a merged candidate with its `revalidate` set or returns typed conflicts and writes nothing; `patch` with `rebase` uses it; `propose` enforces the late-result rule.

**Read first.** R3 §2.9, §2.7 (read sets), §2.4 (the "Merge" codes), §2.12, §4; R10 §3.2 A1, A2; lld/11 FR10, FR11, B:SD2.

**Build.** `merge(target, candidate, {resolutions?})`; ordered-set merge of reference lists; the `rebase` path; `propose(worker_branch, target)`.

**Rules that are easy to get wrong.**
- Upgrade documents first. Merge per entity, then per leaf path; arrays and one-value fields are leaves; keyed-map entries merge separately (R3 §2.9, §2.12).
- Different values are `MERGE_CONFLICT` with base, ours and theirs; then `DELETE_MODIFY`; a double move conflicts; two inserts at one position go ours-first with `LIST_ORDER_AMBIGUOUS`; `HANDLE_COLLISION` (R3 §2.9).
- Revalidate with stages 6 and 7 and check theirs' changes against ours' locks (R3 §2.9 step 5).
- `COUPLED_CHANGE` is the intersection of the two `impact` results; Project Core stores the set, and the inline compile and check jobs belong to M4 and M3 (R3 §2.9).
- A conflict writes nothing. A retried merge keeps its ID, so parents go in one fixed order.
- A worker's proposal merges only if its read set, by `pin_hash`, is unchanged on the target head; otherwise it fails with the new Project Core code `STALE_READ_SET` (severity `blocking`, R3 §2.4's "Merge" row), whose payload lists each changed entity with its handle, the `pin_hash` the job read and the `pin_hash` on the target head, and nothing is written (FR10; B:SD2). `propose`, and `merge` applied to a worker branch, return it; R6 relays it unchanged. `STALE_BASE` is not reused: it is returned first (R3 §4), and a proposal whose read set is unchanged still merges after the head has moved, so the two outcomes must differ.

**Tests.** Every merge code; disjoint fields of one layer and equal values on both sides merge; keyed-map entries edited on both sides merge; a merge breaking a lock or invariant fails; the `COUPLED_CHANGE` set equals the impact intersection; `resolutions` apply. Property (300 runs): disjoint edit sets merge to the result of applying both in either order, with one ID. Late result: unchanged read set merges after the head moved; a changed `pin_hash` gives `STALE_READ_SET` naming the entity, its handle and both `pin_hash` values, and writes nothing; a readiness-only change merges (I18).

**Done when.** Baseline.

**Out of scope.** The `project_merge` tool; A1, A2.

### M2-07 — Timing solver and timing pass

- **Care:** high
- **Package:** `packages/compiler` (`src/timing/`)
- **Depends on:** M2-01     **Parallel with:** M2-02 to M2-06
- **Live calls:** none

**Goal.** A pure solver gives every timing point a flick time, the film its length `N`, and the compile a timing report and conflict witnesses.

**Read first.** R4 D2 (Timing rows), D3, D4 (`impossible`), D5 "Transitions", D7 ("Placeholders"), §5; R1 §1.1–1.6; R3 §2.2 (`music_cue`, `sfx_cue`, notes "Acting follows its cause" and "Timing constraints"), §2.7 (locks); lld/11 K6, L4, L34, B:O3, B:O13.

**Build.** The STN with edge sources and classes (`authored`, `measured`, `locked`, `structural`, `estimated`); Bellman-Ford; Floyd-Warshall on typed arrays; ordered commitment; witnesses; the builder from every R4 D3 timing source, locks as equalities and the shot-contiguity equalities included (L4); the report; `timing_explain`; the codes `TIME_POINTS_EXCEEDED` (B:O3) and `TIMELINE_GAP` (L4).

**Rules that are easy to get wrong.**
- Integer flicks; a take lasts `round(samples × 705,600,000 × den / num)` (R4 D3). This `round`, the beat-grid formula's and every other "round to nearest" rounds an exact half up, computed exactly on integers, as M0-02's helper does (L6, L34).
- Commit cuts in film order at the first frame boundary at or after their earliest time, then beat snaps, then preferences by `priority` and entity ID (`TIME_PREFERENCE_CLAMPED`), then the rest at earliest time, updating the matrix after each (R4 D3 step 3).
- Mid-frame events round up: frame `ceil(t / T)`, length `ceil(end / T)` (R1 §1.4–1.5).
- The earliest-time rule gives `TIME_UNANCHORED`, never `UNRESOLVED_CHOICE` (R4 D3, I22); `duration_target` is not a bound (R4 D3).
- Sound tied to a picture event places its `sync_point` at `presented_frame × T` (I21); authored beats come from their absolute index (R4 D3).
- The solver must return a readable conflict witness: each edge mapped to its source, rigid runs merged, rules in film order, the deficit, each unlocked constraint's relaxation and whether it suffices, lifting a lock last, at most `timing.max_witnesses` (R4 D3). Only locked and structural edges means `impossible` (R4 D4).
- Above `timing.max_points`, stop before solving and return `TIME_POINTS_EXCEEDED`: severity `blocking`, `blocks: both`, pointing to the film with the point count and `timing.max_points`, suggesting a simpler timing network or a higher `timing.max_points` (a `director` setting, K6). No later pass runs. `CAPABILITY_BLOCKED` does not fit, being `blocks: frozen` (B:O3).
- Consecutive shots in film order are contiguous (L4; B:O13): the solver adds the structural equality start(next) = end(previous) − d, where d is the next shot's `transition_in.duration` (0 without a transition), and the first shot starts at 0. A constraint that would open a gap lengthens a `derived` shot, or gives `TIME_CONFLICT` with a witness against a `fixed` or locked one. `TIMELINE_GAP` is raised only for sound, cues or events solved after the last shot ends.

**Tests.** R4 D3's example: `TIME_CONFLICT`, deficit 400 ms, `tc_13` relaxed 400 ms as sufficient, `lk_3` last. Every in-scope timing code, `TIME_POINTS_EXCEEDED` (one point over the limit, no schedule) and `TIMELINE_GAP` (a cue placed after the last shot) included. A dissolve of 0.5 s starts the next shot 0.5 s before the previous one ends; a constraint pushing a `fixed` shot away from its neighbour gives `TIME_CONFLICT`, never a gap. Property (300 runs, 2–40 points): schedules satisfy every hard edge; consecutive shots are contiguous; cuts sit on frame boundaries; a witness cycle sums to the negated deficit and a relaxation marked sufficient restores consistency; identical input gives a byte-identical report.

**Done when.** Baseline.

**Out of scope.** `R4-SP1` (M2-12); the mix plan (M5).

### M2-08 — Compiler front end: request, facts, resolve, validate, readiness

- **Care:** normal
- **Package:** `packages/compiler` (`src/compile.ts`, `src/passes/`, `src/diagnostics/`)
- **Depends on:** M2-07     **Parallel with:** M2-02 to M2-06
- **Live calls:** none

**Goal.** `compile(request, facts)` runs Resolve, Validate, timing, and capability and readiness, accumulates R4 D2 diagnostics and returns a compilation record with a stable ID.

**Read first.** R4 D1, D2, D4, D5 (the stack follows `shot.layers`; group nodes), D7 ("Placeholders"), D12, §3, §5, §8; R3 §2.1 (member references), §2.2 notes ("A layer is one source", "Voice", "One home and one format per figure"), §2.11, §2.14, §3 (R4 row); R5 §2.4 (`Predicate`); R6 D10, the tool table (`evidence_read`); lld/11 FR5, F3, G6, K3, B:SD1, B:O4, B:O14d, B:O14e.

**Build.** The driver; the closed code catalogue with severity and `blocks`, `GROUP_NOT_CONTIGUOUS` included (B:O14d); `CompileFacts {validation, environment, capabilities, rung_settings}` with test builders, `capabilities` carrying the measured set of compositing features (B:O14e); the three passes; formatter and segmenter stubs; `CompilationStore`, which stores each compilation record as a content-addressed blob of canonical JSON with `durable: false` and indexes it in a compiler-owned table `compilation (id, revision, plan_id, record)`, registered through project-core's `registerMigrations` (B:O4); settings as registry defaults overlaid by `project.settings`. `Predicate` and `Need` come from foundations (B:SD1).

**Rules that are easy to get wrong.**
- Pure: no clock, randomness, network, model or job; keyed maps in key order; the record's ID hashes the request and facts (R4 D1, D12).
- Relay Project Core's and R2's codes unchanged; `UNKNOWN_CONTROL` is R4's (R4 D2).
- `needs_authoring` is no source, or a component source without a document (G6). A placeholder forces `animatic`; `frozen` and `final` plans never contain one (R4 D4, D12).
- `frozen` readiness is R5's typed predicates; a miss is `NOT_READY` with no plan (R4 D4). `TAKE_TIMING_ESTIMATED` follows `voice.final_timing` (K3).
- Diagnostics accumulate; nothing is dropped (R4 D1).
- A compilation record is derived, not evidence: it is no `evidence` row, and `evidence.origin_kind` keeps its four values. The record names the candidate revision it was compiled for; a plan or record a deliverable cites is rooted by that deliverable, and the others follow the rules for derived blobs (R3 §2.14; B:O4). Storing is separate from `compile`, which stays pure.
- The members of one `shot.groups` group must be adjacent in `shot.layers`; otherwise Validate raises `GROUP_NOT_CONTIGUOUS` (`blocking`/`frozen`), pointing at the group and the layers between its members. The group is never split silently, because two isolated groups at opacity 0.5 look different from one (B:O14d).
- The measured set is a record in the capability registry, read through `CompileFacts.capabilities`, listing the compositing features verified across sandboxed iframes: S4's eight cases plus whatever M1's automated tests add. A layer or group using anything else is `unknown_test_required`, a `CAPABILITY_GAP` that blocks nothing; a test that passes adds its case to the record, a fact, with no code change (B:O14e).

**Tests.** Every in-scope code of these passes, `GROUP_NOT_CONTIGUOUS` included; each R4 D4 feasibility state; a `frozen` `preview` compile with an unvalidated component gives `NOT_READY` and no plan; `plan` mode emits healthy shots; repeated compiles share an ID that one changed fact alters; a blend mode outside the measured set gives `unknown_test_required` and blocks nothing, and adding it to the set clears the note; `CompilationStore` stores a record once by its ID and finds it by revision and plan.

**Done when.** Baseline.

**Out of scope.** Lowering, keys, emission.

### M2-09 — Track evaluator, camera and render units

- **Care:** normal
- **Package:** `packages/compiler` (`src/lower/`)
- **Depends on:** M2-08     **Parallel with:** M2-04 to M2-06
- **Live calls:** none

**Goal.** Shots and transitions lower to RenderUnits whose frame tables evaluate tracks, time maps, camera and `follow` once; packets can be built from them.

**Read first.** R4 D2 (Timing rows), D5 (RenderUnit, "Layer sources", "Groups, blend, masks, filters", "Transitions", "Track evaluation", "Frame packets"), D9 ("Anchor-follow layers"), D10, D11, §5; R2 §2.2, §2.3, §2.6; R1 §1.6; R3 §2.2 `Meta`, notes on `layer.transform`; lld/11 FR7, G18, H10, I4, L7, L34, L44, B:O1b, B:O14b, B:O14c.

**Build.** The evaluator (four precedence layers, `CONTROL_CONFLICT`, defaults and nullable `null`, the easing table with clamping, stepped enum, boolean and text, per-coordinate points); time maps (`TIME_MAP_INVALID`); camera with shake, parallax, `zoom_max`, `CAMERA_INVALID`; stack, groups, masks, blend, filters; `component`, `placeholder`, `fill` and `effect` sources, `fill` and `effect` lowered to `{kind, params}` from R2's records (L7); transition units: a dissolve lowers to the incoming group's opacity channel, and a wipe to a `clip` mask channel on the incoming shot's group whose inset sweeps across the canvas in `direction`, linear in time, over the overlap frames (B:O14c; L44: the wipe is lowered here, with the other transitions); `follow`; `UNIT_TOO_LARGE`, `UNIT_PIXI_LIMIT`, `COMPONENT_RANGE_EXCEEDED` (B:O14b); `build_packets(unit, frame)`, the frame-packet builder that render receives packets from, through the caller (R4 §3; A:M1-8a; B:O1a).

**Rules that are easy to get wrong.**
- Nothing in the browser interpolates (I4). Key times are offsets from `origin`, sampled at frame start; values round to `plan.quantum` before hashing (R4 D5).
- `M_layer = T(x, y) · R(rotation) · S(scale) · T(−w/2, −h/2)`, with `x`, `y`, `scale` and `rotation` (degrees clockwise) from the layer's `place` row and `w × h` the layer's box in design units: a component's `meta.size`, a trusted layer's declared `size`, otherwise the canvas. So `transform.x` and `transform.y` place the box's centre, and rotation and uniform scale turn about it. When a `follow` leader is in force, the anchor point takes the place of `(x, y)`. The host applies the matrix with `transform-origin: 0 0` (M1-03; B:O1b).
- A component whose `meta.out_of_range` is `error` raises `COMPONENT_RANGE_EXCEEDED` (`blocking`/`frozen`, the Timing group beside `MEDIA_RANGE_EXCEEDED`) when the frame tables are built, pointing to the layer, its component and the unit frames whose local time falls outside a `fixed` `meta.duration` (R1 §1.6; B:O14b).
- `M = T(W/2, H/2)·R(−rot)·S(zoom)·T(−cx, −cy)`; R2 §2.6 writes S before R, the same matrix since zoom is uniform (R4 D10).
- The parallax centre is the camera's on unit frame 0, never a chunk's first frame; `zoom_max` covers the whole unit (R4 D10, D6).
- Shake is seeded from the camera's entity ID (R4 D10).
- A leader is in the same unit and sought first; a cycle or depth over `follow.max_depth` is `CAPABILITY_BLOCKED`; `staging.follow_enabled` false is `CAPABILITY_GAP`; every leader change is recorded for `handoffs`, empty ends allowed (R4 D9; G18).

**Tests.** Golden tables: precedence across layers and `CONTROL_CONFLICT` within one; `out_back` overshoot then clamp; a nullable control outside intervals; time maps at speeds 0 and −1; rows 90–179 evaluated alone equal those of a 0–179 run, shake and parallax included; an attachment and a hand-off. A packet carries `frame`, `t_flicks`, `t`, every control and the matrix. A layer of 400 × 200 du at (540, 960), rotated 90° and scaled 2, has its box centred at (540, 960); a follower's centre sits on its anchor. A `fill` and an `effect` source lower to `{kind, params}` carrying R2's records unchanged. A wipe in each of the four directions gives a `clip` inset that sweeps across the canvas in that direction, linear in time, over the overlap frames; a dissolve gives the opacity ramp. An `out_of_range: error` component sampled outside its `fixed` duration gives `COMPONENT_RANGE_EXCEEDED`.

**Done when.** Baseline.

**Out of scope.** Media, caption, baked sources.

### M2-10 — Staging, quality declarations, chunks, work keys, emit and `plan_diff`

- **Care:** normal
- **Package:** `packages/compiler` (`src/staging/`, `src/declarations/`, `src/chunk/`, `src/keys/`, `src/emit/`)
- **Depends on:** M2-09     **Parallel with:** M2-05, M2-06
- **Live calls:** none

**Goal.** Passes 5, 7 and 8 complete the Render Plan, and `plan_diff` compares two plans.

**Read first.** R4 D5 (manifest, "Quality declarations", "Execution", "Source map", "Audio mix plan" first paragraph), D6, D7, D8 (last paragraph), D9 (first five bullets), §5; R2 §2.8 ("Environment hash"), §2.9, §2.12, §2.16; lld/11 FR15, G3, G8, A:M1-3, A:env-3.

**Build.** Staging (`ANCHOR_UNRESOLVED` for undeclared anchors, `FOOTPRINT_OVERLAP`, `SAFE_ZONE_VIOLATION`, `EFFECT_UNREALISED`); `holds`, `black`, `expected_motion`, `handoffs`, and `silent` for a film without audio; chunking and scope widening; keys for `chunk.render`, `still.render`, `film.concat`, `film.mux`, with `component.bake` and `audio.mix` declared; the execution graph with `pixi` and `requires`; manifest, `plan_` ID, source map; `store_plan` (`durable: false`); `plan_diff`.

**Rules that are easy to get wrong.**
- Chunks count from unit frame 0: up to `chunk.max_frames` is one chunk; longer units cut every `chunk.frames`, a remainder under `chunk.min_frames` merging backwards (R4 D7).
- The environment hash enters a chunk key once: shim, host and rung-bundle hashes are inside it (G8; FR15); its operating-system half is defined by content, so a kernel update or another tool-folder path changes no key (A:env-3). The key also holds capability and version, the pruned slice, the rung, and a diagnostic mode only when requested (R4 D6). `film.mux`'s key parameters include `encode.aac_bitrate_kbps` (A:M1-3).
- A placeholder's footprint when its layer has no scene-context item is the implementer's choice: placeholders appear only in `animatic` plans, and no other module reads the value (B:O14a).
- Work keys ignore film position: frame step `k` samples unit frames 0, `k`, 2`k`; IDs, handles, readiness, grade, audio and compiler version stay out (R4 D6; R2 §2.12).
- A slice keeps a leader that a remaining layer follows (R4 D6).
- At rung `still`, one `still.render` node per unit and no concat or mux; range scopes widen to aligned chunks (R4 D7).

**Tests.** Chunks: 150 frames give [0,150); 151 give [0,90) [90,151); 200 give [0,90) [90,200); 210 give [0,90) [90,180) [180,210). Retiming an earlier shot keeps a later shot's keys; renaming, freezing a commitment and changing grade change no key; one edited control key re-keys only its chunks and `plan_diff` names the entity; a changed `encode.aac_bitrate_kbps` re-keys `film.mux` and no chunk; a diagnostic key differs; identical compiles share a plan ID; every staging code; golden declarations for a hold, a black interval and a hand-off.

**Done when.** Baseline.

**Out of scope.** `verify_staging` (M6); `plan_to_jobs` (M3).

### M2-11 — Hand-authored fixture rendered to MP4

- **Care:** normal
- **Package:** `tests/fixtures/m2-hand-authored/`
- **Depends on:** M2-05, M2-10, milestone M1     **Parallel with:** M2-06, M2-12
- **Live calls:** none

**Goal.** A hand-authored project, built only through Project Core's operations, compiles `frozen` at grade `preview` and renders through milestone M1 to an MP4 of exactly `N` frames.

**Read first.** R10 §4.2; R4 D5–D7; R3 §2.13 ("Human edits"); R2 §2.2, §2.8, §2.9, §2.12; lld/11 L4, B:O11, B:O14e; sections 3 and 4 above.

**Build.** The fixture: a 1080 × 1920, 30 fps profile; a human-written brief with one hard constraint, covered by the Quality Intent; one beat of three shots (shot 1 fixed at 4 s under a `shot.duration` lock; shot 2 derived, at least 7 s, so three chunks; shot 3 fixed at 3 s with a 0.5 s dissolve in); three hand-written components (SVG with a `number` control, Canvas 2D with a `point` and a nullable `number`, HTML text in Inter with a `text` param), each with probes and `user_supplied` provenance from the ingest module; the Inter `font` and asset; a camera on shot 2 zooming 1 to 1.5 with a short shake; `base` and `acting` tracks on one layer with `out_back`; a reaction event 650 ms after its cause with `preferred` and `priority`, and one `event.pin`; an effect group with opacity, `multiply` and a gradient mask; on shot 3, a follower attaching mid-shot to a still, unzoomed leader; a scene context on shot 2 with one avoid region. A test-only `run_plan_direct(plan)` calls M1's functions in order, standing in for `audio.mix` with 48 kHz silence of `round(N × T / 14,700)` samples. Validation facts come from M1's ladder, in memory.

**Rules that are easy to get wrong.**
- Use `genesis`, `patch`, `promote` and `system_write` only (R3 §2.13); components, the font and the asset come through M2-05's `ingest` entry (B:O11).
- Write no validation record: the check runner is the only writer (FR13, K4).
- Keep the leader unzoomed: follow under zoom is unverified until M7 (H5).
- Shot 2's effect group (an isolated group with opacity, `multiply` and a gradient mask) is outside S4's measured set unless M1's tests added group isolation, so expect a `CAPABILITY_GAP` note (`unknown_test_required`) on shot 2, which blocks nothing (B:O14e).
- Shots are contiguous (L4): shot 3's dissolve starts it 0.5 s before shot 2 ends.

**Tests** (`npm run test:render`). `ffprobe` counts exactly `N` frames, H.264, BT.709 tags. A second compile gives the same plan ID. A human retime of shot 1 re-keys only its chunks, concat and mux; shots 2 and 3 move in film time and keep their keys; `plan_diff` names exactly those. Freezing the scene context changes no key. Every frame from the attachment on has a sidecar `placement` record.

**Done when.** Baseline; `npm run test:render` passes.

**Out of scope.** Audio, captions, media.

### M2-12 — Claim tests R4-SP1 and R4-SP2, and A13 at the patch level

- **Care:** normal; a test author who implemented none of M2-03, M2-04, M2-07 to M2-10 (00 §3)
- **Package:** `tests/claims/`, `tests/acceptance/`
- **Depends on:** M2-04, M2-10, milestone M1     **Parallel with:** M2-06, M2-11
- **Live calls:** none

**Goal.** Independent tests decide `R4-SP1`, `R4-SP2` and A13 at the patch level.

**Read first.** R10 §2.2 (`R4-SP1`, `R4-SP2`), §3.2 (A13); R4 D3, D6, D8, §8, §9; R3 §2.7; lld/11 FR1, G11, G21, B:O16, A:testing-1d; 00 §8.

**Build.** `tests/claims/R4-SP1.test.ts` with a generator of synthetic 90-second projects at 300, 800 and 1,000 points; `tests/claims/R4-SP2.test.ts`; `tests/acceptance/A13-patch-level.test.ts`.

**Rules that are easy to get wrong.**
- A failure is reported with its numbers, never loosened (00 §8 rule 5).
- A13's completion-state half waits for M6; here the head must not move.

**Tests.**
- `R4-SP1`: on random networks (500 runs) the consistency verdict matches an independent check (a non-negative Floyd-Warshall diagonal), schedules satisfy every hard edge, committed values lie in their windows, and every injected conflict yields a witness whose relaxations do what they claim. Each pass is timed at 300, 800 and 1,000 points; the whole compile at 1,000 points must finish within `compile.budget_ms` (3,000 ms).
- `R4-SP2`: a unit of at least 240 frames, with a layer invisible in its second chunk and a followed leader, rendered whole and as pruned slices; `still.render` images of the same frames reach `validation.repeat_min_psnr_db` (50 dB) on every frame, and frame counts match exactly (B:O16; A:testing-1d). A failure applies the fallback "Key the whole unit".
- A13: Director-grant patches to `rights.status`, a claim's `support`, a `from_brief` constraint and `project.settings.budget.hard_cap_usd` are each refused with `FIELD_AUTHORITY`, also under `dry_run`; the head does not move; each write succeeds for its proper writer.

**Done when.** Baseline; `npm run test:claims` and `npm run test:accept` pass.

**Out of scope.** `R4-SP5` (M4).

## 7. Claims assigned to M2

| Claim | Test | Fallback |
|---|---|---|
| `R4-SP1`: the solver is correct and fast at 1,000 points | `tests/claims/R4-SP1.test.ts` | Lower `timing.max_points` to the largest size that fits; record a build revision |
| `R4-SP2`: a sliced unit gives the same pixels as the whole | `tests/claims/R4-SP2.test.ts` | Key the whole unit; less reuse on long shots |

## 8. Live-call budget

None.

## 9. Acceptance list

| # | Command | Expected result | R10 "done when" |
|---|---|---|---|
| 1 | `npm run check` | Exit 0, dependency edges included | All |
| 2 | `npm test` | Exit 0 in about a minute with no network; both coverage tests pass, so every in-scope code of R3 §2.4 and R4 D2 has a producing test | Patches with write authority; compiler passes |
| 3 | `npm run test:claims` | `R4-SP1` passes with the compile at 1,000 points ≤ 3,000 ms; `R4-SP2` passes with every frame ≥ 50 dB; times and minimum PSNR in the report | Solver property tests pass; sliced and whole renders match |
| 4 | `npm run test:accept` | A13: four `FIELD_AUTHORITY` refusals, head unchanged | A13 at the patch level |
| 5 | `npm run test:render` | Fixture MP4 of exactly `N` frames; stable plan ID; only shot 1's chunks re-key after its retime | Hand-authored project compiles and renders |
| 6 | `npm run env:check` | Exit 0 | Render environment unchanged |
| 7 | M0-01b's three-layout timing script, run again (L43) | The numbers are in `docs/impl/reports/M2.md`; a test level moves only if it is clearly faster in another layout, and the move is noted in conventions §9 | None (a build measurement) |

## 10. Resolved points

Every point this document raised is closed by section 18 of the [integration decisions](../../lld/11-integration-decisions.md), with the classes of `impl/research/open-points-B.md` as the lead ruled on them (`impl/research/lead-decisions.md`). Points with several parts are split as the report splits them.

| Label | Point | Resolution |
|---|---|---|
| O1a | Where the frame-packet builder lives | ANSWERED (B:O1a): the compiler, as R4 D5, D10 and §3 say (I4). Render declares `RenderUnit` and `FramePacket` (M1-01), the compiler imports them, and the caller of `chunkRender` and `stillRender` builds and passes the packets: M3-03's executor, or `run_plan_direct` in M2-11. No render → compiler edge and nothing in foundations (M2-09) |
| O1b | The order and pivot of `M_layer` | Decided (B:O1b): `M_layer = T(x, y) · R(rotation) · S(scale) · T(−w/2, −h/2)`, about the box's centre; the host sets `transform-origin: 0 0` (M2-09, M1-03) |
| O2 | Reference `role` and `on_delete` given only by example | Decided (B:O2): six rules derive every row; M2-01 writes the table by them, and the orchestrator records it in section 18 before M2-03 |
| O3 | No code for exceeding `timing.max_points` | Decided (B:O3): the new R4 code `TIME_POINTS_EXCEEDED`, `blocking`, `blocks: both` (M2-07) |
| O4 | Where compilation records are stored | Decided (B:O4): content-addressed blobs of canonical JSON, `durable: false`, with a compiler-owned index table `compilation`; not evidence rows (M2-08, M2-10) |
| O5 | What "created once" is judged against | Decided (B:O5): the patch's base revision, or the merged base under `rebase`; every constraint for one brief key comes in one patch (M2-04) |
| O6 | The late-result refusal's code | Decided (B:SD2, for this row and M3's point 8): the new Project Core code `STALE_READ_SET`, listing each changed entity with both `pin_hash` values (M2-06; A1 at M3-10) |
| O7 | A Director's `restore all` after a module wrote a `system` field | Decided (B:O7): the expansion keeps every path the caller may not write at its base value and reports them in one `RESTORE_PATH_KEPT` warning (M2-04) |
| O8a | How dotted setting names nest in `project.settings` | Decided (B:O8a): by every dot-separated segment; M0-04's registry refuses a name that is a prefix of another (M0-04, M2-04) |
| O8b | The code for a `settings_overrides` entry R9 does not own | Decided (B:O8b): `UNKNOWN_FIELD`, with R9 candidates and a message pointing to `project.settings` (M2-04) |
| O9 | Which check proves which hard-constraint kind | Decided (B:O9): each check declares `proves: kind[]` in `register_check` (M3-07); M2's stub proves nothing, so stage 7 checks only that a proof is named (M2-04). C:C1.5 settles the duration case at M6: F-06 evaluates `duration`, `aspect` and `language` itself, and a proof naming an unregistered check is refused with `UNKNOWN_CHECK` (L32; M6-04a) |
| O10 | Rights fields `RIGHTS_FIELDS_REQUIRED` requires per status | Decided (L3; B:O10): accepted as the starting rule, confirmed or corrected when the rights rule table is seeded at M6 (M2-04) |
| O11 | Module actor identifiers; may a module create what it fills | Decided (B:O11): `ingest`, `rights`, `research`, `beat_tracking`, `quality`; yes, a module may create, writing its own `system` fields and `director` fields; `ingest` lives in project-core (M2-04, M2-05) |
| O12 | Who may create, change or delete a lock at each level | Decided (B:O12): `lock.level` is `human` for `brief` and `creator`; a change or deletion needs authority reaching the current level and any new level, else `UNLOCK_NOT_PERMITTED` (M2-01, M2-04, M2-05) |
| O13 | Are consecutive shots contiguous | Decided (L4; B:O13): yes; `TIMELINE_GAP` is raised only for sound, cues or events solved after the last shot ends (M2-07) |
| O14a | A placeholder's footprint without a scene-context item | IMPLEMENTATION DETAIL (B:O14a), left to the implementer: placeholders appear only in `animatic` plans and no other module reads the value (M2-10) |
| O14b | A code for `out_of_range: error` | Decided (B:O14b): the new R4 code `COMPONENT_RANGE_EXCEEDED`, `blocking`/`frozen`, raised in Lower (M2-09) |
| O14c | The parameters of a wipe | Decided (B:O14c): `shot.transition_in` is `{type, duration, direction?}`, fixed at M2-01; M2-09 lowers both `dissolve` and `wipe`, with the other transitions (L44) |
| O14d | Effect-group members that are not adjacent | Decided (B:O14d): the new R4 Validate code `GROUP_NOT_CONTIGUOUS`, `blocking`/`frozen` (M2-08) |
| O14e | The "measured set" behind `unknown_test_required` | Decided (B:O14e): a capability-registry record of compositing features verified across iframes, starting with S4's eight cases and M1's tests (M2-08, M2-11) |
| O14f | What `must_see.element` names | Decided (B:O14f): `{layer: Ref<layer>, cut_id}`, a typed reference; fixed at M2-01, used at M6 |
| O14g | How a live matte is requested | Decided (B:O14g): `matte` joins `scene_context.effects[].kind`; the compiler raises `CROSS_COMPONENT_EFFECT_UNSUPPORTED` at M10 (A4); the shape is fixed at M2-01 |
| O15 | Home of R5's `Predicate` type | Decided (B:SD1, for this row and M3's point 3): `Predicate` and `Need` are declared in `packages/foundations` (M0-02); R5 keeps their meaning; the compiler, project-core and the scheduler import them |
| O16 | `R4-SP2` names no threshold | Decided (B:O16, as A:testing-1d): every frame at or above `validation.repeat_min_psnr_db` (50 dB), with frame counts matching exactly (M2-12) |
| O17 | Should views be built now | ANSWERED (B:O17): no; R10 §4.2 places them at M4. M3 needs only `record_read` and `read_set` (M2-05), which M3-08's fake author uses |
| O18a | Do time fields accept bare numbers | ANSWERED (B:O18a): no; R1 §1.3 accepts only the authoring literals, so a bare number is `BAD_TIME_LITERAL` (M2-03) |
| O18b | Which fields `IMMUTABLE_FIELD` covers | Decided (B:O18b): `id`, `kind`, `v` and `handle`, which changes only through `rename_handle` (M2-03) |
| O18c | The code for a patch to a missing branch | Decided (B:O18c): the new stage 2 code `UNKNOWN_BRANCH` (M2-03) |
| O18d | Whether M0 created the `event` table | Decided (B:SD3): M0 did not; M2-05 creates it in project-core's migrations with R5 §2.4's columns and `append_event`; M3-01 adds only subscription |
