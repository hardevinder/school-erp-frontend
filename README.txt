EduBridge Study Material - automatic target selection (no Add button)

Based on EduBridge_Study_Material_Inline_Assessment_Style_Patch.zip.
The wizard remains inline and button-based.
Select a program and optionally a section/batch; the target is inferred directly.
No Add another target button or target chips.
The Review page and uploaded FormData use the currently selected program/section.
This patch intentionally supports ONE program at a time; it does not enable multiple programs.

Apply on top of the previous inline Assessment-style patch:
  cd ~/PathSeekers/pits-frontend
  cp src/pages/LearningResources.jsx src/pages/LearningResources.jsx.before_no_add
  unzip -o ~/Downloads/EduBridge_Study_Material_No_Add_Button_Patch.zip -d .
  npm run build

Only src/pages/LearningResources.jsx is changed. No backend modifications.
