#!/usr/bin/env bash
# Design: impl/02 §3.1 (the WSL Node, no sudo)
# Usage (in WSL): bash tools/install-wsl-node.sh [version]
# Downloads the official Linux x64 tarball and SHASUMS256.txt of the newest 26.x LTS (or the given
# version) into <tools>/archives/, verifies the tarball, unpacks it into <tools>/node/ and prints the
# measured pin values. It installs nothing else and touches nothing outside <tools>.
set -euo pipefail

tools="${HOME}/.cutroom-build/.tools"
mkdir -p "$tools/archives"
base="https://nodejs.org/dist"

version="${1:-}"
if [ -z "$version" ]; then
  curl -fsSL "$base/index.json" -o "$tools/archives/node-index.json"
  version="$(python3 - "$tools/archives/node-index.json" <<'PY'
import json, sys
entries = json.load(open(sys.argv[1]))
print(next(e["version"] for e in entries if e["version"].startswith("v26.") and e["lts"]))
PY
)"
fi

name="node-${version}-linux-x64.tar.xz"
curl -fsSL "$base/$version/SHASUMS256.txt" -o "$tools/archives/SHASUMS256.node-linux.txt"
expected="$(grep " ${name}\$" "$tools/archives/SHASUMS256.node-linux.txt" | cut -d' ' -f1)"
[ -n "$expected" ] || { echo "no checksum for $name" >&2; exit 1; }

if [ ! -f "$tools/archives/$name" ] || [ "$(sha256sum "$tools/archives/$name" | cut -d' ' -f1)" != "$expected" ]; then
  curl -fsSL "$base/$version/$name" -o "$tools/archives/$name"
fi
actual="$(sha256sum "$tools/archives/$name" | cut -d' ' -f1)"
[ "$actual" = "$expected" ] || { echo "tarball hash mismatch: expected $expected, got $actual" >&2; exit 1; }

rm -rf "$tools/node" "$tools/node-unpack"
mkdir -p "$tools/node-unpack"
tar -xJf "$tools/archives/$name" -C "$tools/node-unpack"
mv "$tools/node-unpack/node-${version}-linux-x64" "$tools/node"
rmdir "$tools/node-unpack"

node_bin="$tools/node/bin/node"
echo "version=$("$node_bin" -p 'process.version')"
echo "npm=$("$node_bin" -p "require('$tools/node/lib/node_modules/npm/package.json').version")"
echo "tarball_sha256=$actual"
echo "binary_sha256=$(sha256sum "$node_bin" | cut -d' ' -f1)"
echo "sqlite=$("$node_bin" -p 'process.versions.sqlite')"
echo "platform=$("$node_bin" -p 'process.platform')"
echo "lts=$("$node_bin" -p 'String(process.release.lts)')"
