# Cutroom v2 — Implementation · Environment

**Written:** 15 November 2026
**Status:** In force for the build. Work package M0-01b carries it out; `npm run env:check` re-checks it. These are build instructions, not design; where they touch the design they cite it. Revised on 15 November 2026 for U19 to U35 ([integration decisions](../lld/11-integration-decisions.md), section 17.3): there are now two environments, Windows and WSL.
**Read with:** [orchestration rules](00-orchestration.md) · [repository and conventions](01-repo-and-conventions.md) · [testing](03-testing.md) · [spend](04-spend.md)

## 1. Starting point

The build session is Claude Code on Windows, started by the user in the project folder `C:\Users\XZNON\cutroom-v2` (U19, U25), as [`handoff.md`](../../handoff.md) describes. Nothing has to be installed in WSL before M0-01b.

There are **two environments** (U26, U27):

- **Windows** runs the session, the subagents, Git, `gh`, the type check and the unit tests, straight from the working tree on NTFS.
- **WSL** runs everything that needs Linux: headless Chrome with BeginFrame, FFmpeg, the render, acceptance, claim and live tests, and every run of the product. It works on a disposable build mirror on its own ext4 disk, never on `/mnt/c`.

The machine, as checked on 15 November 2026:

| Item | State |
|---|---|
| System | Windows 11, WSL2, Ubuntu 22.04.5 LTS, kernel 6.18.58.1-microsoft-standard-WSL2, glibc 2.35 |
| CPU and memory | 16 threads; 15.3 GB in the machine; 11,961 MB visible to WSL (12 GB set in `.wslconfig`); 3,072 MB swap |
| Disk | WSL home on ext4, about 950 GB free |
| Windows: present | Node 22.23.4 through nvm-windows (`C:\nvm4w\nodejs`; 22.14.0 and 20.18.0 also installed), npm 10.9.9; Git 2.47.0.windows.2, whose system configuration sets `core.autocrlf=true`; `gh` 2.97.0, logged in to an account that is admin on the repository with the `repo` and `workflow` scopes ([target repository](research/target-repo-state.md), section 1) |
| Windows: absent | Node 26 |
| WSL: present | `git`, `python3`, `rsync` 3.2.7, fontconfig 2.13.1 with 20 system font files (DejaVu, Ubuntu) |
| WSL: absent | Node, FFmpeg, `chrome-headless-shell`; `libnss3`, `libnspr4`, `libasound2` |
| Trap | The `npm` on the WSL `PATH` is the Windows one, through `/mnt/c`. It must never run in WSL |

Three rules govern what follows.

1. **No sudo on the main path,** as in every spike. A sudo route is given only where it is simpler, for when the user is present to type the password.
2. **Tools live in ignored folders that belong to the build** (standing rule 9): on Windows, `.tools\` in the project folder, which holds only the Windows Node; in WSL, the WSL tool folder on ext4 (section 2). Nothing is installed globally, and the machine's nvm-windows selection is not changed. Never run `git clean -x` or `-X` in the project folder: it deletes `.tools\`, and also `.env` and the v3.1 archive, which are ignored too. The guard hook refuses both (L21).
3. **No value is guessed.** M0-01b looks up each version and hash at build time and records it in `tools/pins.json` (section 9). Versions quoted below are what the spikes used, for reference, not pins.

## 2. Layout

```
Windows (NTFS)
C:\Users\XZNON\cutroom-v2\         the project folder, the one working tree (U19)
  tools\                 committed: env.sh, pins.json, fonts.conf, the env-check, install and sync scripts, context\,
                         models\ (the pinned ONNX export script, M5-03; L38)
  .tools\                ignored:   node-win\ (Windows Node 26)  archives\ (its zip and SHASUMS256.txt)
  .env                   ignored:   the API keys (section 8)

WSL (ext4)
~/.cutroom-build/main/   the main working tree's build mirror (L45)
~/.cutroom-build/<worktree name>/  one build mirror per Git worktree (U26; L19; L45): synced source, Linux
                         node_modules/, build output. Disposable
~/.cutroom-build/.tools/ the WSL tool folder, written <tools> below (L19): node/ browsers/ chrome-libs/ ffmpeg/ fonts/
                         fontconfig-cache/ npm-cache/ archives/ (every download, kept with its hash)  the render lock
