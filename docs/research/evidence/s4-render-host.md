# S4 — Render host spike: sandboxed iframe components captured with BeginFrame

Date: 2026-11-14. Throwaway measurement spike. The spike code and `~/cutroom-spikes` were deleted afterwards; only these results are kept.

## Headline findings

1. **Speed.** One browser, 1080×1920 JPEG: 1 component about 31–34 ms per frame, 5 components 47–52 ms, 15 components 80–83 ms in the two dedicated runs (73–83 ms across every run of that page in the session). Four browsers in parallel on the 15-component page: 29–30 ms per frame effective.
2. **The iframes cost little.** Against the same 15 components in one document (shadow roots), the iframes add a consistent 7–8 ms per frame in the seek/acknowledge step and nothing measurable in capture, plus about 40 MB of memory.
3. **The iframes are not process-isolated.** With BeginFrame control, Chrome runs every sandboxed iframe in the same renderer process as the host page, and refuses to start with `--site-per-process`. Isolation is by origin rules only (which did hold in every test), not by a process boundary.
4. **Ack-then-BeginFrame is frame-exact:** 0 wrong captures in 900 random-order captures. Without waiting for acks, 299 of 300 captures were wrong, and they were torn (some components new, some old).
5. **Two network leaks get past the component CSP:** a component can navigate its own frame to an external URL, and can send WebRTC STUN packets over UDP. Both were closed in tests (host-page `frame-src 'none'`; a Chrome launch flag; or running Chrome in an empty network namespace).
6. **The runtime shim works for the six named functions but is trivially bypassed** (`new Date()`, `crypto.getRandomValues`, and above all a nested `srcdoc` iframe, which gets untouched timers and clocks).
7. **`deviceScaleFactor` emulation has no effect on BeginFrame output.** Smaller previews need a smaller window plus a host-side scale (41 ms per frame at 0.5, 30 ms at 0.333), or the `--force-device-scale-factor` launch flag (0.5 worked, 0.333 did not).
8. **Chunk seam is not bit-exact but is invisible:** PSNR 81.95 dB between browser A's and fresh browser B's frame 150 (133 of 2,073,600 pixels differ). The cause is that Chrome's output depends slightly on which frame was rendered before; with identical history two browsers were byte-identical.

## Setup

| Item | Value |
|---|---|
| Machine | Ryzen 7 5800H (8 cores / 16 threads), WSL2 Ubuntu 22.04.5, kernel 6.18.58.1-microsoft-standard-WSL2, about 11.7 GB RAM |
| Chrome | chrome-headless-shell 157.0.8103.78 (`HeadlessChrome/157.0.8103.78`), launched by puppeteer-core 25.17.0 with `headless: 'shell'` |
| Node | v22.23.5 |
| FFmpeg | N-128889-g88c46fce27-20261113 (BtbN static linux64 GPL build) |
| Rendering | Software only. Chrome reported `gpu_compositing: disabled_software`, `rasterization: disabled_software`, GL via SwiftShader. No GPU was used. |
| Other | pngjs 7.0.0 for PNG decoding; no sudo used |

Launch flags: `--enable-begin-frame-control --run-all-compositor-stages-before-draw --disable-new-content-rendering-timeout --disable-threaded-animation --disable-threaded-scrolling --disable-checker-imaging --disable-image-animation-resync`. The page was created with `Target.createTarget({enableBeginFrameControl: true})` and captured with `HeadlessExperimental.beginFrame` (`interval` 1000/30, strictly increasing `frameTimeTicks`, `optimizeForSpeed: true`).

### What was rendered

- **Host page**: 1080×1920, loaded from a `file://` URL, dark blue background, a `#world` container holding the components.
- **Components**: each is a full HTML document passed by `srcdoc` to an `<iframe sandbox="allow-scripts">`, with the CSP below in a `<meta>` tag, the shim script first, a transparent background, and a render function that is a pure function of the frame number. Four kinds, repeated in this order:
  1. **SVG character**, about 150 SVG nodes, two Gaussian-blur filters, about 40 attribute changes per frame; iframe 540×960.
  2. **Canvas particles**, 400 circles on a 1080×1920 canvas; iframe full frame.
  3. **HTML caption**, 12 words with karaoke highlight, text shadow, small scale and rotation each frame; iframe 1000×210.
  4. **Moving shapes**, 12 gradient divs with rotation, some with box shadows; iframe full frame.
