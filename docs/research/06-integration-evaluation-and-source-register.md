# Integration, Evaluation, Open Decisions & Source Register

**Cutroom v2 | Subsystem research | Updated 13 November 2026**  
**Status:** Research and proposed contracts, not approved HLD or LLD; nothing implemented.  
**Parent:** [Main research index](../research-index.md) · [Full vision](../archive/cutroom-v3.1-full-system-architecture.md)  
**Scope:** Cross-cutting invariants, end-to-end scenario, research decision backlog, sources and research limitations.

---

## 13 November Phase B accepted — cross-domain lifecycle and diagnostic-first evaluation

The [Phase B HLD](../hld/02-phase-b-production-lifecycle-and-autonomous-quality.md) formalizes dynamic project revisions/commitments/jobs/artifacts, scoped blackboard/future orchestration, evidence-rich worker outcomes, and three evaluation scopes with **diagnostic-first recovery** instead of Cutroom v1's strict clip rejection. [Quality research](09-quality-evaluation-review-and-recovery.md) owns review/repair depth. Preserve this file's earlier **volcano timing test vector** as one example, **not** the universal production baseline: the HLD also checks historical comedy, science/documentary, art history, software tutorials, data-driven/financial reels, and abstract motion graphics. No such lifecycle or performance test has been executed. The old section "artifacts before HLD" is historical research process and is superseded by the accepted A/B phase boundaries.

## 13 November update — full-system HLD entry (broad engine research completed)

**DECIDED:** The broad engine-research exit gate has been met to begin the **full-system HLD** (Phases A/B have since been documented and accepted; the full HLD is not yet complete/approved). Initial production is 2D and uses **no image/video-generation models**; LLMs write conventional renderable graphics/animation code. User brief is sufficient input. Default visual components are code-rendered, with structured graphs and advanced method selection retained where necessary. Earlier generator-model candidates remain historical, not allowed v2 implementation choices.

**DECIDED:** Independent layer creators are **not free to stage spatially in isolation**: the volcano/layout producer publishes revision-pinned footprints, staging/avoid regions, camera/occlusion and event anchors to characters and captions. The compositor later consumes compatible frames/surfaces. A versioned producer-consumer future contract generalizes to research, story, asset/code preparation, audio, animation, rendering, evaluation and experimentation; physical workers/jobs can be grouped by cost and dependencies. Local time for reusable actions and time-addressable frame execution are strong boundary requirements.

**DECIDED:** Project and entity revisions, patch/branch/rollback, provenance, experiment histories, failure-aware decision memory and dependency-correct artifact reuse are first-class. The goal is time to *accepted* video and fast safe edits, not theoretical render speed. The next phase decides the HLD ownership and minimum contracts, then chooses technology and detailed LLDs, with explicit permission before implementation.

**New research files:** [Coordination, futures and spatial contracts](07-production-coordination-futures-and-spatial-contracts.md) · [Versioning, lineage and experiment memory](08-versioning-lineage-and-experiment-memory.md) · [HLD entry baseline](../HLD-ENTRY.md).

---

## Update — cross-system experiment and capability evidence (12 November 2026)

A new **on-demand Experiment Agent** is a selected architectural direction for Cutroom's research/design, and the adaptive action/technique registry is a working design candidate. Together they enable structured search over renderer combinations, motion/rig methods, DSL lowering implementations and end-to-end production alternatives. They **do not** constitute a benchmark or proof of advantage. Record evaluations per accepted production and preserve candidate lineage.

The research process now separates **overview summaries** (main index) from the five detailed subsystem papers below. This file preserves integration examples, cross-cutting risks, decision gates and the 11 November 2026 source register. Any source claim not independently checked after that date remains historically scoped.

---

# Part VIII — Bringing the five research areas together

## 19. The full Cutroom video creation journey (volcano scenario)

This is the conceptual **end-to-end production** we ultimately want to support; every step remains a research/design goal until validated.

