## BLOCKING

1. **Commitment hashes include and exclude readiness.**
   - `04-r3-project-model-and-storage.md` §§2.1, 2.5: “`commitment` is `{readiness, assumptions[], unknowns[]}`”; consumers pin “that entity-version hash.”
   - `06-r5-scheduler-and-recovery.md` §2.3: “A commitment's content hash must exclude its readiness state.”
   - Resolution: retain immutable entity-version hashes and define a separate execution-content hash that excludes readiness.

2. **Promotion has incompatible preconditions.**
   - `04-r3-project-model-and-storage.md` §2.7: “It does not require a clean compile or review.”
   - `09-r9-quality.md` §3.5: “Project Core refuses a candidate that fails a corrective check.”
   - Also `07-r6-harness.md` §D10: promotion requires “no failed check marked as blocking promotion.”
   - Resolution: choose one promotion policy and specify separately what structural acceptance, execution validity, and delivery require.

3. **Lost paid calls may be retried without the baseline’s required provider reconciliation.**
   - `lld/02-r1-foundations.md` §4.3: an `unknown_outcome` job “must be reconciled with the provider before any retry.”
   - `06-r5-scheduler-and-recovery.md` §2.6: when the outcome cannot be learned, “Resend once” within an allowance.
   - Resolution: either preserve the baseline’s prohibition or explicitly amend it to permit conservatively booked duplicate spend.

4. **The harness retries ambiguous transport failures without invoking reconciliation.**
   - `06-r5-scheduler-and-recovery.md` §2.6: “timeout, reset mid-stream, crash” produces `unknown_outcome`.
   - `07-r6-harness.md` §4: “network fault, stream `error` event” is `transient`; the limiter retries.
   - Resolution: distinguish definitely unsent failures from possibly executed calls; route the latter through the Scheduler’s intent reconciler.

5. **The harness promises stronger duplicate-payment protection than the Scheduler provides.**
   - `07-r6-harness.md` §4: joining the existing work key means “nothing is paid twice.”
   - `06-r5-scheduler-and-recovery.md` §2.6: reconciliation may permit one resend of a presumed-charged call.
   - Resolution: replace the absolute promise with the actual bounded-duplicate-spend guarantee.

6. **A job state is used as a failure class.**
   - `lld/02-r1-foundations.md` §4.3: failure classes are `transient`, `deterministic`, `capability`, `creative`, `policy`.
   - `08-r7-studio-tools.md` §4: “Paid audio call: reply lost” has class `unknown_outcome`.
   - Resolution: record `unknown_outcome` as the job state and define the associated intent/diagnostic separately.

7. **Missing final audio has different failure classes and retry rules.**
   - `03-r2-components-and-rendering.md` §4: missing audio or wrong length is `deterministic`; “Redo the mux only.”
   - `08-r7-studio-tools.md` §4: “Final file has no or short audio” is “`policy` (hard).”
   - Resolution: classify the execution defect as deterministic and represent the failed hard delivery check independently.

8. **Moderation policy failures are retried despite the baseline’s rule.**
   - `lld/02-r1-foundations.md` §4.3: `policy` means “No retry.”
   - `07-r6-harness.md` §4: “Moderation flag or repeated empty reply” is `policy`, handled with “One retry.”
   - Resolution: retry only an unclassified empty transport response; stop immediately on an identified moderation refusal.

9. **Commitment hash changes cannot preserve speculative work keys as claimed.**
   - `04-r3-project-model-and-storage.md` §2.1: readiness is stored inside the pinned entity version.
   - `06-r5-scheduler-and-recovery.md` §2.9: “If the commitment freezes unchanged, the work key is the same.”
   - Resolution: define “unchanged” using the separate execution-content hash proposed in finding 1.

10. **Controls must be complete and may be absent.**
    - `03-r2-components-and-rendering.md` §2.2: `seek` receives “a complete set of control values.”
    - `08-r7-studio-tools.md` §2.3.2: “An unkeyed control is passed as absent.”
    - Resolution: define expression/default precedence in the trusted evaluator and always pass the resulting complete control set.

11. **Three different places own control-track evaluation.**
    - `03-r2-components-and-rendering.md` §2.2: tracks are evaluated “in Node.”
    - `05-r4-compiler-and-render-plan.md` §D5: “The compiler evaluates every track”; “the host interpolates nothing.”
    - `08-r7-studio-tools.md` §2.3.1: “The host evaluates the tracks for each frame.”
    - Resolution: make the compiler’s shared evaluator authoritative and have the host consume resolved frame packets.

12. **Camera composition requires incompatible DOM structures.**
    - `03-r2-components-and-rendering.md` §2.6: “One world container carrying the transform was rejected” because world and screen layers must interleave.
    - `05-r4-compiler-and-render-plan.md` §D10: apply the transform to “the container of all world layers”; screen layers sit outside it.
    - Resolution: use R2’s per-layer camera matrices while preserving the single paint-order stack.

13. **A stored mask is precisely the live-layer matte that rendering forbids.**
    - `04-r3-project-model-and-storage.md` §2.2: `layer.mask?: Ref<layer>`.
    - `05-r4-compiler-and-render-plan.md` §D5: “A live layer cannot be another layer's matte.”
    - Also `03-r2-components-and-rendering.md` §2.6: masks are shapes, gradients, or image assets.
    - Resolution: replace `Ref<layer>` with the supported mask union, including an explicit baked-image reference where needed.

14. **Scene context has two incompatible stored schemas.**
    - `04-r3-project-model-and-storage.md` §2.2: `subject`, `frame`, keyed `regions`, keyed `anchors`, `cross_layer_effects`, nested `commitment`.
    - `05-r4-compiler-and-render-plan.md` §D9: `shot`, top-level `readiness`, `drawGroups`, `items`, `effects`, `realisedBy`.
    - Resolution: select one R3 entity schema and define an explicit compiler lowering to any different runtime representation.

15. **Control tracks have incompatible targets and channel structures.**
    - `04-r3-project-model-and-storage.md` §2.2: `target: Ref<layer|camera>`, required `origin`, channels containing `interp` and `keys[{at,value,ease?}]`.
    - `08-r7-studio-tools.md` §2.3.3: `"target": "presenter"`, `"layer": "acting"`, channel arrays using `"v"` and relative `"+80ms"`.
    - Resolution: make the Studio example an explicit authoring syntax that normalizes into R3’s layer-targeted schema.

16. **The acting easing vocabulary exceeds the renderer’s contract.**
    - `03-r2-components-and-rendering.md` §2.2: interpolation is “step, linear or cubic-bezier.”
    - `08-r7-studio-tools.md` §2.3.3: keys use `"out"` and `"out_back"` and “a named easing from the trusted shim.”
    - Resolution: define one easing schema and decide whether overshooting named easings are supported.

