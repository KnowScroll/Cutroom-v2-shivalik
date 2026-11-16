# Cutroom v2 — Full-System HLD Entry & Decision Baseline

**Updated:** 14 November 2026  
**Phase:** **HLD Phases A + B + C accepted** — integration architecture complete at HLD level; focused technology comparisons and subsystem LLDs next.
**Status:** [Phase A](hld/01-phase-a-system-boundaries-and-ownership.md), [Phase B](hld/02-phase-b-production-lifecycle-and-autonomous-quality.md), and [Phase C](hld/03-phase-c-integration-contracts.md) are **ACCEPTED at the architecture level**. Exact frameworks/schemas, technical performance validation, and implementation permission remain OPEN; no product code or prototypes are authorized.

**Post-HLD status (14 November 2026):** the low-level design is complete. **R0 and R1 were accepted by the user; R2–R10 were decided by the lead session under the user's delegation,** verified with throwaway spikes, checked for consistency three times and reviewed by an independent agent before the freeze. Implementation has not started and needs the user's explicit approval. See the [design process and roadmap](lld/00-design-process-and-roadmap.md), the stage designs under [`lld/`](lld/), the [acceptance and build plan](lld/10-r10-integration-acceptance-and-build-plan.md), the [integration decisions](lld/11-integration-decisions.md) and the [spike evidence log](research/10-spike-evidence-log.md). Where this entry says the v3.1 archive may be consulted, the newer rule in [AGENT.md](../AGENT.md) applies: it is not read or used. Section 4 below lists choices as open; those since decided are recorded in `lld/` (language, where it runs, LLM provider, budget targets, time/identity/space conventions).

**Navigation:** [LLD process and roadmap](lld/00-design-process-and-roadmap.md) · [Phase A finalized](hld/01-phase-a-system-boundaries-and-ownership.md) · [Phase B finalized](hld/02-phase-b-production-lifecycle-and-autonomous-quality.md) · [Phase C finalized](hld/03-phase-c-integration-contracts.md) · [Product vision](VISION.md) · [Original v3.1 archive — on demand](archive/cutroom-v3.1-full-system-architecture.md) · [Decision register](research-index.md) · [Subsystem research](research/)

## Session reading and document authority

Start with [AGENT.md](../AGENT.md), [VISION.md](VISION.md) and this entry. Then read the accepted HLD sections and [subsystem research](research-index.md) relevant to the task. For architecture-wide planning or cross-system changes, read all three accepted HLDs. Routine sessions do **not** require the enormous v3.1 file.

VISION.md retains the creative product purpose and long-term ambitions; accepted HLD A–C controls finalized v2 architecture. Research supplies alternatives and evidence, with its historical dates/status preserved where applicable. Consult the unchanged [v3.1 archive](archive/cutroom-v3.1-full-system-architecture.md) only for original examples, rationale or research depth missing from the active documents. Older stage notices and conflicting proposals in the archive or earlier phase/research files do not reopen accepted decisions. If active accepted documents genuinely disagree, flag the conflict instead of silently changing the baseline.

**Current next step:** focused technology comparisons, subsystem LLDs and integration acceptance plans. No product implementation or prototypes are authorized by this documentation task or the HLD sign-off.

## Phase A accepted — concise ownership baseline

- **Main Director/Harness** is the fully autonomous central controller. Modular/plugin-oriented and lean (DSH/Pi-style extensibility, Claude Code-style scoped delegation); it can command every subsystem, without making each subsystem a separate agent.
- **Eight logical responsibilities:** Director/Harness; Project Core; flexible Production Studio; Compiler/Execution Planner; Scheduler/Futures; Rendering/Finishing; Quality System; callable Experiment Agent. **Not eight deployed services.**
- **Quality System:** deterministic validation first where possible, with an independent **callable Reviewer** that has scoped access to the same authoritative project/brief/ground-truth sources and actual render evidence—not just a summary of the Director's claims. Reviewer reports findings and cannot unilaterally modify accepted revisions.
- **Experiment Agent:** separate callable role to test competing approaches on isolated versioned branches and return evidence and recommendations; neither reviewer nor experimenter becomes an alternate Director.
- **Internet image/video acquisition:** Production Studio capability; verified source identity, provenance, relevance, rights, preparation and versioned assets. No image/video generation models.
- **Autonomous acceptance:** Director can promote, revert and deliver revisions based on brief, policies, objective checks and review evidence. No default user approval step.
- **Multi-domain coverage:** Phase B traces historical/comedic, scientific/maglev, art-history, software tutorial, data-driven and abstract motion-graphics productions, not volcano alone.