- "1 component" = one SVG character. "5" = character, particles, caption, shapes, character. "15" = 4 characters, 4 particle layers, 4 captions, 3 shape layers, all overlapping.
- **Protocol**: Node calls the host; the host posts `seek` to every iframe; each shim calls the component's render function and posts an `ack`; when every ack is in, Node sends one BeginFrame with a screenshot.

### How time was measured

Per frame = **seek** (the Node-to-host call that posts to all components and waits for all acks) + **capture** (one BeginFrame with screenshot, including moving the image to Node as base64). Each configuration used a fresh browser, 10 uncounted warm-up frames, then 300 frames in order. JPEG quality 90. Frames were not written to disk in the timing runs. The same configuration varied by up to about ±5 ms per frame from run to run: the 15-iframe page gave between 73 and 83 ms across all runs in the session. The variation is in the capture step; seek times repeated to within about 1 ms.

Memory is the sum over the browser process and all its descendants, read from `/proc` at the end of the 300 frames (samples every 50 frames never exceeded the final value). RSS counts shared pages once per process, so it overstates the total; PSS shares them out and is the fairer figure. Both are given.

### Exact component CSP

```
default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'
```

## A. Speed versus component count

One browser, sandboxed iframes, JPEG q90, 1080×1920, 300 frames. Two separate runs each.

| Components | ms per frame (run 1 / run 2) | Seek mean | Capture mean | Capture p95 | Processes | RSS | PSS |
|---|---|---|---|---|---|---|---|
| 1 | 33.9 / 30.8 | 2.4 / 2.3 | 31.5 / 28.5 | 34.9 / 30.1 | 8 | 575 MB | 239 MB |
| 5 | 52.5 / 47.0 | 4.6 / 4.0 | 47.9 / 43.0 | 53.4 / 45.9 | 8 | 718 MB | 344 MB |
| 15 | 83.3 / 80.3 | 11.4 / 11.0 | 71.8 / 69.3 | 81.6 / 75.5 | 8 | 921 MB | 462 MB |
| 15, every iframe made full-frame 1080×1920 | 78.9 / 80.2 | 10.4 / 10.6 | 68.5 / 69.6 | 73.2 / 74.6 | 8 | 948 MB | 476 MB |

- No missing screenshots and no component errors in any run.
- Other runs of the same 15-component page later in the session gave 78.9 and 80.5 ms, and 73.2–81.1 ms in the probe test's probes-off rounds (section H). Treat the figure as 73–83 ms.
- The 8 processes are: 1 browser, 3 zygotes, 1 GPU process, 1 utility (network) process, 2 renderers. One renderer belongs to the blank tab Chrome opens at launch; the host page **and all of its iframes** share the other. The process count did not change with the number of components.
- Making every iframe full-frame instead of sized to its content did not change speed measurably and cost about 27 MB more RSS.

**Parallel browsers, 15-component page, 300 frames per browser:**

| Browsers | Effective ms per frame (wall time / total frames) | Each browser's own ms per frame | Processes | RSS | PSS |
|---|---|---|---|---|---|
| 2 | 46.8 | 92–94 | 16 | 1,833 MB | 785 MB |
| 4 | 29.4 and 30.5 (two runs) | 115–122 | 32 | 3,614 MB | 1,383 MB |
| 6 | 26.1 | 154–157 | 48 | 5,384 MB | 1,966 MB |
| 8 | 27.1 | 212–217 | 64 | 7,084 MB | 2,486 MB |

Four browsers gives about 2.7 times the single-browser throughput. Six gave a little more; eight was no better than six and used twice the memory of four.

### Process model (found while answering A)

- With BeginFrame control on, the 15 sandboxed iframes produced no extra renderer process and no out-of-process frames, with the host on `file://` and on `http://127.0.0.1`. Adding `--enable-features=IsolateSandboxedIframes` changed nothing.
- Launching with `--site-per-process` failed: Chrome exits with `Frame control is not compatible with --site-per-process switch.`
- Control without the BeginFrame flags: still 2 renderers by default; with `--site-per-process`, 3 renderers (one extra shared by the sandboxed frames).

So in this capture mode the sandbox is an origin boundary inside one process, not a process boundary. A slow component blocks the host and every other component, and all components share one main thread.

## B. Iframes versus same document

Same 15 components mounted in one document, each in a closed shadow root, no iframes, no CSP, no shim.

