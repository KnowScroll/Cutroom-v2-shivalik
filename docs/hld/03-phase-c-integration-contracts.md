# Cutroom v2 — Full-System HLD · Phase C: Integration Contracts

**Accepted design baseline:** 14 November 2026  
**Status:** **PHASE C ACCEPTED** — HLD-level cross-subsystem contracts and invariants. **Not** a finalized wire protocol, LLD, framework choice, performance benchmark, or implementation authorization.  
**Predecessors:** [Phase A: boundaries and ownership](01-phase-a-system-boundaries-and-ownership.md) · [Phase B: production lifecycle](02-phase-b-production-lifecycle-and-autonomous-quality.md)  
**Details and prior alternatives:** [DSL/IR](../research/01-dsl-compiler-executable-render-ir.md) · [layers/compositing](../research/02-layers-compositing-and-incremental-revision.md) · [animation](../research/03-animation-behavior-and-capability-growth.md) · [media/rights](../research/04-asset-retrieval-rights-and-preparation.md) · [harness/experiments](../research/05-agentic-harness-and-experiment-agent.md) · [integration evidence](../research/06-integration-evaluation-and-source-register.md) · [coordination/futures](../research/07-production-coordination-futures-and-spatial-contracts.md) · [versions/lineage](../research/08-versioning-lineage-and-experiment-memory.md) · [quality/recovery](../research/09-quality-evaluation-review-and-recovery.md)

> **Interpretation and scope.** The nine interfaces below are **logical contracts, not nine services or mandatory independent data models**. Data may be grouped in one project structure, a few libraries, or processes selected later. Exact names, JSON/TypeScript types, RPC protocols and stores remain open. The **main Director/Harness is the central autonomous controller**, not the renderer, reviewer or scheduler. Cutroom v2 creates original visuals via LLM-authored **code and conventional rendering**, with **no image-generation or video-generation models**. It may use authentic internet media with sufficient provenance and rights. The **source of truth is the versioned editable semantic project**, not the generated MP4, a worker chat transcript, or the production blackboard.

## C0. Integration architecture and common guarantees

Phase A establishes **eight logical subsystem owners**: Director/Harness; Project Core; flexible Production Studio; Compiler/Execution Planner; Scheduler/Artifact Futures; Rendering/Finishing; Quality System (including callable Reviewer); callable Experiment Agent. Phase B establishes dynamic production graphs, commitments before artifacts, local timelines, scoped workers, diagnostic-first QA and autonomous delivery. **Phase C specifies how these systems agree on data and failures.**

### Cross-cutting invariants — required

1. **Identifiable and versioned:** Every consequential published decision, scene context, source, component, job, result and finding can be traced to a stable subject and an immutable version or content reference. IDs of entities are distinct from IDs of their revisions.
2. **One authority per kind of state:** Project Core owns accepted project revisions and authoritative semantic history; Scheduler owns job lifecycle; producers own the content they propose; Director owns creative strategy and autonomous acceptance. A blackboard is a *query view* over these, not another master.
3. **Scoped authority:** Invocations declare their intent, permissions and permitted edits. Workers may request wider changes but cannot quietly override accepted project content, brief constraints, policy, or another worker's scope.
4. **Readiness is typed:** Exploring/provisional commitments, completed artifacts, technically validated artifacts, internally accepted candidates, and delivery-eligible results are **not synonyms**. A consumer states what readiness it requires.
5. **Dependency compatibility, not only chronology:** A result finishing later is not automatically newer or better. Before reuse/promotion, check the exact relevant inputs, semantic dependencies and execution conditions; invalid or unknown dependencies trigger focused revalidation.
6. **Jobs are bounded and observable:** Track cost/resources, failures, cancellation, diagnostic evidence, and stable work identity. One execution-retry owner per side effect; duplicates must not create duplicate accepted commits.
7. **Reproducible render boundary:** Frozen execution inputs cannot silently change mid-render. Components are time-addressable on declared local clocks; stateful effects expose the necessary preparation or replay rules.
8. **Diagnostic-first QA:** Intermediate imperfections and failed trials are preserved as evidence. Soft findings cannot automatically destroy or reject usable work; the Director chooses repairs and creative acceptance. Only true non-negotiable constraints can block **successful final delivery**.
9. **No mandatory human gate:** The Director can accept a working candidate, revise, revert and deliver under predeclared brief/policy constraints. A failure to meet a hard requirement must be reported, not mislabeled a successful delivery.

