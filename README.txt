EduBridge Study Material - three-step uploader and required subject.

Apply in frontend root:
  unzip -o EduBridge_Study_Material_3_Step_Subject_Patch.zip -d .
  npm run build

Flow: Details & Audience -> Files & Links -> Review & Publish.
Subject dropdown uses the existing GET /subjects endpoint; the existing POST /learning-resources endpoint already accepts subject_id.
No backend changes or database migrations necessary.
Before applying, commit or back up existing src/pages/LearningResources.jsx and LearningResources.css.
