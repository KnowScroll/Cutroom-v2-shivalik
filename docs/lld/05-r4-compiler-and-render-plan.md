# Cutroom v2 — LLD · R4: Compiler, Executable Render Plan, Timing Solver and Spatial/Event Contracts

**Decided:** 14 November 2026
**Status:** DECIDED by the lead session under the user's delegation of 14 Nov 2026. The design set was frozen on 15 November 2026 ([R10](10-r10-integration-acceptance-and-build-plan.md) section 6.4); this document may be revised during implementation.
**Baseline:** HLD B1, B2, C3, C6, C7 · [lld/00](00-design-process-and-roadmap.md)–[02](02-r1-foundations.md) (R1 with Revision 1) · [integration decisions](11-integration-decisions.md)
**Research inputs:** [research/01](../research/01-dsl-compiler-executable-render-ir.md), [02](../research/02-layers-compositing-and-incremental-revision.md), [07](../research/07-production-coordination-futures-and-spatial-contracts.md), [spike log](../research/10-spike-evidence-log.md), [S4 evidence](../research/evidence/s4-render-host.md), [S3/S5/S6 evidence](../research/evidence/s3-s5-s6-minimax.md), [S7 evidence](../research/evidence/s7-pixi-hardening-follow.md), [batch 2a evidence](../research/evidence/b2a-colour-mux-mix.md)

Type and JSON snippets are illustrative; their field names are the persisted `snake_case` names. Entity schemas belong to R3. `I-n` and `Fn` are items and first-report findings in the integration decisions; `§12 Fn`, `§13 #n`, `§14.n`, `Hn` (§15), `FRn` and `§16.2 #n` cite its later sections, which win. Bare `S1`–`S7` are spikes in the spike log; `R4-SPn` are R4's wanted spikes.

## 1. Problem and scope

The compiler turns one immutable project revision into a frozen, executable **Render Plan**, or into typed diagnostics that say exactly why it cannot. It is the boundary where editable creative meaning (HLD C2) becomes reproducible execution (HLD C6). It must not invent anything creative or change the project.

In scope: passes, diagnostics, the timing solver, the track evaluator, readiness policies, the Render Plan, work keys, chunking, previews, the scene context (HLD C3), the camera model and baking rules. Out of scope: entity schemas (R3); host page, capture, encode and the rung ladder (R2); jobs and the cache (R5); the FFmpeg mix graph (R7); check thresholds (R9).

Terms:

- A **render unit** is one host page over a run of frames: a shot, or the overlap of two shots during a transition (F145).
- A **frame table** holds one value per frame of a render unit.
- A **track interval** is the span of a control track from its first key to its last.
- A **footprint** is a declared region where an object's pixels may appear. A **probe box** is the box the runtime shim measured for a tagged element in a real render.
- **Grade** (`animatic`, `preview`, `final`) is the readiness of a plan's inputs and belongs to R4. **Rung** (`still`, `draft`, `review`, `final`) is output fidelity and belongs to R2. A plan carries both; delivery needs both at `final` (I11).
- A **`pin_hash`** is the hash of an entity version with its commitment readiness removed (I18). The compiler pins every input by `pin_hash`.

## 2. Decisions

### D1. The compiler is a pure function that runs eight passes over the whole project

**Problem.** HLD C6 forbids a plan that changes meaning at frame time. B2.2 forbids "unresolved creative promises masquerading as executable inputs".

**Choice.** `compile(request, facts)` returns a **compilation record**. The request names a `revision`, a `mode` (`plan` or `frozen`, D4), a `grade`, a `rung` and a `scope` (D7). `facts` is a snapshot of recorded facts that the compiler reads and never writes: validation records, the environment record, the capability registry and R2's rung settings. The same request and facts always give a byte-identical result. The compiler uses no clock, randomness, network or model call, and never starts a job.

| # | Pass | Produces |
|---|---|---|
| 1 | Resolve | References bound to `pin_hash`; data bindings replaced by formatted values (D5); ArtifactRefs confirmed present; authoring times as flick expressions |
| 2 | Validate | Type-checked graph; unresolved choices |
| 3 | Solve timing | A flick time for every point; film length; timing report |
| 4 | Check capability and readiness | Feasibility report (`plan`) or readiness verdict (`frozen`) |
| 5 | Check staging | Regions and anchors keyed to flicks; declared-versus-declared findings |
| 6 | Lower | Render units with frame tables; mix plan; caption plan; quality declarations; bake decisions |
| 7 | Chunk and key | Chunks, work keys, the `execution` part |
| 8 | Emit | Manifest and parts as content-addressed blobs; source map |

Diagnostics accumulate, so one compile returns every repairable finding it can. A pass skips only the shots whose inputs are blocked.

**Tools (I23, F100, F101).** Three read-only tools run inline in their tool handlers, because a compile is pure and cheap (D8); `compile` is not a Scheduler capability (§12 F9). Rendering is requested through the scheduler-backed `render_request`, never through the compiler.

| Tool | Input | Result |
|---|---|---|
| `compile` | `revision`, `mode`, `grade`, `rung`, `scope` | `compilation_id`; `plan_id` if a plan was emitted; the top diagnostics; a feasibility summary |
| `plan_diff(a, b)` | Two plan IDs or compilation IDs | The units, chunks, frames, bakes, audio clips, caption cues and work keys that differ, named by entity (D8) |
| `timing_explain(compilation_id, select?)` | `select`: one of `{event}`, `{constraint}`, `{conflict}`. This is a union of shapes, so on MiniMax it travels as JSON text (R6 D7) | Timing report rows, or the conflict witness (D3) |

The compilation record holds the plan ID, every diagnostic, the feasibility report, the timing report and the hash of the facts snapshot. Its ID is the hash of the request and that snapshot, so a repeated compile returns the same record. `evidence_read` pages through the remaining diagnostics. The `compile` tool handler stores the record as a content-addressed blob of canonical JSON with `durable: false`, because it is derived, and indexes it in a table `compilation (id, revision, plan_id, record)` that the compiler owns and registers through Project Core's migrations; it is not an `evidence` row. A plan or record that a deliverable cites is rooted by that deliverable, and the others follow the rules for derived blobs (decided: `lld/11` section 18, B:O4).

### D2. One diagnostic shape and a closed catalogue of codes

Every diagnostic follows the R1 §5 evidence convention: code, pass, severity, `blocks`, check type, failure class, subject entity IDs with handles, field path, optional flick interval and region, observed facts and repair options. A repair option is a patch template the Director may apply; the compiler never applies one.

**Severity** uses R1's values (`blocking`, `material`, `minor`, `note`). A separate **`blocks`** field says what the diagnostic stops (F51):

- `frozen`: no plan in `frozen` mode; in `plan` mode only the affected shot is left out or given a placeholder. `frozen†` applies at grade `final` only.
- `both`: no plan in either mode.
- `none`: it never blocks. Every `material` and `note` code below has `blocks: none`.

