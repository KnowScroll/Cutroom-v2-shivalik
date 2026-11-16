// Design: impl/00 §9 (guard hook), lld/11 U30, L21; M0-01a tests. Drives guard.mjs as a child process.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const GUARD = join(dirname(fileURLToPath(import.meta.url)), "guard.mjs");
const ARCHIVE = "cutroom-v3.1-full-system-architecture";

function run(toolName, toolInput) {
  const event = { session_id: "s", transcript_path: "t", cwd: "c", hook_event_name: "PreToolUse", tool_name: toolName, tool_input: toolInput };
  return runRaw(JSON.stringify(event));
}
function runRaw(stdin) {
  const r = spawnSync(process.execPath, [GUARD], { input: stdin, encoding: "utf8" });
  return { code: r.status, stderr: r.stderr };
}

function refused(tool, input, rule) {
  const r = run(tool, input);
  assert.equal(r.code, 2, `expected refusal of ${JSON.stringify(input)}, got ${r.code}`);
  assert.match(r.stderr, new RegExp(`^guard: refused \\(rule: ${rule}\\): .+\\n$`), `reason for ${JSON.stringify(input)}: ${r.stderr}`);
  assert.equal(r.stderr.trim().split("\n").length, 1, "one-line reason");
}
function allowed(tool, input) {
  const r = run(tool, input);
  assert.equal(r.code, 0, `expected allowance of ${JSON.stringify(input)}, got ${r.code}: ${r.stderr}`);
  assert.equal(r.stderr, "");
}
const sh = (rule, ...cmds) => {
  for (const c of cmds) {
    refused("Bash", { command: c }, rule);
    refused("PowerShell", { command: c }, rule);
  }
};
const shOk = (...cmds) => {
  for (const c of cmds) {
    allowed("Bash", { command: c });
    allowed("PowerShell", { command: c });
  }
};

test("force pushes are refused in every spelling", () => {
  sh(
    "force-push",
    "git push --force origin wp/x",
    "git push -f origin wp/x",
    "git push origin wp/x --force-with-lease",
    "git push --force-with-lease=wp/x origin wp/x",
    "git push -uf origin wp/x",
    "git push origin +wp/x",
    "git push origin +HEAD:wp/x",
    "git push --force origin main",
    "git -C /some/dir push --force origin wp/x",
    "git -c core.editor=true push -f origin wp/x",
    "& git push -f origin wp/x",
    "& 'C:\\Program Files\\Git\\cmd\\git.exe' push --force origin wp/x",
    "echo hi; git push -f origin wp/x",
    "true && git push -f origin wp/x",
    'bash -c "git push -f origin wp/x"',
    'powershell -Command "git push --force origin wp/x"',
    'echo "$(git push -f origin wp/x)"',
    "env GIT_X=1 git push -f origin wp/x",
  );
});

test("pushes that update or delete main are refused", () => {
  sh(
    "push-to-main",
    "git push origin main",
    "git push origin HEAD:main",
    "git push origin HEAD:refs/heads/main",
    "git push origin refs/heads/main",
    "git push origin wp/x:main",
    "git push origin :main",
    "git push origin :refs/heads/main",
    "git push --delete origin main",
    "git push origin --delete main",
    "git push --all origin",
    "git push --mirror origin",
    "git push --dry-run origin HEAD:main",
    "git push -u origin main",
    "git push",
    "git push origin",
    "git push origin HEAD",
    "git push origin @",
    "git push origin 'refs/heads/*:refs/heads/*'",
    "git -C C:\\Users\\x\\repo push origin HEAD:main",
    "git push origin wp/x main",
  );
});

test("gh api writes that name main are refused", () => {
  sh(
    "gh-api-main",
    "gh api -X PATCH repos/KnowScroll/Cutroom-v2-shivalik/git/refs/heads/main -f sha=abc",
    "gh api --method DELETE repos/KnowScroll/Cutroom-v2-shivalik/git/refs/heads/main",
    "gh api repos/KnowScroll/Cutroom-v2-shivalik/git/refs -f ref=refs/heads/main -f sha=abc",
  );
});

