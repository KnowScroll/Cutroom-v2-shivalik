## BLOCKING

1. **`capture_run` uses a tool-effect value absent from the harness vocabulary.**  
   `08-r7-studio-tools.md` §2.9: “`capture_run` … `external_interactive`.”  
   `07-r6-harness.md` §2 D9: “`read | propose | job | external_paid | network`”; capability `effect_class` is a “separate vocabulary.”  
   **Fix:** Register the tool with effect `job`; retain `external_interactive` on its `capture.run` capability.

2. **Lowered sync pairs lose the layer identifying the probe.**  
   `04-r3-project-model-and-storage.md` §2.2: “`probe?: {layer: Ref<layer>, cut_id, predicate}`.”  
   `05-r4-compiler-and-render-plan.md` §2 D5: “`{event, probe_id?, predicate?, expected_frame, audio_sample}`.”  
   `03-r2-components-and-rendering.md` §2.4 identifies sidecar items with both “`layer, id`.”  
   **Fix:** Carry the resolved layer path alongside the probe ID, or explicitly define `probe_id` as a qualified layer-and-ID pair.

## NAMING

3. **Chart-value equality cites the text-only check.**  
   `08-r7-studio-tools.md` §2.6: “each mark’s `data.value` equals its bound value … (R9 P-07).”  
   `09-r9-quality.md` §3.1: P-07 is “Rendered text equals bound text”; K-02 checks “chart values (probe `data.value`).”  
   **Fix:** Cite K-02 for mark-value equality and P-07 for label-text equality.

4. **`UNKNOWN_CONTROL` has two claimed owners.**  
   `05-r4-compiler-and-render-plan.md` §2 D2 lists `UNKNOWN_CONTROL` among codes that “are R4’s.”  
   `08-r7-studio-tools.md` §2.9 lists it under “R7 errors”; `07-r6-harness.md` §2 D4 calls it “R7’s `UNKNOWN_CONTROL`.”  
   **Fix:** Keep one owner and describe the other modules as relaying that owner’s code.

5. **`TYPE_MISMATCH` also has two claimed owners.**  
   `04-r3-project-model-and-storage.md` §2.4: “Project Core owns these codes,” including `TYPE_MISMATCH`.  
   `08-r7-studio-tools.md` §2.9: “R7’s fetch module defines … `TYPE_MISMATCH`”; `07-r6-harness.md` §2 D4 repeats that ownership.  
   **Fix:** Preserve the binding fetch code and give Project Core’s schema mismatch a distinct code, updating its catalogue references.

## SETTING

6. **Two documents own `follow.max_depth`, and a third names the wrong owner.**  
   `03-r2-components-and-rendering.md` §5: “R2 owns the settings below,” including `follow.max_depth`.  
   `05-r4-compiler-and-render-plan.md` §5: “R4 owns these settings,” also including it.  
   `04-r3-project-model-and-storage.md` §2.2 calls it “R2’s”; `11-integration-decisions.md` §15 H10 assigns it to R4.  
   **Fix:** Remove R2’s ownership claim and change R3’s attribution to R4.

7. **`pixi.unit_browsers` is assigned to the wrong owner in the scheduler.**  
   `06-r5-scheduler-and-recovery.md` §5 lists “`pixi.unit_browsers` (1) (R2)” under settings owned elsewhere; §3 also says R2 owns “`pixi.*`.”  
   `03-r2-components-and-rendering.md` §5 attributes it to R5; `11-integration-decisions.md` §15 H1 says “`pixi.unit_browsers` by R5.”  
   **Fix:** Define it in R5’s owned-settings table and correct both scheduler ownership statements.

8. **The build plan uses an unowned browser-recycling setting.**  
   `10-r10-integration-acceptance-and-build-plan.md` §2.2: “`browser.max_chunks` = 1.”  
   `03-r2-components-and-rendering.md` §§2.8, 5 names the setting “`capture.browser_max_chunks`,” default 20.  
   **Fix:** Use `capture.browser_max_chunks = 1` for the fallback.

## NOT APPLIED

