# D1 demo reel: Alan Turing and the Turing machine

**What this is.** A hand-steered demo of the ingredients chosen for Cutroom v2, strung together by a throwaway script on one Windows machine. It is NOT output of the real system: there is no Director, no treatment search, no full review loop. The script code was deleted; only the video, the contact sheet and this note are kept.

- Video: `turing-demo.mp4` (1080 x 1920, 30 fps, 65.6 s, 1968 frames, H.264 + AAC 48 kHz stereo, about 4.5 MB). Checked with ffprobe: 1968 frames, audio and video both 65.6 s.
- Contact sheet: `contact-sheet.png` (24 frames, every 82nd frame).
- It is about 5 s longer than the 45-60 s aim: the model wrote 146 words and the voice speaks them at its natural pace. Not trimmed.

## Ingredients used
- Script: MiniMax-M3 (thinking on). Visual components: MiniMax-M3.1-Flash (low effort). Review: MiniMax-M3 (thinking on) with a contact sheet as an image.
- Voice: Kokoro 82M through OpenRouter, provider pinned to DeepInfra with slug `deepinfra` (accepted; the endpoints list shows its tag as `deepinfra/us`). Voice `bm_george` for every line. I cannot listen, so it was chosen by the brief's fallback, not auditioned against other voices (naturalness is ASSUMED).
- Drawing: headless Chrome (chrome-headless-shell 157, puppeteer-core), screenshot capture, one browser per beat. Audio and encode: FFmpeg 8.1.
- No image or video generation. All pictures are SVG/HTML/CSS drawn by code; no external assets.

## The script (as spoken; numbers are spelled out for the voice and shown as digits in the captions)

**Beat 1 - Hook** (5.9 s)
- Narration: What if one machine, given the rules of another, can imitate any machine like it?
- On screen (as planned): A vertical dark navy canvas with an off-white horizontal tape made from outlined cells continuing beyond both edges. A small rectangular head moves above the cells while teal arrows connect the tape to a second miniature machine. Centered text reads: Can one machine imitate any other such machine? The cells slide as the head advances one cell at a time. Everything is code drawn from simple shapes and text.

**Beat 2 - Who was Alan Turing** (7.4 s)
- Narration: Alan Turing was a British mathematician, born on twenty three June nineteen twelve in London.
- On screen (as planned): A clean typographic card on dark navy. Large centered text reads Alan Turing, followed by British mathematician and Born 23 June 1912 in London. A faint outlined tape-and-head motif moves behind the lettering. No portrait or photograph is used.

**Beat 3 - The Turing machine** (12.1 s)
- Narration: In nineteen thirty six, Turing published On Computable Numbers, with an Application to the Entscheidungsproblem, describing an imaginary machine now called a Turing machine.
- On screen (as planned): The tape fills most of the vertical frame as outlined cells continuing past both edges, with small text reading Endless tape. A blocky read-and-write head points down at one cell. Beside it, a compact table headed Current state, Read, Write, Move, Next state has the rows A zero one Right A; A one zero Right B; B zero one Left B; B one zero Left A. Above the table, a label reads Illustration only and Finite rule table. The visible tape begins as zero one zero one zero one zero one zero, with the head over the middle zero and Current state A. Animate one table action at a time: A reads zero, writes one, moves right, and enters A; A reads one, writes zero, moves right, and enters B; B reads zero, writes one, moves left, and stays in B; B reads one, writes zero, moves left, and enters A. Then continue with the next table action. The read cell glows teal, the rewritten cell flashes amber, and the head slides left or right.

**Beat 4 - The universal machine** (11.6 s)
- Narration: A universal machine can imitate any other such machine, given its rules as input on the tape. This is the idea behind the stored program computer.
- On screen (as planned): A linked code-drawn diagram. At the top, a small tape is labeled Rules for another such machine. An arrow leads to a second tape labeled Rules as input on the tape, then into a large outlined rectangle labeled Universal Turing machine. An outgoing arrow leads to a miniature tape and head labeled Imitates any other such machine. The head moves across the rule tape while the connections illuminate in sequence. A bottom caption reads: The idea behind the stored program computer.

