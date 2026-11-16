# S7 — PixiJS as a trusted library, shim hardening, anchor-follow

Date: 2026-11-14. Throwaway measurement spike. The spike code and `~/cutroom-spikes` were deleted afterwards; only these results are kept. Setup and protocol are the ones recorded in `s4-render-host.md` (S4), reused unchanged except where stated.

## Headline findings

1. **PixiJS v8 runs inside the sandboxed iframe with no CSP change**, on WebGL 2 through SwiftShader. It needs three things: the `pixi.js/unsafe-eval` add-on inlined beside the bundle, both PixiJS tickers switched off before `init`, and textures made from an `<img>` or a canvas instead of `Assets.load` defaults. WebGPU did not work.
2. **Capture is frame-exact and bit-exact.** 0 wrong frames in 2,100 random-order captures with the ack protocol. Frame 100 was byte-identical on re-seek, across fresh browsers, and with a different seek history.
3. **PixiJS is slower than hand-written Canvas 2D on this machine, not faster.** The 200-sprite scene with one full-frame blur took 178–220 ms per frame in PixiJS against 70–79 ms in Canvas 2D. Without the filter: 57–63 ms against 44–47 ms. At 2,000 sprites: 178 ms against 147 ms. PixiJS also keeps about 9–11 CPU cores busy (SwiftShader), so four parallel browsers gave only 1.5 times the throughput, against 3.1 times for Canvas 2D pages.
4. **Nested frames: the two CSP directives do nothing; a shim guard on the document alone is beaten by shadow roots.** Two things closed every route tried: an extended guard that also covers shadow roots, and (structurally) a `script-src` that lists the hash of one single inline script holding shim + library + component.
5. **A replacement `Date` fixes `new Date()`, `Date.now()` and `Date()`.** It does not fix `performance.timeOrigin`, `document.timeline.currentTime`, event timestamps, `Intl.DateTimeFormat().format()`, `Temporal.Now`, or CSS/SMIL animation progress; each needed its own override. With all of them in place, the only non-repeatable values left were callback loops that count real time (self-`postMessage`, image `onerror`), one `navigator.connection` field, and images created during a render.
6. **Both S4 leak fixes still hold** with the final CSP: 0 navigation requests and 0 UDP packets reached the test server.
7. **Anchor-follow is exact and free.** 0 of 300 captures had the follower more than half a pixel off the leader's anchor (largest offset 0.27 px). The extra round trip added less than 0.1 ms per frame.

## Setup

| Item | Value |
|---|---|
| Machine | Same as S4: Ryzen 7 5800H (8 cores / 16 threads), WSL2 Ubuntu 22.04.5, kernel 6.18.58.1-microsoft-standard-WSL2, about 11.7 GB RAM |
| Chrome | chrome-headless-shell 157.0.8103.78, launched by puppeteer-core 25.17.0 with `headless: 'shell'`; installed with @puppeteer/browsers 3.2.7 (yauzl 3.4.0) |
| Node | v22.23.5 (tarball), npm 10.9.9 |
| PixiJS | pixi.js 8.23.0 from npm. Inlined files: `dist/pixi.min.js` (912,519 bytes) and `dist/packages/unsafe-eval.min.js` |
| Libraries | libnspr4 2:4.35-0ubuntu0.22.04.1, libnss3 2:3.98-0ubuntu0.22.04.5, libasound2 1.2.6.1-1ubuntu1.2, fetched with `apt-get download`, unpacked with `dpkg-deb -x`, used through `LD_LIBRARY_PATH` |
| Other | pngjs 7.0.0. No sudo. FFmpeg was **not** downloaded this time: nothing here needed video encoding, and PSNR was computed in Node from the decoded PNG pixels (all three colour channels) |
| Rendering | Software only. WebGL reported `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`, `WebGL 2.0 (OpenGL ES 3.0 Chromium)`, maximum texture size 8192 |

Launch flags, page creation, BeginFrame call, host page, `postMessage` seek/ack protocol and host-page CSP are exactly as in S4. Output 1080×1920.

Timing method, as in S4: per frame = **seek** (Node call that posts to every component and waits for every ack) + **capture** (one BeginFrame with a JPEG quality-90 screenshot returned to Node). Fresh browser, 10 warm-up frames, then 300 frames in order, frames kept in memory.

**Two shims are named below.** The *S4 shim* replaces the six functions S4 listed. The *final shim* is the hardened one built in Part B. Part A used the S4 shim unless stated; the key Part A checks were repeated with the final shim and final CSP.

**Other load on the machine.** A second, unrelated job was running in the same WSL instance for part of the session. The first two timing batches have no measurement of its effect, and it was seen running during the second of them. For every later timing run the CPU used by processes that were not part of the run was measured; it was never above 0.25 of one core. The tables say which numbers come from which batch, and all runs are shown so the spread is visible.

### Test scenes

