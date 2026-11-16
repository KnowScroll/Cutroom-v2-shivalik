# Target repository state: KnowScroll/Cutroom-v2-shivalik

**Written:** 15 November 2026, about 15:20 IST (09:50 UTC)
**Method:** read-only. `gh` queries with the logged-in account `XZNON`, and a `git clone` into an empty scratch folder. Nothing in the repository was run, and no issue, pull request, branch or setting was created or changed. Local file times below are IST; GitHub times are UTC.
**Summary:** the repository is a private, completely empty repository created today at 09:39 UTC. It has no commits, no branches, no files, no issues, no pull requests, no workflows, no secrets and only GitHub's nine default labels. The logged-in account is an admin. Nothing in it can conflict with the planned monorepo. The real constraints come from the organisation's Free plan and from the local implementation documents, which currently assume a local-only repository.

## 1. Access

| Item | Observed |
|---|---|
| Owner | `KnowScroll` (organisation, plan `free`) |
| Visibility | Private |
| Created / last pushed | 2026-11-15 09:39:23 UTC / 2026-11-15 09:39:24 UTC (creation only) |
| Default branch | The REST API reports `main` as the default-branch setting. No branch actually exists: GraphQL returns an empty `defaultBranchRef`, and the branch list is empty. |
| Account permission | `viewerPermission: ADMIN`, `viewerCanAdminister: true`; REST `permissions` gives admin, maintain, push, triage and pull all true |
| Token scopes | `gist`, `read:org`, `repo`, `workflow`. There is no `read:project` or `project` scope. |
| Can create issues | Yes, inferred: issues are enabled and the account is an admin with the `repo` scope. Not tested, because the brief forbids creating any. |
| Can push branches | Yes, inferred from push and admin permission. The clone succeeded, and `git ls-remote` returns no refs. |
| Can add or edit Actions workflows | Yes, inferred: the token has the `workflow` scope and the account is an admin. |
| Can change Actions settings, secrets and variables | Yes, inferred from admin. The settings endpoints answered read requests. |
| Branch protection and rulesets | **Not available.** Both endpoints return HTTP 403 with the message "Upgrade to GitHub Pro or make this repository public to enable this feature." |

Nothing was refused except branch protection and rulesets, which this plan does not provide, and GitHub Projects, which this token cannot read (section 6).

## 2. Contents

| Item | Observed |
|---|---|
| Files | None. The clone contains only `.git/`, and Git reports "You appear to have cloned an empty repository." |
| Directory tree | None |
| Languages | None |
| Size | `diskUsage` 0, REST `size` 0 |
| Commits | 0. The commits API returns HTTP 409, "Git Repository is empty." |
| Authors | 0 |
| First and latest commit | None |
| Branches | None |
| Tags / releases | None / none |
| Description, topics, licence | Empty / none / none |
| Community health | 0 %: no README, licence, contributing guide, code of conduct, issue template or pull-request template |

Clone location, holding only `.git/`: `C:\Users\XZNON\AppData\Local\Temp\claude\b56320f5a3d82eb0\75eddf41-4d08-4859-bc4a-ddc5947e3ab1\scratchpad\repos\cutroom-v2-shivalik`

## 3. Is there already code?

No. The repository has no code, no package manifest, no test runner and no lint configuration. There is therefore nothing that does or does not follow the design documents.

## 4. Documents

**In the repository:** none. No Markdown or design document exists there.

**Local design set at `C:\Users\XZNON\cutroom-v2`:** 65 files, 5,981,036 bytes in total. The local folder is not a Git repository, so it has no history to carry over. All 56 Markdown files read use LF line endings; the off-limits file was not checked. Sizes and times were taken at about 15:17 IST. The `impl/milestones/` folder's modification time changed to 15:19 during this inspection, so other sessions may still be editing these files. The one-line summaries below are each file's first heading.

| Folder | Bytes |
|---|---|
| `hld/` | 80,027 |
| `lld/` | 622,752 |
| `research/` (of which `research/evidence/` is 4,402,385) | 4,625,336 |
| `impl/` (of which `impl/milestones/` is 255,851; `impl/reports/` is empty) | 323,303 |

### Root

| File | Bytes | Modified | Summary |
|---|---|---|---|
| `VISION.md` | 13,098 | 2026-11-14 01:08 | Product vision |
| `AGENT.md` | 19,118 | 2026-11-15 01:09 | Agent and contributor guidance |
| `CLAUDE.md` | 3,390 | 2026-11-15 14:41 | Rules for every session and subagent |
| `HLD-ENTRY.md` | 15,128 | 2026-11-14 17:49 | Full-system HLD entry and decision baseline |
| `VERIFICATION.md` | 4,857 | 2026-11-14 01:09 | Documentation verification |
| `cutroom-2d-compiler-language-and-engine-research.md` | 15,616 | 2026-11-14 17:49 | Overall research and subsystem index |
| `cutroom-v3.1-full-system-architecture.md` | 258,411 | 2026-11-14 00:21 | **Not opened** (the off-limits v3.1 archive). Only its existence and size are recorded. |

