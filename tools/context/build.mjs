// Design: U31; impl/00 §4 (a brief starts from this output)
// Builds what `npm run wp-context -- <ID>` prints: the work package block verbatim, each design section
// its "Read first" line cites, the README of each package it touches, and each lld/11 decision it names.
// A reference that cannot be resolved goes on an "unresolved:" line and is never dropped.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Corpus, findHeading, findHeadingByText, findParagraph, sectionText } from "./docs.mjs";
import { parseReadFirst } from "./refs.mjs";

const SPIKE_LOG = "docs/research/10-spike-evidence-log.md";

function resolvers(corpus) {
  return {
    docForLld: (n) => corpus.lld.byNumber.get(n) ?? null,
    docForR: (n) => corpus.lld.byR.get(n) ?? null,
    docForResearch: (n) => corpus.researchDoc(n),
    docForEvidence: (key, token) => {
      const direct = corpus.evidence.get(key);
      if (direct) return direct;
      const log = corpus.doc(SPIKE_LOG);
      if (log && /^S\d+c?$/.test(token) && findHeading(log, token) >= 0) return SPIKE_LOG;
      return null;
    },
  };
}

function packagesIn(root, blockText) {
  const line = /^- \*\*Package:\*\*(.*)$/m.exec(blockText)?.[1] ?? "";
  const names = new Set([...line.matchAll(/packages\/([a-z][a-z-]*)/g)].map((m) => m[1]));
  if (/\b(?:all )?nine packages\b/.test(line)) {
    const dir = join(root, "packages");
    if (existsSync(dir))
      for (const e of readdirSync(dir, { withFileTypes: true })) if (e.isDirectory()) names.add(e.name);
  }
  return [...names].sort();
}

function renderDecision(id, rows) {
  return [`### ${id}`, ...rows.map((r) => `(${r.section})\n${r.text}`)].join("\n");
}

/** @returns {{ found: boolean, text: string, unresolved: string[] }} */
export function buildContext(root, id) {
  const corpus = new Corpus(root);
  const block = corpus.milestoneBlock(id);
  if (!block)
    return { found: false, text: `no work package '${id}' in docs/impl/milestones/\n`, unresolved: [] };

  const unresolved = [];
  const out = [];
  out.push(`# Work package ${id}: ${block.title}`, `Source: ${block.rel}`, "", block.text, "");

  const readFirst = Corpus.readFirst(block.text);
  const parsed = readFirst ? parseReadFirst(readFirst, resolvers(corpus)) : { refs: [], unresolved: [] };
  for (const u of parsed.unresolved) unresolved.push(`${u.text} (${u.reason})`);

  const seen = new Set();
  const sections = [];
  const decisions = [];
  for (const ref of parsed.refs) {
    const key = ref.kind === "decision" ? `d:${ref.id}` : `${ref.kind}:${ref.doc}:${ref.section ?? ref.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (ref.kind === "decision") {
      const rows = corpus.decisionRows(ref.id);
      if (rows.length === 0)
        unresolved.push(`lld/11 ${ref.id} (no such decision in the integration decisions)`);
      else decisions.push(renderDecision(ref.id, rows));
      continue;
    }
    const doc = corpus.doc(ref.doc);
    if (!doc) {
      unresolved.push(`${ref.label} (document ${ref.doc} is missing)`);
      continue;
    }
    const h = ref.kind === "heading" ? findHeadingByText(doc, ref.text) : findHeading(doc, ref.section);
    if (h < 0) {
      // A quoted name may be a bold-named paragraph inside a section rather than a heading.
      const paragraph = ref.kind === "heading" ? findParagraph(doc, ref.text) : null;
      if (paragraph) sections.push(`## ${ref.label}\n(${ref.doc})\n\n${paragraph}`);
      else if (!(ref.kind === "heading" && ref.soft))
        unresolved.push(`${ref.label} (no such section in ${ref.doc})`);
      continue;
    }
    let body = sectionText(doc, h);
    if (ref.rows?.length) {
      // "§13 #3": the numbered row of the section's table.
      const lines = body.split("\n");
      const picked = ref.rows
        .map((n) =>
          // A row's first cell may name several numbers ("11, 12").
          lines.find(
            (line) => line.startsWith("|") && (line.split("|")[1] ?? "").split(/[\s,]+/).includes(String(n)),
          ),
        )
        .filter(Boolean);
      if (picked.length === 0) {
        unresolved.push(`${ref.label} #${ref.rows.join(",")} (no such row in ${ref.doc})`);
        continue;
      }
      body = `${doc.headings[h].text}\n${[...new Set(picked)].join("\n")}`;
    }
    sections.push(`## ${ref.label}: ${doc.headings[h].text}\n(${ref.doc})\n\n${body}`);
  }

  out.push("# Design sections cited by Read first", "");
  out.push(sections.length ? sections.join("\n\n") : "(none)", "");
  out.push("# Decisions named (docs/lld/11-integration-decisions.md)", "");
  out.push(decisions.length ? decisions.join("\n\n") : "(none)", "");

  out.push("# READMEs of the packages this work package touches", "");
  const packages = packagesIn(root, block.text);
  if (packages.length === 0) out.push("(none: this work package is outside packages/)");
  for (const name of packages) {
    const path = join(root, "packages", name, "README.md");
    if (existsSync(path))
      out.push(
        `## packages/${name}/README.md`,
        "",
        readFileSync(path, "utf8").replace(/\r\n/g, "\n").trimEnd(),
        "",
      );
    else unresolved.push(`packages/${name}/README.md (package or README missing)`);
  }

  out.push("# References");
  if (unresolved.length === 0) out.push("All references resolved.");
  for (const u of unresolved) out.push(`unresolved: ${u}`);
  return { found: true, text: `${out.join("\n")}\n`, unresolved };
}

/** `wp-context decision <ID>`: every row of lld/11 that names the decision. */
export function buildDecision(root, id) {
  const corpus = new Corpus(root);
  const rows = corpus.decisionRows(id);
  if (rows.length === 0)
    return { found: false, text: `no decision '${id}' in docs/lld/11-integration-decisions.md\n` };
  return { found: true, text: `${renderDecision(id, rows)}\n` };
}