Validate and timing codes are corrective checks (HLD B3.1); staging and after-render codes are observational; `RIGHTS_UNRESOLVED` is a hard delivery constraint. A code is defined by the module that raises it (C3). R4 relays unchanged Project Core's `UNKNOWN_ENTITY`, `REF_KIND_MISMATCH`, `BLOB_MISSING` and `RATE_NOT_FLICK_EXACT`, and R2's `FONT_UNREGISTERED` and `LIBRARY_UNREGISTERED` (§13 #39), and R7's `TAKE_SUPERSEDED`, `CAPTION_READING_SPEED`, `CAPTION_TOO_SHORT` and `CAPTION_TIMING_ESTIMATED` (decided: `lld/11` section 18, C:M5-O6 and C:M5-O7). The others are R4's, including `UNKNOWN_CONTROL`, which R6 and R7 relay (§16.2 #4).

| Code | Severity/blocks | Points to | Suggested repair |
|---|---|---|---|
| **Resolve** | | | |
| `UNKNOWN_ENTITY` | blocking/both | Referencing field | Nearest handles |
| `REF_KIND_MISMATCH` | blocking/both | Field and entity reached | Retarget |
| `BLOB_MISSING` | blocking/frozen | ArtifactRef and owner | Re-run the producer |
| `TAKE_SUPERSEDED` (R7's) | blocking/frozen; material in `plan` mode | Selected take whose `spoken_text` no longer matches its line, found by R7's `takeIsCurrent` in the Resolve pass | Select or request a new take |
| **Validate** | | | |
| `UNRESOLVED_CHOICE` | blocking/frozen | Layer with no source, or a component source whose component has no document; line with no selected take | Decide, author or remove |
| `PARAM_TYPE_MISMATCH` | blocking/frozen | Value and its `meta` declaration | Clamped value |
| `UNKNOWN_CONTROL` | blocking/frozen | Control track channel | Nearest declared controls |
| `CONTROL_CONFLICT` | blocking/frozen | Two tracks on one track layer writing one control in overlapping intervals | Trim one, or change its layer |
| `RIGHTS_UNRESOLVED` | blocking/frozen† | Asset not `eligible` for the delivery profile | Eligible substitute |
| `FONT_UNREGISTERED`, `LIBRARY_UNREGISTERED` | blocking/frozen | Component and its font family or library | Nearest registered one |
| `RATE_NOT_FLICK_EXACT` | blocking/both | Delivery profile rate | A flick-exact rate |
| `TIMELINE_GAP` | blocking/frozen | Take, cue or event solved after the last shot ends; consecutive shots are contiguous (D3; decided: `lld/11` section 18, L4 and B:O13) | Extend a neighbour |
| `STACK_ORDER_MISMATCH` | blocking/frozen | Scene-context `draw_groups` or item `order` contradicting `shot.layers` (D5) | Reorder the layers or fix the declaration |
| `GROUP_NOT_CONTIGUOUS` | blocking/frozen | A `shot.groups` group whose members are not adjacent in `shot.layers`, and the layers between them (D5; decided: `lld/11` section 18, B:O14-groups) | Reorder the layers or split the group |
| `CROSS_COMPONENT_EFFECT_UNSUPPORTED` | blocking/frozen | Effect the host cannot express (D9), including a `matte` effect whose `from` has a live component source | One merged component, or a baked matte through `MaskSpec {type: image}` |
| **Timing** | | | |
| `TIME_POINTS_EXCEEDED` | blocking/both | The film; the point count and `timing.max_points`. The solve and the later passes are skipped (decided: `lld/11` section 18, B:O3) | Simplify the timing network, or raise `timing.max_points` |
| `TIME_CONFLICT` | blocking/frozen | Cycle of constraints (witness, D3) | Relaxation per constraint |
| `TIME_CUT_OFF_GRID` | blocking/frozen | Cut whose window holds no frame boundary | Widen by the stated amount |
| `TIME_GRID_MISS` | material | Beat-snapped event with no beat in its window | Widen, or name a beat |
| `TIME_BEAT_UNAVAILABLE` | blocking/frozen | Beat reference without a beat grid | Add a grid |
| `BEAT_GRID_UNVERIFIED` | blocking/frozen† | Visual on a beat of an unverified grid | Verify the grid |
| `TIME_MAP_INVALID` | blocking/frozen | Overlapping or disordered time-map segments | The offending segments |
| `MEDIA_RANGE_EXCEEDED` | blocking/frozen | Source time beyond the media | Trim, slow or freeze |
| `COMPONENT_RANGE_EXCEEDED` | blocking/frozen | Layer, its component and the unit frames whose local time falls outside a `fixed` `meta.duration` when `meta.out_of_range` is `error`; raised in Lower, when the frame tables are built (decided: `lld/11` section 18, B:O14-range) | Change the time map, the layer's `visible` interval or the component's `out_of_range` |
| `TIME_OUTSIDE_TARGET` | material | Film length outside `brief.duration_target` | Amount over or under |
| `TIME_PREFERENCE_CLAMPED` | note | Unmet preference and its binding constraints | Constraint to relax |
| `TIME_UNANCHORED` | note | Events placed by the earliest-time rule | Add a pin or preference |
| `TIME_ESTIMATED_ANCHOR` | note | Constraint resting on an estimate | — |
| `TIME_ROUNDED` | note | Event rounding; film end moved to a frame boundary | — |
| `SYNC_ROUNDING_RISK` | note | Frame period above R9's `sync.event_early_ms` | Higher rate, or accept |
| **Capability and readiness** | | | |
| `CAPABILITY_GAP` | material | Item and its feasibility state (D4) | Author, adapt or experiment |
| `CAPABILITY_BLOCKED` | blocking/frozen | Item and the blocking constraint. Also a `final` compile with `quality_intent.disclosure.visible_notice` on while the notice overlay does not exist, naming the notice (decided: `lld/11` section 18, L16 and C:M6-O7b) | Change the treatment |
| `NOT_READY` | blocking/frozen | Input, missing readiness fact, its recorder | Request the fact |
| `TAKE_TIMING_ESTIMATED` | blocking/frozen† | Selected take whose `timing` fails R7's `voice.final_timing` | Align it, or select another |
| `STALE_COMMITMENT` | material | Consumer pinned to a superseded scene context | Re-pin and revalidate |
| `PLACEHOLDER_USED` | note | Each placeholder | Supply the real input |
| `ENV_UNREGISTERED` | blocking/both | Missing environment record | Register it (R2) |
| **Staging** | | | |
| `ANCHOR_UNRESOLVED` | blocking/frozen | Undeclared anchor, or asset anchor without its crop | Declare it |
| `FOOTPRINT_OVERLAP` | material | Footprint inside another item's avoid region | Move, retime or reorder |
| `SAFE_ZONE_VIOLATION` | material | Screen region outside the safe zone | Offset that fixes it |
| `CAMERA_INVALID` | blocking/frozen | Zoom outside `camera.zoom_min`–`camera.zoom_max` | Clamped value |
| `EFFECT_UNREALISED` | blocking/frozen | Cross-layer effect naming no realisation | Add one (D9) |
| **Lower, key, emit** | | | |
| `MEDIA_NOT_PREPARED` | blocking/frozen | Footage range without extracted frames | Request `media.extract_frames` |
| `CAPTION_TEXT_MISMATCH` | blocking/frozen; material in `plan` mode | Authored cue differing from the line's `display_text` (§12 F21) | The differing words |
| `CAPTION_READING_SPEED`, `CAPTION_TOO_SHORT`, `CAPTION_TIMING_ESTIMATED` (R7's) | material | Caption cue that R7's segmenter reports when the compiler calls it | As R7 states |
| `UNIT_TOO_LARGE` | material | Unit over R2's `host.max_layers` | Merge components or bake |
| `UNIT_PIXI_LIMIT` | blocking/frozen | Unit over `pixi.max_per_unit` PixiJS components (§14.1) | Merge them, or use Canvas 2D |
| `INTERNAL_INVARIANT` | blocking/both | Compiler defect | Escalate; class `deterministic` |
| **After render (D9)** | | | |
| `FOOTPRINT_EXCEEDED` | material | Probe box outside a conservative footprint | Widen footprint or constrain component |
| `AVOID_REGION_ENTERED` | material | Another owner's probe box in an avoid region | Restage |
| `ANCHOR_DRIFT` | material | Anchor beyond `staging.anchor_tolerance_du` from its probe point | Correct anchor or component |
| `PROBE_MISSING` | note | Declared item with no probe box; verdict `UNKNOWN` | Tag the element |

### D3. Timing is a Simple Temporal Network solved in flicks

**Problem.** Moving an eruption must move its reaction while a locked voice take stays put (VISION §4). Impossible timing must be reported in words a model can act on.

**Formulation.** A Simple Temporal Network (STN) is a set of time points with constraints `lo ≤ x_j − x_i ≤ hi`. Its **distance graph** has an edge `i→j` of weight `hi` and an edge `j→i` of weight `−lo`. The network is consistent exactly when that graph has no cycle of negative total weight, and shortest paths give each point's earliest and latest time ([Dechter, Meiri and Pearl 1991](https://ftp.cs.ucla.edu/pub/stat_ser/r113-L-reprint.pdf), restated in [Rossi et al.](https://arxiv.org/abs/1110.2212) and [Micheli 2022](https://arxiv.org/abs/2212.07226)).

- **Variables.** One point per event; a start and an end per shot, take and cue; and the origin at film time 0. Word marks, beats and control-track keys are constant offsets from a take start, a cue start or a track's `origin` event, not variables.
- **Hard constraints.** `time_constraint` entities (`min ≤ t(b) − t(a) ≤ max`); `shot.duration` (an equality when `fixed`, bounds when `derived`); `event.pin` (the event equals its owner's start plus the pin); and structural rules: start ≤ end, shot order, transition overlap, every point ≥ 0, every track interval inside its shot. Weights are integer flicks, so solutions are integral.
- **Shots are contiguous** (decided: `lld/11` section 18, L4 and B:O13). Consecutive shots in film order meet: `start(next) = end(previous) − d`, where `d` is the next shot's `transition_in.duration` (0 without a transition), and the first shot starts at 0. A constraint that would open a gap lengthens a `derived` shot, or gives `TIME_CONFLICT` with a witness against a `fixed` or locked one. `TIMELINE_GAP` is raised only for sound, cues or events solved after the last shot ends.
- **Film length (§13 #33).** `brief.duration_target` is a preference behind `TIME_OUTSIDE_TARGET`, not a bound in the solve. A hard limit exists only as a Quality Intent hard constraint, checked by R9's F-06.
- **Track intervals replace "actions" (F123).** There is no action entity, and components declare no minimum durations. Keys are offsets from the track's `origin` event (I17), so an interval is rigid and "inside its shot" is two bounds on that event.
- **Measured durations.** A selected take contributes `end − start = round(samples × 705,600,000 × den / num)` from its `samples` and rational `sample_rate` (F113). A line with no take uses its estimated duration. Here and in every other "round to nearest" of this document (the beat-grid and position formulas, and rounding to `plan.quantum`), an exact half rounds up, towards +∞, computed exactly on integers where the operands are integers (R1 Revision 3; decided: `lld/11` section 18, L6, L34).
- **Soft preferences.** A `time_constraint` may carry `preferred` and an integer `priority` (F121); it has no `strength` field (§12 F6).

**Locks become equalities (F122).** R3 locks protect paths. The compiler reads three:

| Locked path | Equality |
|---|---|
| `voice_line.selected_take` | Line duration equals the take's measured duration |
| `event.pin` | The event sits at its owner's start plus the pin |
| `shot.duration` | Shot end minus shot start equals the stored value |

Unlocked, these fields still constrain the solve (class `measured` or `authored`) and a repair may propose changing them. Locked, their class is `locked`: a repair may only propose lifting the lock, listed last. Other locks add no timing constraint.

**Algorithm.**

1. **Consistency.** Bellman-Ford from all-zero distances finds any negative cycle in O(points × edges) ([description](https://cp-algorithms.com/graph/finding-negative-cycle-in-graph.html)).
2. **Minimal network.** Floyd-Warshall computes all-pairs shortest paths, the exact feasible window of every pair. This network is decomposable: any value chosen inside a window extends to a full solution without backtracking (Dechter et al.).
3. **Ordered commitment.** Fix values one at a time, updating the matrix in O(n²) after each: (a) each cut, in film order, to the first frame boundary at or after its earliest time; (b) beat snaps, to the beat nearest the preferred value in the window; (c) preferences by priority then entity ID, clamped into the window, with `TIME_PREFERENCE_CLAMPED` when clamped; (d) every remaining point at its earliest time.
4. **Frames.** Film length is `N = ceil(end / T)` (R1 §1.4). A visual event is presented on frame `ceil(t / T)` (R1 §1.5), so a reaction cannot precede its cause.

**Unpinned events take the earliest time (I22).** Rule (d) is a documented language rule, not a creative choice. A window without a preference raises no `UNRESOLVED_CHOICE`. The timing report marks each such event `placed_by: earliest_rule`, and `TIME_UNANCHORED` summarises them.

**Sound tied to a picture event (I21, R1 Revision 1).** An `sfx_cue` or music hit point anchored to a visual event defaults to `sync: presented_frame`: its `sync_point`, the offset inside the sound that should land on the event, is placed at `presented_frame × T`. Otherwise the sound would lead its picture by up to one frame. Voice and free-running music stay sample-accurate at the solved time.

The **timing report** lists for every event its time, window (the slack), presented frame, `placed_by`, precision and binding constraints. Precision is `exact` (authored or solved), `measured` (a take's samples, or `native` word times) or `estimated` (an estimated duration, word marks from an `aligned` or `estimated` take, or an unverified beat grid). A word's `confidence` is carried separately (F114).

**Conflict witness.** Predecessor links from an edge that still relaxes on pass n lead into a negative cycle. The compiler maps each edge to the constraint, take, track or lock that produced it, merges consecutive rigid edges and rewrites them as readable rules in film order. The **deficit** is the negated cycle weight. For each unlocked constraint the witness states how far it must be relaxed and whether that alone suffices. Up to `timing.max_witnesses` cycles are reported.

```json
// Illustrative
{"code":"TIME_CONFLICT","deficit":"400ms","cycle":[
 {"rule":"line03.start ≥ shot04.start + 300ms","source":"tc_11","class":"authored"},
 {"rule":"line03.end = line03.start + 4.200s","source":"take tk_a1","class":"locked"},
 {"rule":"eruption ≥ line03.end + 150ms","source":"tc_12","class":"authored"},
 {"rule":"doubletake = eruption + 650ms","source":"tc_13","class":"authored"},
 {"rule":"track tr_7 ends at doubletake + 600ms","source":"tr_7 last key","class":"authored"},
 {"rule":"track tr_7 ends ≤ shot04.end","source":"track inside shot","class":"structural"},
 {"rule":"shot04.end = shot04.start + 5.500s","source":"lock lk_3","class":"locked"}],
 "repairs":[{"relax":"tc_13","by":"400ms","sufficient":true},{"unlock":"lk_3","by":"400ms"}]}
```

**Beat grids.** A `music_cue` carries a beat grid with a `source` and a `verified` flag. An `authored` grid (code-rendered music) is exact: at `num/den` beats per minute, beat `k` falls at `offset + round(k × 60 × 705,600,000 × den / num)` flicks, computed from its absolute index so no drift accumulates. A `detected` grid lists its analysed beat times in `beat_grid.beats`, in flicks from the cue's start (§13 #9); they are `estimated` until verified. A `final` compile raises `BEAT_GRID_UNVERIFIED` when a visual references a beat on a grid that is neither `authored` nor `verified` (F117). A visual on a beat appears on the next frame: under 33.4 ms late at 30 fps, inside R9's 40 ms `sync.event_early_ms` and the +45 ms threshold of [ITU-R BT.1359-1](https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1359-1-199811-I!!PDF-E.pdf). At 24 fps it can reach 41.6 ms, which raises `SYNC_ROUNDING_RISK`.

**Rejected.** Disjunctive constraints ("A before B, or after C") are NP-hard (Dechter et al.) and are creative choices for the Director.

### D4. One compiler, two readiness policies

HLD C6 requires planning feasibility to be separate from frozen compilation. The **grade** names the readiness condition to test. The **mode** names what happens when an input misses it.

| Grade | Condition on inputs |
|---|---|
| `animatic` | The structure validates and timing solves. Placeholders and estimated durations are allowed. The treatment comparison renders its candidates at this grade (FR2) |
| `preview` | No placeholder: every layer has a source, every component source has a validated component and every line a selected take; footage is extracted; fonts, libraries and the environment are registered |
| `final` | The `preview` condition, and: every pinned commitment is `frozen`, including each voice line's; every asset is `eligible` for the delivery profile (I16); beat grids are `authored` or `verified`; every selected take's `timing` is `native` or `aligned` (R7's `voice.final_timing`, §13 #3) |

A take has no separate acceptance fact: the accepted take is the one selected in the revision being compiled (F115).

**`plan` mode.** Each layer, control track and shot gets a feasibility state computed from recorded facts only:

| State | Rule |
|---|---|
| `supported` | Source bound; any component source validated for this environment; every referenced control declared; media and capture sources prepared; assets eligible |
| `needs_adaptation` | A track uses a control or range the component lacks, or validation failed repairably |
| `needs_authoring` | The layer has no `source`, or its `layer.source` is of kind `component` and that component has no document (G6) |
| `unknown_test_required` | Not validated in this environment, or a layer, blend, mask or filter combination outside the measured set |
| `blocked_by_constraint` | Rights, lock, budget or policy forbids it |
| `impossible` | A timing cycle of only locked and structural edges, or a media range that does not exist |

The measured set is a record in the capability registry, read through `CompileFacts.capabilities`, listing the compositing features verified across sandboxed iframes: S4's eight cases (opacity, `multiply`, `screen`, a linear-gradient `mask-image`, `clip-path: inset` and z-order) plus what M1's automated tests add. A test that passes adds its case to the record, which is a fact, so no code changes. Anything else, such as other blend modes, group isolation with opacity, filters and `backdrop-filter`, is `unknown_test_required` (decided: `lld/11` section 18, B:O14-measured).

The first four states are not errors. Each returns as a `CAPABILITY_GAP` diagnostic carrying the state and repair options: a planning result that R7's gap flow consumes, not a failed job (F134). A plan is still emitted for the healthy shots. Where a placeholder stands in (D7), the plan is recorded at grade `animatic` whatever was requested.

**`frozen` mode.** Every input must satisfy the requested grade's condition, expressed as R5's typed predicates over the R1 §4.2 readiness facts. Any miss is `NOT_READY` and no plan is emitted. The compiler neither waits nor starts remediation.

The manifest records the grade and every provisional input, so output from a provisional plan can never be labelled delivery-eligible.

### D5. The Render Plan is a small manifest over content-addressed parts

**Problem.** The plan must be frozen, complete enough for a host page that makes no decisions, and cheap to store on every compile.

**Choice.** The manifest references its parts by hash, so plans share unchanged blobs: render units, `execution`, `quality_declarations`, the audio mix plan, the caption plan, the timing report and the source map. The plan ID is `plan_` plus the manifest hash.

```ts
// Illustrative
type RenderPlan = {
  revision: RevId; mode: "plan" | "frozen"; grade: Grade; rung: Rung;
  rung_settings: Hash; env: Hash;
  delivery: { profile: Hash; fps: Rate; canvas: [number, number] };
  commitments: { entity: EntityId; pin_hash: Hash; readiness: string }[];
  timeline: { unit: Hash; kind: "shot" | "transition";
              film_start_frame: number; local_frames: [number, number] }[];
  execution: Hash; quality_declarations: Hash;
  audio: Hash; captions: Hash; timing: Hash; source_map: Hash;
  gaps: Diagnostic[]; provisional_inputs: { path: string; reason: string }[];
};
type RenderUnit = {
  frames: number; canvas: [number, number];
  camera: { cx: Channel; cy: Channel; zoom: Channel; rot: Channel };
  stack: Node[];                                // shot.layers, bottom to top
  fonts: { family: string; file: ArtifactRef }[];
};
type Node = Layer | { group: Node[]; opacity: Channel; blend: Blend; mask?: Mask; filter?: Channel };
type Layer = {
  source: Source; space: "world" | "screen"; parallax?: number;
  follow?: Channel;                             // runs of {layer, anchor} | null; D9
  local_time: (number | null)[];                // flicks per frame; null = hidden
  place: { x: Channel; y: Channel; scale: Channel; rot: Channel; opacity: Channel };
  controls: Record<string, Channel>;            // every declared control
  blend: Blend; mask?: Mask; filter?: Channel;
};
type Source =
  | { kind: "component"; html: ArtifactRef; params: Json; seed: number; size: [number, number]; zoom_max: number }
  | { kind: "media"; frames: ArtifactRef; source_frame: (number | null)[];
      crop: Rect; fit: Fit; mapping: Json }     // the one display crop, source pixels; asset.mapping
  | { kind: "baked"; bake: Hash; live: Source }
  | { kind: "caption" | "fill" | "effect" | "cursor"; params: Json }
  | { kind: "placeholder"; label: string; footprint: Region };
type Channel = { const: Json } | { from: number; values: number[] } | { runs: [number, Json][] };
```

- **Positions carry their unit (F81).** `film_start_frame` is a film frame. `local_frames` is a half-open range of unit-local frames. Times are flicks.
- **Rung settings.** The rung fixes output scale and frame step. The plan also pins R2's settings bundle for that rung by hash: intermediate format and quality, encoder preset and CRF, colour settings and encoder version (F91). Units hold no rung value, so one unit serves every rung.
- **Stacking (§12 F3).** `stack` follows `shot.layers`, bottom to top, the single source of paint order. A scene context's `draw_groups` and item `order` are declared constraints, checked against it in the Validate pass (`STACK_ORDER_MISMATCH`).
- **Layer sources (F93).** `component` is a sealed, sandboxed component; its `seed` is `layer.seed`, by default derived from the entity ID. The other kinds are trusted host code whose parameters R2 defines: `media` (the source frame computed from native timestamps, R1 §1.7, with its `crop`, `fit` and asset mapping, §13 #25), `baked` (D11), `caption` (the caption plan's cues), `fill` (a colour or gradient), `effect` (a host-level effect such as blurring what lies behind), `cursor` (a tutorial pointer) and `placeholder` (D7).
- **Lowering `layer.source` (FR6).** `{media, crop?, fit}` and `{capture, steps}` lower to the trusted `media` kind, with the asset's frame set, or the capture session's over the named `steps`. `fit` is `contain`, `cover` or `fill`, as in R3. `crop` is `layer.source.crop` in source pixels, or the whole frame. It is the only display crop and the host applies it once; `mapping` crops nothing. A crop change is a new layer version, not a new asset. `{fill}` and `{effect}` lower to the trusted kinds of the same name, `{kind, params}`, whose `params` is R2's `fill` or `effect` record (decided: `lld/11` section 18, L7 and A:M1-1).
- **Data bindings (FR5).** A binding in a layer's `params` references `claim.values`, the single home of a factual figure, or a dataset cell that references one. A line's `display_text` and `spoken_text` use `{name}` placeholders resolved through `voice_line.bindings: {name: {ref, member}}`; a dataset cell is a value or `{ref, member}`. The Resolve pass replaces each binding with the value as R7's one formatter renders it, and cue text derives from the line. A corrected value therefore changes the compiled chart `params`, caption cues and their work keys.
- **Groups, blend, masks, filters.** A layer's `group` name and its shot's `groups` map (F120) lower to group nodes. The members of one group must be adjacent in `shot.layers`, so that one group node keeps the paint order; otherwise the Validate pass raises `GROUP_NOT_CONTIGUOUS`. Splitting silently into several group nodes is rejected, because two isolated groups at opacity 0.5 look different from one (decided: `lld/11` section 18, B:O14-groups). Blend is one of the 16 `mix-blend-mode` values ([W3C Compositing 1](https://www.w3.org/TR/compositing-1/)). A mask is a clip shape with per-frame geometry, a gradient, or an image asset, which may be a baked component; a live component cannot be another's matte (I6). Layers and groups carry a `filter` channel: a list of filter functions per frame (F94), from the static `layer.filter` and any `filter.*` track channels.
- **Transitions.** A dissolve or wipe is its own unit: both shots' stacks as two groups over the overlap frames, with the transition as group channels. A dissolve lowers to the incoming group's opacity channel. A wipe lowers to a `clip` mask channel on the incoming group whose inset sweeps across the canvas in `transition_in.direction`, linear in time, over the overlap frames (decided: `lld/11` section 18, B:O14-wipe).

**Track evaluation: one evaluator, in the compiler (I4).** A trusted, pure TypeScript module evaluates control tracks, time maps and the camera once, into frame tables. At render time R2's engine reads the tables and sends frame packets; the host and the components interpolate nothing. This gives exact slicing for work keys (D6).

1. **Targets (§12 F1, F2).** A track targets a layer or a camera through nested channel keys: on a layer `channels.transform.*` (`x`, `y`, `scale`, `rotation`, `opacity`), `channels.controls.*` and `channels.filter.*` (such as `channels.filter.blur`); on a camera `channels.camera.*`. A layer's step channel `channels.follow.leader` is lowered the same way (D9).
2. **Key times.** A stored key time is an offset from the track's `origin` event. Each row is sampled at the start of its frame.
3. **Four track layers (I17).** Every track sits on `base`, `derived`, `acting` or `override`, lowest to highest. A track covers a channel from that channel's first key to its last, and the highest layer covering a channel wins. Outside every interval a control takes its `meta` default, or `null` if declared `nullable`, a transform channel takes the layer's stored `transform`, and a filter channel takes the static `layer.filter`. Two tracks on one layer covering one channel in overlapping intervals raise `CONTROL_CONFLICT`, so evaluation order never decides.
4. **Complete controls (I3).** Every declared control has a value in every row. `null` means "automatic" and is legal only for a nullable control.
5. **Easing (F16).** The `ease` on a key shapes the segment arriving at it: `step`, `linear`, `cubic_bezier(x1, y1, x2, y2)`, or a named preset. Presets are aliases of cubic-bezier curves in a versioned table, such as `out_back` = (0.34, 1.56, 0.64, 1). Overshoot is allowed; after easing, a bounded control is clamped to its declared range. Enumerated, boolean and text controls step. `point` controls interpolate per coordinate.
6. **Numbers.** Values are rounded to `plan.quantum` before hashing, so last-digit floating-point differences cannot change a key. Canonical JSON then fixes their text form ([RFC 8785](https://www.rfc-editor.org/rfc/rfc8785)).

**Frame packets (F79–F81, F95).** R2's input is the lowered unit plus frame packets built from it by the same module. For unit-local frame `f`, a layer's packet carries `frame` = `f`; `t_flicks` = `local_time[f]`, an integer on the layer's local clock after its R1 §1.6 time map; `t` = `t_flicks / 705,600,000` seconds; the row's controls; and the final matrix (D10). Component `meta` gives durations in seconds; the project copy stores them rounded to flicks.

**Audio mix plan.** Clips with a source ArtifactRef, in and out points in source samples, a start in output samples, gain keyframes, fades and a bus, plus ducking rules. The mix and the delivered audio are fixed at 48 kHz in v2; a profile with another rate is rejected (§13 #26). A position is `round(t / 14,700)`, after the sync rule of D3. The mix is `round(N × T / 14,700)` samples long (F35); the video has exactly `N` frames, and the container's audio may exceed the mix by at most one AAC frame (F141, §12.2). R7 lowers the plan to FFmpeg, whose `adelay` accepts exact sample counts ([FFmpeg filters](https://ffmpeg.org/ffmpeg-filters.html)).

**Caption plan.** Cues with start and end in flicks and presented frames, text, line breaks, word records, direction, language and source take. The style is trusted data: a preset name and parameters. For a `derived` track the compiler calls R7's segmenter as a pure function to produce the cues (§12 F22). The compiler clips every `caption_track.suppress` interval out of the burn-in cues, so the renderer receives clipped cues and no suppression field; R7's sidecars keep the full cues (§13 #22). Burned-in captions are a `caption` layer, emitted when the profile's `captions.burn_in` is true.

**Quality declarations (F87, F88).** This part states what the plan expects, so R9's detectors can tell a defect from a choice. It is derived from the frame tables, the mix plan and the Quality Intent; nothing is invented.

| Field | Content and source |
|---|---|
| `holds` | Intervals where a freeze is expected: every visible layer has constant channels and frozen or irrelevant time, or a waiver applies |
| `black` | Intervals with no visible layer or only black fills, or waived |
| `silent` | Sample intervals with no clip in the mix plan, or waived |
| `expected_motion` | Intervals where a visible layer has a changing channel or advancing time, or the camera moves |
| `must_see` | The resolved `layer` stack path, `probe_id` and interval per entry of the Quality Intent's `must_see` map, whose `element` is `{layer, cut_id}` as in `event.probe`, with event references solved (decided: `lld/11` section 18, B:O14-must_see) |
| `sync_pairs` | `{event, layer?, probe_id?, predicate?, expected_frame, audio_sample}` for each cue anchored to a visual event |
| `handoffs` | `{layer, frame, from, to}` per change of `follow` leader: the switch frame and the old and new `{layer, anchor}`, with `null` for an empty end on attachment or detachment. With both ends present, R9's P-11 measures the distance between the anchors; with either end empty, it measures the follower's displacement from the frame before the switch to the switch frame, against the same tolerance (G18, D9) |

Sync pairs are built from authored bindings only (§12 F8, §13 #30). An `event` may carry `probe: {layer, cut_id, predicate}` with predicate `visible` or `moved`; the compiler resolves it to `layer` (the stack path the sidecar uses) and `probe_id` (§16.2 #2), and infers nothing. A pair whose event has no binding carries none of the three, and R9's planned-pair sync check records `UNKNOWN`.

**Execution (F96–F99).** The compiler stays pure. The `execution` part is a graph that R5's deterministic adapter `plan_to_jobs(plan, purpose)` turns into job specifications; the `render_request` and `delivery_finalize` handlers call it.

```ts
// Illustrative
type ExecNode = {
  id: string;                                   // local to the plan
  capability: "component.bake" | "chunk.render" | "still.render" | "audio.mix" | "film.concat" | "film.mux";
  work_key: Hash; inputs: Json;                 // chunk: {unit, local_frames}; still: {unit, frames}
  depends_on: string[]; requires: Predicate[];  // node ids; R5's readiness predicates
  pixi?: true;                                  // the unit holds a PixiJS component
};
```

A chunk or still depends on the bakes it shows. `film.concat` depends on every chunk in scope, in timeline order. `film.mux` depends on `film.concat` and `audio.mix`. The chunk and still nodes of a unit that holds a PixiJS component (one whose `meta.libraries` names PixiJS) carry `pixi`, so the Scheduler renders it one browser at a time (R5's `pixi.unit_browsers`, §14.1). A work key identifies reusable execution inputs only; revision and plan are recorded on the consumer.

**Source map.** A side table from structural paths (unit hash, stack path, control name) to entity ID, `pin_hash` and field path, with a map from each `data-cut-id` to its entity and each unit's closure of entity versions. No entity ID appears inside a unit, so identical content from different branches shares one cache entry and renaming a handle changes no key.

### D6. Work key for a chunk

A work key is the R1 §2.4 hash that identifies a piece of work. For `chunk.render` it is the SHA-256 of the canonical JSON of:

1. **Capability and version:** `chunk.render` plus the hash of the capture engine and trusted layer code.
2. **Environment hash:** the hash covering the complete pixel-affecting input list in R2 §2.8 (FR15, G8).
3. **The unit slice:** the render unit restricted to the chunk. Nodes with no visible frame in the range are removed, except a leader that a remaining layer follows, and every table is cut to the range. What remains holds component, media, bake and font hashes and every per-frame value.
4. **The rung** (F92).
5. **A diagnostic capture mode,** only when requested. Hide, isolate and tint are R2 engine features that R9 requests per capture, naming the target by stack path (I9, F102). Such a capture is never reused as a normal render.

Excluded: entity IDs, handles, revision and plan IDs, commitment readiness, grade, the source map, audio, job IDs, budgets and the compiler version. Freezing an unchanged provisional commitment therefore changes no key (I18), and a shot that only moves in film time keeps every chunk key. This holds at any frame step: step `k` samples the unit's own frames 0, `k`, 2`k`, so a slice carries only its phase within the unit, never film position (§12 F7).

**Rejected.** Hashing the whole plan or the whole unit would re-render far more than an edit touches.

Slicing is sound only because `seek(t, controls)` is pure, which R2's out-of-order seek check enforces. S4 showed that fresh browsers with the same render history are byte-identical and that a different history differs at about 82 dB. Each chunk therefore runs in a fresh context with a fixed warm-up, and reuse is correct to a tolerance (R1 §5), not to the byte.

**Chunk result (I10).** `chunk.render` is atomic and always returns `{segment, frames, fps, probe_sidecar, rung, diagnostic}`: a closed-GOP H.264 segment at the rung's settings plus a probe sidecar. `film.concat` and `film.mux` reject a segment whose `diagnostic` is true, with `DIAGNOSTIC_IN_DELIVERY` (§13 #29). Final assembly joins segments by stream copy and muxes audio; there is no second video encode. Stills come from the separate `still.render`: a frame list in, image artifacts and probe records out (§13 #10). Other keys follow the same pattern:

| Capability | Key inputs |
|---|---|
| `still.render` | As a chunk, with the unit cut to the listed frames |
| `component.bake` | Sealed component, params, seed, constant controls and time, size, bake scale, engine, environment |
| `audio.mix` | Mix plan hash, FFmpeg build |
| `film.concat` | Ordered chunk work keys, FFmpeg build |
| `film.mux` | Concat key, mix key, container and audio-encode settings, FFmpeg build |

A picture change never forces a re-mix, and an audio change never re-renders a frame.

### D7. Chunking and previews

**Chunking.** A unit of at most `chunk.max_frames` frames is one chunk. A longer unit is cut at multiples of `chunk.frames` from its local frame 0, with a remainder shorter than `chunk.min_frames` merged backwards. Counting from local 0 keeps earlier keys stable when a shot's tail changes. Fixed chunks on the film timeline would change every key on a retime, and one chunk per shot would re-render a one-shot film on any edit. Chunk-and-join is established practice ([Remotion Lambda](https://www.remotion.dev/docs/lambda/how-lambda-works)).

**Previews.** A preview is an ordinary compile with a narrower request:

- **Scope:** shots, a film frame range, or an explicit frame list. A range is widened to whole aligned chunks so the result is reusable. At rung `still` each affected unit gets one `still.render` node listing its unit-local frames, and no chunk, concat or mux node.
- **Rung:** scale, frame step and encode settings come from R2's ladder. With step `k` the engine reads rows 0, `k`, 2`k` of each unit (D6), and the coverage record states the step, because an event can appear up to `k − 1` frames late.
- **Placeholders (grade `animatic`):** a layer with no source, or a component source whose component has no document or is unvalidated, becomes a trusted `placeholder` that draws the item's declared footprint, its handle and the label of the control track active on it. A missing take becomes silence of the line's estimated duration, or word count times `timing.est_word_ms`. Missing footage becomes a labelled card. Each substitution is listed in `provisional_inputs` and raises `PLACEHOLDER_USED`. Placeholder hashes differ from real ones, so keys never collide.

### D8. No incremental or query-based compilation

**Estimate for a 90-second film at 30 fps (ASSUMED until measured):** about 20 shots, 160 layers, 1,800 channels and 2,700 frames, so 1–3 MB of JSON tables. The timing network has 300–800 points, so Floyd-Warshall costs at most about 5 × 10⁸ simple steps, around a second. Every other pass is linear.

**Choice.** Recompile the whole plan every time and let work keys provide reuse, as [Bazel](https://bazel.build/remote/caching)'s content-addressed action cache does. A query system such as [Salsa](https://github.com/salsa-rs/salsa) would add dependency tracking and a second cache to save about a second. It is rejected unless real films exceed `compile.budget_ms`.

`plan_diff(a, b)` compares execution work keys and part hashes through the source maps. It tells the Director which shots, frames and audio a patch would rebuild before anything is spent (HLD B3.4).

### D9. Scene context: the spatial and event commitment

A scene context is R3's `scene_context` entity, stored with the structure below (F14). It is created by ordinary patches from the Director or a layout worker (FR6). Consumers pin its `pin_hash` and state the readiness they need (HLD C3). Rectangles and polygons keyed to time are enough; a collision solver is rejected, as HLD B2.4 allows.

```ts
// Illustrative; this is the stored shape
type SceneContext = {
  shot: EntityId; valid: [TimeRef, TimeRef];
  draw_groups: string[];             // back to front; checked against shot.layers (D5)
  items: Record<string, { owner: EntityId; draw_group: string; order?: number;
           footprint: TimedRegion;   // where the owner's pixels may be
           avoid?: TimedRegion[];    // where others should not be
           reserve?: TimedRegion[];  // offered staging positions
           anchors?: { name: string; at: TimedPoint; binds_to?: { cut_id: string; point: string } }[];
           unknowns?: string[] }>;
  effects: Record<string, { kind: "tint" | "glow" | "blur_behind" | "shake" | "matte";
             from: EntityId; onto: EntityId[]; during: [TimeRef, TimeRef];
             realised_by?: { group_filter: string } | { layer: EntityId } | { control: string } }>;
  supersedes?: Hash;
  commitment: Commitment;            // R3's type, with every R1 §4.1 state
};
type TimedRegion = { space: "world" | "screen" | { asset: EntityId }; conservative: boolean;
                     interp: "hold" | "linear"; keys: { t: TimeRef; shape: Rect | Polygon }[] };
```

- **`items` and `effects` are keyed maps (§12 F5),** which the compiler reads in key order.
- **Time keys are event references** (`eruption + 200ms`), so a plume envelope moves when the eruption moves.
- **Cross-layer effects** must name a realisation: a filter on a group, a trusted `fill` or `effect` layer with a blend mode, a control on the target component driven by a track, or, for `shake`, the camera track. An effect with none raises `EFFECT_UNREALISED`.
- **Effects the host cannot express** raise `CROSS_COMPONENT_EFFECT_UNSUPPORTED` (F52): a live component as another's matte, drawing between the internal parts of another component, and cast shadows between components. The repair is one merged component, the HLD's "grouped execution". A matte is requested as an effect of kind `matte`, whose `from` is the matte layer and `onto` the layers it would mask; the code is raised when `from` has a live component source, and a baked matte through `MaskSpec {type: image}` is the other repair (decided: `lld/11` section 18, B:O14-matte).
- **Verification against renders.** R2's probe sidecar has one JSON line per item per sampled frame, with the box already in screen space as `rect_screen` (F82, F83). A pure function `verify_staging(context, unit, sidecar)` maps each declared footprint and anchor into screen space with the unit's camera rows, then applies the "After render" checks of D2, with `staging.tolerance_du` for footprints and `staging.anchor_tolerance_du` for anchors. The Quality System runs it and records the validation fact.
- **What a probe result proves.** All four checks are observational (F22, F24). Containment in a footprint marked conservative is definitive from probes; other footprints are measured, not judged. `AVOID_REGION_ENTERED` is a hypothesis until one of R2's diagnostic captures confirms it (F139).

**Anchor-follow layers (I7, DECIDED by §14.3; FR7).** `follow` is a keyed step channel on the layer, `channels.follow.leader`: each key is a `{layer, anchor}` or none, so the leader can change at an event. It lowers to the unit layer's `follow` channel, the leader in force on each frame as a stack index and an anchor. The host applies that leader within the frame (R2 §2.6), so held props and hand-offs need no merged component. The compiler checks that every leader is in the same unit and sought first, and that on no frame the chain has a cycle or more than `follow.max_depth` followers; a failure raises `CAPABILITY_BLOCKED`. `staging.follow_enabled` defaults to `true`; when it is `false`, a `follow` channel returns `CAPABILITY_GAP`. Each change of leader is declared in `handoffs` (D5) for R9's P-11. Beyond S7's still, unzoomed leader the mechanism is ASSUMED until `R2-S12` runs at M7 (H5; section 8).

### D10. Camera and layer spaces

A camera is authored on five channels: `x`, `y`, `zoom`, `rotation` and `shake` (F38). The compiler lowers them to four per-frame channels on the unit: view centre `(cx, cy)` in world units, `zoom` (1 means one world unit is one design unit) and `rot` in degrees clockwise.

**Shake lowering.** `shake` is an amplitude in design units. The compiler adds `shake × n(seed, axis, t)` to `cx` and to `cy`, where `n` is seeded value noise in −1 to 1: hashed lattice values at `camera.shake_hz` points per second of unit-local time, joined by a smoothstep curve. The seed is derived from the camera's entity ID. The result is ordinary table values, so a shake is reproducible and sliceable.

**The camera is applied per layer (I5, F12).** For a canvas `W × H`, the camera matrix for a frame is

`M = T(W/2, H/2) · R(−rot) · S(zoom) · T(−cx, −cy)`

The frame-packet builder gives a world layer `M · M_layer` and a screen layer `M_layer` alone, where `M_layer` comes from the layer's `place` row: `M_layer = T(x, y) · R(rotation) · S(scale) · T(−w/2, −h/2)`, and `w × h` is the layer's box (a component's `meta.size`, a trusted layer's declared `size`, otherwise the canvas). So `x` and `y` place the centre of the box, as the camera centres its view, and rotation and uniform scale turn about it; the host sets `transform-origin: 0 0` on every layer box. While a `follow` leader is in force, the anchor point takes the place of `(x, y)` (decided: `lld/11` section 18, B:O1b). This is fixed arithmetic on table values, not interpolation. With no world container, world and screen layers interleave in paint order. A world layer may declare `parallax p`, which replaces the centre with `c₀ + p · (c − c₀)`, where `c₀` is the camera's first-frame centre.

**Sharpness under zoom (S4).** SVG and text in a sandboxed iframe under a 2× host transform were pixel-identical to native 2× rendering. Canvas content was blurry unless drawn at the zoomed resolution, and `will-change: transform` made zoomed content blurry, so the host never sets it. Each component source therefore carries `zoom_max`: the unit's highest camera zoom for a world layer, 1 for a screen layer. The engine passes `scale` = rung output scale × `zoom_max` in `init`, and the shim's `cut.canvas(w, h)` sizes its backing store from it. Taking the maximum over the whole unit makes every chunk draw alike.

**Rejected.** One world container carrying the transform would stop world and screen layers interleaving. Passing the camera into every component would hide mismatches from the compiler.

### D11. Baking

A layer is bake-eligible only when every effective visual input is constant over the unit (F26): every control value, and the local time unless the component's `meta` says `time_invariant` and R2 validation confirmed it. Time-invariance never permits baking a layer whose controls change. Placement, opacity, filters and the camera may change, because the host applies them to the image. The image must also fit `bake.max_pixels` at output scale × `zoom_max`.

Baking happens only when `bake.mode` allows it (`off`, `opaque_only`, `any`; default `off`) (F27). Lowering then sets the layer source to `{kind: "baked", bake, live}` and adds a `component.bake` node. The chunk key contains the bake's work key, so keys are known at compile time.

**Accepted deviation (FR17).** While `bake.mode` is `off`, a re-authored element re-renders its shot's chunks, where the HLD expects the unchanged background to be reused. `R4-SP6` tests baking static backgrounds at M7, and baking is turned on if it passes.

**Failure (F28).** The bake job renders one frame both ways, compares them against R2's bake-equivalence threshold and returns the comparison result. The Quality System's check runner writes the validation record from that result (FR13, G7). On failure the record disables that bake, and the chunks that depend on it do not run. The next compile reads the fact and keeps the live source. Alpha capture under frame control and edge fidelity are unmeasured (Puppeteer documents [`omitBackground`](https://pptr.dev/api/puppeteer.screenshotoptions)). Baking never changes the project.

### D12. What the compiler must never do

- Choose a pose, duration, order, colour, cut point or take that the project does not determine. Where a rule is needed (earliest time, frame rounding, presented-frame sync), it is a documented language rule and its effect is reported.
- Apply a repair, even an obvious one.
- Write to the project, move a branch, record readiness or acceptance, or start a job. It emits the `execution` part; others run it.
- Call a model, read a clock, use randomness or use the network.
- Treat a provisional input as frozen, or emit a `final` plan with a placeholder.
- Drop a diagnostic to make a compile succeed.

## 3. Interfaces to other stages

| Stage | The compiler needs | The compiler gives |
|---|---|---|
| **R2** | Component `meta` in R2's shape (I1); validation records; environment record and the environment-hash list; rung settings bundles; `host.max_layers`; probe sidecar and frame-store formats; parameter schemas of the trusted layer kinds | Lowered render units and the frame-packet builder as the engine's only input; `zoom_max`; bake inputs |
| **R3** | A coherent snapshot read with `pin_hash`; `time_constraint` with `preferred` and `priority`; locks as paths; `control_track` with `layer`, nested channel keys and origin-relative keys; `shot.layers` in paint order; an optional `layer.source` of kind component, media or capture (FR6, G6), `seed`, `parallax`, `group`, `filter` and the `follow` channel; bindings and `claim.values`; `shot.groups`; `scene_context` as in D9; `event.probe`; `brief.duration_target`; take `samples` and `sample_rate`; `caption_track.suppress` | Nothing written. Diagnostics addressed by entity ID and field path |
| **R5** | The typed readiness-predicate schema, whose `Predicate` and `Need` types are declared in `packages/foundations` while R5 owns their meaning (decided: `lld/11` section 18, B:SD1); the capability catalogue | The `execution` part for `plan_to_jobs`, with the `pixi` mark; work keys; grade and provisional inputs |
| **R6** | Tool registration; inline execution | `compile`, `plan_diff`, `timing_explain` |
| **R7** | Word records and timing method; `voice.final_timing`; cue `sync_point` and `sync`; beat grids with `source`, `verified` and `beats`; caption style presets; the caption segmenter and the value formatter as pure functions | Audio mix plan; caption plan; `CAPABILITY_GAP` with a feasibility state |
| **R9** | `sync.*` tolerances; Quality Intent `must_see` and waivers | `verify_staging`; quality declarations; the timing report; the source map |

## 4. Failure handling

| Case (HLD B4, C11) | Behaviour |
|---|---|
| Late completion against an old revision | Its renders stay valid for that revision; a later revision reuses any chunk whose slice is identical |
| Two file-disjoint edits conflict semantically | The merged revision, compiled inline after `project_merge` (§12 F9), gives `TIME_CONFLICT`, `CONTROL_CONFLICT`, `STACK_ORDER_MISMATCH` or `FOOTPRINT_OVERLAP` |
| A provisional scene bound changes | Pinned consumers get `STALE_COMMITMENT`; only changed slices get new keys |
| A commitment freezes unchanged | No work key changes |
| Cross-layer effect | Realised inside one unit, or `EFFECT_UNREALISED`, or `CROSS_COMPONENT_EFFECT_UNSUPPORTED` |
| A bake fails its equivalence check | A validation fact disables it; the next compile keeps the live source |
| Failed experiment rolled back; worker crash | Nothing to undo: the compiler holds no state and has no external effects |
| Known defect kept in a preview | Its diagnostics travel with the plan |
| Final MP4 has no audio | `audio.mix` and `film.mux` have their own keys; finishing is repaired without rendering |
| A corrected fact | `plan_diff` lists the changed units, caption cues and audio clips |

## 5. Named settings and defaults

R4 owns these settings ([integration decisions](11-integration-decisions.md) §6, §14, §15).

Override authority and ranges follow the shared rule in R3 §2.7 (G15); none of these production settings or observational thresholds requires `human` authority.

| Setting | Default | Meaning |
|---|---|---|
| `timing.max_witnesses` | 3 | Conflict cycles reported per compile |
| `timing.max_points` | 1,000 | Above this, compile fails rather than run a long solve |
| `timing.est_word_ms` | 400 | Speech estimate per word for animatics |
| `plan.quantum` | 1e-5 | Rounding of numeric channel values |
| `chunk.max_frames` | 150 | Longest unit rendered as one chunk |
| `chunk.frames`, `chunk.min_frames` | 90, 30 | Chunk length inside longer units; shorter remainders merge backwards |
| `staging.tolerance_du` | 8 | Slack in footprint checks, in design units |
| `staging.anchor_tolerance_du` | 6 | Slack in anchor checks |
| `staging.handoff_tolerance_du` | 24 | Largest distance between the old and new anchors at a switch frame, or the follower's displacement from the preceding frame when either end is empty (R9's P-11) |
| `staging.follow_enabled` | `true` | Gate for anchor-follow layers (D9) |
| `follow.max_depth` | 2 | Longest chain of followers behind one leader |
| `pixi.max_per_unit` | 1 | PixiJS components per render unit; behind `UNIT_PIXI_LIMIT` |
| `camera.zoom_min`, `camera.zoom_max` | 0.25, 8 | Limits behind `CAMERA_INVALID` |
| `camera.shake_hz` | 12 | Lattice rate of the shake noise |
| `bake.mode` | `off` | `off`, `opaque_only` or `any` |
| `bake.max_pixels` | 16,000,000 | Largest baked image |
| `compile.budget_ms` | 3,000 | Compile time that reopens D8 |

Owned elsewhere and only referenced: `host.max_layers` (R2, default 24, behind `UNIT_TOO_LARGE`; §12 F10); `probe.stride` (R2, default 1); the rung ladder and the bake-equivalence threshold (R2); `pixi.unit_browsers` (R5, default 1); `voice.final_timing` (R7); `sync.event_early_ms` (R9).

## 6. Cross-domain check

| Domain | How the design carries it |
|---|---|
| **Historical comedy** | The comic pause is a window with a preferred value on a locked take. Moving the eruption moves the reaction track, the camera shake and the sound, which lands on the presented frame |
| **Science documentary** | Footage is a media layer with compiler-computed source frames. A wrong-train correction changes only the units, cues and clips that reference that asset |
| **Art history** | Feature anchors live in the painting's pixel space (R1 §3.4). A new crop is a new layer version that moves the resolved anchors, so only that layer's and the annotation layers' slices change |
| **Software tutorial** | Recordings keep native timestamps. Cursor events are "event plus offset", drawn by the trusted `cursor` layer. A recaptured step changes one frame store |
| **Data reel** | Chart values are params, so a corrected figure changes the chart, caption cue and voice line together. A single long shot is still re-rendered chunk by chunk |
| **Abstract motion graphics** | Beats are rigid marks on an authored grid; beat-snapped events use the commitment pass. No scene context is needed: `shot.layers` gives the paint order |

## 7. Decisions that differ from the first working draft

1. **Timing adds a minimal-network step and ordered commitment to Bellman-Ford,** whose schedule alone cannot place cuts on frame boundaries.
2. **Control tracks, time maps and the camera appear in the plan as frame tables, not keyframes,** giving one evaluator and exact chunk slicing.
3. **A transition is its own render unit,** because one shot's host page cannot express a dissolve without alpha intermediates.
4. **A staging pass is added,** and the capability pass is split by mode as HLD C6 requires.
5. **Baking is designed but off by default,** because its gain and edge fidelity are unmeasured.
6. **The plan gains `execution` and `quality_declarations` parts,** and a chunk result is an encoded segment, not frames.

## 8. Claims table

| Claim | Label | Evidence or consequence |
|---|---|---|
| An STN is consistent exactly when its distance graph has no negative cycle; the minimal network is decomposable; Bellman-Ford finds a negative cycle | SECONDARY | Rossi et al., Micheli and cp-algorithms (links in D3) restate Dechter et al., whose scan could not be machine-read. If wrong, ordered commitment could need backtracking. R4-SP1 adds a property test |
| One added constraint updates the minimal network in O(n²); flick path sums stay exact in doubles | VERIFIED by arithmetic | A new shortest path uses the new edge at most once; 1,000 edges of 8.5 × 10¹⁰ flicks sum far below 2⁵³ |
| RFC 8785 fixes number formatting; sixteen blend modes apply to all elements; `adelay` accepts exact sample counts; sound up to 45 ms early is below the detectability threshold; input-hash action caches are established practice | VERIFIED by source | Links in D3, D5 and D8; batch 2a measured `adelay` as exact |
| The host shows exactly the frame the tables describe; opacity, blend modes, gradient masks, clip paths and z-order work across sandboxed iframes | VERIFIED by spike | S4: 0 wrong frames in 900 captures with the acknowledgement protocol; 8 of 8 compositing cases within one colour level |
| Per-layer and group `filter`, group isolation around iframes, and `backdrop-filter` behave as in one document | ASSUMED | Not tested by S4. If wrong, the affected effects return `CROSS_COMPONENT_EFFECT_UNSUPPORTED` and move inside components |
| A host transform re-rasterises SVG and text in an iframe sharply; canvas needs the zoomed resolution; `will-change` must not be set | VERIFIED by spike | S4: pixel-identical to native 2×. Hence `zoom_max` and `scale` (D10) |
| Sharpness also holds under rotation and non-integer zoom | ASSUMED | S4 compared at 2× only and saw an HTML box snap by one pixel. If wrong, the zoom range is narrowed |
| Probes can be recorded on every frame | VERIFIED by spike | S4: under 1 ms per frame, so `probe.stride` = 1 and `verify_staging` sees every frame |
| The host's `rect_screen` is accurate under camera zoom and rotation | ASSUMED | Owned by R2. If wrong, conservative-footprint verdicts become hypotheses confirmed by an isolated-layer capture |
| Chunks from separate fresh browsers join without a visible seam, and separately encoded segments join by stream copy | VERIFIED by spike | S4: seam frame 81.95 dB. Segment-join check: 150 + 90 + 150 frames gave exactly 390, uniform timestamps, PSNR within 0.001 dB of a single encode. Batch 2a: three joined segments muxed with 0 samples of audio lag |
| Removing nodes with no visible frame from a slice leaves the pixels unchanged within tolerance | ASSUMED | S4 rendered ranges of a whole unit, not pruned slices. If wrong, slices keep every node and keys are less precise. R4-SP2 |
| One layout serves every rung; a unit of 15 component layers renders at about 80 ms per frame in about 920 MB per browser | VERIFIED by spike | S4. Units of 16–24 layers are unmeasured, so R2's `host.max_layers` is a starting limit |
| Control tracks evaluated outside the component produce acting, and editing a track leaves the component untouched | VERIFIED by spike | S6: 3 of 3 model-written tracks valid; double-take visible on 5 of 5 characters; a 300 ms shift gave 17 of 17 pixel-identical frames. The four-layer rule and overshoot clamping were not exercised |
| A whole compile takes 1–2 s; a model can repair timing from the witness format | ASSUMED | R4-SP1, R4-SP5. If wrong, D8 is reopened, or the witness wording changes |
| Baking saves time and matches the live component at its edges | ASSUMED | Disabled by default, so not on the critical path; until it is on, a re-authored element re-renders its shot's chunks (FR17). R4-SP6, at M7 |
| A follower can be placed from its leader's probe anchor within one frame | VERIFIED by spike | S7: at most 0.27 px off in 300 captures; under 0.1 ms per frame |
| The same holds under camera zoom, on a transformed leader and in a chain of two | ASSUMED | S7 tested a still, unzoomed leader only; R2 owns the mechanism and verifies it at M7 (`R2-S12`, H5). If wrong, the prop is drawn inside the character component, and `follow.max_depth` drops to 1 or such layers return `CAPABILITY_GAP` |
| Parallel browsers gain little on a PixiJS unit | VERIFIED by spike | S7: four browsers gave 1.5× the throughput. Hence `pixi.max_per_unit` and the `pixi` mark |

## 9. Spikes wanted

Local IDs are kept and prefixed with the stage (C4). S4 answered R4-SP3 (camera sharpness) and the seam half of R4-SP2; R4-SP4 (probe mapping) moved to R2 with `rect_screen`. S7 answered the anchor-follow question for a still, unzoomed leader (H5).

| ID | Claim | Method |
|---|---|---|
| R4-SP1 | Compile cost and solver correctness | Synthetic 90-second project; time each pass at 300, 800 and 1,000 points; property-test schedules and injected conflicts |
| R4-SP2 | Pruned slices are sound | Render one unit whole and from pruned chunk slices; compare PSNR per frame. It passes when every frame is at or above R2's `validation.repeat_min_psnr_db` (50 dB) and the frame counts match exactly (decided: `lld/11` section 18, B:O16 and A:testing-1d) |
| R4-SP5 | Witness readability | Give MiniMax-M3 twenty seeded conflicts in the D3 format; measure the share fixed by one patch |
| R4-SP6 | Bake gain and fidelity | At M7 (FR17): bake static layers with alpha under frame control; compare PSNR against live, and milliseconds per frame |

## 10. Open questions for the lead

None remain. I21 settled sound tied to a picture event, I22 windows with no preferred value, I10 the chunk result, and S7 anchor-follow (§14.3).