### Common operation identity — conceptual, not one forced payload

At meaningful boundaries (long-running jobs, separately versioned work, external effects, cross-worker handoffs), operations need the functional equivalents of:

| Shared information | Purpose |
|---|---|
| Project ID; target entity/scope; base revision | Locate the intended work and pin its assumptions |
| Task/attempt ID and correlation/causal parent | Deduplicate, trace, retry, and relate resulting evidence |
| Capability/goal and expected result kind | Invoke replaceable tools or specialists through the harness |
| Input/dependency refs and required readiness | Know what the worker may safely assume |
| Authorized change scope, brief locks, policy/budget | Prevent unrelated edits and hidden cost escalation |
| Result reference or diagnostics with provenance | Make output inspectable and retrievable without flooding LLM context |

**Do not** introduce a network request envelope around each SVG path, pure function or tiny in-process draw call. Exact field names and serialization are deferred. Common identifiers/evidence refs can be shared by all nine contracts.

---

## C1. Capability Invocation — Director/Harness to tools and workers

**Owner:** Director/Harness (control); invoked capability executes within its scope.  
**Purpose:** Request concrete work without requiring a standing agent for every specialty. Supports direct tools, plugin-provided capabilities, in-process tasks and bounded specialist workers.

**Minimum handoff:** task/correlation IDs; project and immutable base/input refs; goal and expected output; permitted mutations and forbidden changes; brief/quality constraints; resource/time/token budget; relevant previous findings; reporting requirements.

**Outcome:** accepted/scheduled work reference, successful artifact/patch proposal, or evidence-rich diagnostic/blocker. Long work may report progress or partial readiness through C4. The worker can retrieve relevant authoritative project context instead of receiving the full Director conversation.

**Invariants:** A worker may propose an out-of-scope modification but cannot self-authorize it; a successful tool call never implies the produced artifact is creatively accepted; no routine result forwarding needs a model turn.

**Failure behavior:** Missing inputs → typed blocker; insufficient scope → requested expansion/escalation; unexpected tool failure → C4 operational recovery; creative conflict → Director decision. Preserve evidence and any valuable partial output.

## C2. Project Revision & Patch — canonical editable state

**Owner:** Project Core (integrity); Director (selection/acceptance).  
**Purpose:** Version semantic production state at useful granularity: brief/constraints, scene/shot, object, action, visual layer, narration, timing, source/claim, code component and decision. Supports candidate branches and rollback without remaking unaffected work.

**Minimum operations:** read coherent snapshot for a revision; propose scoped candidate patch against expected base; compare semantic/source differences; inspect dependent references; attempt conflict-checked promotion; restore an earlier state by new accepted transition; retrieve lineage and evidence.

**Invariants:** Stable entity ID ≠ immutable revision ID; one accepted working head at a time, many candidate branches; all promotions are atomic with respect to the accepted head and active locks/policy; rejected branches and their failures remain inspectable; a code/media artifact is not the project master.

**Conflict rule:** File-disjoint edits may still conflict semantically through camera, event timing, framing, cross-layer effects, sources, style or audio. Safe reuse requires dependency compatibility, not merely equal filenames. If validity is uncertain, revalidate rather than silently merge.

**Failure behavior:** Stale base or semantic conflict → diagnostic explaining affected entities, both revisions, and reconciliation options; no silent overwrite. A late task result may remain a reusable artifact but cannot auto-promote the accepted head. No exact Git/DB/CAS implementation selected.

## C3. Production Commitment / Scene Context — early producer-consumer coordination

**Owners:** Relevant Studio producer proposes; Project Core versions/publishes; consumers declare which commitment/revision they use.  
**Purpose:** Allow planning/cheap reversible downstream work before the final producer artifact exists.

**Minimum properties:** stable identity and published revision; subject and validity interval; `exploring`, `provisional`, or `frozen for execution` readiness; explicit exposed assumptions and unknowns; named temporal/event anchors; spatial/camera coordinates or safe/occupied regions when relevant; stylistic/source or factual dependencies where relevant; eventual deliverable expectations.

