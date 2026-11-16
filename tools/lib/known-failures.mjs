// Design: testing §8 rule 5 (known failures are registered, not skipped); U32
// Judges test results against tests/known-failures.ts. A pure function, so it is unit tested.
//
// A result is { id, file, status: "pass" | "fail", message } with id = "<file>::<name > subname>".
// A registry entry is { test, reason, issue, workPackage, matches } where `test` is the id and `matches`
// is a substring the failure's message or code must contain, so only the expected failure is excused.
//
// Rules: an unlisted failure fails the run; a listed test failing with another message fails the run;
// a listed test that passes fails the run until its entry is removed; an entry whose file ran but whose
// test did not appear fails the run (it would otherwise rot).

/** Entries are well-formed or the run fails before any test is judged. */
export function validateRegistry(registry) {
  const problems = [];
  const seen = new Set();
  for (const [i, entry] of registry.entries()) {
    const where = `entry ${i}${entry?.test ? ` (${entry.test})` : ""}`;
    for (const key of ["test", "reason", "workPackage", "matches"]) {
      if (typeof entry?.[key] !== "string" || entry[key].trim() === "")
        problems.push(`${where}: '${key}' must be a non-empty string`);
    }
    if (!Number.isInteger(entry?.issue) || entry.issue <= 0)
      problems.push(`${where}: 'issue' must be a positive issue number`);
    if (seen.has(entry?.test)) problems.push(`${where}: listed twice`);
    seen.add(entry?.test);
  }
  return problems;
}

export function evaluate(results, registry, ranFiles) {
  const failures = [];
  const byId = new Map(registry.map((entry) => [entry.test, entry]));
  const counts = { passed: 0, failed: 0, knownFailing: 0 };
  const seenIds = new Set();

  for (const result of results) {
    seenIds.add(result.id);
    const entry = byId.get(result.id);
    if (result.status === "pass") {
      if (entry) {
        counts.failed++;
        failures.push(
          `${result.id}: listed in tests/known-failures.ts (issue #${entry.issue}) but it passes; remove the entry`,
        );
      } else counts.passed++;
      continue;
    }
    if (!entry) {
      counts.failed++;
      failures.push(`${result.id}: failed and is not in tests/known-failures.ts\n${indent(result.message)}`);
    } else if (!(result.message ?? "").includes(entry.matches)) {
      counts.failed++;
      failures.push(
        `${result.id}: listed (issue #${entry.issue}) but failed with another reason; expected the failure to contain '${entry.matches}'\n${indent(result.message)}`,
      );
    } else counts.knownFailing++;
  }

  for (const entry of registry) {
    const file = entry.test.split("::")[0];
    if (ranFiles.includes(file) && !seenIds.has(entry.test)) {
      counts.failed++;
      failures.push(
        `${entry.test}: listed in tests/known-failures.ts (issue #${entry.issue}) but no such test ran`,
      );
    }
  }
  return { failures, counts };
}

function indent(text) {
  return String(text ?? "")
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
}
