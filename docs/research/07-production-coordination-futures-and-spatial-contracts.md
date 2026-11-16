# Production Coordination, Spatial Contracts, Futures & Parallel Scheduling

**Cutroom v2 | Subsystem research + approved HLD inputs | Updated 13 November 2026**  
**Status:** Architectural requirements approved; contract shapes below are PROPOSED, not implementation or measured benchmarks.  
**Parent:** [Research and decision index](../research-index.md) · [HLD entry](../HLD-ENTRY.md)  
**Related:** [Layers and compositing](02-layers-compositing-and-incremental-revision.md) · [Compiler](01-dsl-compiler-executable-render-ir.md) · [Version history](08-versioning-lineage-and-experiment-memory.md) · [Harness](05-agentic-harness-and-experiment-agent.md)

## 13 November Phase B2 accepted refinements — task scopes, shared state and notifications

**DECIDED:** Shared production blackboard = an indexed/readable **view** over authoritative Project Core revisions/commitments and Scheduler job/future/artifact state, not a separate mutable creative memory master. The main Director controls all systems while workers obtain necessary project context by stable IDs and publish versioned results. Direct worker conversations are optional, but their shared decisions must be persisted and revision-pinned. **Events signal changes; authoritative state is reread before consequential action.**

**DECIDED:** Delegate bounded work with **read set, authorized write set, base revision, expected output, constraints, costs and cancellation scope**. Distinguish semantically equivalent jobs (same relevant exact inputs and output specification), not merely same task title. Use existing jobs/futures or cache rather than duplicate work. Avoid reflexive waiting while unrelated critical-path work can continue. Retry ownership is unambiguous for paid/external side effects; transient failures differ from visually unsuccessful techniques. Jobs completed after supersession retain evidence and may be reused only if dependency compatibility is proven. [HLD B2](../hld/02-phase-b-production-lifecycle-and-autonomous-quality.md#b2--subsystem-handoffs-collaboration-and-asynchronous-execution).

**DECIDED:** A failed/poor worker outcome is a **retrievable Diagnostic Evidence Bundle** (expected/observed, precise timestamps/frames/source refs, artifact previews/logs, cause hypotheses and uncertainty, attempted repairs, specific corrections and dependency impact) plus a compact Director notification. Local self-repair is bounded and permission-scoped; cross-system/creative changes escalate. **No automatic rejection of imperfect intermediate clips**; labels and readiness preserve known defects. Quality/death-of-clip policy in [dedicated research](09-quality-evaluation-review-and-recovery.md). Exact task/status/envelope schema remains OPEN.

## 1. Approved principles — distinguish parallel creation from isolated planning

**DECIDED:** Cutroom may prepare/render independent scene layers, objects, actions, shots, assets, audio and evaluation tasks concurrently, using dependency-aware asynchronous jobs or **futures**. The scheduler may combine multiple logical layers into one render job or split a layer into jobs when advantageous. Do **not** assume one layer equals one video, one job, one worker, or one process. Parallel execution is an optimization, not the meaning of the production project.

**DECIDED:** An independent visual producer must expose enough **scene context before its final pixels exist** for downstream producers to avoid overlap, misplaced action, occlusion contradictions and poor staging. The volcano worker can publish a versioned volcano pose/layout footprint and event schedule; the characters producer can plan around that without waiting for final eruption frames.

**DECIDED:** Frame/scene/action/layer time is placed on a common canonical production clock, while reusable visual components may run on local time with explicit mapping. A component's `seek(t)` and render results must be reproducible for a frozen revision, subject to declared stateful preparation/checkpoints.

**DECIDED:** Performance is judged by *time to first usable preview, time to accepted video, revision latency, and resource/cost efficiency*, not just nominal frame render speed. Preserve caching, parallelism, streaming frames/ranges and incremental changes wherever they demonstrably help; measure overhead and regroup work if independent offscreen passes are slower.

**No image- or video-generation models in Cutroom v2.** LLMs may author deterministic SVG/Canvas/HTML/CSS/TS or procedural drawing code and structured animation instructions; rendering is conventional. Authentic pre-existing footage/images may be imported subject to source/rights rules.

## 2. Spatial collaboration: publish layout, not merely a video promise

### Volcano staging example

The volcano producer publishes an **early contract** that other producers can consume:

- Semantic identity and scene coordinate frame: `volcano`, world/scene transforms, intended visible extent, camera reference.
- **Approximate spatial footprint over time**: static base of volcano; eruption plume likely occupies an animated region from event onset through settling. Bounds can be conservative/uncertain during planning.
- **Avoidance/reservation areas**: locations occupied by the eruption or where a character/caption would hide a critical event; optional safe staging positions.
- Occlusion/draw order and masks: can the presenter stand behind the volcano? When may smoke cover a character? Which effects light/tint or cast shadows on other passes?
- Interaction/event anchors: e.g. `eruption.start`, `volcano.crater`, `volcano.focus`, `smoke.dissipates` with resolved or provisional timestamps.
- Contract revision, validity interval, confidence and explicit unknowns; these are not invented precise geometry from a non-existent final render.

The characters producer uses that contract to place Alice/Bob, choose camera-compatible gestures, avoid visual collisions, and schedule reactions. This can happen before the eruption is rendered. If the volcano's accepted size, position, or plume changes, the new revision **invalidates only actual dependents** and prompts recomposition/review. A compositor should receive compatible pixels/surfaces; it is not expected to invent spatial planning at assembly time.

**PROPOSED minimal planning artifact (NOT final schema):**

```yaml
scene_context:
  scene_revision: scene-r12
  camera_space: frame_1080x1920  # illustrative; coordinate semantics TBD
  producers:
    - id: volcano
      layout_revision: vol-layout-r3
      bounds: {x: 120, y: 520, width: 850, height: 1180}
      events: {eruption_start: {num: 103, den: 20}}
      dynamic_regions:
        - id: plume
          active_from: eruption_start
          region_provider: volcano/plume-envelope-v3
          status: provisional
      avoid_regions: [volcano/plume-envelope-v3]
      occlusion: {base_draw_group: background}
      needs_cross_pass_effects: [eruption_glow_on_characters]
```

No general-purpose physics/collision solver is implied. A simple bounding region or author-provided staging note is enough for many stylized reels. Use richer time-varying shapes, camera-space projections or constraints only where clarity and interaction actually need them. Global camera changes may invalidate previously published footprints.

### Spatial contract lifecycle

`draft/reserved → published/provisional → accepted/frozen → superseded` describes *metadata commitment*, separate from render-job completion. A producer may publish a stable layout before the expensive frames are ready. The consumer pins the layout revision; changes cause explicit dependency checks rather than silent positional drift. Some art direction decisions can be frozen while others remain exploratory. If enough information is missing, dependent staging waits or proceeds conditionally and must be revalidated.

## 3. Futures: usable across the entire production, not only layers

A **promise/future** here is a producer-consumer dependency on an identified **versioned artifact or decision**, not a requirement to use the JavaScript `Promise` type or a heavyweight workflow product. A job resolves to a concrete artifact or an explicit error/cancellation/supersession. A consumer can start once its required contract is published, even if the final artifact is not yet complete.

| Producer / promised result | Can proceed in parallel | What must be known first | Completion or invalidation condition |
|---|---|---|---|
| Topic/fact research → evidence bundle | Storyboard/look exploration, independent source research | Research question, subject constraints, source policy | Required claims vetted; revised factual finding invalidates dependent narration/depictions |
| Creative treatment / script → accepted beats and narration | Character/style exploration, scene layout | Brief, tone, accepted facts and locks | New accepted revision may invalidate shot plan, captions or voice |
| Shot layout → spatial contracts | Character motions, background code, captions safe zones | Camera, coordinates, provisional object bounds and event anchors | Geometry/layout change triggers impacted consumer revalidation |
| Character identity/look → reference/style contract | Create scene-specific SVG/sprite parts, voices, performance plans | Approved appearance or protected design direction | Look change invalidates derived poses/parts, not automatically all assets |
| Voice → accepted waveform and timing | Visual work not coupled to words; rough camera/animation | Narration text, voice direction, format | Waveform/word alignment change invalidates lip-sync and dependent captions |
| Asset acquisition → rights-cleared media reference | Scene staging from metadata/proxies | Source/rights constraints, expected dimensions/duration/subject | Final media missing/denied or different crop invalidates bound consumers |
| Action realization → seekable animation component | Independent scene/background prep | Actors, action contract, event schedule, needed anchors | Capability failure triggers bounded remediation/experiment; frozen dependency required for final render |
| Layer or subpass → frames/ranges/seekable surface | Other independent surfaces, mixing, some reviews | Shared time/space/alpha/occlusion contract | Renderer output resolves, then compositor consumes matching frame ranges |
| Audio mix / subtitles / encoding | Independent frame rendering; some previews | Frozen timing/version bindings | Final mux waits for compatible audio/visual assets |
| Evaluation → technical + creative evidence | Other candidate renders/evaluations | Target revision, frames or clip, rubric | Evidence accepted for exactly that revision; new output requires fresh affected checks |
| Experiment Agent → evidence/recommendation | Unrelated production paths | Frozen trial inputs, budgets, variants and metrics | Trial branch produces traceable evidence; main harness decides promotion |

**Where not to use futures:** trivial in-memory operations, tiny tightly coupled render steps where scheduling overhead dominates, or tasks whose unresolved contract risks substantial invalid speculative work. A semantic dependency need not create a new worker, service or promise object.

### Structured task lifecycle — research candidate

`declared → waiting_on_dependencies → ready → running → partial_ready → completed | failed | cancelled | superseded` (specific persistence model OPEN). Support cancellation, deduplication/idempotency for external tools, retry policy, timeouts and bounded concurrency. Avoid stale promises being silently fulfilled by the wrong project revision. A future's published artifact must declare producer revision and expected content/hash/format when known.

### Two complementary kinds of parallelism

1. **Creative/production concurrency:** script, research, characters, sound, layout, action code proceed once necessary creative contracts are announced.
2. **Rendering concurrency:** per component, frame range, shot or renderer job; compositor can process ready intervals while other jobs are still running. Buffers need backpressure and bounded memory.

Workers can evaluate code at independent frame timestamps if the component is seekable. Stateful effects declare preparation/checkpoint/replay instead of lying about arbitrary seeking. GPU/CPU limits and browser startup costs determine useful granularity.

## 4. Dependencies and scheduling: minimum rules

1. **Declare what downstream work reads:** source revision, immutable inputs, event anchors, spatial layout version, rendering/code version, parameters, output target, other producer artifacts. Include implicit coupling such as camera, fonts, global grading, shared lighting and masks.
2. **Build an acyclic dependency graph** for each schedulable execution revision. Temporal creative feedback cycles (review → revise → recompilation) are explicit *new revision iterations*, not circular render-task dependencies.
3. **Publish staged commitments:** e.g. volcano bounds can become available before final pixels. Distinguish `provisional` from `frozen` so premature completions cannot be mistaken for approved deliverables.
4. **Pin and verify revisions:** every downstream job records exact producer revision IDs. If a producer is superseded, discard/revalidate only affected consumers; do not silently attach an old surface to a new timing or layout.
5. **Group/split adaptively:** compositor and scheduler may co-render coupled nodes, reuse GPU textures, cache static passes, or split independent frame ranges; measure actual cost. Neither 'layer' nor 'promise' determines physical process boundaries.
6. **Partial output is typed:** a preview frame or incomplete range is not equivalent to a complete, accepted layer. Final encoding and final creative review require the required exact artifacts.
7. **Retry without repeating unchanged failure:** consult versioned failed-attempt evidence and choose a genuinely changed input/method before repeating a known deterministic failure. Transient failures can be retried with an explicit policy.

## 5. Proposed narrow integration contracts for HLD

Keep responsibilities logical, not mandatory microservices:

- `SceneSpatialContract`: world/camera mapping, time-relative occupancy or avoidance regions, event/interaction anchors, relevant depth/occlusion/effects, version and provenance.
- `ArtifactFuture`: artifact kind, producer revision/inputs, dependency IDs, expected output type/ranges, status, readiness/quality level, error/cancel/superseded state.
- `RenderJobSpec`: frozen code/IR/asset revisions, source time map, requested frame interval, surface and alpha/color contract, declared dependencies, resource class.
- `ArtifactRef`: content address or immutable revision reference, inspection metadata, validity range, code/renderer/toolchain versions and access rights.
- `DependencyIndex`: which scene/objects/events/layers/outputs are invalidated by a particular semantic or spatial revision.

**Not decided:** exact API, storage/queue tech, GPU sharing method, browser concurrency, scheduling optimization algorithm, physical deployment, chunk duration, renderer format, format of time-varying regions or automatic occlusion solver. These belong to HLD decisions and subsequent detailed research/LLD.

## 6. Examples of safe and unsafe concurrency

**Safe:** scene geometry and volcano location are agreed; the eruption pass and character pass render independently using the same accepted spatial and event contracts, then compose compatible surfaces.

**Unsafe:** characters are animated against a guessed volcano position while a different worker alters its scale and framing, and the compositor blindly overlays them.

**Safe:** captions from accepted word timings and visual backgrounds from an accepted shot plan run concurrently.

**Unsafe:** final lip-sync is published using a provisional voice take and silently reused after a different waveform is accepted.

**Safe:** an Experiment Agent tests two methods on immutable candidate branches while the approved project remains unchanged.

**Unsafe:** both experiment branches directly mutate the same active code, then claim their timings/measurements are comparable.

## 7. Performance questions for focused technical research

Benchmark one-pass vs grouped vs independent layer render, parallel frame ranges and progressive output, under the same accepted creative requirements. Collect time to first usable preview, time to accepted video, cost/token/tool calls, P50/P95 revision latency, RAM/VRAM, encode cost, cache hit rate and spatial/compositing error rate. Include partial edits to volcano layout, actor poses, scene camera, and shared glow to expose dependency mistakes. No performance claims without measurements.

### Related precedents (not adopted frameworks)

- Temporal documented execution/parallel activity patterns: https://docs.temporal.io/design-patterns
- Bazel declared build inputs/actions, action cache and content-addressable outputs: https://bazel.build/remote/caching
- OpenUSD's scene references, layered data and deferred payloads are useful *conceptual* precedents for spatial contract/reference publication, **not** a recommendation to adopt a 3D scene-description engine in this 2D scope: https://openusd.org/release/intro.html
- PixiJS render layers/render targets: https://pixijs.com/8.x/guides/concepts/render-layers
- FFmpeg overlays/compositing: https://www.ffmpeg.org/ffmpeg-filters.html

**Exit for this subsystem:** HLD defines minimal scene spatial contract, artifact promise/producer-consumer version semantics, task dependency/invalidations, scheduler ownership, and a benchmark plan. No LLD or actual benchmark has been completed.
