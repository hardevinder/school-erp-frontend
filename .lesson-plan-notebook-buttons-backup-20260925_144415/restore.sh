#!/usr/bin/env bash
set -euo pipefail
cp "/home/gurman/PathSeekers/pits-frontend/.lesson-plan-notebook-buttons-backup-20260925_144415/src/pages/LessonPlan.jsx" "/home/gurman/PathSeekers/pits-frontend/src/pages/LessonPlan.jsx"
if [ -f "/home/gurman/PathSeekers/pits-frontend/.lesson-plan-notebook-buttons-backup-20260925_144415/src/pages/LessonPlan.css" ]; then
  cp "/home/gurman/PathSeekers/pits-frontend/.lesson-plan-notebook-buttons-backup-20260925_144415/src/pages/LessonPlan.css" "/home/gurman/PathSeekers/pits-frontend/src/pages/LessonPlan.css"
fi
echo "✅ Restored Lesson Plan files from /home/gurman/PathSeekers/pits-frontend/.lesson-plan-notebook-buttons-backup-20260925_144415"
