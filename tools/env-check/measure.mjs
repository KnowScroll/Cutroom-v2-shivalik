// Design: impl/02 §9 (the pins file and env:check); A:env-3 (the operating-system image by content)
// Measures both environments and returns objects shaped like tools/pins.json, so one function serves
// both `pins:record` (write what was measured) and `env:check` (compare what was measured to the file).
// Reads files and runs the tools that are installed; it installs nothing and writes nothing outside a
// temporary file.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  realpathSync,
  rmSync,
  statfsSync,
  statSync,
} from "node:fs";
import { homedir, release, tmpdir, totalmem } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";
import { checkFeatures, colourCheck } from "./ffmpeg-features.mjs";

export const CHROME_BUILD_ID = "157.0.8103.78";

export function sha256File(path) {
  const hash = createHash("sha256");
  const fd = openSync(path, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    for (;;) {
      const n = readSync(fd, buffer, 0, buffer.length, null);
      if (n === 0) break;
      hash.update(buffer.subarray(0, n));
    }
  } finally {
    closeSync(fd);
  }
  return hash.digest("hex");
}

/** A hash over every file below `dir`: sorted relative paths, each with its own SHA-256. */
export function treeHash(dir) {
  const lines = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : 1,
    )) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) lines.push(`${sha256File(full)}  ${relative(dir, full).split(sep).join("/")}`);
    }
  };
  walk(dir);
  return createHash("sha256")
    .update(`${lines.join("\n")}\n`)
    .digest("hex");
}

