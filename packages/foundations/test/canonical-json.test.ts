import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import {
  CanonicalJsonError,
  canonicalJson,
  hashCanonical,
  parseArtifactRef,
  revisionId,
  sha256Hex,
  workKey,
} from "../src/index.js";

function findVectors(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    const p = join(dir, "tests", "fixtures", "rfc8785", "vectors.json");
    if (existsSync(p)) return p;
    dir = dirname(dir);
  }
  throw new Error("tests/fixtures/rfc8785/vectors.json not found");
}
interface Vectors {
  appendixB: { rows: { ieee: string; expected: string | null }[] };
  section3_2_2: { inputJsonText: string; expectedCanonicalText: string; expectedBytes: number };
  section3_2_3: {
    inputKeys: { key: string; label: string }[];
    expectedOrderLabels: string[];
  };
}
const vectors = JSON.parse(readFileSync(findVectors(), "utf8")) as Vectors;

function doubleFromHex(hex: string): number {
  const buf = Buffer.from(hex, "hex");
  return buf.readDoubleBE(0);
}

test("RFC 8785 Appendix B: 26 rows (24 exact, NaN and Infinity refused)", () => {
  assert.equal(vectors.appendixB.rows.length, 26);
  let exact = 0;
  let refused = 0;
  for (const row of vectors.appendixB.rows) {
    const n = doubleFromHex(row.ieee);
    if (row.expected === null) {
      assert.throws(() => canonicalJson(n), CanonicalJsonError, row.ieee);
      refused++;
    } else {
      assert.equal(canonicalJson(n), row.expected, row.ieee);
      exact++;
    }
  }
  assert.equal(exact, 24);
  assert.equal(refused, 2);
});

test("RFC 8785 section 3.2.3: keys sort by UTF-16 code units", () => {
  const obj: Record<string, number> = {};
  vectors.section3_2_3.inputKeys.forEach((k, i) => {
    obj[k.key] = i;
  });
  // Order is read from the text: a JS object would reorder the integer-like key "1" itself.
  const text = canonicalJson(obj);
  const order = vectors.section3_2_3.inputKeys
    .map((k) => ({
      label: k.label,
      at: text.indexOf(JSON.stringify(k.key).slice(0, -1) + (k.key === "1" ? '":' : "")),
    }))
    .sort((x, y) => x.at - y.at)
    .map((x) => x.label);
  assert.deepEqual(order, vectors.section3_2_3.expectedOrderLabels);
  // The emoji (surrogate pair D83D) must sort before U+FB33: code-point order would put it last.
  assert.ok(text.indexOf("\u{1F600}") < text.indexOf("דּ"));
});

test("RFC 8785 section 3.2.2 sample gives section 3.2.4 text, 118 bytes", () => {
  const v = vectors.section3_2_2;
  const text = canonicalJson(JSON.parse(v.inputJsonText));
  assert.equal(text, v.expectedCanonicalText);
  assert.equal(Buffer.byteLength(text, "utf8"), 118);
  assert.equal(v.expectedBytes, 118);
});

const keyArb = fc.oneof(
  fc.string({ unit: "binary" }).filter((s) => s.isWellFormed()),
  fc.constantFrom("€", "דּ", "\u{1F600}", "\u0080", "\r", "a", "￿", "\u{10000}", ""),
);
const numberArb = fc.oneof(
  fc.integer({ min: -(2 ** 53), max: 2 ** 53 }),
  fc.double({ noNaN: true, noDefaultInfinity: true }),
  fc.double({ min: 9e20, max: 2e21, noNaN: true }),
  fc.double({ min: 5e-8, max: 2e-7, noNaN: true }),
  fc.constant(-0),
);
const jsonArb = fc.letrec<{ v: unknown }>((tie) => ({
  v: fc.oneof(
    { maxDepth: 4 },
    fc.constant(null),
    fc.boolean(),
    numberArb,
    fc.string({ unit: "binary" }).filter((s) => s.isWellFormed()),
    fc.array(tie("v"), { maxLength: 4 }),
    fc.dictionary(keyArb, tie("v"), { maxKeys: 5 }),
  ),
})).v;