| Mode | ms per frame (run 1 / run 2) | Seek mean | Capture mean | RSS | PSS |
|---|---|---|---|---|---|
| 15 in sandboxed iframes | 83.3 / 80.3 | 11.4 / 11.0 | 71.8 / 69.3 | 921 MB | 462 MB |
| 15 in one document | 75.3 / 75.4 | 3.1 / 3.1 | 72.2 / 72.3 | 882 MB | 430 MB |
| 5 in iframes | 52.5 / 47.0 | 4.6 / 4.0 | 47.9 / 43.0 | 718 MB | 344 MB |
| 5 in one document | 45.7 / 49.3 | 1.9 / 2.1 | 43.8 / 47.2 | 700 MB | 328 MB |
| 1 in an iframe | 33.9 / 30.8 | 2.4 / 2.3 | 31.5 / 28.5 | 575 MB | 239 MB |
| 1 in one document | 32.5 / 31.6 | 2.2 / 2.2 | 30.3 / 29.4 | 573 MB | 238 MB |

- **Cost of the iframes at 15 components: a consistent 7–8 ms per frame in the seek step (about 10%), and about 40 MB RSS (32 MB PSS).**
- Seek was 9.9–11.4 ms with iframes against 3.0–3.4 ms without, in every run, roughly 0.5 ms per component per frame for the message round trip. Capture time is the same within noise.
- Totals are noisier than that: three paired runs differed by 8.0, 4.9 and 0.2 ms, because capture time moves by a few ms between runs. Across the session the same-document page ranged from 73 to 80 ms and the iframe page from 73 to 83 ms.
- With 4 browsers in parallel the same-document page gave 29.4 ms per frame effective, the same as the iframe page (29.4 and 30.5).
- The two modes produce almost the same picture: PSNR 57.2 dB between an iframe frame and the same-document frame.

## C. Stale-frame check

Each of the 15 components drew the frame number as a row of 10 black/white squares using its own technology (SVG rects, canvas `fillRect`, HTML divs). 300 frames were sought in a seeded random order, captured as PNG and decoded with pngjs. A capture is wrong if any of the 15 rows reads a different number from the frame requested.

| Run | Captures | Wrong captures | Notes |
|---|---|---|---|
| Ack then BeginFrame, order 1 | 300 | **0** | |
| Ack then BeginFrame, order 2 | 300 | **0** | |
| Ack then BeginFrame, each component made 8 ms slow | 300 | **0** | 230 ms per frame |
| Same-document, no iframes | 300 | **0** | |
| **No ack**: post seek, BeginFrame immediately | 300 | **299** | Every wrong capture was torn. Typical capture: 2 components showed the new frame, 13 still showed the previous one. 2,949 of 4,500 component readings wrong. |
| No ack, each component made 8 ms slow | 300 | **300** | Typical capture: 1 component new, 14 old. One capture had squares not yet drawn at all. |

The check can fail and does fail without acks, so the zero for the ack protocol is meaningful. One BeginFrame after the last ack was enough for SVG, canvas and HTML content alike.

## D. Isolation

Tested from inside a component with the design settings (`sandbox="allow-scripts"`, no `allow-same-origin`, the CSP above). A local HTTP/WebSocket server and a UDP socket on `127.0.0.1` recorded whatever actually arrived. The component's origin was `null`.

