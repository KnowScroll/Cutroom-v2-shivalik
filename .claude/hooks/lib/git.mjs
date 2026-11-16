// Design: impl/00 §9 (guard hook), lld/11 U30, L21. What the hook refuses in `git` and `gh` calls.
import { isEnvName, normPath } from "./shell.mjs";

const refuse = (rule, why) => ({ rule, why });
const ARCHIVE = "cutroom-v3.1-full-system-architecture";
const GLOBAL_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--super-prefix", "--config-env"]);
const PUSH_WITH_VALUE = new Set(["--repo", "-o", "--push-option", "--receive-pack", "--exec"]);

// `a` is the token list after the word `git`.
export function analyzeGit(a) {
  let i = 0;
  while (i < a.length && a[i].startsWith("-")) {
    const name = a[i].split("=")[0];
    if (name === "-c" && /^alias\./i.test(a[i + 1] ?? "")) return refuse("git-alias", "git -c alias.* could hide a refused subcommand");
    if (GLOBAL_WITH_VALUE.has(a[i]) && !a[i].includes("=")) i++;
    i++;
  }
  const sub = (a[i] ?? "").toLowerCase();
  const rest = a.slice(i + 1);
  if (sub === "push") return analyzePush(rest);
  if (sub === "clean") return analyzeClean(rest);
  if (sub === "add" || sub === "update-index") return analyzeAdd(rest);
  return null;
}

function analyzeClean(rest) {
  for (const t of rest) {
    if (t === "--") break;
    if (t.startsWith("-") && !t.startsWith("--") && /[xX]/.test(t)) return refuse("git-clean-x", "git clean -x/-X would delete ignored files such as .env");
  }
  return null;
}

function protectedPath(p) {
  const n = normPath(p);
  const base = n.split("/").pop();
  return isEnvName(base) || n.includes(ARCHIVE) || /(^|\/)docs\/archive(\/|$)/.test(n);
}

function analyzeAdd(rest) {
  let force = false;
  let broad = false;
  const paths = [];
  let afterDashes = false;
  for (const t of rest) {
    if (!afterDashes && t === "--") afterDashes = true;
    else if (!afterDashes && t.startsWith("--")) {
      if (t === "--force") force = true;
      if (t === "--all") broad = true;
    } else if (!afterDashes && t.startsWith("-") && t.length > 1) {
      if (t.includes("f")) force = true;
      if (t.includes("A")) broad = true;
    } else paths.push(t);
  }
  if (paths.some(protectedPath)) return refuse("git-add-protected", "adding .env or the v3.1 archive to Git is refused");
  if (force && (broad || paths.some((p) => [".", "..", "./", "*", ":/", ":/.", "docs", "docs/"].includes(p) || p === "" )))
    return refuse("git-add-protected", "git add --force over a whole folder could add .env or the v3.1 archive");
  if (force && paths.length === 0) return refuse("git-add-protected", "git add --force without explicit paths is refused");
  return null;
}

const normRef = (s) => s.toLowerCase().replace(/^refs\//, "").replace(/^heads\//, "");

function analyzePush(rest) {
  let force = false;
  let all = false;
  let tags = false;
  const pos = [];
  for (let i = 0; i < rest.length; i++) {
    const t = rest[i];
    if (t === "--") {
      pos.push(...rest.slice(i + 1));
      break;
    }
    if (t.startsWith("--")) {
      const name = t.split("=")[0];
      if (["--force", "--force-with-lease", "--force-if-includes"].includes(name)) force = true;
      if (["--all", "--mirror", "--prune"].includes(name)) all = true;
      if (name === "--tags") tags = true;
      if (PUSH_WITH_VALUE.has(name) && !t.includes("=")) i++;
    } else if (t.startsWith("-") && t.length > 1) {
      if (t.includes("f")) force = true;
      if (/o$/.test(t)) i++;
    } else pos.push(t);
  }
  if (force) return refuse("force-push", "force pushes are never allowed");
  if (all) return refuse("push-to-main", "--all, --mirror and --prune would update or delete main");
  const refspecs = pos.slice(1);
  if (refspecs.length === 0) {
    if (tags) return null;
    return refuse("push-to-main", "a push without an explicit refspec pushes main when main is checked out; name the branch");
  }
  for (const spec of refspecs) {
    if (spec.startsWith("+")) return refuse("force-push", "a + refspec is a force push");
    if (spec.includes("*")) return refuse("push-to-main", "a wildcard refspec could update main");
    const dst = spec.includes(":") ? spec.slice(spec.indexOf(":") + 1) : spec;
    if (["main", "head", "@"].includes(normRef(dst))) return refuse("push-to-main", "this push updates or deletes main (or HEAD, which is main on main)");
  }
  return null;
}

// `a` is the token list after the word `gh`.
export function analyzeGh(a) {
  const apiAt = a.findIndex((t) => t.toLowerCase() === "api");
  if (apiAt < 0) return null;
  const args = a.slice(apiAt + 1);
  let method = "";
  let fields = false;
  for (let i = 0; i < args.length; i++) {
    const t = args[i];
    if (t === "-X" || t === "--method") method = (args[i + 1] ?? "").toUpperCase();
    else if (/^(-X|--method=)/.test(t)) method = t.replace(/^(-X|--method=)/, "").toUpperCase();
    if (/^(-f|-F|--field|--raw-field|--input)/.test(t)) fields = true;
  }
  const writes = method ? method !== "GET" : fields;
  if (writes && /(^|[^a-z0-9_-])main($|[^a-z0-9_-])/i.test(args.join(" ")))
    return refuse("gh-api-main", "a gh api write that names main could update or delete it");
  return null;
}
