// Design: lld/02 §5, lld/10 (Diagnostic {code, path, expected?, got?, candidates?} and Result<T>)
import { z } from "zod";

export const DiagnosticSchema = z.strictObject({
  code: z.string().min(1),
  path: z.string(),
  expected: z.unknown().optional(),
  got: z.unknown().optional(),
  candidates: z.array(z.string()).optional(),
});
export type Diagnostic = z.infer<typeof DiagnosticSchema>;

/** A failure the design names is a value, not an exception (conventions §5). */
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T = never>(...diagnostics: Diagnostic[]): Result<T> {
  return { ok: false, diagnostics };
}