17. **Quality Intent has incompatible entity shapes.**
    - `04-r3-project-model-and-storage.md` §2.2: `derived_from`, keyed `criteria`, `review_triggers`, `stop_rules`.
    - `09-r9-quality.md` §3.4: `must_communicate`, `hard_constraints`, `facts`, `key_aims`, `must_see`, `waivers`, `audio`, `disclosure`.
    - Resolution: merge the required fields into R3’s authoritative schema before implementing proofs or stopping rules.

18. **Rights states and delivery eligibility disagree.**
    - `04-r3-project-model-and-storage.md` §2.10: `unknown|prospect|cleared|restricted|refused`; delivery requires “all `cleared` or authored.”
    - `08-r7-studio-tools.md` §2.4: `candidate → evidence_collected → eligible | restricted | unresolved`, later `revoked`; delivery requires `eligible`.
    - Resolution: separate acquisition progress from rights eligibility and define one canonical eligibility enumeration.

19. **Claim status enumerations disagree.**
    - `04-r3-project-model-and-storage.md` §2.2: `supported|simplification|interpretation|fiction|unverified|refuted`.
    - `08-r7-studio-tools.md` §2.5: `supported`, `simplification`, `interpretation`, `fiction`, `unsupported`, `disputed`.
    - Resolution: adopt one enumeration and distinguish absence of support from active dispute or refutation.

20. **Recipe lifecycle enumerations disagree.**
    - `04-r3-project-model-and-storage.md` §2.11: `seed|experimental|proven|deprecated`.
    - `08-r7-studio-tools.md` §2.3.5: `candidate`, `validated`, `retired`.
    - Resolution: publish one recipe lifecycle and migrate the Studio terminology to it.

21. **Take audio references have incompatible types.**
    - `04-r3-project-model-and-storage.md` §2.2: `take.audio: Ref<asset>`.
    - `08-r7-studio-tools.md` §2.2.1: `VoiceTake.audio: ArtifactRef`.
    - Resolution: explicitly distinguish adapter results from stored takes and specify the asset-ingest conversion.

22. **A footprint violation is observational in one contract and corrective in another.**
    - `05-r4-compiler-and-render-plan.md` §D2: after-render codes, including `FOOTPRINT_EXCEEDED`, “are observational.”
    - `09-r9-quality.md` §3.1: C-06, “Probe boxes stay inside the declared footprint,” is `corrective`.
    - Resolution: give footprint verification one check type and corresponding promotion/readiness effect.

23. **Text overflow changes from observational to corrective.**
    - `03-r2-components-and-rendering.md` §2.13: in V5, blankness is corrective; “the rest observational,” including text overflow.
    - `09-r9-quality.md` §3.1: P-07, “Rendered text equals bound text; no overflow,” is `corrective`.
    - Resolution: split exact bound-text fidelity from overflow, or explicitly choose one shared overflow policy.

24. **Anchor drift changes from observational to corrective.**
    - `05-r4-compiler-and-render-plan.md` §D2: `ANCHOR_DRIFT` is an observational after-render finding.
    - `09-r9-quality.md` §3.1: P-08, pointer tip against the reprojected anchor, is `corrective`.
    - Resolution: unify the check type, or define distinct declared-anchor and required-pointer-fidelity checks.

25. **Loudness checks are hard and corrective.**
    - `08-r7-studio-tools.md` §2.2.6: “Loudness, true peak and sample count go to R9 as hard checks.”
    - `09-r9-quality.md` §3.1: M-04 loudness and true peak is `corrective`.
    - Resolution: identify which profile limits are hard delivery requirements and encode that in the shared check catalogue.

26. **Baking eligibility differs.**
    - `03-r2-components-and-rendering.md` §2.14: requires `timeInvariant` **and** constant controls over the chunk.
    - `05-r4-compiler-and-render-plan.md` §D11: eligibility is constant seek inputs **or** validated time-invariance.
    - Resolution: require constant effective visual inputs; time-invariance must not permit baking changing controls.

27. **Baking is automatic versus disabled by default.**
    - `03-r2-components-and-rendering.md` §2.14: “A component is baked when” eligible.
    - `05-r4-compiler-and-render-plan.md` §§D11, 5: “`bake.mode` defaults to `off`.”
    - Resolution: make baking conditional on the shared setting in both drafts.

28. **Bake failure cannot follow both fallback contracts.**
    - `03-r2-components-and-rendering.md` §2.14: if equivalence fails, “the live component is used.”
    - `05-r4-compiler-and-render-plan.md` §D11: the planner already replaces the source with `{kind:"baked"}` and keys the chunk using the bake work key.
    - Resolution: retain a pinned live fallback and define whether fallback changes the plan/key or fails the bake dependency.

29. **Shot Reviewer thinking defaults disagree.**
    - `07-r6-harness.md` §D7: “Reviewer, shot scope” uses thinking “off.”
    - `09-r9-quality.md` §3.2: “M3 with thinking on for shot, film, claim and final reviews.”
    - Resolution: use one role-routing setting for shot reviews.

30. **The same local repair loop has different limits.**
    - `03-r2-components-and-rendering.md` §§2.13, 5: author repair limits are `3`, then `2` escalated attempts.
    - `09-r9-quality.md` §§3.5, 5: “2 attempts on Flash, then 1 on M3.”
    - Also `07-r6-harness.md` §5: author limits are `3 / 2`, plus one visual repair round.
    - Resolution: define whether these are separate nested loops; otherwise consolidate them into one total attempt budget.

31. **Blob-ingest durability guarantees conflict.**
    - `04-r3-project-model-and-storage.md` §2.6: ingest “syncs, renames into place … then inserts the `blob` row”; never a row without a file.
    - `06-r5-scheduler-and-recovery.md` §2.12: “Derived blobs are not” synced.
    - Resolution: put durability tiers in the blob-store API and qualify R3’s guarantee accordingly.

32. **Two modules claim the physical blob sweep.**
    - `04-r3-project-model-and-storage.md` §2.14: “R5 owns cache eviction … R3 owns the sweep.”
    - `06-r5-scheduler-and-recovery.md` §2.12: “The sweep deletes unmarked blobs” under Scheduler retention rules.
    - Resolution: let Scheduler choose evictions and supply roots; let Project Core’s blob store perform the single sweep.

33. **The shared database has two incompatible `attempt` tables.**
    - `04-r3-project-model-and-storage.md` §§2.6, 2.11: `attempt` stores experience signatures, context, outcomes, defects, and suggestions.
    - `06-r5-scheduler-and-recovery.md` §2.2: `attempt` stores execution leases, heartbeats, timings, and failure classes.
    - Resolution: name them separately, such as `execution_attempt` and `experience_attempt`, with an explicit relation.

34. **The shared fetch service both rejects and needs HTML.**
    - `08-r7-studio-tools.md` §2.4: “One fetch service serves acquisition, research and capture”; “Refuse … HTML and SVG.”
    - `07-r6-harness.md` §§D4, D6.5: `web_fetch` fetches pages and returns extracted web text.
    - Resolution: define separate document-fetch and media-download policies on the common transport.

