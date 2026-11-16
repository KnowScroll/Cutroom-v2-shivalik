# Cutroom v2 — LLD · Design Process and Roadmap

**Created:** 14 November 2026
**Status:** **ACCEPTED** (process and stage order). Stage contents are accepted one at a time; see the status table.
**Related:** [AGENT.md](../../AGENT.md) · [HLD entry](../HLD-ENTRY.md) · [R0 decisions](01-r0-framing-decisions.md) · [R1 foundations](02-r1-foundations.md) · [Spike evidence log](../research/10-spike-evidence-log.md)

## 1. Strategy — design everything first, verify with spikes, then build

**ACCEPTED (14 Nov 2026):** No product implementation starts until every stage below has an accepted design and the freeze review has passed. Small throwaway checks ("spikes") are allowed during design to verify the claims a design depends on.

### 1.1 The loop for every stage

1. Research the problem and the existing technology.
2. Bring a proposal with alternatives and trade-offs.
3. Discuss; the user decides.
4. Run spikes on any claim the design depends on.
5. Write the stage's LLD and record decisions and evidence. This happens only after the stage is accepted.

### 1.2 Claims table

Every LLD ends with a table of the claims it relies on. Each claim has one label:

| Label | Meaning |
|---|---|
| **VERIFIED by spike** | Measured by us, with numbers in the [evidence log](../research/10-spike-evidence-log.md) |
| **VERIFIED by source** | Stated in primary documentation or a licence, with a link |
| **VERIFIED by arithmetic** | Follows from a derivation shown beside the claim (K8 in the [integration decisions](11-integration-decisions.md)) |
| **SECONDARY** | Third-party source only; check before relying on it |
| **ASSUMED** | Not checked; the table says what breaks if it is wrong |

A stage is finished when no ASSUMED claim sits on a critical path.

### 1.3 Spike rules

- A spike answers one factual question with a measurement.
- It runs in a scratch folder outside the project, is announced before it runs, and its code is deleted afterwards. Only the results are kept: numbers, and small evidence files such as contact sheets where they help.
- No spike code is reused as product code.
- Spikes concentrate on the seams between subsystems, where paper designs usually fail.
- Spikes that spend money (API calls) have a stated cost cap.

### 1.4 Values that need real films

Reviewer thresholds, retry limits and stopping rules cannot be settled on paper. For these, the design fixes the mechanism and stores the value as a named, versioned setting with a starting default. The number is tuned once real films exist.

### 1.5 Depth follows risk

- **Full detail:** rendering, project model/DSL, compiler, scheduler, harness.
- **Interfaces and contracts only:** parts that plug in behind a stable contract, such as individual media providers, tutorial capture and additional audio engines.

### 1.6 Design freeze review (end of design)

1. A paper walkthrough of all six video domains (historical comedy, science documentary, art history, software tutorial, data reel, abstract motion graphics) through the finished LLDs.
2. The failure cases listed in HLD B4 and C11, traced through the design.
3. A review by a fresh agent that has not seen the design discussions, looking for contradictions between LLDs.
4. Explicit user approval to implement.

### 1.7 Build order is part of the design

Even with everything designed, the build starts with one thin film end to end and then widens. That plan is the last LLD (R10).

## 2. Stages and order

