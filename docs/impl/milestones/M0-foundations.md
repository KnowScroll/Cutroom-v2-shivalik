# Cutroom v2 — Implementation · Milestone M0: Foundations

**Written:** 15 November 2026
**Status:** Build plan, following [orchestration](../00-orchestration.md) and [conventions](../01-repo-and-conventions.md) §7–8.
**Read with:** [environment](../02-environment.md) · [testing](../03-testing.md)

Signatures, type shapes and file names are illustrative unless the design fixes them. Persisted names (tables, columns, settings, codes) are the design's. R1 is `lld/02`, R3 `lld/04`, R5 `lld/06`, R6 `lld/07`; "b2b" is `research/evidence/b2b-sqlite-node.md`.

## Goal

R10 §4.2: M0 builds the "repository and packages; settings registry with override levels; R1 types (flicks, IDs, hashes); storage adapter over `node:sqlite`; blob store; CLI skeleton (R3, R6)". It is done when "canonical-JSON vectors pass; the 200-kill promotion drill passes on real code; start-up refuses a `9p` mount".

## Provides to later milestones

- **foundations:** flick time (`Rational`, `isFlickExactRate`, `presentedFrame`, `filmFrames`, `audioSamples`, `parseTime`, `formatTime`, `mediaTicksToFlicks`), rounding half up (L6); `newEntityId`, `newJobId`, `isHandle`; `canonicalJson`, `hashCanonical`, `ArtifactRef`, `workKey`; R1's vocabularies; `Predicate` and `Need`, R5 §2.4's types, declared here for the compiler, project-core, the scheduler, quality and the harness (B:SD1); `Diagnostic` and `Result`; `SettingsRegistry` (`register`, `resolve`, `checkOverride`) with keyed values (A:M0-3).
- **Every package's `settings.ts`:** its stage's named settings with default, `override_by` and `range`.
- **project-core:** `StorageAdapter` (`exec`, `prepare`, `tx`, `backup`, `close`) with grouped commits and a per-transaction `full` flag, the grouped writer that M3-01 wraps (L2); `registerMigrations`; `checkSpaceMount`; the start-up codes (A:M0-4); `BlobStore` (`ingest`, `open`, `sweep`) and `BlobRootProvider`, which M3's `blob_roots()` implements; `putEntityVersion`, `putRevision`, `snapshot`, branches, and `swapAcceptedHead` with a same-transaction hook, which M2's promotion calls and through which M2-05 inserts the head-accepted `event` row (B:SD3).
- **cli:** `cutroom new | run | status | stop`, the Space socket, the `ControlApi` interface M4 implements; `SPACE_IN_USE` and `SOCKET_PATH_TOO_LONG` (A:M0-4); backups in the Space (A:M0-10).
- **tools:** the edge, code-coverage and integrity checks, `env:check`, `pins.json`, `fonts.conf`; the pointer command `wp-context`; `wsl:sync` and the WSL build mirrors, one per worktree (L19); `npm run test:linux` for the `*.linux.test.ts` files (L18); the known-failures registry.
- **repository:** the guard hook, the issue and pull-request templates, the GitHub workflow (M0-01a, M0-01b).

## What must already exist

The machine of [environment](../02-environment.md) §1; the bootstrap of [orchestration](../00-orchestration.md) §12 (Git, the first push, labels, milestones, issues); M0-01b carries out environment sections 2 to 9. The open points this document raised are resolved (section "Resolved points"), and each work package's "Read first" line names the decisions that bind it.

## Dependency sketch

```
bootstrap (orchestration §12) ──> M0-01a guard hook, templates ──> M0-01b

M0-01b scaffold, both environments, mirror, tooling, env:check, timings
  ├── M0-02 time, IDs, vocabularies, predicates ┐
  ├── M0-03 hashing, canonical JSON             ├─ parallel: separate folders of packages/foundations
  └── M0-04 settings registry                   ┘
        └── M0-05 settings catalogue (one file per package)
              └── M0-06 storage adapter (also needs M0-02)
                    ├── M0-07 blob store       ┐ parallel: src/blob, src/revision
                    └── M0-08 revision store   ┘ (also needs M0-03)
                          ├── M0-09 kill drill      ┐ parallel
                          └── M0-10 CLI and Space   ┘ (needs M0-07, M0-08)
```

Parallel foundations packages each add one export line to `packages/foundations/src/index.ts`; the orchestrator merges that file.

## Work packages

### Before M0-01: the bootstrap

Not a work package: it has no issue, no branch and no pull request, because there is no `main` yet. The orchestrator carries out [orchestration](../00-orchestration.md) §12 itself, as the build session's first act (U34): it initialises Git in the project folder, confirms `.gitignore` and adds `.gitattributes`, shows that `.env` and the v3.1 archive are untracked, creates the labels, the GitHub milestones `M0` to `M6` and one issue per work package of M0 to M6, writes `docs/impl/STATE.md` with its links to those issues, commits the design and planning documents with `STATE.md`, adds the remote `KnowScroll/Cutroom-v2-shivalik` and pushes `main` (the only direct push to `main` the build makes, and the one push made before the guard hook exists, L21). `STATE.md` is written in this bootstrap commit; no work package's pull request edits it, and after the bootstrap it changes only as L20 says (L42). The bootstrap's results (the first commit, `git ls-files --eol`, the untracked check, the issue numbers) are recorded in M0-01a's pull request.

**M0-01 is split in two,** because the guard hook, the scaffold, both environments and the tooling are too much for one sitting. M0-01a depends on the bootstrap; M0-01b depends on M0-01a. **Wherever this document, a later milestone document, an issue or a decision says M0-01, it means M0-01b, which includes M0-01a's result:** M0-02, M0-03 and M0-04 depend on M0-01b, and the resolved points that name M0-01 bind M0-01b. U27's measurement and U30's and U31's tools are built as stated below.

### M0-01a — Repository bootstrap files and the guard hook

- **Care:** normal
- **Package:** `.claude/` (settings and hook with its tests), `.github/ISSUE_TEMPLATE/`, `.github/pull_request_template.md`
- **Depends on:** the bootstrap     **Parallel with:** none
- **Live calls:** none

**Goal.** Before any branch is pushed, a tested Claude Code `PreToolUse` hook guards `main` and the off-limits files in the running session, because GitHub cannot (U30); the issue and pull-request templates exist; the bootstrap's untracked and line-ending checks still hold.

**Read first.** Orchestration §§8–10 and 12; conventions §1, §7; environment §3.2 "The guard hook's Node", §11; `lld/11` U20, U28 to U30, U34, L20, L21, L42; the study [`impl/research/knowscroll-workflow.md`](../research/knowscroll-workflow.md) §1 (the `.claude/` rows) and "What to copy" rows 2, 5 and 6; [`impl/research/target-repo-state.md`](../research/target-repo-state.md) §§1, 6, 8.

