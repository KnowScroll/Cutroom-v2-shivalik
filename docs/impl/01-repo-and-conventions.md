# Cutroom v2 — Implementation · Repository and Conventions

**Written:** 15 November 2026
**Status:** In force for the build. These are implementation conventions, not design. The orchestrator may change one when it proves wrong in practice; it then edits this file and adds a dated line to section 9. Revised on 15 November 2026 for U19 to U35 ([integration decisions](../lld/11-integration-decisions.md), section 17.3): the Windows working tree, the WSL build mirror and the GitHub flow.
**Read with:** [orchestration rules](00-orchestration.md) · [environment](02-environment.md) · [testing](03-testing.md)

## 1. Repository layout

The project folder `C:\Users\XZNON\cutroom-v2` is the one working tree (U19) and the Git repository pushed to `KnowScroll/Cutroom-v2-shivalik` (U20). Everything below it is tracked by Git unless marked ignored.

```
C:\Users\XZNON\cutroom-v2\
  CLAUDE.md                 rules every session and subagent reads first
  handoff.md                how to start or resume the build
  AGENT.md                  the design-phase working notes for agents
  .gitignore                .env, .env.*, the v3.1 archive, node_modules/, dist/, .tools/, .worktrees/
  .gitattributes            * text=auto eol=lf; *.png binary (LF everywhere, on every platform)
  .env                      ignored: the API keys (never tracked, never synced to WSL)
  .github/
    workflows/checks.yml    the one workflow: check, npm test and test:linux on Ubuntu (testing §1)
    ISSUE_TEMPLATE/         the work-package form (section 7) and a problem form
    pull_request_template.md  what was built; commands and results; evidence labels; Not proved; design doubts
  .claude/
    settings.json           registers the guard hook (PreToolUse)
    hooks/                  guard.mjs and its tests (orchestration §9)
  docs/
    VISION.md  HLD-ENTRY.md
    research-index.md
    hld/                    accepted high-level design (never edited)
    lld/                    frozen low-level design; 11 is the decisions record
    research/               findings and spike evidence
    history/                dated records of the design phase, such as the HLD documentation verification
    impl/                   these documents, STATE.md, milestone documents, reports, research/
    archive/                ignored: the v3.1 archive (below)
  packages/                 the product code, one folder per module, each with a README.md (section 2)
  tests/
    acceptance/             cases A1 to A14 of R10 section 3.2
    claims/                 the tests of R10 section 2.2, named by claim ID
    golden/                 the six golden briefs with their expected properties
    fixtures/               hand-written projects, components, recorded model replies
    known-failures.ts       tests expected to fail, each with a reason and an issue (testing §8)
  tools/                    developer scripts: environment check and pins, dependency-edge check, wsl:sync
    context/                the pointer command (wp-context) and its tests
    models/                 the pinned ONNX export script for the speech models (M5-03; L38)
  .tools/                   ignored: the Windows Node 26 (environment §3)
  .worktrees/               ignored: Git worktrees for parallel work packages
```

`docs/archive/cutroom-v3.1-full-system-architecture.md` also sits in this folder. It is ignored by Git, never opened, and the guard hook refuses any attempt to read it or add it (orchestration §8, rule 1). The hook also refuses `git clean` with `-x` or `-X`, which would delete `.env`, and any command that names a path under `C:\Users\XZNON\Cutroom` (L21).

**The WSL side** holds no project of its own ([environment](02-environment.md), section 2):

