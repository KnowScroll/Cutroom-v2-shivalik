// Design: lld/02 §1.1-1.7, Revision 3 (flick time, ties half up; L6)
import assert from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";
import {
  audioSamples,
  FLICKS_PER_MS,
  FLICKS_PER_SECOND,
  filmFrames,
  flicksPerPeriod,
  flicksToSamples,
  formatTime,
  frameStart,
  isFlickExactRate,
  mediaTicksToFlicks,
  msToFlicks,
  parseTime,
  presentedFrame,
  roundHalfUp,
} from "../src/index.js";

const FPS: [number, number][] = [
  [24, 1],
  [25, 1],
  [30, 1],
  [48, 1],
  [50, 1],
  [60, 1],
  [90, 1],
  [100, 1],
  [120, 1],
  [144, 1],
  [24000, 1001],
  [30000, 1001],
  [60000, 1001],
  [120000, 1001],
];
const AUDIO_HZ = [8000, 16000, 22050, 24000, 32000, 44100, 48000, 88200, 96000, 192000];
const SAFE = Number.MAX_SAFE_INTEGER;

function must<T>(r: { ok: boolean; value?: T }): T {
  assert.equal(r.ok, true);
  return r.value as T;
}

function bigRoundHalfUp(n: bigint, d: bigint): bigint {
  const x = 2n * n + d;
  const y = 2n * d;
  let q = x / y;
  if (x % y < 0n) q -= 1n;
  return q;
}

test("every R1 §1.1 rate is flick-exact", () => {
  for (const [num, den] of FPS) assert.equal(isFlickExactRate({ num, den }), true, `${num}/${den}`);
  for (const hz of AUDIO_HZ) assert.equal(isFlickExactRate({ num: hz, den: 1 }), true, `${hz}`);
  assert.equal(isFlickExactRate({ num: 1000, den: 1 }), true);
  assert.equal(isFlickExactRate({ num: 90000, den: 1 }), true);
});

test("named flick counts: 48 kHz 14,700; 1 ms 705,600; 90 kHz tick 7,840", () => {
  assert.equal(flicksPerPeriod({ num: 48000, den: 1 }), 14_700);
  assert.equal(msToFlicks(1), 705_600);
  assert.equal(FLICKS_PER_MS, 705_600);
  assert.equal(flicksPerPeriod({ num: 90000, den: 1 }), 7_840);
  assert.equal(FLICKS_PER_SECOND, 705_600_000);
});

test("rate 15,360/1 is rejected (45,937.5); zero and negative rates are rejected", () => {
  assert.equal(isFlickExactRate({ num: 15360, den: 1 }), false);
  assert.equal(flicksPerPeriod({ num: 15360, den: 1 }), undefined);
  assert.equal(isFlickExactRate({ num: 0, den: 1 }), false);
  assert.equal(isFlickExactRate({ num: 24, den: 0 }), false);
  assert.equal(isFlickExactRate({ num: 24.5, den: 1 }), false);
});

test("roundHalfUp rounds an exact half up for positive and negative n", () => {
  assert.equal(roundHalfUp(1, 2), 1);
  assert.equal(roundHalfUp(3, 2), 2);
  assert.equal(roundHalfUp(-1, 2), 0);
  assert.equal(roundHalfUp(-3, 2), -1);
  assert.equal(roundHalfUp(-5, 2), -2);
  assert.equal(roundHalfUp(7, 3), 2);
  assert.equal(roundHalfUp(-7, 3), -2);
  assert.equal(roundHalfUp(0, 5), 0);
  assert.throws(() => roundHalfUp(1, 0), RangeError);
  assert.throws(() => roundHalfUp(1.5, 2), RangeError);
});

test("roundHalfUp agrees with exact rational rounding near 2^53", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: -SAFE, max: SAFE }),
      fc.oneof(fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 1, max: SAFE })),
      (n, d) => {
        assert.equal(BigInt(roundHalfUp(n, d)), bigRoundHalfUp(BigInt(n), BigInt(d)));
      },
    ),
    { numRuns: 2000 },
  );
  // Ties near 2^53: n = 2m + 1 over d = 2.
  fc.assert(
    fc.property(fc.integer({ min: SAFE - 1000, max: SAFE }), (n) => {
      const odd = n % 2 === 0 ? n - 1 : n;
      assert.equal(roundHalfUp(odd, 2), (odd + 1) / 2);
    }),
  );
});