35. **Mix duration is expressed in incompatible dimensions.**
    - `lld/02-r1-foundations.md` §1.4: audio duration is `N·T`; sample count is computed from the absolute end time.
    - `08-r7-studio-tools.md` §2.2.6: cut to “exactly N·T samples.”
    - Resolution: use `round(N·T / flicksPerSample)` samples and retain `N·T` as the duration in flicks.

## NAMING

36. **Component metadata is renamed instead of copied.**
    - `03-r2-components-and-rendering.md` §2.2: `size`, `duration`, `outOfRange`, `timeInvariant`.
    - `04-r3-project-model-and-storage.md` §2.2: `natural_bounds`, `intrinsic_duration`, `out_of_range`, `time_invariant`.
    - Resolution: use one metadata schema or publish the exact lossless mapping.

37. **The point-control type has two names.**
    - `03-r2-components-and-rendering.md` §2.2: `{type:"point"; default:[number,number]}`.
    - `08-r7-studio-tools.md` §2.3.2: `gaze` has type `vec2`.
    - Resolution: use `point` consistently or add `vec2` as an explicitly normalized authoring alias.

38. **Camera channels change names.**
    - `04-r3-project-model-and-storage.md` §2.2: camera channels `x`, `y`, `zoom`, `rotation`, `shake`.
    - `05-r4-compiler-and-render-plan.md` §D5: `cx`, `cy`, `zoom`, `rot`.
    - Resolution: document the authored-to-lowered channel mapping, including how `shake` is absorbed.

39. **Entity scope uses `scene` versus `shot`.**
    - `04-r3-project-model-and-storage.md` §2.2: Quality Intent criterion scope is `component|scene|film`.
    - `09-r9-quality.md` §3.1: check scopes are “component, shot, film … and final file.”
    - Resolution: standardize `shot`, or define `scene` as a separate aggregate with membership.

40. **Word-timing labels differ.**
    - `04-r3-project-model-and-storage.md` §2.2: `alignment: provider|forced|estimated`.
    - `08-r7-studio-tools.md` §2.2.1: `timing: native|aligned|estimated`.
    - Resolution: adopt one field and enumeration, mapping `provider→native` and `forced→aligned` if intended.

41. **Word records identify words differently.**
    - `04-r3-project-model-and-storage.md` §2.2: `words:[{w,start,end}]`.
    - `08-r7-studio-tools.md` §2.2.1: `words:{token,start,end,confidence?}[]`.
    - Resolution: store both the stable spoken-token index and its text, with one shared record type.

42. **Take engine metadata changes shape and meaning.**
    - `04-r3-project-model-and-storage.md` §2.2: `engine:{name,model,voice,params,seed?}`.
    - `08-r7-studio-tools.md` §2.2.1: `engine:{adapter,version,model}`.
    - Resolution: combine adapter identity/version with the pinned voice, parameters, and seed.

43. **Project patch tool and operation names differ.**
    - `04-r3-project-model-and-storage.md` §§2.4, 3: `apply_patch` takes `{base,branch,intent,key?,unlock?,ops[]}`.
    - `07-r6-harness.md` §D4: `project_patch` takes “branch, base revision, operations, intent.”
    - Resolution: define the wrapper mapping and expose idempotency and authorized unlock inputs.

44. **Project error codes are renamed by the harness without a mapping.**
    - `04-r3-project-model-and-storage.md` §2.4: `LOCKED`, `OUT_OF_SCOPE`, `DANGLING_REF`, `STILL_REFERENCED`.
    - `07-r6-harness.md` §D4: `LOCK_VIOLATION`, `SCOPE_VIOLATION`, `REFERENCE_BROKEN`.
    - Resolution: propagate Project Core’s codes or publish a complete error translation table.

45. **Stale promotion has two error names.**
    - `04-r3-project-model-and-storage.md` §2.6: failed accepted-head CAS returns `STALE_BASE`.
    - `07-r6-harness.md` §D4: `project_promote` returns `STALE_HEAD`.
    - Resolution: choose one code and preserve its expected/current-head payload.

46. **Compiler tool names differ.**
    - `05-r4-compiler-and-render-plan.md` §3: `compile`, `plan_diff`, `explain_timing`, `request_preview`.
    - `07-r6-harness.md` §D4: `compile_request`, `render_request`.
    - Resolution: define aliases/adapters and explicitly retain plan-diff and timing-explanation access.

47. **Scheduler submission has two names.**
    - `06-r5-scheduler-and-recovery.md` §2.4: `request(spec,consumer)`.
    - `07-r6-harness.md` §D9: `call.scheduler.submit(...)`.
    - Resolution: use `request` in plugin facades or specify `submit` as its adapter.

48. **Render capability identifiers disagree.**
    - `03-r2-components-and-rendering.md` §3: `chunk.render`, `component.bake`, `video.concat`, `film.mux`.
    - `05-r4-compiler-and-render-plan.md` §D6: `render.chunk`, `render.bake`, `finish.encode`.
    - Resolution: register one capability catalogue and distinguish concat, encode, and mux operations.

49. **Evidence retrieval has three names/shapes.**
    - `09-r9-quality.md` §3.5: `evidence.get(bundle,parts)`.
    - `07-r6-harness.md` §§D4, D6.3: `evidence_read(reference,section,cursor)` and Reviewer `bundle_read`.
    - Resolution: define one underlying retrieval API with explicit role-specific wrappers.

50. **The durable event table has two names.**
    - `04-r3-project-model-and-storage.md` §2.6: `INSERT INTO event_log(...)`, identified as R5’s table.
    - `06-r5-scheduler-and-recovery.md` §2.4: `event(seq,ts,type,job,consumer,scope,payload)`.
    - Resolution: use one table name in the shared schema and promotion transaction.

51. **Diagnostic severity introduces a second enumeration.**
    - `lld/02-r1-foundations.md` §5: `blocking`, `material`, `minor`, `note`.
    - `05-r4-compiler-and-render-plan.md` §D2: `B`, `B*`, `M`, `N`.
    - Resolution: retain the baseline severity values and put mode-dependent blocking in a separate field.

52. **Unsupported compositing has different diagnostic names.**
    - `03-r2-components-and-rendering.md` §2.6: `CROSS_COMPONENT_EFFECT_UNSUPPORTED`.
    - `05-r4-compiler-and-render-plan.md` §D2: `COMPOSITE_UNSUPPORTED` for a live matte; `EFFECT_UNREALISED` for an unrealized effect.
    - Resolution: define distinct unsupported-capability and missing-realization codes and map renderer errors to them.

53. **Invalid rates and fonts have different codes.**
    - `04-r3-project-model-and-storage.md` §2.4: `RATE_NOT_FLICK_EXACT`; `03-r2-components-and-rendering.md` §2.13: `LINT.FONT`.
    - `05-r4-compiler-and-render-plan.md` §D2: `RATE_INVALID`, `FONT_UNREGISTERED`.
    - Resolution: either reuse canonical codes or namespace them and document equivalent conditions.

