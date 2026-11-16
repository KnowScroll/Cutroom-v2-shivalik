// Design: lld/06 §2.4 (Predicate and Need), lld/11 B:SD1 (declared in foundations, meaning kept by R5)
import { z } from "zod";
import { ArtifactPointerSchema, Sha256TextSchema } from "../vocab/vocab.js";

const HashSchema = Sha256TextSchema;
const EntityIdSchema = z.string().regex(/^ent_[0-9a-f-]{36}$/);
const RevIdSchema = z.string().regex(/^rev_[0-9a-f]{64}$/);

export const NeedSchema = z.union([
  z.strictObject({ kind: z.literal("complete") }),
  z.strictObject({
    kind: z.literal("range"),
    start_frame: z.number().int().safe(),
    end_frame: z.number().int().safe(),
  }),
]);
export type Need = z.infer<typeof NeedSchema>;

export type Predicate =
  | { fact: "completion"; authority: "scheduler"; work_key: string; need: Need }
  | {
      fact: "validation";
      authority: "quality";
      check: string;
      verdict: "PASS";
      subject: { result_of: string } | { artifact: z.infer<typeof ArtifactPointerSchema> };
    }
  | {
      fact: "acceptance";
      authority: "project_core";
      entity_id: string;
      revision_id: string;
    }
  | {
      fact: "commitment";
      authority: "project_core";
      entity_id: string;
      pin_hash: string;
      min_readiness: "provisional" | "frozen";
    }
  | { fact: "delivery_eligibility"; authority: "deliverable"; deliverable_id: string }
  | { all: Predicate[] }
  | { any: Predicate[] };

export const PredicateSchema: z.ZodType<Predicate> = z.lazy(() =>
  z.union([
    z.strictObject({
      fact: z.literal("completion"),
      authority: z.literal("scheduler"),
      work_key: HashSchema,
      need: NeedSchema,
    }),
    z.strictObject({
      fact: z.literal("validation"),
      authority: z.literal("quality"),
      check: z.string().min(1),
      verdict: z.literal("PASS"),
      subject: z.union([
        z.strictObject({ result_of: HashSchema }),
        z.strictObject({ artifact: ArtifactPointerSchema }),
      ]),
    }),
    z.strictObject({
      fact: z.literal("acceptance"),
      authority: z.literal("project_core"),
      entity_id: EntityIdSchema,
      revision_id: RevIdSchema,
    }),
    z.strictObject({
      fact: z.literal("commitment"),
      authority: z.literal("project_core"),
      entity_id: EntityIdSchema,
      pin_hash: HashSchema,
      min_readiness: z.enum(["provisional", "frozen"]),
    }),
    z.strictObject({
      fact: z.literal("delivery_eligibility"),
      authority: z.literal("deliverable"),
      deliverable_id: z.string().min(1),
    }),
    z.strictObject({ all: z.array(PredicateSchema) }),
    z.strictObject({ any: z.array(PredicateSchema) }),
  ]),
);