1. **Creator intent:** “Make a funny, accurate 2D volcano explainer; presenter confidently claims nothing will happen, eruption starts behind them, crowd reacts, presenter double-takes late.” Target 9:16, 90 seconds overall; the example shot may be eight seconds.
2. **Director and researchers:** establish topic/claims, decide whether authentic volcano footage, illustrated background or combination best supports the shot; propose at least a couple of distinct treatments if search is enabled.
3. **Asset/code producer:** search permitted sources for genuine volcano footage/photo if useful; otherwise LLM-author SVG/Canvas/HTML/procedural artwork and character/sprite animation code (NO image/video-generation models). Retain code/asset versions, source rights and provenance; prepare background masks/proxies as needed. Publish provisional layout and character-style references.
4. **Create semantic IR:** narrative beat with setup/contradiction/payoff, stable entities, asset bindings, separate foreground/background and caption layers, named speech/eruption/reaction anchors, tone and editing constraints.
5. **Creative resolution:** choose actual voice take, specific character expression/rig capabilities, explosion style, crowd animation, timing offsets and camera treatment; open choices are marked until resolved.
6. **Compile:** validate entities/assets/rights/schedule and version-pinned spatial contracts; lower `double_take` into either selected code-rendered motion or optional structured animation tracks; partition or co-render shot elements as beneficial; create the frozen executable plan, component refs and source maps.
7. **Render:** schedule independent tasks from artifact futures and dependency graph; for each required time/frame range, evaluate shared film time and local component time, render compatible surfaces (possibly together), composite with correct masks/color, apply whole-frame effects and encode. Reuse eligible cached ranges; mix speech/effects/music/captions.
8. **Inspect:** check timing and media technical correctness; look at full output/isolated layers; route nuanced critic(s) for acting, comedy, legibility, and accurate depiction.
9. **Revise and branch:** a reviewer reports character reaction too small. The director creates a branch adjusting only performer expression/timing, preserving dialogue and background wherever safe; compiler computes impacted artifacts; render variant.
10. **Select:** creator or permitted autonomy policy accepts useful portions of alternatives; accepted native project is retained with manifest, final MP4 and comparison/evidence history. Candidate ancestry is not thrown away.

### 19.1 What happens if only the character changes?

**Semantic patch:** modify `presenter.double_take.intensity` or select a different motion clip. The background asset and its original source stay unchanged. The render engine should change only required subplans and recomposite affected frames. If the erupting background casts lighting over the presenter, the character pass must evaluate the relevant illumination input; a cache of the old character pass is not automatically valid. We should expose *why* a cache was reused or invalidated.

### 19.2 What happens if the volcano changes?

**Semantic patch:** choose a different eruption interval, asset or style, without deleting the presenter's identities and accepted voice take. However, if presenter reactions depend on `eruption.start`, their scheduled times and possibly camera movement may need recompilation. A background-only asset replacement can still alter visual readability, so final composition review is required.

### 19.3 Example exact 8-second excerpt at 30 FPS

| Event | Authored or resolved relation | Example absolute time | Nearest output frame sample context |
|---|---|---:|---|
| Dialogue end | Frozen selected audio | 5.00s | frame 150 |
| Eruption begins | speech end + 0.15s | 5.15s | falls between frames 154 (`5.1333`) and 155 (`5.1667`); visible onset policy must be specified |
| Crowd reacts | eruption + 0.20s | 5.35s | between frames 160 (`5.3333`) and 161 (`5.3667`) |
| Presenter double-take | eruption + 0.65s | 5.80s | frame 174 |
| Camera push | reaction + 0.12s | 5.92s | between frames 177 and 178 |

The scene's exact continuous event time may not coincide with a frame sample; the compiler must state whether quantized **visible onset** constraints are satisfied. Audio can start at finer sample resolution. This is a *test vector*, not a live Cutroom render.

## 20. Cross-cutting requirements that every design track must consider

### 20.1 Extensibility without premature multi-engine complexity

Keep the native project model independent of a particular renderer. **But do not spend months implementing a universal adapter standard before testing one 2D path.** The next HLD can state a narrow 2D surface/time/tool contract and reserve future versions for additional modes.

### 20.2 Safety, authorization and trustworthy inputs