54. **Equivalent component checks have separate identifiers.**
    - `03-r2-components-and-rendering.md` §2.13: validation steps `V0`–`V7`.
    - `09-r9-quality.md` §3.1: component checks `C-01`–`C-06`.
    - Resolution: provide a one-to-one or one-to-many mapping so evidence and failure signatures identify the same rule.

55. **Seek-sampling defaults disagree.**
    - `03-r2-components-and-rendering.md` §5: `validation_sample_times = 6`.
    - `09-r9-quality.md` §5: `comp.seek_samples = 8`.
    - Resolution: use one shared setting with one sample-selection algorithm.

56. **Order-independence threshold has two setting names.**
    - `03-r2-components-and-rendering.md` §5: `order_independence_min_psnr_db = 70`.
    - `09-r9-quality.md` §5: `comp.reseek_psnr_min_db = 70`.
    - Resolution: give the shared check one canonical setting key.

57. **Probe sampling defaults disagree.**
    - `03-r2-components-and-rendering.md` §§2.4, 5: `probe_stride = 1`, “on every frame by default.”
    - `05-r4-compiler-and-render-plan.md` §5: `probe.frameStep = 3`.
    - Resolution: choose one default and record the actual stride in every probe sidecar and coverage record.

58. **Chunk-limit setting names differ.**
    - `03-r2-components-and-rendering.md` §5: `chunk_max_frames = 150`.
    - `05-r4-compiler-and-render-plan.md` §5: `chunk.maxFrames = 150`.
    - Resolution: make R4’s chunk policy authoritative and reuse its setting key in R2.

59. **Bake pixel limits differ in name and value.**
    - `03-r2-components-and-rendering.md` §5: `bake_max_pixels = 4096 × 4096`.
    - `05-r4-compiler-and-render-plan.md` §5: `bake.maxPixels = 16,000,000`.
    - Resolution: choose one total-pixel cap and specify any separate maximum dimension.

60. **Browser concurrency defaults disagree.**
    - `03-r2-components-and-rendering.md` §§2.8, 5: pool “starts at 4”; `browser_pool_size = 4`.
    - `06-r5-scheduler-and-recovery.md` §§2.8, 5: memory-sized pool capped by `browser.max = 6`.
    - Resolution: distinguish initial size from maximum size under one Scheduler-owned policy.

61. **LLM concurrency and rate ceilings disagree.**
    - `06-r5-scheduler-and-recovery.md` §5: `llm.max_concurrent = 16`; `llm.limit_fraction = 0.8`.
    - `07-r6-harness.md` §5: `llm.max_concurrent_requests = 8`; ceilings `120 RPM / 6,000,000 TPM`.
    - Resolution: define one effective limiter policy; if harness limits are subordinate, state how the limits compose.

62. **Retry limits have two owners and defaults.**
    - `06-r5-scheduler-and-recovery.md` §5: `retry.transient_max = 3`, “4 for model 529.”
    - `07-r6-harness.md` §§4, 5: `llm.retry_max = 4` for the listed transient failures.
    - Resolution: retain one Scheduler retry setting, with explicit per-error overrides.

63. **SQLite synchronous setting has two keys.**
    - `04-r3-project-model-and-storage.md` §5: `sqlite_synchronous = FULL`.
    - `06-r5-scheduler-and-recovery.md` §5: `db.synchronous = FULL`.
    - Resolution: use one database-wide setting key.

64. **Blob grace periods disagree.**
    - `04-r3-project-model-and-storage.md` §5: `blob_grace_hours = 24`.
    - `06-r5-scheduler-and-recovery.md` §5: `gc.grace_s = 3600`.
    - Resolution: select one sweep grace period and unit.

65. **Finalization reserves differ in name, value, and scope.**
    - `06-r5-scheduler-and-recovery.md` §5: `budget.delivery_reserve_usd = 0.50`.
    - `09-r9-quality.md` §5: `budget.final_reserve_usd = 0.40`.
    - Also `07-r6-harness.md` §5: `budget.wrapup_reserve_usd = 0.25`.
    - Resolution: specify whether these are separate allocations or one reserve, then define the total withheld amount.

66. **Loudness tolerance differs.**
    - `08-r7-studio-tools.md` §5: `delivery.audio.tolerance_lu = 0.5`.
    - `09-r9-quality.md` §5: `loud.tolerance_lu = 1.0`.
    - Resolution: have checks read the delivery profile’s target and tolerance directly.

67. **Caption duration defaults disagree.**
    - `08-r7-studio-tools.md` §5: `captions.min_duration_ms = 400`.
    - `09-r9-quality.md` §5: `caption.min_ms = 700`.
    - Resolution: use one minimum-duration setting for generation and validation.

68. **Other caption setting names differ.**
    - `08-r7-studio-tools.md` §5: `captions.max_cps`, `captions.max_lines`.
    - `09-r9-quality.md` §5: `caption.max_cps`, `caption.max_lines`.
    - Resolution: standardize the namespace and carry the children’s-content CPS override into validation.

69. **Footprint tolerance has two setting names.**
    - `05-r4-compiler-and-render-plan.md` §5: `staging.tolerance = 8`.
    - `09-r9-quality.md` §5: `footprint.tolerance_du = 8`.
    - Resolution: use the same setting for the same footprint check.

70. **Anchor tolerance differs.**
    - `05-r4-compiler-and-render-plan.md` §§D9, 5: after-render anchor checks use `staging.tolerance = 8`.
    - `09-r9-quality.md` §5: `anchor.tolerance_du = 6`.
    - Resolution: define a separate shared anchor tolerance and use it in both verification paths.

71. **Author repair setting names differ.**
    - `03-r2-components-and-rendering.md` §5: `repair_author_attempts`, `repair_escalated_attempts`.
    - `07-r6-harness.md` §5: `author.repair_attempts_max`, `author.escalation_attempts`.
    - Resolution: use one author-loop configuration schema.

72. **View output caps differ without a wrapper rule.**
    - `04-r3-project-model-and-storage.md` §5: `view_max_tokens = 4,000`.
    - `07-r6-harness.md` §5: `tool.result_max_tokens = 2,000`.
    - Resolution: specify whether the harness requests a smaller Project Core page or performs additional truncation while preserving its cursor.

73. **Spike `S7` identifies unrelated experiments.**
    - `03-r2-components-and-rendering.md` §9: “S7 colour and mux.”
    - `07-r6-harness.md` §9: “S7: Reviewer accuracy with thinking off.”
    - Resolution: namespace the identifiers, for example `R2-S7` and `R6-S7`.

74. **Spike `S8` identifies unrelated experiments.**
    - `03-r2-components-and-rendering.md` §9: “S8 containment.”
    - `07-r6-harness.md` §9: “S8: structured submission without forced tool choice.”
    - Resolution: namespace both identifiers and their claim-table references.

