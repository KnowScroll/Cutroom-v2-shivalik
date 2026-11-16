// Design: lld/02 §1.1-1.7 and Revision 3 (flick arithmetic on safe integers, ties round half up; L6)
import { fail, ok, type Result } from "../vocab/diagnostic.js";

export const FLICKS_PER_SECOND = 705_600_000;
export const FLICKS_PER_MS = 705_600;

export type Rational = { readonly num: number; readonly den: number };

function assertSafe(n: number, what: string): number {
  if (!Number.isSafeInteger(n)) {
    throw new RangeError(`${what} is not a safe integer: ${String(n)}`);
  }
  return n;
}

function assertPositive(n: number, what: string): number {
  assertSafe(n, what);
  if (n <= 0) throw new RangeError(`${what} must be positive: ${String(n)}`);
  return n;
}

/** Exact floor division and non-negative remainder for safe integers, with d > 0. */
export function divmod(n: number, d: number): { q: number; r: number } {
  assertSafe(n, "n");
  assertPositive(d, "d");
  // n % d is exact in IEEE 754, so n - n % d is an exact multiple of d and the division is exact.
  let r = n % d;
  let q = (n - r) / d;
  if (r < 0) {
    q -= 1;
    r += d;
  }
  return { q, r };
}

/**
 * The one rounding rule (L6): n/d rounded to nearest, an exact half rounding up (towards +infinity),
 * equal to floor((2n + d) / 2d) but computed from quotient and remainder so nothing overflows.
 */
export function roundHalfUp(n: number, d: number): number {
  const { q, r } = divmod(n, d);
  // 2r >= d without computing 2r: r < d, so d - r is safe.
  return r >= d - r ? q + 1 : q;
}

/** ceil(n/d) from the integer quotient and remainder, never from a floating quotient. */
export function ceilDiv(n: number, d: number): number {
  const { q, r } = divmod(n, d);
  return r > 0 ? q + 1 : q;
}

/** Flicks in one period of a rate, or undefined when the rate is not flick-exact (R1 §1.2). */
export function flicksPerPeriod(rate: Rational): number | undefined {
  const { num, den } = rate;
  if (!Number.isSafeInteger(num) || !Number.isSafeInteger(den) || num <= 0 || den <= 0) {
    return undefined;
  }
  const product = FLICKS_PER_SECOND * den;
  if (!Number.isSafeInteger(product)) return undefined;
  return product % num === 0 ? product / num : undefined;
}

export function isFlickExactRate(rate: Rational): boolean {
  return flicksPerPeriod(rate) !== undefined;
}

function periodOrThrow(rate: Rational): number {
  const p = flicksPerPeriod(rate);
  if (p === undefined) {
    throw new RangeError(`rate ${String(rate.num)}/${String(rate.den)} is not flick-exact`);
  }
  return p;
}

/** Frame n covers [n*T, (n+1)*T) (R1 §1.4). T is the frame period in flicks. */
export function frameStart(n: number, T: number): number {
  assertSafe(n, "n");
  assertPositive(T, "T");
  return assertSafe(n * T, "frame start");
}

/** The first frame at or after time t: ceil(t / T) (R1 §1.5). */
export function presentedFrame(t: number, T: number): number {
  assertPositive(T, "T");
  return ceilDiv(t, T);
}

export type FilmFrames = {
  readonly frames: number;
  readonly durationFlicks: number;
  /** Flicks added to reach the next frame boundary; the compiler reports it when above zero. */
  readonly extension: number;
};

/** A film is exactly N frames; a planned duration between boundaries is extended up (R1 §1.4). */
export function filmFrames(duration: number, T: number): FilmFrames {
  const frames = presentedFrame(duration, T);
  const durationFlicks = frameStart(frames, T);
  return { frames, durationFlicks, extension: durationFlicks - duration };
}

