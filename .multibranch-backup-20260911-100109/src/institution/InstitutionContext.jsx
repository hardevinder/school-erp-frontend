import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../api";

const STORAGE_TYPE = "institutionType";
const STORAGE_ID = "edubridgeInstitutionId";
export const INSTITUTION_CHANGED_EVENT = "edubridge:institution-changed";

const normalizeType = (value) =>
  String(value || "school").trim().toLowerCase() === "college" ? "college" : "school";

const schoolTerms = {
  institution: "School",
  institutionLower: "school",
  class: "Class",
  classes: "Classes",
  classLower: "class",
  classesLower: "classes",
  section: "Section",
  sections: "Sections",
  sectionLower: "section",
  sectionsLower: "sections",
  subject: "Subject",
  subjects: "Subjects",
  subjectLower: "subject",
  subjectsLower: "subjects",
  teacher: "Teacher",
  teachers: "Teachers",
  classTeacher: "Class Teacher",
  academicSession: "Academic Session",
  reportCard: "Report Card",
  reportCards: "Report Cards",
};

const collegeTerms = {
  institution: "College",
  institutionLower: "college",
  class: "Program / Semester",
  classes: "Programs / Semesters",
  classLower: "program / semester",
  classesLower: "programs / semesters",
  section: "Batch / Section",
  sections: "Batches / Sections",
  sectionLower: "batch / section",
  sectionsLower: "batches / sections",
  subject: "Paper / Subject",
  subjects: "Papers / Subjects",
  subjectLower: "paper / subject",
  subjectsLower: "papers / subjects",
  teacher: "Faculty",
  teachers: "Faculty",
  classTeacher: "Faculty Mentor",
  academicSession: "Academic Year",
  reportCard: "Grade Card",
  reportCards: "Grade Cards",
};

const InstitutionContext = createContext({
  institutionType: "school",
  institution: null,
  isCollege: false,
  terms: schoolTerms,
  refreshInstitution: async () => {},
});

const readPreferredId = () => {
  const candidates = [
    localStorage.getItem(STORAGE_ID),
    localStorage.getItem("selectedSchoolId"),
    localStorage.getItem("schoolId"),
    localStorage.getItem("school_id"),
  ];
  const found = candidates.map(Number).find((n) => Number.isFinite(n) && n > 0);
  return found || null;
};

export const publishInstitutionChange = ({ id, institution_type, name } = {}) => {
  const type = normalizeType(institution_type);
  localStorage.setItem(STORAGE_TYPE, type);
  if (id) localStorage.setItem(STORAGE_ID, String(id));
  window.dispatchEvent(
    new CustomEvent(INSTITUTION_CHANGED_EVENT, {
      detail: { id: id || null, institution_type: type, name: name || null },
    })
  );
};

export function InstitutionProvider({ children }) {
  const [institutionType, setInstitutionType] = useState(() =>
    normalizeType(localStorage.getItem(STORAGE_TYPE))
  );
  const [institution, setInstitution] = useState(null);

  const applySnapshot = useCallback((snapshot = {}) => {
    const row = snapshot?.institution || snapshot?.school || snapshot || null;
    const type = normalizeType(
      snapshot?.institution_type || row?.institution_type || localStorage.getItem(STORAGE_TYPE)
    );

    setInstitutionType(type);
    localStorage.setItem(STORAGE_TYPE, type);

    if (row && typeof row === "object") {
      setInstitution(row);
      if (row.id) localStorage.setItem(STORAGE_ID, String(row.id));
    }
  }, []);

  const refreshInstitution = useCallback(async () => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) return null;

    try {
      const preferredId = readPreferredId();
      const { data } = await api.get("/schools/current/profile", {
        params: preferredId ? { school_id: preferredId } : undefined,
      });
      applySnapshot(data || {});
      return data;
    } catch (error) {
      // Keep the locally selected mode as a safe fallback. This also means a
      // Super Admin sees the change immediately after editing an institution.
      console.warn("Institution profile could not be refreshed:", error?.response?.data || error?.message || error);
      return null;
    }
  }, [applySnapshot]);

  useEffect(() => {
    refreshInstitution();

    const onChanged = (event) => {
      const detail = event?.detail || {};
      applySnapshot({
        institution_type: detail.institution_type,
        institution: detail.id || detail.name
          ? { id: detail.id || undefined, name: detail.name || undefined, institution_type: detail.institution_type }
          : undefined,
      });
      // Refresh in the background so the complete institution record stays in sync.
      window.setTimeout(refreshInstitution, 0);
    };

    const onStorage = (event) => {
      if (event.key === STORAGE_TYPE || event.key === STORAGE_ID) refreshInstitution();
    };

    window.addEventListener(INSTITUTION_CHANGED_EVENT, onChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(INSTITUTION_CHANGED_EVENT, onChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, [applySnapshot, refreshInstitution]);

  const isCollege = institutionType === "college";
  const terms = isCollege ? collegeTerms : schoolTerms;

  const value = useMemo(
    () => ({ institutionType, institution, isCollege, terms, refreshInstitution }),
    [institutionType, institution, isCollege, terms, refreshInstitution]
  );

  return <InstitutionContext.Provider value={value}>{children}</InstitutionContext.Provider>;
}

export const useInstitution = () => useContext(InstitutionContext);
