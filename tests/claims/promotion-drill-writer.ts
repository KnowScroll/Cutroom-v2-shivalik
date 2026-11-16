// Design: lld/10 §4.2 (M0: the 200-kill promotion drill on real code); b2b §4; lld/04 §2.6 (swapAcceptedHead)
// The drill's child process. Not a test file (it does not end in .test.ts), so the runner never selects it.
//   node promotion-drill-writer.ts setup <db>   create the Space: genesis revision, `main`, one candidate branch
//   node promotion-drill-writer.ts loop <db>    put an entity version and a revision, swap the accepted head with
//                                               a hook that writes the event row, and only after the promise
//                                               resolves write the seq to stdout, synchronously. Runs until killed.
import { writeSync } from "node:fs";
import { type EntityDocument, openDatabase, RevisionStore } from "@cutroom/project-core";
import { drillRegistry, drillWriterSettings } from "./promotion-drill-shared.ts";

const [mode, dbPath] = process.argv.slice(2);
if ((mode !== "setup" && mode !== "loop") || dbPath === undefined) {
  process.stderr.write("usage: promotion-drill-writer.ts <setup|loop> <db path>\n");
  process.exit(2);
}

const opened = await openDatabase(dbPath, { ...drillWriterSettings(), migrations: drillRegistry() });
if (!opened.ok) {
  process.stderr.write(`open failed: ${JSON.stringify(opened)}\n`);
  process.exit(3);
}
const storage = opened.value;
const store = new RevisionStore(storage);

const projectId = "ent_01a1e487-1e4e-71d4-a030-049981c8cc1a";
const documentFor = (n: number): EntityDocument => ({
  id: projectId,
  kind: "project",
  v: 1,
  handle: "drill",
  counter: n,
});

if (mode === "setup") {
  const first = await store.putEntityVersion(documentFor(0));
  const genesis = await store.putRevision({
    project: projectId,
    parents: [],
    entities: { [projectId]: first.hash },
    origin: "genesis",
  });
  await store.createBranch({ name: "main", head: genesis.revision_id, type: "accepted" });
  await store.createBranch({
    name: "d/1",
    head: genesis.revision_id,
    fork_point: genesis.revision_id,
    type: "candidate",
  });
  storage.close();
  process.exit(0);
}

// loop: carry on from whatever head the database holds (the previous writer may have been killed mid-swap).
const start = store.getBranch("main");
if (!start.ok) {
  process.stderr.write(`no main branch: ${JSON.stringify(start)}\n`);
  process.exit(4);
}
let head = start.value.head;
// The entity document differs on every pass, so every revision is new.
let counter = Number(storage.prepare("SELECT count(*) AS n FROM revision").get()?.n ?? 0) + 1;
for (;;) {
  const version = await store.putEntityVersion(documentFor(counter));
  const revision = await store.putRevision({
    project: projectId,
    parents: [head],
    entities: { [projectId]: version.hash },
    origin: "patch",
  });
  const swapped = await store.swapAcceptedHead(
    { expected_base: head, candidate: revision.revision_id, from_branch: "d/1", decision: null, by: "drill" },
    (db, info) => {
      db.prepare("INSERT INTO drill_event(seq, revision) VALUES (?, ?)").run(info.seq, info.revision);
    },
  );
  if (!swapped.ok) {
    process.stderr.write(`swap refused: ${JSON.stringify(swapped)}\n`);
    process.exit(5);
  }
  head = revision.revision_id;
  counter++;
  // The acknowledgement: only after the promise has resolved, and synchronous, so nothing is buffered.
  writeSync(1, `${swapped.value.seq}\n`);
}
