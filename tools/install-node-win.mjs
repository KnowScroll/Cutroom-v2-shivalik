// Design: impl/02 §3.2 (the Windows Node, installed without touching nvm-windows)
// Usage: node tools/install-node-win.mjs [version]   (any Node >= 22 can run this; it uses built-ins only)
// Downloads the official Windows x64 zip and SHASUMS256.txt of the newest 26.x LTS (or the given
// version) into .tools/archives/, verifies the zip, unpacks it into .tools/node-win/ and prints the
// measured pin values as JSON. It never changes the machine's Node.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const archives = join(root, ".tools", "archives");
const target = join(root, ".tools", "node-win");
const base = "https://nodejs.org/dist";

const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const fetchBuffer = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
};

let version = process.argv[2];
if (!version) {
  const index = JSON.parse((await fetchBuffer(`${base}/index.json`)).toString("utf8"));
  const lts = index.find((entry) => entry.version.startsWith("v26.") && entry.lts);
  if (!lts) throw new Error("no 26.x LTS release in the index");
  version = lts.version;
}
const zipName = `node-${version}-win-x64.zip`;
mkdirSync(archives, { recursive: true });

const sums = (await fetchBuffer(`${base}/${version}/SHASUMS256.txt`)).toString("utf8");
writeFileSync(join(archives, "SHASUMS256.txt"), sums);
const line = sums.split("\n").find((l) => l.trim().endsWith(` ${zipName}`));
if (!line) throw new Error(`${zipName} not listed in SHASUMS256.txt`);
const expected = line.trim().split(/\s+/)[0];

const zipPath = join(archives, zipName);
if (!existsSync(zipPath) || sha256(zipPath) !== expected) {
  writeFileSync(zipPath, await fetchBuffer(`${base}/${version}/${zipName}`));
}
const actual = sha256(zipPath);
if (actual !== expected) throw new Error(`zip hash mismatch: expected ${expected}, got ${actual}`);

rmSync(target, { recursive: true, force: true });
const staging = join(root, ".tools", "node-win-unpack");
rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });
const tar = spawnSync("tar", ["-xf", zipPath, "-C", staging], { stdio: "inherit" });
if (tar.status !== 0) throw new Error("tar could not unpack the zip");
const inner = readdirSync(staging).find((name) => name.startsWith("node-"));
if (!inner) throw new Error("unpacked zip has no node-* folder");
renameSync(join(staging, inner), target);
rmSync(staging, { recursive: true, force: true });

const nodeExe = join(target, "node.exe");
const run = (args) => spawnSync(nodeExe, args, { encoding: "utf8" }).stdout.trim();
const npmCli = join(target, "node_modules", "npm", "package.json");
console.log(
  JSON.stringify(
    {
      version: run(["-p", "process.version"]).replace(/^v/, ""),
      npm: JSON.parse(readFileSync(npmCli, "utf8")).version,
      zip_sha256: actual,
      binary_sha256: sha256(nodeExe),
      sqlite: run(["-p", "process.versions.sqlite"]),
      platform: run(["-p", "process.platform"]),
      lts: run(["-p", "String(process.release.lts)"]),
    },
    null,
    2,
  ),
);
