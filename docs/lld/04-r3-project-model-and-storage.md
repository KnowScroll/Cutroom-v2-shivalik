# Cutroom v2 — LLD · R3: Project Model, DSL/AST, Patches, Versioning and Storage

**Decided:** 14 November 2026
**Status:** DECIDED by the lead session under the user's delegation of 14 Nov 2026. The design set was frozen on 15 November 2026 ([R10](10-r10-integration-acceptance-and-build-plan.md) section 6.4); this document may be revised during implementation.
**Baseline:** HLD B1, B2.4, C0, C2, C3, C5, C8 ([Phase B](../hld/02-phase-b-production-lifecycle-and-autonomous-quality.md), [Phase C](../hld/03-phase-c-integration-contracts.md)) · [R1 foundations](02-r1-foundations.md) · [process and roadmap](00-design-process-and-roadmap.md) · [integration decisions](11-integration-decisions.md) · [spike evidence log](../research/10-spike-evidence-log.md) · [S5 results](../research/evidence/s3-s5-s6-minimax.md) · [S7 results](../research/evidence/s7-pixi-hardening-follow.md) · [batch 2b results](../research/evidence/b2b-sqlite-node.md)
**Sources:** fetched 14 Nov 2026; URLs are in section 8.

## 1. Problem and scope

Project Core must hold one authoritative, editable description of a film that an LLM, a worker and a human can all change safely. It must keep every accepted state, let candidates branch and merge, say what a change affects, and survive a crash.

R3 is the single home of entity schemas. Where another stage owns a shape's meaning (R2 the component `meta`, R4 the scene context, R7 the voice, cue and rights vocabularies, R9 the Quality Intent and the evidence bundle), R3 stores it once under the names given here.

Out of scope: the timing solver and Render Plan (R4), job tables (R5), tool wiring (R6), provider interfaces (R7) and check definitions (R9).

Terms. An **entity** is one addressable thing (a shot, a layer, a claim). An **entity version** is one immutable JSON document describing it. A **revision** is an immutable list saying which version of each entity is current. A **patch** is a list of edit operations against a named base revision. A **Space** is one directory on the Linux filesystem, served by one Node process, that holds one production: one film with all its branches and delivered versions.

## 2. Decisions

### 2.1 Entity documents and typed references

Every entity version is a flat JSON object with `snake_case` field names. Common fields: `id` (`ent_` + UUIDv7), `kind`, `v` (that kind's schema version), `handle`, and optional `title`, `depends_on`, `commitment` and `trust`. Authorship and timestamps belong to the patch that wrote the document, so identical content always hashes the same.

- **`depends_on`** is a list of `{target, aspect, note}`. It declares coupling that no typed field expresses.
- **`commitment`** is `{readiness, assumptions[], unknowns[]}` with the R1 §4.1 states. It is required on `scene_context` and optional on `voice_line`, `claim` and `music_cue`.
- **`trust`** is `trusted` (the default), `user` or `untrusted_web`. Views fence the string fields of an `untrusted_web` entity (section 2.13).

**Typed references.** A reference field stores the target's entity ID. The schema says which kinds it may point at, what role the link plays and what deleting the target does. Zod 4 copies this metadata into exported JSON Schema, so it reaches every consumer.

```ts
// illustrative
const ref = (kinds: Kind[], o: { role: Role; on_delete: 'block' | 'unset' }) =>
  z.string().regex(ENT_ID).meta({ 'x-cut-ref': { kinds, ...o } });
// Role = 'owns' | 'uses' | 'timing' | 'spatial' | 'fact' | 'style'
const Layer = entity('layer', 1, {
  object: ref(['object'], { role: 'uses', on_delete: 'block' }),
  source: LayerSource.optional(),   // {component} | {media, crop?, fit} | {capture, steps} | {fill} | {effect}
  mask:   MaskSpec.optional(),      // a shape, a gradient or an image asset; never a layer
});
```

**Roles and deletion** (decided: `lld/11` section 18, B:O2). Every reference's `role` and `on_delete` follow fixed rules. (1) `owns` appears only on the parent-side ordered lists `project.beats`, `beat.shots`, `beat.lines`, `shot.layers`, `project.delivery_profiles` and `project.treatments`; deleting a member removes its entry, and `cascade` follows only these lists. (2) `fact` covers references and member references to `claim`, `dataset` and `source`, including data bindings and `voice_line.bindings`. (3) `timing` covers references to events and clock owners: `event.owner`, `time_constraint.a` and `.b`, `control_track.origin.event`, cue placements, and the bounds of `must_see` and `suppress`. (4) `spatial` covers `shot.scene_context`, the scene-context fields `owner`, `from`, `onto` and anchors, and `follow` leaders. (5) `style` covers references to `font`, `library` and `voice_profile`. (6) Every other reference is `uses`. `on_delete` is `unset` for an optional single reference that only selects something (`voice_line.selected_take`, `shot.camera`, `shot.scene_context`, `object.default_component`, `media_need.chosen`, `asset.need`), and for the record-keeping list `decision.affects`, whose entry is removed while the earlier decision version keeps it. Every other reference is `block`, so deleting its target fails with `STILL_REFERENCED`; that includes `lock.target`, so a lock is removed before the entity it locks can be deleted.

**Write levels (FR1).** Every field also carries a write level, declared beside the reference metadata as `x-cut-write: {level, module?, values?}`. A `system` field is written only by the code of the named `module`, never by a model patch; `values` limits this to the listed values of an enum field. A `human` field needs a human. `director`, the default, is also open to workers within their grant. Section 2.7 lists the fields and the check.

A **member reference** `{ref, member}` points at a named item inside the target, such as `claim.values.q3`, a dataset column, a component control or an asset anchor. The member must exist. Inside a layer's `params` it is a **data binding**: the compiler replaces it with the bound value.

**Structure rules.**

1. Ordered membership is a reference list on the parent (`beat.shots`, `shot.layers`) with role `owns`. Unordered membership is one reference on the child (`event.owner`). Links are one-way; the index supplies the reverse.
2. Anything that needs its own address is an entity or an entry in a keyed map whose keys are `snake_case` names without dots. A list of records (keyframes, word records, caption cues) or a map whose keys are free text or dotted names (a lexicon, `settings_overrides`) is one value: a patch replaces it whole and a merge treats it as one field. Scene-context `items` and `effects` and the Quality Intent lists are keyed maps, so that two branches can edit different entries (F5).
3. Numbers are finite. Times and durations are integer flicks. Other numbers are rounded to the nearest value with `store.number_decimals` places when written, an exact half rounding up, towards +∞ (R1 Revision 3; decided: `lld/11` section 18, L34). Wall-clock instants are ISO 8601 UTC strings.
4. Beat-relative time is the one stored non-flick form: `{beats: {num, den}, tempo: ref}`. The compiler resolves it.
5. Authoring forms are converted before storage. A component's own `meta` gives its duration in seconds; the project copy stores `round(seconds × 705,600,000)` flicks, a tie rounding half up, computed exactly on integers (R1 Revision 3; decided: `lld/11` section 18, L6 and A:M0-7). The tool layer resolves a key time written as `+80ms` after the previous key to an offset from the track's origin.

### 2.2 Entity kinds

`Ref<k>` is a typed reference and `[]` a list. Every field not marked `?` is required, with defaults written out at creation. `Region` is the R1 §3.6 shape. `Word` is `{token, text, start, end, confidence?}`, with times in flicks from the start of the take. `Format` is `{decimals, unit, rounding}`.

| Kind | Fields |
|---|---|
| **project** (one) | `brief: Ref<brief>`, `quality_intent: Ref<quality_intent>`, `delivery_profiles: Ref<delivery_profile>[]` (first is primary), `beats: Ref<beat>[]`, `treatments: Ref<treatment>[]`, `language`, `settings: {area: {name: value}}` (overrides of named settings, nested by every dot-separated segment of the name so a path such as `settings.blob.grace_hours` or `settings.delivery.audio.loudness_lufs` addresses one value; every level is a keyed map, so overrides of different settings merge leaf by leaf, and the settings registry refuses a setting name that is a prefix of another; decided: `lld/11` section 18, B:O8-nesting) |
| **brief** | `text` (verbatim), `audience`, `purpose`, `tone[]`, `duration_target: {min, max}` (a preference), `hard_constraints: {key: {statement, check?}}`, `preferences[]`, `attachments: Ref<asset\|source>[]`, `policy: {budget_usd, rights_policy: {commercial, derivative}, voice_policy}` |
| **quality_intent** (R9's shape) | `derived_from: Ref<brief>`, `purpose`, `audience`, `must_communicate: {key: {statement, proof}}`, `hard_constraints: {key: {kind: duration\|aspect\|language\|must_include\|must_not_include\|rights_scope\|essential_claim\|custom, params, proof, from_brief?}}` (`from_brief`: the `brief.hard_constraints` key it covers; `params` is `{max_s?, min_s?}` for `duration`, `{w, h}` for `aspect` and `{code}` for `language`, the three kinds a proof `{by: check, check: "F-06"}` may cover; decided: `lld/11` section 18, C:C1.5), `facts: {essential_claims: Ref<claim>[]}`, `key_aims: {key: {scope, aim, review_question}}`, `must_see: {key: {element: {layer: Ref<layer>, cut_id}, from, to}}` (`element` has the shape of `event.probe`; `from` and `to` are event references; decided: `lld/11` section 18, B:O14-must_see), `waivers: {key: {check, scope, reason}}`, `audio: {stt_exempt[], lexicon: {term: [spellings]}}`, `settings_overrides: {setting: value}` (R9's own settings only), `disclosure: {visible_notice, c2pa: off\|test_cert\|production}`. `proof` is `{by: check, check}` or `{by: reviewer, question, max_unseen_gap_ms}`. A `scope` is `{level: component\|shot\|film, target?}`, where `target` is a handle |
| **delivery_profile** | `canvas: {w, h}`, `fps: {num, den}`, `output_scale`, `video: {codec, pix_fmt, colour}`, `audio: {sample_rate: {num, den}, channels, loudness_lufs, limit_dbtp, verify_max_dbtp}` (48 kHz only), `safe_zones: {name: Region}`, `captions: {burn_in: bool, sidecars: [webvtt\|srt]}`, `ai_disclosure` (a `human` field holding the platform disclosure label and the suggested disclosure text for upload; the on-screen notice switch is not here but `quality_intent.disclosure.visible_notice`; decided: `lld/11` section 18, L24, L37). No duration bounds |
| **beat** | `intent`, `summary`, `tone?`, `shots: Ref<shot>[]`, `lines: Ref<voice_line>[]`, `claims: Ref<claim>[]`, `setup_for?: Ref<beat>` |
| **shot** | `intent`, `duration: {mode: fixed\|derived, value?, min?, max?}`, `layers: Ref<layer>[]` (bottom to top; the single source of paint order), `groups: {name: {opacity, blend, filter[], mask?: MaskSpec}}`, `camera?: Ref<camera>`, `scene_context?: Ref<scene_context>`, `transition_in?: {type: dissolve\|wipe, duration, direction?: left\|right\|up\|down}` (`direction` is required for a wipe; decided: `lld/11` section 18, B:O14-wipe) |
| **object** | `role: character\|prop\|graphic\|text\|media\|background`, `description`, `default_component?: Ref<component>`, `identity_notes`, `depicts_real_person?: bool`, `voice?: {profile: Ref<voice_profile>, style}` |
| **component** | `source: ArtifactRef`, `representation: svg\|canvas2d\|html\|pixi_scene\|media_player\|audio_score`, `meta` (below), `uses: {fonts: Ref<font>[], assets: Ref<asset>[], libraries: Ref<library>[]}`, `edit_limits[]`, `provenance` |
| **library** | `name`, `version`, `file: ArtifactRef`, `rights`, `needs_webgl: bool`. One record per vetted, pinned script (I2) |
| **layer** | `object: Ref<object>`, `source?: {component: Ref<component>} \| {media: Ref<asset>, crop?: {x, y, w, h}, fit: contain\|cover\|fill} \| {capture: Ref<capture_session>, steps[]} \| {fill: Fill} \| {effect: Effect}` (`steps`: names in the session's `steps`; `Fill` and `Effect` are R2's records, decided: `lld/11` section 18, A:M1-1 and L7), `params` (values or data bindings), `space: world\|screen`, `transform: {x, y, scale, rotation, opacity}`, `blend`, `filter?[]`, `mask?: MaskSpec`, `group?` (a name in `shot.groups`), `seed` (default derived from the entity ID), `parallax?`, `visible: {from, to}`, `time_map[]` (R1 §1.6) |
| **control_track** | `target: Ref<layer\|camera>`, `layer: base\|derived\|acting\|override`, `label`, `direction?`, `origin: {event: Ref<event>, offset}`, `channels: {namespace: {name: {interp, keys: [{at, value, ease?}]}}}`. Key times are offsets from `origin` |
| **camera** | `base: {x, y, zoom, rotation}`. Motion is a control track |
| **event** | `owner: Ref<shot\|beat\|voice_line\|music_cue>`, `meaning`, `source: authored \| {derived_from: Ref<take\|music_cue\|asset\|capture_session>, marker}`, `pin?` (fixed time on the owner's clock), `probe?: {layer: Ref<layer>, cut_id, predicate: visible\|moved}` |
| **time_constraint** | `a: Ref<event>`, `b: Ref<event>`, `min?`, `max?` (hard bounds: min ≤ t(b) − t(a) ≤ max), `preferred?` (a soft target inside the bounds), `priority` (integer, default 0), `reason` |
| **scene_context** (R4's structure) | `shot: Ref<shot>`, `valid: [from, to]`, `draw_groups[]` (names, back to front), `items: {key: {owner: Ref<layer\|caption_track>, draw_group, order?, footprint: TimedRegion, avoid?: TimedRegion[], reserve?: TimedRegion[], anchors?: [{name, at, binds_to?: {cut_id, point}}], unknowns?[]}}`, `effects: {key: {kind: tint\|glow\|blur_behind\|shake\|matte, from: Ref<layer>, onto: Ref<layer>[], during: [from, to], realised_by?: {group_filter} \| {layer: Ref<layer>} \| {control}}}`, `supersedes?` (the `pin_hash` of the version it replaces), `commitment`. `TimedRegion` is `{space: world\|screen\|{asset: Ref<asset>}, conservative, interp: hold\|linear, keys: [{t, shape}]}`. Every time is an event reference plus an offset. An effect of kind `matte` names the matte layer as `from` and the layers it would mask as `onto`, so that R4 can refuse a live matte (decided: `lld/11` section 18, B:O14-matte) |
| **asset** | `media: ArtifactRef`, `class: image\|video\|audio\|font_file\|data`, `intrinsic: {w?, h?, duration?, timebase?, sample_rate?}`, `anchors: {name: {x, y, t?}}` (asset pixels), `derived_from?: Ref<asset>`, `mapping?: {trim, scale, rotation}`, `identity?: {depicts, basis: Ref<source>[], verdict}`, `need?: Ref<media_need>`, `provenance`, `rights` |
| **voice_profile** | `origin: preset\|designed\|procedural`, `engine: {adapter, adapter_version, model, voice}`, `design_prompt?`, `rights`, `character?: Ref<object>`, `provenance` |
| **voice_line** | `speaker: Ref<object>`, `display_text`, `spoken_text` (templates with `{name}` placeholders), `bindings: {name: {ref, member}}`, `token_map: [{display: [from, to], spoken: [from, to]}]`, `direction: {style?, pace?, emphasis?[], tags?[]}`, `pronunciations: [{token, say}]`, `language`, `est_duration`, `selected_take?: Ref<take>`, `claims: Ref<claim>[]`, `commitment?` |
| **take** | `line: Ref<voice_line>`, `audio: Ref<asset>`, `samples`, `sample_rate: {num, den}`, `spoken_text` (as synthesised), `timing: native\|aligned\|estimated`, `words: Word[]`, `engine: {adapter, adapter_version, model, voice, params, seed?}`, `work_key`, `trim?: {head, tail}`, `loudness_lufs?` |
| **caption_track** | `lines: Ref<voice_line>[]`, `language`, `audience: general\|children` (default `general`, read by A-03; decided: `lld/11` section 18, C:M5-O7), `direction: ltr\|rtl\|auto`, `mode: derived\|authored`, `style: {preset: phrase\|word_pop\|highlight, params}`, `layout: {zone, max_lines?, max_chars_per_line?}`, `cues?: [{start, end, line: Ref<voice_line>, tokens: [from, to], direction?, language?}]` (authored mode only), `suppress: [{from, to}]` (event references) |
| **music_cue** | `mode: score\|media`, `request?: {mood, target_duration, tempo_range: {min, max}, section_plan[], hit_points: Ref<event>[]}`, `score?: Ref<component>`, `media?: Ref<asset>`, `stems?: {name: Ref<asset>}`, `sections: {name: {from, to}}`, `beat_grid: {tempo_map: [{start, bpm: {num, den}, metre}], first_downbeat, beats?[], source: authored\|declared\|detected, verified}` (`beats`: a `detected` grid's beat times, in flicks from the cue's start), `markers: {name: time}`, `hits: {name: {marker, event: Ref<event>, sync}}`, `placement: {event, offset}`, `gain`, `gain_keys: [{at, db}]`, `duck_under[]`, `commitment?` |
| **sfx_cue** | `mode: score\|media`, `request?: {description, category, max_duration, preferred_origin: procedural\|library\|generated}` (`category` is one of a closed list that R7 publishes in the `sfx_request` schema; decided: `lld/11` section 18, C:M5-O4), `media?: Ref<asset>` or `component?: Ref<component>`, `at: {event, offset}`, `sync_point` (offset into the sound), `sync: presented_frame\|sample`, `gain`, `pan` |
| **lock** | `target: Ref<any>`, `paths[]` (`*` = whole entity, `@exists` = may not be deleted), `subtree: bool`, `level: brief\|creator\|director` (with `x-cut-write {level: human, values: [brief, creator]}`; decided: `lld/11` section 18, B:O12), `reason` |
| **decision** | `type: creative\|technical\|acceptance\|rollback\|rights\|waiver\|adjudication`, `question`, `chosen`, `alternatives: [{label, revision?, why_not}]`, `rationale`, `evidence: EvidenceId[]`, `affects: Ref<any>[]`, `made_by: {actor, session?, model_call?}` |

Lighter kinds:

| Kind | Essentials |
|---|---|
| **claim** | `statement`, `status: supported\|simplification\|interpretation\|fiction\|unverified\|disputed\|refuted`, `support: [{source: Ref<source>, locator, quote}]`, `values: {name: {value, unit, format: Format}}` (the single home of a factual figure), `commitment?` |
| **source** | `url`, `title`, `publisher`, `retrieved_at`, `snapshot: ArtifactRef`, `type: web\|paper\|dataset\|user`, `quality_tier: primary\|reputable\|tertiary\|unknown`, `licence?` (as the source states it) |
| **dataset** | `columns: {name: {type, unit?, format?: Format}}`, `rows: {row_key: {column: value \| {ref, member}}}`, `sources: Ref<source>[]`, `claims: Ref<claim>[]`. A cell is a literal (non-factual data only) or a member reference to a claim value. A member is `column` or `column.row_key`. Datasets are chart-sized and stored inline |
| **media_need** | `content_class: image\|video\|audio`, `subject`, `action?`, `factual_role: evidence\|atmosphere`, `min_duration?`, `framing?`, `avoid[]`, `use_profile: {commercial, derivative, share_alike}`, `for: Ref<shot\|layer\|object>[]`, `status: open\|filled\|abandoned`, `chosen?: Ref<asset>` |
| **capture_session** | `script: ArtifactRef` (the validated step list), `viewport: {w, h}`, `timebase: {num: 1, den: 1000}`, `frames: ArtifactRef` (a list of `{pts, ArtifactRef}`), `steps: {name: {action, selector, box, url, pts, assertions[]}}`, `provenance`. Step times use the same timebase as the frames |
| **treatment** (FR2) | `premise`, `hook`, `structure`, `visual_approach`, `tone[]`, `techniques[]` (intended), `risks[]`, `status: proposed\|developed\|chosen\|rejected`, `branch?` (the `d/` branch it was developed on), `decision?: Ref<decision>` (the decision that chose or rejected it) |
| **recipe** | section 2.11 |
| **font** | `family`, `faces: [{weight, style, file: Ref<asset>}]`, `rights`, `scripts[]`, `fallback?: Ref<font>` |

**Component `meta`** mirrors R2's shape (I1, I2). The one difference is rule 5: a fixed duration is stored in flicks.

```ts
// illustrative; field names are the persisted form
type Meta = {
  contract: 1;
  size: { w: number; h: number };                        // design units
  duration: { kind: 'fixed'; flicks: number } | { kind: 'open' };
  out_of_range: 'hold' | 'loop' | 'hide' | 'error';      // R1 §1.6
  time_invariant: boolean;
  may_be_blank: boolean;                                 // default false
  controls: Record<string, Control>;
  params: Record<string, { type: string; required: boolean }>;  // fixed inputs, such as chart data
  fonts: { family: string; weights: number[]; italic?: boolean }[];
  probes: string[];                                      // data-cut-id values it reports
  technique: ('svg' | 'canvas2d' | 'html' | 'sprite_sheet' | 'puppet_rig' | 'pixi_scene')[];
  libraries: string[];                                   // name@version
};
type Control = { nullable?: boolean } & (
  | { type: 'number'; min: number; max: number; default: number }
  | { type: 'boolean'; default: boolean }
  | { type: 'enum'; options: string[]; default: string }
  | { type: 'color'; default: string }
  | { type: 'point'; default: [number, number] }
  | { type: 'text'; max_length: number; default: string });
```

Project Core fills `uses` from `meta` when the component is created, by resolving each font family and each `name@version` to its entity. An unknown family or library fails with `FONT_UNREGISTERED` or `LIBRARY_UNREGISTERED`; R2 owns both codes, and Project Core relays them unchanged. `meta` stays R2's declaration, and `uses` gives the dependency index typed edges. `meta.params` declares the fixed inputs that a layer's `params` supply.

Notes on the tables.

- **A layer is one source in one shot's stack (FR6).** `source` names a component, a media asset or a capture session, or holds a trusted `fill` or `effect` record; R4 lowers a media asset or capture session to a trusted `media` source, and `{fill}` and `{effect}` to the trusted kinds of the same name (decided: `lld/11` section 18, A:M1-1 and L7). A layer with no `source`, or a component source whose component has no document, is `needs_authoring` and compiles to a placeholder in `plan` mode. The display crop is `source.crop`, in source pixels, applied once; changing it is a new layer version, never a new asset.
- **`layer.transform` places the centre of the layer's box** (decided: `lld/11` section 18, B:O1b). `transform.x` and `transform.y` place the centre of the box (a component's `meta.size`, a trusted layer's declared `size`, otherwise the canvas), and `rotation`, in degrees clockwise, and uniform `scale` turn about that centre. R4 D10 gives the matrix.
- **Media (FR6).** The `media_annotate` tool proposes `asset.anchors`, which are stored once a crop review confirms them. `media_need.factual_role` feeds R9's hard identity check K-05: an `evidence` need requires `identity.verdict` = `confirmed` on its asset.
- **A mask is a specification, not a layer (I6).** `MaskSpec` is `{type: clip, shape: Region}`, `{type: gradient, gradient}` (`gradient` is R2's `Gradient` record; decided: `lld/11` section 18, A:M1-1) or `{type: image, asset: Ref<asset>, mode: alpha|luminance}`. A baked component serves as a matte through its image asset; a live component cannot.
- **`follow` is a keyed step channel, not a static field (I7, FR7).** A control track on the follower carries `channels.follow.leader`. Each key is `{layer: Ref<layer>, anchor}` or `null` (no leader) and holds until the next, so a hand-off is one key at an event. R4 declares each change of leader in its `handoffs` list, and `from` or `to` may be empty there: a follower that gains its first leader, or lets go (G18). With both ends present, R9's P-11 measures the distance between the two anchors at the switch frame; with either end empty, it measures the follower's own displacement between the frame before the switch and the switch frame, against the same tolerance. S7 placed a follower from its leader's probe anchor within the same frame, at most 0.27 px off in 300 captures, so coupled parts need not share a component. A chain is at most R4's `follow.max_depth` (2) deep (H10).
- **Two kinds of group.** `shot.groups` are effect groups that layers join by name. A scene context's `draw_groups` and `order` are declared constraints: the compiler checks them against `shot.layers` and reports a mismatch as R4's `STACK_ORDER_MISMATCH` (F3).
- **Control tracks.** A track on a layer addresses four channel namespaces: `transform` (`x`, `y`, `scale`, `rotation`, `opacity`), `controls` (names declared in `meta.controls`), `filter` (one channel per filter function, such as `blur`) and `follow` (the one channel `leader`). `layer.transform` and `layer.filter` hold the static values. A track on a camera uses the namespace `camera` with channels `x`, `y`, `zoom`, `rotation` and `shake`, which the compiler lowers to `cx`, `cy`, `zoom` and `rot`. Channel keys are nested (F1): the paths are `channels.transform.x`, `channels.controls.gaze`, `channels.filter.blur`, `channels.follow.leader` and `channels.camera.x`. `interp` and `ease` use R4's one easing schema. The `layer` field is R7's precedence layer: the highest one with a key wins, and two tracks on one precedence layer that write one control in overlapping intervals raise `CONTROL_CONFLICT` at compile. A key value may be `null` only for `follow.leader` and for a control declared `nullable`, where it means "automatic" (I3). There is no action entity: an action is a track's interval from its first key to its last.
- **Acting follows its cause through `origin`.** A double-take track hangs off an event that a constraint places 650 ms after the eruption, so moving the eruption moves the reaction.
- **Timing constraints.** Bounds are always hard. `preferred` is a soft target that the solver clamps into the bounds, in `priority` order. There is no `strength` field (F6).
- **Probe bindings (F8).** The compiler builds `sync_pairs` from the authored `event.probe` bindings. An event without one gives `UNKNOWN` in R9's planned-pair sync check.
- **Duration and sample rate.** A film outside `brief.duration_target` gets R4's material note `TIME_OUTSIDE_TARGET`; only a Quality Intent hard constraint limits duration. Delivered audio is fixed at 48 kHz in v2; the schema rejects any other rate (`VALUE_OUT_OF_RANGE`).
- **Voice (FR5).** `display_text` and `spoken_text` are templates: a placeholder `{name}` is the `bindings` entry `name`, a member reference to a claim or dataset value, which R7's shared formatter renders in display and in spoken form. No figure is typed into a line, and an unbound placeholder is `UNKNOWN_MEMBER`. R7's one segmenter splits the rendered texts into tokens. `token_map` pairs half-open token ranges of the two, so "$4.2M" maps to five spoken tokens. When a corrected value changes the rendered text, it no longer matches `take.spoken_text`: the take is superseded, and R7 rewrites `token_map` and requests a new one. `words[].token` and `pronunciations[].token` are spoken-token indices; a word-wide pronunciation rule is authoring sugar. A take's duration is `samples` at `sample_rate`, and no other duration is stored. `timing` is the method; per-word `confidence` is separate. An adapter returns an ArtifactRef, and ingest creates the `asset` that `take.audio` references.
- **Take acceptance** is not a separate fact. The accepted take is the one selected in the revision being compiled, and a `final` compile needs the line's commitment to be `frozen`.
- **Sound sync (I21).** An `sfx_cue` or music hit anchored to a visual event defaults to `sync: presented_frame`; voice and free-running music stay sample-accurate.
- **Cues.** R7's request tools read a cue's `request` block. A cue carries no licence; that lives only in the `rights` record of the asset it references (F4).
- **Captions (F22).** A `derived` track stores no cues: the compiler gets them from R7's segmenter, a pure function. `captions_build` with `materialise` stores them and sets `mode: authored`, so that they can be edited. An authored cue stores a display-token range of its line, not text, so cue text derives from the line (FR5).
- **One home and one format per figure (FR5).** `claim.values` is the single home of a factual figure; dataset cells, layer `params` and lines reference it. A chart label, a caption and a spoken number all read the `Format` on the bound claim value or dataset column. A `user` source supports a figure the brief supplies (R9 K-01).

### 2.3 Handles and resolution

R1 §2.1 defines handles. Spike S5 changed the reason for them: no entity reference was miscopied in 352 trials, with handles or with long IDs, and long IDs cost about 885 more input tokens per task (30%). Handles are kept for token cost, not for accuracy. R3 adds these rules.

- A handle is unique within a revision and **is never reused for a different entity**, because the Director's append-only history may still hold the old one.
- Tool input accepts `@handle` or a raw ID wherever a reference is expected. Tool output shows only handles.
- Resolution order: handles created earlier in the same patch; handles in the base revision; the rename history, which resolves with a `HANDLE_RENAMED` warning for `handle.alias_grace_revisions` accepted revisions. Otherwise the tool returns `UNKNOWN_ENTITY` with the five nearest matches by edit distance, matching kinds first.
- If `create` gives no handle, Project Core assigns `<parent>.<kind><n>`. The LLM never mints IDs.
- Hashes in views are shortened to 12 hex characters and accepted back when unique.

### 2.4 Patch operations

**Problem.** MiniMax has no schema mode, so some patches will arrive malformed. The format must be small, hard to get subtly wrong, and mergeable.

**Choice: ID-addressed operations.** Three alternatives were rejected. [RFC 6902](https://www.rfc-editor.org/rfc/rfc6902) JSON Patch addresses array positions, so one insert shifts every later path, and its paths carry no entity identity for scope and lock checks. Batch 3 compared it on 10 tasks: it was about as accurate (41 of 48 runs right, against 45 of 48 for entity operations), but cost 75% to 85% more uncached input and showed index-shift errors on multi-item removals (J7). [RFC 7396](https://www.rfc-editor.org/rfc/rfc7396) Merge Patch cannot edit part of an array. Whole-entity replacement makes the model re-emit unchanged fields and turns every merge into an entity-level conflict.

A patch is `{base, branch, intent, key?, unlock?, rebase?, dry_run?, ops[]}`. This envelope is the input of the `project_patch` tool. It is the logical shape: on MiniMax, `ops` travels as one string of JSON text, which R6's model adapter parses and validates against this shape before Project Core sees it (R6 D7). `base` is a revision ID, a `P` number or a branch name. `key` is an idempotency key: a second patch with the same key returns the first result. `rebase` asks for a merge onto the branch head if it has moved. `dry_run` returns the diagnostics and the impact summary without writing.

| Operation | Exact semantics |
|---|---|
| `create {kind, handle?, fields, into?: {parent, list, before\|after\|at}}` | Mints the ID, fills defaults, validates the document. `into` also inserts the new entity into a parent list |
| `update {target, set?: {path: value}, unset?: [path]}` | A path is dot-separated object keys, never an array index. `set` replaces the value at the path; an array is replaced whole. `unset` is for optional fields only |
| `delete {target, cascade?}` | Removes the entity from the next revision. Its entries in `owns` lists are removed and `unset` references cleared. Any other inbound reference from a surviving entity fails the patch. `cascade` also deletes entities the target owns |
| `rename_handle {target, to}` | The ID is unchanged; the old handle enters the rename history |
| `list_insert {target, path, items, before\|after\|at}` | Reference lists only. Position is given by a neighbouring item or `start`/`end`. A duplicate is an error |
| `list_move {target, path, item, before\|after\|at}` | Same addressing |
| `list_remove {target, path, item}` | Removes the entry only; the entity stays |
| `restore {targets \| all, from}` | Expands into the operations that make the targets equal to their state in revision `from`. This is rollback. Paths the caller may not write keep their value in the base revision and are reported in one `RESTORE_PATH_KEPT` warning; re-creating an entity the base lacks is an ordinary `create` and needs authority for every field it writes (decided: `lld/11` section 18, B:O7) |

Operations apply in order, and later ones see earlier results. A patch is all-or-nothing. Success writes one candidate revision on the branch and returns the changed handles, warnings and an impact summary (section 2.8). Rejected patches are stored too, as evidence for the repair loop.

**Evidence.** In S5, 377 of 381 tool calls (99.0%) had schema-valid arguments without a JSON mode, including `project_patch` calls that carried two operations, and an exact schema error fixed all four invalid calls on the next attempt. That rate holds for fully typed schemas only (R6 D7). Batch 3 measured the full operation set on a 184-entity project: with `ops` sent as JSON text, 95% of runs reached exactly the expected state, 88% of first patches were valid and 98% were valid within two repairs (R3-K2, section 8). Patches are therefore written reliably enough for validate-and-repair at the tool boundary, which is required, with two repairs as the expected budget. Three of the four invalid calls copied a field that the project state displayed but the patch schema refused, so a view must show exactly the field names that `update` accepts (section 2.13).

**Validation order,** cheapest first. A stage reports all of its errors, and later stages run only if it reports none.

1. Envelope: JSON shape and operation names.
2. Base: the revision exists; the branch head equals `base`, or `rebase` was requested (then section 2.9 runs).
3. Resolution: handles and references.
4. Authority: write scope, then field write levels, then locks (section 2.7). This precedes schema checks so a worker does not spend repair attempts on a patch that can never land.
5. Schema: each operation against the kind's schema.
6. Integrity of the resulting revision: references, members, blob presence, one owner per entity, unique handles.
7. Local invariants: rates exact in flicks, `min ≤ preferred ≤ max`, sorted keyframes, required rights fields, and R9's Quality Intent write rules (every hard constraint names a proof; every brief hard constraint is covered; waivers name observational checks only).

Passing all seven stages is **structural validity**. Timing solves and spatial checks belong to the compiler (R4). An accepted head need not compile, because a project is incomplete for most of its life (I19).

**Diagnostics.** Each is `{code, severity, op_index, target, path, message, expected?, got?, candidates?, fix?}`, with R1 §5 severity values. `fix` is a ready-made replacement operation when the repair is unambiguous. Project Core owns these codes, `REF_KIND_MISMATCH`, `BLOB_MISSING` and `TYPE_MISMATCH` among them, and the harness relays them unchanged (C3, I25). R7's fetch module reports a wrong media type with its own code, `MEDIA_TYPE_MISMATCH`.

| Stage | Codes (what the payload adds) |
|---|---|
| 1 | `MALFORMED_PATCH` (parser position), `UNKNOWN_OP` (valid names) |
| 2 | `UNKNOWN_REVISION`, `STALE_BASE` (expected and current head; handles changed since base), `UNKNOWN_BRANCH` (nearest branch names, or the state of a branch that is `merged` or `abandoned`; a patch never creates a branch, and an unknown branch name given as `base` stays `UNKNOWN_REVISION`; decided: `lld/11` section 18, B:O18-branch) |
| 3 | `UNKNOWN_ENTITY` (nearest handles), `HANDLE_TAKEN`, `HANDLE_INVALID`, `HANDLE_RENAMED` (warning) |
| 4 | `OUT_OF_SCOPE` (the grant), `FIELD_AUTHORITY` (the field and the level required), `LOCKED` (lock, level, reason), `UNLOCK_NOT_PERMITTED`, `UNKNOWN_CHECK` (a Quality Intent proof names a check that is not registered; nearest registered checks, in the pattern of R4's `UNKNOWN_CONTROL`; decided: `lld/11` section 18, L32) |
| 5 | `UNKNOWN_FIELD` (nearest names), `TYPE_MISMATCH`, `VALUE_OUT_OF_RANGE` (bounds), `MISSING_REQUIRED`, `IMMUTABLE_FIELD` (`id`, `kind`, `v`, and `handle`, which changes only through `rename_handle`, given as `fix`; no kind-specific field is immutable; decided: `lld/11` section 18, B:O18-immutable), `BAD_TIME_LITERAL` (accepted forms), `NOT_A_REF_LIST`, `PATH_INTO_ARRAY` |
| 6 | `REF_KIND_MISMATCH` (allowed kinds), `DANGLING_REF`, `STILL_REFERENCED` (referrers), `UNKNOWN_MEMBER` (members available), `BLOB_MISSING`, `DUPLICATE_OWNER`, `DUPLICATE_LIST_ITEM`, `ANCHOR_NOT_IN_LIST`, `ORPHAN` (warning) |
| 7 | `RATE_NOT_FLICK_EXACT`, `CONSTRAINT_BOUNDS`, `KEYS_NOT_SORTED`, `RIGHTS_FIELDS_REQUIRED`, `PROOF_REQUIRED`, `BRIEF_CONSTRAINT_UNCOVERED` (the brief key), `WAIVER_NOT_ALLOWED` |
| Merge | `MERGE_CONFLICT` (base, ours, theirs), `DELETE_MODIFY`, `HANDLE_COLLISION`, `LIST_ORDER_AMBIGUOUS` (warning), `COUPLED_CHANGE` (warning; revalidation set), `STALE_READ_SET` (blocking; each changed entity with its handle, the `pin_hash` the job read and the `pin_hash` on the target head; decided: `lld/11` section 18, B:SD2) |
| Other | `NO_CHANGE`, `BRANCH_EXISTS` (the branch name is taken), `UNKNOWN_REF` (evidence reference), `KNOWN_FAILURE` (warning; prior evidence), `SCOPE_OVERLAP` (warning), `RESTORE_PATH_KEPT` (warning; the paths a `restore` left at their base value; decided: `lld/11` section 18, B:O7) |
| Start-up | `SPACE_MOUNT_REFUSED` (mount point and type), `SPACE_MOUNT_UNKNOWN` (`/proc/mounts` cannot be read; start-up refuses), `SQLITE_TOO_OLD` (3.51.3 required; the version found), `DB_DAMAGED` (the `quick_check` output), `MIGRATION_FAILED` (owner, script and error; `user_version` unchanged) (decided: `lld/11` section 18, A:M0-4) |

**Stage 7 rules.** `RIGHTS_FIELDS_REQUIRED` applies per rights status: `candidate` and `revoked` require nothing more; `evidence_collected`, `restricted` and `unresolved` require `licence.id` (the value `unknown` is allowed) and at least one `basis` source; `eligible` requires those and also `attribution.required`, `attribution.text` when attribution is required, `scope.commercial` and `scope.modify`. This is the starting rule, confirmed or corrected when R7's rule table is seeded at M6 (decided: `lld/11` section 18, B:O10 and L3). Each check declares in R9's `register_check` the hard-constraint kinds it can prove (`proves`); when a registered check proves a constraint's kind, a `by: reviewer` proof is refused with `PROOF_REQUIRED`, whose `expected` names those checks, and a `by: check` proof must name a registered check (decided: `lld/11` section 18, B:O9). A proof that names a check absent from the installed catalogue, or names F-06 for a kind other than `duration`, `aspect` or `language`, is refused when the Quality Intent is written (decided: `lld/11` section 18, C:C1.5); a proof naming an unregistered check gets `UNKNOWN_CHECK` (stage 4 above; decided: `lld/11` section 18, L32).

### 2.5 Revisions and hashing

A revision manifest is canonical JSON (illustrative):

```json
{"format":1,"project":"ent_0192…","parents":["rev_9f2c…"],
 "entities":{"ent_0192…":"sha256:41ab…","ent_0193…":"sha256:77c0…"}}
```

- `revision_id = "rev_" + SHA-256(manifest)`. A second value, `tree_hash = SHA-256(entities map)`, says whether two revisions have identical content whatever their history (I20).
- **Parents are hashed; time and author are not.** A rollback therefore gets a new ID (C2), while retrying the same merge yields the same ID.
- The stored text is exactly the hashed text, so one hash re-checks integrity.
- A job pinned to a revision ID is frozen by construction. "Frozen for execution" (B1.2) needs no lock.

**`pin_hash` (I18).** Each entity version has two hashes. `hash` covers the whole document and is what a manifest lists. `pin_hash` is the hash of the same document with `commitment.readiness` removed; without a commitment the two are equal. Jobs, consumers and work keys pin `pin_hash`, and a consumer states the readiness it needs as a separate condition. Freezing an unchanged provisional commitment therefore creates a new entity version and revision but changes no work key.

**Canonical JSON.** `canonicalize` 5.1.0 implements RFC 8785 and has no runtime dependencies. Batch 2b verified it against the RFC's tables (section 8). The fallback is about thirty lines of our own, since RFC 8785 specifies ECMAScript's own number serialisation. The schema already rejects what the RFC forbids (non-finite numbers, lone surrogates). **Only TypeScript canonicalises JSON:** the Python package `rfc8785` is marked beta and was last released in September 2024, so the Python worker receives paths and byte hashes (R0 §3) and never hashes a document.

**UUIDv7.** npm `uuid` 14.0.3 (MIT) generates RFC 9562 version 7 IDs; `uuidv7` 1.2.1 is the fallback. Batch 2b verified its `v7()`; Node's built-in `crypto.randomUUIDv7()` is not ordered within a millisecond and is not used. IDs are treated as opaque; ordering uses explicit columns.

### 2.6 Storage

**Runtime (C5).** Node 26 LTS, minimum 24.15. The built-in `node:sqlite` module is a release candidate (Stability 1.2) in Node 26 LTS and in Node 24 since v24.15.0, and still under active development in Node 22. Node 26.13.1 bundles SQLite 3.54.1 with FTS5. The alternative, `better-sqlite3` 13.2.0, is mature and MIT-licensed but is a native add-on.

**Choice: `node:sqlite` behind a small adapter** (`exec`, `prepare`, `tx`, `backup`, `close`). Both APIs are synchronous. The built-in module removes a native dependency and has what this design uses (busy timeout, `backup()`); it lacks a transaction helper, which the adapter's `tx` supplies. A release candidate is not stable: v26.11.0 renamed `DatabaseSync` to `Database`, keeping the old name as an alias. The adapter confines such changes to one file and makes `better-sqlite3` a one-file fallback. Batch 2b verified the module on Node 26.13.1 (section 8).

**Connection settings.** Write-ahead logging (`journal_mode=WAL`), so readers never block the writer. Foreign keys on; busy timeout 5 s; `STRICT` tables. One write connection in the main process; worker threads may open read-only connections.

**Durability and grouped commits.** `db.synchronous` defaults to `NORMAL`, which in WAL mode can lose the last commits on power loss. Transactions that must survive it run with `FULL`: promotions, paid-call intents and confirmations, and deliverable records. `FULL` everywhere stalled the main thread for too long (section 8). Commits are grouped, one per R5's `db.commit_tick_ms` (20), because ungrouped commits fell behind at 50 writes per second. A group holding a listed transaction commits with `FULL`: a `FULL` member closes any open `NORMAL` group and commits in its own group at `FULL`, which is correct whether or not SQLite lets the level change inside a transaction. Project Core owns this grouped writer, and R5's writer wraps it (decided: `lld/11` section 18, L2). Power-loss survival with `FULL` and rollback inside a grouped commit are ASSUMED (H12): batch 2b tested process death only. Build milestone M3 verifies the rollback and runs an abrupt-stop drill, terminating WSL from Windows under a write load and checking the database on restart; its result is labelled "abrupt VM stop", not power loss, and true power loss on a deployment disk stays ASSUMED until M11 (decided: `lld/11` section 18, L1; section 8).

**Where a Space lives (C6).** A Space is on the WSL or Linux filesystem, never under `/mnt/c`, on SQLite's own advice that WAL does not work over a network filesystem. In batch 2b a database on `/mnt/c` gave no error by itself, only slower commits. Start-up therefore reads the Space's mount type from `/proc/mounts` and refuses `9p`, which the Windows mount reports. Exports are copied out on delivery.

**Tables owned by Project Core.** R5 adds its own tables (`job`, `job_attempt` and others) to the same database. Project Core creates the `event` table in its own migrations, with R5's columns, and a helper `append_event(tx, …)`; R5 keeps the meaning and the event types and adds subscription (decided: `lld/11` section 18, B:SD3).

| Table | Content |
|---|---|
| `entity_version` | `hash` PK, `pin_hash`, `entity_id`, `kind`, `v`, `handle`, `doc`. Insert-only |
| `revision` | `id` PK, `tree_hash`, `parents`, `manifest`, `origin: patch\|merge\|restore\|migration\|genesis`, `patch_id`, `revalidate`, `pruned`, `created_at` |
| `patch` | `id` PK, `key` unique, `base`, `result`, `branch`, `author`, `intent`, `ops`, `diagnostics`, `status` |
| `branch` | `name` PK, `head`, `fork_point`, `type: accepted\|candidate\|worker\|experiment`, `state: open\|merged\|abandoned`, `owner_job`. The accepted head is the row `main` |
| `accepted_log` | `seq` PK (the `P` number), `revision`, `previous`, `from_branch`, `decision`, `by`, `at`. Append-only |
| `handle_history` | `handle` PK, `entity_id`, `retired_at_seq` |
| `dep_edge` | `from_version`, `to_entity`, `member`, `role`, `declared` |
| `authored_pin` | `from_version`, `to_entity`, `pin_hash`: the commitment versions a component was authored against (section 2.8) |
| `version_blob` | `version_hash`, `blob_hash` |
| `blob` | `hash` PK, `size`, `media_type`, `durable`, `state`, `stored_at`, `purged_reason` |
| `scope_grant`, `job_read` | section 2.7 |
| `evidence`, `experience`, `experience_tag` | section 2.11 |
| `event` | `seq`, `ts`, `type`, `job_id`, `consumer_id`, `scope`, `payload` (R5 §2.4); written through `append_event` |

Entity documents and manifests sit in SQLite because they must commit together with the head pointer. A manifest for 800 entities is about 94 KB, and batch 2b measured 500 revisions at 50 MB (section 8). `json_each` joins a manifest to `entity_version` when SQL needs the rows.

**Blob store.** `blobs/sha256/<first two hex>/<64 hex>`, read-only files. `ingest(stream, {durable})` streams to `tmp/<uuid>` on the same filesystem while hashing, renames the file into place (atomic on one filesystem), then inserts the `blob` row. The caller sets the durability flag:

- **`durable: true`** for bytes that cannot be made again: model outputs, paid audio, fetched originals, user files and component sources. The file and its directory are synced before the referencing transaction. For these blobs a crash can leave a file without a row, never a row without a file. A sync per file slows ingest several times over (section 8), so only these blobs pay for it.
- **`durable: false`** for derived bytes such as preview chunks and extracted frames. Nothing is synced, so after a power loss a row may point at a short file. The stored `size` is checked whenever such a blob is opened; on a mismatch the row is removed, the blob is treated as evicted and `open` returns `BLOB_MISSING`, and the Scheduler re-runs the job that made the blob (decided: `lld/11` section 18, A:M0-4).

**Atomic accepted-head update** (illustrative):

```sql
BEGIN IMMEDIATE;
UPDATE branch SET head = :candidate WHERE name = 'main' AND head = :expected_base;
-- changes() must be 1, otherwise ROLLBACK and return STALE_BASE
INSERT INTO accepted_log(revision, previous, from_branch, decision, by, at) VALUES (…);
INSERT INTO event(…);   -- through append_event, same transaction
COMMIT;                 -- with synchronous=FULL
```

### 2.7 Branches, promotion, rollback, locks and scopes

- **Branch.** A named pointer. Workers write to `w/<job>`, experiments to `exp/<name>`, the Director to `d/<n>`. A candidate revision is any revision absent from `accepted_log`. Abandoned branches stay inspectable (C2).
- **Promotion needs structural validity and authority only (I19).** It is a compare-and-swap with an expected base. Preconditions: the caller's grant has `may_promote` (the Director or a human); the candidate passed validation stages 1 to 7; the current head is an ancestor of the candidate. If the head has moved, the swap returns `STALE_BASE`, and the caller merges first, producing a candidate with both parents. Promotion requires no clean compile, passing check or review. A failed corrective check makes an artifact unusable where valid input is needed (a `frozen` compile then fails with `NOT_READY`) but does not block promotion. Delivery is what requires every hard check to pass (C9).
- **Rollback** is a `restore` patch followed by a normal promotion. It excludes the kinds in `rollback.excluded_kinds` by default, so later locks still apply and decisions survive. Partial rollback restores named entities. The expansion leaves every path the caller may not write at its value in the base revision and reports those paths in one `RESTORE_PATH_KEPT` warning, so the Director can still roll back after a module has written a `system` field; deleting entities created since `from` follows the ordinary rules (decided: `lld/11` section 18, B:O7).
- **Locks** are entities, so they branch and merge like everything else. A patch that touches a locked path fails with `LOCKED` unless its authority reaches the lock's level and it names the lock in `unlock`. A `brief` or `creator` lock needs a human; a `director` lock needs the Director or a human. A `brief` lock covers the brief and its hard constraints from the start. `lock.level` carries `x-cut-write {level: human, values: [brief, creator]}`, so only a human creates a `brief` or `creator` lock, and the Director, or a worker whose grant allows creating `lock`, may create a `director` lock. Changing or deleting a lock, including its `level`, `target`, `paths` and `subtree`, needs authority that reaches its current level, and the new level as well when `level` changes; otherwise the patch fails with `UNLOCK_NOT_PERMITTED`. `genesis` creates the `brief` lock as a human (decided: `lld/11` section 18, B:O12). The compiler derives timing equalities from locked paths (`voice_line.selected_take`, `event.pin`, `shot.duration`), as R4 documents.
- **Scope grant** (C1, B2.4), created when the Director invokes a worker (illustrative):

```json
{"job":"…","base":"P17","branch":"w/7f3a","may_promote":false,
 "read":[{"entity":"@shot04","subtree":true}],
 "write":[{"entity":"@shot04.presenter","paths":["transform","params"]},{"kind":"control_track","under":"@shot04"}],
 "create":["control_track","component","event"],"may_delete":false}
```

Project Core enforces the grant on every call from that job; prompts enforce nothing. A call outside the grant, including a promotion without `may_promote`, returns `OUT_OF_SCOPE`. Overlapping write scopes between live grants raise `SCOPE_OVERLAP` at grant time.

- **Read sets and the one late-result rule (FR10).** Every view call from a job records `(job, entity, pin_hash, hash)`: `pin_hash` for validity and the full `hash` for provenance. A job's artifact is cached under its work key. A worker's patch proposal is merged only if its read set, compared by `pin_hash`, is unchanged on the target head (B2.4 rule 5). Otherwise `propose`, or `project_merge` applied to a worker branch, returns `STALE_READ_SET` with the changed entities and writes nothing; R6 relays the code unchanged. A proposal whose read set is unchanged still merges after the head has moved, which is why `STALE_BASE` is not reused (decided: `lld/11` section 18, B:SD2).

**Field write levels (FR1).** Stage 4 checks every written path, in `create` as in `update`, against the field's level and the actor on the caller's grant. A failure is `FIELD_AUTHORITY`, naming the field and the level required. No grant raises a level. The one exception is the first creation of a brief-derived hard constraint (the Quality Intent rule below). A `system` field is written only through an operation of its owning module, which Project Core accepts only from that module's actor. A module actor is `{actor: module, module}` with one of five identifiers, which `x-cut-write.module` also uses: `ingest`, `rights`, `research`, `beat_tracking` and `quality`. A module may `create` an entity, writing its own `system` fields and `director` fields but never `human` fields or another module's `system` fields; `provenance` is written by the creating module, in `create` only. Ingest is part of Project Core (`packages/project-core`), beside the blob store's `ingest`: one entry point acting as the module actor `ingest` through `system_write`, which studio adapters, the harness's author handlers, the CLI and tests call; build milestone M2 builds it in work package M2-05 (decided: `lld/11` section 18, B:O11, L46).

| `system` field | Writer |
|---|---|
| `rights.status` | R7's rights module, from its rule table |
| `asset.identity.verdict` | The Quality System, from a review or a provider record |
| `claim.support`; `claim.status` when the value is `supported` | R7's research module, from its quote check, which R6's researcher sub-loop calls; the harness does not write these fields (K2) |
| `music_cue.beat_grid.verified` | R7's beat-tracking pass |
| Measured fields: on a take, `samples`, `sample_rate`, `spoken_text`, `timing`, `words`, `engine`, `work_key` and `loudness_lufs`; on an asset, `media` and `intrinsic` | Ingest, from the adapter's result |
| `provenance`, in every shape | The module that made the record |

- **`human` fields:** the `brief`, which holds the voice policy; every Quality Intent hard constraint with `from_brief`; the labelling fields `quality_intent.disclosure` and `delivery_profile.ai_disclosure`; the audio thresholds `delivery_profile.audio.loudness_lufs` and `delivery_profile.audio.verify_max_dbtp`, which are thresholds of the hard check F-09 (K1); and settings that the shared rule below makes `human`, such as `rights.share_alike_ok`, `screen_capture.allowed_origins`, `budget.hard_cap_usd` and `fetch.contact_identity`. When a delivery profile is created, its two audio thresholds take the values of R7's `delivery.audio.loudness_lufs` and `delivery.audio.verify_max_dbtp` settings; after that only a human may change them (K1). `cutroom new` runs `genesis(project, brief)` through the human path, with the `brief` lock, and on the same path creates the primary delivery profile from the profile defaults and appends the event R10 calls "brief accepted"; it creates no Quality Intent and no `decision` (decided: `lld/11` section 18, C:M4-O10a). Every other field is `director`.
- **Settings.** Each setting record states who may override it (`override_by: human|director`) and within what `range`. A `project.settings` path takes its level from that record, and a value outside the range fails with `VALUE_OUT_OF_RANGE`. A setting whose default differs by key keeps its one name and has a keyed value: its owner's table fixes the keys (`snake_case`, no dots), each with its own type and range, and a patch may set one key, as in `settings.tool.result_max_tokens.project_read`. A range is an integer range, a list of values, or both, as for `audit.retention_days`, which takes a number of days or `keep_all` (decided: `lld/11` section 18, A:M0-3). R9's settings resolve in this order: the registered default, then `project.settings`, then `quality_intent.settings_overrides`, so the more specific statement of the film's aims wins (decided: `lld/11` section 18, A:M0-11). A `settings_overrides` entry that names a setting R9 does not own fails with `UNKNOWN_FIELD` (stage 5), with path `settings_overrides`, `got` set to the setting name, `candidates` set to the nearest R9 settings, and a message saying that other settings belong in `project.settings` (decided: `lld/11` section 18, B:O8-code).
- **Who may override a setting: one shared rule (G15).** A setting is `override_by: director` unless it falls in one of these classes, which are `human`: (a) it holds a user decision; (b) it is a threshold or switch of a **hard** check, or it changes which checks are hard; (c) it is a budget cap or a spending limit; (d) it concerns the sandbox, network egress, rights rules or the capture allow-list; (e) it pins the render environment (Chrome build and flags, fonts, shim and host versions); (f) it guards the durability of stored data (G20), which means that it decides whether or for how long stored data is kept, or how commits are made durable (K5). Class (f) covers R3's storage settings (section 5), including `blob.grace_hours`; R5's `retention.*`, `cache.max_gb` and `db.commit_tick_ms`; and R6's `audit.retention_days` and `audit.max_gb`. Class (b) includes any setting whose value decides a system-written gate fact or whether a `final` compile is ready, such as `voice.final_timing` and `music.grid_tolerance_ms`. That clause (G20) is read narrowly (K6): it covers the settings that decide a system-written gate fact and the grade conditions for `final`, which are its two examples. Thresholds of corrective checks and the compiler's limits, such as `camera.zoom_min`, `camera.zoom_max`, `pixi.max_per_unit`, `follow.max_depth`, `timing.max_points` and R2's `validation.*`, stay with the Director: they protect a render, and the hard checks still gate delivery. A share of the budget inside the caps, such as `treatment.budget_fraction` or `stop.polish_budget_fraction`, is a production setting and not a cap (G22). The same rule applies wherever a setting is overridden, including `quality_intent.settings_overrides`: an override of a `human` setting written by the Director is refused with `FIELD_AUTHORITY` (G21). Thresholds of observational checks and production settings, such as candidate counts, review caps and rung sizes, stay with the Director. Without (b) the Director could pass a hard check by loosening it, which is the fault FR1 removed. Each owner's settings table marks its `human` rows, and the other stage documents refer to this rule. **Ranges:** the settings registry built at M0 refuses to load a setting that has no `override_by` and no `range`; the per-setting ranges are filled in then, from each default and its type.
- **Quality Intent (G19).** The Director creates the Quality Intent, including one or more hard constraints with a proof for each hard constraint of the brief; code stamps `from_brief` with the brief constraint's key and checks coverage. Every brief hard constraint must be covered by a hard constraint that names it in `from_brief` and has a proof; a patch that writes the Quality Intent and leaves one uncovered fails with `BRIEF_CONSTRAINT_UNCOVERED`. Creation is allowed once for each brief constraint key; from then on only a human may change or delete that constraint (G11). "Once" is judged against the patch's base revision, or the merged base when `rebase` runs: a Director patch may create constraints with `from_brief: k` only when the base's Quality Intent has none for `k`, so every constraint for one key comes in one patch (decided: `lld/11` section 18, B:O5). Any later Director patch to a constraint with `from_brief` fails with `FIELD_AUTHORITY`, whether it would weaken the constraint or not; no weakening test is needed. The Director may always add constraints. How well a constraint and its proof capture the brief is a model judgement that code cannot verify, so it is ASSUMED: every deliverable record prints each brief constraint beside its derived constraint and proof, and each golden brief carries its expected constraints, compared at M6 (R10).
- **An `unresolved` asset** is resolved by a human-authored `decision` of type `rights`, which the rights module applies, or by the Director substituting another asset.

### 2.8 Dependency index

**Derivation.** When an entity version is inserted, its outgoing edges are computed once from the schema's reference annotations, from data bindings and from `depends_on`, and stored in `dep_edge`. A version is immutable, so its edges never change. A revision's graph is its manifest joined to `dep_edge`.

**Authored-against pins.** A typed reference names an entity, not a version. A component written against scene context version 3 keeps the same bytes after version 4 is published, and its render stays a valid cache hit, yet it may now overlap the volcano. Its provenance therefore lists `authored_against: [{entity, pin_hash}]` for every commitment in its pinned bundle, and Project Core copies the list into `authored_pin`. `stale_assumptions(revision)` returns each component whose recorded `pin_hash` differs from the entity's `pin_hash` in that revision.

**Conservative fallback.** Component code is opaque, so overlap between layers in one shot is not declared. Any change inside a shot marks that shot's composite for revalidation.

**Query `impact(change)`** takes a patch, a pair of revisions or a list of handles.

1. Compute the changed entities and paths.
2. Walk reverse edges. A member edge matches only if the changed path overlaps the member; a whole-entity edge always matches.
3. Carry the edge role forward as the affected aspect, and continue transitively.
4. Add the containing shot of every affected entity, and the result of `stale_assumptions`.

It returns `{entity, aspects, via, certainty: typed|declared|conservative}` per affected entity, plus the affected shots.

**What the index is not used for.** Render-cache correctness comes from work keys (R5). An index gap can cause a missed review, never stale pixels.

**Stale evidence.** Each evidence record stores a `closure_hash`: the hash of the sorted `(entity, pin_hash)` pairs in its subject's dependency closure. Evidence is current for a revision only if the recomputed hash matches. This catches a change in meaning with identical pixels (VISION §5); a change of readiness alone leaves evidence current.

### 2.9 Three-way merge

Inputs: the target head (ours), the candidate (theirs) and their nearest common ancestor (base). Documents are upgraded to the current schema first (section 2.12).

1. **Per entity.** Changed on one side only, including created or deleted: take that side. Deleted on one side and modified on the other: `DELETE_MODIFY`.
2. **Per field,** when both sides changed an entity. Compare leaf paths; arrays are leaves. Changed on one side, or to the same value on both: take it. Otherwise `MERGE_CONFLICT`. Entity-level merging would conflict whenever two edits touch different fields of one layer.
3. **Reference lists** merge as ordered sets. One item moved to two places is a conflict. Two inserts at one position are ordered ours-first with `LIST_ORDER_AMBIGUOUS`.
4. **Handles.** Two new entities with one handle give `HANDLE_COLLISION`.
5. **Validate** the merged revision with stages 6 and 7, and check theirs' changes against ours' locks.
6. **Coupling.** Intersect `impact(base→ours)` with `impact(base→theirs)`. If the intersection is non-empty the merge succeeds with `COUPLED_CHANGE` and stores it as the candidate's `revalidate` set.

Any conflict stops the merge with nothing written. The caller retries `project_merge` with a `resolutions` map (`ours` or `theirs` per path).

**Who runs the validators after a merge.** Project Core only writes the candidate and its `revalidate` set. The `project_merge` tool handler then compiles inline in `plan` mode (the compile is pure and quick, and is not a Scheduler capability) and requests the checks on that set as jobs. The results attach to the candidate as evidence. Promotion does not wait for them; delivery requires them.

**What triggers revalidation.**

| Change | Revalidate |
|---|---|
| Merge with `COUPLED_CHANGE` | Compile, plus checks on the stored set |
| Anything inside a shot | That shot's composite checks |
| `event`, `time_constraint`, selected take | Timing solve for the connected events |
| `scene_context` | Consumers and components that pinned the superseded version |
| `claim`, `dataset`, or a `source` supporting either | Everything bound to it, directly or through a dataset cell: charts, labels, captions and lines. A line whose rendered spoken text changed gets a new take |
| `asset` identity; `rights` on an `asset`, `font`, `library` or `voice_profile` | Shots using it; delivery eligibility |
| `delivery_profile`, `font`, `library` | Everything that uses it |
| `quality_intent` | Every check that reads a changed field, deterministic checks included, and the reviews that cite it |
| `brief` | The Quality Intent derived from it, and reviews |

### 2.10 Asset, provenance and rights records

`provenance` on components, assets, voice profiles and capture sessions is one of six shapes. HLD C5 names the first five; `captured` is added for tutorial capture.

| Origin | Fields |
|---|---|
| `authored_code` | `job`, `model: {provider, id}`, `prompt: ArtifactRef`, `recipe?`, `inputs[]`, `authored_against: [{entity, pin_hash}]`, `toolchain: {shim, chrome, fonts}`, `repair_of?`, `seed?` |
| `acquired` | `source: Ref<source>`, `original_url`, `page_url`, `retrieved_at`, `creator`, `original: ArtifactRef` (bytes as fetched), `found_by: job` |
| `derived` | `from: Ref<asset>[]`, `operation: {tool, version, args}`, `job`. The trim and transform sit in `asset.mapping`, in source pixels and the source timebase |
| `provider_audio` | `adapter`, `adapter_version`, `model`, `params`, `request_hash`, `job`, `disclosure: ai_generated` |
| `captured` | `session: Ref<capture_session>`, `job`, `url`, `captured_at` |
| `user_supplied` | `supplied_at`, `declared_rights` |

`rights` is `{status: candidate|evidence_collected|eligible|restricted|unresolved|revoked, licence: {id, url, snapshot}, attribution: {required, text}, scope: {commercial, modify, platforms, expires?}, basis: Ref<source>[], decision?: Ref<decision>}`. R7 owns the state machine; R3 stores the state. `asset`, `font`, `library` and `voice_profile` all carry this record.

- Found is not eligible: an acquired asset starts as `candidate` and may appear in previews. `rights_closure(revision)` lists every asset, font, library and voice profile reachable from a revision with its status. R9 makes "every imported item is `eligible`" a hard delivery check.
- Originals are never modified. A derived asset (`derived_from`, `mapping`) exists only for destructive preparation such as transcoding; a display crop is `layer.source.crop` and creates no asset (FR6). Anchors stay in the original's pixels (R1 §3.4).
- Code-authored components meet C5's "editable controls or declared limits" through `meta.controls` and `edit_limits`.
- `purge(asset, reason)` deletes the bytes after a takedown, sets `revoked` and keeps the record.

### 2.11 Evidence, experience and the recipe registry

**Evidence** follows R1 §5 and stores R9's Diagnostic Evidence Bundle (I30). It lives in a side table, not in the revision: if a review were an entity, reviewing a revision would change it. Indexed columns: `id`, `signature` (R9's identity of a finding, used to recognise a repeat), `origin_kind: check|worker|reviewer|experiment`, `check`, `check_version`, `settings_version`, `check_type`, `verdict`, `severity`, `fault_layer: authoring|compile|render|encode|observation|unknown`, `revision`, `subjects` (entity IDs and `pin_hash` values), `artifact`, `job`, `closure_hash`, `coverage`, `cost_usd`, `created_at`. The rest of the bundle is one canonical JSON blob referenced by `body`. Readers use `evidence_read(ref, section, cursor)`. A `decision` entity cites evidence IDs.

**Experience record,** one row in `experience` per try. R5's `job_attempt` table records execution; `experience` records what was learned and links to it. Its identity field is `approach`; `signature` means only R9's finding signature.

| Field | Meaning |
|---|---|
| `approach` | Capability, recipe version hash, technique tags, representation, model |
| `context` (as tags) | Domain, style, object role, shot scale, what must be communicated, precision need |
| `work_key`, `job`, `job_attempt`, `base`, `scope`, `branch` | What ran, where |
| `outcome` | `accepted`, `rejected`, `failed_validation`, `failed_review`, `abandoned`, `error`, with the R1 failure class |
| `defects[]`, `evidence[]` | Evidence signatures and evidence IDs |
| `cost` | Tokens, dollars, time, attempt number |
| `next_suggestion`, `retry_of` | The repair chain |

Retrieval: an identical work key is R5's business (the cached result). The same `approach` and `context` returns `KNOWN_FAILURE` with the evidence before work starts; the caller proceeds by stating what changed. `experience_search` ranks looser matches by tag overlap and recency. Embedding search is not used: tags are inspectable and need no Python worker.

**Recipe** (a technique or capability) is an entity, so it is versioned and branchable: `name`, `summary`, `tags[]`, `applies_to: {roles, actions, representations, domains}`, `method: {type: prompt_template|code_skeleton|base_component|track_template|procedure, body: ArtifactRef}`, `params`, `contract: {required_controls, probes}`, `fallback?: Ref<recipe>`, `known_limits[]`, `tests[]`, `status: seed|candidate|validated|retired`, `derived_from?`. A seed set ships with each release and is imported when the Space is created. Recipes and experience belong to one production; cross-project promotion stays open (roadmap §4). Statistics are a query over `experience`, never stored fields. Raising a status is a Director patch citing a decision.

### 2.12 Schema versioning and migration

**Choice: upgrade on read, write current.** Rewriting every entity when a schema changes would change every hash and flood history with migration revisions.

Each kind has pure functions `upcast(vN → vN+1)`, and any schema change bumps `v`. Stored documents are never rewritten. Readers upgrade in memory, and a patch that touches an entity writes it at the current `v`. A change that needs several entities at once becomes an explicit `migration` revision, promoted through the normal path. Database layout changes use `PRAGMA user_version` and ordered scripts, run in one transaction at open after an automatic `backup()`.

### 2.13 What an LLM sees, and human edits

The model reads views, never the whole project. A view shows handles for references, times as `650ms` or `5.15s`, and no defaults or empty fields. It uses exactly the field names and nesting that `update` accepts, and marks as read-only any field whose write level the caller lacks. Every view begins with the revision it was read from, which is the patch `base`. String fields of an `untrusted_web` entity appear inside the harness's untrusted-data fence.

R6 owns the tool catalogue (I24). Project Core implements these tools:

| Tool | Returns |
|---|---|
| `project_read` | View `outline`: the project's own handle, then the beat and shot tree, one line per shot. Views `card`, `summary`, `full`: the selected entities as one line each, as main fields, or as whole documents. View `timeline`: one shot's layers, events and constraints as a table |
| `project_find` | Matching handles with one-line summaries, by kind, field values or text |
| `project_refs` | Neighbours in the dependency index, inbound or outbound |
| `project_impact` | Section 2.8, as a dry run for a patch or a list of handles |
| `project_patch` | Section 2.4; with `dry_run`, diagnostics without writing |
| `project_diff`, `project_history` | Changed paths between two revisions; an entity's accepted versions and the decisions about it |
| `project_schema` | For one kind: its fields with their types, which are required, each field's write level, and one small example. Views hide empty fields, and some shapes have no example in the project, so this is how a model discovers them (J5) |
| `project_branch`, `project_merge`, `project_promote` | Sections 2.7 and 2.9 |
| `experience_search`, `evidence_read` | Matching experience records; one section of an evidence record |

Project Core returns pages no larger than the cap the harness passes: R6's `tool.result_max_tokens`, which `project_read` overrides to 4,000. A longer result is cut at an entity boundary with Project Core's continuation cursor, never silently.

**Human edits** use the same operations, because the store has no other write path. Dragging an object is `update layer.transform`; reordering shots is `list_move beat.shots`; choosing another take is `update voice_line.selected_take`; protecting a decision is `create lock` at level `creator`; undo is `restore`.

### 2.14 Retention and garbage collection

- **Kept for the life of the production:** every accepted revision, every branch head and fork point, every patch, evidence and experience record, and every revision that one of those or a deliverable cites.
- **Pruned:** intermediate candidate revisions that nothing cites, after `retention.prune_intermediate_days`. The row stays with its parents; the manifest is dropped.
- **Entity versions** are deleted when no retained manifest lists them.
- **Blobs: one mark-and-sweep, run by Project Core's blob store.** Project Core's roots are the `version_blob` rows of retained versions, evidence bodies and attachments, deliverables and explicit pins. The Scheduler supplies the rest through its `blob_roots()` call: the results it keeps, the inputs of unfinished jobs and the diagnostics of retained jobs. The sweep removes a blob that no root reaches. The grace period protects every such blob younger than `blob.grace_hours`, whether or not its row exists yet (H7, correcting F13). The Scheduler chooses evictions by withdrawing a root and never unlinks a file; eviction removes only blobs referenced solely as re-creatable cache results. Order: mark `deleting`, unlink, delete the row; the next sweep repairs a crash.
- **Backups** (decided: `lld/11` section 18, A:M0-10). `backup()` writes to `backups/` inside the Space directory, on the same filesystem, in a file named by UTC time and `user_version`. The newest `db.backup_keep` periodic backups are kept, and the newest pre-migration backup in any case. This guards against database damage, not against losing the disk; a copy outside WSL is the user's choice of place.

## 3. Interfaces to other stages

| Stage | R3 provides | R3 needs |
|---|---|---|
| R2 rendering | The `component` and `library` kinds; a faithful copy of `meta`; blob paths for the host page | The validated `meta`; the toolchain identity |
| R4 compiler | A snapshot of one revision; resolved references and bindings; the index; `pin_hash` per entity; the `scene_context` entity | Solved times and source maps keyed by entity ID; compilation records, stored as blobs with the compiler's own `compilation` index table, registered through Project Core's migrations, and not as evidence rows (decided: `lld/11` section 18, B:O4) |
| R5 scheduler | The shared database and transaction; the blob store with its durability flag and the single sweep; read sets; `pin_hash`; the `ReadinessOracle` answers for `commitment` and `acceptance`; `stale_assumptions`; the `event` table, created by Project Core with R5's columns, and `append_event` (decided: `lld/11` section 18, B:SD3) | Job IDs for grants and provenance; `blob_roots()` and eviction choices |
| R6 harness | The tools in section 2.13; scope grants; Project Core's error codes; `trust` labels | The caller's actor and authority on every call; the page cap |
| R7 studio | Kinds for takes, cues, voice profiles, datasets, media needs, capture sessions, sources and assets; provenance and rights shapes | Engine results in those shapes; the rights state machine; the segmenter and formatter |
| R9 quality | Evidence storage; `closure_hash`; `rights_closure`; the `quality_intent` kind | Check definitions; verdicts; the bundle schema |

## 4. Failure handling

| Case (HLD B4 / C11) | Behaviour |
|---|---|
| Stale worker completes after the head moved | `STALE_BASE`, then the late-result rule (section 2.7): the patch proposal is merged only if its read set is unchanged on the target head; otherwise the changed entities are returned and nothing merges silently |
| Two disjoint edits conflict semantically | The field merge is clean; the impact intersection raises `COUPLED_CHANGE`; the tool handler compiles inline and requests the checks as jobs |
| Provisional scene bound changes | A new `scene_context` version supersedes the old; `impact` lists the consumers and the components authored against it |
| Failed experiment | The branch is marked `abandoned`. `main` never moved, so nothing is undone; the experience record and evidence stay |
| Corrected fact | A `claim.values` change, the figure's one home, reaches dataset cells, charts, captions and lines through member references with role `fact` |
| Known defect kept in a preview | Evidence is linked to the revision. Promotion does not read findings |
| Crash mid-patch, mid-promotion or mid-ingest | One SQLite transaction commits or rolls back whole. Batch 2b verified this for process death (section 8). A kill usually leaves one committed transaction unacknowledged, so every caller must be able to repeat a request; the patch `key` makes the retry return the first result. An unlisted blob file is swept after the grace period; a short derived blob fails its size check and is made again |
| Final file fails | The project is untouched; the deliverable record (C9) is separate from the revision |
| Database damage | `PRAGMA quick_check` at open; hashes re-verify documents and blobs; a backup every `db.backup_hours`. A failed `quick_check` refuses start-up with `DB_DAMAGED` and names the newest backup; restoring is a human act (decided: `lld/11` section 18, A:M0-10) |

## 5. Named settings and defaults

R3 owns these settings. Names follow `area.snake_case` (C1). Override gives each record's `override_by` and `range` (section 2.7); the storage settings are `human` because they guard durability (class (f) of the shared rule).

| Setting | Default | Override | Note |
|---|---|---|---|
| `store.number_decimals` | 6 | `human`; 3–9 | Rounding of non-time numbers |
| `handle.alias_grace_revisions` | 50 | `director`; 10–500 | Accepted revisions during which an old handle still resolves, with a warning |
| `db.synchronous` | `NORMAL` | `human`; `NORMAL` or `FULL` | The transactions listed in section 2.6 always commit with `FULL`. R5 refers to it by name |
| `db.backup_hours` | 6 | `human`; 1–24 | Online `backup()` |
| `db.backup_keep` | 4 | `human`; 1–48 | Periodic backups kept in `backups/` (one day at `db.backup_hours` = 6); the newest pre-migration backup is kept as well (decided: `lld/11` section 18, A:M0-10) |
| `blob.verify_on_read` | `final_render_only` | `human`; `final_render_only` or `always` | The hash is always verified at ingest |
| `blob.grace_hours` | 24 | `human`; 1–168 | The only sweep grace period; covers every unrooted blob younger than this, with or without a `blob` row (H7) |
| `retention.prune_intermediate_days` | 7 | `human`; 1–90 | |
| `rollback.excluded_kinds` | `lock`, `decision` | `human`; kinds may be added, not removed | |

The view page cap is not an R3 setting; it is R6's `tool.result_max_tokens`.

## 6. Cross-domain check

| Domain | What carries it |
|---|---|
| Historical comedy | The reaction track's `origin` is an event constrained to the eruption; a locked take holds because its events derive from measured audio. A failed handoff is an experience record on an abandoned branch |
| Science documentary | A wrong-train finding changes the asset's `identity.verdict`, and `impact` reaches shots, labels and lines |
| Art history | Feature anchors live on the original asset in its pixels. A new crop is a new layer version (`source.crop`), not a new asset, so annotations bound by member reference reproject |
| Software tutorial | A `capture_session` holds the frames and steps. Each step is a derived event, so a recapture affects only the callouts and layers that reference it |
| Data reel | A factual figure lives once, in `claim.values`; dataset cells, charts and lines reference it. A corrected figure changes that one value, and the spoken number uses the same `Format` |
| Abstract motion graphics | `music_cue.markers`, `beat_grid` and beat-relative times bind motion to the tempo map. No claim or asset is required |

## 7. Decisions that differ from the first working draft

The [integration decisions](11-integration-decisions.md) record these. Items 1, 4 and 5 are also Revision 1 of R1.

1. **Only TypeScript canonicalises JSON** (R1 §7 revised).
2. **Node 26 LTS, minimum 24.15** (C5).
3. **List operations address items by value, not position.**
4. **Revision ID covers parents but not time or author; `tree_hash` and `pin_hash` are added** (R1 §2.2 revised).
5. **Handles are kept for token cost.** S5 did not support R1's assumption that they reduce copying mistakes.
6. **Evidence and experience are side records, not entities.**
7. **Merge revalidation is targeted:** an inline compile, then checks as jobs.
8. **Kinds added:** `voice_profile`, `dataset`, `media_need`, `capture_session`, `library` (I14) and `treatment` (FR2).
9. **Other additions:** `restore`, per-job read sets, the general `commitment` block, `trust`, authored-against pins, `closure_hash`, per-field write levels (FR1) and `layer.source` (FR6).
## 8. Claims table

| Claim | Label | Evidence or consequence |
|---|---|---|
| MiniMax models write schema-valid tool arguments without a JSON mode (377 of 381 calls), including two-operation `project_patch` calls; an exact schema error repaired 4 of 4 invalid calls | VERIFIED by spike, for fully typed schemas only | S5, [results](../research/evidence/s3-s5-s6-minimax.md). Limits: single-turn tasks on a 13-entity project. Untyped values such as `ops` lose their types on the MiniMax endpoint (batch 3), so they travel as JSON text (R6 D7) |
| No entity reference was miscopied in 352 trials, with handles or long IDs; long IDs cost about 885 more input tokens per task (30%) | VERIFIED by spike | S5. Handles are justified by cost only |
| The full operation set of section 2.4, with by-value list addressing and multi-step edits, works on a project of realistic size | VERIFIED by spike (batch 3), with JSON-text transport | R3-K2, [batch 3](../research/evidence/b3-patches-and-restart.md): 40 tasks on a 184-entity synthetic project, both models, 588 runs. With `ops` as JSON text, 95% of runs were correct, 88% of first patches were valid and 98% were valid within two repairs. Limits: one synthetic project, with tasks that mostly name their handles; paging was never triggered and stays with R3-K4 at M4; vague, Director-style requests are untested and are covered by the first golden brief at M4 (R10) |
| RFC 6902 JSON Patch is no more accurate than the entity operations | VERIFIED by spike | Batch 3, 10 tasks, 48 runs each: 41 against 45 right, with 75% to 85% more uncached input and index-shift errors on multi-item removals (J7, section 2.4) |
| `node:sqlite` is Stability 1.2 in Node 26.13.1 and in Node 24 since 24.15.0, and Stability 1.1 in Node 22.23.5. It has a busy timeout, `backup()` and user functions, and no transaction helper. `DatabaseSync` became `Database` in v26.11.0. Node 26, 24 and 22 are the current LTS lines | VERIFIED by source | [v26](https://nodejs.org/docs/latest/api/sqlite.html), [v24](https://nodejs.org/docs/latest-v24.x/api/sqlite.html), [v22](https://nodejs.org/docs/latest-v22.x/api/sqlite.html), [releases](https://nodejs.org/en/about/previous-releases), [DEP0210](https://nodejs.org/docs/latest/api/deprecations.html#dep0210-sqlitedatabasesync) |
| Node 26 bundles SQLite ≥ 3.53.0 with FTS5 | VERIFIED by source | [26.1.0 notes](https://nodejs.org/en/blog/release/v26.1.0), [sqlite.gyp](https://github.com/nodejs/node/blob/v26.x/deps/sqlite/sqlite.gyp). Batch 2b read 3.54.1 |
| `node:sqlite` on Node 26.13.1 loads with no flag and no warning; WAL, `STRICT` tables, `BEGIN IMMEDIATE`, `json_each`, the busy timeout and `backup()` work | VERIFIED by spike | [Batch 2b](../research/evidence/b2b-sqlite-node.md); R3-K1 closed. Each feature was checked once, for function |
| 400 SIGKILLs during a promotion loop: no integrity failure, the head always matched the log, no acknowledged commit lost. About 9 in 10 kills left one committed transaction unacknowledged | VERIFIED by spike | Batch 2b. Process death only, with ungrouped commits |
| A `FULL` commit took about 5 ms at the median and stalled the main thread for up to about 190 ms under load; with `NORMAL` the worst stall was 25–30 ms. Ungrouped commits fell behind at 50 writes per second; grouped commits did not | VERIFIED by spike | Batch 2b: one laptop, a WSL2 virtual disk, background load |
| A `FULL` commit survives power loss on the deployment disk, and one transaction can roll back inside a commit group | ASSUMED | H12. Batch 2b tested process death only. Build milestone M3 verifies the rollback and runs an abrupt-VM-stop drill; true power loss on a deployment disk stays ASSUMED until M11 (decided: `lld/11` section 18, L1). If wrong, a promotion can be lost in a power cut, and the affected transactions move to their own commit |
| 500 revisions of an 800-entity project: 50 MB, a warm snapshot load of 1.7 ms (about 120 ms cold), a diff in 0.5 ms | VERIFIED by spike | Batch 2b, synthetic documents. Nothing larger was measured |
| `better-sqlite3` 13.2.0: MIT, Node ≥ 22, N-API since 13.0.0, SQLite 3.54.1 | VERIFIED by source | [releases](https://github.com/WiseLibs/better-sqlite3/releases), [registry](https://registry.npmjs.org/better-sqlite3/latest) |
| WAL lets readers and one writer run together and fails on network filesystems; the WAL-reset bug is fixed in 3.51.3. `synchronous=NORMAL` in WAL can lose recent commits on power loss; `FULL` is durable | VERIFIED by source | [wal.html](https://www.sqlite.org/wal.html), [pragma.html](https://www.sqlite.org/pragma.html) |
| `BEGIN IMMEDIATE`, STRICT tables and `json_each` behave as used here | VERIFIED by source | [transactions](https://www.sqlite.org/lang_transaction.html), [strict](https://www.sqlite.org/stricttables.html), [json1](https://www.sqlite.org/json1.html) |
| `rename()` atomically replaces the target on one filesystem | VERIFIED by source | [rename(2)](https://man7.org/linux/man-pages/man2/rename.2.html) |
| RFC 8785 fixes key order, number and string forms and rejects NaN, Infinity and lone surrogates; `canonicalize` 5.1.0 implements it (Apache-2.0, no runtime dependencies) | VERIFIED by source | [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785), [repo](https://github.com/erdtman/canonicalize), [registry](https://registry.npmjs.org/canonicalize/latest) |
| `canonicalize` 5.1.0 passes the 26 rows of the RFC's number table and its sorting example, and matched a reference on 10,000 random objects | VERIFIED by spike | Batch 2b; R3-K3 closed |
| Python `rfc8785` 0.1.4 is beta, last released 27 Sep 2024 | VERIFIED by source | [PyPI](https://pypi.org/project/rfc8785/). Off the critical path |
| `uuid` 14.0.3 (MIT) and `uuidv7` 1.2.1 (Apache-2.0) generate UUIDv7 | VERIFIED by source | [uuid](https://github.com/uuidjs/uuid), [uuidv7](https://registry.npmjs.org/uuidv7/latest), [RFC 9562](https://www.rfc-editor.org/rfc/rfc9562) |
| `uuid` 14.0.3 `v7()` gave 100,000 unique IDs in generation order within one process. Node's built-in `crypto.randomUUIDv7()` is not ordered within a millisecond | VERIFIED by spike | Batch 2b |
| Zod 4 (`z.toJSONSchema`) copies custom metadata into JSON Schema | VERIFIED by source | [zod.dev](https://zod.dev/json-schema) |
| A database on `/mnt/c` in WSL2 gives no error, only slower commits and reopens. `/proc/mounts` reports that mount as `9p` and the Linux home as `ext4` | VERIFIED by spike | Batch 2b. A Windows program sharing the file was not tried. The refusal rests on SQLite's advice and [Microsoft's](https://learn.microsoft.com/en-us/windows/wsl/filesystems) |
| A 90-second film is about 800 entities and 500 revisions | ASSUMED | If far larger, store manifests as deltas; no interface changes |
| Views fit the page caps on a 30-shot project | ASSUMED | R3-K4. If wrong, views get coarser levels or more paging |
| A size check detects a derived blob damaged by power loss | ASSUMED | A full-length file with wrong bytes would pass. If that occurs, verify hashes on read (`blob.verify_on_read`) |
| Blob ingest ran at 177–329 MB/s without a sync per file, 36–41 MB/s with one and 25–34 MB/s with the directory synced too | VERIFIED by spike | Batch 2b, under background load; R3-K5 closed |
| The same-shot fallback catches undeclared coupling well enough | ASSUMED | Needs real films. Cross-shot coupling must be declared |

## 9. Spikes wanted

| ID | Claim | Method |
|---|---|---|
| R3-K2 | MiniMax can write and repair the full patch format at project scale | VERIFIED by spike (batch 3), with JSON-text transport (section 8): 95% of runs correct, 88% of first patches valid, 98% valid within two repairs, on one synthetic 184-entity project with tasks that mostly name their handles. Vague, Director-style requests are covered by the first golden brief at M4 |
| R3-K4 | Views fit the page caps | Count tokens for the `outline`, `card`, `full` and `timeline` views on a synthetic 30-shot project. Paging is untested: none of batch 3's 1,291 reads reached the 2,000-token cap, so it is measured here at M4 |

Batch 2b closed R3-K1, R3-K3 and R3-K5. Batch 3 verified R3-K2.

## 10. Decisions for the user

Three items in section 9 of the [integration decisions](11-integration-decisions.md) touch stored fields in this stage. The user decided all three on 15 November 2026 (section 17 of the integration decisions).

1. **Voice policy.** `voice_profile.origin` allows `preset`, `designed` and `procedural`. The user permits no voice cloning at all, including the user's own voice (U9), so no origin value or consent reference is added.
2. **ShareAlike media.** ShareAlike media is not accepted (U4): R7's setting `rights.share_alike_ok` is `false`. A media need's `use_profile.share_alike` copies it (F4).
3. **AI-content labelling.** There is no embedded C2PA signing (U7), so `quality_intent.disclosure.c2pa` stays `off`. There is no visible on-screen notice by default (U10): `visible_notice` defaults to `false`, and setting it to `true` for one film is the switch (L16).
