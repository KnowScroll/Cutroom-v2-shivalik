# Cutroom v2 — LLD · R1: Shared Foundations

**Accepted:** 14 November 2026
**Status:** **ACCEPTED.** These conventions are shared by all nine Phase C contracts (C0). Colour and alpha are decided in R2. Revision 2 (15 November 2026) makes consistency corrections with no change of substance and is reported to the user with the design freeze. Revision 3 (15 November 2026) fixes which way a rounding tie goes and is reported to the user.
**Related:** [Process and roadmap](00-design-process-and-roadmap.md) · [HLD Phase C](../hld/03-phase-c-integration-contracts.md) · [Spike evidence](../research/10-spike-evidence-log.md)

Field names in this document are illustrative. Exact schemas are written in R3.

## Revision 1 (14 November 2026)

Made by the lead session under the user's delegation, after the R2–R9 designs and spikes S3–S6. Each change is also marked at its section.

1. **§1.5 — sounds tied to a picture event.** A sound effect or music hit anchored to a visual event is placed at the frame where that event first appears, so the sound never comes before its visible cause. Voice and free-running music stay sample-accurate at the event time.
2. **§1.8 — sync tolerance verified.** The 40 ms early / 60 ms late tolerance is the end-to-end limit in EBU R37-2007. A tighter tolerance of 5 ms early / 15 ms late is added for the offset introduced when audio is muxed into the final file.
3. **§2.1 — why handles.** Spike S5 found no reference-copying mistakes with handles or with long IDs. Handles are kept because long IDs cost about 30% more input tokens per task.
4. **§2.2 — revision identity.** The revision hash covers the manifest including its parents, but not time or author. A `tree_hash` of the entity map says whether two revisions have identical content. Each entity version also has a `pin_hash`, the hash of its document without the commitment readiness field; jobs pin `pin_hash`, so freezing an unchanged commitment changes no work key.
5. **§4.3 — `unknown_outcome` when a provider offers no lookup.** MiniMax's model, synchronous speech and transcription calls have no idempotency key and no way to query a past request. For such providers, reconciliation means: adopt a complete response if one was already saved locally, otherwise book the call as charged, and allow one bounded resend (R5).
6. **§7 — claims.** The canonical-JSON claim is narrowed to TypeScript; the Python worker never canonicalises JSON. The handle and sync-tolerance claims are updated.
7. **§1.4 — film duration and audio samples.** The film's duration is exactly `N·T`, and the audio sample count is rounded from it: `round(N·T / flicks_per_sample)`, computed from the absolute end time. (Added to this list by Revision 2; §1.4 already noted it.)

## Revision 2 (15 November 2026) — consistency corrections

Made by the lead session under the user's delegation, after the fifth mechanical consistency pass (decision K12 in the [integration decisions](11-integration-decisions.md)). It corrects wording and changes no substance. Each change is also marked at its place. R1 was accepted by the user, so this revision is reported to the user with the design freeze.

1. **Revision 1 list — the §1.4 amendment.** The list gains item 7, the amendment §1.4 already noted inline: the film's duration is exactly `N·T`, and the audio sample count is rounded from it.
2. **§3.4 — anchors on real media.** An anchor on real media is stored on the asset in source pixels. The display crop is `layer.source.crop`, a field of the layer, and a crop change creates no new asset (FR6).
3. **§4.2 — the commitment fact.** The readiness facts include the commitment fact of §4.1, which R5's predicates use.
4. **§7 — claim labels.** The claims table may use the label VERIFIED by arithmetic, which the roadmap lists (K8).

## Revision 3 (15 November 2026) — rounding ties

Made by the lead session under the user's delegation, before the build (ruling L6 and row A:M0-7 in section 18 of the [integration decisions](11-integration-decisions.md)). R1 said "round to nearest" without saying which way an exact half goes, and ties do occur: every odd tick at the 15,360 timescale is exactly half a flick (§7). Each change is also marked at its place. R1 was accepted by the user, so this revision is reported to the user.

1. **Every "round to nearest" rounds half up** (towards +∞), computed exactly on integers: a rational n/d rounds to floor((2n + d) / 2d). This covers the audio sample count (§1.4), audio events placed at the nearest sample (§1.5), fractional local times (§1.6) and imported media timestamps (§1.7), and the stored flicks of a component's duration in R3 §2.1 rule 5. Half up is the direction JavaScript's `Math.round` takes, and a bias of half a flick (0.7 ns) has no effect anywhere.

## 1. Time

### 1.1 Canonical unit: the flick