~/cutroom-space/         the Space (section 7)
```

Kept archives allow a rebuild even if an upstream file changes under the same name.

**The WSL tool folder** holds the pinned Linux tools. Its path is `~/.cutroom-build/.tools` (L19); this document writes `<tools>` for it. It sits on ext4 beside the mirror folders and outside every one of them, so deleting a mirror never deletes the pinned tools, their archives or the render lock.

**The build mirrors** (U26; L19). Headless Chrome with BeginFrame and the product's run time work only on Linux, and WSL's access to the Windows drive (`/mnt/c`, a `9p` mount) is slow and unsafe for SQLite ([batch 2b](../research/evidence/b2b-sqlite-node.md), section 6). So WSL keeps disposable mirrors of the working tree under `~/.cutroom-build/`, one per Git worktree, the main working tree's included. The folder names are fixed (L45): the main working tree syncs to `~/.cutroom-build/main/`, and each Git worktree to `~/.cutroom-build/<worktree name>/`.

- **`npm run wsl:sync`,** started on Windows in a worktree, refreshes that worktree's mirror through `wsl.exe` with one `rsync` of the working tree as it is, uncommitted changes included, from its `/mnt/c` path (for the main working tree, `/mnt/c/Users/XZNON/cutroom-v2/`). It honours `.gitignore`, so `.env`, the v3.1 archive, `node_modules`, build output (`dist/`), `.tools/` and `.worktrees/` are left out, and it also leaves out `.git` (L19). Files deleted in the working tree are deleted in the mirror; the mirror's own `node_modules` and build output are kept.
- After the copy, the mirror runs its own Linux `npm ci` when `package-lock.json` changed, and the build. Native packages that Windows `npm` installed (Biome's binary, for example) do not run on Linux, which is why `node_modules` is never synced.
- **Nobody edits the mirror.** It can be deleted and recreated at any time. It is not a second copy of the project: every change is made in the working tree and reaches the mirror only by `wsl:sync`.
- The mirror holds no `.env` and no `.git`. The keys are read from the Windows file (section 8).
- A work package's new files reach the mirror before they are committed, because the sync copies the working tree as it is (L19). Each worktree has its own mirror folder, with its own `node_modules`, so parallel work packages never overwrite each other's source; render, acceptance and claim runs from different worktrees never run at the same time, because they take the render lock (section 10; L19).

M0-01b measures how long the sync and the mirror's install and build take, beside the two other layouts ([testing](03-testing.md), section 1).

## 3. Node 26 LTS

**One release on both sides.** M0-01b takes the newest 26.x release marked LTS from the nodejs.org release index and installs that same version on Windows and in WSL, so the two environments and GitHub Actions run one Node.

### 3.1 WSL

**Install without sudo.** Batch 2b verified this route: the official Linux x64 tarball, checked against the `SHASUMS256.txt` beside it (`latest-v26.x/`), which gave Node 26.13.1 with `node:sqlite` loading without a flag ([evidence](../research/evidence/b2b-sqlite-node.md), "Environment and versions"). M0-01b downloads the tarball and `SHASUMS256.txt` into `<tools>/archives/`, verifies it, unpacks it into `<tools>/node/`, and records the version, the npm version, the tarball's SHA-256 and the `node` binary's SHA-256.

A per-user version manager is the other no-sudo route; no spike used one, and it edits the shell profile, so it is not used (A:env-1). A system package is a global install, which rule 9 forbids.

**Confirm:**
- `node -v` prints 26.x; `node -p process.release.lts` prints a codename.
- `node -p process.versions.sqlite` is at least 3.51.3, which R5 requires at start-up (lld/06 §2.1).
- `node -p process.platform` prints `linux` (the Windows Node prints `win32`).
- `command -v node npm npx` resolve inside `<tools>/node/bin`. Anything under `/mnt/` fails.

**The PATH.** `tools/env.sh` prepends `<tools>/node/bin` and `<tools>/ffmpeg/bin`, sets `npm_config_cache` to `<tools>/npm-cache`, and drops every `PATH` entry under `/mnt/`, so the Windows `npm` cannot be reached. It sets nothing Chrome or FFmpeg read: the render code starts them with an explicit environment (4.3). Every WSL command, each started from Windows by `wsl.exe`, sources it first: every `wsl.exe` call runs `bash -c '. tools/env.sh && …'` in the mirror, from inside the npm or `tools/` scripts. No interactive WSL shell is used and nothing is added to `~/.bashrc` (A:env-2).

### 3.2 Windows

**What is there.** Node 22.23.4 is active through nvm-windows, which switches one machine-wide link (`C:\nvm4w\nodejs`) for every program of the user (checked 15 November 2026). Running `nvm install` and `nvm use` for Node 26 would change the Node of everything else on the machine, which standing rule 9 forbids without the user's agreement.

**Install without touching it.** M0-01b downloads the official Windows x64 zip of the same 26.x release and its `SHASUMS256.txt` into `.tools\archives\`, verifies the hash, unpacks it into `.tools\node-win\`, and records the version, the npm version, the zip's SHA-256 and the `node.exe` SHA-256 in `pins.json` (`node_windows`). This mirrors the WSL route and stays inside the project folder. The build's Windows commands (`npm run check`, `npm test`, `npm run wp-context`, `npm run wsl:sync`) run with `.tools\node-win\` first on the `PATH`, put there by the same wrapper scripts that start every build command (A:env-2). The alternative, `nvm use`, would switch Node for every program on the machine and needs the user's agreement, so it is not taken (A:env-1).

**Confirm:** `node -v` prints the same 26.x as WSL; `node -p process.platform` prints `win32`; `node -p process.versions.sqlite` matches the WSL value; `where node` lists `.tools\node-win\node.exe` first.

**The guard hook's Node.** Claude Code starts the guard hook with whatever `node` it finds on the Windows `PATH`, which today is nvm's Node 22.23.4, not the build's Node 26 (ASSUMED until M0-01a checks it). The hook therefore uses built-in modules only, and its tests also run under that Node (M0-01a).

## 4. chrome-headless-shell

### 4.1 Build and install

`chrome.build_id` is 157.0.8103.78, the build every spike used, and a `human` setting (lld/03 §2.8, §5; G15 class (e)). If it can no longer be downloaded, the orchestrator stops and asks the user.

All of section 4 happens in WSL. S7 recorded what worked: `@puppeteer/browsers` 3.2.7 with `yauzl` 3.4.0, and `puppeteer-core` 25.17.0 launching with `headless: 'shell'` ([evidence](../research/evidence/s7-pixi-hardening-follow.md), "Setup"). M0-01b pins both packages exactly. The design names no version for them, so the implementer chooses; S7's pair, 25.17.0 and 3.2.7, is the safer choice, as the pair recorded driving build 157.0.8103.78 (A:M0-8). It installs `chrome-headless-shell@157.0.8103.78` into `<tools>/browsers/` through the package's `install` command (`--path`) or `install()` function (S7's exact invocation is not recorded), and adds `yauzl` if extraction fails for want of an unzip library. It records the SHA-256 of the archive (R2 requires the archive hash, lld/03 §2.8), of the binary, and a tree hash over the whole install directory, since a changed resource or library file can change pixels too. `puppeteer-core` is always given the binary's path, so no browser cache in the home directory is used.

### 4.2 Missing shared libraries

S1c found that a stock WSL Ubuntu lacks `libnss3`, `libnspr4` and `libasound2` ([evidence log](../research/10-spike-evidence-log.md), S1c); today's `dpkg -l` confirms it. `ldd <binary> | grep "not found"` lists what is missing.

**Without sudo** (S7's recipe):

```
cd <tools>/chrome-libs
apt-get download libnss3 libnspr4 libasound2
for d in *.deb; do dpkg-deb -x "$d" root; done
```

Chrome then gets `LD_LIBRARY_PATH` pointing at `root/usr/lib/x86_64-linux-gnu`, in its own environment only, and `ldd` with that variable must find everything. S7 used libnspr4 2:4.35-0ubuntu0.22.04.1, libnss3 2:3.98-0ubuntu0.22.04.5 and libasound2 1.2.6.1-1ubuntu1.2. M0-01b records the versions it gets (`dpkg-deb -f <file> Version`) and the SHA-256 of each `.deb` and each extracted library. `apt-get download` uses the package lists that only `sudo apt-get update` refreshes; if a listed version has left the mirror, ask the user for the sudo route.

**With sudo:** `sudo apt-get install libnss3 libnspr4 libasound2`; no `LD_LIBRARY_PATH`. M0-01b records `dpkg-query -W` versions and the same library hashes, so `pins.json` has one shape either way.

### 4.3 Launch flags and environment

The set R2 gives (lld/03 §2.8, marked illustrative there; the seven BeginFrame flags are S4's):

```
--remote-debugging-pipe --enable-begin-frame-control --run-all-compositor-stages-before-draw
--disable-new-content-rendering-timeout --disable-threaded-animation --disable-threaded-scrolling
--disable-checker-imaging --disable-image-animation-resync
--force-webrtc-ip-handling-policy=disable_non_proxied_udp --force-color-profile=srgb
--font-render-hinting=none --hide-scrollbars --mute-audio --disable-background-networking
--user-data-dir=<fresh temporary directory on ext4>
environment: FONTCONFIG_FILE=<tools/fonts.conf>  TZ=UTC  (+ LD_LIBRARY_PATH without sudo)
```

- The flags are in the environment hash and are `human` (G15 class (e)); the list fixed at M1 changes only on the user's word.
- `--no-sandbox` is never used (lld/03 §2.7). If Chrome will not start with its sandbox, report it; do not add the flag. Ubuntu 22.04 needs no AppArmor profile (lld/10 §5).
- No network interface: S4 launched Chrome without sudo in an empty network namespace (`unshare --user --map-user --map-group --net`, as recorded) and capture ran normally ([evidence](../research/evidence/s4-render-host.md), section D).
- `TZ=UTC` matters: S7 saw the machine's time zone in `Date()` strings.
- Rendering is software. S4 saw `gpu_compositing: disabled_software` with SwiftShader; M0-01b records this as the raster mode.

## 5. FFmpeg

**What the design needs:** a GPL build with **libx264**, the native **`aac`** encoder, and every part these chains name.

| Chain | Needs | Design |
|---|---|---|
| Encode | `image2pipe`; `png` and `mjpeg` decoders; `scale` (`in_color_matrix`, `out_color_matrix`, `out_range`, `accurate_rnd+full_chroma_int`), `format`, `setparams`; `-flags +cgop`; colour options; mp4 | lld/03 §2.9 |
| Concat, mux | `concat` demuxer, `-c copy`; mp4 `+faststart`; `aac` | lld/03 §2.9; batch 2a |
| Extraction | `-fps_mode passthrough`; `mjpeg` and `png` encoders | lld/03 §2.11 |
| Mix, master | `atrim`, `volume`, `afade`, `adelay`, `amix`, `asplit`, `sidechaincompress`, `apad`, `ebur128`, `aresample`, `alimiter`; float and 24-bit WAV | lld/08, mix steps 1–6 |
| Checks | `blackdetect`, `freezedetect`, `silencedetect`, `ebur128=peak=true`; `ffprobe` fields and frame counts; `-ignore_editlist` | lld/09 M-01–M-04, F-01–F-09 |

FFmpeg exists only in WSL. M0-01b turns the table into a script over `ffmpeg -encoders`, `-decoders`, `-filters`, `-muxers`, `-demuxers` and `-h full` that fails on any missing item, then encodes three frames with R2's final command and reads all four colour fields back with `ffprobe`: batch 2a found FFmpeg 8.1.1 silently dropping two of them ([evidence](../research/evidence/b2a-colour-mux-mix.md), finding 1).

**Obtaining a build without sudo:** a static Linux x64 build unpacked into `<tools>/ffmpeg/`. The spikes used FFmpeg 8.1.1 (gyan.dev "full", libx264 core 165) **on Windows** for the colour chain, mux offset, segment join and spike M1, and a BtbN static linux64 GPL development snapshot (`N-128889-g88c46fce27-20261113`) **in WSL** for S4's encode timings. No Linux build has yet run the colour and mux measurements. **The exact build is chosen and recorded at M0-01b, once the feature check passes,** preferring a release build of the measured 8.1 line over a snapshot. M0-01b records the `ffmpeg -version` line, the configuration line, the libx264 core, the archive's SHA-256 and the SHA-256 of `ffmpeg` and `ffprobe`. The encoder version is in the rung settings bundle and the FFmpeg build in the `audio.mix` work key (lld/03 §2.9; lld/05 D6); R2's colour patches are re-checked whenever it changes.

**With sudo:** Ubuntu's `ffmpeg` package. Not recommended: it is from an older series than 8.1 (ASSUMED; see `apt-cache policy ffmpeg`) and must pass the same check.

## 6. Fonts

**The set** is R2's (lld/03 §2.10): Inter; Noto Sans and Noto Serif; JetBrains Mono; Noto Sans CJK and Noto Serif CJK; Noto Sans Arabic and Noto Naskh Arabic; Noto Color Emoji; Noto Sans Hebrew, Noto Sans Math and Noto Sans Symbols 2. Their SIL OFL 1.1 licence is VERIFIED by source for the families R2 links and ASSUMED for the rest, so M0-01b reads each licence file first (lld/03 §8). S4 used Inter 4.1 (`Inter-Regular.ttf`, GitHub release).

**Install** (in WSL). Each family comes from its project's release into `<tools>/archives/`, its files into `<tools>/fonts/`. M0-01b records each file's SHA-256, family and style (as fontconfig reports them), source and licence. Versions, weights and file types are the implementer's choice, since they touch no interface: R3's `font` records are made from what is installed (A:env-4). Recommended: each family's latest release on the day; static files where the project ships them (S4 used a static `Inter-Regular.ttf`, and static files make weight matching exact); at least weights 400 and 700, with italics where they exist. G15 class (e) makes any later font change the user's, so the M0 report states the chosen set plainly.

**Private fontconfig.** `tools/fonts.conf` lists only `<tools>/fonts/`, naming it relatively if fontconfig 2.13.1 allows it, so that no machine path enters the environment hash (A:env-3), keeps its cache in `<tools>/fontconfig-cache/`, aliases the generic families (recommended: `sans-serif` → Inter, then Noto Sans; `serif` → Noto Serif; `monospace` → JetBrains Mono; each followed by the fallbacks for CJK, Arabic, Hebrew, emoji, maths and symbols; A:env-4) and forces greyscale anti-aliasing with hinting off, as R2 requires. It includes nothing from `/etc/fonts`, so today's 20 system fonts stay hidden. Chrome reads it through `FONTCONFIG_FILE`.

**Check.** `FONTCONFIG_FILE=tools/fonts.conf fc-list` lists exactly the pinned files, and `fc-match` on each generic family returns its alias. That Chrome draws only these fonts is part of `R2-S9` at M1 (`CSS.getPlatformFontsForNode`, lld/03 §2.10).

## 7. The Space

The Space is `~/cutroom-space`, on the WSL ext4 disk (lld/04 §2.6, C6), never under `/mnt/c` and never inside the build mirror, so deleting the mirror cannot touch it. Start-up finds the mount holding the Space in `/proc/mounts` and refuses `9p`, which is how the Windows drive appears: batch 2b found that SQLite there raises no error, only slower commits and reopens ([evidence](../research/evidence/b2b-sqlite-node.md), section 6). From the same section: `stat -f -c %T` prints `ext2/ext3` for ext4, so do not match on `stat` output; `fs.statfsSync(dir).type` gives `0xef53` for ext4 and `0x1021997` for the Windows mount. Tests create Spaces with `fs.mkdtemp` under the system temporary directory, through the same check. In WSL that directory is on ext4; on Windows, where `npm test` also runs, it is on NTFS and there is no `/proc/mounts`. So unit tests inject the mounts table, and a test that needs the real one is a `*.linux.test.ts` file, run by `npm run test:linux` in WSL ([testing](03-testing.md), section 10, point 11; L18). A test of the refusal points the Space at a path under `/mnt/c` that does not exist: the check reads `/proc/mounts` and the nearest existing ancestor and writes nothing, so the path still does not exist afterwards (A:env-5).

## 8. The API keys

- **File:** `C:\Users\XZNON\cutroom-v2\.env`, at the project root (U23). It holds `MINIMAX_API_KEY` (the model calls) and `OPENROUTER_API_KEY` (the voice engine, U17). `.gitignore` lists it; Git never tracks it; the bootstrap shows it untracked before the first push, `npm run check` fails if it is ever tracked, and the guard hook refuses any command that would add it to Git or print or copy it.
- **In WSL** the same file is `/mnt/c/Users/XZNON/cutroom-v2/.env`. The product and the tests find it through the environment variable `CUTROOM_ENV_FILE`, which holds that path and never a key (L19; U26). The file is never copied into the mirror: `.gitignore` lists it, so `wsl:sync` leaves it out. Nothing runs on Windows that needs a key, because every live call and every run of the product happens in WSL.
- **Only the model and speech transports read it,** when building a request (lld/07 D6.6, item 8), each parsing its own `MINIMAX_API_KEY=` or `OPENROUTER_API_KEY=` line itself. Nothing sources the file into a shell, puts a key in an environment variable or on a command line (visible in `/proc`), or hands it to a child process.
- A key is never printed, logged, echoed, copied (into Git, the mirror, a fixture, a recording, an issue, a pull request, a workflow or an Actions secret), or sent anywhere but its provider's endpoint, MiniMax's or OpenRouter's (standing rule 3). Recordings drop the authorisation header before storage ([testing](03-testing.md), section 2). GitHub Actions never has a key.
- `env:check` reports each key only as `present` or `absent`; when present, it scans tracked files, recordings and the mirror for the value and names any file containing it, never the value. A missing key fails only `npm run test:live`.
- **Nothing under `C:\Users\XZNON\Cutroom` is read, used or touched** (U23). That folder is not part of this project.
- From WSL, the build only reads the Windows drive, in two ways: `wsl:sync` reads the working tree, and the transports read this file. WSL never writes there, except M0-01b's timing measurement in a throwaway worktree inside the project folder ([testing](03-testing.md), section 1).

## 9. The pins file and `env:check`

`tools/pins.json` is the single record of both environments, with `snake_case` keys. M0-01b fills every value by measurement:

```json
{ "schema": 1,
  "os":     {"distro": "…", "kernel": "…", "glibc": "…", "fontconfig": "…", "raster_mode": "…"},
  "node":   {"version": "…", "npm": "…", "tarball_sha256": "…", "binary_sha256": "…", "sqlite": "…"},
  "node_windows": {"version": "…", "npm": "…", "zip_sha256": "…", "binary_sha256": "…", "sqlite": "…"},
  "chrome": {"build_id": "157.0.8103.78", "archive_sha256": "…", "binary_sha256": "…", "tree_sha256": "…",
             "libraries": [{"package": "…", "version": "…", "deb_sha256": "…", "files": {}}]},
  "ffmpeg": {"version_line": "…", "configuration": "…", "x264_core": "…", "archive_sha256": "…",
             "ffmpeg_sha256": "…", "ffprobe_sha256": "…"},
  "fonts":  {"fonts_conf_sha256": "…", "files": [{"file": "…", "family": "…", "style": "…",
             "sha256": "…", "source": "…", "licence": "…"}]} }
