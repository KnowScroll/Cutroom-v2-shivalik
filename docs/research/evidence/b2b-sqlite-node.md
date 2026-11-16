# B2b — SQLite through `node:sqlite`: measured results

Date: 2026-11-14. Throwaway measurement spike. All spike code and data were deleted afterwards; only this file is kept.

## Summary

| # | Question | Result |
|---|---|---|
| 1 | API fit | Everything asked for works in Node 26.13.1 with no flag and no warning. Bundled SQLite is 3.54.1 (at least 3.51.3: yes). `Database` and `DatabaseSync` are both exported and are the same class. |
| 2 | Scale | 500 revisions x 800 entities = 49.9 MB database, of which 94% is manifests. Snapshot load 1.7 ms (p50, warm) to about 120 ms (cold file cache). Diff between two revisions 0.5 ms in JavaScript, 2.2-2.5 ms in SQL. |
| 3 | Commit latency | At `FULL` one commit takes 4.8-4.9 ms (p50), about 13 ms (p95) and 22 ms (p99) when every transaction commits separately; worst case 94-124 ms. Grouped every 20 ms: p50 4.9 ms, p99 12-28 ms, worst case 128-192 ms. The longest main-thread stall is the longest single commit: 124-193 ms at `FULL`, 25-30 ms at `NORMAL`. Separate commits fell up to 2.4 s behind at 50 per second; grouped commits did not. |
| 4 | Crash safety | 400 SIGKILLs (2 x 200), 0 violations. In about 9 of 10 kills the last commit was in the database but had not been acknowledged. |
| 5 | Blob ingest | 2,700 x 1 MB, two samples, both under background load: 177-329 MB/s without fsync (78-156 MB/s once the final flush to disk is counted), 36-41 MB/s with fsync per file, 25-34 MB/s with fsync of file and directory. |
| 6 | Wrong filesystem | WAL mode on `/mnt/c` gave **no error at all**. It works, only slower and with a longer tail. Start-up cannot rely on an error; it has to check the filesystem type (`v9fs` / `9p` versus `ext2/ext3` / `ext4`). |
| 7 | Canonical JSON | `canonicalize` 5.1.0 passes all 26 rows of RFC 8785 appendix B, the section 3.2.3 sorting example and the section 3.2.2 sample bytes. 0 mismatches against the reference on 10,000 random objects. |
| 8 | UUIDv7 | `uuid` 14.0.3 has `v7()`. 100,000 IDs were unique and sorted in generation order. Node's own `crypto.randomUUIDv7()` exists too but is **not** ordered inside one millisecond. |

Surprises:

- WAL on the Windows mount did not fail (question 6).
- A crash usually leaves one committed but unacknowledged transaction (question 4).
- Node 26 has a built-in `crypto.randomUUIDv7()`, and it does not keep generation order (question 8).
- `stat -f -c %T` prints `ext2/ext3` for an ext4 filesystem (question 6).
- With a separate commit per transaction at only 50 per second, the main thread spent about a third of its time inside commits, and the writer fell behind schedule for seconds at a time (question 3).

## Environment and versions

| Item | Value |
|---|---|
| Host | WSL2, Ubuntu 22.04.5 LTS, kernel 6.18.58.1-microsoft-standard-WSL2 |
| CPU / RAM | 16 logical CPUs, 11,961 MB RAM |
| Disk | ext4 on a WSL virtual disk (`/dev/sdd`, mount options `rw,relatime,discard,errors=remount-ro,data=ordered`) |
| Node | v26.13.1 linux-x64, official tarball, SHA-256 checked against `latest-v26.x/SHASUMS256.txt`. `process.release.lts` is `Lithium`. A v26 line existed, so v24 was not needed. |
| npm | 11.20.0 |
| `process.versions.sqlite` | 3.54.1 (`select sqlite_version()` gives the same) |
| `node:sqlite` | Loads with plain `require('node:sqlite')`. No flag needed. No experimental warning: nothing on stderr and no `warning` event. |
| `canonicalize` | 5.1.0 (ES module, no dependencies; loads with `require()` in Node 26, the function is the `default` export) |
| `uuid` | 14.0.3 (ES module, no dependencies; loads with `require()` in Node 26) |