test("presentedFrame is ceil(t/T): the least n with n*T >= t, near 2^53", () => {
  assert.equal(presentedFrame(0, 29_400_000), 0);
  assert.equal(presentedFrame(1, 29_400_000), 1);
  assert.equal(presentedFrame(29_400_000, 29_400_000), 1);
  assert.equal(presentedFrame(29_400_001, 29_400_000), 2);
  assert.equal(frameStart(3, 29_400_000), 88_200_000);
  const periods = FPS.map(([num, den]) => flicksPerPeriod({ num, den }) as number);
  fc.assert(
    fc.property(
      fc.constantFrom(...periods),
      fc.integer({ min: 0, max: 5000 }),
      fc.constantFrom(-1, 0, 1),
      (T, back, delta) => {
        const kMax = Math.floor((SAFE - 2) / T);
        const k = kMax - back;
        const t = k * T + delta;
        const n = presentedFrame(t, T);
        const expected = (BigInt(t) + BigInt(T) - 1n) / BigInt(T);
        assert.equal(BigInt(n), expected);
        assert.ok(BigInt(n) * BigInt(T) >= BigInt(t));
        assert.ok(n === 0 || BigInt(n - 1) * BigInt(T) < BigInt(t));
      },
    ),
    { numRuns: 1000 },
  );
});

test("filmFrames never shortens and reports its extension", () => {
  const r = filmFrames(29_400_001, 29_400_000);
  assert.deepEqual(r, { frames: 2, durationFlicks: 58_800_000, extension: 29_399_999 });
  assert.deepEqual(filmFrames(58_800_000, 29_400_000), {
    frames: 2,
    durationFlicks: 58_800_000,
    extension: 0,
  });
  const periods = FPS.map(([num, den]) => flicksPerPeriod({ num, den }) as number);
  fc.assert(
    fc.property(fc.constantFrom(...periods), fc.integer({ min: 0, max: 200 * FLICKS_PER_SECOND }), (T, d) => {
      const f = filmFrames(d, T);
      assert.ok(f.durationFlicks >= d);
      assert.ok(f.durationFlicks - d < T);
      assert.equal(f.durationFlicks, f.frames * T);
      assert.equal(f.extension, f.durationFlicks - d);
    }),
  );
});

test("audioSamples is exact at 48 kHz for every supported frame rate", () => {
  for (const [num, den] of FPS) {
    const T = flicksPerPeriod({ num, den }) as number;
    for (const N of [1, 7, 1441, 86_400]) {
      const flicks = N * T;
      // 90 and 144 fps have periods that are not a multiple of 14,700 flicks; R1 does not list them
      // among the supported delivery rates, so they get the half-up rounding instead (design doubt).
      if (T % 14_700 !== 0) {
        assert.equal(audioSamples(N, T, { num: 48000, den: 1 }), roundHalfUp(flicks, 14_700));
        continue;
      }
      assert.equal(audioSamples(N, T, { num: 48000, den: 1 }), flicks / 14_700);
    }
  }
  fc.assert(
    fc.property(fc.constantFrom(...FPS), fc.integer({ min: 0, max: 1_000_000 }), ([num, den], N) => {
      const T = flicksPerPeriod({ num, den }) as number;
      if (T % 14_700 !== 0) return;
      assert.equal(audioSamples(N, T, { num: 48000, den: 1 }), (N * T) / 14_700);
    }),
  );
});

test("audio sample count is from the absolute end time, not per-frame sums (tie at 44.1 kHz)", () => {
  // 1 frame at 24 fps = 29,400,000 flicks; 44.1 kHz sample = 16,000 flicks; 1837.5 samples, half up.
  const hz = { num: 44100, den: 1 };
  assert.equal(audioSamples(1, 29_400_000, hz), 1838);
  assert.equal(flicksToSamples(8_000, hz), 1);
  assert.equal(flicksToSamples(7_999, hz), 0);
  // Summing rounded per-frame counts over 2 frames would give 3676; the absolute end time gives 3675.
  assert.equal(audioSamples(2, 29_400_000, hz), 3675);
  assert.throws(() => audioSamples(1, 29_400_000, { num: 15360, den: 1 }), RangeError);
});

