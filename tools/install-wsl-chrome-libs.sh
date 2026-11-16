#!/usr/bin/env bash
# Design: impl/02 §4.2 (shared libraries Chrome needs, without sudo: S7's recipe)
# Usage (in WSL): bash tools/install-wsl-chrome-libs.sh
# Downloads libnss3, libnspr4 and libasound2 with apt-get download (no root, no install), unpacks each
# .deb into <tools>/chrome-libs/root and keeps the .debs in <tools>/archives/. Writes
# <tools>/records/chrome-libs.json with each package's version and .deb hash.
set -euo pipefail

tools="${HOME}/.cutroom-build/.tools"
libs="$tools/chrome-libs"
mkdir -p "$libs" "$tools/archives" "$tools/records"
cd "$libs"
rm -rf root ./*.deb
apt-get download libnss3 libnspr4 libasound2
mkdir -p root
for deb in *.deb; do dpkg-deb -x "$deb" root; done

records="["
first=1
for deb in *.deb; do
  pkg="$(dpkg-deb -f "$deb" Package)"
  ver="$(dpkg-deb -f "$deb" Version)"
  sum="$(sha256sum "$deb" | cut -d' ' -f1)"
  cp -f "$deb" "$tools/archives/$deb"
  [ "$first" = 1 ] || records="$records,"
  first=0
  records="$records{\"package\":\"$pkg\",\"version\":\"$ver\",\"deb\":\"$deb\",\"deb_sha256\":\"$sum\"}"
  echo "$pkg $ver $sum"
done
records="$records]"
echo "$records" > "$tools/records/chrome-libs.json"