75. **Spike `S9` identifies unrelated experiments.**
    - `03-r2-components-and-rendering.md` §9: “S9 fonts.”
    - `07-r6-harness.md` §9: “S9: researcher injection resistance.”
    - Resolution: namespace both identifiers.

76. **Spike `S10` identifies unrelated experiments.**
    - `03-r2-components-and-rendering.md` §9: “S10 pixel history.”
    - `07-r6-harness.md` §9: “S10: segment restart fidelity.”
    - Resolution: namespace both identifiers.

77. **Bare numbered spikes `1`–`5` collide.**
    - `06-r5-scheduler-and-recovery.md` §9: `1` SQLite, `2` billing, `3` rate limits, `4` browser memory, `5` restart recovery.
    - `09-r9-quality.md` §9: `1` slowed clips, `2` probe checks, `3` WER, `4` Reviewer recall, `5` mux offset.
    - Resolution: prefix every numeric spike reference with its stage.

## GAP

78. **R2’s full static metadata cannot be stored as the promised copy.**
    - `03-r2-components-and-rendering.md` §§2.2, 3: requires `contract`, duration kind, font weights/italic, control `maxLength`, and “a copy of `meta`.”
    - `04-r3-project-model-and-storage.md` §2.2: component metadata omits those fields and places fonts in separate references.
    - Resolution: import R2’s complete metadata schema into R3 or define which fields are derived and how.

79. **Component duration units lack a storage-boundary conversion.**
    - `03-r2-components-and-rendering.md` §2.2: fixed duration uses `seconds:number`.
    - `04-r3-project-model-and-storage.md` §2.1: “Times and durations are integer flicks.”
    - Resolution: specify seconds-to-flick conversion and distinguish embedded source metadata from normalized project metadata.

80. **Render Plan flick times lack the explicit conversion to the component’s seconds clock.**
    - `05-r4-compiler-and-render-plan.md` §D5: `localTime` is “flicks per frame.”
    - `03-r2-components-and-rendering.md` §§2.2–2.3: `seek(t,controls)` uses seconds; messages contain both `t` and `tFlicks`.
    - Resolution: define the frame-packet adapter, including rounding, local versus film time, and the meaning of `frame`.

81. **Render Plan timeline/range units are not stated at the interface.**
    - `05-r4-compiler-and-render-plan.md` §D5: `filmStart:number`, `local:[number,number]`.
    - `06-r5-scheduler-and-recovery.md` §2.4: range needs explicitly use `unit:'frame'`.
    - Resolution: annotate every plan position/range as film frames, unit-local frames, or flicks and define the conversion.

82. **Probe coordinate space changes before the compiler consumes it.**
    - `03-r2-components-and-rendering.md` §2.4: “The host maps each rectangle to screen space.”
    - `05-r4-compiler-and-render-plan.md` §D9: verification consumes a box “in the component's own viewport” and maps it through placement and camera.
    - Resolution: retain named local and screen rectangles in the sidecar, or choose one canonical space and transform exactly once.

83. **The chunk-sidecar envelope is missing.**
    - `05-r4-compiler-and-render-plan.md` §D9: needs records keyed by “frame, layer and `data-cut-id`.”
    - `03-r2-components-and-rendering.md` §2.4: `ProbeItem` contains `id`, `kind`, `rect`, visibility and text, but no frame/layer envelope.
    - Resolution: define the JSON-lines record schema, including frame number, layer identity, unit identity, coordinate space, and stride.

84. **Required diagnostic capture modes have no renderer contract.**
    - `09-r9-quality.md` §3.1: needs “hide one element, isolate one layer, tint one element.”
    - `03-r2-components-and-rendering.md` §§2.3, 3: the message protocol exposes init/seek/probe and the interface lists ordinary render capabilities.
    - Resolution: add explicit trusted diagnostic-capture inputs and cache-key rules, including Canvas support.

85. **Rendered text measurements are underspecified.**
    - `09-r9-quality.md` §3.1: needs “rendered font size” and tests height “after all transforms.”
    - `03-r2-components-and-rendering.md` §2.4: provides local `sizePx`, rectangles, and a color string.
    - Resolution: specify transformed text metrics, color/opacity interpretation, and how local text measurements become design-unit measurements.

86. **Chart checks require bound values that probes cannot carry.**
    - `08-r7-studio-tools.md` §2.6: each mark and label carries “its bound value.”
    - `03-r2-components-and-rendering.md` §2.4: `ProbeItem` and `cut.mark(id,rect,text?)` have no value or scale fields.
    - Also `09-r9-quality.md` §6: charts must report plotted values through `report()`.
    - Resolution: add typed chart probe payloads for values, scale, baseline, and mark geometry.

87. **Planned sync checks lack an observed-event signal.**
    - `09-r9-quality.md` §D6: compare the “first frame on which the probe shows the visual event” with the cue.
    - `03-r2-components-and-rendering.md` §2.4: probes report geometry, visibility, clipping, and text.
    - Resolution: define an event-to-probe predicate or explicit event marker in the probe schema.

88. **The plan does not provide the declarations quality detectors require.**
    - `09-r9-quality.md` §3.1: needs “declared hold, black and silent intervals” and “visual-audio pairs.”
    - `05-r4-compiler-and-render-plan.md` §D5: the Render Plan includes visual units, audio/caption parts, timing, and source maps, but no such declarations.
    - Resolution: add a quality-declarations part with typed intervals, expected motion, and sync-pair bindings.

89. **A rendered chunk’s payload remains unresolved outside R2.**
    - `03-r2-components-and-rendering.md` §2.9: explicitly chooses “an H.264 segment” joined by stream copy.
    - `05-r4-compiler-and-render-plan.md` §10.3: asks “whether R2 stores frames or encoded segments.”
    - Also `06-r5-scheduler-and-recovery.md` §2.4: publishes a generic range `artifact_ref`.
    - Resolution: adopt R2’s encoded-segment result type, including codec/timebase, frame range, frame count, probe sidecar, and fallback format.

90. **Atomic chunks versus partial leaf ranges lack a capability-specific rule.**
    - `03-r2-components-and-rendering.md` §4: “A chunk is atomic: its segment is stored only when complete.”
    - `06-r5-scheduler-and-recovery.md` §2.4: ranges may be “published by a leaf attempt.”
    - Resolution: state that `chunk.render` publishes only its complete segment; aggregate renders may expose completed child-chunk ranges.

91. **The plan’s output settings cannot fully determine R2’s encodes.**
    - `03-r2-components-and-rendering.md` §2.12: each rung fixes JPEG quality, x264 preset, and CRF.
    - `05-r4-compiler-and-render-plan.md` §D5: `delivery` contains profile, FPS, scale, frame step, and frame format.
    - Resolution: pin the rung/settings bundle or include quality, preset, CRF, codec, and color settings explicitly.