- **Main scene** (A2–A5), 1080×1920: 200 sprites cut from an 8-frame 512×64 sprite sheet drawn once on a canvas; every sprite changes position, rotation, scale, opacity and sheet frame each frame; 50 of the sprites sit in a container with one blur filter (strength 4); one bold 72 px text object that moves, rotates and scales; a row of 10 black/white squares showing the frame number in binary. The blurred container's bounds cover almost the whole frame, so the filter works on nearly 1080×1920 pixels.
- **Same scene in Canvas 2D**, written by hand: `drawImage` per sprite, the 50 blurred sprites drawn to an offscreen canvas and composited with `ctx.filter = 'blur(4px)'`, `fillText`, `fillRect`.
- **SVG character**, 540×960, rebuilt to match S4's description: 153 SVG nodes, two Gaussian-blur filters, 40 attribute updates per frame. One alone took 28.8–31.1 ms per frame here against S4's 31–34 ms, so the machine and setup are comparable.
- **"5 components"** = the PixiJS (or Canvas 2D) scene full-frame plus four SVG characters in the four quarters.

## Part A — PixiJS as a trusted library

### A1. Does it initialise, and what does it need?

Yes. Renderer: **WebGL** (`renderer.name` = `webgl`, WebGL 2 through ANGLE on SwiftShader). No extra process appeared; the count stayed at 8.

| Trial (S4 shim, S4 component CSP, S4 host CSP unless stated) | Result |
|---|---|
| Bundle inlined, default options | **Fails**: `Current environment does not allow unsafe-eval, please use pixi.js/unsafe-eval module to enable support.` PixiJS builds shader and uniform code with `new Function`. |
| + `unsafe-eval.min.js` inlined after the bundle | Gets further, then **fails**: `cutroom-shim: requestAnimationFrame is disabled`. PixiJS starts tickers during `init`. |
| + `autoStart: false` only | Fails, same error |
| + `PIXI.Ticker.system.autoStart = false` only | Fails, same error |
| + both of the above | **Works.** Red, green and blurred test shapes read back with the right colours from the capture. |
| `'unsafe-eval'` added to the component CSP only (no add-on) | **Still fails.** A `srcdoc` iframe also inherits the host page's CSP, which has no `'unsafe-eval'`. |
| `'unsafe-eval'` added to both host and component CSP (no add-on) | Works. Not needed, since the add-on avoids it. |
| `preserveDrawingBuffer: true` | Works, but is **not needed**: the default gave 0 wrong frames (A2) and the same speed. |
| Launch flag `--enable-unsafe-swiftshader` | **Not needed in Chrome 157**: WebGL worked without it. Without the flag Chrome logs `Automatic fallback to software WebGL has been deprecated. Please use the --enable-unsafe-swiftshader flag to opt in to lower security guarantees for trusted content.` With the flag: no warning, same renderer string, same speed. `--use-angle=swiftshader` also worked. |
| `preference: 'webgpu'`, no extra flags | Falls back to WebGL. `navigator.gpu` exists but `requestAdapter()` returns `null` (`No available adapters`). |
| `preference: 'webgpu'` with `--enable-unsafe-webgpu --enable-features=Vulkan --enable-unsafe-swiftshader` | **Not usable.** An adapter appeared (`google/swiftshader`) and PixiJS created its WebGPU renderer, but Chrome then logged `WebGPU device was lost and could not be restored` and the BeginFrame returned no screenshot. |
| `preference: 'canvas'` | Works (`renderer.name` = `canvas`, a Canvas 2D renderer inside PixiJS 8.23). **Filters are skipped** with a warning: `CanvasRenderer: filter ... is not supported in Canvas2D and will be skipped.` |
| S4 CSP with `script-src` replaced by a hash of one inline script (Part B) | Works |
| Final shim | Works after one shim change. PixiJS tests `"ResizeObserver" in globalThis` and then constructs one; a shim that leaves the name defined as `undefined` gives `ResizeObserver is not a constructor`. Deleting the property works: PixiJS then falls back to `Ticker.shared`, so `Ticker.shared.autoStart = false` is also required. |

**Loading images** (a 64×64 PNG as a `data:` URL):

| Method | Result |
|---|---|
| `Assets.load(dataUrl)`, defaults | **Never resolves and never rejects.** PixiJS starts a worker from a `blob:` URL; `worker-src 'none'` blocks it and the promise hangs. |
| Same, component CSP relaxed to `worker-src blob:; connect-src data: blob:` | **Still hangs.** The worker is now blocked by the inherited host CSP (`script-src` used as the fallback for `worker-src`). |
| `Assets.setPreferences({ preferWorkers: false })` | Fails: `Failed to fetch`. PixiJS calls `fetch()` on the `data:` URL; `connect-src 'none'` blocks it. Adding `connect-src data:` to the component CSP alone did not help (host `default-src 'none'` is inherited). |
| `Assets.setPreferences({ preferWorkers: false, preferCreateImageBitmap: false })` | **Works, CSP unchanged.** PixiJS loads through an `<img>` element, which `img-src data:` allows. |
| `new Image()`, `await img.decode()`, `Texture.from(img)` | **Works, CSP unchanged** |
| `Texture.from(canvas)` | **Works, CSP unchanged** |

**So the CSP needs no change.** Workers, `blob:` and `data:` fetches are all avoidable by configuration. Allowing them would mean relaxing the host page's CSP as well as the component's, which was not tested further.

**Options that worked** (used for every PixiJS measurement below):

- Before `init`: `PIXI.Ticker.system.autoStart = false` and `PIXI.Ticker.shared.autoStart = false`.
- `app.init({ width, height, backgroundAlpha: 0, autoStart: false, sharedTicker: false, preference: 'webgl', antialias: false, resolution: scale, autoDensity: true })`.
- `init` is asynchronous; the component reported "ready" to the host only after it resolved.
- On each seek: set every property from the seek time, call `app.render()` once, synchronously, then acknowledge.
- Sprite-sheet animation: `new AnimatedSprite({ textures, autoUpdate: false })` and `gotoAndStop(frame)`.

