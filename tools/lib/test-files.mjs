// Design: testing §1 (test levels); conventions §4; L18
// Which files belong to which test level. Split by folder and file name, never by skipping.
//   unit   : built package tests (packages/*/dist/test), tools tests (*.test.mjs) and the guard hook's tests,
//            except *.linux.*, *.render.*, *.live.* and anything under test/named or test/e2e
//   linux  : *.linux.test.js in built packages, *.linux.test.mjs in tools (L18)
//   render : *.render.test.js, and built files under test/named/ and test/e2e/ of a package
//   accept : tests/acceptance/**/*.test.ts (not *.live.test.ts)
//   claims : tests/claims/**/*.test.ts (not *.live.test.ts)
//   live   : *.live.test.ts under tests/
//   wsl    : *.wsl.test.mjs in tools (they drive wsl.exe from Windows)
import { existsSync } from "node:fs";
import { join } from "node:path";

const kinds = ["linux", "render", "live", "wsl"];

function kindOf(path) {
  const p = path.replace(/\\/g, "/");
  for (const kind of kinds) if (p.includes(`.${kind}.test.`)) return kind;
  if (/\/test\/(named|e2e)\//.test(p)) return "render";
  return "unit";
}

export function selectFiles(root, level, { pkg, listFiles }) {
  const found = [];
  const packagesDir = join(root, "packages");
  const builtTests = (dir) =>
    listFiles(dir, { exts: [".test.js"], skipDirs: new Set(["node_modules", ".git"]) });

  const packageDirs = pkg ? [join(packagesDir, pkg)] : existsSync(packagesDir) ? [packagesDir] : [];
  for (const dir of packageDirs) {
    for (const file of builtTests(dir)) {
      if (!file.replace(/\\/g, "/").includes("/dist/test/")) continue;
      if (kindOf(file) === level) found.push(file);
    }
  }
  if (!pkg) {
    for (const file of listFiles(join(root, "tools"), { exts: [".test.mjs"], skipFixtures: true })) {
      if (kindOf(file) === level) found.push(file);
    }
    if (level === "unit") {
      for (const file of listFiles(join(root, ".claude", "hooks"), { exts: [".test.mjs"] })) found.push(file);
    }
    const testsDir = join(root, "tests");
    if (existsSync(testsDir)) {
      for (const file of listFiles(testsDir, { exts: [".test.ts"], skipFixtures: true })) {
        const p = file.replace(/\\/g, "/");
        const live = p.includes(".live.test.");
        if (level === "live" && live) found.push(file);
        else if (level === "accept" && !live && p.includes("/tests/acceptance/")) found.push(file);
        else if (level === "claims" && !live && p.includes("/tests/claims/")) found.push(file);
      }
    }
  }
  return found;
}
