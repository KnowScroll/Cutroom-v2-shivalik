# Cutroom v2 — Documentation Verification

**Date:** 14 November 2026  
**Scope:** Documentation consolidation and handoff; no product code, prototype, render or benchmark was run.

## Changes and reading path

- Added [VISION.md](../VISION.md), a roughly 1,600-word product north star derived from the complete original v3.1 document and reconciled with accepted HLD A–C.
- Updated [AGENT.md](../../AGENT.md) and the canonical [HLD-ENTRY.md](../HLD-ENTRY.md) to require the concise vision and task-relevant HLD/research; the original archive is consulted on demand.
- Retained [Cutroom-v2-HLD-ENTRY.md](Cutroom-v2-HLD-ENTRY.md) as a compatibility pointer. The supplied folder had this filename while existing links expected HLD-ENTRY.md; the complete entry now lives at the expected canonical path.
- Corrected stale phase status/navigation in the [research index](../research-index.md). HLD A–C is accepted; focused technology comparisons, subsystem LLDs and integration acceptance plans are next. Implementation remains separately gated.

## Fidelity review

The full original document, including its current-scope addenda, A–Z chapters and appendices, was reviewed against the accepted architecture. The following coverage map makes the condensation reviewable; it does not promote historical mechanisms into accepted v2 requirements.

| VISION.md coverage | Original v3.1 source sections | Accepted HLD reconciliation |
|---|---|---|
| Directed, editable films; initial reel target; persistent Space and human steering | Charter; A–B; S | A1, A5; B1, B3; C2, C9 |
| Factual evidence, beats, audience knowledge, shifting tone and visual attention | F; N; Y | A1, A6; B3–B4; C3, C5, C8 |
| Meaningful alternatives, quality diversity, multi-fidelity evidence, scoped search and recombination | P–Q; Z.9–Z.10 | A3–A4; B2.5, B3; C8 |
| Genuine media, identity, expressive acting, event relationships, capability adaptation | G; L–N; T.9 | A1, A6; B1–B2; C3, C5–C7 |
| Speech, selected takes, alignment uncertainty, music, silence, mix, captions and localization | O | A2; B2–B3; C5, C7, C9 |
| Semantic project, source maps, reversible scoped edits, locks and honest editability limits | E; H–J; R–S; U | A2, A5; B1.2–B1.4; C2, C6 |
| Central replaceable harness, dynamic work, early commitments, durable jobs, bounded resources and recovery | C–D; I–J; U–V; X | A2–A3; B1–B2; C0–C4, C10 |
| Actual-output review, diagnosis, Reviewer versus experiments, bounded autonomous completion | P–Q; Z | A4–A5; B3; C8–C9, C12 |
| Future 2.5D/3D, collaboration, portability, interchange, external harnesses and contextual learning | B; K; S–X | A1, A8; B5; C12–C13: future/open mechanisms, not selected implementations |
| Maglev, Picasso, Volcano and mathematician examples; invention and evidence discipline | Y; Z.9–Z.10; appendices | A7; B4; C11–C13: design cases adapted to current v2 limits |

Explicitly retained current constraints: 2D-first; no image/video-generation models; code-authored conventional graphics; eligible real media; one semantic master; default code components with optional richer graphs; logical layers independent of physical jobs; central autonomous Director; separate callable Reviewer and Experiment Agent; diagnostic-first checks; no routine human approval gate; no measured performance claims. Historical generation-model proposals, compulsory human approval and rigid universal low-level IR are not carried into the current baseline. Formal verification, learning methods and specific stacks retain their research/open status. The ICFP paper remains independent research.

## Integrity and link checks

SHA-256 comparison against the supplied originals confirms that the **full v3.1 archive, all three accepted HLD documents and all nine subsystem research papers are byte-for-byte unchanged**. Only AGENT.md, the supplied entry filename and the research index changed among original files. New files are VISION.md, canonical HLD-ENTRY.md and this report.

**Original v3.1 archive SHA-256:**

```text
0D81F91BC35321B9A972A4BA9F0D39CD90715F923418916BCA6633EC775B4539
```

All relative Markdown file/directory targets and fragment anchors in the complete package were checked, including the archive's explicit anchors and the entry's Phase C consistency-review link. There are no unresolved internal links. Original external research citations retain their historical evidence status; their live availability and current technical claims were not reverified in this documentation-only task.

The ZIP contains the complete Markdown tree with relative paths intact, including the unchanged archive and research. ZIP integrity and every packaged file's bytes were checked against the updated source folder. Temporary scripts and baseline copies are excluded.