**Concrete domains:** castle/volcano bounds and smoke/plume envelope for staging; painting feature anchors under crop; UI element/cursor target for tutorial; source claim + verified dataset for chart; accepted narration timestamps for captions/lip sync; rhythm markers for motion graphics. Not all commitments require spatial fields or a universal geometric solver.

**Invariants:** Consumers pin the specific commitment version and readiness, not an unversioned verbal promise. Provisional assumptions permit bounded speculative work but cannot be silently substituted for required frozen inputs. A commitment is **not** evidence that final pixels or legally usable media already exist.

**Failure behavior:** A changed camera, claim, audio event, safe zone, crop or data value supersedes the relevant commitment and triggers dependency checks; affected consumers replan or revalidate. Others continue. Studio workers may directly coordinate a narrow adjustment, but must publish the agreed change rather than storing it only in chat.

## C4. Work Job / Artifact Future — asynchronous execution and readiness

**Owner:** Scheduler for job state/retry/resource allocation; producers for result content; Project Core for semantic dependencies and accepted usage.  
**Purpose:** Express a versioned expected result and its completion independently from the physical worker, layer or media file used to produce it.

**Minimum properties:** work identity, capability/producer, frozen or declared inputs, expected artifact kind and properties, dependency/readiness predicates, budget/resource class, job status, cancellation/supersession, attempt history, partial output ranges and final ArtifactRef/diagnostic.

**Possible lifecycle (illustrative):** declared → waiting/ready → running → partial_available → completed/failed/cancelled/superseded. **Job completion**, **artifact validation** and **Director acceptance** remain different decisions. Partial interval readiness must include the exact frame/time coverage and revision, not just a vague percentage.

**Invariants:** Scheduler releases tasks only when the consumer's prerequisite readiness is satisfied; bounded concurrency and backpressure prevent excessive memory pressure; cache/deduplication requires compatible input closure and requested execution settings; only one party owns operational retries for a side effect. The same work may physically execute more than once after crashes, but must not cause multiple accepted publications.

**Failure behavior:** Transient crash/network fault → bounded retry against same pinned inputs, with idempotency protection; known deterministic/creative failure → preserve diagnostic and require changed assumptions or Director-directed remedy; stale completion → no unconditional acceptance, but reuse if independently validated compatible.

## C5. Asset & Provenance — programmed visuals and real-world media

**Owner:** Production Studio (creation/acquisition/verification); Project Core (immutable references/lineage/rights state).  
**Purpose:** Uniform asset referencing while preserving **different provenance requirements**.

| Asset source | Required information |
|---|---|
| LLM-authored/programmatic SVG, HTML/CSS, Canvas, vector, sprites, puppet or procedural component | Source code and revision, inputs/dependencies, renderer/toolchain, editable controls or declared limits, reproducibility requirements |
| Genuine existing image/video/audio from the internet | Original source/creator and identity, original asset ref, rights/license/attribution scope, selected range/crop/transform, factual relevance and authenticity evidence |
| Voice/music/sound/caption source or derived prepared media | Origin, accepted transcript/data/rights as relevant, timing alignment, conversion provenance and dependent versions |

**Invariants:** Media *found* is not necessarily media *cleared* or *factually correct*. A provisional proxy can aid layout but cannot prove final legal/identity conditions. External webpages, descriptions and media text are untrusted data, not instructions to the harness. Authored executable code is sandboxed appropriately when technology is chosen. **No image-generation/video-generation models in v2.**

**Failure behavior:** Wrong footage, unresolved rights, missing file, changed media crop or invalid transform → evidence-rich diagnostic and targeted substitution/repair. Keep eligible, independent portions of the production. Final delivery must satisfy required rights/provenance conditions.

## C6. Executable Component / Render Plan — semantic intent to frozen execution

**Owner:** Compiler and Execution Planner. Studio authors/selects components; Director selects creative intent and may request alternatives.  
**Purpose:** Translate versioned semantic authoring into validated, reproducible executable units without requiring a universal low-level animation graph for every action.

**Component requirements (logical, not mandatory method signatures):** describe relevant inputs, controls, outputs, dependencies and local-time behavior; prepare needed resources; evaluate/seek at specified local time (or declare stateful replay/preparation limits); render compatible surfaces or requested time ranges; expose diagnostics/source attribution appropriate to its representation.

