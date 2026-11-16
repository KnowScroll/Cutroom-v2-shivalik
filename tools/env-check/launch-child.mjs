// Design: impl/02 §4.3, §9 (env:check --launch)
// Runs inside an empty network namespace (started by launch.mjs through `unshare`). Launches the pinned
// chrome-headless-shell with the R2 flags and environment, captures one frame with BeginFrame, reads the
// raster mode over the DevTools protocol, and prints one JSON line. Nothing here is a product module.
import { mkdtempSync, rmSync } from "node:fs";
import { networkInterfaces, tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";
import { chromeArgs } from "./chrome-flags.mjs";

const [executablePath, fontconfigFile, libraryPath] = process.argv.slice(2);
const userDataDir = mkdtempSync(join(tmpdir(), "cutroom-chrome-"));
const env = {
  PATH: process.env.PATH ?? "",
  HOME: process.env.HOME ?? "",
  FONTCONFIG_FILE: fontconfigFile,
  TZ: "UTC",
};
if (libraryPath) env.LD_LIBRARY_PATH = libraryPath;

const result = { ok: false };
let browser;
try {
  browser = await puppeteer.launch({
    executablePath,
    headless: "shell",
    pipe: true,
    waitForInitialPage: false,
    ignoreDefaultArgs: true,
    args: chromeArgs(userDataDir),
    env,
    protocolTimeout: 60000,
  });
  const step = (s) => {
    if (process.env.CUTROOM_DEBUG) console.error("step", s);
  };
  step("launched");
  const browserSession = await browser.target().createCDPSession();
  step("session");
  await browserSession.send("Target.createTarget", {
    url: "about:blank",
    enableBeginFrameControl: true,
    width: 320,
    height: 240,
  });
  const target = await browser.waitForTarget((t) => t.type() === "page", { timeout: 30000 });
  step("target");
  const page = await target.page();
  step("page");
  const session = await page.createCDPSession();
  let screenshotData;
  for (let i = 0; i < 4; i++) {
    const frame = await session.send("HeadlessExperimental.beginFrame", {
      frameTimeTicks: 1000 + i * 16.667,
      interval: 16.667,
      screenshot: i === 3 ? { format: "png" } : undefined,
    });
    screenshotData = frame.screenshotData ?? screenshotData;
  }
  const png = Buffer.from(screenshotData ?? "", "base64");
  const isPng = png.length > 24 && png.subarray(1, 4).toString("latin1") === "PNG";
  result.png = isPng
    ? { width: png.readUInt32BE(16), height: png.readUInt32BE(20), bytes: png.length }
    : null;

  const info = await browserSession.send("SystemInfo.getInfo");
  result.gpu_compositing = info.gpu?.auxAttributes?.gpuCompositing ?? null;
  result.feature_status = info.gpu?.featureStatus ?? null;
  result.version = await browser.version();
  result.interfaces = Object.entries(networkInterfaces()).flatMap(([name, list]) =>
    (list ?? []).filter((i) => !i.internal).map((i) => `${name}:${i.address}`),
  );
  result.raster_mode = `gpu_compositing=${result.feature_status?.gpu_compositing};rasterization=${result.feature_status?.rasterization}`;
  result.ok = isPng && result.png.width > 0 && result.png.height > 0;
} catch (error) {
  result.error = String(error?.stack ?? error).slice(0, 2000);
} finally {
  await browser?.close().catch(() => {});
  rmSync(userDataDir, { recursive: true, force: true });
}
console.log(JSON.stringify(result));
process.exit(result.ok ? 0 : 1);
