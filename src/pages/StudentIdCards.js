import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";

// ---------------------------------------------
// Permission helpers (same style as Students.js)
// ---------------------------------------------
const readStoredArray = (key) => {
  try {
    const localValue = JSON.parse(localStorage.getItem(key) || "[]");
    if (Array.isArray(localValue) && localValue.length) return localValue;
  } catch {}

  try {
    const sessionValue = JSON.parse(sessionStorage.getItem(key) || "[]");
    if (Array.isArray(sessionValue) && sessionValue.length) return sessionValue;
  } catch {}

  return [];
};

const getPermissionFlags = () => {
  const singleRole =
    localStorage.getItem("userRole") || sessionStorage.getItem("userRole");
  const multiRoles = readStoredArray("roles");
  const storedPermissions = readStoredArray("permissions");

  const roles = (multiRoles.length ? multiRoles : [singleRole].filter(Boolean))
    .map((role) => String(role || "").trim().toLowerCase())
    .filter(Boolean);

  const permissions = storedPermissions
    .map((permission) => String(permission || "").trim().toLowerCase())
    .filter(Boolean);

  const isAdmin = roles.includes("admin");
  const isSuperadmin = roles.includes("superadmin");
  const isAccounts = roles.includes("accounts");
  const isFrontoffice = roles.includes("frontoffice");
  const isTeacher = roles.includes("teacher");
  const isAcademicCoordinator = roles.includes("academic_coordinator");

  const fallbackManage =
    isAdmin ||
    isSuperadmin ||
    isAccounts ||
    isFrontoffice ||
    isTeacher ||
    isAcademicCoordinator;

  const hasPermission = (slug, fallback = false) =>
    isSuperadmin ||
    (permissions.length
      ? permissions.includes(String(slug || "").toLowerCase())
      : fallback);

  return {
    roles,
    permissions,
    isAdmin,
    isSuperadmin,
    isAccounts,
    isFrontoffice,
    isTeacher,
    isAcademicCoordinator,
    canUseStudentIdCards:
      hasPermission("students_view", fallbackManage) ||
      hasPermission("id_cards_view", fallbackManage) ||
      fallbackManage,
  };
};

// ---------------------------------------------
// Helpers
// ---------------------------------------------
const apiBase = (() => {
  const b = api?.defaults?.baseURL;
  return b ? b.replace(/\/+$/, "") : window.location.origin;
})();

const buildStudentPhotoURL = (fileName) =>
  fileName
    ? `${apiBase}/uploads/photoes/students/${encodeURIComponent(fileName)}`
    : "";

