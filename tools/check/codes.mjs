// Design: testing §8 rule 4 (every diagnostic code has a test that produces it)
// Each package lists its codes in `src/**/codes.ts` as exported arrays whose names end in CODES, for
// example `export const CODES = ["SPACE_MOUNT_REFUSED"] as const;`. A code that appears as a quoted
// string in no test file fails the check. Test files are `*.test.ts` and `*.test.mjs` under
// packages/*/test, packages/*/src and tests/.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { lineOf, listFiles, rel } from "../lib/files.mjs";

const CODES_DECL = /export\s+const\s+([A-Za-z0-9_]*CODES)\b[^=]*=\s*\[([\s\S]*?)\]/g;
const STRING_LITERAL = /(['"`])([^'"`\n]+)\1/g;

/** Reads the codes a codes.ts file declares: [{ name, code, line }]. */
export function readCodes(text) {
  const out = [];
  for (const decl of text.matchAll(CODES_DECL)) {
    const bodyStart = decl.index + decl[0].indexOf("[") + 1;
    const body = decl[2].replace(/\/\/.*$/gm, (m) => " ".repeat(m.length));
    for (const lit of body.matchAll(STRING_LITERAL)) {
      out.push({ name: decl[1], code: lit[2], line: lineOf(text, bodyStart + lit.index) });
    }
  }
  return out;
}

export function checkCodes(root) {
  const violations = [];
  const packagesDir = join(root, "packages");
  const testFiles = [];
  for (const dir of [packagesDir, join(root, "tests")]) {
    if (!existsSync(dir)) continue;
    for (const file of listFiles(dir, { exts: [".test.ts", ".test.mts", ".test.mjs"] })) testFiles.push(file);
  }
  const testText = testFiles.map((f) => readFileSync(f, "utf8")).join("\n");

  const packages = existsSync(packagesDir)
    ? readdirSync(packagesDir, { withFileTypes: true }).filter((e) => e.isDirectory())
    : [];
  for (const pkg of packages) {
    const srcDir = join(packagesDir, pkg.name, "src");
    if (!existsSync(srcDir)) continue;
    for (const file of listFiles(srcDir, { exts: ["codes.ts"] })) {
      const text = readFileSync(file, "utf8");
      for (const { code, line } of readCodes(text)) {
        const asserted = ["'", '"', "`"].some((q) => testText.includes(`${q}${code}${q}`));
        if (!asserted) {
          violations.push({ file: rel(root, file), line, message: `code ${code} is asserted by no test` });
        }
      }
    }
  }
  return violations;
}
