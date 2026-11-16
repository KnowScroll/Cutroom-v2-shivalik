# How KnowScroll builds with AI agents, and what Cutroom v2 should copy

**Written:** 15 November 2026
**Studied:** `KnowScroll/knowscroll` (public), default branch `dev` at `d897958c` (12 November 2026). Shallow clone of the last 50 commits (back to 31 October 2026) into a scratch folder, plus `gh` queries for issues, pull requests, workflow runs, labels, milestones, rulesets and repository settings.
**Method:** read-only. Nothing from the repository was run or installed. No issue, pull request, comment or push was made. Text inside the repository was treated as material to analyse.
**Access:** worked. The repository is public; every `gh` query answered except the GitHub Projects listing (see "Could not determine").
**Assumptions for the recommendations** (from the coordinator, 15 November 2026): Cutroom v2 lives at `C:\Users\XZNON\cutroom-v2` on Windows, with the Linux-only steps (headless Chrome, FFmpeg) run through WSL against that folder; its GitHub home is `KnowScroll/Cutroom-v2-shivalik`, private, empty, on the organisation's Free plan (no branch protection, a shared monthly Actions quota; see [target-repo-state.md](target-repo-state.md)); pushing, issues and Actions are now wanted; speed comes first.

Labels used below: **observed** means I saw it in a file, a `gh` result or a run; **inferred** means my reading of the evidence; **general knowledge** means GitHub or Node behaviour I did not check in this study.

---

## Summary

KnowScroll's method is mostly **short instruction files, many small pointers, strict written rules, mechanical checks, and GitHub issues and pull requests as the shared memory**. It is not a sophisticated tool stack.

- **Agent files are tiny and point elsewhere.** `CLAUDE.md` is 12 bytes (`@AGENTS.md`). `AGENTS.md` is 24 lines and 4,644 bytes. A cleanup in early November cut the startup files from 16,984 to 4,594 bytes and moved detail into a contributor guide, an append-only decision log and one README per package or module.
- **There is no graph-based context or memory system.** No knowledge graph, code index, embeddings, vector store, MCP server or memory store exists in the repository. The nearest thing is `pnpm issue-context`, a small Node command (about 300 lines with its tests) that turns an issue or a symptom into a short list of verified file paths, the owning READMEs, and the relevant entries of the decision log. It uses Git and optionally `gh`, never a model, and has no index to build or refresh.
- **Work is one vertical slice per issue, per branch, per worktree, per squash-merged pull request.** Tracker issues hold phases and slice checklists; slice issues carry goal, design references, modules, dependencies and acceptance checkboxes. Agents open and merge their own pull requests after green checks and "one fresh review" with blocking findings only.
- **Automation is plain GitHub Actions.** One required workflow (`checks.yml`, seven jobs) runs on every push and every pull request. No AI agent runs in any workflow; there is no auto-merge, no labeller, no Dependabot. A Claude Code `PreToolUse` hook, with its own tests in CI, is the only thing that stops agents updating `main`.
- **CI has become slow.** The median `checks` run grew from 7.0 minutes (20–22 October) to 42.8 minutes (3–4 November). In a recent run one Playwright step took 34.7 of 40.4 minutes because the browser suite runs on a single worker. Each pull request head is checked twice (push and pull_request events), and the merge to `dev` runs the whole set a third time.
- **For Cutroom v2, the valuable parts are cheap to copy**: a pointer command for work packages and decisions, a guard hook that replaces the missing branch protection, a known-failures registry, labelled evidence in pull requests, and a small, fast CI job. The slow parts (hosted browser suites on one worker, duplicate triggers, deploy machinery) should not be copied. Render, acceptance, claim and live tests should stay on the local machine.

---

## 1. Files for agents

### What exists

| File | Size | Purpose (observed) |
|---|---|---|
| `CLAUDE.md` | 12 bytes, 1 line | `@AGENTS.md`. Claude Code and Codex read the same rules. |
| `AGENTS.md` | 24 lines, 4,644 bytes | Four short sections: "Start with the task", "Product and reliability", "How we work", safety. Every line is a rule or a pointer. |
| `.claude/settings.json` | 1 hook | `PreToolUse` on `Bash`, runs `.claude/hooks/refuse-main-update.mjs`, status message "Checking the command does not update main (#201)". |
| `.claude/hooks/refuse-main-update.mjs` and `.test.mjs` | 79 lines plus tests | Regex rules that refuse a push to `main`, `--all`/`--mirror`, `refs/heads/main`, `promote.sh live`, a `gh api` merge into main, `gh repo sync` of main, and `gh pr merge` when the base is main or cannot be confirmed. Exit code 2 blocks the call. |
| `docs/STATUS.md` | 47 lines | One-page coordination status: where things run, dev settings, what works, known gaps, "Code to improve as you touch it". |
| `docs/v2/engineering/contributing.md` | 55 lines | The full working agreement ("How we work", quality bar, providers and money, environments and safety). |
| `docs/v2/engineering/issue-context.md` | 27 lines | How to start from an issue or a report with `pnpm issue-context`. |
| `docs/v2/decisions.md` | 5,032 lines, about 400 entries up to D-422 | Binding, append-only decision log. |
| `docs/v2/carried-forward-facts.md` | 168 lines | Owner rulings kept from v1 (`CF-nn`). |
| `docs/v2/architecture/02d-greenfield-blueprint.md` | 2,036 lines | The architecture and behaviour specification. |
| `docs/v2/architecture/02e-future-session-handoff.md` | 75 lines | "Decisions that must survive context loss". |
| `docs/v2/handover.md`, `docs/v2/v3-revamp/handover.md` | 113 and 60 lines | End-of-programme handovers: try it, what changed, evidence, known gaps, recovery, "Waiting for owner". |
| `docs/v2/v3-revamp/CHANGE-MAP.md` plus three findings files | 194 to 522 lines each | A map from new designs to the code, written by subagents ("Verify any claim against the code before you build on it: subagents wrote the findings by reading the code, and nothing was run"). |
| 76 `README.md` files | one per package, backend module and test area | Owning documentation next to the code. |
| `docs/owner-feedback/<date>/<issue>/README.md` | with before/after PNGs | Evidence folders for UI fixes, each labelling what the screenshots do and do not prove. |
| `docs/v2/engineering/cleanup-pr-prompt.md` | 14 lines | A reusable brief: "Copy the following brief into a fresh coding session." |