Generated executable HTML/JS, imported media, uploaded files and external AI tool calls are untrusted by default. Sandbox execution; restrict filesystem and egress; protect API secrets; guard acquisition against SSRF; use resource/time limits; label untrusted web text as evidence not instructions; validate all agent actions in domain services. Avoid enabling the model to alter compiler correctness checks during routine scene production.

### 20.3 Reproducibility and observability

An accepted production must retain the IR revision, selected media bytes/hashes where permitted, resolved audio takes, model outputs, compiler/renderer versions, font/shader assets, timebase and settings. Exact byte-identical output across different GPU/browser platforms is not assumed; define whether the contract is exact mathematical state, pixels within tolerance, or perceptual conformance. Video code regeneration must be traceable and diagnostics must name the original semantic objects.

### 20.4 Human editing and agent editing remain first-class

A scene/canvas editor, timeline and agent dialog are **projections/operations over the same project model**. AI can propose patches; a human can drag an event; both validate against the same locks and dependencies. Baked conventionally rendered code-to-video output can remain useful, but the project must expose limited editability honestly.

### 20.5 Performance and cost should be measured per *accepted result*

Fast frame rendering may not help if 200 model calls are needed for every successful scene. Cheap one-shot generation may be worse if it cannot support necessary edits. Report separate costs for acquisition, generation, compilation, layer rendering, compositing, reviewing, retries, and creator effort—then compare total cost/time to an accepted production. Avoid claims of engine speed superiority before conformance tests.

## 21. A research evaluation matrix (for later HLD decisions)

| Research dimension | Candidate A: web source | Candidate B: native scene graph | Hybrid A+B |
|---|---|---|---|
| Typography, SVG, CSS layout | Likely strong; test | Depends on text engine; test | Use A for typography; test pixel/color consistency |
| Puppet animation and object controls | Can embed canvas/runtime; test | Native fit; test | Use B for actor, A for labels; test occlusion |
| Frame-accurate random seeking | Supported in HyperFrames with correct adapters; still verify | Requires own pure evaluator/baking | Need shared seek contract and barrier |
| Partial layers and caching | DOM element isolation may limit; test | Render textures offer options; test | Targeted cache opportunities vs transfer cost |
| Seamless cross-layer effects | Single page may help | One graph may help | Most complicated; require explicit passes/fallback |
| Source maps and semantic patches | Codegen mapping required | Typed graph mapping required | Harder but same semantic source possible |
| Failure visibility | Browser logs and screenshots | Object/channel inspection | Need combined traces and layer provenance |
| Licensing | Depends on chosen engine | PixiJS MIT; other libraries differ | All dependencies and combination matter |
| Commercial/operational complexity | Browser rendering + build processes | GPU render worker + media integration | More moving parts and integration tests |

No numerical winner is declared. A sensible research hypothesis is **one canonical executable plan with a deliberate subset that both renderers can execute**; if mixed execution proves too expensive or visually unreliable, begin with a single runtime and retain the neutral IR.

## 22. Prioritized unanswered decisions — not implementation tasks

| ID | Open decision | Why it matters | Evidence needed |
|---|---|---|---|
| D01 | Canonical AST and semantics before textual DSL? | Avoid locking runtime to syntax | Round-trip and semantic capability study |
| D02 | One renderer, A/B per scene, or A/B per layer? | Quality vs orchestration cost | Actual layer compositing and seeking comparison |
| D03 | What is the `Render2DPlan` instruction set? | Defines compiler/runtime contract | State/time/layer/curve/asset spec and examples |
| D04 | Typed declarative program vs generated JS | Safety, control, flexibility | Sandbox and diagnostics plan |
| D05 | Default character representation(s) | Acting quality and editability | Comparative rigs, sprite and vector capabilities |
| D06 | How to express high-level performance? | Core differentiated problem | Action registry, resolving policy, reviewer cases |
| D07 | What is a layer vs surface vs semantic group? | Correct caching and edits | Composition algebra, masks and dependency graph |
| D08 | Who resolves or generates selected voice/assets? | Frozen inputs and determinism | Planned→resolved transition contract |
| D09 | Exact timebase and frame onset rules | AV sync, edit precision | Output sampling and quantization specification |
| D10 | Media provider order and rights model | Authenticity and reliable distribution | API/legal and source eligibility matrix |
| D11 | Harness vs workflow engine ownership | Recovery without duplicate effects | Durable job protocol, failure cases |
| D12 | Review method and acceptance criteria | Quality isn't a type check | Human-rated comparison design and evidence rubric |
| D13 | What permissions for external agents? | Trust and correctness | MCP/CLI tool contract, scopes, audit design |
| D14 | Cache granularity and invalidation | Iteration cost vs stale results | Conservative effect dependency model |
| D15 | Whether the user's DSL is a text language | Usability and maintenance | Text ↔ structured editor round-trip study |