test("adding .env or the archive to Git is refused", () => {
  sh(
    "git-add-protected",
    "git add -f .env",
    "git add --force .env",
    "git add -f C:\\Users\\XZNON\\cutroom-v2\\.env",
    "git add -f .env.local",
    `git add -f docs/archive/${ARCHIVE}.md`,
    "git add -f docs/archive",
    "git add -f .",
    "git add -f -A",
    "git add --force --all",
    "git add -f docs",
    "git add -f",
  );
});

test("git clean with -x or -X is refused", () => {
  sh("git-clean-x", "git clean -x", "git clean -X", "git clean -fdx", "git clean -xdf", "git clean -Xn", "git clean -n -d -x", "git -C . clean -fdX");
});

test("printing or copying .env from a shell is refused", () => {
  sh(
    "env-access",
    "cat .env",
    "cat C:\\Users\\XZNON\\cutroom-v2\\.env",
    "Get-Content .env",
    "gc .env",
    "type .env",
    "head -n 3 .env",
    "tail .env",
    "grep KEY .env",
    "sed -n 1p .env",
    "awk '{print}' .env",
    "cp .env /tmp/x",
    "copy .env x.txt",
    "Copy-Item .env x.txt",
    "mv .env x",
    "rsync .env host:",
    "scp .env host:",
    "xxd .env",
    "od -c .env",
    "strings .env",
    "base64 .env",
    "source .env",
    ". ./.env",
    "cat < .env",
    "cat<.env",
    "cat .env.local",
    "node -e \"console.log(require('fs').readFileSync('.env','utf8'))\"",
    "echo $(cat .env)",
    "cat .e\"\"nv",
    "cat .*",
    "cat .e*",
    "cat .en?",
    "git check-ignore -v .env > out.txt",
    "ls .env 2>&1",
  );
});

test("the archive is refused in shells, in either case and with either separator", () => {
  sh(
    "archive-access",
    `cat docs/archive/${ARCHIVE}.md`,
    `type docs\\archive\\${ARCHIVE}.md`,
    `Get-Content DOCS\\ARCHIVE\\${ARCHIVE.toUpperCase()}.MD`,
    `grep -r foo ${ARCHIVE}.md`,
    "ls docs/archive",
    "cat docs/arch*/cutroom-v3*",
    "cat docs/*architecture*",
    `echo "$(cat docs/archive/${ARCHIVE}.md)"`,
    `wsl cat /mnt/c/Users/XZNON/cutroom-v2/docs/archive/${ARCHIVE}.md`,
  );
});

test("file tools naming the archive are refused", () => {
  for (const path of [
    `C:\\Users\\XZNON\\cutroom-v2\\docs\\archive\\${ARCHIVE}.md`,
    `C:/Users/XZNON/cutroom-v2/docs/archive/${ARCHIVE}.md`,
    `c:\\users\\xznon\\cutroom-v2\\DOCS\\Archive\\${ARCHIVE.toUpperCase()}.MD`,
    `docs/archive/${ARCHIVE}.md`,
    "docs\\archive",
  ]) {
    refused("Read", { file_path: path }, "archive-access");
    refused("Write", { file_path: path, content: "x" }, "archive-access");
    refused("Edit", { file_path: path, old_string: "a", new_string: "b" }, "archive-access");
    refused("NotebookEdit", { notebook_path: path }, "archive-access");
    refused("Glob", { pattern: "*", path }, "archive-access");
    refused("Grep", { pattern: "x", path }, "archive-access");
  }
  refused("Glob", { pattern: `**/${ARCHIVE}.md` }, "archive-access");
  refused("Glob", { pattern: "**/cutroom-v3*" }, "archive-access");
  refused("Glob", { pattern: "archive/**", path: "C:\\Users\\XZNON\\cutroom-v2\\docs" }, "archive-access");
  refused("Grep", { pattern: "x", path: "docs", glob: "archive/*.md" }, "archive-access");
  refused("Grep", { pattern: "x", glob: `**/${ARCHIVE}.md` }, "archive-access");
});

test("file tools reading or writing .env are refused", () => {
  for (const path of ["C:\\Users\\XZNON\\cutroom-v2\\.env", "C:/Users/XZNON/cutroom-v2/.env", ".env", ".ENV", "sub/.env.local", ".env.production"]) {
    refused("Read", { file_path: path }, "env-access");
    refused("Edit", { file_path: path, old_string: "a", new_string: "b" }, "env-access");
    refused("Write", { file_path: path, content: "x" }, "env-access");
  }
  refused("Grep", { pattern: "KEY", path: "C:\\Users\\XZNON\\cutroom-v2\\.env" }, "env-access");
});

