# Cutroom v2 — LLD · R0: Framing Decisions

**Accepted:** 14 November 2026
**Status:** **ACCEPTED.** Audio provider choice is deferred (section 6).
**Related:** [Process and roadmap](00-design-process-and-roadmap.md) · [Spike evidence](../research/10-spike-evidence-log.md) · [Provider, cost and audio research](../research/11-provider-cost-and-audio-research.md)

## 1. Where it runs

- **ACCEPTED:** one machine, local-first, with hosted model APIs. Development happens on the user's laptop; production runs on a Linux VM.
- Contracts do not assume a process layout (already required by the HLD). Distributed operation stays OPEN.
- **Development machine (measured):** AMD Ryzen 7 5800H (8 cores / 16 threads), 15.3 GB RAM, NVIDIA RTX 3050 Laptop GPU with 4 GB of video memory, Windows 11 Home with WSL2 Ubuntu 22.04.
- **Consequence:** 4 GB of video memory is too small for most local AI audio models. Hosted APIs, CPU-sized models or a rented GPU are the realistic options.

## 2. Development environment

- **ACCEPTED:** build and test the render path inside WSL2, using the Linux headless Chrome build (`chrome-headless-shell`) and BeginFrame capture. There is one render path, and it matches the Linux VM.
- WSL memory was raised to 12 GB on 14 Nov 2026 (`C:\Users\XZNON\.wslconfig`).
- **Why:** deterministic BeginFrame capture works on Linux, and a third-party source reports that it is not available on Windows or macOS (SECONDARY, section 8). On Linux it was 1.3–1.9× faster than the screenshot path, and it needs no GPU (spike S1c).
- The Windows-native screenshot path is not used, so there is only one path to keep consistent.

## 3. Language and runtime

- **ACCEPTED:** a TypeScript core on Node LTS. It owns the Director/harness, project store, compiler, scheduler, all Chrome and FFmpeg work, media acquisition, and quality checks on rendered frames.
- **ACCEPTED:** Python is one long-lived worker process for stateless analysis only (forced alignment, shot detection, embeddings). Its protocol is designed up front, but it is built only when first needed. It is called with file paths and content hashes, never raw bytes. The TypeScript scheduler stays the single owner of job state and retries.
- **ACCEPTED:** no Rust for now. It may be considered later for a measured hotspot (a browser-free SVG renderer, pixel-heavy frame checks, a sandboxed evaluator) or as a side project off the critical path.
- **Why TypeScript:** what is rendered is JavaScript/HTML running in Chrome, so the renderer, the validation of LLM-written code and the capture engine share one language. Schemas written in TypeScript export to JSON Schema, which can generate the Python types.
- **Why not Python-only:** Node and Chrome would still be needed for rendering, and there is no good in-process sandbox for LLM-written JavaScript.

## 4. LLM provider and model split

- **ACCEPTED:** MiniMax is the LLM provider. Its data-use terms are accepted.
- **ACCEPTED split:**
  - **MiniMax-M3:** Director, research, script, Reviewer.
  - **MiniMax-M3.1-Flash:** code-writing workers and per-component checks.
- Using M3 for every role stays open as a future option.
- **Design consequences (see [research 11](../research/11-provider-cost-and-audio-research.md)):**
  - MiniMax has no JSON-schema output mode and cannot force a specific tool call. Every model output is validated by our services and repaired on failure.
  - The models accept images and video but not audio. Audio review needs speech-to-text, rule-based checks, or a second provider.
  - MiniMax retires models quickly. Model versions are pinned, and the harness stays provider-neutral.

## 5. Budget and time targets

**ACCEPTED** as targets to measure against, not as measured results:

| Target | Value |
|---|---|
| Typical film, all-in | about $5 |
| Hard cap per film (the Director stops and reports) | $15 |
| One revision cycle | at most $0.75 |
| First useful preview | within 20 minutes |
| Accepted film | within 2.5 hours, typical |

The estimate behind these numbers is in [research 11](../research/11-provider-cost-and-audio-research.md). Token counts in that estimate are assumptions.

## 6. Audio policy

- **ACCEPTED:** AI-generated music, sound effects and dialogue are allowed. Only image-generation and video-generation models stay banned.
- **DEFERRED by the user:** which providers or engines to use for music and dialogue. Research on code-generated and open-source options is recorded in [research 11](../research/11-provider-cost-and-audio-research.md).

## 7. Spike policy

- **ACCEPTED:** throwaway measurement spikes are allowed during design, under the rules in the [process document](00-design-process-and-roadmap.md#13-spike-rules).
- A MiniMax API key for spikes is stored outside this project folder. Spike scripts read it from a file and never print it.

## 8. Claims this stage relies on

| Claim | Label | Evidence |
|---|---|---|
| BeginFrame capture works on Linux with `chrome-headless-shell` | VERIFIED by spike | S1c, S4, S7 |
| BeginFrame capture is not available on Windows or macOS | SECONDARY | HeyGen HyperFrames research article (see research 11). Not on a critical path: the design uses Linux only |
| BeginFrame on Linux is 1.3–1.9× faster than screenshots | VERIFIED by spike | S1c |
| A 2,700-frame film captures in about one minute with 4–6 browsers | VERIFIED by spike | S1, S1c (light-to-moderate scene) |
| MiniMax-M3 and M3.1-Flash accept image input and tool calls through the Anthropic-compatible endpoint | VERIFIED by spike (images) and by source (tools) | S2; MiniMax docs |
| MiniMax prices and limits | VERIFIED by source, 14 Nov 2026 | MiniMax docs; may change |
| Typical film costs about $4 on MiniMax | ASSUMED | Token model is an estimate. If wrong, the budget targets move; the design does not |
| 4 GB of video memory rules out most local audio models | SECONDARY | Model cards cited in research 11 |
