#!/usr/bin/env bash
set -euo pipefail
TARGET="/home/gurman/PathSeekers/pits-frontend"
BACKUP="/home/gurman/PathSeekers/pits-frontend/.premium-dashboard-v2-backup-20260916-104223"
while IFS= read -r -d '' file; do
  rel="${file#$BACKUP/}"
  [[ "$rel" == "RESTORE.sh" ]] && continue
  mkdir -p "$TARGET/$(dirname "$rel")"
  cp -a "$file" "$TARGET/$rel"
  echo "Restored: $rel"
done < <(find "$BACKUP" -type f -print0)
echo "Restore complete."