| Attempt | Result | How it is stopped |
|---|---|---|
| `fetch` to the local server and to `https://example.com/` | Blocked, nothing reached the server | `TypeError: Failed to fetch`; CSP violation `connect-src` |
| `XMLHttpRequest` | Blocked | error event, status 0; `connect-src` |
| External image (`new Image().src`) | Blocked | error event; `img-src` |
| CSS `background: url(external)` | Blocked | `img-src` |
| External `<script src>` / stylesheet | Blocked | error events; `script-src-elem` / `style-src-elem` |
| `parent.document` | Blocked | `SecurityError: Failed to read a named property 'document' from 'Window': Blocked a frame with origin "null" from accessing a cross-origin frame.` |
| `parent.location.href`, `top.document`, a host global (`parent.seek`) | Blocked | same `SecurityError` wording |
| `localStorage` | Blocked | `SecurityError: Failed to read the 'localStorage' property from 'Window': The document is sandboxed and lacks the 'allow-same-origin' flag.` |
| `sessionStorage` | Blocked | same wording for `sessionStorage` |
| `document.cookie` read | Blocked | `SecurityError: Failed to read the 'cookie' property from 'Document': The document is sandboxed and lacks the 'allow-same-origin' flag.` |
| `document.cookie` write | Blocked | `SecurityError: Failed to set the 'cookie' property on 'Document': ...` |
| `indexedDB.open` | Blocked | `SecurityError: ... access to the Indexed Database API is denied in this context.` |
| `caches.open` | Blocked | `SecurityError: ... Cache storage is disabled because the context is sandboxed and lacks the 'allow-same-origin' flag.` |
| `new WebSocket(...)` | Blocked, no upgrade request reached the server | No exception from the constructor; an error event with `readyState` 3; `connect-src` |
| `EventSource` | Blocked | error event; `connect-src` |
| `navigator.sendBeacon` | Blocked, **but returns `true`** | `connect-src`; nothing reached the server |
| Worker from a blob URL | Blocked | error event; `worker-src` |
| `window.open` | Blocked | returns `null` (sandbox has no `allow-popups`) |
| Form submit to the server | Blocked | `submit()` returns silently; nothing reached the server (sandbox has no `allow-forms`; CSP `form-action`) |
| Nested iframe with an external `src` | Blocked | `frame-src`; nothing reached the server |
| `top.location.href = ...` | Blocked | `SecurityError: ... The current window does not have permission to navigate the target frame to '...'` |
| **Navigating its own frame** (`location.href = 'http://.../selfnav?leak=secret'`) | **NOT blocked. The request reached the server with the query string.** | The component's own CSP does not govern where its frame navigates |
| **WebRTC** (`RTCPeerConnection` with a STUN server address) | **NOT blocked. Three 20-byte UDP packets reached the socket.** | CSP has no control over WebRTC here |

Controls, to show which layer does what:

- **Sandbox but no CSP**: every network request got through (fetch, XHR, image, script, stylesheet, CSS url, WebSocket upgrade, EventSource, beacon, blob worker, nested frame). Storage, cookies, parent access, popups, forms and top navigation stayed blocked. So the CSP is what stops the network, and the sandbox is what stops storage and parent access.
- **CSP but no sandbox attribute**: the network stayed blocked, but `parent.document`, the host's globals, `localStorage`, `sessionStorage`, cookies, IndexedDB, caches and `window.open` all worked.

Closing the two leaks (the host CSP was exercised in four runs, the other measures in one run each):

| Measure | Self-navigation | WebRTC UDP |
|---|---|---|
| Host page CSP `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; frame-src 'none'` | **Blocked.** The frame ended on Chrome's error page and nothing reached the server. The `srcdoc` components still loaded and rendered normally. | Not affected |
| Adding `webrtc 'block'` to the component CSP | — | **No effect.** Chrome logged `Unrecognized Content-Security-Policy directive 'webrtc'` and the packets still arrived. |
| Launch flag `--force-webrtc-ip-handling-policy=disable_non_proxied_udp` | — | **Blocked.** 0 ICE candidates, no packets. |
| Launch flag `--webrtc-ip-handling-policy=disable_non_proxied_udp` (no `force-`) | — | No effect, packets still arrived |
| Shim removes the `RTCPeerConnection` globals | — | Blocked in that document (`TypeError: RTCPeerConnection is not a constructor`). Not tested against the nested-iframe bypass in section E, which would be expected to defeat it. |
| Chrome started in its own empty network namespace (`unshare --user --map-user --map-group --net`, puppeteer `pipe: true`), no sudo | Nothing reached the server | Nothing reached the socket, 0 ICE candidates |

The network-namespace launch worked without sudo and BeginFrame capture ran normally inside it (10 frames, same speed as the other variants). Note the test server was unreachable from inside the namespace by construction, so this shows the launch method works, not an independent proof against every route.

## E. Runtime shim

The shim replaced the six functions with non-writable, non-configurable properties.

| Call inside the component | Result |
|---|---|
| `Date.now()` | Deterministic: `1700000001000` at frame 30, `1700000002000` at frame 60, `1700000001000` again when frame 30 was re-sought |
| `performance.now()` | Deterministic: `1000`, `2000`, `1000` |
| `Math.random()` | Deterministic per frame: the same three values at frame 30 both times (0.0674…, 0.3170…, 0.4918…), different values at frame 60 |
| `setTimeout`, `setInterval`, `requestAnimationFrame` (bare or as `window.setTimeout`) | Throw: `cutroom-shim: setTimeout is disabled; render as a pure function of t` |
| `Date.now = fn` | Throws: `Cannot assign to read only property 'now' ...` |
| `delete Date.now` | Returns `false`; the override stays |
| `Object.defineProperty(Date, 'now', ...)` / `(window, 'setTimeout', ...)` | Throw: `Cannot redefine property` |
| `Performance.prototype.now.call(performance)` | Still the deterministic value |