**Authoritative HLD details:** [Phase A — ownership](hld/01-phase-a-system-boundaries-and-ownership.md), [Phase B — lifecycle](hld/02-phase-b-production-lifecycle-and-autonomous-quality.md), [Phase C — integration contracts](hld/03-phase-c-integration-contracts.md). Read these before interpreting historical alternatives. Keep their detailed rationale outside this entry.

## Phase B accepted — lifecycle and quality baseline

**[Full HLD Phase B — B1/B2/B3](hld/02-phase-b-production-lifecycle-and-autonomous-quality.md)** owns the details. In brief: dynamic production graph with **project revision, commitment, work job, artifact**; exploring/provisional/frozen readiness; version-pinned dependency-aware futures; **shared blackboard as access to existing state, not a new authority**; scoped parallel workers with event-driven results, deduplication and safe merge; evidence-rich failure diagnostics and bounded worker self-repair. The Director remains the autonomous brain and accepted-revision authority. The Reviewer is callable and evidence-grounded; the Experiment Agent compares candidate alternatives.

**Cutroom v1 correction:** v2 checks are **diagnostic-first, not rejection-first**. Preserve imperfect previews and failed attempts; provide precise evidence and proposed fixes. Intermediate issues normally drive Director-led repair rather than automatic clip rejection. Only essential final-delivery constraints block claiming success, while still producing useful diagnostics. Three review scopes (component, scene, whole film); production-specific quality intent; risk-based reviewer calls; candidate comparisons; bounded autonomous iteration; explicit exported-file validation. See [Quality research](research/09-quality-evaluation-review-and-recovery.md).

**Phase C is accepted:** use its integration contracts for focused technical comparisons, subsystem LLDs and integration acceptance plans.

## 1. Non-negotiable direction for the full HLD

- **Brief-in, Cutroom creates the production:** Creative director/harness researches, invents treatment and narrative, writes, makes programmable illustrations/graphics/characters/sprites, directs animation, composes real sourced media, adds speech/audio, reviews and revises. Preserve humor/emotional arcs, creative search and diverse visual treatments; do not turn Cutroom into only a video renderer.
- **Cutroom v2 forbids image-generation and video-generation models.** LLMs may **write deterministic/renderable code** (SVG, HTML/CSS, Canvas, procedural/vector graphics, sprite/puppet logic and typed production instructions); pixels are produced by conventional graphics rendering and encoding. Eligible existing genuine media is allowed under rights/provenance policy.
- **2D first.** 2.5D/3D later, without losing eventual full vision. Target initially reels, vertical 60–120 seconds, but not artificially single-style.
- **Style-appropriate acting**, not maximum physical realism. Simple poses/prop motion/staging are valid if clear and smooth; IK/rigs or more precise contact remain available when a shot benefits.
- **Default visual unit: code-rendered component** with declared parameters, source revision, local time, dependencies and output contract; allow structured scene/object/animation graphs when they make animation or fine editing better. Harness chooses at object/action/layer/shot level. Keep prior deep IR/animation research as available techniques—not mandatory intermediates for every action.
- **One native editable semantic project:** versioned structured DSL/AST (initially JSON/typed, optional TS builder), persistent identity, author intent, review, event relationships and history. Derived frozen 2D execution plan and renderer-specific artifacts; no novel textual DSL required now.
- **Logical layers enable editing and concurrent work.** A layer does not imply a separate video/job/process. Planner may co-render or split tasks. Spatial/event context must be published before dependent workers blindly stage against it.
- **Dependency-aware futures/jobs across production**, including research, creative decisions, layout, character/asset preparation, voice/timing, animation, render frames, compositing, evaluation and experiments. Jobs bind to explicit revisions; partial/provisional commitments and final artifacts are distinct. Bounded concurrency, retries/cancellation and cache-aware incremental preview/revisions.
- **Versioned and reversible at meaningful granularity:** accepted project revisions, object/scene/action/layer/code/asset edits, candidate branches and experiment lineage, conflicts, undo/rollback, dependency-sensitive invalidation and reuse. Record failed approaches and learned context to avoid senseless repetitions without forbidding changed experiments.
- **Agentic harness plus callable Experiment Agent:** Select/try techniques and renderer choices; repair missing capabilities with code-authored programmatic assets/animations and validated branches. Experiment Agent compares scoped alternatives on request, returns evidence; harness governs creative goals and approved revisions.
- **Performance success:** time to first useful preview, time to accepted video, revision latency, memory/CPU/GPU/cost and quality. Never infer speedups merely from the word parallel.
- **Process:** HLD architecture A–C approved → targeted technical comparisons/choices and each subsystem LLD → integration acceptance plan → explicit implementation approval → code/implementation. Technology stacks, service boundaries, data stores and exact schemas remain OPEN.

