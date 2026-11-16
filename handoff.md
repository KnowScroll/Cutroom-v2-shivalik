# Cutroom v2 — Build Handoff

_Written: 15 November 2026, at the end of the design and planning phase._
_For: a new Claude Code session that acts as the build **orchestrator**._

## Goal

Build Cutroom v2, an autonomous system that turns a written brief into a finished 60–120 second vertical (9:16) video, exactly as the frozen design describes. Work as **one orchestrator session (Opus 5.5) that decides and coordinates, with Sonnet 5.5 subagents that implement and write tests, and Opus 5.5 subagents that review, plan and investigate**. Build milestones **M0 to M6**, which end with one complete film delivered end to end with no human input (the data-reel golden brief), then **stop and wait for the user**.

## Start here

**Models (the user's rule, U36).** Thinking and deciding on Opus 5.5; implementing on Sonnet 5.5. **Never Fable**, for anything.

| Who | Model | Set on the call |
|---|---|---|
| This session, the orchestrator | Opus 5.5 | (check with `/model` before you start) |
| Implementers and test authors, including for care: high packages | Sonnet 5.5 | `model: sonnet` |
| Reviewers, planners, investigators | Opus 5.5 | `model: opus` |

Set the model on every subagent call; never let one inherit this session's model. If a Sonnet implementer fails the same package twice, send an Opus investigator to find the cause and write instructions, and have a Sonnet implementer apply them.

**Read, in this order. Read only these before you begin.**

1. [`CLAUDE.md`](CLAUDE.md): the standing rules.
2. [`docs/impl/00-orchestration.md`](docs/impl/00-orchestration.md): how you work, when you stop, Git and GitHub, and the **bootstrap** (section 12).
3. [`docs/impl/STATE.md`](docs/impl/STATE.md): where the build stands.
4. [`docs/impl/01-repo-and-conventions.md`](docs/impl/01-repo-and-conventions.md): the layout, packages, commands and the work-package template.
5. [`docs/impl/milestones/M0-foundations.md`](docs/impl/milestones/M0-foundations.md): the first milestone.

Read the rest when a step needs it:

- [`docs/impl/02-environment.md`](docs/impl/02-environment.md): Windows and WSL set-up, the WSL build mirror, the pins.
- [`docs/impl/03-testing.md`](docs/impl/03-testing.md): test levels, where each runs, recorded replies, acceptance and claim tests.
- [`docs/impl/04-spend.md`](docs/impl/04-spend.md): the spend cap and ledger.
- [`docs/lld/10-r10-integration-acceptance-and-build-plan.md`](docs/lld/10-r10-integration-acceptance-and-build-plan.md): what each milestone must prove.
- [`docs/lld/11-integration-decisions.md`](docs/lld/11-integration-decisions.md): every decision. It wins over any other document, and later sections win over earlier ones.

Do not read the whole design up front. Subagents read the exact sections their work package names, through the pointer command `npm run wp-context -- <ID>` once it exists.

## What to do

1. **Check the start.**
   - The working directory is `C:\Users\XZNON\cutroom-v2`.
   - It is not yet a Git repository.
   - `gh auth status` shows an account that is admin on `KnowScroll/Cutroom-v2-shivalik`, and that repository is still empty.
   - `.env` exists at the root (check variable **names** only: `MINIMAX_API_KEY`, `OPENROUTER_API_KEY`).
   - If any of these is not so, stop and tell the user.
2. **Run the bootstrap** exactly as [`docs/impl/00-orchestration.md`](docs/impl/00-orchestration.md) section 12 says. In order:
   1. Initialise Git.
   2. Add `.gitattributes`.
   3. Create the labels, milestones and one issue per work package of M0–M6.
   4. Write `docs/impl/STATE.md` with the issue links.
   5. Show that `.env` and the archive are untracked.
   6. Make the first commit and the one direct push to `main`.
   The user started this session knowingly; the bootstrap needs no further confirmation.
3. **Build M0 to M6 in order,** one work package at a time or in parallel where a milestone document allows:
   - one issue, one `wp/<id>-<name>` branch and one squash-merged pull request per work package;
   - verify each subagent's work yourself by running the tests;
   - implement each package with a Sonnet 5.5 subagent, and have an Opus 5.5 subagent review every `care: high` package;
   - follow the milestone procedure in section 11 of the orchestration document.
4. **M0-01a builds the guard hook first.** It must be live before any branch is pushed.
5. **At each milestone's end:**
   1. Write `docs/impl/reports/M<n>.md`.
   2. Update `STATE.md` in its own pull request.
   3. Push the tag `m<n>-done`.
   4. Close the GitHub milestone.
   5. Refresh the "Current state" section below.
6. **After M6:** write the M6 report, and stop. M7 to M11 start only on the user's word.

## Rules you must not break

- **Never open, read, search or use `docs/archive/cutroom-v3.1-full-system-architecture.md`.** Exclude `docs/archive/` from every search. A planning agent once searched inside it by mistake because of the order of `grep` options; list files explicitly instead.
- **Never read, use or touch anything under `C:\Users\XZNON\Cutroom`.** It is an older, unrelated folder.
- **The keys** are read at run time from `C:\Users\XZNON\cutroom-v2\.env`. In WSL they are reached through `CUTROOM_ENV_FILE=/mnt/c/Users/XZNON/cutroom-v2/.env`. Never print, log, copy (also not into the WSL mirror), commit, or put a key in a fixture, recording, issue or pull request.
- **No image-generation or video-generation models,** anywhere.
- **Never push to `main`** after the bootstrap. **Never force-push.** Never bypass the guard hook.
- **Live model and speech calls** are made only in the work packages that say so, only from WSL, and each is logged in the ledger.
  - The cap through M6 is **$10.00 at list prices**. Spend is counted from response `usage` fields for MiniMax, and from OpenRouter's generation look-up for speech, **never estimated**.
  - The milestone ceilings are M4 $3.30, M5 $0.29 and M6 $3.92.
  - Stop and ask before any ceiling or the cap would be passed.
- **Tests are evidence.** Never delete, skip or loosen one. A test that cannot pass yet goes in the known-failures registry with an issue.
- **Do not redesign.**
  - If the design is wrong or silent, follow section 6 of the orchestration document: record a build revision in `docs/lld/11` section 18 before the dependent code.
  - Anything touching the HLD, the vision, R0, R1 or a user decision (section 17) goes to the user.

## When to stop and ask the user

- M6 is complete.
- A decision belongs to the user (orchestration section 6).
- Spend would pass a ceiling or the cap.
- The same acceptance failure survives three rounds of fixing.
- The guard hook needs a Claude Code restart or an approval to load.
- A step needs the user's own action: a login, a key, an account setting.
- **At M4, ask once (optional):** the MiniMax plan's usage figure before and after the billing probe (L17).

## Key facts and decisions

**Where everything is**

| Item | Value |
|---|---|
| Project folder | `C:\Users\XZNON\cutroom-v2`, the only working tree |
| GitHub | `KnowScroll/Cutroom-v2-shivalik`: private; organisation on GitHub Free, so no branch protection and a shared Actions minutes quota. Actions runs only `check` and `npm test` as a second record; nobody waits for it |
| Where things run | Claude Code, `npm run check` and `npm test` on Windows. Render, acceptance, claim, Linux-only and live tests, and every run of the product, in WSL Ubuntu 22.04 on a disposable mirror under `~/.cutroom-build/` (`npm run wsl:sync`), with the system's data under `~/cutroom-space`. Never put the database on `/mnt/c` |
| Machine | 16 threads, 12 GB for WSL, no GPU needed. Node, Chrome and FFmpeg are not yet installed in WSL; M0-01b installs them as `docs/impl/02-environment.md` says |

**Product decisions in force**

| Area | Decision |
|---|---|
| Language models | MiniMax-M3 for the Director, research, scripts and the Reviewer; MiniMax-M3.1-Flash for code-writing workers. Calls go through the Anthropic-compatible endpoint, at most 8 in flight. Free-form tool arguments travel as JSON text, because the endpoint damages them otherwise (J1) |
| Voice | `hexgrad/kokoro-82m` through OpenRouter: PCM, signed 16-bit little-endian, 24 kHz mono, provider pinned (U17, L12) |
| Word timing and transcripts | Word times from CTC forced alignment in Node (wav2vec2-base); transcripts from Whisper `small.en` in Node. Both models are exported once to ONNX by a pinned script (L10, L27, L38) |
| Music | Code-rendered; no AI music |
| Audio review | Nothing listens to the audio; this is listed as a limitation on every deliverable |
| Voice cloning | None |
| Visible AI notice | Off by default |
| Other | No C2PA signing; no ShareAlike media; no third-party screen capture; no production VM yet |

**Evidence**

The spike evidence behind the design is in `docs/research/10-spike-evidence-log.md` and `docs/research/evidence/`.

## Current state

- The design is frozen.
- The build plan has 81 work packages across M0–M6.
- No code exists.
- No Git repository exists yet.
- Nothing has been pushed.
- Spend so far in the build: $0.00. The design phase spent $2.53 on MiniMax and $0.0031 on OpenRouter speech.

**Next step:** step 1 above (check the start), then the bootstrap.

## Things that went wrong before (do not repeat)

- **Network drops** (`ENOTFOUND`) killed several subagents mid-task. Resume the same subagent with a message, telling it to check what it already changed; do not start it again from zero.
- **Codex's usage limit** ended a Codex run silently, with exit 0 and empty output. Use Opus subagents for reviews in its place, and verify partial work after any stop.
- **Rule breaches by agents:**
  - A subagent once ran `rm -f` on a shared scratch folder. Always name the exact folder a subagent may delete.
  - Another searched the archive by mistake. Exclude `docs/archive/` from every search.
- **Spike lesson:** the MiniMax endpoint turns untyped tool arguments into strings and wrapped arrays (batch 3). Never rely on free-form structured tool arguments with MiniMax.
