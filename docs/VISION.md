# Cutroom v2 — Product Vision

**Updated:** 14 November 2026  
**Purpose:** Lightweight product north star for every new session, distilled from the complete [v3.1 original vision](archive/cutroom-v3.1-full-system-architecture.md) and reconciled with the **accepted HLD Phases A–C**. This describes intended capabilities, not an implemented product.

Read [AGENT.md](../AGENT.md) and [HLD-ENTRY.md](HLD-ENTRY.md) for working rules, current decisions and navigation. The accepted HLD governs architecture; this vision preserves product purpose. The v3.1 file is an unchanged reference archive, consulted for original detail rather than required session reading. Its version number names the mother proposal, not a separate active product.

## 1. The outcome: an intentionally directed, editable film

Cutroom is an autonomous **brief-to-finished-video creative production system** and a persistent audiovisual workspace. Given audience, purpose, taste and constraints, it researches, invents treatments, writes, creates visuals and characters, directs performance, acquires genuine media, builds sound, inspects results, revises and delivers. The initial target is **60–120-second portrait-first reels**, typically 9:16; the project model should allow other layouts and durations, with longer scene-based productions an eventual extension.

Its value is the chain from intent and evidence to chosen performances and observed output. Preserve why a beat exists, what it claims, which alternatives were considered, what was selected, what the finished film actually showed, and why a revision was accepted. The native project remains editable after export; an MP4 is a deliverable, not the project master.

## 2. Creative direction is central

Direct the viewer's understanding and experience, not just a sequence of clips. Research factual claims and important visual implications; distinguish supported facts, simplifications, interpretations and fictional/comic expression. Plan narrative setup/payoff, character versus audience knowledge, staging, attention, pacing, transitions and continuity.

Tone can change within one film: curiosity, clarity, sarcasm, absurdity, tension, restraint and awe are available choices. Humor is optional and must serve the brief. Serious work deserves equally deliberate direction. Visual treatments should vary with the beat: authentic footage, diagrams, typography, sketches on photographs, expressive characters or compatible mixtures. Avoid reducing production to one image per sentence or a single compulsory aesthetic.

Search for **meaningfully different productions**, not paraphrases. Explore hooks, narrative structures, medium choices, acting, camera, voice takes, sound and timing. Retain strong alternatives with different quality/cost/taste trade-offs; no universal numeric score settles every creative choice. Develop ideas through suitable evidence—scripts, storyboards, timed animatics, selective renders and finished sequences—without forcing every task through a fixed funnel or candidate count.

Scoped mutation, repair, retiming and recombination should preserve useful work. A new candidate may combine one branch's hook, another's explanation and another's performance, after checking setup, continuity, timing, style, rights and locks. Judge a comic pause through actual moving pictures and sound; a script or keyframe alone cannot establish performance quality. Stop exploration when further expected benefit does not justify its cost or delay.

## 3. Current v2 production boundaries

**2D first. No image-generation or video-generation models.** LLMs may author SVG, HTML/CSS, Canvas, vector/procedural drawing, sprite/puppet animation code and structured production instructions. Conventional engines render and encode the pixels. User-prepared character assets are optional: Cutroom should invent and create programmatic visuals from the brief and reuse suitable versioned assets.

Existing genuine photographs, artwork, screen captures and footage are first-class inputs when identity, factual relevance, provenance, rights and attribution are sufficient. Discovery is not clearance; attractive but incorrect footage must not stand in for evidence. Preserve originals and declared crop/trim/annotation mappings. Clearly distinguish expressive overlays from authentic source material.

The default visual unit is a **code-rendered component** with exposed controls, dependencies and local-time behavior. Richer object/scene/animation graphs are available when useful for control or editing; a universal low-level rig/curve representation is not mandatory. The Director/planner may select techniques at object, action, layer or shot scope, supported by a versioned evidence-backed technique registry that permits fresh experimentation. Renderer and framework choices remain open.

## 4. Expressive performance, picture and sound

Maintain recognizable character appearance, voice and object identity across scenes. Actions include gaze, anticipation, holds, double takes, staggered reactions, entrances, prop handling and background business—not just geometric movement. Readable, smooth, style-appropriate acting matters more than mandatory anatomical realism. Pose changes or simple prop motion may suffice; rigs, IK, contact constraints and more detailed motion remain options when justified.

Represent causal event relationships so edits remain meaningful: moving an eruption can move its crowd reaction, camera jolt and sound while preserving a locked voice take. A plausible missing pose, motion or control should prompt bounded programmatic adaptation or an experiment during production. Validate and version the result before frozen execution; rendering must not secretly invent choreography or modify source assets.

Camera, composition, occlusion, typography and transitions direct attention. An event scheduled correctly can still be hidden or unreadable. Publish enough shared scene/spatial/event context for independent producers to stage compatible work before pixels exist.

Audio is direction: expressive speech and selected takes, pronunciation, music phrases, effects, ambience, silence, intelligible mixing and deliberate synchronization. Freeze selected waveforms; distinguish measured sample duration from estimated word/phoneme alignment. Captions need faithful text, timing, readable layout and appropriate language support. Localization can require a new timed performance and layout, beyond translated text.

## 5. One editable workspace, reversible decisions

