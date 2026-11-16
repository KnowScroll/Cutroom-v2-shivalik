// Design: U31; impl/01 §7 ("the reference format in Read first is kept exactly")
// Parses a work package's "Read first" paragraph into references. Formats seen in the seven milestone
// documents: `lld/04 §2.4`; `R3 §2.6` (R-numbers, each design document's header giving the mapping);
// `§§8–10`, `§1.1–1.5, §1.7`, `§2.2.2 to §2.2.4`, `§5 of lld/03, lld/04`, `§13 #3`; `R4 D5`, `R6 D6.1`
// (decision-style headings); `Revision 3`; `lld/11` followed by decision IDs (`G15`, `K5–K7`, `A:M0-3`,
// `B:SD1`, `C:C1.5`) and bare IDs (`FR5`, `U9`) with the `§` sections that go with them; impl documents by
// name (`environment §5`, `[environment](...) §9`); evidence documents (`b2b §8`, `S4 §E`, `S7 B1–B3`,
// `b2a spike 1`, `B3 spike 2`, `V1 §3`); research documents (`r11 §5.2`); links to impl/research files;
// quoted headings and named paragraphs (`"What to copy"`).
// Anything it does not understand as a reference is not a reference; anything it recognises but cannot
// resolve is returned as unresolved by the caller, never dropped.

const IMPL_DOCS = {
  orchestration: "docs/impl/00-orchestration.md",
  conventions: "docs/impl/01-repo-and-conventions.md",
  environment: "docs/impl/02-environment.md",
  testing: "docs/impl/03-testing.md",
  spend: "docs/impl/04-spend.md",
};

const NUM = "\\d+(?:\\.\\d+)*";
const RANGE_SEP = "(?:–|-|to)\\s*§?";
const DEC_ID = "(?:[ABC]:[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*(?:\\.\\d+)?|(?:FR|[FGHIJKLU])\\d+[a-z]?)";

/** Expands "1.1–1.5" to 1.1 … 1.5 and "8–10" to 8 … 10; other pairs are returned as two ids. */
export function expandRange(from, to) {
  const a = from.split(".");
  const b = to.split(".");
  if (b.length < a.length) b.unshift(...a.slice(0, a.length - b.length));
  if (a.length === b.length && a.slice(0, -1).join(".") === b.slice(0, -1).join(".")) {
    const lo = Number(a.at(-1));
    const hi = Number(b.at(-1));
    if (Number.isInteger(lo) && Number.isInteger(hi) && hi >= lo && hi - lo <= 40) {
      const prefix = a.slice(0, -1);
      return Array.from({ length: hi - lo + 1 }, (_, k) => [...prefix, lo + k].join("."));
    }
  }
  return [from, b.join(".")];
}

/** Expands "K5–K7" to K5, K6, K7. */
export function expandIdRange(from, to) {
  const f = /^(.*?)(\d+)([a-z]?)$/.exec(from);
  const t = /^(.*?)(\d+)([a-z]?)$/.exec(to);
  if (f && t && f[1] === t[1] && !f[3] && !t[3]) {
    const lo = Number(f[2]);
    const hi = Number(t[2]);
    if (hi >= lo && hi - lo <= 40) return Array.from({ length: hi - lo + 1 }, (_, k) => `${f[1]}${lo + k}`);
  }
  return [from, to];
}

