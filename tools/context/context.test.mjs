// Design: U31; M0-01b tests (the pointer command: fixture workspace and the real documents)
// The heading format (### M0-04 — …), the section format (### 2.4 …) and the reference formats are pinned
// against a fixture and against the real milestone and design documents, so a document edit that breaks
// extraction fails npm test.
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { makeWorkspace } from "../lib/tmp-workspace.mjs";
import { buildContext, buildDecision } from "./build.mjs";
import { Corpus } from "./docs.mjs";
import { expandIdRange, expandRange, parseReadFirst } from "./refs.mjs";

const realRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const fixture = () =>
  makeWorkspace({
    "docs/impl/milestones/M9-test.md": [
      "# Milestone M9",
      "",
      "### M9-01 — First package",
      "",
      "- **Care:** normal",
      "- **Package:** `packages/foundations`",
      "",
      "**Goal.** Do the first thing.",
      "",
      '**Read first.** R2 §2.4; lld/04 §2.5 "Hashing", §2.6; R3 §3 of lld/03, lld/04; `lld/11` K5–K7, A:M0-3, U1. Environment §1.',
      "",
      "**Done when.** It works.",
      "",
      "### M9-02 — Second package",
      "",
      "- **Package:** `packages/nowhere`",
      "",
      "**Read first.** R2 §9.9; `lld/11` K99; R7 §1.",
      "",
      "## Acceptance",
      "",
    ].join("\n"),
    "docs/lld/03-r2-render.md": [
      "# Cutroom v2 — LLD · R2: Render",
      "",
      "## 2. Decisions",
      "",
      "### 2.4 Probe data",
      "Probe text.",
      "",
      "#### 2.4.1 Sub",
      "Sub text.",
      "",
      "## 3. Interfaces",
      "Interfaces of render.",
    ].join("\n"),
    "docs/lld/04-r3-project.md": [
      "# Cutroom v2 — LLD · R3: Project",
      "",
      "## 2. Decisions",
      "",
      "### 2.5 Hashing",
      "Hash text.",
      "",
      "### 2.6 Storage",
      "Storage text.",
      "",
      "## 3. Interfaces",
      "Interfaces of project.",
    ].join("\n"),
    "docs/lld/11-integration-decisions.md": [
      "# Cutroom v2 — LLD · Integration Decisions",
      "",
      "## 18. Pre-build",
      "",
      "| # | Decision |",
      "|---|---|",
      "| K5 | five |",
      "| K6 | six |",
      "| K7 | seven |",
      "| A:M0-3 | keyed |",
      "- **U1. A bullet decision.** text",
    ].join("\n"),
    "docs/impl/02-environment.md": "# Environment\n\n## 1. Starting point\nStart text.\n",
    "packages/foundations/README.md": "# foundations readme\n",
  });