Ways a component can trivially get round it (each one observed returning real time or real randomness, or firing a callback):

- **Real clock**: `new Date().getTime()`, `Date()`, `Intl.DateTimeFormat().format()`, `performance.timeOrigin`, `performance.mark().startTime`, `new Event('x').timeStamp`, `document.timeline.currentTime`.
- **Real randomness**: `crypto.getRandomValues`, `crypto.randomUUID`.
- **Deferred work after the ack**: `MessageChannel` messages, `scheduler.postTask`, `requestIdleCallback`, Web Animations (`el.animate(...).finished`), and `ResizeObserver` callbacks all fired. (`queueMicrotask` and promises also run, but they finish before the host sees the ack.)
- **A nested `srcdoc` iframe**: a component created `<iframe srcdoc="<script>...">` inside itself. The inner frame had native `setTimeout` (ran three timer ticks), the real `Date.now()` and real `Math.random()`, and passed the values back with `postMessage`. This worked even with `frame-src 'none'; child-src 'none'` in the CSP. This one bypass undoes everything the shim does.

Blocked: reading `Date` from a freshly created empty iframe (`Blocked a frame with origin "null" from accessing a cross-origin frame`), and blob workers (stopped by `worker-src 'none'`).

Conclusion from the measurements: the shim reliably catches accidental use of the six functions. It does not contain a component that is trying to escape it, and the ack protocol alone does not prove a component has finished changing its picture.

## F. Cross-iframe compositing

Two full-frame sandboxed iframes on a white host. A draws a 600×600 square of rgb(200,100,50); B draws one of rgb(100,200,150) overlapping it. The effect was set by the host on B's `<iframe>` element. Pixels were read from PNG captures.

| Effect on the iframe element | Sample | Expected | Got (iframe) | Pass |
|---|---|---|---|---|
| None (B above A) | overlap | 100,200,150 | 100,200,150 | yes |
| `opacity: 0.5` | overlap / B over white | 150,150,100 / 178,228,203 | 150,150,100 / 177,227,202 | yes |
| `mix-blend-mode: multiply` | overlap / B over white | 78,78,29 / 100,200,150 | 79,79,30 / 100,200,150 | yes |
| `mix-blend-mode: screen` | overlap / B over white | 222,222,171 / 255,255,255 | 222,222,171 / 255,255,255 | yes |
| `mask-image: linear-gradient(to right, transparent, black)` | x=550 over A / x=850 over white / x=450 over A | 149,151,101 / 133,212,172 / 158,142,92 | 149,151,100 / 133,212,172 / 159,141,91 | yes |
| `clip-path: inset(0 0 0 550px)` | x=450 (clipped away) / x=650 | A's colour / B's colour | 200,100,50 / 100,200,150 | yes |
| z-order: A `z-index: 2`, B `z-index: 1` | overlap | A's colour | 200,100,50 | yes |
| z-order: A `z-index: 1`, B `z-index: 2` | overlap | B's colour | 100,200,150 | yes |

All 8 cases passed with a largest error of 1 colour level. The same 8 cases in same-document mode also passed (largest error 2). Blending between components in different iframes behaved exactly like blending between ordinary elements.

## G. Camera zoom sharpness

A test component with a black SVG rectangle, circle and triangle, bold text, an HTML rounded box, and the same shapes drawn on a canvas. Reference: the same component drawn natively at 2× (540×960 window with `--force-device-scale-factor=2`, canvas given a 2× backing store). Edge width = number of grey pixels crossing the rectangle's left edge.

| Case | SVG region vs reference | Text vs reference | SVG edge width | Canvas region vs reference | Canvas edge width |
|---|---|---|---|---|---|
| Reference, native 2× | — | — | 1 px (255, 127, 0) | — | 1 px |
| Iframe, `transform: scale(2)` on the world container | **pixel-identical** | **pixel-identical** | 1 px | 30.99 dB | 3 px (255, 207, 111, 48, 16, 0) |
| Same, with the component drawing its canvas at 2× backing store | pixel-identical | pixel-identical | 1 px | **pixel-identical** | 1 px |
| Same, world also has `will-change: transform` (static scale 2) | pixel-identical | pixel-identical | 1 px | 30.99 dB | 3 px |
| Same-document instead of iframe | pixel-identical | pixel-identical | 1 px | 30.99 dB | 3 px |
| Iframe, scale changed 1 → 1.5 → 2 over three captures | pixel-identical | pixel-identical | 1 px | 30.99 dB | 3 px |
| **Iframe, scale changed 1 → 1.5 → 2 with `will-change: transform` on the world** | **30.95 dB (blurry)** | **21.19 dB (blurry)** | **3 px** | 30.99 dB | 3 px |
| `transform: scale(2)` on the iframe element itself | pixel-identical | pixel-identical | 1 px | 30.99 dB | 3 px |