92. **The chunk work key omits settings that change the encoded chunk.**
    - `03-r2-components-and-rendering.md` §§2.9, 2.12: chunks are encoded with rung-specific preset and CRF.
    - `05-r4-compiler-and-render-plan.md` §D6: output-key inputs list “frame format and quality, colour,” but not the segment encoder settings.
    - Resolution: include all segment-encoding parameters and encoder version in the chunk work key.

93. **Trusted host layer kinds are absent from the Render Unit union.**
    - `03-r2-components-and-rendering.md` §2.6: trusted “media, captions, fills, effects” live in the host.
    - `05-r4-compiler-and-render-plan.md` §D5: layer sources are only `component`, `media`, `baked`, `placeholder`.
    - Resolution: add trusted source kinds and their schemas, or define an explicit representation for each.

94. **Per-layer filters are not represented.**
    - `03-r2-components-and-rendering.md` §2.6: per-layer properties include `filter`.
    - `05-r4-compiler-and-render-plan.md` §D5: only the group node has `filter?:Filter[]`; `Layer` does not.
    - Resolution: add filter channels to layers or require an explicit single-layer group wrapper.

95. **R2’s expected plan input is not R4’s emitted plan input.**
    - `03-r2-components-and-rendering.md` §3: expects “tracks, time map … camera track.”
    - `05-r4-compiler-and-render-plan.md` §D5: those are lowered into frame tables.
    - Resolution: replace R2’s input contract with the lowered Render Unit and frame-packet schemas.

96. **Compiler execution submission has no owner.**
    - `06-r5-scheduler-and-recovery.md` §3: R4 “Submits a Render Plan as job specifications” and releases replaced consumers.
    - `05-r4-compiler-and-render-plan.md` §D12: the compiler must never “start a job.”
    - Resolution: assign plan submission/replacement to a render coordinator or harness facade, separate from pure compilation.

97. **The plan does not contain the job specification promised to Scheduler.**
    - `06-r5-scheduler-and-recovery.md` §3: needs `requires`, purpose, cost tier, group/chunk structure, and one consumer per plan.
    - `05-r4-compiler-and-render-plan.md` §D5: chunks contain only `unit`, `local`, `workKey`; bake/audio parts are hashes.
    - Resolution: define a deterministic plan-to-job-spec adapter with explicit dependency and readiness construction.

98. **Non-chunk work keys and dependencies are promised but not represented.**
    - `05-r4-compiler-and-render-plan.md` §3: promises “chunk, bake, mix and encode work keys and their dependencies.”
    - `06-r5-scheduler-and-recovery.md` §§2.2–2.4: scheduling depends on pinned specifications and `job_dep`.
    - Resolution: add keyed bake/mix/finish nodes and dependency edges to the emitted execution manifest.

99. **A work key cannot establish revision identity as Scheduler claims.**
    - `05-r4-compiler-and-render-plan.md` §D6: explicitly excludes “revision and plan IDs.”
    - `06-r5-scheduler-and-recovery.md` §2.4: “the work key fixes the revision.”
    - Resolution: track revision/plan provenance on consumers; let the work key identify reusable execution inputs only.

100. **Compiler request options disappear in the harness tool.**
     - `05-r4-compiler-and-render-plan.md` §§D1, D4–D7: requests need mode, grade, scope, and output settings.
     - `07-r6-harness.md` §D4: `compile_request` takes only “revision, profile, shot scope.”
     - Resolution: expose those options or specify exact defaults and how still/range requests select them.

101. **Compiler result fields disappear in the harness tool.**
     - `05-r4-compiler-and-render-plan.md` §D1: returns `{plan?,diagnostics,timingReport,feasibility}`.
     - `07-r6-harness.md` §D4: returns “compilation handle, top diagnostics, evidence ref.”
     - Resolution: define the compilation record and how tools retrieve its plan, feasibility, and timing report.

102. **Isolated-layer rendering has no compiler scope contract.**
     - `07-r6-harness.md` §D4: `render_request` accepts “isolated layers.”
     - `05-r4-compiler-and-render-plan.md` §D7: scope is shots, a film frame range, or an explicit frame list.
     - Resolution: define diagnostic layer selection and its interaction with groups, masks, camera, and work keys.

103. **Project read views do not map to the available Project Core operations.**
     - `04-r3-project-model-and-storage.md` §2.13: exposes `outline`, `get`, `find`, `refs`, `timeline`, `impact`, `validate`, `diff`, `history`, `experience`.
     - `07-r6-harness.md` §§D3–D4: exposes `project_read` with `card|summary|full`, plus diff/history.
     - Resolution: define selector/view mappings and expose the missing graph, timeline, impact, validation, and experience operations.

104. **The harness lacks the merge operation required before promotion.**
     - `04-r3-project-model-and-storage.md` §§2.7, 2.9: “If the head has moved, the caller merges first”; conflicts use a `resolutions` map.
     - `07-r6-harness.md` §D4: no merge tool or merge-resolution input is listed.
     - Resolution: add `project_merge` or specify that another named tool performs merge and accepts conflict resolutions.

105. **Scheduler retry and quarantine operations are not wired to tools.**
     - `06-r5-scheduler-and-recovery.md` §§2.4, 3: exposes `retry`, `quarantine`; job tools should map to `view`, `cancel`, `retry`, `budget`.
     - `07-r6-harness.md` §D4: lists status, cancel, and budget, but no retry or quarantine operation.
     - Resolution: expose authorized operations or document an automatic/internal-only path.

106. **Cancellation result shapes differ.**
     - `06-r5-scheduler-and-recovery.md` §2.7: returns outcomes such as `completed_before_cancel`, with consumer release and potentially continuing shared work.
     - `07-r6-harness.md` §D4: returns “cancelled, already finished and `unknown_outcome` lists.”
     - Resolution: define a shared `CancelOutcome` including consumer release, shared-job continuation, pending stop, and completion races.

107. **Studio plugins are promised without a concrete tool catalogue.**
     - `07-r6-harness.md` §D4: “R7 plugins add audio, media-acquisition and capture tools.”
     - `08-r7-studio-tools.md` §3: promises R6 a “Tool list and bundle contents,” but defines provider interfaces rather than registered tool names and envelopes.
     - Resolution: enumerate Studio tools with input/output schemas, role permissions, effect classes, and typed errors.

108. **The plugin voice example does not connect its result to a line.**
     - `07-r6-harness.md` §D9: `voice_request` uses `VoiceRequest` and returns `JobHandle`.
     - `08-r7-studio-tools.md` §2.2.1: `VoiceRequest` contains text, voice, direction, and variant, but no target line or base revision.
     - Resolution: wrap provider requests in a pinned Studio job request containing the line, revision, and publication policy.

109. **Voice profiles have no valid storage schema.**
     - `08-r7-studio-tools.md` §§2.2.1, 3: voice profile is “an asset” with origin, voice ID, prompt, licence, and owning character.
     - `04-r3-project-model-and-storage.md` §2.2: asset classes are `image|video|audio|font_file|data`; object voice is only `{profile,style}`.
     - Resolution: define a voice-profile entity or a typed data-asset payload and reference type.