```

**`npm run env:check`** fails with the entry, the expected and the actual value on any difference. In WSL, on the mirror, it checks that:
1. `node`, `npm` and `npx` resolve inside `<tools>/node/bin`, the platform is `linux`, and the Node version, binary hash and SQLite version match;
2. the Chrome hashes match, and `ldd` with Chrome's environment finds every library, whose hashes match;
3. the FFmpeg hashes and version line match, and the feature list of section 5 is complete;
4. `fonts.conf` and every font file match, and `fc-list` under it lists exactly the pinned files;
5. the Space, if it exists, is not on `9p`, and the mirror itself is on ext4;
6. and it reports each key's presence, the memory total and R5's browser pool size.

On Windows, `env:check` checks only `node_windows`: that `node` resolves to `.tools\node-win\`, the platform is `win32`, and the version and binary hash match. This split is this document's choice.

**Speech model files** (L10, L27 revised, L38). The word aligner (a wav2vec2-base model, Apache-2.0) and the transcript model (Whisper `small.en`) run locally in Node through ONNX. Published ONNX conversions often state no licence, so the build does not use them: the two ONNX files are exported once from the original weights (Apache-2.0 and MIT) by a pinned export script under `tools/models/`, and the exported files are pinned by hash in `pins.json`, never committed. The export is a one-time set-up step, the first task of M5-03, run in WSL: the script runs in a throwaway Python virtual environment inside `<tools>`, with its packages pinned, using the `python3` already present in WSL (section 1). Later set-ups check the hash and skip the export when the files are present. This Python is a set-up tool only; the product's run time stays Node, and no Python worker is built. That both models run on Linux in WSL is ASSUMED (the spike ran on Windows) and is checked by the first M5 work package; the fallback is the WASM backend.

`env:check --launch` also captures one BeginFrame in an empty network namespace. M0-01b runs both forms. `test:render`, `test:accept` and `test:claims` run `env:check` first and refuse to start if it fails.

**The environment hash** covers the Chrome build, its flags and environment variables, the operating-system image and raster mode, the font files and `fonts.conf`, the shim and host bundle versions, the rung settings bundle (with the encoder version), `capture.warmup_frames` and `canvas.max_backing_pixels` (lld/03 §2.8; FR15, G8). `pins.json` supplies the machine half; code and settings supply the rest. The "operating-system image" is defined by content, not by version strings or paths (A:env-3): the distribution ID and `VERSION_ID`, the glibc version, the raster mode, and the SHA-256 of every shared library that `ldd` resolves for `chrome-headless-shell` under its launch environment, which M0-01b records under `os`. The kernel is recorded for diagnosis but left out of the hash, because a Windows update can change the WSL kernel. No path enters it: a path-valued flag is hashed as a fixed token (`--user-data-dir=<tmp>`), `LD_LIBRARY_PATH` counts through the hashes of the libraries it supplies, and `FONTCONFIG_FILE` through the hash of `fonts.conf`, which names its directories relatively if fontconfig 2.13.1 allows it (M0-01b checks) or else is hashed with the tool-folder path replaced by a token. A laptop and a VM can then share work keys; the qualification run below stays the safety net for anything left out. A missing environment record is R4's `ENV_UNREGISTERED` (lld/05). A changed pin changes every render work key, and a Chrome upgrade first passes a qualification run against reference frames (lld/03 §2.8). After M0-01b, changing the Chrome build, its flags or the fonts goes to the user (G15 class (e)); other pin changes are recorded in the pull request that makes them.

## 10. Memory and concurrency

- **Measured:** one render browser about 920 MB resident with 15 components; four 3.6 GB; six 5.4 GB (S4). One PixiJS browser keeps about 10 threads busy (S7).
- **The design:** R5's pool is `min(browser.max, floor((total − mem.reserve_mb) / browser.mem_budget_mb))` = `min(6, floor(7,961 / 950))` = 6 here. No browser lease below `mem.low_water_mb` (1,500 MB) available; below `mem.critical_mb` (700 MB) the newest capture is killed and retried (lld/06 §2.8). The guard is on in tests.
- **The build adds:** the orchestrator and up to four subagents now run on Windows, outside WSL's 12 GB but on the same 15.3 GB machine, together with Windows-side `check` and `npm test` runs; their use is unmeasured. **Only one render, acceptance or claim run at a time on the machine:** those commands take an exclusive file lock in the WSL tool folder, shared by every mirror and worktree, and a second run waits, so render tests from different worktrees never run at the same time (L19). Unit tests may run in parallel. Timing claims run with nothing else heavy running, because background load moved the figures in batch 2b and S7.
- **If WSL runs out of memory** (a Chrome or Node process killed by signal 9, or WSL stopping): it is an environment fault, not a test result. Kill any `chrome-headless-shell` started from `<tools>/`, check `free -m`, re-run the test alone. If it recurs, record it in the work package's issue and run render work with no subagent active. Never edit `.wslconfig`: it is on the Windows drive, and more memory is the user's decision. A WSL restart no longer ends the session, which runs on Windows; it ends any render run and any Space process, and the mirrors, the tool folder and the Space survive on the ext4 disk. Re-run what was interrupted. M3's abrupt-stop drill terminates WSL on purpose, so it runs with nothing else using WSL (L1; M3-10).

## 11. Known pitfalls

| Pitfall | What to do | Evidence |
|---|---|---|
| `wsl.exe` writes its own messages in UTF-16 (a NUL after each character) | `tr -d '\0'`; this now matters on every Linux step, since Windows drives WSL for all of them | No evidence file. Seen on 15 November 2026, twice: a `wsl.exe` warning arrived in UTF-16 |
| Two tabs in one headless window: the background tab gets no frames and capture hangs | One page per browser (lld/03 §2.8) | S1, [evidence log](../research/10-spike-evidence-log.md) (Windows) |
| `@puppeteer/browsers` needed an unzip library | Add `yauzl` | [S7](../research/evidence/s7-pixi-hardening-follow.md), "Setup" (records the pairing, not the error) |
| `/mnt/c` is `9p`; SQLite there fails silently | The working tree stays on NTFS and reaches WSL only through `wsl:sync`; the mirror, the tool folder, the Space and temporary files are on ext4; refuse `9p` | [Batch 2b](../research/evidence/b2b-sqlite-node.md), section 6 |
| The Windows `npm` is on the WSL `PATH` | `env.sh` drops `/mnt/`; `env:check` fails on it | Machine check, 15 November 2026 |
| Git for Windows sets `core.autocrlf=true` in its system configuration | `.gitattributes` with `* text=auto eol=lf` and `*.png binary`, added at the bootstrap; `git ls-files --eol` shows LF | Machine check, 15 November 2026 |
| Native packages installed by Windows `npm` (Biome's binary, for example) do not run on Linux | Never sync `node_modules`; the mirror runs its own `npm ci` | General knowledge, [study](research/knowscroll-workflow.md), "Where each kind of test should run" |
| `nvm use` switches the machine-wide Node | The build uses `.tools\node-win\`; never run `nvm use` | Machine check, 15 November 2026 |
| `git clean -x` or `-X` deletes ignored files | Never run either: it would delete `.tools\`, `.env` and the v3.1 archive. The guard hook refuses both (L21) | Git behaviour |
| FFmpeg 8.1.1 dropped two colour tags silently | Keep `setparams`; read all four tags | [Batch 2a](../research/evidence/b2a-colour-mux-mix.md), finding 1 |
| Background load moves timings | Run timing claims alone | Batch 2b; S7 |

## 12. What is ASSUMED

No spike did these; each is checked where named.

**WSL side**
- Node in `<tools>/node/` reached through `tools/env.sh`, and every WSL command sourcing it (M0-01b). Batch 2b used the same tarball elsewhere.
- A per-user version manager, if chosen instead.
- The exact `@puppeteer/browsers` invocation, whether it still needs `yauzl`, and that build 157.0.8103.78 is still downloadable (M0-01b).
- That `apt-get download` still finds the three libraries in the current package lists (M0-01b).
- That a static Linux FFmpeg matches the Windows 8.1.1 colour and mux results (M1 tests), and that Ubuntu's package is too old.
- That a private `fonts.conf` hides system fonts from Chrome (R2's own ASSUMED claim, `R2-S9`, M1).
- That Chrome's raster mode can be read over the DevTools protocol, as S4's report suggests (M0-01b).
- That the system temporary directory in WSL is on ext4 (the Space check catches it).
- That an incremental `rsync` from `/mnt/c` into the mirror is quick enough to run before every WSL test command, and that reading one small `.env` through `/mnt/c` is reliable (M0-01b measures the sync).
- That `rsync`'s filter rules can honour `.gitignore` as Git reads it, so that an uncommitted new file is copied and an ignored one is not (M0-01b's test checks both).
- That the speech model files of L10 run on Linux in WSL (the first M5 work package checks it; the fallback is the WASM backend).

**Windows side**
- That the official Windows zip of Node 26, run from `.tools\node-win\`, gives the same `check` and `npm test` results as Linux Node 26. GitHub Actions on Ubuntu is the standing cross-check.
- That `check` and `npm test` are faster on Windows-native Node than on the mirror or on `/mnt/c`. This is the reasoned default of U27, not a measurement; M0-01b measures it ([testing](03-testing.md), section 1).
- That the product's code and unit tests can stay platform-neutral enough to pass on `win32` and `linux` alike ([testing](03-testing.md), section 10, point 11).
- That `.gitattributes` keeps every text file LF in the Windows checkout despite `core.autocrlf=true`, so canonical-JSON hashes, recordings and fixtures match across the two environments (the bootstrap checks it with `git ls-files --eol`).
- That Claude Code starts the guard hook with the Node on the Windows `PATH` (today nvm's 22.23.4), and that a hook added during a session takes effect without a restart. If Claude Code needs a restart or an approval to load it, the session stops and asks the user (L21; orchestration §7, §9).
- That the organisation's GitHub Free quota (about 2,000 Actions minutes a month, shared, Linux jobs billed per job rounded up to the minute) covers one small job per pull request. General knowledge from the [study](research/knowscroll-workflow.md); billing was not queried.
- The memory that Claude Code's own processes use on Windows.

## 13. Resolved points

Every point this document raised is closed by section 18 of the [integration decisions](../lld/11-integration-decisions.md). Points 1 to 5 carry the classes of `impl/research/open-points-A.md` (rows `A:env-1` to `A:env-5`); points 6 to 9 were raised after that report and are decided by the lead's ruling L19.

| # | Point | Resolution |
|---|---|---|
| 1 | **Node route** | Overtaken (A:env-1) by U19 and U25 to U27: there is no WSL repository, and one Node 26 release is installed twice, the Linux tarball in the WSL tool folder and the Windows zip in `.tools\node-win\` (section 3). nvm-windows would switch Node for every program on the machine and would need the user's agreement; the zip needs nothing and is the route taken |
| 2 | **How every command gets the build's Node** | Overtaken (A:env-2) by U25 and U26: no interactive WSL shell is used and Claude Code is not installed in WSL, so neither a `~/.bashrc` line nor a second WSL Node arises. What remains is left to the implementer, as it touches no design: every `wsl.exe` call runs `bash -c '. tools/env.sh && …'` in the mirror from the npm or `tools/` scripts, the same wrapper puts `.tools\node-win\` first on the Windows `PATH`, and `env:check` on each side proves which Node ran (section 3) |
| 3 | **The machine half of the environment hash** | Decided (A:env-3): the operating-system image is defined by content (distribution ID and `VERSION_ID`, glibc, raster mode, and the hash of every library `ldd` resolves for Chrome); the kernel is recorded but not hashed; no path enters the hash (section 9; M0-01b, M1-04) |
| 4 | **Fonts** | IMPLEMENTATION DETAIL (A:env-4), left to the implementer: the design fixes the family set, the private `fonts.conf`, the licence check and pinning by file hash (R2 §2.10), and which release, weights and file type are pinned touches no interface. The recommendation and the aliases are in section 6; the M0 report states the chosen set, because G15 class (e) makes any later change the user's |
| 5 | **Testing the `9p` refusal** | IMPLEMENTATION DETAIL (A:env-5), left to the implementer: the check reads `/proc/mounts` and the nearest existing ancestor and writes nothing, so pointing the Space at a path that does not exist proves refusal before any write. Unit tests inject the mounts table; M0's acceptance item 5 uses a non-existent path inside the project folder (section 7) |
| 6 | **Where the WSL tool folder lives** | Decided (L19): `~/.cutroom-build/.tools`, on ext4, beside the mirror folders and outside each of them (section 2) |
| 7 | **What `wsl:sync` copies** | Decided (L19): the working tree as it is, uncommitted changes included, honouring `.gitignore`; `.git` is never copied (section 2) |
| 8 | **Parallel worktrees and one mirror** | Decided (L19, L45): each Git worktree syncs to its own mirror folder under `~/.cutroom-build/` (the main working tree to `main/`, a worktree to `<worktree name>/`); render tests from different worktrees never run at the same time, which the render lock enforces (sections 2 and 10) |
| 9 | **The name of the key-file variable** | Decided (L19): `CUTROOM_ENV_FILE`, holding the path of `C:\Users\XZNON\cutroom-v2\.env` as WSL sees it, never a key (section 8) |
