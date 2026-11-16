# Cutroom v2 — Implementation · Milestone M3: Scheduler

**Written:** 15 November 2026
**Status:** Plan for the build; section 9 records how its design gaps were resolved.
**Read with:** [orchestration](../00-orchestration.md) · [conventions](../01-repo-and-conventions.md) · [R5](../../lld/06-r5-scheduler-and-recovery.md) · [R9](../../lld/09-r9-quality.md) D1 · [R10](../../lld/10-r10-integration-acceptance-and-build-plan.md) §2.2, §3.2, §4.2 · [decisions](../../lld/11-integration-decisions.md) §15–17

Signatures and type shapes below are illustrative, except `Need`, `CancelOutcome` and `Predicate`, which R5 §2.4 fixes. `Predicate` and `Need` are declared in `packages/foundations` (M0-02) and imported from there (B:SD1).

## 1. Goal

In R10's words (§4.2), M3 builds "jobs, work-key cache, futures, pools, intents and reconciliation, budget ledger, `plan_to_jobs`, the check runner (R5, R9)". It is done when "cases A1, A7 and A11 pass against stub capabilities (a fake author and a fake paid adapter); a killed render resumes; orphaned browsers are removed; the power-loss and grouped-rollback tests pass". The power-loss test runs here as an abrupt-stop drill, labelled "abrupt VM stop"; true power loss on a deployment disk stays ASSUMED until M11, when a VM exists (L1).

## 2. Provides to later milestones

- **`Scheduler`** (R5 §2.4): `request(spec, consumer)` returning a future, `view`, `until`, `release`, `cancel` (returning `CancelOutcome`), `retry`, `quarantine`, `subscribe`, `budget`, `blob_roots`, under M4's job tools.
- **`plan_to_jobs(plan, purpose)`**, for `render_request` (M4) and `delivery_finalize` (M6).
- **`ReadinessOracle`**, over foundations' `Predicate` and `Need` (B:SD1); `delivery_eligibility` is answered from M6.
- **`register_capability`, `Executor`, `AttemptContext`**, for `model.call` and `subloop.run` (M4), audio (M5), fetch (M8), capture (M10).
- **`PaidAdapter`** (reconciliation `queryable_task` or `none`, limits, price function, failure mapping), wrapping `ModelClient` (M4) and R7's `ProviderAdapter` (M5); **`ModelLimits`**, from M4's model catalogue.
- **Budget scopes** (thresholds, the delivery reserve and its `delivery` scope, B:M3-9-draw) and **subscription to the `event` table** (the table is project-core's, M2-05; B:SD3), for R6 (G2, `director.budget_wake_fractions`, wake-ups) and R9's stopping rules.
- **The check runner** in `packages/quality`: `register_check` with `proves` (B:O9), validation records, the `validation` half of the oracle; the catalogue follows at M4 to M6.
- **In `packages/project-core`:** the `evidence` table and `closure_hash`, built by M3-07 (L5).
- **Under `tests/fixtures/`:** the fake author, fake render and fake paid adapter, which stub the M4 and M5 interfaces above, and the fault helpers; reused for A1 (M4), A7 (M5), A8 and A12 (M6).

## 3. What must already exist

**M0.** `packages/foundations` (flicks, UUIDv7, SHA-256, RFC 8785 canonical JSON, `ArtifactRef`, the R1 §2.4 work key, failure classes, R1 §5 evidence types, `Predicate` and `Need` (B:SD1), the settings registry). In `packages/project-core`: the storage adapter (`exec`, `prepare`, `tx`, `backup`, `close`) on one WAL writer connection with per-transaction `FULL`, and its grouped writer, in which a `full` member commits in its own group (L2); `user_version` migrations; refusal of `9p` and of SQLite before 3.51.3; the blob store (`ingest(stream, {durable})`, one sweep under `blob.grace_hours` taking external roots); the accepted-head swap writing `accepted_log`, with a same-transaction hook. The edge table lets scheduler import foundations, project-core, compiler and render, and quality import those and scheduler.

**M1.** `packages/render`: `chunkRender`, `stillRender`, `filmConcat`, `filmMux` (which M3 wraps as the capabilities `chunk.render`, `still.render`, `film.concat`, `film.mux`) with an `AbortSignal` and progress callbacks, returning R2 §2.9's records and codes (A:M1-4); browser recycling; the environment hash; child processes in their own process groups, reported with PID and start time (B:M3-5).

**M2.** Entity versions with `pin_hash`; write authority; revisions, branches (`w/<job>`), merge, promotion, `restore`; job-bound grants, and `record_read` and `read_set`, which record a job's reads (the views stay at M4; B:O17); merge refusal of a proposal whose read set changed by `pin_hash`, with `STALE_READ_SET` listing the changed entities (R3 §2.7; B:SD2); the `event` table and `append_event`, with promotion writing the head-accepted event (M2-05; B:SD3); the `ingest` module (B:O11); the dependency index (M2-02), over which `closure_hash` is computed; the Render Plan's `execution` part (R4 D5). The `evidence` table is not M2's: M3-07 builds it (L5).

The orchestrator settles any missing item first.

## 4. Dependency sketch

```
M3-01 store ─► M3-02 jobs ─► M3-03 attempts ─► M3-04 pools ─► M3-05 paid calls ─► M3-06 recovery ─┐
                                   ├─► M3-07 check runner (packages/quality) ────────────────────────┤
                                   └─► M3-08 stub capabilities ─► M3-09 fault helpers ───────────────┴─► M3-10 tests
```

M3-10 is written by a test author who implemented none of M3-01 to M3-07 (00 §3).

## 5. Work packages

### M3-01 — Scheduler store, single instance, grouped writer and events

- **Care:** normal
- **Package:** `packages/scheduler`; it wraps project-core's grouped writer and does not change `packages/project-core` (L2; B:SD4)
- **Depends on:** M0, M2     **Parallel with:** none
- **Live calls:** none

**Goal.** R5's tables exist, one process owns the Space, state changes commit in groups through project-core's writer, events reach subscribers after commit, and every R5 setting is registered.

**Read first.** R5 §2.1, §2.2 (Tables), §2.4 (Events), §2.5 (fencing), §2.13, §5. R3 §2.6 (Durability and grouped commits), §2.7 (Settings), §3. lld/11 H12, G15, K5, K7, G22, C6, U11, L2, A:M0-4, B:SD3, B:SD4, B:M3-4, B:M3-7. Batch 2b evidence §3, §4.

**Build.** `src/store/schema.ts`: STRICT tables `job`, `job_consumer`, `job_dep`, `job_child`, `job_attempt`, `job_range`, `external_intent`, `budget_scope`, `ledger_entry`, `scheduler_instance`, registered through project-core's `registerMigrations`. Not `event`: M2-05 created it in project-core (B:SD3). `src/store/instance.ts`: the instance claim, refusal of a second owner with `SPACE_IN_USE` (A:M0-4), and the fence on every state change; `scheduler_instance` records the owner's PID, its start time from `/proc/<pid>/stat` and the boot ID, beside the instance ID and heartbeat (B:M3-4). `src/store/writer.ts`: `transact(fn, {durability: 'normal' | 'full'})`, a wrapper over project-core's `tx` that adds the instance fence and the dispatch of events after commit; it builds no second grouped writer (L2; B:SD4). `src/events.ts`: `subscribe(filter, from_seq, handler)` and the cursor, over project-core's `event` table and `append_event` (B:SD3). `src/settings.ts`: R5 §5, with the settings B:M3-7 adds.

**Rules that are easy to get wrong.**
- Promises resolve and events fire only after the group commits; a kill before `COMMIT` acknowledges no member (R5 §2.1).
- A failing member rolls back to its savepoint; the rest commit (H12).
- A group holding a promotion, a paid-call intent or confirmation, or a deliverable record commits with `FULL`, and nothing else does: `FULL` stalled the main thread for up to 190 ms (R3 §2.6; batch 2b §3). A `full` member closes any open `NORMAL` group and commits in its own group at `FULL` (L2). Project-core's writer does this; M0-06 recorded whether SQLite allows `synchronous` to change inside a transaction, and the rule holds either way.
- A predecessor is alive exactly when a process with the recorded PID and start time exists under the same boot ID. This allows an immediate restart after a kill, which A7, `R5-5` and M3-09's `restart` need, and needs no new setting; the heartbeat is an observation only. M0-10's check for a served socket runs first and must agree (B:M3-4; C6, Linux only).
- The writer yields to the event loop between groups: draining a backlog in one turn froze the process for 7.3 s (batch 2b §3).
- `human` settings are exactly `db.commit_tick_ms`, `unknown.resend_max`, R5's five `budget.*` settings, `compute.usd_per_hour`, `net.per_host_concurrent`, `net.max_concurrent`, `llm.max_concurrent` (G15 class (a), holding U11's ceiling, range 1 to 8; B:M3-12), `cache.max_gb` and `retention.*` (R5 §5, K5, K7); `spec.max_fraction` is `director` (K7, G22), as are B:M3-7's `llm.recover_interval_s`, `llm.recover_rate_fraction` and `breaker.failure_count`. Ranges follow default and type (G15).
- Event delivery is at least once, in `seq` order; subscribers re-read state (R5 §2.4).

