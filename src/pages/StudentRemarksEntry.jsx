// src/pages/StudentRemarksEntry.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";

const HEADER_Z = 1030; // below Bootstrap navbar (if any), above content

const StudentRemarksEntry = () => {
  const [filters, setFilters] = useState({ class_id: "", section_id: "", term_id: "" });
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [terms, setTerms] = useState([]);
  const [students, setStudents] = useState([]);
  const [remarksMap, setRemarksMap] = useState({});
  const [loading, setLoading] = useState(false);

  // Keep a stable list of refs for textareas to support Enter-to-next
  const textRefs = useRef({});

  useEffect(() => {
    loadAssignedClasses();
    loadTerms();
  }, []);

  useEffect(() => {
    const { class_id, section_id, term_id } = filters;
    if (class_id && section_id && term_id) fetchRemarks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.class_id, filters.section_id, filters.term_id]);

  const loadAssignedClasses = async () => {
    try {
      const res = await api.get("/coscholastic-evaluations/assigned-classes");
      setAssignedClasses(res.data || []);
    } catch (err) {
      console.error("Failed to load classes", err);
      Swal.fire("Error", "Failed to load assigned classes", "error");
    }
  };

  const loadTerms = async () => {
    try {
      const res = await api.get("/terms");
      setTerms(res.data || []);
    } catch (err) {
      console.error("Failed to load terms", err);
      Swal.fire("Error", "Failed to load terms", "error");
    }
  };

  const fetchRemarks = async () => {
    const { class_id, section_id, term_id } = filters;
    try {
      setLoading(true);
      const res = await api.get("/student-remarks", {
        params: { class_id, section_id, term_id },
      });

      const map = {};
      (res.data.existingRemarks || []).forEach((r) => {
        map[r.student_id] = r.remark || "";
      });

      setStudents(res.data.students || []);
      setRemarksMap(map);
    } catch (err) {
      console.error("Failed to fetch remarks", err);
      Swal.fire("Error", "Failed to fetch remarks", "error");
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
      Swal.fire("Error", "Failed to save remarks", "error");
    } finally {
      setLoading(false);
    }
  };

  // Keyboard shortcut: Ctrl/Cmd + S to save
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [students, remarksMap, filters]);

  // Build unique class list for the first dropdown (avoid duplicates)
  const uniqueClasses = useMemo(() => {
    const map = new Map();
    for (const c of assignedClasses) {
      if (!map.has(c.class_id)) map.set(c.class_id, c);
    }
    return Array.from(map.values());
  }, [assignedClasses]);

  // Style helpers for sticky columns
  const stickyColStyle = (leftPx) => ({
    position: "sticky",
    left: leftPx,
    background: "#fff",
    zIndex: 2,
  });

  const headerStickyStyle = {
    position: "sticky",
    top: 0,
    zIndex: 3,
  };

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
            <div className="col-md-4">
              <label className="form-label">Select Class</label>
              <select
                className="form-select"
                value={filters.class_id}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, class_id: e.target.value, section_id: "" }))
                }
              >
                <option value="">Select Class</option>
                {uniqueClasses.map((item) => (
                  <option key={item.class_id} value={item.class_id}>
                    {item.class_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label">Select Section</label>
              <select
                className="form-select"
                value={filters.section_id}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, section_id: e.target.value }))
                }
                disabled={!filters.class_id}
              >
                <option value="">Select Section</option>
                {assignedClasses
                  .filter((c) => String(c.class_id) === String(filters.class_id))
                  .map((item) => (
                    <option key={item.section_id} value={item.section_id}>
                      {item.section_name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label">Select Term</label>
              <select
                className="form-select"
                value={filters.term_id}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, term_id: e.target.value }))
                }
              >
                <option value="">Select Term</option>
                {terms.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
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

          {/* Loading / empty states */}
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
              {/* Scrollable container with sticky header/cols */}
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
                        <td style={stickyColStyle(0)}>{s.roll_number}</td>
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
                              // Enter to jump to next student (Shift+Enter for newline)
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                const next = students[idx + 1];
                                if (next && textRefs.current[next.id]) {
                                  textRefs.current[next.id].focus();
                                }
                              }
                            }}
                            placeholder="Type remark…"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bottom save for convenience */}
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
