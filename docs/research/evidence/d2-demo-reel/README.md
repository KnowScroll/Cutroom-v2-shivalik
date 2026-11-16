# D2 demo reel: The Normandy beaches, D-Day, 6 June 1944

**What this is.** A hand-steered demo of the ingredients chosen for Cutroom v2, strung together by a throwaway script on one Windows machine. It is NOT output of the real system (no Director, no treatment search, no full review loop). The script was deleted; only the video, the contact sheet and this note are kept.

- Video: `normandy-demo.mp4`, 1080 x 1920, 30 fps, 41.1 s, 1233 frames, H.264 + AAC 48 kHz, about 20 MB. VERIFIED by ffprobe: 1233 frames counted, video and audio both 41.100 s, encode flags exactly as D1.
- Contact sheet: `contact-sheet.png`, 24 frames evenly spaced (with captions).
- Ingredients: MiniMax-M3 (thinking on) for the script, all scene components and both reviews (M3.1-Flash was NOT used in D2, by the user's second request); Kokoro 82M via OpenRouter (provider pinned to DeepInfra), voice `am_onyx`; headless Chrome 157 (puppeteer-core, screenshot capture); FFmpeg 8.1 for the sound bed, mix, master and encode. No image or video generation; every picture is drawn by code (Canvas 2D plus DOM text).

## What changed after the user's second request
The first brief asked for diagrams and a map; the user then asked for "something happening, like a scene of people storming the beach", a fast voice and no calm. Before any scene was rendered I changed to: animated scenes in Canvas 2D with parallax and seeded particles, rigged running silhouettes (I gave the model a small helper for the run cycle and a seeded hash; it was free to use or replace it), M3 with thinking for the components, three repair rounds allowed, a faster voice, a more driving bed.
- Scenes that worked as asked (8 of 9): 1 night sky with aircraft and parachutes; 2 fleet at sea (after review fix); 3 landing craft in rough sea; 4 ramp drops, soldiers run into the surf and up the sand past obstacles; 6 Omaha, dozens of running figures and obstacles; 7 Eisenhower silhouette in a command tent; 8 troops inland, then a Paris skyline (after review fix); 9 empty beach today.
- Weakest, where I fell short of "scene": shot 5 (the map beat) is still a stylised map with labels, though now an oblique coast with craft and arrows racing in and beaches lighting in sequence; shot 7 is a nearly static tableau (lamp, light and camera push only); shot 9 has little action. No shot had to be dropped, and I did not need to simplify any component myself. The Paris skyline is generic (a lattice tower and rooftops), not recognisably Paris beyond the date.
- Shot 6: many black obstacle crosses and logs beside the runners; the review said they could read as fallen figures. I did not fix it (two fixes per round only). I judged from frames that they are obstacles and running figures, but a viewer might read them differently. Flagged for the user.

## What was done differently from D1, and did it work
| Change | Worked? |
|---|---|
| Scenes with parallax, particles and running figures instead of diagrams | Yes, clearly more like an animated film (my own look at frames and the contact sheet; how it reads on a phone is ASSUMED). Shots 5 and 7 are the exceptions above. |
| Big type, few words: only hook, number, beach names, date, closing | Yes: 1 to 5 words per shot on screen; the validator enforces at least 44 px for every DOM text, the margins and the caption area. |
| Motion check (picture changes every 0.5 s) | Yes. All final components pass (at least 2,500 differing pixels between frames 0.5 s apart). Recorded minimums for shots 1 and 4 were about 214,000 px. |
| Transitions in each shot's first and last 0.3 s | Demanded in every prompt and visible in the sheets; a solid amber frame in shot 8 was found by the review and fixed. |
| Tight cuts (take + 0.1 s) | Yes. |
| Faster voice | Partly: 2.87 words/s after the 1.15 `atempo` cap, below the 3.0 to 3.4 target (see voice). |
| Large `max_tokens` (40,000 to 48,000) | Yes; no empty responses. |
| Fix prompts contain only the shot's own text | Yes. |

## The script (as spoken)
The model (M3, thinking) wrote a 9-shot script with scene descriptions (129 words). Its narration was descriptive ("landing craft batter rough waves, spray bursting across their decks"), not hard-hitting, so **I rewrote the narration by hand** (114 words, shorter, with commas inside phrases to reduce pauses) and set the on-screen strings myself. The scene descriptions are the model's. Numbers are spelled out for the voice.

1. D-Day, June sixth, nineteen forty-four. In the night, airborne troops drop behind the beaches.
2. Then the sea invasion, the largest in history. About one hundred fifty-six thousand Allied troops.
3. Operation Neptune, the seaborne assault. Landing craft crash through the waves toward France.
4. Ramps drop, and Allied forces storm ashore on the Normandy coast.
5. Five beaches. Americans at Utah and Omaha, British at Gold and Sword, Canadians at Juno.
6. Of all five, Omaha saw the heaviest fighting and losses.
7. Their commander, General Dwight D. Eisenhower, Supreme Allied Commander.
8. The landings opened a new front in western Europe, and Paris was liberated on August twenty-fifth, nineteen forty-four.
9. This was Operation Overlord, a new front. Remember it.

On screen (read back from the live pages at 0.25 s steps): shot 1 "D-DAY", "6 JUNE 1944"; 2 "ABOUT 156,000"; 3 and 4 none; 5 "UTAH, OMAHA, GOLD, JUNO, SWORD"; 6 "OMAHA"; 7 "GENERAL EISENHOWER"; 8 "25 AUGUST 1944"; 9 "OVERLORD". Captions are written by hand per shot (for example "ABOUT 156,000", "AUGUST 25, 1944") with the key word in amber.

**Fact check (VERIFIED by reading, not an automated check).** Every narration line, on-screen string and caption was checked against the ten facts. Nothing falls outside them except "Remember it." (an exhortation, not a claim) and pictures that are illustrative rather than claims (a generic skyline with a tower for Paris, a generic silhouette for Eisenhower, soldiers, landing craft, aircraft). No other dates, numbers, names or quotations.

## Voice and pace
- Audition on one 129-character line, same text for both: `am_onyx` 2.87 words/s, loudness range 3.7 LU; `am_fenrir` 2.75 words/s, 1.1 LU. By the rule (higher pace and more variation) I chose **`am_onyx`**, although the user's message named `am_fenrir` first. One line is a small sample; I cannot listen, so "energy" is only the loudness-range proxy.
- Real pace: 9 takes, one request per shot. Raw takes ran 2.08 words/s (long pauses at full stops). With silence trimmed from the start and end of each take and commas in place of some full stops: 2.50 words/s. Then one global `atempo` of **1.15** (the cap) on every take: **2.87 words/s final** (114 words). This is below the 3.0 to 3.4 target and could not be reached within the cap. Per take after tempo: 2.07 to 3.86 (shot 7, the name and title, is slowest).
- Shot length = take + 0.1 s (0.6 s after the last): 5.35, 5.51, 5.33, 3.21, 5.05, 2.69, 4.45, 5.33, 4.22 s. Total 41.1 s.

## Components: validation, first try and repairs
Validator (headless Chrome, one page per shot): no console or page errors; static scan for forbidden APIs (setTimeout, setInterval, requestAnimationFrame, Date, Math.random, fetch, CSS animation or transition, external URLs or resources, images); `__seek` exists; no scrolling; out-of-order seeks within 1,000 differing pixels; the picture changes between every pair of frames 0.5 s apart; every DOM text element at least 44 px effective size, inside the frame (40 px margin) and above y 1580 (caption area), checked every 0.5 s except the first and last 0.4 s. Not checked: overlap between text elements, how a scene looks.

| Shot | First try | Repairs | What failed |
|---|---|---|---|
| 1 Airborne | yes | 0 | |
| 2 Fleet | no | 1 | page error "t is not defined" |
| 3 Landing craft | no | 1 | page error "t is not defined" |
| 4 Ramp and beach | yes | 0 | |
| 5 Map | yes | 0 | |
| 6 Omaha | no | 1 | "OMAHA" outside the frame margin at 0.5 s |
| 7 Eisenhower | yes | 0 | |
| 8 Paris | yes | 0 | |
| 9 Closing | yes | 0 | |

**First-try pass: 6 of 9. All 9 passed within 1 repair round** (3 allowed). The review fixes were validated the same way: round 1, shot 8 passed first time and shot 5 needed one repair ("c is not defined"); round 2, shots 2 and 5 passed first time.

## Reviews (MiniMax-M3, thinking on; contact sheet of 24 frames as an image, with the style guide and shot list)
**Round 1.** Problems named: shot 2 no visible fleet, reads as a number over waves; shot 5 flat top-down map, blank sand, tiny labels; shot 6 shapes could read as fallen soldiers; shot 7 static; shot 8 an almost solid amber frame (dead frame) and a generic skyline; shot 9 nearly empty. Worst two: 5 and 8. Fixed: 5 rebuilt as an oblique animated coast; 8 amber flash shortened, Paris skyline with a lattice tower, river and troops.
**Round 2** (after re-render). Named: shot 2 still no fleet (severity 5); shot 5 label "UTAN" and overlapping labels, JUNO not visible; also 1 (weak first frame), 3 (dark craft), 6 (cluttered), 7 (static), 8, 9. Worst two: 2 and 5. Fixed: 2 now has several rows of ships with wakes; 5 labels staggered so they no longer overlap. Not fixed (round limit): the points on 1, 3, 6, 7, 8, 9. On my own look at the final sheet the fleet is visible and shot 5's labels are separate, but the map is still busy.

## Sound bed (code-rendered, no AI music; I could not listen, so this is by construction and measurement only)
- Pulse: a kick-like thump on every beat at **115 BPM** (sine with a pitch falling from about 118 Hz to 48 Hz, decay about 9 per second, plus a tiny click), continuous for the whole reel.
- Whooshes: pink noise band-passed 500 to 6,000 Hz, 0.6 s with a rising then falling fade; one at 0 s and one 0.35 s before each of the 8 cuts.
- Booms: brown noise low-passed at 140 Hz, 1.4 s exponential decay, at 0.7 s into shot 2 (the number) and 0.35 s into shot 4 (the ramp drop). These times are my estimates of when the number and ramp appear; not aligned frame by frame.
- Level: bed set 18 LU below the voice (voice -25.4 LUFS, bed -43.4 LUFS). It is ducked a further 6 dB (factor 0.5) while each take speaks, with 80 ms attack and 250 ms release ramps.
- Master: mix, one gain, then `aresample=192000,alimiter=limit=0.708:level=false:latency=true,aresample=48000` (no loudnorm). The first gain (+11.4 dB) gave -15.8 LUFS after the limiter because the voice is peaky; I raised the single gain in steps (+13.2, +14.0, +14.5 dB) to **-14.2 LUFS, peak -3.0 dBFS** (ebur128 and astats on the master). That much limiting may colour the voice a little; ASSUMED acceptable.

## Timings and spend
- Script request about 4 min. Voice: one audition pair and two full 9-take runs (the first discarded for slow pace). Components: 9 to 14 min for the first wave (thinking runs of 20,000 to 28,000 tokens), repairs 5 to 8 min. Render: 143 s for 1233 frames (4 shots at once). Encode about 40 s. Total wall time a few hours, lengthened by a tool outage and one stalled run (below).
- **Spend (cap 1.00 US dollar): about 0.565 US dollar counted; the cap was not reached.** MiniMax-M3 from each response's `usage` (input minus cache-read at 0.30, cache-read at 0.06, output at 1.20 per million): script 0.0271; 9 component first generations 0.3243; 8 repair or fix calls 0.1821 (3 validation repairs, 3 round-1 fix calls, 2 round-2 fix calls); 2 reviews 0.0300; total 0.5635. Speech (Kokoro via DeepInfra), 20 requests from the OpenRouter generation look-up `total_cost`: 0.0011.
- **Not counted:** requests abandoned without a response, so with no `usage`: one script request stopped after the user's change of direction, a second script request started by a failed prompt patch (stopped), and about 4 component requests in flight when a tool outage killed the run, then restarted. At roughly 0.03 each they would add at most about 0.2; the total stays below 0.8. The ledger was in the scratch folder and was deleted with it.

## Limits and what a viewer should know
- Captions are timed by character share of each take, not forced alignment; chunks can come early or late. They are drawn by the render (84 px, white with a dark outline, key word in amber) in the bottom area.
- No real footage, by design. Everything is stylised and code-drawn; the soldiers are simple rigged silhouettes and look stick-like in some shots.
- I could not listen. Voice quality, the bed balance and the mix are unjudged; only loudness and pace were measured. The voice choice rested on one short audition line.
- The Paris skyline and the Eisenhower figure are generic; the map is stylised, with no scale or coordinates, and the beach positions are not survey-accurate.
- The file is 20 MB, larger than D1's 4.5 MB, probably because of the film grain.
- Review fixes were limited to two shots per round, so known weak points remain (above).

## What went wrong
- The first script request used the old diagram prompt; the user's change of direction arrived mid-run, so I stopped it and redid the script. A prompt patch then failed on quoting and a second old-prompt run began and was stopped; neither returned a response.
- The model's narration was too descriptive and slow; I rewrote it by hand.
- The voice came out at 2.08 words/s raw, much slower than the 2.87 of my one-line audition, because Kokoro pauses at every full stop in short sentences. Partly fixed (commas, silence trimming, atempo 1.15), not fully.
- A tool-approval outage stopped me; the component run was killed with about half the shots finished, and I restarted it for the unfinished ones, resuming the three failed components from their saved files (their first-try failures come from the earlier log). An early version of my validator crashed at start on a path-escaping bug (no cost).
- The caption words ran together in the first render (a flexbox layout dropped the spaces); found on the contact sheet, fixed, everything re-rendered.
- The review-fix prompt reused the repair wrapper, so the model was told its previous attempt "failed validation" before the reviewer's note was shown. No visible harm.
