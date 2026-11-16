# Cutroom v2 — Implementation · Orchestration Rules

**Written:** 15 November 2026
**Status:** In force for the build. Decided by the user on 15 November 2026 ([integration decisions](../lld/11-integration-decisions.md), section 17, U12 to U24), with the follow-up decisions U25 to U35 made by the lead under U19 to U22 (section 17.3). Revised on 15 November 2026 for the Windows working tree and the GitHub flow.
**Read with:** [repository and conventions](01-repo-and-conventions.md) · [environment](02-environment.md) · [testing](03-testing.md) · [spend](04-spend.md) · [state](STATE.md) · the milestone documents under [`milestones/`](milestones/) · the study of the copied method, [`research/knowscroll-workflow.md`](research/knowscroll-workflow.md)

## 1. The arrangement

One main Claude Code session, **the orchestrator**, builds Cutroom v2. It runs on Windows with its working directory at `C:\Users\XZNON\cutroom-v2`, the project folder and the one working tree (U19, U25). It decides and coordinates. It does not write product code itself except for small fixes of a few lines. **Subagents** do the implementation, the tests and the reviews. Linux-only steps run through `wsl.exe` on the WSL build mirror ([environment](02-environment.md), section 2).

The work lives on GitHub at `KnowScroll/Cutroom-v2-shivalik` (U20) and follows the working method of `KnowScroll/knowscroll` (U21): one issue, one branch and one squash-merged pull request per work package, a pointer command for briefs, and issues and pull requests as the history (sections 4, 9 and 10).

The design is frozen. The build's job is to realise it, not to redesign it. Where the design turns out to be wrong or silent, section 6 says what to do.

## 2. What the orchestrator does

0. Before the first work package, carries out the bootstrap step (section 12).
1. Reads [`STATE.md`](STATE.md) to see where the build stands and the issues of the current milestone, which hold per-package status (L20), then checks `git status`, the open pull requests and the result of the last GitHub Actions run.
2. Takes the next work package from the current milestone document, in dependency order, with its GitHub issue.
3. Creates its branch from a freshly fetched `main` and briefs a subagent to implement it, starting from the pointer command's output (section 4).
4. When the subagent reports, **verifies the result itself**: runs the test commands, reads the summary of what changed, and checks the work package's "done when" list item by item. A subagent's report is a claim, not evidence.
5. For a work package marked **care: high**, has a second subagent review it (section 5).
6. Pushes the branch, opens the pull request, merges it by squash, which closes the issue, and moves on (section 9). `STATE.md` does not change in a work package's pull request, M0-01a's included: it is written in the bootstrap commit (L42), and after that it changes only at the end of a milestone and at a stop, in a small pull request of its own; per-package status lives in the issues (L20).
7. At the end of a milestone, runs the milestone's acceptance list, writes the milestone report, refreshes the "current state" part of [`handoff.md`](../../handoff.md), updates `STATE.md` in its own small pull request (L20), tags the milestone and closes its GitHub milestone (section 11).

The orchestrator keeps its own context small. It delegates reading as well as writing: it does not load whole stage designs, and it never reads a subagent's transcript. The issues, the pull requests, the small `STATE.md` and the milestone reports are the memory of the build, not the conversation.

## 3. Subagents

| Role | When | Model |
|---|---|---|
| **Implementer** | Every work package, including those marked care: high | **Sonnet 5.5** (`model: sonnet`) |
| **Test author** | The acceptance cases A1 to A14 and the claim tests of R10 section 2.2. Never the same subagent that implemented the code under test | **Sonnet 5.5** (`model: sonnet`) |
| **Reviewer** | Every work package marked care: high; every milestone's last step | **Opus 5.5** (`model: opus`), with fresh context |
| **Planner** | Splitting or re-planning a work package, a build revision (section 6), a milestone report's analysis | **Opus 5.5** (`model: opus`) |
| **Investigator** | A failing test whose cause is unclear, or a question about the design | **Opus 5.5** (`model: opus`), read-only |

Rules for using them:

