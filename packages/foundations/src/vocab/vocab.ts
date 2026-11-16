// Design: lld/02 §4.1, §4.3, §5 (shared enumerations, location, coverage and content lists)
import { z } from "zod";

export const COMMITMENT_STATES = ["exploring", "provisional", "frozen", "superseded", "withdrawn"] as const;
export const CommitmentStateSchema = z.enum(COMMITMENT_STATES);
export type CommitmentState = z.infer<typeof CommitmentStateSchema>;

// `unknown_outcome` is a job state and never a failure class (R1 §4.3).
export const JOB_STATES = [
  "declared",
  "waiting",
  "ready",
  "running",
  "partial",
  "succeeded",
  "failed",
  "cancelled",
  "superseded",
  "unknown_outcome",
] as const;
export const JobStateSchema = z.enum(JOB_STATES);
export type JobState = z.infer<typeof JobStateSchema>;

export const FAILURE_CLASSES = ["transient", "deterministic", "capability", "creative", "policy"] as const;
export const FailureClassSchema = z.enum(FAILURE_CLASSES);
export type FailureClass = z.infer<typeof FailureClassSchema>;

export const VERDICTS = ["PASS", "FAIL", "UNKNOWN", "NOT_APPLICABLE"] as const;
export const VerdictSchema = z.enum(VERDICTS);
export type Verdict = z.infer<typeof VerdictSchema>;

export const CHECK_TYPES = ["observational", "corrective", "hard"] as const;
export const CheckTypeSchema = z.enum(CHECK_TYPES);
export type CheckType = z.infer<typeof CheckTypeSchema>;

export const SEVERITIES = ["blocking", "material", "minor", "note"] as const;
export const SeveritySchema = z.enum(SEVERITIES);
export type Severity = z.infer<typeof SeveritySchema>;

const Flicks = z.number().int().safe();

/** Half-open or closed is the user's choice per check; the vocabulary only fixes start <= end. */
export const IntervalSchema = z
  .strictObject({ start: Flicks, end: Flicks })
  .refine((i) => i.start <= i.end, { message: "start must not exceed end" });
export type Interval = z.infer<typeof IntervalSchema>;

export const RationalSchema = z.strictObject({
  num: z.number().int().safe().positive(),
  den: z.number().int().safe().positive(),
});

// Design units are the project's own coordinate space; R1 §5 gives no more than "a region".
export const RegionSchema = z.strictObject({
  x: z.number().finite(),
  y: z.number().finite(),
  w: z.number().finite().nonnegative(),
  h: z.number().finite().nonnegative(),
});
export type Region = z.infer<typeof RegionSchema>;

// sha256 pointer to bytes with media type and size (R1 §3); M0-03 owns the full ArtifactRef helpers.
export const Sha256TextSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/);
export const ArtifactPointerSchema = z.strictObject({
  hash: Sha256TextSchema,
  media_type: z.string().min(1),
  size: z.number().int().safe().nonnegative(),
});

export const SourceLocationSchema = z.union([
  z.strictObject({ file: z.string().min(1), line: z.number().int().positive() }),
  z.strictObject({ tree_path: z.string().min(1) }),
]);
export type SourceLocation = z.infer<typeof SourceLocationSchema>;

export const LocationSchema = z.strictObject({
  entities: z.array(z.string()).optional(),
  revision: z.string().optional(),
  interval: IntervalSchema.optional(),
  region: RegionSchema.optional(),
  artifact: ArtifactPointerSchema.optional(),
  source: SourceLocationSchema.optional(),
});
export type Location = z.infer<typeof LocationSchema>;

export const COVERAGE_VIEWS = ["isolated_layer", "full_composite"] as const;
export const CoverageRecordSchema = z.strictObject({
  intervals: z.array(IntervalSchema),
  sampled_frames: z.array(z.number().int().nonnegative()).optional(),
  sampling_rate: RationalSchema.optional(),
  audio_intervals: z.array(IntervalSchema),
  view: z.enum(COVERAGE_VIEWS),
  resolution: z.strictObject({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  coverage_fraction: z.number().min(0).max(1),
});
export type CoverageRecord = z.infer<typeof CoverageRecordSchema>;

// Observed facts, hypotheses with a confidence, and suggestions stay in three separate lists (R1 §5).
export const ObservedFactSchema = z.strictObject({ text: z.string().min(1) });
export const HypothesisSchema = z.strictObject({
  text: z.string().min(1),
  confidence: z.number().min(0).max(1),
});
export const SuggestionSchema = z.strictObject({ text: z.string().min(1) });
export const EvidenceContentSchema = z.strictObject({
  observed: z.array(ObservedFactSchema),
  hypotheses: z.array(HypothesisSchema),
  suggestions: z.array(SuggestionSchema),
});
export type EvidenceContent = z.infer<typeof EvidenceContentSchema>;
