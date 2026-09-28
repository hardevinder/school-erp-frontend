#!/usr/bin/env bash
set -euo pipefail
cp "/home/gurman/PathSeekers/pits-frontend/.edubridge-backups/assignment-3way-pinned-20260925-141615/TeacherAssignment.js" "/home/gurman/PathSeekers/pits-frontend/src/pages/TeacherAssignment.js"
cp "/home/gurman/PathSeekers/pits-frontend/.edubridge-backups/assignment-3way-pinned-20260925-141615/SyllabusTeacherAssignment.jsx" "/home/gurman/PathSeekers/pits-frontend/src/pages/SyllabusTeacherAssignment.jsx"
cp "/home/gurman/PathSeekers/pits-frontend/.edubridge-backups/assignment-3way-pinned-20260925-141615/TeacherAssignment.css" "/home/gurman/PathSeekers/pits-frontend/src/pages/TeacherAssignment.css"
if [[ "1" == "1" ]]; then
  cp "/home/gurman/PathSeekers/pits-frontend/.edubridge-backups/assignment-3way-pinned-20260925-141615/SyllabusTeacherAssignment.css" "/home/gurman/PathSeekers/pits-frontend/src/pages/SyllabusTeacherAssignment.css"
else
  rm -f "/home/gurman/PathSeekers/pits-frontend/src/pages/SyllabusTeacherAssignment.css"
fi
echo "✅ Teacher + Syllabus assignment pages restored."