**Background load.** Another spike was running in the same WSL machine during this work. At times its headless Chrome used 8 to 9 of the 16 CPUs, and the load average went from under 1 up to 19. It was busy during both blob tests (question 5), during the latency runs on the Windows mount (question 6) and during parts of the commit-latency runs (question 3). Load averages are given where they matter. Numbers taken under that load are probably worse than on a quiet machine, and tails in particular should be read with that in mind. No run in this file was taken on a machine known to be idle for the whole run.

**General limit.** Everything here was measured on one laptop, on a WSL2 virtual disk. A native Linux machine or a different SSD will give different absolute numbers, especially for anything that calls `fsync`.

## 1. API fit

All checks were run against a database file on ext4.

| Feature | Works | What was observed |
|---|---|---|
| `PRAGMA journal_mode=WAL` | yes | returns `wal`; `-wal` and `-shm` files appear |
| `PRAGMA synchronous=FULL` | yes | reads back as 2. The build default is already FULL (`DEFAULT_SYNCHRONOUS=2`, `DEFAULT_WAL_SYNCHRONOUS=2`). |
| `PRAGMA foreign_keys=ON` | yes | Already 1 on a new connection: `node:sqlite` turns foreign keys on by default (constructor option `enableForeignKeyConstraints`). An insert of an orphan row failed with `FOREIGN KEY constraint failed`. |
| Busy timeout | yes | Constructor option `timeout` (milliseconds) and `PRAGMA busy_timeout=N` both work and read back. Enforced: with one connection holding a write transaction, a second connection's `BEGIN IMMEDIATE` threw after 301 ms (timeout was 300) with `code=ERR_SQLITE_ERROR`, `errcode=5`, message `database is locked`. |
| `STRICT` tables | yes | Text into an `INTEGER` column was rejected: `cannot store TEXT value in INTEGER column p.n`. `WITHOUT ROWID` together with `STRICT` also works. |
| `BEGIN IMMEDIATE` | yes | `db.isTransaction` reports the state correctly |
| Prepared statements | yes | positional and named parameters; `run()` returns `{ changes, lastInsertRowid }`; `get()`, `all()`, `iterate()` exist |
| `json_each` | yes | also `json_extract` and `jsonb()` |
| WAL snapshot reads | yes | a second (read-only) connection saw the old row count while the writer had an open transaction, and the new count after commit |
| Online backup | yes | `backup(sourceDb, path, { rate, progress })` returns a Promise. It copied 2,869 pages (11.75 MB) in 286 ms at 100 pages per step, with 28 progress callbacks, while 42 inserts ran on the source connection between steps. The copy passed `integrity_check` and held 20,042 of the 20,043 source rows; the missing row was inserted after the last backup step. The copy is itself in WAL mode. |
| `VACUUM INTO` | yes | 54 ms for the same 11.75 MB |

**Class name.** The module exports both `Database` and `DatabaseSync`, and `Database === DatabaseSync` is true. `Statement` and `StatementSync` are also the same class. Every call is synchronous; there is no asynchronous database class. Other exports: `Session`, `constants`, `backup`.

**SQLite version.** 3.54.1, which is at least 3.51.3. Relevant compile options: `THREADSAFE=1`, `DEFAULT_WAL_AUTOCHECKPOINT=1000`, FTS5, R-Tree, session extension, `dbstat`, math functions.

Limits of this test:

- Each feature was checked once for function, not for speed.
- The backup was taken from an 11.75 MB database with light writes on the same connection. It was not tried under the 50 writes per second load, on a larger file, or with a second writer connection.
- Nothing was tried from a worker thread.

## 2. Scale

Layout used: `entity_docs(hash primary key, body)` as a `STRICT`, `WITHOUT ROWID` table; `revisions(rev_no, rev_id, parent_rev_id, created_at, manifest)` with the manifest stored as one JSON object mapping entity ID to hash. WAL, `synchronous=FULL`, 4 KB pages.

What was created:

| Item | Value |
|---|---|
| Revisions | 500 |
| Entities per revision | 800 |
| Entity document size | 600 bytes each |
| Entities changed per revision | 5 |
| Entity document rows | 3,295 (800 + 499 x 5) |
| Manifest size | 93,601 bytes each |
| Build time | 4.07 s in total |
| Time to write one revision (5 documents + manifest, one transaction, `FULL`) | p50 6.9 ms, p95 14.2 ms, p99 29.6 ms, max 35.7 ms |

File sizes:

| File | Size |
|---|---|
| Database after checkpoint | 49,922,048 bytes (47.6 MiB), 12,188 pages |
| of which `revisions` (manifests) | 47,108,096 bytes (94%) |
| of which `entity_docs` | 2,768,896 bytes (6%) |
| WAL right after the build, before a checkpoint | 4,317,792 bytes (database file was 48,455,680 bytes at that moment) |
| WAL after `wal_checkpoint(TRUNCATE)` | 0 bytes |
| WAL and shm after a clean close | both removed |
| shm while open | 32,768 bytes |

The WAL stays near 4.1 to 4.3 MB in steady state because the automatic checkpoint runs every 1,000 pages. The full manifest per revision is what makes the file grow: about 94 KB per revision, whatever the size of the change.

Time to load one revision's full snapshot (800 rows):

| Method | p50 | p95 | p99 | max |
|---|---|---|---|---|
| One SQL query: manifest through `json_each`, joined to documents (rows only) | 1.69 ms | 3.75 ms | 5.30 ms | 6.38 ms |
| Same, plus `JSON.parse` of the 800 documents | 3.51 ms | 8.37 ms | 10.63 ms | 13.46 ms |
| Manifest parsed in JavaScript, then 800 single-row lookups (rows only) | 5.80 ms | 10.37 ms | 12.35 ms | 15.15 ms |
| Same, plus `JSON.parse` of the 800 documents | 7.92 ms | 16.95 ms | 21.89 ms | 23.03 ms |
| Fetch the manifest row only | 0.05 ms | 0.19 ms | 1.44 ms | 2.80 ms |

These are 200 random revisions on one connection with the file in the operating system's cache. Two more cases, each in a fresh process:

| Case | SQL query | `JSON.parse` of documents |
|---|---|---|
| Fresh process, file in OS cache (5 runs) | 3.6 to 6.7 ms | 6.6 to 7.7 ms |
| Fresh process, file pushed out of the OS cache first (6 runs) | 111 to 204 ms (median about 120 ms) | 8.6 to 11.8 ms |

Time to find which entities changed between two revisions:

| Method | Pair | p50 | p95 | p99 | max |
|---|---|---|---|---|---|
| JavaScript: parse both manifests, compare hashes | adjacent revisions (5 changes) | 0.47 ms | 0.66 ms | 0.94 ms | 1.32 ms |
| JavaScript | random pairs (median 488 changes) | 0.47 ms | 0.69 ms | 1.01 ms | 1.29 ms |
| SQL: two `json_each` scans joined on entity ID | adjacent revisions | 2.16 ms | 2.62 ms | 2.96 ms | 3.23 ms |
| SQL | random pairs | 2.50 ms | 2.89 ms | 3.17 ms | 3.33 ms |

Revision 1 against revision 500: 765 entities changed, 2.9 ms in SQL. The results of both methods were compared with the known list of changes for 400 pairs: 0 differences.

Limits of this test:

- One project, 800 entities, 500 revisions. No larger project and no longer history was tried, so nothing here shows how the numbers grow.
- Documents were synthetic and all exactly 600 bytes.
- The cold-cache case evicted the database file with `posix_fadvise`. That is close to, but not the same as, a first read after boot.
- A manifest stored as rows (one row per entity per revision) or as a delta was not measured.
- No concurrent writer was running during the read timings.

## 3. Commit latency

Workload: 50 transactions per second for 300 seconds, arriving at random moments (the same random schedule in every run, 15,029 transactions). Each transaction updates one of 200 job rows and inserts one event row with a JSON payload of about 230 bytes; the event table has one extra index. WAL, automatic checkpoint at the default 1,000 pages, one connection on the main thread, ext4. Each transaction runs in its own event-loop turn.

- **Separate**: `BEGIN IMMEDIATE` ... `COMMIT` for every transaction.
- **Grouped**: the first transaction opens `BEGIN IMMEDIATE` and starts a 20 ms timer; transactions that arrive in that window join it; `COMMIT` runs when the timer fires. At 50 per second a group held 2.0 to 2.1 transactions on average, so there were about 24 commits per second instead of 50.

The `FULL` configurations were measured twice (runs A and B). Run A used an earlier load generator; see the note under the stall table.

Duration of the `COMMIT` call:

