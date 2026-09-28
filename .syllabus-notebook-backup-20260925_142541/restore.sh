#!/usr/bin/env bash
set -euo pipefail
cp "/home/gurman/PathSeekers/pits-frontend/.syllabus-notebook-backup-20260925_142541/src/pages/SyllabusBreakdownCRUD.jsx" "/home/gurman/PathSeekers/pits-frontend/src/pages/SyllabusBreakdownCRUD.jsx"
if [ -f "/home/gurman/PathSeekers/pits-frontend/.syllabus-notebook-backup-20260925_142541/src/pages/SyllabusBreakdownCRUD.css" ]; then
  cp "/home/gurman/PathSeekers/pits-frontend/.syllabus-notebook-backup-20260925_142541/src/pages/SyllabusBreakdownCRUD.css" "/home/gurman/PathSeekers/pits-frontend/src/pages/SyllabusBreakdownCRUD.css"
fi
echo "✅ Restored syllabus files from /home/gurman/PathSeekers/pits-frontend/.syllabus-notebook-backup-20260925_142541"
