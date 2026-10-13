#!/usr/bin/env bash
set -e
cp "/home/gurman/PathSeekers/pits-frontend/.syllabus-breakdown-easy-backup-20260925-135051/src/pages/SyllabusBreakdownCRUD.jsx" "/home/gurman/PathSeekers/pits-frontend/src/pages/SyllabusBreakdownCRUD.jsx"
if [[ -f "/home/gurman/PathSeekers/pits-frontend/.syllabus-breakdown-easy-backup-20260925-135051/src/pages/SyllabusBreakdownCRUD.css" ]]; then
  cp "/home/gurman/PathSeekers/pits-frontend/.syllabus-breakdown-easy-backup-20260925-135051/src/pages/SyllabusBreakdownCRUD.css" "/home/gurman/PathSeekers/pits-frontend/src/pages/SyllabusBreakdownCRUD.css"
fi
echo "✅ Syllabus Breakdown restored from backup."
