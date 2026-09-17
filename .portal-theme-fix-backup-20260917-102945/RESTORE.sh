#!/usr/bin/env bash
set -e
ROOT="${1:-/home/gurman/PathSeekers/pits-frontend}"
HERE="$(cd "$(dirname "$0")" && pwd)"
echo "Restoring modified files from $HERE to $ROOT"
cd "$HERE"
find . -type f ! -name RESTORE.sh ! -name .created-files -print0 | while IFS= read -r -d '' f; do
  rel="${f#./}"
  mkdir -p "$ROOT/$(dirname "$rel")"
  cp -a "$f" "$ROOT/$rel"
done
if [[ -f "$HERE/.created-files" ]]; then
  while IFS= read -r rel; do [[ -n "$rel" ]] && rm -f "$ROOT/$rel"; done < "$HERE/.created-files"
fi
echo "Restore complete."
