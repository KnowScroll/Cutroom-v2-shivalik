# Cutroom v2 — Build State

**Updated:** 16 November 2026, at the bootstrap
**Changes:** only at the bootstrap, at the end of a milestone, and at a stop, each time in its own commit or pull request ([orchestration](00-orchestration.md), section 10; L20, L42). Per-work-package status lives in the GitHub issues and pull requests.

## Where the build stands

| Item | State |
|---|---|
| Design | Frozen. `docs/lld/11-integration-decisions.md` sections 10 to 18.6 hold every decision |
| Build plan | Complete: 7 milestone documents, 81 work packages (`docs/impl/milestones/`), one GitHub issue each (#1 to #81) |
| Git repository | Created at the bootstrap; `main` pushed once, directly, by the bootstrap commit (the only direct push, L21) |
| GitHub `KnowScroll/Cutroom-v2-shivalik` | Private. Labels, milestones `M0` to `M6` and the 81 work-package issues created at the bootstrap |
| Current milestone | **M0 Foundations.** Next: M0-01a, the guard hook ([#1](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/1)) |
| Live-call spend through M6 | $0.00 of the $10.00 cap ([ledger](04-spend.md)) |

## Milestones

| Milestone | Document | GitHub milestone | Status |
|---|---|---|---|
| M0 Foundations | [M0](milestones/M0-foundations.md) | [M0](https://github.com/KnowScroll/Cutroom-v2-shivalik/milestone/1) | In progress |
| M1 Render core | [M1](milestones/M1-render-core.md) | [M1](https://github.com/KnowScroll/Cutroom-v2-shivalik/milestone/2) | Not started |
| M2 Project and compiler | [M2](milestones/M2-project-and-compiler.md) | [M2](https://github.com/KnowScroll/Cutroom-v2-shivalik/milestone/3) | Not started |
| M3 Scheduler | [M3](milestones/M3-scheduler.md) | [M3](https://github.com/KnowScroll/Cutroom-v2-shivalik/milestone/4) | Not started |
| M4 Harness and first light | [M4](milestones/M4-harness-and-first-light.md) | [M4](https://github.com/KnowScroll/Cutroom-v2-shivalik/milestone/5) | Not started |
| M5 Sound | [M5](milestones/M5-sound.md) | [M5](https://github.com/KnowScroll/Cutroom-v2-shivalik/milestone/6) | Not started |
| M6 Quality and delivery | [M6](milestones/M6-quality-and-delivery.md) | [M6](https://github.com/KnowScroll/Cutroom-v2-shivalik/milestone/7) | Not started; the build stops when M6 is done |

## Work-package issues

| Milestone | Issues |
|---|---|
| M0 | [M0-01a](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/1) · [M0-01b](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/2) · [M0-02](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/3) · [M0-03](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/4) · [M0-04](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/5) · [M0-05](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/6) · [M0-06](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/7) · [M0-07](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/8) · [M0-08](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/9) · [M0-09](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/10) · [M0-10](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/11) |
| M1 | [M1-01](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/12) · [M1-02](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/13) · [M1-03](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/14) · [M1-04](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/15) · [M1-05](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/16) · [M1-06](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/17) · [M1-07](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/18) · [M1-08](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/19) · [M1-09](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/20) · [M1-10](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/21) |
| M2 | [M2-01](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/22) · [M2-02](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/23) · [M2-03](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/24) · [M2-04](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/25) · [M2-05](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/26) · [M2-06](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/27) · [M2-07](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/28) · [M2-08](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/29) · [M2-09](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/30) · [M2-10](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/31) · [M2-11](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/32) · [M2-12](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/33) |
| M3 | [M3-01](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/34) · [M3-02](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/35) · [M3-03](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/36) · [M3-04](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/37) · [M3-05](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/38) · [M3-06](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/39) · [M3-07](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/40) · [M3-08](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/41) · [M3-09](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/42) · [M3-10](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/43) |
| M4 | [M4-01](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/44) · [M4-02](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/45) · [M4-03](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/46) · [M4-04](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/47) · [M4-05](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/48) · [M4-06](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/49) · [M4-07](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/50) · [M4-08a](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/51) · [M4-08b](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/52) · [M4-09](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/53) · [M4-10](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/54) · [M4-11](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/55) · [M4-12](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/56) · [M4-13](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/57) |
| M5 | [M5-01](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/58) · [M5-02](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/59) · [M5-03](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/60) · [M5-04](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/61) · [M5-05](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/62) · [M5-06](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/63) · [M5-07](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/64) · [M5-08](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/65) · [M5-09](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/66) · [M5-10](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/67) |
| M6 | [M6-01](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/68) · [M6-02](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/69) · [M6-03](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/70) · [M6-04a](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/71) · [M6-04b](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/72) · [M6-05](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/73) · [M6-06](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/74) · [M6-07](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/75) · [M6-08](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/76) · [M6-09](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/77) · [M6-10](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/78) · [M6-11](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/79) · [M6-12](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/80) · [M6-13](https://github.com/KnowScroll/Cutroom-v2-shivalik/issues/81) |

## Open questions for the user

None. Two things will be asked during the build:

- **At M4 (optional):** the MiniMax plan's usage figure before and after the billing probe (L17). Without it, the billing half of `R5-2` is recorded `UNKNOWN`.
- **At M5, only if it happens:** a speech model whose licence differs from what L51 states.

## Deferred findings

None yet.

## Last milestone report

None yet.
