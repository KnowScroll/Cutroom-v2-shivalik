# Cutroom v2 — rules for every session and subagent

Cutroom v2 turns a written brief into a finished 60–120 second vertical video, autonomously. The design is finished and frozen. This folder, `C:\Users\XZNON\cutroom-v2`, is where it is built; its GitHub home is `KnowScroll/Cutroom-v2-shivalik`.

## Before doing anything

- **Orchestrator session:** read [`handoff.md`](handoff.md), then [`docs/impl/00-orchestration.md`](docs/impl/00-orchestration.md) and [`docs/impl/STATE.md`](docs/impl/STATE.md). Then check `git status`, the open pull requests and the last Actions run. Do the same after a context summary, before acting. Models (U36): you, reviewers, planners and investigators run on **Opus 5.5** (`model: opus`); implementers and test authors run on **Sonnet 5.5** (`model: sonnet`). Never Fable. Set the model on every subagent call.
- **Subagent:** read your brief (it starts from `npm run wp-context -- <ID>`), then [`docs/impl/01-repo-and-conventions.md`](docs/impl/01-repo-and-conventions.md), [`docs/impl/03-testing.md`](docs/impl/03-testing.md), and only the design sections your brief names.

## Rules that always apply

1. **The design is `docs/lld/`.** Where two documents disagree, `docs/lld/11-integration-decisions.md` wins, and its later sections override earlier ones. `docs/hld/` and `docs/VISION.md` are the accepted baseline and are never edited. Do not redesign; if the design is wrong or silent, follow `docs/impl/00-orchestration.md` section 6.
2. **Never open, read, search or use `docs/archive/cutroom-v3.1-full-system-architecture.md`.** It is an old archive. It sits in this folder, ignored by Git, and must never be added or published. Never read, use or touch anything under `C:\Users\XZNON\Cutroom`: it is not this project.
3. **No image-generation or video-generation models,** for anything.
4. **The API keys** (`MINIMAX_API_KEY`, `OPENROUTER_API_KEY`) are in `.env` at this folder's root, ignored by Git. Only the model and speech transports read them, at run time. Never print, log, copy (also not into the WSL mirror), commit, or put a key in a fixture, recording, issue, pull request or GitHub secret.
5. **Nothing about the user** (name, email, machine paths) goes into a request to a model, speech or web service.
6. **Tests are evidence.** Never delete, skip, loosen or special-case a test to get a pass. A test that cannot pass yet goes in `tests/known-failures.ts` with an issue. Report failures with their output.
7. **Report honestly.** Say what ran, where, and what it showed. Label claims VERIFIED by test, VERIFIED by measurement, or ASSUMED. Do not guess: check the design, the evidence under `docs/research/`, or a small test.
8. **Live model or speech calls** only in work packages that say so, only from WSL, each recorded in the ledger in `docs/impl/04-spend.md`. The cap through milestone M6 is 10 US dollars at list prices.
9. **Names come from the design:** entity kinds, fields, settings, diagnostic codes, tool names and check IDs are spelled as `docs/lld/` spells them.
10. **Git and GitHub.** One issue, one `wp/<id>-<short-name>` branch and one squash-merged pull request per work package (`docs/impl/00-orchestration.md` section 9). **Never push to `main`, never force-push.** The guard hook in `.claude/` enforces this; never bypass it. Subagents commit on their branch; the orchestrator pushes, opens and merges.
11. **Where things run.** Edit files only in this folder (or its worktrees), never in a WSL mirror. Each working tree has its own mirror: the main working tree's is `~/.cutroom-build/main/`, a Git worktree's is `~/.cutroom-build/<worktree name>/` (L19, L45). `check` and `npm test` run on Windows; the Linux-only unit tests (`*.linux.test.ts`, run by `npm run test:linux`), render, acceptance, claim and live tests and every run of the product run in WSL on that tree's mirror, after `npm run wsl:sync` (L18).
12. **Stop for the user** when `docs/impl/00-orchestration.md` section 7 says so, and when milestone M6 is complete.

## Commands

Run from the root of this folder (Windows) or of the mirror (WSL). See `docs/impl/01-repo-and-conventions.md` section 4.

```
Windows, working tree
npm run check               type check, lint, dependency edges, integrity (also in CI)
npm test                    unit and property tests, no browser, no network (also in CI)
npm run wp-context -- <ID>  a work package with its design sections, READMEs and decisions
npm run wsl:sync            refresh this working tree's WSL build mirror

WSL, this working tree's build mirror
npm run test:linux          unit tests that need Linux (*.linux.test.ts; also in CI)
npm run test:render         tests that drive Chrome or FFmpeg
npm run test:accept         acceptance cases
npm run test:claims         claim tests
npm run test:live           tests that call MiniMax or OpenRouter (CUTROOM_LIVE=1, a ledger line)
npm run env:check           verify pinned Node, Chrome, FFmpeg and fonts
```

## Where things are

| Path | What |
|---|---|
| `handoff.md` | How to start or resume the build; current state |
| `docs/impl/` | Orchestration rules, conventions, environment, testing, spend, `STATE.md`, milestone documents, reports |
| GitHub issues and pull requests | Per-work-package status, discussion and history |
| `.claude/`, `.github/` | The guard hook; the workflow and the issue and pull request templates |
| `tools/` | Developer scripts, including the pointer command (`tools/context/`) |
| `docs/lld/` | The frozen low-level design (`10` is the build plan and acceptance; `11` is the decisions record) |
| `docs/hld/`, `docs/VISION.md` | The accepted high-level design and the vision |
| `docs/research/` | Findings and spike evidence (`10` is the evidence log) |
| `packages/` | Product code, one package per module, each with a `README.md` |
| `tests/` | Acceptance cases, claim tests, golden briefs, fixtures, `known-failures.ts` |
