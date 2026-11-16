## BLOCKING

1. **A stream error bypasses paid-call reconciliation.**
   - `06-r5-scheduler-and-recovery.md` §2.6: “a reset or error after response bytes began” is **ambiguous** and enters `unknown_outcome`.
   - `07-r6-harness.md` §4: “A stream `error` event” is “Outcome known; `transient`” and follows ordinary retry.
   - **Fix:** Route stream errors after response bytes through reconciliation; distinguish an explicit, conclusive provider rejection.

2. **Two sources determine paint order.**
   - `04-r3-project-model-and-storage.md` §2.2: `shot.layers` is “paint order, bottom to top.”
   - `05-r4-compiler-and-render-plan.md` D5: “`stack` is in paint order, from the scene context's draw groups and each layer's `order`.”
   - **Fix:** Make `shot.layers` authoritative and treat scene-context ordering as constraints to validate.

3. **The compiler’s final-readiness policy omits the voice-timing requirement.**
   - `08-r7-studio-tools.md` §2.2.1: “A `final` compile requires `native` or `aligned` (`voice.final_timing`).”
   - `05-r4-compiler-and-render-plan.md` D4: final readiness adds frozen commitments, eligible assets and verified beat grids, but no take-timing requirement.
   - **Fix:** Add `voice.final_timing` to final readiness and define the diagnostic for an estimated take.

4. **Missing probes have different gating effects.**
   - `03-r2-components-and-rendering.md` §2.13: V5’s **C-05 corrective** checks include “promised probe IDs present, boxes on the canvas.”
   - `09-r9-quality.md` §3.1: C-05 checks flat colour; promised probe IDs belong to **C-06 observational**, and `PROBE_MISSING` produces `UNKNOWN`, severity `note`.
   - **Fix:** Align R2’s V5 partition and gating with R9’s canonical check definitions.

5. **Quality can prematurely terminate the component-author repair loop.**
   - `07-r6-harness.md` D6.2: “a repeated error does not escalate early”; M3 escalation follows exhausted Flash attempts.
   - `09-r9-quality.md` D8 and §3.5: a repeated signature “escalates early” / “escalates at once (`revision.same_signature_limit`).”
   - **Fix:** Exempt R6’s local component loop from the Director revision-signature rule.

6. **Rights checks require fields missing from several entity schemas.**
   - `04-r3-project-model-and-storage.md` §2.10: `rights_closure` lists every “asset, font, library and voice profile … with its status.”
   - The same file §2.2 gives `font`, `library` and `voice_profile` a `licence`, but no `rights` or rights-state field; `09-r9-quality.md` §3.1 R-01 requires rights state `eligible`.
   - **Fix:** Give these kinds a canonical rights record or an explicit reference to one, and include libraries explicitly in R-01.

7. **`music_request` reads a brief that the stored music cue cannot hold.**
   - `08-r7-studio-tools.md` §§2.2.2, 2.9: the cue carries “a mood brief, target duration, tempo range, section plan”; `music_request` targets a cue “which holds the brief.”
   - `04-r3-project-model-and-storage.md` §2.2: `music_cue` has no request, brief, target-duration or tempo-range fields.
   - **Fix:** Add the generation-request fields to `music_cue`, or make them explicit tool inputs.

8. **`sfx_request` reads a description that the stored effect cue cannot hold.**
   - `08-r7-studio-tools.md` §§2.2.3, 2.9: the cue gives “a description, category, maximum duration and preferred origin”; `sfx_request` reads the cue’s description.
   - `04-r3-project-model-and-storage.md` §2.2: `sfx_cue` contains playback fields but none of those generation fields.
   - **Fix:** Add a typed request block to `sfx_cue`, or pass that block to `sfx_request`.

9. **Detected beat times have no stored representation.**
   - `05-r4-compiler-and-render-plan.md` D3: “An imported grid is a list of analysed beat times.”
   - `04-r3-project-model-and-storage.md` §2.2: `music_cue.beat_grid` only stores `tempo_map`, `first_downbeat`, `source` and `verified`; no analysed beat-time list exists.
   - **Fix:** Define the beat-time representation and its units, including how it relates to the tempo map.

10. **The still rung conflicts with the universal chunk-result contract.**
    - `03-r2-components-and-rendering.md` §2.12: rung `still` has encode “none.”
    - `05-r4-compiler-and-render-plan.md` D7 nevertheless submits `chunk.render` for stills; D6 and `06-r5-scheduler-and-recovery.md` §2.4 require an encoded H.264 `segment`.
    - **Fix:** Define a still-result variant or a separate still-capture capability and its work key.

11. **F-05 assigns revision ownership to reusable work keys.**
    - `06-r5-scheduler-and-recovery.md` §2.2: a work key contains “no revision, plan, branch, entity ID”; two revisions share one job.
    - `09-r9-quality.md` §3.1 F-05: “Plan hash and every work key belong to the accepted revision.”
    - **Fix:** Check that the accepted plan’s execution graph requests those keys and that the consumer records the accepted revision.

12. **Quality rejects late results more broadly than the Scheduler permits.**
    - `06-r5-scheduler-and-recovery.md` §4: a late result is used when the newer plan requests “the same work key.”
    - `09-r9-quality.md` §4: after an upstream revision, “Its work key is not in the accepted closure, so no result attaches.”
    - **Fix:** Make the Quality rule conditional on whether the accepted plan still requests that work key.

13. **The harness forbids a record that Quality requires for blocked exports.**
    - `07-r6-harness.md` §4: after a final MP4 lacks audio, “no deliverable record is written until it passes.”
    - `09-r9-quality.md` §§3.6–3.7: the deliverable record includes `completion_state: blocked` when a hard check fails or is unknown.
    - **Fix:** Distinguish writing a blocked export record from declaring successful delivery.

14. **Post-merge compilation is submitted as an undefined job capability.**
    - `04-r3-project-model-and-storage.md` §2.9 and `07-r6-harness.md` D10: the merge handler requests a compile and checks “as jobs.”
    - `05-r4-compiler-and-render-plan.md` D1: compiler tools run inside handlers; `06-r5-scheduler-and-recovery.md` §2.5’s closed capability catalogue has no compile capability.
    - **Fix:** Run compilation directly in the merge handler and submit only the resulting execution/check jobs.

## NAMING

15. **Experience lookup still uses the renamed `signature` field.**
    - `04-r3-project-model-and-storage.md` §2.11: “The draft's `signature` field is renamed `approach`.”
    - `07-r6-harness.md` D4: `experience_search` takes “signature”; D6.5 also matches a trial’s “signature and context.”
    - **Fix:** Use `approach` consistently for experience matching; reserve `signature` for findings.

16. **The harness’s patch envelope omits `rebase`.**
    - `04-r3-project-model-and-storage.md` §2.4: `{base, branch, intent, key?, unlock?, rebase?, dry_run?, ops[]}`.
    - `07-r6-harness.md` D4: “R3's envelope” lists `base`, `branch`, `intent`, `key`, `unlock`, `dry_run`, `ops`, omitting `rebase`.
    - **Fix:** Include `rebase` and preserve R3’s optionality.

17. **`plan_diff` accepts different identifiers and promises different results.**
    - `05-r4-compiler-and-render-plan.md` D1: input “Two plan IDs”; result includes units, chunks, frames, bakes, audio clips and caption cues.
    - `07-r6-harness.md` D4: input “two compilation or plan IDs”; output “render units, chunks and work keys.”
    - **Fix:** Publish one signature and complete result schema, including any compilation-ID resolution.

18. **`timing_explain` has incompatible selector inputs.**
    - `05-r4-compiler-and-render-plan.md` D1: `compilation_id`, “optional event or constraint.”
    - `07-r6-harness.md` D4: “compilation ID, events or a conflict.”
    - **Fix:** Define one selector union and use its exact field names in both documents.

19. **An unknown control has two diagnostic names.**
    - `05-r4-compiler-and-render-plan.md` D2: `UNKNOWN_CONTROL`.
    - `08-r7-studio-tools.md` §2.9: `performance_author` returns `CONTROL_UNKNOWN`.
    - **Fix:** Use `UNKNOWN_CONTROL` throughout, or explicitly document distinct conditions and owners.

20. **R2 leaves its performance-check ID unmapped.**
    - `03-r2-components-and-rendering.md` §2.13: V6’s R9 check is “—”.
    - `09-r9-quality.md` §3.1: “V6 C-09”; C-09 is seek/capture performance.
    - **Fix:** Label R2 V6 as C-09.

21. **The scene-context commitment enumeration is narrower in R4.**
    - `04-r3-project-model-and-storage.md` §2.1: commitments use all R1 states, including `superseded` and `withdrawn`.
    - `05-r4-compiler-and-render-plan.md` D9’s “stored shape” permits only `exploring | provisional | frozen`.
    - **Fix:** Reuse R3’s commitment type, or explicitly identify D9 as a restricted compiler-input view.