### `hld/`

| File | Bytes | Modified | Summary |
|---|---|---|---|
| `01-phase-a-system-boundaries-and-ownership.md` | 16,480 | 2026-11-14 00:21 | Phase A: boundaries and ownership |
| `02-phase-b-production-lifecycle-and-autonomous-quality.md` | 33,043 | 2026-11-14 00:21 | Phase B: production lifecycle, coordination and autonomous quality |
| `03-phase-c-integration-contracts.md` | 30,504 | 2026-11-14 00:46 | Phase C: integration contracts |

### `lld/`

| File | Bytes | Modified | Summary |
|---|---|---|---|
| `00-design-process-and-roadmap.md` | 8,535 | 2026-11-15 14:45 | Design process and roadmap |
| `01-r0-framing-decisions.md` | 5,943 | 2026-11-15 01:03 | R0: framing decisions |
| `02-r1-foundations.md` | 18,092 | 2026-11-15 01:17 | R1: shared foundations |
| `03-r2-components-and-rendering.md` | 57,178 | 2026-11-15 01:16 | R2: visual components and rendering |
| `04-r3-project-model-and-storage.md` | 77,528 | 2026-11-15 01:18 | R3: project model, DSL/AST, patches, versioning, storage |
| `05-r4-compiler-and-render-plan.md` | 61,694 | 2026-11-15 01:10 | R4: compiler, render plan, timing solver, spatial/event contracts |
| `06-r5-scheduler-and-recovery.md` | 51,312 | 2026-11-15 01:15 | R5: scheduler, artifact futures, cache, recovery |
| `07-r6-harness.md` | 73,457 | 2026-11-15 14:45 | R6: Director harness, tools, plugins, Reviewer, experiment agent |
| `08-r7-studio-tools.md` | 70,607 | 2026-11-15 14:44 | R7: production studio tools |
| `09-r9-quality.md` | 65,103 | 2026-11-15 14:45 | R9: quality checks, review, diagnostics, stopping rules |
| `10-r10-integration-acceptance-and-build-plan.md` | 34,686 | 2026-11-15 14:46 | R10: integration acceptance, spike register, build plan |
| `11-integration-decisions.md` | 98,617 | 2026-11-15 14:36 | Integration decisions (R2 to R9) |

### `research/`

| File | Bytes | Modified | Summary |
|---|---|---|---|
| `01-dsl-compiler-executable-render-ir.md` | 38,924 | 2026-11-14 00:21 | DSL, compiler, executable 2D render IR |
| `02-layers-compositing-and-incremental-revision.md` | 12,685 | 2026-11-14 00:21 | Layers, composition, incremental revision |
| `03-animation-behavior-and-capability-growth.md` | 21,778 | 2026-11-14 00:21 | Animation, behaviour, character assets |
| `04-asset-retrieval-rights-and-preparation.md` | 12,539 | 2026-11-14 00:21 | Real-media retrieval, rights, preparation |
| `05-agentic-harness-and-experiment-agent.md` | 29,248 | 2026-11-14 00:21 | Agentic harness, experiment agent, recovery |
| `06-integration-evaluation-and-source-register.md` | 23,816 | 2026-11-14 00:21 | Integration, evaluation, source register |
| `07-production-coordination-futures-and-spatial-contracts.md` | 17,831 | 2026-11-14 00:21 | Coordination, spatial contracts, futures |
| `08-versioning-lineage-and-experiment-memory.md` | 11,713 | 2026-11-14 00:21 | Versioning, lineage, experiment memory |
| `09-quality-evaluation-review-and-recovery.md` | 10,323 | 2026-11-14 00:21 | Quality, diagnostic review, recovery |
| `10-spike-evidence-log.md` | 30,667 | 2026-11-15 01:08 | Spike evidence log |
| `11-provider-cost-and-audio-research.md` | 13,427 | 2026-11-14 14:21 | Provider, cost, language and audio |

### `research/evidence/`