**Beat 5 - The limit** (9.1 s)
- Narration: Some problems cannot be decided by any such machine at all. The best known example is now called the halting problem.
- On screen (as planned): A restrained diagram shows a small card labeled Problem pointing toward a rounded box containing a tape and head, labeled Any such machine. The connector stops at a bold horizontal barrier before reaching the box. Large text below reads: Some problems cannot be decided by any such machine at all. An outlined emphasis card then appears with the text: The best known example is now called the halting problem. No other problem is named.

**Beat 6 - Bletchley Park** (10.2 s)
- Narration: During the Second World War, he worked at Bletchley Park and was a leading figure in breaking German Enigma messages and designing the Bombe machine.
- On screen (as planned): A charcoal and teal code-drawn diagram with a simple geometric building silhouette labeled Bletchley Park. Two connected outlined boxes beside it read Breaking German Enigma messages and Designing the Bombe machine. The header reads During the Second World War. A caption beneath reads: Alan Turing was a leading figure in breaking German Enigma messages and designing the Bombe machine. The boxes illuminate one after the other while the building outline remains still. No photograph, portrait, or detailed reconstruction of the Bombe appears.

**Beat 7 - Legacy and end card** (9.3 s)
- Narration: In nineteen fifty, he proposed what is now called the Turing test. He died on seven June nineteen fifty four.
- On screen (as planned): A dark navy end card. Small text at the top reads Computing Machinery and Intelligence, 1950. The large centered title reads Alan Turing and the Turing Machine. Beneath it, an outlined label reads What is now called the Turing test. At the bottom, the text reads Died 7 June 1954. A faint tape-and-head motif slides once across the background and then rests.

Fact check (step 9): I read back every on-screen string (extracted from the live pages at six times per beat) and every narration line against the eight supplied facts. Nothing states anything outside them. The rule table and the 0/1 tape in beat 3 are an invented illustration, labelled "Illustration only" on screen. VERIFIED by reading, not by an automated check.

## Components: validation
Validator: loads in headless Chrome; no console or page errors; no forbidden APIs (static scan of the source); `__seek` exists; seeks to start, middle and end in shuffled order then repeated, compared by screenshots; text boxes checked against 70 px side/top margins and the bottom 300 px caption area; scrollable overflow checked.

| Beat | First try | Repair rounds | What failed first |
|---|---|---|---|
| 1 Hook | no | 1 | A URL in the source (the SVG namespace) |
| 2 Who | yes | 0 | |
| 3 Machine | no | 2 | URL in source; screenshots not identical on re-seek; then tape-cell digits drawn beyond the side margins |
| 4 Universal | no | 1 | A caption line wider than the screen (box -85 to 1165 px) |
| 5 Limit | yes | 0 | |
| 6 Bletchley | yes | 0 | |
| 7 End card | no | 1 | The top line outside the side margin |

First-try pass: 3 of 7. All 7 passed after at most 2 repair rounds (the limit).

Caveat on "not identical on re-seek": beat 3 kept failing a strict byte-for-byte screenshot hash even though its logic is a pure function of time. I measured the difference: 17 to 23 pixels out of 2 million, at most 14 levels, along cell borders, which is rasterization noise in headless Chrome rather than state leakage. I changed the validator to allow up to 1000 differing pixels; with that, all 7 final components pass. I did not re-run the first-round versions under the tolerance, so the first-try figures use the strict check for that one item.

## The one review and one fix
MiniMax-M3 was shown a 42-frame sheet (6 frames per beat) with the script and style guide. Its three biggest problems:
1. Beat 3: the rule table and tape labels are too small to read; enlarge them and highlight only the active row and cell. (Named the worst shot.)
2. Beat 4: the scripted line "The idea behind the stored program computer" was missing.
3. Beat 7: supporting end-card text (the 1950 paper line, the Turing test label, the date) is below the 40 px floor.

