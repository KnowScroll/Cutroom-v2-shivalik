#!/usr/bin/env bash
# Design: impl/02 §5 (FFmpeg without sudo: a static Linux x64 GPL build)
# Usage (in WSL): bash tools/install-wsl-ffmpeg.sh
# The build is BtbN's autobuild of the release/8.1 branch under an immutable tag (a release build of the
# measured 8.1 line is not published by BtbN; the tag's asset never changes). The archive and the
# tool's own checksum file are kept in <tools>/archives/. Writes <tools>/records/ffmpeg.json.
set -euo pipefail

tools="${HOME}/.cutroom-build/.tools"
tag="autobuild-2026-11-15-12-40"
name="ffmpeg-n8.1.3-35-gf1acb0a266-linux64-gpl-8.1.tar.xz"
url="https://github.com/BtbN/FFmpeg-Builds/releases/download/${tag}"
mkdir -p "$tools/archives" "$tools/records"

curl -fsSL "$url/checksums.sha256" -o "$tools/archives/ffmpeg-checksums.sha256"
expected="$(grep " ${name}\$" "$tools/archives/ffmpeg-checksums.sha256" | cut -d' ' -f1)"
[ -n "$expected" ] || { echo "no checksum for $name" >&2; exit 1; }

if [ ! -f "$tools/archives/$name" ] || [ "$(sha256sum "$tools/archives/$name" | cut -d' ' -f1)" != "$expected" ]; then
  curl -fsSL "$url/$name" -o "$tools/archives/$name"
fi
actual="$(sha256sum "$tools/archives/$name" | cut -d' ' -f1)"
[ "$actual" = "$expected" ] || { echo "archive hash mismatch: expected $expected, got $actual" >&2; exit 1; }

rm -rf "$tools/ffmpeg" "$tools/ffmpeg-unpack"
mkdir -p "$tools/ffmpeg-unpack"
tar -xJf "$tools/archives/$name" -C "$tools/ffmpeg-unpack"
mv "$tools/ffmpeg-unpack/${name%.tar.xz}" "$tools/ffmpeg"
rmdir "$tools/ffmpeg-unpack"

"$tools/ffmpeg/bin/ffmpeg" -version | head -3
echo "archive=$name"
echo "archive_sha256=$actual"
echo "ffmpeg_sha256=$(sha256sum "$tools/ffmpeg/bin/ffmpeg" | cut -d' ' -f1)"
echo "ffprobe_sha256=$(sha256sum "$tools/ffmpeg/bin/ffprobe" | cut -d' ' -f1)"
printf '{"tag":"%s","archive":"%s","archive_sha256":"%s","source":"%s/%s"}\n' \
  "$tag" "$name" "$actual" "$url" "$name" > "$tools/records/ffmpeg.json"