| File | Bytes | Modified | Summary |
|---|---|---|---|
| `b2a-colour-mux-mix.md` | 29,600 | 2026-11-14 16:18 | B2a spikes: colour chain, mux offset, mix |
| `b2b-sqlite-node.md` | 32,150 | 2026-11-14 17:09 | B2b: SQLite through `node:sqlite` |
| `b2c-minimax-review.md` | 24,306 | 2026-11-14 16:29 | B2c: MiniMax measurement spikes |
| `b3-patches-and-restart.md` | 42,645 | 2026-11-14 19:12 | B3: patch authoring and segment restart |
| `codex-consistency-pass1.md` | 55,941 | 2026-11-14 16:43 | Consistency pass 1 (opens with a BLOCKING section) |
| `codex-consistency-pass2.md` | 17,994 | 2026-11-14 16:43 | Consistency pass 2 (same form) |
| `codex-consistency-pass3.md` | 11,624 | 2026-11-14 17:42 | Consistency pass 3 (same form) |
| `codex-consistency-pass4.md` | 18,565 | 2026-11-14 19:23 | Fourth mechanical consistency pass |
| `consistency-pass5.md` | 22,086 | 2026-11-15 01:19 | Fifth mechanical consistency pass |
| `s3-s5-s6-minimax.md` | 24,509 | 2026-11-14 15:56 | S3, S5, S6: MiniMax measurement spikes |
| `s4-render-host.md` | 34,851 | 2026-11-14 15:54 | S4: render host spike |
| `s7-pixi-hardening-follow.md` | 42,509 | 2026-11-14 17:18 | S7: PixiJS, shim hardening, anchor-follow |
| `s2-contact-sheets/` (5 PNG files) | 302,320 to 971,450 each | 2026-11-14 14:21 | Contact sheets: abstract, character, chart, diagram, kinetic |
| `s6-contact-sheets/` (3 PNG files) | 212,096 to 237,679 each | 2026-11-14 15:40 | Contact sheets: cat controls and frames |

The largest file is 971,450 bytes, far below GitHub's 100 MB per-file limit.

### `impl/`

| File | Bytes | Modified | Summary |
|---|---|---|---|
| `00-orchestration.md` | 11,601 | 2026-11-15 14:46 | Orchestration rules |
| `01-repo-and-conventions.md` | 10,109 | 2026-11-15 14:37 | Repository layout and conventions |
| `02-environment.md` | 20,599 | 2026-11-15 15:00 | Environment |
| `03-testing.md` | 19,521 | 2026-11-15 15:00 | Testing |
| `04-spend.md` | 5,622 | 2026-11-15 14:41 | Live-call spend |
| `milestones/M0-foundations.md` | 32,488 | 2026-11-15 15:09 | M0: foundations |
| `milestones/M1-render-core.md` | 35,316 | 2026-11-15 15:13 | M1: render core |
| `milestones/M2-project-and-compiler.md` | 37,998 | 2026-11-15 15:06 | M2: project and compiler |
| `milestones/M3-scheduler.md` | 32,560 | 2026-11-15 15:12 | M3: scheduler |
| `milestones/M4-harness-and-first-light.md` | 43,540 | 2026-11-15 15:12 | M4: harness and first light |
| `milestones/M5-sound.md` | 31,086 | 2026-11-15 15:07 | M5: sound |
| `milestones/M6-quality-and-delivery.md` | 43,564 | 2026-11-15 15:13 | M6: quality and delivery |

### Comparison

No document exists in both places, because the repository has no files. Every local document would be new in the repository, so the question of same, older or newer copies does not arise. The table below gives SHA-256 prefixes of the root documents as a baseline for later comparison; the v3.1 archive was not hashed.

| File | SHA-256 (first 12) |
|---|---|
| `VISION.md` | `5cba7d72d348` |
| `AGENT.md` | `419f178e9129` |
| `HLD-ENTRY.md` | `62b5db0740b5` |
| `CLAUDE.md` | `32606249490f` |
| `VERIFICATION.md` | `7aff91478830` |
| `cutroom-2d-compiler-language-and-engine-research.md` | `9e64249b0df9` |

A search of the local documents for `Cutroom-v2-shivalik`, `github.com/KnowScroll`, `gh issue`, `GitHub Actions` and `.github/workflows` found no matches; the v3.1 archive was excluded from the search. The local design set does not yet mention this repository or any use of GitHub.

## 5. Agent files

| File | In the repository | Local |
|---|---|---|
| `CLAUDE.md` | No | Yes (3,390 bytes) |
| `AGENTS.md` / `AGENT.md` | No | `AGENT.md` only (19,118 bytes) |
| `.claude/` | No | No |
| `handoff.md` | No | No. `impl/00-orchestration.md` §10 refers to it, but it does not exist yet. |
| `impl/STATE.md` | No | No. `impl/00-orchestration.md` §10 refers to it, but it does not exist yet. |
| `impl/reports/` | No | The folder exists and is empty. |

## 6. GitHub usage so far

