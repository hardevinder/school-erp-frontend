import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";

const HEADER_Z = 1030;

/* ---------------- Role Helpers ---------------- */
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

const getTodayDate = () => {
  return new Date().toISOString().slice(0, 10);
};

const StudentPromotionDecisionEntry = () => {
  const { isGlobal } = useMemo(getRoleFlags, []);

  const [filters, setFilters] = useState({
    session_id: "",
    class_id: "",
    section_id: "",
    term_id: "",
  });

  const [assignedClasses, setAssignedClasses] = useState([]);
  const [classSections, setClassSections] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [terms, setTerms] = useState([]);

  const [students, setStudents] = useState([]);
  const [decisionMap, setDecisionMap] = useState({});
  const [loading, setLoading] = useState(false);

  const [bulkStatus, setBulkStatus] = useState("PROMOTED");
  const [bulkPromotedToClassId, setBulkPromotedToClassId] = useState("");
  const [bulkPromotionDate, setBulkPromotionDate] = useState(getTodayDate());

  useEffect(() => {
    init();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    const { session_id, class_id, section_id, term_id } = filters;
    if (session_id && class_id !== "" && section_id && term_id) {
      fetchPromotionDecisions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.session_id, filters.class_id, filters.section_id, filters.term_id]);

  const init = async () => {
    try {
      setLoading(true);
      await loadTerms();

      if (isGlobal) {
        await loadGlobalMeta();
      } else {
        await loadAssignedClasses();
        await loadSessions();
        await loadAllClasses();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Loaders ---------------- */

  const loadSessions = async () => {
    try {
      const res = await api.get("/sessions");
      const list = Array.isArray(res.data) ? res.data : res?.data?.sessions || [];
      const normalized = Array.isArray(list) ? list : [];
      setSessions(normalized);

      const active =
        normalized.find((s) => s.is_active === true || s.is_active === 1) || normalized[0];

      if (active && !filters.session_id) {
        setFilters((prev) => ({
          ...prev,
          session_id: String(active.id),
        }));
      }
    } catch (err) {
      console.error("Failed to load sessions", err);
      Swal.fire("Error", "Failed to load sessions", "error");
      setSessions([]);
    }
  };

  const loadTerms = async () => {
    try {
      const res = await api.get("/terms");
      const list = Array.isArray(res.data) ? res.data : res?.data?.terms || [];
      const normalized = Array.isArray(list) ? list : [];
      setTerms(normalized);

      if (normalized.length > 0 && !filters.term_id) {
        setFilters((prev) => ({
          ...prev,
          term_id: String(normalized[0].id),
        }));
      }
    } catch (err) {
      console.error("Failed to load terms", err);
      Swal.fire("Error", "Failed to load terms", "error");
    }
  };

  const loadAssignedClasses = async () => {
    try {
      const res = await api.get("/coscholastic-evaluations/assigned-classes");
      const list = Array.isArray(res.data) ? res.data : [];
      setAssignedClasses(list);

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

  const loadGlobalMeta = async () => {
    try {
      const res = await api.get("/student-promotion-decisions", {
        params: { meta: 1 },
      });

      const classSectionsList = Array.isArray(res.data?.classSections) ? res.data.classSections : [];
      const sessionsList = Array.isArray(res.data?.sessions) ? res.data.sessions : [];
      const classesList = Array.isArray(res.data?.classes) ? res.data.classes : [];

      setClassSections(classSectionsList);
      setSessions(sessionsList);
      setClasses(classesList);

      const activeSession =
        sessionsList.find((s) => s.is_active === true || s.is_active === 1) || sessionsList[0];
      const firstClass = classesList[0];

      setFilters((prev) => {
        const next = { ...prev };
        if (!next.session_id && activeSession) next.session_id = String(activeSession.id);
        if (next.class_id === "" && firstClass) next.class_id = String(firstClass.id);
        return next;
      });

      if (firstClass) {
        const filteredSections = classSectionsList
          .filter((x) => String(x.class_id) === String(firstClass.id))
          .map((x) => ({
            id: x.section_id,
            section_name: x.section_name,
            class_id: x.class_id,
          }));

        const uniqueSections = Array.from(
          new Map(
            filteredSections.map((s) => [
              String(s.id),
              {
                id: s.id,
                section_name: s.section_name,
                class_id: s.class_id,
              },
            ])
          ).values()
        );

        setSections(uniqueSections);

        setFilters((prev) => ({
          ...prev,
          section_id:
            !prev.section_id && uniqueSections[0] ? String(uniqueSections[0].id) : prev.section_id,
        }));
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
            class_name: c.class_name ?? c.name ?? `Class ${c.id}`,
          }))
        : [];

      setClasses(normalized);

      if (normalized.length > 0 && filters.class_id === "") {
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
    if (class_id === "" || class_id === null || class_id === undefined) return;

    try {
      if (isGlobal && classSections.length > 0) {
        const filteredSections = classSections
          .filter((x) => String(x.class_id) === String(class_id))
          .map((x) => ({
            id: x.section_id,
            section_name: x.section_name,
            class_id: x.class_id,
          }));

        const uniqueSections = Array.from(
          new Map(
            filteredSections.map((s) => [
              String(s.id),
              {
                id: s.id,
                section_name: s.section_name,
                class_id: s.class_id,
              },
            ])
          ).values()
        );

        setSections(uniqueSections);

        setFilters((prev) => ({
          ...prev,
          section_id:
            !prev.section_id && uniqueSections[0] ? String(uniqueSections[0].id) : prev.section_id,
        }));
        return;
      }

      const res =
        (await api.get("/sections", { params: { class_id } }).catch(() => null)) ||
        (await api.get("/section", { params: { class_id } }).catch(() => null)) ||
        null;

      const list = res?.data?.sections || res?.data || [];
      const normalized = Array.isArray(list)
        ? list.map((s) => ({
            id: s.id ?? s.section_id ?? s.sectionId,
            section_name: s.section_name ?? s.name ?? `Section ${s.id}`,
            class_id: s.class_id ?? s.classId ?? class_id,
          }))
        : [];

      const filtered = normalized.filter((x) => String(x.class_id) === String(class_id));
      setSections(filtered);

      if (filtered.length > 0 && !filters.section_id) {
        setFilters((prev) => ({ ...prev, section_id: String(filtered[0].id) }));
      }
    } catch (err) {
      console.error("Failed to load sections", err);
      Swal.fire("Error", "Failed to load sections", "error");
      setSections([]);
    }
  };

  /* ---------------- API ---------------- */

  const fetchPromotionDecisions = async () => {
    const { session_id, class_id, section_id, term_id } = filters;

    try {
      setLoading(true);

      const res = await api.get("/student-promotion-decisions", {
        params: { session_id, class_id, section_id, term_id },
      });

      const studentsList = Array.isArray(res.data?.students) ? res.data.students : [];
      const allClasses = Array.isArray(res.data?.classes) ? res.data.classes : classes;
      const existing = Array.isArray(res.data?.existingDecisions) ? res.data.existingDecisions : [];

      setStudents(studentsList);
      if (allClasses.length > 0) setClasses(allClasses);

      const map = {};
      existing.forEach((d) => {
        map[String(d.student_id)] = {
          promotion_status: d.promotion_status || "PROMOTED",
          promoted_to_class_id:
            d.promoted_to_class_id !== null && d.promoted_to_class_id !== undefined
              ? String(d.promoted_to_class_id)
              : "",
          promotion_date: d.promotion_date
            ? String(d.promotion_date).slice(0, 10)
            : getTodayDate(),
          remarks: d.remarks || "",
        };
      });

      studentsList.forEach((s) => {
        if (!map[String(s.id)]) {
          map[String(s.id)] = {
            promotion_status: "PROMOTED",
            promoted_to_class_id: "",
            promotion_date: getTodayDate(),
            remarks: "",
          };
        }
      });

      setDecisionMap(map);
    } catch (err) {
      console.error("Failed to fetch promotion decisions", err);
      Swal.fire(
        "Error",
        err?.response?.data?.message || "Failed to fetch promotion decisions",
        "error"
      );
      setStudents([]);
      setDecisionMap({});
    } finally {
      setLoading(false);
    }
  };

  const handleDecisionChange = (studentId, key, value) => {
    setDecisionMap((prev) => {
      const current = prev[String(studentId)] || {
        promotion_status: "PROMOTED",
        promoted_to_class_id: "",
        promotion_date: getTodayDate(),
        remarks: "",
      };

      const next = {
        ...prev,
        [String(studentId)]: {
          ...current,
          [key]: value,
        },
      };

      if (key === "promotion_status" && value === "NOT_PROMOTED") {
        next[String(studentId)].promoted_to_class_id = "";
      }

      return next;
    });
  };

  const handleBulkApply = () => {
    if (students.length === 0) {
      Swal.fire("Info", "No students available to apply bulk action.", "info");
      return;
    }

    if (bulkStatus === "PROMOTED" && !bulkPromotedToClassId) {
      Swal.fire("Warning", "Please select bulk promoted class first.", "warning");
      return;
    }

    const next = { ...decisionMap };

    students.forEach((s) => {
      next[String(s.id)] = {
        ...(next[String(s.id)] || {
          promotion_status: "PROMOTED",
          promoted_to_class_id: "",
          promotion_date: getTodayDate(),
          remarks: "",
        }),
        promotion_status: bulkStatus,
        promoted_to_class_id: bulkStatus === "PROMOTED" ? String(bulkPromotedToClassId) : "",
        promotion_date: bulkPromotionDate || getTodayDate(),
      };
    });

    setDecisionMap(next);

    Swal.fire("Success", "Bulk action applied.", "success");
  };

  const handleSave = async () => {
    const { session_id, class_id, section_id, term_id } = filters;

    if (!session_id || class_id === "" || !section_id || !term_id) {
      Swal.fire(
        "Missing filters",
        "Please select Session, Class, Section and Term first.",
        "warning"
      );
      return;
    }

    const payload = students.map((student) => {
      const item = decisionMap[String(student.id)] || {
        promotion_status: "PROMOTED",
        promoted_to_class_id: "",
        promotion_date: getTodayDate(),
        remarks: "",
      };

      return {
        student_id: student.id,
        session_id,
        class_id,
        section_id,
        term_id,
        promotion_status: item.promotion_status || "PROMOTED",
        promoted_to_class_id:
          item.promotion_status === "PROMOTED" && item.promoted_to_class_id
            ? item.promoted_to_class_id
            : null,
        promotion_date: item.promotion_date || null,
        remarks: item.remarks || "",
      };
    });

    const invalidPromoted = payload.find(
      (x) => x.promotion_status === "PROMOTED" && !x.promoted_to_class_id
    );

    if (invalidPromoted) {
      Swal.fire(
        "Validation Error",
        "For promoted students, promoted class is required.",
        "warning"
      );
      return;
    }

    try {
      setLoading(true);
      await api.post("/student-promotion-decisions", { decisions: payload });
      Swal.fire("Success", "Promotion decisions saved successfully", "success");
      fetchPromotionDecisions();
    } catch (err) {
      console.error("Failed to save promotion decisions", err);
      Swal.fire(
        "Error",
        err?.response?.data?.message || "Failed to save promotion decisions",
        "error"
      );
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
  }, [students, decisionMap, filters]);

  /* ---------------- Derived ---------------- */

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
      .filter(
        (x, idx, arr) =>
          idx === arr.findIndex((y) => String(y.section_id) === String(x.section_id))
      );
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
        <h4 className="mb-0">🎓 Student Promotion Decision Entry</h4>
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
            <div className="col-md-3">
              <label className="form-label">Select Session</label>
              <select
                className="form-select"
                value={filters.session_id}
                onChange={(e) => {
                  const session_id = e.target.value;
                  setFilters((prev) => ({ ...prev, session_id }));
                  setStudents([]);
                  setDecisionMap({});
                }}
              >
                <option value="">Select Session</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.is_active ? " (Active)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label">Select Class</label>
              <select
                className="form-select"
                value={filters.class_id}
                onChange={async (e) => {
                  const class_id = e.target.value;
                  setFilters((prev) => ({
                    ...prev,
                    class_id,
                    section_id: "",
                  }));
                  setStudents([]);
                  setDecisionMap({});

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
            </div>

            <div className="col-md-3">
              <label className="form-label">Select Section</label>
              <select
                className="form-select"
                value={filters.section_id}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, section_id: e.target.value }));
                  setStudents([]);
                  setDecisionMap({});
                }}
                disabled={filters.class_id === ""}
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

            <div className="col-md-3">
              <label className="form-label">Select Term</label>
              <select
                className="form-select"
                value={filters.term_id}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, term_id: e.target.value }));
                  setStudents([]);
                  setDecisionMap({});
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

          <hr />

          <div className="row g-3 align-items-end">
            <div className="col-md-3">
              <label className="form-label">Bulk Status</label>
              <select
                className="form-select"
                value={bulkStatus}
                onChange={(e) => {
                  const value = e.target.value;
                  setBulkStatus(value);
                  if (value === "NOT_PROMOTED") {
                    setBulkPromotedToClassId("");
                  }
                }}
              >
                <option value="PROMOTED">PROMOTED</option>
                <option value="NOT_PROMOTED">NOT_PROMOTED</option>
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label">Bulk Promote To Class</label>
              <select
                className="form-select"
                value={bulkPromotedToClassId}
                onChange={(e) => setBulkPromotedToClassId(e.target.value)}
                disabled={bulkStatus !== "PROMOTED"}
              >
                <option value="">Select Class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.class_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label">Bulk Promotion Date</label>
              <input
                type="date"
                className="form-control"
                value={bulkPromotionDate}
                onChange={(e) => setBulkPromotionDate(e.target.value)}
              />
            </div>

            <div className="col-md-3 d-flex gap-2">
              <button className="btn btn-primary" onClick={handleBulkApply} disabled={loading}>
                Apply Bulk Action
              </button>

              <button
                className="btn btn-outline-secondary"
                onClick={() => {
                  const activeSession =
                    sessions.find((s) => s.is_active === true || s.is_active === 1) || sessions[0];

                  setFilters({
                    session_id: activeSession ? String(activeSession.id) : "",
                    class_id: "",
                    section_id: "",
                    term_id: terms[0] ? String(terms[0].id) : "",
                  });
                  setStudents([]);
                  setDecisionMap({});
                  setSections([]);
                  setBulkStatus("PROMOTED");
                  setBulkPromotedToClassId("");
                  setBulkPromotionDate(getTodayDate());
                }}
                disabled={loading}
              >
                Reset Filters
              </button>

              <button className="btn btn-outline-primary" onClick={init} disabled={loading}>
                Reload
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="d-flex align-items-center mb-3">
            <h6 className="mb-0">📋 Promotion Decision Table</h6>
            <button className="btn btn-outline-success btn-sm ms-auto" onClick={handleSave} disabled={loading}>
              {loading ? "Saving…" : "Save"}
            </button>
          </div>

          {!filters.session_id || filters.class_id === "" || !filters.section_id || !filters.term_id ? (
            <div className="alert alert-info mb-0">
              Please select <strong>Session</strong>, <strong>Class</strong>, <strong>Section</strong> and{" "}
              <strong>Term</strong> to view students.
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
                  maxHeight: 560,
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
                      <th style={{ minWidth: 170 }}>Status</th>
                      <th style={{ minWidth: 220 }}>Promote To Class</th>
                      <th style={{ minWidth: 170 }}>Promotion Date</th>
                      <th style={{ minWidth: 260 }}>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => {
                      const item = decisionMap[String(s.id)] || {
                        promotion_status: "PROMOTED",
                        promoted_to_class_id: "",
                        promotion_date: getTodayDate(),
                        remarks: "",
                      };

                      return (
                        <tr key={s.id}>
                          <td style={stickyColStyle(0)}>
                            {s.roll_number == null || s.roll_number === "" ? "—" : s.roll_number}
                          </td>
                          <td style={stickyColStyle(90)}>
                            {s.name || s.student_name || "—"}
                          </td>
                          <td>
                            <select
                              className="form-select"
                              value={item.promotion_status}
                              onChange={(e) =>
                                handleDecisionChange(s.id, "promotion_status", e.target.value)
                              }
                            >
                              <option value="PROMOTED">PROMOTED</option>
                              <option value="NOT_PROMOTED">NOT_PROMOTED</option>
                            </select>
                          </td>
                          <td>
                            <select
                              className="form-select"
                              value={item.promoted_to_class_id}
                              onChange={(e) =>
                                handleDecisionChange(s.id, "promoted_to_class_id", e.target.value)
                              }
                              disabled={item.promotion_status !== "PROMOTED"}
                            >
                              <option value="">Select Class</option>
                              {classes.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.class_name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="date"
                              className="form-control"
                              value={item.promotion_date || ""}
                              onChange={(e) =>
                                handleDecisionChange(s.id, "promotion_date", e.target.value)
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="form-control"
                              value={item.remarks}
                              onChange={(e) => handleDecisionChange(s.id, "remarks", e.target.value)}
                              placeholder="Optional remarks"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 text-end">
                <button className="btn btn-success" onClick={handleSave} disabled={loading}>
                  {loading ? "Saving…" : "💾 Save Promotion Decisions"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentPromotionDecisionEntry;