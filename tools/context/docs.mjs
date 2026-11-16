// Design: U31 (pointer command); impl/01 §7 (heading formats the tests pin)
// Reads the documents the pointer command draws on: the milestone documents' work-package blocks
// (`### M0-04 — title`), the design documents' sections (`### 2.4 title`, `### D5. title`, `## Revision 3`,
// lettered `## E. title`), and the decision rows of lld/11. Built-in modules only. Never walks docs/ as a
// whole, so it can never open the v3.1 archive: it reads only the named folders below.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const WP_HEADING = /^### (M\d+-\d+[a-z]?) — (.*)$/;
const HEADING = /^(#{1,6})\s+(.*)$/;

const read = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

/** Splits a document into lines and finds its headings: [{ level, text, line }]. */
export function parseHeadings(text) {
  const lines = text.split("\n");
  const headings = [];
  let fenced = false;
  for (const [i, line] of lines.entries()) {
    if (/^```/.test(line)) fenced = !fenced;
    if (fenced) continue;
    const m = HEADING.exec(line);
    if (m) headings.push({ level: m[1].length, text: m[2].trim(), line: i });
  }
  return { lines, headings };
}

/** The lines of the section that starts at heading index `h`, up to the next heading of the same or higher level. */
export function sectionText(doc, h, maxLevel = null) {
  const start = doc.headings[h];
  const stop = maxLevel ?? start.level;
  let end = doc.lines.length;
  for (let j = h + 1; j < doc.headings.length; j++) {
    if (doc.headings[j].level <= stop) {
      end = doc.headings[j].line;
      break;
    }
  }
  return doc.lines.slice(start.line, end).join("\n").trimEnd();
}

/** Index of the heading whose text starts with `id` ("2.4", "D6.1", "E", "Revision 3", "S1c", "Spike 2"). */
export function findHeading(doc, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^(?:Part\\s+)?${escaped}\\.?(?:\\s|$|—|:|–)`);
  return doc.headings.findIndex((h) => pattern.test(h.text));
}

/** Index of a heading whose text contains `phrase` (case-insensitive), for quoted references. */
export function findHeadingByText(doc, phrase) {
  const lower = phrase.toLowerCase();
  const exact = doc.headings.findIndex((h) => h.text.toLowerCase().replace(/[`*]/g, "") === lower);
  if (exact >= 0) return exact;
  return doc.headings.findIndex((h) => h.text.toLowerCase().replace(/[`*]/g, "").includes(lower));
}

/** A bold-named paragraph ("**Lint rules.** ...") by its name; returns its text or null. */
export function findParagraph(doc, phrase) {
  const lower = phrase.toLowerCase();
  const start = doc.lines.findIndex((line) => {
    const t = line.replace(/^[-*]\s+/, "").toLowerCase();
    return t.startsWith(`**${lower}`);
  });
  if (start < 0) return null;
  let end = start + 1;
  while (
    end < doc.lines.length &&
    doc.lines[end].trim() !== "" &&
    !/^#{1,6}\s/.test(doc.lines[end]) &&
    end - start < 60
  ) {
    end++;
  }
  return doc.lines.slice(start, end).join("\n");
}

export class Corpus {
  constructor(root) {
    this.root = root;
    this.cache = new Map();
    this.milestones = this.#indexMilestones();
    this.lld = this.#indexLld();
    this.evidence = this.#indexEvidence();
  }

  /** A parsed document by path relative to the root; null if missing. */
  doc(rel) {
    if (!this.cache.has(rel)) {
      const full = join(this.root, rel);
      this.cache.set(rel, existsSync(full) ? { rel, ...parseHeadings(read(full)) } : null);
    }
    return this.cache.get(rel);
  }

  #markdownIn(rel) {
    const dir = join(this.root, rel);
    return existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => f.endsWith(".md"))
          .sort()
      : [];
  }

  #indexMilestones() {
    const map = new Map();
    for (const file of this.#markdownIn("docs/impl/milestones")) {
      const rel = `docs/impl/milestones/${file}`;
      for (const h of this.doc(rel).headings) {
        const m = WP_HEADING.exec(`### ${h.text}`);
        if (h.level === 3 && m) map.set(m[1], { rel, title: m[2] });
      }
    }
    return map;
  }

  /** R-number and lld number to file, from each design document's header ("LLD · R2: ..."). */
  #indexLld() {
    const byNumber = new Map();
    const byR = new Map();
    for (const file of this.#markdownIn("docs/lld")) {
      const rel = `docs/lld/${file}`;
      const number = /^(\d+)-/.exec(file)?.[1];
      if (number) byNumber.set(number, rel);
      const title = this.doc(rel).lines[0] ?? "";
      const r = /LLD · R(\d+)\b:/.exec(title);
      if (r) byR.set(r[1], rel);
    }
    return { byNumber, byR };
  }

  /** Spike and batch tokens ("s4", "b2b", "b3") to the evidence file they name. */
  #indexEvidence() {
    const map = new Map();
    for (const file of this.#markdownIn("docs/research/evidence")) {
      for (const token of file.replace(/\.md$/, "").split("-")) {
        if (/^[sbv]\d+[a-c]?$/.test(token)) map.set(token, `docs/research/evidence/${file}`);
      }
    }
    return map;
  }

  /** docs/research/NN-*.md for a number such as "11". */
  researchDoc(n) {
    const prefix = `${String(n).padStart(2, "0")}-`;
    const file = this.#markdownIn("docs/research").find((f) => f.startsWith(prefix));
    return file ? `docs/research/${file}` : null;
  }

  milestoneBlock(id) {
    const entry = this.milestones.get(id);
    if (!entry) return null;
    const doc = this.doc(entry.rel);
    const h = doc.headings.findIndex((x) => x.level === 3 && x.text.startsWith(`${id} — `));
    return { ...entry, text: sectionText(doc, h, 3) };
  }

  /** The paragraph that begins with "**Read first.**" inside a block. */
  static readFirst(blockText) {
    const m = /^\*\*Read first\.\*\*([\s\S]*?)(?:\n\s*\n|$)/m.exec(blockText);
    return m ? m[1].trim() : null;
  }

  /** Decision rows of lld/11 whose first cell or bullet names `id`: [{ section, text }]. */
  decisionRows(id) {
    const rel = this.lld.byNumber.get("11");
    const doc = rel ? this.doc(rel) : null;
    if (!doc) return [];
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const idPattern = new RegExp(`(?<![\\w:.-])${escaped}(?![\\w-]|\\.\\d)`);
    const bullet = new RegExp(`^- \\*\\*${escaped}[.:]`);
    const rows = [];
    let section = "";
    let hIndex = 0;
    for (const [i, line] of doc.lines.entries()) {
      while (hIndex < doc.headings.length && doc.headings[hIndex].line <= i) {
        section = doc.headings[hIndex].text;
        hIndex++;
      }
      if (line.startsWith("|")) {
        const first = line.split("|")[1]?.replace(/\*\*/g, "") ?? "";
        if (first.trim() && idPattern.test(first) && !/^\s*-+\s*$/.test(first))
          rows.push({ section, text: line });
      } else if (bullet.test(line)) rows.push({ section, text: line });
    }
    if (rows.length === 0 && id.startsWith("B:")) {
      // "report B's row B:O17": the lead's rulings in lld/11 do not list every row of the research reports.
      const report = this.doc("docs/impl/research/open-points-B.md");
      const suffix = id.slice(2);
      for (const line of report?.lines ?? []) {
        if (line.startsWith("|") && (line.split("|")[1] ?? "").trim().replace(/\*\*/g, "") === suffix) {
          rows.push({ section: "impl/research/open-points-B.md", text: line });
        }
      }
    }
    return rows;
  }
}