| Item | Observed |
|---|---|
| Issues | 0 open, 0 closed. Issues are enabled. |
| Pull requests | 0 |
| Labels | GitHub's 9 defaults only: `bug`, `documentation`, `duplicate`, `enhancement`, `good first issue`, `help wanted`, `invalid`, `question`, `wontfix` |
| Milestones | 0 |
| Projects (v2) | **Not checked.** The GraphQL query was refused because the token lacks the `read:project` scope. `hasProjectsEnabled` is true. |
| Discussions / wiki / Pages | Disabled / disabled / no Pages site (404) |
| Workflows | 0 (`.github/workflows/` does not exist; the Actions workflows API returns `total_count: 0`) |
| Workflow runs | 0 |
| Issue and pull-request templates | None |
| Actions | Enabled, `allowed_actions: all`, SHA pinning not required. The default `GITHUB_TOKEN` permission is **read**, and workflows may not approve pull requests. `access_level: none`, so other repositories cannot use workflows from this one. |
| Actions secrets | 0 repository secrets; 0 organisation secrets visible to this repository |
| Actions variables | 0 repository variables; 0 organisation variables. The organisation-variables call failed twice on a network error and returned `total_count: 0` on the third attempt. |
| Environments | 0 |
| Webhooks / deploy keys / autolinks | 0 / 0 / 0 |
| Merge settings | Merge commits, squash and rebase are all allowed. Auto-merge is off, "delete branch on merge" is off, and web commit sign-off is not required. |

## 7. Who works here

There are no commit authors and no issue authors yet.

Three accounts have access, and all three are **admin** on this repository: `XZNON`, `Legend101Zz` and `Asrani-Aman`. These are also the organisation's only three members. The repository has no direct collaborators, no outside collaborators, no teams and no pending invitations. The organisation's default member permission is `read`, so admin here most likely comes from organisation ownership (inferred). The organisation does not require two-factor authentication.

Other repositories in the organisation, listed but not inspected: `knowscroll` (public, updated 2026-11-12), `Cutroom` (public, TypeScript, default branch `main`, updated 2026-10-17), `test-DSL` (private), `Knowscroll-Backend` (private), `knowscroll-frontend` (public) and `DSLEngine` (private). The repository named `Cutroom` could be mistaken for this one.

## 8. Risks for using it as the build's home

| Risk | Detail |
|---|---|
| Overwriting existing content | **None.** The repository is empty, so `packages/`, `tests/`, `impl/`, `lld/`, `CLAUDE.md` and `handoff.md` would all be new. The first push creates `main`. |
| No branch protection or required checks | The organisation is on GitHub Free and the repository is private, so branch protection and rulesets both return 403. `main` cannot be protected, required status checks cannot be enforced, and any of the three admins can push or force-push to `main`. The 403 message names the two ways out: upgrade the plan or make the repository public. Until then, "main always passes its tests" can be kept only by convention and by CI reporting results. |
| Actions minutes | Private repositories on GitHub Free draw on a monthly minutes quota shared across the organisation. This comes from GitHub's published plan terms, not from this inspection; billing was not queried. Long render or browser tests in CI would consume it. |
| Read-only `GITHUB_TOKEN` | Workflows that open or label issues, comment, or push need an explicit `permissions:` block. Workflows cannot approve pull requests. |
| No secrets | No secrets exist in the repository or the organisation. Any workflow that needs a model key requires a repository secret to be added first. Adding one would expose the key to the workflows of all three admins (inferred). |
| Projects not visible | If the sister repository's method uses GitHub Projects, this token needs the `project` scope added before those boards can be read or written. |
| Labels and templates | Only the default labels exist, and there are no issue or pull-request templates. Labels from the sister method must be created. |
| Local documents assume a local-only repository | `impl/00-orchestration.md` §9 says "The repository is local. **Nothing is pushed anywhere.**" `impl/01-repo-and-conventions.md` §1 places the repository at `~/cutroom/`. Both conflict with using this GitHub repository, so they need a dated revision before the build starts (the revision is an inference; the conflicting text is observed). |
| v3.1 archive could be published | `cutroom-v3.1-full-system-architecture.md` (258,411 bytes) sits at the local root. Copying the local folder wholesale would commit it to a repository shared with two other admins. The layout in `impl/01-repo-and-conventions.md` §1 does not list it. That layout also omits `VERIFICATION.md` and `cutroom-2d-compiler-language-and-engine-research.md`, so a decision is needed for each. |
| Line endings | All 56 local Markdown files checked are LF. A Windows checkout with `core.autocrlf` on could convert them; a `.gitattributes` file would fix this (inferred). |
| Repository size | About 6 MB, mostly the eight PNG contact sheets. This is not a concern. |
| Name confusion | The organisation also has a public `Cutroom` repository. The two could be mixed up in links and `gh -R` arguments. |
