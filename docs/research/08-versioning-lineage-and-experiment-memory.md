# Project Versioning, Semantic Revisions, Artifact Lineage & Experiment Memory

**Cutroom v2 | Subsystem research + approved HLD inputs | Updated 13 November 2026**  
**Status:** Versioning and failure-aware reuse are DECIDED product requirements. Mechanisms below are PROPOSED designs, not implementation.  
**Parent:** [Research and decision index](../research-index.md) · [HLD entry](../HLD-ENTRY.md)  
**Related:** [Coordination and futures](07-production-coordination-futures-and-spatial-contracts.md) · [DSL/IR](01-dsl-compiler-executable-render-ir.md) · [Harness and experiments](05-agentic-harness-and-experiment-agent.md)

## 13 November Phase B acceptance — atomic promotion and evidence-retaining QA

**DECIDED:** The Director autonomously accepts working candidates and final delivery; **no routine human approval gate**. Project Core validates the expected base revision, locks/hard requirements and atomic head transition without becoming a creative judge. Imperfect previews, rejected versions and failure diagnostics remain revision-linked and inspectable; **v1-style take rejection must not delete them or force unrelated rerenders**. A worker publishing a late result cannot overwrite a newer head. Semantic dependencies (claims, layout, events, voice timing) control safe reuse across revisions; combine unrelated candidate edits only after checking shared constraints. See [HLD Phase B](../hld/02-phase-b-production-lifecycle-and-autonomous-quality.md).

## 1. Why Cutroom needs more than undo or Git commits

**DECIDED:** Preserve reversible, traceable revisions of the production and its objects, layers, scenes/shots, animations, timings, render code, sources, style/character references, audio and relevant generated conventional graphics/derived assets. An edited final MP4 cannot be the only history. The system must support selective rollback, comparison of alternatives, branching, later merging when compatible, and cheap reuse of unaffected work.

**DECIDED:** A long production cannot depend on an LLM remembering every failed trial from chat context. Link decisions, accepted and rejected candidate attempts, validation/evaluation evidence, costs, and causes to immutable revisions. The harness and Experiment Agent should retrieve relevant context before repeating a method and avoid identical known failures without a changed assumption. Failed experiments are informative but **not universal bans**; a different character, style, scale, renderer or constraint can change the result.

**DECIDED:** Accepted render runs use frozen inputs, code and tool versions; new attempts create candidate revisions, not invisible mutations of an approved output. **No image- or video-generation models in the v2 pipeline**; source code and conventionally rasterized assets still need provenance and versioning.

### Distinguish five kinds of records

1. **Semantic project revisions:** creator decisions, shots, objects, actions, timings, locks, source refs and relationships (the authoritative editable model).
2. **Component/code revisions:** renderer-specific code, SVG/path definitions, sprite/puppet programs and optional structured animation tracks.
3. **Asset revisions:** canonical and derived vector/raster/media/audio resources, accepted appearance references, rights data and hashes.
4. **Build/render artifacts:** derived compiled IR, prepared outputs, frames/ranges, surfaces, encoded shots, final MP4; recreated or reused from immutable inputs.
5. **Experience and evidence records:** experiments, assessments, known defects, failures, resolved trade-offs, rationales and measured costs.

Don't force all five into the same store or versioning mechanism. Git-like history may suit authored text; content-addressed blobs may suit large media; a structured revision store/index may suit semantic patches. **No storage technology is selected.**

## 2. Proposed minimal revision model

Stable ID is independent of revision. Revision points to immutable content/patch and its predecessors:

```text
project cutroom-volcano
  accepted revision p17
       |
       +-- scene volcano: s12
       |     +-- volcano object: o7  -> render code c8
       |     +-- character Alice: o13 -> vector component c21
       |     +-- eruption event: ev9
       |
       +-- audio narration: a5
       +-- layout contract: layout-6
       +-- render recipe: recipe-4
       +-- evaluation evidence: eval-17

experiment branch p17/exp-2
  changes Alice reaction o13 -> o14 only
  parent p17, untouched volcano c8 is reused if dependencies permit
```

A semantic operation may be `update(scene=volcano, object=alice, action=double_take, field=start_offset, new=650ms)` rather than replacing a whole scene blob. Preserve stable IDs, timestamp units, expected base revision, creator locks and causal dependencies. Editing a renderer code module can remain a code diff, but must be linked to affected semantic objects and generated outputs. Identity and deep editability vary by component method; never claim fully editable bones for a single flattened sprite.

**Proposed revision semantics:**

- `revision_id`: immutable ID and parent(s); `entity_id`: stable identity; `content_digest`: hash of canonical content when applicable.
- `change`: scoped patch/diff with author (creator/harness/experiment), reasons, tool provenance, before/after and acceptance status.
- `branch`: isolated candidate derived from a pinned base; `merge`: explicit conflict check and resolved new revision; `rollback`: create a new accepted pointer/revision based on an earlier state (do not delete later history).
- `lock`: creator-protected region or decision may not be overwritten without authorization.
- `snapshot`: materialized efficient view of project at chosen revision; not necessarily duplicate every binary file.
- `rebuild`: derived artifact is reused only when content + relevant dependencies + renderer/tool versions match.