There is **no** `.claude/agents/`, `.claude/commands/`, `.claude/skills/`, `.cursor/`, `.github/copilot-instructions.md`, `.mcp.json`, plans folder, ADR folder or task file in the repository (observed: `git ls-files` search).

### How agents are told to use them

`AGENTS.md` starts with the task, not the product: "Resolving or auditing a GitHub issue: run `pnpm issue-context <number>`. Investigating a report: run `pnpm issue-context new "short symptom or UI text"`." It then says to read "the acceptance criteria, the README of each package/module you change, and the specific rules and design screens that govern the journey. Expand when a boundary, amendment or runtime result is unclear." Reading is deliberately narrow and on demand.

Precedence is stated once: the blueprint governs, "amended by [decisions] and the applicable [carried-forward rulings]". The decision log says how it changes: "Append-only. Each entry: date, decision, reason, consequence. When a later entry changes an earlier one, it says so; earlier entries are not rewritten."

Module READMEs follow a rule in `contributing.md`: each covers purpose and ownership, public entry points, a real journey, configuration, CI verification, failure and recovery, and links to decisions, and must "mark each capability as planned, implemented or runtime-verified". Example: `packages/backend/src/modules/planner/README.md` opens with a journey, gives the focused test command (`pnpm --filter @knowscroll/backend exec vitest run src/modules/planner`) and a capability table with states such as "implemented, CI-verified" and "planned".

### How they are kept current