## 2. HLD subsystems whose interfaces must be designed

The following are **logical responsibilities**, not a predetermined microservice topology:

1. Creator brief, product/session control, budget/permissions and locks.
2. Creative director, editorial research, factual grounding, story/treatment search and script/storyboard decisions.
3. Main agentic harness, tools, revision authority and bounded recovery.
4. Experiment Agent, alternative production branches, evidence and recommendations.
5. Canonical project model/DSL, source maps, semantic revisions, branch/merge/rollback, history, decision memory.
6. Asset/media production: code-created SVG/Canvas/sprites/props/graphics and verified real-image/video/audio sourcing and rights.
7. Scene/layout director and spatial/event contracts for cross-layer collaboration; camera/occlusion context.
8. Behavior/action resolution, capability reuse/adaptation, animation method selection and local-time scheduling.
9. Compiler/validator, minimal executable 2D Render IR, code-artifact packaging and renderer execution manifest.
10. Execution planner, dependency-aware job scheduler/futures, caches, progressive previews and GPU/browser resource management.
11. Rendering adapters and compositing: code-rendered surfaces, optional structured graphs, masks, alpha/colors, global effects, frame seeking.
12. Audio (voice, timing/alignment, effects/music), captions, audiovisual sync and final encoding.
13. Technical/factual/perceptual checks, an optional independent context-aware Reviewer, full-video feedback, traceable semantic revisions and automatic Director-led delivery.

The HLD should consolidate responsibilities where doing so simplifies the system; a list item does **not** automatically create a network service or separate agent.

## 3. Phase C accepted — nine logical integration contracts

The full guarantees, source-of-truth boundaries, readiness, failures and cross-domain consistency review are in **[HLD Phase C](hld/03-phase-c-integration-contracts.md)**. The contracts are: **Capability Invocation; Project Revision & Patch; Production Commitment / Scene Context; Work Job / Artifact Future; Asset & Provenance; Executable Component / Render Plan; Surface & Compositing; Diagnostic / Review / Experiment Evidence; Final Deliverable**.

They share relevant identity/revision/dependency/authority/evidence conventions, but **do not imply nine services, rigid universal schemas or compulsory agent handoffs**. The Director controls creative decisions; Project Core accepted state; Scheduler jobs and retries; the Studio authored/acquired outputs; Compiler execution plans; Renderer outputs; Quality/Reviewer and Experiment Agent evidence. Technical schemas/transport remain for LLD.

## 4. Exact technical decisions intentionally NOT yet approved

- Runtime/framework: browser-based, scene-graph, GPU/canvas, HyperFrames, PixiJS, Remotion, Skia, custom code or compatible mixes.
- Runtime deployment: one process vs multiple workers/services; task orchestration system and queues; CPU/GPU/browsers allocation.
- Exact DSL/IR JSON schemas, animation channel types, source map format and compiler pass implementation.
- Storage: Git, DB, event store, asset CAS, cache implementation, retention/merge algorithm.
- Spatial occupancy/occlusion representation, renderer alpha/color standards, chunk size and streaming protocol.
- LLM provider/models and agent framework, number of agents, experiment rubrics, voice synthesis/audio tools.
- Actual performance, quality or scalability improvements: no Cutroom prototypes/benchmarks have established them.

## 5. HLD consistency review and next-phase gate

**Completed at design level:** [Phase C section C12](hld/03-phase-c-integration-contracts.md#c12-final-ac-consistency-review-and-boundaries) checks ownership/authority, ready-versus-provisional promises, revision validity, layer scheduling, autonomous decision-making and diagnostic-first QA across six content domains. **No real tests or benchmarks were run**; performance, quality and reliability remain empirical hypotheses.

**Next action:** targeted technology comparisons **per subsystem**, detailed LLDs and explicit integration acceptance test plans. Start implementation **only after separate explicit approval**. Preserve original research and vision; use this HLD as the authoritative v2 architectural decision baseline over older historical alternatives.
