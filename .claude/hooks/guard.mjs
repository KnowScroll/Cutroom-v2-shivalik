// Design: impl/00 §9 (guard hook), lld/11 U30, L21; scanning choices in the M0-01a pull request.
// PreToolUse hook: exit 2 with a one-line reason on stderr refuses the call, exit 0 allows it.
// Fail closed: unparseable input or an internal error also exits 2.
import { writeSync } from "node:fs";
import { analyzeGh, analyzeGit } from "./lib/git.mjs";
import { cmdName, globToRegex, hasWildcard, isEnvName, literalLength, normPath, splitCommand } from "./lib/shell.mjs";

const refuse = (rule, why) => ({ rule, why });
const ARCHIVE_FILE = "cutroom-v3.1-full-system-architecture.md";
const SHELL_TOOLS = new Set(["bash", "powershell"]);
const WRAPPERS = new Set(["env", "sudo", "command", "exec", "nohup", "time", "nice", "builtin", "call", "start", "xargs", "then", "do", "else", "if", "while", "!"]);
const SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh", "fish", "pwsh", "powershell", "cmd", "eval", "wsl", "su", "ssh"]);
const ENV_SAFE_HEADS = new Set(["test", "[", "[[", "test-path", "ls", "dir", "stat", "get-item", "get-childitem"]);
const ENV_SAFE_GIT = new Set(["check-ignore", "status", "ls-files"]);

// --- text rules: whole command or one path field ---------------------------------------------