/** Samples at the nearest sample (half up) for an absolute time in flicks (R1 §1.4, §1.5). */
export function flicksToSamples(flicks: number, sampleRate: Rational): number {
  return roundHalfUp(flicks, periodOrThrow(sampleRate));
}

/** Audio sample count of an N-frame film: round(N*T / flicks per sample), from the absolute end time. */
export function audioSamples(N: number, T: number, sampleRate: Rational): number {
  return flicksToSamples(frameStart(N, T), sampleRate);
}

export function msToFlicks(ms: number): number {
  assertSafe(ms, "ms");
  return assertSafe(ms * FLICKS_PER_MS, "flicks");
}

function gcd(a: number, b: number): number {
  let x = a;
  let y = b;
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x;
}

/**
 * Imported media timestamps to flicks, rounded to nearest, half up (R1 §1.7).
 * Divides both numbers by their gcd first and splits ticks into quotient and remainder,
 * so an hour at 15,360 per second never passes 2^53 on the way.
 */
export function mediaTicksToFlicks(ticks: number, timescale: number): Result<number> {
  if (!Number.isSafeInteger(ticks) || !Number.isSafeInteger(timescale) || timescale <= 0) {
    return fail({
      code: "VALUE_OUT_OF_RANGE",
      path: "timescale",
      expected: "safe integers, timescale > 0",
      got: { ticks, timescale },
    });
  }
  const g = gcd(FLICKS_PER_SECOND, timescale);
  const a = FLICKS_PER_SECOND / g;
  const b = timescale / g;
  const { q, r } = divmod(ticks, b);
  const whole = q * a;
  const total = whole + roundHalfUp(r * a, b);
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(total)) {
    return fail({
      code: "VALUE_OUT_OF_RANGE",
      path: "ticks",
      expected: "a result below 2^53 flicks",
      got: ticks,
    });
  }
  return ok(total);
}

const TIME_LITERAL = /^([+-]?)(\d+)(?:\.(\d+))?(ms|s)$/;

function badLiteral(text: string): Result<number> {
  return fail({
    code: "BAD_TIME_LITERAL",
    path: "",
    expected: ["650ms", "5.15s"],
    got: text,
  });
}

/** Parses `650ms` or `5.15s` as decimal text, never through floating point (R1 §1.3). */
export function parseTime(text: string): Result<number> {
  const m = TIME_LITERAL.exec(text);
  if (m === null) return badLiteral(text);
  const sign = m[1] === "-" ? -1 : 1;
  const intDigits = m[2] ?? "";
  const fracDigits = m[3] ?? "";
  const scale = m[4] === "ms" ? FLICKS_PER_MS : FLICKS_PER_SECOND;
  const digits = Number(intDigits + fracDigits);
  const denominator = 10 ** fracDigits.length;
  const numerator = sign * digits * scale;
  if (
    !Number.isSafeInteger(digits) ||
    !Number.isSafeInteger(denominator) ||
    !Number.isSafeInteger(numerator)
  ) {
    return fail({
      code: "VALUE_OUT_OF_RANGE",
      path: "",
      expected: "a time below 2^53 flicks",
      got: text,
    });
  }
  return ok(roundHalfUp(numerator, denominator));
}

/**
 * Display form of a time: `650ms` below one second, otherwise decimal seconds (`5.15s`).
 * Whole milliseconds round-trip exactly through parseTime; any other value is shown rounded
 * to the nearest millisecond, half up.
 */
export function formatTime(flicks: number): string {
  assertSafe(flicks, "flicks");
  const ms = roundHalfUp(flicks, FLICKS_PER_MS);
  const sign = ms < 0 ? "-" : "";
  const abs = Math.abs(ms);
  if (abs < 1000) return `${sign}${String(abs)}ms`;
  const whole = Math.floor(abs / 1000);
  const frac = String(abs % 1000)
    .padStart(3, "0")
    .replace(/0+$/, "");
  return `${sign}${String(whole)}${frac === "" ? "" : `.${frac}`}s`;
}