**Component CSP that worked** (unchanged from S4):

```
default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'
```

and the hardened form from Part B, which also worked with PixiJS:

```
default-src 'none'; script-src 'sha256-<hash of the one inline script>'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'
```

Host page CSP (unchanged from S4): `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; frame-src 'none'`

### A2. Is the PixiJS canvas captured correctly?

300 frames sought in a seeded random order, captured as PNG. Every component drew the frame number as 10 squares. A capture is wrong if any row reads another number.

| Run | Captures | Wrong |
|---|---|---|
| Ack then BeginFrame, PixiJS + 4 SVG, order 1 | 300 | **0** |
| Same, order 2 | 300 | **0** |
| Same, `preserveDrawingBuffer: true` | 300 | **0** |
| PixiJS alone | 300 | **0** |
| PixiJS Canvas renderer + 4 SVG | 300 | **0** |
| PixiJS alone, final shim + frame guard + hash CSP | 300 | **0** |
| PixiJS + 4 SVG, final shim + frame guard + hash CSP | 300 | **0** |
| Control, **no ack** (post seek, BeginFrame at once), PixiJS + 4 SVG | 300 | 5 (13 wrong readings, all in SVG components; the frames were torn) |

One BeginFrame after the last ack was enough for the WebGL canvas. No screenshot was missing in any run. The no-ack control failed far less often than in S4 (299 of 300 there); with 5 components the seek usually wins the race. It still shows the check can fail.

### A3. Speed

One browser, 1080×1920, 300 frames. Runs 1 and 2 are the first batch (other load not measured); run 3 was made later with other load measured at under 0.1 core.

| Page | ms per frame, runs 1 / 2 / 3 | Seek mean | Capture mean | CPU cores used |
|---|---|---|---|---|
| 1 SVG character | 29.1 / — / 28.8 | 2.2 | 26.7 | 1.2 |
| 5 SVG characters | 44.9 / — / 41.1 | 2.3–2.6 | 38.8–42.3 | 1.8 |
| **PixiJS scene alone** | **207.6 / 219.9 / 177.7** | 1.9–2.4 | 175.8–217.4 | **10.1** |
| **Canvas 2D scene alone** | **74.2 / 78.7 / 70.2** | 40.6–46.6 | 29.7–32.1 | 1.1 |
| **PixiJS scene + 4 SVG** | **221.2 / 217.2 / 190.3** | 2.5–2.8 | 187.8–218.4 | 9.1 |
| **Canvas 2D scene + 4 SVG** | **91.5 / 90.4 / 81.7** | 41.2–46.7 | 40.5–44.7 | 1.3 |

A further single-browser PixiJS run of 100 frames, with other load measured near zero, gave 213.5 ms. So the PixiJS figure moved between 178 and 220 ms from run to run, and other load does not explain all of that spread; treat it as that range. (The machine is a laptop and PixiJS loads about 10 cores, so heat is a possible cause; this was not checked.)

