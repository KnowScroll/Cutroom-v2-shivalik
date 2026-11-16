# Cutroom v2 — LLD · R2: Visual Components and Rendering

**Decided:** 14 November 2026
**Status:** DECIDED by the lead session under the user's delegation of 14 Nov 2026. The design set was frozen on 15 November 2026 ([R10](10-r10-integration-acceptance-and-build-plan.md) section 6.4); this document may be revised during implementation.
**Baseline:** HLD A–C (C6, C7, B1.3, B2.4), [R0](01-r0-framing-decisions.md), [R1](02-r1-foundations.md) with Revision 1, the [integration decisions](11-integration-decisions.md), the [spike log](../research/10-spike-evidence-log.md), and the full results for [S4](../research/evidence/s4-render-host.md), [S3, S5, S6](../research/evidence/s3-s5-s6-minimax.md), [S7](../research/evidence/s7-pixi-hardening-follow.md) and [batch 2a](../research/evidence/b2a-colour-mux-mix.md). Web sources were fetched on 14 Nov 2026.

---

## 1. Problem and scope

R2 turns frozen inputs into frames and an MP4. It must render visual code written by a language model that we cannot trust to be correct or safe, give the same pixels for the same inputs, and report enough measured facts for repair and quality checks to work without a model call.

**In scope:** the component contract, the library registry, the shim, the host page, the sandbox, capture, encoding, colour, fonts, the trusted media and caption components, the preview ladder, validation, diagnostic captures and baking. **Out of scope:** the Render Plan (R4), scheduling (R5), the author repair loop (R6), audio and caption tracks (R7), quality rubrics (R9).

**Terms.** A *component* is one HTML document that draws one visual element and can be set to any time. A *render unit* is a shot or a transition, lowered by the compiler into a stack of layers with per-frame tables. The *host page* is the trusted page that stacks one unit's layers. The *shim* is trusted script inside every component. A *probe* is layout data measured inside a component. A *chunk* is a half-open range of a unit's frames. A *rung* is a level of output fidelity; a plan's *grade* is input readiness and belongs to R4. *BeginFrame* is the Chrome DevTools Protocol (CDP) command that makes headless Chrome draw exactly one frame.

Persisted fields and settings are `snake_case`. Snippets are illustrative, but their field names are the persisted form.

---

## 2. Decisions

### 2.1 Engine: our own thin engine

The engine is our own, on `puppeteer-core`, `chrome-headless-shell` and FFmpeg. HyperFrames (HeyGen, Apache-2.0, v0.9.44, at least 32 releases in the ten days to 14 November 2026) and Remotion (a custom licence with paid automated rendering; React components that need a bundler) were rejected: neither isolates untrusted components, returns per-frame probe data or accepts per-frame control values. HyperFrames also rounds time to the nearest frame, against R1's round-up rule. It remains our reference for flags, the warm-up loop and the frame clock.

### 2.2 The component contract

**Problem.** The compiler, the linter and the host must know a component's controls, fonts and time behaviour without running its code, whatever technique draws it.

**Choice.** A component is one HTML document with a static `<script type="application/json" id="cut-meta">` block and one call `cut.define({ prepare, seek, report })`.

```ts
// Illustrative
type Meta = {
  contract: 1;
  size: { w: number; h: number };            // design units
  duration: { kind: "fixed"; seconds: number } | { kind: "open" };
  out_of_range: "hold" | "loop" | "hide" | "error";
  time_invariant: boolean;
  may_be_blank: boolean;                     // default false
  technique: ("svg" | "canvas2d" | "html" | "sprite_sheet" | "puppet_rig" | "pixi_scene")[];
  libraries: string[];                       // "name@version"
  params: Record<string, { type: string; required: boolean }>;  // fixed inputs
  controls: Record<string, Control>;
  fonts: { family: string; weights: number[]; italic?: boolean }[];
  probes: string[];                          // promised data-cut-id values
};
type Control = { nullable?: boolean } & (
  | { type: "number"; min: number; max: number; default: number }
  | { type: "boolean"; default: boolean } | { type: "color"; default: string }
  | { type: "enum"; options: string[]; default: string }
  | { type: "point"; default: [number, number] }
  | { type: "text"; max_length: number; default: string });
```

- `prepare(params)` runs once and may be asynchronous. `seek(t, controls)` is synchronous and sets the whole visual state for local time `t` in seconds; returning a promise is the error `SEEK_ASYNC`. `report()` is optional and returns probe items for Canvas drawings.
- **Duration** is written in seconds; R3's copy of `meta` stores flicks. Trusted code applies `out_of_range` (R1 §1.6) before `seek`.
- **`params`** is the schema of the fixed inputs a component accepts (name, type, required). Chart data parameters are declared there.
- **Controls are always passed complete.** A control declared `nullable: true` may arrive as `null`, meaning "automatic": the component derives it, for example a brow value from the current `expression`. An unkeyed control receives its default, or `null` if nullable.
- **Nothing in the browser interpolates.** The compiler evaluates control tracks, time maps and the camera into per-frame tables in the Render Plan (R4); Node reads them and sends frame packets.
- **`may_be_blank`** declares that a flat or empty picture is intended; check C-05 reads it.

**Technique-neutral.** Anything that runs in the sandboxed page behind `seek(t, controls)` is allowed: inline SVG, Canvas 2D, HTML and CSS, sprite sheets and pose atlases, layered puppets with rigs. `meta.technique` tags what a component uses, for the technique registry, lint and review.

**Trusted library registry.** A `library` record (an R3 entity kind) holds a name, a version, the file's hash, its licence and whether it needs WebGL. A component declares `meta.libraries`, and the sealer (2.5) copies each library from the blob store into the sealed script, after the shim. No library is ever loaded from the network; an undeclared or unregistered one is the lint error `LIBRARY_UNREGISTERED`. Library code runs under the shim, so it must draw on demand inside `seek`.

**WebGL** is allowed only when a declared, registered library needs it. Hand-written WebGL is a lint error, and WebGPU is excluded.

**PixiJS 8.23.0 is the one registered library,** admitted by S7 with exactly this configuration and no CSP change: its `unsafe-eval` add-on module inlined; `Ticker.system` and `Ticker.shared` set to `autoStart = false`, and `autoStart: false` on the application; one manual render inside `seek`; textures made from an `<img>` or a canvas; `resolution` set from `scale` (2.5). `Assets.load` hangs under the CSP and is a lint error in a component that declares PixiJS.

**PixiJS is optional, never the default;** the default techniques stay SVG, Canvas 2D and HTML. Under software rendering it was slower than hand-written Canvas 2D in every comparison (178–220 ms against 70–79 ms per frame for 200 sprites with a full-frame blur) and used about 10 cores, so four browsers gave 1.5× the throughput against 3.1×. It brings authoring convenience, not speed. A render unit holds at most `pixi.max_per_unit` (1, R4) PixiJS component and is rendered by `pixi.unit_browsers` (1, R5) browser at a time.

**Rejected.** A `meta` returned by running code hides the contract from static tools. An asynchronous `seek` invites state leaks (S2: 2 of 24 components). CSS animations add a second clock, and models obey a ban: 0 of 110 components in S2 and S3 used a banned API.

### 2.3 The host–component message protocol

The host and a sandboxed component have different origins and can only exchange messages, so each component gets one `MessageChannel`. The host posts once to the frame with target origin `"*"` (an opaque origin cannot be named) and transfers a port, which the shim keeps in a closure. The host ignores anything that does not arrive on that port, so component code cannot forge replies.

```ts
// Illustrative. host → component
{ type: "init", protocol: 1, layer, params, seed, scale, diag? }
{ type: "seek", seq, t, t_flicks, frame, controls, probe: boolean }
// component → host
{ type: "ready",  meta, prepare_ms }
{ type: "seeked", seq, seek_ms, probe?, notes }
{ type: "fault",  seq?, code, message, line?, col?, stack? }
```

- **Fields.** `t_flicks` is the layer's local time, `t` is `t_flicks / 705,600,000` seconds, and `frame` is the unit-local frame index. `layer` is the layer's path in the unit's stack; no entity ID or handle enters the page. `scale` is the output scale times the highest camera zoom in the unit (2.5). `diag` requests a diagnostic mode (2.16).
- **Acknowledgement is mandatory.** Every `seek` gets exactly one `seeked` or `fault` with the same `seq`. The host function `applyFrame(packet)` resolves when every active layer has answered, and only then does Node send BeginFrame. S4 measured 0 wrong frames in 900 random-order captures with this rule and 299 torn frames in 300 without it.
- **Codes** (owned by R2): `LOAD_ERROR`, `NO_DEFINE`, `META_INVALID`, `PREPARE_REJECTED`, `SEEK_THROWN`, `SEEK_ASYNC`, `BANNED_API`, `NESTED_FRAME`, `CSP_VIOLATION`, `CONSOLE_ERROR`, `PROBE_MISSING_ID`, `ANIMATION_RUNNING`. R2 also owns `FONT_UNREGISTERED` and `LIBRARY_UNREGISTERED`, which R4 relays unchanged.
- **Capture and encode codes** (owned by R2, with the classes of section 4): `BROWSER_CRASHED` (a crash event or a closed pipe; `transient`, and `deterministic` on a second failure at the same frame); `CDP_TIMEOUT` (a call over `capture.cdp_timeout_ms`; `transient`); `SCREENSHOT_MISSING` (no `screenshotData` after `capture.retry`; `transient`); `ENCODE_FAILED` (FFmpeg's exit status) and `FRAME_COUNT_MISMATCH` (the expected and actual counts from `ffprobe`), each `transient`, then `deterministic`; and `LAYER_LIMIT_EXCEEDED` (`host.max_layers` and the actual count; `deterministic`). The host does not reuse R4's `UNIT_TOO_LARGE` (C3) (decided: `lld/11` section 18, A:M1-4).
- **Timeouts belong to Node,** because a looping component blocks the whole page (2.7). Node races `applyFrame` against a wall-clock timer, records `PREPARE_TIMEOUT` or `SEEK_TIMEOUT`, and kills the browser.

### 2.4 Probe data

The shim measures elements tagged `data-cut-id="<id>"` after each `seek`. `ProbeItem` is the canonical shape for every stage.

```ts
// Illustrative; coordinates in the component's box, design units
type ProbeItem = {
  id: string; kind: "dom" | "svg" | "canvas";
  rect: [x: number, y: number, w: number, h: number] | null;
  visible: boolean; opacity: number;                // ancestors included
  clipped: "none" | "partial" | "full";             // against the box
  text?: { content: string; family: string; size_px: number;
           line_rects: [number, number, number, number][]; color: string; overflow: boolean };
  fill?: string;                                    // colour of a non-text item
  data?: { value?: number | string; point?: [number, number];
           scale?: { domain: [number, number]; range_px: [number, number]; baseline_px: number } };
};
```

- **Canvas and data.** Canvas components call `cut.mark(id, rect, {text?, data?})` during `seek`. With a `null` rectangle the call attaches `data` to a tagged DOM or SVG element. A chart mark reports its bound value in `data.value` and a chart reports one `scale` item, so R9 can compare plotted values with the dataset. The scale is in the component's own pixel space, like `rect_local`, so camera and layer transforms do not affect R9's K-04.
- **Sidecar.** Each chunk stores a JSON-lines file with one record per item per sampled frame: `{unit, frame, stride, layer, id, kind, rect_local, rect_screen, visible, opacity, clipped, stack_order, text?, fill?, data?}`. The host computes `rect_screen` once, as the item's bounding box under the layer's final matrix, in design units, so it is the same at every rung. It folds layer and group opacity into `opacity` and adds `size_du` (the size after all transforms) beside `size_px`. R9 evaluates the plan's `sync_pairs` predicates (`visible`, `moved`) on these records; `sync_pairs[].layer` uses this same stack path (G5). For every follower layer (2.6) the sidecar also holds one `placement` record per frame: `{unit, frame, layer, matrix}`.
- **Stride.** `probe.stride` is 1, every frame. S4 measured under 1 ms per frame for 20 tagged elements.
- **Strength of evidence.** Containment in a footprint marked conservative and equality of bound text are definitive from probes. Overlap and occlusion are hypotheses until a diagnostic capture confirms them, because probe boxes are rectangles.

### 2.5 The trusted runtime shim

**Provides:** `cut.define`; the message port; seeded `cut.random(key?)` and `cut.noise`; `cut.ease.*`, `cut.lerp`, `cut.clamp`, `cut.mix`; `cut.mark`; error capture; a base style; and three helpers, which are conveniences a component may replace with its own code.

- `cut.ik.two_bone(root, target, len_a, len_b, bend)` solves a two-segment chain such as an arm or a leg. It is pure and returns the joint, the end point, both angles and a `reached` flag. `bend` (`1` or `-1`) picks the side the joint bends to; an unreachable target gives a straight chain pointing at it.
- `cut.sprite(sheet, frame)` returns the source rectangle of one sprite-sheet frame and a `draw(ctx, x, y)` function. `sheet` is `{image, frame_w, frame_h, columns, count}`; `image` is a `data:` image or an atlas the component drew in `prepare`. The sealer inlines small sprite sheets and images as `data:` URLs, up to `component.inline_asset_max_bytes` (2 MB) per sealed component.
- `cut.canvas(w, h)` creates a canvas of `w × h` design units whose backing store is multiplied by `scale` from `init`, capped by `canvas.max_backing_pixels`. In S4, SVG and text under a 2× zoom matched native 2× rendering pixel for pixel, but a canvas was blurry unless drawn at the zoomed resolution.

Sprites and IK need no library (S7: deterministic in Canvas 2D and SVG at about 27 ms per frame).

**Disables or replaces:**

| API | Behaviour under the shim |
|---|---|
| `setTimeout`, `setInterval`, `requestAnimationFrame`, `requestIdleCallback`, `scheduler` | Inert or deleted; `BANNED_API` fault |
| `Date` (constructed, called as a function or reached through `Reflect.construct`), `Date.now`, `performance.now`, `performance.timeOrigin`, `Event.timeStamp`, `document.timeline.currentTime`, `document.lastModified`, `Intl.DateTimeFormat` formatting with no argument | A value derived from the seek time, or a constant; `BANNED_API` note |
| `Math.random`, `crypto.getRandomValues`, `crypto.randomUUID` | The seeded generator, reset before `prepare` and every `seek` |
| `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `Worker`, `RTCPeerConnection`, `open`, `MessageChannel`, `ResizeObserver`, `IntersectionObserver`, `FinalizationRegistry`, `WeakRef`; the clock routes `Temporal`, `File`, `DocumentTimeline`, `Animation`, `AudioContext`, `PerformanceObserver`, `performance.mark`, `measure` and `getEntries*`; the random routes `crypto.subtle` and `URL.createObjectURL` | Removed or disabled |
| Nested frames | Refused or removed by a guard that also covers shadow roots; checked before every acknowledgement; `NESTED_FRAME` fault |
| CSS animations and transitions, SMIL, Web animations | `ANIMATION_RUNNING`, detected with `document.getAnimations()`. Around every `seek`, animations and SMIL are paused at the seek time and transitions are finished |

**After S7.** `frame-src 'none'` and `child-src 'none'` do not stop nested frames, a guard on the document alone is beaten through shadow roots, and replacing `Date` alone leaves other clocks real. The table is the full list recorded in the S7 evidence file; with it, no clock S7 read returned real time.

**What stays nondeterministic.** A tick loop built on self-`postMessage` or image `onerror` counts real time, `navigator.connection.downlink` differs between browsers, and an image created during a render may not be ready. These are lint errors where lint can detect them (2.13). **The shim is a determinism aid, not a guarantee:** the order-independence and repeatability checks (2.13) catch what it misses. Nor is it a security boundary: component code shares its realm, and the boundary is in 2.7.

**Injection.** The *sealer* runs in Node. It concatenates the shim, any declared libraries and the component's code into **one inline script**, and sets `script-src` in the component's Content Security Policy (CSP) `<meta>` to that script's hash. No other script can run, including in a nested frame: in S7 this stopped all 25 nested-frame routes tried. Inline event-handler attributes are a lint error. The sealed document is written into the iframe's `srcdoc`. The shim's hash and each library's hash enter every render work key (R1 §2.4).

### 2.6 The host page

One trusted page stacks, moves, masks and blends layers from different authors, in one capture per frame.

- **Input.** The host's only input is the lowered render unit and its frame packets, which carry each layer's transform, opacity, `mix-blend-mode`, `filter` and mask. It decides nothing.
- **Serving.** CDP `Fetch` interception serves the host from the synthetic origin `https://render.cutroom.invalid` and fails every request except `/host/<hash>` and `/asset/sha256/<hex>`. This is still ASSUMED under frame control (S4 loaded its host from `file://`); the fallback is `Page.setDocumentContent` with `data:` URLs.
- **Host policy.** `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; frame-src 'none'`. The last directive stops a component navigating its own frame (2.7); `srcdoc` frames still load.
- **Layers.** Each layer is an absolutely positioned box, in DOM order for z-order. A component layer holds `<iframe sandbox="allow-scripts" srcdoc="…">` sized to `meta.size`. A *group* is a box with `isolation: isolate`. `host.max_layers` (24) is the starting limit; S4 measured up to 15.
- **Camera per layer.** Node composes each world layer's matrix from the plan's per-frame camera values, `T(W/2, H/2) · S(zoom) · R(−rot) · T(−cx, −cy)`, and the layer's placement and `parallax`. A screen-locked layer gets only its own matrix. The layer's own matrix is `M_layer = T(x, y) · R(rotation) · S(scale) · T(−w/2, −h/2)`, with `x`, `y`, `scale` and `rotation` from the layer's `place` row and `w × h` its box (a component's `meta.size`, a trusted layer's declared `size`, otherwise the canvas), so `transform.x` and `transform.y` place the centre of the box and rotation and scale turn about it. The host sets `transform-origin: 0 0` on every layer box, so the matrix applies exactly as built; while a `follow` leader is in force, the anchor point takes the place of `(x, y)` (decided: `lld/11` section 18, B:O1b). One world container was rejected: world and screen layers could not then interleave in z-order.
- **No `will-change`.** In S4, `will-change: transform` on a zoomed container stretched the old raster, so SVG and text went blurry. The host never sets it, and lint rejects it in components.
- **Masks** are declared in the Render Plan: `clip-path` shapes, or `mask-image` gradients and image assets, including a baked component (2.14). A live component cannot be another's matte.
- **Blend and alpha.** Compositing follows [W3C Compositing and Blending Level 1](https://www.w3.org/TR/compositing-1/) in gamma-encoded 8-bit sRGB. The host background is opaque, so frames carry no alpha.
- **Trusted layers** live in the host document, not in iframes: `media`, `baked`, `caption`, `fill`, `effect`, `cursor` and `placeholder`.
- **The `fill`, `effect` and `Gradient` records** (decided: `lld/11` section 18, A:M1-1 and L7). R2 owns all three. A `fill` has `size` ([w, h] in design units) and either `color`, an sRGB CSS colour string as for a `color` control, or `gradient`. An `effect` has `size` and `backdrop_filter`, a list of the same filter functions `layer.filter` uses. A `Gradient` is `{kind: linear or radial, angle_deg?, stops: [{at, color}]}`, with `at` from 0 to 1; R3's `MaskSpec` gradient uses the same record. A project layer names a `fill` or an `effect` as its `layer.source` (R3), and R4 lowers it to `{kind, params}`.

**Cross-component effects** are expressed at host level: fades, blurs and blends on a group; a trusted `fill` layer with a blend mode for a glow; a baked shape as `mask-image`. S4 confirmed opacity, two blend modes, a gradient mask, a clip path and z-order across sandboxed iframes. A trusted `effect` layer with `backdrop-filter` blurs what is behind a panel; S4 did not test it, so it stays ASSUMED.

**Anchor-follow layers (DECIDED; verified by S7 for a still, unzoomed leader).** A layer's `follow` is a keyed step channel, `channels.follow.leader`: each key names a leader as `{layer, anchor}` or none, so the leader can change at an event and held props and hand-offs need no merged component. The compiler lowers the channel into the unit's per-frame tables, and the host applies the leader in force on each frame: it seeks that leader, reads its probe item named `anchor` (the item's `data.point`, or the centre of its rectangle), places the follower there, seeks the follower, and only then is the frame captured. With no leader in force the layer keeps its own placement. In S7 the follower was at most 0.27 px off in 300 captures, and the extra round trip cost under 0.1 ms per frame. R4 owns the gate `staging.follow_enabled` (default true) and the chain limit `follow.max_depth` (2), and its compiler rejects cycles. Each frame's placement is recorded in the sidecar (2.4). A follower under camera zoom, on a transformed leader or in a chain of two is ASSUMED: `R2-S12` verifies it at build milestone M7, and the fallback is drawing the prop inside the character component.

**Not supported in v2:** a live component as a matte; drawing between another component's internal parts; cast shadows between components. The compiler returns R4's code `CROSS_COMPONENT_EFFECT_UNSUPPORTED` and proposes one merged component.

### 2.7 Sandbox, CSP and network

**Isolation is by origin only.** S4 showed that under BeginFrame control every sandboxed iframe runs in the host's renderer process, and that Chrome refuses to start with `--site-per-process`. No process boundary separates components from each other or from the host. The security boundary is three things outside the page: **no network, no file access, and Chrome's own sandbox**. A slow component therefore blocks the host and every other component, and an exploit of the renderer itself would reach them all, contained only by Chrome's sandbox and the missing network.

**What the origin rules do.** A sandboxed frame without `allow-same-origin` has an opaque origin ([HTML standard](https://html.spec.whatwg.org/multipage/browsers.html)). In S4 the sandbox blocked parent access, storage and cookies, and the component CSP blocked every tested network request. Neither was enough alone: without the CSP every request got through, and without the sandbox storage and parent access worked.

**Component CSP** (the hardened policy S7 tested, minus its unused `media-src` allowance):

```
default-src 'none'; script-src 'sha256-<hash of the one sealed script>'; style-src 'unsafe-inline';
img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none';
child-src 'none'; worker-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'
```

**Two leaks got past the S4 policy; both are closed by design, and S7 confirmed both fixes with the final CSP.**
1. *Self-navigation.* A component set `location.href` to an external URL and the request left. The host's `frame-src 'none'` blocks it: the frame ends on Chrome's error page and the layer times out.
2. *WebRTC.* `RTCPeerConnection` sent STUN packets over UDP. The launch flag `--force-webrtc-ip-handling-policy=disable_non_proxied_udp` stops them; a `webrtc` CSP directive did not.

**The network is also denied below the page.** CDP interception fails every request that is not a known host or asset URL. Chrome runs with no network interface, driven over `--remote-debugging-pipe`; S4 launched it in an empty network namespace without sudo and capture ran normally. Chrome's own sandbox stays on, and `--no-sandbox` is never used. The production VM image must allow that: Ubuntu 22.04 as in WSL, or an AppArmor profile on later releases ([Chromium note](https://chromium.googlesource.com/chromium/src/+/main/docs/security/apparmor-userns-restrictions.md)). R10 records this deployment requirement.

**Threat model.** The realistic threat is a prompt injection in researched web text that makes the authoring model write code that reads local data or calls a server. No network and no file access remove both. S4 and S7 are not security reviews; `file:` URLs and serving by interception remain for `R2-S8`.

### 2.8 The capture engine

**Launch flags** (illustrative; the seven BeginFrame flags are the set S4 ran):

```
chrome-headless-shell --remote-debugging-pipe
  --enable-begin-frame-control --run-all-compositor-stages-before-draw
  --disable-new-content-rendering-timeout --disable-threaded-animation
  --disable-threaded-scrolling --disable-checker-imaging --disable-image-animation-resync
  --force-webrtc-ip-handling-policy=disable_non_proxied_udp
  --force-color-profile=srgb --font-render-hinting=none --hide-scrollbars --mute-audio
  --disable-background-networking --user-data-dir=<fresh temp dir>
env: FONTCONFIG_FILE=<pinned fonts.conf>  TZ=UTC
```

Rendering is software on both machines, as in S1c and S4. The engine runs on Node 26 LTS (decision C5); the spikes ran on Node 22. `puppeteer-core` only launches the browser and opens raw CDP sessions. Temporary directories stay on the Linux filesystem, never under `/mnt/c` (C6).

**CDP sequence per chunk.**
1. Create a browser context and a target with `enableBeginFrameControl: true` (headless shell only, per the [protocol](https://github.com/ChromeDevTools/devtools-protocol/blob/master/pdl/domains/Target.pdl)). Set the viewport to the rung's output size at device scale factor 1 (2.12).
2. Navigate to the host. While components prepare, send `HeadlessExperimental.beginFrame` with `noDisplayUpdates: true` for `capture.warmup_frames` frames.
3. Per frame: evaluate `applyFrame(packet)` and await it; then send `beginFrame` with `frameTimeTicks`, `interval` and `screenshot: {format, quality, optimizeForSpeed: true}` ([protocol](https://github.com/ChromeDevTools/devtools-protocol/blob/master/pdl/domains/HeadlessExperimental.pdl)). `frameTimeTicks` rises by one interval per capture. A reply without `screenshotData` is retried `capture.retry` times.
4. Close the encoder, verify the frame count, store the segment and the sidecar, dispose of the context.

**Pinning Chrome.** `@puppeteer/browsers` installs `chrome-headless-shell@<buildId>` ([docs](https://pptr.dev/browsers-api)). The build is the setting `chrome.build_id`, starting at 157.0.8103.78, which every spike used. Its archive hash is recorded and verified. An upgrade changes every work key and must first pass a qualification run against reference frames.

**Environment hash.** Every input that can change pixels without changing the unit is part of the environment hash, which is in every render work key. R4's D6 refers to this list: the Chrome build (`chrome.build_id`), its launch flags and environment variables; the operating-system image and raster mode; the pinned font files and `fonts.conf`; the shim and host bundle versions; the rung settings bundle (2.9); `capture.warmup_frames`; and `canvas.max_backing_pixels`. The operating-system image is defined by content: the distribution ID and `VERSION_ID`, the glibc version, the raster mode, and the SHA-256 of every shared library that `ldd` resolves for `chrome-headless-shell` under its launch environment. The kernel is recorded for diagnosis but left out of the hash, and no path enters it: a path-valued flag is hashed as a fixed token (`--user-data-dir=<tmp>`), `LD_LIBRARY_PATH` counts through the hashes of the libraries it supplies, and `FONTCONFIG_FILE` through the hash of `fonts.conf`, which names its directories relatively if fontconfig allows it, or else is hashed with the tool-folder path replaced by a token. The qualification run against reference frames stays the safety net for anything left out (decided: `lld/11` section 18, A:env-3).

**Browser pool.** R5 owns the size: `browser.max` (6) and `browser.mem_budget_mb` (950; S4 measured about 920 MB for a browser with 15 components). R2 fixes how a browser is used:
- One page per browser, parallel across browsers (S1: two tabs in one headless window hang).
- A fresh context and page per chunk, a fixed warm-up, frames in order. S4 confirmed why: fresh browsers with the same render history were byte-identical, while a different history changed a few pixels of transformed HTML text (about 82 dB). Comparisons still use a tolerance (R1 §5).
- A browser is recycled after `capture.browser_max_chunks`, on high memory, or after any fault.
- A crash event, a closed pipe, a CDP timeout or the Node watchdog all lead to one action: kill the process group, discard the unfinished chunk, and report a `transient` failure.

### 2.9 Frame transport and encoding

**Intermediates.** JPEG for preview rungs and PNG with `optimizeForSpeed` for the final rung, because JPEG would subsample chroma twice. S4 measured 98–103 ms per PNG frame against 76–79 ms for JPEG q95. Frames reach the encoder through a pipe under operating-system backpressure, with at most `capture.max_buffered_frames` (8) held in memory.

**Chunk artefact.** A rendered chunk is an H.264 segment at its rung's settings, with a closed group of pictures, plus a probe sidecar. Assembly joins segments by stream copy and muxes audio; there is no second video encode. The segment-join check verified this: segments of 150, 90 and 150 frames joined to exactly 390 frames with uniform timestamps, and the same PSNR as a single encode to within 0.001 dB.

**Chunk result.** `chunk.render` takes a frame range, always produces an encoded segment, and returns `{segment, frames, fps, probe_sidecar, rung, diagnostic}`. It is atomic: nothing is stored until the segment is complete. Group jobs expose the ranges of their finished children (R5).

**Stills** are a separate capability, `still.render`: a unit and a frame list in, image artifacts and probe records out, under its own work key.

**Rung settings bundle.** The plan pins a bundle by hash: intermediate format and quality, encoder preset and CRF, colour settings and the encoder version. The hash is in the chunk work key. One bundle per plan also gives every segment the same codec and time base, which the concat demuxer requires ([FFmpeg formats](https://ffmpeg.org/ffmpeg-formats.html)).

**Final-rung encode (illustrative).**

```
ffmpeg -f image2pipe -framerate 30 -c:v png -i pipe:0
  -vf "scale=in_color_matrix=bt709:out_color_matrix=bt709:out_range=limited:flags=accurate_rnd+full_chroma_int,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709"
  -c:v libx264 -preset medium -crf 18 -profile:v high -flags +cgop
  -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709
  -an segment.mp4
```

`film.concat` joins the segments with FFmpeg's concat demuxer and `-c copy`.

**Colour rule.** Frames are 8-bit sRGB. The video is BT.709 matrix, limited range, 4:2:0, with pixel values left sRGB-encoded. FFmpeg converts RGB with the BT.601 matrix unless told otherwise ([ASWF guidelines](https://academysoftwarefoundation.github.io/EncodingGuidelines/Quickstart.html)), so the explicit matrix, range and tag options are mandatory and are always set together: without them batch 2a measured errors of up to 39 levels. Chrome's JPEG frames are BT.601 full range, and preview encodes declare that.

**The chain is VERIFIED by spike (batch 2a, FFmpeg 8.1.1).** On 24 flat colour patches the final chain was at most 1 level of 255 from the source, in FFmpeg and in Chrome, and the JPEG chain at most 2. FFmpeg 8.1.1 left primaries and transfer untagged despite the output options, so the chain ends with `setparams`, and the final-file check reads all four colour fields with `ffprobe`. The transfer tag, `encode.color_trc`, stays `bt709`: `bt709` and `iec61966-2-1` gave identical pixels in FFmpeg and identical Chrome screenshots. A calibration page of colour patches is re-checked whenever the environment changes.

**Audio mux (`film.mux`).** R7 delivers one 48 kHz mix of `round(N·T / flicks_per_sample)` samples. The mux copies the video stream and encodes AAC with FFmpeg's native `aac` encoder (LC profile) at `encode.aac_bitrate_kbps`, with `-movflags +faststart` and without `-shortest`. The encoder and flags are fixed, and the bitrate enters `film.mux`'s work-key parameters (decided: `lld/11` section 18, A:M1-3). The job succeeds whenever FFmpeg exits cleanly and always returns its file. R9's hard checks F-01 and F-02 judge the file: it must have the exact video frame count, and its decoded audio may exceed the mix by at most one AAC frame (1,024 samples). Batch 2a measured the audio offset at 0 samples, also with a video joined from three segments. This depends on the MP4 edit list: a player that ignores it plays audio 21.33 ms late, outside the 15 ms mux tolerance (R1 §1.8), which is a stated limitation.

### 2.10 Fonts

**The set** (pinned by file hash, all under the SIL Open Font Licence 1.1): [Inter](https://github.com/rsms/inter/blob/master/LICENSE.txt); Noto Sans and Noto Serif; [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono); [Noto Sans and Serif CJK](https://github.com/notofonts/noto-cjk/blob/main/Sans/LICENSE); [Noto Sans Arabic and Noto Naskh Arabic](https://github.com/notofonts/arabic/blob/main/OFL.txt); [Noto Color Emoji](https://github.com/googlefonts/noto-emoji); Noto Sans Hebrew, Noto Sans Math and Noto Sans Symbols 2. The licence is ASSUMED for the families without a link.

**Installation.** Fonts are installed through fontconfig, because CJK fonts are far too large to embed in each component. S4 confirmed that a sandboxed component can use an installed font by family name. `FONTCONFIG_FILE` points Chrome at our own `fonts.conf` ([fontconfig manual](https://www.freedesktop.org/software/fontconfig/fontconfig-user.html)), which lists only the pinned font directory, aliases the generic families, and forces greyscale anti-aliasing with hinting off. `@font-face` in a component is a lint error: S4 measured the same font file 1.1 px wider over one line when embedded than when installed.

**Checking.** A component lists families and weights in `meta.fonts`; lint rejects an unregistered family with the canonical code `FONT_UNREGISTERED`. `document.fonts.ready` is not awaited, because installed fonts need no loading. Validation asks Chrome which fonts actually drew the text (`CSS.getPlatformFontsForNode`) and reports a finding on a mismatch, because a missing family falls back silently. `document.fonts.check` cannot be used: S4 saw it report a missing font as available.

### 2.11 The trusted media component

Real images and footage must appear in the same capture at exactly the right source frame. A layer's media arrives as a trusted `media` source, which the compiler lowers from `layer.source`: `{media, crop?, fit}` for an asset, or `{capture, steps}` for a capture session. `fit` is `contain`, `cover` or `fill`, as in R3.

- **Inputs** are prepared assets (C5, R7): stills as 8-bit sRGB images; footage and capture sessions as a *frame set*, a list of `{pts, ArtifactRef}` with the source timebase.
- **Extraction (`media.extract_frames`).** `ffprobe` lists the real presentation timestamps, and FFmpeg decodes the needed range with `-fps_mode passthrough`, which keeps each frame's own timestamp ([FFmpeg manual](https://ffmpeg.org/ffmpeg.html)). Footage is stored as high-quality JPEG, lossless assets (artwork, screen recordings) as PNG. HDR sources fail with `UNSUPPORTED_TRANSFER`.
- **Frame mapping** is the compiler's: for each output frame the plan names the last source frame at or before the mapped source time (R1 §1.7). The host shows that frame as an `<img>` and awaits `img.decode()` before acknowledging. The lowered media source carries `crop` (a rectangle in source pixels), `fit` and the asset mapping. That `crop` is the display crop: the host applies it once, from the plan, and nothing else crops the picture. Transform and anchor positions (R1 §3.4) also come from the plan.

**Rejected.** Seeking a `<video>` element skips frames (HeyGen). Overlaying footage afterwards in FFmpeg breaks z-order, masks and blends.

### 2.12 The preview ladder

| Rung | Output | Frame step | Intermediate | Encode | Use |
|---|---|---|---|---|---|
| `still` | 0.5 → 540 × 960 | chosen frames | JPEG q85 | none | Validation, contact sheets, diagnostics |
| `draft` | 0.5 → 540 × 960 | 2 | JPEG q80 | x264 veryfast, CRF 28 | First preview |
| `review` | 2/3 → 720 × 1280 | 1 | JPEG q90 | x264 fast, CRF 23 | Motion review, Reviewer clips |
| `final` | 1 → 1080 × 1920 | 1 | PNG | x264 medium, CRF 18 | Delivery |

**How a rung is produced.** A window of the output size with `transform: scale(s)` on the host root, not a device scale factor. In S4 a `deviceScaleFactor` of 0.5 or 0.333 left BeginFrame output at 1080 × 1920 with unchanged speed, while the smaller window gave about 41 ms per frame at half size and 30 ms at one third, against 79 ms. The layout stays at design size, so layout and probe values are identical on every rung; only rasterisation differs.

The `still` rung is produced by `still.render` (2.9). With step `k`, frames `0, k, 2k, …` are counted from the render unit's own frame 0, so film position never enters a chunk key. They are sampled at their true times and encoded at `fps/k`, so duration and audio sync are unchanged, and an event may appear up to `k − 1` frames late. A plan carries both a rung and a grade, and every coverage record states both, so a preview is never served as a final (B2.3). Delivery needs grade `final` and rung `final`.

### 2.13 Validation, lint, determinism and repair

**Ladder (cheapest first).** The ladder is a set of functions called by the Quality System's check runner, which executes `check.run` and is the only writer of validation records. Inside an author worker's job (R6 D6.2, D6.3) the repair rounds call the same functions directly, as plain functions, and write no validation records; only the candidate the worker returns is validated through `check.run`, and the worker's result references that one record (K4). Each step returns R1 §5 evidence under the R9 check ID it produces.

| Step | R9 check | What is checked | Type |
|---|---|---|---|
| V0 | C-00 | One HTML document can be extracted, or the repair edits apply | corrective |
| V1 | C-01 | Static lint | corrective |
| V2 | C-02 | Loads alone in the sandbox; `ready` arrives; no faults | corrective |
| V3 | C-03, C-07, C-08 | C-03: seek sweep; console errors are failures. C-07: control response. C-08: frames differ over time | C-03 and C-07 corrective; C-08 observational |
| V4 | C-04 | Determinism rules | corrective |
| V5 | C-05, C-06 | C-05: not blank unless `may_be_blank`. C-06: promised probe IDs present (a missing probe gives `UNKNOWN`), boxes on the canvas and inside the footprint. Also clipping, text overflow, fonts | C-05 corrective; the rest observational |
| V6 | C-09 | Seek and capture time within budget | observational |
| V7 | review rule T1 | One model look at a contact sheet, the same call as R6's visual check; always on and outside the review caps | observational |

- **Sample times (V3).** The start, the end, every event time the request declares, and uniform points up to `validation.sample_times` (8). In S3 six samples missed a short motion and raised a false alarm, so C-08 is observational.
- **Control response (V3, C-07).** Each declared control is driven to its extremes: the picture must change, the control's probe expectation must hold, and the defaults must restore the picture (S6). This includes the optional `hand_l_target` and `hand_r_target` point controls of rigs that use the IK helper.
- **V5 and V7 are part of validation.** In S3 at least 7 of 72 components that passed load and seek were visibly broken. The sheet for a component with controls shows each control at its extremes, because pixel change cannot tell a correct arm from a wrong one (S6: 2 of 5). Acting is judged on a dense strip centred on each event, never on evenly spaced frames (S6).
- Observational findings do not block use (C8).

**Lint rules (all errors).**
- `LINT.EXTERNAL_URL`: a `src`, `href`, `url()` or `@import` that is not `data:` or a fragment.
- `LINT.BANNED_ELEMENT`: nested frames (`iframe`, `frame`, `object`, `embed`, also when created from script), `video`, `audio`, `form`, `base`, `link`, `meta http-equiv`, `script src`, SVG animation elements, and inline event-handler attributes.
- `LINT.BANNED_API`: the APIs in 2.5, `eval`, `new Function`, `import()`, `document.write`, direct use of `parent`, `top` or `postMessage`, `navigator.connection`, creating an image inside `seek`, and `Assets.load` in a component that declares PixiJS.
- `LINT.CSS_ANIMATION`: `animation`, `@keyframes`, `transition`, `will-change`.
- `LINT.META`, `LINT.PROBE_ID`, `LINT.SIZE`: an invalid `cut-meta`; a duplicate `data-cut-id`; source over `component.max_bytes`.
- `FONT_UNREGISTERED`, `LINT.FONT_UNDECLARED`, `LINT.FONT_FACE`: a family outside the registry; one missing from `meta.fonts`; an embedded font.
- `LIBRARY_UNREGISTERED`, `LINT.UNSUPPORTED_API`: a library that is not registered and declared; WebGPU, and WebGL without a declared library that needs it.
- `LINT.CLAIM_BOUND_CANVAS`: the `canvas2d` or `pixi_scene` technique in a component with parameters bound to a claim or dataset. Such a component must use `svg` or `html`, where the shim measures the elements itself.

**Determinism rules (V4).**
1. *Order independence.* A frame revisited after out-of-order seeks matches its first capture at `validation.order_independence_min_psnr_db`. The default of 70 dB lies between the leaky components (46 to 65 dB in S2 and S3) and the clean ones (79 dB or more).
2. *Control purity.* Changing a control and changing it back restores the frame.
3. *Time invariance.* If `time_invariant` is true, frames at different times match.
4. *Repeatability.* A fresh page reproduces a frame at `validation.repeat_min_psnr_db` (S1c and S4 measured 76–83 dB).
5. *Clean run.* No faults, console errors or violations.

**Repair.** R6 owns the one component-author repair loop and its limits: `author.repair_attempts_max` (3, on MiniMax-M3.1-Flash), `author.escalation_attempts` (1, on MiniMax-M3, used only after the Flash attempts are used up, even when a failure signature repeats), `author.candidates` (1) and `author.visual_repair_rounds`. R2 fixes what the loop exchanges with validation:
- **Evidence out:** rule IDs, exact messages, source lines and, for visual findings, a contact sheet.
- **Search/replace first.** A repair is a list of search/replace edits against the failed version. Each search text must match exactly once, or V0 fails with `EDIT_NO_MATCH`. After a second failure the loop asks for a whole document. In S3, edits fixed as many failures as rewrites with about one sixth of the output tokens and one third of the time.
- Every attempt is a new content-hashed version; failures are kept as evidence.

### 2.14 Baking

A layer is bake-eligible only when every effective visual input is constant over the unit: every control value, and its local time unless the component is validated `time_invariant`. Baking happens only when R4's `bake.mode` allows it (default `off`) and the image fits R4's `bake.max_pixels`. The `component.bake` job captures the component alone with a transparent background (`Emulation.setDefaultBackgroundColorOverride`) to a PNG with alpha, at the output scale times the highest camera zoom in use. The host shows it as a `baked` layer under its own work key. The bake equivalence test is a function the check runner calls (2.13): the bake job renders one frame both ways, compares them at `validation.bake_equivalence_min_psnr_db` and returns the comparison result. The check runner writes the validation record from that result (G7). On failure the record disables that bake, and the next compile keeps the live source. Alpha capture under frame control is ASSUMED (`R4-SP6`, at M7).

### 2.15 Captions as a trusted component

Caption text, timing and placement are delivery requirements, not creative code, so one trusted `caption` layer in the host document draws them, normally as the top screen-locked layer.
- **Input** from the plan: cues with start and end in flicks, text, word records `{token, text, start, end, confidence?}`, language and direction; a style given as trusted data (a preset name and parameters), never a component reference; the safe zone. Limits are R7's `captions.*` settings. The compiler has already clipped suppressed intervals out of the cues, so the renderer receives no suppression field; caption sidecar files keep the full cues.
- **Layout** uses real browser layout once in `prepare`: `text-wrap: balance`, and `dir="auto"` with `lang`. Text is copied verbatim.
- **Timing.** A cue is visible on frame `n` when `start ≤ t_n < end`; starts round up (R1 §1.5).
- **Probe.** Every frame reports the active cue, line and word rectangles, font size and colours, so R9 can check safe zone, overlap, contrast, size and reading rate without a model.

Model-authored caption components were rejected: they would re-risk a hard requirement in every film. Kinetic typography uses an ordinary component that receives word timings as `params`.

### 2.16 Diagnostic capture modes

Probe boxes over-estimate overlap, so R9 needs pixel evidence. Three modes are requested per capture through a `diagnostic` parameter on `chunk.render` or `still.render`:
- **Isolate one layer.** The host hides every other layer.
- **Hide one element.** The shim hides the element with the given `data-cut-id` after every `seek`.
- **Tint one element.** The shim paints every pixel of that element in one flat key colour, so R9 can count how much of it is visible in the composite.

The parameter changes the work key, and every chunk result carries `diagnostic` (true or false). `film.concat` and `film.mux` reject a diagnostic segment with `DIAGNOSTIC_IN_DELIVERY`, and the `final` rung refuses the parameter, so a diagnostic capture can never appear in a delivery render. **Limit:** hide and tint act on DOM and SVG elements. A Canvas mark has no element, so the request returns `DIAG_UNSUPPORTED` and the check records `UNKNOWN`. Layer isolation works for every technique. The modes are untested (`R2-S12`).

---

## 3. Interfaces to other stages

| Stage | R2 needs | R2 provides |
|---|---|---|
| **R3** | `component` entities with a full copy of `meta`; `library` and `font` records | The `meta`, control and `ProbeItem` shapes |
| **R4** | Lowered render units with per-frame tables, chunk ranges, the rung and its settings bundle | Probe sidecars; chunk results; the bake job; the environment-hash list (2.8) |
| **R5** | `browser.max`, `browser.mem_budget_mb`, `pixi.unit_browsers`; retry by failure class | Capabilities `component.validate`, `chunk.render`, `still.render`, `component.bake`, `media.extract_frames`, `film.concat`, `film.mux`; the hashes of Chrome, flags, FFmpeg, shim, host bundle and fonts for the work key |
| **R6** | The author loop and its `author.*` settings | The ladder behind `component_author`; the edit-application rule |
| **R7** | Prepared media and capture sessions; the audio mix; caption cues and style data | Frame extraction; burnt-in captions; the `cursor` layer |
| **R9** | Check IDs and thresholds; its check runner | The ladder and the bake equivalence test, as functions that runner calls; probes with `data` payloads, per-frame notes, contact sheets and clips at a stated rung, diagnostic captures |
| **R10** | — | The requirement that Chrome's sandbox stays on in production |

---

## 4. Failure handling

| Failure | Detection | Class (R1 §4.3) | Response |
|---|---|---|---|
| Lint, load, seek or determinism failure | Ladder V0–V4 | `deterministic` | Repair loop (R6); never retried unchanged |
| Component hangs | Node watchdog | `deterministic` once reproduced | Kill the browser; attribute by running layers alone |
| Browser crash or out of memory | CDP crash events, closed pipe (`BROWSER_CRASHED`) | `transient` | Retry on a new browser; a second failure at the same frame is `deterministic` |
| Network or navigation attempt | Interception log, CSP event, a layer that stops answering | `policy` | The component fails validation; a security note goes to the Director |
| Unregistered font or library, hand-written WebGL, HDR footage | Lint, extraction | `capability` | Typed diagnostic; the Director changes approach |
| Encoder fails or the frame count is wrong | Exit code (`ENCODE_FAILED`), `ffprobe` (`FRAME_COUNT_MISMATCH`) | `transient`, then `deterministic` | Re-render that chunk only (C7) |
| Final MP4 lacks audio or has the wrong length | F-01 and F-02 on the exported file (C9) | none: the `film.mux` job succeeded | The Quality System quarantines the result, which allows one re-run of the mux only; a second failure leaves the state `blocked` with the diagnostic |
| Bake differs from the live component | The bake equivalence test, called by the check runner | none; a validation fact | That bake is disabled; the next compile keeps the live source |
| Probe box outside the declared footprint | C-06 | none; an observational finding | Diagnostic with frame and region; the preview is kept |

---

## 5. Named settings and defaults

R2 owns the settings below. `capture.*` is R2's frame capture only; R5's `capture_browser.*` and R7's `screen_capture.*` are separate namespaces.

Override authority and ranges follow the shared rule in R3 §2.7 (G15); rows requiring `human` authority are marked below.

| Setting | Default | Basis |
|---|---|---|
| `chrome.build_id` | 157.0.8103.78 (`human`) | S1c, S4 |
| `host.max_layers` | 24 | S4 measured 15; `R2-S10` |
| `capture.browser_max_chunks` | 20 | Guess |
| `capture.warmup_frames` | 10 (`human`) | The count S4 ran with; in the environment hash |
| `capture.max_buffered_frames` | 8 | Guess |
| `capture.init_timeout_ms`, `capture.seek_timeout_ms`, `capture.cdp_timeout_ms` | 5,000, 2,000, 30,000 | Guess |
| `capture.seek_soft_ms`, `capture.retry` | 50, 2 | Guess |
| `probe.stride` | 1 | S4: under 1 ms per frame |
| `component.max_bytes` | 512,000 | S3 documents averaged 9.7 KB |
| `component.inline_asset_max_bytes` | 2 MB | Decided; no measurement |
| `canvas.max_backing_pixels` | 16,000,000 (`human`) | Guess; in the environment hash |
| `validation.sample_times` | 8 | S3 |
| `validation.order_independence_min_psnr_db`, `validation.repeat_min_psnr_db` | 70, 50 | S2, S3; S1c, S4 |
| `validation.blank_min_coverage` | 0.5% of pixels | The value S3 used |
| `validation.bake_equivalence_min_psnr_db` | 45 | Guess |
| `rung.<name>.*` (scale, step, intermediate, quality, preset, CRF) | Table in 2.12 | S1, S1c, S4 |
| `encode.color_trc` | `bt709` (`human`) | Batch 2a: the same pixels as `iec61966-2-1` |
| `encode.aac_bitrate_kbps` | 192 (range 128–320) | Batch 2a and spike M1 used it, and R7's −3.0 dBTP ceiling was set against the true-peak rise measured at it; in `film.mux`'s work key (decided: `lld/11` section 18, A:M1-3) |

**Owned elsewhere and used by name:** `chunk.max_frames`, `chunk.frames`, `chunk.min_frames`, `bake.mode`, `bake.max_pixels`, `staging.follow_enabled`, `follow.max_depth`, `pixi.max_per_unit` (R4); `browser.max`, `browser.mem_budget_mb`, `pixi.unit_browsers` (R5); `author.repair_attempts_max`, `author.escalation_attempts`, `author.visual_repair_rounds`, `author.candidates` (R6); `captions.*` (R7).

---

## 6. Cross-domain check

| Domain | How R2 serves it | Limit or failure traced |
|---|---|---|
| **Historical comedy** | The character is a component with acting controls; reactions are control tracks (S6) | A held prop is a layer that follows the hand's anchor |
| **Science documentary** | The media component shows footage at the source frame the plan names | Replacing wrong footage changes only the work keys of chunks that show it |
| **Art history** | Artwork is stored losslessly; anchors come from the plan | A crop change moves anchors by recomputation |
| **Software tutorial** | Capture sessions map by real timestamps; lossless frames; a trusted `cursor` layer | 4:2:0 softens small coloured text |
| **Data reel** | Exact values enter as `params`; marks report `data.value` and a `scale` item | A corrected figure changes `params` and the work key, not the styling code |
| **Abstract motion graphics** | Seeded random and noise; blend modes and group effects | Shaders only through PixiJS, which is slower than Canvas 2D under software rendering |

---

## 7. Decisions that differ from the first working draft

Section 2 states each one; the cross-stage ones are recorded in the [integration decisions](11-integration-decisions.md).

---

## 8. Claims table

| Claim | Label | Evidence, or what breaks |
|---|---|---|
| BeginFrame is 1.3–1.9× faster than screenshots | VERIFIED by spike | S1c |
| Models obey the component rules; 90% pass at once and 100% after two repairs; search/replace repairs match rewrites; at least 7 of 72 passing components were visibly broken | VERIFIED by spike | S2, S3 |
| Controls plus a control track give acting that one-shot components did not | VERIFIED by spike | S6 |
| Acknowledge-then-BeginFrame is frame-exact across sandboxed iframes, at about 33 / 50 / 80 ms per frame and 920 MB for 1 / 5 / 15 components; probes cost under 1 ms | VERIFIED by spike | S4: 0 of 900 wrong, 299 of 300 without waiting; components written by the spike agent |
| The iframes share the host's renderer under BeginFrame control. Sandbox and component CSP block the tested attempts; host `frame-src 'none'` and the WebRTC flag close the two leaks; Chrome runs in an empty network namespace | VERIFIED by spike | S4, for the attempts listed there |
| Compositing works across iframes; SVG and text stay sharp under zoom and Canvas needs a scaled backing store; `will-change` blurs; rungs work by window size, not device scale factor; PNG costs 98–103 ms and JPEG q95 76–79 ms per frame; same-history browsers are byte-identical; an installed font works by family name | VERIFIED by spike | S4 |
| Segments join by stream copy without seam defects | VERIFIED by spike | Segment-join check, FFmpeg 8.1 |
| PixiJS 8.23.0 runs sandboxed with no CSP change: 0 wrong frames in 2,100 random-order captures; byte-identical on re-seek, across fresh browsers and histories; pixel-identical to native drawing under a 2× zoom; slower than Canvas 2D in every comparison | VERIFIED by spike | S7 part A; software rendering, one machine |
| One hashed inline script stops script in nested frames; with the full override list no real clock was reachable; the two S4 leak fixes hold; anchor-follow is at most 0.27 px off in 300 captures | VERIFIED by spike | S7 parts B and C, for the attempts listed there; untransformed leader, no chain |
| The override list is complete; lint catches every tick loop; PixiJS holds over long renders | ASSUMED | Not tested. If false: only the determinism checks catch the drift |
| Interception serves the host and assets under frame control, with `img-src 'self'`; `file:` URLs are closed | ASSUMED, critical | `R2-S8`. If false: `setDocumentContent` and `data:` URLs; the missing network interface still stops delivery |
| `backdrop-filter` and group filters work across iframes; the diagnostic modes work; anchor-follow holds under camera zoom, on a transformed leader and in a chain of two | ASSUMED | `R2-S12`, the follow cases at M7. If false: fewer effects; probe-only findings stay hypotheses; the prop is drawn inside the character component |
| A reused browser matches a fresh one; 24 layers and long chunks behave like the measured cases | ASSUMED | `R2-S10`. If false: one browser per chunk; a lower `host.max_layers` |
| The encode chain keeps flat colours within 1 level of 255; both transfer tags give identical pixels; the mux offset is 0 samples, also across joined segments | VERIFIED by spike | Batch 2a, FFmpeg 8.1.1; flat patches, one decoder, Chrome 157 |
| Players honour the MP4 edit list; colour holds in other players | ASSUMED | Not measured. If false: audio 21.33 ms late; a colour shift |
| A private `fonts.conf` hides system fonts; `--font-render-hinting=none` stabilises text | ASSUMED / SECONDARY | `R2-S9`. If wrong: text differs between machines |
| Alpha screenshots work under frame control; a bake equals the live component | ASSUMED | `R4-SP6`, at M7. If wrong: no baking |
| `beginFrame` parameters; frame control is headless-shell only; FFmpeg's BT.601 default, `-fps_mode passthrough` and concat rules; `FONTCONFIG_FILE`; Ubuntu 23.10+ needs an AppArmor profile for Chrome's sandbox | VERIFIED by source | Links in 2.7–2.11 |
| Font licences are OFL 1.1 | VERIFIED by source for the linked families; ASSUMED for the rest | Licence files in 2.10; check the rest before bundling |
| HyperFrames and Remotion licences, release rate and capabilities | VERIFIED by source | [HyperFrames](https://github.com/heygen-com/hyperframes), [changelog](https://hyperframes.heygen.com/changelog); Remotion [pricing](https://www.remotion.dev/docs/license/pricing), [licence](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md) |

---

## 9. Spikes wanted

These are R2's own spikes; bare `S1`–`S7` are the lead's. `R2-S7` (colour and mux) is not the lead's S7 and is closed by batch 2a.

| Spike | Claim | Method |
|---|---|---|
| **`R2-S8`** containment and serving | No remaining route to the network or files; interception can serve the host | With the host served by interception in an empty network namespace, a component tries `file:` URLs and repeats S7's navigation attempts |
| **`R2-S9`** fonts | A private fontconfig gives identical text on two machines | Render Latin, CJK, Arabic, Hebrew and emoji on WSL and a clean container; compare pixels and reported fonts |
| **`R2-S10`** pixel history and scale | A reused browser matches a fresh one; 24 layers and long chunks hold | Compare a chunk from a new browser with the tenth chunk of a reused one; run 24 layers for 1,500 frames |
| **`R2-S11`** media | Timestamp mapping is exact on variable-rate input | At M9, extract a recording with burnt-in frame numbers at speeds 1, 0.5, 0 and −1; baking is tested by `R4-SP6` at M7 |
| **`R2-S12`** follow, diagnostics, backdrop, assets | Anchor-follow holds under camera zoom, on a transformed leader and in a chain of two; the diagnostic modes work; `backdrop-filter` composites across iframes; a larger prepared asset loads from the host's asset origin | At M7, S7's follow test under camera zoom, with a transformed leader and with a chain of two. At M1 and M6 as assigned in R10, hide, isolate and tint against known pixels; a backdrop blur over two iframes; a sprite sheet served from the asset path |

---

## 10. Open questions

**Larger prepared assets.** Small sprite sheets and images are inlined up to `component.inline_asset_max_bytes` (2.5). Loading a larger prepared asset from the host's asset origin would need the component CSP to admit that path. It stays an open item, pending `R2-S12`.

## 11. Decisions for the user

One item in section 9 of the [integration decisions](11-integration-decisions.md) touches this stage: **AI-content labelling of exports (item 4).** The user decided it on 15 November 2026 (section 17 of the integration decisions). There is no embedded C2PA signing (U7), so no signing step is added after `film.mux`. There is no visible on-screen notice by default (U10); a film may switch it on through `quality_intent.disclosure.visible_notice` (L16). The notice is then a trusted screen-locked layer, and until that layer exists a `final` compile with the switch on reports R4's `CAPABILITY_BLOCKED` (decided: `lld/11` section 18, L16 and C:M6-O7b).
