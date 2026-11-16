# M4 — Harness and First Light

**Written:** 15 November 2026
**Status:** Milestone document ([orchestration](../00-orchestration.md); shape per [conventions](../01-repo-and-conventions.md) §7, §8). Planning only; the design is frozen in `lld/`.
**References:** `lld/07 D5` is R6's section D5; J1, FR2, U11 and similar are rows of [`lld/11`](../../lld/11-integration-decisions.md); B3, S3, S5, S6 and batch 2c are files under `research/evidence/`. Signatures and file names are illustrative unless the design fixes them.

## Goal

From R10 (`lld/10` §4.2):

- **Builds:** "`ModelClient` for MiniMax, with per-provider tool-argument encoding (JSON text for every parameter not typed to every leaf); Director loop; tool boundary; component-author worker with repair; treatment worker and text-level treatment proposals; project and compile tools, including `project_schema` (R6)".
- **Done when:** "the abstract motion-graphics brief produces a silent film with no human input; A1 passes with the real author; the transport conformance test passes for every tool; view sizes, the transport facts, billing and rate-limit probes are recorded".

## Provides to later milestones

- **`ModelClient`** (`complete`, `count_tokens`); the **MiniMax adapter** and wire encoder (`classifyParameter`, `toWireSchema`, `decodeToolInput`); the **model catalogue** and **routing table** (`lld/07` D7).
- The **record-and-replay transport** and reply builders.
- The **tool registry** and **plugin API** `ctx.tool`, `ctx.capability`, `ctx.role`, `ctx.setting` (D9).
- The **tool boundary** `runToolCall` (D5); the **transport conformance test**, covering tools registered later (J4).
- The **session runtime**: `model.call` and `subloop.run` executors, resume, and the tables `session`, `message`, `model_call`, `tool_call` (D11).
- The **Director loop**, `ControlApi`, and CLI `new`, `run`, `status`, `stop` (D12); `cutroom new` creates the brief and the primary `delivery_profile` (C:M4-O10a).
- The **views** `outline`, `card`, `summary`, `full`, `timeline` and `project_find` in `packages/project-core` (M4-08a; B:O17).
- The **staged `delivery_finalize`** (grade `preview`, no deliverable record), which M6-09 replaces with the designed chain (C:C1.1, L23); `director_report_blocked` writing a `decision` (C:M4-O10b).
- The **contact-sheet and event-strip builders** in `packages/render` (M4-11; A:M1-2).
- The **sub-loop runtime** (`Handoff`, `WorkerOutcome`, grants, `submit_*`) for M6's Reviewer, the brief-only researcher of M6-04b, M8's researcher, M10's Experiment Agent.
- The **component-author** and **treatment** workers, with `submit_treatments` (C:C1.2); the golden brief; the probe results.

## What must already exist

| From | Assumed by name |
|---|---|
| **M0** | Flicks, IDs, handles, canonical JSON, `ArtifactRef`, `workKey`, failure classes (`lld/02` §4.3), evidence (`lld/02` §5), `Diagnostic` and `Result`; `Predicate` and `Need`, declared in `packages/foundations` (M0-02; B:SD1); the `SettingsRegistry` refusing settings without `override_by` and `range` (G15); the `StorageAdapter` over `node:sqlite`; the `BlobStore`; the CLI skeleton (`cutroom new \| run \| status \| stop`, the Space socket, the `ControlApi` interface); pinned `@anthropic-ai/sdk` and `npm run test:live` gated on `CUTROOM_LIVE=1` (both M0-01b) |
| **M1** | `stillRender`, `chunkRender`, `filmConcat`, `filmMux`, which M3 wraps as `still.render`, `chunk.render`, `film.concat`, `film.mux`; the validation functions V0–V6 (C-00 to C-09) (`lld/03` §2.13) and `applyEdits` with `EDIT_NO_MATCH`; the probe sidecar format. The contact-sheet and event-strip builders are not M1's: M4-11 builds them (A:M1-2) |
| **M2** | The entity schemas and kind registry, including `treatment`, `decision`, `component`; `describe_kind(kind)`, the data behind `project_schema` (J5); `patch(envelope, caller)` with the seven validation stages and codes (`lld/04` §2.4); `x-cut-write`, `FIELD_AUTHORITY`, `grant_create`; `genesis`, `branch_create`, `merge` with `revalidate`, `propose`, `promote`, `restore`, `impact`, `refs`, `diff`, `history`, `snapshot`; `record_read`, `read_set`, and `STALE_READ_SET` for a refused late result (B:SD2); the `event` table and `append_event` (M2-05; B:SD3); `compile(request, facts)`, `plan_diff`, `timing_explain`, `store_plan` and `CompilationStore` (B:O4), the conflict witness (`lld/05` D1, D3). The views are not M2's: M4-08a builds them (B:O17) |
| **M3** | The `Scheduler` (`request`, `cancel` returning `CancelOutcome`, `subscribe`, `budget`); `register_capability`, `Executor` and `AttemptContext`, with slots for `model.call` and `subloop.run`; `PaidAdapter` and `ModelLimits`; the model limiter (`llm.max_concurrent` = 8), intents, spool, reconciler; budget scopes with `budget.delivery_reserve_usd`; `plan_to_jobs(plan, purpose)`; the `ReadinessOracle` over foundations' `Predicate` and `Need`; the check runner (`register_check`) as sole writer of validation records (FR13), and the `evidence` table (M3-07; L5); the fake author; tests A1, A7, A11 |

A missing item is added in its owning package before the dependent work package starts (C:M4-O9; `lld/10` §7).

## The R6 tool catalogue at M4