**Build.**
- `.claude/settings.json` registering one `PreToolUse` hook that runs `.claude/hooks/guard.mjs` on every tool call (both shells and the file tools), with a short status message.
- `.claude/hooks/guard.mjs`: refuses exactly what orchestration §9 lists (force pushes; any push that updates or deletes `main`; adding `.env` or the v3.1 archive to Git; any tool call that reads the archive; printing or copying `.env`; `git clean` with `-x` or `-X`, which would delete `.env`; any command or tool call that names a path under `C:\Users\XZNON\Cutroom`, L21), exiting with code 2 and a one-line reason naming the rule. Built-in modules only.
- `.claude/hooks/guard.test.mjs` (`node:test`) with a refused list and an allowed list.
- `.github/ISSUE_TEMPLATE/work-package.md`, in the sections of conventions §7 plus "Depends on: #n" and a link to the milestone document at a commit; and `.github/ISSUE_TEMPLATE/problem.md` (what failed, the command, where it ran, its output, the evidence label, the work package expected to fix it), used for known failures, flaky tests, red Actions runs and deferred review findings.
- `.github/pull_request_template.md`: What was built; Commands run (each with where it ran and its result); Evidence (each claim labelled VERIFIED by test, VERIFIED by measurement or ASSUMED); Not proved; Design doubts; Review (for care: high); `Closes #`.

