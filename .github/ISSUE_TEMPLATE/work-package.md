---
name: Work package
about: One work package of a milestone document (impl/00 section 9; impl/01 section 7). The milestone document stays the source.
title: "M<n>-<nn> — <title>"
labels: ""
---

<!-- Design: impl/01 §7 (work package template), impl/00 §9 (U28). Paste the work package block from the milestone document unchanged. -->

Source: [milestone document at commit `<sha>`](../blob/<sha>/docs/impl/milestones/M<n>-<name>.md)

Depends on: #n, #m

### M<n>-<nn> — <title>

- **Care:** normal | high
- **Package:** packages/<name>  (and any test folder)
- **Depends on:** <work package IDs>     **Parallel with:** <IDs, or "none">
- **Live calls:** none | <what, and a dollar ceiling>

**Goal.** One or two sentences: what exists when this is done.

**Read first.** The exact design sections (document and section number) and the decisions in lld/11 (by identifier) that bind this work.

**Build.** The files to create and the public interface, using the design's names.

**Rules that are easy to get wrong.** The few points where a reasonable implementer would go astray, each with its design reference.

**Tests.** What must be tested and the pass criterion, with numbers where the design gives them.

**Done when.**
- [ ] ...

**Out of scope.** What a later work package does.