- Every time and duration stored in the project is an **integer count of flicks**. One flick is exactly 1/705,600,000 of a second.
- `FLICKS_PER_SECOND = 705_600_000`.
- **Exact for the rates we use:**
  - 24, 25, 30, 48, 50, 60, 90, 100, 120 and 144 fps;
  - the NTSC rates 24000/1001, 30000/1001, 60000/1001 and 120000/1001;
  - audio at 8, 16, 22.05, 24, 32, 44.1, 48, 88.2, 96 and 192 kHz (48 kHz is 14,700 flicks per sample);
  - 1 ms (705,600 flicks);
  - the 90 kHz timescale used by transport-stream video (7,840 flicks per tick).
- **Range:** JavaScript holds integers exactly up to 2^53, which is about 147 days of flicks. No BigInt and no rational-number fields are needed in JSON.
- **Alternative considered:** exact fractions (numerator/denominator) everywhere. More general, but heavier in JSON and error-prone for LLMs to edit. Rejected because the flick already covers our rates.

### 1.2 Rates

- A frame rate or sample rate is stored as a rational `{num, den}`.
- A rate is valid only if one period is a whole number of flicks (`705_600_000 × den / num` is an integer). Other rates are rejected at the delivery-profile level.

### 1.3 Authoring units

LLMs and people never write flicks. The authoring layer accepts:

- milliseconds or decimal seconds (`650ms`, `5.15s`);
- frame numbers at a stated rate;
- beats against a tempo map;
- an event reference plus an offset (`eruption.start + 650ms`).

The compiler converts these to flicks. Any value given in whole milliseconds converts exactly.

### 1.4 Frames

- Frame `n` covers the half-open interval `[n·T, (n+1)·T)` and is sampled at its start, where `T` is the frame period in flicks.
- A film is exactly `N` frames long. If the planned duration is not a whole number of frames, the compiler extends it to the next frame boundary and reports the change.
- The film's duration is exactly `N·T`. The audio sample count is `round(N·T / flicks_per_sample)`, computed from the absolute end time and never by adding up rounded per-frame counts. (Revision 1 states the rounding explicitly; at 48 kHz and the supported frame rates the division is exact.) (Revision 3: a tie rounds half up.)

### 1.5 Events that fall between frames

- A visual event first appears on the first frame at or after the event time: `n = ceil(t / T)`.
- A reaction can therefore never appear before its cause.
- The compiler reports the shift for each event. The shift is always less than one frame.
- Audio events are placed at the nearest sample, so they stay accurate to the individual sample. (Revision 3: a tie rounds half up.)
- **Revision 1:** a sound effect or music hit anchored to a visual event is placed at that event's presented frame, not at the unrounded event time. Voice and free-running music are unaffected.

### 1.6 Local time

- Each component, action and layer runs on its own clock.
- A time map from parent clock to local clock is an ordered list of straight-line segments. Each segment has a parent interval, a local start and a rational speed. Speed 0 is a freeze; a negative speed is reverse.
- Outside its mapped range a component declares one behaviour: hold the first or last state, loop, hide, or raise an error.
- When a non-integer speed produces a fractional flick, the result is rounded to the nearest flick. (Revision 3: a tie rounds half up, computed exactly on integers.)
- Curved speed ramps can be added later as a new segment type.

### 1.7 Imported media

- Imported footage and audio keep their native timestamps and timebase unchanged.
- Some native timescales do not divide evenly into flicks (for example 15,360 per second, a common MP4 default: 705,600,000 / 15,360 = 45,937.5).
- Conversion to flicks rounds to the nearest flick. (Revision 3: a tie, such as every odd tick at 15,360 per second, rounds half up, computed exactly on integers.) The error is under 1.5 nanoseconds. This is the single documented rounding rule for media timestamps.

### 1.8 Audio/video sync tolerance

- A sync check needs a tolerance. The default is audio no more than 40 ms early and no more than 60 ms late. **Revision 1:** this is the end-to-end limit in [EBU R37-2007](https://tech.ebu.ch/docs/r/r037.pdf). The offset added when audio is muxed into the final file has its own tolerance of 5 ms early and 15 ms late, the per-stage figure from the same source. Both are named settings owned by R9.

## 2. Identity, revisions and references

### 2.1 Entities

- **Entity ID:** opaque and permanent: `ent_` plus a UUIDv7 (time-sortable).
- **Handle:** a short name, unique within the project, such as `presenter` or `shot04.volcano`. Characters allowed: lowercase letters, digits, `_`, `.`, `-`; at most 64 characters.
- LLMs read and write handles. The tool layer translates handles to IDs.
- Renaming a handle is a patch and does not change the entity ID.
- Every handle an LLM writes is checked. An unknown handle returns an `UNKNOWN_ENTITY` error that lists the nearest matches.
- **Why handles (Revision 1):** long IDs cost about 30% more input tokens per task (spike S5). The same spike found no copying mistakes with either form, so the reason is cost, not accuracy.

### 2.2 Revisions

- **Revision ID:** `rev_` plus the SHA-256 hash of the revision's content in canonical JSON (RFC 8785, which fixes field order and number formatting so identical content always hashes the same).
- Each revision records its parent revision or revisions.
- Accepted revisions also get a readable counter (`P17`, `P18`, …). The accepted-head pointer names one revision at a time.
- An entity ID is never a revision ID (C0 invariant 1).
- **Revision 1:** "content" means the revision manifest including its parents, and excludes time and author. A separate `tree_hash` covers only the entity map, so two revisions with the same content but different history can be recognised. Each entity version also has a `pin_hash`: the hash of its document with the commitment readiness field removed. Jobs and consumers pin `pin_hash`, so freezing an unchanged commitment changes no work key.

### 2.3 Artifacts

- **ArtifactRef:** `sha256:` plus the hash of the bytes, with the media type and size.
- Who produced an artifact, from which inputs and with which tools, is stored as metadata next to it, not inside the reference.

### 2.4 Jobs and the work key

- Job IDs and attempt IDs are UUIDv7. Each carries a correlation ID and a causal parent.
- **Work key:** the SHA-256 hash of the canonical JSON of: the capability and its version, the hashes of all pinned inputs, the parameters, and the execution environment's hash.
- The one work key serves three purposes: deduplicating equivalent jobs, keying the cache, and acting as the idempotency key for paid external calls.

### 2.5 Hash choice

- SHA-256, written as lowercase hex with a `sha256:` prefix.
- It is built into Node and Python. BLAKE3 is faster but needs a native add-on, and hashing time is negligible next to rendering.

## 3. Space

### 3.1 Design units

- Positions and sizes are in **design units**. A 9:16 canvas is 1080 × 1920 design units.
- Origin at the top-left; x to the right; y pointing down.
- Angles in degrees, clockwise positive.
- This matches SVG, CSS and Canvas, so LLM-written code avoids sign mistakes.

### 3.2 Output scale

- Output resolution is a scale factor over design units: ×1 for 1080 × 1920, about ×0.667 for a 720 × 1280 preview, ×2 for 2160 × 3840.
- Previews at lower resolution use the same component code.

### 3.3 World, camera and screen

- Objects live in world space.
- The camera is a 2D transform (pan, zoom, rotate) from world space to the canvas.
- Each layer is either attached to the world (moves with the camera) or locked to the screen (captions, overlays).

### 3.4 Anchors on real media

- An annotation anchor on an imported image or clip is stored on the asset, in that asset's own source pixel coordinates. **Revision 2:** the display crop is not stored with the anchor; it is `layer.source.crop`, a field of the layer, and a crop change creates no new asset (FR6).
- When the crop or transform changes, the anchor's canvas position is recomputed. The anchor itself does not change.

### 3.5 Safe zones

- Safe zones are versioned data in a delivery profile, not hardcoded.
- Starting defaults for a combined TikTok/Reels/Shorts profile: about 130–150 units clear at the top, about 340 at the bottom, about 130 on the right, with faces and text kept inside a central region of about 900 × 1400. These come from secondary sources that disagree with each other; no official specification was found.

### 3.6 Regions

- A region is an axis-aligned rectangle by default, a polygon when needed, or a sequence of shapes keyed to time.
- Each region carries a flag saying whether it is conservative (guaranteed to contain the real footprint).
- Detailed spatial contracts are designed in R4.

## 4. Readiness and lifecycle

### 4.1 Commitments

- States: `exploring`, `provisional`, `frozen` (from HLD B1.2), plus the end states `superseded` and `withdrawn`.

### 4.2 Artifact readiness is a set of facts

Readiness is not one status field. Each fact is recorded by the authority that owns it (C0 invariant 2):

| Fact | Recorded by |
|---|---|
| Completion, including which time ranges are available | Scheduler |
| Validation records (each check and its verdict) | Quality System |
| Acceptance for a given project revision | Project Core, on the Director's decision |
| Delivery eligibility | The final deliverable record |
| Commitment (section 4.1), which R5's predicates use (Revision 2) | Project Core |

A consumer states what it needs as a condition over these facts, for example `complete AND decode_ok`. A single status field would have been written by several subsystems, which C0 forbids.

### 4.3 Jobs

- States: `declared`, `waiting`, `ready`, `running`, `partial`, `succeeded`, `failed`, `cancelled`, `superseded`, `unknown_outcome`.
- **`unknown_outcome`** covers a paid external call whose reply was lost. A job in this state must be reconciled before any retry. This is the guard against paying twice.
- **Revision 1:** where a provider offers a way to look up a past request, reconciliation uses it. Where it offers none (MiniMax model, synchronous speech and transcription calls), reconciliation means: adopt a complete response if one was already saved locally; otherwise book the call as charged and allow one resend within a per-film allowance. `unknown_outcome` is a job state, never a failure class.
- Every failure carries a class, and each class has its own retry rule:

| Class | Meaning | Default handling |
|---|---|---|
| `transient` | Crash, network fault, rate limit | Bounded retry with the same pinned inputs |
| `deterministic` | The same inputs will fail the same way | No retry without a changed input |
| `capability` | Something required is missing or unsupported | Capability repair, or escalate |
| `creative` | It ran, but the result is not good enough | The Director decides; branch an alternative |
| `policy` | Rights, budget or a hard constraint | No retry; report or use an eligible fallback |

## 5. Evidence

One convention is shared by diagnostics, reviews and experiments (C8).

- **Verdict:** `PASS`, `FAIL`, `UNKNOWN`, `NOT_APPLICABLE`.
- **Check type:** `observational`, `corrective`, `hard` (the three types in HLD B3.1).
- **Severity:** `blocking`, `material`, `minor`, `note`.
- **Location:** entity IDs, the project revision, a time interval in flicks, an optional region in design units, an ArtifactRef, and a source location (a code file and line, or a position in the project tree).
- **Coverage record:** exactly what was inspected: time intervals, sampled frames or the sampling rate, audio intervals, whether an isolated layer or the full composite was viewed, and the resolution. It includes a coverage fraction. A review of three still frames cannot be reported as a review of the whole film.
- **Content is kept in three separate lists:** observed facts, hypotheses (each with a confidence), and suggestions.
- **Comparing frames:** two renders of the same frame are compared with a tolerance, not by byte equality (spikes S1 and S1c).

## 6. Cross-domain check

| Domain | What R1 gives it |
|---|---|
| Historical comedy | A reaction never shows before its cause; audio cues are sample-accurate |
| Science documentary | Footage keeps its native timestamps, with one documented rounding rule |
| Art history | Anchors in source-image coordinates survive crop changes |
| Software tutorial | Screen recordings with irregular frame timing map onto the film clock; cursor events are "event plus offset" |
| Data reel | Nothing special is needed |
| Abstract motion graphics | Time can be written in beats against a tempo map |

## 7. Claims this stage relies on

**Revision 2:** the label VERIFIED by arithmetic, for a claim that follows from a derivation shown beside it, is one of the roadmap's labels (K8).

| Claim | Label | Evidence or consequence |
|---|---|---|
| The flick is exact for the listed frame and audio rates | VERIFIED by source | [Flicks README](https://github.com/facebookarchive/Flicks), plus arithmetic |
| Flick counts for about 147 days fit in a JavaScript number | VERIFIED by arithmetic | 2^53 / 705,600,000 ≈ 12.77 million seconds |
| A timescale of 15,360 does not divide evenly into flicks | VERIFIED by arithmetic | 705,600,000 / 15,360 = 45,937.5 |
| Two renders of the same frame are not byte-identical but are visually identical | VERIFIED by spike | S1, S1c: PSNR 77–83 dB |
| RFC 8785 canonical JSON and UUIDv7 have maintained TypeScript libraries | VERIFIED by source (Revision 1) | `canonicalize` 5.1.0 and `uuid` 14 (sources in R3). The Python RFC 8785 package is stale, so only TypeScript canonicalises JSON |
| The safe-zone defaults | SECONDARY | Vendor blogs that disagree. They are data in a profile, so correcting them is not a design change |
| The 40/60 ms sync tolerance, and 5/15 ms for the mux stage | VERIFIED by source (Revision 1) | EBU R37-2007, Table 1 |
| Long IDs cost about 30% more input tokens than handles; neither form caused copying mistakes | VERIFIED by spike (Revision 1) | S5. The earlier assumption that handles reduce mistakes was not supported |
| A provider-side lookup exists for lost paid calls | False for MiniMax model, synchronous speech and transcription calls; VERIFIED by source (Revision 1) | MiniMax API references (sources in R5). Hence the salvage, presume-charged and bounded-resend rule |