const NO_PHOTO_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">
       <rect width="100%" height="100%" fill="#f8f9fa"/>
       <circle cx="40" cy="30" r="16" fill="#e9ecef"/>
       <rect x="14" y="50" width="52" height="18" rx="9" fill="#e9ecef"/>
     </svg>`
  );

const normalizeArray = (value) => (Array.isArray(value) ? value : []);

const normalizeSectionsResponse = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const normalizeStudentsResponse = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.students)) return data.students;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const openFileUrl = (fileUrl) => {
  if (!fileUrl) return;
  const finalUrl = /^https?:\/\//i.test(fileUrl)
    ? fileUrl
    : `${apiBase}/${String(fileUrl).replace(/^\/+/, "")}`;

  const win = window.open(finalUrl, "_blank", "noopener,noreferrer");
  if (!win) {
    const a = document.createElement("a");
    a.href = finalUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
};

const getClassName = (student) =>
  student?.Class?.class_name ||
  student?.class_name ||
  student?.className ||
  student?.class?.class_name ||
  "";

const getSectionName = (student) =>
  student?.Section?.section_name ||
  student?.section_name ||
  student?.sectionName ||
  student?.section?.section_name ||
  "";

const getSessionName = (student) =>
  student?.Session?.name || student?.session_name || student?.sessionName || "";

const getDisplayTemplateName = (template) =>
  template?.label || template?.key || "Template";

const StudentIdCards = () => {
  const { canUseStudentIdCards } = getPermissionFlags();

  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [bulkPdfLoading, setBulkPdfLoading] = useState(false);

  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [templates, setTemplates] = useState([]);
  const [fieldDefinitions, setFieldDefinitions] = useState([]);
  const [allowedFields, setAllowedFields] = useState([]);

  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");
  const [selectedFields, setSelectedFields] = useState([]);
  const [cardsPerPage, setCardsPerPage] = useState(4);

  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [previewStudentId, setPreviewStudentId] = useState(null);
  const [previewHtml, setPreviewHtml] = useState("");

  const templateMap = useMemo(() => {
    const map = new Map();
    templates.forEach((tpl) => map.set(String(tpl.key), tpl));
    return map;
  }, [templates]);

  const selectedTemplate = useMemo(
    () => templateMap.get(String(selectedTemplateKey)) || null,
    [templateMap, selectedTemplateKey]
  );

  const visibleSections = useMemo(() => {
    if (!selectedClass) return sections;
    return sections.filter(
      (sec) => String(sec.class_id || "") === String(selectedClass)
    );
  }, [sections, selectedClass]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();

    return students.filter((stu) => {
      const classMatch =
        !selectedClass || String(stu.class_id || "") === String(selectedClass);
      const sectionMatch =
        !selectedSection ||
        String(stu.section_id || "") === String(selectedSection);
      const sessionMatch =
        !selectedSession ||
        String(stu.session_id || "") === String(selectedSession);
      const statusMatch =
        !selectedStatus ||
        String(stu.status || "").toLowerCase() ===
          String(selectedStatus).toLowerCase();

      const textMatch =
        !q ||
        [
          stu.name,
          stu.father_name,
          stu.admission_number,
          getClassName(stu),
          getSectionName(stu),
          getSessionName(stu),
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(q)
        );

      return classMatch && sectionMatch && sessionMatch && statusMatch && textMatch;
    });
  }, [students, search, selectedClass, selectedSection, selectedSession, selectedStatus]);

  const selectedStudents = useMemo(() => {
    const selectedSet = new Set(selectedStudentIds.map((id) => String(id)));
    return filteredStudents.filter((stu) => selectedSet.has(String(stu.id)));
  }, [filteredStudents, selectedStudentIds]);

  const activeCount = filteredStudents.filter(
    (stu) => String(stu.status || "").toLowerCase() === "enabled"
  ).length;

  const inactiveCount = filteredStudents.filter(
    (stu) => String(stu.status || "").toLowerCase() === "disabled"
  ).length;

  const fetchTemplates = async () => {
    const { data } = await api.get("/api/id-cards/student/templates");
    const templateList = normalizeArray(data?.templates);
    const definitionList = normalizeArray(data?.fieldDefinitions);
    const allowed = normalizeArray(data?.allowedFields);

    setTemplates(templateList);
    setFieldDefinitions(definitionList);
    setAllowedFields(allowed);

    const defaultTemplateKey =
      data?.defaultTemplateKey || templateList?.[0]?.key || "";
    setSelectedTemplateKey(defaultTemplateKey);

    const defaultTemplate = templateList.find(
      (tpl) => String(tpl.key) === String(defaultTemplateKey)
    );
    setSelectedFields(normalizeArray(defaultTemplate?.defaultFields));
  };

  const fetchClasses = async () => {
    const { data } = await api.get("/classes");
    setClasses(normalizeArray(data));
  };

  const fetchSections = async () => {
    const { data } = await api.get("/sections");
    setSections(normalizeSectionsResponse(data));
  };

  const fetchSessions = async () => {
    const { data } = await api.get("/sessions");
    setSessions(normalizeArray(data));
  };

  const fetchStudents = async ({
    classId = selectedClass,
    sessionId = selectedSession,
  } = {}) => {
    setStudentsLoading(true);
    try {
      let url = "/students";

      if (sessionId) {
        const params = new URLSearchParams();
        params.append("session_id", sessionId);
        if (classId) params.append("class_id", classId);
        url = `/students/by-session?${params.toString()}`;
      }

      const { data } = await api.get(url);
      setStudents(normalizeStudentsResponse(data));
    } finally {
      setStudentsLoading(false);
    }
  };

  useEffect(() => {
    if (!canUseStudentIdCards) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        await Promise.all([
          fetchTemplates(),
          fetchClasses(),
          fetchSections(),
          fetchSessions(),
        ]);
      } catch (err) {
        console.error("StudentIdCards bootstrap error:", err);
        Swal.fire(
          "Error",
          err?.response?.data?.message || "Failed to load ID card module.",
          "error"
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [canUseStudentIdCards]);

  useEffect(() => {
    if (!canUseStudentIdCards) return;
    fetchStudents({ classId: selectedClass, sessionId: selectedSession }).catch(
      (err) => {
        console.error("fetchStudents error:", err);
        Swal.fire("Error", "Failed to fetch students.", "error");
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseStudentIdCards, selectedClass, selectedSession]);

  useEffect(() => {
    if (!selectedClass && selectedSection) {
      setSelectedSection("");
      return;
    }

    const sectionStillValid = visibleSections.some(
      (sec) => String(sec.id) === String(selectedSection)
    );
    if (selectedSection && !sectionStillValid) {
      setSelectedSection("");
    }
  }, [selectedClass, selectedSection, visibleSections]);

  useEffect(() => {
    if (!selectedTemplate) return;

    const defaults = normalizeArray(selectedTemplate.defaultFields);
    if (!selectedFields.length) {
      setSelectedFields(defaults);
    }

    if (String(selectedTemplate.orientation).toLowerCase() === "landscape") {
      setCardsPerPage((prev) => (prev === 4 ? 2 : prev));
    }
  }, [selectedTemplate, selectedFields.length]);

  const effectivePreviewStudentId = useMemo(() => {
    if (previewStudentId) return previewStudentId;
    if (selectedStudentIds.length) return selectedStudentIds[0];
    if (filteredStudents.length) return filteredStudents[0]?.id || null;
    return null;
  }, [previewStudentId, selectedStudentIds, filteredStudents]);

  useEffect(() => {
    if (!canUseStudentIdCards) return;
    if (!selectedTemplateKey) return;
    if (!effectivePreviewStudentId) {
      setPreviewHtml("");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setPreviewLoading(true);
        const { data } = await api.post("/api/id-cards/student/preview-html", {
          studentId: effectivePreviewStudentId,
          templateKey: selectedTemplateKey,
          selectedFields,
        });

        if (!cancelled) {
          setPreviewHtml(data?.html || "");
        }
      } catch (err) {
        console.error("preview html error:", err);
        if (!cancelled) {
          setPreviewHtml("");
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canUseStudentIdCards, effectivePreviewStudentId, selectedTemplateKey, selectedFields]);

  const setTemplateAndDefaults = (templateKey) => {
    const nextTemplate = templateMap.get(String(templateKey));
    setSelectedTemplateKey(templateKey);

    if (nextTemplate) {
      setSelectedFields(normalizeArray(nextTemplate.defaultFields));
      if (String(nextTemplate.orientation).toLowerCase() === "landscape") {
        setCardsPerPage(2);
      } else {
        setCardsPerPage(4);
      }
    }
  };

  const toggleField = (fieldKey) => {
    setSelectedFields((prev) => {
      const has = prev.includes(fieldKey);
      if (has) return prev.filter((item) => item !== fieldKey);
      return [...prev, fieldKey];
    });
  };

  const selectAllFields = () => setSelectedFields(allowedFields);
  const clearFields = () => setSelectedFields([]);
  const resetFieldsToDefault = () =>
    setSelectedFields(normalizeArray(selectedTemplate?.defaultFields));

  const toggleStudentSelection = (studentId) => {
    setSelectedStudentIds((prev) => {
      const has = prev.some((id) => String(id) === String(studentId));
      if (has) return prev.filter((id) => String(id) !== String(studentId));
      return [...prev, studentId];
    });
  };

  const selectAllFiltered = () => {
    const ids = filteredStudents.map((stu) => stu.id);
    setSelectedStudentIds(ids);
    if (!previewStudentId && ids.length) setPreviewStudentId(ids[0]);
  };

  const clearSelectedStudents = () => {
    setSelectedStudentIds([]);
  };

  const handlePreviewStudent = (studentId) => {
    setPreviewStudentId(studentId);
  };

  const handleGenerateSinglePdf = async (studentId) => {
    try {
      setPdfLoading(true);
      const { data } = await api.post("/api/id-cards/student/generate-pdf", {
        studentId,
        templateKey: selectedTemplateKey,
        selectedFields,
      });

      if (data?.fileUrl) {
        openFileUrl(data.fileUrl);
      }

      Swal.fire("Success", data?.message || "ID card PDF generated.", "success");
    } catch (err) {
      console.error("generate single pdf error:", err);
      Swal.fire(
        "Error",
        err?.response?.data?.message || "Failed to generate student ID card PDF.",
        "error"
      );
    } finally {
      setPdfLoading(false);
    }
  };

  const handleGenerateBulkPdf = async () => {
    if (!selectedStudentIds.length) {
      Swal.fire(
        "Select Students",
        "Please select at least one student for bulk PDF.",
        "warning"
      );
      return;
    }

    try {
      setBulkPdfLoading(true);
      const { data } = await api.post("/api/id-cards/student/generate-bulk-pdf", {
        studentIds: selectedStudentIds,
        templateKey: selectedTemplateKey,
        selectedFields,
        cardsPerPage,
      });

      if (data?.fileUrl) {
        openFileUrl(data.fileUrl);
      }

      Swal.fire(
        "Success",
        data?.message || "Bulk student ID cards PDF generated.",
        "success"
      );
    } catch (err) {
      console.error("generate bulk pdf error:", err);
      Swal.fire(
        "Error",
        err?.response?.data?.message ||
          "Failed to generate bulk student ID cards PDF.",
        "error"
      );
    } finally {
      setBulkPdfLoading(false);
    }
  };

  const previewStudent = filteredStudents.find(
    (stu) => String(stu.id) === String(effectivePreviewStudentId)
  );

  if (!canUseStudentIdCards) {
    return (
      <div className="container-fluid py-4">
        <div className="alert alert-warning shadow-sm border-0 rounded-4">
          You are not authorized to access Student I-Card Generator.
        </div>
      </div>
    );
  }

  return (
    <div
      className="container-fluid py-3"
      style={{
        background:
          "radial-gradient(circle at top left, rgba(99,102,241,0.14), transparent 32%), linear-gradient(180deg, #f8fafc 0%, #ffffff 260px, #ffffff 100%)",
        minHeight: "100vh",
      }}
    >
      <div
        className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3 p-3"
        style={{
          background: "rgba(255,255,255,0.92)",
          border: "1px solid rgba(226,232,240,0.95)",
          borderRadius: 18,
          boxShadow: "0 14px 32px rgba(15,23,42,0.07)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span
              className="d-inline-flex align-items-center justify-content-center"
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: "linear-gradient(135deg,#4f46e5,#06b6d4)",
                color: "#fff",
              }}
            >
              <i className="bi bi-person-vcard-fill"></i>
            </span>
            <h2 className="h5 mb-0 fw-bold text-dark">Student I-Card Generator</h2>
          </div>
          <p className="mb-0 text-muted" style={{ fontSize: "0.84rem" }}>
            Select template, choose fields, preview instantly, and generate single
            or bulk student ID card PDFs.
          </p>
        </div>

        <div className="d-flex gap-2 flex-wrap align-items-center justify-content-end">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary rounded-pill px-3"
            onClick={selectAllFiltered}
            disabled={!filteredStudents.length}
          >
            <i className="bi bi-check2-square me-1"></i>
            Select Visible
          </button>

          <button
            type="button"
            className="btn btn-sm btn-outline-secondary rounded-pill px-3"
            onClick={clearSelectedStudents}
            disabled={!selectedStudentIds.length}
          >
            <i className="bi bi-x-circle me-1"></i>
            Clear Selected
          </button>

          <button
            type="button"
            className="btn btn-sm btn-primary rounded-pill px-3"
            onClick={handleGenerateBulkPdf}
            disabled={bulkPdfLoading || !selectedStudentIds.length || !selectedFields.length}
          >
            <i className="bi bi-file-earmark-pdf me-1"></i>
            {bulkPdfLoading ? "Generating..." : "Bulk PDF"}
          </button>
        </div>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-md-3 col-6">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body py-3">
              <div className="text-muted small">Filtered Students</div>
              <div className="fs-4 fw-bold">{filteredStudents.length}</div>
            </div>
          </div>
        </div>
        <div className="col-md-3 col-6">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body py-3">
              <div className="text-muted small">Selected Students</div>
              <div className="fs-4 fw-bold text-primary">{selectedStudentIds.length}</div>
            </div>
          </div>
        </div>
        <div className="col-md-3 col-6">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body py-3">
              <div className="text-muted small">Selected Fields</div>
              <div className="fs-4 fw-bold text-success">{selectedFields.length}</div>
            </div>
          </div>
        </div>
        <div className="col-md-3 col-6">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body py-3">
              <div className="text-muted small">Active / Inactive</div>
              <div className="fs-6 fw-bold">
                <span className="text-success">{activeCount}</span>
                <span className="mx-2 text-muted">/</span>
                <span className="text-danger">{inactiveCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-xl-7">
          <div className="card border-0 shadow-sm rounded-4 mb-3">
            <div className="card-body">
              <div className="row g-2">
                <div className="col-md-4">
                  <label className="form-label fw-semibold small">Session</label>
                  <select
                    className="form-select"
                    value={selectedSession}
                    onChange={(e) => setSelectedSession(e.target.value)}
                  >
                    <option value="">All Sessions</option>
                    {sessions.map((ss) => (
                      <option key={ss.id} value={ss.id}>
                        {ss.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-semibold small">Class</label>
                  <select
                    className="form-select"
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                  >
                    <option value="">All Classes</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.class_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-semibold small">Section</label>
                  <select
                    className="form-select"
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                  >
                    <option value="">All Sections</option>
                    {visibleSections.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.section_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-semibold small">Status</label>
                  <select
                    className="form-select"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                  >
                    <option value="">All Status</option>
                    <option value="enabled">Active</option>
                    <option value="disabled">Inactive</option>
                  </select>
                </div>

                <div className="col-md-5">
                  <label className="form-label fw-semibold small">Search</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search by name, father name, admission no..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="col-md-3">
                  <label className="form-label fw-semibold small">Students</label>
                  <button
                    type="button"
                    className="btn btn-outline-primary w-100"
                    onClick={() =>
                      fetchStudents({
                        classId: selectedClass,
                        sessionId: selectedSession,
                      }).catch((err) => {
                        console.error(err);
                        Swal.fire("Error", "Failed to refresh students.", "error");
                      })
                    }
                  >
                    <i className="bi bi-arrow-clockwise me-1"></i>
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm rounded-4 mb-3">
            <div className="card-body">
              <div className="row g-2 align-items-end">
                <div className="col-md-6">
                  <label className="form-label fw-semibold small">Template</label>
                  <select
                    className="form-select"
                    value={selectedTemplateKey}
                    onChange={(e) => setTemplateAndDefaults(e.target.value)}
                    disabled={loading}
                  >
                    {templates.map((tpl) => (
                      <option key={tpl.key} value={tpl.key}>
                        {getDisplayTemplateName(tpl)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-3">
                  <label className="form-label fw-semibold small">Cards / Page</label>
                  <select
                    className="form-select"
                    value={cardsPerPage}
                    onChange={(e) => setCardsPerPage(Number(e.target.value))}
                  >
                    {[1, 2, 4, 6, 8].map((count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-3">
                  <div className="small text-muted mb-1">Orientation</div>
                  <div className="fw-semibold">
                    {selectedTemplate?.orientation || "-"}
                  </div>
                </div>
              </div>

              <hr />

              <div className="d-flex flex-wrap gap-2 mb-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary rounded-pill"
                  onClick={selectAllFields}
                >
                  Select All Fields
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary rounded-pill"
                  onClick={resetFieldsToDefault}
                  disabled={!selectedTemplate}
                >
                  Default Fields
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary rounded-pill"
                  onClick={clearFields}
                >
                  Clear Fields
                </button>
              </div>

              <div className="row g-2">
                {fieldDefinitions.map((field) => (
                  <div className="col-xl-4 col-md-6" key={field.key}>
                    <label
                      className="d-flex align-items-center gap-2 border rounded-3 px-3 py-2 h-100"
                      style={{ cursor: "pointer", background: "#fff" }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedFields.includes(field.key)}
                        onChange={() => toggleField(field.key)}
                      />
                      <span className="small fw-semibold">{field.label}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-0">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 p-3 border-bottom">
                <div>
                  <h6 className="mb-0 fw-bold">Students</h6>
                  <div className="small text-muted">
                    Click preview on any student or select multiple for bulk PDF.
                  </div>
                </div>
                <div className="small text-muted">
                  Showing {filteredStudents.length} record(s)
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 44 }}></th>
                      <th style={{ width: 70 }}>Photo</th>
                      <th>Name</th>
                      <th>Admission No</th>
                      <th>Class</th>
                      <th>Section</th>
                      <th>Session</th>
                      <th>Status</th>
                      <th style={{ width: 170 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentsLoading ? (
                      <tr>
                        <td colSpan="9" className="text-center py-5 text-muted">
                          Loading students...
                        </td>
                      </tr>
                    ) : !filteredStudents.length ? (
                      <tr>
                        <td colSpan="9" className="text-center py-5 text-muted">
                          No students found.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((student) => {
                        const isSelected = selectedStudentIds.some(
                          (id) => String(id) === String(student.id)
                        );
                        const isPreviewing =
                          String(previewStudentId || effectivePreviewStudentId || "") ===
                          String(student.id);

                        return (
                          <tr
                            key={student.id}
                            style={{
                              background: isPreviewing
                                ? "rgba(59,130,246,0.05)"
                                : "transparent",
                            }}
                          >
                            <td>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleStudentSelection(student.id)}
                              />
                            </td>

                            <td>
                              <img
                                src={
                                  student?.photo
                                    ? buildStudentPhotoURL(student.photo)
                                    : NO_PHOTO_SVG
                                }
                                alt={student?.name || "Student"}
                                className="rounded-circle"
                                style={{
                                  width: 42,
                                  height: 42,
                                  objectFit: "cover",
                                  border: "2px solid #e5e7eb",
                                }}
                                onError={(e) => {
                                  e.currentTarget.src = NO_PHOTO_SVG;
                                }}
                              />
                            </td>

                            <td>
                              <div className="fw-semibold">{student.name || "-"}</div>
                              <div className="small text-muted">
                                {student.father_name || "-"}
                              </div>
                            </td>

                            <td>{student.admission_number || "-"}</td>
                            <td>{getClassName(student) || "-"}</td>
                            <td>{getSectionName(student) || "-"}</td>
                            <td>{getSessionName(student) || "-"}</td>
                            <td>
                              <span
                                className={`badge ${
                                  String(student.status || "").toLowerCase() === "enabled"
                                    ? "bg-success-subtle text-success"
                                    : "bg-danger-subtle text-danger"
                                }`}
                              >
                                {String(student.status || "-").toUpperCase()}
                              </span>
                            </td>

                            <td>
                              <div className="d-flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => handlePreviewStudent(student.id)}
                                >
                                  <i className="bi bi-eye me-1"></i>
                                  Preview
                                </button>

                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary"
                                  onClick={() => handleGenerateSinglePdf(student.id)}
                                  disabled={pdfLoading || !selectedFields.length}
                                >
                                  <i className="bi bi-file-earmark-pdf me-1"></i>
                                  PDF
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-5">
          <div
            className="card border-0 shadow-sm rounded-4"
            style={{ position: "sticky", top: 16 }}
          >
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
                <div>
                  <h6 className="mb-1 fw-bold">Live Preview</h6>
                  <div className="small text-muted">
                    {previewStudent
                      ? `${previewStudent.name || "Student"} • ${
                          previewStudent.admission_number || "-"
                        }`
                      : "Select a student to preview"}
                  </div>
                </div>

                {previewStudent ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary rounded-pill"
                    onClick={() => handleGenerateSinglePdf(previewStudent.id)}
                    disabled={pdfLoading || !selectedFields.length}
                  >
                    <i className="bi bi-download me-1"></i>
                    {pdfLoading ? "Generating..." : "Download PDF"}
                  </button>
                ) : null}
              </div>

              {previewLoading ? (
                <div
                  className="d-flex align-items-center justify-content-center text-muted rounded-4 border"
                  style={{ height: 720, background: "#fafafa" }}
                >
                  Loading preview...
                </div>
              ) : previewHtml ? (
                <iframe
                  title="Student ID Card Preview"
                  srcDoc={previewHtml}
                  style={{
                    width: "100%",
                    height: 720,
                    border: "1px solid #e5e7eb",
                    borderRadius: 18,
                    background: "#fff",
                  }}
                />
              ) : (
                <div
                  className="d-flex align-items-center justify-content-center text-muted rounded-4 border"
                  style={{ height: 720, background: "#fafafa" }}
                >
                  Preview will appear here.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentIdCards;