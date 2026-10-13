#!/usr/bin/env bash
set -euo pipefail
cp "/home/gurman/PathSeekers/pits-frontend/.timetable-classic-easy-backup-20260925-134452/src/pages/Timetable.jsx" "/home/gurman/PathSeekers/pits-frontend/src/pages/Timetable.jsx"
if [[ -f "/home/gurman/PathSeekers/pits-frontend/.timetable-classic-easy-backup-20260925-134452/src/pages/TimetablePlanner.css" ]]; then
  cp "/home/gurman/PathSeekers/pits-frontend/.timetable-classic-easy-backup-20260925-134452/src/pages/TimetablePlanner.css" "/home/gurman/PathSeekers/pits-frontend/src/pages/TimetablePlanner.css"
fi
echo "✅ Timetable restored from: /home/gurman/PathSeekers/pits-frontend/.timetable-classic-easy-backup-20260925-134452"