test("a path under the older Cutroom folder is refused in every spelling", () => {
  const spellings = [
    "C:\\Users\\XZNON\\Cutroom",
    "C:\\Users\\XZNON\\Cutroom\\src\\a.ts",
    "c:\\users\\xznon\\cutroom\\src",
    "C:/Users/XZNON/Cutroom",
    "C:/Users/XZNON/Cutroom/README.md",
    "c:/USERS/xznon/CUTROOM/x",
    "C:\\\\Users\\\\XZNON\\\\Cutroom\\\\x",
    "/c/Users/XZNON/Cutroom/x",
    "/mnt/c/Users/XZNON/Cutroom",
    "/mnt/c/Users/XZNON/Cutroom/package.json",
    "/MNT/C/USERS/XZNON/CUTROOM/x",
  ];
  for (const p of spellings) {
    sh("old-folder", `ls ${p}`, `cat "${p}"`, `cd '${p}'`, `git -C ${p} status`);
    refused("Read", { file_path: p }, "old-folder");
    refused("Glob", { pattern: "*.ts", path: p }, "old-folder");
    refused("Grep", { pattern: "x", path: p }, "old-folder");
    refused("Write", { file_path: p, content: "x" }, "old-folder");
  }
  sh("old-folder", "ls C:\\Users\\XZNON\\Cutroom && echo done", "cd C:/Users/XZNON/Cutroom;ls");
});

test("the project folder and the repository name are not the older folder", () => {
  shOk(
    "ls C:\\Users\\XZNON\\cutroom-v2\\docs",
    "cd C:/Users/XZNON/cutroom-v2 && git status",
    "cat /mnt/c/Users/XZNON/cutroom-v2/CLAUDE.md",
    "ls /c/Users/XZNON/cutroom-v2/packages",
    "gh pr list -R KnowScroll/Cutroom-v2-shivalik",
    "git remote add origin https://github.com/KnowScroll/Cutroom-v2-shivalik.git",
  );
  allowed("Read", { file_path: "C:\\Users\\XZNON\\cutroom-v2\\docs\\lld\\11-integration-decisions.md" });
  allowed("Read", { file_path: "C:/Users/XZNON/cutroom-v2/CLAUDE.md" });
  allowed("Glob", { pattern: "**/*.md", path: "C:\\Users\\XZNON\\cutroom-v2\\docs\\lld" });
  allowed("Grep", { pattern: "Cutroom", path: "C:\\Users\\XZNON\\cutroom-v2\\docs\\lld" });
});

test("the flow of the build is allowed", () => {
  shOk(
    "git push -u origin wp/m0-01a-guard-hook",
    "git push origin m0-done",
    "git push origin HEAD:wp/m0-01a-guard-hook",
    "git push origin refs/tags/m0-done",
    "git push origin --tags",
    "git push --delete origin wp/m0-01a-guard-hook",
    "git -C C:\\Users\\XZNON\\cutroom-v2 push -u origin wp/x",
    "gh pr create --base main --title x --body-file f",
    "gh pr merge 5 --squash --delete-branch",
    "gh issue create --title t --body-file b -R KnowScroll/Cutroom-v2-shivalik",
    "gh api repos/KnowScroll/Cutroom-v2-shivalik/git/refs/heads/main",
    "gh api -X GET repos/KnowScroll/Cutroom-v2-shivalik/git/refs/heads/main",
    "git status --ignored",
    "git check-ignore -v .env",
    "git ls-files --eol",
    "git ls-files .env",
    "test -f .env",
    "Test-Path .env",
    "git fetch origin",
    "git switch -c wp/x origin/main",
    "git checkout main",
    "git pull --ff-only origin main",
    "git add -A",
    "git add .",
    "git add .claude/hooks/guard.mjs",
    "git add -f packages/foo/src/index.ts",
    "git commit -m 'M0-01a: guard hook'",
    "git clean -n",
    "git clean -fd",
    "git diff --stat",
    "git log --oneline -5",
    "cat .env.example",
    "ls docs/lld",
    "cat docs/impl/STATE.md",
    "ls *.md",
    "node --test .claude/hooks/",
    "npm run check",
    "cat process.env.txt",
    'echo "do not git push --force"',
  );
});