### 22.1 Questions to discuss next, in order

1. Should **Cutroom's own typed executable plan** be the permanent interface between semantic IR and 2D execution, with both HTML codegen and scene-graph interpretation possible?
2. What exact operations and values belong in that plan, and what remains in semantic Performance IR?
3. Do we want an original readable **Cutroom DSL syntax**, or first formalize AST + typed operation vocabulary?
4. Are we comfortable with mixed A+B **at layer/subpass level**, including explicit unsupported cross-layer interactions, or should we first specify scene-level selection?
5. Which actor model and quality criteria must the first 2D performance vocabulary support?

These questions are staged for **research and discussion**. They are not a request to code, select a dependency, or claim a benchmark result.

## 23. Proposed research artifacts to produce before any HLD

- **Language concept paper:** domain ontology, typed values, canonical AST vs surface syntax, transformations and unresolved creative holes.
- **2D execution semantics paper:** sample times, object evaluation, scene graph, curves, stateful effects, audio clock and frame production.
- **Hybrid layer contract:** surface formats, alpha and color, masks, coordinate mappings, occlusion and compositing operations, effect boundaries.
- **Backend comparison dossier:** HyperFrames/HTML vs PixiJS/scene graph vs mixed, with conformance criteria and licensing considerations.
- **Character-performance study:** representation options, primitive registry, channel conflicts, sample controlled performances and review criteria.
- **Media-acquisition dossier:** specific provider APIs, rights matrix, interval finding, downloader security, normalization and provenance.
- **Harness operations paper:** tool contracts, permissions, job workflow, idempotency, retry taxonomy, reviewer/specialist outputs, versioned state.
- **Experiment design:** exactly what prototypes *would* test and what evidence would convince us; do not execute those prototypes until the user elects to implement.

---

---

# Appendix A — Primary-source research register (checked 11 November 2026)

The references below are evidence for **existing capabilities and constraints**, not proof that they are appropriate for Cutroom. Some pages change quickly; pin versions/revisions before design implementation.

## Video execution / composition

