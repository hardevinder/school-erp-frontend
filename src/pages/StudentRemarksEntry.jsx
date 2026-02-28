import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";

const HEADER_Z = 1030;

/* ---------------- Role Helpers (same as CoScholasticEntry) ---------------- */
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

  const [filters, setFilters] = useState({ class_id: "", section_id: "", term_id: "" });

  // Teacher/incharge assigned list
  const [assignedClasses, setAssignedClasses] = useState([]);

  // Global lists
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);

  const [terms, setTerms] = useState([]);
  const [students, setStudents] = useState([]);
  const [remarksMap, setRemarksMap] = useState({});
  const [loading, setLoading] = useState(false);

  const textRefs = useRef({});

  useEffect(() => {
    init();
    // eslint-disable-next-line
  }, []);

  const init = async () => {
    try {
      setLoading(true);
      await loadTerms();

      if (isGlobal) {
        await loadAllClasses();
      } else {
        await loadAssignedClasses();
      }
    } catch (e) {
      // already handled in sub calls
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const { class_id, section_id, term_id } = filters;
    if (class_id && section_id && term_id) fetchRemarks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.class_id, filters.section_id, filters.term_id]);

  /* ---------------- Loaders ---------------- */

  const loadAssignedClasses = async () => {
    try {
      const res = await api.get("/coscholastic-evaluations/assigned-classes");
      const list = Array.isArray(res.data) ? res.data : [];
      setAssignedClasses(list);

      // Auto-select first
      if (list.length > 0 && !filters.class_id && !filters.section_id) {
        const first = list[0];
        setFilters((prev) => ({
          ...prev,
          class_id: String(first.class_id),
          section_id: String(first.section_id),
        }));
      }
    } catch (err) {
      console.error("Failed to load assigned classes", err);
      Swal.fire("Error", "Failed to load assigned classes", "error");
    }
  };

  // ✅ For global roles: load classes from /classes or /class
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

      // Auto-select first class
      if (normalized.length > 0 && !filters.class_id) {
        const firstId = String(normalized[0].id);
        setFilters((prev) => ({ ...prev, class_id: firstId, section_id: "" }));
        await loadSectionsForClass(firstId);
      }
    } catch (err) {
      console.error("Failed to load classes", err);
      Swal.fire("Error", "Failed to load classes", "error");
      setClasses([]);
    }
  };

  const loadSectionsForClass = async (class_id) => {
    if (!class_id) return;
    try {
      const res =
        (await api.get("/sections", { params: { class_id } }).catch(() => null)) ||
        (await api.get("/section", { params: { class_id } }).catch(() => null)) ||
        null;

      const list = res?.data?.sections || res?.data || [];
      const normalized = Array.isArray(list)
        ? list.map((s) => ({
            id: s.id ?? s.section_id ?? s.sectionId,
            section_name: s.section_name ?? s.name ?? s.title ?? `Section ${s.id}`,
            class_id: s.class_id ?? s.classId ?? class_id,
          }))
        : [];

      const filtered = normalized.filter((x) => String(x.class_id) === String(class_id));
      setSections(filtered);

      // Auto-select first section
      if (filtered.length > 0 && !filters.section_id) {
        setFilters((prev) => ({ ...prev, section_id: String(filtered[0].id) }));
      }
    } catch (err) {
      console.error("Failed to load sections", err);
      Swal.fire("Error", "Failed to load sections", "error");
      setSections([]);
    }
  };

  const loadTerms = async () => {
    try {
      const res = await api.get("/terms");
      const list = Array.isArray(res.data) ? res.data : res?.data?.terms || [];
      setTerms(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Failed to load terms", err);
      Swal.fire("Error", "Failed to load terms", "error");
    }
  };

  /* ---------------- API: remarks ---------------- */

  const fetchRemarks = async () => {
    const { class_id, section_id, term_id } = filters;
    try {
      setLoading(true);
      const res = await api.get("/student-remarks", {
        params: { class_id, section_id, term_id },
      });

      const map = {};
      (res.data?.existingRemarks || []).forEach((r) => {
        map[r.student_id] = r.remark || "";
      });

      setStudents(res.data?.students || []);
      setRemarksMap(map);
    } catch (err) {
      console.error("Failed to fetch remarks", err);
      Swal.fire("Error", err?.response?.data?.message || "Failed to fetch remarks", "error");
      setStudents([]);
      setRemarksMap({});
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (student_id, value) => {
    setRemarksMap((prev) => ({ ...prev, [student_id]: value }));
  };

  const handleSave = async () => {
    const { class_id, section_id, term_id } = filters;

    if (!class_id || !section_id || !term_id) {
      Swal.fire("Missing filters", "Please select Class, Section and Term first.", "warning");
      return;
    }

    const payload = students.map((student) => ({
      student_id: student.id,
      class_id,
      section_id,
      term_id,
      remark: remarksMap[student.id] || "",
    }));

    try {
      setLoading(true);
      await api.post("/student-remarks", { remarks: payload });
      Swal.fire("Success", "Remarks saved successfully", "success");
      fetchRemarks();
    } catch (err) {
      console.error("Failed to save remarks", err);
      Swal.fire("Error", err?.response?.data?.message || "Failed to save remarks", "error");
    } finally {
      setLoading(false);
    }
  };

  // Ctrl/Cmd + S
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
  }, [students, remarksMap, filters]);

  // Unique class list for teacher assigned
  const uniqueAssignedClasses = useMemo(() => {
    const map = new Map();
    for (const c of assignedClasses) {
      if (!map.has(String(c.class_id))) map.set(String(c.class_id), c);
    }
    return Array.from(map.values());
  }, [assignedClasses]);

  const sectionsForAssignedClass = useMemo(() => {
    return assignedClasses
      .filter((c) => String(c.class_id) === String(filters.class_id))
      .map((x) => ({ section_id: x.section_id, section_name: x.section_name }))
      .filter((x, idx, arr) => idx === arr.findIndex((y) => String(y.section_id) === String(x.section_id)));
  }, [assignedClasses, filters.class_id]);

  const stickyColStyle = (leftPx) => ({
    position: "sticky",
    left: leftPx,
    background: "#fff",
    zIndex: 2,
  });

  const headerStickyStyle = { position: "sticky", top: 0, zIndex: 3 };

  return (
    <div className="container-fluid px-3 py-3">
      <div className="d-flex align-items-center mb-2">
        <h4 className="mb-0">📝 Student Remarks Entry</h4>
        <div className="ms-auto d-flex gap-2">
          <button className="btn btn-success" onClick={handleSave} disabled={loading}>
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" />
                Saving…
              </>
            ) : (
              <>💾 Save (Ctrl/Cmd+S)</>
            )}
          </button>
        </div>
      </div>

      {/* Sticky Filter Bar */}
      <div
        className="card mb-3"
        style={{
          position: "sticky",
          top: 0,
          zIndex: HEADER_Z,
          boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
        }}
      >
        <div className="card-body py-3">
          <div className="row g-3">
            {/* Class */}
            <div className="col-md-4">
              <label className="form-label">Select Class</label>
              <select
                className="form-select"
                value={filters.class_id}
                onChange={async (e) => {
                  const class_id = e.target.value;
                  setFilters((prev) => ({ ...prev, class_id, section_id: "" }));
                  setStudents([]);
                  setRemarksMap({});

                  if (isGlobal) {
                    await loadSectionsForClass(class_id);
                  }
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

              {/* Helpful hint */}
              {!isGlobal && uniqueAssignedClasses.length === 0 && (
                <div className="form-text text-danger">No assigned classes found for this user.</div>
              )}
              {isGlobal && classes.length === 0 && (
                <div className="form-text text-danger">No classes loaded from /classes endpoint.</div>
              )}
            </div>

            {/* Section */}
            <div className="col-md-4">
              <label className="form-label">Select Section</label>
              <select
                className="form-select"
                value={filters.section_id}
                onChange={(e) => setFilters((prev) => ({ ...prev, section_id: e.target.value }))}
                disabled={!filters.class_id}
              >
                <option value="">Select Section</option>

                {!isGlobal
                  ? sectionsForAssignedClass.map((item) => (
                      <option key={item.section_id} value={item.section_id}>
                        {item.section_name}
                      </option>
                    ))
                  : sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.section_name}
                      </option>
                    ))}
              </select>
            </div>

            {/* Term */}
            <div className="col-md-4">
              <label className="form-label">Select Term</label>
              <select
                className="form-select"
                value={filters.term_id}
                onChange={(e) => setFilters((prev) => ({ ...prev, term_id: e.target.value }))}
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

          <div className="mt-2 d-flex gap-2 flex-wrap">
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => {
                setFilters({ class_id: "", section_id: "", term_id: "" });
                setStudents([]);
                setRemarksMap({});
              }}
              disabled={loading}
            >
              Reset Filters
            </button>

            <button className="btn btn-outline-primary btn-sm" onClick={init} disabled={loading}>
              Reload
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="card">
        <div className="card-body">
          <div className="d-flex align-items-center mb-3">
            <h6 className="mb-0">📋 Remarks Table</h6>
            <button className="btn btn-outline-success btn-sm ms-auto" onClick={handleSave} disabled={loading}>
              {loading ? "Saving…" : "Save"}
            </button>
          </div>

          {!filters.class_id || !filters.section_id || !filters.term_id ? (
            <div className="alert alert-info mb-0">
              Please select <strong>Class</strong>, <strong>Section</strong> and <strong>Term</strong> to view students.
            </div>
          ) : loading ? (
            <div className="d-flex align-items-center gap-2">
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
              <span>Loading data…</span>
            </div>
          ) : students.length === 0 ? (
            <div className="alert alert-warning mb-0">No students found for the selected filters.</div>
          ) : (
            <>
              <div
                className="table-responsive"
                style={{
                  maxHeight: 520,
                  overflow: "auto",
                  border: "1px solid var(--bs-border-color, #dee2e6)",
                  borderRadius: 8,
                }}
              >
                <table className="table table-bordered table-hover mb-0">
                  <thead className="table-light" style={headerStickyStyle}>
                    <tr>
                      <th style={{ minWidth: 90, ...stickyColStyle(0) }}>Roll No</th>
                      <th style={{ minWidth: 220, ...stickyColStyle(90) }}>Name</th>
                      <th style={{ minWidth: 480 }}>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, idx) => (
                      <tr key={s.id}>
                        <td style={stickyColStyle(0)}>
                          {s.roll_number == null || s.roll_number === "" ? "—" : s.roll_number}
                        </td>
                        <td style={stickyColStyle(90)}>{s.name}</td>
                        <td>
                          <textarea
                            ref={(el) => {
                              if (el) textRefs.current[s.id] = el;
                            }}
                            className="form-control"
                            rows={2}
                            value={remarksMap[s.id] || ""}
                            onChange={(e) => handleChange(s.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                const next = students[idx + 1];
                                if (next && textRefs.current[next.id]) textRefs.current[next.id].focus();
                              }
                            }}
                            placeholder="Type remark… (Shift+Enter = newline)"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 text-end">
                <button className="btn btn-success" onClick={handleSave} disabled={loading}>
                  {loading ? "Saving…" : "💾 Save Remarks"}
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