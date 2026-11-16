# Cutroom v2 — LLD · R6: Director Harness, Tools, Plugins, Reviewer and Experiment Agent Runtime

**Decided:** 14 November 2026
**Status:** DECIDED by the lead session under the user's delegation of 14 Nov 2026. The design set was frozen on 15 November 2026 ([R10](10-r10-integration-acceptance-and-build-plan.md) section 6.4); this document may be revised during implementation.
**Baseline:** HLD A3–A5, B2–B3, C1, C8, C10 · [roadmap](00-design-process-and-roadmap.md) · [R0](01-r0-framing-decisions.md) · [R1](02-r1-foundations.md) with Revision 1 · [integration decisions](11-integration-decisions.md) · [spike log](../research/10-spike-evidence-log.md) · [S3, S5 and S6 results](../research/evidence/s3-s5-s6-minimax.md) · [batch 2c results](../research/evidence/b2c-minimax-review.md) · [batch 3 results](../research/evidence/b3-patches-and-restart.md) · [research 05](../research/05-agentic-harness-and-experiment-agent.md) · [research 11](../research/11-provider-cost-and-audio-research.md)
**Web sources** were fetched on 14 Nov 2026. Bare `S1`–`S7` are the spikes in the spike log; this stage's wanted spikes are `R6-S9` to `R6-S11` (section 9). Snippets are illustrative; their field names are the persisted `snake_case` names.

## 1 Problem and scope

The **harness** is the code that runs model conversations and connects them to the rest of Cutroom. One **Director** (the central model-driven controller) must steer a whole film and delegate bounded work cheaply, while every rule that matters is enforced by code and not by prompt wording.

Terms:

- A **turn** is one model request plus the execution of every tool call in its reply.
- A **run** is a sequence of turns that ends when the model replies without calling a tool.
- A **session** is one persisted conversation (the Director's, or one sub-loop's).
- A **sub-loop** is a separate session with a fresh context, a restricted tool set, a pinned input bundle and a budget.
- A **grant** is a stored record of what one session may read, change and spend.
- A **capability** is a kind of work the Scheduler (R5) runs as a job. A **paid** capability calls a provider that charges for it.

**Out of scope:** prompt wording, the bodies of Production Studio tools (R7), and review rubrics and thresholds (R9).

**Constraints:** MiniMax-M3 and MiniMax-M3.1-Flash through the Anthropic-compatible Messages endpoint; no JSON-schema output mode; `tool_choice` accepts only `auto`; one Node process per Space with SQLite and a blob store; the conversation never becomes a second source of truth (C0 invariant 2); the Scheduler alone owns retries and spend.

## 2 Decisions

### D1. Framework: a thin custom loop, with the Anthropic TypeScript SDK as transport only

**Problem.** The loop needs exact control of the request bytes (for the prefix cache and for replaying thinking blocks), session storage in our own SQLite, tools that are our modules' operations, and no built-in coding tools.

| Candidate | Deciding facts, verified by source | Verdict |
|---|---|---|
| **Claude Agent SDK** | "A library that runs the Claude Code binary" ([overview](https://code.claude.com/docs/en/agent-sdk/overview)); proprietary ([Commercial Terms](https://www.anthropic.com/legal/commercial-terms)). Anthropic "doesn't support routing Claude Code to non-Claude models through any gateway" ([gateway docs](https://code.claude.com/docs/en/llm-gateway)), although MiniMax documents that setup ([MiniMax](https://platform.minimax.io/docs/m-plan/claude-code.md)) | **Rejected:** unsupported use, built-in file and shell tools, its own session files |
| **Pi** | MIT, 1.5.2 ([package.json](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/package.json)); parallel tools and tool-call hooks ([README](https://raw.githubusercontent.com/earendil-works/pi/main/packages/agent/README.md)); sessions are its own JSONL trees ([SDK docs](https://docs.pi.dev/latest/sdk)); "does not include a built-in permission system" ([repo](https://github.com/earendil-works/pi)) | **Runner-up:** we would still write persistence, validation, budgets and authority. Kept as a fallback transport |
| **Vercel AI SDK** | Apache-2.0 ([package.json](https://raw.githubusercontent.com/vercel/ai/main/packages/ai/package.json)); MiniMax's provider page says "Video input is not supported" ([MiniMax](https://platform.minimax.io/docs/api-reference/text-ai-sdk.md)) | **Rejected:** the Reviewer needs video input |
| **OpenAI Agents SDK (JS)** | MIT, 0.22.0 ([package.json](https://raw.githubusercontent.com/openai/openai-agents-js/main/packages/agents/package.json)); Responses-only features are "warned and ignored" on Chat Completions ([models guide](https://openai.github.io/openai-agents-js/guides/models/)) | **Rejected:** it forces the OpenAI-compatible endpoint, which MiniMax does not recommend |
| **Mastra**; **LangGraph JS** | Mastra bundles workflows, memory and storage ([repo](https://github.com/mastra-ai/mastra)). On resume, LangGraph's "runtime restarts the entire node from the beginning" ([interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts)) | **Rejected:** each brings a second owner of state |
| **Plain `@anthropic-ai/sdk`** | Apache-2.0 from 1.0.0. MiniMax documents its base URL with this package ([MiniMax](https://platform.minimax.io/docs/api-reference/text-anthropic-api.md)). Request bodies are not validated at run time, so MiniMax-only blocks such as `video` pass through ([SDK docs](https://platform.claude.com/docs/en/api/sdks/typescript)). 1.0.0 sends `anthropic-version: 2026-10-21` and `Authorization: Bearer` ([migration guide](https://platform.claude.com/docs/en/api/migration-2026-10-21)); MiniMax accepts Bearer | **Chosen as transport** |

**Choice.** A thin loop of our own. A framework's loop, session store and tool registry are the parts Cutroom must own to keep authority and state in Project Core and the Scheduler (roadmap §2.1). The SDK supplies only HTTP, streaming, typed errors and request IDs, behind the `ModelClient` interface of D7. Its automatic retries are off (`maxRetries: 0`) because the Scheduler is the single retry owner (C0 invariant 6).

**Open risk.** S5 did not record the version header it sent, so MiniMax's acceptance of `2026-10-21` is unmeasured (`R6-S11`). If it is rejected, we override the header or use plain `fetch`.

### D2. The Director loop

**Turn structure.**

1. Build the request: the fixed system prompt, the fixed tool list and the append-only message history.
2. Run it as a `model.call` job (D7) and assemble the streamed reply.
3. Persist the assistant message exactly as received, thinking blocks and signatures included, before any tool runs.
4. Run each `tool_use` block through the pipeline of D5, then the tool.
5. Append one user message holding every `tool_result` in call order, then any waiting event digest.
6. If the reply has no tool call, the run ends and the Director is **parked**: no model call is made until something wakes it.

**What wakes it.** The Scheduler's `event` table is the only wake source. The harness keeps a per-session cursor and drops events already delivered, so duplicates and reordering are harmless (C10).

| Wake policy | Events (illustrative kinds) |
|---|---|
| **Immediately** | A sub-loop finished; a job failed with class `creative`, `capability` or `policy` (including a paid call the reconciler could not settle); a commitment was superseded with consumers affected; a hard check failed on an export; spend crossed one of `director.budget_wake_fractions`; a user steering message arrived |
| **Batched** (within `director.event_coalesce_ms`) | Success of a job the Director asked for; a new artifact range became available |
| **Never** | Transient retries, intermediate job states, cache hits, heartbeats |

An event digest is a short harness-written list of kinds, handles and references. It means "inspect current state" and is never the state itself. Messages must alternate between user and assistant, so a digest rides on the turn's tool-result message, or becomes the next user message when parked.

**Ending a film is a tool call, not a sentence.** A tool call cannot be forced, so the loop never reads prose as completion. Only `delivery_finalize` or `director_report_blocked` ends production. From M6, a `delivery_finalize` call ends production when the chain's deliverable record is `delivered` or `delivered_with_limitations`; a `blocked` or `incomplete` record wakes the Director at once, and the Director repairs or calls `director_report_blocked` (decided: `lld/11` section 18, C:C1.1). At M4 and M5, before that chain exists, the run ends when the staged `delivery_finalize` of D4 returns a file, and a failed chain wakes the Director as at M6 (decided: `lld/11` section 18, L23). If the Director parks with no job pending and neither was called, the harness sends up to `director.stall_nudges_max` nudges, then marks the session `stalled` and reports through the CLI.

**Progress is read from tool calls, not prose (J10).** With adaptive thinking, MiniMax-M3 wrote almost no text between tool calls in batch 3. Nothing in the harness depends on the model stating its progress in prose: decisions are `decision` entities, and progress is the audit log of tool calls (D11).

**Staying out of the data path.** Tools return handles, counts and short summaries; frames, code, logs and web text stay in the blob store. Routine chains need no model turn: `render_request` compiles inline first if needed and turns the plan into jobs with R5's `plan_to_jobs(plan, purpose)`. Sub-loop results are written by the owning module as patch proposals and evidence records, and the Director receives a notice with references (B2.6).

**The default first phase is a treatment search (decision FR2).** A `treatment` entity uses R3's fields `premise`, `hook`, `structure`, `visual_approach`, `tone`, `techniques` and `risks`, with `status`, optional `branch` and optional `decision`. The Director calls `treatment_propose`, and a treatment worker proposes `treatment.candidates` (3) distinct treatments with a stated difference between each pair. The Director develops up to `treatment.animatic_candidates` (2) of them on separate `d/` branches to script and `animatic` grade. When there are two or more animatics, one blind film-scope comparison (R9's review rule T9) ranks them against the Quality Intent, and the choice is a `decision` entity that lists the alternatives and why they lost. The phase's budget share is `treatment.budget_fraction` (0.2) of R5's `budget.soft_target_usd`, about one dollar on a typical film. Crossing that share tells the Director, who decides whether to continue; it does not stop the phase or impose a hard child-scope limit (G2). This is a default, not a fixed funnel: the Director may explore fewer when the brief fixes the treatment, and records why. Rejected treatments stay as branches and evidence.

### D3. Context strategy

**Problem.** MiniMax caches prefixes automatically for requests of 512 input tokens or more, matching "system prompts → tool list → user messages"; explicit breakpoints are unsupported ([caching docs](https://platform.minimax.io/docs/api-reference/text-prompt-caching.md)). MiniMax-M3 input costs $0.30 per million tokens, $0.06 cached, and all rates double in the ">512K input tokens" row ([pricing](https://platform.minimax.io/docs/pricing/overview.md)). The page does not say whether that applies to the whole request, so the design treats 512K as a cliff.

**Measured (S5).** Caching needed no marker. In a 10-turn append-only loop about 99% of the input was read from cache from the second turn on. The cache still hit after 25 idle minutes and missed after 32. `input_tokens` excludes cached tokens.

**Choices.**

1. **Append-only history.** The system prompt holds no project data and no timestamps. The tool list is fixed for a session and sorted by name; an unusable tool returns a typed error and is never removed. Nothing earlier in the history is edited. Current state arrives at the tail, in tool results and event digests.
2. **Retrieval by handle.** The first user message carries the brief and a project index built from the `outline` and `card` views, and every view result begins with the revision it was read from. S5 showed why: M3 often re-read the project before editing.
3. **Evidence by reference.** `evidence_read` returns one section of a bundle. `evidence_view` returns thumbnails, at most `director.images_per_run_max` per run.
4. **The page-size rule.** The harness passes a token cap with every tool call: `tool.result_max_tokens`, or the tool's override (4,000 for `project_read`). The owning module returns a page no larger than the cap, cut at a structural boundary, with a `truncated` mark, a total count and a cursor that the module owns. The harness never cuts a page a second time.
5. **Compaction by segment, not by editing.** When the last request's context size (`input_tokens + cache_read_input_tokens`) passes `context.compact_at_tokens`, the harness waits for a parked boundary, asks the model for working notes, and starts a new **segment**. Its first message is the brief, a fresh project index, a state digest generated by code (open jobs, open findings, budget, recent `decision` entities, and the last ten accepted patches with their intent and changed handles) and the notes. A segment cannot close without working notes: if the model returns none, the harness asks again. The notes must say which step is in progress and what has been patched but not yet closed; the patch list in the digest keeps a half-finished step visible even when the notes are thin (J8). `context.hard_max_tokens` forces the change at the next turn boundary. The old segment stays in the audit log.
6. **Thinking blocks are replayed unchanged,** as MiniMax requires ([tool-use guide](https://platform.minimax.io/docs/guides/text-m3-function-call.md)). The effect of omitting old blocks is unmeasured, so they are kept until the next segment.
7. **No keep-alive.** A Director parked for more than about half an hour pays one uncached read when it wakes: at 180K tokens about $0.054 instead of $0.011.

**Rejected.** Rewriting a "current state" block at the top of the prompt, or summarising old turns in place, breaks the cache on every change.

**Persistence and resume.** Sessions, messages and tool calls are rows in the Space database (D11). The assistant message is written before tools run, and each result when it completes. After a crash the harness reloads the history. A model call that was in flight is a job, so the Scheduler settles it (D7). A tool call without a result is re-run (read tools), matched to the job its work key already created (job tools), or answered with an `INTERRUPTED` error telling the model to inspect state. A session can also be discarded: a new Director session starts from the project alone, which proves the transcript holds no project truth.

### D4. The tool catalogue

R6 owns the tool names. Tools take handles, not entity IDs: S5 found no copying mistakes with either form, and long IDs cost about 30% more input tokens (R1 Revision 1).

**Errors** are tool results with `is_error: true`. Each code has one owner, and the harness relays module codes unchanged. The harness's own codes are `UNKNOWN_TOOL`, `SCHEMA_INVALID`, `BUDGET_EXCEEDED`, `TRUNCATED_CALL`, `EMPTY_RESPONSE` and `INTERRUPTED`. Project Core's codes are those of R3 §2.4; any project tool can return `UNKNOWN_ENTITY`, `UNKNOWN_REVISION`, `OUT_OF_SCOPE` (the grant does not allow it) or `LOCKED`. `TYPE_MISMATCH` is Project Core's schema code; the fetch module's code is `MEDIA_TYPE_MISMATCH`. Other modules define their codes in their own LLDs; the table names the ones each tool can return.

The inputs below are logical: each tool's input is one Zod schema, and how it travels to and from a provider is decided by the `ModelClient` adapter (D7).

Input and authority errors are returned at once. Job failures arrive later through `job_status` and evidence; their codes are marked *(job)* below. `DIAG_UNSUPPORTED` is an immediate tool error, decided from the component's `meta` before any job is submitted; `HARD_CHECK_FAILED` arrives as a job result, after the check has run (decision H3).

| Tool | Input | Output and specific errors |
|---|---|---|
| **Project Core** | | |
| `project_read` | `select` (handles, a kind or a shot), `view`, `at` (revision, `P` number or branch), `cursor` | The view and a next cursor. Views: `outline` (the project's own handle, then the beat and shot tree), `card` (one line per entity), `summary`, `full`, `timeline` (one shot's layers, events and constraints) |
| `project_find` | `kind`, `where`, `text`, `cursor` | Matching handles, one line each |
| `project_refs` | handle, `in` or `out` | Neighbours in the dependency index |
| `project_impact` | a patch or handles | The projected rebuild and revalidation set |
| `project_diff` | from, to, scope | Changed paths, before and after |
| `project_history` | handle, limit | Accepted versions, decisions, evidence |
| `project_schema` | `kind` | That kind's fields with their types, which are required, their write level, and one small example (J5) |
| `project_branch` | from, name, purpose | Branch and revision. `BRANCH_EXISTS` |
| `project_patch` | R3's envelope: `base`, `branch`, `intent`, `key`, `unlock`, `rebase`, `dry_run`, `ops`. On MiniMax, `ops` travels as one string of JSON text (D7) | A candidate revision, changed handles, warnings and an impact summary; with `dry_run`, diagnostics only. `STALE_BASE`, `DANGLING_REF`, `FIELD_AUTHORITY` (D10) and the rest of R3 §2.4 |
| `project_merge` | `branch`, `into`, `resolutions` (`ours` or `theirs` per path) | A merged candidate, its `revalidate` set, the record of the inline `plan`-mode compile and the check jobs started on that set (D10). `MERGE_CONFLICT`, `DELETE_MODIFY`, `HANDLE_COLLISION`; on a worker branch, Project Core's `STALE_READ_SET` when the worker's read set changed on the target head, listing each changed entity with its handle, the `pin_hash` the job read and the one on the head, with nothing merged; relayed unchanged (decided: `lld/11` section 18, B:SD2) |
| `project_promote` | candidate, expected accepted head | The new accepted counter (`P18`). `STALE_BASE` if the head moved |
| `experience_search` | `approach`, `context`, limit | Matching experience records |
| `evidence_read` | `ref`, `section`, `cursor` | One section of an evidence record, bundle, compilation record or timing report |
| `director_report_blocked` | reason, unmet requirements, evidence | A blocked record; ends the run. At every milestone the record is a `decision` written through Project Core under the Director's grant: `type: technical`, the `question` "production blocked" fixed by the handler, `chosen: stop`, the reason as `rationale`, the unmet requirements and the cheapest known remedy as `alternatives` entries `{label, why_not}`, and the bundle IDs as `evidence` (from M6 also the deliverable record of a blocked export). `cutroom status` shows it (decided: `lld/11` section 18, C:M4-O10b) |
| **Compiler** | | |
| `compile` | `revision`, `mode` (`plan` or `frozen`), `grade`, `rung`, `scope` | Runs inline in the tool handler (pure, a second or two); it is not a Scheduler capability. A compilation record ID, the plan ID if one was emitted, the top diagnostics and a feasibility summary. Diagnostics are results, not errors; a `frozen` compile of unready input reports `NOT_READY` |
| `plan_diff` | `a`, `b`: plan IDs or compilation IDs | R4's full result: the units, chunks, frames, bakes, audio clips, caption cues and work keys that differ |
| `timing_explain` | `compilation_id`, optional `select`: one of `{event}`, `{constraint}`, `{conflict}` | Solved times, windows, binding constraints, events placed by the earliest-time rule, the conflict witness |
| **Scheduler and Quality System** | | |
| `render_request` | revision or compilation, purpose, range, `rung`, `grade`, optional diagnostic capture (`hide`, `isolate` or `tint` one target) | Job, cache hit, cost and time estimate. Rung `still` runs as the `still.render` capability. `NOT_READY` with the compile diagnostics. R2's `DIAG_UNSUPPORTED` for `hide` or `tint` on a Canvas mark, returned at once |
| `check_run` | revision or artifact, R9 check IDs, scope | Job |
| `review_request` | target, question, focus handles, evidence forms, budget | Job; later verdict counts, top findings, coverage |
| `evidence_view` | `ref`, form (contact sheet, event strip, frame, crop), times, region | Images and a coverage note |
| `job_status` | jobs, a filter or a tree | State, ranges available, cost, failure class, diagnostic reference |
| `job_cancel` | job or tree, reason | R5's `CancelOutcome`: consumer released, shared job continuing, stop pending, or completed before cancel |
| `job_retry` | job, reason | The job, declared again. Director only |
| `artifact_quarantine` | job or artifact, evidence | The work key stops resolving; one re-run is allowed. Director only; the Quality System calls the Scheduler operation directly |
| `budget_status` | scope | Spent, reserved, remaining |
| `delivery_finalize` | delivery profile, expected accepted head | An inline `frozen` compile at grade and rung `final`, then the job chain: final render, final-file checks, final review, deliverable record. `STALE_BASE`, `NOT_READY`. *(job)* R9's `HARD_CHECK_FAILED`, R2's `DIAGNOSTIC_IN_DELIVERY`. **Staged form at M4 and M5,** before this chain is built: the same name, input, head check and immediate errors; an inline `frozen` compile at grade `preview`, rung `final`, which also requires every pinned commitment to be `frozen` (`NOT_READY` otherwise); then `plan_to_jobs(plan, "review")`, which renders the final-rung chunks and runs `film.concat`, and `audio.mix` and `film.mux` only when the plan has audio. It writes no deliverable record and returns no `completion_state`; its result names the file and the plan's grade and says that this build has no final-file check, review or record yet, and the CLI shows "exported, not checked: not a delivery" (decided: `lld/11` section 18, L23) |
| **Delegation** | | |
| `treatment_propose` | brief references, count, budget | Job; later proposed `treatment` entities, with a stated difference between each pair (D2). The treatment worker's only tool is `submit_treatments` (effect `propose`, typed to every leaf, no tight length limits): `treatments`, exactly the requested number of R3 `treatment` field sets, and `differences`, one `{a, b, difference}` per unordered pair, where `a` and `b` index `treatments`. The handler returns `SCHEMA_INVALID` naming a missing or repeated pair; otherwise it writes the treatments with `status: proposed` as the worker's patch proposal and stores the differences in the worker's evidence bundle, keyed by the new treatment handles. The Director's notice references both, and no field is added to `treatment` (decided: `lld/11` section 18, C:C1.2) |
| `research_request` | question, claims needed, source standard, budget | Job; later proposed `claim` and `source` entities |
| `component_author` | target handle, base revision, task, contract, context references, budget | Job; later component hashes, a reference to the one validation record of the returned candidate (D6.2), a patch proposal |
| `performance_author` | base revision, `mode`: `author` (target layer, a direction with event references, budget) or `shift` (a `track` handle, `from`, `delta`) | `author`: job; later a `control_track` patch proposal, a reference to the one validation record of the returned candidate (D6.3), an event strip. `shift`: a patch, with no model call. R4's `UNKNOWN_CONTROL` and R7's `KEY_IN_LOCKED_INTERVAL` and `SHIFT_NO_ROOM`, relayed unchanged |
| `experiment_request` | experiment specification (D6.5) | Job; later an experiment report. `KNOWN_FAILURE` (a warning with the earlier evidence) |
| **Researcher only** | | |
| `web_search` | query | Search results, through the `SearchProvider` (D6.6) |
| `web_fetch` | URL, purpose | Plain text in an untrusted-data fence, from R7's fetch transport under its `document` policy. R7's `URL_NOT_ALLOWED`, `FETCH_FAILED`, `TOO_LARGE`, `MEDIA_TYPE_MISMATCH`, relayed unchanged |

**Mapping.** R3's `get` is `project_read` with the `card`, `summary` or `full` view, its `validate` is `project_patch` with `dry_run`, and R9's `evidence.get` is `evidence_read`.

**Core tool effects (G17).** The `read` effect applies to `project_read`, `project_find`, `project_refs`, `project_impact`, `project_diff`, `project_history`, `project_schema` (J5), `experience_search`, `evidence_read`, `evidence_view`, `compile`, `plan_diff`, `timing_explain`, `job_status` and `budget_status`. The `propose` effect applies to `project_branch`, `project_patch`, `project_merge`, `project_promote`, `director_report_blocked` and every sub-loop submission tool, including `submit_findings`, `submit_research` and `submit_treatments` (C:C1.2); its payload is a proposal that the receiving module validates. The `job` effect applies to `render_request`, `check_run`, `review_request`, `job_cancel`, `job_retry`, `artifact_quarantine`, `delivery_finalize`, `treatment_propose`, `research_request`, `component_author` and `experiment_request`. The `network` effect applies to `web_search` and `web_fetch`. Grants in D10 determine who may call a tool; its effect does not grant permission.

**Plugin-registered Studio tools.** R7 registers these through D9 and owns their inputs, outputs, effect classes and errors: `voice_request`, `music_request` and `sfx_request` have effect `external_paid`; `take_select`, `captions_build` and `dataset_register` have effect `propose`; `media_search` and `media_acquire` have effect `network`; `media_annotate`, `capture_run` and `performance_author` have effect `job`. `media_annotate` has a vision worker propose named anchors on an asset, stored after a crop review confirms them (FR6). `capture_run` submits the `external_interactive` capability `capture.run`, whose recovery class is separate from the tool's effect. Each request names its target entity and base revision.

### D5. Validation and repair at the tool boundary

**Problem.** Tool input is never guaranteed to match a schema, a call cannot be forced, and a reply can be cut off because `max_tokens` also counts thinking tokens ([MiniMax](https://platform.minimax.io/docs/api-reference/text-anthropic-api.md)).

**The pipeline for every tool call:**

1. **Look up the name.** An unknown name returns `UNKNOWN_TOOL` with the nearest names.
2. **Decode the wire form (D7).** A parameter that travels as JSON text is parsed back into its logical value. Text that does not parse returns `SCHEMA_INVALID` with the parser's position. If the model sends the identical unparseable string twice, the result says so and asks for the value to be written again from the beginning; batch 3 saw the same broken string re-sent four times (J2).
3. **Normalise leniently, and log it.** A JSON-encoded string is parsed where an object or array is expected, and a numeric string is converted where the schema wants a number. Unknown keys are rejected with the nearest valid key.
4. **Validate** against the logical schema, the shared Zod schema. Failure returns `SCHEMA_INVALID` with up to ten issues: path, expected, received, hint.
5. **Resolve** handles and revisions. Failure returns `UNKNOWN_ENTITY` with the nearest matches.
6. **Check authority** in the owning module against the session's grant and each field's write level (D10).
7. **Check budget** (D8), then **execute**.

*Illustrative error result; the diagnostic inside is R3's, relayed unchanged:*

```json
{"code": "STALE_BASE", "source": "project_core", "retryable": true,
 "diagnostics": [{"code": "STALE_BASE", "severity": "blocking", "op_index": 0, "target": "shot04.volcano",
   "message": "Branch head is rev_91c0; the patch was based on rev_4f2a."}]}
```

**Repair.** The error goes back in-band and the same model repairs on its next turn, which is a new model call and never a retry. After `tool.repair_attempts_max` consecutive failures of the same tool with the same code, the result adds the schema excerpt and a minimal valid example. After `tool.repair_hard_stop` more, a sub-loop ends `blocked` and the Director session raises a stall alert. A second "repair model" at the boundary was rejected because it hides the failure from the history.

**Evidence (S5).** Without a JSON mode, 377 of 381 tool calls (99.0%) were schema-valid across both models, and an exact schema error fixed 4 of 4 natural invalid calls. One model silently replaced an unsupported value with an allowed one, so a successful result echoes the values applied. This rate holds for fully typed schemas only: in batch 3 the MiniMax endpoint damaged 31% to 59% of structured patch calls, whose `ops` the schema left untyped, which is why such parameters travel as JSON text (D7, J4).

**Evidence (batch 3, patch authoring).** With `ops` sent as JSON text on a 184-entity project, 88% of first patches were valid, 96% within one repair and 98% within two. Validate-and-repair is therefore required, and two repairs are the expected budget (J6). Models sometimes copied an unrequested field from a neighbouring entity, and MiniMax-M3 twice substituted a near match on an impossible request, so the worker and Director prompts say to set only what was asked and to report what cannot be done.

**Structured final answers.** A sub-loop that must return structure ends by calling a `submit_*` tool. If it does not, the harness sends up to `subloop.submit_nudges_max` nudges, then tries to extract and validate a fenced JSON block from the text, and otherwise records `failed` with class `deterministic`. The two author workers instead return one fenced block in plain text (D6.2, D6.3).

Batch 2c verified the `submit_*` path (section 8). Every failure there was a tight length limit, so `submit_*` schemas avoid them, and the harness truncates an over-long text field and records that it did.

**Cut-off replies.** A tool call that arrives incomplete under `stop_reason: "max_tokens"` is never executed; it receives a `TRUNCATED_CALL` error result.

### D6. Sub-loops

Every sub-loop is a Scheduler job of capability `subloop.run`. The Scheduler owns its lifecycle, cancellation and budget scope; the harness supplies the executor. Each model request inside it is a `model.call` job in that scope. Sub-loop sessions persist and resume like the Director's. Nesting is capped by `subloop.max_depth`.

#### D6.1 The worker handoff (HLD C1)

*Illustrative:*

```ts
type Handoff = {
  task_id: string; correlation_id: string; causal_parent: string;
  project_id: string; base_revision: string;
  inputs: { ref: string; requires: Predicate }[];
  goal: string;
  expected_output: "patch" | "component" | "control_track" | "findings" | "research" | "experiment_report";
  permitted: { branch: string; write_scope: string[] };   // handles, kinds or field paths
  forbidden: string[];                                    // locks and named exclusions
  constraints: { quality_intent: string; brief_refs: string[] };
  budget: { usd: number; tokens: number; wall_s: number; max_turns: number };
  prior_findings: string[];
  reporting: { outcome_schema: string; evidence_required: string[] };
};
// Predicate is R5's schema (R5 §2.4), imported and used exactly, with no local variant. For example:
// {all: [{fact: "completion", authority: "scheduler", work_key: "sha256:…", need: {kind: "complete"}},
//        {fact: "validation", authority: "quality", check: "C-03", verdict: "PASS",
//         subject: {result_of: "sha256:…"}}]}
type WorkerOutcome = {
  status: "succeeded" | "needs_revision" | "blocked" | "failed";
  failure_class?: "transient" | "deterministic" | "capability" | "creative" | "policy";
  artifacts: string[]; patch_proposal?: string;
  evidence_bundle: string;                                // ID of an R9 Diagnostic Evidence Bundle
  summary: string; scope_expansion_request?: string[]; cost: object;
};
```

- **Readiness is typed.** `requires` is R5's `Predicate` schema over the R1 §4.2 facts, used exactly as R5 defines it; R5 names who answers each fact.
- **The grant is narrower.** The harness builds the worker's grant from `permitted` and `forbidden`; it can only be narrower than the Director's and never exceeds the `director` write level (D10). A worker that needs more returns `scope_expansion_request` and cannot authorise itself.

#### D6.2 The component-author worker

**Choice.** A fixed generate → validate → repair loop on MiniMax-M3.1-Flash, with no model-called tools. It is the only component repair loop in Cutroom: R2 and R9 refer to it, and its limits are R6's `author.*` settings.

1. **Generate.** The prompt carries the pinned bundle: component contract, task, scene-context regions, style references and the shim's API. `author.candidates` documents are requested (default 1).
2. **Extract** the one fenced HTML document the model returns.
3. **Validate** with R2's ladder, in code, including the probe checks and the response check on every declared control. Inside the job the ladder runs as plain functions, round after round, and repair rounds write no validation records. Only the candidate the worker returns is validated through `check.run`; the check runner writes that one record (FR13), and the worker's result carries a reference to it (K4).
4. **Repair on Flash,** up to `author.repair_attempts_max` times. Each repair is a fresh request holding the task, the current document and the exact rule IDs and messages. It asks for search/replace edits, each of which must match exactly once; after a second failure it asks for a whole document.
5. **Look.** A fresh-context check on Flash views one contact sheet; its findings feed at most `author.visual_repair_rounds` further rounds. It is one call, the same as R2's step V7 and R9's review rule T1; it cannot be turned off and is outside R9's review caps.
6. **Escalate** to MiniMax-M3 for `author.escalation_attempts` only when the Flash attempts are used up, then return `needs_revision` with the evidence bundle.

**Evidence (S3, 80 components).** The ladder passed 90% at the first attempt, 96% after one repair and 100% after two. Search/replace repairs fixed as many failures as whole-document rewrites with about one sixth of the output tokens. M3 as first repairer was no better, slower and dearer, and Flash fixed a repeated error on its second attempt, so a repeated error does not escalate early. At least 7 of the 72 passing components were visibly broken, hence the probes and the look.

**Why no tools.** S2 and S3 returned one extractable document in 110 of 110 generations. A large HTML document inside a JSON tool argument adds escaping risk, and a fixed loop leaves the model no action to choose.

#### D6.3 The performance-author worker

**Problem.** Drawing and acting are separate (R7): a character component exposes controls, and the acting is a `control_track` in the project. In S6, M3 wrote valid tracks (3 of 3 at the first attempt, about half a cent each), and one track showed a double-take on 5 of 5 characters, which no one-shot component had achieved.

**Choice.** A second fixed loop with no model-called tools, on MiniMax-M3 with thinking on.

1. **Bundle** (contents owned by R7): the control manifest from the component's `meta`, a pose sheet, the shot's solved event schedule, the direction text and matching recipes.
2. **Answer in two steps:** acting beats tied to events, then keyframes per beat, as one fenced JSON block in authoring form.
3. **Normalise and validate.** The tool layer resolves authoring sugar (relative key times, a character name as target) into R3's stored form, then applies R7's deterministic rules.
4. **Look.** A low-resolution render is checked with probes and with an **event strip**: frames about 120 ms apart, centred on each event. S6 showed the acting in such a strip and not in 12 evenly spaced frames.
5. **Repair** from exact findings, up to R7's `acting.repair_attempts`. The result is a patch proposal for a `control_track` on the `acting` layer. As in D6.2, the validation in steps 3 and 4 runs as plain functions in every round and repair rounds write no validation records; only the returned candidate is validated through `check.run`, which writes that one record (FR13), and the worker's result carries a reference to it (K4).

A missing control is not this worker's failure. It returns `blocked` with class `capability`, and the Director follows R7's capability-gap flow. `shift` is a mode of `performance_author`: given a `track` handle, it delays that track's keys in code by inserting a hold, and starts no worker.

#### D6.4 The Reviewer

**Bundle.** The Quality System builds an immutable, version-pinned bundle: the brief and Quality Intent; relevant accepted decisions; ground truth (claims with source excerpts, data, the frozen transcript and word timings); actual output (contact sheets, event strips, crops, clips as video input, deterministic check results, and an audio transcript because the models take no audio); and prior findings with how they were settled. The Director supplies only a short `question` and `focus`; none of its transcript is included (A4).

**Evidence forms.** Dense still strips are the primary evidence for frame-level inspection, acting included; evenly spaced contact sheets are never used to judge acting (S6). A slowed inspection clip is optional. A real-time clip is used only for pacing and is never asked about a single-frame defect (batch 2c, section 8).

**Tools.** `evidence_read` and `evidence_view`, restricted by the grant to the pinned bundle and its artifact, and `submit_findings`.

**Read-only, in three layers.** The tool list contains no mutating tool. The grant has an empty write scope, so Project Core refuses any patch from that actor. Findings are stored by the Quality System after schema validation, not written by the model.

**Coverage is computed, not self-reported.** The harness logs which frames, clips and sections were served and writes the R1 coverage record from that log, including the sampling rate or frame spacing. Video input is sampled at no more than 5 frames per second on this endpoint ([API reference](https://platform.minimax.io/docs/api-reference/text-chat-anthropic); D13). A finding located outside served coverage is stored as a hypothesis with verdict `UNKNOWN`.

**The Reviewer is fallible evidence.** In S6 an M3 judge agreed with direct inspection on 12 of 15 event strips and gave one false positive in ten control sheets. In batch 2c it raised false alarms on clean material in every evidence form. A single-frame defect it reports is therefore a hypothesis until a deterministic check (R9's P-06 or a diagnostic capture) confirms it. Its findings inform the Director, and no single review decides anything by itself.

**A reviewer-proved hard constraint takes a majority (decision FR4).** One `FAIL` or `UNKNOWN` on such a constraint triggers up to two more reviews, and the verdict is the value held by a strict majority of R9's `review.hard_proof_votes` (3), or `UNKNOWN` when no value holds one; the reviews stop as soon as a majority exists (R9 §3.4) (decided: `lld/11` section 18, C:C1.6). The harness runs them as separate Reviewer sub-loops, each with fresh context. R9 owns the rule and the setting.

#### D6.5 The Experiment Agent

*Illustrative specification:*

```json
{"id": "exp_handoff_017", "question": "Which method gives a readable prop handoff?",
 "base_revision": "rev_43…", "scope": ["shot04.handoff"],
 "variants": [{"name": "pose_switch"}, {"name": "control_track"}],
 "constants": ["script", "voice_take", "background", "delivery_profile"],
 "measures": ["contact_continuity", "review:readability", "render_ms", "cost_usd"],
 "required_evidence": ["isolated_preview", "full_composite"],
 "budget": {"max_trials": 3, "usd": 0.6, "wall_s": 1200},
 "stop_when": ["clear_winner", "budget_exhausted"], "prior_attempts": ["ev_…"]}
```

- **When.** The Director may call `experiment_request` whenever it judges an alternative worth testing, not only after failed repairs (decision FR2).
- **Branch isolation.** Project Core creates branches under `exp/<experiment>/<variant>` from the frozen base. The agent's grant allows `project_patch` only under that prefix and never allows promotion. Unchanged shots hit the cache because work keys are content hashes.
- **Fair comparison.** Every variant is rendered and reviewed with the same settings, and the harness randomises variant labels in the review bundle so the Reviewer cannot tell which is the baseline.
- **Memory.** The harness supplies prior experience records that match the scope. A trial with the same `approach` and `context` as an earlier failure returns Project Core's `KNOWN_FAILURE` warning with that evidence; the agent proceeds only by stating what changed.
- **Result.** An experiment report stored as evidence: measures per variant, costs, classified failures, negative results and a recommendation. The Director adopts a variant with its own patch and promotion. A failed experiment needs no rollback because the accepted head never moved.

#### D6.6 The researcher

**Problem.** Web text can contain instructions aimed at the model (indirect prompt injection). OWASP advises least privilege, validated output formats and segregating external content ([OWASP LLM01](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)). MiniMax's `web_search` runs on the server and inserts results straight into the calling context ([server tools](https://platform.minimax.io/docs/guides/server-tools.md)), so the harness cannot wrap them.

**Choice: quarantine, plus defences that do not depend on the model obeying.**

1. **The Director has no search or fetch tool.** It calls `research_request` and receives typed `claim` and `source` proposals. Raw web text never enters its context.
2. **Privilege separation.** The researcher holds only `web_search`, `web_fetch` and `submit_research`. It cannot patch, render or exceed its budget.
3. **Search behind an interface.** `SearchProvider` defaults to MiniMax's server-side `web_search`. A client-side provider could replace it as an ordinary tool whose results the harness can fence.
4. **Labelling.** `web_fetch` uses R7's fetch transport under the `document` policy, which reduces HTML to plain text and never executes it. The result is capped at 8,000 tokens and wrapped in a fence with a random boundary token and a header saying it is untrusted data.
5. **`trust` follows the text into the project.** Every entity may carry `trust` (`trusted`, `user` or `untrusted_web`). Entities created from web text carry `untrusted_web`, and every model-facing view and evidence bundle shows their string fields inside the same fence.
6. **Checked output.** Every claim cites a source handle and a short quote. The quote check, which verifies that the quote occurs in the stored snapshot, is owned by R7's research module; the researcher sub-loop calls that module operation (K2). That check, not a model patch and not the harness, writes `claim.support` and a `supported` status (D10).
7. **Egress control.** `web_fetch` is GET-only, sends no credentials, blocks private addresses, re-checks redirects, and accepts only URLs that appeared in the brief, a search result or a page already fetched by the same job. The model cannot compose a URL to carry data out.
8. **No secrets in any context.** API keys are read by the transport and never appear in prompts or tool results.

**Residual risk.** Injected text can still bias what the researcher reports. Independent factual review (R9) is the control.

### D7. Model interface, routing and how a model call runs

*Illustrative:*

```ts
interface ModelClient {
  complete(req: ModelRequest, opts: { signal: AbortSignal; on_delta?: (d: Delta) => void }): Promise<ModelReply>;
  count_tokens(req: ModelRequest): Promise<number>;
}
type ModelRequest = { role: RoleKey; system: string; tools: ToolSpec[]; messages: Message[] };
type ModelReply = { content: Block[]; stop: "end" | "tool_use" | "max_tokens" | "pause" | "error";
                    usage: Usage; request_id: string; raw: unknown };
```

Assistant messages are stored and replayed exactly as the provider returned them. A role moves to another model or provider only at a segment boundary, where reasoning blocks are dropped, because signatures belong to the model that produced them. Routing is a settings table from role key to model, thinking, effort and fallback; a model catalogue records each pinned model's prices, limits and retirement date.

| Role | Model | Thinking or effort | Reason |
|---|---|---|---|
| Director, script, Experiment Agent | MiniMax-M3 | `adaptive` | Planning quality matters most |
| Treatment worker | MiniMax-M3 | `adaptive` | Creative planning work (G1) |
| Performance author | MiniMax-M3 | `adaptive` | Measured this way in S6 |
| Researcher | MiniMax-M3 | off | Extraction work; facts stay on MiniMax-M3 (R0) |
| Reviewer: shot scope, film scope and disputed facts | MiniMax-M3 | `adaptive` | Batch 2c: thinking off found 12 of 22 defects with 9 false ones, at $0.0012 a review; adaptive found 7 of 11 with 3 false ones, at $0.0105 and 64 s. This reverses the earlier "off for shot reviews" |
| Component author; per-component look | MiniMax-M3.1-Flash | `effort: low`; `medium` on repair | Tested at `low` (S2, S3); Flash cannot turn thinking off |

R6 owns the Reviewer's thinking and output settings (`reviewer.*`). `max_tokens` counts thinking tokens and is the only cap on them, so every role has a named output cap. With thinking on, M3 sometimes used a whole 8,000-token limit without answering (batch 2c), so `reviewer.max_output_tokens` is 16,000 for shot reviews and 24,000 for film reviews. A reply still cut off by the limit gives `UNKNOWN` and is retried once at `reviewer.retry_output_factor` (2) times the cap (decision H2).

**Tool arguments are encoded per provider, by the adapter (J1).** The tool catalogue stays logical: each tool's input is one Zod schema (D4), and the `ModelClient` adapter decides how it travels. On MiniMax the model writes a tool call as XML-like elements and the endpoint builds JSON from them using the tool schema, so a value the schema leaves untyped loses its type (batch 3). A parameter therefore travels as a structured argument only if its schema is typed down to every leaf, with no free keys, no untyped value and no union of value types. A value that may be `null` is a union of its type and `null`, so it travels as JSON text; a schema that should stay structured expresses "no value" as an omitted optional field instead (J1, J12). Every other parameter travels as one string parameter holding JSON text, which the adapter parses and then validates against the logical schema before the handler sees it (D5). `project_patch.ops` is the first such parameter; `project_merge.resolutions`, `project_find.where`, the experiment specification and any map with free keys follow the same rule. Handlers, modules and other providers are unaffected.

**Two guards on the wire (J2).** No name nested inside a structured parameter may equal the name of a parameter of the same tool; the tool registry (D9) refuses to load a tool that breaks this. JSON text that does not parse is returned as `SCHEMA_INVALID` with the parser's position, and an identical unparseable string sent twice brings a request to write the value again from the beginning (D5, step 2).

**A tool call that comes back as text (J3).** In two batch 3 runs the endpoint did not convert a call and returned the XML-like text. The adapter recognises an unconverted call in a text block, does not treat it as an answer, and asks once more; a second occurrence is `EMPTY_RESPONSE`.

**Transport conformance test (J4).** For every tool in the catalogue, the adapter's test suite sends a "call this tool with exactly this input" probe and compares what arrives, type by type. It runs at M4 and again whenever a model version pin changes, as part of `R6-S11`.

**Every model call is a Scheduler job.** The harness never calls `ModelClient` directly and has no retry of its own.

1. The loop requests a job of the `paid` capability `model.call` through the Scheduler's `request`, giving the request hash, the role, a variant index and the worst-case cost (context size plus output cap, at catalogue prices).
2. The Scheduler takes a limiter permit, writes the intent record, reserves the cost and only then lets the executor send. The executor is `ModelClient` with streaming on; response bytes go to R5's spool.
3. A complete response confirms the intent, books the real usage and completes the job. The loop then persists the assistant message.
4. A failure is **definitely unsent** when the connection was refused or an HTTP error response arrived. Like an explicit provider error before any content, it follows the rule for its class (section 4). A failure is **ambiguous** when the request may have run (a timeout, a reset or a stream error after response bytes began, a crash); the job then becomes `unknown_outcome` and goes to R5's intent reconciler.

A repair, a nudge or an appended tool result changes the request, so it is a new job with a new work key.

### D8. Concurrency and budget hooks

- **Within a turn.** Tool calls from one reply run concurrently when each is declared `safe` (reads and job submissions). Project-mutating tools run one at a time in the order written. Results return in call order. S5 saw two calls in one reply in 31 of 32 trials that needed them.
- **Across sub-loops.** The model limiter is R5's: `llm.limit_fraction` of MiniMax's published 200 requests and 10M tokens per minute per model ([rate limits](https://platform.minimax.io/docs/guides/rate-limits.md)), plus one global cap, `llm.max_concurrent` = 8 across all models, which concurrency ramps up to from `llm.start_concurrent`. The cap is global because the spike key, on a subscription plan, returned HTTP 429 near 10 concurrent requests (S5). R6 adds only `subloop.max_concurrent`, a per-role cap on running sub-loops under the limiter.
- **Budget.** The ledger and its enforcement are the Scheduler's. The harness puts the worst-case cost in each job specification. The Scheduler reserves it in the intent transaction, refuses when a budget scope cannot cover it (a tool call then returns `BUDGET_EXCEEDED`), and books actual usage after the reply. Crossing one of `director.budget_wake_fractions` wakes the Director.
- **At the hard cap** the Scheduler admits no new paid work. R5's `budget.delivery_reserve_usd` covers the final export, the final-file checks, the final review and the Director's wrap-up turns, so the Director can still deliver an eligible film or call `director_report_blocked`. `delivery_finalize` opens a child budget scope `delivery`, whose jobs draw on the reserve; the Director session's own `model.call` jobs may draw on it once the film's other spend has reached the hard cap less the reserve, or once that scope is open, and no other job may (R5 §2.10) (decided: `lld/11` section 18, B:M3-9-draw). Budget state never alters a hard check (B3.5).

### D9. The plugin model

**Choice.** A plugin is a first-party TypeScript module listed in the Space configuration and registered at process start. It is trusted code, not a sandbox.

*Illustrative:*

```ts
ctx.tool({
  name: "voice_request", description: "…",
  input: VoiceRequestInput,     // names the voice_line and base_revision; Zod, exported as JSON Schema
  output: JobHandle, errors: ["VOICE_UNAVAILABLE"],
  effects: "external_paid",     // read | propose | job | external_paid | network
  concurrency: "safe", roles: ["director", "experiment"], max_result_tokens: 600,
  handler: async (input, call) => call.scheduler.request(/* job spec */, call.consumer),
});
ctx.capability({ id: "voice.synthesize", adapter: "…", version: "1", effect_class: "paid", run });
ctx.role({ key: "caption_checker", tools: [/* … */], default_budget: {/* … */} });
ctx.setting({ key: "voice.default_takes", default: 2 });
```

`voice.default_takes` is owned by R7: its default is 2, its override level is `director`, and its range is 1 to 5 (G16).

- **Permissions follow the declared `effects`.** A handler receives only the module facades its effects allow: `read` gets a read-only project view, `propose` a patch call bound to the caller's grant, and `external_paid` can act only by requesting a Scheduler job, which writes the intent record. A capability's `effect_class` is R5's separate vocabulary for how its job recovers.
- **One capability catalogue.** Capability IDs come from R5's catalogue; a plugin registers an adapter for one, and the adapter version enters the work key.
- **The core does not change.** Tool lists per role, schemas, error codes, settings and audit fields are derived from manifests. A session's tool list is fixed at its start, so a new plugin applies to new sessions and segments.
- **Rejected:** MCP as the in-process plugin protocol, a dependency-injection framework, and hot reload.

### D10. Authority is in the modules

- **Grants.** Each session has a grant stored by the core: actor, role, job, read scope, write scope (branch pattern, handles, kinds, field paths), `may_promote`, budget reference, network permission and expiry. Models never see grants. The tool layer attaches the session's grant to each module call, and Project Core checks every patch against scope, locks and base revision.
- **Field authority (decision FR1).** Every schema field carries R3's `x-cut-write: {level, module?, values?}` metadata, with level `system`, `human` or `director`. The Director and every worker hold the `director` level only, and no grant raises it. Except for initial constraint creation below, Project Core refuses a patch that touches a `system` or `human` field with `FIELD_AUTHORITY`, which the tool boundary relays unchanged. System fields, such as `rights.status`, `asset.identity.verdict`, `claim.support`, measured fields and provenance, are written by the owning module's operations and never by a model patch. A module writes as the actor `{actor: module, module}`, with the identifiers `ingest`, `rights`, `research`, `beat_tracking` and `quality`; it may create the entity it fills and write its own `system` fields and `director` fields, never `human` fields or another module's `system` fields. An author worker's result is therefore stored through the `ingest` module in project-core, which creates the `component` and writes its `provenance` at creation (decided: `lld/11` section 18, B:O11). `claim.support` and a `supported` status are written by R7's research module from its quote check, which the researcher sub-loop calls; the harness does not write them (K2). The brief, hard constraints with `from_brief`, `quality_intent.disclosure`, `delivery_profile.ai_disclosure` and the settings in the `human` classes of R3 §2.7's shared rule (G15), such as `budget.hard_cap_usd` and `fetch.contact_identity`, are `human`, so the Director cannot change them. Each setting declares `override_by` and `range`, and project views mark fields the reader may not write as read-only (G10–G12).
- **Initial Quality Intent (G19).** The Director creates the Quality Intent, including one or more hard constraints with a proof for each brief hard constraint. Code stamps `from_brief` with the brief constraint's key and checks coverage with `BRIEF_CONSTRAINT_UNCOVERED`. Creation is allowed once per brief constraint key; afterwards only a human may change or delete that constraint. The Director may always add constraints. Whether a derived constraint and its proof capture the brief is a model judgement that code cannot verify, so it is ASSUMED: every deliverable record prints each brief constraint beside its derived constraint and proof, and the golden briefs' expected constraints are compared at M6.
- **Promotion needs structural validity and authority only.** Only `project_promote` moves the accepted head, by compare-and-swap, and only for a grant with `may_promote` (the Director's). It requires no clean compile, passing check or review. A corrective failure makes an artifact unusable where valid input is needed, so a `frozen` compile of it reports `NOT_READY`; it does not block promotion.
- **Merge, then revalidate.** When the head has moved, promotion returns `STALE_BASE` and the Director calls `project_merge`. Project Core writes the merged candidate with its `revalidate` set. The tool handler then compiles the candidate inline in `plan` mode and requests the checks on that set as jobs. The compilation record and the check results attach to the candidate. Promotion does not wait for the checks; delivery requires them.
- **Delivery is the gate.** `delivery_finalize` requires every hard check on the exported file to pass (C9). A blocked or incomplete export still gets a deliverable record, with `completion_state` `blocked` or `incomplete`; what the harness must never do is report it as a successful delivery.
- **Jobs.** A session may cancel only jobs in its own tree; the Director may cancel any. `job_retry` and `artifact_quarantine` are Director tools.

Prompts describe these rules to save turns. Nothing depends on the model following them.

### D11. Audit logging

Append-only tables in the Space database, with large bodies in the blob store:

- **`session`**: role, model, prompt-template hash, tool-list hash, segment number, parent job, grant.
- **`message`**: sequence number, role, content exactly as sent or received, usage, stop reason, provider request ID, latency, cost.
- **`model_call`**: the `model.call` job and its intent, and the sequence range that formed the request. A request is always a prefix of the history, so bodies are not duplicated.
- **`tool_call`**: tool-use ID, raw input, normalisations applied, validation result, error code or result reference, work key and job, duration.

Decisions (promotion, delivery, cancellation, how each finding was settled) are `decision` entities in Project Core, linked to the model call that issued them. Prompt templates are versioned files identified by hash.

**Retention.** The log keeps everything by default (`audit.retention_days`), and `audit.max_gb` caps the stored bodies. At the cap the harness alerts through the CLI and releases its references to the oldest bodies of ended sessions; rows, hashes, usage and decisions stay. A body that nothing else references then follows R5's retention tiers.

### D12. External interfaces

- **Now: a CLI.** Illustrative commands: `cutroom new`, `run`, `say`, `status`, `events --follow`, `pause`, `stop`, `lock`, `export`, `audit`. `say` delivers a steering message as an event at the next turn boundary. A second invocation reaches the running Space process over a Unix domain socket in the Space directory. The CLI's own codes are `SPACE_IN_USE` (the Space is already served, which also reports R5's single-instance refusal) and `SOCKET_PATH_TOO_LONG` (decided: `lld/11` section 18, A:M0-4). When each command that no milestone names is built is left to the implementer, as `lld/11` section 18 leaves implementation details.
- **`cutroom new`** runs Project Core's `genesis(project, brief)` through the human path, with the `brief` lock. It also creates the primary `delivery_profile` from the profile defaults, copying `delivery.audio.*` as K1 requires, through the human path as well, because the profile's `ai_disclosure` and audio thresholds are `human` fields, which a Director patch may not write in `create` as in `update`. It appends the event that R10 §3.3's measures call "brief accepted". It creates no Quality Intent (the Director's, G19) and no `decision` (decided: `lld/11` section 18, C:M4-O10a).
- **One `ControlApi` behind it,** whose operations are the tool catalogue plus session control. HTTP and MCP can be added later as adapters over it, with an `external` role grant.
- Human edits use the same patch operations as agent edits (roadmap §4).

### D13. MiniMax specifics not covered above

- **Moderation** is undocumented for this endpoint and unmeasured. The OpenAI-compatible endpoint returns `input_sensitive` or `output_sensitive` with an empty reply, and codes 1026 and 1027 exist. The adapter treats those flags and codes as an identified refusal (section 4).
- **Streaming** is always on. Documented deltas are text, thinking and signature, and failures arrive as an `error` event (D7). Streamed tool input is unmeasured; a tool call runs only once its block is complete.
- **`pause_turn`** is a stop reason beside `end_turn`, `max_tokens` and `tool_use`. The loop resends with the content appended unchanged.
- **Media limits** (images ≤ 10 MB, video ≤ 50 MB inline at 0.2–5 fps, request ≤ 64 MB) are enforced by the bundle builder.
- **Video input** (batch 2c). `fps` must sit inside `source`, where the bundle builder always sets it; elsewhere it is silently ignored. The default sampling is 2 frames per second. A sampled frame costs 173 tokens at 540 × 960.

Sources: [API reference](https://platform.minimax.io/docs/api-reference/text-chat-anthropic), [SDK page](https://platform.minimax.io/docs/api-reference/text-anthropic-api.md), [OpenAI-compatible reference](https://platform.minimax.io/docs/api-reference/text-chat-openai.md).

## 3 Interfaces to other stages

| Stage | What R6 needs from it | What R6 gives it |
|---|---|---|
| **R2** rendering | The validation ladder as a function returning rule IDs, exact messages and source lines; the control response check; contact-sheet and event-strip builders over `still.render`; the clip builder | The component-author loop and its `author.*` limits |
| **R3** project model | Zod schemas; views; a kind's field list and example for `project_schema`; the patch envelope; `merge` with a `revalidate` set; `promote`; `impact`; experience records; `trust` on entities and fenced views; the `treatment` kind; grants and per-field write levels checked at apply time | Tool wrappers; a grant on every call; the page cap |
| **R4** compiler | `compile`, `plan_diff(a, b)` and `timing_explain(compilation_id, select?)`, called inline; a compilation record; typed diagnostics | Diagnostics relayed unchanged |
| **R5** scheduler | `request`; the `event` table; the `model.call` and `subloop.run` capabilities; the limiter, ledger and intent reconciler; `plan_to_jobs`; `CancelOutcome`; `retry` and `quarantine`; the `Predicate` schema | Executors for both capabilities; cost estimates; the failure kind of D7 |
| **R7** studio | Manifests for the Studio tools named in D4; the performance bundle and `acting.*` rules; the fetch transport and its error codes; a `SearchProvider` | Plugin API, handoff type, the researcher and performance-author loops |
| **R9** quality | Bundle builder with dense still strips; finding schema; the Diagnostic Evidence Bundle; check IDs; review rule T9; `review.*` and `revision.*` limits, including `review.hard_proof_votes` | Served-evidence log for coverage; Reviewer runtime, with one fresh sub-loop per hard-proof vote; `reviewer.*` settings |

## 4 Failure handling

The harness classifies; the Scheduler retries, with R5's `retry.transient_max` (3, or 4 for HTTP 529).

| Failure | Kind and class (R1 §4.3) | Handling |
|---|---|---|
| Connection refused; HTTP 429, any 5xx, or 529 | Definitely unsent; `transient` | The Scheduler retries and slows the limiter |
| An explicit provider `error` event before any content | Outcome known; `transient` | As above |
| Any HTTP 4xx not named in another row (400, 413 and the rest) | Definitely unsent; `deterministic` | No retry; the session fails with a diagnostic |
| HTTP 401, 403, insufficient balance (1008) | Definitely unsent; `policy` | Stop all model work; alert through the CLI |
| A missing or retired model (HTTP 404; "model no longer available", 2069) | Definitely unsent; `capability` | Fall back per the routing table at a segment boundary; alert |
| Timeout; a reset or a stream `error` event after response bytes began; process crash | Ambiguous; the job is `unknown_outcome`, a state and not a class | R5's reconciler adopts a complete spooled response. Otherwise it books the call as presumed charged and resends once within `unknown.resend_max` and `budget.duplicate_spend_usd`; failing that, the job fails with class `policy` and the Director is woken. Partial output is never added to history |
| An identified moderation refusal | `policy` | No retry and no rephrasing. A sub-loop ends `failed` and the Director is told; if the Director's own turn is refused, the session is `blocked` and the CLI alerts |
| An empty reply with no moderation signal | `transient` | Retried once by the Scheduler, as a per-error limit beside `retry.transient_max`. If it is empty again, the harness sends one nudge (a new call), then fails the session with `EMPTY_RESPONSE` |
| A sub-loop exceeds its budget or turns | `policy` | It ends with partial work and evidence preserved |

**HLD B4 and C11 cases:**

- **Stale worker completion.** Project Core compares the worker's read set with the current head. The Director's notice says whether the result is still valid; nothing is promoted automatically.
- **Disjoint edits that conflict semantically.** `project_merge` succeeds with a `revalidate` set; the compile and checks that follow name both entities.
- **Provisional bound changes.** A `commitment_superseded` event wakes the Director with the affected consumers.
- **Corrected fact.** The research proposal becomes a patch; its impact summary lists dependents by kind, and the Director issues targeted work.
- **Failed experiment.** Branches and evidence remain; the accepted head never moved.
- **Known defect kept in a preview.** Findings stay as evidence; carrying the defect is a `decision` entity.
- **Crash after a paid call.** The reconciler settles the `unknown_outcome` job, and a repeated tool call joins the existing job by work key. The guarantee is at most one bounded duplicate per job, not "nothing is paid twice".
- **Final MP4 without audio.** The mux job succeeds and returns its file; R9's hard checks F-01 and F-02 fail it, and the Quality System quarantines the result, which permits one re-run (decision FR9). An export that still fails gets a deliverable record with `completion_state` `blocked`, and the harness never reports it as delivered.
- **Cross-layer effect needing grouped execution.** A compiler decision; the harness relays diagnostics.

## 5 Named settings and defaults

**Owned by R6.** All are starting defaults.

Override authority and ranges follow the shared rule in R3 section 2.7 (G15); settings requiring `human` authority are marked below.

| Setting | Default |
|---|---|
| `context.compact_at_tokens` / `context.hard_max_tokens` | 180,000 / 400,000 |
| `tool.result_max_tokens` | 2,000; `project_read` 4,000; `web_fetch` 8,000 |
| `tool.repair_attempts_max` / `tool.repair_hard_stop` | 3 / 2 |
| `director.event_coalesce_ms` | 5,000 |
| `director.stall_nudges_max` | 2 |
| `director.images_per_run_max` | 6 |
| `director.max_output_tokens` | 16,000 |
| `director.budget_wake_fractions` | 0.5, 0.8, 0.95 |
| `subloop.max_depth` / `subloop.submit_nudges_max` | 2 / 2 |
| `subloop.max_output_tokens` (roles without their own cap) | 8,000 |
| `subloop.max_concurrent` (authors / reviewers / researchers / experiments / treatments) | 6 / 3 / 2 / 1 / 1 |
| `author.candidates` | 1 |
| `author.repair_attempts_max` | 3, on Flash |
| `author.escalation_attempts` | 1, on MiniMax-M3 |
| `author.visual_repair_rounds` | 1 |
| `author.max_output_tokens` | 32,000 |
| `reviewer.thinking` (shot / film) | adaptive / adaptive |
| `reviewer.max_output_tokens` (shot / film) | 16,000 / 24,000 |
| `reviewer.retry_output_factor` | 2 |
| `treatment.candidates` / `treatment.animatic_candidates` | 3 / 2 |
| `treatment.budget_fraction` | 0.2 of R5's `budget.soft_target_usd`; crossing it notifies the Director and does not stop the phase |
| `audit.retention_days` / `audit.max_gb` | keep all / 5 (both `human`: they decide how long stored data is kept, class (f), K5) |

`tool.result_max_tokens`, `subloop.max_concurrent`, `reviewer.thinking` and `reviewer.max_output_tokens` are each one setting with a keyed value: this table fixes the keys (`default`, `project_read` and `web_fetch`; `authors`, `reviewers`, `researchers`, `experiments` and `treatments`; `shot` and `film`), each key has its own type and range, and a patch may set one key, for example `settings.tool.result_max_tokens.project_read`. `audit.retention_days` takes a number of days or the value `keep_all`, its default (decided: `lld/11` section 18, A:M0-3).

**Referenced, owned elsewhere.** R5: `llm.limit_fraction` (0.6), `llm.max_concurrent` (8, one global cap across all models), `llm.start_concurrent`, `retry.transient_max`, `unknown.resend_max` (1 per job), `budget.duplicate_spend_usd` (0.50 per film), `budget.delivery_reserve_usd` (0.50). R7: `acting.repair_attempts`. R9: `review.*` (including `review.hard_proof_votes`, 3), `revision.*`. The draft's `llm.rpm_ceiling`, `llm.tpm_ceiling`, `llm.max_concurrent_requests`, `llm.retry_max`, `budget.wrapup_reserve_usd`, `budget.thresholds` and `fetch.max_text_tokens` no longer exist.

## 6 Cross-domain check

| Domain | What the harness must handle | How |
|---|---|---|
| Historical comedy | Acting iterations; pose switch versus control track | Performance-author loop with event strips; Experiment Agent with blind labels |
| Science documentary | Web research; wrong-footage correction | Researcher quarantine and quote check; the impact summary drives targeted rework |
| Art history | Authentic artwork; crop change | A patch, then events for affected annotations. Rights text from web pages is untrusted data |
| Software tutorial | Capture tools; a UI revision invalidates steps | `capture_run` is an R7 plugin tool; no core change |
| Data reel | A figure changes | `research_request` or a steering message yields a claim patch; Project Core lists dependents |
| Abstract motion graphics | No characters, no research | The Director does not call those tools; no role is mandatory |

## 7 Decisions that differ from the first working draft

The lead accepted all three; the binding record is the [integration decisions](11-integration-decisions.md).

1. **The two author workers have no model-called tools** (D6.2, D6.3). The draft made every worker a sub-loop with a restricted tool set.
2. **The Director does not hold search or fetch** (D6.6). The draft listed them among its tools.
3. **Provider neutrality stops at the `ModelClient` boundary and at segment boundaries** (D7), because reasoning signatures must go back unchanged to the model that produced them.

## 8 Claims table

| Claim | Label | Evidence or consequence |
|---|---|---|
| `tool_choice` accepts only `auto`; `cache_control` is unsupported; assistant content, thinking included, must be replayed with its signature | VERIFIED by source | [API reference](https://platform.minimax.io/docs/api-reference/text-chat-anthropic); [tool-use guide](https://platform.minimax.io/docs/guides/text-m3-function-call.md) |
| Caching is automatic; an append-only history with tool results keeps hitting it; `input_tokens` excludes cached tokens | VERIFIED by spike | S5: about 99% of input cached from the second turn |
| The cache lives between 25 and 32 idle minutes | VERIFIED by spike | S5, one sample per pause |
| The cache also hits with images and thinking blocks in the history | ASSUMED | S5 held tool results only, thinking off. If wrong, those turns cost up to five times more input; lower `context.compact_at_tokens`. `R6-S11` |
| M3 rates double above 512K input tokens | VERIFIED by source | [Pricing](https://platform.minimax.io/docs/pricing/overview.md); whole-request or marginal is not stated |
| Several tool calls arrive in one reply, and tool input is schema-valid often enough for in-band repair to converge | VERIFIED by spike, for fully typed schemas only | S5: 31 of 32 trials; 99.0% valid; 4 of 4 natural invalid calls repaired. The 99% does not carry over to untyped values (J4, next row) |
| The MiniMax endpoint damages tool-argument values that the schema leaves untyped; one string of JSON text avoids the damage | VERIFIED by spike | Batch 3: 31% to 59% of structured patch calls damaged; 0 of 312 with JSON text, at a 1.9% rate of JSON syntax errors. Measured on one day on one endpoint, so the transport conformance test re-checks every tool at M4 and at each model pin change (D7, `R6-S11`) |
| Patch calls on a full-size project are valid often enough for repair to converge | VERIFIED by spike (batch 3), with JSON-text transport | 184-entity synthetic project, tasks that mostly name their handles: 88% of first patches valid, 98% within two repairs (R3's `R3-K2`). With structured arguments, a restart session stalled on five rejected patches in a row |
| Sub-loops end with a schema-valid `submit_*` call without a forced tool choice | VERIFIED by spike | Batch 2c, short loops: 26 of 30 unaided on M3 and 25 of 30 on Flash; one exact-error retry fixed 4 of 4 and 4 of 5; none ended in plain text. The text fallback stays. `R6-S8` is closed |
| MiniMax accepts `anthropic-version: 2026-10-21`; moderation surfaces as a sensitivity flag or codes 1026 and 1027; streamed tool input can be assembled | ASSUMED | If wrong: override the header or use `fetch`; change the adapter's detector; request tool turns without streaming. `R6-S11` |
| Framework facts in D1, including that `@anthropic-ai/sdk` passes unknown blocks through | VERIFIED by source | Links in D1 |
| The Commercial Terms neither permit nor forbid non-Anthropic models expressly | ASSUMED (the draft author's reading) | Not on the critical path |
| A component is reliably extractable from plain text; validate and repair converges within `author.repair_attempts_max` | VERIFIED by spike | S2: 30 of 30. S3: 80 of 80 extracted; 90%, 96%, 100% passing after zero, one and two repairs (only 8 failures) |
| Search/replace repair is as effective as a whole-document rewrite | VERIFIED by spike | S3: 5 of 8 each in one round, at one sixth of the output tokens |
| Escalating to M3 helps once Flash attempts are used up | ASSUMED | S3 never reached that round. If wrong, set `author.escalation_attempts` to 0 |
| M3 writes valid control tracks; acting shows only in dense frames around events | VERIFIED by spike | S6: 3 of 3 tracks; visible at 120 ms spacing, not in 12 even frames |
| The Reviewer measurements in D7; with thinking on, M3 can use its whole output limit without answering | VERIFIED by spike | Batch 2c: two passes with thinking off, one adaptive; no answer in 7 of 16 inspection runs at 8,000 tokens. `R6-S7` is closed |
| A dense still strip finds a single-frame defect and a real-time clip does not; false alarms are common in every form | VERIFIED by spike | Batch 2c, synthetic clips: exact frame in 22 of 24 strips, 38 of 48 slowed clips, 0 of 24 real-time clips; false alarms in 4 of 8, 5 of 16 and 7 of 8 clean runs |
| The video input facts of D13 | VERIFIED by spike | Batch 2c: the token-count endpoint and `usage` |
| The published limits (200 requests, 10M tokens per minute per model) apply to a pay-as-you-go key | ASSUMED | [Rate limits](https://platform.minimax.io/docs/guides/rate-limits.md). The subscription key returned 429 near 10 concurrent requests (S5). If wrong, keep `llm.max_concurrent` at 8 or lower |
| The researcher's defences hold | ASSUMED | The Director is quarantined in any case. `R6-S9` |
| A new segment loses no working state | VERIFIED by spike (batch 3), at small scale only | 9 of 9 restart runs over 3 sessions repeated, skipped and contradicted nothing and used every handle correctly, at 13,000 to 17,000 tokens of context. Without working notes a half-finished step led to rework and a wrongly reasoned waiver in 2 of 2 runs, so the notes are required (D3, J8). `R6-S10` |
| The working notes stay good when written from a context of 150,000 tokens or more, and in open-ended work | ASSUMED | Measured on the first long real session at M6 by comparing a restarted run with a non-restarted one. If wrong, raise the restart threshold, which MiniMax's one-million-token context allows (J9) |

## 9 Spikes wanted

S5 answered the draft's questions about tool-call validity (for fully typed schemas), parallel calls, cache hits with tool results, cache lifetime and how invalid tool input surfaces; those are dropped. Batch 2c closed `R6-S7` (Reviewer accuracy) and `R6-S8` (structured submission). Batch 3 verified `R6-S10` at small scale. The rest carry this stage's prefix; the unified register is in R10.

| ID | Claim | Method |
|---|---|---|
| `R6-S9` | Researcher injection resistance | Serve ten local pages with planted instructions; count changed tool calls, blocked fetches and tainted claims that pass the quote check. Cap $1 |
| `R6-S10` | Segment restart fidelity; tool-call validity over a long session | VERIFIED by spike (batch 3) at small scale (section 8). Behaviour when the notes are written from a context of 150,000 tokens or more, and in open-ended work, is ASSUMED: it is measured on the first long real session at M6 by comparing a restarted run with a non-restarted one, and the fallback is a higher restart threshold (J9) |
| `R6-S11` | Transport facts S5 left open: the `2026-10-21` header through SDK 1.x; cache hits with images and thinking blocks; the effect of dropping old thinking blocks; how moderation surfaces; streamed tool input; and the transport conformance test of every tool's arguments (D7, J4) | Scripted conversations against both models; record `usage` and raw events. Cap $1. The conformance test runs at M4 and again whenever a model version pin changes |

## 10 Decisions for the user

1. **A pay-as-you-go MiniMax key for production.** The spike key is on a MiniMax subscription plan. It returned HTTP 429 near 10 concurrent requests, and its billing may differ from list prices (S5). `llm.max_concurrent` = 8 works with it in development. Production needs a pay-as-you-go key so that the published per-model limits and list prices apply. Obtaining the key is a user action. **Decided by the user on 15 November 2026 (U11, [integration decisions](11-integration-decisions.md) section 17.1):** the current MiniMax key is kept, with at most 8 model requests in flight (`llm.max_concurrent` = 8). Because only the user can read the plan's usage page, the session asks the user once, at M4, for the plan's usage figure before and after the `R5-2` billing probe; if the user does not supply it, the billing half of `R5-2` is recorded `UNKNOWN` and the build continues (decided: `lld/11` section 18, L17).