function reference(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(reference).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const keys = Object.keys(o).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${keys.map((k) => `${JSON.stringify(k)}:${reference(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

test("fast-check: 10,000 random nested objects match the UTF-16 reference and re-canonicalise identically", () => {
  fc.assert(
    fc.property(fc.dictionary(keyArb, jsonArb, { maxKeys: 6 }), (obj) => {
      const text = canonicalJson(obj);
      assert.equal(text, reference(obj));
      assert.equal(canonicalJson(JSON.parse(text)), text);
    }),
    { numRuns: 10_000 },
  );
});

test("the guard refuses what canonicalize would silently change", () => {
  assert.throws(() => canonicalJson({ a: undefined }), CanonicalJsonError);
  assert.throws(() => canonicalJson([undefined]), CanonicalJsonError);
  assert.throws(() => canonicalJson({ d: new Date(0) }), CanonicalJsonError);
  assert.throws(() => canonicalJson({ b: 1n }), CanonicalJsonError);
  assert.throws(() => canonicalJson("\ud800"), CanonicalJsonError);
  assert.throws(() => canonicalJson({ "\udc00": 1 }), CanonicalJsonError);
  assert.throws(() => canonicalJson({ n: Number.NaN }), CanonicalJsonError);
  assert.throws(() => canonicalJson({ f: () => 1 }), CanonicalJsonError);
  assert.throws(() => canonicalJson(undefined), CanonicalJsonError);
  const cyc: Record<string, unknown> = {};
  cyc.self = cyc;
  assert.throws(() => canonicalJson(cyc), CanonicalJsonError);
  assert.throws(() => canonicalJson(new Map()), CanonicalJsonError);
  // shared (non-cyclic) references are fine
  const shared = { x: 1 };
  assert.equal(canonicalJson({ a: shared, b: shared }), '{"a":{"x":1},"b":{"x":1}}');
  assert.equal(canonicalJson({ z: -0 }), '{"z":0}');
  try {
    canonicalJson({ a: [1, undefined] });
    assert.fail("expected throw");
  } catch (e) {
    assert.ok(e instanceof CanonicalJsonError);
    assert.equal(e.path, "/a/1");
  }
});

test("hashCanonical returns the hashed text with sha256: and lowercase hex", () => {
  const { text, hash } = hashCanonical({ b: 1, a: [true] });
  assert.equal(text, '{"a":[true],"b":1}');
  assert.match(hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(hash, `sha256:${sha256Hex(text)}`);
  // known SHA-256 of "abc"
  assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("ArtifactRef validator", () => {
  const good = { hash: `sha256:${"0".repeat(64)}`, media_type: "video/mp4", size: 12 };
  assert.deepEqual(parseArtifactRef(good), { ok: true, value: good });
  for (const bad of [
    { ...good, hash: "sha256:ABC" },
    { ...good, media_type: "mp4" },
    { ...good, size: -1 },
    { ...good, size: 1.5 },
    { ...good, extra: 1 },
    null,
    [],
  ]) {
    assert.equal(parseArtifactRef(bad).ok, false);
  }
});

test("workKey and revisionId", () => {
  const env = `sha256:${"1".repeat(64)}`;
  const inH = `sha256:${"2".repeat(64)}`;
  const base = {
    capability: "cap",
    capability_version: "1",
    input_hashes: { a: inH },
    parameters: { n: 1 },
    environment_hash: env,
  };
  const k = workKey(base);
  assert.match(k, /^sha256:[0-9a-f]{64}$/);
  assert.equal(workKey({ ...base, parameters: { n: 1 } }), k);
  assert.notEqual(workKey({ ...base, parameters: { n: 2 } }), k);
  assert.notEqual(workKey({ ...base, capability_version: "2" }), k);
  assert.throws(() => workKey({ ...base, environment_hash: "x" }));
  const rid = revisionId({ format: 1, parents: [] });
  assert.match(rid, /^rev_[0-9a-f]{64}$/);
  assert.equal(rid, revisionId({ parents: [], format: 1 }));
});