- **Thinking and deciding on Opus 5.5; implementing on Sonnet 5.5** (U36, the user's decision of 15 November 2026). The orchestrator itself runs on Opus 5.5. Reviewers, planners and investigators run on Opus 5.5 (`model: opus`). Implementers and test authors run on Sonnet 5.5 (`model: sonnet`). **Never Fable**, for anything. Set the model on every subagent call; never let a subagent inherit the session's model.
- **When a Sonnet implementer is stuck.** If the same work package fails its tests after two rounds, the orchestrator sends an Opus investigator to find the cause and write precise instructions, and a Sonnet implementer applies them. The orchestrator does not hand implementation to Opus.
- **Codex** may stand in for an Opus reviewer when it is installed and has quota (`gpt-6.1-sol`, medium effort); it never replaces the Sonnet implementers. The orchestrator keeps its own work small and delegates reading, writing and checking.
- **Parallel work.** Work packages that the milestone document marks as parallel, and that touch different packages, may run at the same time. Each parallel implementer works in its own Git worktree under `.worktrees/` in the project folder, on its own branch, and syncs to that worktree's own WSL mirror; render tests from different worktrees never run at the same time (L19; [environment](02-environment.md), sections 2 and 10). Work packages that touch the same package run one after another. Branches are never stacked: each starts from `main` after the packages it depends on have merged.
- **At most four subagents at once.** The machine has 16 threads and 15.3 GB of memory, of which WSL may use up to 12 GB, and render tests are heavy.
- **One work package per implementer.** A subagent that finishes does not continue into the next package.
- **No subagent starts another subagent,** except a reviewer asking for one investigator.
- **Subagents never edit `STATE.md` or `handoff.md`,** and never push. They commit on their branch and report in the form of the pull request body (section 4, item 5). The orchestrator pushes, opens and merges.

## 4. How to brief an implementer

A subagent knows only what the brief says. Every brief starts from the output of the pointer command, `npm run wp-context -- <work package ID>` (U31; [conventions](01-repo-and-conventions.md), section 4). It prints the work package whole, the exact design sections its "Read first" line cites (extracted from `docs/lld/` by section number), the README of each package it touches, and the decisions of `lld/11` it names: a few kilobytes instead of whole documents. The orchestrator pastes that output into the brief rather than copying by hand. Until M0-01b has built the command, the orchestrator assembles the same parts by hand for the bootstrap, M0-01a and M0-01b.

Every brief contains:

1. **The pointer command's output** for the work package, and its issue number and branch name.
2. **What to read first:** [`CLAUDE.md`](../../CLAUDE.md), [conventions](01-repo-and-conventions.md), [testing](03-testing.md). The design sections are already in the output; read further only where a boundary, a revision or a runtime result is unclear. Not whole documents.
3. **What already exists:** the packages and interfaces earlier work packages produced, by path, and the pull requests that made them.
4. **The standing rules** (section 8), repeated in the brief, and where each command runs ([conventions](01-repo-and-conventions.md), section 4).
5. **What to return,** written as the body of the pull request, in the template's sections: what was built (the files created or changed); the commands run and their full results; each claim labelled VERIFIED by test, VERIFIED by measurement, or ASSUMED; "Not proved", saying exactly what this work does not prove; design doubts, every place where the design was unclear or wrong; and anything left undone. A subagent that could not finish says so plainly.

Do not pass a subagent your own guess about a cause or a fix as if it were a fact. Give it the evidence and the question.

## 5. Review

A reviewer gets the code and the design sections, not the implementer's report. It checks:

- the code does what the design sections say, including every diagnostic code, setting name and default they give;
- every "done when" item is met, by running the tests itself;
- no test was weakened, skipped or made to pass by special-casing;
- nothing outside the work package's scope was changed.

Findings come back as a list. The orchestrator decides each one: fix, defer to an issue of its own (linked from the pull request), or reject with a reason written in the pull request. A fix goes to an implementer, then the reviewer's test run is repeated. When the review is closed, the pull request body says so in one line, with the reviewer's model.

**Care: high** work packages are the ones R10 section 4.1 names: the shim and sealer, the capture engine, patch validation with write authority and merge, the timing solver, the paid-call protocol, and the Director loop. The milestone documents mark them.

## 6. When the design is wrong, silent or in doubt

Decide by what kind of question it is.

| Kind | Who decides | What to do |
|---|---|---|
| **An implementation detail** the design leaves open (a file name, a private helper, an internal data structure) | The implementer | Nothing to record |
| **A design gap or error** inside one stage (a missing field, a rule that cannot work as written, a threshold) | The orchestrator | Decide, then **record it before the dependent code is written**: add a row to section 18 of the [integration decisions](../lld/11-integration-decisions.md) ("Build revisions": number `B1`, `B2`, …; what was found; the decision; the documents changed) and correct the stage design in the same pull request |
| **A change that crosses stages** (an interface between two modules, a shared name, an owner) | The orchestrator, after an investigator has read both stage designs | As above, and check every document that names the thing |
| **A change to the accepted HLD** (`hld/`), to the vision, or to a decision the user made (section 17 of the integration decisions, R0, R1) | **The user** | Stop and ask. Do not work around it |
| **A claim from R10 section 2.2 that fails its test** | The orchestrator | Apply the fallback R10 names for that claim, record it as a build revision, and continue. If the fallback also fails, stop and ask |

Never resolve a doubt by guessing. Check the design, check the evidence under `research/`, run a small test, or ask.

## 7. When to stop and wait for the user

- **The thin film is delivered:** milestone M6 is complete. Write the report and stop. M7 to M11 start only on the user's word.
- A decision in the table above belongs to the user.
- **Live-call spend** would pass the cap in [spend](04-spend.md).
- A milestone's acceptance list still fails after **three** rounds of fixing the same failure. Report what was tried and what the evidence shows.
- Something would be destroyed or sent outside the machine that these documents do not cover. These documents cover, on `KnowScroll/Cutroom-v2-shivalik` only: the bootstrap's first push of `main` (section 12), pushes of `wp/` branches and milestone tags, issues, labels, milestones, pull requests, squash merges and comments, and the one workflow (section 9). They do not cover any other push to `main`, a force push, a change to the repository's or the organisation's settings, an Actions secret or variable, or any other repository. Stop before any of those.
- A key would be needed from anywhere but the project's `.env`, or that file lacks a key that a live work package needs.
- Anything would require reading, using or touching a file under `C:\Users\XZNON\Cutroom`, an older folder that is not part of this project.
- The guard hook is not live in the session (section 9) and only a restart or the user's approval can make it so: the session stops and asks (L21).
- A step needs the user's own action: a login, a password, a new API key, an account setting.

Do not stop to ask for confirmation of something these documents already decide.

## 8. Standing rules

These go into every brief.

1. **No design by inference from old material.** The design is `lld/`, with `lld/11-integration-decisions.md` winning any conflict and its later sections overriding earlier ones. `hld/` and `VISION.md` are the accepted baseline. The file `docs/archive/cutroom-v3.1-full-system-architecture.md` sits in the project folder but is ignored by Git; it is never opened, read, searched, used, added to Git or published, and the guard hook refuses any attempt. Nothing under `C:\Users\XZNON\Cutroom` (an older folder, not this project) is read, used, cited or touched (U23), and the guard hook refuses any command that names a path under it (L21).
2. **No image-generation or video-generation models,** anywhere, for any purpose.
3. **The API keys** (`MINIMAX_API_KEY`, `OPENROUTER_API_KEY`) are read at run time, only by the model and speech transports, from the project's `.env` at `C:\Users\XZNON\cutroom-v2\.env` (U23); in WSL, through the path that the environment variable `CUTROOM_ENV_FILE` holds (L19; [environment](02-environment.md), section 8). They are never printed, logged, echoed, copied (into the WSL mirror, into Git, into a test fixture or a recording, into an issue, a pull request, a workflow or an Actions secret), or sent anywhere but the provider's own endpoint.
4. **Nothing about the user** (name, email address, machine paths) goes into a request to a model, speech or web service (L22). GitHub is the project's chosen home, and the documents pushed there are the project's own (U20; L22); issues and pull requests carry no email address and no path outside the project folder.
5. **Tests are evidence.** A test is never deleted, skipped, loosened or special-cased to make a milestone pass. A test that cannot pass yet goes into the known-failures registry ([testing](03-testing.md), section 8). If a test is wrong, say why, fix the test in its own commit, and record it in the pull request.
6. **Report honestly.** "Done" means the tests ran and passed, and says which and where. Each claim is labelled VERIFIED by test, VERIFIED by measurement, or ASSUMED; anything unverified is named as unverified.
7. **Live model and speech calls** happen only in the work packages that say so, only from WSL, and every one is written to the spend ledger.
8. **Names come from the design:** entity kinds, fields, diagnostic codes, settings and tool names are spelled as `lld/` spells them.
9. **Stay inside the project folder,** the WSL build mirrors and the WSL tool folder under `~/.cutroom-build/` (L19), and the Space ([environment](02-environment.md), section 2). Edit files only in the project folder or its worktrees, never in a mirror. Do not change system settings, global packages, the machine's active Node version or anything else on either disk. From WSL, only read the Windows drive: the working tree through `wsl:sync`, and the key file. The one exception is M0-01b's timing measurement, in a throwaway worktree inside the project folder ([testing](03-testing.md), section 1).
10. **No pushes to `main`, no force pushes.** Work reaches `main` only through a squash-merged pull request (section 9). The only direct push to `main` is the bootstrap's first one (section 12), the one push made before the guard hook exists (L21). Never bypass, disable or edit around the guard hook.

## 9. Git and GitHub

The working method is copied from `KnowScroll/knowscroll` (U21; [study](research/knowscroll-workflow.md), section 3), without the parts the study lists under "What not to copy" (U35).

**The repository.** The project folder is the Git working tree (U19). Its remote is `KnowScroll/Cutroom-v2-shivalik`, private, default branch `main` (U20). The organisation also has a public repository named `Cutroom`; always name this one in full (`gh … -R KnowScroll/Cutroom-v2-shivalik`). The organisation is on GitHub Free: the repository has **no branch protection and no required checks**, any of its three admins can push to `main`, and Actions minutes are a monthly quota shared with the organisation's other private repositories ([target repository](research/target-repo-state.md), sections 1 and 8). `main` therefore stays green by this procedure and by the guard hook, not by GitHub.

**One issue per work package** (U28). The bootstrap (section 12) creates one issue for every work package of M0 to M6 from the milestone documents: title `<ID> — <title>`, for example `M2-03 — Patch envelope, handles and operations`; body the work package text as the milestone document gives it, with a link to the document at the bootstrap commit and a line "Depends on: #n, #m" giving its dependencies by issue number; labels for its milestone (`m0` … `m6`), its package (`pkg:<name>` as in [conventions](01-repo-and-conventions.md) section 2, `pkg:repo` for work outside `packages/`), `care:high` where marked, and `live-calls` where its header lists live calls; and its GitHub milestone (`M0` … `M6`). **The milestone documents stay the source.** Work package text is never edited in GitHub: when a build revision changes a work package, the document changes in a pull request and the orchestrator then replaces the issue body with the new text. The issue is the place for discussion, status and history: the orchestrator comments when a package starts, is blocked, or hands off.

**One branch and one pull request per work package** (U29).
- Branch `wp/<id>-<short-name>`, lower case, for example `wp/m2-03-patch-envelope`, created from a freshly fetched `main` after every package it depends on has merged. Never stack branches: on a squash-only flow a stacked branch conflicts after each squash. Parallel work packages use worktrees under `.worktrees/`, which Git ignores; a worktree is removed once its pull request merges.
- Subagents commit on the branch. Commit messages: a one-line summary starting with the work package ID, then what and why, ending with the attribution line the session's own instructions give.
- The orchestrator pushes the branch and opens the pull request with `gh pr create --base main`, following `.github/pull_request_template.md`: what was built; the commands run, where they ran, and their results; evidence labels (VERIFIED by test, VERIFIED by measurement, ASSUMED); "Not proved"; design doubts; and "Closes #<issue>". The title is the issue's title.
- **The orchestrator merges** with `gh pr merge --squash --delete-branch` when the local tests are green (the commands of [conventions](01-repo-and-conventions.md) section 4 that apply, run where that table says) and, for `care: high`, the review is closed. The squash commit takes the pull request's title and body, so `main` has one commit per work package.
- **Nobody waits for GitHub Actions** (U27). When the orchestrator starts the next package, it reads the result of the previous pull request's run. A red run on merged work is fixed next, before new work, as a small fix of its own with its own issue and pull request.
- Design documents and code change in the same pull request when a build revision requires both.

**No direct pushes to `main`, no force pushes** (standing rule 10). The bootstrap's first push of the documents, made before the guard hook exists, is the only exception (L21). Milestone tags are pushed: `m0-done`, `m1-done`, and so on (section 11).

**The guard hook** (U30). Because GitHub cannot protect `main` here, a Claude Code `PreToolUse` hook in `.claude/` is the guard. It refuses force pushes (`--force`, `-f`, `--force-with-lease`, a `+` refspec), any push that would update or delete `main` (including `--all`, `--mirror` and `HEAD:main`), any command that would add `.env` or `docs/archive/cutroom-v3.1-full-system-architecture.md` to Git, any read of that archive by any tool, any command or tool call that would print or copy `.env`, `git clean` with `-x` or `-X` (which would delete `.env`), and any command that names a path under `C:\Users\XZNON\Cutroom` (L21). A refused call costs one reworded command; the hook is never bypassed. The hook has its own tests and is built by M0-01a before the first branch is pushed. Before that push the orchestrator proves the hook is live by issuing a harmless command it must refuse, such as a `--dry-run` push to `main`. ASSUMED: Claude Code may load hooks only at session start or after the user approves them. If Claude Code needs a restart or an approval to load the hook, the session stops and asks the user (L21; section 7).

By starting the session from `handoff.md`, the user authorises, on `KnowScroll/Cutroom-v2-shivalik` only: the bootstrap of section 12, commits, branches and worktrees, pushes of `wp/` branches and milestone tags, labels, milestones, issues and comments, pull requests and their squash merges, closing GitHub milestones, and the one workflow of [testing](03-testing.md) section 1.

## 10. Records the orchestrator keeps

Per-package status and history live on GitHub, not in a file (U33). Everything else is a file in the repository, changed through pull requests like the code.

| Record | What | When |
|---|---|---|
| **The work package's issue** | The work package text (a copy of the milestone document's), its dependencies by issue number, labels, milestone; the orchestrator's comments on start, blocking, deferred findings and hand-off; closed by its pull request | Created at the bootstrap; commented as work proceeds |
| **The work package's pull request** | What was built; the commands run, where, and their results; evidence labels; "Not proved"; design doubts; the review line for care: high; links to the Actions run | One per work package |
| **Other issues** | Each deferred review finding, known failure (testing §8), flaky test, red Actions run on merged work, and open question that outlives a package | When it arises |
| [`docs/impl/STATE.md`](STATE.md) | **Small:** the current milestone, open questions for the user, and links to the current milestone's issues and the last report. No per-package rows: the work package in progress, its branch, worktree and status are in its issue (L20) | First in the bootstrap commit, with its links to the issues (L42); then only at the end of a milestone and at a stop, in a small pull request of its own (L20) |
| `docs/impl/reports/M<n>.md` | What was built, with links to the milestone's pull requests; the acceptance results with the commands run and where; the claims of R10 section 2.2 tested and their outcomes; build revisions made; spend; the open known failures; what is not verified. M0's report also holds the three-layout timings of M0-01b | End of each milestone |
| [`docs/impl/04-spend.md`](04-spend.md), ledger section | Every live call batch: date, work package, model, requests, tokens by kind, dollars at list prices | In the pull request of every work package that makes live calls |
| `docs/lld/11-integration-decisions.md`, section 18 | Build revisions | In the pull request that needs them, before the dependent code |
| [`handoff.md`](../../handoff.md), "Current state" | Where the build stands and what the next session should do first | End of each milestone, and before the session ends for any reason |

