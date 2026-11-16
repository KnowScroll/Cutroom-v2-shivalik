// Design: conventions §3 (versions recorded in docs/impl/DEPENDENCIES.md); M0-01b "matches package-lock.json"
// Every dependency any package.json declares must be pinned exactly (no ^, ~ or range), must have a row
// in docs/impl/DEPENDENCIES.md, and that row's version must be the one package-lock.json holds. Workspace
// packages (@cutroom/*) are not third-party dependencies and are not listed.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { lineOf, rel } from "../lib/files.mjs";

const ROW = /^\|\s*`([^`]+)`\s*\|\s*([^|\s]+)\s*\|/gm;

export function readDependencyTable(text) {
  const rows = new Map();
  for (const m of text.matchAll(ROW)) rows.set(m[1], { version: m[2], line: lineOf(text, m.index) });
  return rows;
}

export function checkDependencies(root) {
  const violations = [];
  const docPath = join(root, "docs", "impl", "DEPENDENCIES.md");
  const lockPath = join(root, "package-lock.json");
  if (!existsSync(docPath))
    return [{ file: rel(root, docPath), line: 1, message: "docs/impl/DEPENDENCIES.md is missing" }];
  const docText = readFileSync(docPath, "utf8");
  const table = readDependencyTable(docText);
  const lock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, "utf8")) : { packages: {} };

  const manifests = [join(root, "package.json")];
  const packagesDir = join(root, "packages");
  if (existsSync(packagesDir)) {
    for (const e of readdirSync(packagesDir, { withFileTypes: true })) {
      if (e.isDirectory() && existsSync(join(packagesDir, e.name, "package.json")))
        manifests.push(join(packagesDir, e.name, "package.json"));
    }
  }

  const declared = new Map(); // name -> where
  for (const path of manifests) {
    const text = readFileSync(path, "utf8");
    const pkg = JSON.parse(text);
    for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
      for (const [name, version] of Object.entries(pkg[field] ?? {})) {
        if (name.startsWith("@cutroom/")) continue;
        declared.set(name, rel(root, path));
        const line = lineOf(text, text.indexOf(`"${name}"`));
        if (!/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(version)) {
          violations.push({
            file: rel(root, path),
            line,
            message: `${name} is not pinned exactly ('${version}')`,
          });
        }
        if (!table.has(name))
          violations.push({
            file: rel(root, path),
            line,
            message: `${name} has no row in docs/impl/DEPENDENCIES.md`,
          });
      }
    }
  }
  for (const [name, { version, line }] of table) {
    const locked = lock.packages?.[`node_modules/${name}`]?.version;
    if (!declared.has(name))
      violations.push({
        file: "docs/impl/DEPENDENCIES.md",
        line,
        message: `${name} is listed but no package.json declares it`,
      });
    else if (locked !== version) {
      violations.push({
        file: "docs/impl/DEPENDENCIES.md",
        line,
        message: `${name}: the table says ${version}, package-lock.json holds ${locked ?? "nothing"}`,
      });
    }
  }
  return violations;
}