110. **Dataset, binding, media-need, and capture-session records have no home.**
     - `08-r7-studio-tools.md` §§2.4, 2.6–2.7, 3: requires those records and their relationships.
     - `04-r3-project-model-and-storage.md` §2.2: none is an entity kind; `asset.class:data` has no corresponding payload contract.
     - Resolution: add typed entities or defined asset/side-record schemas with dependency annotations.

111. **Display/spoken text and token mapping cannot be stored.**
     - `08-r7-studio-tools.md` §2.2.1: lines store `display_text`, `spoken_text`, and a token map.
     - `04-r3-project-model-and-storage.md` §2.2: `voice_line` has a single `text`.
     - Resolution: add the two text forms and a stable token mapping to R3.

112. **Pronunciation data structures differ.**
     - `04-r3-project-model-and-storage.md` §2.2: `pronunciations:{word:hint}`.
     - `08-r7-studio-tools.md` §2.2.1: `pronunciations:{token:number;say:string}[]`.
     - Resolution: use token-addressed pronunciations, with a defined authoring convenience for word-wide rules.

113. **Sample-exact take anchors require fields R3 does not supply.**
     - `05-r4-compiler-and-render-plan.md` §§D3, 3: uses `sampleCount × flicksPerSample`; needs “Take durations in samples.”
     - `04-r3-project-model-and-storage.md` §2.2: take has measured `duration`, but no required sample count or sample rate.
     - Resolution: store required decoded sample count and rational sample rate on takes or their audio assets.

114. **Timing precision is not carried consistently.**
     - `05-r4-compiler-and-render-plan.md` §§D3, 3: needs word marks with precision and labels forced alignment estimated.
     - `08-r7-studio-tools.md` §2.2.1: uses timing-method labels and optional confidence.
     - Resolution: separate method (`native|aligned|estimated`) from precision/confidence, and define propagation into timing and caption plans.

115. **Accepted-take status has no recording contract.**
     - `05-r4-compiler-and-render-plan.md` §D4: final compilation requires “takes accepted.”
     - `04-r3-project-model-and-storage.md` §2.2: stores `selected_take`, but defines no take-acceptance fact or acceptance operation.
     - Resolution: distinguish selection from acceptance and define the Project Core record and tool that writes acceptance.

116. **Music and SFX fields needed by Studio are missing.**
     - `08-r7-studio-tools.md` §§2.2.1–2.2.3: requires stems, sections, verified beat grids, placement, gain keyframes, and an SFX sync point.
     - `04-r3-project-model-and-storage.md` §2.2: music has `tempo_map`, markers, start, gain, ducking; SFX has event offset, gain, pan.
     - Resolution: extend the cue schemas with those fields and define sync-point subtraction during lowering.

117. **Verified beat-grid readiness is not enforced by the compiler.**
     - `08-r7-studio-tools.md` §2.2.2: visuals may freeze only against authored or verified grids.
     - `05-r4-compiler-and-render-plan.md` §D3: imported beat maps are used as analysed times labelled `estimated`.
     - Resolution: add grid source, verification evidence, and tolerance to the compiler’s frozen-readiness predicates.

118. **Layered acting precedence is not representable in R3.**
     - `08-r7-studio-tools.md` §2.3.3: `base`, `derived`, `acting`, `override`; highest layer wins.
     - `04-r3-project-model-and-storage.md` §2.2: control tracks have no priority/layer field.
     - Resolution: add the performance layer and define its interval/precedence semantics in both schema and compiler.

119. **Host placement tracks have no declared target-channel contract.**
     - `08-r7-studio-tools.md` §2.3.2: placement is “host-level tracks on the object.”
     - `04-r3-project-model-and-storage.md` §2.2: tracks target layers or cameras; layer transforms are stored separately.
     - Resolution: specify layer-transform channels and distinguish them from component controls and object identity.

120. **Per-instance seeds, parallax, and effect groups lack authored fields.**
     - `05-r4-compiler-and-render-plan.md` §§D5, D10, 3: uses component-instance seeds, optional parallax, and nested groups.
     - `04-r3-project-model-and-storage.md` §2.2: layer has no seed, parallax, or group membership.
     - Resolution: add these authored fields or define deterministic derivation rules for each.

121. **Timing preferences and priorities are absent from constraints.**
     - `05-r4-compiler-and-render-plan.md` §§D3, 3: requires bounds, “preferred value and priority.”
     - `04-r3-project-model-and-storage.md` §2.2: constraints have `min`, `max`, `strength`, and `reason`.
     - Resolution: add preferred value and integer priority with exact solver semantics.

122. **Compiler lock kinds have no mapping to Project Core locks.**
     - `05-r4-compiler-and-render-plan.md` §3: requires “lock kinds (duration, placement, value).”
     - `04-r3-project-model-and-storage.md` §2.2: locks specify target, paths, subtree, authority level, and reason.
     - Resolution: derive compiler equalities from locked paths or add explicit semantic lock payloads.

123. **Actions and component minimum durations are referenced but not modeled.**
     - `05-r4-compiler-and-render-plan.md` §D3: creates start/end points per “action” and reads “minimum durations declared by components.”
     - `04-r3-project-model-and-storage.md` §2.2: no action kind or minimum-action-duration contract exists.
     - Resolution: define actions as entities or track intervals and specify where their duration constraints live.

124. **Provisional layers cannot omit a component as planning requires.**
     - `05-r4-compiler-and-render-plan.md` §§D4, D7: supports `needs_authoring` and placeholders for a missing component.
     - `04-r3-project-model-and-storage.md` §2.2: every layer requires `component:Ref<component>`.
     - Resolution: permit an explicit unresolved visual binding or define a separate authored placeholder component.

125. **Caption style and cue schemas do not support renderer inputs.**
     - `03-r2-components-and-rendering.md` §2.15: needs style preset, direction, optional word timings, and language.
     - `04-r3-project-model-and-storage.md` §2.2: style is `Ref<component>`; authored cues contain only start, end, and text.
     - Resolution: define trusted caption-style data and a cue schema that carries word/display mappings and direction.

126. **The delivery profile cannot request both caption forms.**
     - `08-r7-studio-tools.md` §2.2.7: burn-in is normally on and “WebVTT and SRT sidecars are always written.”
     - `04-r3-project-model-and-storage.md` §2.2: captions is `burned|sidecar|none`.
     - Resolution: represent burn-in and sidecar outputs as independent options.

127. **Caption suppression during kinetic typography is not represented.**
     - `08-r7-studio-tools.md` §2.8: captions “are suppressed for that interval.”
     - `05-r4-compiler-and-render-plan.md` §D5: caption plan describes cues and presented frames, without suppression intervals or rules.
     - Resolution: add explicit suppression intervals to the authored caption policy and lower them deterministically.

