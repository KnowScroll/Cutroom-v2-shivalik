// Design: impl/02 §4.1 (chrome-headless-shell, pinned build)
// Usage (in WSL, in the build mirror, tools/env.sh sourced): node tools/install-wsl-chrome.mjs
// Installs chrome-headless-shell at the pinned build id into <tools>/browsers/ with @puppeteer/browsers
// (its `install` function, given a path, so no browser cache in the home directory is used). The archive is
// downloaded first, hashed and kept in <tools>/archives/, then unpacked from that same file.
// Writes <tools>/records/chrome.json. If the build can no longer be downloaded, it stops: the Chrome
// build is the user's decision (G15 class (e)).
import { createHash } from "node:crypto";
import { copyFileSync, createReadStream, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { Browser, install } from "@puppeteer/browsers";

const BUILD_ID = "157.0.8103.78";
const tools = join(homedir(), ".cutroom-build", ".tools");
const cacheDir = join(tools, "browsers");
const archives = join(tools, "archives");
const records = join(tools, "records");
for (const dir of [cacheDir, archives, records]) mkdirSync(dir, { recursive: true });

function sha256File(path) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(path)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve(hash.digest("hex")))
      .on("error", reject);
  });
}

const base = { browser: Browser.CHROMEHEADLESSSHELL, buildId: BUILD_ID, cacheDir };
// An earlier run that stopped half way leaves a folder the installer refuses to reuse; it holds only
// this build, inside the tool folder, so it is removed and the install starts again.
const partial = join(cacheDir, "chrome-headless-shell", `linux-${BUILD_ID}`);
if (
  existsSync(partial) &&
  !existsSync(join(partial, "chrome-headless-shell-linux64", "chrome-headless-shell"))
) {
  rmSync(partial, { recursive: true, force: true });
}
const archivePath = await install({ ...base, unpack: false });
const archiveSha = await sha256File(archivePath);
copyFileSync(archivePath, join(archives, basename(archivePath)));
const installed = await install({ ...base, unpack: true });
const record = {
  build_id: BUILD_ID,
  archive: basename(archivePath),
  archive_sha256: archiveSha,
  executable: installed.executablePath.slice(cacheDir.length + 1),
  platform: installed.platform,
};
writeFileSync(join(records, "chrome.json"), `${JSON.stringify(record, null, 2)}\n`);
console.log(JSON.stringify(record, null, 2));
