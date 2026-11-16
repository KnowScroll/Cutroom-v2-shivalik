// Design: lld/02 §2.1, §4.1, §4.3, §5; lld/06 §2.4 (ids, vocabularies, Predicate and Need)
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CheckTypeSchema,
  COMMITMENT_STATES,
  CommitmentStateSchema,
  CoverageRecordSchema,
  DiagnosticSchema,
  EvidenceContentSchema,
  FAILURE_CLASSES,
  FailureClassSchema,
  fail,
  isEntityId,
  isHandle,
  isUuidV7,
  JOB_STATES,
  JobStateSchema,
  LocationSchema,
  NeedSchema,
  newAttemptId,
  newEntityId,
  newJobId,
  ok,
  PredicateSchema,
  SeveritySchema,
  VerdictSchema,
} from "../src/index.js";

const HASH = `sha256:${"a".repeat(64)}`;
const ENT = "ent_0192f6c0-7b1e-7abc-8def-0123456789ab";
const REV = `rev_${"b".repeat(64)}`;

test("100,000 entity IDs are unique and in generation order (b2b §8)", () => {
  const ids: string[] = [];
  for (let i = 0; i < 100_000; i++) ids.push(newEntityId());
  assert.equal(new Set(ids).size, ids.length);
  for (let i = 1; i < ids.length; i++) {
    assert.ok((ids[i] as string) > (ids[i - 1] as string), `out of order at ${i}`);
  }
  assert.ok(ids.every((id) => isEntityId(id)));
});

test("job and attempt IDs are UUIDv7 and ordered", () => {
  const a = newJobId();
  const b = newJobId();
  assert.ok(isUuidV7(a) && isUuidV7(b) && b > a);
  assert.ok(isUuidV7(newAttemptId()));
  assert.equal(isEntityId(newJobId()), false);
});

test("isEntityId accepts ent_ + UUIDv7 only", () => {
  assert.equal(isEntityId(ENT), true);
  assert.equal(isEntityId(ENT.slice(4)), false);
  assert.equal(isEntityId("ent_0192f6c0-7b1e-4abc-8def-0123456789ab"), false);
  assert.equal(isEntityId("ent_0192f6c0-7b1e-7abc-cdef-0123456789ab"), false);
  assert.equal(isEntityId(ENT.toUpperCase()), false);
  assert.equal(isEntityId(5), false);
});

test("handles: valid and invalid (R1 §2.1)", () => {
  for (const ok1 of ["presenter", "shot04.volcano", "a", "a-b_c.d9", "x".repeat(64)]) {
    assert.equal(isHandle(ok1), true, ok1);
  }
  for (const bad of ["", "Presenter", "has space", "x".repeat(65), "a/b", "é", "a:b", null, 3]) {
    assert.equal(isHandle(bad), false, String(bad));
  }
});

test("vocabularies hold exactly the R1 values; unknown_outcome is a job state, not a failure class", () => {
  assert.deepEqual([...COMMITMENT_STATES], ["exploring", "provisional", "frozen", "superseded", "withdrawn"]);
  assert.equal(JOB_STATES.length, 10);
  assert.equal(JobStateSchema.safeParse("unknown_outcome").success, true);
  assert.equal(FailureClassSchema.safeParse("unknown_outcome").success, false);
  assert.deepEqual([...FAILURE_CLASSES], ["transient", "deterministic", "capability", "creative", "policy"]);
  assert.equal(CommitmentStateSchema.safeParse("draft").success, false);
  for (const v of ["PASS", "FAIL", "UNKNOWN", "NOT_APPLICABLE"]) {
    assert.equal(VerdictSchema.safeParse(v).success, true);
  }
  assert.equal(VerdictSchema.safeParse("pass").success, false);
  for (const c of ["observational", "corrective", "hard"]) {
    assert.equal(CheckTypeSchema.safeParse(c).success, true);
  }
  for (const s of ["blocking", "material", "minor", "note"]) {
    assert.equal(SeveritySchema.safeParse(s).success, true);
  }
  assert.equal(SeveritySchema.safeParse("major").success, false);
});