function run(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function readJsonIfExists(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}

/** The Windows half: only `node_windows` (impl/02 §9). */
export function measureWindows(root) {
  const nodeDir = join(root, ".tools", "node-win");
  const exe = join(nodeDir, "node.exe");
  const archives = join(root, ".tools", "archives");
  const zip = existsSync(archives)
    ? readdirSync(archives).find((f) => /^node-v.*-win-x64\.zip$/.test(f))
    : undefined;
  const npmPkg = readJsonIfExists(join(nodeDir, "node_modules", "npm", "package.json"));
  const where = run("where", ["node"]);
  const first = where.stdout.split(/\r?\n/).find(Boolean) ?? null;
  const measured = {
    node_windows: {
      version: existsSync(exe) ? run(exe, ["-p", "process.versions.node"]).stdout.trim() : null,
      npm: npmPkg?.version ?? null,
      zip_sha256: zip ? sha256File(join(archives, zip)) : null,
      binary_sha256: existsSync(exe) ? sha256File(exe) : null,
      sqlite: existsSync(exe) ? run(exe, ["-p", "process.versions.sqlite"]).stdout.trim() : null,
    },
  };
  const running = {
    execPath: process.execPath,
    platform: process.platform,
    version: process.versions.node,
    sqlite: process.versions.sqlite,
    whereFirst: first,
  };
  return { measured, running };
}

function osRelease() {
  const text = readFileSync("/etc/os-release", "utf8");
  const get = (key) => new RegExp(`^${key}="?([^"\\n]*)"?$`, "m").exec(text)?.[1] ?? null;
  return { id: get("ID"), version_id: get("VERSION_ID") };
}

/** Libraries `ldd` resolves for a binary under an environment: { soname: sha256 }. */
export function lddLibraries(binary, env) {
  const r = run("ldd", [binary], { env });
  const libs = {};
  const missing = [];
  for (const line of r.stdout.split("\n")) {
    const named = /^\s*(\S+)\s+=>\s+(\S+)\s+\(0x/.exec(line);
    if (named) libs[named[1]] = sha256File(realpathSync(named[2]));
    else if (/not found/.test(line)) missing.push(line.trim());
    else {
      const loader = /^\s*(\/\S+)\s+\(0x/.exec(line);
      if (loader) libs[basename(loader[1])] = sha256File(realpathSync(loader[1]));
    }
  }
  return { libs, missing };
}

// fc-list prints its version on stderr in some builds, so both streams are read.
function fontconfigVersion() {
  const r = run("fc-list", ["--version"]);
  return /version\s+(\S+)/.exec(`${r.stdout}\n${r.stderr}`)?.[1] ?? null;
}

function fontFamilies(file) {
  const r = run("fc-scan", ["--format", "%{family[0]}|%{style[0]}\\n", file]);
  const faces = r.stdout
    .split("\n")
    .filter(Boolean)
    .map((l) => l.split("|"));
  const unique = (xs) => [...new Set(xs)];
  return {
    family: unique(faces.map((f) => f[0])).join(", "),
    style: unique(faces.map((f) => f[1])).join(", "),
  };
}

/** The WSL half. `launch` adds the BeginFrame capture and the raster mode. */
export function measureLinux(tools, root, { launch = false, launchRunner = null } = {}) {
  const records = join(tools, "records");
  const archives = join(tools, "archives");
  const problems = [];
  const info = {};

  // Node
  const nodeBin = join(tools, "node", "bin", "node");
  const nodeArchive = existsSync(archives)
    ? readdirSync(archives).find((f) => /^node-v.*-linux-x64\.tar\.xz$/.test(f))
    : undefined;
  const npmPkg = readJsonIfExists(join(tools, "node", "lib", "node_modules", "npm", "package.json"));
  const resolved = run("bash", ["-c", "command -v node npm npx"]).stdout.split("\n").filter(Boolean);
  info.resolved = resolved;
  for (const path of resolved) {
    if (!path.startsWith(join(tools, "node", "bin") + sep))
      problems.push(`${path} resolves outside ${join(tools, "node", "bin")}`);
  }
  if (resolved.length !== 3)
    problems.push(`command -v node npm npx printed ${resolved.length} paths, expected 3`);
  if (process.platform !== "linux") problems.push(`process.platform is ${process.platform}, expected linux`);

  // Chrome
  const chromeRecord = readJsonIfExists(join(records, "chrome.json"));
  const chromeDir = join(tools, "browsers", "chrome-headless-shell", `linux-${CHROME_BUILD_ID}`);
  const chromeBin = join(chromeDir, "chrome-headless-shell-linux64", "chrome-headless-shell");
  const libsRoot = join(tools, "chrome-libs", "root", "usr", "lib", "x86_64-linux-gnu");
  const chromeEnv = { ...process.env, LD_LIBRARY_PATH: libsRoot };
  let libs = { libs: {}, missing: [] };
  if (existsSync(chromeBin)) libs = lddLibraries(chromeBin, chromeEnv);
  for (const line of libs.missing) problems.push(`ldd: ${line}`);

  const libRecords = readJsonIfExists(join(records, "chrome-libs.json")) ?? [];
  const chromeLibraries = libRecords.map((lib) => {
    const list = run("dpkg-deb", ["-c", join(tools, "chrome-libs", lib.deb)]).stdout.split("\n");
    const files = {};
    for (const line of list) {
      const m = /\s\.(\/\S*\.so\S*)(?: -> (\S+))?$/.exec(line);
      if (!m) continue;
      const full = join(tools, "chrome-libs", "root", m[1]);
      if (existsSync(full)) files[m[1].replace(/^\//, "")] = sha256File(realpathSync(full));
    }
    return { package: lib.package, version: lib.version, deb_sha256: lib.deb_sha256, files };
  });

  // FFmpeg
  const ffmpeg = join(tools, "ffmpeg", "bin", "ffmpeg");
  const ffprobe = join(tools, "ffmpeg", "bin", "ffprobe");
  const ffRecord = readJsonIfExists(join(records, "ffmpeg.json"));
  let versionLine = null;
  let configuration = null;
  let x264Core = null;
  if (existsSync(ffmpeg)) {
    const v = run(ffmpeg, ["-version"]).stdout.split("\n");
    versionLine = v[0] ?? null;
    configuration =
      (v.find((l) => l.startsWith("configuration:")) ?? "").replace(/^configuration:\s*/, "") || null;
    const missing = checkFeatures((args) => {
      const r = run(ffmpeg, args);
      return r.stdout + r.stderr;
    });
    for (const m of missing) problems.push(`ffmpeg lacks ${m}`);
    const scratch = mkdtempSync(join(tmpdir(), "cutroom-colour-"));
    try {
      const colour = colourCheck(ffmpeg, ffprobe, join(scratch, "three-frames.mp4"));
      x264Core = colour.x264_core;
      info.colour = colour.fields;
      if (!colour.ok) problems.push(`ffmpeg colour chain: ${colour.detail}`);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }

  // Fonts
  const fontsDir = join(tools, "fonts");
  const fontsConf = join(root, "tools", "fonts.conf");
  const fontRecords = readJsonIfExists(join(records, "fonts.json")) ?? [];
  const bySource = new Map(fontRecords.map((r) => [r.file, r]));
  const fontFiles = existsSync(fontsDir)
    ? readdirSync(fontsDir)
        .filter((f) => !f.startsWith("."))
        .sort()
    : [];
  const fontEntries = fontFiles.map((file) => {
    const rec = bySource.get(file);
    return {
      file,
      ...fontFamilies(join(fontsDir, file)),
      sha256: sha256File(join(fontsDir, file)),
      source: rec?.source ?? null,
      licence: rec?.licence ?? null,
    };
  });
  const listed = run("fc-list", [":", "file"], { env: { ...process.env, FONTCONFIG_FILE: fontsConf } })
    .stdout.split("\n")
    .map((l) => basename(l.replace(/:\s*$/, "")))
    .filter(Boolean);
  const wanted = new Set(fontFiles);
  const got = new Set(listed);
  for (const f of wanted) if (!got.has(f)) problems.push(`fc-list does not list pinned font ${f}`);
  for (const f of got) if (!wanted.has(f)) problems.push(`fc-list lists ${f}, which is not pinned`);

  // Filesystems: the mirror on ext4, the Space (if it exists) not on 9p (impl/02 §7)
  const EXT4 = 0xef53;
  const NINE_P = 0x1021997;
  const fsType = (path) => Number(statfsSync(path).type);
  if (fsType(root) !== EXT4)
    problems.push(`the mirror ${root} is not on ext4 (statfs type 0x${fsType(root).toString(16)})`);
  const space = join(homedir(), "cutroom-space");
  if (existsSync(space) && statSync(space).isDirectory() && fsType(space) === NINE_P)
    problems.push(`the Space ${space} is on 9p`);

  const measured = {
    os: {
      distro: osRelease().id,
      version_id: osRelease().version_id,
      kernel: release(),
      glibc: /(\d+\.\d+)\s*$/.exec(run("ldd", ["--version"]).stdout.split("\n")[0] ?? "")?.[1] ?? null,
      fontconfig: fontconfigVersion(),
      raster_mode: null,
      libraries: libs.libs,
    },
    node: {
      version: existsSync(nodeBin) ? run(nodeBin, ["-p", "process.versions.node"]).stdout.trim() : null,
      npm: npmPkg?.version ?? null,
      tarball_sha256: nodeArchive ? sha256File(join(archives, nodeArchive)) : null,
      binary_sha256: existsSync(nodeBin) ? sha256File(nodeBin) : null,
      sqlite: existsSync(nodeBin) ? run(nodeBin, ["-p", "process.versions.sqlite"]).stdout.trim() : null,
    },
    chrome: {
      build_id: CHROME_BUILD_ID,
      archive_sha256:
        chromeRecord && existsSync(join(archives, chromeRecord.archive))
          ? sha256File(join(archives, chromeRecord.archive))
          : null,
      binary_sha256: existsSync(chromeBin) ? sha256File(chromeBin) : null,
      tree_sha256: existsSync(chromeDir) ? treeHash(chromeDir) : null,
      libraries: chromeLibraries,
    },
    ffmpeg: {
      version_line: versionLine,
      configuration,
      x264_core: x264Core,
      archive_sha256:
        ffRecord && existsSync(join(archives, ffRecord.archive))
          ? sha256File(join(archives, ffRecord.archive))
          : null,
      ffmpeg_sha256: existsSync(ffmpeg) ? sha256File(ffmpeg) : null,
      ffprobe_sha256: existsSync(ffprobe) ? sha256File(ffprobe) : null,
    },
    fonts: {
      fonts_conf_sha256: existsSync(fontsConf) ? sha256File(fontsConf) : null,
      files: fontEntries,
    },
  };

  if (launch) {
    const result = launchRunner
      ? launchRunner({ chromeBin, libsRoot, fontsConf })
      : { ok: false, error: "no launch runner" };
    info.launch = result;
    if (!result.ok) problems.push(`launch: ${result.error ?? "BeginFrame capture failed"}`);
    else measured.os.raster_mode = result.raster_mode;
  }

  info.memory_mb = Math.round(totalmem() / 1024 / 1024);
  info.resolvedPaths = resolve(tools);
  return { measured, problems, info };
}