A Cutroom Space retains brief, sources, conversation, treatments, assets, candidates, previews, jobs, costs, evidence and exports. Preserve the ambition for linked storyboard, stage/canvas, timeline, script/voice, asset library and synchronized candidate-comparison surfaces, with accessible direct editing and human steering. These are product ambitions, not a claim that their UI is designed or built.

Human and agent edits use the same authoritative semantic project, initially a renderer-neutral typed DSL/AST in structured JSON with an optional TypeScript builder; a custom textual parser is deferred. Stable identities, versioned code/assets, scoped patches, protected decisions, candidate branches, conflict checks, rollback and source maps make local changes traceable. Distinguish semantic changes, execution invalidation and review impact: unchanged pixels can acquire a different narrative meaning. Reveal actual editing limits; assigning an ID to a baked clip does not expose its internal objects.

The creator can steer, stop, lock or revise work. **The v2 Director autonomously accepts revisions and delivers under the brief and policy; routine human approval is not required.** Optional intervention settings do not turn every internal promotion into a human gate. Export and external publishing remain distinct operations.

## 6. Autonomous production with accountable evidence

One modular **Director/Main Harness** controls eight logical responsibilities: Director/Harness, Project Core, Production Studio, Compiler/Execution Planner, Scheduler/Artifact Futures, Rendering/Finishing, Quality System and callable Experiment Agent. These do not prescribe eight agents or services. Use lean plugin/tool access and scoped workers where useful.

The lifecycle is a dynamic graph of revisions, commitments, jobs and artifacts. Early provisional commitments can enable reversible work; consumers declare needed readiness and pin dependencies. Logical editing layers need not be separate videos or processes: group or split execution when appropriate. Frozen render inputs, compatible surfaces/time maps, cache-aware invalidation, bounded concurrency, cancellation and durable recovery protect accepted work. Reconcile uncertain external effects before retrying paid work. The blackboard is a view of authoritative project/job state, not another master.

**Quality is diagnostic-first.** Keep imperfect previews and failed attempts, identify observed defects with exact revision/time/object evidence, distinguish hypotheses from facts, and support bounded local repair or Director-led revision. Review component, scene and whole film, including the actual exported file. Record PASS/FAIL/UNKNOWN, inspected coverage and limitations; sampled stills cannot establish unseen temporal quality. Technical validity alone does not prove factual truth, clear acting or a satisfying film.

The independent callable **Reviewer** accesses the original brief, authoritative sources and actual output with fresh critical context; it normally reports read-only findings. The separate callable **Experiment Agent** compares scoped alternatives across the system on isolated branches. Neither replaces the Director or unilaterally promotes accepted state. Hard brief, rights, integrity and essential delivery requirements prevent false claims of success; subjective criticism guides judgment. A depleted budget cannot make a failed requirement pass.

## 7. Durable ambitions and honest progress

Retain eventual **2.5D, 3D and richer hybrid production**, longer-film continuity, collaboration, portable native packages and interchange with disclosed losses, local/hosted/hybrid operation, and external harness access through common governed tools. These are future possibilities, not immediate implementation commitments. Historical image/video-model proposals remain excluded from current v2.

Learn from accepted/rejected alternatives, scoped creator preferences, revisions, costs and failures. Retrieve relevant experience before repeating work; changed hypotheses remain welcome. Learned ranking/search policies and carefully scoped reinforcement learning are possible later approaches, not prerequisites. Audience engagement alone does not establish truth, comprehension or taste. Small formal checkers/Lean are preserved research directions for precise guarantees, not proof of artistic success or an approved stack; the ICFP 2017 language paper remains independent research, not an adopted component.

Judge success by quality and creator fit at a matched budget, factual reliability, first useful preview, time to accepted video, meaningful revision latency, human intervention and total token/CPU/GPU/memory/provider cost. Parallelism and creative search offer hypotheses to measure, not automatic speedups or quality gains. Compare against capable existing workflows. Missing precedent invites bounded invention; it proves neither impossibility nor success.

Keep the original **Maglev** (grounded medium selection), **Picasso** (authentic art plus expressive annotations), **Volcano** (controlled performance search) and **angry mathematician portrait** examples as creative reference cases. Adapt future tests to v2's 2D/no-image-or-video-model limits and also cover historical comedy, software tutorials, data-driven explainers and abstract motion graphics. These are designed scenarios, not completed experiments.

**Current gate:** HLD A–C is accepted at architecture level. Next come focused technology comparisons, subsystem LLDs and integration acceptance plans; implementation/prototypes require separate explicit approval. No Cutroom performance, quality or reliability result is established by these documents.

## Source navigation

- [Phase A: ownership and autonomy](hld/01-phase-a-system-boundaries-and-ownership.md), [Phase B: lifecycle and quality](hld/02-phase-b-production-lifecycle-and-autonomous-quality.md), [Phase C: integration contracts](hld/03-phase-c-integration-contracts.md).
- [Research index](research-index.md): select relevant subsystem depth for the task.
- [Unchanged v3.1 archive](archive/cutroom-v3.1-full-system-architecture.md): A–B product/workspace; C–K harness, execution and verification; F and P–Q editorial/search/evaluation; L–O media/performance/sound; R–X editing, backends, operations and learning; Y–Z examples, acceptance and invention; appendices for original contracts and research. Consult only the needed sections when original detail is required.
