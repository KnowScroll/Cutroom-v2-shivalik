// Design: lld/10 §4.2 (M0: the 200-kill promotion drill passes on real code); b2b §4; lld/11 U27 (WSL only; A:M0-6)
// The parent of the drill. A child process (promotion-drill-writer.ts) loops through the real openDatabase, grouped
// writer and RevisionStore; this file kills it 200 times with SIGKILL, reopens the database after each kill and
// checks it. Runs by `npm run test:claims` in WSL on the mirror; the Space is a temporary folder under the home
// directory (ext4), never under /mnt/c. Seed: CUTROOM_DRILL_SEED (default below); kills: CUTROOM_DRILL_KILLS.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { openDatabase, type Storage } from "@cutroom/project-core";
import { DRILL_WRITER_SETTINGS, drillRegistry } from "./promotion-drill-shared.ts";

const WRITER = fileURLToPath(new URL("./promotion-drill-writer.ts", import.meta.url));
const KILLS = Number(process.env.CUTROOM_DRILL_KILLS ?? 200);
const SEED = Number(process.env.CUTROOM_DRILL_SEED ?? 20260516);
const ACK_TIMEOUT_MS = 60_000;

/** mulberry32: a small seeded generator, so a run can be repeated by its seed. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 15% of the delays fall within 5 ms; the rest are uniform over 0 to 250 ms (b2b §4). */
function delayMs(random: () => number): number {
  return random() < 0.15 ? random() * 5 : random() * 250;
}

interface Kill {
  readonly signal: string | null;
  readonly acked: number[];
}

/** Starts a writer, waits for its first acknowledgement, kills it after `delay`, returns what it acknowledged. */
function runAndKill(db: string, delay: (() => number) | undefined): Promise<Kill> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [WRITER, "loop", db], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    let killed = false;
    const watchdog = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`no acknowledgement within ${ACK_TIMEOUT_MS} ms; stderr: ${err}`));
    }, ACK_TIMEOUT_MS);
    child.stderr.on("data", (d: Buffer) => {
      err += d.toString();
    });
    child.stdout.on("data", (d: Buffer) => {
      out += d.toString();
      if (!killed && out.includes("\n")) {
        killed = true;
        clearTimeout(watchdog);
        const wait = delay === undefined ? 0 : delay();
        setTimeout(() => child.kill("SIGKILL"), wait);
      }
    });
    child.on("error", reject);
    // "close" fires after stdout has been read to its end, so acknowledgements already in the pipe are counted.
    child.on("close", (_code, signal) => {
      clearTimeout(watchdog);
      if (!killed)
        return reject(new Error(`writer ended without an acknowledgement (${signal}); stderr: ${err}`));
      const acked = out
        .split("\n")
        .filter((line, i, all) => line !== "" && (i < all.length - 1 || out.endsWith("\n")))
        .map(Number);
      resolve({ signal, acked });
    });
  });
}

function check(storage: Storage, lastAcked: number, ackedSet: ReadonlySet<number>): string[] {
  const problems: string[] = [];
  const integrity = storage.prepare("PRAGMA integrity_check").all();
  if (integrity.length !== 1 || integrity[0]?.integrity_check !== "ok") {
    problems.push(`integrity_check: ${JSON.stringify(integrity)}`);
  }
  const rows = storage.prepare("SELECT seq, revision, previous FROM accepted_log ORDER BY seq").all();
  const seqs = rows.map((r) => Number(r.seq));
  for (let i = 0; i < seqs.length; i++)
    if (seqs[i] !== i + 1) problems.push(`gap: position ${i + 1} holds seq ${seqs[i]}`);
  for (let i = 1; i < rows.length; i++) {
    if (rows[i]?.previous !== rows[i - 1]?.revision) problems.push(`broken chain at seq ${rows[i]?.seq}`);
  }
  const head = storage.prepare("SELECT head FROM branch WHERE name = 'main'").get()?.head;
  const lastRow = rows[rows.length - 1];
  if (lastRow !== undefined && head !== lastRow.revision)
    problems.push("head differs from last accepted_log revision");
  const present = new Set(seqs);
  for (const s of ackedSet) if (!present.has(s)) problems.push(`acknowledged seq ${s} missing`);
  const events = storage.prepare("SELECT seq, revision FROM drill_event ORDER BY seq").all();
  if (
    events.length !== rows.length ||
    events.some((e, i) => e.seq !== rows[i]?.seq || e.revision !== rows[i]?.revision)
  ) {
    problems.push(`event rows (${events.length}) do not match accepted_log rows (${rows.length}) one to one`);
  }
  const beyond = rows.length - lastAcked;
  if (beyond < 0 || beyond > 1) problems.push(`${beyond} commits beyond the last acknowledgement`);
  return problems;
}

