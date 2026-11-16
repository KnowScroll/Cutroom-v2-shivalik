# Cutroom v2 — Implementation · Dependencies

**Written:** 16 November 2026 (M0-01b)
**Rule:** [conventions](01-repo-and-conventions.md) section 3. Every dependency is pinned exactly (no `^`, no `~`) at the version `npm view` reported on the day it was added, except where the design names a version. Adding one later needs the orchestrator's agreement and a row here. `npm run check` fails if this table and `package-lock.json` disagree, or if a `package.json` declares a dependency this table lacks.

The two environments' non-npm pins (Node 26, `chrome-headless-shell`, FFmpeg, fonts, the shared libraries) are in `tools/pins.json`, filled by measurement ([environment](02-environment.md) section 9).

| Name | Version | Purpose | Date |
|---|---|---|---|
| `typescript` | 7.0.2 | Type check and build (`tsc --build`) | 2026-11-16 |
| `@types/node` | 26.6.6 | Node 26 type declarations | 2026-11-16 |
| `@biomejs/biome` | 2.6.8 | Lint and format | 2026-11-16 |
| `fast-check` | 4.10.2 | Property tests (timing solver, canonical JSON, merge) | 2026-11-16 |
| `zod` | 4.6.7 | Entity schemas and `meta` parsing (`lld/04`, `lld/03`) | 2026-11-16 |
| `canonicalize` | 5.1.0 | RFC 8785 canonical JSON (`lld/04` §2.5; named by the design, verified by the spikes; `npm view` shows no newer version) | 2026-11-16 |
| `uuid` | 14.0.3 | UUIDv7 entity IDs (`lld/04` §2.5; named by the design, verified by the spikes; `npm view` shows no newer version) | 2026-11-16 |
| `puppeteer-core` | 25.17.0 | Chrome control, always given the pinned binary's path. The design names no version; S7's pair, recorded driving build 157.0.8103.78 (A:M0-8) | 2026-11-16 |
| `@puppeteer/browsers` | 3.2.7 | Installs the pinned `chrome-headless-shell` (S7's pair; A:M0-8) | 2026-11-16 |
| `yauzl` | 3.4.0 | Unzip library `@puppeteer/browsers` needs in WSL, where no `unzip` exists (measured: the install fails without it) | 2026-11-16 |
| `@anthropic-ai/sdk` | 1.8.0 | Model transport behind `ModelClient`, with `maxRetries: 0` (`lld/07` D1) | 2026-11-16 |