const MASTER = new RegExp(
  [
    "(?<link>impl/research/[\\w.-]+\\.md)",
    "(?<lld>lld/\\d{2})",
    "(?<rfc>RFC\\s+\\d+)",
    "(?<r>(?<![\\w-])R\\d+(?![\\w-]))",
    "(?<rdoc>(?<![\\w-])r\\d+(?![\\w-]))",
    "(?<impl>\\b(?:[Oo]rchestration|[Ee]nvironment|[Cc]onventions|[Tt]esting|[Ss]pend)\\b(?=\\]?\\s*§))",
    '(?<evid>(?<![\\w:-])(?:b2a|b2b|b2c|b3|S\\d+c?|V1(?=\\s*§)|B3(?=\\s+(?:spike|"|“))|[Bb]atch\\s+(?:2[abc]|3))(?![\\w-]))',
    `(?<sec>§§?\\s*(?:${NUM}|[A-Z])(?:\\s*${RANGE_SEP}\\s*(?:${NUM}|[A-Z]))?)`,
    "(?<rev>Revision\\s+\\d+)",
    "(?<spike>\\bspikes?\\s+\\d+(?:\\s+and\\s+\\d+)?)",
    "(?<dsec>(?<![\\w:.-])D\\d+(?:\\.\\d+)?(?![\\w-]))",
    `(?<dec>(?<![\\w:.-])${DEC_ID}(?![\\w-]|\\.\\d))`,
    "(?<dec2>(?<![\\w:.-])[A-Z]\\d+[a-z]?(?![\\w-]|\\.\\d))",
    '(?<quote>"[^"\\n]+")',
    "(?<semi>;)",
  ].join("|"),
  "g",
);

/**
 * @param {string} text the "Read first" paragraph
 * @param {{ docForLld: (n: string) => string|null, docForR: (n: string) => string|null,
 *           docForResearch: (n: string) => string|null,
 *           docForEvidence: (key: string, token: string) => string|null }} resolvers
 * @returns {{ refs: object[], unresolved: object[] }}
 *   refs: { kind: "section", doc, section, rows?, label } | { kind: "heading", doc, text, soft, label }
 *         | { kind: "decision", id, label }
 *   unresolved: { text, reason }
 */