test("promotion drill: 200 SIGKILLs of a writer on the real storage and revision modules, 0 violations", async () => {
  assert.equal(process.platform, "linux", "the drill needs Linux kill behaviour (U27); run it in WSL");
  const dir = mkdtempSync(join(homedir(), ".cutroom-drill-"));
  const started = Date.now();
  try {
    const fsType = spawnSync("stat", ["-f", "-c", "%T", dir], { encoding: "utf8" }).stdout.trim();
    assert.match(fsType, /ext/, `the Space must be on ext4, found ${fsType} at ${dir}`);
    const db = join(dir, "space.db");
    const setup = spawnSync(process.execPath, [WRITER, "setup", db], { encoding: "utf8" });
    assert.equal(setup.status, 0, `setup failed: ${setup.stderr}`);

    const random = rng(SEED);
    const ackedSet = new Set<number>();
    let lastAcked = 0;
    let signals = 0;
    let exactlyOneUnacked = 0;
    let totalAcked = 0;
    const violations: string[] = [];
    const reopenMs: number[] = [];
    for (let k = 1; k <= KILLS; k++) {
      const kill = await runAndKill(db, () => delayMs(random));
      if (kill.signal === "SIGKILL") signals++;
      else violations.push(`kill ${k}: writer ended with ${kill.signal}, not SIGKILL`);
      for (const s of kill.acked) ackedSet.add(s);
      totalAcked += kill.acked.length;
      lastAcked = Math.max(lastAcked, ...kill.acked);
      const t0 = performance.now();
      const reopened = await openDatabase(db, { ...DRILL_WRITER_SETTINGS, migrations: drillRegistry() });
      if (!reopened.ok) {
        violations.push(`kill ${k}: reopen failed ${JSON.stringify(reopened)}`);
        continue;
      }
      try {
        const problems = check(reopened.value, lastAcked, ackedSet);
        const count = Number(reopened.value.prepare("SELECT count(*) AS n FROM accepted_log").get()?.n);
        if (count === lastAcked + 1) exactlyOneUnacked++;
        reopenMs.push(performance.now() - t0);
        for (const p of problems) violations.push(`kill ${k}: ${p}`);
      } finally {
        reopened.value.close();
      }
    }
    const sorted = [...reopenMs].sort((a, b) => a - b);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(
      [
        `promotion drill: seed ${SEED}, ${KILLS} kills, ${signals} delivered as SIGKILL`,
        `  acknowledged commits in total ${totalAcked}, accepted_log rows ${lastAcked + exactlyOneUnacked}`,
        `  kills that left exactly one unacknowledged commit: ${exactlyOneUnacked} of ${KILLS}`,
        `  reopen plus checks (incl. quick_check, migrations): p50 ${sorted[Math.floor(sorted.length / 2)]?.toFixed(1)} ms, max ${sorted[sorted.length - 1]?.toFixed(1)} ms`,
        `  violations: ${violations.length}; run time ${seconds}s; filesystem ${fsType}`,
      ].join("\n"),
    );
    assert.equal(signals, KILLS);
    assert.deepEqual(violations, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