| Sync | Style | Run | Load average, start to end | Commits | p50 | p95 | p99 | max | over 20 ms | over 50 ms | over 100 ms |
|---|---|---|---|---|---|---|---|---|---|---|---|
| FULL | separate | A | 7.8 to 1.0 | 15,029 | 4.80 ms | 13.47 ms | 22.06 ms | 93.9 ms | 219 | 21 | 0 |
| FULL | separate | B | 0.7 to 6.8 | 15,029 | 4.85 ms | 13.33 ms | 21.61 ms | 123.8 ms | 212 | 17 | 1 |
| FULL | grouped | A | 1.0 to 0.9 | 7,384 | 4.92 ms | 7.38 ms | 12.07 ms | 127.7 ms | 12 | 1 | 1 |
| FULL | grouped | B | 6.8 to 4.1 | 7,234 | 4.87 ms | 13.53 ms | 28.01 ms | 192.2 ms | 142 | 43 | 11 |
| NORMAL | separate | B | 4.1 to 5.8 | 15,029 | 0.04 ms | 0.07 ms | 0.12 ms | 28.7 ms | 7 | 0 | 0 |
| NORMAL | grouped | B | 5.8 to 1.5 | 7,511 | 0.07 ms | 0.12 ms | 4.56 ms | 23.3 ms | 2 | 0 | 0 |

Time from a transaction's arrival until its commit had returned (what a caller waits for):

| Sync | Style | Run | p50 | p95 | p99 | max |
|---|---|---|---|---|---|---|
| FULL | separate | A | 5.8 ms | 41.6 ms | 349.6 ms | 1,117 ms |
| FULL | separate | B | 6.1 ms | 31.9 ms | 179.9 ms | 491.8 ms |
| FULL | grouped | A | 24.8 ms | 30.0 ms | 34.0 ms | 152.8 ms |
| FULL | grouped | B | 24.9 ms | 37.5 ms | 92.4 ms | 304.2 ms |
| NORMAL | separate | B | 0.7 ms | 1.2 ms | 5.4 ms | 29.8 ms |
| NORMAL | grouped | B | 19.8 ms | 21.5 ms | 25.0 ms | 48.0 ms |

Main-thread stall, from `perf_hooks.monitorEventLoopDelay` at 1 ms resolution. The values include the 1 ms sampling interval, so an idle loop reads about 1.07 ms.

| Sync | Style | Run | p50 | p95 | p99 | p99.9 | max = longest stall | Longest single commit | Longest time continuously behind schedule |
|---|---|---|---|---|---|---|---|---|---|
| FULL | separate | B | 1.07 ms | 5.71 ms | 10.58 ms | 21.09 ms | **124.0 ms** | 123.8 ms | 2,398 ms |
| FULL | grouped | A | 1.04 ms | 1.14 ms | 6.22 ms | 10.04 ms | **128.8 ms** | 127.7 ms | not recorded |
| FULL | grouped | B | 1.07 ms | 1.18 ms | 6.39 ms | 17.71 ms | **193.5 ms** | 192.2 ms | 5 ms |
| NORMAL | separate | B | 1.08 ms | 1.16 ms | 1.29 ms | 6.06 ms | **29.9 ms** | 28.7 ms | 34 ms |
| NORMAL | grouped | B | 1.07 ms | 1.16 ms | 1.22 ms | 4.05 ms | **24.6 ms** | 23.3 ms | 1 ms |

Note on run A, `FULL` separate: its load generator handled every overdue transaction in one event-loop turn. When the disk slowed down, it ran commits back to back for **7.3 seconds** without returning to the event loop (event-loop delay max 7,319 ms), although no single commit took more than 93.9 ms. That figure belongs to that generator, not to SQLite, and is why the set was run again. It is still a fair warning: code that drains a queue of writes in one loop will freeze the process for as long as the queue lasts.

Extra run, not asked for: a burst of 500 transactions per second for 30 seconds at `FULL` (15,029 transactions).

| Style | Achieved rate | Commits | Commit p50 / p99 / max | Arrival-to-commit p50 / p99 / max | Longest stall |
|---|---|---|---|---|---|
| Separate | 133 per second; the 30 seconds of work took 113 seconds | 15,029 | 4.6 / 32.4 / 105.6 ms | 55 s / 82 s / 83 s | 105.8 ms |
| Grouped (13 per group on average, at most 31) | 500 per second, kept up | 1,155 | 4.9 / 14.0 / 23.2 ms | 19.9 / 37.8 / 58.1 ms | 26.4 ms |

What the numbers say:

- In every run the longest stall is the longest single `COMMIT`, to within about 1 ms. The commit runs `fsync` on the main thread, and that is the stall.
- At `FULL` a commit costs about 5 ms at the median and 12 to 28 ms at p99. The slowest commit of each run took 94 to 192 ms (0 to 11 commits per five-minute run took more than 100 ms).
- With separate commits at 50 per second the main thread spent about 32% of its time inside commits (mean 6.4 ms x 50). When the disk was slow the writer fell behind for up to 2.4 seconds, and 1% of callers waited longer than 180 ms (run B) or 350 ms (run A). With grouping, callers wait about 25 ms at the median (the 20 ms window plus one commit), but p99 stayed at 34 to 92 ms, and in the run where it was recorded the writer was never behind for more than 5 ms.
- In the burst, separate commits topped out at 133 transactions per second. Grouped commits handled 500 per second, with a lower p99 wait than separate commits had at 50 per second.
- At `NORMAL` a commit does not call `fsync` (0.04 to 0.07 ms). The 23 to 29 ms worst cases are checkpoints, which do. The price is durability on power loss, which this spike did not test.
- The two `FULL` grouped runs differ a lot in the tail (p99 12 ms against 28 ms; 12 against 142 commits over 20 ms). The worse one ran while the other spike was busy. The background load therefore changes the tail by more than the choice between the two commit styles does.

Limits of this test:

- Background load from the other spike was present in most runs and cannot be separated from disk behaviour. Maximum values are single events.
- The disk is a WSL2 virtual disk. It is not known whether `fsync` here reaches the physical drive, and a native disk may be faster or slower.
- The database stayed small (about 4 MB, 15,000 event rows, WAL about 4.1 MB). Checkpoint cost on a large database was not measured.
- No reader connection was open. A long-running reader can hold back checkpoints and let the WAL grow; that was not tested.
- Grouped mode kept one write transaction open for up to 20 ms. Rolling back one member of a group (savepoints) was not tested.
- `NORMAL` was run once per style, `FULL` twice.

## 4. Crash safety

A writer process looped: `BEGIN IMMEDIATE`; compare-and-swap the head row to a new revision; insert an `accepted_log` row with the next sequence number; insert an event row; `COMMIT`; then write the sequence number to stdout with a synchronous write. A parent process waited for the first acknowledgement, then sent SIGKILL after a random delay (0 to 250 ms; 15% of the kills within 5 ms). After each kill the parent reopened the database and checked it. The next writer carried on from the same database. WAL, `synchronous=FULL`, on ext4.

| | Run 1: default checkpoint (1,000 pages) | Run 2: checkpoint every 20 pages |
|---|---|---|
| Kills | 200 (all delivered as SIGKILL) | 200 (all delivered as SIGKILL) |
| Acknowledged commits in total | 2,914 | 3,137 |
| Acknowledged commits per run | p50 11, p95 39, max 50 | p50 16, p95 31, max 33 |
| `integrity_check` not ok | 0 | 0 |
| Head pointer differs from last `accepted_log` row | 0 | 0 |
| Acknowledged sequence number missing | 0 | 0 |
| Gap in sequence numbers, or broken parent chain | 0 | 0 |
| Event rows not matching `accepted_log` rows | 0 | 0 |
| Compare-and-swap failures reported by the writer | 0 | 0 |
| WAL not empty at reopen (recovery needed) | 200 of 200 | 200 of 200 |
| Database held exactly one commit more than was acknowledged | 179 of 200 | 174 of 200 |
| Database held more than one commit beyond the last acknowledgement | 0 | 0 |
| Reopen plus all checks | p50 2.0 ms, p99 4.5 ms, max 4.8 ms | p50 2.1 ms, p99 10.0 ms, max 11.9 ms |

**No violation in 400 kills.** The same test on the Windows mount (question 6) added 200 more kills, also with no violation.

One thing to design for: in 353 of 400 kills, the transaction in flight was already in the database when the writer died, but the acknowledgement had never been sent. This is correct behaviour (nothing acknowledged was lost), and it is the normal case, not a rare one, because most of each commit is spent in `fsync` after the data is already visible in the WAL. Whoever asked for that commit will not know whether it happened and must read the head again after a restart.

Limits of this test:

- SIGKILL stops the process but not the operating system. Data already handed to the kernel survives. This test therefore shows that a process crash cannot break atomicity or lose acknowledged commits. It does **not** show what happens on power loss or a crash of the virtual machine, and it cannot tell `synchronous=FULL` from `NORMAL`.
- The writer committed each transaction separately. The 20 ms grouped commit was not used here.
- Only one writer and no concurrent reader were active when the kill arrived.