Where the time goes: PixiJS's cost is all in the capture step (SwiftShader executes the drawing in the GPU process and Chrome then reads the canvas back; Chrome logs `GPU stall due to ReadPixels`). Canvas 2D's cost is in the seek step (the drawing runs in the component's script).

Breaking the scene down (one browser). Where two numbers are given, the first is from the second batch (other load not measured) and the second from a later run with other load measured near zero. Single numbers are from measured runs, except the `antialias` and `--enable-unsafe-swiftshader` rows, which are from the second batch.

| Variant | PixiJS, ms per frame | Canvas 2D by hand, ms per frame |
|---|---|---|
| Full scene (blur over ~full frame) | 178–220 | 70–79 |
| Blur on the text object only | 65.7 | 63.6 |
| Colour-matrix filter in place of the blur | 73.9 / 69.4 | not written |
| No filter (200 sprites + text) | 62.6 / 57.0 | 47.2 / 44.4 |
| Empty full-frame canvas (frame squares only) | 42.1 / 39.5 | 31.7 / 30.5 |
| 2,000 sprites, no filter | 177.9 | 146.8 |
| Same scene on a 540×960 canvas | 83.5 | not run |
| `resolution: 2` (2160×3840 backing store), 100 frames | 297.4 | not run |
| `antialias: true` | 212.4 | — |
| `preserveDrawingBuffer: true` | 199.4 / 187.6 | — |
| `--enable-unsafe-swiftshader` | 199.6 | — |
| PixiJS `preference: 'canvas'` (blur skipped) | 44.6 / 43.0 | — |
| Final shim + hash CSP | 180.6 (S4 shim in the same batch: 177.7) | 69.6 (70.2) |

- The blur filter costs about 120–160 ms per frame in PixiJS and about 26–31 ms in Canvas 2D (difference in the seek step) when it covers the whole frame. Confined to the text object it costs about 9 ms in PixiJS and about 19 ms in Canvas 2D.
- A full-frame WebGL canvas with almost nothing on it costs about 9–10 ms per frame more than a 2D canvas, and about 14–16 ms more than the almost empty component of A8 (25.9 ms).
- The final shim made no measurable difference to PixiJS or Canvas 2D. One SVG character measured 31.1 ms with the final shim against 28.8 ms with the S4 shim in the same session (seek 2.5 against 2.2 ms); one run each, so within the run-to-run spread S4 reported.

**Parallel browsers** (100 frames per browser, other load under 0.1 core):

| Page | 1 browser | 2 browsers, effective | 4 browsers, effective | 4-browser gain | Memory, 4 browsers (RSS / PSS) |
|---|---|---|---|---|---|
| PixiJS scene alone | 213.5 | 149.6 | 139.8 (each 554–559) | 1.5× | 2,997 / 1,141 MB |
| PixiJS scene + 4 SVG | 226.4 | — | 138.6 (each 550–554) | 1.6× | 3,208 / 1,287 MB |
| Canvas 2D scene alone | 73.7 | — | 23.8 (each 94–95) | 3.1× | 2,936 / 1,210 MB |
| 5 SVG characters | 43.5 | — | 14.3 (each 57) | 3.0× | 2,408 / 688 MB |

One PixiJS browser already occupies 9–11 of the 16 hardware threads, so parallel browsers add little.

### A4. Repeatability

Seek sequence in one page: 100, 250, 3, 177, 100, 99, 100, a PNG capture after each. Browsers A and B ran the same sequence; browser C sought frame 100 as its very first frame.

| Comparison | PixiJS alone | PixiJS + 4 SVG | Canvas 2D alone |
|---|---|---|---|
| Same page, frame 100 first time vs after 250, 3, 177 | byte-identical | byte-identical | byte-identical |
| Same page, frame 100 again after 99 | byte-identical | byte-identical | byte-identical |
| Browser A vs fresh browser B, same history (frame 100, three times; frame 250) | byte-identical | byte-identical | byte-identical |
| Fresh browser C (100 as first frame) vs A's later capture of 100 | byte-identical | byte-identical | byte-identical |

Every comparison: same bytes, PSNR infinite, 0 of 2,073,600 pixels differing. No history dependence was seen for these scenes. (S4 found a small history effect for rotated HTML text; none of these scenes contains HTML text.)

### A5. Memory

Browser process tree after 300 frames, 8 processes in every case.

| Page | RSS | PSS | Renderer (host page + iframes) RSS / PSS | GPU process RSS / PSS |
|---|---|---|---|---|
| 1 SVG character | 555–568 MB | 232–234 MB | 122 / 65 | 91 / 50 |
| 5 SVG characters | 633–644 MB | 294–296 MB | 183 / 119 | 106 / 59 |
| **PixiJS scene alone** | **774–788 MB** | **415–417 MB** | 166 / 92 | **264 / 207** |
| Canvas 2D scene alone | 760–773 MB | 422–423 MB | 313 / 249 | 103 / 56 |
| PixiJS scene + 4 SVG | 834–842 MB | 452–459 MB | 206 / 123 | 280 / 215 |
| Canvas 2D scene + 4 SVG | 792–806 MB | 438–439 MB | 328 / 256 | 119 / 65 |
| PixiJS, empty stage | 659–672 MB | 302–303 MB | | |
| PixiJS, no filter | 677–690 MB | 317–319 MB | | |
| PixiJS, `antialias: true` | 860 MB | 487 MB | | |
| PixiJS, `resolution: 2` | 890 MB | 483 MB | | |
| Small PixiJS component (A8) | 628 MB | 291 MB | | |
| Small Canvas 2D / SVG component (A8) | 542–545 MB | 220–223 MB | | |

A full-frame PixiJS component costs about 220 MB RSS (185 MB PSS) over one SVG character, most of it in the GPU process. The hand-written Canvas 2D scene costs about the same total, held in the renderer instead. Runs were 300 frames; growth over long renders was not measured.

### A6. Sharpness under a 2× host zoom

A 540×960 PixiJS component with a black rectangle and circle, bold 40 px text and a 64 px bitmap sprite on white; the host's world container had `transform: scale(2)`. Edge width = number of grey pixels crossing the rectangle's edge.

| Case | Rectangle edge | Grey pixels in the text area | Against reference B |
|---|---|---|---|
| Reference A: 540×960 window with `--force-device-scale-factor=2`, `resolution: 2`, no host zoom | 0 grey px | 1,974 | 29.78 dB, 4,857 px differ (all text) |
| Reference B: no zoom, 1080×1920 canvas, the same content drawn at double size | 0 grey px | 1,836 | — |
| Host zoom 2, `resolution: 1` | **2 grey px (191, 64): blurred** | 5,939 | 33.48 dB, 17,554 px differ |
| **Host zoom 2, `resolution: 2` from the `scale` passed at init** | **0 grey px** | 1,836 | **pixel-identical** |
| Host zoom 2, `resolution: 3` | 0 grey px | 2,100 | 38.52 dB, 4,624 px differ |
| Host zoom 2, resolution changed on each seek with `renderer.resize(w, h, r)`, ending at 2 | 0 grey px | 1,836 | **pixel-identical** |

- With `resolution` equal to the host zoom the output is identical, pixel for pixel, to drawing the content natively at that size. The host transform maps the larger backing store 1:1.
- PixiJS text followed the renderer resolution by itself (its `resolution` read 1, 2, 3) and came out sharp.
- Reference A differs from reference B only in the text. Canvas text is rasterised differently when Chrome's device scale factor is 2; the zoom is not the cause.
- The bitmap sprite showed the same 2 grey pixels in every case, including both references: a bitmap texture does not gain detail.
- Changing the resolution per seek worked and gave the same pixels as setting it at init. Its cost was not timed.
- Cost of oversampling: the main scene at `resolution: 2` took 297 ms per frame against 178–220 ms.

### A7. Sprite-sheet animation and two-bone IK arm: deterministic?

**Yes, in all three technologies.** A 540×960 component with an 8-frame PNG sprite sheet (frame chosen from the seek time) and a two-bone arm solved analytically from the seek time. 60 frames (0, 5, …, 295) were captured in three passes: two different random orders in one page, and a third order in a fresh browser.

| Technology | Wrong frame numbers (180 captures) | Frames not byte-identical, order 1 vs order 2 | Frames not byte-identical, fresh browser vs order 1 |
|---|---|---|---|
| PixiJS (`AnimatedSprite` + `Graphics`) | 0 | 0 of 60 | 0 of 60 |
| Canvas 2D | 0 | 0 of 60 | 0 of 60 |
| Inline SVG | 0 | 0 of 60 | 0 of 60 |

### A8. The same sprite sheet and arm without a library: cost

One 540×960 component on the 1080×1920 host, 300 frames, two runs each.

| Technology | ms per frame | Seek | Capture | RSS / PSS |
|---|---|---|---|---|
| Baseline: a component that moves one small box | 25.9 | 2.1 | 23.8 | 523 / 209 MB |
| PixiJS | 35.2 / 35.1 | 2.4 | 32.7–32.9 | 628 / 291 MB |
| Canvas 2D | 27.5 / 27.6 | 2.7 | 24.8–24.9 | 542 / 221 MB |
| Inline SVG | 27.0 / 27.5 | 2.3 | 24.7–25.1 | 545 / 222 MB |

For a sprite animation and a small rig, Canvas 2D and SVG each add about 1–2 ms per frame over an almost empty component. PixiJS adds about 9 ms, and uses about 85 MB more than the other two.

**When PixiJS was worth it, on these measurements:** in no case measured here. Under software rendering it was slower than the hand-written Canvas 2D version in every pairing (small scene, 200 sprites, 2,000 sprites, with and without blur, alone and beside SVG), used more memory in the small case, and used far more CPU. The one near-tie was a blur confined to a small object (65.7 against 63.6 ms). What PixiJS did offer was filters with no hand-written code (blur, colour matrix) and exact, repeatable output. A machine with a working GPU path was not available and could change this picture completely.

## Part B — shim hardening

### B1. Nested frames

A component tried 25 ways to get a nested frame that runs script, and from inside it read `Date.now()` and started a `setTimeout`. "Reached" means the nested script reported real wall-clock time back to the component.

Ways tried: `createElement('iframe')`; `createElementNS`; `innerHTML`; `insertAdjacentHTML`; `outerHTML`; `DOMParser` + `adoptNode`; `Range.createContextualFragment`; `<template>` content cloned in; `setHTMLUnsafe`; `Document.parseHTMLUnsafe` + `adoptNode`; iframe inside SVG `<foreignObject>`; an XHTML-parsed iframe imported with `importNode`; a customised built-in element extending `HTMLIFrameElement` (in the document, and in a shadow root); `innerHTML` on a closed shadow root; template content appended to a closed shadow root; declarative shadow root through `setHTMLUnsafe` and through `parseHTMLUnsafe`; iframe with a `data:` URL, a `blob:` URL, a `javascript:` URL; `<object>` and `<embed>` with a `data:` URL; a nested `srcdoc` frame that replays the component's own script text; `document.write`.

| Defence | Native clock reached by | Blocked |
|---|---|---|
| None (no frame directives) | **20 of 24**: every `srcdoc` route, the `javascript:` URL iframe, and the replay. With `document.write` a nested frame was also created; the component then stopped answering seeks, so the clock read was not confirmed. | `data:` and `blob:` iframes, `<object>`, `<embed>` (blocked by `default-src` / the inherited host `frame-src`) |
| **(a)** `frame-src 'none'; child-src 'none'` in the component CSP | **20 of 24, exactly the same list.** The directives do not apply to `srcdoc` frames. | the same 4 |
| **(b)** Shim overrides `createElement`/`createElementNS`, the `innerHTML`-style setters and parsers, `document.write`, plus a `MutationObserver` on the document that removes frames | **6**: `innerHTML` on a shadow root, template content appended to a shadow root, both declarative-shadow-root routes, the customised built-in inside a shadow root, and the replay (through a shadow root). A document-level observer does not see inside shadow roots. | the other 18 routes and `document.write` (25 frames removed or refused) |
| **(c)** a + b | **6, the same list as (b)** | as (b) |
| **(b+)** as (b), extended: `ShadowRoot.innerHTML`, `attachShadow` patched so every shadow root is observed, template contents scanned, `setHTMLUnsafe` / `parseHTMLUnsafe` disabled, customised built-ins that extend frame elements refused | **0** | all 25 |
| **(d1)** `script-src` lists hashes instead of `'unsafe-inline'`; shim and component are two inline scripts with two hashes | **1**: the nested frame may run the component's script without the shim, because that script's hash is allowed on its own. | the other 23: frames are created but their scripts are refused |
| **(d2)** `script-src` lists the hash of **one** inline script containing shim + library + component | **0.** Frames can still be created (17 existed), but the only script any of them may run is the whole bundle, shim first. The replayed copy reported the shim's fake time and `setTimeout` threw. | all |
| (d2) + (b+) | **0** | all |

What works:

- **(a) alone does nothing. (b) as specified is not enough. (c) is no better than (b).**
- **(b+) stopped every route tried**, but it is a list of known routes; a route not on the list would get through.
- **(d2) stopped every route tried and does not depend on listing routes**: a nested `srcdoc` frame inherits the component's CSP, so it can run no script other than the hashed bundle. It requires the system to emit shim, library and component code as one inline `<script>` and to compute its hash. It also means a component cannot use inline event-handler attributes, `javascript:` URLs or extra `<script>` elements (the `javascript:` iframe was refused under d1 and d2). PixiJS ran normally under (d2).
- Reading a property of a nested frame's window from the component stays blocked by the sandbox (origins differ), as in S4.

### B2. `new Date()` and the other clocks

Each value was read at frame 30, at frame 60 after a real delay, at frame 30 again, and at frame 30 in a second browser. "Fixed" means the same at frame 30 all three times and changing with the seek.

| Read | S4 shim | + `Date` replaced by a class only | Final shim |
|---|---|---|---|
| `Date.now()` | fixed | fixed | fixed |
| `new Date()` (also `.toISOString()`, `.toLocaleTimeString()`) | **real time** | fixed | fixed |
| `Date()` called as a function | **real time** | fixed | fixed |
| `new (new Date(0).constructor)()`, `Reflect.construct(Date, [])` | **real time** | fixed | fixed |
| `new Date(2020, 0, 1, 12)`, `instanceof Date` | work | work | work |
| `performance.now()` | fixed | fixed | fixed |
| `performance.timeOrigin` | **real time** | **real time** | fixed (constant) |
| `performance.mark().startTime`, navigation timing, `performance.timing` | **real time** | **real time** | removed (throws or `undefined`) |
| `document.timeline.currentTime` | **not fixed** | **not fixed** | fixed |
| `new Event('x').timeStamp` | **real time** | **real time** | fixed |
| Timestamp of the seek `message` event itself | **real time** | **real time** | fixed |
| `new Intl.DateTimeFormat(...).format()` and `.formatToParts()` with no argument | **real time** | **real time** | fixed |
| `Temporal.Now.instant()` | **real time** | **real time** | removed |
| `document.lastModified` | **real time** | **real time** | constant |
| `new File([], 'x').lastModified` | **real time** | **real time** | removed |
| `new DocumentTimeline().currentTime`, `el.animate(...).timeline.currentTime` | **not fixed** | **not fixed** | removed |
| CSS animation progress read with `getComputedStyle` | **not fixed** | **not fixed** | fixed |
| CSS transition progress | **not fixed** | **not fixed** | constant (finished) |
| SVG SMIL: `svg.getCurrentTime()`, animated attribute value | **not fixed** | **not fixed** | fixed |
| `new AudioContext().currentTime` | `suspended 0` every time | same | removed |
| `performance.memory.usedJSHeapSize` | `10000000` every time | same | removed |

- **Replacing `Date` with a class fixes exactly the `Date` routes** (constructor, `now`, call as a function, and reaching the constructor through a prototype). It cannot affect the others.
- `document.timeline.currentTime`, CSS animations, CSS transitions and SMIL do not follow wall-clock time. **They follow the BeginFrame clock**: every value read was an exact multiple or half-multiple of the 33.33 ms BeginFrame interval (for example 0, 733.304 and 1,066.624 ms), which wall-clock time would not produce. So they depend on how many BeginFrames the host has issued, not on the seek time.
- What the final shim does about each: a `Date` function that handles `new`, plain calls and `Reflect.construct`; getters overridden for `Performance.prototype.timeOrigin`, `Event.prototype.timeStamp`, `AnimationTimeline.prototype.currentTime`, `Document.prototype.lastModified`; `Intl.DateTimeFormat` `format` / `formatToParts` given the fake time when called with no argument; `performance.mark`, `measure`, `getEntries*` disabled; globals deleted (`Temporal`, `File`, `DocumentTimeline`, `Animation`, `AudioContext`, `PerformanceObserver`, `MessageChannel`, `scheduler`, `requestIdleCallback`, `ResizeObserver`, `IntersectionObserver`, `RTCPeerConnection`, `Worker`, `fetch`, `XMLHttpRequest`, `WebSocket`, `FinalizationRegistry`, `WeakRef` and related names); and before and after every render it pauses every CSS animation and sets its time to the seek time, finishes every CSS transition, and pauses every `<svg>` and sets its SMIL time to the seek time.
- **With the final shim, no clock on the list returned real time.**

### B3. Random sources and other nondeterminism

| Source | S4 shim | Final shim |
|---|---|---|
| `Math.random()` | fixed per frame | fixed per frame |
| `crypto.getRandomValues` (also through `Crypto.prototype`) | **random** | fixed per frame |
| `crypto.randomUUID()` | **random** | fixed per frame |
| `URL.createObjectURL(new Blob([]))` (the URL contains a random UUID) | **random** | disabled |
| `new Response(new FormData()).headers.get('content-type')` (random multipart boundary) | **random** | removed |
| `crypto.subtle.generateKey` then export | **random key** | removed (`crypto.subtle` is `undefined`) |
| `RTCPeerConnection.createOffer()` (random session id in the SDP) | **random** | removed |

The seeded generator was reset before every seek: frame 30 gave the same values the first time, after frame 60, and in another browser.

Other nondeterminism reachable from component code **with the final shim in place**:

| Source | Observed |
|---|---|
| A loop that posts a message to its own window and counts replies | **Not repeatable**: 381 ticks before the first seek in one browser, 36,177 in another. The count measures real elapsed time. |
| A loop on `Image` `onerror` | **Not repeatable**: 381 against 36,177 |
| `navigator.connection.downlink` | **Not repeatable**: `10` in some browsers, `9.4` or `9.7` in others. It differed between two browsers in some probe runs and not in others. |
| An image created inside the render function and drawn at once | **Depends on history**: for a `data:` URL not seen before, `naturalWidth` was 0 and nothing was drawn; when the same frame was sought again later, the image was ready (64 px wide, drawn). An image created at init was ready at every seek. |
| Promises that still resolve after the ack | `createImageBitmap`, `new Blob().text()` resolved; these, like the two loops above, let work continue after the acknowledgement |
| Machine-dependent values (same on every run here, different on another machine) | `navigator.userAgent`, `hardwareConcurrency` (16), `deviceMemory` (8), `language`, `platform`; `screen` size; time zone (`Asia/Calcutta`, so `Date()` strings and `new Date(2020, 0, 1)` depend on the machine); canvas text widths (459.77 px sans-serif, 467.58 serif, 481.64 monospace for one test string), which depend on installed fonts; `matchMedia` colour-scheme and reduced-motion |
| No difference seen | `performance.memory` (always 10,000,000 under the S4 shim), `document.fonts.status`, `document.hasFocus()`, `innerWidth`/`innerHeight` (the iframe size) |
| `WebAssembly.instantiate` | Refused by the CSP |

So the final shim makes a cooperative component repeatable. It does not contain a hostile one: a component can still count real time with a self-`postMessage` loop or an image-error loop, and neither can be removed without breaking messaging or image loading.

### B4. The two S4 leak fixes with the final CSP

A local HTTP server and UDP socket on `127.0.0.1` recorded what arrived.

| Configuration | Navigation requests that reached the server | TCP connections | UDP packets (WebRTC) | Normal component still renders |
|---|---|---|---|---|
| **Control**: host page without CSP, no WebRTC flag, S4 CSP and shim | **6**: `location.href`, `location.replace`, `location.assign`, `<meta http-equiv=refresh>`, link click, `window.open(url, '_self')` | 6 | **10** (direct and from a nested frame) | yes |
| **Fixed**: host CSP + `--force-webrtc-ip-handling-policy=disable_non_proxied_udp`, S4 component CSP, S4 shim | **0** | 0 | **0** (0 ICE candidates) | yes |
| **Fixed**: same host CSP and flag, final component CSP (script hash), final shim | **0** | 0 | **0** | yes |
| Host CSP only, no flag, final CSP + final shim | 0 | 0 | 0 (`RTCPeerConnection` removed; nested frames refused) | yes |
| Host CSP only, no flag, final shim but **no** frame defence | 0 | 0 | **5**: a nested frame gets `RTCPeerConnection` back | yes |

- **Both fixes hold.** Thirteen kinds of outbound request were tried this time, six of them ways of navigating the component's own frame (S4 tried one). Also tried and never reaching the server in any configuration: link click with `target=_top` and `target=_blank`, form submission, `<a ping>`, `<link rel=prefetch/preconnect/dns-prefetch/preload/modulepreload>`, nested iframe `src`, `fetch`, image, `sendBeacon`. No extra TCP connection was seen from the link hints.
- The launch flag is what stops WebRTC. Removing `RTCPeerConnection` in the shim is only as strong as the nested-frame defence.

## Part C — anchor-follow within one frame

Leader: an SVG two-bone arm in a 700×900 iframe; its hand is a red circle tagged `data-cut-id="hand"`. Follower: a separate 200×120 iframe containing a green circle at a known offset from its origin. Per frame the host seeks the leader, takes the hand's bounding-box centre from the ack, adds the leader iframe's position, sets `transform: translate(...)` on the follower iframe, seeks the follower, waits, then issues one BeginFrame. The offset is the distance between the two colour centroids in the captured PNG, minus the known offset.

### C1. Correctness (300 random-order seeks each)

| Run | Follower more than 0.5 px off | Leader not where the seek time says | Offset mean / 95th / max |
|---|---|---|---|
| Sequential follow, anchor at fractional positions | **0 of 300** | 0 | 0.085 / 0.153 / 0.272 px |
| Sequential follow, leader snaps the anchor to whole pixels | **0 of 300** | 0 | 0.067 / 0.124 / 0.167 px |
| All components sought in parallel, then the follower moved from the leader's ack, then BeginFrame | **0 of 300** | 0 | 0.085 / 0.153 / 0.272 px |
| Control: follower placed from the previous frame's anchor | 300 of 300 | — | 224 / 395 / 882 px |

The follower sat on the anchor in every capture. The residual of up to 0.27 px is at the limit of the measurement (centroids of anti-aliased circles of different sizes); the whole-pixel run shows a similar residual.

### C2. Cost (300 frames per mode, three alternating rounds, same page)

| Page | Parallel seek, ms per frame (seek / total) | Sequential follow (seek / total) | Added seek | Added total |
|---|---|---|---|---|
| 2 components (leader + follower) | 2.20–2.27 / 25.7–26.2 | 2.25–2.29 / 25.9–26.2 | +0.02 to +0.09 ms | −0.2 to +0.2 ms |
| 5 components (leader, 3 SVG characters, follower) | 2.28–2.40 / 35.4–35.8 | 2.31–2.45 / 34.9–35.6 | −0.04 to +0.07 ms | −0.9 to +0.2 ms |

- **The second round trip costs under 0.1 ms per frame**, which is inside the noise of the total.
- If the follower's own picture does not depend on the anchor, the second round trip is not needed at all: seeking everything in parallel and moving the follower's iframe once the leader's ack is in gave the same offsets (third row of C1) and the same time (−0.08 to +0.12 ms seek).
- The probe point is in the leader iframe's own coordinates; the host added the iframe's position. A host zoom or a transform on the leader was not part of this test.

## What failed or surprised

- PixiJS fails to start without the `unsafe-eval` add-on, and fails again on the shim's disabled `requestAnimationFrame` unless both tickers are off (A1).
- A `srcdoc` iframe inherits the host page's CSP. Relaxing only the component's CSP (for `'unsafe-eval'`, `worker-src blob:` or `connect-src data:`) had no effect (A1).
- `Assets.load` with default settings hangs forever under the CSP, with no error (A1).
- WebGPU could be made to produce an adapter but lost its device and returned no picture (A1).
- PixiJS on SwiftShader was slower than hand-written Canvas 2D in every comparison, used about 10 cores, and gained little from parallel browsers (A3).
- A shim that leaves `ResizeObserver` defined as `undefined` breaks PixiJS; deleting it works (A1).
- `frame-src 'none'` and `child-src 'none'` made no difference at all to nested frames; shadow roots defeat a document-level `MutationObserver` (B1).
- `document.timeline`, CSS animations, CSS transitions and SMIL run on the BeginFrame clock, not wall-clock time and not the seek time (B2).
- `Intl.DateTimeFormat().format()` with no argument reads the real clock even when `Date` is replaced (B2).
- `URL.createObjectURL`, a `FormData` boundary and `crypto.subtle` are random sources outside the three named functions (B3).
- The no-ack control produced only 5 wrong captures of 300, against 299 in S4 (A2).
- Every repeatability comparison was byte-identical, including across different seek histories (A4, A7).
- Nothing crashed. No run had a missing screenshot.

## Not measured

- Pixel comparison of PixiJS output with and without `--enable-unsafe-swiftshader`.
- PixiJS features beyond sprites, `AnimatedSprite`, `Graphics`, `Text`, `BlurFilter`, `ColorMatrixFilter`: no `HTMLText`, `BitmapText`, masks, render textures, meshes, particles, video textures, or compressed textures (Basis and KTX loaders use workers).
- PixiJS over long renders. With the tickers off, whatever housekeeping PixiJS schedules on them does not run; memory over thousands of frames was not looked at.
- The time cost of changing `resolution` per seek, and sharpness when the zoom changes continuously.
- A Canvas 2D version of the colour-matrix filter.
- Any GPU-backed machine.
- Ways round the extended frame guard (b+) beyond the 25 routes listed; ways for a component to recover a deleted global; whether a host-side check (for example rendering a frame twice and comparing) would catch the remaining tick-loop nondeterminism.
- Whether relaxing the host CSP for workers or `data:` fetches is safe.
- Anchor-follow with a zoomed or transformed leader, with a chain of followers, or with a follower inside the same iframe.
- Fonts: the same font caveats as S4 section I apply; nothing new was tested.

## Limits of this test

- One machine, WSL2, **software rendering only**, one Chrome version (chrome-headless-shell 157). SwiftShader availability without a flag is already deprecated and may change.
- A second job shared the machine for part of the session. The first two timing batches have no measurement of its effect. PixiJS timings varied between 178 and 220 ms across runs of the same page.
- Each timing figure comes from one to three runs of 300 frames (100 for the parallel and `resolution: 2` runs), frames held in memory, sent to Node as base64.
- The scenes are synthetic. The blur was deliberately one filter over a container whose bounds fill the frame; a filter on a small object costs far less (A3).
- The Canvas 2D comparison is one hand-written version of the scene, not tuned beyond the obvious; its blur (`ctx.filter`) is not the same algorithm as PixiJS's `BlurFilter`.
- The Part B results show what happened for the specific attempts listed. They are not a security review. All components still share one renderer process, as S4 found.
- The final shim is a spike-quality construction; it shows which overrides are sufficient for the probes listed, not that the list is complete.

## Cleanup

- `~/cutroom-spikes` and the Windows scratch folder holding the spike sources were deleted and confirmed gone. No Chrome or Node processes were left running.
- Four npm debug logs written by this spike in `~/.npm/_logs` were removed.
- `~/.local/share/pki` was not present at the end of the run, so there was nothing to remove.
- Left in place: `~/.npm` (package cache from earlier work today, which this spike added to, as S4 did); `~/.cache/fontconfig` (older than this spike); an empty `~/.config/procps` directory that appeared at 16:14 during the session and was not created by any command of this spike.
- Nothing was installed with sudo.