test("file tools and other tools that are allowed", () => {
  allowed("Write", { file_path: "C:\\Users\\XZNON\\cutroom-v2\\notes.md", content: `mentions ${ARCHIVE} and C:\\Users\\XZNON\\Cutroom and .env` });
  allowed("Edit", { file_path: "C:\\Users\\XZNON\\cutroom-v2\\notes.md", old_string: ARCHIVE, new_string: "x" });
  allowed("Grep", { pattern: ARCHIVE, path: "C:\\Users\\XZNON\\cutroom-v2\\docs\\lld" });
  allowed("Read", { file_path: "C:\\Users\\XZNON\\cutroom-v2\\.env.example" });
  allowed("Glob", { pattern: "**/*", path: "C:\\Users\\XZNON\\cutroom-v2\\packages" });
  allowed("Glob", { pattern: "**/.env*", path: "C:\\Users\\XZNON\\cutroom-v2" });
  allowed("Agent", { description: "d", prompt: `Never open docs/archive/${ARCHIVE}.md or C:\\Users\\XZNON\\Cutroom; git push --force is refused` });
  allowed("WebFetch", { url: "https://example.com", prompt: "x" });
  allowed("mcp__some__tool", { anything: "git push -f origin main" });
});

test("malformed input fails closed", () => {
  for (const stdin of ["", "not json", "null", "[]", "{}", JSON.stringify({ tool_name: 5 })]) {
    const r = runRaw(stdin);
    assert.equal(r.code, 2, `stdin ${JSON.stringify(stdin)}`);
    assert.match(r.stderr, /^guard: refused \(rule: bad-input\): /);
  }
  refused("Bash", {}, "bad-input");
  refused("Bash", { command: 5 }, "bad-input");
  refused("Read", {}, "bad-input");
  refused("Read", { file_path: 5 }, "bad-input");
  allowed("Bash", { command: "echo ok" });
  allowed("Agent", undefined);
});

// Incident guard (M0-01a): a lost backslash once made lib/shell.mjs unparseable; with `|| exit 2` that blocked every
// tool call. These tests fail loudly, here, before the hook is ever registered.
test("every hook module parses and loads, and the entry point runs on a trivial input", async () => {
  const dir = dirname(GUARD);
  const files = [join(dir, "guard.mjs"), join(dir, "guard.test.mjs"), ...readdirSync(join(dir, "lib")).filter((f) => f.endsWith(".mjs")).map((f) => join(dir, "lib", f))];
  for (const f of files) {
    const r = spawnSync(process.execPath, ["--check", f], { encoding: "utf8" });
    assert.equal(r.status, 0, `${f} does not parse: ${r.stderr}`);
  }
  for (const f of files.filter((x) => x.includes(`${join(dir, "lib")}`))) await import(pathToFileURL(f).href);
  const { globToRegex, normPath } = await import(pathToFileURL(join(dir, "lib", "shell.mjs")).href);
  assert.equal(normPath("C:\\\\Users/X\\y"), "c:/users/x/y");
  assert.ok(globToRegex("a[bc]*.m?").test("abxx.md"));
  assert.ok(globToRegex("a.b").test("a.b") && !globToRegex("a.b").test("axb"));
  allowed("Bash", { command: "echo ok" });
});

test("the registration file (settings.json or its .off name) points at this hook and fails closed", () => {
  const claude = join(dirname(GUARD), "..");
  const name = ["settings.json", "settings.json.off"].find((n) => existsSync(join(claude, n)));
  assert.ok(name, "settings.json (or settings.json.off) exists");
  const cfg = JSON.parse(readFileSync(join(claude, name), "utf8"));
  const entry = cfg.hooks.PreToolUse[0];
  assert.equal(entry.matcher, "*");
  assert.equal(entry.hooks[0].type, "command");
  assert.match(entry.hooks[0].command, /\.claude\/hooks\/guard\.mjs" \|\| exit 2$/);
});