128. **Research trust labels cannot be persisted.**
     - `07-r6-harness.md` §D6.5: entities created from web text carry `trust:untrusted_web`.
     - `04-r3-project-model-and-storage.md` §§2.1–2.2: neither common fields nor claim/source schemas define `trust`.
     - Resolution: add trust/provenance labels and enforce them in every model-facing view.

129. **Source quality tiers cannot be stored.**
     - `08-r7-studio-tools.md` §2.5: sources record “a quality tier.”
     - `04-r3-project-model-and-storage.md` §2.2: source fields have type, publisher, snapshot, and licence, but no quality tier.
     - Resolution: define the tier vocabulary, authority, and evidence in R3.

130. **The Transcriber required by Quality is not supplied by Studio.**
     - `09-r9-quality.md` §§D5, 3.1: defines a `Transcriber` and lists it as “Needed from R7.”
     - `08-r7-studio-tools.md` §§2.2, 3: discusses alignment candidates and supplied word times but defines no transcription interface.
     - Resolution: assign ownership and specify request/result, timing units, normalization, failure mapping, and reconciliation.

131. **Capture-browser resource requirements have no Scheduler pool.**
     - `08-r7-studio-tools.md` §3: requires “a capture-browser pool” and per-host rate limits.
     - `06-r5-scheduler-and-recovery.md` §2.8: defines render-browser, FFmpeg, model, and paid-API pools.
     - Resolution: add a separate capture resource pool and shared per-host network limiter.

132. **Tutorial event-log timing is insufficiently typed for film mapping.**
     - `08-r7-studio-tools.md` §2.7: capture logs “times” and emits stills after settled steps.
     - `03-r2-components-and-rendering.md` §2.11: media frame sets require `{pts,ArtifactRef}` plus source timebase.
     - Resolution: define capture timestamps, timebase, frame durations, and mapping from step events to media presentation time.

133. **Readiness predicates use an untyped string instead of the shared facts model.**
     - `lld/02-r1-foundations.md` §4.2: consumers state conditions over separately owned completion, validation, acceptance, and eligibility facts.
     - `07-r6-harness.md` §D6.1: handoff inputs contain `required_readiness:string`.
     - Resolution: use a shared typed readiness-predicate schema that names each fact and its authority.

134. **R4’s feasibility vocabulary is not connected to Studio’s capability failures.**
     - `05-r4-compiler-and-render-plan.md` §D4: returns `needs_adaptation`, `needs_authoring`, `unknown_test_required`, and other feasibility states.
     - `08-r7-studio-tools.md` §2.3.6: missing controls produce a `capability` failure.
     - Resolution: map planning feasibility states to remediation requests without turning every planning gap into a failed execution job.

135. **Review locations use seconds without a defined normalization step.**
     - `lld/02-r1-foundations.md` §5: persisted evidence locations use “a time interval in flicks.”
     - `09-r9-quality.md` §3.2: ReviewOutput uses `t_start_s` and `t_end_s`.
     - Resolution: define validated seconds-to-flick conversion before evidence storage, retaining the submitted values for audit.

136. **Review verdict output omits a baseline verdict.**
     - `lld/02-r1-foundations.md` §5: verdicts include `NOT_APPLICABLE`.
     - `09-r9-quality.md` §3.2: answer verdicts allow only `PASS|FAIL|UNKNOWN`.
     - Resolution: allow `NOT_APPLICABLE` in Reviewer answers or specify that applicability is determined and recorded outside the model output.

137. **Changed Quality Intent revalidation is too narrow for its contents.**
     - `04-r3-project-model-and-storage.md` §2.9: changes to `brief` or `quality_intent` trigger “Reviews only.”
     - `09-r9-quality.md` §3.4: Quality Intent contains hard constraints, waivers, lexicon, and settings overrides; changes “re-key the checks that read it.”
     - Resolution: revalidate deterministic checks whose declared inputs include the changed Quality Intent fields.

138. **Source-count rules are not reconciled.**
     - `08-r7-studio-tools.md` §§2.5, 5: numbers need `research.min_sources_for_numbers = 2`.
     - `09-r9-quality.md` §3.1: K-01 requires at least one source, or two if essential.
     - Resolution: define whether all numerical claims require two sources and have K-01 enforce the same rule.

139. **Probe-only findings have incompatible evidentiary status.**
     - `03-r2-components-and-rendering.md` §4: a probe outside its declared footprint directly produces a creative diagnostic.
     - `09-r9-quality.md` §D3: “a probe-only result is a hypothesis until a diagnostic capture confirms it.”
     - Resolution: state which conservative probe checks are definitive and which require pixel confirmation.

140. **Blank/flat-color exemptions have no declared-data field.**
     - `09-r9-quality.md` §3.1: C-05 permits a flat color “unless declared.”
     - `03-r2-components-and-rendering.md` §§2.2, 2.13: metadata has no flat-color/blank-intent declaration; V5 checks blankness.
     - Resolution: add an explicit expected-blank/flat-color declaration and define which validator consumes it.

141. **Final-file audio duration verification lacks an agreed sample-rounding contract.**
     - `05-r4-compiler-and-render-plan.md` §D5: output positions are `round(t/14,700)` and total length comes from `N×T`.
     - `09-r9-quality.md` §3.1: F-01 requires duration `N·T` “exact.”
     - Resolution: distinguish exact video-frame duration from rounded PCM sample count and encoded-container duration tolerances.

142. **Caption reading-speed policy has an unsupported children’s override.**
     - `08-r7-studio-tools.md` §5: `captions.max_cps = 20`, “17 for children's content.”
     - `09-r9-quality.md` §§3.1, 5: A-03 uses a fixed default of 20 CPS.
     - Resolution: have A-03 read the same audience-specific caption settings used by segmentation.

143. **The R3 dependency store does not record the pinned commitment versions R5 requires.**
     - `04-r3-project-model-and-storage.md` §§2.1, 2.6: typed references store entity IDs; `dep_edge` points to `to_entity`.
     - `06-r5-scheduler-and-recovery.md` §2.3: requires “entity → commitment version it was authored against.”
     - Resolution: store authored-against version pins separately from current typed references and include them in stale-assumption queries.

144. **The spine’s post-merge validation requirement has no agreed execution point.**
     - `00-design-spine.md` §S2: after field merge, “the normal validators (timing solve, spatial checks) run.”
     - `04-r3-project-model-and-storage.md` §2.9: merge runs structural stages 6 and 7 and stores a `revalidate` set.
     - Resolution: define the coordinator that runs compiler/quality validation after merge and whether its completion is required before promotion.

145. **The spine’s shot-only execution unit is narrower than R4’s transition unit.**
     - `00-design-spine.md` §S3: rendering/caching unit is “a shot chunk.”
     - `05-r4-compiler-and-render-plan.md` §§D5, 7: a transition is “its own render unit” containing both shots.
     - Resolution: propagate the declared R4 deviation into Scheduler group/range semantics and replace shot-only assumptions with render-unit terminology.
