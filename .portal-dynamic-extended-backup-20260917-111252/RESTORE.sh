#!/usr/bin/env bash
set -e
ROOT="${1:?frontend root required}"
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
find . -type f ! -name RESTORE.sh -print0 | while IFS= read -r -d "" f; do rel="${f#./}"; mkdir -p "$ROOT/$(dirname "$rel")"; cp -a "$f" "$ROOT/$rel"; done
echo "Restore complete."