**Tests.** `packages/scheduler/test/store.test.ts`: an old instance ID changes nothing; nothing is delivered before commit; cursor replay is ordered and complete; one failing member leaves nine committed; a `FULL` member never commits in a `NORMAL` group; the `human` set equals the list above. `packages/scheduler/test/store.linux.test.ts` (L18), since it reads `/proc`: a second instance is refused with `SPACE_IN_USE` while the first is alive; after the first is killed, a new instance starts at once; a live process with the recorded PID but another start time does not count as the predecessor.

**Done when.** `npm run check` and `npm test` pass, and `npm run test:linux` passes in WSL on a freshly synced mirror (L18); if `packages/project-core` changed, M0's 200-kill promotion drill passes again.

**Out of scope.** Job logic (M3-02); the H12 claim tests (M3-10); the `event` table itself (M2-05).

### M3-02 — Jobs, work-key cache, futures and `plan_to_jobs`

- **Care:** normal
- **Package:** `packages/scheduler`
- **Depends on:** M3-01     **Parallel with:** none
- **Live calls:** none

**Goal.** `request()` is get-or-create by work key, with states, consumers, dependencies, groups, ranges, quarantine and failure memory; `plan_to_jobs` turns a Render Plan into jobs.

**Read first.** R1 §2.4, §4.3. R5 §2.2, §2.3, §2.4, §2.7 (Late results). R4 D5 (Execution), D6. R6 D6.1 (the `Predicate` note). lld/11 FR9, FR10, B:SD1, B:M3-6.