Only the orchestrator edits `STATE.md` and `handoff.md`. Per-package status lives in the issues (L20): before the session's context is summarised, the issue of every work package in progress carries a comment naming its branch, its worktree and the next step. A handoff is a stop, so before one `STATE.md` also names the milestone, the open branches and worktrees and the next step, in a small pull request of its own (L20). After a summary, or when a new session takes over, re-read `STATE.md` and the open issues of the current milestone, then check `git status`, the open pull requests and the last Actions run before acting. These records are enough to continue. Write them as if for a reader who has not seen the conversation.

## 11. The order of a milestone

1. Read the milestone document. Confirm that the work packages it depends on have their issues closed by merged pull requests, and that the milestone's issues still match the document (replace any body a build revision changed).
2. Build the work packages in the order the document gives, in parallel where it allows: each through its issue, branch and pull request (section 9).
3. Run the whole test suite on `main`, not only the new tests: `npm run check` and `npm test` on Windows; then `npm run wsl:sync` and `test:linux` (L18), `test:render`, `test:accept` and `test:claims` in WSL on the mirror. The known-failures registry says which failures are expected ([testing](03-testing.md), section 8).
4. Run the milestone's acceptance list. Each item is a command and an expected result.
5. Have a reviewer read the milestone as a whole against R10's "done when" text for that milestone.
6. Write the milestone report and refresh `handoff.md` in one pull request (or in the milestone's last work package, where its document says so), and merge it. Update `STATE.md` for the next milestone in a small pull request of its own (L20). Tag the merge commit `m<n>-done` and push the tag, which also starts the workflow once. Close the GitHub milestone.
7. Go to the next milestone, or stop if section 7 says so.

## 12. The bootstrap step

The build session's first act, before any work package, is the bootstrap (U34). The orchestrator does it itself, in the project folder, with no subagent and no pull request, because there is no `main` yet. The user starts the session knowingly, so no further confirmation is needed for these steps.

1. **Check the start.** The working directory is `C:\Users\XZNON\cutroom-v2` and is not yet a Git repository. `gh` is logged in to an account that is admin on `KnowScroll/Cutroom-v2-shivalik`, and the repository is still empty (`git ls-remote` lists no refs). If it is not empty, stop and ask.
2. **Initialise Git** with `main` as the first branch.
3. **Confirm `.gitignore` and `.gitattributes`.** `.gitignore` already lists `.env`, `.env.*` and `docs/archive/cutroom-v3.1-full-system-architecture.md`. Add `.gitattributes` with `* text=auto eol=lf` and `*.png binary`, because Git for Windows on this machine sets `core.autocrlf=true` in its system configuration and would otherwise convert line endings ([environment](02-environment.md), section 11).
4. **Create on GitHub** the labels of section 9; the GitHub milestones `M0` to `M6`, titled as R10 section 4.2 names them; and one issue per work package of M0 to M6, in document order, so that each "Depends on" line can give the issue numbers of packages already created. This needs no commit on the repository. (That GitHub accepts issues on a repository with no commit yet is ASSUMED; if it does not, stop and ask.)
5. **Write `docs/impl/STATE.md`,** small (section 10), with its links to those issues (L42).
6. **Stage the design and planning documents** (the root documents, the documents directly under `docs/`, `docs/hld/`, `docs/lld/`, `docs/research/`, `docs/history/`, `docs/impl/` with `docs/impl/research/`, `.gitignore`, `.gitattributes`) and `docs/impl/STATE.md`. Then **show that the archive and `.env` are untracked:** `git ls-files` lists neither, and `git status --ignored` and `git check-ignore -v` show both as ignored by `.gitignore`. Stop if either is staged.
7. **Commit** the documents and `STATE.md` as the first commit (the bootstrap commit), and confirm `git ls-files --eol` shows LF for every text file.
8. **Add the remote** `KnowScroll/Cutroom-v2-shivalik` and **push `main`.** This is the only direct push to `main` the build makes (standing rule 10), and the one push made before the guard hook exists (L21). `STATE.md` arrives on `main` in this push; no work package's pull request edits it, and from now on it changes only at the end of a milestone and at a stop, in a small pull request of its own (L20, L42).

Then M0-01a builds the guard hook, which must be live before the first branch is pushed (section 9).