## 5. Blob ingest

2,700 files of 1 MB (1,048,576 bytes) of random data, one after another. Each file was streamed in 64 KB chunks into a temporary file while being hashed with SHA-256, then renamed to `blobs/sha256/<first two hex digits>/<hash>` on the same ext4 filesystem. "fsync" below means the `flush: true` option of `fs.createWriteStream`, which calls `fsync` before closing the file.

The whole test was run twice. Sample 1 ran with a load average of about 8 from the other spike; sample 2 ran with the load average rising from 8 to 19.

| Mode | Sample | Total time | MB/s | Per file p50 | p95 | p99 | max |
|---|---|---|---|---|---|---|---|
| No fsync | 1 | 8.2 s | 329 | 2.8 ms | 3.7 ms | 4.3 ms | 228.7 ms |
| No fsync | 2 | 15.3 s | 177 | 3.4 ms | 16.8 ms | 25.6 ms | 39.0 ms |
| No fsync, plus one `sync` of the filesystem at the end | 1 | 34.6 s (8.2 + 26.4) | 78 | | | | |
| No fsync, plus one `sync` of the filesystem at the end | 2 | 17.3 s (15.3 + 2.1) | 156 | | | | |
| fsync per file | 1 | 65.9 s | 41 | 18.3 ms | 51.4 ms | 66.0 ms | 287.8 ms |
| fsync per file | 2 | 74.8 s | 36 | 21.8 ms | 61.5 ms | 81.5 ms | 139.6 ms |
| fsync per file, plus fsync of the directory after the rename (extra, not asked for) | 1 | 108.6 s | 25 | 30.3 ms | 79.4 ms | 121.2 ms | 224.4 ms |
| fsync per file, plus fsync of the directory after the rename (extra, not asked for) | 2 | 79.8 s | 34 | 24.1 ms | 64.7 ms | 82.3 ms | 155.0 ms |

In every run all 2,700 files were on disk in 256 sub-folders, no temporary file was left over, and a sample of 50 files hashed to their file names. Generating and hashing 1 MB with no disk took 0.6 to 0.9 ms, so the CPU is not the limit; the disk is.

Without fsync, the writes mostly fill memory. In sample 1 the data needed another 26 seconds to reach the disk after the last file was written, and it would have been lost in a power cut during that time.

Limits of this test:

- Both samples ran while the other spike was busy, and they differ by up to a factor of two in the modes without fsync. A 50-file trial at a quieter moment gave 97 MB/s with fsync per file, more than twice either full sample. Treat 36 to 41 MB/s as figures under load, not as the best the disk can do.
- Files were written one at a time. Parallel ingest was not measured.
- The data came from memory, not from a network upload.
- Random data cannot be compressed or deduplicated; every file was unique.

## 6. Wrong filesystem

The same database was created under `/mnt/c/Users/XZNON/AppData/Local/Temp/cr-b2b-mnt/`.

How to tell the two locations apart:

| Check | ext4 home | `/mnt/c` |
|---|---|---|
| `stat -f -c %T <dir>` | `ext2/ext3` | `v9fs` |
| `stat -f -c %t <dir>` (magic number, hex) | `ef53` | `1021997` |
| Node `fs.statfsSync(dir).type` | `0xef53` | `0x1021997` |
| Type field in `/proc/mounts` | `ext4` | `9p` |
| Full `/proc/mounts` line | `/dev/sdd / ext4 rw,relatime,discard,errors=remount-ro,data=ordered 0 0` | `C:\134 /mnt/c 9p rw,noatime,aname=drvfs;path=C:\;uid=1000;gid=1000;symlinkroot=/mnt/,cache=0x5,access=client,msize=65536,trans=fd,rfd=6,wfd=6 0 0` |

Note that `stat` calls ext4 `ext2/ext3`, because the three share one magic number. A check for the literal string `ext4` in `stat` output would fail on the correct filesystem. `/proc/mounts` does say `ext4`.

What happened with WAL mode on `/mnt/c`:

| Step | Result on `/mnt/c` |
|---|---|
| `PRAGMA journal_mode=WAL` | returned `wal`, no error |
| First commit | ok; `probe.db`, `probe.db-wal` and `probe.db-shm` appeared on the Windows drive |
| Second connection in the same process, read and write | ok |
| Second process, read and write, first process idle | ok |
| Second process while the first holds a write transaction | read ok; write failed with the normal `database is locked` (errcode 5) after the 500 ms timeout. Same as on ext4. |
| Checkpoint, `integrity_check`, close, reopen | ok; WAL and shm files removed at close |
| Reader process polling while a writer process commits, 15 s | 6,209 reads, 0 errors, 0 inconsistent snapshots, never behind an acknowledged commit, never went backwards |
| Crash test of question 4, 200 SIGKILLs | 0 violations |

**No error of any kind was seen.** The differences were in speed only:

Commit latency, same workload as question 3 (50 per second, `FULL`), 60 seconds per run, two samples of each:

| Location | Style | Sample | Load average, start to end | Commit p50 | p95 | p99 | max | Longest stall |
|---|---|---|---|---|---|---|---|---|
| ext4 | separate | 1 | 3.4 to 6.8 | 5.27 ms | 11.75 ms | 14.90 ms | 19.8 ms | see note |
| ext4 | separate | 2 | 9.3 to 9.2 | 4.84 ms | 10.54 ms | 12.83 ms | 26.9 ms | 30.7 ms |
| `/mnt/c` | separate | 1 | 2.7 to 1.3 | 5.99 ms | 15.04 ms | 28.64 ms | 92.5 ms | see note |
| `/mnt/c` | separate | 2 | 4.0 to 6.7 | 6.11 ms | 13.51 ms | 19.02 ms | 53.2 ms | 57.4 ms |
| ext4 | grouped | 1 | 6.8 to 8.2 | 5.50 ms | 11.38 ms | 14.30 ms | 25.0 ms | 26.1 ms |
| ext4 | grouped | 2 | 9.2 to 6.8 | 8.25 ms | 78.23 ms | 124.07 ms | 203.8 ms | 205.0 ms |
| `/mnt/c` | grouped | 1 | 1.4 to 3.4 | 8.55 ms | 17.90 ms | 28.36 ms | 53.6 ms | 54.7 ms |
| `/mnt/c` | grouped | 2 | 6.7 to 9.3 | 8.64 ms | 17.61 ms | 31.00 ms | 72.3 ms | 73.5 ms |

Note: sample 1 of the separate style used the earlier load generator (see question 3), so its event-loop figure is not comparable. With that generator the `/mnt/c` run once ran commits back to back for 633 ms and the ext4 run for 79 ms.

Reading: on `/mnt/c` the median commit was about 1 ms slower with separate commits and about 3 ms slower with grouped commits, and p99 was up to twice as long. But ext4 grouped sample 2, taken at a load average of 9, was worse than every `/mnt/c` run. Commit latency is therefore too noisy to tell the two filesystems apart at start-up.

Other speed differences:

| Measure | ext4 | `/mnt/c` |
|---|---|---|
| Reopen after a kill, with WAL recovery and checks (p50 / max) | 2.0 ms / 4.8 ms | 71.8 ms / 120.0 ms |
| Read transaction from a second process while a writer runs (p50 / p95 / p99) | 0.07 / 0.13 / 0.20 ms | 0.37 / 5.17 / 9.44 ms |
| Commits by a writer running flat out for 15 s with a reader polling | 2,168 | 1,275 |

Limits of this test:

- Only Linux processes inside this one WSL machine touched the file. A Windows program, or a second WSL distribution, opening the same database at the same time was **not** tried. That is the case where the WAL shared-memory file is known to be a risk, and this test says nothing about it.
- It is not known whether `fsync` on this mount reaches the physical disk. Power loss was not tested.
- The behaviour depends on the WSL version and mount options (here kernel 6.18, `cache=0x5`). An older WSL may behave differently.
- Latency runs were 60 seconds each, not five minutes.

## 7. Canonical JSON

Package: `canonicalize` 5.1.0. RFC text fetched from `https://www.rfc-editor.org/rfc/rfc8785.txt` (41,879 bytes); the test values were read out of that text by the test, not typed in, except where noted.