22. **Suppressed captions are removed in one interface and retained in another.**
    - `03-r2-components-and-rendering.md` §2.15: “the compiler has already removed suppressed intervals.”
    - `05-r4-compiler-and-render-plan.md` D5: a cue is “marked `suppressed` and the burned-in layer hides it.”
    - **Fix:** Define whether the renderer receives removed cues, clipped cues or a suppression field.

23. **Canvas diagnostic support is stated differently.**
    - `03-r2-components-and-rendering.md` §2.16: hide/tint require DOM or SVG; Canvas returns `DIAG_UNSUPPORTED`.
    - `09-r9-quality.md` §8: the assumed feature is diagnostic modes “including on Canvas”; §9 R9-2 tests hide/tint on Canvas.
    - **Fix:** Make R9 honour the documented unsupported result, or extend R2’s contract before claiming Canvas support.

## GAP

24. **Charts declare parameters in an absent `meta` field.**
    - `08-r7-studio-tools.md` §2.6: “A chart component declares its data parameters in `meta`.”
    - `03-r2-components-and-rendering.md` §2.2 and `04-r3-project-model-and-storage.md` §2.2: the complete `Meta` types contain controls but no parameter declaration/schema.
    - **Fix:** Add a canonical parameter-schema field or identify an existing field that carries these declarations.

25. **The lowered media source cannot express promised crop information.**
    - `03-r2-components-and-rendering.md` §2.11: “Crop, transform and anchor positions … also come from the plan.”
    - `05-r4-compiler-and-render-plan.md` D5: media `Source` contains only `kind`, `frames` and `source_frame`; no crop or asset-mapping field is defined.
    - **Fix:** Specify lowered media crop/mapping fields and their source-pixel units.

26. **Configurable audio sample rates meet a fixed 48 kHz execution interface.**
    - `04-r3-project-model-and-storage.md` §2.2: delivery profiles have a rational `audio.sample_rate`; §2.4 only requires flick-exact rates.
    - `05-r4-compiler-and-render-plan.md` D5 and `08-r7-studio-tools.md` §2.2.6 use 48 kHz/14,700-flick samples throughout mixing.
    - **Fix:** Either constrain supported delivery profiles to 48 kHz or define final resampling and sample-index conversion.

27. **Chart geometry compares quantities without a coordinate-space conversion contract.**
    - `03-r2-components-and-rendering.md` §2.4: chart scales report `range_px` and `baseline_px` locally, while sidecar `rect_screen` is in transformed design units.
    - `09-r9-quality.md` §3.1 K-04 compares mark boxes through the chart scale; §5 defines tolerance as a fraction of the scale’s “pixel range.”
    - **Fix:** Specify which rectangle K-04 uses and how scale coordinates transform under layer/camera scaling and rotation.

28. **Anchor-follow placement is promised but absent from the sidecar schema.**
    - `03-r2-components-and-rendering.md` §2.6: follower “placement is recorded in the sidecar.”
    - The canonical sidecar in that file §2.4 and `09-r9-quality.md` §3.1 has rectangles and probe attributes, but no placement/matrix field.
    - **Fix:** Add the follower-placement record or state precisely how it is reconstructed from existing fields.

29. **The diagnostic safety flag is absent from the shared result shape.**
    - `03-r2-components-and-rendering.md` §2.16: “the chunk result is flagged `diagnostic`”; concat/mux must reject it.
    - `05-r4-compiler-and-render-plan.md` D6 and `06-r5-scheduler-and-recovery.md` §2.4 define only `{segment, frames, fps, probe_sidecar, rung}`.
    - **Fix:** Add `diagnostic` to the canonical result and specify how concat/mux validate it.

30. **Sync-pair construction assumes a track targets a probe.**
    - `04-r3-project-model-and-storage.md` §2.2: a track targets `Ref<layer|camera>`.
    - `05-r4-compiler-and-render-plan.md` D5: a `moved` pair comes from a track “whose target is the probe.”
    - **Fix:** Define the layer/control-to-probe binding used to select `probe_id`; otherwise emit `UNKNOWN`.

31. **Shift mode cannot identify which track to shift.**
    - `08-r7-studio-tools.md` §2.3.3 defines `shift(track, from, delta)`.
    - `07-r6-harness.md` D4 and `08-r7-studio-tools.md` §2.9 give `performance_author` a target **layer**, `from` and `delta`, but no track selector.
    - **Fix:** Add a target-track handle or define an explicit all-tracks selection rule.

32. **Module errors are missing from the harness’s tool contracts.**
    - `09-r9-quality.md` §4: `delivery_finalize` returns `HARD_CHECK_FAILED`; `03-r2-components-and-rendering.md` §2.16 defines `DIAG_UNSUPPORTED` and `DIAGNOSTIC_IN_DELIVERY`.
    - `07-r6-harness.md` D4 lists only `STALE_BASE`/`NOT_READY` for finalization and `NOT_READY` for rendering.
    - **Fix:** Include these module errors in the relevant tool schemas and specify asynchronous job-failure versus immediate tool-error delivery.

33. **Timing reads profile duration bounds that R3 does not define.**
    - `05-r4-compiler-and-render-plan.md` D3 lists “delivery-profile bounds” as hard timing constraints; D2’s `TIME_OUTSIDE_PROFILE` compares film length against profile bounds.
    - `04-r3-project-model-and-storage.md` §2.2 puts `duration_target: {min, max}` on `brief`; `delivery_profile` has no duration bounds.
    - **Fix:** Name the actual source of timing bounds and distinguish brief targets from hard profile constraints.

34. **Final documents still depend on the draft design spine.**
    - `03-r2-components-and-rendering.md` baseline and §7; `04-r3-project-model-and-storage.md` baseline; `05-r4-compiler-and-render-plan.md` baseline; `06-r5-scheduler-and-recovery.md` baseline; `07-r6-harness.md` §7; `08-r7-studio-tools.md` baseline; `09-r9-quality.md` baseline all link `drafts/00-design-spine.md`.
    - Representative quotes: R2 §7, “These refer to §S1 of the [design spine]”; R6 §7, “The [design spine] was the working draft.”
    - **Fix:** Replace these dependencies with final-contract section references or inline the retained decisions.

35. **Final documents still cite the draft resolutions as their baseline.**
    - `03-r2-components-and-rendering.md`, `04-r3-project-model-and-storage.md`, `05-r4-compiler-and-render-plan.md`, `06-r5-scheduler-and-recovery.md` and `09-r9-quality.md`, baseline blocks: `[integration resolutions](drafts/10-integration-resolutions.md)`.
    - `drafts/10-integration-resolutions.md` introduction: “The final LLDs must apply every item that touches them.”
    - **Fix:** Move the binding record to a final location and update the five links, or replace each dependency with the applied final sections.

## RESOLUTION NOT APPLIED

36. **R1 retains exact audio duration instead of the agreed sample-rounding rule.**
    - `02-r1-foundations.md` §1.4: “Audio is exactly `N·T` long.”
    - `drafts/10-integration-resolutions.md` §10, finding 35: mix length is `round(N·T / flicks_per_sample)` samples; `08-r7-studio-tools.md` §2.2.6 applies that rule.
    - **Fix:** Amend R1 §1.4 to distinguish exact film duration from the nearest integral audio sample count.

37. **Worker read sets still pin full version hashes.**
    - `drafts/10-integration-resolutions.md` §3 I18: “Jobs and consumers pin `pin_hash`”; readiness-only changes must not disturb execution pins.
    - `04-r3-project-model-and-storage.md` §2.7: views record “`(job, entity, version hash)`” and compare those hashes with the target head.
    - **Fix:** Use `pin_hash` for worker read-set validity, recording full hashes separately for provenance.

38. **R7 still makes rights eligibility a promotion gate.**
    - `drafts/10-integration-resolutions.md` §3 I19: promotion requires “structural validity and authority only.”
    - `08-r7-studio-tools.md` §4: an imported asset not eligible at delivery means “Substitute or change treatment; never promote.”
    - **Fix:** Replace “never promote” with “never deliver successfully”; preserve promotion of structurally valid candidates.

39. **Diagnostic-code ownership remains duplicated.**
    - `drafts/10-integration-resolutions.md` §1 C3: “One owner per code.”
    - `04-r3-project-model-and-storage.md` §2.4 says Project Core owns `REF_KIND_MISMATCH`, `BLOB_MISSING`, `FONT_UNREGISTERED` and `LIBRARY_UNREGISTERED`; `05-r4-compiler-and-render-plan.md` D2 says only `UNKNOWN_ENTITY` and `RATE_NOT_FLICK_EXACT` are Project Core’s and “the others are R4's.” R2 §§2.2, 2.13 also defines the font/library lint conditions.
    - **Fix:** Assign each shared code one owner and explicitly mark every other occurrence as an unchanged relay.

40. **R4 retains unprefixed local spike identifiers.**
    - `drafts/10-integration-resolutions.md` §1 C4 requires stage prefixes such as `R4-SP1`.
    - `05-r4-compiler-and-render-plan.md` §9: “S4 answered SP3 … the seam half of SP2; SP4 … moved to R2.”
    - **Fix:** Write `R4-SP3`, `R4-SP2` and `R4-SP4`, including in historical references.
