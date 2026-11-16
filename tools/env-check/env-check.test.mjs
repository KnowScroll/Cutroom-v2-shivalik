// Design: M0-01b tests ("a pins file with one wrong hash fails env:check, naming entry, expected and actual";
// the FFmpeg feature check names what is missing)
import assert from "node:assert/strict";
import { test } from "node:test";
import { comparePins, formatMismatch } from "./compare.mjs";
import { checkFeatures, parseNames, REQUIRED } from "./ffmpeg-features.mjs";

const pins = () => ({
  os: { distro: "ubuntu", kernel: "6.1", libraries: { "libc.so.6": "aaa" } },
  node: { version: "26.13.1", binary_sha256: "abc" },
  chrome: { libraries: [{ package: "libnss3", version: "1", deb_sha256: "x", files: { "a.so": "h1" } }] },
  fonts: {
    files: [
      { file: "Inter-Regular.ttf", family: "Inter", sha256: "f1", source: "https://a", licence: "OFL-1.1" },
    ],
  },
});

test("identical pins and measurements produce no mismatch", () => {
  assert.deepEqual(comparePins(pins(), pins()), []);
});

test("one wrong hash fails, naming the entry, the expected and the actual value", () => {
  const measured = pins();
  measured.node.binary_sha256 = "def";
  const out = comparePins(pins(), measured);
  assert.equal(out.length, 1);
  assert.equal(formatMismatch(out[0]), "node.binary_sha256: expected abc, got def");
});

test("a changed font file, library file or system library is named by its path", () => {
  const measured = pins();
  measured.fonts.files[0].sha256 = "f2";
  measured.chrome.libraries[0].files["a.so"] = "h2";
  measured.os.libraries["libc.so.6"] = "bbb";
  const entries = comparePins(pins(), measured).map((m) => m.entry);
  assert.deepEqual(entries.sort(), [
    "chrome.libraries[libnss3].files.a.so",
    "fonts.files[Inter-Regular.ttf].sha256",
    "os.libraries.libc.so.6",
  ]);
});

test("a missing or extra font is reported; kernel, source and licence are not compared", () => {
  const measured = pins();
  measured.os.kernel = "7.0";
  measured.fonts.files[0].source = "https://elsewhere";
  measured.fonts.files.push({ file: "Extra.ttf", family: "Extra", sha256: "e" });
  const out = comparePins(pins(), measured);
  assert.deepEqual(out.map(formatMismatch), ["fonts.files[Extra.ttf]: expected absent, got present"]);
});

const listing = (rows) => rows.join("\n");

test("the feature parser reads encoder, filter and muxer listings", () => {
  const encoders = listing([
    " V....D libx264              libx264 H.264",
    " A....D aac                  AAC",
  ]);
  assert.deepEqual([...parseNames(encoders, /^\s*[A-Z.]{6}\s+(\S+)/)], ["libx264", "aac"]);
  const filters = listing([" TS aap               AA->A      x", " .. scale             V->V       y"]);
  assert.deepEqual([...parseNames(filters, /^\s*[A-Z.]{2,3}\s+(\S+)/)], ["aap", "scale"]);
  const demuxers = listing([" D  mov,mp4,m4a,3gp,3g2,mj2 QuickTime / MOV"]);
  assert.ok(parseNames(demuxers, /^\s*[DE ]{2}\s+(\S+)/).has("mp4"));
});

test("a build missing an item fails the feature check and names it", () => {
  const full = (args) => {
    const key = args.join(" ");
    if (key === "-hide_banner -encoders")
      return REQUIRED.encoders.map((n) => ` V....D ${n}   desc`).join("\n");
    if (key === "-hide_banner -decoders")
      return REQUIRED.decoders.map((n) => ` VFS..D ${n}   desc`).join("\n");
    if (key === "-hide_banner -filters")
      return REQUIRED.filters.map((n) => ` .. ${n}   A->A  desc`).join("\n");
    if (key === "-hide_banner -muxers") return REQUIRED.muxers.map((n) => `  E ${n}   desc`).join("\n");
    if (key === "-hide_banner -demuxers") return REQUIRED.demuxers.map((n) => ` D  ${n}   desc`).join("\n");
    const help = REQUIRED.help.find(([a]) => `-hide_banner ${a.join(" ")}` === key);
    return help ? help[1].join(" ") : "";
  };
  assert.deepEqual(checkFeatures(full), []);
  const withoutSidechain = (args) => full(args).replace(/^.*sidechaincompress.*$/m, "");
  assert.deepEqual(checkFeatures(withoutSidechain), ["filter sidechaincompress"]);
  const withoutCgop = (args) => full(args).replace("cgop", "");
  assert.deepEqual(checkFeatures(withoutCgop), ["'cgop' in ffmpeg -h full"]);
});
