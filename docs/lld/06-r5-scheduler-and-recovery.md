# Cutroom v2 — LLD · R5: Scheduler, Artifact Futures, Cache and Recovery

**Decided:** 14 November 2026
**Status:** DECIDED by the lead session under the user's delegation of 14 Nov 2026. The design set was frozen on 15 November 2026 ([R10](10-r10-integration-acceptance-and-build-plan.md) section 6.4); this document may be revised during implementation.
**Baseline:** HLD [B2](../hld/02-phase-b-production-lifecycle-and-autonomous-quality.md), [C0, C4, C10, C11](../hld/03-phase-c-integration-contracts.md) · [R1 foundations](02-r1-foundations.md) · [integration decisions](11-integration-decisions.md), cited below as "decision" with an identifier · [spike log](../research/10-spike-evidence-log.md) · spike evidence [S4](../research/evidence/s4-render-host.md), [S3, S5, S6](../research/evidence/s3-s5-s6-minimax.md), [S7](../research/evidence/s7-pixi-hardening-follow.md) and [batch 2b](../research/evidence/b2b-sqlite-node.md) · [provider research](../research/11-provider-cost-and-audio-research.md)
**Web sources** were fetched on 14 November 2026 and are cited in section 8. Field names, SQL and TypeScript are illustrative; exact schemas belong to R3.

## 1. Problem and scope

The Scheduler owns job state, retries and resource allocation (C0 invariant 2, C4). It must let work overlap, reuse earlier results, survive a crash at any instant, and never pay a provider twice without knowing it. It runs inside the one Node process per Space, on Node 26 LTS (decision C5). A **Space** is the directory that holds one production.

Out of scope: render job content (R2, R4), storage (R3), the Director loop (R6), audio providers (R7) and verdicts (R9).

Terms:

- A **capability** is a named, versioned kind of work (2.5).
- A **job** is one requested piece of work, identified by its work key (R1 §2.4). An **attempt** is one execution of it.
- A **consumer** is whatever asked for a job: a Render Plan, a tool call, a check or a sub-loop. A **future** is its handle on the job.
- An **intent** is a durable record written before a paid external call.
- A **render unit** is a shot or a transition as the compiler emits it. A **chunk** is a frame range of one render unit.
- A **`pin_hash`** is an entity version's hash with `commitment.readiness` removed (R1 Revision 1).

## 2. Decisions

### 2.1 Workflow engine: none; a thin scheduler over SQLite

**Problem.** Jobs must be durable and recoverable. Would an existing engine do this better than our own tables?

**Options.** Temporal, Restate, DBOS Transact, Inngest and BullMQ each need a separate server or database (section 8). SQLite queue libraries need nothing external but offer only a queue with retries.

**Choice.** No external engine and no queue library. The Scheduler is a module over tables in the Space's SQLite database.

1. Completing a job must record the result, the ledger entry and the event in one transaction. An engine with its own store would be a second authority for job state, against C0 invariant 2.
2. No engine solves the paid-call problem: they retry attempts and rely on an idempotent provider, which MiniMax is not (2.6). The queue libraries also lack work-key deduplication, range futures, `unknown_outcome`, budgets and pools.

**SQLite behaviour this relies on.**

- **Mode.** Write-ahead log (WAL): readers and the one writer do not block each other. WAL "does not work over a network filesystem", so a Space lives on the Linux filesystem, never under `/mnt/c` (decision C6). A database there raised no error in batch 2b, so start-up reads the mount type and refuses a `9p` mount. Exports are copied out on delivery.
- **Power loss.** R3's `db.synchronous` defaults to `NORMAL`, under which a commit "might roll back following a power loss"; `FULL` stalled the main thread for up to about 190 ms under load. A commit that holds a promotion, a paid-call intent or confirmation, or a deliverable record runs with `FULL`, because a lost intent record could hide a paid call. That `FULL` survives power loss on the deployment disk, and that rollback works inside a grouped commit, are ASSUMED (decision H12, section 8). At build milestone M3 the build tests rollback inside a grouped commit and runs an abrupt-stop drill: WSL is terminated from the Windows side while a write load runs, and the database is checked on restart. That result is labelled "abrupt VM stop", not power loss; true power loss on a deployment disk stays ASSUMED until M11, when a VM exists (decided: `lld/11` section 18, L1).
- **Process death.** 400 kills lost no acknowledged commit, but about 9 in 10 left one committed transaction unacknowledged. **Every caller must therefore be able to repeat a request.** Work keys (2.3) and R3's patch keys make that safe.
- **Write path.** One writer connection on the main thread groups transitions into one transaction per `db.commit_tick_ms` (20); ungrouped commits fell behind at 50 writes per second. Project Core owns this grouped writer (R3 §2.6), and the Scheduler's writer wraps it with the instance fence and the dispatch of events after commit. A transaction that must commit with `FULL` closes any open `NORMAL` group and commits in its own group at `FULL`; this rule holds whether or not SQLite allows the level to change inside a transaction (decided: `lld/11` section 18, L2). Promises resolve and events fire only after the commit. A writer worker thread is a later option.
- **Version.** SQLite before 3.51.3 has a rare WAL corruption race between two writing connections, so start-up requires 3.51.3 or later and other processes open the database read-only. The driver is `node:sqlite`, verified on Node 26.13.1 (SQLite 3.54.1), with `better-sqlite3` as the fallback behind R3's storage adapter.
- **Single instance.** A `scheduler_instance` row holds a fresh instance ID and a heartbeat. A second process refuses to start while the first is alive, and every state change is conditional on the instance ID. The row also records the owner's PID, its start time from `/proc/<pid>/stat` and the boot ID. A predecessor is alive exactly when a process with that PID and that start time exists under the same boot ID, so a restart straight after a kill is allowed; the heartbeat is an observation only (decided: `lld/11` section 18, B:M3-4). The refusal is reported as the CLI's `SPACE_IN_USE` (R6 D12) (decided: `lld/11` section 18, A:M0-4).

### 2.2 Job tables and state machine

**Tables (illustrative).** `job` has one row per work key, ever: `id`, `work_key` (unique), `kind` (`leaf` or `group`), `capability`, `effect_class`, `cost_tier`, `input_manifest` (an ArtifactRef to the pinned inputs, parameters and environment), `requires`, `state`, `failure_class`, `result_ref`, `diagnostic_ref`, `quarantined_at`, `paying_scope`, `correlation_id` and `causal_parent`.