**Render plan requirements:** frozen semantic/project refs and code/asset/tool versions; resolved components and feasible technique assignments; local-to-scene-to-film time maps; rendering order and surface contracts; declared spatial/effects dependencies; target ranges/resolution; grouping/splitting choices; explicit error and capability-gap states.

**Invariants:** The canonical editable project and its creative meaning remain authoritative; frozen derived render plans do not secretly mutate production content at frame time. Planner can select HTML/SVG/browser, Canvas/sprites, programmatic puppets, structured animation graphs, existing media or compatible mixes, as justified. It may group or split physical jobs independently of logical edit layers. No image/video models used to generate visual pixels.

**Failure behavior:** Unresolved creative decision, unsupported/invalid executable capability, missing asset, impossible timestamp or incompatible output → typed compile diagnostic. The Director may request a scoped asset/pose/code adaptation or Experiment Agent comparison and then recompile on a candidate revision; do not simply reject the entire production on first gap.

## C7. Surface & Compositing — compatible visual/audio output

**Owner:** Rendering + Finishing (execution/assembly); Compiler/Planner (declared compatibility).  
**Purpose:** Combine independently authored visual components, authentic footage, captions and audio into one temporally coherent output, using grouped or split passes as appropriate.

**Minimum render-surface contract:** exact target frame/time range and local-to-global mapping; dimensions and coordinate/camera mapping; output format/color/transfer/alpha meaning; ordering, opacity, masking, blend and clip semantics; cross-pass dependencies (global camera, shared lighting/glow/shadows); pinned source and renderer versions; partial availability, errors and valid ranges. Audio path includes time alignment, sample timing, channel/mixing and final mux dependencies where needed.

**Invariants:** A layer is a logical edit/staging entity, not mandatory individual MP4. Compositor sees execution-ready compatible surfaces; staging conflicts should be resolved by Studio/Director upstream. Render each valid interval once when efficient, with selective reuse and bounded buffering. The renderer cannot reinterpret factual claims or invent missing choreography. Color/alpha and exact clock rules must be specified consistently by the eventual technical LLD.

**Failure behavior:** Conflicting time bases, mismatched alpha/color, incorrect z-order, cross-layer effects, unavailable intervals or source mismatch → isolate the affected pass/range, report evidence and repair/re-render where required; do not regenerate unrelated creative work. Encode errors should not force rebuilding accepted source animations.

## C8. Diagnostic / Review / Experiment Evidence — actionable observations

**Owner:** Any producer may emit diagnostics; Quality System owns technical and Reviewer evaluation; Experiment Agent owns trials; Project Core retains evidence lineage; Director decides corrective creative actions.  
**Purpose:** Share a single **evidence-reference convention**, not one agent or scoring rubric.

**Common evidence minimum:** target entity + exact artifact and project revision, expected behavior, actual observed behavior, location in time/frame/object/asset/log, evidence refs (not just an assertion), source or test basis, severity or impact, certainty/UNKNOWN, attempted work, plausible causes clearly marked hypotheses, possible corrections and projected dependency impact/cost when available. Tiny deterministic errors may carry only the meaningful subset; do not force long reports for trivial faults.

**Reviewer-specific:** context-pinned original brief, relevant accepted intent, independent source/ground-truth material, actual frames/clips/audio and prior decisions. Fresh scoped reasoning is allowed and desirable; it must not merely inherit Director assumptions. Read-only by default. Findings support Director judgment; subjective critique cannot independently invalidate a working artifact.

**Experiment-specific:** frozen base, scope, variants, controlled conditions, budget, metrics, observations, negative results, comparative evidence and recommendation. Trials work in isolated branches, never mutate accepted head. Preserve outcomes to prevent identical failed retries without forbidding changed hypotheses.

**Invariants:** **Diagnostic-first, not rejection-first** (the Cutroom v1 correction). Intermediate flaws can remain visible and be repaired, compared or carried with explicit limitations. A technical pass does not prove creative quality. Review coverage must specify actual evidence inspected—sampled stills do not imply full-video temporal review. No permanent separate Debugging Agent is mandated.