What was observed:

- Vector content and text inside a sandboxed iframe **are re-rasterised sharply** under a host-side `scale(2)`: identical, pixel for pixel, to drawing natively at 2×. This held when the scale changed from one capture to the next.
- Canvas content is a bitmap and is upscaled blurry (3-pixel edge instead of 1) unless the component draws its canvas at the zoomed resolution, in which case it matched the reference exactly. A component would need to be told the zoom to do that.
- `will-change: transform` on the zoomed container is a trap: when the scale then changes, Chrome keeps the old raster and stretches it, so everything goes blurry.
- The HTML box was equally sharp in all cases (hard edge, same number of grey pixels) but sat one output pixel to the left of the reference (edge at x=80 instead of 81). Boxes at fractional positions snap to whole CSS pixels before the transform is applied.

## H. Probes

The shim collected `getBoundingClientRect()` for every `[data-cut-id]` element (20 tagged elements across the 15 components) and included them in the ack. Three alternating rounds of 300 frames each, same page.

| Round | Seek, probes off | Seek, probes to host | Seek, probes also returned to Node | Total ms per frame off / to host / to Node |
|---|---|---|---|---|
| 1 | 10.03 | 10.76 | 10.82 | 75.5 / 73.9 / 73.9 |
| 2 | 9.85 | 10.82 | 10.79 | 73.2 / 74.1 / 73.9 |
| 3 | 9.99 | 10.83 | 10.79 | 74.3 / 74.2 / 73.6 |

- **Probes add about 0.7–1.0 ms to the seek step.** The total per frame changed by −1.6 to +0.9 ms, which is inside the noise: reading the rectangles forces layout early, so the capture step has that much less to do.
- Passing the 20 rectangles on to Node cost nothing measurable.
- An earlier run of the same test agreed (seek +0.4 to +0.8 ms) apart from one noisy round. Same-document mode: +0.7 to +0.9 ms.
- The rectangles a component reports are in its own iframe's coordinates (for example a body at x=131.7, y=345.7 inside an iframe placed at 40, 800; the same element read in same-document mode was at 171.7, 1145.7). The host has to add the iframe's position and any transform.

## I. Fonts

Inter 4.1 (`Inter-Regular.ttf` from the GitHub release zip) was copied into `~/.local/share/fonts`, `fc-cache -f` was run, and a new browser was started. Text: 41 characters at 40 px, measured in a sandboxed component with the shim on.

| Font stack | Width before install | Width after install |
|---|---|---|
| `"Inter", monospace` | 987.38 px (the monospace fallback) | **853.88 px** |
| `"Inter", serif` | 919.66 px (the serif fallback) | **853.88 px** |
| `monospace` | 987.38 px | 987.38 px |
| `"NoSuchFontCutroomXYZ", monospace` | 987.38 px | 987.38 px |
| `"InterEmbedded", monospace` (the same file as an `@font-face` `data:` URL inside the component) | 855.00 px | 855.00 px |

- A sandboxed component **can use a user-installed font by family name**. A browser restart was used after installing.
- `document.fonts.ready` **resolved** in both runs, with `document.fonts.status` `loaded`. It resolved only after the embedded font had loaded.
- A font embedded as a `data:` URL also works under the CSP (`font-src data:`), with no CSP violations and no install.
- The same font file measured 853.88 px when installed and 855.00 px when embedded, a 1.1 px difference over the line. The two routes do not give identical text layout.
- `document.fonts.check('40px Inter')` returned `true` even before the font was installed, so it cannot be used to detect a missing font. Comparing a width against a fallback can.
- The font and its folder were removed afterwards and `fc-cache -f` run again; `fc-list` then showed no Inter.

## J. Preview scale

15-component iframe page, 300 frames.