| Test | Result |
|---|---|
| Appendix B number table, 26 rows | 26 of 26 pass. The 24 finite values serialise exactly as the table says. The NaN and Infinity rows throw (`NaN is not allowed`, `Infinity is not allowed`), which is what the RFC requires. |
| Section 3.2.3 sorting example (7 keys, including U+20AC, U+FB33, an emoji as a surrogate pair, U+0080) | Pass. Order is Carriage Return, One, Control, Latin Small Letter O With Diaeresis, Euro Sign, Emoji: Grinning Face, Hebrew Letter Dalet With Dagesh. |
| Section 3.2.2 sample object (input typed in) against the 118 bytes printed in section 3.2.4 | Pass, byte for byte |
| 10,000 random nested objects against the reference (keys sorted by UTF-16 code units, numbers and strings through `JSON.stringify`) | 0 mismatches, 0 exceptions. Output re-parsed and canonicalised again was identical in all 10,000 cases. |

The random set held 155,878 keys and 58,219 numbers in 4.4 MB of output. 39,973 objects had non-ASCII keys, including characters above the surrogate range and surrogate pairs, which is where code-unit order and code-point order differ. Numbers included random 64-bit patterns, integers up to 2^53, values around 1e21 and 1e-7, and minus zero. Strings included control characters, quotes, backslashes, U+2028 and U+2029.

Behaviour outside the reference that is worth knowing:

| Input | `canonicalize` 5.1.0 does |
|---|---|
| Lone surrogate in a string or key | throws `Lone surrogate is not allowed` (RFC-conformant; `JSON.stringify` would escape it instead) |
| `undefined` property / function property | property is dropped |
| `undefined` in an array | becomes `null` |
| `Date` | serialised through `toJSON()` |
| `BigInt` | throws |
| `-0` | `0` |

Limits of this test:

- The reference is `JSON.stringify` itself, so this shows the package agrees with V8, not that V8 is right. The appendix B rows are the independent check on numbers.
- The random objects contained no lone surrogates, no NaN or Infinity and no non-JSON types; those were checked one by one as listed above.
- Speed was not measured in a controlled way (about 0.9 s for the 10,000 objects including the reference and the re-parse).

## 8. UUIDv7

Package: `uuid` 14.0.3. `v7` is exported.

| Test | Result |
|---|---|
| 100,000 IDs in a tight loop (262 ms, about 380,000 per second, spanning 259 different milliseconds) | all unique; every ID is greater, as a string, than the one before; sorting the strings gives the generation order; all have version 7 and a valid variant |
| 100,000 IDs in 100 batches of 1,000 with 2 ms pauses | same: all unique, 0 out of order |
| Embedded timestamp against `Date.now()` | 0 ms apart |
| Two processes generating at the same time, 2,000 IDs each, merged by wall-clock time | all unique, but 1,233 neighbouring pairs out of order. Order holds inside one process only. |
| Node's built-in `crypto.randomUUIDv7()`, 100,000 IDs in a tight loop | all unique, valid version 7, but **49,970 neighbouring pairs out of order**. Inside one millisecond its IDs are in random order. |

Limits of this test:

- One process, one run of each case. The first run of the tight loop (before a change to the script) gave the same result at about 477,000 per second.
- A system clock that jumps backwards was not simulated.
- The two-process case is given for information; one process is the design.

## What failed or had to be redone

- Nothing in the design under test failed.
- Question 3 was started once with a load generator that handled all overdue transactions in one go without returning to the event loop. It was stopped after two of its runs, and the whole set was run again with one transaction per event-loop turn. The two finished runs are kept as run A because their commit times are valid; the 7.3 s stall in the first of them is explained in question 3. The first 60-second samples in question 6 used the same earlier generator.
- Separate commits could not keep up with the extra 500 per second burst (133 per second achieved). This is a measured limit of that commit style, not an error.
- The blob test and several latency runs ran under heavy load from the other spike; no quiet-machine figures exist for them.
- The first version of the blob writer waited on a stream that never reported completion and wrote nothing; it was replaced before any result was recorded.
- The first attempt to read the RFC tables picked up the table of contents; fixed before any result was recorded.

## Cleanup

Deleted and checked as gone:

- `~/cr-b2b` in WSL (Node, npm packages, RFC text, databases, blobs, scripts, raw results).
- `/mnt/c/Users/XZNON/AppData/Local/Temp/cr-b2b-mnt` (the Windows-mount test folder).
- The Windows scratch folder `b2b-src` that held the scripts.
- Three npm debug logs that the two `npm` commands wrote to `~/.npm/_logs`.

Left in place, outside the spike folder: `npm` added the `canonicalize` and `uuid` tarballs to the shared download cache `~/.npm/_cacache`, which already existed. It was not cleared because the other spike may be using it.

`~/cutroom-spikes` was not read, written or deleted. Nothing was installed with sudo.
