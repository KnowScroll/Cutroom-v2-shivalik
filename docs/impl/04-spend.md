# Cutroom v2 — Implementation · Live-Call Spend

**Written:** 15 November 2026
**Status:** In force for the build. The cap is the user's decision of 15 November 2026 ([integration decisions](../lld/11-integration-decisions.md), U15).

## 1. The rule

- **Cap: 10 US dollars at list prices for milestones M0 to M6**, across model and speech calls.
- Spend is **counted, never estimated**, and written to the ledger in section 5. **Model calls:** from the `usage` fields of the response. **Speech calls:** the speech reply carries no usage, so each generation's cost is read from OpenRouter's generation look-up, `GET https://openrouter.ai/api/v1/generation?id=<X-Generation-Id>`, field `total_cost`, which satisfies U15 for speech (L12). Spike V1 found `total_cost` equal to characters times the serving provider's list price on all 18 generations; the key-level usage counter lags and is not used.
- **The speech provider is pinned** (`provider: {only: [voice.provider_only], allow_fallbacks: false}`, with `voice.provider_only` = `deepinfra`, a `human` setting, L12), because in spike V1 one unpinned request of 15 was routed to a provider 6.45 times dearer, with different audio.
- Live calls are made only from WSL, on the build mirror, by `npm run test:live` or a run of the product, with the keys read at run time from the project's `.env` (`C:\Users\XZNON\cutroom-v2\.env`, U23; [environment](02-environment.md), section 8), whose path WSL receives in `CUTROOM_ENV_FILE` (L19). They are never made from Windows-side commands or from GitHub Actions, which has no key.
- Live calls happen only in the work packages that say so, each with its own ceiling. A milestone's ceiling is the sum of its work packages' ceilings, as its document states: **M4 $3.30, M5 $0.29, M6 $3.92**, $7.51 in all, which leaves $2.49 of the cap unallocated.
- Before a work package would take the running total past its ceiling or past the cap, the orchestrator **stops and asks the user**.
- **A test may lower `budget.hard_cap_usd`** (L8). Tests may set any `human` setting inside their own temporary Space, acting with the `human` level there; a golden run may so set `budget.hard_cap_usd` to its work package's remaining ceiling, so that the Scheduler enforces the ceiling too ([testing](03-testing.md), section 7). The real Space is never touched by a test.
- Tests that do not need a live model use recorded replies ([testing](03-testing.md)).

## 2. List prices used (MiniMax documentation, 14 November 2026; OpenRouter document, 15 November 2026)

| Item | Price |
|---|---|
| MiniMax-M3 input / output / cached input | $0.30 / $1.20 / $0.06 per million tokens (input price doubles above 512,000 input tokens) |
| MiniMax-M3.1-Flash input / output / cached input | $0.15 / $0.60 / $0.015 per million tokens |
| `hexgrad/kokoro-82m` through OpenRouter (the voice engine, U17) | $0.62 per million characters through DeepInfra, the pinned provider (L12); $4 per million through Together, not used. Pay as you go |
| speech-2.8-hd (no longer used, U17) | $100 per million characters |
| speech-2.8-turbo (no longer used, U17) | $60 per million characters |
| Speech-to-text | None: Whisper `small.en` runs locally (L10). MiniMax `asr-1.0`, $0.38 per hour of audio, is no longer used |

Prices are VERIFIED by source and may change. The MiniMax prices come from MiniMax's documentation; the OpenRouter price comes from OpenRouter's document, supplied by the user on 15 November 2026 (U17). Spike V1 showed that the provider can be pinned (3 of 3 pinned requests went to DeepInfra) and that the generation look-up bills exactly the pinned price, so the DeepInfra price applies (L12). Work package M4's billing probe re-reads the MiniMax prices.

## 3. What has actually been spent so far (measured)

Everything below was counted during the design phase: model calls from response `usage` fields, spike V1's speech calls from OpenRouter's generation look-up. The sources are the spend lines in the evidence files.