- **Coordinator owns the status page.** The pre-November `AGENTS.md` said: "The coordinating session keeps `docs/STATUS.md` (one page) ... Workers report in their issue or PR and do not edit `docs/STATUS.md`." The current one says "Coordinators own status and promotion" and "Handoffs belong in the issue or PR: branch/commit, verified outcome and next action."
- **The old `CLAUDE.md` had a compaction rule** (observed in the version before PR #678): "Before compaction or a handoff, make sure `docs/STATUS.md` or #222 records the current phase, the integration and dev revisions, active agents with the worktrees and processes they own, and the next step." After compaction: "re-read `docs/STATUS.md` and verify Git, CI and the deployed revisions before acting."
- **Startup size was measured and cut.** PR #676: "Claude project startup files: **16,984 → 4,594 bytes** (73% smaller). Codex root `AGENTS.md`: 11,799 → 4,583 bytes." The PR also recorded which files fresh Codex sessions actually opened for two real issues.
- **Every slice updates its owning README and adds a decision entry**; slice issues have acceptance boxes such as "Decisions recorded in `docs/v2/decisions.md` (next free number)" and "module READMEs updated and each capability marked planned, implemented or runtime-verified" (issue #472).
- **Staleness happens.** `docs/STATUS.md` was last updated 6 November and says "Decision numbers run to D-399", while the log reaches D-422 (observed). The status page lags the log by about a week.
- A style rule applies to all of it: "Long dense prose in issues, PRs or docs is a defect: write short sentences a newcomer can follow."

---

## 2. Graph-based context or memory

**There is none.** I searched the tracked files for MCP configuration, knowledge-graph, code-graph, embedding, vector and memory tooling and found nothing used for development. `AGENTS.md` even forbids a graph database in the product: "No second queue, Kafka, graph DB, microservices or autonomous model tool loops." The hits for "memory" and "vector" are product code (room memory, 3D vectors).

### The nearest thing: `pnpm issue-context`

Files: `scripts/issue-context/cli.mjs` (201 lines), `lookup.mjs` (93 lines), `lookup.test.mjs` (45 lines); guide `docs/v2/engineering/issue-context.md`; tested in CI (`integrity` job) and on a Windows runner (`issue-context.yml`). Header: "Contributor CLI. Uses Git and optionally gh, never a model or a product service."

What it does on each run (observed in the code):

| Command | Steps |
|---|---|
| `pnpm issue-context 664` | Reads the issue through `gh issue view`. Prints the first paragraph of the "What should improve / Goal / Problem" section (550 characters at most) and up to 10 acceptance lines. Extracts every path-like string, Markdown link target, inline code span and pinned GitHub blob URL from the body, and keeps only those that are tracked files in this checkout (`git ls-files`). Walks up from each path to the nearest `README.md` ("Owning READMEs"). Suggests a focused Jest command when a client test is among the paths. Warns when the issue links a commit other than `HEAD`. Lists decisions the body cites (`D-nnn`) plus four lexically related decision headings. |
| `pnpm issue-context new "Next part" [--offline]` | `git grep` for the literal phrase in `*.ts`, `*.tsx`, `*.mjs`, `*.sql` (case-insensitive retry); otherwise word-overlap ranking of tracked paths. Owning READMEs. Related decisions. Word-overlap duplicate search over the latest 100 open and closed issues. Prints a checklist for drafting a new issue. |
| `pnpm issue-context --file issue.md` (or `-` for stdin) | The same as the first, from a saved brief, offline. |
| `pnpm issue-context decision D-319` | Prints that one decision, including any later addendum, from the 5,032-line log. |

The "graph" it walks is implicit: tracked paths to their owning README by directory ancestry, and issue text to decision IDs by regex. Ranking is word overlap with a stop list. There is nothing to build or refresh, because every run reads `git ls-files` and the decision headings afresh. Output is small: PR #676 measured 2,338 bytes for #664 and 3,993 bytes for #674.

### Other "context" structures

- **Stable IDs as cross-references:** `D-nnn` (decisions), `CF-nn` (carried-forward facts), `#issue`, blueprint section numbers, design frame codes (`A1`, `G1`). Issues, PRs, READMEs and code comments cite them, and the CLI resolves them.
- **GitHub as memory:** tracker issues (#661, #462, #674) hold phase checklists and audit tables; slice issues hold acceptance; PR bodies hold verification; coordinator comments hold handoffs (for example #472: "S-1 is complete on the integration branch: S-1a #507, S-1b #508 ... Closing").
- **The code dependency graph, enforced rather than queried:** `.dependency-cruiser.cjs` (30 rules such as `no-circular`, `domain-is-pure`, `cross-module-through-public`, `no-generic-folders`) runs in CI, and a probe script proves the rules reject deliberately forbidden imports.

### What reproducing it would take in Cutroom v2

A Node script of about 200–300 lines with `node:test` tests, using only built-in modules: parse the milestone documents' work-package headings (`### M0-04 — ...`), the `lld/NN §x.y` references in each package's "Read first" line, the `lld/` section headings (`### 2.4 Patch operations`), and the decision identifiers in `lld/11-integration-decisions.md`; verify paths against `git ls-files`; find the owning package README. Details are in the table in "What to copy", row 1. No graph store, index or model is needed.

---

## 3. Work breakdown

### From request to issue

- **Issue first.** `contributing.md`: "Every change belongs to a GitHub issue: a phase issue (#229–#250) or a child of one, or a follow-up under the active tracker. Its brief names the goal, the blueprint sections, the design artboards, the modules touched and what a user can do when it is done."
- **Trackers and slices.** #462 (v3 revamp) had lettered slice issues per lane: `U-1`…`U-6` (Universe), `S-0`…`S-10` (Scrolls), `R-1`…`R-11` (rooms), `T-A`…`T-F` (Talk), `F-1`…`F-3` (finish). #674 (rewritten 11 November) is an audit with an evidence table, then phases with numbered slices (0.1, 1.1, 1.2, …) as checkboxes: "Each numbered slice is one PR against `dev`, with its own tests, README and decision entry. A later slice starts only after the earlier one's measure is recorded."
- **A slice issue written for an agent** (#472, observed headings): "Part of #462", Goal (one user journey), Change map (quotes from the map), Blueprint (section names), Design frames (codes), Modules (paths), Depends on (#471), Acceptance (checkboxes that name the real commands, property tests, widths to check, decisions to record, READMEs to update, and "`checks` green; one review with no blocking finding; PR under about 2,500 changed lines of non-test code").
- **A bug issue** (#697): "Parent: #661 · Suggested priority: **P1** · Type: **reported bug**", then "What should improve", "Reproduction", "Scope and implementation starting point", "Acceptance criteria", "Design and product rules", "Verification and handoff", "Evidence". The intake records the deployed revision and migration it inspected and says "This is issue intake, not a claim of a fix." These headings match the regexes `issue-context` reads (inferred: the format and the tool were designed together).
- **Template.** `.github/ISSUE_TEMPLATE/work.md` is thin (Outcome, Scope, Depends on, Owner, Contracts, Verification, Definition of done). Real issues are richer than the template.

### Labels, milestones, sizes, dependencies

- Labels (observed, 23): GitHub defaults plus area labels (`foundation`, `mobile`, `core`, `cutroom`, `reasoning`, `observability`, `product`), state labels (`ready`, `blocked`, `deferred`), programme labels (`epic`, `v2`, `v3`) and `run-native`, which starts the Android lane on a pull request.
- Dependencies are written as "Depends on: #471" in the body, and the `blocked` label marked v3 slices until their dependency closed (observed on #465–#499). No GitHub sub-issue or dependency feature is used (observed in bodies; I did not query the sub-issue API).
- Milestones exist (Bootstrap, Owner Alpha, Living Worlds, Worlds Collide) but hold only 27 issues in total; the v3 and #674 work does not use them (observed).
- No size labels. Size is a rule: "roughly under 2,500 changed lines of non-test code; split by slice, never by layer." It is not enforced: recent merged PRs add 3,000–6,000 lines with tests, and #731 added 35,162.
- Priority appears as text ("Suggested priority: P1"), not as a label.

### Branches, pull requests, review, merge, closing

- **Branch and worktree:** `claude/<issue>-<purpose>` (earlier `codex/<issue>-<purpose>`), "in its own worktree", from "freshly fetched `origin/dev`". Never switch the shared checkout; "Remove a worktree once its PR merges."
- **PR template** (`.github/pull_request_template.md`): Outcome ("Link the sub-issue (Closes #N) and the tracker"), Changes ("contract changes land before their consumers"), Verification ("Label each item: source inspection · CI fixture · real database · real provider · browser · emulator · physical device · dev deployment · stage deployment. Link CI runs on this exact head."), "Not proved / remaining" ("Say exactly what this PR does not prove").
- **Review:** "A reviewer with fresh context reads the diff against the blueprint sections and this file, and reports blocking findings only ... Fix them; re-review only what changed. No multi-round 'closure' reviews." No PR in my sample has a GitHub review (0 reviews on #676, #701, #704, #714, #725). The review is recorded as a sentence in the PR body, for example #704 "Fresh-context review found no blocking findings." How the reviewer is started is not in the repository.
- **Merge:** squash only (repository settings: merge commits and rebase off), "delete branch on merge" on, auto-merge off. The author's agent merges its own PR with `gh` after the required checks pass. Agents act as the owner's GitHub account ("GitHub cannot tell the agent from the owner"), so the hook is the guard for `main`.
- **Required checks:** ruleset 25423111 on `dev` requires `integrity`, `static`, `backend`, `build`, `client`, `release` and `simulation`, with "strict" off (a PR need not be up to date with `dev`). Other rulesets forbid deleting or force-pushing environment branches and let only a two-person team update `main` and `stage`. Classic branch protection is not used.
- **After merge:** "Wait for deployment and compare the commit in `https://app.dev.knowscroll.space/health` with the merged dev revision. Exercise changed product journeys with disposable accounts."
- **Closing:** "Closes #N" in the PR, or the coordinator closes a slice issue with a summary comment listing its PRs.
- **Parallel-work trick:** migration numbers are "assigned in merge order ... an open PR renumbers to the next free number just before it merges" (`STATUS.md`).
- **A failure mode:** stacked PRs on a squash-only repository conflicted after each squash, so six reviewed slices were landed together in #731 ("Lands six reviewed slices in one squash, because the repo is squash-only and the stacked PRs went conflicting after each squash").

Throughput (observed): numbers reached #731 two months after the repository was created on 15 September 2026; on 12 November alone, PRs #724–#731 were opened or merged. Merged PRs in my sample went from open to merged in 0.6 to 17 hours.

---

## 4. Automation

### Workflows

| Workflow | Trigger | Jobs and what runs | Caching, matrix, concurrency |
|---|---|---|---|
| `checks.yml` (name `checks`, a contract: deploy and promotion look for it by name) | `on: [push, pull_request]` | `integrity`: `node --test` for the issue-context CLI, the hook, the deploy tool; SHA-256 checks of the vendored design exports and the vendored Cutroom wire schema. `static`: Prettier check, typed ESLint (split into parts), `tsc`, dependency-cruiser, four probe scripts, knip, squawk (SQL migration lint). `backend`: Postgres 16 service, FFmpeg install, Vitest unit and property tests, integration tests. `simulation`: the "algorithm simulation lab" twice (current policy and a test-only policy), reports uploaded. `build`: Nest builds, `pnpm deploy` release trees, generated DB types verified against the migrated schema, the release booted against Postgres. `client`: jest-expo tests, Expo web export, gallery-marker positive control, Chromium install, Playwright web smoke. `release` (needs `build` and `client`): assembles and smoke-tests the release tar, uploads `release-<sha>`. | `setup-node` with `cache: pnpm` only. No matrix. **No `concurrency` block**, so superseded runs are not cancelled. Actions pinned by commit SHA. Job summary written. |
| `deploy.yml` | push to `dev` or `stage`; `workflow_dispatch` with a ref (deploys any commit to dev, used to preview a branch before merge) | Polls `gh run list` every 30 s (up to 60 minutes) for a successful push-triggered `checks` run on the exact commit, downloads that run's release artifact, checks its hash, ships it over SSH with a world-pinned key, then checks `/health` from outside reports the commit and artifact hash. | `concurrency: deploy-<world>`, `cancel-in-progress: false` ("cancelling would cut the SSH session in the middle of a migration"). |
| `native.yml` | `workflow_dispatch`, or a pull request only while it carries `run-native` | Expo prebuild, Gradle build (debug-signed APK), Android API 35 emulator, Maestro flows against a test API on a disposable Postgres. Not required. | Gradle cache; `cancel-in-progress: true`. No non-skipped run among the last 100 (observed). |
| `issue-context.yml` | pull request touching `scripts/issue-context/**`, `package.json` or the file itself | `windows-latest`, PowerShell: runs the CLI offline and from stdin, and its tests. | Path filter (the only affected-only trigger in the repository); 5-minute timeout; runs took 1–3 minutes. |

Bots and AI: none. No workflow runs Claude, Codex or any model; no Dependabot, Renovate, labeller, auto-merge or auto-assign (observed: workflow search and repository settings).

### Recent durations

Last 40 runs (observed, `gh run list`): `checks` took **38.2 to 52.9 minutes**; `deploy` took 39.4 to 50.3 minutes, mostly waiting for the `checks` run of the same commit. Each PR head got a push run and a pull_request run at the same minute (for example `claude/674-final`: 38.2 and 47.5 minutes).

Median successful `checks` duration by date (observed through the runs API): 7.0 minutes (20–22 October), 11.2 (24–25 October), 28.0 (30–31 October), 41.1 (1–2 November), 42.8 (3–4 November). The old `AGENTS.md` still promised "the required `checks` workflow runs in about seven minutes".

Per job, `checks` run 43228892282 on `dev`, 12 November (observed):

| Job | Minutes | Slowest step |
|---|---|---|
| `integrity` | 0.2 | — |
| `static` | 9.0 | typed lint 4.3, typecheck 2.5 |
| `backend` | 11.9 | integration tests 7.1 |
| `simulation` | 3.8 | — |
| `build` | 12.5 | booting the release against Postgres 10.3 |
| `client` | **40.4** | **Playwright web smoke 34.7** |
| `release` | 2.9 | starts only after `client` |

The Playwright config sets `workers: 1`, `retries: 0` and `forbidOnly: true` over 61 spec files and two static servers (observed, `apps/client/e2e/playwright.config.ts`). The critical path is `client` then `release`, about 43 minutes.

---

## 5. Testing

### Frameworks and layout

| Layer | Tool | Where | Count (observed) |
|---|---|---|---|
| Unit and property tests (server and shared packages) | Vitest 4.1.12, fast-check | `packages/*/src/**/*.test.ts`, `apps/api`, `apps/worker`, `migrations` | 922 test files in the repository in total |
| Client and UI components | jest-expo 58 with React Native Testing Library; two Jest projects (native preset and web preset) | `apps/client/**`, `packages/ui` | included above |
| Integration | Vitest projects over a real Postgres 16 | `tests/integration/` | 195 files |
| Simulation lab | Vitest, synthetic readers driving real modules, invariants, known-failure gate | `tests/integration/simulation/` | 3 lab files plus a gate |
| Installed release | Vitest, boots the `pnpm deploy` trees | `tests/integration/release/` | — |
| Web smoke | Playwright 1.64.1 with axe-core over the static production and gallery exports | `apps/client/e2e/` | 61 specs |
| Android | Maestro on an emulator | `apps/client/maestro/` | 11 flows |
| Scripts, hook, deploy tool | `node --test` | `scripts/`, `.claude/hooks/`, `ops/vps/tool/` | — |
| Static | Prettier, typed ESLint with custom `no-restricted-*` rules, `tsc`, dependency-cruiser, knip, squawk, `kysely-codegen --verify` | root | — |

### Local versus CI

- Locally, the README asks for `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm knip` and `pnpm boundaries`, and each package README gives its focused command.
- Heavy suites are pushed to hosted runners on purpose: "D-010 allocates these database/release suites to hosted Actions" (`tests/integration/README.md`); "The browser is installed here only; nothing installs it on a developer machine" (`checks.yml`); "Android builds and the emulator run here, never on a developer's Mac" (`native.yml`). The reason given elsewhere is keeping the owner's Mac and its SSD clean and using free runners on a public repository ("The repository is public on purpose (free runners and rulesets)").
- The contributor guide still lists integration tests "against a disposable PostgreSQL on the SSD" as a local step, and the simulation lab "takes about 25 to 30 seconds on a laptop", so some heavy tests do run locally (observed text; how often is unknown).

### Speed tricks in the tests

- **One template database per run, cloned per file.** `tests/integration/support/global-setup.ts` migrates one template database; "Each ordinary test file calls `createTestDatabase()` to clone it, then drops its clone." Files run in parallel (`pool: 'forks'`).
- **Tests read TypeScript sources, never `dist/`.** A custom export condition (`@knowscroll/source`) and a Vite plugin (`vitest.workspace-sources.ts`) resolve workspace packages to `src/`, "so tests never depend on a previous build". Jest maps the same packages to sources.
- **Timing-sensitive suites are isolated.** `packages/scroll-model/vitest.config.ts` sets `fileParallelism: false, maxWorkers: 1`: "Running their files together oversubscribes CI cores and turns elapsed time into scheduler delay." CI runs that package in its own step.
- **Small and large modes** for the simulation lab (`KS_SIM_SIZE=large` for manual runs; the CI mode "should stay under 90 seconds on a hosted runner"). A load test exists (`test:load`) but is "manual, tens of minutes, not in any CI job".
- **Lint in parts.** `scripts/lint.mjs` runs typed ESLint in six processes with a 6 GB heap each, because "one process over the whole tree grows with the code until it no longer fits a heap". This is about memory, not speed.
- **Parallel CI jobs** and the pnpm store cache.

Not present (observed): sharding, affected-only test selection (apart from one path filter), Turbo or Nx caching, pre-commit or pre-push hooks, coverage tools or coverage gates, Playwright parallel workers.

### Known failures, flakes and "every check can fail"

- **Known failures that flip into gates.** `tests/integration/simulation/known-failures.ts`: each entry names the invariant, the slice that will fix it, the reason, and a `matches` function that accepts only violations failing for that reason. Every other violation fails the run, and a separate gate fails when an entry is no longer reproduced, "so CI stays green now and goes red the day a fix lands", and the fixing slice must delete the entry. The list is empty today.
- **Flakes are defects with their own issue.** #626: "Do not add a sleep or retries, and do not weaken the assertion. Run the spec many times (`--repeat-each=20`) on the production export before and after." Playwright has `retries: 0`. #681 (open) tracks a Jest suite that passes but does not exit.
- **Checks that prove they can fail.** `boundaries:probe`, `lint:probe` and `lint:probe:network` feed forbidden imports to the rules and expect rejection; the gallery-marker step is a "Positive control for the check below"; two PRs report deliberate mutations ("10 mutations each caught", #725; "Rules broken once on purpose, each caught", #639).
- **Honest evidence.** The integration README: "A passed fixture is evidence for its asserted behavior, not deployment, real model quality, physical-device parity or a successful live privacy journey."

---

## 6. Speed

### What makes agent work fast

1. **Small startup context and pointer-driven reading.** A session reads 4.6 KB of rules, runs one command and gets 2–4 KB of verified pointers instead of opening a 2,036-line blueprint or a 5,032-line decision log.
2. **One-entry decision extraction.** `issue-context decision D-319` returns one entry with its addenda.
3. **Self-contained slices.** One issue, one worktree, one PR, one reviewer with fresh context, blocking findings only, no review rounds about reviews.
4. **Agents merge their own green PRs.** No human waits for routine merges; only `main` and production need the owner.
5. **Mechanical rules instead of review time.** dependency-cruiser, knip, custom lint rules, squawk and DB-type verification catch whole classes of error without a reviewer.
6. **No-build tests and cloned databases.**
7. **Self-describing issues and PRs.** An agent resuming work finds the goal, acceptance, verification and next action in the issue or PR.

### What looks slow

1. **The browser suite on one worker** (34.7 of the 43 critical-path minutes). The median run grew six-fold in two weeks as specs were added.
2. **Duplicate runs.** `on: [push, pull_request]` runs the whole workflow twice per PR head, and the squash commit on `dev` runs it a third time because the deploy needs a push-triggered run.
3. **No `concurrency` cancel on `checks`.** A new push does not stop the old run.
4. **Deploy waits for checks** by polling for up to an hour.
5. **Everything runs on every change.** Only the Windows CLI workflow has a path filter.
6. **Very large PRs** when stacking failed (#731, 35,162 lines added).
7. **Status lag.** `STATUS.md` was six days behind the decision log, so a fresh session must verify against Git and CI (which the rules tell it to do).

---

## 7. Scripts and tooling

| Tool | What it does (observed) |
|---|---|
| `pnpm issue-context` | The pointer CLI of section 2. |
| `scripts/lint.mjs` | Typed ESLint in parts; every part runs even after a failure; `--fix` is forwarded. |
| `scripts/promote.sh stage|live` | Reads the lower world's `/health`, refuses unless fast-forward and unless `checks` passed on the exact commit, then pushes the commit to the next branch. |
| `scripts/release/build.mjs`, `smoke.mjs`, `files.mjs` | Build the release once and smoke-test the same bytes that are later deployed and promoted. |
| `scripts/check-library-sources.mjs`, `build-cutroom-wire.mjs` | Product-specific operator and build helpers. |
| `tests/integration/boundaries/*.mjs` | Probes that prove the boundary and lint rules reject forbidden code; a manifest check that workspace imports are declared dependencies. |
| `ops/vps/**` | Ansible roles, systemd units, the `ks` deploy tool with tests, backup and restore checks. |
| `pnpm-workspace.yaml` | One catalogue of exact versions ("Every workspace manifest must take third-party versions from the catalog"), `savePrefix: ''`, `strictPeerDependencies`, an allow-list of packages that may run install scripts; versions recorded in `docs/v2/operations/dependency-matrix.md`. |
| `.npmrc`, `.nvmrc` | pnpm store under `${KS_DEV_ROOT}`; Node 22.23.0. |
| `.gitattributes` | `docs/v2/design/v3/** -text`, because "Git must never convert their line endings, or SHA256SUMS stops matching on a Windows checkout." |

There is no Makefile, task runner, dev container, Turbo or Nx (observed).

Side observation: KnowScroll consumes Cutroom through a byte-for-byte vendored "Cutroom wire schema" pinned to upstream revision `94ee04a1` and hash-checked in CI (`packages/backend/src/modules/content/adapters/cutroom/wire-v1/`), and its rules say "Cutroom is not ours to change: integrate through its HTTP contract only (CF-60)". Inferred: if Cutroom v2 is meant to replace that service for KnowScroll, its wire contract will need a coordinated change on the KnowScroll side.

---

## Where each kind of Cutroom v2 test should run (speed first)

GitHub facts I did not check here and rely on as general knowledge: a private repository on GitHub Free draws on an organisation-wide monthly quota (2,000 minutes on the Free plan at the time of my training); Linux jobs bill per job, rounded up to the minute; Windows jobs bill at twice the Linux rate; standard Linux runners for private repositories have 2 vCPUs, far fewer than the laptop's 16 threads. Check the current plan page before relying on the numbers.

| Kind of test | Command (`impl/01` §4) | Run it | Why |
|---|---|---|---|
| Type check, lint, edge check | `npm run check` | **Local, every change** (Windows Node on the NTFS checkout). Also once per PR in CI, as a record. | Incremental `tsc --build` and Biome finish in seconds to a minute on 16 threads. A runner pays queueing, `npm ci` and a cold build on 2 vCPUs (inferred: several minutes). CI's value is a clean checkout: it catches a file that was never committed. |
| Unit and property tests | `npm test` | **Local, every change**, files in parallel. Also in the same CI job as `check`. | Under a minute locally by design (`impl/01` §4). Same reasoning as above. `node --test` already runs files in parallel; set `--test-concurrency` explicitly (general knowledge: the default is the number of CPUs minus one). |
| Timing and budget tests (for example "compile within `compile.budget_ms`") | a separate serial lane | **Local only, alone** | `impl/02` §11 already says "Background load moves timings | Run timing claims alone". KnowScroll isolated its timing suite for the same reason. On a 2-vCPU shared runner such budgets measure the runner, not the code (inferred). |
| Render, acceptance, claim tests | `npm run test:render`, `test:accept`, `test:claims` | **Local only, in WSL**, one at a time behind the render lock | Reference frames are "stamped with the environment hash ... A test that finds another environment hash fails rather than compare" (`impl/03` §3), so on a runner they fail by design. Each run would also download and verify the pinned Chrome, FFmpeg and fonts, and render jobs on 2 vCPUs would be slow and spend the shared quota. |
| Live MiniMax tests | `npm run test:live` | **Local only** | They need the key; putting it in a repository secret would expose it to every admin's workflows (`target-repo-state.md` §8). The spend ledger is local. |
| Second clean environment (claim `R2-S9`, `impl/03` §10 point 3) | a manual workflow | **GitHub, by hand, rarely** (for example once at M1 and once at M11) | A fresh runner is exactly "a second clean environment", which the laptop cannot provide. Run it by `workflow_dispatch`, not on every push. Inferred, and the user should decide. |
| Integrity checks (frozen-file hashes, no off-limits file, no key in recordings) | part of `npm run check` | **Both** | Seconds. In CI it is the only check that sees exactly what was pushed, which matters without branch protection. |

**One WSL warning that affects both speed and correctness.** `impl/02` §11 says "`/mnt/c` is `9p`; SQLite there fails silently | Repository, worktrees, Space, temporary files on ext4; refuse `9p`" (evidence: batch 2b, section 6). With the repository now at `C:\Users\XZNON\cutroom-v2`, WSL reads it through `/mnt/c`. Inferred recommendation: build and run `check` and `npm test` with Windows Node on NTFS; for render work, keep the Space, the SQLite files and all temporary files on the WSL ext4 disk as `impl/01` §1 already says for the Space, and measure in M0-01 whether reading the built `dist/` through `/mnt/c` is slow enough to justify copying it to ext4 before each render run. Also note `impl/02` §11: "The Windows `npm` is on the `PATH`"; with two operating systems working on one folder, platform-specific packages (for example Biome's native binary) installed by Windows `npm` will not run in WSL (general knowledge), so WSL should only run Node on already-built JavaScript.

---

## What to copy into Cutroom v2

Ordered by value for speed. "00" and "01" mean `impl/00-orchestration.md` and `impl/01-repo-and-conventions.md`.

| # | Practice | Where it is in KnowScroll | What copying it would involve | Expected benefit | Cost or risk |
|---|---|---|---|---|---|
| 1 | **A pointer command instead of reading whole documents.** `npm run context -- M2-03` prints the work package block verbatim, the `lld/` sections its "Read first" line names (extracted by section number), the paths it names that exist, the owning package README, and the decisions it cites. `npm run context -- decision B4` prints one decision or build revision. `npm run context -- find "text"` does a `git grep` and finds owners. | `scripts/issue-context/cli.mjs`, `lookup.mjs`, `lookup.test.mjs`; `AGENTS.md` first section; `docs/v2/engineering/issue-context.md` | One early work package (M0, care: normal): `tools/context/` with built-in modules only and `node:test` tests that pin the heading formats (`### M0-04 — ...`, `### 2.4 ...`, `lld/04 §2.4`). 00 §4 items 1–2: the brief is the tool's output plus the standing rules, not a hand copy. 00 §2 step 3 and §3 rule "delegates reading" point to it. 01 §1 adds `tools/context/`; 01 §4 adds the command; `CLAUDE.md` lists it. If issues are used (row 5), the same tool prints the issue body. | The orchestrator never opens a 340–540-line milestone document or a 612-line decisions file to brief one package; subagents read only the cited sections. Briefs become uniform. KnowScroll's output was 2–4 KB per issue. | About half a day of one implementer. It depends on stable heading formats, so a document edit can break extraction; the tests and an "unresolved reference" line in the output catch that. |
| 2 | **A `PreToolUse` guard hook, tested in CI, as the real guard.** | `.claude/settings.json`, `.claude/hooks/refuse-main-update.mjs` and its test, run in `checks.yml` `integrity` | `.claude/hooks/guard.mjs` plus a test with refused and allowed command lists. Refuse: any force push (`--force`, `-f`, `+ref`), a direct push to `main`, `git push --all/--mirror`, deleting `main`, any command naming `cutroom-v3.1-full-system-architecture.md`, `git add` of that file or `.env`, and printing the key file. Allow `gh pr merge --squash` only from the orchestrator's own flow (inferred design choice). 00 §8 gains a line; 00 §9 names the hook; 01 §1 lists `.claude/`. | The repository cannot have branch protection (`target-repo-state.md` §1: HTTP 403), and three admins can force-push `main`. KnowScroll faced the same gap ("GitHub cannot tell the agent from the owner") and solved it this way. | Small. Regex rules give false refusals; KnowScroll accepts that ("a false refusal costs the agent one reworded command"). The hook only loads for sessions started in the checkout, and it does not stop people. |
| 3 | **One PR per work package, squash-merged by the orchestrator on local green plus review; CI is a record, not a wait.** | `contributing.md` steps 2–5; repository settings (squash only, delete branch on merge) | Rewrite 00 §9: push `wp/<id>-<short-name>`, `gh pr create --base main` with the template, merge with `gh pr merge --squash --delete-branch` after the orchestrator's own test run and, for care: high, the closed review. Set the repository to squash only and delete branches on merge. Push tags `m0-done` and so on. Remove the worktree after merge. Never stack work-package branches: branch each one from fresh `main` after its dependencies merge. The orchestrator checks the CI result of the previous PR when it starts the next package, instead of waiting. | Every package gets a durable record (PR body, CI run) at almost no time cost, and the next package starts at once. Avoids KnowScroll's 40-minute waits and its stacked-PR collapse into one 35,162-line PR. | A red CI result arrives after the merge; the fix becomes the next small package. Inferred acceptable because local checks are the same commands. |
| 4 | **A small, fast CI workflow.** | `checks.yml` (what to keep), and its lack of `concurrency` and its double trigger (what to avoid) | `.github/workflows/checks.yml`: `on: pull_request`, `push: tags: ['m*-done']` and `workflow_dispatch`; `concurrency: { group: checks-${{ github.ref }}, cancel-in-progress: true }`; `permissions: contents: read`; **one** Linux job: checkout, `setup-node` (Node 26, `cache: npm`), `npm ci`, `npm run check`, `npm test`, with a 10-minute timeout. Pin actions by commit SHA as KnowScroll does. No render, live or Windows jobs. Optional separate `clean-env.yml` for `R2-S9`, manual only. 01 §4 notes which commands CI runs. | One job avoids per-job minute rounding and repeated installs. Estimate (inferred): about 4–6 billed minutes per PR; 78 work packages in M0–M6 come to roughly 300–500 minutes, inside the shared Free quota, which other private repositories in the organisation also use. | Without branch protection the result is advisory. The quota is shared with the organisation's other private repositories. |
| 5 | **Issues that an agent can resume from, generated from the milestone documents.** | Slice issues (#472), bug issues (#697), tracker issues (#674); "Handoffs belong in the issue or PR" | One tracker issue per milestone with a checklist of its work-package IDs; one issue per work package whose body the context tool prints from the milestone document (goal, done-when as checkboxes, link to the document at a commit). GitHub milestones M0–M6. A few labels: `care:high`, `blocked`, `live-calls`, `build-revision`, `flaky`. PR body "Closes #N". The milestone document stays the single source; the issue is a mirror. 00 §10 adds the issue and PR as records; 00 §11 step 1 creates the milestone's issues. | Other admins see progress; a new session resumes from the issue and PR thread; dependency blocking is visible. | Two places hold the same text. Keep it mechanical (the tool writes the body) and never edit work-package text in GitHub. Projects need a token scope that is missing (`target-repo-state.md` §6), so skip them. |
| 6 | **Labelled evidence and "Not proved" in every report.** | `.github/pull_request_template.md`; owner-feedback READMEs | `.github/pull_request_template.md` with Outcome, Changes, Verification and "Not proved / remaining". Fixed evidence labels for Cutroom: `unit`, `property`, `recorded reply`, `hand-written reply`, `render (pinned env <hash>)`, `acceptance`, `claim`, `live MiniMax`, `reviewer run`. 00 §4 item 5 and §10 (milestone report) use the same labels. | The orchestrator can verify a claim by its label and see at once what was not run; matches standing rule 6. | Minutes per PR. |
| 7 | **Known-failures registry instead of skipping.** | `tests/integration/simulation/known-failures.ts` and its gate test | `tests/known-failures.ts`: an entry per acceptance case or claim test that cannot pass yet, with its ID, the work package that will make it pass, the reason, and a `matches` check on the failure's diagnostic code. The runner fails on any unexplained failure and on any entry that stops failing; the fixing package deletes the entry. 00 §11 step 3 ("Run the whole test suite on `main`") can then run every acceptance and claim test from M0 on. Add to `impl/03` §8. | Fits "Tests are evidence ... never deleted, skipped, loosened"; the whole suite runs from the start, and a fix shows itself. | Entries can linger; requiring a work-package ID per entry keeps them honest. |
| 8 | **Package READMEs with a capability-state table and a focused command.** | `contributing.md` "Code and documentation quality"; `packages/backend/src/modules/planner/README.md` | Each `packages/<name>/README.md`: purpose, entry point, design pointers (`lld/04 §2.4`), the focused test command, and a table with states `planned`, `implemented`, `tested`, `render-verified`, `live-verified`. 01 §6 "done" adds "README updated". The context tool lists the owning README. | A subagent learns a package's state from one short file; `STATE.md` stays one row per package. | Upkeep in every package; stale tables mislead, so the reviewer checks them. |
| 9 | **Append-only build revisions with IDs, "Amends" lines and one-entry extraction.** | `docs/v2/decisions.md` header and `## D-nnn · date · title` format; `issue-context decision` | In 00 §6, make each build revision a heading `### B7 · 2026-11-20 · title` in `lld/11` §18 with "Amends B3" when it changes an earlier one, never rewriting earlier entries. The context tool extracts one. | Decisions survive context loss and cost a few hundred bytes to read. | None beyond the format. |
| 10 | **One fresh-context review, blocking findings only.** | `contributing.md` step 4; PR bodies ("Fresh-context review found no blocking findings") | Add to 00 §5: report blocking findings only (correctness, design conformance, test integrity, scope); after fixes, re-review only the changed lines; no review of a review. Record the result as one line in the PR body. | Caps review time per package. | A reviewer may hold back non-blocking points; they can go to `STATE.md` as deferred notes. |
| 11 | **A serial lane for timing tests; full parallelism for the rest.** | `packages/scroll-model/vitest.config.ts` (`fileParallelism: false`) and its own CI step | Name budget and timing tests `*.timing.test.ts`; `npm test` excludes them and runs with explicit `--test-concurrency`; `npm run test:timing` runs them one at a time with nothing else running. 01 §4 and `impl/03` §1. | Fast unit runs without false budget failures; matches `impl/02` §11. | One more command. |
| 12 | **Template copy for test databases.** | `tests/integration/support/global-setup.ts` | For `node:sqlite` tests: build one migrated template database file once per run on ext4, and give each test a file copy (inferred adaptation). Add to `impl/03`. | Per-test setup becomes a file copy instead of a migration (inferred speed gain; measure). | Must stay on ext4 or NTFS, never `/mnt/c` from WSL (`impl/02` §11). |
| 13 | **Flaky tests are defects with their own work item.** | Issue #626; Playwright `retries: 0` | Add to `impl/03` §8: no retries, no sleeps; a flake gets a `flaky` issue; reproduce by running the file 20 times before and after the fix (a small loop script; general knowledge, unchecked on Node 26: `node --test` has no repeat-each option). | Keeps the suite trustworthy without slowing every run with retries. | None. |
| 14 | **Integrity hashes for frozen inputs and fixed line endings.** | `integrity` job SHA-256 checks; `.gitattributes` `-text` | `SHA256SUMS` for `hld/` and `VISION.md`, checked by `npm run check`; a check that `cutroom-v3.1-full-system-architecture.md` and `.env` are not tracked; `.gitattributes` with `* text=auto eol=lf` and `*.png binary`. 01 §1 lists the files. | Enforces "never edited" and protects canonical-JSON hashes and recordings when Windows Git and WSL share one folder. `target-repo-state.md` §8 flags both the archive and line endings as risks. | Small. |
| 15 | **Probes that prove the edge check can fail.** | `tests/integration/boundaries/probe-boundaries.mjs`, `pnpm boundaries:probe` | M0-01's `tools/dependency-edges.json` check gets a test that feeds it a forbidden deep import and a forbidden edge and expects a failure. | Extends the "every check must be able to fail" rule of `impl/03` §3 to the static checks. | Minutes. |
| 16 | **Orchestrator-only status files; workers report in the PR.** | Old `AGENTS.md` "Status and continuity"; old `CLAUDE.md` compaction rule | Add to 00 §3 rules: subagents never edit `STATE.md` or `handoff.md`; they report in their PR body. Add to `CLAUDE.md` the KnowScroll compaction rule: before compaction record phase, branches, worktrees and next step; after it, re-read `STATE.md` and verify Git and CI before acting. | No merge conflicts on status files between parallel worktrees; reliable resumption. | None. |

### Already in Cutroom v2, no change needed

Exact version pins with a dependency record (KnowScroll's catalogue and dependency matrix; Cutroom's `impl/DEPENDENCIES.md`); "never weaken a test"; honest reports that name the unverified; a spend ledger for live calls; controls that prove a check can fail; one work package per branch and worktree; a richer work-package template than KnowScroll's issue template; a short `CLAUDE.md` (3,390 bytes). Inferred: whether the 19,118-byte `AGENT.md` is loaded at session start depends on the tool (Claude Code reads `CLAUDE.md`; Codex reads `AGENTS.md`, plural); KnowScroll's trick of a one-line `CLAUDE.md` importing `AGENTS.md` keeps both tools on one file if Codex is used as a reviewer.

---

## What not to copy and why

- **Running heavy tests on hosted runners.** KnowScroll moved databases, browsers and the emulator to Actions to keep a Mac clean on a public repository with free minutes. Cutroom's repository is private on a shared quota, its render tests depend on a pinned machine environment by design, and its laptop has 16 threads. Its runs would be slower and would spend the quota.
- **A browser suite on one worker in the required checks.** This is KnowScroll's main slowdown (34.7 minutes).
- **`on: [push, pull_request]` without `concurrency`.** It doubles every PR's runs and never cancels superseded ones.
- **A Windows CI job for portability.** KnowScroll runs one for its CLI. For Cutroom, running the tool's tests under both Windows Node and WSL Node locally is faster and costs no minutes (Windows jobs bill at a higher rate; general knowledge).
- **Deploy, promotion and release machinery** (`deploy.yml`, `promote.sh`, release tars, `/health` checks, environments). Cutroom has nothing to deploy during M0–M6.
- **Stacked branches on a squash-only repository.** They forced the 35,162-line #731.
- **The integration branch with back-merges** (D-002). KnowScroll retired it itself (D-394).
- **One huge log read whole.** A 5,032-line decision file works only because a tool extracts entries; copy the extractor, not the habit of growth.
- **A loose size rule.** "Roughly under 2,500 changed lines" was routinely exceeded; Cutroom's work-package scope and "Out of scope" lines are a better limit.
- **Agents acting as a human's GitHub account with only a hook to tell them apart.** Inferred alternative: if possible, let the build push with its own account or token so the history shows what the agent did; this is the user's decision.
- **Typed ESLint split into processes.** Cutroom uses Biome, which does not have that memory problem (inferred).
- **The simulation lab itself.** It is product-specific; only its known-failures pattern transfers (row 7).

---

## Could not determine

- **GitHub Projects.** `gh project list --owner KnowScroll` failed ("unknown owner type"); the repository has projects enabled. Whether KnowScroll uses a project board is unknown.
- **How the "one fresh review" is started.** There are no agent definitions or commands in the repository and no GitHub reviews on the sampled PRs; only sentences in PR bodies record that a review happened. The prompt, model and tooling used for review are not visible.
- **Anything outside the repository.** User-level `CLAUDE.md`, global settings, MCP servers or memory tools on the maintainers' machines would not appear in the repository. The repository itself contains none.
- **Local test times.** Apart from the simulation lab's "about 25 to 30 seconds on a laptop", no local timings are recorded.
- **History before 31 October 2026.** The clone holds 50 commits; earlier history was read only through `gh` (issues, PRs, run durations).
- **Hosted runner hardware and the organisation's Actions billing.** Not queried; the figures above are general knowledge.
- **How sub-issues and blocking are tracked beyond body text and the `blocked` label.** I did not query GitHub's sub-issue or dependency APIs.
