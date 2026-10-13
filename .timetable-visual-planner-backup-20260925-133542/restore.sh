#!/usr/bin/env bash
set -euo pipefail
cp "/home/gurman/PathSeekers/pits-frontend/.timetable-visual-planner-backup-20260925-133542/src/pages/Timetable.jsx" "/home/gurman/PathSeekers/pits-frontend/src/pages/Timetable.jsx"
if [[ -f "/home/gurman/PathSeekers/pits-frontend/.timetable-visual-planner-backup-20260925-133542/src/pages/TimetablePlanner.css" ]]; then
  cp "/home/gurman/PathSeekers/pits-frontend/.timetable-visual-planner-backup-20260925-133542/src/pages/TimetablePlanner.css" "/home/gurman/PathSeekers/pits-frontend/src/pages/TimetablePlanner.css"
else
  rm -f "/home/gurman/PathSeekers/pits-frontend/src/pages/TimetablePlanner.css"
fi
echo "✅ Timetable planner restored from /home/gurman/PathSeekers/pits-frontend/.timetable-visual-planner-backup-20260925-133542"