## 3. Conflict-aware changes and merges

Two experiments may edit unrelated actions on different layers and merge cleanly *if* no shared dependency contradicts either choice. They might both alter a camera interval or `eruption.start`, making their changes semantically incompatible even when they edit different files. A merge must check time/event, geometry/spatial, visual effects, audio sync, locked decisions and derived assets; run targeted evaluation when a dependency changed. Do not promise Git-style text auto-merge is enough for a production timeline.

**Example:** experiment A alters Alice's `double_take`; experiment B enlarges the volcano. Text changes are separate, but B may move the plume into Alice's frame region; merge rechecks spatial contract, staging and final composition.

## 4. Fine-grained invalidation and reuse

**Goal:** Changing Alice's facial expression must not force regeneration of an unrelated volcano eruption. Conversely, a changed camera or global glow may invalidate several surfaces.

A cache key may incorporate: input code and asset digests, dependent semantic revision/event timing, layout/spatial contract revision, output format/resolution/fps/frame range, font/renderer/environment versions, deterministic seed and global compositing/effects inputs. Dependencies should be declared rather than guessed by file-name coincidence. For untracked dynamic code reads, choose conservative invalidation.

Cache tiers already researched in [layers and compositing](02-layers-compositing-and-incremental-revision.md): immutable source and prepared assets, component compilation, static texture, render frame range, composite and encode ranges. A cache reuse is correct only if the dependency closure remains valid. Byte-level MP4 segment reuse may be limited by interframe codec settings and boundary conditions; it is not automatic.

## 5. Learning from successful and failed work

A compact **Attempt/Evidence Record** could be:

```yaml
attempt_id: exp-volcano-handoff-07
base_project_revision: p17
scope: scene-volcano/charlie-handoff
method: pose_and_prop_motion
inputs_digest: sha256:illustrative
context:
  visual_style: flat_cartoon
  shot_scale: wide
  required_communication: document_transfer
  precision_need: low
result: failed_review
observed_defects:
  - transfer_readability_low
  - prop_disappeared_for_two_frames
artifacts:
  preview: artifact:preview-07
suggested_next_change: add_receiver_pose_and_hold
source: reviewer-and-render-log
```

This is illustrative. Every failure needs observation/evidence and scope, not an ungrounded blanket label such as 'sprites cannot handle handoffs.' When planning another candidate, the main harness or Experiment Agent retrieves relevant history and tries a changed parameter, method, character representation or test hypothesis—or reports that the same experiment has already failed under identical conditions. Accepted successes record contexts and quality/cost measurements so they can guide future decisions without prohibiting original invention.

The record is **not model weight training by default**, and no autonomous self-modifying global policy is implied. Queryable evidence plus curated summaries can already help the harness avoid redundant work and context overflow. Any future model-training adaptation is separate research and approval.

## 6. Branching and approval workflow

1. Pin an accepted project revision and source/rights/creator locks.
2. Create a narrow candidate branch, identifying object IDs, affected scenes, code/assets and expected dependencies.
3. Run source/semantic checks, compile on the branch and optionally render the affected interval.
4. Attach technical tests, visual review, metrics and trial commentary to that exact branch.
5. Accept/promote candidate or reject/archive it; never erase failed trial evidence.
6. Update the accepted project head atomically; cancel/supersede invalid jobs and invalidate only their dependent futures/caches.
7. Support inspection of what changed, why, what results it produced and what would be restored by rollback.

Candidate exploration/recombination in the original v3.1 creative-search vision stays fully supported. Branches may capture alternative treatments, camera/editing rhythms, emotional performances, audio mixes and renderer methods—not just code fixes.

## 7. HLD boundary questions: do not choose a large platform prematurely

**Required:** stable identities, semantic revisions, immutable artifact refs, experiment lineage, approvals/locks, dependency invalidation, scoped rollback, traceability.

**OPEN:** Git under the hood vs custom event log/manifest, database choices, asset deduplication and retention, project collaboration/merge strategies, optimistic concurrency API, branching granularity, semantic diff UX, storage budget and cleanup, distributed workers' revision guarantees, evidence relevance/retrieval/ranking and user-facing undo design. These belong in the HLD and detailed technical research/LLD.

### Relevant precedents (not framework commitments)

- Git distributed and branching model: https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell
- Bazel action caching, declared inputs, content-addressed outputs: https://bazel.build/remote/caching
- OpenUSD's non-destructive scene references/layers/variants offer conceptual precedent for compositional revisions, **but adopting the 3D-oriented OpenUSD runtime is not implied**: https://openusd.org/release/intro.html

**Exit for this subsystem:** HLD identifies source of truth, versioned entities and contracts, immutable build outputs, accepted-head authority, branch/merge/rollback semantics, cache linkage and failure memory. No LLD or implementation selected.
