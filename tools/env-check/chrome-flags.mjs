// Design: impl/02 §4.3 (launch flags and environment; lld/03 §2.8, illustrative there)
// The flag set the pinned Chrome is launched with. It is `human` (G15 class (e)): the list fixed at M1
// changes only on the user's word. M1's capture engine takes it over; until then env:check --launch uses it.
export const CHROME_FLAGS = [
  "--remote-debugging-pipe",
  "--enable-begin-frame-control",
  "--run-all-compositor-stages-before-draw",
  "--disable-new-content-rendering-timeout",
  "--disable-threaded-animation",
  "--disable-threaded-scrolling",
  "--disable-checker-imaging",
  "--disable-image-animation-resync",
  "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
  "--force-color-profile=srgb",
  "--font-render-hinting=none",
  "--hide-scrollbars",
  "--mute-audio",
  "--disable-background-networking",
];

/** `--no-sandbox` is never used (lld/03 §2.7): a launch that needs it is reported, not worked around. */
export function chromeArgs(userDataDir) {
  return [...CHROME_FLAGS, `--user-data-dir=${userDataDir}`];
}
