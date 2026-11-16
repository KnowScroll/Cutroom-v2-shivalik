// Design: impl/01 §2 (packages, allowed edges); M0-01b "the edge check"
// Checks, against tools/dependency-edges.json: every import, every package.json dependency and every
// tsconfig reference of each package is an allowed edge (and the three match the table exactly), and
// nothing reaches past another package's entry point (no deep import by name or by relative path).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { lineOf, listFiles, rel } from "../lib/files.mjs";

const CODE_EXTS = [".ts", ".mts", ".tsx", ".js", ".mjs", ".cjs"];
const STATIC_IMPORT =
  /^[ \t]*(?:import|export)\b[^'";]*?\bfrom\s*(['"])([^'"\n]+)\1|^[ \t]*import\s*(['"])([^'"\n]+)\3/gm;
const DYNAMIC_IMPORT = /(?:\bimport\s*\(|\brequire\s*\()\s*(['"])([^'"\n]+)\1/g;

/** Finds import specifiers in source text: { specifier, line }. */
export function findImports(text) {
  const found = [];
  for (const match of text.matchAll(STATIC_IMPORT)) {
    found.push({ specifier: match[2] ?? match[4], line: lineOf(text, match.index) });
  }
  for (const match of text.matchAll(DYNAMIC_IMPORT)) {
    const lineStart = text.lastIndexOf("\n", match.index) + 1;
    const prefix = text.slice(lineStart, match.index).trimStart();
    if (prefix.startsWith("//") || prefix.startsWith("*")) continue;
    found.push({ specifier: match[2], line: lineOf(text, match.index) });
  }
  return found;
}

/** Cycles in the edge table (impl/01 §2: no import cycles between packages), each as a path a -> ... -> a. */
export function findCycles(table) {
  const cycles = [];
  const state = new Map(); // 1 = on the stack, 2 = done
  const stack = [];
  const visit = (name) => {
    if (state.get(name) === 2) return;
    if (state.get(name) === 1) {
      cycles.push([...stack.slice(stack.indexOf(name)), name]);
      return;
    }
    state.set(name, 1);
    stack.push(name);
    for (const next of table[name] ?? []) visit(next);
    stack.pop();
    state.set(name, 2);
  };
  for (const name of Object.keys(table)) visit(name);
  return cycles;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function packageNameOfPath(root, file) {
  const parts = relative(join(root, "packages"), file).split(sep);
  return parts[0] && !parts[0].startsWith("..") ? parts[0] : null;
}

/**
 * @param {string} root workspace root (holds tools/dependency-edges.json and packages/)
 * @returns {{file: string, line: number, message: string}[]} violations, empty when the workspace is clean
 */
export function checkEdges(root) {
  const violations = [];
  const add = (file, line, message) => violations.push({ file: rel(root, file), line, message });
  const table = readJson(join(root, "tools", "dependency-edges.json")).packages;
  const names = Object.keys(table);
  for (const cycle of findCycles(table)) {
    add(join(root, "tools", "dependency-edges.json"), 1, `the edge table has a cycle: ${cycle.join(" -> ")}`);
  }
  const rootPkg = existsSync(join(root, "package.json")) ? readJson(join(root, "package.json")) : {};
  const rootDeps = new Set(Object.keys({ ...rootPkg.dependencies, ...rootPkg.devDependencies }));

  const packagesDir = join(root, "packages");
  const onDisk = existsSync(packagesDir)
    ? readdirSync(packagesDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
    : [];
  for (const name of onDisk) {
    if (!names.includes(name))
      add(join(packagesDir, name), 1, `package '${name}' is not in tools/dependency-edges.json`);
  }

  for (const name of names) {
    const dir = join(packagesDir, name);
    const pkgPath = join(dir, "package.json");
    if (!existsSync(pkgPath)) {
      add(pkgPath, 1, `package '${name}' has no package.json`);
      continue;
    }
    const allowed = new Set(table[name]);
    const pkgText = readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(pkgText);
    const declared = new Set();
    for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      for (const dep of Object.keys(pkg[field] ?? {})) {
        if (!dep.startsWith("@cutroom/")) continue;
        const target = dep.slice("@cutroom/".length);
        declared.add(target);
        if (!allowed.has(target)) {
          add(
            pkgPath,
            lineOf(pkgText, pkgText.indexOf(`"${dep}"`)),
            `${name} depends on ${dep}, which is not an allowed edge`,
          );
        }
      }
    }
    for (const target of allowed) {
      if (!declared.has(target))
        add(pkgPath, 1, `${name} does not declare its allowed dependency @cutroom/${target}`);
    }

    const tsPath = join(dir, "tsconfig.json");
    if (existsSync(tsPath)) {
      const tsText = readFileSync(tsPath, "utf8");
      const refs = new Set();
      for (const ref of JSON.parse(tsText).references ?? []) {
        const target = resolve(dir, ref.path).split(sep).pop();
        refs.add(target);
        if (!allowed.has(target)) {
          add(
            tsPath,
            lineOf(tsText, tsText.indexOf(ref.path)),
            `${name} references ${target}, which is not an allowed edge`,
          );
        }
      }
      for (const target of allowed) {
        if (!refs.has(target))
          add(tsPath, 1, `${name}'s tsconfig does not reference its allowed dependency ${target}`);
      }
    } else {
      add(tsPath, 1, `package '${name}' has no tsconfig.json`);
    }
  }

  const scanDirs = [packagesDir, join(root, "tests"), join(root, "tools")].filter(existsSync);
  for (const scanDir of scanDirs) {
    for (const file of listFiles(scanDir, { exts: CODE_EXTS, skipFixtures: true })) {
      const owner = packageNameOfPath(root, file);
      const ownAllowed = owner ? new Set(table[owner] ?? []) : null;
      const ownPkg =
        owner && existsSync(join(packagesDir, owner, "package.json"))
          ? readJson(join(packagesDir, owner, "package.json"))
          : {};
      const ownDeps = new Set(
        Object.keys({ ...ownPkg.dependencies, ...ownPkg.devDependencies, ...ownPkg.peerDependencies }),
      );
      const text = readFileSync(file, "utf8");
      for (const { specifier, line } of findImports(text)) {
        if (specifier.startsWith("node:")) continue;
        if (specifier.startsWith(".") || isAbsolute(specifier)) {
          const target = resolve(dirname(file), specifier);
          const targetPkg = packageNameOfPath(root, target);
          if (targetPkg && targetPkg !== owner) {
            add(
              file,
              line,
              `deep import '${specifier}' reaches into package '${targetPkg}'; import '@cutroom/${targetPkg}' instead`,
            );
          }
          continue;
        }
        const scoped = specifier.startsWith("@cutroom/");
        if (scoped) {
          const rest = specifier.slice("@cutroom/".length).split("/");
          const target = rest[0];
          if (rest.length > 1) {
            add(file, line, `deep import '${specifier}' reaches past the entry point of '${target}'`);
            continue;
          }
          if (!names.includes(target)) {
            add(file, line, `import of unknown package '${specifier}'`);
          } else if (owner && target !== owner && !ownAllowed.has(target)) {
            add(file, line, `forbidden import: ${owner} may not import @cutroom/${target}`);
          }
          continue;
        }
        const base = specifier.startsWith("@")
          ? specifier.split("/").slice(0, 2).join("/")
          : specifier.split("/")[0];
        if (owner) {
          if (!ownDeps.has(base) && !rootDeps.has(base))
            add(file, line, `undeclared dependency: ${base} is in no package.json`);
        } else if (!rootDeps.has(base) && base !== "") {
          add(file, line, `undeclared dependency: ${base} is not in the root package.json`);
        }
      }
    }
  }
  return violations;
}