**Build.** `src/jobs/api.ts` (`request`, `view`, `until(job_id, need)`, `release`, `retry`, `quarantine`); `src/jobs/states.ts` (R5 §2.2's transitions as data, and the one writer of `job.state`); `src/jobs/graph.ts` (`job_dep`, groups over `job_child`, `job_range`); `src/plan_to_jobs.ts`. `Predicate` and `Need` are imported from foundations, not declared here (B:SD1).

**Rules that are easy to get wrong.**
- One `job` row per work key, ever: it is the deduplication, the cache (`work_key` → `result_ref`) and the memory of a `deterministic` failure, whose diagnostic an identical request gets back. There is no cache table (R5 §2.3, §7 item 1).
- A work key holds no revision, plan, branch, entity ID, purpose, priority or budget; those sit on `job_consumer`, and `view` reports the asking consumer's revision and plan (R5 §2.2). Jobs pin `pin_hash` (I18).
- A caller whose acknowledgement was lost repeats the request and joins the same job (R5 §2.1).
- A quarantined result stops resolving and permits exactly one re-run (R5 §2.3, FR9). After that re-run, a second quarantine turns the job into a remembered `deterministic` failure whose diagnostic is the quarantine evidence; its `result_ref` no longer resolves, an identical request returns that diagnostic with no attempt, and only `job_retry` runs it again (B:M3-6).
- An ended, unsucceeded job is declared again by a new request unless it is a remembered `deterministic` failure; `retry` (Director only) re-runs even that (R5 §2.2).
- `plan_to_jobs` produces exactly R5 §2.4's list, including one `job_dep` and one `completion` predicate per `depends_on` edge and a single consumer carrying `revision_id`, `plan_id`, branch and `purpose`. For `delivery` it refuses unless rung and grade are `final` and every pinned commitment is `frozen`; the handler then returns `NOT_READY`.

**Tests.** Unit: one key, two requests, one job, two consumers; a succeeded job is a hit with no attempt; a `deterministic` failure returns its diagnostic with no attempt, and `retry` re-runs it; quarantine, one re-run, second quarantine, no third run, and an identical request then gets the `deterministic` failure with the quarantine evidence and no attempt, until `retry`; group state and ranges; `plan_to_jobs` is deterministic, refuses `delivery` with a `provisional` commitment, and plans sharing a chunk share its job.

**Done when.** `npm run check` and `npm test` pass.

**Out of scope.** Running jobs and evaluating predicates (M3-03); budget and speculation (M3-05).

### M3-03 — Readiness, attempts, executors and dispatch

- **Care:** normal
- **Package:** `packages/scheduler`
- **Depends on:** M3-02     **Parallel with:** none
- **Live calls:** none

**Goal.** Predicates release waiting jobs; executors run fenced attempts under heartbeats and a stall watchdog; retries follow the failure class; dispatch follows priority, ageing and fairness.

**Read first.** R5 §2.4 (Readiness predicates), §2.5, §2.7 (Retry), §2.11. R2 §2.8. R6 §4. R1 §4.3. R4 §3 (the frame-packet builder). lld/11 B:SD1, B:M3-8-weights.

**Build.** `src/readiness/oracle.ts`: `ReadinessOracle`, over foundations' `Predicate` and `Need` (B:SD1), answering `completion` itself, `commitment` and `acceptance` through a thin adapter over the plain answer functions of M2's reads, `validation` through M3-07. `src/exec/capability.ts`: `register_capability({name, version, effect_class, cost_tier, resources, retention_tier, executor})`, `Executor`, `AttemptContext` (`heartbeat`, `signal`, `register_process_group`, `store_blob`), and the `PaidAdapter` type. `src/exec/attempt.ts`, `retry.ts`, `dispatch.ts`. The fault-point hook: a no-op by default, with all point names in one list. Where it lives is the implementer's choice; one function in `packages/foundations`, which every package already imports, is recommended, so that render, project-core and the harness can place points with no new edge. It reads one environment variable, never project data or model output, and SIGKILLs its own process when the named point matches; a reviewer confirms this (A:testing-10). Executors for M1's four capabilities; the render executors build each chunk's frame packets with the compiler's builder and pass them to `chunkRender` (B:O1a).

**Rules that are easy to get wrong.**
- Completion is `UPDATE … WHERE attempt = ? AND ended_at IS NULL AND lease_owner = ?`, after every result blob is stored; zero rows is a stale report, dropped (R5 §2.2, §2.5).
- A job leaves `waiting` when its own predicates and those of at least one active consumer hold (R5 §2.4).
- A stalled model stream is ambiguous, since the request was written (R5 §2.6); a stalled capture or FFmpeg attempt has its group killed and is `transient` (R2 §2.8).
- `retry.transient_max` is 3, or 4 for HTTP 529, with R5 §5's jittered back-off; a chunk that kills its browser twice becomes `deterministic` (R5 §2.7).
- A job takes the highest class among its active consumers, and nothing is preempted. Ageing raises a job one class per `priority.age_step_s`; within a class the branch with fewest resource-seconds goes first, then earliest `order_hint` (R5 §2.11). In v2 every branch weighs 1 and no weight is stored; the weight "the Director may change" waits until a tool needs it (B:M3-8-weights).

**Tests.** Unit with stub executors: `all` and `any` across job and consumer parts; a stale completion is dropped; a stalled attempt is killed and retried, then `failed` after `retry.transient_max`; HTTP statuses map as R6 §4; a starved `final` job rises after one `priority.age_step_s`; fairness and `order_hint` order.

**Done when.** `npm run check` and `npm test` pass; `npm run test:render` runs one real `chunk.render` through the Scheduler.

**Out of scope.** Pools (M3-04); paid calls (M3-05); cancellation and restart (M3-06).

### M3-04 — Resource pools and limiters

- **Care:** normal
- **Package:** `packages/scheduler`
- **Depends on:** M3-03     **Parallel with:** M3-07, M3-08
- **Live calls:** none

**Goal.** Every pool and limiter of R5 §2.8 grants permits to dispatch.

**Read first.** R5 §2.8, §5. lld/11 H1, U11, G15, B:M3-7.

**Build.** In `src/pools/`: vector acquisition; `browser` (sized by R5 §2.8's memory formula, one smaller after an out-of-memory kill, a live guard on `MemAvailable`, one interactive slot, `pixi.unit_browsers` per PixiJS unit); `capture_browser`; `ffmpeg_heavy`; the model limiter (request and token buckets per model at `llm.limit_fraction` of `ModelLimits`, one global cap); the paid-API limiter; the per-host limiter (with `Retry-After`); the breaker; the disk guard; a JSON-lines decision log.

**Rules that are easy to get wrong.**
- A vector's parts are acquired together in one fixed order (R5 §2.8).
- At most 8 model requests in flight across all models (U11), starting at `llm.start_concurrent`; `llm.max_concurrent` is `human`, range 1 to 8 (B:M3-12).
- On HTTP 429 or codes 1002, 1039, 1041, 2045–2047 the rate halves and concurrency drops by one; both recover additively: after each `llm.recover_interval_s` (30) with no throttling signal, concurrency rises by one and each bucket's rate by `llm.recover_rate_fraction` (0.1) of its ceiling, up to `llm.max_concurrent` and the bucket limits (B:M3-7). These are unmeasured starting values; `R5-3` at M4 revisits the first two. The token bucket is charged the estimate, then corrected from `usage` (R5 §2.8).
- `breaker.failure_count` (5) consecutive `transient` failures from one provider or host open the breaker for `breaker.open_s` (B:M3-7).
- `capture.run` never shares a browser with rendering, which has no network (R5 §2.8).

**Tests.** Unit with fake memory and clocks: 11.7 GB with a 4 GB reserve gives 8, capped at 6 (R5 §2.8); no lease under `mem.low_water_mb`; a PixiJS unit never holds two browsers; randomised acquisition never deadlocks; 20 model jobs against a slow stub start at 2 in flight and never exceed 8; a 429 halves the rate and drops concurrency by one, and one quiet `llm.recover_interval_s` later concurrency is one higher and the rate 0.1 of the ceiling higher; per-host spacing works; the breaker opens on the fifth consecutive `transient` failure, not the fourth.

**Done when.** `npm run check` and `npm test` pass.

**Out of scope.** Budget and intents (M3-05).

### M3-05 — Budget ledger, speculation and the paid-call protocol

- **Care:** high
- **Package:** `packages/scheduler`
- **Depends on:** M3-04     **Parallel with:** M3-07, M3-08
- **Live calls:** none

**Goal.** Spend is booked and enforced; speculation is gated; every paid call writes its intent before sending, spools its reply, and is confirmed, rejected or reconciled with at most one bounded resend.

**Read first.** R5 §2.6, §2.9, §2.10, §2.12, §4. R1 §4.3 (Revision 1). R6 D7, D8, §4 (budget paragraph). R7 §2.1. R9 §3.3, §3.6. R10 §3.2 A7. lld/11 FR10, G2, G22, K7, U15, B:M3-8-scope, B:M3-9-draw, B:M3-9-rounding, B:M3-11-resend, B:M3-11-state.

**Build.** `src/budget/ledger.ts`: the `budget_scope` tree (film root; revision cycles, experiments, workers; the `delivery` scope that `delivery_finalize` opens under the film root, B:M3-9-draw); entries `reserve`, `commit`, `release`, `presumed` in integer micro-dollars, every amount rounded up to the next micro-dollar (B:M3-9-rounding), with tokens by kind and milliseconds; compute booking; notification thresholds; `budget(scope)`. `src/budget/speculation.ts`. `src/paid/intent.ts`, `spool.ts`, `protocol.ts`, `reconciler.ts`.

**Rules that are easy to get wrong.**
- At most one unresolved intent per work key, which is the idempotency key wherever accepted (R5 §2.6 item 1).
- Permit, then intent, then send (R6 D7): one `FULL` transaction writes the intent as `sent` (request hash, estimated maximum cost) and reserves that cost before any byte leaves (item 3).
- Reply bytes are spooled to `spool/<intent>` as they arrive; a complete reply's blobs are stored `durable`, then one `FULL` transaction confirms, books usage and completes the job (items 4, 5).
- The charge is the price of the reply's `usage`, never the reservation, which assumes no cache hit (U15; R5 §2.6).
- Definitely unsent (no request byte written, or HTTP 4xx, 429, 5xx, 529 or non-zero `base_resp` before content): intent `rejected`, reservation released. Anything else: intent `unknown` and job `unknown_outcome`, a state, never a failure class, moved only by the reconciler (item 6; R1 §4.3).
- Reconciler: `queryable_task` polls the stored task ID. `none` salvages a complete spool; else books `presumed` (estimated input plus output seen) and resends once within `unknown.resend_max` and the film's remaining `budget.duplicate_spend_usd`; else fails `policy` with a notification event (R5 §2.6). A cancelled call is settled as presumed charged too.
- `unknown.resend_max` counts per job row, for the row's life: neither a new request after `failed` (`policy`) nor `job_retry` resets it; the first send after a job is admitted again is a new send, not a resend (B:M3-11-resend).
- An intent settled as presumed charged ends in the state `presumed`, the same word as the ledger entry: a terminal, settled state whose spool may be deleted after `retention.logs_days`, after which the single-flight rule lets the resend write a new intent (B:M3-11-state).
- Passing a hard limit at any ancestor fails the job `policy` (the handler's `BUDGET_EXCEEDED`); of two joining scopes the first pays (R5 §2.10).
- `budget.delivery_reserve_usd` is withheld from all other work (R5 §2.10). Jobs of the `delivery` scope may draw on it: the final export, and the final-file checks and review T7 that the handler adds. The Director session's own `model.call` jobs may draw on it once the film's other spend has reached `budget.hard_cap_usd` − `budget.delivery_reserve_usd`, or once the `delivery` scope is open, so that the Director can still call `delivery_finalize` or `director_report_blocked`. No other job may (B:M3-9-draw).
- The treatment share notifies at `treatment.budget_fraction` × `budget.soft_target_usd` and never stops work (G2, G22).
- On `provisional` inputs an `expensive` job holds in `declared` without `allow_speculative`; a `moderate` one runs while speculative spend is under `spec.max_fraction` of the scope budget (R5 §2.9). The scope budget is the consumer's `budget_scope` hard limit or, if that scope has none, its nearest ancestor's, which at the film root is `budget.hard_cap_usd`; speculative spend is measured over that scope and its descendants (B:M3-8-scope).

**Tests.** Unit, with an in-package stub adapter: the intent commits before the stub sees the request; each fault classifies correctly; salvage books one `commit`, no `presumed`; one lost reply gives one `presumed` and one resend; two give two `presumed`, `failed` (`policy`), two requests; a small allowance gives no resend; `job_retry` after that gives no second resend; a settled presumed intent is in state `presumed`; an ancestor's limit refuses; the commit is price(`usage`), not the estimate; an amount of 1.2 micro-dollars books 2; a worker job cannot draw on the delivery reserve, a `delivery`-scope job can, and the Director's `model.call` can only past the threshold or with the scope open; speculation in a scope without its own limit is measured against the nearest ancestor's; every speculation cell.

**Done when.** `npm run check` and `npm test` pass; the review is closed.

**Out of scope.** Restart (M3-06); real model and audio adapters (M4, M5).

### M3-06 — Cancellation, supersession, restart recovery and retention

- **Care:** high
- **Package:** `packages/scheduler`
- **Depends on:** M3-05     **Parallel with:** M3-07 to M3-09
- **Live calls:** none

**Goal.** Cancels and supersession end attempts cleanly, a restart settles every job in flight, and eviction follows the tiers.

**Read first.** R5 §2.5 (Restart), §2.6 (Reconciler), §2.7, §2.12, §4. R3 §2.6 (Blob store), §2.14. R10 §3.2 A11. lld/11 H7, H8, FR10, B:M3-4.

**Build.** `src/cancel.ts` (`cancel(target)` returning `CancelOutcome`), `src/supersede.ts`, `src/recovery.ts`, `src/retention.ts` (`blob_roots()`, eviction, spool and log deletion).

**Rules that are easy to get wrong.**
- Cancelling a consumer only releases it; a shared job continues (`shared_continuing`). A job left with no active consumer has its attempt signalled (capture stops after the frame; FFmpeg gets SIGTERM, then SIGKILL after `cancel.grace_s`; a stream is aborted) and is `stop_pending` until the attempt ends. A session cancels only its own tree (R5 §2.4, §2.7).
- Cancel and completion are ordered on the one writer. Completion first: `completed_before_cancel`. Cancel first: a valid late result is cached under its work key, else `cancelled`. The released consumer is never resolved, even when completion and release share a group; nothing is promoted (R5 §2.7).
- A finished orphan serves a later request with its key; the Scheduler never moves the accepted head (FR10). An orphan not yet running becomes `superseded`; a running one finishes if `pure` with under `orphan.finish_max_s` left or a paid call is in flight, else it is aborted (R5 §2.7). How "time left" is estimated is the implementer's choice, since a wrong guess costs time, never money or correctness; the suggestion is elapsed time × remaining units ÷ units done from the progress reports, and abort when there is no estimate (B:M3-8-orphan).
- Restart: kill the old instance's groups, end its attempts, move each job to `ready` (nothing sent), `unknown_outcome` (an unresolved `sent` intent) or `failed` (`policy`) for an interrupted `external_interactive` attempt not declared repeat-safe (H8); reconcile; re-evaluate waiting jobs (R5 §2.5). How groups are recorded is the implementer's choice, since `R5-5` fixes the result to observe (no live orphan group); the recommendation keeps R5's wording: a reused browser's group is recorded on every attempt that leases it, through `AttemptContext.register_process_group`, and restart kills each distinct group recorded on any attempt of a dead instance, sparing any group whose leader's start time differs from the recorded one (B:M3-5). The old instance is dead by the PID, start-time and boot-ID rule of M3-01 (B:M3-4).
- Keep unresolved intents' spools; delete settled spools and logs after `retention.logs_days` (R5 §2.12).
- The Scheduler never deletes a blob. Eviction clears `result_ref` only for blobs referenced solely as re-creatable cache results, never `irreproducible` ones for space; `blob.grace_hours` is the only grace (H7).

**Tests.** Unit: each `CancelOutcome` value; both race orders, forced through the fault-point hook, checking job, consumer and ledger; the orphan rules; an in-process restart moves each kind of job correctly; roots include a chunk's segment and sidecar; `derived_cheap` is evicted least-recently-used above `cache.max_gb`, `irreproducible` never.

**Done when.** `npm run check` and `npm test` pass; the review is closed.

**Out of scope.** Killed-process tests (M3-10).

### M3-07 — The check runner

- **Care:** normal
- **Package:** `packages/quality`; in `packages/project-core`, the `evidence` table and `closure_hash` (L5)
- **Depends on:** M3-03     **Parallel with:** M3-04 to M3-06, M3-08
- **Live calls:** none

**Goal.** `check.run` is a Scheduler capability whose executor, the check runner, is the only writer of validation records, stored in the `evidence` table this package adds.

**Read first.** R9 D1, D2, D7, §3.1 (opening; "Supplied by other stages"), §3.4, §3.5 (bundle), §4. R5 §2.4 (`validation` predicate), §2.5 (`check.run`), §2.7. R3 §2.8 ("Stale evidence"), §2.11, §2.12. R1 §4.3. lld/11 FR9, FR10, FR13, K4, G7, L5, B:X2, B:O9, B:M3-10.

**Build.**
- In `packages/project-core`, before any record is written (L5; B:X2): the `evidence` migration with R3 §2.11's indexed columns, registered through `registerMigrations`, and `closure_hash` (R3 §2.8), the hash of the sorted `(entity, pin_hash)` pairs in a subject's dependency closure, over M2-02's dependency index.
- `src/runner/registry.ts` (`register_check`: ID, version, type, scope, the settings and Quality Intent fields read, the hard-constraint kinds it proves (`proves: kind[]`, B:O9), `needs(subject)` returning job specifications, resource vector, `run`); `executor.ts`; `oracle.ts`; `quarantine.ts`. The registry is the `CheckCatalogue` that replaces M2-04's stub.

**Rules that are easy to get wrong.**
- The work key hashes check ID and version, input hashes, and the values of the settings and Quality Intent fields read (R9 D1).
- One validation record per check job, an `evidence` row with `origin_kind: check`, a `closure_hash` and a bundle body (R9 D1, §3.5; R3 §2.8, §2.11). Nothing else writes one (FR13); author repair rounds write none (K4). A readiness-only change leaves the `closure_hash`, and so the evidence, current (R3 §2.8).
- A missing input, crash or timeout gives `UNKNOWN`, never `PASS` (R9 D1). A crash or timeout inside a check is a `transient` attempt failure, retried up to `retry.transient_max`, and writes no record; if the last attempt also crashes or times out, the runner writes the one validation record with verdict `UNKNOWN` and a coverage record naming the failure, which is the cached result, run again only by `job_retry` or after an input changes. A missing input gives a cached `UNKNOWN` at once (B:M3-10; R1 §4.3).
- When a registered check proves a hard constraint's kind, stage 7 refuses a `by: reviewer` proof of it with `PROOF_REQUIRED`, `expected` naming those checks, and a `by: check` proof must name a registered check (B:O9). The starting mapping is `rights_scope` → R-01 and `essential_claim` → K-01, registered when those checks are built.
- Checks declare the artifacts they need; the Scheduler requests them as dependencies of the check job (FR10).
- A job result failing a hard check is quarantined through the Scheduler, permitting one re-run (FR9). No verdict deletes anything or blocks promotion (R9 D2).

**Tests.** Unit with two fixture checks: one record per job, with its `closure_hash`; an unchanged input is a hit with no second record; a setting the check reads re-keys it, an unrelated one does not; declared needs become dependency jobs; one crash is retried and writes no record, and a crash on every attempt writes one `UNKNOWN` record with a coverage record naming the failure, which an identical request then gets with no attempt; a missing input gives a cached `UNKNOWN` at once; a hard `FAIL` on a stub mux result quarantines it, the mux re-runs once, a second `FAIL` gets no third run; `validation` holds only after a `PASS`. In project-core: `closure_hash` changes when an entity in the closure changes its `pin_hash`, and not on a readiness-only change; a fixture check declaring `proves: [duration]` makes stage 7 refuse a `by: reviewer` proof of a `duration` constraint with `PROOF_REQUIRED`.

**Done when.** `npm run check` and `npm test` pass; the `evidence` migration runs in order after M2's and M3-01's scripts.

**Out of scope.** The catalogue (ladder checks at M4, the rest at M5 and M6), and so the real `proves` mapping; completion state and deliverable record (M6).

### M3-08 — Stub capabilities

- **Care:** normal
- **Package:** `tests/fixtures/stubs/`
- **Depends on:** M3-03, M2     **Parallel with:** M3-04 to M3-07
- **Live calls:** none

**Goal.** Reusable fakes for a component author, a paid provider and the render capabilities, with controllable faults.

**Read first.** R6 D6.1, D6.2 (shape only), D7. R7 §2.1. R5 §2.5 (catalogue), §2.6. R3 §2.7 (grants, read sets). R10 §3.2 A1, A7, A11; R10 §4.2 (M2 and M4 rows: views are M4's).

**Build.**
- `fake_author`, a `subloop.run` executor: reads a snapshot and records each entity it reads with M2-05's `record_read`, so the job's read set exists (views stay at M4; B:O17), stores a fixed component as a `durable` blob, writes a patch proposal on `w/<job>`, returns a `WorkerOutcome`; a hold point before returning.
- `fake_provider`: a loopback HTTP server in the test process, so its request log (the provider's bill) survives killing the Space process, with a `PaidAdapter` registrable as `model.call` (streamed, `usage` last) or `voice.synthesize` (whole body). Modes: normal, `reply_lost` (read the request, never answer), `reset_after_bytes`, `error_event_after_bytes`, `slow`, HTTP 429 and other statuses; reconciliation `none` or `queryable_task`.
- `fake_render`: `chunk.render`, `film.concat`, `film.mux` executors writing small blobs in R2 §2.9's result shape, with hold points.

**Rules that are easy to get wrong.** The fakes use public interfaces only, never retry, and need no key and no network beyond loopback (01 §4).

**Tests.** Each mode behaves as named; the log counts each request once.

**Done when.** `npm run check` and `npm test` pass.

**Out of scope.** Real adapters (M4, M5).

### M3-09 — Fault-injection helpers

- **Care:** normal
- **Package:** `tests/fixtures/faults/`
- **Depends on:** M3-08     **Parallel with:** M3-06, M3-07
- **Live calls:** none

**Goal.** Helpers that hold a job, kill the Space process at a named point, drop a reply and restart.

**Read first.** R10 §2.2 (H12 and `R5-5` rows), §3.2 (A1, A7, A11). R5 §2.5. Batch 2b evidence §4.

**Build.** `space_process`: a Space owner in a child Node process, driven over IPC. `kill_at(point)`: the child pauses at the fault point and signals the parent, which sends SIGKILL. `hold(point)` and `release()`, in process and across IPC. `drop_reply(n)`. `restart(space)`. `live_groups(pgids)` from `/proc`. `race(a, b)`: two transactions commit in a chosen order.

**Rules that are easy to get wrong.** Kill the Node process only, leaving its browser and FFmpeg groups orphaned as a real crash would. The helpers that kill processes or read `/proc` need Linux, so their self-tests go in `*.linux.test.ts` files (L18).

**Tests.** A self-test per helper.

**Done when.** `npm run check` and `npm test` pass, and `npm run test:linux` passes in WSL on a freshly synced mirror (L18).

**Out of scope.** The acceptance and claim tests (M3-10).

### M3-10 — Acceptance cases A1, A7, A11 and the M3 claim tests

- **Care:** normal; written by a test author
- **Package:** `tests/acceptance/`, `tests/claims/`
- **Depends on:** M3-06, M3-07, M3-09     **Parallel with:** none
- **Live calls:** none

**Goal.** The tests that prove R10's "done when" for M3.

**Read first.** R10 §2.2, §3.2 (A1, A7, A11). R5 §2.1, §2.5, §2.6, §2.7, §9 (`R5-5`). R3 §2.7 (Read sets). lld/11 FR10, FR11, H12, L1, B:SD2. Batch 2b evidence §3, §4. Environment §10.

**Build.** The six test files listed under Tests.

**Rules that are easy to get wrong.** Assert R10 §3.2's observables exactly; never read private state to make a case pass (00 §8 rule 5). The abrupt-stop drill ends every WSL process on the machine, the render lock's holder and any Space included (environment §10), so it runs with nothing else using WSL, no other subagent active there; and it is driven from Windows, since a driver inside WSL would end with the stop. How the Windows-side driver is started is the implementer's choice; it is not part of `npm run test:claims`, which runs inside WSL. The result is labelled "abrupt VM stop", never power loss (L1).

**Tests.**
- `tests/acceptance/A1-stale-worker.test.ts`: hold the fake author, promote a patch changing an entity it read, release. Pass: the component is the job's `result_ref`, and an identical request is a hit with no attempt; Project Core refuses to merge the proposal with `STALE_READ_SET`, listing exactly the changed entity (B:SD2); the accepted head is still the test's promotion. A second run, whose patch touches nothing the job read, merges.
- `tests/acceptance/A7-crash-after-paid-call.test.ts` (`voice.synthesize`, reconciliation `none`). (a) `kill_at` after the reply is fully spooled, before confirmation; restart. Pass: `unknown_outcome`, then `succeeded` with the spooled reply; one `commit`, no `presumed`; one request at the provider. (b) `drop_reply(1)`: one `presumed`, one resend, `succeeded`. `drop_reply(2)`: two `presumed`, `failed` (`policy`), a notification event, no third request.
- `tests/acceptance/A11-cancel-races-completion.test.ts`: completion first; cancel first, result still delivered; cancel first, no result. Pass: `completed_before_cancel`; cached under the work key; `cancelled`. In every order the released consumer never resolves with the result, an unreleased consumer does, and no head-accepted event exists.
- `tests/claims/H12-grouped-rollback.test.ts`: member 5 of 10 fails; nine commit; none of its rows or events exist. Twenty kills inside an open group: `integrity_check` ok, no member of that group present, every acknowledged commit present. At `NORMAL`, 50 transactions per second for 60 s keep arrival-to-commit p99 at or under 50 ms (batch 2b: 25 ms), and a 500-per-second burst for 30 s keeps up, as grouped commits did in batch 2b. The factor of two is a test tolerance, not design.
- `tests/claims/H12-abrupt-vm-stop.test.ts`, the abrupt-stop drill (L1): a write load runs in WSL on the mirror, promotions and intents committing `FULL` and other work `NORMAL`, each acknowledgement reported to the Windows side, outside WSL; the Windows-side driver terminates WSL with `wsl.exe --terminate` at a seeded random moment while the load runs, restarts it and checks the database. The number of stops is the test author's, stated in the M3 report, since L1 gives none. Pass: after every stop, every acknowledged `FULL` commit present, `integrity_check` ok, head equal to the last `accepted_log` row. This tests the guest's unsynced data, not the host's own write cache, so true power loss on a deployment disk stays ASSUMED until M11 (L1).
- `tests/claims/R5-5-restart-recovery.test.ts`: kill Node during a real `chunk.render` capture, an FFmpeg encode, a fake model stream (before and after its last event) and a grouped commit. Pass: after restart no recorded group has a live member; the killed render resumes with the exact frame count; a complete spool is salvaged with one charge, an incomplete one booked `presumed` and resent once. `R5-5` gives no count: use 20 kills per point for commit and stream, 5 for capture and encode.

**Done when.** `npm run test:accept` and `npm run test:claims` pass in the environment of `impl/02-environment.md`, and the abrupt-stop drill passes from Windows, its result labelled "abrupt VM stop" in `docs/impl/reports/claims/H12.json` (L1).

**Out of scope.** A1 with the real author (M4); A7 with the real adapter (M5).

## 6. Claims of R10 §2.2 assigned to M3

| Claim | Test | Fallback (R10) |
|---|---|---|
| `synchronous=FULL` survives power loss on the deployment disk (H12): tested at M3 as an abrupt VM stop; true power loss stays ASSUMED until M11 (L1) | `H12-abrupt-vm-stop` | The affected transactions move to their own commit |
| A grouped commit rolls back cleanly (H12) | `H12-grouped-rollback` | The same |
| Restart recovery kills orphaned child processes and salvages spools (`R5-5`) | `R5-5-restart-recovery` | A leaked browser is caught by the memory guard |

## 7. Live-call budget

None: M3 uses only stubs and a loopback fake provider.

## 8. Acceptance list

| # | Command | Expected result |
|---|---|---|
| 1 | `npm run check` | Exit 0 |
| 2 | `npm test` on Windows, then `npm run test:linux` in WSL on the mirror (L18) | All unit tests pass in about a minute, with no network |
| 3 | `npm run test:accept` | A1 (both runs), A7 (a) and (b), A11 (three orders) pass with M3-10's counts |
| 4 | `npm run test:claims` | `R5-5-restart-recovery` passes with zero live orphan groups (a killed render resumes; orphaned browsers are removed); `H12-grouped-rollback` passes with M3-10's figures |
| 4a | The abrupt-stop drill, driven from Windows with nothing else using WSL (L1) | `H12-abrupt-vm-stop` passes after every stop; the report labels it "abrupt VM stop" and marks true power loss ASSUMED until M11 |
| 5 | `npm run test:render` | Still passes (M1 regression) |
| 6 | Milestone review | A reviewer confirms R10 §4.2's M3 row item by item |

## 9. Resolved points

Every point this document raised is closed by section 18 of the [integration decisions](../../lld/11-integration-decisions.md), with the classes of `impl/research/open-points-B.md` (rows `B:M3-1` to `B:M3-12`, multi-part rows named by a short word as section 18 names them) as the lead ruled on them (`impl/research/lead-decisions.md`).

| # | Point | Resolution |
|---|---|---|
| 1 | **Grouped writer** | Decided (L2; B:SD4, B:X1): Project Core owns the grouped writer, built by M0-06; M3-01 wraps it with the instance fence and event dispatch. A `FULL` member closes any open `NORMAL` group and commits in its own group at `FULL`; M0-06 records whether SQLite allows the level to change inside a transaction, and the rule holds either way |
| 2 | **Power-loss method (H12)** | Decided by the lead (L1), with no user action: an abrupt-stop drill at M3, terminating WSL from the Windows side while a write load runs and checking the database on restart, labelled "abrupt VM stop" (M3-10). True power loss on a deployment disk stays ASSUMED until M11, when a VM exists. The grouped-rollback half is tested by process death and fault points, as before |
| 3 | **Where `Predicate` lives** | Decided (B:SD1): `Predicate` and `Need` are declared in `packages/foundations` (M0-02); R5 keeps their meaning; the `ReadinessOracle` stays in the scheduler (M3-02, M3-03) |
| 4 | **Instance liveness** | Decided (B:M3-4): `scheduler_instance` records PID, start time and boot ID; a predecessor is alive exactly when that process exists under the same boot ID; no new setting; the refusal is `SPACE_IN_USE` (A:M0-4) (M3-01) |
| 5 | **Process groups** | IMPLEMENTATION DETAIL (B:M3-5), left to the implementer: it touches no other module or shared name, and `R5-5` fixes the result to observe. Recording a reused browser's group on every attempt that leases it, and sparing a group whose leader's start time differs, is recommended (M3-06) |
| 6 | **A result quarantined twice** | Decided (B:M3-6): option (a), a remembered `deterministic` failure carrying the quarantine evidence, re-run only by `job_retry`; R9 then sets `blocked` (FR9) (M3-02) |
| 7 | **Missing numbers** | Decided (B:M3-7): new `director` settings `llm.recover_interval_s` = 30, `llm.recover_rate_fraction` = 0.1 and `breaker.failure_count` = 5, unmeasured starting values that `R5-3` at M4 revisits (M0-05, M3-04) |
| 8-weights | **Fairness weights** | Decided (B:M3-8-weights): every branch weighs 1 and no weight is stored in v2, until a tool needs one (M3-03) |
| 8-code | **The read-set refusal's code** | Decided (B:M3-8-code, as B:SD2): `STALE_READ_SET`, built by M2-06, asserted by A1 (M3-10) |
| 8-orphan | **A running orphan's "time remaining"** | IMPLEMENTATION DETAIL (B:M3-8-orphan), left to the implementer: only a `pure` orphan is judged this way, so a wrong guess costs time, never money or correctness; an estimate from progress reports, aborting when there is none, is suggested (M3-06) |
| 8-scope | **The "scope budget" of `spec.max_fraction`** | Decided (B:M3-8-scope): the consumer's `budget_scope` hard limit, else its nearest ancestor's, `budget.hard_cap_usd` at the film root; spend measured over that scope and its descendants (M3-05) |
| 9-draw | **Who may draw on the delivery reserve** | Decided (B:M3-9-draw): jobs of the `delivery` scope that `delivery_finalize` opens, and the Director's own `model.call` jobs once the film's other spend reaches the cap minus the reserve or the scope is open; no other job (M3-05). R6's budget paragraph and R9 §3.6 change with it, at M4 and M6 |
| 9-rounding | **Micro-dollar rounding** | Decided (B:M3-9-rounding): every ledger amount rounds up to the next micro-dollar (M3-05) |
| 10 | **A check's `UNKNOWN` after a crash or timeout** | Decided (B:M3-10): a `transient` attempt failure, retried up to `retry.transient_max` with no record; after the last attempt, one cached `UNKNOWN` record with a coverage record; a missing input gives a cached `UNKNOWN` at once (M3-07) |
| 11-resend | **What `unknown.resend_max` counts** | Decided (B:M3-11-resend): per job row, for the row's life (M3-05) |
| 11-state | **The settled state of a presumed-charged intent** | Decided (B:M3-11-state): `presumed`, terminal and settled (M3-05) |
| 12 | **`llm.max_concurrent`** | ANSWERED (B:M3-12): it is `human` by G15 class (a), holding U11's decision; R5 §5 lacks the mark and is corrected, with range 1 to 8 (M0-05, M3-01, M3-04) |

The batch also settled two findings outside the list: the `FULL` member's group (B:X1, decided by L2, point 1) and the unassigned `evidence` table and `closure_hash`, now built by M3-07 in project-core before it writes records (L5; B:X2).