`job_consumer` has one row per job and consumer: `consumer_id`, `consumer_kind`, `state` (`active` or `released`), `revision_id`, `plan_id`, `branch`, `purpose`, `priority_class`, `budget_scope`, `requires` and `order_hint`. The other tables are `job_dep`, `job_child` (ordered group members), `job_attempt` (lease owner, heartbeat, timings, failure class, diagnostic), `job_range`, `external_intent`, `budget_scope`, `ledger_entry` and `event`. R3's table of past experience is `experience`. The `event` table is created by Project Core's migrations, with the columns in 2.4, because every module that appends events (Project Core in the promotion, the Scheduler, Quality) imports project-core; R5 keeps the table's meaning and event types and adds subscription and the cursor (decided: `lld/11` section 18, B:SD3). R3's `evidence` table and `closure_hash` are built in project-core at M3, before the check runner writes records (decided: `lld/11` section 18, L5).

**A work key identifies reusable execution inputs only.** It contains no revision, plan, branch, entity ID, purpose, priority or budget; that provenance sits on `job_consumer`. Two revisions that need the same work share one job, and a job's view for a consumer reports that consumer's revision and plan, as C4 requires.

A **group job** has no attempt; its state is derived from its children. A render unit's group has its chunk jobs as children; a plan's group has all the plan's jobs. A group's work key is the hash of its kind and its ordered child work keys.

**States** are the R1 §4.3 set. `declared` means not yet admitted: the budget is not reserved, or the speculation policy holds the job. `waiting` means a prerequisite job or readiness fact is unmet. `ready` means queued for a pool, a limiter or a back-off timer. `partial` applies to groups only, because no leaf capability publishes partial output. `unknown_outcome` is a state, never a failure class.

**Transitions.** Only the Scheduler writes job rows.

| From → to | Trigger |
|---|---|
| new → `declared` | `request()` from a tool handler, Quality, the harness or a worker within its scope |
| `declared` → `waiting` or `ready`; or `failed` (`policy`) | Admission passes; or budget or policy refuses |
| `waiting` → `ready`; or `failed` or `superseded` | Predicates hold; or a prerequisite job failed or a prerequisite commitment was superseded |
| `ready` → `running` → `succeeded` | Pools and limiters grant; then a fenced completion (2.5) with every result blob stored |
| group → `partial` → `succeeded` | One child, then all children, succeeded |
| `running` → `ready` or `failed` | A failure, under its class's retry rule (2.7) |
| `running` → `unknown_outcome` → `succeeded`, `ready` or `failed` | The attempt ended with a sent, unresolved intent; then only the reconciler acts |
| non-terminal → `cancelled` or `superseded` | A cancel, once any running attempt has stopped without a result; or no active consumer remains |
| ended, not `succeeded` → `declared` | A new request for the same work key, unless it is a remembered `deterministic` failure; or the Director's `job_retry` |

### 2.3 Deduplication, cache and the dependency index

**Choice.** `job.work_key` is unique, and `request()` is get-or-create. A live job is joined. A succeeded job whose result blobs still exist is a cache hit. A job that failed as `deterministic` returns its stored diagnostic, so a known failure is not repeated (B1.4). The cache "work key → ArtifactRef" is therefore `job.work_key` → `job.result_ref`, not a separate table.

**Why no invalidation step.** The work key hashes the capability version, every pinned input hash, the parameters and the environment hash (R1 §2.4). A changed script line, component, font set or Chrome build gives a different key, so the old entry is never looked up. A chunk's key also contains the hash of the settings bundle for the plan's **rung**, which is its output fidelity level (R2).

**Three additions.**

1. **Variant index.** Model calls and most audio engines are not deterministic. Their parameters include a variant index, so the same sample deduplicates and another candidate is new work.
2. **Quarantine.** Hashing does not catch a faulty result such as a truncated file or an export without audio. The Quality System or the Director may quarantine a result with evidence (`artifact_quarantine`); the key stops resolving and one re-run is allowed. A second quarantine, after that re-run, turns the job into a remembered `deterministic` failure whose diagnostic is the quarantine evidence: an identical request returns that diagnostic with no attempt, and only `job_retry` runs it again (decided: `lld/11` section 18, B:M3-6).
3. **Readiness is not hashed.** Jobs and consumers pin a commitment by its `pin_hash` (decision I18), never by the full version hash. Freezing an unchanged provisional commitment therefore changes no work key.

**What the dependency index is still needed for.** A component written against layout v3 has the same bytes after layout v4 is published, so its render is a valid cache hit, yet it may now overlap the volcano. Provenance records the `pin_hash` of each commitment a component was authored against, and Project Core indexes these, so "which components assumed the superseded version" is a query. The index also says which reviews to redo and gives the rebuild set before a patch (C8).

### 2.4 Futures, plan submission, readiness predicates and events

**Interface seen by other modules (illustrative).** `request(spec, consumer)` is get-or-create by work key and returns a future. The other calls are `view`, `until`, `release`, `cancel`, `retry`, `quarantine`, `subscribe`, `budget` and `blob_roots`.

```ts
type Need = { kind: 'complete' } | { kind: 'range'; start_frame: number; end_frame: number };
type CancelOutcome = { consumers_released: string[]; jobs: { job_id: JobId; outcome:
  'cancelled' | 'stop_pending' | 'shared_continuing' | 'completed_before_cancel' }[] };
```

**Operations exposed to tools.** The call is `request` everywhere. `job_status` maps to `view`, `job_cancel` to `cancel`, `budget_status` to `budget`, `job_retry` to `retry` (Director only) and `artifact_quarantine` to `quarantine` (the Director as a tool; the Quality System calls the operation directly). A session may view and cancel only jobs in its own tree; the Director may act on any.

**From a Render Plan to jobs.** The compiler is pure and starts no job. `compile` is not a capability: it runs inline in the tool handler (decision F9). After `project_merge` the handler compiles in `plan` mode and requests the revalidate set's checks as jobs. A plan carries an `execution` part: nodes for bake, chunk, still, `audio.mix`, `film.concat` and `film.mux`, each with a work key, plus dependency edges. `plan_to_jobs(plan, purpose)` is a deterministic adapter owned by R5 and called by the `render_request` and `delivery_finalize` tool handlers. `purpose` is `preview`, `review` or `delivery`. It returns:

- one leaf specification per execution node, with the node's capability, work key, inputs and `requires` predicates;
- one `job_dep` row and one completion predicate per `depends_on` edge;
- one group per render unit over its chunks, and one group for the whole plan;
- one consumer for the plan, with `revision_id`, `plan_id`, branch, `purpose`, a priority class (2.11), and predicates built from the plan's pinned commitments.

For `delivery` the adapter refuses a plan unless its rung and its grade (input readiness, R4) are both `final` and every pinned commitment is `frozen`; the handler returns `NOT_READY`. The handler then adds the `check.run` and review jobs that depend on `film.mux`. A handler that replaces a plan requests the new one before releasing the old plan's consumer.

**Futures.**