| Method | Output size | ms per frame | Seek | Capture |
|---|---|---|---|---|
| Scale 1 | 1080×1920 | 80.5 | 11.0 | 69.5 |
| `deviceScaleFactor` 0.5 through `page.setViewport` (CDP device-metrics emulation) | **1080×1920, unchanged** | 79.8 | 11.0 | 68.8 |
| `deviceScaleFactor` 0.333, same way | **1080×1920, unchanged** | 79.0 | 10.9 | 68.2 |
| Launch flag `--force-device-scale-factor=0.5` | 540×960 | 41.6 | 10.9 | 30.7 |
| Launch flag `--force-device-scale-factor=0.333` | **540×960, not 360×640** | 43.1 | 11.3 | 31.8 |
| 540×960 window + `transform: scale(0.5)` on the world container | 540×960 | 41.8 | 11.0 | 30.8 |
| 540×960 window + CSS `zoom: 0.5` on the world container | 540×960 | 40.3 | 10.5 | 29.8 |
| 360×639 window + `transform: scale(0.333)` | 360×639 | 30.6 | 10.7 | 19.9 |
| 360×639 window + CSS `zoom: 0.333` | 360×639 | 30.1 | 10.7 | 19.4 |

- **The question as asked has a negative answer:** setting `deviceScaleFactor` to 0.5 or 0.333 did nothing to the BeginFrame screenshot. The page saw `devicePixelRatio` 0.5, but the frames came out 1080×1920 with the same average size in bytes and the same speed. Applying the override after load gave the same result, and so did same-document mode (78.7 / 76.2 / 76.5 ms).
- Half-size output is reachable two other ways and gives **about 41 ms per frame (roughly half)**. One-third size gives **about 30 ms**.
- The seek step stays at about 11 ms whatever the scale, so it becomes a third of the frame time at one-third scale. Components still do full-size work (the particle canvas still draws 1080×1920).
- Memory at half scale was 833–841 MB RSS, at one-third 819–822 MB, against 918 MB at full size.

## K. PNG versus JPEG intermediates

150 frames of the 15-component page. Each format captured twice (second pass in reverse order).

| Intermediate | Capture ms per frame (pass 1 / pass 2) | 150 frames, seek + capture | Average frame | 150 frames on disk | x264 encode time (3 runs) | MP4 size |
|---|---|---|---|---|---|---|
| PNG | 103.3 / 98.2 | 17.2 s / 16.3 s | 1,476 KB | 216.2 MB | 3.87, 2.92, 2.82 s | 12,609 KB |
| JPEG q95 | 76.1 / 79.2 | 13.1 s / 13.7 s | 555 KB | 81.2 MB | 2.90, 2.90, 2.85 s | 14,342 KB |
| JPEG q100 | 85.2 / 83.4 | 14.4 s / 14.1 s | 1,061 KB | 155.4 MB | 2.91, 3.26, 4.04 s | 13,692 KB |

Encode command: `libx264 -preset medium -crf 18 -pix_fmt yuv420p`, 30 fps. Chrome's JPEGs are 4:2:0 full range (`yuvj420p`).

Quality of the JPEG-sourced MP4s against the PNG-sourced MP4 (FFmpeg `psnr` and `ssim` filters):

| MP4 | PSNR average (Y) | SSIM all (Y) |
|---|---|---|
| From JPEG q95 | 40.63 dB (Y 40.44) | 0.9873 (Y 0.9901) |
| From JPEG q100 | 41.06 dB (Y 40.80) | 0.9886 (Y 0.9908) |

For context, each MP4 against the original PNG frames:

| MP4 | PSNR average | SSIM all |
|---|---|---|
| From PNG | 41.96 dB | 0.98914 |
| From JPEG q95 | 41.47 dB | 0.98833 |
| From JPEG q100 | 41.71 dB | 0.98913 |

And the JPEG frames against the PNG frames before any video encoding: q95 46.52 dB, q100 56.58 dB.

- PNG capture is about 19–27 ms per frame slower than JPEG q95 (24–36%) and makes files 2.7 times larger. Encode time is the same for all three (about 2.9 s for 150 frames).
- At crf 18 the video encode itself loses more than the JPEG step does. Measured against the true frames, the q95 route ends 0.5 dB below the PNG route and the q100 route 0.25 dB below.
- The JPEG-sourced MP4s came out 9–14% larger than the PNG-sourced one.
- This content has four layers of small moving particles, which is hard for a video encoder; the absolute dB figures would differ for calmer content.

## L. Chunk seam

Browser A rendered frames 0–149 and then frame 150. A fresh browser B rendered 150–299, so frame 150 was its first frame. PNG captures.