**Failure behavior:** If root cause is unknown, report `UNKNOWN` plus reproducible observations and investigative options. The worker may make bounded in-scope repairs; broader narrative/layout/claim changes escalate to the Director. An independent Reviewer and Experiment Agent are callable **when useful**, not unconditional stages.

## C9. Final Deliverable — autonomous acceptance and export

**Owners:** Director (creative acceptance and delivery), Quality (evidence and hard invariant checks), Rendering/Finishing (export), Project Core (accepted and delivered revision/lineage).  
**Purpose:** Bind the **actual exported output** to the approved production and evidence that it fulfills the brief.

**Minimum record:** exact project revision and dependency closure, final file reference and properties, asset/code/toolchain identities, necessary source/rights attribution, validation coverage and findings, completion state, known limitations and deliverable revision history.

**Invariants:** The Director may promote candidates and deliver **without routine user permission**. Confirm essential delivery constraints on the **exported file**: duration/format/coverage, visual+audio synchronization, source/rights/factual requirements, material quality and full-sequence cohesion. Bounded optional polishing stops when further improvement is not worth delay/cost; exhausted budgets do not turn a failed hard requirement into success. Subsequent edits create new delivered revisions.

**Failure behavior:** Missing audio or broken exported MP4 → repair finishing and revalidate the actual file, preserving prior accepted creative assets/scene state. Unresolved essential rights/brief/data requirement → report incomplete/blocked; do not claim successful final delivery. Soft concerns remain Director-directed, not automatic v1-style rejection.

---

## C10. Cross-boundary ownership and event semantics

| State / event | Authority | Consumers and handling |
|---|---|---|
| Creative decisions, accepted project head, protected brief | Project Core for state; Director for artistic selection | Workers obtain version-pinned views, propose patches |
| Layout/fact/timing/other commitments | Studio producer for content; Project Core for durable revision | Dependent producers declare required readiness and pinned version |
| Task readiness, execution attempt, retry, cancellation, resource accounting | Scheduler | Workers publish outcomes; Director receives meaningful blocker/exception events |
| Compiled executable plan | Compiler/Planner | Scheduler runs only the frozen, compatible plan |
| Rendered surfaces/media | Renderer/Finishing | Compositor/Quality consumes exact ranges and versions |
| Findings/experiments and repair hypotheses | Quality/Experiment/producer; Project Core retains evidence | Director selects optional creative changes, targeted recovery or delivery |
| Deliverable publication | Director authorizes; Project Core records; Finishing produces output | Consumers receive exact exported artifact and provenance |

**Events are notifications, not project truth.** Examples: commitment published, artifact range available, job failed, project revision accepted, candidate superseded, diagnostic ready, deliverable exported. Consumers should query the authoritative state and tolerate event duplication/reordering, instead of assuming an event means all current dependencies are valid. Event format/transport remains open.

**Coordination pattern:** A shared blackboard **view** over Project Core and Scheduler state; scoped read/write sets, direct worker-to-worker messages where truly helpful, and recorded published commitments as the lasting outcome of any negotiation. No LLM turn needed to forward standard artifacts. The main Director receives concise events and can retrieve full evidence, protecting context budget. Tools and workers do not become mandatory subagents. No additional top-level subsystem is introduced.

## C11. Cross-domain contract tests and failure traces (HLD thought experiments)

| Domain | Critical contract combination | Expected recovery / preservation |
|---|---|---|
| **Historical comedy** | Scene spatial and speech-event commitment → character component → combined render → temporal review | Reaction/prop jump gets frame-linked diagnostic; revise action or staging; reuse unchanged castle/map; preserve failed experiment evidence |
| **Science/maglev documentary** | Verified claim, legitimate footage, technical diagram and narration timing → final factual review | Wrong train footage or revised physical claim invalidates affected media, labels, diagrams and spoken claims; unrelated sound/visuals reused |
| **Art-history essay** | Authenticated artwork with named feature anchors + crop transform → annotation component | Changed crop reprojects dependent annotation/pointing only; source/rights retained |
| **Software tutorial** | Versioned actual UI states and cursor event schedule → callouts/narration | UI update invalidates affected screenshots, steps and callouts; retain unaffected transitions |
| **Financial/data reel** | Verified dataset revision + labels/chart geometry + narration claims | Changed numeric fact updates semantic references and invalidates dependent chart, caption, audio where relevant; styling may remain |
| **Abstract motion graphics** | Programmable components + local-time maps + audio beat contract + renderer | Timing drift prompts targeted time-map/animation fix; no unnecessary factual media or character subagents |