const OLD_FOLDER = /(?:^|[^a-z0-9_.-])(?:[a-z]:|\/mnt\/[a-z]|\/[a-z])\/users\/xznon\/cutroom(?=$|[/\s"'`)<>;|&,])/;
const OLD_FOLDER_RELATIVE = /(?:%userprofile%|\$home|\$env:userprofile|~|\/\.\.)\/cutroom(?=$|[/\s"'`)<>;|&,])/;

function textRules(s) {
  const n = normPath(s);
  if (OLD_FOLDER.test(n) || OLD_FOLDER_RELATIVE.test(n)) return refuse("old-folder", "a path under the older Cutroom folder is off limits (L21)");
  if (n.includes("cutroom-v3.1-full-system") || /cutroom-v3\.1.*architecture/.test(n) || /(^|[^a-z0-9._-])docs\/archive(\/|$|[^a-z0-9._-])/.test(n))
    return refuse("archive-access", "the v3.1 archive is never opened, read, searched or used");
  return null;
}

// A wildcard path part that would match the archive or its folder, with enough literal text to mean it.
function archiveWildcard(s) {
  for (const part of normPath(s).split("/")) {
    if (!hasWildcard(part) || literalLength(part) < 4) continue;
    const re = globToRegex(part);
    if (re.test(ARCHIVE_FILE) || re.test("archive")) return refuse("archive-access", "a wildcard that matches the v3.1 archive is refused");
  }
  return null;
}

function envPathRule(p) {
  return isEnvName(normPath(p).split("/").pop()) ? refuse("env-access", ".env holds the API keys and is never read, written or copied") : null;
}

// --- shell commands --------------------------------------------------------------------------

const ENV_MENTION = /(?:^|[\s"'<>=:/\\(,;|&])(\.env(?:\.[a-z0-9_.-]+)?)(?=$|[\s"'<>|;&),:])/gi;

function mentionsEnv(text) {
  for (const m of text.matchAll(ENV_MENTION)) if (m[1].toLowerCase() !== ".env.example") return true;
  return false;
}

// Index of the command word, after variable assignments and wrappers such as `env` or `sudo`.
function headOf(tokens) {
  let i = 0;
  let wrapped = false;
  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t)) i++;
    else if (WRAPPERS.has(cmdName(t))) {
      wrapped = true;
      i++;
    } else if (wrapped && t.startsWith("-")) i++;
    else break;
  }
  return i;
}

// Commands that only test for or list .env, never show its content.
function envSafeSegment(seg) {
  if (/[<>]/.test(seg.raw)) return false;
  const at = headOf(seg.tokens);
  const head = cmdName(seg.tokens[at] ?? "");
  if (head === "git") {
    let j = at + 1;
    while (j < seg.tokens.length && seg.tokens[j].startsWith("-")) j += ["-C", "-c"].includes(seg.tokens[j]) ? 2 : 1;
    return ENV_SAFE_GIT.has(seg.tokens[j] ?? "");
  }
  return ENV_SAFE_HEADS.has(head);
}

function envGlobHit(tokens) {
  for (const t of tokens) {
    const base = t.split(/[\\/]/).pop();
    if (hasWildcard(base) && literalLength(base) >= 1 && globToRegex(base).test(".env")) return true;
  }
  return false;
}

function analyzeShell(cmd, depth = 0) {
  if (depth > 4) return refuse("too-deep", "command nesting too deep to check");
  for (const seg of splitCommand(cmd)) {
    const t = seg.tokens;
    for (let i = 0; i < t.length; i++) {
      const name = cmdName(t[i]);
      const r = name === "git" ? analyzeGit(t.slice(i + 1)) : name === "gh" ? analyzeGh(t.slice(i + 1)) : null;
      if (r) return r;
    }
    const head = cmdName(t[headOf(t)] ?? "");
    if ((head === "powershell" || head === "pwsh") && t.some((x) => /^-e(nc(odedcommand)?)?$/i.test(x)))
      return refuse("obfuscated", "an encoded PowerShell command cannot be checked");
    for (const x of t) {
      if (/\$\(|`/.test(x) || (SHELLS.has(head) && /\s/.test(x))) {
        const r = analyzeShell(x, depth + 1);
        if (r) return r;
      }
    }
    if (!envSafeSegment(seg) && (mentionsEnv(seg.raw) || mentionsEnv(t.join(" ")) || envGlobHit(t)))
      return refuse("env-access", ".env holds the API keys and is never read, printed or copied");
    for (const x of t) {
      const w = archiveWildcard(x);
      if (w) return w;
    }
  }
  return null;
}

// --- tool dispatch ---------------------------------------------------------------------------

const str = (v) => (typeof v === "string" ? v : null);
const FILE_TOOLS = new Set(["read", "write", "edit", "multiedit", "notebookedit", "glob", "grep"]);

function checkCall(tool, input) {
  const name = tool.toLowerCase();
  // Shell tools: the whole command string. Any other tool that carries a `command` string is treated the same.
  if (SHELL_TOOLS.has(name) || str(input.command) !== null) {
    const cmd = str(input.command);
    if (cmd === null) return refuse("bad-input", "a shell tool call without a command string");
    return analyzeShell(cmd) ?? textRules(cmd);
  }
  // File tools: only path and pattern fields, never contents (`content`, `old_string`, `new_string`) or Grep's regex.
  const paths = [];
  for (const f of ["file_path", "notebook_path", "path"]) {
    if (input[f] === undefined) continue;
    if (str(input[f]) === null) return refuse("bad-input", `${f} is not a string`);
    paths.push(input[f]);
  }
  if (FILE_TOOLS.has(name) && paths.length === 0 && name !== "glob" && name !== "grep") return refuse("bad-input", "a file tool call without a path");
  const extra = name === "glob" ? str(input.pattern) : name === "grep" ? str(input.glob) : null;
  const scan = [...paths];
  if (extra !== null) scan.push(extra, ...paths.map((p) => `${p}/${extra}`));
  for (const p of scan) {
    const r = textRules(p) ?? archiveWildcard(p) ?? (name === "glob" ? null : envPathRule(p));
    if (r) return r;
  }
  return null;
}

async function readStdin() {
  let data = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

async function main() {
  let event;
  try {
    event = JSON.parse(await readStdin());
  } catch {
    return refuse("bad-input", "the hook input is not valid JSON");
  }
  if (!event || typeof event !== "object" || typeof event.tool_name !== "string") return refuse("bad-input", "the hook input has no tool_name");
  const input = event.tool_input && typeof event.tool_input === "object" ? event.tool_input : {};
  return checkCall(event.tool_name, input);
}

let result;
try {
  result = await main();
} catch (e) {
  result = refuse("internal-error", `the guard failed (${e instanceof Error ? e.message : "unknown"}); refusing`);
}
if (result) {
  writeSync(2, `guard: refused (rule: ${result.rule}): ${result.why}\n`);
  process.exitCode = 2;
}