export function parseReadFirst(text, resolvers) {
  MASTER.lastIndex = 0;
  const clean = text.replace(/\]\([^)]*\)/g, "]").replace(/[`*]/g, "");
  const refs = [];
  const unresolved = [];
  const lld11 = resolvers.docForLld("11");
  let doc = null; // { path, label } | { external }
  let decisionMode = false;
  let segmentHasSection = false;
  let prev = null; // "sec" | "qualifier" | "doc" | ...
  let prevEnd = 0;

  const setDoc = (path, label, extra = {}) => {
    doc = path ? { path, label, ...extra } : null;
    decisionMode = Boolean(extra.lld11);
    segmentHasSection = false;
    prev = "doc";
  };

  const addSection = (id, rows) => {
    if (decisionMode && lld11) {
      refs.push({ kind: "section", doc: lld11, section: id, rows, label: `lld/11 §${id}` });
    } else if (!doc) {
      unresolved.push({ text: `§${id}`, reason: "no document in scope" });
    } else if (doc.external) {
      unresolved.push({
        text: `${doc.external} §${id}`,
        reason: "external document, not in this repository",
      });
    } else {
      refs.push({ kind: "section", doc: doc.path, section: id, rows, label: `${doc.label} §${id}` });
    }
    segmentHasSection = true;
  };

  const addDecision = (id) => {
    refs.push({ kind: "decision", id, label: id });
    decisionMode = true;
    prev = "dec";
  };

  for (let match = MASTER.exec(clean); match; match = MASTER.exec(clean)) {
    const g = match.groups;
    const token = match[0];
    const between = clean.slice(prevEnd, match.index);
    prevEnd = MASTER.lastIndex;

    if (g.link) {
      setDoc(`docs/${g.link}`, g.link);
    } else if (g.lld) {
      const number = token.slice(4);
      const path = resolvers.docForLld(number);
      if (!path) unresolved.push({ text: token, reason: "no such design document" });
      setDoc(path, `lld/${number}`, { lld11: number === "11" });
    } else if (g.rfc) {
      doc = { external: token };
      decisionMode = false;
      segmentHasSection = false;
      prev = "doc";
    } else if (g.r) {
      const path = resolvers.docForR(token.slice(1));
      if (!path)
        unresolved.push({ text: token, reason: "no design document has this R-number in its header" });
      setDoc(path, token);
    } else if (g.rdoc) {
      const path = resolvers.docForResearch(token.slice(1));
      if (!path) unresolved.push({ text: token, reason: "no research document has this number" });
      setDoc(path, token);
    } else if (g.impl) {
      setDoc(IMPL_DOCS[token.toLowerCase()], token.toLowerCase());
    } else if (g.evid) {
      const path = resolvers.docForEvidence(token.toLowerCase().replace(/^batch\s+/, "b"), token);
      if (!path)
        unresolved.push({ text: token, reason: "no evidence document or spike entry has this name" });
      setDoc(path, token, { evidence: true });
      // Evidence documents also cite sub-entries without a section sign: "S7 B1–B3", "S7 A4, B1–B4".
      const tail = /^\s*((?:[A-C]\d+(?:\s*(?:–|-)\s*[A-C]\d+)?(?:\s*,\s*|\s+and\s+)?)+)/.exec(
        clean.slice(MASTER.lastIndex),
      );
      if (tail && path) {
        for (const part of tail[1].split(/\s*,\s*|\s+and\s+/).filter(Boolean)) {
          const range = /^([A-C])(\d+)\s*(?:–|-)\s*[A-C](\d+)$/.exec(part.trim());
          if (range) {
            for (let n = Number(range[2]); n <= Number(range[3]); n++) {
              refs.push({
                kind: "section",
                doc: path,
                section: `${range[1]}${n}`,
                label: `${token} ${range[1]}${n}`,
              });
            }
          } else if (/^[A-C]\d+$/.test(part.trim())) {
            refs.push({ kind: "section", doc: path, section: part.trim(), label: `${token} ${part.trim()}` });
          }
        }
        MASTER.lastIndex += tail[0].length;
        prevEnd = MASTER.lastIndex;
        segmentHasSection = true;
      }
    } else if (g.sec) {
      const plural = token.startsWith("§§");
      const m = new RegExp(`^§§?\\s*(${NUM}|[A-Z])(?:\\s*${RANGE_SEP}\\s*(${NUM}|[A-Z]))?$`).exec(token);
      const items = (m[2] ? expandRange(m[1], m[2]) : [m[1]]).map((id) => ({ id, rows: undefined }));
      // Row numbers: "§13 #3", "§13 #11–12".
      const rowsOf = () => {
        const row = /^\s*#(\d+)(?:\s*(?:–|-)\s*(\d+))?/.exec(clean.slice(MASTER.lastIndex));
        if (!row) return undefined;
        MASTER.lastIndex += row[0].length;
        const lo = Number(row[1]);
        const hi = row[2] ? Number(row[2]) : lo;
        return Array.from({ length: Math.min(hi - lo + 1, 40) }, (_, k) => lo + k);
      };
      const firstRows = rowsOf();
      if (firstRows && items.length === 1) items[0].rows = firstRows;
      // A list continues: ", §7", ", 6, 8" (plural marker), "and 12". Each item carries its own rows.
      for (;;) {
        const rest = clean.slice(MASTER.lastIndex);
        const next = new RegExp(
          `^\\s*(?:,\\s*(?:and\\s+)?|and\\s+)(§?)\\s*(${NUM}|[A-Z](?![a-z0-9]))(?:\\s*${RANGE_SEP}\\s*(${NUM}))?`,
        ).exec(rest);
        if (!next) break;
        const hasMark = next[1] === "§";
        if (!hasMark && !plural && !/\./.test(next[2])) break;
        const more = next[3] ? expandRange(next[2], next[3]) : [next[2]];
        MASTER.lastIndex += next[0].length;
        const moreRows = rowsOf();
        for (const id of more) items.push({ id, rows: more.length === 1 ? moreRows : undefined });
      }
      prevEnd = MASTER.lastIndex;
      // "§5 of lld/03, lld/04, ..." applies the section to each named document.
      const of = /^\s+of\s+((?:lld\/\d{2}(?:\s*,\s*(?:and\s+)?|\s+and\s+)?)+)/.exec(
        clean.slice(MASTER.lastIndex),
      );
      if (of) {
        const numbers = [...of[1].matchAll(/lld\/(\d{2})/g)].map((x) => x[1]);
        for (const number of numbers) {
          const path = resolvers.docForLld(number);
          if (!path) unresolved.push({ text: `lld/${number}`, reason: "no such design document" });
          else
            for (const { id, rows } of items)
              refs.push({ kind: "section", doc: path, section: id, rows, label: `lld/${number} §${id}` });
        }
        MASTER.lastIndex += of[0].length;
        prevEnd = MASTER.lastIndex;
        const lastNumber = numbers.at(-1);
        if (lastNumber)
          setDoc(resolvers.docForLld(lastNumber), `lld/${lastNumber}`, { lld11: lastNumber === "11" });
        segmentHasSection = true;
        prev = "sec";
        continue;
      }
      for (const { id, rows } of items) addSection(id, rows);
      prev = "sec";
    } else if (g.rev) {
      const n = token.replace(/\D/g, "");
      if (!doc || doc.external) unresolved.push({ text: token, reason: "no document in scope" });
      else
        refs.push({
          kind: "section",
          doc: doc.path,
          section: `Revision ${n}`,
          label: `${doc.label} ${token}`,
        });
      segmentHasSection = true;
      prev = "sec";
    } else if (g.spike) {
      if (!doc?.evidence) unresolved.push({ text: token, reason: "no evidence document in scope" });
      else
        for (const n of token.match(/\d+/g))
          refs.push({
            kind: "section",
            doc: doc.path,
            section: `Spike ${n}`,
            label: `${doc.label} spike ${n}`,
          });
      segmentHasSection = true;
      prev = "sec";
    } else if (g.dsec) {
      if (doc?.path && !decisionMode) {
        refs.push({
          kind: "section",
          doc: doc.path,
          section: token.toUpperCase(),
          label: `${doc.label} ${token.toUpperCase()}`,
        });
        segmentHasSection = true;
        prev = "sec";
      }
    } else if (g.dec || g.dec2) {
      // An identifier inside parentheses describes the section just cited ("R10 §2.2 (H12 and R5-5 rows)").
      const open =
        (clean.slice(0, match.index).match(/\(/g) ?? []).length -
        (clean.slice(0, match.index).match(/\)/g) ?? []).length;
      if (open > 0 || (g.dec2 && !decisionMode)) continue;
      const range = new RegExp(`^\\s*(?:–|to)\\s*(${DEC_ID})`).exec(clean.slice(MASTER.lastIndex));
      if (range) {
        for (const x of expandIdRange(token, range[1])) addDecision(x);
        MASTER.lastIndex += range[0].length;
        prevEnd = MASTER.lastIndex;
      } else addDecision(token);
    } else if (g.quote) {
      const phrase = token.slice(1, -1);
      const after = clean.slice(MASTER.lastIndex);
      const adjacent =
        (prev === "sec" || prev === "qualifier") &&
        /^[\s,(]*(?:and\s+)?$/.test(between) &&
        !between.includes(")");
      if (/^\s+sections?\b/.test(after)) {
        // `the "Interfaces to other stages" sections lld/03 §3`: a description, not a reference.
      } else if (adjacent) {
        prev = "qualifier";
      } else if (doc?.path && !doc.external) {
        refs.push({
          kind: "heading",
          doc: doc.path,
          text: phrase,
          soft: segmentHasSection,
          label: `${doc.label} "${phrase}"`,
        });
        prev = "heading";
      } else {
        unresolved.push({ text: token, reason: "quoted heading with no document in scope" });
      }
    } else if (g.semi) {
      decisionMode = false;
      segmentHasSection = false;
      prev = "semi";
    }
  }
  return { refs, unresolved };
}