9. **The precise Reviewer retry multiplier is missing.**  
   `11-integration-decisions.md` §15 H2: “`reviewer.retry_output_factor` = 2 times the cap.”  
   `07-r6-harness.md` §2 D7 and `09-r9-quality.md` §4 say only “a higher cap”; neither settings table defines the factor.  
   **Fix:** Define the setting in R6 with default 2 and reference it in both retry descriptions.

10. **`DIAG_UNSUPPORTED` still arrives at the wrong time.**  
    `11-integration-decisions.md` §15 H3: “returned at once, from the component’s `meta`.”  
    `07-r6-harness.md` §2 D4 marks `render_request`’s `DIAG_UNSUPPORTED` as “*(job)*.”  
    **Fix:** Mark it as an immediate tool error and perform the metadata check before job submission.

11. **Frame-level strips still share the 12-cell event-strip limit.**  
    `11-integration-decisions.md` §15 H6: “`sheet.frame_strip_cells` = 18 consecutive frames”; `sheet.strip_max_cells` applies to event-centred strips.  
    `09-r9-quality.md` §3.2 applies “up to `sheet.strip_max_cells`” even when showing every frame; §5 defines that limit as 12 and omits the new setting.  
    **Fix:** Define the 18-cell setting and use it specifically for consecutive-frame inspection strips.

12. **Both storage documents retain the superseded blob-grace rule.**  
    `11-integration-decisions.md` §15 H7 protects every young, unreferenced blob “whether or not its row exists yet”; eviction applies only to blobs referenced solely as recreatable cache results.  
    `04-r3-project-model-and-storage.md` §§2.14, 5 says grace protects “only a file with no `blob` row yet.”  
    `06-r5-scheduler-and-recovery.md` §2.12 likewise says “only a blob with no row yet” and permits derived-blob eviction “of any age.”  
    **Fix:** Apply H7’s grace condition and restrict immediate eviction to cache-only references.

13. **R2 never defines its new buffering setting.**  
    `11-integration-decisions.md` §15 H9: “`capture.max_buffered_frames` = 8 is owned by R2.”  
    `06-r5-scheduler-and-recovery.md` §§2.8, 5 uses that name and default; `03-r2-components-and-rendering.md` §5 has no corresponding definition.  
    **Fix:** Add `capture.max_buffered_frames = 8` to R2’s owned settings and reference it in frame transport.

14. **R7 omits the decided terminal outcome for an interrupted capture.**  
    `11-integration-decisions.md` §15 H8: an interrupted, non-repeat-safe attempt “ends `failed` with class `policy`.”  
    `08-r7-studio-tools.md` §2.7 says only “never repeated automatically”; §4 supplies no interrupted-capture outcome.  
    `06-r5-scheduler-and-recovery.md` §2.5 already specifies “`failed` (`policy`).”  
    **Fix:** Add the same terminal state and failure class to R7’s capture contract and failure table.

15. **R5’s claims table does not apply the new durability qualification.**  
    `11-integration-decisions.md` §15 H12 labels deployment power-loss survival and rollback inside grouped commits “ASSUMED.”  
    `06-r5-scheduler-and-recovery.md` §8 retains “`FULL` survives power loss” as “VERIFIED by source,” notes only that process-death testing excluded power loss, and omits grouped rollback.  
    **Fix:** Add explicit ASSUMED entries for the deployment-disk and grouped-rollback claims, with the decided fallback.

## LINKS

16. **Freeze-review placeholders remain.**  
    `10-r10-integration-acceptance-and-build-plan.md` §§6.2–6.4 each says “*Recorded after the review runs.*”  
    Its §6 says the review’s “results are recorded here.”  
    **Fix:** Replace the three placeholders with results or explicitly mark those review steps as outstanding.

17. **The roadmap retains stale stage-status markers.**  
    `00-design-process-and-roadmap.md` §2 marks R2–R10 “OPEN,” including R6’s “framework chosen late.”  
    `03-r2-components-and-rendering.md` through `10-r10-integration-acceptance-and-build-plan.md` each declare “DECIDED”; `07-r6-harness.md` §2 D1 already chooses the framework.  
    **Fix:** Update the roadmap to distinguish decided designs from outstanding freeze review and user approval.

18. **Superseded pending markers remain unqualified in the binding record.**  
    `11-integration-decisions.md` §2 says PixiJS admission is “pending spike S7,” anchor-follow is “PROPOSED,” and seam correctness is “pending S4”; §6 still contains “pending S4” and “pending S3.”  
    The same file §§11, 14 closes those questions, including “PixiJS is admitted” and anchor-follow “DECIDED.”  
    **Fix:** Label those earlier phrases explicitly historical/superseded and point to their final resolutions.

No broken relative Markdown links or links into `lld/drafts` found.

## R10

19. **The unified register omits three open stage spikes.**  
    `07-r6-harness.md` §9 lists open `R6-S11` transport checks; `08-r7-studio-tools.md` §9 lists `R7-A9` arm-probe checks; `05-r4-compiler-and-render-plan.md` §9 lists `R4-SP6` bake gain/fidelity.  
    `10-r10-integration-acceptance-and-build-plan.md` §2.2 assigns none of these IDs a milestone, despite saying “each becomes an automated acceptance test at the milestone named.”  
    **Fix:** Add the missing rows and milestone assignments, explicitly recording any shared test coverage.

20. **The anchor-follow extension test is absent from its required milestone.**  
    `11-integration-decisions.md` §15 H5 assigns zoomed/transformed leaders and two-deep chains to “M7 (spike `R2-S12`).”  
    `03-r2-components-and-rendering.md` §9 includes these cases in `R2-S12`; `10-r10-integration-acceptance-and-build-plan.md` §2.2 describes that spike without them and assigns only “M1, M6.”  
    **Fix:** Add the follow cases, M7 acceptance criteria, and the fallback of drawing the prop inside the character component.

21. **M3 lacks the decided durability and grouped-rollback verification.**  
    `11-integration-decisions.md` §15 H12: “Verified at build milestone M3.”  
    `04-r3-project-model-and-storage.md` §8 calls both claims ASSUMED; `10-r10-integration-acceptance-and-build-plan.md` §§2.2, 4.2 includes neither test in the register or M3’s completion criteria.  
    **Fix:** Add both M3 tests and the fallback to separate commits.

22. **The billing spike has incompatible deadlines.**  
    `06-r5-scheduler-and-recovery.md` §8: `R5-2` “should be settled … before the design freeze.”  
    `10-r10-integration-acceptance-and-build-plan.md` §2.2 defers it to “M4” and says no listed claim blocks the design.  
    **Fix:** Choose one deadline and apply it consistently to R5 and R10.

23. **Quality calibration spikes also have incompatible deadlines.**  
    `09-r9-quality.md` §5.1: “Before the build: spikes R9-2 to R9-4.”  
    `10-r10-integration-acceptance-and-build-plan.md` §2.2 assigns them to M6, M5 and M6 respectively.  
    **Fix:** Reconcile the pre-build requirement with the milestone assignments.

24. **The thin-film claim understates deferred user decisions.**  
    `10-r10-integration-acceptance-and-build-plan.md` §7 says the thin film needs no deferred decision “except the voice engine at M5.”  
    `08-r7-studio-tools.md` §10 defers voice, music and sound-effect engines; R10 §4.3 itself also requires those engines and voice policy by M5, plus listening/disclosure choices by M6.  
    **Fix:** List all required decisions or specify concrete defaults/fallbacks that remove each dependency.

25. **The chart-check fallback repeats an existing requirement.**  
    `10-r10-integration-acceptance-and-build-plan.md` §2.2 gives `R7-A5` the fallback “Charts report values through `report()`.”  
    `08-r7-studio-tools.md` §2.6 already requires value reporting; §8 gives the fallback “charts are built on a trusted base component.”  
    `09-r9-quality.md` §3.1 additionally requires measured geometry for K-04.  
    **Fix:** Use the trusted-base-component fallback and retain both value and geometry checks.