**Required future acceptance cases:** a stale worker completes after an upstream revision; two disjoint file edits conflict semantically; a provisional scene bound changes; a cross-layer lighting/mask pass requires grouped execution; a failed experiment is rolled back; a known defect is preserved in a provisional preview; a worker crashes after an external effect but before reporting success; a final MP4 is missing audio. These test cases are **not implemented** and do not claim measured performance.

## C12. Final A–C consistency review and boundaries

| Review point | Result and interpretation |
|---|---|
| Phase A authority vs C interfaces | **Consistent.** Director controls decisions/acceptance; Project Core arbitrates state; Scheduler governs running jobs; Reviewer/Experiment Agent remain callable specialists, not second directors |
| Phase B asynchronous futures vs C commitments | **Consistent.** A published provisional contract may unblock reversible work, but does not stand in for final artifact readiness or full delivery validation |
| Editable layers vs parallel render jobs | **Consistent.** The logical layer is not a required process/clip. Compiler/Planner may split or co-render based on interdependence and cost |
| Prior deep DSL/IR research vs default code components | **Consistent when current Phase A/B decisions govern.** The structured semantic project and frozen execution remain; universal object-curve/rig detail is optional by component |
| Cutroom v1 rejection behavior vs Quality | **Consistent.** Soft intermediate findings are diagnostic evidence; only final hard invariants can block successful delivery. Director controls creative correction |
| Autonomous Director vs protected constraints | **Consistent.** Brief/policy can define hard conditions without imposing routine human approval. Project Core protects revision integrity; Quality reports evidence |
| Internet media vs no generative image/video models | **Consistent.** Source acquisition is permitted and subject to authenticity/rights; original graphics are programmatically authored and conventionally rendered |
| Version control vs stale task completion | **Consistent.** Frozen input refs and conflict checks prevent automatic publication into an incompatible accepted revision, without wasting valid reusable work |
| Cross-domain coverage | **Logical stress tests complete**, not real integration/quality benchmarks. All six categories map to the same contract set; no special permanent agent required for each |

**Historical-document caution:** The preserved v3.1 mother proposal and older subsystem research include now-superseded passages about image/video generation models, creator approval as default, and overly rigid universal IR. These are historical proposals, **not current v2 decisions**. Do not erase prior research merely to hide earlier alternatives. Read the Phase A–C accepted HLD and `AGENT.md` first; their supersession statements govern the present project.

**HLD exit gate:** The nine logical contracts have named owners, minimum inputs/outputs, invariants, readiness/failure semantics, and cross-domain traces. **Phases A, B, and C are accepted at the HLD architecture level.** This is **not** evidence that performance, quality, reliability, or any concrete implementation has been validated. The next session should begin focused framework/technology comparisons and then subsystem LLD + integration acceptance test designs; implementation remains unauthorized until explicitly approved.

## C13. Technical decisions intentionally still OPEN

- Harness/runtime/plugin implementation (DSH, Pi, Claude Code-inspired custom integration, other); specialized agent model/providers and context retrieval mechanics.
- Exact wire/types/schema methods for invocation, revision/patch/merge, artifact futures, evidence, spatial and temporal formats, and surface transport.
- Project store/database/CAS/Git/event-log implementation, semantic diff/merge details, retention and cache eviction.
- Job persistence/queues/worker processes, retry/lease/idempotency algorithm, browser/GPU resource scheduling and distributed-versus-desktop topology.
- Renderer choices and actual grouping/streaming/frame-range approach, clock representation, pixel/color/alpha/mask formats, GPU/CPU transfer, audio synthesis/mix/encode stack.
- Rights/provider integrations, actual quality evaluation/checker policies/rubrics and empirical comparisons, budgets, latency/throughput/cost targets.

**No new code or prototypes are requested or authorized by the HLD sign-off.** Collect implementation evidence in targeted technical research and benchmark specific tradeoffs once a prototype is authorized. Keep new research in the corresponding subsystem paper, not this index or the master vision.