| Comparison | Result |
|---|---|
| **A's frame 150 vs B's frame 150** | **PSNR 81.95 dB.** Not byte-identical: 133 of 2,073,600 pixels differ, largest channel difference 9 of 255 |
| A's 151 vs B's 151 | 76.03 dB, 136 pixels differ, largest difference 28 |
| A's vs B's 152, 153, 154 | Byte-identical |
| Frame 150 rendered twice in A (after 149, and after 151) | 104.61 dB, 14 pixels differ by 1 level |

A follow-up located the cause:

- Two browsers given the **same history** (120–149, then 150) were **byte-identical**. Two fresh browsers' first frames were also byte-identical. So rendering is deterministic; what varies is the history.
- Frame 150 after 120–149 versus frame 150 as a first frame differs by 133 pixels (81.95 dB). Rendering 149 first in the fresh browser did not remove the difference.
- Testing each component kind alone: SVG characters, canvas particles and shapes were byte-identical whatever the history. **Only the HTML caption differed** (165 pixels, largest difference 3, 89.5 dB). The differing pixels lie along the edges of the caption boxes, which are scaled and rotated a little every frame.
- Same-document mode showed the same effect far more weakly (1 pixel differing by 1 level).

The seam is invisible at 82 dB, but output is not bit-exact across a chunk boundary: a frame's pixels depend slightly on which frames that browser drew before it.

The JPEG q95 captures of 150–154 were byte-identical between A and B, but both browsers had already rendered the same PNG pass immediately before, so they shared the same history. That is not evidence that a real seam is byte-identical in JPEG.

## What failed or surprised

- `deviceScaleFactor` emulation does not affect BeginFrame screenshots (J).
- `--force-device-scale-factor=0.333` produced 540×960, not one-third size (J).
- `--site-per-process` cannot be combined with BeginFrame control, and sandboxed iframes are in-process (A).
- The component CSP does not stop self-navigation or WebRTC, and Chrome 157 does not recognise the `webrtc` CSP directive (D).
- A nested `srcdoc` iframe defeats the shim despite `frame-src 'none'` (E).
- `navigator.sendBeacon` returns `true` when blocked, and `new WebSocket` does not throw when blocked; both fail silently (D).
- `document.fonts.check` reports a missing font as available (I).
- Installed and embedded copies of the same font measure 1.1 px apart (I).
- `will-change: transform` on the zoom container makes zoomed content blurry (G).
- Output depends slightly on render history for transformed HTML text (L).
- Nothing crashed. No run had a missing screenshot or a component error.

## Not measured

- No way was found or tested to stop the nested-iframe shim bypass.
- The shim's removal of `RTCPeerConnection` was not tested against that bypass.
- Self-navigation was tested by `location.href` only (not `<meta refresh>`, `location.replace` or link clicks). DNS prefetch and other side channels were not tested.
- Seam behaviour for a real JPEG-first-frame pair was not isolated (see L).
- Whether the history-dependent pixels can be removed (for example by forcing a full repaint) was not tested.
- More than 15 components, and pages longer than 300 frames, were not run. Memory growth over long renders is unknown.
- Images, video, audio and web fonts loaded over the network inside components were not tested (the CSP forbids them).

## Limits of this test

- One machine, WSL2, **software rendering only**. A machine with a working GPU path could behave differently in speed and possibly in pixels.
- The components are synthetic. Real components may be heavier or lighter; the particle layers in particular make frames large and hard to compress.
- Timing runs kept frames in memory and did not write them to disk. Each figure comes from one or two runs of 300 frames; differences in total time under about 5 ms per frame are noise.
- Frames travelled from Chrome to Node as base64 over the DevTools connection, which is part of the capture time.
- The host was loaded from `file://`. An `http://127.0.0.1` host was checked only for the process model and gave the same result.
- The security tests show what was and was not blocked for the specific attempts listed. They are not a security review, and with all components sharing one renderer process they say nothing about attacks on the renderer itself.
- Chrome version specific: chrome-headless-shell 157. Flag and CSP behaviour may change between versions.

## Cleanup

- `~/cutroom-spikes` was deleted and confirmed gone. No Chrome, Node or FFmpeg processes were left running.
- The Inter font and `~/.local/share/fonts` (created for the test) were removed and the font cache rebuilt.
- Chrome created an empty certificate store at `~/.local/share/pki` during the run; it was removed. Three npm debug logs written by this spike in `~/.npm/_logs` were removed.
- Left in place, created by earlier work today and not by this spike: `~/.npm` (package cache, which this spike added to) and `~/.cache/fontconfig` (rebuilt by `fc-cache`).
- Nothing was installed with sudo.