test("parseTime: 5.15s, 650ms, decimals as text", () => {
  assert.equal(must(parseTime("5.15s")), 3_633_840_000);
  assert.equal(must(parseTime("650ms")), 458_640_000);
  assert.equal(must(parseTime("0ms")), 0);
  assert.equal(must(parseTime("1s")), FLICKS_PER_SECOND);
  assert.equal(must(parseTime("0.1s")), 70_560_000);
  assert.equal(must(parseTime("-650ms")), -458_640_000);
  assert.equal(must(parseTime("+80ms")), 56_448_000);
  assert.equal(must(parseTime("1.5ms")), 1_058_400);
});

test("parseTime rounds a tie half up, exactly", () => {
  // 0.0003125 ms = 220.5 flicks.
  assert.equal(must(parseTime("0.0003125ms")), 221);
  assert.equal(must(parseTime("-0.0003125ms")), -220);
});

test("parseTime rejects bad literals and out-of-range values", () => {
  for (const bad of ["", "5", "5.s", ".5s", "5.15 s", "1e3ms", "5.15S", "abc", "5.15s ", "1,5s"]) {
    const r = parseTime(bad);
    assert.equal(r.ok, false, bad);
    if (!r.ok) assert.equal(r.diagnostics[0]?.code, "BAD_TIME_LITERAL");
  }
  const big = parseTime("99999999999999999s");
  assert.equal(big.ok, false);
  if (!big.ok) assert.equal(big.diagnostics[0]?.code, "VALUE_OUT_OF_RANGE");
});

test("formatTime shows 650ms and 5.15s and round-trips whole milliseconds", () => {
  assert.equal(formatTime(458_640_000), "650ms");
  assert.equal(formatTime(3_633_840_000), "5.15s");
  assert.equal(formatTime(0), "0ms");
  assert.equal(formatTime(FLICKS_PER_SECOND), "1s");
  assert.equal(formatTime(-458_640_000), "-650ms");
  fc.assert(
    fc.property(fc.integer({ min: -10_000_000, max: 10_000_000 }), (ms) => {
      assert.equal(must(parseTime(formatTime(msToFlicks(ms)))), msToFlicks(ms));
    }),
  );
});

test("mediaTicksToFlicks: odd ticks at 15,360 are halves, rounded up", () => {
  assert.equal(must(mediaTicksToFlicks(1, 15_360)), 45_938);
  assert.equal(must(mediaTicksToFlicks(2, 15_360)), 91_875);
  assert.equal(must(mediaTicksToFlicks(3, 15_360)), 137_813);
  assert.equal(must(mediaTicksToFlicks(-1, 15_360)), -45_937);
  assert.equal(must(mediaTicksToFlicks(90_000, 90_000)), FLICKS_PER_SECOND);
});

test("mediaTicksToFlicks survives an hour at 15,360 per second (ticks x 705,600,000 passes 2^53)", () => {
  const ticks = 3600 * 15_360;
  assert.ok(ticks * FLICKS_PER_SECOND > SAFE);
  assert.equal(must(mediaTicksToFlicks(ticks, 15_360)), 3600 * FLICKS_PER_SECOND);
  fc.assert(
    fc.property(
      fc.constantFrom(15_360, 90_000, 44_100, 30_000, 12_800, 1_000),
      fc.double({ min: 0, max: 1, noNaN: true }),
      (ts, frac) => {
        const ticks2 = Math.floor(frac * ts * 100 * 3600);
        const r = mediaTicksToFlicks(ticks2, ts);
        assert.equal(r.ok, true);
        if (r.ok) {
          assert.equal(
            BigInt(r.value),
            bigRoundHalfUp(BigInt(ticks2) * BigInt(FLICKS_PER_SECOND), BigInt(ts)),
          );
        }
      },
    ),
    { numRuns: 1000 },
  );
});

test("mediaTicksToFlicks rejects bad input and overflow with VALUE_OUT_OF_RANGE", () => {
  for (const [t, ts] of [
    [1, 0],
    [1, -5],
    [1.5, 15360],
    [SAFE, 1],
  ] as const) {
    const r = mediaTicksToFlicks(t, ts);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.diagnostics[0]?.code, "VALUE_OUT_OF_RANGE");
  }
});

test("msToFlicks is exact and guarded", () => {
  assert.equal(msToFlicks(650), 458_640_000);
  assert.throws(() => msToFlicks(SAFE), RangeError);
  assert.throws(() => msToFlicks(0.5), RangeError);
});
