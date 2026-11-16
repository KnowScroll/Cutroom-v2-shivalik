// Design: impl/00 §9 (guard hook), lld/11 U30, L21. Shell tokenizing and path helpers, built-in modules only.

// Unquoted characters that end a command segment. `&` covers `&&` and PowerShell's call operator.
const SEPARATORS = new Set([";", "&", "|", "\n", "\r", "(", ")", "{", "}", "`"]);

// Split a command into segments of unquoted tokens. Each segment keeps its raw text.
export function splitCommand(cmd) {
  const out = [];
  let toks = [];
  let cur = "";
  let inTok = false;
  let quote = null;
  let start = 0;
  const endTok = () => {
    if (inTok) toks.push(cur);
    cur = "";
    inTok = false;
  };
  const endSeg = (i) => {
    endTok();
    if (toks.length > 0) out.push({ raw: cmd.slice(start, i), tokens: toks });
    toks = [];
    start = i + 1;
  };
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      inTok = true;
      continue;
    }
    if (SEPARATORS.has(ch)) {
      endSeg(i);
      continue;
    }
    if (/\s/.test(ch)) {
      endTok();
      continue;
    }
    cur += ch;
    inTok = true;
  }
  endSeg(cmd.length);
  return out;
}

// Lower-case, `\` and `/` runs become one `/`: Windows paths are case-insensitive, JSON may double backslashes.
export function normPath(s) {
  return String(s).toLowerCase().replace(/[\\/]+/g, "/");
}

// The command name of a token: last path part, lower case, without an executable extension.
export function cmdName(tok) {
  const last = String(tok).split(/[\\/]/).pop().toLowerCase();
  return last.replace(/\.(exe|cmd|bat|ps1|com)$/, "");
}

export function globToRegex(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") re += ".*";
    else if (c === "?") re += ".";
    else if (c === "[") {
      const j = glob.indexOf("]", i + 1);
      if (j < 0) re += "\\[";
      else {
        re += `[${glob.slice(i + 1, j).replace(/^!/, "^").replace(/\\/g, "\\\\")}]`;
        i = j;
      }
    } else re += c.replace(/[.+^${}()|\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`, "i");
}

export const hasWildcard = (s) => /[*?[]/.test(s);
export const literalLength = (s) => s.replace(/[*?[\]]/g, "").length;

// `.env` or `.env.<x>`, but not `.env.example`, as a whole path part.
export function isEnvName(base) {
  const b = String(base).toLowerCase();
  return /^\.env(\..+)?$/.test(b) && b !== ".env.example";
}