test("a fixture work package prints the block, every cited section and decision, and the README", () => {
  const ws = fixture();
  try {
    const r = buildContext(ws.root, "M9-01");
    assert.equal(r.found, true);
    assert.deepEqual(r.unresolved, []);
    assert.match(r.text, /### M9-01 — First package/);
    assert.match(r.text, /\*\*Done when\.\*\* It works\./);
    assert.doesNotMatch(r.text, /Second package/); // the block ends at the next heading
    assert.match(r.text, /Probe text\./); // R2 §2.4, mapped from the header "LLD · R2"
    assert.match(r.text, /Sub text\./); // a subsection belongs to its section
    assert.match(r.text, /Hash text\./); // lld/04 §2.5 by document number
    assert.match(r.text, /Storage text\./);
    assert.match(r.text, /Interfaces of render\./); // §3 of lld/03 ...
    assert.match(r.text, /Interfaces of project\./); // ... and of lld/04
    assert.match(r.text, /\| K5 \| five \|/); // K5–K7 expands to three rows
    assert.match(r.text, /\| K6 \| six \|/);
    assert.match(r.text, /\| K7 \| seven \|/);
    assert.match(r.text, /\| A:M0-3 \| keyed \|/);
    assert.match(r.text, /A bullet decision/);
    assert.match(r.text, /Start text\./); // impl document by name
    assert.match(r.text, /# foundations readme/);
    assert.match(r.text, /All references resolved\./);
  } finally {
    ws.cleanup();
  }
});

test("a reference to a missing section, decision, or package README is printed as unresolved, never dropped", () => {
  const ws = fixture();
  try {
    const r = buildContext(ws.root, "M9-02");
    const lines = r.text.split("\n").filter((l) => l.startsWith("unresolved:"));
    assert.equal(lines.length, 5, lines.join("\n"));
    assert.ok(lines.some((l) => /R2 §9\.9 \(no such section/.test(l)));
    assert.ok(lines.some((l) => /K99 \(no such decision/.test(l)));
    assert.ok(lines.some((l) => /R7 \(no design document has this R-number/.test(l)));
    assert.ok(lines.some((l) => /packages\/nowhere\/README\.md/.test(l)));
  } finally {
    ws.cleanup();
  }
});

test("an unknown work package is reported", () => {
  const ws = fixture();
  try {
    assert.equal(buildContext(ws.root, "M9-77").found, false);
    assert.equal(buildDecision(ws.root, "K6").found, true);
    assert.equal(buildDecision(ws.root, "NOPE1").found, false);
  } finally {
    ws.cleanup();
  }
});

test("ranges expand: sections, plural lists and identifiers", () => {
  assert.deepEqual(expandRange("1.1", "1.5"), ["1.1", "1.2", "1.3", "1.4", "1.5"]);
  assert.deepEqual(expandRange("8", "10"), ["8", "9", "10"]);
  assert.deepEqual(expandIdRange("K5", "K7"), ["K5", "K6", "K7"]);
  const resolvers = {
    docForLld: (n) => `lld${n}`,
    docForR: (n) => `r${n}`,
    docForResearch: () => null,
    docForEvidence: () => null,
  };
  const { refs } = parseReadFirst("Orchestration §§8–10 and 12; R1 §1.1–1.3, §1.7, 2.4.", resolvers);
  assert.deepEqual(
    refs.map((r) => `${r.doc}:${r.section}`),
    [
      "docs/impl/00-orchestration.md:8",
      "docs/impl/00-orchestration.md:9",
      "docs/impl/00-orchestration.md:10",
      "docs/impl/00-orchestration.md:12",
      "r1:1.1",
      "r1:1.2",
      "r1:1.3",
      "r1:1.7",
      "r1:2.4",
    ],
  );
});

test("the real milestone documents hold 81 work packages under the pinned heading format", () => {
  const corpus = new Corpus(realRoot);
  assert.equal(corpus.milestones.size, 81);
  for (const id of ["M0-01a", "M0-01b", "M0-02", "M2-08", "M4-08a", "M6-13"]) {
    assert.ok(corpus.milestones.has(id), `${id} missing`);
  }
  for (const id of corpus.milestones.keys()) {
    assert.match(corpus.milestoneBlock(id).text, /\*\*Read first\./, `${id} has no Read first paragraph`);
  }
});

test("each R-number maps to its design document through the document's own header", () => {
  const { lld } = new Corpus(realRoot);
  const expected = {
    0: "01-r0",
    1: "02-r1",
    2: "03-r2",
    3: "04-r3",
    4: "05-r4",
    5: "06-r5",
    6: "07-r6",
    7: "08-r7",
    9: "09-r9",
    10: "10-r10",
  };
  for (const [r, prefix] of Object.entries(expected)) {
    assert.ok(lld.byR.get(r)?.includes(prefix), `R${r} -> ${lld.byR.get(r)}`);
  }
  assert.ok(lld.byNumber.get("11")?.includes("11-integration-decisions"));
});

test("real section, D-section, revision and decision formats resolve", () => {
  const corpus = new Corpus(realRoot);
  const resolvers = {
    docForLld: (n) => corpus.lld.byNumber.get(n) ?? null,
    docForR: (n) => corpus.lld.byR.get(n) ?? null,
    docForResearch: (n) => corpus.researchDoc(n),
    docForEvidence: (k) => corpus.evidence.get(k) ?? null,
  };
  const { refs, unresolved } = parseReadFirst(
    'lld/04 §2.4; R3 §2.6 "Runtime"; R4 D5; R6 D6.1; R1 Revision 3; lld/11 G15, A:M0-3, B:SD1, L6, U25 to U27; b2b §8; environment §9.',
    {
      docForLld: resolvers.docForLld,
      docForR: resolvers.docForR,
      docForResearch: resolvers.docForResearch,
      docForEvidence: resolvers.docForEvidence,
    },
  );
  assert.deepEqual(unresolved, []);
  assert.equal(refs.filter((r) => r.kind === "decision").length, 7);
  for (const ref of refs) {
    if (ref.kind === "decision") assert.ok(corpus.decisionRows(ref.id).length > 0, `decision ${ref.id}`);
    else assert.ok(corpus.doc(ref.doc), ref.doc);
  }
  const out = buildContext(realRoot, "M0-02");
  assert.match(out.text, /## R1 §2\.4: 2\.4 /);
  assert.match(out.text, /## R6 D6\.1: D6\.1 /);
  assert.match(out.text, /### L6\b/);
});

test("wp-context M0-02 prints M0-02 and every cited section with no unresolved line", () => {
  const out = buildContext(realRoot, "M0-02");
  assert.equal(out.found, true);
  assert.deepEqual(out.unresolved, []);
  assert.ok(!/^unresolved:/m.test(out.text));
  assert.match(out.text, /^### M0-02 — Flick time/m);
  assert.ok(Buffer.byteLength(out.text) < 100 * 1024, "the output should stay a few tens of kilobytes");
});

test("nearly every real work package resolves all its references", () => {
  const corpus = new Corpus(realRoot);
  let clean = 0;
  for (const id of corpus.milestones.keys()) if (buildContext(realRoot, id).unresolved.length === 0) clean++;
  assert.ok(clean >= 70, `only ${clean} of ${corpus.milestones.size} work packages resolve every reference`);
});