test("location, coverage record and the three content lists", () => {
  assert.equal(
    LocationSchema.safeParse({
      entities: [ENT],
      revision: REV,
      interval: { start: 0, end: 10 },
      region: { x: 0, y: 0, w: 10, h: 10 },
      source: { file: "a.ts", line: 3 },
    }).success,
    true,
  );
  assert.equal(LocationSchema.safeParse({ interval: { start: 5, end: 1 } }).success, false);
  const cov = {
    intervals: [{ start: 0, end: 100 }],
    sampled_frames: [0, 10],
    audio_intervals: [],
    view: "full_composite",
    resolution: { width: 1080, height: 1920 },
    coverage_fraction: 0.25,
  };
  assert.equal(CoverageRecordSchema.safeParse(cov).success, true);
  assert.equal(CoverageRecordSchema.safeParse({ ...cov, coverage_fraction: 1.5 }).success, false);
  assert.equal(
    EvidenceContentSchema.safeParse({
      observed: [{ text: "x" }],
      hypotheses: [{ text: "y", confidence: 0.4 }],
      suggestions: [],
    }).success,
    true,
  );
  assert.equal(
    EvidenceContentSchema.safeParse({ observed: [], hypotheses: [{ text: "y" }], suggestions: [] }).success,
    false,
  );
});

test("Diagnostic and Result", () => {
  const d = { code: "UNKNOWN_ENTITY", path: "a.b", candidates: ["x"], got: 1, expected: 2 };
  assert.equal(DiagnosticSchema.safeParse(d).success, true);
  assert.equal(DiagnosticSchema.safeParse({ path: "a" }).success, false);
  assert.deepEqual(ok(3), { ok: true, value: 3 });
  assert.deepEqual(fail({ code: "X", path: "" }), { ok: false, diagnostics: [{ code: "X", path: "" }] });
});

test("Need accepts R5 §2.4 shapes and refuses an unknown kind", () => {
  assert.equal(NeedSchema.safeParse({ kind: "complete" }).success, true);
  assert.equal(NeedSchema.safeParse({ kind: "range", start_frame: 0, end_frame: 30 }).success, true);
  assert.equal(NeedSchema.safeParse({ kind: "partial" }).success, false);
  assert.equal(NeedSchema.safeParse({ kind: "range", start_frame: 0 }).success, false);
});

test("Predicate accepts every R5 §2.4 shape, nested all/any, and refuses unknown ones", () => {
  const completion = {
    fact: "completion",
    authority: "scheduler",
    work_key: HASH,
    need: { kind: "complete" },
  };
  const validation = {
    fact: "validation",
    authority: "quality",
    check: "C-03",
    verdict: "PASS",
    subject: { result_of: HASH },
  };
  const validationArtifact = {
    ...validation,
    subject: { artifact: { hash: HASH, media_type: "video/mp4", size: 10 } },
  };
  const acceptance = {
    fact: "acceptance",
    authority: "project_core",
    entity_id: ENT,
    revision_id: REV,
  };
  const commitment = {
    fact: "commitment",
    authority: "project_core",
    entity_id: ENT,
    pin_hash: HASH,
    min_readiness: "frozen",
  };
  const delivery = {
    fact: "delivery_eligibility",
    authority: "deliverable",
    deliverable_id: "main",
  };
  for (const p of [completion, validation, validationArtifact, acceptance, commitment, delivery]) {
    assert.equal(PredicateSchema.safeParse(p).success, true, JSON.stringify(p));
  }
  assert.equal(
    PredicateSchema.safeParse({ all: [completion, { any: [validation, commitment] }] }).success,
    true,
  );
  assert.equal(PredicateSchema.safeParse({ all: [] }).success, true);
  // Unknown fact, wrong authority, wrong verdict, bad readiness, free text, nested unknown.
  assert.equal(PredicateSchema.safeParse({ fact: "vibes", authority: "scheduler" }).success, false);
  assert.equal(PredicateSchema.safeParse({ ...completion, authority: "quality" }).success, false);
  assert.equal(PredicateSchema.safeParse({ ...validation, verdict: "FAIL" }).success, false);
  assert.equal(PredicateSchema.safeParse({ ...commitment, min_readiness: "exploring" }).success, false);
  assert.equal(PredicateSchema.safeParse("frozen").success, false);
  assert.equal(PredicateSchema.safeParse({ all: [{ fact: "vibes" }] }).success, false);
  assert.equal(PredicateSchema.safeParse({ ...completion, extra: 1 }).success, false);
});