| Stage | Scope | Status (14 Nov 2026) |
|---|---|---|
| **R0** | Framing: where it runs, language, providers, budget, spike policy | **ACCEPTED** — [01](01-r0-framing-decisions.md) |
| **R1** | Shared foundations: time, identity, space, readiness, evidence | **ACCEPTED** — [02](02-r1-foundations.md) |
| **R2** | Visual component contract and rendering: component contract, shim, host page, sandbox, capture, encode, colour, fonts | **DECIDED** — [03](03-r2-components-and-rendering.md) |
| **R3** | Project model, DSL/AST, patches, versioning, storage | **DECIDED** — [04](04-r3-project-model-and-storage.md) |
| **R4** | Compiler, executable Render Plan, timing solver, spatial/event contracts (formerly R8) | **DECIDED** — [05](05-r4-compiler-and-render-plan.md) |
| **R5** | Scheduler, artifact futures, caching, recovery | **DECIDED** — [06](06-r5-scheduler-and-recovery.md) |
| **R6** | Harness runtime, tool catalogue, plugins, Reviewer and Experiment Agent runtime | **DECIDED** — [07](07-r6-harness.md). A thin custom loop was chosen |
| **R7** | Production Studio tools: audio, character performance, media acquisition and rights, research tools, charts, tutorial capture | **DECIDED**; the items the user held (audio engines, voice policy and others) were decided by the user on 15 November 2026 — [08](08-r7-studio-tools.md) |
| **R9** | Quality: check catalogue, Reviewer protocol, stopping rules, deliverable record | **DECIDED**; the items the user held (listening, labelling) were decided by the user on 15 November 2026 — [09](09-r9-quality.md) |
| **R10** | Spike register, integration acceptance plan, freeze review, build plan | **DECIDED** — [10](10-r10-integration-acceptance-and-build-plan.md) |
| — | Cross-stage decisions and the answers to every review finding | [11](11-integration-decisions.md) |

"DECIDED" means decided by the lead session under the user's delegation of 14 November 2026 (the user asked the lead to complete the technical design and to ask only where blocked). The stages were designed in the order R1 → R2 → R3 → R4 → R5 → R6 → R7 → R9 → R10, drafted in parallel against a shared set of interface decisions and then reconciled.

**What remains before implementation:** the user's explicit approval to implement. The user's decisions listed in [R10 §4.3](10-r10-integration-acceptance-and-build-plan.md#43-decisions-the-user-made-on-15-november-2026) were made on 15 November 2026 (section 17 of the [integration decisions](11-integration-decisions.md)). The build is started by the user from `handoff.md`.

### 2.1 Why this order

- **Foundations first.** All nine Phase C contracts share the same time, identity, space, readiness and evidence conventions (C0). They are cheap to decide and expensive to change later.
- **Rendering before compiler and scheduler.** It is the most uncertain area and needs measurement. It decides what the Render Plan must express, how work is split for scheduling, which cache tiers exist, and what quality checks can be done deterministically.
- **Project model after rendering, compiler after both.** The DSL is built from R1's types and refers to R2's components.
- **Harness framework chosen late.** Phase A3 makes the harness the most replaceable part, and its tools are the operations of the project model, compiler and scheduler. Choosing a framework first risks its conversation or workflow state becoming a second source of truth, which would break C0 invariant 2. The accepted harness architecture (one central Director, plugin-oriented, scoped delegation) is unchanged.
- **Quality rubrics late, instrumentation early.** The hooks that deterministic checks need are designed in R2.

## 3. Gaps the HLD did not name (found in the post-HLD review)

| Gap | Resolution |
|---|---|
| Where the system runs | R0: local machine, then a Linux VM |
| Implementation language | R0: TypeScript core, Python worker when first needed |
| AI audio policy | R0: AI music, sound effects and dialogue are allowed |
| Budget and time targets | R0: accepted targets |
| Whether measurement is allowed before LLDs | R0: spikes allowed under the rules in 1.3 |
| Whether LLMs can author good programmatic visuals | R2a; first evidence in spike S2 |

## 4. Deliberately left open

- A custom text DSL (deferred by the HLD; AST first).
- Distributed or multi-machine operation, until a single-machine bottleneck is measured.
- Cross-project capability promotion, learned ranking and reinforcement learning.
- UI surfaces (storyboard, timeline, stage). Constraint: every human edit must be expressible as the same semantic patch operations as an agent edit.
- Collaboration, interchange formats, 2.5D/3D, formal verification.

## 5. Document conventions for LLD work

- `lld/` holds accepted designs, one file per stage, each with a claims table.
- `research/` holds research findings and the spike evidence log. Findings are not decisions.
- Accepted HLD files under `hld/` are not edited.
- The v3.1 archive is not consulted (see [AGENT.md](../../AGENT.md)).