**Rules that are easy to get wrong.**
- The hook sees commands from Git Bash and from PowerShell, and paths and patterns from the file tools. Match all of them, case-insensitively and with either path separator, since Windows paths are case-insensitive.
- The older folder `C:\Users\XZNON\Cutroom` must be matched as a whole path segment, in any case, with either separator and in its WSL spelling `/mnt/c/Users/XZNON/Cutroom`, so that the project folder `C:\Users\XZNON\cutroom-v2`, which begins with the same letters, is never refused (L21). `git clean` is refused when `-x` or `-X` appears alone or inside a combined flag such as `-fdx`.
- A push can reach `main` by many spellings: `main`, `HEAD:main`, `refs/heads/main`, `:main`, `--delete main`, `--all`, `--mirror`. Force can be `--force`, `-f`, `--force-with-lease` or a `+` refspec. Each is a refused case.
- The flow must still work: pushes of `wp/` branches and `m*-done` tags, `gh pr create`, `gh pr merge --squash --delete-branch`, `git status --ignored` are allowed cases. The simplest safe rule for the archive is to refuse every tool call whose input names it. A false refusal costs one reworded command; a false allowance is a defect.
- The hook runs under whatever `node` Claude Code finds on the Windows `PATH` (nvm's 22.23.4 on 15 November 2026), not the build's Node 26, so it uses built-in modules only and its tests run under that Node (environment §3.2). M0-01b adds them to `npm test`, so Node 26 and GitHub Actions run them too.
- **The hook must be live before the branch is pushed.** The orchestrator proves it by issuing a harmless command the hook must refuse, such as `git push --dry-run origin HEAD:main`, and quotes the refusal in the pull request. If Claude Code needs a restart or an approval to load the new hook (it may load hooks only at session start or after the user approves them; ASSUMED), the session stops and asks the user (L21; orchestration §7).
- ASSUMED: once Git exists, the search tools skip ignored files such as the archive; M0-01a notes in the pull request whether a whole-folder file listing still shows it.

**Tests.** `guard.test.mjs`: every refused spelling above exits 2 with a reason naming its rule; every allowed command exits 0; a file-tool call naming the archive in either case and with either separator is refused; `cat .env`, `Get-Content .env` and a read of `.env` by the file tool are refused, while `git check-ignore -v .env` is allowed; `git clean -x`, `git clean -X` and `git clean -fdx` are refused; a command or file-tool call naming a path under `C:\Users\XZNON\Cutroom`, in either case, with either separator or as `/mnt/c/Users/XZNON/Cutroom`, is refused, while one naming a path under `C:\Users\XZNON\cutroom-v2` is allowed (L21).

**Done when.**
- [ ] `node --test .claude/hooks/` passes under the Windows Node that Claude Code uses.
- [ ] The hook is live in the session: the dry-run push to `main` is refused, and the refusal is quoted in the pull request.
- [ ] `git ls-files` lists neither `.env` nor the v3.1 archive; `git ls-files --eol` shows LF for every text file.
- [ ] The branch was pushed only after the hook was live; the pull request follows the new template, is squash-merged, and closes this issue.

**Out of scope.** The workspace, every `npm` command and the GitHub workflow, which needs `npm run check` and `npm test` to exist (M0-01b). `docs/impl/STATE.md`, which the bootstrap commit already holds with its links to the issues; this pull request does not edit it (L42).

### M0-01b — Workspace scaffold, both environments and the build tooling

- **Care:** normal
- **Package:** repository root, `tools/` (with `tools/context/`), `tests/known-failures.ts`, `.github/workflows/checks.yml`, `docs/impl/DEPENDENCIES.md`, skeletons and READMEs of all nine packages
- **Depends on:** M0-01a     **Parallel with:** none
- **Live calls:** none

**Goal.** Both environments of impl/02 are installed and pinned; the empty workspace builds, lints and tests on Windows and in the WSL build mirror; `npm run check` includes the edge, code-coverage and integrity checks; the pointer command, `wsl:sync`, `test:linux`, the known-failures registry and the GitHub workflow exist; the three-layout timings are measured.

**Read first.** Environment §§1–13 (the install steps are there, not here); conventions §§1–7; testing §1, §3 "Memory", §8 rules 4 and 5, §10 point 11; orchestration §4, §9; `lld/11` U25 to U27, U31, U32, L18, L19, L45; the study [`impl/research/knowscroll-workflow.md`](../research/knowscroll-workflow.md) §2 ("The nearest thing: `pnpm issue-context`") and "What to copy" rows 1, 4, 7, 8, 14 and 15; the "Interfaces to other stages" sections `lld/03` §3, `lld/04` §3, `lld/05` §3, `lld/06` §3, `lld/07` §3, `lld/08` §3, `lld/09` §3; `lld/04` §2.5 (the pinned `canonicalize` and `uuid` versions); the resolved points 1, 2 and 8 of this document and environment §13's resolved points.

**Build.**
- The environments by impl/02 §§2–9: the Windows Node 26 in `.tools\node-win\`; in WSL, the tool folder `~/.cutroom-build/.tools` (L19), `tools/env.sh`, `tools/fonts.conf` (naming its font directories relatively if fontconfig 2.13.1 allows it, A:env-3); `tools/pins.json` filled by measurement, `node_windows` included, with the operating-system half of the environment hash as A:env-3 defines it.
- Root `package.json` (workspaces over `packages/*`; the commands of conventions §4, `wsl:sync`, `wp-context` and `test:linux` included), `.npmrc` with `save-exact=true`, lockfile, and `.gitignore` gaining `node_modules/`, `dist/`, `.worktrees/` and `.tools/` (its `.env` and archive lines stay).
- `tsconfig.base.json` (`strict`, ES modules); nine package skeletons (`package.json` exporting `dist/index.js`, `src/index.ts`, `test/`, `tsconfig.json` with `references`, and a `README.md` in the shape of conventions §2 with every capability `planned`) named as conventions §2.
- `biome.json`.
- `tools/dependency-edges.json` and a check that every import and every `package.json` dependency is an allowed edge and nothing reaches past another package's entry point.
- The check of testing §8 rule 4: each package exports its codes; a code no test asserts fails.
- The integrity check in `npm run check`: `.env` and `docs/archive/cutroom-v3.1-full-system-architecture.md` are not tracked, and every tracked text file is LF.
- `tools/env-check` with its `--launch` form and its Windows part (impl/02 §9). `test:render`, `test:accept` and `test:claims` run it first and take the render lock (impl/02 §10); `test:live` refuses to start without `CUTROOM_LIVE=1` (testing §1).
- `npm run wsl:sync` and the build mirrors under `~/.cutroom-build/`, one per Git worktree (impl/02 §2; L19): the `rsync` of the working tree as it is, uncommitted changes included, leaving out `.git` and everything `.gitignore` ignores, then the mirror's own `npm ci` when the lockfile changed and the build; and `CUTROOM_ENV_FILE`, the variable that gives WSL commands the key file's path (impl/02 §8; L19).
- The split of Linux-only unit tests (L18): `npm test` on Windows leaves out files named `*.linux.test.ts`; `npm run test:linux` runs them in WSL on the mirror, and the workflow runs it in its Ubuntu job.
- The pointer command in `tools/context/`, built-in modules and Git only, with `node:test` tests (U31). `npm run wp-context -- <ID>` prints the work package block verbatim from its milestone document in `docs/impl/milestones/`; each design section its "Read first" line cites, extracted from `docs/lld/` by section number (both `lld/04 §2.4` and the R-numbers milestone documents use, such as `R3 §2.6`, each document's header giving the mapping); the README of each package it touches; and each `docs/lld/11` decision it names (IDs such as `G15` or `U23`, and section 18's identifiers: a lead ruling such as `L6`, a report row such as `A:M0-7` or `B:SD1`). A reference it cannot resolve is printed on an "unresolved" line, never dropped. `npm run wp-context -- decision <ID>` prints one decision.
- `tests/known-failures.ts`, empty, and its use by every test command (testing §8, rule 5).
- `.github/workflows/checks.yml` as testing §1 describes.
- `docs/impl/DEPENDENCIES.md` (name, exact version, purpose, date) for every dependency of conventions §3, including `@anthropic-ai/sdk`, `puppeteer-core` and `@puppeteer/browsers`.
- **The three-layout timing measurement** of testing §1: `npm ci`, the build, `npm run check` and `npm test`, cold and after a one-file change, (1) on Windows in the working tree, (2) in WSL on the mirror including `wsl:sync`, (3) in WSL directly on `/mnt/c`. The default placement of U27 is a reasoned choice, not a measurement; this measures it.

**Rules that are easy to get wrong.**
- No `^` or `~`; versions from `npm view` on the day (conventions §3), except `canonicalize` 5.1.0 and `uuid` 14.0.3, which R3 §2.5 names and the spikes verified: those are pinned, and any newer version is noted in `docs/impl/DEPENDENCIES.md` (A:M0-8). For `puppeteer-core` and `@puppeteer/browsers` the design names no version, so the implementer chooses; S7's pair, 25.17.0 and 3.2.7, is the safer choice, as the pair recorded driving build 157.0.8103.78 (A:M0-8). The Windows and WSL Node are the same release.
- On Windows the build's Node is `.tools\node-win\`; never `nvm use`, never a global install (impl/02 §3.2). In WSL the Windows `npm` on the `PATH` must never run; every WSL command sources `tools/env.sh` (impl/02 §1, §3.1).
- Never sync `node_modules`, build output, `.git` or `.env` into the mirror, and never edit the mirror. Windows `node_modules` hold native binaries that do not run on Linux.
- Layout (3) runs in a throwaway worktree under `.worktrees/`, never in the working tree itself, where WSL's `npm ci` would replace the Windows `node_modules`; it opens no SQLite database and is removed afterwards.
- Each package's `tsconfig` references and `package.json` dependencies match the edge table exactly; the check compares all three.
- `npm test` never starts Chrome or FFmpeg and needs no network; categories split by folder or file name, never by skipping (conventions §4). It passes on `win32` and on `linux`. A unit test that needs Linux process behaviour (sockets, `/proc`, kill signals) goes in a `*.linux.test.ts` file, which counts toward "done" like any other (L18). `env:check` compares hashes and installs nothing.
- Each Git worktree, the main working tree included, syncs to its own mirror folder under `~/.cutroom-build/`, beside the tool folder `~/.cutroom-build/.tools`, so deleting a mirror never deletes the tools (L19). The names are fixed (L45): the main working tree syncs to `~/.cutroom-build/main/`, and each Git worktree to `~/.cutroom-build/<worktree name>/`. Render tests from different worktrees never run at the same time: the render lock in the tool folder serialises them (L19; environment §10).
- The pointer command's tests pin the heading format (`### M0-04 — …`), the section format (`### 2.4 …`) and the reference formats against fixtures **and** against the real milestone and design documents, so a document edit that breaks extraction fails `npm test`.
- The workflow has one job, `permissions: contents: read`, no secrets, `cancel-in-progress`, and no render, live or Windows job (U35).

**Tests.** On a fixture workspace: an allowed import passes; a forbidden import, an undeclared dependency and a deep import (`@cutroom/project-core/src/…`) each fail, naming file and line. An exported code that no test asserts fails the check. A tracked `.env` fails the integrity check. A pins file with one wrong hash fails `env:check`, naming entry, expected and actual. The known-failures registry: an unlisted failure fails the run, a listed test failing with another code fails it, and a listed test that passes fails it. The pointer command: for a fixture work package it prints the block, every cited section and decision, and the owning READMEs; a reference to a missing section is printed as unresolved. A fixture `*.linux.test.ts` file is not run by `npm test` on Windows and is run by `npm run test:linux` (L18). An uncommitted new file in the working tree reaches the mirror after `wsl:sync`, and an ignored file such as `.env` does not (L19).

**Done when.**
- [ ] On Windows: `npm ci`, `npm run check` and `npm test` exit 0, and `npm run env:check` exits 0.
- [ ] `npm run wsl:sync`; then in WSL on the mirror `npm test`, `npm run test:linux`, `npm run env:check` and `npm run env:check -- --launch` exit 0.
- [ ] `docs/impl/DEPENDENCIES.md` matches `package-lock.json`.
- [ ] `npm run wp-context -- M0-02` prints M0-02, every section its "Read first" line cites and no "unresolved" line; its size is in the pull request.
- [ ] The workflow has run once on this pull request (or by hand) and passed; the run's link is in the pull request.
- [ ] The three-layout timings are in the pull request, ready for the M0 report; any level the numbers would move is named there.

**Out of scope.** All product code.

### M0-02 — Flick time, IDs, handles and the R1 vocabularies

- **Care:** normal
- **Package:** `packages/foundations` (`src/time`, `src/ids`, `src/vocab`, `src/readiness`)
- **Depends on:** M0-01b     **Parallel with:** M0-03, M0-04, M0-05
- **Live calls:** none

**Goal.** R1's time arithmetic, identifiers and shared enumerations, and R5's `Predicate` and `Need` types, exist as pure, tested functions and Zod schemas.

**Read first.** R1 §1.1–1.5, §1.7, Revision 1 items 1 and 7, Revision 3, §2.1, §2.4 first bullet, §4.1, §4.3, §5; R3 §2.1 structure rules 3–5, §2.5 "UUIDv7", §2.13 first paragraph; R5 §2.4 "Readiness predicates"; R6 D6.1 (the `Predicate` note); `lld/11` L6, B:SD1; b2b §8; conventions §5.

**Build.**
- `time`: `FLICKS_PER_SECOND`; `Rational {num, den}`; `isFlickExactRate`; `frameStart(n, T)`; `presentedFrame(t, T)` = ⌈t/T⌉; `filmFrames(duration, T)` with the extension it made; `audioSamples(N, T, rate)` = round(N·T / flicks per sample); `msToFlicks`; `parseTime` and `formatTime` (`650ms`, `5.15s`); `mediaTicksToFlicks(ticks, timescale)`; one `roundHalfUp(n, d)` that every "round to nearest" of R1 and R3 uses (L6).
- `readiness`: `Predicate` and `Need` as R5 §2.4 fixes them. They are declared here because the compiler, project-core, the scheduler, quality and the harness all use them and all import foundations; R5 keeps their meaning (B:SD1).
- `ids`: `newEntityId` (`ent_` + UUIDv7), `newJobId`, `newAttemptId`, `isEntityId`, `isHandle`.
- `vocab`: schemas for commitment states, job states, failure classes, verdicts, check types, severities, the location and coverage records and the three content lists (R1 §5); `Diagnostic {code, path, expected?, got?, candidates?}`; `Result<T>`.

**Rules that are easy to get wrong.**
- Integers only, guarded by `Number.isSafeInteger`; no BigInt (R1 §1.1). Compute ⌈t/T⌉ from the integer quotient and remainder: a floating quotient rounds to an integer at t = k·T + 1 when k is large.
- Frame n covers [n·T, (n+1)·T); an event appears on the first frame at or after it (R1 §1.4–1.5).
- Audio samples come from the absolute end time, never a sum of per-frame counts (R1 §1.4, Revision 1 item 7).
- Decimal seconds are parsed as decimal text, not by `parseFloat` (R1 §1.3).
- **Ties round half up,** towards +∞, at every "round to nearest" in R1 §1.4, §1.6, §1.7 and R3 §2.1 rule 5 (L6; R1 Revision 3). For a rational n/d with d > 0 the result is floor((2n + d) / 2d), computed exactly on integers; never round a floating-point quotient. Ties really occur: every odd tick at the 15,360 timescale is exactly half a flick (R1 §7).
- `mediaTicksToFlicks` divides 705,600,000 and the timescale by their gcd first: an hour at 15,360 ticks per second times 705,600,000 passes 2^53.
- IDs come from `uuid`'s `v7()`; `crypto.randomUUIDv7()` is not ordered within a millisecond (b2b §8).
- `unknown_outcome` is a job state, never a failure class (R1 §4.3).

**Tests.** Every rate of R1 §1.1 is flick-exact; 48 kHz is 14,700 flicks per sample, 1 ms 705,600, the 90 kHz tick 7,840; rate 15,360/1 is rejected (45,937.5). fast-check: `presentedFrame(t)` is the least n with n·T ≥ t, at t = k·T and k·T ± 1 near 2^53; `filmFrames` never shortens; `audioSamples` is exact at 48 kHz for every supported rate. `parseTime('5.15s')` = 3,633,840,000. Ties (L6): `mediaTicksToFlicks(1, 15,360)` = 45,938 (45,937.5 rounded up); `roundHalfUp` rounds an exact half up for positive and negative n, agrees with exact rational rounding on fast-check inputs near 2^53, and every function above that rounds to nearest gives the half-up result on a constructed tie. 100,000 IDs unique and in generation order (b2b §8). Valid and invalid handles (R1 §2.1). `Predicate` and `Need` accept R5 §2.4's shapes and refuse an unknown kind.

**Done when.**
- [ ] `npm run check` and `npm test` pass with these tests.

**Out of scope.** Time maps (R1 §1.6), beats and event references (M2); the evidence bundle (M6).

### M0-03 — Hashing, canonical JSON, artifact references and work keys

- **Care:** normal
- **Package:** `packages/foundations` (`src/hash`); vectors in `tests/fixtures/rfc8785/`
- **Depends on:** M0-01b     **Parallel with:** M0-02, M0-04, M0-05
- **Live calls:** none

**Goal.** One canonical-JSON and hashing path for every module, proved against RFC 8785's own vectors.

**Read first.** R1 §2.2–2.5 and the canonical-JSON row of §7; R3 §2.5 "Canonical JSON" and its first three bullets; b2b §7; RFC 8785 Appendix B, §3.2.2–3.2.4.

**Build.** `canonical.ts`, the only importer of `canonicalize`, so R3's thirty-line fallback can replace it; `canonicalJson(value)` behind a guard refusing anything not plain JSON; `sha256Hex`; `hashCanonical(value)` returning `{text, hash}`, `hash` being `sha256:` + lowercase hex; the `ArtifactRef {hash, media_type, size}` schema; `workKey(parts)` over the four groups of R1 §2.4 (their contents per capability are R4 D6's, M2); the `rev_` prefix helper.

**Rules that are easy to get wrong.**
- `canonicalize` 5.1.0 drops `undefined` properties, turns `undefined` in arrays into `null`, serialises `Date` by `toJSON`, writes −0 as 0, and throws on lone surrogates and BigInt (b2b §7). The guard refuses these first, so the hashed text is the content in memory.
- Return text with hash: R3 §2.5 stores exactly the hashed text.
- Keys sort by UTF-16 code units (RFC 8785 §3.2.3), never `localeCompare`. `canonicalize` is an ES module with a default export (b2b).

**Tests** (`packages/foundations/test/canonical-json.test`; vectors transcribed with their RFC section numbers, so no network): 26 of 26 Appendix B rows (24 exact, NaN and Infinity throw); the §3.2.3 sorting example; the §3.2.2 object gives §3.2.4's 118 bytes exactly; fast-check over 10,000 random nested objects with non-ASCII keys, surrogate pairs, integers to 2^53, values near 1e21 and 1e−7 and −0: 0 mismatches against a reference (keys by UTF-16 code units, values by `JSON.stringify`), and re-canonicalising gives identical text (b2b §7); a lone surrogate, `undefined`, a `Date` and a BigInt are refused.

**Done when.**
- [ ] The file passes inside `npm test`: R10's "canonical-JSON vectors pass".

**Out of scope.** Manifests, `tree_hash`, `pin_hash` (M0-08).

### M0-04 — Settings registry with override levels

- **Care:** normal
- **Package:** `packages/foundations` (`src/settings`)
- **Depends on:** M0-01b     **Parallel with:** M0-02, M0-03
- **Live calls:** none

**Goal.** Packages register named settings with default, `override_by` and `range`; the registry resolves effective values and says whether a writer may set an override.

**Read first.** R3 §2.7 bullets "Settings" and "Who may override a setting", §2.2 row `project` (`settings`), §2.1 rule 2, §5; `lld/11` G15, G20, G21, G22, K5–K7, A:M0-3, A:M0-11, B:O8a; `lld/09` §3.4, rule on `settings_overrides`; conventions §5.

**Build.** `SettingRecord {name, owner, type, default, override_by, range, note?}` with numeric, enum and list ranges (including add-only), a range that is an integer range or listed values (such as `audit.retention_days`, a number of days or `keep_all`), and keyed values: the owner fixes the set of keys, and each key has its own type and range (A:M0-3); `register(owner, records)`, `get(name)`, `resolve(name, layers)` over the ordered override layers, `checkOverride(name, value, writer_level)` returning `VALUE_OUT_OF_RANGE` or `FIELD_AUTHORITY`, `list(owner?)`. In `project.settings` a setting nests by every dot-separated segment of its name, so `delivery.audio.loudness_lufs` is stored at `settings.delivery.audio.loudness_lufs` and a patch path is `settings.` followed by the name; a keyed value adds its key as one more level, such as `settings.tool.result_max_tokens.project_read` (B:O8a, A:M0-3).

**Rules that are easy to get wrong.**
- `register` refuses a record without `override_by` or `range`, a duplicate, a name not `area.snake_case`, a default outside its range (G15; R3 §2.7 "Ranges"), and a name that is a prefix of another by dot-separated segments, such as `delivery.audio` beside `delivery.audio.loudness_lufs`, so that a value and a map never share a key (B:O8a).
- A `human` setting written by a `director` writer gets `FIELD_AUTHORITY` wherever the override is written, `quality_intent.settings_overrides` included (G21). Layers resolve in this order, the later winning: the registered default, then `project.settings`, then `quality_intent.settings_overrides` (A:M0-11).
- The add-only `rollback.excluded_kinds` refuses an override removing a default member (R3 §5).

**Tests.** Each refusal, a prefix name included; default without override, override with one; `VALUE_OUT_OF_RANGE` at both bounds; `FIELD_AUTHORITY` for a director on a `human` setting, accepted for a human; removing `decision` from the add-only list refused; one key of a keyed setting overridden while the others keep their defaults, and an unknown key refused; `audit.retention_days` accepts a number of days and `keep_all` and refuses another word; an R9 setting set in both `project.settings` and `quality_intent.settings_overrides` resolves to the Quality Intent's value.

**Done when.**
- [ ] `npm run check` and `npm test` pass with these tests.

**Out of scope.** Validation stage 4, which calls `checkOverride` (M2); the records (M0-05).

### M0-05 — Settings catalogue of every stage

- **Care:** normal
- **Package:** `src/settings.ts` of each of the nine packages
- **Depends on:** M0-04     **Parallel with:** M0-02, M0-03
- **Live calls:** none

**Goal.** Every setting in the §5 tables of R2 to R9 is registered by its owning package with the design's default and `override_by` and a range, as R3 §2.7 "Ranges" places at M0 and M2 §3 expects.

**Read first.** §5 of `lld/03`, `lld/04`, `lld/05`, `lld/06`, `lld/07`, `lld/08`, `lld/09`; R3 §2.7 "Who may override a setting"; `lld/11` H1, H9, H10, G4, G16, G20, G22, K5–K7, U4, U6, U11, A:M0-3, A:M0-10, A:M1-3, B:M3-7, L9, L10, L12, L13.

**Build.** One `settings.ts` per package, exported from its entry point, and a test per package registering its records into a fresh registry.

**Rules that are easy to get wrong.**
- Names and defaults are copied exactly, and each setting is registered once, by its owner; "used by name" rows are not repeated (`pixi.max_per_unit` R4 and `pixi.unit_browsers` R5, H1; `capture.max_buffered_frames` R2, H9; `follow.max_depth` R4, H10; `staging.handoff_tolerance_du` R4, G4).
- `override_by` is `human` exactly where the owner's table or `lld/11` marks it (G15 classes (a)–(f), K5–K7); the later `lld/11` section wins a disagreement.
- Names R6 §5 lists as gone are not registered. User decisions set values: `rights.share_alike_ok` false (U4), `screen_capture.allowed_origins` empty (U6).
- A range the design does not give is derived from the default and type and listed in the report for the orchestrator to record (G15).
- Keyed values (A:M0-3): `tool.result_max_tokens` {`default`, `project_read`, `web_fetch`}; `subloop.max_concurrent` {`authors`, `reviewers`, `researchers`, `experiments`, `treatments`}; `reviewer.thinking` and `reviewer.max_output_tokens` {`shot`, `film`}; `captions.min_duration_ms` {`phrase`, `word_pop`, `highlight`}. `audit.retention_days` takes a number of days or `keep_all`, its default.
- The settings that section 18 of `lld/11` adds are registered as the corrected stage designs give them: `db.backup_keep` (A:M0-10), `encode.aac_bitrate_kbps` (A:M1-3), `llm.recover_interval_s`, `llm.recover_rate_fraction` and `breaker.failure_count` (B:M3-7), `align.lipsync_min_fraction` (L9), `align.word_end_offset_ms` (L10), `voice.provider_only` (L12), `stt.short_take_words` and `stt.short_take_max_errors` (L13). `llm.max_concurrent` is `human`, with range 1 to 8 (B:M3-12).

**Tests.** Every package's records register; every `human` row of each table is `human`; twenty defaults sampled across stages match the design text.

**Done when.**
- [ ] `npm run check` and `npm test` pass; the report lists every derived range.

**Out of scope.** Reading the settings; each module does that when built.

### M0-06 — Storage adapter over `node:sqlite` and the Space mount check

- **Care:** high
- **Package:** `packages/project-core` (`src/storage`)
- **Depends on:** M0-02, M0-05     **Parallel with:** none
- **Live calls:** none

**Goal.** A Space database opens through one small adapter that sets WAL, foreign keys, the busy timeout and `STRICT` tables; groups commits; commits listed transactions at `FULL`; runs migrations; and refuses a Space on `9p`.

**Read first.** R3 §2.6 "Runtime", "Choice", "Connection settings", "Durability and grouped commits", "Where a Space lives"; R3 §2.12 last sentence; R3 §4 rows "Crash mid-patch…" and "Database damage"; R3 §5; R5 §2.1 "SQLite behaviour this relies on"; `lld/11` §14.4, H12, L2, A:M0-4, A:M0-10; b2b §1, §3 (with the run A note), §4, §6.

**Build.**
- `driver.ts`, the only file naming `node:sqlite` or its class (`Database`, aliased `DatabaseSync` since v26.11.0), so `better-sqlite3` stays a one-file fallback.
- `openDatabase(path, {readonly})`: refuses SQLite before 3.51.3 with `SQLITE_TOO_OLD` (the version found); sets WAL, `foreign_keys=ON`, a 5 s busy timeout (a named constant in `driver.ts` citing R3 §2.6, not a setting; A:M0-5), `synchronous` from `db.synchronous`; runs `PRAGMA quick_check` and refuses a damaged file with `DB_DAMAGED`, carrying the `quick_check` output (A:M0-4). Read-only connections for worker threads.
- `registerMigrations(owner, scripts)`; at open, an automatic `backup()` into `backups/` in the Space directory, named by UTC time and `user_version` (A:M0-10), then pending scripts in one transaction, advancing `user_version` (R3 §2.12). Every owner's scripts share the one `user_version` and one number sequence that only grows and is never renumbered; each owner keeps its scripts in its own package, and the runner applies all registered scripts in number order and refuses a gap or a duplicate (R3 §2.6, §2.12; A:M0-9). A failing script returns `MIGRATION_FAILED` (owner, script, error) with `user_version` unchanged (A:M0-4).
- The grouped writer, which Project Core owns and M3-01 wraps (L2): one write connection on the main thread. The first transaction opens `BEGIN IMMEDIATE` and starts a `db.commit_tick_ms` timer; later ones join, each in its own `SAVEPOINT`. `tx(fn, {durability})` resolves after the group's `COMMIT`. A `full` member closes any open `NORMAL` group and commits in its own group at `FULL` (L2).
- `exec`, `prepare`, `backup(path)`, `close()` (commits the open group first); `checkSpaceMount(dir)`, returning `SPACE_MOUNT_REFUSED` (mount point and type) for `9p` and `SPACE_MOUNT_UNKNOWN` when `/proc/mounts` cannot be read (A:M0-4).

**Rules that are easy to get wrong.**
- `FULL` only for promotions, paid-call intents and confirmations, and deliverable records: it stalled the main thread up to about 190 ms, against 25–30 ms at `NORMAL` (R3 §2.6; b2b §3).
- A `full` member never joins a group opened at `NORMAL`: it closes that group first and commits in a group of its own at `FULL` (L2). A test records whether SQLite allows `synchronous` to change inside an open transaction, and the pull request states the result; the rule holds either way (L2).
- Never drain the write queue in one event-loop turn: b2b's run A froze the process for 7.3 s so. Yield between groups.
- Promises resolve and events fire only after the commit; one write connection, every other read-only (R5 §2.1).
- A kill usually leaves one committed transaction unacknowledged (b2b §4: 353 of 400); nothing may assume otherwise.
- One member's rollback inside a group is built and unit-tested here; its behaviour across an abrupt stop is claim H12 at M3 (L1), whose fallback commits listed transactions alone.
- The mount check reads the type field in `/proc/mounts` for the longest mount point holding the Space's real path (symlinks resolved) and refuses `9p`; `stat -f` prints `ext2/ext3` for ext4, so never match `stat` output (b2b §6). A path not yet created is checked through its nearest existing ancestor. An unreadable mounts table refuses, because nothing else would fail by itself (A:M0-4). The mounts table is injected in unit tests, so they also run on Windows, which has no `/proc/mounts`.

**Tests** (`packages/project-core/test/storage.test`). Pragmas read back (`wal`, foreign keys 1, timeout 5,000, `NORMAL`); SQLite 3.51.2 (faked) refused with `SQLITE_TOO_OLD`; a damaged file gives `DB_DAMAGED` with the `quick_check` output. Migrations run in order after a backup written to `backups/`; a failing script gives `MIGRATION_FAILED` and leaves `user_version` unchanged; a gap or a duplicate script number is refused. Driver spy: ten transactions in one tick make one `COMMIT`, each promise resolving after it; a `full` member arriving while a `NORMAL` group is open closes that group and commits alone at `FULL`; a throwing member rolls back alone; the test of changing `synchronous` inside a transaction reports its result. A second writer fails busy (errcode 5). Fixture `/proc/mounts`: ext4 `/` accepted; `9p` `/mnt/c` refused with `SPACE_MOUNT_REFUSED`, also through a home symlink; nested mounts by longest prefix; an unreadable table gives `SPACE_MOUNT_UNKNOWN`.

**Done when.**
- [ ] `npm run check` and `npm test` pass with these tests; the review is closed.

**Out of scope.** Other tables (M0-07, M0-08, M2, M3); backup rotation (M0-10); the H12 tests (M3); a writer thread (R3 §2.6, later).

### M0-07 — Blob store

- **Care:** high
- **Package:** `packages/project-core` (`src/blob`)
- **Depends on:** M0-06     **Parallel with:** M0-08
- **Live calls:** none

**Goal.** Blobs are ingested with the durability the caller asks for, opened with a size or hash check, and swept by one mark-and-sweep under the grace period.

**Read first.** R3 §2.6 "Blob store"; §2.14 bullet "Blobs"; §4 row "Crash mid-…"; §5 rows `blob.*`; R5 §2.12; `lld/11` H7, A:M0-4; b2b §5.

**Build.** The `blob` table (R3 §2.6 columns); layout `blobs/sha256/<first two hex>/<64 hex>` and `tmp/` in the Space; `ingest(stream, {durable, media_type})` → `ArtifactRef` (stream to `tmp/<uuid>` while hashing, rename into place, make read-only, insert the row; a known hash discards the temporary file); `open(ref, {purpose})` with the size check and `blob.verify_on_read`; `sweep({now})` over registered `BlobRootProvider`s, explicit pins first.

**Rules that are easy to get wrong.**
- `durable: true` syncs file and directory before `ingest` resolves, hence before the referencing transaction: a crash may leave a file without a row, never a row without a file (R3 §2.6). Syncing cut ingest from 177–329 to 36–41 MB/s (b2b §5), so only durable blobs pay.
- `durable: false` syncs nothing; a size mismatch on open removes the row and returns R3's existing `BLOB_MISSING`, the blob being treated as evicted (R5 §2.12), so the caller re-runs the job. No new code is needed (A:M0-4).
- `tmp/` is on the same filesystem, or rename is not atomic (R3 §8).
- Grace protects every unrooted blob younger than `blob.grace_hours`, with or without a row; a file without a row is aged by its modification time (H7).
- Sweep order: state `deleting`, unlink, delete row; the next sweep finishes an interrupted one (R3 §2.14). Only the sweep unlinks.

**Tests.** A 1 MB ingest: right path and hash, read-only, `tmp/` empty; duplicate ingest; an fs spy sees a durable ingest sync file and directory, a non-durable one nothing; a crash between rename and insert leaves a file kept within grace, removed after; a truncated non-durable file makes `open` remove the row and return `BLOB_MISSING`; `verify_on_read = always` catches one changed byte; an interrupted sweep is completed; a rooted old blob stays.

**Done when.**
- [ ] `npm run check` and `npm test` pass with these tests; the review is closed.

**Out of scope.** The `version_blob` provider (M0-08); evidence, deliverable and Scheduler roots and eviction (M3, M6); `purge` (M9).

### M0-08 — Revision store and the accepted-head swap

- **Care:** high
- **Package:** `packages/project-core` (`src/revision`)
- **Depends on:** M0-03, M0-06     **Parallel with:** M0-07
- **Live calls:** none

**Goal.** Entity versions and revisions are stored content-addressed, and the accepted head moves only by a compare-and-swap that appends the accepted log in the same `FULL` transaction.

**Read first.** R1 §2.2 with Revision 1 item 4; R3 §2.5; R3 §2.6 rows `entity_version`, `revision`, `branch`, `accepted_log`, `version_blob` and "Atomic accepted-head update"; R3 §2.7 bullets "Branch" and "Promotion"; b2b §2, §4.

**Build.** The five tables, `STRICT`; `putEntityVersion(doc, blobs?)` → `{hash, pin_hash}`, insert-only and idempotent, with `version_blob` rows; `putRevision({project, parents, entities, origin})` → `{revision_id, tree_hash}`, storing the manifest text exactly as hashed; `getRevision`; `snapshot(revision_id)` by `json_each`; `createBranch`, `getBranch`; `swapAcceptedHead({expected_base, candidate, from_branch, decision, by}, alsoInTransaction?)` → new `seq` or `STALE_BASE`, as one `full` transaction; a `version_blob` root provider.

**Rules that are easy to get wrong.**
- Parents are hashed, time and author are not: a retried merge gets the same ID, a rollback a new one (R3 §2.5).
- `tree_hash` covers only the entity map; `pin_hash` hashes the document without `commitment.readiness` and equals `hash` without a commitment (R1 §2.2; R3 §2.5).
- `changes()` must be 1, otherwise the transaction rolls back and returns `STALE_BASE` (R3 §2.6).
- Head, log row and hook rows commit together at `FULL`. R5 §2.4 states the `event` columns, but the table does not exist yet: M2-05 creates it in project-core's migrations and inserts the head-accepted event through this hook (B:SD3, which wins over A:M0-12's proposal that M3 create it).
- After a restart the caller reads the head again: about 9 kills in 10 left the last swap committed but unacknowledged (b2b §4).
- This is the swap, not promotion. M2's `project_promote` adds the grant, validation stages 1–7 and the ancestor check and must call this swap, since the drill verifies it.

**Tests.** Same content, same ID; new parents, new ID, same `tree_hash`; a readiness-only change keeps `pin_hash`; the stored manifest re-hashes to its ID; `STALE_BASE` changes nothing; ten swaps give `seq` 1 to 10; a throwing hook rolls the swap back; an 800-entity snapshot returns 800 documents (b2b: 1.7 ms warm; reported only).

**Done when.**
- [ ] `npm run check` and `npm test` pass with these tests; the review is closed.

**Out of scope.** Patches, handle history, dependency index, merge, `restore`, grants, authority, the `event` table and the head-accepted event (M2; B:SD3).

### M0-09 — The 200-kill promotion drill

- **Care:** normal (by a subagent that wrote neither M0-06 nor M0-08)
- **Package:** a test file run in WSL on the mirror; where it lives is the implementer's choice, and `tests/claims/m0-promotion-drill.test.ts` under `npm run test:claims` is the recommended place (A:M0-6)
- **Depends on:** M0-08     **Parallel with:** M0-10
- **Live calls:** none

**Goal.** R10's "200-kill promotion drill passes on real code".

**Read first.** b2b §4; R3 §4 row "Crash mid-…"; R5 §2.1 "Process death"; R10 §4.2 (M0 row); `lld/11` U27.

**Build.** A writer that opens a temporary Space on ext4 through the real adapter, grouped writer and revision store, and loops: put an entity version and a revision; `swapAcceptedHead` with a hook inserting a row into a test-only event table; after the promise resolves, write the `seq` to stdout synchronously. A parent that waits for the first acknowledgement, sends SIGKILL after a seeded random delay of 0–250 ms with 15% within 5 ms, reopens and checks, and starts the next writer on the same database, 200 times.

**Rules that are easy to get wrong.** The writer uses the product modules unchanged; a re-implemented transaction proves nothing. Acknowledge only after the promise resolves. Grouping is on: batch 2b drilled separate commits only. The drill needs Linux kill behaviour and a Space on ext4, so it runs in WSL on the mirror, never inside `npm test` on Windows (U27; A:M0-6).

**Tests.** After every kill (b2b §4): `integrity_check` ok; head equals the last `accepted_log` revision; every acknowledged `seq` present; no gap; each row's `previous` is the prior row's revision; event rows match `accepted_log` one to one; at most one commit beyond the last acknowledgement. **Pass:** 200 SIGKILLs, 0 violations. Report how many left exactly one unacknowledged commit (b2b: 179 and 174 of 200).

**Done when.**
- [ ] The drill exits 0 in WSL on a freshly synced mirror and prints the counts.

**Out of scope.** Power loss (H12) and orphans (`R5-5`), M3.

### M0-10 — CLI skeleton and Space lifecycle

- **Care:** normal
- **Package:** `packages/cli`
- **Depends on:** M0-07, M0-08     **Parallel with:** M0-09
- **Live calls:** none

**Goal.** `cutroom new`, `run`, `status` and `stop` create, serve, inspect and close a Space; a second invocation reaches the Space process over a Unix socket; start-up refuses `9p`.

**Read first.** R6 D12; R3 §1 (the Space), §2.6 "Where a Space lives", §2.12, §2.14, §4 row "Database damage", §5 `db.backup_hours`, `db.backup_keep`; `lld/11` A:M0-4, A:M0-10, L18; conventions §1; environment §7; testing §1.

**Build.**
- The `cutroom` bin with every D12 command registered; those not built here exit non-zero naming their milestone.
- `new [dir]` (default `~/cutroom-space`): mount check before anything is created; layout, database at the current schema, `blobs/`, `tmp/`.
- `run [dir]`: start-up runs the mount check, SQLite version check, `quick_check` and migrations; holds the one write connection; `backup()` every `db.backup_hours` into `backups/` in the Space directory, named by UTC time and `user_version`, keeping the newest `db.backup_keep` periodic backups plus the newest pre-migration backup in any case (A:M0-10); serves the socket in the Space directory; refuses with `SPACE_IN_USE` when another process serves the Space (A:M0-4).
- `status [dir]`: by socket when served, otherwise read-only: schema version, accepted head and P number, blob count and bytes. `stop [dir]`: commit, close, remove the socket.
- `ControlApi`, declared here with `status` and `stop` and stubbed in tests; M4's harness supplies the real one (D12).

**Rules that are easy to get wrong.** Start-up stops at the first failure: mount, SQLite version, `quick_check`, migrations. A `DB_DAMAGED` refusal names the newest backup; restoring is a human act (A:M0-10). A socket path over 107 bytes fails with `SOCKET_PATH_TOO_LONG` (A:M0-4). One process serves one Space (R3 §1); nothing goes over the network. Backups guard against database damage, not against losing the disk (A:M0-10). Tests that use the Unix socket or the real `/proc/mounts` of an ext4 directory need Linux and go in `*.linux.test.ts` files (L18); the others inject the mounts table, since Windows has none and an unreadable table refuses (A:M0-4).

**Tests.** `new` on a temporary ext4 directory creates layout and schema; with an injected `9p` table it is refused and creates nothing; `run`, `status` over the socket, `stop`; a second `run` refused with `SPACE_IN_USE`; a socket path over 107 bytes gives `SOCKET_PATH_TOO_LONG`; `status` without a process; a damaged database refused with `DB_DAMAGED` naming the newest backup; periodic backups (with a fake clock) keep the newest `db.backup_keep` and the newest pre-migration one; an unbuilt command exits non-zero.

**Done when.**
- [ ] `npm run check` and `npm test` pass with these tests, and `npm run test:linux` passes the Linux-only ones in WSL on a freshly synced mirror (L18).

**Out of scope.** Genesis and the project entity, `lock` (M2); `events` (M3); `say`, `pause`, `audit` (M4); `export` (M6).

## Claims of R10 §2.2 assigned to M0

None. H12 and `R5-5` are M3's; M0 builds what they test.

## Acceptance cases and live calls

No case of A1 to A14 is assigned to M0. No live calls; the budget is zero.

## Acceptance list

| # | Command | Expected result | Proves |
|---|---|---|---|
| 1 | On Windows: `npm ci && npm run check` | Exit 0: types, Biome, edges, code coverage | Repository and packages |
| 2 | In WSL on a freshly synced mirror, because `unshare` exists only on Linux: `unshare --user --map-root-user --net npm test` | All unit and property tests pass without network, in about a minute or less | Conventions §4 |
| 3 | `node --test` on the built `canonical-json.test` | 26 of 26 Appendix B rows, §3.2.3 order, §3.2.4's 118 bytes, 10,000 objects with 0 mismatches | Canonical-JSON vectors pass |
| 4 | The drill of M0-09, in WSL on the mirror (A:M0-6) | 200 SIGKILLs, 0 violations, counts printed | 200-kill drill on real code |
| 5 | In WSL: `npx cutroom new /mnt/c/Users/XZNON/cutroom-v2/.worktrees/cutroom-m0-check`, a path inside the project folder that does not exist | Non-zero exit with `SPACE_MOUNT_REFUSED` naming `9p`; the path still does not exist (A:env-5, A:M0-4) | Start-up refuses `9p` |
| 6 | In WSL: `npx cutroom run` on a home symlink into `/mnt/c` | Refused at the mount check with `SPACE_MOUNT_REFUSED`, before any other step | As 5, for an existing path |
| 7 | In WSL: `npx cutroom new ~/cutroom-m0-check`; `run` in the background; `status`; `stop` | `status` answers over the socket with the schema version; `stop` exits 0 and removes the socket | CLI skeleton |
| 8 | `npm run env:check`, then with `--launch` | Exit 0 | Pinned environment |
| 9 | In WSL on the mirror: `npm run test:linux` | Exit 0: the Linux-only unit tests pass (L18) | Repository and packages |

## Resolved points

Every point this document raised is closed by section 18 of the [integration decisions](../../lld/11-integration-decisions.md). The class is the research report's (`impl/research/open-points-A.md`, rows `A:M0-1` to `A:M0-12`), ruled on by the lead (`impl/research/lead-decisions.md`).

| # | Point | Resolution |
|---|---|---|
| 1 | **Edge directions** where two stages need things from each other | ANSWERED (A:M0-1). The later-milestone rule of conventions §2 settles every two-way pair: a package that needs something from a later milestone declares an interface itself (render's `BlobSource`, project-core's `BlobRootProvider`, the compiler's `ValueFormatter` and `CaptionSegmenter`). The edge list first proposed here stands, with project-core → render (point 2), but not the rule first stated with it, which would give a compiler → studio cycle (impl/01 §2; R2 §3; R3 §3; R4 §3). `Predicate` and `Need` in foundations add no edge (B:SD1) |
| 2 | **Home of `meta`, `Control`, `ProbeItem`** | ANSWERED (A:M0-2): option (a). Render defines the three schemas and `META_INVALID` parsing (M1-01); project-core imports them for its stored copy, which differs only in keeping a fixed duration in flicks (R2 §3; R3 §2.2, §3; I1) |
| 3 | **Keyed and "keep all" settings** | Decided (A:M0-3): one name per setting with a keyed value; the owner fixes the keys, each with its own type and range; `audit.retention_days` takes a number of days or `keep_all`. M0-04 builds it; M0-05 registers the keys |
| 4 | **Unnamed failure codes** | Decided (A:M0-4): Project Core's start-up codes `SPACE_MOUNT_REFUSED`, `SPACE_MOUNT_UNKNOWN`, `SQLITE_TOO_OLD`, `DB_DAMAGED` and `MIGRATION_FAILED` (M0-06); the CLI's `SPACE_IN_USE` and `SOCKET_PATH_TOO_LONG` (M0-10), the first also reporting the Scheduler's single-instance refusal (M3-01); a wrong-size blob returns the existing `BLOB_MISSING` (M0-07). Each has a test that produces it |
| 5 | **The 5 s busy timeout** | ANSWERED (A:M0-5): a named constant in `driver.ts` citing R3 §2.6, which fixes it beside WAL and foreign keys; R3 §5 lists no such setting (M0-06) |
| 6 | **Where the drill runs** | IMPLEMENTATION DETAIL (A:M0-6), left to the implementer: its place touches no module, persisted name or specified behaviour. It runs in WSL on the mirror, since it needs Linux kill behaviour and ext4; `tests/claims/m0-promotion-drill.test.ts` under `npm run test:claims` is recommended (M0-09) |
| 7 | **Ties in "round to nearest"** | Decided (L6; A:M0-7): round half up, computed exactly on integers, at every "round to nearest" in R1 and R3. Recorded as R1 Revision 3 and reported to the user. M0-02 builds it, with tests for ties |
| 8 | **Verified versions against `npm view`** | ANSWERED (A:M0-8): R3 §2.5 names `canonicalize` 5.1.0 and `uuid` 14.0.3, so those are pinned and newer versions noted. The design names no version for `puppeteer-core` or `@puppeteer/browsers`; they are the implementer's choice, S7's pair (25.17.0, 3.2.7) being the safer (M0-01b) |
| 9 | **One `user_version`** | ANSWERED (A:M0-9): one, as R3 §2.6 and §2.12 give it, with one growing script sequence across owners and each owner's scripts in its own package (M0-06) |
| 10 | **Backups** | Decided (A:M0-10): backups go to `backups/` in the Space, named by UTC time and `user_version`; the newest `db.backup_keep` periodic backups (a new R3 setting: 4, range 1 to 48, `human`) and the newest pre-migration backup are kept; `DB_DAMAGED` names the newest backup. M0-05, M0-06, M0-10 |
| 11 | **Override precedence** for R9's settings | Decided (A:M0-11): the registered default, then `project.settings`, then `quality_intent.settings_overrides`. M0-04's `resolve` builds it; M6 relies on it |
| 12 | **The promotion's `event` row** | Decided by B:SD3, which wins over A:M0-12 for this shared table (the lead's general ruling): M2-05 creates `event` in project-core's migrations with R5 §2.4's columns and inserts the head-accepted event through M0-08's same-transaction hook; M3-01 adds only subscription |

Decisions on other documents' points that also change this milestone: B:SD1 (M0-02), B:O8a (M0-04), B:M3-7 and B:M3-12 (M0-05), L2 (M0-06), L18 and L19 (M0-01b, M0-10), L21 (M0-01a).
