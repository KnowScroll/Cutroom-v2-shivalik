// Design: impl/02 §5 (what the design needs from FFmpeg); lld/03 §2.9; batch 2a finding 1
// Turns the table of impl/02 §5 into a check over `ffmpeg -encoders`, `-decoders`, `-filters`, `-muxers`,
// `-demuxers` and `-h` output that names every missing item, then encodes three frames with R2's final
// command and reads all four colour fields back with ffprobe: FFmpeg 8.1.1 silently dropped two of them.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

export const REQUIRED = {
  encoders: ["libx264", "aac", "mjpeg", "png", "pcm_f32le", "pcm_s24le"],
  decoders: ["png", "mjpeg"],
  muxers: ["mp4", "image2pipe", "wav", "null"],
  demuxers: ["concat", "image2pipe", "mov"],
  filters: [
    "scale",
    "format",
    "setparams",
    "atrim",
    "volume",
    "afade",
    "adelay",
    "amix",
    "asplit",
    "sidechaincompress",
    "apad",
    "ebur128",
    "aresample",
    "alimiter",
    "blackdetect",
    "freezedetect",
    "silencedetect",
  ],
  // [arguments to ffmpeg, words that must appear in the help text]
  help: [
    [
      ["-h", "filter=scale"],
      ["in_color_matrix", "out_color_matrix", "out_range", "accurate_rnd", "full_chroma_int"],
    ],
    [["-h", "filter=ebur128"], ["peak"]],
    [["-h", "muxer=mp4"], ["faststart"]],
    [["-h", "demuxer=mov"], ["ignore_editlist"]],
    [
      ["-h", "full"],
      ["cgop", "fps_mode"],
    ],
  ],
};

const LISTS = {
  encoders: { args: ["-hide_banner", "-encoders"], pattern: /^\s*[A-Z.]{6}\s+(\S+)/ },
  decoders: { args: ["-hide_banner", "-decoders"], pattern: /^\s*[A-Z.]{6}\s+(\S+)/ },
  filters: { args: ["-hide_banner", "-filters"], pattern: /^\s*[A-Z.]{2,3}\s+(\S+)/ },
  muxers: { args: ["-hide_banner", "-muxers"], pattern: /^\s*[DE ]{2}\s+(\S+)/ },
  demuxers: { args: ["-hide_banner", "-demuxers"], pattern: /^\s*[DE ]{2}\s+(\S+)/ },
};

/** Names listed in the output of an `ffmpeg -encoders` style command. */
export function parseNames(text, pattern) {
  const names = new Set();
  for (const line of text.split("\n")) {
    const match = pattern.exec(line);
    if (match) for (const name of match[1].split(",")) names.add(name);
  }
  return names;
}

/**
 * @param {(args: string[]) => string} run runs ffmpeg with the arguments and returns its output
 * @returns {string[]} one line per missing item; empty when the build has everything
 */
export function checkFeatures(run) {
  const missing = [];
  for (const [kind, { args, pattern }] of Object.entries(LISTS)) {
    const names = parseNames(run(args), pattern);
    for (const wanted of REQUIRED[kind]) {
      if (!names.has(wanted)) missing.push(`${kind.slice(0, -1)} ${wanted}`);
    }
  }
  for (const [args, words] of REQUIRED.help) {
    const text = run(["-hide_banner", ...args]);
    for (const word of words) {
      if (!text.includes(word)) missing.push(`'${word}' in ffmpeg ${args.join(" ")}`);
    }
  }
  return missing;
}

/** R2's final-rung chain (lld/03 §2.9), from three PNG frames on a pipe. */
export const FINAL_CHAIN = [
  "-vf",
  "scale=in_color_matrix=bt709:out_color_matrix=bt709:out_range=limited:flags=accurate_rnd+full_chroma_int,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709",
  "-c:v",
  "libx264",
  "-preset",
  "medium",
  "-crf",
  "18",
  "-profile:v",
  "high",
  "-flags",
  "+cgop",
  "-color_range",
  "tv",
  "-colorspace",
  "bt709",
  "-color_primaries",
  "bt709",
  "-color_trc",
  "bt709",
  "-an",
];

export const EXPECTED_COLOUR = {
  color_range: "tv",
  color_space: "bt709",
  color_transfer: "bt709",
  color_primaries: "bt709",
};

/**
 * Encodes three frames with the final chain and reads the four colour fields back.
 * @returns {{ok: boolean, fields: object, x264_core: string|null, frames: number|null, detail: string}}
 */
export function colourCheck(ffmpeg, ffprobe, tmpFile) {
  const run = (cmd, args, input) =>
    spawnSync(cmd, args, { input, encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
  const frames = run(ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=128x128:rate=30",
    "-frames:v",
    "3",
    "-c:v",
    "png",
    "-f",
    "image2pipe",
    "-",
  ]);
  if (frames.status !== 0)
    return {
      ok: false,
      fields: {},
      x264_core: null,
      frames: null,
      detail: `could not make test frames: ${frames.stderr}`,
    };
  const encode = spawnSync(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "info",
      "-y",
      "-f",
      "image2pipe",
      "-framerate",
      "30",
      "-c:v",
      "png",
      "-i",
      "pipe:0",
      ...FINAL_CHAIN,
      "-f",
      "mp4",
      tmpFile,
    ],
    { input: frames.stdout, encoding: "buffer", maxBuffer: 64 * 1024 * 1024 },
  );
  const log = encode.stderr.toString("utf8");
  if (encode.status !== 0)
    return {
      ok: false,
      fields: {},
      x264_core: null,
      frames: null,
      detail: `encode failed: ${log.slice(-500)}`,
    };
  // The encoder writes its version into the stream (an SEI message), so the file itself names the core.
  const core = /x264 - core (\d+)/.exec(readFileSync(tmpFile).toString("latin1"));
  const probe = run(ffprobe, [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-count_frames",
    "-show_entries",
    "stream=color_range,color_space,color_transfer,color_primaries,nb_read_frames",
    "-of",
    "json",
    tmpFile,
  ]);
  if (probe.status !== 0)
    return {
      ok: false,
      fields: {},
      x264_core: core?.[1] ?? null,
      frames: null,
      detail: `ffprobe failed: ${probe.stderr}`,
    };
  const stream = JSON.parse(probe.stdout).streams?.[0] ?? {};
  const fields = Object.fromEntries(Object.keys(EXPECTED_COLOUR).map((k) => [k, stream[k] ?? null]));
  const wrong = Object.entries(EXPECTED_COLOUR).filter(([k, v]) => fields[k] !== v);
  const framesRead = Number(stream.nb_read_frames ?? Number.NaN);
  const ok = wrong.length === 0 && framesRead === 3;
  return {
    ok,
    fields,
    x264_core: core?.[1] ?? null,
    frames: framesRead,
    detail: ok
      ? ""
      : `colour fields or frame count wrong: ${wrong.map(([k, v]) => `${k} expected ${v} got ${fields[k]}`).join("; ")}; frames ${framesRead}`,
  };
}
