#!/usr/bin/env bash
set -euo pipefail
TARGET="/home/gurman/PathSeekers/pits-frontend"
PAGES="$TARGET/src/pages"
BACKUP_DIR="/home/gurman/PathSeekers/pits-frontend/.edubridge-backups/syllabus-teacher-assignment-easy-20260925-140403"
cp "$BACKUP_DIR/SyllabusTeacherAssignment.jsx" "/home/gurman/PathSeekers/pits-frontend/src/pages/SyllabusTeacherAssignment.jsx"
if [[ -f "$BACKUP_DIR/SyllabusTeacherAssignment.css" ]]; then
  cp "$BACKUP_DIR/SyllabusTeacherAssignment.css" "$PAGES/SyllabusTeacherAssignment.css"
else
  rm -f "$PAGES/SyllabusTeacherAssignment.css"
fi
echo "✅ Syllabus Teacher Assignment restored from backup."
