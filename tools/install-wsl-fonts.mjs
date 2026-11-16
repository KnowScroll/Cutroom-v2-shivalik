// Design: impl/02 §6 (the font set of R2 §2.10, from each project's release)
// Usage (in WSL, with the pinned Node): node tools/install-wsl-fonts.mjs
// Downloads every file into <tools>/archives/fonts/, checks each family's licence text first (SIL OFL
// 1.1), copies the font files into <tools>/fonts/ and writes <tools>/records/fonts.json with source and
// licence per file. Files come from commit-pinned URLs, so a moved branch cannot change them.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { listZip, readZipEntry } from "./lib/zip.mjs";

const tools = join(homedir(), ".cutroom-build", ".tools");
const archives = join(tools, "archives", "fonts");
const fontsDir = join(tools, "fonts");
const records = join(tools, "records");
for (const dir of [archives, fontsDir, records]) mkdirSync(dir, { recursive: true });

const NOTO =
  "https://raw.githubusercontent.com/notofonts/notofonts.github.io/983116fbb1e1c231cf33f1f4ec0f9456055fe1e1/fonts";
const CJK = "https://raw.githubusercontent.com/notofonts/noto-cjk/f8d157532fbfaeda587e826d4cd5b21a49186f7c";
const GF = "https://raw.githubusercontent.com/google/fonts/cc39c4c2c304bc368c9b7c311ea2bcc6013299fe/ofl";
const INTER_ZIP = "https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip";
const JB_ZIP = "https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip";

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const cache = new Map();
async function download(url) {
  if (cache.has(url)) return cache.get(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(join(archives, basename(url)), buffer);
  cache.set(url, buffer);
  return buffer;
}

/** A family: where its licence text is, and its files (a URL each, or an entry of a zip). */
const families = [
  {
    name: "Inter",
    licence: { zip: INTER_ZIP, entry: "LICENSE.txt" },
    zip: INTER_ZIP,
    dir: "extras/ttf/",
    files: ["Inter-Regular.ttf", "Inter-Bold.ttf", "Inter-Italic.ttf", "Inter-BoldItalic.ttf"],
  },
  {
    name: "JetBrains Mono",
    licence: { zip: JB_ZIP, entry: "OFL.txt" },
    zip: JB_ZIP,
    dir: "fonts/ttf/",
    files: [
      "JetBrainsMono-Regular.ttf",
      "JetBrainsMono-Bold.ttf",
      "JetBrainsMono-Italic.ttf",
      "JetBrainsMono-BoldItalic.ttf",
    ],
  },
  noto("Noto Sans", "NotoSans", "notosans", ["Regular", "Bold", "Italic", "BoldItalic"]),
  noto("Noto Serif", "NotoSerif", "notoserif", ["Regular", "Bold", "Italic", "BoldItalic"]),
  noto("Noto Sans Arabic", "NotoSansArabic", "notosansarabic", ["Regular", "Bold"]),
  noto("Noto Naskh Arabic", "NotoNaskhArabic", "notonaskharabic", ["Regular", "Bold"]),
  noto("Noto Sans Hebrew", "NotoSansHebrew", "notosanshebrew", ["Regular", "Bold"]),
  noto("Noto Sans Math", "NotoSansMath", "notosansmath", ["Regular"]),
  noto("Noto Sans Symbols 2", "NotoSansSymbols2", "notosanssymbols2", ["Regular"]),
  {
    name: "Noto Sans CJK",
    licence: { url: `${CJK}/Sans/LICENSE` },
    urls: ["Regular", "Bold"].map((w) => `${CJK}/Sans/OTC/NotoSansCJK-${w}.ttc`),
  },
  {
    name: "Noto Serif CJK",
    licence: { url: `${CJK}/Serif/LICENSE` },
    urls: ["Regular", "Bold"].map((w) => `${CJK}/Serif/OTC/NotoSerifCJK-${w}.ttc`),
  },
  {
    name: "Noto Color Emoji",
    licence: { url: `${GF}/notocoloremoji/OFL.txt` },
    urls: [`${GF}/notocoloremoji/NotoColorEmoji-Regular.ttf`],
  },
];

function noto(name, repoDir, gfDir, styles) {
  return {
    name,
    licence: { url: `${GF}/${gfDir}/OFL.txt` },
    urls: styles.map((s) => `${NOTO}/${repoDir}/unhinted/ttf/${repoDir}-${s}.ttf`),
  };
}

const out = [];
for (const family of families) {
  const licenceBytes = family.licence.zip
    ? readZipEntry(
        await download(family.licence.zip),
        listZip(await download(family.licence.zip)).find((e) => e.name === family.licence.entry),
      )
    : await download(family.licence.url);
  const text = licenceBytes.toString("utf8");
  if (!/SIL OPEN FONT LICENSE/i.test(text) || !/Version 1\.1/i.test(text)) {
    throw new Error(`${family.name}: licence text is not SIL OFL 1.1`);
  }
  const licenceSource = family.licence.zip
    ? `${family.licence.zip}!${family.licence.entry}`
    : family.licence.url;

  const files = [];
  if (family.zip) {
    const zip = await download(family.zip);
    const entries = listZip(zip);
    for (const file of family.files) {
      const entry = entries.find((e) => e.name === family.dir + file);
      if (!entry) throw new Error(`${family.zip}: no ${family.dir}${file}`);
      files.push({ file, bytes: readZipEntry(zip, entry), source: `${family.zip}!${entry.name}` });
    }
  } else {
    for (const url of family.urls)
      files.push({ file: basename(url), bytes: await download(url), source: url });
  }
  for (const f of files) {
    writeFileSync(join(fontsDir, f.file), f.bytes);
    out.push({
      family: family.name,
      file: f.file,
      sha256: sha256(f.bytes),
      source: f.source,
      licence: "OFL-1.1",
      licence_source: licenceSource,
    });
    console.log(`${family.name}: ${f.file} ${sha256(f.bytes)}`);
  }
}
writeFileSync(join(records, "fonts.json"), `${JSON.stringify(out, null, 2)}\n`);
console.log(`${out.length} font files installed`);
