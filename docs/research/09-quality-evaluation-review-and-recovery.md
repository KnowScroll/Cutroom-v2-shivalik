# Quality System, Diagnostic Review & Autonomous Recovery — Focused Research

**Cutroom v2 | Subsystem research**  
**Updated:** 13 November 2026  
**Status:** HLD behavioral principles **ACCEPTED**; evaluation methods, tools, thresholds and measurements **OPEN**. No v2 prototypes or reviewer benchmarks have been run.  
**Read:** [HLD Phase B — quality decisions](../hld/02-phase-b-production-lifecycle-and-autonomous-quality.md#b3--evaluation-revision-and-autonomous-completion) · [HLD Phase A — reviewer ownership](../hld/01-phase-a-system-boundaries-and-ownership.md#a4-reviewer-and-experiment-agent--distinct-callable-roles) · [Harness research](05-agentic-harness-and-experiment-agent.md) · [Versioning](08-versioning-lineage-and-experiment-memory.md)

## 1. Product lesson from Cutroom v1: preserve observability and recovery

**User-provided v1 experience:** Strict checks rejected takes/clips without a capable supervising harness to inspect and fix the cause. **Decision for v2:** Quality checks are **diagnostic-first**. They should tell the Main Director/Harness what was expected, what was actually observed, where it broke, why the failure is suspected and what change might correct it. Do not dispose of rejected candidates or make a trivial defect force whole-video regeneration. Preserve retrievable clips, logs, code versions, comparisons and recovery attempts.

The advantage of v2's code-created animation plus shared project blackboard is **greater control and reproducibility**: named curves, transforms, event times, scene commitments, underlying SVG/Canvas/HTML code, source assets and renderer logs are inspectable. **HYPOTHESIS, not measured guarantee:** this may lower the cost of precise diagnosis relative to opaque image/video-generation output. Programmable graphics are still vulnerable to visual bugs, conceptual errors, boring stories, rhythm problems, audio mismatch and renderer-specific artifacts.

Hard requirements are separate from exploratory quality observations. A valid export, mandatory source permission, essential accuracy and explicit brief constraints may block falsely labeling a final result *successful*, not remove the evidence or forbid safe intermediate work. Reviewer judgments cannot override legal/rights or deterministic technical requirements.

## 2. What needs evidence, and what can be checked without another agent

| Class of question | Evidence sources | Default checker | What it cannot conclude |
|---|---|---|---|
| Schema/reference/render validity | Parser diagnostics, source maps, locked revision hashes, execution logs | Deterministic tools | Whether the scene communicates well |
| Temporal/media integrity | Timestamp maps, frame counts, audio/video probes, alignment metadata | Deterministic tools, selected samples | Whether a comedic pause is funny |
| Spatial and continuity observation | Rendered clip, sampled neighboring frames, object transforms, layer surfaces and events | Automated observations plus optionally Reviewer | That overlap is unintended in stylized acting |
| Factual / source accuracy | Original source, claim bindings, selected genuine media, crop/time range, citations | Evidence/rights checks plus focused Reviewer | Anything if the claimed ground truth is unknown |
| Creative and audiovisual quality | Actual clip/audio, original brief, selected treatment, target audience, accepted style constraints | Director, callable Reviewer if valuable | Objective numerical proof of taste or engagement |
| Whole-film continuity | Finished video, scene plan, narration, sound, transitions and temporal coverage | Final-film evaluation and technical validation | That a few still frames represent every moment |

**Reviewer context:** shared *authoritative* project facts and selected ground truth, with a **fresh independent reasoning scope**. A producer's script is not automatically factually true, and the Director's intention is not evidence that pixels/audio match. Reviewer findings must distinguish observed defects, uncertain inferences and opinions. Record coverage (frames, intervals, audio, entire clip) and `unknown` when evidence is insufficient.

## 3. More useful failure outputs: Diagnostic Evidence Bundle

A substantial failure should support **targeted rework**, not just say "hand movement off." Useful fields, proportional to complexity:

- Subject revision, intended meaning, accepted constraints, exact output/component/shot.
- Observed defect with precise time/frame/coordinates/object IDs and relevant before/after state.
- Links to isolated and full-context visual evidence, waveform, source excerpt, source map, render log, code diff or deterministic test as appropriate.
- Hypotheses with confidence and distinguishing tests; separate from actually observed facts.
- Already-attempted fixes, their outcomes, resource and token cost, and similar prior failure records.
- Targeted next modifications (parameter/pose/attachment event, crop/framing, data/claim, source footage, renderer assignment) and alternative methods.
- Predicted affected dependencies, allowed write scope, background/media that can be reused, unknowns and escalation reason.

The worker sends a **short actionable summary** to the Director and saves full evidence under versioned refs. The Director can inspect additional material without loading all logs into its context. Propose no extra mandatory "Debug Agent": a worker can self-repair small valid errors within a bounded, authorized scope; uncertain quality receives optional independent review; competing costly fixes can be delegated to the Experiment Agent. Aesthetic criticism should not masquerade as a deterministic compiler failure.

## 4. Scalable review and stopping policy

**ACCEPTED:** Evaluate at component, shot/scene, and full-film scopes. The Director derives light **production-specific Quality Intent** from the brief: documentary truth, comedy timing, precise UI actions, chart-data consistency, or abstract music/graphics sync. Invoke the Reviewer **when risk or uncertainty justifies cost**, not for every frame or parameter tweak. The full delivered film gets technical verification and output-level quality assessment; report the fraction of audio/visual duration truly inspected instead of claiming full coverage from still samples.

**Repair loop:** inspect evidence → determine smallest *semantically sufficient* change → branch the accepted revision → edit affected tasks and dependencies → rerender/revalidate relevant outputs → compare against accepted baseline for regressions → promote, reject or try a fundamentally different technique. Preserve creative flexibility: a simpler cartoon pose, changed framing or narrative cut may outperform an elaborate IK solution.

**Completion:** blocked essential requirements are resolved or accurately reported as unmet; material defects motivate bounded changes; optional aesthetic improvements are attempted only if likely benefit outweighs latency, token/render cost and regression risk. An exhausted optional budget does not convert a known invalid video into a successful deliverable. An opinionated Reviewer cannot force infinite revisions. The Director accepts autonomously; no routine creator approval loop.

**Final checkpoint:** validate the actual exported media's completeness, format, duration, synchronized audio/captions, correct provenance/rights and known critical defects. Attach deliverable revision, code/assets versions, evaluation coverage and any explicit limitation. Re-exporting is a new artifact revision.

## 5. External precedents and limits of inference

These sources inform review patterns; none validates Cutroom's eventual creative quality without experiments.

- [Anthropic — Building effective agents](https://www.anthropic.com/research/building-effective-agents): orchestrator-worker and evaluator-optimizer patterns can help when subtasks are distinct and the evaluation criteria support actual improvement. Iteration has cost; a feedback loop is not automatically desirable for every action.
- [Claude Code — agent teams](https://code.claude.com/docs/en/agent-teams): independent contexts and shared task coordination for useful parallelism; team workflows have substantial coordination/token overhead.
- [Claude Code — subagents](https://code.claude.com/docs/en/sub-agents): restricted tools and scoped contexts support independent review without carrying the entire main conversation.
- [Netflix — VMAF](https://github.com/Netflix/vmaf): image/video fidelity metric for relevant comparisons; **not a substitute** for factual accuracy, film quality, humor or viewer comprehension.
- [Bazel — remote caching](https://bazel.build/remote/caching): action caching with explicit inputs/outputs suggests artifact provenance and reproducibility; Cutroom additionally requires semantic constraints and temporal dependencies.

The Cutroom-specific diagnostic-first policy and 3-level review/completion semantics arise from **user requirements and project design discussions**, not as proven implementations of these external systems.

## 6. Future evaluation and experiment design — NOT yet performed

Compare v1-style strict reject gates versus diagnostic-first recovery under representative **six-domain test cases**, controlling for same brief, visual quality goals and compute budget. Measure: time to accepted film; useful previews per iteration; proportion of identified defects repaired; rework scope and reused cache; false-positive/false-negative reviewer findings; repeated identical failures; total model/tool/render costs; actual exported-file defects; human comparative judgments of result quality. Sample temporal intervals and final films, not only still frames. Vary reviewer trigger policy to identify when an independent Reviewer materially improves quality versus cost.

**Unresolved technical choices:** review-capable model(s), frame/audio sampling/coverage and retrieval; failure severity taxonomy; exact Diagnostic Bundle schema; calibration of creative rubrics; fact-verification and rights procedures; hard/soft gate policy encoding; bounded repair thresholds; metrics and reference datasets. These belong to Phase C integration contracts, focused technical research and LLD, not this accepted behavioral baseline.
