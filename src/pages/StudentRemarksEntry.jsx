import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";

const HEADER_Z = 1030;
const isMissingClassId = (value) => value == null || String(value).trim() === "";

const DEFAULT_RESULT_DECLARATIONS = [
  { value: "PASS", label: "Pass" },
  { value: "FAIL", label: "Fail" },
  { value: "PROMOTED", label: "Promoted" },
  { value: "DETAINED", label: "Detained" },
  { value: "NEEDS IMPROVEMENT", label: "Needs Improvement" },
  { value: "COMPARTMENT", label: "Compartment" },
  { value: "RESULT WITHHELD", label: "Result Withheld" },
];

const getRoleFlags = () => {
  const singleRole = localStorage.getItem("userRole");
  const multiRoles = JSON.parse(localStorage.getItem("roles") || "[]");
  const roles = (multiRoles.length ? multiRoles : [singleRole].filter(Boolean)).map((r) =>
    String(r || "").toLowerCase()
  );

  const isAdmin = roles.includes("admin");
  const isSuperadmin = roles.includes("superadmin");
  const isExamination = roles.includes("examination");

  return {
    roles,
    isAdmin,
    isSuperadmin,
    isExamination,
    isGlobal: isAdmin || isSuperadmin || isExamination,
  };
};

const StudentRemarksEntry = () => {
  const { isGlobal } = useMemo(getRoleFlags, []);

  const [filters, setFilters] = useState({
    session_id: "",
    class_id: "",
    section_id: "",
    term_id: "",
  });

  const [assignedClasses, setAssignedClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [terms, setTerms] = useState([]);

  const [students, setStudents] = useState([]);
  const [remarksMap, setRemarksMap] = useState({});
  const [resultDeclarationMap, setResultDeclarationMap] = useState({});
  const [resultDeclarationDateMap, setResultDeclarationDateMap] = useState({});
  const [resultDeclarationOptions, setResultDeclarationOptions] = useState(
    DEFAULT_RESULT_DECLARATIONS
  );

  const [bulkResultDeclaration, setBulkResultDeclaration] = useState("");
  const [bulkResultDeclarationDate, setBulkResultDeclarationDate] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [sectionsLoading, setSectionsLoading] = useState(false);

  const textRefs = useRef({});

  const clearStudentData = () => {
    setStudents([]);
    setRemarksMap({});
    setResultDeclarationMap({});
    setResultDeclarationDateMap({});
    setBulkResultDeclaration("");
    setBulkResultDeclarationDate("");
    setStudentSearch("");
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const init = async () => {
    try {
      setLoading(true);
      await loadTerms();

      if (isGlobal) {
        await loadGlobalMeta();
      } else {
        await Promise.all([loadAssignedClasses(), loadSessions()]);
      }
    } catch (e) {
      // loader functions show their own errors
    } finally {
      setLoading(false);
    }
  };

  // Section is intentionally NOT required.
  useEffect(() => {
    const { session_id, class_id, term_id } = filters;
    if (session_id !== "" && class_id !== "" && term_id !== "") {
      fetchRemarks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.session_id, filters.class_id, filters.section_id, filters.term_id]);

  /* ---------------- Loaders ---------------- */

  const loadSessions = async () => {
    try {
      const res = await api.get("/sessions");
      const list = Array.isArray(res.data) ? res.data : res?.data?.sessions || [];
      const normalized = Array.isArray(list) ? list : [];
      setSessions(normalized);

      const active =
        normalized.find((s) => s.is_active === true || s.is_active === 1) || normalized[0];

      if (active) {
        setFilters((prev) =>
          prev.session_id === "" ? { ...prev, session_id: String(active.id) } : prev
        );
      }
    } catch (err) {
      console.error("Failed to load sessions", err);
      Swal.fire("Error", "Failed to load sessions", "error");
      setSessions([]);
    }
  };

  const loadAssignedClasses = async () => {
    try {
      const res = await api.get("/coscholastic-evaluations/assigned-classes");
      const list = Array.isArray(res.data) ? res.data : [];
      setAssignedClasses(list);

      if (list.length > 0) {
        const first = list[0];
        setFilters((prev) =>
          prev.class_id === ""
            ? { ...prev, class_id: String(first.class_id), section_id: "" }
            : prev
        );

        const firstClassSections = list
          .filter((x) => String(x.class_id) === String(first.class_id))
          .map((x) => ({
            id: x.section_id,
            section_id: x.section_id,
            section_name: x.section_name,
          }))
          .filter((x) => x.id != null);
        setSections(
          Array.from(new Map(firstClassSections.map((x) => [String(x.id), x])).values())
        );
      }
    } catch (err) {
      console.error("Failed to load assigned classes", err);
      Swal.fire("Error", "Failed to load assigned classes", "error");
    }
  };

  const loadGlobalMeta = async () => {
    try {
      const res = await api.get("/student-remarks", { params: { meta: 1 } });

      const classList = Array.isArray(res.data?.classes) ? res.data.classes : [];
      const sessionsList = Array.isArray(res.data?.sessions) ? res.data.sessions : [];

      setClasses(classList);
      setSessions(sessionsList);
      if (Array.isArray(res.data?.resultDeclarationOptions)) {
        setResultDeclarationOptions(res.data.resultDeclarationOptions);
      }

      const activeSession =
        sessionsList.find((s) => s.is_active === true || s.is_active === 1) || sessionsList[0];
      const firstClass = classList[0];

      setFilters((prev) => ({
        ...prev,
        session_id:
          prev.session_id === "" && activeSession ? String(activeSession.id) : prev.session_id,
        class_id: prev.class_id === "" && firstClass ? String(firstClass.id) : prev.class_id,
        section_id: "",
      }));

      if (firstClass) {
        await loadSectionsForClass(firstClass.id);
      }
    } catch (err) {
      console.error("Failed to load global meta", err);
      await Promise.all([loadSessions(), loadAllClasses()]);
    }
  };

  const loadAllClasses = async () => {
    try {
      const res =
        (await api.get("/classes").catch(() => null)) ||
        (await api.get("/class").catch(() => null)) ||
        null;

      const list = res?.data?.classes || res?.data || [];
      const normalized = Array.isArray(list)
        ? list.map((c) => ({
            id: c.id ?? c.class_id ?? c.classId,
            class_name: c.class_name ?? c.name ?? c.title ?? `Class ${c.id}`,
          }))
        : [];

      setClasses(normalized);
      if (normalized.length > 0) {
        const firstId = String(normalized[0].id);
        setFilters((prev) =>
          prev.class_id === "" ? { ...prev, class_id: firstId, section_id: "" } : prev
        );
        await loadSectionsForClass(firstId);
      }
    } catch (err) {
      console.error("Failed to load classes", err);
      Swal.fire("Error", "Failed to load classes", "error");
      setClasses([]);
    }
  };

  const loadSectionsForClass = async (classId) => {
    if (isMissingClassId(classId)) {
      setSections([]);
      return;
    }

    if (!isGlobal) {
      const list = assignedClasses
        .filter((c) => String(c.class_id) === String(classId))
        .map((x) => ({
          id: x.section_id,
          section_id: x.section_id,
          section_name: x.section_name,
        }))
        .filter((x) => x.id != null);

      const unique = Array.from(
        new Map(list.map((s) => [String(s.id), s])).values()
      );
      setSections(unique);
      return;
    }

    try {
      setSectionsLoading(true);
      const res = await api.get("/student-remarks", {
        params: { meta: 1, class_id: classId },
      });
      const used = Array.isArray(res.data?.studentSections)
        ? res.data.studentSections
        : [];
      setSections(used);
    } catch (err) {
      console.error("Failed to load student sections", err);
      setSections([]);
    } finally {
      setSectionsLoading(false);
    }
  };

  const loadTerms = async () => {
    try {
      const res = await api.get("/terms");
      const list = Array.isArray(res.data) ? res.data : res?.data?.terms || [];
      const normalized = Array.isArray(list) ? list : [];
      setTerms(normalized);

      if (normalized.length > 0) {
        setFilters((prev) =>
          prev.term_id === "" ? { ...prev, term_id: String(normalized[0].id) } : prev
        );
      }
    } catch (err) {
      console.error("Failed to load terms", err);
      Swal.fire("Error", "Failed to load terms", "error");
    }
  };

  /* ---------------- API: remarks ---------------- */

  const fetchRemarks = async () => {
    const { session_id, class_id, section_id, term_id } = filters;
    if (!session_id || isMissingClassId(class_id) || !term_id) return;

    try {
      setLoading(true);

      const params = { session_id, class_id, term_id };
      if (section_id) params.section_id = section_id;

      const res = await api.get("/student-remarks", { params });

      const map = {};
      const declarationMap = {};
      const declarationDateMap = {};
      (res.data?.existingRemarks || []).forEach((r) => {
        const sid = String(r.student_id);
        map[sid] = r.remark || "";
        declarationMap[sid] = r.result_declaration || "";
        declarationDateMap[sid] = r.result_declaration_date || "";
      });

      setStudents(res.data?.students || []);
      setRemarksMap(map);
      setResultDeclarationMap(declarationMap);
      setResultDeclarationDateMap(declarationDateMap);
      if (Array.isArray(res.data?.resultDeclarationOptions)) {
        setResultDeclarationOptions(res.data.resultDeclarationOptions);
      }
      if (Array.isArray(res.data?.studentSections)) {
        setSections(res.data.studentSections);
      }
    } catch (err) {
      console.error("Failed to fetch remarks", err);
      Swal.fire("Error", err?.response?.data?.message || "Failed to fetch remarks", "error");
      setStudents([]);
      setRemarksMap({});
      setResultDeclarationMap({});
      setResultDeclarationDateMap({});
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (studentId, value) => {
    setRemarksMap((prev) => ({ ...prev, [String(studentId)]: value }));
  };

  const handleResultDeclarationChange = (studentId, value) => {
    setResultDeclarationMap((prev) => ({ ...prev, [String(studentId)]: value }));
  };

  const handleResultDeclarationDateChange = (studentId, value) => {
    setResultDeclarationDateMap((prev) => ({ ...prev, [String(studentId)]: value }));
  };

  const applyResultFieldsToAll = () => {
    if (!bulkResultDeclaration && !bulkResultDeclarationDate) {
      Swal.fire(
        "Nothing to apply",
        "Select Result Declaration and/or Date of Result Declaration first.",
        "info"
      );
      return;
    }

    if (bulkResultDeclaration) {
      const next = {};
      students.forEach((student) => {
        next[String(student.id)] = bulkResultDeclaration;
      });
      setResultDeclarationMap((prev) => ({ ...prev, ...next }));
    }

    if (bulkResultDeclarationDate) {
      const next = {};
      students.forEach((student) => {
        next[String(student.id)] = bulkResultDeclarationDate;
      });
      setResultDeclarationDateMap((prev) => ({ ...prev, ...next }));
    }

    Swal.fire({
      icon: "success",
      title: "Applied",
      text: `Result fields applied to ${students.length} student${students.length === 1 ? "" : "s"}.`,
      timer: 1200,
      showConfirmButton: false,
    });
  };

  const handleSave = async () => {
    const { session_id, class_id, term_id } = filters;

    if (!session_id || isMissingClassId(class_id) || !term_id) {
      Swal.fire(
        "Missing filters",
        "Please select Session, Class and Term. Section is optional.",
        "warning"
      );
      return;
    }

    if (!students.length) {
      Swal.fire("No students", "There are no students to save for the selected filters.", "info");
      return;
    }

    const payload = students.map((student) => ({
      student_id: student.id,
      session_id,
      class_id,
      section_id: student.section_id ?? null,
      term_id,
      remark: remarksMap[String(student.id)] || "",
      result_declaration: resultDeclarationMap[String(student.id)] || "",
      result_declaration_date: resultDeclarationDateMap[String(student.id)] || "",
    }));

    try {
      setLoading(true);
      await api.post("/student-remarks", { remarks: payload });
      await Swal.fire(
        "Saved",
        "Remarks and result declaration saved successfully.",
        "success"
      );
      fetchRemarks();
    } catch (err) {
      console.error("Failed to save remarks", err);
      Swal.fire("Error", err?.response?.data?.message || "Failed to save remarks", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, remarksMap, resultDeclarationMap, resultDeclarationDateMap, filters]);

  const uniqueAssignedClasses = useMemo(() => {
    const map = new Map();
    for (const c of assignedClasses) {
      if (!map.has(String(c.class_id))) map.set(String(c.class_id), c);
    }
    return Array.from(map.values());
  }, [assignedClasses]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;

    return students.filter((s) => {
      const values = [
        s.name,
        s.student_name,
        s.admission_number,
        s.roll_number,
        s.Section?.section_name,
      ];
      return values.some((v) => String(v ?? "").toLowerCase().includes(q));
    });
  }, [students, studentSearch]);

  const selectedClassName = useMemo(() => {
    if (isMissingClassId(filters.class_id)) return "";
    const source = isGlobal ? classes : uniqueAssignedClasses;
    const item = source.find((c) =>
      String(c.id ?? c.class_id) === String(filters.class_id)
    );
    return item?.class_name || "";
  }, [filters.class_id, isGlobal, classes, uniqueAssignedClasses]);

  const selectedTermName = useMemo(() => {
    const item = terms.find((t) => String(t.id) === String(filters.term_id));
    return item?.name || "";
  }, [terms, filters.term_id]);

  const stickyColStyle = (leftPx) => ({
    position: "sticky",
    left: leftPx,
    background: "var(--edb-surface)",
    zIndex: 2,
  });

  const headerStickyStyle = { position: "sticky", top: 0, zIndex: 3 };

  const readyForStudents =
    filters.session_id !== "" && filters.class_id !== "" && filters.term_id !== "";

  return (
    <div className="container-fluid px-3 py-3">
      <div className="d-flex flex-wrap align-items-start gap-2 mb-3">
        <div>
          <h4 className="mb-1">📝 Student Remarks & Result Declaration</h4>
          <div className="text-muted small">
            Enter teacher remarks, result declaration and declaration date. Section is optional.
          </div>
        </div>
        <div className="ms-auto d-flex align-items-center gap-2">
          {students.length > 0 && (
            <span className="badge rounded-pill text-bg-light border px-3 py-2">
              {students.length} student{students.length === 1 ? "" : "s"} loaded
            </span>
          )}
          <button className="btn btn-success" onClick={handleSave} disabled={loading || !students.length}>
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" />
                Saving…
              </>
            ) : (
              <>💾 Save All</>
            )}
          </button>
        </div>
      </div>

      <div
        className="card mb-3 border-0 shadow-sm"
        style={{ position: "sticky", top: 0, zIndex: HEADER_Z }}
      >
        <div className="card-body py-3">
          <div className="d-flex align-items-center mb-3">
            <div>
              <div className="fw-semibold">Report Filters</div>
              <div className="text-muted small">
                Choose Session, Class and Term. Use Section only when you want to narrow the class.
              </div>
            </div>
            <button
              className="btn btn-outline-primary btn-sm ms-auto"
              onClick={fetchRemarks}
              disabled={loading || !readyForStudents}
            >
              ↻ Reload Students
            </button>
          </div>

          <div className="row g-3">
            <div className="col-xl-3 col-md-6">
              <label className="form-label fw-medium">Session</label>
              <select
                className="form-select"
                value={filters.session_id}
                onChange={(e) => {
                  clearStudentData();
                  setFilters((prev) => ({ ...prev, session_id: e.target.value }));
                }}
              >
                <option value="">Select Session</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.is_active ? " (Active)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-xl-3 col-md-6">
              <label className="form-label fw-medium">Class</label>
              <select
                className="form-select"
                value={filters.class_id}
                onChange={async (e) => {
                  const classId = e.target.value;
                  clearStudentData();
                  setSections([]);
                  setFilters((prev) => ({ ...prev, class_id: classId, section_id: "" }));
                  await loadSectionsForClass(classId);
                }}
              >
                <option value="">Select Class</option>
                {!isGlobal
                  ? uniqueAssignedClasses.map((item) => (
                      <option key={item.class_id} value={item.class_id}>
                        {item.class_name}
                      </option>
                    ))
                  : classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.class_name}
                      </option>
                    ))}
              </select>
              {!isGlobal && uniqueAssignedClasses.length === 0 && (
                <div className="form-text text-danger">No assigned classes found for this user.</div>
              )}
            </div>

            <div className="col-xl-3 col-md-6">
              <label className="form-label fw-medium">
                Section <span className="badge text-bg-light border fw-normal">Optional</span>
              </label>
              <select
                className="form-select"
                value={filters.section_id}
                onChange={(e) => {
                  clearStudentData();
                  setFilters((prev) => ({ ...prev, section_id: e.target.value }));
                }}
                disabled={isMissingClassId(filters.class_id) || sectionsLoading}
              >
                <option value="">All Sections / No Section Restriction</option>
                {sections.map((s) => (
                  <option key={s.id ?? s.section_id} value={s.id ?? s.section_id}>
                    {s.section_name || `Section ${s.id ?? s.section_id}`}
                  </option>
                ))}
              </select>
              <div className="form-text">
                {sectionsLoading
                  ? "Checking sections used by students…"
                  : sections.length === 0 && !isMissingClassId(filters.class_id)
                  ? "No section is assigned to students in this class — this is okay."
                  : "Only sections actually assigned to students are listed."}
              </div>
            </div>

            <div className="col-xl-3 col-md-6">
              <label className="form-label fw-medium">Term</label>
              <select
                className="form-select"
                value={filters.term_id}
                onChange={(e) => {
                  clearStudentData();
                  setFilters((prev) => ({ ...prev, term_id: e.target.value }));
                }}
              >
                <option value="">Select Term</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => {
                const activeSession =
                  sessions.find((s) => s.is_active === true || s.is_active === 1) || sessions[0];
                setFilters({
                  session_id: activeSession ? String(activeSession.id) : "",
                  class_id: "",
                  section_id: "",
                  term_id: terms[0] ? String(terms[0].id) : "",
                });
                setSections([]);
                clearStudentData();
              }}
              disabled={loading}
            >
              Reset Filters
            </button>

            {selectedClassName && selectedTermName && (
              <div className="small text-muted ms-md-auto">
                Working on <strong>{selectedClassName}</strong> · <strong>{selectedTermName}</strong>
                {filters.section_id ? " · filtered by section" : " · all students in class"}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card mb-3 border-primary-subtle shadow-sm">
        <div className="card-body py-3">
          <div className="d-flex align-items-center mb-3">
            <div>
              <div className="fw-semibold">Quick Fill</div>
              <div className="text-muted small">Apply declaration and/or date to all loaded students.</div>
            </div>
          </div>
          <div className="row g-3 align-items-end">
            <div className="col-lg-4 col-md-5">
              <label className="form-label mb-1">Result Declaration</label>
              <select
                className="form-select"
                value={bulkResultDeclaration}
                onChange={(e) => setBulkResultDeclaration(e.target.value)}
                disabled={students.length === 0}
              >
                <option value="">Select Result Declaration</option>
                {resultDeclarationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-lg-4 col-md-4">
              <label className="form-label mb-1">Date of Result Declaration</label>
              <input
                type="date"
                className="form-control"
                value={bulkResultDeclarationDate}
                onChange={(e) => setBulkResultDeclarationDate(e.target.value)}
                disabled={students.length === 0}
              />
            </div>
            <div className="col-lg-4 col-md-3 d-grid">
              <button
                type="button"
                className="btn btn-primary"
                onClick={applyResultFieldsToAll}
                disabled={students.length === 0 || loading}
              >
                Apply to All Loaded Students
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            <div>
              <h6 className="mb-0">📋 Remarks Table</h6>
              {students.length > 0 && (
                <div className="text-muted small mt-1">
                  Showing {filteredStudents.length} of {students.length} loaded students
                </div>
              )}
            </div>

            {students.length > 0 && (
              <div className="ms-auto d-flex gap-2 align-items-center">
                <input
                  type="search"
                  className="form-control form-control-sm"
                  style={{ minWidth: 260 }}
                  placeholder="Search name, admission no., roll no.…"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
                <button
                  className="btn btn-outline-success btn-sm"
                  onClick={handleSave}
                  disabled={loading}
                >
                  Save
                </button>
              </div>
            )}
          </div>

          {!readyForStudents ? (
            <div className="alert alert-info mb-0">
              Select <strong>Session</strong>, <strong>Class</strong> and <strong>Term</strong> to view students.
              <br />
              <span className="small">Section is optional and can be left as “All Sections / No Section Restriction”.</span>
            </div>
          ) : loading ? (
            <div className="d-flex align-items-center gap-2 py-3">
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
              <span>Loading students and saved remarks…</span>
            </div>
          ) : students.length === 0 ? (
            <div className="alert alert-warning mb-0">
              <div className="fw-semibold">No students found.</div>
              <div className="small mt-1">
                No enabled/visible students were found for this Class{filters.section_id ? " and Section" : ""}.
                You can leave Section unselected to load the entire class.
              </div>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="alert alert-light border mb-0">
              No students match “{studentSearch}”. Clear the search to show all loaded students.
            </div>
          ) : (
            <>
              <div
                className="table-responsive"
                style={{
                  maxHeight: 560,
                  overflow: "auto",
                  border: "1px solid var(--bs-border-color, #dee2e6)",
                  borderRadius: 10,
                }}
              >
                <table className="table table-bordered table-hover align-middle mb-0">
                  <thead className="table-light" style={headerStickyStyle}>
                    <tr>
                      <th style={{ minWidth: 90, ...stickyColStyle(0) }}>Roll No</th>
                      <th style={{ minWidth: 250, ...stickyColStyle(90) }}>Student</th>
                      <th style={{ minWidth: 95 }}>Section</th>
                      <th style={{ minWidth: 360 }}>Remarks</th>
                      <th style={{ minWidth: 190 }}>Result Declaration</th>
                      <th style={{ minWidth: 190 }}>Declaration Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s) => {
                      const originalIndex = students.findIndex((x) => String(x.id) === String(s.id));
                      return (
                        <tr key={s.id}>
                          <td style={stickyColStyle(0)}>
                            {s.roll_number == null || s.roll_number === "" ? "—" : s.roll_number}
                          </td>
                          <td style={stickyColStyle(90)}>
                            <div className="fw-semibold">{s.name || s.student_name || "—"}</div>
                            <div className="text-muted small">
                              {s.admission_number ? `Adm. No. ${s.admission_number}` : "No admission number"}
                            </div>
                          </td>
                          <td>{s.Section?.section_name || "—"}</td>
                          <td>
                            <textarea
                              ref={(el) => {
                                if (el) textRefs.current[s.id] = el;
                              }}
                              className="form-control"
                              rows={2}
                              value={remarksMap[String(s.id)] || ""}
                              onChange={(e) => handleChange(s.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  const next = students[originalIndex + 1];
                                  if (next && textRefs.current[next.id]) textRefs.current[next.id].focus();
                                }
                              }}
                              placeholder="Type teacher remark… (Shift+Enter = newline)"
                            />
                          </td>
                          <td>
                            <select
                              className="form-select"
                              value={resultDeclarationMap[String(s.id)] || ""}
                              onChange={(e) => handleResultDeclarationChange(s.id, e.target.value)}
                            >
                              <option value="">Select</option>
                              {resultDeclarationOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="date"
                              className="form-control"
                              value={resultDeclarationDateMap[String(s.id)] || ""}
                              onChange={(e) => handleResultDeclarationDateChange(s.id, e.target.value)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 d-flex justify-content-end">
                <button className="btn btn-success" onClick={handleSave} disabled={loading}>
                  {loading ? "Saving…" : "💾 Save Remarks & Result"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentRemarksEntry;