- **Durability.** A future is a job row plus an in-process promise. Promises do not survive a restart; consumers keep job IDs and call `view()` again.
- **Chunk results.** `chunk.render` is atomic and always produces a segment. Its result is one record, `{segment, frames, fps, probe_sidecar, rung, diagnostic}`: an encoded H.264 segment with a closed group of pictures, plus a probe sidecar (decision I10). Both blobs are stored before the fenced completion. Final assembly joins segments by stream copy, with no second video encode.
- **Diagnostic captures.** `film.concat` and `film.mux` reject a segment whose `diagnostic` is true, with `DIAGNOSTIC_IN_DELIVERY`.
- **Mux result.** `film.mux` succeeds whenever FFmpeg exits cleanly and always returns its file. It does not judge that file; R9's hard checks F-01 and F-02 do (decision FR9, section 4).
- **Stills.** `still.render` has its own work key: a frame list in, image artifacts and probe records out.
- **Ranges.** A group job exposes the ranges of its finished children. `job_range(group_job_id, start_frame, end_frame, child_job_id)` records half-open frame intervals: unit-local frames on a render unit's group, film frames on a plan's group. Coverage is exact, never a percentage.

**Readiness predicates.** A consumer states what it needs as a condition over the R1 §4.2 facts. R5 owns the one typed schema, which names each fact and its authority; free-text readiness strings are not accepted. The `Predicate` and `Need` types are declared in `packages/foundations`, which every module that uses them already imports, and R5 keeps their meaning; the `ReadinessOracle` interface stays in the Scheduler (decided: `lld/11` section 18, B:SD1).

```ts
type Predicate =
  | { fact: 'completion'; authority: 'scheduler'; work_key: Hash; need: Need }
  | { fact: 'validation'; authority: 'quality'; check: string; verdict: 'PASS';
      subject: { result_of: Hash } | { artifact: ArtifactRef } }
  | { fact: 'acceptance'; authority: 'project_core'; entity_id: EntityId; revision_id: RevId }
  | { fact: 'commitment'; authority: 'project_core'; entity_id: EntityId; pin_hash: Hash;
      min_readiness: 'provisional' | 'frozen' }                        // R1 §4.1
  | { fact: 'delivery_eligibility'; authority: 'deliverable'; deliverable_id: string }
  | { all: Predicate[] } | { any: Predicate[] };
```

- The Scheduler answers `completion`. A `ReadinessOracle` implemented by Project Core and the Quality System answers the rest; waiting jobs are re-evaluated when those owners emit events.
- `completion` and `validation` predicates are stored on the job. The other three concern a revision and are stored on the consumer. A job leaves `waiting` when its own predicates hold and those of at least one active consumer hold.

**Events.** `event(seq, ts, type, job_id, consumer_id, scope, payload)` is append-only, and `seq` is a total order because there is one writer. Other modules append events in their own transactions; Project Core writes the head-accepted event, whose `type` is `head_accepted`, inside the promotion transaction (decided: `lld/11` section 18, L44). Subscribers are called after commit and replay from a cursor after a restart, so delivery is at-least-once and handlers re-read state (C10). The Director's wake-ups are a filtered subset of these events (R6).

### 2.5 Leases, restart recovery, effect classes and the capability catalogue

**Choice.** Instance fencing plus an in-process stall watchdog, not time-based lease expiry. One process owns the Space, so an attempt owned by another instance ID is dead by definition.

- **Heartbeat.** Workers report progress (frames captured, stream bytes, FFmpeg progress lines). The watchdog marks an attempt stalled after its `stall.*` timeout. Heartbeats reach the table every `lease.flush_s`.
- **Fencing.** Completion is `UPDATE … WHERE attempt = ? AND ended_at IS NULL AND lease_owner = ?`. Zero rows changed means a stale report, which is dropped.

**Restart.** Child processes run in process groups recorded on the attempt. How a browser reused across attempts has its group recorded is left to the implementer, as `lld/11` section 18 leaves implementation details; `R5-5` fixes the result, no live orphan group. On restart the Scheduler kills the groups left by the old instance, ends its attempts, moves each affected job to `ready` (nothing sent), `unknown_outcome` (unresolved sent intent) or `failed` (an `external_interactive` attempt that may not be repeated), runs the reconciler and re-evaluates waiting jobs.

**Effect classes** say what repeating an attempt can do to the outside world.

| Class | After a crash |
|---|---|
| `pure` | Repeat freely. Output is written to a temporary file and renamed into the blob store, so half-written output is never visible |
| `external_read` | Repeat with bounds; the fetched hash is recorded |
| `external_interactive` | Clicks and types on real sites. Never repeated automatically unless its script declares itself repeat-safe; otherwise the job ends `failed` (`policy`), and only a new request or `job_retry` runs it again (decision F15) |
| `paid` | Never repeated without reconciliation (2.6) |
| `paid_stateful` | An asynchronous provider task; reconcile by task ID |

**Capability catalogue.** This is the one list; `compile` is not in it (2.4). R2 owns the component, chunk, still, media and film capabilities; R7 owns audio, transcription, fetch and capture; R9 owns `check.run`; R6 owns `model.call` and `subloop.run`. Each owner supplies the executor, the resource vector and the cost tier (2.9).

**`check.run`.** The Quality System's check runner is the executor of `check.run` and the only writer of validation records; R2's validation ladder and bake equivalence test are functions it calls (decision FR13). Each check declares the artifacts it needs, and the Scheduler requests those renders as dependencies of the check job (decision FR10).

| Capability | Effect class | Pool or limiter (2.8) |
|---|---|---|
| `component.validate`, `component.bake` | `pure` | `browser` |
| `chunk.render` | `pure` | `browser` with a piped encoder |
| `still.render` | `pure` | `browser` |
| `media.extract_frames`, `audio.mix`, `film.concat`, `film.mux` | `pure` | `ffmpeg_heavy` |
| `check.run` | `pure` | By check |
| `model.call` | `paid` | Model limiter |
| `voice.synthesize`, `music.generate`, `sfx.generate`, `transcribe` | By adapter: `paid`, `paid_stateful`, or `pure` for a local engine | Paid-API limiter |
| `voice.align` (R7) | By adapter, as for `transcribe`: `pure` for a local engine, `paid` for a hosted one | Declared by R7: CPU work, not the browser pool (decided: `lld/11` section 18, C:M5-O1c) |
| `fetch.document`, `fetch.media` | `external_read` | Per-host network limiter |
| `capture.run` | `external_interactive` | `capture_browser`; per-host network limiter |
| `subloop.run` | `pure` | None of its own |

- **Every model call is a `model.call` job**, including each Director turn and a researcher request that uses MiniMax's `web_search` tool. The harness has no retry of its own.
- **`subloop.run` is `pure`** because it has no external effect of its own. Each model turn is a child `model.call` job, and the harness resumes the sub-loop from its session log after a restart.

### 2.6 Paid external calls: intents, `unknown_outcome`, reconciliation

**What MiniMax offers (verified by source).** No call accepts an idempotency key. Model calls (including the `web_search` tool), synchronous speech and speech-to-text cannot be queried afterwards. Only asynchronous speech can, by `task_id`, with no list endpoint. There is no usage or balance API, and the pricing page is silent on failed or aborted requests.

**Choice.** Reconcile locally, book conservatively and allow one bounded resend. Never resending would stall a film over a two-cent call; resending freely could hide spend. R1 Revision 1 amends R1 §4.3 to match: for a provider with no idempotency key or lookup, "reconciled with the provider" means salvage from the local spool, book the call as presumed charged, and allow one bounded resend.

**The guarantee** is "at most one bounded duplicate per job", not "nothing is paid twice": `unknown.resend_max` is 1 per job, and all resends in a film share `budget.duplicate_spend_usd` ($0.50). The count is kept per job row, for the row's life: neither a new request after `failed` (`policy`) nor `job_retry` resets it, and the first send after a job is admitted again is a new send, not a resend (decided: `lld/11` section 18, B:M3-11-resend).

**Protocol.**

1. **Single flight.** At most one unresolved intent exists per work key. The work key is sent as an idempotency key to any provider that accepts one.
2. **One retry owner.** Client libraries must not retry. The Anthropic TypeScript SDK retries twice by default, so clients are created with `maxRetries: 0`.
3. **Intent before send.** One transaction writes the intent (`sent`, request hash, estimated maximum cost) and reserves that cost. The send waits for this commit, which runs with `FULL` (2.1).
4. **Spool.** Response bytes are appended to `spool/<intent>` as they arrive; model calls always stream.
5. **Confirm.** On a complete response the blobs are stored; then one transaction marks the intent `confirmed`, books the real usage and completes the job.
6. **Failure.** Every failed call is one of two kinds.
   - **Definitely unsent:** the connection failed before any request byte was written, or an explicit provider error arrived before any response content (HTTP 4xx, 429, 5xx or 529, or a non-zero `base_resp` code). The intent is `rejected`, the reservation is released, and the retry rules in 2.7 apply.
   - **Ambiguous:** a timeout after the request was written, a reset or any stream error (a provider error event included) after response bytes began, or a crash. The intent is `unknown`, the job is `unknown_outcome`, and only the reconciler may move it.

**Reconciler, by what the provider adapter declares.**

- **`queryable_task`, with the task ID stored.** Poll the task; adopt the result or record the failure.
- **`none`.** This covers MiniMax model calls, synchronous speech and speech-to-text, an adapter that answers `cannot_tell`, and an asynchronous create call lost before its `task_id` arrived. A complete response in the spool is **salvaged**, which covers a crash after receipt but before commit. Otherwise the call is booked as **presumed charged** (estimated input cost plus the output seen in the spool) and resent once, if the job is within `unknown.resend_max` and the film's allowance covers it. Failing that, the job is `failed` (`policy`) with a notification.

**Notes.**

- **The settled state `presumed`.** An intent booked as presumed charged ends in the terminal state `presumed`, the same word as its ledger entry. Its spool may be deleted after `retention.logs_days`, and the single-flight rule lets the resend write a new intent (decided: `lld/11` section 18, B:M3-11-state).
- A job cancelled mid-call still has its intent settled as presumed charged, in the same state.
- **Exposure is small.** A component generation costs about $0.003; a repair costs $0.001 as search/replace edits, $0.003 as a whole document and $0.011 on MiniMax-M3 (S3); a Reviewer call about $0.014 (S2).
- **Cost function.** MiniMax caches prompt prefixes automatically, and `input_tokens` excludes cached tokens (S5). Cost is input × input price + cached × cached price + output × output price. Reservations assume no cache hit.

### 2.7 Retry, cancellation, supersession and late results

**Retry by failure class (R1 §4.3).** The Scheduler is the only retry owner; `retry.transient_max` replaces R6's `llm.retry_max`.

| Class | Scheduler behaviour |
|---|---|
| `transient` | Retry with the same pinned inputs up to `retry.transient_max`, with exponential back-off and jitter. Covers HTTP 429, 5xx and 529. An empty model reply with no moderation signal is retried once. A chunk that kills its browser twice becomes `deterministic` |
| `deterministic` | No retry. The diagnostic is stored against the work key and returned to any identical request. Covers HTTP 4xx responses not named in another row. A muxed file without audio is not a job failure (section 4) |
| `capability`, `creative` | No retry. A capability failure, which includes a missing or retired model, returns to the requester for repair with new inputs; a creative one goes to the Director, who may ask for a new variant or a branch |
| `policy` | No retry. Covers budget refusals, HTTP 401 and 403, and an identified moderation refusal. The Director may re-admit a budget refusal after changing a budget inside the hard cap |

Validate-and-repair of model output is not a Scheduler retry: each repair is a new `model.call` job with a new work key, limited by R6's `author.*` settings. `job_retry` lets the Director re-run a failed job, including a remembered `deterministic` failure.

A crash or timeout inside a check is a `transient` attempt failure: it is retried up to `retry.transient_max` and writes no record. If the last attempt also crashes or times out, the check runner writes the one validation record with verdict `UNKNOWN` and a coverage record naming the failure, and that record is the cached result, run again only by `job_retry` or after an input changes. A missing input gives a cached `UNKNOWN` at once (R9 D1) (decided: `lld/11` section 18, B:M3-10).

**Cancellation.**

- A cancel names a job, a tree or a consumer. Cancelling a consumer only releases it; a job shared with another consumer keeps running.
- A job with no active consumer has its attempt signalled: capture stops after the current frame; FFmpeg receives SIGTERM, then SIGKILL after `cancel.grace_s`; a stream is aborted. The job leaves `running` only when the attempt has ended.
- **`CancelOutcome` is the shape shared with R6.** It lists the consumers released and one outcome per job: `cancelled` (not running; ended at once), `stop_pending` (signalled, not yet ended), `shared_continuing` (another consumer still needs it) or `completed_before_cancel`.
- **Cancellation racing completion.** Both are transactions on the one writer, so they are ordered. If completion commits first, the outcome is `completed_before_cancel`. If the cancel commits first and the attempt still delivers a valid result, it is cached under its work key; otherwise the job ends `cancelled`. Either way the released consumer is never resolved and nothing is promoted.

**Supersession.** The handler that replaces a plan releases the old plan's consumer; the Scheduler does not interpret project meaning. Jobs the new plan also requests keep their work key and continue. Jobs left with no active consumer become `superseded` if not yet running. A running orphan finishes if it is `pure` with under `orphan.finish_max_s` remaining, or if a paid call is in flight; otherwise it is aborted.

**Late results.** One rule covers them (decision FR10). A job artifact is cached under its work key, so a finished orphan is kept and a later revision that requests that key gets a hit: an equal work key is an equal closure of declared inputs, which is the HLD's condition for reusing a late result. A worker's patch proposal is merged only if its read set, compared by `pin_hash`, is unchanged on the target head; Project Core makes that comparison. The Scheduler never moves the accepted head.

### 2.8 Resource pools and backpressure

A job declares a resource vector, for example `{browser: 1, encoder: 1}`. All parts are acquired together in a fixed order, which prevents deadlock. R5 owns every pool and limiter below.

**Render browser pool (`browser`), sized by memory.**

- **Measured (S4, WSL2, 15 sandboxed components per page).** One browser uses about 920 MB of resident memory (462 MB proportional); four use 3.6 GB and six use 5.4 GB. Six give 26 ms per frame effective against 30 ms for four; eight are no faster.
- **Size.** `min(browser.max, floor((total − mem.reserve_mb) / browser.mem_budget_mb))`, with `browser.mem_budget_mb` = 950 and `browser.max` = 6. WSL at 11.7 GB with a 4 GB reserve gives 8, capped at 6.
- **One policy.** Browsers start on demand up to the computed size, which drops by one after an out-of-memory kill until restart. R2's `browser_pool_size` and `browser_base_mb` are removed.
- **Live guard.** No browser lease is granted while `MemAvailable` is under `mem.low_water_mb`. Under `mem.critical_mb` the newest capture attempt is killed and retried as `transient`.
- **Interactive reserve.** One slot is kept for validation and preview work.
- **PixiJS units.** One PixiJS browser uses about 10 cores under software rendering (S7). The chunk and still jobs of a render unit that the plan marks as holding a PixiJS component therefore also take a permit keyed by the unit. Each unit has `pixi.unit_browsers` (1) permits, so one browser at a time renders it.

**Capture browser pool (`capture_browser`).** `capture.run` drives a browser with network access, so it never shares one with rendering, which has no network. The pool holds `capture_browser.max` browsers. While one is open, `capture_browser.mem_budget_mb` is taken from the render pool's memory.

**FFmpeg pool.** An encoder piped from a capture belongs to the capture's vector and runs with `ffmpeg.piped_threads`. The `ffmpeg_heavy` capabilities share a pool of `ffmpeg.heavy_max`.

**Model-call limiter.**

- MiniMax documents 200 requests and 10 million tokens per minute per model. Each model has a request bucket and a token bucket at `llm.limit_fraction` (0.6) of those figures. One global cap, `llm.max_concurrent` (8), limits the requests in flight across all models (decision F12). These replace R6's `llm.rpm_ceiling`, `llm.tpm_ceiling` and `llm.max_concurrent_requests`. The token bucket is charged the estimated input plus expected output, and corrected after the response.
- On HTTP 429, or error codes 1002, 1039, 1041 and 2045–2047 (which include a "sudden rise" in requests), the rate is halved and concurrency drops by one. Both recover additively: after each `llm.recover_interval_s` (30) with no throttling signal, concurrency rises by one and each bucket's rate by `llm.recover_rate_fraction` (0.1) of its ceiling, up to `llm.max_concurrent` and the bucket limits (decided: `lld/11` section 18, B:M3-7). Concurrency starts at `llm.start_concurrent` and rises the same way, up to `llm.max_concurrent`.
- **Measured (S5).** The spike key is on a MiniMax subscription plan and returned HTTP 429 (code 2062) at about 10 requests in flight in total, hence the global cap of 8. The user kept this key (U11), so the cap stays at 8.

**Paid-API limiter.** Each adapter declares requests per minute and concurrency. The voice adapter, Kokoro-82M through OpenRouter (U17), has no published limits and backs off on HTTP 429 (U18); the aligner and the transcriber run locally (R7 §2.2.4).

**Per-host network limiter.** `fetch.document`, `fetch.media` and `capture.run` take a permit keyed by the target host: `net.per_host_concurrent` requests at once and `net.max_concurrent` across all hosts, spaced by the adapter's rate rule or else by R7's `fetch.per_host_interval_ms`. `Retry-After` is obeyed.

**Backpressure.** Frame pipes use operating-system backpressure, with at most R2's `capture.max_buffered_frames` in memory. Bulk and speculative jobs are not admitted while disk space is under `disk.low_water_gb`. A provider or host with `breaker.failure_count` (5) consecutive `transient` failures opens a circuit breaker for `breaker.open_s`; its jobs wait in `ready` (decided: `lld/11` section 18, B:M3-7).

### 2.9 Speculative work on provisional commitments

**Choice.** Gate by cost and reversibility, so that provisional commitments unblock work (C3) without wasting money when they change. Always waiting for frozen inputs wastes parallelism; allowing everything would buy voice takes for scripts that are still moving.

Readiness is not in the work key, so speculation is judged per consumer. A request is **speculative** if a commitment it pins is not `frozen` in the consumer's revision, or if a prerequisite is speculative for that consumer. A job runs when the gate passes for at least one active consumer.

| Readiness of the pinned commitment | `cheap` (validation, bake, FFmpeg work, checks, fetches) | `moderate` (authoring call, chunk below rung `final`, transcription, capture) | `expensive` (chunk at rung `final`, paid audio, Reviewer call) |
|---|---|---|---|
| `exploring` | Run | Hold | Hold |
| `provisional` | Run | Run while the scope's speculative spend is under `spec.max_fraction` | Hold in `declared` unless the Director sets `allow_speculative` |
| `frozen` | Run | Run | Run |

- **The scope budget** behind `spec.max_fraction` is the consumer's `budget_scope` hard limit or, if that scope has none, its nearest ancestor's, which at the film root is `budget.hard_cap_usd`. Speculative spend is measured over that scope and its descendants (decided: `lld/11` section 18, B:M3-8-scope).
- A speculative result is an ordinary cached artifact. If the commitment freezes unchanged, the work key is the same and the result is used as it is (2.3).
- The cost of speculative jobs released before use is reported as speculative waste (B5).

### 2.10 Budget ledger

- **Units and entries.** Tokens (input, cached, output, per model), dollars as integer micro-dollars, and wall-clock milliseconds. Entries are `reserve`, `commit`, `release` and `presumed`. Every amount (reservation, commit and presumed charge) is rounded up to the next micro-dollar, so rounding can never let spend pass a cap (decided: `lld/11` section 18, B:M3-9-rounding).
- **Scopes.** A tree of `budget_scope` rows: the film is the root; revision cycles, experiments and workers are children. Every job has one paying scope, and spend rolls up. When two scopes join one job, the first pays.
- **Compute counts toward the cap.** It is booked as wall-clock time multiplied by `compute.usd_per_hour`, once per film however many attempts run in parallel, because they share one machine. The rate is 0 in development and the VM's rate in production.
- **Enforcement point.** The intent transaction. A reservation is refused if committed plus reserved plus the new estimate would pass a hard limit at any ancestor; the job then fails as `policy`. Each role has a `max_tokens` setting, so a reservation is cents.
- **Hard cap.** $15 per film (R0). At the cap no new paid intent is admitted and the Director is notified. No verdict changes because money ran out; the completion state of what is delivered is R9's rule.
- **One delivery reserve.** `budget.delivery_reserve_usd` ($0.50) is withheld from all other work. It covers the final export, the final-file checks, the final review and the Director's wrap-up, and replaces R6's `budget.wrapup_reserve_usd` and R9's `budget.final_reserve_usd`. `delivery_finalize` opens a child budget scope `delivery` under the film root, and its jobs may draw on the reserve: the final export, and the final-file checks and review T7 that the handler adds. The Director session's own `model.call` jobs may draw on it once the film's other spend has reached `budget.hard_cap_usd` − `budget.delivery_reserve_usd`, or once the delivery scope is open, so that the Director can still call `delivery_finalize` or `director_report_blocked`. No other job may draw on it (decided: `lld/11` section 18, B:M3-9-draw).
- **Treatment share (G2).** R6's `treatment.budget_fraction` (0.2) is measured against `budget.soft_target_usd` (5), about one dollar on a typical film. Crossing it notifies the Director, who decides whether to continue; the share is not a hard child-scope limit and does not stop the phase. The film's hard cap still applies.

### 2.11 Priorities and fairness

**Priority classes, highest first:** `control` (reconciliation, cancellation, work a waiting Director turn needs), `preview`, `review`, `final`, `speculative`, `maintenance`. Purposes `preview`, `review` and `delivery` map to the classes `preview`, `review` and `final`. A job takes the highest class among its active consumers.

- **No preemption.** With six browsers, each captures a 15-component page at about 155 ms per frame (S4), so a 90-frame chunk takes about 14 seconds and the 150-frame maximum about 23. A preview request waits at most one chunk and no work is thrown away.
- **Ageing.** A job rises one class per `priority.age_step_s` waited, so final renders cannot starve.
- **Fairness between branches.** Within a class, the next job comes from the branch (read from the job's consumers) that has consumed the fewest resource-seconds, scaled by a weight the Director may change. In v2 every branch weighs 1 and no weight is stored; the weight is deferred until a tool needs it, since no tool in R6's catalogue sets one (decided: `lld/11` section 18, B:M3-8-weights).
- **Experiments.** A variant may request `exclusive` runs when timing is itself the measurement.
- **Within a branch.** Earliest film time first, from `order_hint`, so partial previews fill from the start.

### 2.12 Garbage collection and retention

**One sweep, two roles.** Project Core's blob store runs the only mark-and-sweep over blobs. The Scheduler supplies roots and chooses evictions; it never deletes a blob.

**Roots the Scheduler supplies** through `blob_roots()`: every set `result_ref`, including the segment and sidecar inside a chunk result; the inputs of non-terminal jobs; the diagnostics of retained jobs. Project Core adds its own roots.

| Tier | Contents | Retention once nothing else refers to it |
|---|---|---|
| `irreproducible` | Model outputs, paid audio, fetched originals, captures | `retention.irreproducible_days`; never evicted for space |
| `derived_final` | Final-rung segments, undelivered exports | `retention.derived_final_days` |
| `derived_cheap` | Preview segments, intermediates | `retention.derived_cheap_days`; least-recently-used eviction above `cache.max_gb` |
| `logs` | Log files, settled spools | `retention.logs_days` |

- **Eviction** clears `result_ref`, which removes the root; the blob goes at a later sweep by Project Core, under the grace rule. Eviction removes only blobs that are referenced solely as re-creatable cache results (decision H7, which corrects F13). The job row and its diagnostics stay, so a known deterministic failure is still remembered.
- **Grace.** R3's `blob.grace_hours` (24) is the only grace setting. It protects every blob that no root references and that is younger than `blob.grace_hours`, whether or not its row exists yet (decision H7).
- **Blob durability.** R3's blob store takes a `durable` flag at ingest. The Scheduler sets it for `irreproducible` blobs, which are then synced before the referencing transaction, and clears it for derived blobs. R3's "never a row without a file" guarantee applies to durable blobs; a truncated derived file fails a size check on use and is treated as evicted.
- **Spools and log files** are Scheduler files, not blobs. The Scheduler keeps the spool of every unresolved intent and deletes settled spools and old logs itself.

### 2.13 Observability

Every state transition is a row in `event`, with correlation ID and causal parent. A `job_attempt` row is the trace span. Paid calls and spend are in `external_intent` and `ledger_entry`. Request and response bodies, child-process error output and Diagnostic Evidence Bundles are blobs referenced from those rows. Pool and limiter decisions go to JSON-lines log files. API keys are never written. The B5 measures are SQL queries over these tables; no tracing backend is required.

## 3. Interfaces to other stages

| Stage | What R5 needs from it or gives it |
|---|---|
| R2 rendering | Executors for its capabilities, each with a resource vector, heartbeats and abort behaviour; the environment hash; the chunk result record with its `diagnostic` flag; `still.render`. R2 refers to `browser.*` and `pixi.unit_browsers` and owns `capture.*` |
| R3 project and storage | The shared SQLite database and transaction interface; `db.synchronous` and patch keys (2.1); the blob store with its durability flag and its single sweep, which calls `blob_roots()`; `pin_hash` on every entity version; the index of authored-against `pin_hash` records; the `ReadinessOracle` for `commitment` and `acceptance` |
| R4 compiler | Emits the plan's `execution` part, its pinned commitments, grade and rung, and marks PixiJS render units; it owns `pixi.max_per_unit`. It starts no job |
| R6 harness | The tool handlers and the shared `CancelOutcome` in 2.4. Every model call is a `model.call` job with client retries disabled; sub-loops are `subloop.run` jobs. `compile` runs inline in its tool handler, and 2.7 follows R6's HTTP error mapping (decision F17). R6 refers to `llm.*`, `retry.transient_max` and `budget.delivery_reserve_usd` |
| R7 studio tools | Each adapter declares limits, a price function, its effect class, its reconciliation capability and its failure-code mapping. Fetch and capture use the per-host limiter and the `capture_browser` pool. A capture script declares whether it is repeat-safe |
| R9 quality | Supplies `validation` facts through the oracle. Its check runner is the executor of `check.run` and the only writer of validation records; each check declares the artifacts it needs. It quarantines a result that fails a hard check, and uses the one delivery reserve |

## 4. Failure handling

| Case | Trace through the design |
|---|---|
| **Stale completion after an upstream revision** (B4, C11) | A job requested for P18 finishes after P19 was accepted. Its artifact is cached under its work key and used only if P19's plan requested the same key (2.7); nothing is resolved or promoted. A worker's patch proposal is merged only if its read set, by `pin_hash`, is unchanged on the target head. Changed assumptions are caught by the dependency index (2.3) |
| **Crash after an external effect, before reporting** (C11) | The intent is `sent` and unconfirmed, so the job restarts as `unknown_outcome` and the reconciler acts (2.6). A repeated tool call has the same work key and joins that job |
| Blob and database disagree | A blob without a reference is removed by Project Core's sweep once it is older than `blob.grace_hours`; its job re-runs or is salvaged from the spool. A reference without a blob is treated as evicted; an irreproducible result then fails with a diagnostic |
| Exported file has no audio (C11) | Not a job failure: `film.mux` succeeds whenever FFmpeg exits cleanly and always returns its file. R9's hard checks F-01 and F-02 judge the file. On a hard failure the Quality System quarantines the result (2.3), which permits one re-run; chunks and the mix stay cached, so only the mux is redone. A second failure leaves the state `blocked` with the diagnostic (decision FR9), and its quarantine makes the mux job a remembered `deterministic` failure (2.3) (decided: `lld/11` section 18, B:M3-6) |

Cancellation races are traced in 2.7, network failures of model calls in 2.6, an interrupted capture in 2.5, and browser hangs and memory exhaustion in 2.7 and 2.8.

## 5. Named settings and defaults

R5 owns every setting below. Names follow `area.snake_case` (decision C1). `capture_browser.*` is R5's namespace; `capture.*` is R2's and `screen_capture.*` is R7's (decision F14). `pixi.unit_browsers` is R5's and `pixi.max_per_unit` is R4's; R2 refers to both (decision H1).

Override authority and ranges follow the shared rule in R3 §2.7 (G15); settings requiring `human` authority are marked below.

| Setting | Default |
|---|---|
| `db.commit_tick_ms` | 20 (`human`: it decides how commits are made durable, class (f), K5) |
| `lease.flush_s` | 15 |
| `stall.capture_s` / `stall.model_stream_s` / `stall.ffmpeg_s` | 60 / 120 without bytes / 60 |
| `retry.transient_max` | 3 (4 for HTTP 529) |
| `retry.backoff_base_s` / `retry.backoff_cap_s` | 2, doubling with jitter / 60 |
| `unknown.resend_max` | 1 per job row, for the row's life (`human`) (2.6; decided: `lld/11` section 18, B:M3-11-resend) |
| `budget.duplicate_spend_usd` | 0.50 per film (`human`) |
| `budget.hard_cap_usd` / `budget.soft_target_usd` / `budget.revision_cycle_usd` | 15 (`human`) / 5 (`human`: a target the user accepted in R0, K7) / 0.75 (`human`) (R0) |
| `budget.delivery_reserve_usd` | 0.50 (`human`) |
| `compute.usd_per_hour` | 0 in development; the VM's rate in production (`human`: a price that feeds the hard cap, K7) |
| `browser.max` / `browser.mem_budget_mb` | 6 / 950 (S4) |
| `pixi.unit_browsers` | 1 (S7) |
| `capture_browser.max` / `capture_browser.mem_budget_mb` | 1 / 1500 (unmeasured) |
| `mem.reserve_mb` / `mem.low_water_mb` / `mem.critical_mb` | 4000 / 1500 / 700 |
| `ffmpeg.heavy_max` / `ffmpeg.piped_threads` | 2 / 2 |
| `llm.limit_fraction` / `llm.max_concurrent` / `llm.start_concurrent` | 0.6 / 8 across all models (`human`, range 1 to 8: it holds the user's decision U11, G15 class (a), and the key rejects requests at about 10 in flight, S5) / 2 |
| `llm.recover_interval_s` / `llm.recover_rate_fraction` | 30 / 0.1 of the bucket's ceiling (unmeasured starting values; `R5-3` revisits them) (decided: `lld/11` section 18, B:M3-7) |
| `tts.max_concurrent` / `stt.max_concurrent` | 3 / 1 |
| `net.per_host_concurrent` / `net.max_concurrent` | 2 / 8 (unmeasured; both `human`) |
| `spec.max_fraction` | 0.25 of the scope budget: the consumer scope's hard limit, or its nearest ancestor's (2.9) |
| `orphan.finish_max_s` / `cancel.grace_s` | 30 / 5 |
| `priority.age_step_s` | 300 |
| `breaker.open_s` / `breaker.failure_count` | 60 / 5 consecutive `transient` failures (unmeasured starting value) (decided: `lld/11` section 18, B:M3-7) |
| `cache.max_gb` / `disk.low_water_gb` | 20 (`human`, class (f), K5) / 5 |
| `retention.irreproducible_days` / `retention.derived_final_days` / `retention.derived_cheap_days` / `retention.logs_days` | 90 / 30 / 7 / 14 (all `human`: they decide how long stored data is kept, class (f), K5) |

Settings owned elsewhere and used here: `db.synchronous` and `blob.grace_hours` (R3), `capture.max_buffered_frames` (8) (R2), `fetch.per_host_interval_ms` (R7), `chunk.max_frames` and `chunk.frames` (R4), `author.*` (R6).

## 6. Cross-domain check

| Domain | Scheduler behaviour that matters |
|---|---|
| Historical comedy | A re-authored reaction has a new component hash, so only the chunks of render units that show it get new work keys |
| Science documentary | Footage fetches are `external_read` under the per-host limiter. A corrected claim changes the keys of dependent diagrams, labels and voice lines only |
| Art history | A crop change alters the annotation chunks' inputs; narration and the source image stay cached |
| Software tutorial | `capture.run` is `external_interactive` and uses the `capture_browser` pool. Recapture changes input hashes for the affected steps only |
| Data reel | A changed figure gives a new chart work key and a new voice line; styling components keep their keys |
| Abstract motion graphics | Many `pure` chunks and few paid calls; pools and fairness between variants matter most |

## 7. Decisions that differ from the first working draft

1. **The cache is not a separate table.** It is the unique `work_key` on the job row, which also remembers deterministic failures.
2. **Restart recovery uses instance fencing, not lease expiry.** With one process per Space, every lease from an earlier instance is dead.
3. **"Reconciled per provider" is not possible for most MiniMax calls** (2.6). The design reconciles locally, books the worst case and allows one bounded resend; R1 Revision 1 amends R1 §4.3 accordingly.
4. **Quarantine** is added to "no separate invalidation step", because hashing does not catch a faulty result.
5. **A variant index** is added to the parameters of non-deterministic capabilities.
6. **The unit of rendering is a chunk of a render unit**, not of a shot, because R4 makes a transition its own render unit.
7. **Physical blob deletion belongs to Project Core.** The Scheduler supplies roots and chooses evictions.

## 8. Claims table

| Claim | Label | Evidence, or what breaks |
|---|---|---|
| MiniMax limits: 200 requests and 10M tokens per minute per model; speech 60 per minute; speech-to-text two connections. The error codes in 2.8 are transient load signals | VERIFIED by source | [Rate limits](https://platform.minimax.io/docs/guides/rate-limits), [Error codes](https://platform.minimax.io/docs/api-reference/errorcode) |
| Model, speech and speech-to-text APIs: no idempotency key, batch or retrieval; `store` ignored; only asynchronous speech has a queryable `task_id`, with no list endpoint | VERIFIED by source | [Create Message](https://platform.minimax.io/docs/api-reference/text-chat-anthropic), [Create Response](https://platform.minimax.io/docs/api-reference/responses-create), [T2A HTTP](https://platform.minimax.io/docs/api-reference/speech-t2a-http), [async create](https://platform.minimax.io/docs/api-reference/speech-t2a-async-create), [async query](https://platform.minimax.io/docs/api-reference/speech-t2a-async-query), [Speech to Text](https://platform.minimax.io/docs/api-reference/speech-to-text) |
| No usage or balance API; prices | VERIFIED by source | [Pricing](https://platform.minimax.io/docs/pricing/overview), [API overview](https://platform.minimax.io/docs/api-reference/api-overview) |
| The spike's subscription key returns HTTP 429 (code 2062) at about 10 requests in flight | VERIFIED by spike | S5 |
| Prompt caching is automatic (about 99% of input cached from the second turn; a hit after 25 idle minutes, a miss after 32); `input_tokens` excludes cached tokens | VERIFIED by spike | S5 |
| The call costs in 2.6 | VERIFIED by spike | S3; S2 |
| The browser memory and throughput figures in 2.8 | VERIFIED by spike | S4 |
| Separately encoded H.264 segments join by stream copy with the exact frame count and no quality loss | VERIFIED by spike | Segment-join check (integration decisions, section 11) |
| One PixiJS browser uses about 10 cores under software rendering | VERIFIED by spike | S7 |
| MiniMax does not bill refused requests (4xx, 429) | ASSUMED | Pricing page is silent. If wrong, the ledger under-counts. Spike R5-2 |
| A client-aborted stream is billed only for tokens generated so far | ASSUMED | If wrong, presumed-charged booking is too low by at most the role's `max_tokens`. Spike R5-2 |
| On a pay-as-you-go key the documented limits apply per account and model; cached tokens count toward the token limit | ASSUMED | Undocumented; S5 saw only a subscription key. If wrong, the limiter is mis-sized; the adaptive slowdown still protects. Spike R5-3 runs on the subscription key the user kept (U11), so this stays ASSUMED |
| Browser memory stays inside 950 MB with more than 15 components, and across many chunks in a reused browser | ASSUMED | S4 tested neither. If wrong, the live memory guard kills and retries captures |
| A capture browser fits in 1,500 MB; two concurrent requests per host are acceptable to source sites | ASSUMED | Unmeasured starting values. If wrong, the live guard and the breaker protect |
| WAL: one writer, readers not blocked, local filesystem only; corruption race fixed in 3.51.3; `NORMAL` may lose a commit on power loss | VERIFIED by source | [SQLite WAL](https://sqlite.org/wal.html), [PRAGMA synchronous](https://sqlite.org/pragma.html#pragma_synchronous); [Microsoft on WSL file systems](https://learn.microsoft.com/en-us/windows/wsl/filesystems) |
| A `FULL` commit survives power loss on the deployment disk; rollback works inside a grouped commit | ASSUMED | Batch 2b tested process death only (decision H12). If wrong, the affected transactions move to their own commit. At build milestone M3 the grouped rollback is tested and an abrupt-stop drill runs, labelled "abrupt VM stop"; true power loss stays ASSUMED until M11, when a VM exists (decided: `lld/11` section 18, L1) |
| `node:sqlite` on Node 26.13.1 needs no flag and bundles SQLite 3.54.1. WAL on `/mnt/c` raises no error; that mount's type reads `9p` | VERIFIED by spike | Batch 2b. The version is still checked at start-up |
| Process death loses no acknowledged commit (400 kills, no violation); about 9 in 10 kills leave one committed, unacknowledged transaction | VERIFIED by spike | Batch 2b, on ungrouped commits. Power loss was not tested |
| `FULL` stalls the main thread for up to about 190 ms under load, `NORMAL` for 25–30 ms; only grouped commits keep up at 50 writes per second | VERIFIED by spike | Batch 2b, on one laptop under background load |
| `node:sqlite` is synchronous and a release candidate; Node 24 and 26 are LTS lines | VERIFIED by source | [node:sqlite](https://nodejs.org/api/sqlite.html), [Node releases](https://nodejs.org/en/about/previous-releases) |
| Each external engine in 2.1 needs its own server or database | VERIFIED by source | Temporal [CLI server](https://docs.temporal.io/cli/command-reference/server), [embedded server](https://docs.temporal.io/self-hosted-guide/embedded-server), [Activities](https://docs.temporal.io/encyclopedia/activities); Restate [concepts](https://docs.restate.dev/concepts/durable_execution), [LICENSE](https://github.com/restatedev/restate/blob/main/LICENSE); [DBOS configuration](https://docs.dbos.dev/typescript/reference/configuration); Inngest [self-hosting](https://www.inngest.com/docs/self-hosting), [LICENSE](https://github.com/inngest/inngest/blob/main/LICENSE.md); [BullMQ docs](https://docs.bullmq.io/) |
| The Anthropic TypeScript SDK retries twice by default; `maxRetries: 0` disables it | VERIFIED by source | [SDK documentation](https://platform.claude.com/docs/en/api/sdks/typescript) |

No ASSUMED claim changes the shape of the design. The two billing assumptions sit on the path that enforces the hard cap. Their probe, spike R5-2, is due at build milestone M4, before paid work at scale, and not before the design freeze.

## 9. Spikes wanted

Identifiers carry the stage prefix (decision C4). R5-4 (memory per browser on the real host page) was answered by S4, and R5-1 (SQLite commit speed and crash safety) by batch 2b; both are closed.

| ID | Claim to test | Method |
|---|---|---|
| R5-2 | Billing of aborted and refused model calls; any undocumented idempotency support | Small M3.1-Flash requests: abort mid-stream, force a 4xx, repeat one request with an `Idempotency-Key` header; compare with the console usage page, which only the user can read. The session asks the user once, at M4, for the plan's usage figure before and after the probe; if the user does not supply it, the billing half is recorded `UNKNOWN` and the build continues (decided: `lld/11` section 18, L17). Cost cap $0.50. Due at M4 |
| R5-3 | Rate-limit scope, headers and recovery time on the subscription key the user kept (U11); S5 saw only that kind of key, and the pay-as-you-go claim in section 8 stays ASSUMED | About 300 tiny Flash requests in 60 to 90 seconds, with a trickle of MiniMax-M3, never more than 8 in flight (U11), within M4's spend ceiling; record the 429s, codes, headers and recovery time, and whether MiniMax-M3 is affected. The recovery time revisits `llm.recover_interval_s` and `llm.recover_rate_fraction`. The user is told before the burst (decided: `lld/11` section 18, A:testing-5). Cost cap $1. Due at M4 |
| R5-5 | Restart recovery is clean | Kill Node during capture, encode, a model stream and a grouped commit; confirm orphan process groups are removed and spool salvage works |