1. [HyperFrames repository / architecture](https://github.com/heygen-com/hyperframes) — HTML-native frame seeking, CLI, compositing, release/license statements.
2. [HyperFrames HTML to video research article](https://www.heygen.com/research/html-to-video) — exact-time `seek(t)` and capture model.
3. [HyperFrames engine documentation](https://hyperframes.heygen.com/packages/engine) — headless Chrome BeginFrame and render engine interface.
4. [Remotion renderer](https://www.remotion.dev/docs/renderer/render-frames) and [composition spec](https://www.remotion.dev/docs/terminology/composition) — React frame rendering, FPS/duration.
5. [Remotion current terms](https://www.remotion.dev/docs/terms) — company/automation license and restrictions.
6. [PixiJS rendering systems](https://github.com/pixijs/pixijs/blob/dev/src/rendering/__docs__/rendering.md), [render layers](https://pixijs.com/8.x/guides/concepts/render-layers), [render targets](https://pixijs.download/v8.22.0/docs/rendering.html) — scene graph/targets.
7. [Motion Canvas flow](https://github.com/motion-canvas/motion-canvas/blob/main/packages/docs/docs/getting-started/flow.mdx) — generator-based animation.
8. [CanvasKit](https://docs.skia.org/docs/user/modules/canvaskit/) — drawing and vector/raster possibilities.
9. [Lottie specification](https://lottie.github.io/lottie-spec/latest/specs/layers/) — layer/precomposition/time remapping vocabulary.
10. [W3C Compositing and Blending](https://www.w3.org/TR/compositing-1/) — source-over alpha/compositing semantics.
11. [FFmpeg CLI](https://www.ffmpeg.org/ffmpeg.html), [filters](https://ffmpeg.org/ffmpeg-filters.html), [rawvideo demuxer](https://github.com/FFmpeg/FFmpeg/blob/master/doc/demuxers.texi) — media decode, complex filtergraphs and frames to video.
12. [WebCodecs](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API) — browser-level frame decode/encode.

## 2D animation / performance

13. [Rive state machines](https://github.com/rive-app/help-center/blob/master/runtimes/state-machines.md) and [blend layers](https://github.com/rive-app/help-center/blob/master/editor/state-machine.md?plain=1).
14. [Spine Runtimes](https://en.esotericsoftware.com/spine-runtimes), [animation application](https://us.esotericsoftware.com/spine-applying-animations) — skeletal blending/state/time.
15. [Live2D SDK](https://www.live2d.com/en/sdk/about/), [license](https://www.live2d.com/en/sdk/license/).
16. [Synfig docs](https://wiki.synfig.org/) — 2D vector animation.
17. [MediaPipe face landmark guide](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker) — landmarks/expression blendshape data.

## Assets / rights / security

18. [MediaWiki Imageinfo API](https://www.mediawiki.org/wiki/API:Imageinfo/en), [Commons metadata](https://commons.wikimedia.org/wiki/Commons:Machine-readable_data).
19. [Pexels API documentation](https://www.pexels.com/api/documentation/) and [Oct 2026 policy explanation](https://help.pexels.com/hc/en-us/articles/900005880463-What-are-the-Terms-and-Conditions).
20. [Internet Archive item metadata](https://doc-tools.readthedocs.io/en/ia-test-gsod/md-read.html) and [metadata field reference](https://internetarchive.readthedocs.io/en/stable/metadata.html).
21. [Unsplash API guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines) and [API terms](https://unsplash.com/api-terms).
22. [YouTube Terms](https://www.youtube.com/t/terms) — usage/download restrictions.
23. [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) — remote URL intake safeguards.

## Harness / jobs / language study

24. [Pi SDK](https://pi.dev/docs/latest/sdk), [Pi Extensions](https://pi.dev/docs/latest/extensions), [Pi Durable](https://github.com/earendil-works/pi/blob/main/packages/durable/README.md).
25. [LangGraph interrupts and checkpointing](https://github.com/langchain-ai/docs/blob/main/src/oss/langgraph/interrupts.mdx).
26. [Temporal workflows](https://docs.temporal.io/workflows), [tasks](https://docs.temporal.io/tasks).
27. [MCP tool specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/server/tools.mdx).
28. [Super 8 Languages for Making Movies (ICFP 2017)](https://doi.org/10.1145/3110274) — **independent DSL research reference only, not an architectural adoption**.

## Appendix B — Research limitations and evidence integrity

- All feature claims about external technologies are based on published documentation and repositories, **not measured Cutroom integration**. Product/version availability and licensing may change after the research date.
- No files from the user's Windows project were opened; v3.1 was available as the prior conversation artifact, and this paper uses it as the conceptual parent.
- The IR/DSL snippets, compiler passes, render contracts, asset records, capability checks and traces are **illustrative hypotheses**, not software already built or APIs implemented.
- No empirical data are offered for rendering throughput, human preference, frame stability, model accuracy, per-frame encoding overhead, cache hit ratios or latency; all require a future authorized investigation.
- External provider license compliance cannot be established purely by this document; permission for model training/evaluation must be reviewed separately from permission to use media in published films.
- Deferred 2.5D/3D research remains in v3.1. This paper does not redefine their eventual semantics.
- The 2017 ICFP paper is discussed as precedent, without adopting its implementation, Racket language, MLT backend or typed system.

---

## Process note (agreed project workflow)

**Research and discuss every part first. Then develop and review a complete High-Level Design (HLD). Then develop and review Low-Level Designs (LLDs) for the individual components. Only after those stages are agreed should implementation begin.** This paper is research, not an instruction to implement.