- **The build mirrors,** one per Git worktree under `~/.cutroom-build/` on the WSL ext4 disk (U26; L19): the main working tree's at `~/.cutroom-build/main/`, each Git worktree's at `~/.cutroom-build/<worktree name>/` (L45); disposable copies of the working tree as it is, uncommitted changes included and everything `.gitignore` ignores left out, each refreshed by `npm run wsl:sync` from its worktree, with its own Linux `node_modules` and build output. Nobody edits them. A mirror can be deleted and recreated at any time. Render, acceptance, claim, Linux-only and live tests and every run of the product happen there.
- **The WSL tool folder,** `~/.cutroom-build/.tools`, also on ext4, beside the mirrors and outside each of them (L19): the pinned Linux Node, Chrome, FFmpeg and fonts, and the render lock ([environment](02-environment.md), sections 2 and 10).
- **The Space** (the system's data: database, blob store, spools) is not in the repository or the mirror. Its default place is `~/cutroom-space`, on the WSL ext4 disk, never under `/mnt/c`. Tests create their own Space in a temporary directory and remove it.

## 2. Packages

One package per module. The names are fixed; the design documents that define each are given.

| Package | Holds | Design |
|---|---|---|
| `packages/foundations` | Time in flicks, IDs and handles, hashing and canonical JSON, artifact references, work keys, failure classes, the evidence convention, the settings registry; `Predicate` and `Need`, whose meaning R5 keeps (B:SD1) | `lld/02`; settings rule in `lld/04` §2.7; `lld/06` §2.4 |
| `packages/project-core` | Entity schemas, patches and validation, write authority, revisions, branches, merge, promotion, views, storage adapter over `node:sqlite`, blob store | `lld/04` |
| `packages/render` | Runtime shim, sealer, host page, capture engine, encode and join, mux, component validation functions, preview rungs | `lld/03` |
| `packages/compiler` | The compile passes, timing solver, Render Plan, work keys, `plan_diff`, `timing_explain` | `lld/05` |
| `packages/scheduler` | Jobs, work-key cache, futures, pools, intents and reconciliation, budget ledger, `plan_to_jobs` | `lld/06` |
| `packages/quality` | Check runner, check catalogue, Reviewer protocol, Quality Intent rules, completion state, deliverable record | `lld/09` |
| `packages/harness` | `ModelClient` and the MiniMax adapter, Director loop, tool catalogue and boundary, sub-loops, plugin registration, audit log | `lld/07` |
| `packages/studio` | Audio adapters and mastering, captions, character controls and performance, media, research, charts, capture | `lld/08` |
| `packages/cli` | The command-line entry point | `lld/07` D12 |

Rules:

- **A package is imported only through its entry point** (`src/index.ts`). No deep imports into another package's files.
- **No import cycles between packages.** The allowed edges are the ones the stage designs describe in their "Interfaces to other stages" sections. Work package M0-01b writes them down as a table in `tools/dependency-edges.json`, and `npm run check` fails on any import outside that table.
- A package that needs something from a later milestone depends on an **interface** it declares itself, with a stub for tests. It does not wait.
- `packages/harness` holds no authority: it calls the other modules' operations and never writes their data directly (`lld/07` D10).
- **One README per package** (U21). Each `packages/<name>/README.md` gives the package's purpose, its entry point, its design pointers (for example `lld/04 §2.4`), the focused test command, and a table of its capabilities, each marked `planned`, `implemented`, `tested`, `render-verified` or `live-verified`. A work package that changes a package updates its README in the same pull request. The pointer command prints the README of every package a work package touches, so a subagent learns a package's state from one short file.

## 3. Language and tools

| Item | Choice | Note |
|---|---|---|
| Runtime | Node 26 LTS (minimum 24.15), the same release on Windows and in WSL | R0 decision; environment §3 |
| Language | TypeScript, `strict`, ES modules only | R0 decision |
| Workspace | npm workspaces | No extra package manager |
| Build | `tsc --build` with project references, output in each package's `dist/` | |
| Tests | Node's built-in runner (`node --test`) with `node:assert/strict`, run on the built JavaScript | No test framework dependency |
| Property tests | `fast-check` | For the timing solver, canonical JSON, merge |
| Lint and format | Biome | One tool for both |
| Schemas | Zod, with typed metadata for references and write levels | `lld/04` |
| Database | `node:sqlite` | `lld/04`, batch 2b |
| Browser control | `puppeteer-core` with a pinned `chrome-headless-shell` | `lld/03` |
| Model transport | `@anthropic-ai/sdk` with `maxRetries: 0`, behind `ModelClient` | `lld/07` D1 |
| Canonical JSON | An RFC 8785 implementation, checked against the standard's test vectors | `lld/02` |

**Versions are not guessed.** Work package M0-01b resolves each dependency's current version with `npm view`, installs it pinned exactly (no `^` or `~`), and records name, version and purpose in `docs/impl/DEPENDENCIES.md`. Where the design names a version, the design wins: `canonicalize` 5.1.0 and `uuid` 14.0.3 (`lld/04` §2.5), whose claims the spikes verified for exactly those versions, are pinned, and a newer version is only noted. Adding a dependency later needs the orchestrator's agreement and a line in that file. Prefer the standard library.

Python is not used until a work package needs the analysis worker (`lld/01` section 3).

## 4. Commands

Every command runs from the root of the tree it runs in: the project folder (or a worktree) on Windows, or the build mirror in WSL. A work package is not done until the ones that apply pass, in the place this table gives.

**Where each command runs is a reasoned default, not yet a measurement** (U22, U27). Check and unit tests run on Windows-native Node straight from the working tree, because that loop has no sync step; everything that needs Linux runs in WSL on the mirror. Work package M0-01b measures the alternatives ([testing](03-testing.md), section 1). If a different place is clearly faster for a level, the orchestrator moves that level and records it in section 9.

| Command | What it runs | Runs on | Needs |
|---|---|---|---|
| `npm run check` | Type check, lint, the dependency-edge check, the code-coverage check of testing §8, and the integrity check that `.env` and the v3.1 archive are not tracked | Windows, working tree. Also GitHub Actions | Nothing |
| `npm test` | Unit and property tests of every package, and the tests of the guard hook, the pointer command and the other tools; on Windows it leaves out files named `*.linux.test.ts` (L18) | Windows, working tree. Also GitHub Actions | Nothing: no browser, no network, no key |
| `npm run test:linux` | The unit tests that need Linux process behaviour (sockets, `/proc`, kill signals), in files named `*.linux.test.ts`; they count toward "done" (L18) | WSL, mirror. Also GitHub Actions | Linux; no browser, no network, no key |
| `npm run wp-context -- <ID>` | The pointer command: prints the work package, the design sections it cites, the owning package READMEs and the `lld/11` decisions it names (orchestration §4) | Windows, working tree | Git |
| `npm run wsl:sync` | Refreshes this worktree's WSL build mirror from the working tree as it is, uncommitted changes included, with `rsync`, honouring `.gitignore` (so `.env`, `node_modules` and build output stay out) and leaving out `.git`; then installs and builds in the mirror when needed ([environment](02-environment.md), section 2; L19) | Windows, driving WSL through `wsl.exe` | WSL with `rsync` |
| `npm run test:render` | Tests that drive Chrome or FFmpeg | WSL, mirror | The environment of [02](02-environment.md) |
| `npm run test:accept` | The acceptance cases under `tests/acceptance/` that exist so far | WSL, mirror | As above |
| `npm run test:claims` | The claim tests under `tests/claims/` that exist so far | WSL, mirror | As above |
| `npm run test:live` | Tests that call MiniMax or OpenRouter | WSL, mirror. Never GitHub | The keys; `CUTROOM_LIVE=1`; a line in the spend ledger |
| `npm run env:check` | Verifies the pinned Chrome, FFmpeg, fonts and Node versions by hash | WSL, mirror; on Windows it checks only the Windows Node ([environment](02-environment.md), section 9) | Nothing |
| `cutroom …` (every run of the product) | The CLI of `packages/cli` | WSL, mirror | The Space on ext4 |

A WSL command is run from Windows as `npm run wsl:sync`, then `wsl.exe` in that worktree's mirror with `tools/env.sh` sourced first ([environment](02-environment.md), section 3); WSL commands that need the keys find the key file through `CUTROOM_ENV_FILE` (L19). Render tests from different worktrees never run at the same time: the render lock in the tool folder serialises them (L19). Render, acceptance, claim and live tests never run on GitHub: they need the pinned environment and the keys.

`npm test` must stay fast (under about a minute) and must pass with no network, on Windows and on Linux. Anything slow or external belongs to one of the other commands.

## 5. Code conventions

- **Names come from the design.** Persisted names are `snake_case` exactly as `lld/` spells them: entity kinds, fields, settings, diagnostic codes, tool names, check IDs. TypeScript identifiers are `camelCase` for values and `PascalCase` for types.
- **Each source file starts with a one-line pointer to its design:** `// Design: lld/04 §2.4 (patch validation)`.
- **Failures that the design names are values, not exceptions.** A module operation returns a result that is either a value or a list of typed diagnostics with the code, path, expected, got and candidates the design gives. Exceptions are for bugs.
- **No tunable number in code.** Every threshold, limit, count and timeout is a named setting registered by its owning package, with the default the design gives, its `override_by` level and a range.
- **No `any`,** no non-null assertion without a comment saying why it is safe, no default exports.
- **Determinism where the design asks for it:** compiler and render code take no input from the clock, the locale, the environment or unordered iteration.
- **Platform-neutral code and tests** (U27). The product runs in WSL, but `check` and `npm test` run on Windows too. Build paths with `node:path`; never assume a separator, a shell or a line ending; text files are LF (`.gitattributes`). A test that needs Linux itself (sockets, `/proc`, kill signals) goes in a file named `*.linux.test.ts`, run by `npm run test:linux` (L18; [testing](03-testing.md), section 1).
- **Comments say why, not what.** No commented-out code.
- **Secrets never reach a log,** an error message, a fixture or a recording. The model adapter redacts the authorisation header before anything is stored.
- **Small files.** If a file passes about 400 lines, split it by responsibility.

## 6. What "done" means for any work package

1. Every file the work package lists exists, and nothing outside its scope changed.
2. `npm run check` and `npm test` pass on the branch, on Windows, and `npm run test:linux` passes in WSL on a freshly synced mirror (L18).
3. The tests the work package lists exist and pass where section 4 runs them (the render, acceptance and claim levels in WSL on a freshly synced mirror), including any acceptance case or claim test assigned to it. A test that cannot pass yet is in the known-failures registry with an issue ([testing](03-testing.md), section 8).
4. Every setting, diagnostic code and name it introduces matches the design, or a build revision records the difference.
5. The README of every package it changed is updated (section 2).
6. The pull request body, following the template, lists what was built, the commands run with where and their results, each claim's evidence label, what is not proved, and every doubt about the design.
7. For care: high, the review is closed.
8. **The pull request is merged by squash and its issue closed.**

## 7. Work package template

Every work package in a milestone document has these parts, in this order.

```
### M<n>-<nn> — <title>

- **Care:** normal | high
- **Package:** packages/<name>  (and any test folder)
- **Depends on:** <work package IDs>     **Parallel with:** <IDs, or "none">
- **Live calls:** none | <what, and a dollar ceiling>

**Goal.** One or two sentences: what exists when this is done.

**Read first.** The exact design sections (document and section number) and the decisions
in lld/11 (by identifier) that bind this work. Nothing else needs reading.

**Build.** The files to create and the public interface, using the design's names.
Signatures are illustrative unless the design fixes them.

**Rules that are easy to get wrong.** The few points where a reasonable implementer
would go astray: an ordering, a rounding rule, an authority check, a code that must be
returned. Each with its design reference. Not a restatement of the design.

**Tests.** What must be tested and the pass criterion, with numbers where the design
gives them. Names any acceptance case (A1..A14) or claim (R10 §2.2 ID) this package
must make pass, and the test file it goes in.

**Done when.** A checklist the orchestrator can verify by running commands.

**Out of scope.** What a later work package does, so this one does not start it.
```

The block from its heading to the next work package's heading is, unchanged, the body of the work package's GitHub issue and what the pointer command prints, so the heading format (`### M<n>-<nn> — <title>`) and the reference format in "Read first" (`lld/04 §2.4`, `R3 §2.6`, decision IDs such as `G15`) are kept exactly. The pointer command's tests pin both formats. In the issue, the "Depends on" line also gives issue numbers (orchestration §9).

## 8. Milestone document shape

Each file under `docs/impl/milestones/` has: the milestone's goal in R10's words; what must already exist; a dependency sketch of its work packages; the work packages; the **acceptance list** (commands and expected results that prove R10's "done when"); the claims of R10 section 2.2 assigned to it, each with its fallback; and the live-call budget, if any.

## 9. Changes to these conventions

- **15 November 2026.** The lead's rulings L18 (Linux-only unit tests and `npm run test:linux`), L19 (one WSL mirror per worktree, the tool folder `~/.cutroom-build/.tools`, `CUTROOM_ENV_FILE`, what `wsl:sync` copies) and L21 (the guard hook's further refusals), recorded in section 18 of the [integration decisions](../lld/11-integration-decisions.md), are applied in sections 1, 4, 5 and 6.
- **15 November 2026.** The lead's rulings L38 (the `tools/models/` export script) and L45 (the mirror folder names `~/.cutroom-build/main/` and `~/.cutroom-build/<worktree name>/`) are applied in section 1.

The outcome of M0-01b's three-layout timing measurement, and of its re-run at the end of M2 (L43), is recorded here if it moves a test level from the place section 4 gives; a level moves only if it is clearly faster in the other layout.