| Tool | Effect (G17) | Arrives |
|---|---|---|
| `project_read`, `project_find`, `project_refs`, `project_impact`, `project_diff`, `project_history`, `project_schema`, `evidence_read` | read | **M4** (M4-08b; the views of `project_read` and `project_find` are M4-08a's) |
| `project_branch`, `project_patch`, `project_merge`, `project_promote`, `director_report_blocked` | propose | **M4** (M4-08b) |
| `compile`, `plan_diff`, `timing_explain`, `job_status`, `budget_status` | read | **M4** (M4-09) |
| `render_request`, `check_run`, `job_cancel`, `job_retry`, `artifact_quarantine` | job | **M4** (M4-09) |
| `delivery_finalize` | job | **M4** (M4-09), staged form at grade `preview` with no deliverable record (C:C1.1, L23); the designed chain at M6-09 |
| `treatment_propose`; `submit_treatments` (C:C1.2) | job; propose | **M4** (M4-10) |
| `component_author` | job | **M4** (M4-11) |
| `evidence_view`, `review_request`, `submit_findings` | read, job, propose | M6 |
| `performance_author` | job | M7 |
| `research_request`, `submit_research` | job, propose | M6 (M6-04b), brief-only, with no network tool (C:M6-O2); M8 adds the web tools to the same path |
| `web_search`, `web_fetch`; `dataset_register` | network; R7's effect for `dataset_register` | M8 |
| `experience_search`, `experiment_request` | read, job | M10 |
| `voice_request`, `music_request`, `sfx_request`, `take_select`, `captions_build` | external_paid, propose | M5 |
| `media_search`, `media_acquire`, `media_annotate` | network, job | M9 |
| `capture_run` | job | M10 |

## Dependency sketch

```
M4-01 replay ─► M4-02 adapter ─► M4-03 registry ─┬─► M4-04 probes (live, tests only)
                                                 └─► M4-05 boundary
M4-04 + M4-05 ─► M4-06 session runtime ─┐
M4-08a views (project-core) ────────────┴► M4-07 Director loop and CLI
M4-05 + M4-08a ─► M4-08b project tools ─► M4-09 compile, render and job tools
M4-06 + M4-08b ─► M4-10 sub-loops, treatment worker ─► M4-11 component author, sheet builders
M4-07 + M4-09 + M4-11 ─► M4-12 claim tests, A1 (live) ─► M4-13 golden brief (live)
```

M4-11 also needs M4-09. Harness packages run in sequence (`impl/00` §3); M4-04 writes only under `tests/` and may run beside M4-05, its adapter changes being separate fixes to M4-02. M4-08a touches only `packages/project-core` and may run beside M4-01 to M4-06.

---

## Work packages

### M4-01 — Record-and-replay transport and reply builders

- **Care:** normal
- **Package:** `packages/harness` (`src/model/transport/`, `src/testing/`), `tests/fixtures/model/`
- **Depends on:** M0–M3     **Parallel with:** none
- **Live calls:** none

**Goal.** A transport beneath the SDK with modes `live` (optionally recording), `replay` and `scripted`, so harness tests outside the live packages run offline.

**Read first.** `lld/07` D1, D7, D13, §4; `impl/00` §8 rules 3, 4, 7; `impl/01` §4, §5; B3 Finding 1.

**Build.**

- A `fetch` injected into the SDK client, so the adapter's stream assembly also runs on replay.
- Fixtures, one JSON file per conversation (`{format, model, purpose, exchanges: [{request, response: {status, headers, events[]}}]}`), under `recorded/` or `scripted/`. Replay matches by request hash, or by turn order with a request diff.
- Reply builders for every `lld/07` §4 row and D13 case: thinking with signature, structured and JSON-text `tool_use`, two calls in one reply, an unconverted call, a cut-off `tool_use`, `pause_turn`, an empty reply, moderation (1026, 1027), HTTP errors with codes 2062, 1008 and 2069, and stream errors before and after content.

**Rules that are easy to get wrong.**

- Headers are stored by allow-list, so no authorisation header or key reaches a fixture; a scanner fails the suite on the key, `Bearer`, `authorization`, `x-api-key` or the home path (`impl/00` §8 rules 3, 4).
- Recording only under `CUTROOM_LIVE=1`; under `npm test` the live mode refuses to send (`impl/01` §4).
- Replay keeps recorded event order and chunk boundaries (D13).

**Tests.** Record then replay gives identical events; a planted key fails the scanner; the live mode refuses under `npm test`; scripted mode fails when its replies run out.

**Done when.**

- [ ] `npm run check` and `npm test` pass with the network disabled, and the scanner runs inside `npm test`.

**Out of scope.** The adapter (M4-02) and live recordings (M4-04, M4-12, M4-13).

### M4-02 — `ModelClient` and the MiniMax adapter with per-provider argument encoding

- **Care:** high
- **Package:** `packages/harness` (`src/model/`)
- **Depends on:** M4-01     **Parallel with:** none
- **Live calls:** none

**Goal.** `ModelClient` as in `lld/07` D7, with a MiniMax adapter over `@anthropic-ai/sdk` that encodes each tool's logical Zod input under J1, decodes tool calls, classifies failures as in §4 and reports `usage`.

**Read first.** `lld/07` D1, D7, D13, §4, §8; `lld/11` J1, J2, J3, J12, U11, U15; `lld/06` §2.6 (steps 2, 4 and 6, and the cost function) and §2.8; `lld/02` §4.3; B3 Finding 1; `research/11` §2.

**Build.** The D7 types; `thinking: {type: "adaptive"}` for MiniMax-M3 roles and `output_config: {effort}` for MiniMax-M3.1-Flash; stream assembly passing raw events to `on_delta` for R5's spool; the encoder with a `json_text_overrides` table (J12); the J3 and moderation detectors; the model catalogue and routing table as settings; `costOf(usage, model)`.

**Rules that are easy to get wrong.**

- **J1.** Structured only if typed to every leaf (no free keys, no untyped value, no union of value types); otherwise one string of JSON text under the same name. An enum is one type; a nullable value is a union of its type and `null`, and a union of object shapes is a union, so both travel as JSON text (J1, J12; C:M4-O12). Known JSON-text parameters: `project_patch.ops`, `project_merge.resolutions`, `project_find.where`, `timing_explain.select`.
- The adapter parses JSON text; the boundary validates it (D5 steps 2, 4).
- No JSON-schema mode exists and `tool_choice` is `auto` only: nothing is forced (`lld/07` §1, §8; `research/11` §2).
- `maxRetries: 0`, because the Scheduler owns retries (D1; `lld/06` §2.6).
- Content, thinking blocks and signatures come back unchanged (D7).
- A text block holding `<invoke name="…">` is flagged, never an answer (J3; B3 Finding 1).
- An incomplete `tool_use` under `max_tokens`, which also counts thinking, is marked truncated (D5).
- Cost prices input, cache reads and output separately; `input_tokens` excludes cache reads and output includes thinking (S5; U15). Codes 1002, 1039, 1041, 2045–2047 and 2062 are rate-limit signals (`lld/06` §2.8).
- The key comes from the project's `.env`, `C:\Users\XZNON\cutroom-v2\.env` (U23), read in WSL through the path `CUTROOM_ENV_FILE` names (L19; `impl/02` §8), and never reaches an error, a log or `raw`.

**Tests.** A classification table over synthetic schemas; a `fast-check` round trip logical → wire → decoded; the J3 detector catches B3's sample and passes ordinary prose; every §4 row maps to its kind and class; assembled streams equal complete replies; `costOf` matches the formula.

**Done when.**

- [ ] `npm run check` and `npm test` pass, and the review is closed.

**Out of scope.** Live probes (M4-04); running calls as jobs (M4-06).

### M4-03 — Tool registry, plugin API and the M4 catalogue

- **Care:** normal
- **Package:** `packages/harness` (`src/tools/registry.ts`, `src/tools/catalogue/`, `src/plugin/`, `src/settings.ts`)
- **Depends on:** M4-02     **Parallel with:** none
- **Live calls:** none

**Goal.** Every M4 tool is defined, without handlers, through the `ctx.tool` that plugins use; role tool lists are fixed and sorted; R6's settings are registered.

**Read first.** `lld/07` D3 choice 1, D4, D5 ("Structured final answers"), D8, D9, §5; `lld/11` G17, J2, J5, G1, K5, and §18: C:C1.1, C:C1.2; report C's row C:M4-O12; `lld/05` D1; `lld/04` §2.4.

**Build.** `ToolDef` (name, description, logical Zod input, output, errors, effect, `safe` or `serial`, roles, `max_result_tokens`, ends-run flag); the M4 schemas, including `submit_treatments` (C:C1.2); `ctx.*`; the settings `context.*`, `tool.*`, `director.*`, `subloop.*`, `author.*`, `treatment.*` with `lld/07` §5 defaults, and `audit.*` as `human` (K5).

**Rules that are easy to get wrong.**

- Names and effects exactly as D4 and G17; tools take handles, not IDs (D4).
- `director_report_blocked` ends the run on the call. `delivery_finalize` does not: the run ends on its chain's outcome, so its ending is not a flag fixed on the call (C:C1.1).
- To keep a parameter structured, a schema expresses "no value" as an omitted optional field, not `null` (C:M4-O12).
- Refuse a tool where a name nested in a structured parameter equals one of its parameter names (J2a; B3 saw `target` and `after` jump a level).
- A role's list is fixed at session start and sorted by name; an unusable tool returns a typed error and is never removed (D3 choice 1, D9).
- The Director holds no `web_search` or `web_fetch` (D6.6 item 1).
- `submit_*` schemas avoid tight length limits; every batch 2c submit failure was a 400-character limit (D5).

**Tests.** A J2a breach is refused; every M4 tool loads with G17's effect; the Director's list is sorted, hash-stable and free of network tools; a setting without a range is refused.

**Done when.**

- [ ] `npm run check` and `npm test` pass.

**Out of scope.** Handlers (M4-08b to M4-11), the pipeline (M4-05), and loading plugins from the Space configuration (M5 first needs it).

### M4-04 — Transport, conformance, billing and rate-limit probes

- **Care:** normal. Written by a test author, not by M4-02's implementer.
- **Package:** `tests/claims/`, `tests/fixtures/model/recorded/`
- **Depends on:** M4-03     **Parallel with:** M4-05
- **Live calls:** both models. **Ceiling $0.80:** conformance $0.20, transport facts $0.25, recordings $0.15, `R5-2` $0.05, `R5-3` $0.15.

**Goal.** The conformance test passes for every M4 tool on both models; the `R6-S11`, `R5-2` and `R5-3` results are recorded; transport recordings exist for M4-05 and M4-06 to replay.

**Read first.** `lld/07` D7 (J1–J4), D13, §8, §9; `lld/06` §2.6, §2.8, §8, §9; `lld/11` J4, J12, U11, U15, and §18: L17, C:M4-O7, B:M3-7, A:testing-5; report C's rows C:M4-O5 and C:M4-O6; `lld/10` §2.2; B3 Finding 1; S5 "Caching".

**Build.** Live tests under `tests/claims/`. Each writes `docs/impl/reports/claims/<ID>.json` ([testing](../03-testing.md) §6), naming the model pins.

- **Conformance (J4).** For every registered tool on both models, two "call this tool with exactly this input" probes, typical and edge (0, negatives, decimals, both booleans, empty arrays, numeric-looking strings, nested names), with the role's full tool list attached. The decoded value must deep-equal what was sent, JSON types included. A missing call or unparseable text is retried once and counted apart from damage.
- **Transport (`R6-S11`).** Record the `anthropic-version` sent and the delta types of streamed `tool_use`. Run S5's 10-turn append-only loop in three arms: with an image, with MiniMax-M3 thinking blocks, and a control with neither. Replay one history with old thinking blocks removed. **Moderation is not provoked:** no request is written to be refused. The adapter's detectors for the documented signals (`input_sensitive`, `output_sensitive`, codes 1026 and 1027, `lld/07` D13) are tested on M4-01's reply builders, the moderation part of `R6-S11` is recorded "not observed", and it stays ASSUMED with its fallback, "change the adapter's detector" (`lld/07` §8; C:M4-O7).
- **`R5-2`.** Tiny Flash requests: five aborted mid-stream, five forced 4xx, three pairs with an `Idempotency-Key`. **Billing comparison:** the session asks the user once for the MiniMax plan's usage figure, just before and just after the probe. If the user does not supply it, the billing half of `R5-2` is recorded `UNKNOWN` and the build continues (L17). The aborted-stream, 4xx and `Idempotency-Key` observations run either way (C:M4-O5).
- **`R5-3`.** About 300 tiny Flash requests in 60 to 90 seconds, with a trickle of MiniMax-M3 alongside; record 429s, codes, headers, recovery time, the limiter's behaviour and whether MiniMax-M3 is affected. The probe runs on the current subscription key, never more than 8 in flight (U11; C:M4-O6; A:testing-5), and the user is told before the burst (A:testing-5). Compare the measured recovery with the starting values `llm.recover_interval_s` (30) and `llm.recover_rate_fraction` (0.1), and with `breaker.failure_count` (5) (B:M3-7); a changed value is a build revision.
- **Recordings,** at least: a MiniMax-M3 adaptive turn with a signature and JSON-text `ops`; two calls in one reply; streamed tool input; a Flash reply; a 4xx.

**Rules that are easy to get wrong.**

- At most 8 requests in flight, bursts included (U11); spend from `usage` into `impl/04-spend.md` (U15; `impl/00` §8 rule 7).
- A structured parameter that arrives changed moves to JSON text via `json_text_overrides` and is re-probed; report it as a build revision, editing no adapter code (J12).

**Tests.**

- **Conformance:** every probe arrives equal; no JSON-text parameter is damaged (B3: 0 of 312).
- **Header:** HTTP 200 with `2026-10-21`; else override it or use plain `fetch`.
- **Streamed tool input** equals the complete block; else use non-streamed tool turns.
- **Cache:** from turn 2, each arm's cached share is within 5 points of the control's (a margin chosen here; S5 measured about 99%); else lower `context.compact_at_tokens`.
- **Dropped thinking blocks:** recorded only; the design keeps them to the segment boundary.
- **`R5-2`, `R5-3`:** a verdict per row, `UNKNOWN` for the billing half when the user gave no figure (L17); the pay-as-you-go part stays ASSUMED, with its fallback, "The adaptive limiter slows down on 429 regardless" (`lld/06` §8; `lld/10` §2.2; C:M4-O6).

**Done when.**

- [ ] The result files and ledger lines exist; `npm test` passes offline, the scanner included.

**Out of scope.** Adapter fixes. `R3-K4` and `R4-SP5` (M4-12).

### M4-05 — Tool boundary: validation and repair

- **Care:** high
- **Package:** `packages/harness` (`src/tools/boundary.ts`, `src/tools/repair.ts`)
- **Depends on:** M4-03     **Parallel with:** M4-04
- **Live calls:** none

**Goal.** Every tool call passes D5's seven steps, with in-band errors, escalating repair and module codes relayed unchanged.

**Read first.** `lld/07` D3 choice 4, D4, D5, D8, D10; `lld/11` J2, J3, H3, FR1, G10–G12, and §18: B:SD2; `lld/04` §2.4; S5 "Repair at the tool boundary"; B3 Finding 1.

**Build.** `runToolCall(call, session)`: (1) lookup (`UNKNOWN_TOOL`, nearest names); (2) decode via M4-02; (3) lenient normalisation, logged; (4) validation (`SCHEMA_INVALID`, at most ten issues); (5) resolution (`UNKNOWN_ENTITY`, nearest matches); (6) authority in the module, grant attached; (7) budget, then execution with the page cap. After `tool.repair_attempts_max` (3) consecutive failures of one tool and code, add a schema excerpt and minimal example; after `tool.repair_hard_stop` (2) more, a sub-loop ends `blocked` and the Director raises a stall alert. Cut-off calls get `TRUNCATED_CALL`. `safe` calls run concurrently, `serial` ones in written order, results in call order.

**Rules that are easy to get wrong.**

- The harness holds no authority: it relays `FIELD_AUTHORITY`, `OUT_OF_SCOPE`, `LOCKED`, `STALE_BASE`, `STALE_READ_SET` (B:SD2) and every module code unchanged, with `source` (D4, D10; `impl/01` §2). Its own codes are only `UNKNOWN_TOOL`, `SCHEMA_INVALID`, `BUDGET_EXCEEDED`, `TRUNCATED_CALL`, `EMPTY_RESPONSE`, `INTERRUPTED`.
- Unparseable JSON text returns the parser's position; the same string twice brings a request to write the value again from the beginning (J2b; B3 saw one string sent four times).
- A repair is the model's next turn, never a retry; there is no repair model (D5).
- Lenient normalisation does not replace JSON text: in B3 it still failed three of four control-track creations.
- Unknown keys are rejected with the nearest valid key; a success echoes the values applied (D5; S5).
- A cut-off call never runs; a page is never cut twice (D5; D3 choice 4). `DIAG_UNSUPPORTED` is immediate, `HARD_CHECK_FAILED` a job result (H3).

**Tests** (scripted, stub modules). Each step's code; B3's damage patterns; the J2b message; escalation exactly at 3 and then 2; a truncated call runs zero times; module codes come back byte-identical; results return in call order.

**Done when.**

- [ ] `npm run check` and `npm test` pass, and the review is closed.

**Out of scope.** Handlers; persisting `tool_call` rows (M4-06).

### M4-06 — Session runtime: `model.call` executor, audit log, turns and resume

- **Care:** high. This is part of the Director loop (`lld/10` §4.1).
- **Package:** `packages/harness` (`src/session/`)
- **Depends on:** M4-04, M4-05     **Parallel with:** none
- **Live calls:** none

**Goal.** One turn runner for the Director and sub-loops that runs each request as a `model.call` job, persists everything, and resumes after a crash.

**Read first.** `lld/07` D2 (steps 1–5), D3 (choices 1, 6 and 7; "Persistence and resume"), D7 ("Every model call is a Scheduler job"), D8, D11, D13, §4, §5; `lld/06` §2.5–§2.7; `lld/11` U11, U15.

**Build.** `runTurn`; the `model.call` executor (spool, confirm with `usage`, classify); the tables `session`, `message`, `model_call`, `tool_call` with bodies in the blob store; `resumeSession`.

**Rules that are easy to get wrong.**

- The loop never calls `ModelClient` directly and never retries. Each job carries the request hash, role, variant index and worst-case cost (context plus output cap at catalogue prices) (D7).
- The assistant message is stored exactly as received before any tool runs (D2 step 3); partial output never enters the history (§4).
- History is append-only; the system prompt holds no project data or timestamps (D3 choice 1).
- A repair, nudge or appended result is a new job with a new work key (D7). `pause_turn` is resent with content unchanged (D13).
- An empty reply is retried once by the Scheduler, nudged once, then `EMPTY_RESPONSE`; so is a second unconverted call (J3). A moderation refusal is `policy`: no retry, no rephrasing (§4).
- On resume, read tools re-run, job tools join their job by work key, others get `INTERRUPTED` (D3).
- `model_call` stores a sequence range, not the request (D11). Output caps: Director 16,000, sub-loops 8,000, author 32,000 (§5).

**Tests.** A recorded thinking block and signature are stored and resent byte-identical; two calls give one results message in call order; a kill between assistant message and results resumes correctly in all three cases; an ambiguous failure gives `unknown_outcome`, history untouched; `pause_turn` and empty-reply paths; booked cost equals the formula; 20 concurrent sessions never exceed 8 sends; A7 still passes.

**Done when.**

- [ ] `npm run check`, `npm test` and `npm run test:accept` pass, and the review is closed.

**Out of scope.** Wake, parking and segments (M4-07); handoffs (M4-10).

### M4-07 — Director loop and CLI

- **Care:** high
- **Package:** `packages/harness` (`src/director/`), `packages/cli`
- **Depends on:** M4-06, M4-08a     **Parallel with:** none
- **Live calls:** none

**Goal.** A Director session works from a brief alone: it wakes on events, parks, ends only through a tool, and restarts segments with working notes, driven by `cutroom new`, `run`, `status`, `stop`.

**Read first.** `lld/07` D2, D3, D6.6 item 1, D7 (the paragraph after the interface), D10 (last paragraph), D12; `lld/04` §2.7 ("A `brief` lock covers the brief"); `lld/10` §3.3; `lld/11` J6, J8, J9, J10, FR2, G2, G12, G19, K1, and §18: C:C1.1, L23, C:M4-O10a; B3 spike 2 ("Results of the ten turns", "The no-notes runs", "Other observations").

**Build.** The first message (the brief and an index from M4-08a's `outline` and `card` views); the wake cursor with D2's policy and coalescing within `director.event_coalesce_ms` (5,000); the digest; parking; up to `director.stall_nudges_max` (2) nudges, then `stalled`; budget wakes at 0.5, 0.8 and 0.95; segment restart; hashed prompt templates (D11); the CLI over `ControlApi`. **`cutroom new`** runs M2's `genesis(project, brief)` through the human path with the `brief` lock (`lld/04` §2.7); creates the primary `delivery_profile` from the profile defaults, also through the human path, copying `delivery.audio.*` (K1), because its `ai_disclosure` and audio thresholds are `human` fields; and appends the event that `lld/10` §3.3's measures call "brief accepted". It creates no Quality Intent (the Director's, G19) and no `decision` (C:M4-O10a).

**Rules that are easy to get wrong.**

- The `event` table is the only wake source; the cursor drops duplicates and reordering (D2). A digest rides on the tool-result message, or is the next user message while parked (D2).
- Production ends only with `director_report_blocked`, or when the chain of the staged `delivery_finalize` returns a file; a failed chain wakes the Director, as at M6 (C:C1.1, L23). Nothing reads prose as progress or completion; with adaptive thinking MiniMax-M3 wrote almost none (J10; B3).
- A segment starts at a parked boundary once `input_tokens + cache_read_input_tokens` passes `context.compact_at_tokens` (180,000); `context.hard_max_tokens` (400,000) forces one (D3).
- **A segment cannot close without working notes;** if none come, ask again. They name the step in progress and what is patched but not closed. The code-written digest lists open jobs, open findings, budget, recent `decision` entities and the last ten accepted patches with intent and changed handles (J8). In B3 both runs without notes reworked a half-done step.
- Thinking blocks stay until the next segment; a role changes model only there (D3 choice 6; D7).
- The prompt states the authority rules, the treatment-search default and "set only what was asked; report what cannot be done"; nothing depends on obedience (FR2, J6, D10). Crossing the treatment share notifies, never stops (G2).

**Tests** (scripted). Duplicate and reordered events; coalescing; no model call while parked; nudges, then `stalled`; `director_report_blocked` ends the run, prose saying "done" does not; the run ends when the staged `delivery_finalize` chain returns a file, and a failed chain wakes the Director instead; a restart from recorded `usage`; missing notes requested again; ten patches in the digest; the hard maximum forces a restart; a discarded session continues from the project alone (D3). `cutroom new` leaves the brief with its `brief` lock, a primary `delivery_profile` holding the `delivery.audio.*` values, one "brief accepted" event, and no Quality Intent or `decision`.

**Done when.**

- [ ] `npm run check` and `npm test` pass; `cutroom new` and `cutroom run` work on scripted replies in a temporary Space; the review is closed.

**Out of scope.** Handlers; the other D12 commands, which are scheduled where a package needs them (C:M4-O11; see Resolved points); animatics and T9 (M6).

### M4-08a — Views and `project_find` in Project Core

- **Care:** normal
- **Package:** `packages/project-core` (`src/views/`)
- **Depends on:** M0–M3     **Parallel with:** M4-01 to M4-06
- **Live calls:** none

**Goal.** Project Core's views `outline`, `card`, `summary`, `full` and `timeline`, and `project_find`, exist with paging, so that M4-08b's handlers only relay them. M2 deferred them to M4 (M2 §4; B:O17).

**Read first.** `lld/04` §2.7 ("Read sets"), §2.13, §5; `lld/10` §4.2 (M2 and M4 rows); `lld/11` J5, J6, G12, FR10, and report B's row B:O17; B3 "Reads and paging".

**Build.** The five views of `project_read` and the matcher behind `project_find`, as `lld/04` §2.13's table gives them; paging to a cap the caller passes, with Project Core's continuation cursor; the page-size estimate that `R3-K4` checks (B3 estimated characters ÷ 3.5).

**Rules that are easy to get wrong.**

- A view shows handles for references, times as `650ms` or `5.15s`, and no defaults or empty fields; it uses exactly the field names and nesting `update` accepts; it marks read-only every field whose write level the caller lacks; it begins with the revision it was read from, which is the patch `base` (`lld/04` §2.13; G12; J5). `outline` starts with the project's own handle.
- String fields of an `untrusted_web` entity appear inside the harness's untrusted-data fence (`lld/04` §2.13).
- A longer result is cut at an entity boundary with a continuation cursor, never silently (`lld/04` §2.13).
- A read from a job records `(job, entity, pin_hash, hash)` through M2's `record_read` (`lld/04` §2.7 "Read sets"; FR10).

**Tests.** Each view of a fixture project; `outline` starts with the revision and the project's handle; a `system` field is marked read-only for a Director caller; an empty or default field is absent; a page cut lands on an entity boundary, and the cursor's next page neither overlaps nor skips; a read made from a job leaves one read-set row per entity.

**Done when.**

- [ ] `npm run check` and `npm test` pass.

**Out of scope.** The tool handlers (M4-08b); `experience_search` (M10).

### M4-08b — Project tools, including `project_schema`

- **Care:** normal
- **Package:** `packages/harness` (`src/tools/project/`)
- **Depends on:** M4-05, M4-08a     **Parallel with:** none
- **Live calls:** none

**Goal.** Handlers for the M4 project tools.

**Read first.** `lld/07` D3 choices 2 and 4, D4, D10, D11; `lld/04` §2.2 (`decision`), §2.4, §2.7–§2.9, §2.13; `lld/11` J1, J5, J6, FR1, G10–G12, G17, G19, and §18: B:SD2, C:M4-O10b; `lld/05` D1 (last paragraph).

**Build.** One handler per tool. `project_read` and `project_find` relay M4-08a's views. `project_schema(kind)` returns fields with type, required, `x-cut-write` level and one small example, from M2's `describe_kind`. `project_merge` returns the candidate, compiles it inline in `plan` mode and requests checks on its `revalidate` set as jobs. `evidence_read` pages one section of an evidence record, compilation record or timing report. **`director_report_blocked`** writes, through Project Core under the Director's grant, a `decision` with `type: technical`, a `question` the handler fixes ("production blocked"), `chosen: stop`, the reason as `rationale`, the unmet requirements and the cheapest known remedy as `alternatives` entries `{label, why_not}`, and the bundle IDs as `evidence`; then the run ends, and `cutroom status` shows the decision (C:M4-O10b).

**Rules that are easy to get wrong.**

- Handlers call module operations with the grant attached and write nothing directly (D10; `impl/01` §2).
- The views are M4-08a's; a handler passes the page cap and relays the module's cursor.
- Page caps: `project_read` 4,000 tokens, others 2,000, read from the keyed setting `tool.result_max_tokens` (`project_read` and `default` keys, A:M0-3); the module cuts pages and owns cursors.
- Only `project_promote` moves the head, by compare-and-swap with `may_promote`; it needs no clean compile and does not wait for merge checks (D10).
- `project_merge` of a worker branch whose read set changed returns Project Core's `STALE_READ_SET` with the changed entities, unchanged (B:SD2).
- `director_report_blocked` needs no new kind or `type` value; a deliverable record cannot hold the report, because that record requires an exported `file` (`lld/09` §3.7; C:M4-O10b).

**Tests.** Each tool's happy path and D4 error codes. Director patches to `rights.status`, `claim.support`, a brief-derived hard constraint and `budget.hard_cap_usd` get `FIELD_AUTHORITY` unchanged (A13 at tool level; full case at M6). Each kind's `project_schema` example passes a `dry_run` patch. Over-cap reads page without overlap. A stale proposal's merge returns `STALE_READ_SET` listing the changed entities. `director_report_blocked` writes the `decision` described above and ends the run.

**Done when.**

- [ ] `npm run check` and `npm test` pass.

**Out of scope.** `experience_search` (M10); the views themselves (M4-08a).

### M4-09 — Compile, render, check and job tools

- **Care:** normal
- **Package:** `packages/harness` (`src/tools/compile/`, `src/tools/jobs/`)
- **Depends on:** M4-08b     **Parallel with:** none
- **Live calls:** none

**Goal.** Handlers for `compile`, `plan_diff`, `timing_explain`, `render_request`, `check_run`, `job_status`, `job_cancel`, `job_retry`, `artifact_quarantine` and `budget_status`, and the staged `delivery_finalize` (C:C1.1, L23).

**Read first.** `lld/07` D2 ("Staying out of the data path"), D4, D8, D10; `lld/05` D1, D3, D4; `lld/06` §2.4, §2.7, §2.9, §2.10; `lld/03` §2.12, §2.16; `lld/11` H3, J12, FR1, FR9, and §18: C:C1.1, L23, B:O4.

**Build.** One handler per tool. `compile` stores its compilation record through the compiler's `CompilationStore` (B:O4). **The staged `delivery_finalize`** keeps the designed name, input (`delivery_profile`, `expected_head`), head check and immediate errors (`STALE_BASE`, `NOT_READY`). It compiles inline in `frozen` mode at **grade `preview`, rung `final`**, and requires every pinned commitment to be `frozen`, returning `NOT_READY` otherwise. It then calls `plan_to_jobs(plan, "review")`, which renders the final-rung chunks and runs `film.concat`, plus `audio.mix` and `film.mux` only when the plan has audio. It writes no deliverable record and returns no `completion_state`. Its result names the file and the plan's grade and says that this build has no final-file check, review or record yet; the CLI shows "exported, not checked: not a delivery". The run ends when this chain returns a file; a failed chain wakes the Director (C:C1.1, L23). M6-09 replaces it with the designed chain.

**Rules that are easy to get wrong.**

- `compile` runs inline, not as a Scheduler capability; diagnostics are results; a `frozen` compile of unready input returns `NOT_READY` (`lld/05` D1, D4).
- The staged form is at grade `preview` because grade `final` needs every asset `eligible` (`lld/05` D4), and only M6-04a's rule table may write `rights.status` (FR1). Never hand-write `rights.status` to reach grade `final`. Requiring frozen commitments keeps the final-rung chunks out of R5's speculative hold (`lld/06` §2.9; C:C1.1).
- `render_request` compiles if needed, then calls `plan_to_jobs(plan, purpose)`; rung `still` uses `still.render`; the `final` rung refuses diagnostic captures (`lld/03` §2.16). `DIAG_UNSUPPORTED` comes at once from `meta` (H3).
- Tools return handles, counts and summaries, never frames (D2).
- `job_retry` and `artifact_quarantine` are Director-only. A session cancels only within its own tree, and `CancelOutcome` is relayed unchanged (D10).

**Tests.** A repeated compile returns the same record; `timing_explain` returns the witness of a seeded conflict; a repeated `render_request` is a cache hit; `tint` on a Canvas mark is refused at once; a cancel racing completion leaves a consistent state; a budget refusal gives `BUDGET_EXCEEDED`; the staged `delivery_finalize` produces a silent final-rung file at grade `preview` for a hand-authored project, writes no deliverable record, returns no `completion_state`, and returns `NOT_READY` when a pinned commitment is `provisional`.

**Done when.**

- [ ] `npm run check`, `npm test` and `npm run test:render` pass.

**Out of scope.** `review_request`, `evidence_view`, and the checks, review and record parts of delivery (all M6).

### M4-10 — Sub-loop runtime and the treatment worker

- **Care:** normal
- **Package:** `packages/harness` (`src/subloop/`, `src/workers/treatment/`)
- **Depends on:** M4-06, M4-08b     **Parallel with:** none
- **Live calls:** none

**Goal.** The `subloop.run` executor (handoff, narrowed grant, limits, the `submit_*` path), the treatment worker, and `treatment_propose`, which yields text-level `treatment` proposals.

**Read first.** `lld/07` D2 (the treatment paragraph), D5, D6, D6.1, D7 (the treatment row), D8, §4, §5; `lld/11` FR2, G1, G2, G17, G22, J1, and §18: C:C1.2, B:SD1; `lld/04` §2.2 (the `treatment` kind); `lld/06` §2.4 (`Predicate`), §2.5; batch 2c spike 3.

**Build.** `Handoff` and `WorkerOutcome`, with R5's `Predicate` used exactly, imported from `packages/foundations` (D6.1; B:SD1); grant construction; budget, turn and depth limits; nudges with a fenced-JSON fallback; the Director notice; the treatment prompt, `submit_treatments` and `treatment_propose`. **`submit_treatments`** is the treatment worker's only tool, with effect `propose` (G17). Its input is typed to every leaf and has no tight length limits. It holds `treatments`, a list of exactly the requested number of R3 `treatment` field sets (`premise`, `hook`, `structure`, `visual_approach`, `tone[]`, `techniques[]`, `risks[]`), and `differences`, a list of `{a, b, difference}` in which `a` and `b` index `treatments`, with one entry for each unordered pair (C:C1.2).

**Rules that are easy to get wrong.**

- `subloop.run` is `pure`; each request inside is a child `model.call` in the sub-loop's budget scope (D6; `lld/06` §2.5).
- The worker grant is narrower than the Director's, never above level `director`; more scope means `scope_expansion_request` (D6.1).
- `subloop.max_depth` 2; `subloop.submit_nudges_max` 2, then fenced-JSON extraction, then `failed` (`deterministic`). Over-long text is truncated and the truncation recorded (D5).
- The owning module writes results as patch proposals and evidence; the Director gets a notice, never a transcript (D2).
- The treatment worker runs on MiniMax-M3, adaptive, `subloop.max_concurrent.treatments` 1 (G1; A:M0-3), and proposes `treatment.candidates` (3) with `status: proposed` and a stated difference per pair (D2).
- The `submit_treatments` handler checks the count and that every pair has exactly one difference, and returns `SCHEMA_INVALID` naming the missing or repeated pair otherwise. It then writes the treatments with `status: proposed` as the worker's patch proposal, and stores the differences in the worker's Diagnostic Evidence Bundle (`WorkerOutcome.evidence_bundle`), keyed by the new treatment handles. The Director's notice references both. No field is added to `treatment` (C:C1.2).

**Tests** (scripted). An out-of-scope write returns `OUT_OF_SCOPE`, relayed; valid and repaired submits; a plain-text ending goes through nudges and extraction to `failed`; budget exhaustion ends `policy`, partial work kept; the depth cap holds; three proposals are stored with `status: proposed`, their three differences sit in the evidence bundle keyed by handle, and the Director is notified; a missing or repeated pair gives `SCHEMA_INVALID` naming it.

**Done when.**

- [ ] `npm run check` and `npm test` pass.

**Out of scope.** Animatics and T9 (M6), and the other sub-loop roles.

### M4-11 — Component-author worker with repair, and the contact-sheet and event-strip builders

- **Care:** normal
- **Package:** `packages/harness` (`src/workers/component-author/`); `packages/render` (the contact-sheet and event-strip builders)
- **Depends on:** M4-09, M4-10     **Parallel with:** none
- **Live calls:** none

**Goal.** D6.2's loop runs behind `component_author`: generate, validate, repair, look, and escalate if needed. It returns component hashes, a reference to the returned candidate's one validation record, and a patch proposal. R2's contact-sheet and event-strip builders exist for the look and for M6's bundles.

**Read first.** `lld/07` D5, D6.2, D7 (Flash at `effort: low`, `medium` on repair), §3 (what R6 needs from R2), §5 (`author.*`); `lld/03` §2.2, §2.13, §3; `lld/06` §2.5 (`component.validate`); `lld/09` §3.1 ("Component validation"), §3.2 (the contact sheet with control-extremes cells), §3.3 (T1), §5 (`sheet.*`, `clip.*`); `lld/11` K4, FR13, F23, and report A's row A:M1-2 and report C's row C:M4-O8; S3; S6 "Characters".

**Build.** The `component_author` handler, submitting a `subloop.run` job with a `Handoff`; the fixed loop and its prompts; the patch proposal that creates or updates the `component` (source and `meta`) within the handoff's write scope. In `packages/render`: the contact-sheet and event-strip builders over `still.render`, which R6 §3 names as R2's, reading R9's `sheet.*` and `clip.*` settings by name (A:M1-2). R9's bundle builder (M6-05) is a separate thing that assembles bundles from their images.

**Rules that are easy to get wrong.**

- No model-called tools; one fenced HTML document is extracted (V0, C-00) (D6.2).
- Repair rounds call the ladder as plain functions and write no validation records; only the returned candidate goes through `check.run`, whose one record the result references (K4, FR13). **Browser access:** each repair round submits a `component.validate` child job (`browser` pool) in the worker's tree and budget scope, since `subloop.run` has no pool of its own; its output is ladder evidence, not a validation record (`lld/06` §2.5; FR13; K4; C:M4-O8).
- Up to `author.repair_attempts_max` (3) Flash repairs, each a fresh request with the task, current document and exact rule IDs and messages. Search/replace edits must each match exactly once (`EDIT_NO_MATCH`); after a second failure, ask for a whole document (S3: as effective, one sixth of the output).
- Escalate to MiniMax-M3 (`author.escalation_attempts`, 1) only once Flash attempts are used up, even if a failure repeats; then return `needs_revision` with the evidence bundle (S3).
- **The look:** one fresh-context Flash call on one contact sheet, never turned off, outside the review caps, feeding at most `author.visual_repair_rounds` (1) rounds (D6.2 step 5; T1).
- Every attempt is a new content-hashed version; failures stay as evidence (`lld/03` §2.13).

**Tests** (scripted; the ladder under `npm run test:render`). A pass at round 0; an edit fixes a lint failure; `EDIT_NO_MATCH`, then a whole document after the second failure; a repeated failure does not escalate early; escalation only after three Flash repairs; `needs_revision` when escalation fails; exactly one validation record and one look per job; each repair round is a `component.validate` child job that writes no validation record. Under `npm run test:render`: a contact sheet and an event strip built from `still.render` frames have the cell size, columns, labels and spacing that the `sheet.*` and `clip.*` settings give, including the control-extremes cells (`lld/09` §3.2).

**Done when.**

- [ ] `npm run check`, `npm test` and `npm run test:render` pass, and A1 passes with the real executor on replayed replies.

**Out of scope.** A1 against the live endpoint (M4-12) and the performance author (M7).

### M4-12 — Claim tests `R3-K4`, paging and `R4-SP5`; A1 with the real author

- **Care:** normal (test author)
- **Package:** `tests/claims/`, `tests/acceptance/`, `tests/fixtures/projects/`
- **Depends on:** M4-07, M4-09, M4-11     **Parallel with:** none
- **Live calls:** **ceiling $0.70:** `R3-K4` $0.02, paging $0.10, `R4-SP5` $0.50, A1 $0.08.

**Goal.** View sizes, paging and witness repair measured; A1 passing with the real author.

**Read first.** `lld/04` §2.13, §8, §9; `lld/05` D3, §8, §9; `lld/10` §2.2, §3.2; `lld/11` FR10, J6, and §18: C:M4-O4, B:SD2, A:testing-1f; B3 "The synthetic project" and "Reads and paging"; `lld/07` §5.

**Build.** Live tests, a project generator under `tests/fixtures/projects/`, and result files:

- **`R3-K4`.** A synthetic 30-shot project with B3's entity mix; every view (`outline`, `card`, `summary`, `full`, `timeline`) counted by MiniMax-M3's `count_tokens` less a baseline, and compared with Project Core's estimate.
- **Paging.** B3's two forced-large-read tasks, five runs per model.
- **`R4-SP5`.** Twenty seeded `TIME_CONFLICT` projects in D3's format, on MiniMax-M3 with Director routing and `project_read`, `project_schema`, `project_patch`, `compile`, `timing_explain`. "Fixed by one patch": the first patch after reading the witness gives a `plan` compile without `TIME_CONFLICT`, unlocks nothing and adds no blocking diagnostic. The design fixes only this method and the fallback, "the witness wording changes" (`lld/05` §8, §9). Before the run, the lead states in this package's issue the rule by which the witness would be reworded, so that the rule is not fitted to the result (C:M4-O4).
- **A1.** M3's A1 with the real `component_author`, recorded, plus a replay variant.

**Rules that are easy to get wrong.**

- At most 8 requests in flight; spend from `usage` into the ledger (U11, U15).
- A1 holds the job in the Scheduler, never by stubbing the author: the real worker's model calls and validation run (`lld/10` §3.2; FR11).
- The provider's count decides `R3-K4`, because Project Core's estimator is what is being checked (B3 estimated characters ÷ 3.5).

**Tests.**

- **`R3-K4`:** every page within its cap by the provider's count; record whether outline and card index fit one page.
- **Paging** (part of `R3-K2`'s residual): the share of the 20 runs that end in the expected state, each truncated page followed by a cursor read or covering reads, is recorded in `docs/impl/reports/claims/R3-K2.json` without a gate; B3's 95% (19 of 20) is the reference (A:testing-1f).
- **`R4-SP5`:** the one-patch share of the 20 is recorded in `docs/impl/reports/claims/R4-SP5.json`. There is no pass mark; D3's witness format applies until a rewording under the pre-stated rule is recorded as a build revision with the figures that led to it. Batch 3's 88% first-patch validity is context, not a threshold (C:M4-O4; A:testing-1f).
- **A1** (`lld/10` §3.2): the artifact is cached under its own work key; Project Core refuses the proposal with `STALE_READ_SET`, listing the entities whose `pin_hash` changed (B:SD2); nothing is promoted; a second run merges cleanly.

**Done when.**

- [ ] The result files and ledger lines exist, and `npm run test:accept` passes.

**Out of scope.** The golden brief.

### M4-13 — Golden brief: abstract motion graphics

- **Care:** normal. Run by a test author; no product code changes.
- **Package:** `tests/golden/abstract-motion-graphics/`
- **Depends on:** M4-01 to M4-12     **Parallel with:** none
- **Live calls:** full Director sessions. **Ceiling $1.80**, at most three runs.

**Goal.** The brief runs from `cutroom new` to a silent film with no human input, judged automatically.

**Read first.** `lld/10` §3.1, §3.3, §4.2; `lld/07` D2, D10, §6; `lld/04` §2.2 (`brief`, `quality_intent`, `music_cue`), §6; `lld/05` D2 (`TIME_BEAT_UNAVAILABLE`), D3 ("Beat grids"); `lld/08` §2.2.2; `lld/11` G19, K11, FR2, J10, U15, and §18: C:C1.1, C:C1.2, L23, A:testing-1f; report C's row C:M4-O2.

**Build.** `brief.json` in `brief` fields, its `text` following R10 ("a 30-second beat-synced geometric piece, no narration"), with hard constraints for duration and no narration; tolerances set by the test author. **Beat sync without audio:** the brief's `text` states a tempo, the Director times cuts and accents with `time_constraint` entities, and `expected.json` records beat alignment as an expected property that none of the nine tests judges. No `music_cue` with a grid and no audio is written, because "Every cue enters the Render Plan as a frozen WAV artifact" (`lld/08` §2.2.2); real beat grids come with M5's music engine and this brief's re-run at M11 (C:M4-O2). `expected.json`: expected properties and expected constraints (G19, compared at M6). `judge.ts` and a runner driving the CLI.

**Rules that are easy to get wrong.** At `cutroom new`, set `budget.hard_cap_usd` to the smaller of $1.00 and ($1.80 − spend so far); start no run below $0.80, since the delivery reserve withholds $0.50. After `cutroom run`: no `say`, no human patch, no manual restart; a restarted run counts as failed. Record every exchange and add replay regressions of the treatment worker and one author job. Three failures with one cause: stop and report (`impl/00` §7).

**Tests** (the judge passes a run when all nine hold):

1. No steering event and no `human` patch after `cutroom new`.
2. The session ended when the staged `delivery_finalize`'s chain returned a file (C:C1.1, L23), not `stalled`, and not by `director_report_blocked`.
3. `ffprobe`: one H.264 stream at the profile's size and rate, exactly `N = ceil(end / T)` frames (`lld/05` D3), a duration meeting the brief, and **no audio stream**.
4. No black or frozen interval beyond R9's defaults (`lld/09` §3.1, §5).
5. The final compile is `frozen` at grade `preview`, rung `final`, without `NOT_READY` (C:C1.1); every component has a passing `check.run` record.
6. If `treatment_propose` ran: three treatments, their stated differences read from the treatment worker's evidence bundle (C:C1.2), and a `decision` listing the alternatives; otherwise a `decision` saying why not (D2).
7. The Quality Intent covers every brief hard constraint; derived constraints are printed beside `expected.json`.
8. `R3-K2` residual: the share of first patches valid and the share valid within two repairs are recorded in `docs/impl/reports/claims/R3-K2.json`, against B3's 88% and 98% as the reference; the measurement must run, but its values are not a gate (A:testing-1f).
9. Spend within the ceiling, from the ledger.

**Done when.**

- [ ] One run passes all nine tests, and the ledger is written.
- [ ] `docs/impl/reports/M4.md` records: brief, revision and film hashes with `ffprobe` output; time to film; turns, segments, sub-loops; each component's passing round; patch and error-code counts; paging events; spend, tokens and cache share by model; failures by class; derived against expected constraints; a contact sheet with the orchestrator's description, labelled a person's look; everything unverified.

**Out of scope.** Reviewer calls, final-file checks, and the deliverable record (M6).

---

## Acceptance list

| # | Command | Expected result |
|---|---|---|
| 1 | `npm run check` | Passes, `harness` and `cli` dependency edges included |
| 2 | `npm test`, network disabled | Passes on replay; the scanner finds no key, authorisation header or home path |
| 3 | `npm run test:render` | Passes, with M4-09's silent file and M4-11's ladder rounds |
| 4 | `npm run test:accept` | A1 (stub, replay, real executor), A7, A11 pass |
| 5 | `CUTROOM_LIVE=1 npm run test:live -- tests/claims/R6-S11-conformance.live.test.ts` | Every M4 tool arrives as sent on MiniMax-M3 and MiniMax-M3.1-Flash; pins and J12 moves recorded |
| 6 | Same, `R6-S11-transport` | Each transport fact labelled, fallbacks applied where failed |
| 7 | Same, `R5-2-billing`, `R5-3-rate-limits` | A verdict per row |
| 8 | Same, `R3-K4-views`, `R3-K2-paging`, `R4-SP5-witness` | Pages within caps; the paging share and the `R4-SP5` share recorded in `docs/impl/reports/claims/`, without a gate (C:M4-O4; A:testing-1f) |
| 9 | `CUTROOM_LIVE=1 npm run test:live -- tests/acceptance/A1-stale-worker.live.test.ts` | Passes with the real author |
| 10 | `tests/golden/abstract-motion-graphics/run` | The judge prints PASS for tests 1 to 9 and the film's path |
| 11 | `impl/04-spend.md` ledger | M4 at most $3.30, each package within its ceiling |
| 12 | `gh pr view` on the pull requests of M4-02, M4-05, M4-06 and M4-07 | Each is merged, its issue closed, and its body holds the closed-review line (`impl/00` §5). Per-package status lives in the issues and pull requests; `impl/STATE.md` changes only at the milestone's end (L20) |

## Claims of R10 §2.2 assigned to M4

| Claim | Fallback | Package |
|---|---|---|
| Residual of `R3-K2`: vague Director requests; paging at the cap | Change the view format; validate-and-repair bounds the damage | M4-13, M4-12 |
| `R3-K4`: views fit their token targets | Lower the page size; cursors exist | M4-12 |
| `R4-SP5`: MiniMax-M3 repairs timing from a witness | Reword the witness | M4-12 |
| `R5-2`: refused requests unbilled; aborted streams billed for produced tokens only | The ledger under-counts by a bounded amount; the hard cap has a reserve. The billing half is `UNKNOWN` if the user gives no usage figure (L17) | M4-04 |
| `R5-3`: rate limits per account and model | The adaptive limiter slows on 429 regardless | M4-04 |
| `R6-S11`: transport facts and conformance | Override the header or use `fetch`; add a detector; lower the compaction threshold; keep thinking blocks to the segment boundary; a changed parameter travels as JSON text | M4-04 |

## Live-call budget

**M** marks a measured figure, **E** an estimate.

| Package | Ceiling | Basis |
|---|---|---|
| M4-04 | $0.80 | **M:** a tool task $0.00021 (Flash) to $0.00043 (MiniMax-M3); a 40-call caching run $0.031 (S5). **E:** a tiny Flash request about $0.0002 |
| M4-12 | $0.70 | **M:** $0.0006 to $0.0015 per patch edit (B3); about half a cent per authored component ($0.0029 generation, $0.0011 repair, S3); a MiniMax-M3 sheet judge $0.0015 (S6); an adaptive Reviewer sheet about one cent (batch 2c). **E:** $0.003 to $0.006 per adaptive turn; about $0.002 per Flash look |
| M4-13 | $1.80 | **E:** $0.35 to $0.50 a run: 40 to 70 Director turns (B3 measured about $0.001 per request at 15,000 tokens of context), 6 to 10 components at half a cent, a treatment worker at one to two cents |
| **Total** | **$3.30** | M4's ceiling ([spend](../04-spend.md) §1), within U15's $10 through M6 |

## Resolved points

Every point the plan raised is closed by the lead's rulings and the research report C, recorded in section 18 of [`lld/11`](../../lld/11-integration-decisions.md). Identifiers follow section 18: `L<n>` is a lead ruling; `C:M4-O1` is report C's row for M4's point O1; `C:C1.1` is part 1 of report C's decision C1; `A:M1-2` and `B:O17` are rows of reports A and B. Rows classed ANSWERED or IMPLEMENTATION DETAIL have no row in section 18 and are cited to the [report](../research/open-points-C.md) itself.

| Point | What it was | Resolution |
|---|---|---|
| O1 | How production ends at M4, before `delivery_finalize` is complete | **Decided** (C:C1.1, L23). At M4 and M5 a staged `delivery_finalize` with the designed name, input and immediate errors compiles `frozen` at grade `preview`, rung `final`, requires frozen commitments, exports through `plan_to_jobs(plan, "review")`, writes no deliverable record and never reports delivery; the run ends when its chain returns a file. M4-03, M4-07, M4-09 and M4-13 carry it; M6-09 replaces it with the designed chain. |
| O2 | "Beat-synced" without any audio | **Left to the implementer** (C:M4-O2). Safe because none of the nine judge tests depends on it, and a cue with a grid and no audio is not a designed object (`lld/08` §2.2.2). The plan takes the report's choice: a stated tempo, cuts timed by `time_constraint`, beat alignment as an expected property only (M4-13). |
| O3 | The treatment worker's submission tool, and where each pair's difference lives | **Decided** (C:C1.2). `submit_treatments` (`propose`, typed to every leaf) is the worker's only tool; treatments are proposed with `status: proposed`; the differences go in the worker's evidence bundle, keyed by treatment handle; `treatment` gains no field. M4-03, M4-10 and M4-13 carry it. |
| O4 | `R4-SP5` has no pass threshold | **Measurement** (C:M4-O4; A:testing-1f). M4-12 measures the share of 20 seeded conflicts fixed by one patch and records it without a gate; batch 3's 88% first-patch validity is context only. D3's witness format applies until then. The lead states the rewording rule in M4-12's issue before the run. |
| O5 | `R5-2` needs MiniMax's usage page, which only the user can read | **Decided** (L17; C:M4-O5). The session asks the user once, at M4-04, for the plan's usage figure before and after the probe; without it the billing half of `R5-2` is `UNKNOWN` and the build continues. |
| O6 | `R5-3` targets a pay-as-you-go key, but U11 kept the subscription key | **Answered** by U11 and `lld/06` §8 (C:M4-O6): the probe runs on the current key within `llm.max_concurrent`; the pay-as-you-go claim stays ASSUMED with `lld/10` §2.2's fallback. |
| O7 | Observing moderation needs a request meant to be refused | **Decided** (C:M4-O7). No refusal is provoked; the documented signals are detected on M4-01's reply builders; moderation in `R6-S11` is recorded "not observed" and stays ASSUMED with `lld/07` §8's fallback (M4-04). |
| O8 | Validation inside the author job needs a browser, and `subloop.run` has no pool | **Answered** by `lld/06` §2.5, FR13 and K4 (C:M4-O8): each repair round is a `component.validate` child job, its output ladder evidence, not a validation record (M4-11). |
| O9 | Views, field lists, the control-extremes sheet, the edit rule or the SDK pin may be missing from M0 to M2 | **Answered** by `lld/10` §7 (C:M4-O9): a missing item is added in its owning package before the dependent package starts. The views (B:O17) are built by M4-08a, and the contact-sheet and event-strip builders (A:M1-2) by M4-11. |
| O10a | What `cutroom new` creates besides the brief | **Decided** (C:M4-O10a). `genesis` with the `brief` lock, the primary `delivery_profile` from the defaults through the human path, and the "brief accepted" event; no Quality Intent and no `decision` (M4-07). |
| O10b | Where `director_report_blocked` writes before M6 | **Decided** (C:M4-O10b). A `decision` with `type: technical`, `chosen: stop`, the reason as `rationale`, the unmet requirements and the cheapest remedy as `alternatives`, and the bundle IDs as `evidence`; from M6 also the blocked export's deliverable record (M4-08b, M6-09). |
| O11 | `say`, `pause`, `lock`, `export`, `audit` and `events --follow` belong to no milestone | **Left to the implementer** (C:M4-O11). Safe because `lld/07` D12 calls them illustrative and scheduling them changes no module boundary or persisted name. The report's schedule stands as guidance: a human patch path and `lock` by M6-10, `say` by M6, `export` with M6-09, the rest at M11 unless a package needs them sooner. |
| O12 | M4-02 treats a nullable value as a union, so it travels as JSON text | **Answered** by J1 and J12 (C:M4-O12). A nullable value is a union and travels as JSON text; a schema keeps a parameter structured by omitting an optional field instead of sending `null` (M4-02, M4-03). |
