// Design: impl/02 §9 (env:check fails with the entry, the expected and the actual value)
// Compares a pins object with a measured one of the same shape. Returns one mismatch per difference:
// { entry, expected, actual }, the entry being a dotted path such as "node.binary_sha256" or
// "fonts.files[NotoSans-Regular.ttf].sha256".

/** Entries that are recorded for diagnosis or as provenance and never compared. */
const NOT_COMPARED = [
  /^os\.kernel$/, // a Windows update can change the WSL kernel (impl/02 §9)
  /\.source$/,
  /\.licence$/,
  /\.licence_source$/,
];

const KEYED_LISTS = { "chrome.libraries": "package", "fonts.files": "file" };

const skipped = (entry) => NOT_COMPARED.some((pattern) => pattern.test(entry));

export function comparePins(expected, actual, entry = "") {
  const mismatches = [];
  if (skipped(entry)) return mismatches;
  if (Array.isArray(expected) || Array.isArray(actual)) {
    const key = KEYED_LISTS[entry];
    if (!key || !Array.isArray(expected) || !Array.isArray(actual)) {
      return [{ entry, expected, actual }];
    }
    const e = new Map(expected.map((x) => [x[key], x]));
    const a = new Map(actual.map((x) => [x[key], x]));
    for (const name of new Set([...e.keys(), ...a.keys()])) {
      const path = `${entry}[${name}]`;
      if (!a.has(name)) mismatches.push({ entry: path, expected: "present", actual: "absent" });
      else if (!e.has(name)) mismatches.push({ entry: path, expected: "absent", actual: "present" });
      else mismatches.push(...comparePins(e.get(name), a.get(name), path));
    }
    return mismatches;
  }
  if (expected !== null && typeof expected === "object") {
    if (actual === null || typeof actual !== "object") return [{ entry, expected: "an object", actual }];
    for (const k of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
      const path = entry ? `${entry}.${k}` : k;
      if (!(k in actual)) {
        if (!skipped(path)) mismatches.push({ entry: path, expected: expected[k], actual: "absent" });
      } else if (!(k in expected)) {
        if (!skipped(path)) mismatches.push({ entry: path, expected: "absent", actual: actual[k] });
      } else mismatches.push(...comparePins(expected[k], actual[k], path));
    }
    return mismatches;
  }
  if (expected !== actual) mismatches.push({ entry, expected, actual });
  return mismatches;
}

export function formatMismatch({ entry, expected, actual }) {
  const show = (v) => (typeof v === "string" ? v : JSON.stringify(v));
  return `${entry}: expected ${show(expected)}, got ${show(actual)}`;
}