Fix applied to beat 3 only, as asked. What went less cleanly:
- My fix prompt accidentally included the review's item 2, so the model pasted beat 4's sentence into beat 3. An extra "polish" round removed it and fixed overlapping labels and colliding table headers that I saw on a full-size frame. Beat 3 therefore took 4 model calls after the review (1 fix, 2 validation repairs, 1 polish).
- Problems 2 and 3 were NOT fixed (one fix only). Problem 2 is partly a non-issue (the sentence is in beat 4's on-screen text and appears later in the shot). Problem 3 stands: the 1950 paper line and the Turing test label are small on a phone.
- Visible flaws left alone: in beat 1 the tape overlaps the last headline line; in beats 4 to 7 the pictures sit in the upper two-thirds with small type and large empty areas; small label text in beats 3, 4 and 6 is under the 40 px the style guide asked for.

## Captions
Phrase-level, burned in by the render (dark rounded box, white bold 62 px text, inside the bottom safe area). Each line is split at punctuation into phrases of about 3 to 6 words, each timed by its share of the line's characters. This is not forced alignment, so phrases can change a little early or late. Number words become digits for display only.

## Timings
- Script: about 4 min per attempt. The first request spent its whole 16,000-token budget on thinking and returned no text, so it was repeated with 40,000.
- Voice: 7 lines in about 30 s including cost look-ups. Spoken lengths 5.5, 7.0, 11.7, 11.2, 8.7, 9.8, 8.5 s; each beat adds 0.4 s (0.8 s for the last): 65.6 s.
- Visuals, validation and repairs: 286 s for all 7 (4 requests at a time).
- Review and beat 3 fix: about 10 min including my own looks at frames.
- Render: 92.2 s for 1968 frames (4 beats at once, one page per beat, PNG screenshots at 1080 x 1920, scale 1).
- Audio master: measured -21.8 LUFS integrated, one static gain of +7.8 dB, then the limiter chain from the brief; result -14.1 LUFS and -3.0 dBFS peak (as reported by ebur128 on the output). No loudnorm.
- Encode: 16 s, with the command from the brief.
- Total wall time: about 35 minutes from first command to final files, including setup and my own checking.

## Spend (cap 1.00 US dollar)
Total about 0.111 US dollar. Counted from real responses: MiniMax from each response's `usage` (input minus cache-read tokens at the input price, cache-read at the cached price, output at the output price; M3 at 0.30 / 1.20 / 0.06 and M3.1-Flash at 0.15 / 0.60 / 0.015 per million); OpenRouter speech from `GET /api/v1/generation?id=...`, field `total_cost`.
- MiniMax-M3: script, first attempt (empty text) 0.0193; script, second attempt 0.0209; review 0.0178. Subtotal 0.0580.
- MiniMax-M3.1-Flash: 7 first generations 0.0204; 5 validation repairs 0.0164; beat 3 review fix, its 2 repairs and the polish 0.0152. Subtotal 0.0520.
- Kokoro via DeepInfra: one probe line plus 7 lines, 8 requests, 0.00056 in all.
- Total: MiniMax 0.1100 + speech 0.0006 = 0.1105 US dollars.
The ledger lived in the scratch folder and was deleted with it.

## What a viewer should know
- Captions are timed by character share, not aligned to the audio.
- The pictures are plain code-drawn diagrams from a fast, low-effort model with up to two repair rounds. The style is consistent (one palette and type guide) but layouts are uneven, as described above.
- The only visual review was one pass by a language model over a contact sheet, plus my own look at a few frames.
- No real images, by design.
- The voice was not auditioned.

## What went wrong
- The first script request returned nothing (all tokens spent on thinking); repeated.
- Small bugs in my own throwaway scripts (path quoting, a metadata folder mistaken for the browser) before any billable run was wasted.
- The strict screenshot-hash check was too strict for headless-Chrome noise (above).
- The beat 3 fix prompt leaked beat 4's sentence into beat 3 (above).
- The reel is 65.6 s, over the 60 s target.