| Work | Requests | Spend at list prices | Source |
|---|---|---|---|
| Spike S2: component authoring and contact-sheet review | 35 | $0.20 | `research/10-spike-evidence-log.md`, S2 |
| Spikes S3, S5, S6: repair loop, tool calling, caching, control tracks | 627 | $0.65 | `research/evidence/s3-s5-s6-minimax.md`, "Spend" |
| Batch 2c: Reviewer behaviour | 402 | $0.58 | `research/evidence/b2c-minimax-review.md` |
| Batch 3: patch authoring and segment restart | 2,888 | $1.09 | `research/evidence/b3-patches-and-restart.md`, "Spend" |
| Spike T1: one speech call, 101 characters | 1 | $0.01 | `research/10-spike-evidence-log.md`, T1 |
| Spike V1: OpenRouter Kokoro-82M and word timing (19 speech requests, 18 billed; the look-ups were free) | 19 | $0.0031 | `research/evidence/v1-openrouter-kokoro-and-alignment.md`, section 5 |
| **Total for the whole design phase** | **3,972** | **$2.53** (the rows above sum to $2.5331) | |

Two things this total does not prove:

- **It is at list prices.** The MiniMax key is on a subscription plan ("Token Plan"), so what the account was really charged may differ. Only the account's own billing page shows that, and no session can read it. At M4 the session asks the user once for the plan's usage figure before and after the billing probe (`R5-2`); if the user does not supply it, the billing half of `R5-2` is recorded `UNKNOWN` and the build continues (L17). OpenRouter is pay as you go, and V1's key-level usage rose by exactly the look-up sum once it had caught up.
- **It covers spikes, not films.** No complete film has been made yet.

## 4. What the build is expected to spend

**Measured unit costs** (from the same evidence):

| Unit | Cost | Evidence |
|---|---|---|
| One authored visual component, one attempt | $0.0033 (Flash) to $0.0056 (M3) | S2 |
| One component including its repairs | about $0.0046 on average ($0.366 over 80 components, 107 calls) | S3 |
| One contact-sheet review by MiniMax-M3 with thinking | about $0.014 | S2 |
| One project edit by patch, about 4 turns | $0.0006 (Flash) to $0.0015 (M3) | Batch 3 |
| Ten Director turns at about 15,000 tokens of context | $0.007 to $0.012 | Batch 3 |
| One second of narration at speech-2.8-hd (no longer used, U17) | about $0.0014 (101 characters gave 7.2 s of audio) | T1 |
| One second of narration at Kokoro-82M through OpenRouter, pinned to DeepInfra | about $0.00001 ($0.00056668 for 914 characters and 52.0 s; $0.00094116 for 1,518 characters and 90.2 s) | Spike V1, section 2.1: **measured** through the generation look-up |
| Average over all 3,972 design-phase requests | $0.00064 per request | Section 3 |

**Derived from those, for one thin-film run** (a 60-second data reel: about 20 components, about 40 reviews, about 60 project edits, about 150 Director turns, about 60 seconds of narration with two takes, three text treatments and two animatics):

| Part | Estimate | Basis |
|---|---|---|
| Components | $0.07 to $0.15 | Measured unit cost; the count is an assumption |
| Reviews | $0.55 | Measured unit cost; the count is an assumption |
| Project edits | $0.04 to $0.09 | Measured unit cost; the count is an assumption |
| Director turns | $0.15 to $0.60 | Measured only at small context; real context will be several times larger. ASSUMED |
| Narration | under $0.01: about 1,700 characters, about $0.001 at the pinned DeepInfra price (it was $0.17 at speech-2.8-hd, no longer used); transcription is local and costs nothing (L10) | Unit price measured by spike V1; the character count is an assumption. Speech is now a negligible share of a film's cost |
| Treatment search | up to $1.00 | The design's budget share; not measured |
| **One run** | **about $0.80 to $2.40** | |

The earlier paper estimate was about $4 for a typical 90-second film ([research 11](../research/11-provider-cost-and-audio-research.md), section 3), with its token counts marked as assumptions. The measured unit costs point lower, but **no figure for a whole film is verified until M4 produces the first one.**

**What $10 buys through M6,** on these figures: the M4 probes (a few hundred requests, well under $1), the calibration measurements at M5 and M6 (about $1.50), and roughly three to five complete film runs. If the first full run costs more than $2.60, the orchestrator reports it at once and the user decides whether to raise the cap.

## 5. Ledger

One row per batch of live calls. The orchestrator appends; it never edits an earlier row. A speech row's dollars are the sum of `total_cost` from the generation look-ups of its calls (L12).

| Date | Work package | Purpose | Model or service | Requests | Input tokens (uncached / cached) | Output tokens | Characters or audio | Dollars at list prices | Running total |
|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | $0.00 |

At each milestone the report states the running total, the measured cost of each complete film run, and how the measured figures compare with section 4.
