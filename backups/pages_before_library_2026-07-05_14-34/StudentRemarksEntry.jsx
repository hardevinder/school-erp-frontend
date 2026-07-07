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

  const [filters, setFilters] = useState({
    session_id: "",
    class_id: "",
    section_id: "",
    term_id: "",
  });

  // Teacher/incharge assigned list
  const [assignedClasses, setAssignedClasses] = useState([]);

  // Global meta from backend
  const [classSections, setClassSections] = useState([]);
  const [sessions, setSessions] = useState([]);

  // Fallback global lists
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
        await loadGlobalMeta();
      } else {
        await loadAssignedClasses();
        await loadSessions();
      }
    } catch (e) {
      // already handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const { session_id, class_id, section_id, term_id } = filters;
    if (
      session_id !== "" &&
      class_id !== "" &&
      section_id !== "" &&
      term_id !== ""
    ) {
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

      if (active && filters.session_id === "") {
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

  const loadAssignedClasses = async () => {
    try {
      const res = await api.get("/coscholastic-evaluations/assigned-classes");
      const list = Array.isArray(res.data) ? res.data : [];
      setAssignedClasses(list);

      if (list.length > 0 && filters.class_id === "" && filters.section_id === "") {
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

  // ✅ Best path for admin/superadmin/examination
  const loadGlobalMeta = async () => {
    try {
      const res = await api.get("/student-remarks", {
        params: { meta: 1 },
      });

      const classSectionsList = Array.isArray(res.data?.classSections) ? res.data.classSections : [];
      const sessionsList = Array.isArray(res.data?.sessions) ? res.data.sessions : [];

      setClassSections(classSectionsList);
      setSessions(sessionsList);

      // derive unique classes
      const uniqueClasses = Array.from(
        new Map(
          classSectionsList.map((x) => [
            String(x.class_id),
            {
              id: x.class_id,
              class_name: x.class_name,
            },
          ])
        ).values()
      );

      setClasses(uniqueClasses);

      // auto-select active session
      const activeSession =
        sessionsList.find((s) => s.is_active === true || s.is_active === 1) || sessionsList[0];

      // auto-select first class
      const firstClass = uniqueClasses[0];

      setFilters((prev) => {
        const next = { ...prev };

        if (next.session_id === "" && activeSession) {
          next.session_id = String(activeSession.id);
        }

        if (next.class_id === "" && firstClass) {
          next.class_id = String(firstClass.id);
        }

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
            prev.section_id === "" && uniqueSections[0]
              ? String(uniqueSections[0].id)
              : prev.section_id,
        }));
      }
    } catch (err) {
      console.error("Failed to load global meta", err);

      // fallback older flow
      await Promise.all([loadSessions(), loadAllClasses()]);
    }
  };

  // fallback for global roles if meta endpoint not usable
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
      // Prefer meta-derived sections for global roles
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
            prev.section_id === "" && uniqueSections[0]
              ? String(uniqueSections[0].id)
              : prev.section_id,
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
            section_name: s.section_name ?? s.name ?? s.title ?? `Section ${s.id}`,
            class_id: s.class_id ?? s.classId ?? class_id,
          }))
        : [];

      const filtered = normalized.filter((x) => String(x.class_id) === String(class_id));
      setSections(filtered);

      if (filtered.length > 0 && filters.section_id === "") {
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
      const normalized = Array.isArray(list) ? list : [];
      setTerms(normalized);

      if (normalized.length > 0 && filters.term_id === "") {
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

  /* ---------------- API: remarks ---------------- */

  const fetchRemarks = async () => {
    const { session_id, class_id, section_id, term_id } = filters;

    try {
      setLoading(true);

      const res = await api.get("/student-remarks", {
        params: {
          session_id,
          class_id,
          section_id,
          term_id,
        },
      });

      const map = {};
      (res.data?.existingRemarks || []).forEach((r) => {
        map[String(r.student_id)] = r.remark || "";
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
    setRemarksMap((prev) => ({ ...prev, [String(student_id)]: value }));
  };

  const handleSave = async () => {
    const { session_id, class_id, section_id, term_id } = filters;

    if (
      session_id === "" ||
      class_id === "" ||
      section_id === "" ||
      term_id === ""
    ) {
      Swal.fire(
        "Missing filters",
        "Please select Session, Class, Section and Term first.",
        "warning"
      );
      return;
    }

    const payload = students.map((student) => ({
      student_id: student.id,
      session_id,
      class_id,
      section_id,
      term_id,
      remark: remarksMap[String(student.id)] || "",
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
            {/* Session */}
            <div className="col-md-3">
              <label className="form-label">Select Session</label>
              <select
                className="form-select"
                value={filters.session_id}
                onChange={(e) => {
                  const session_id = e.target.value;
                  setFilters((prev) => ({ ...prev, session_id }));
                  setStudents([]);
                  setRemarksMap({});
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

            {/* Class */}
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

              {!isGlobal && uniqueAssignedClasses.length === 0 && (
                <div className="form-text text-danger">No assigned classes found for this user.</div>
              )}
              {isGlobal && classes.length === 0 && (
                <div className="form-text text-danger">No classes loaded.</div>
              )}
            </div>

            {/* Section */}
            <div className="col-md-3">
              <label className="form-label">Select Section</label>
              <select
                className="form-select"
                value={filters.section_id}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, section_id: e.target.value }));
                  setStudents([]);
                  setRemarksMap({});
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

            {/* Term */}
            <div className="col-md-3">
              <label className="form-label">Select Term</label>
              <select
                className="form-select"
                value={filters.term_id}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, term_id: e.target.value }));
                  setStudents([]);
                  setRemarksMap({});
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

          <div className="mt-2 d-flex gap-2 flex-wrap">
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
                setStudents([]);
                setRemarksMap({});
                setSections([]);
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

      <div className="card">
        <div className="card-body">
          <div className="d-flex align-items-center mb-3">
            <h6 className="mb-0">📋 Remarks Table</h6>
            <button className="btn btn-outline-success btn-sm ms-auto" onClick={handleSave} disabled={loading}>
              {loading ? "Saving…" : "Save"}
            </button>
          </div>

          {filters.session_id === "" ||
          filters.class_id === "" ||
          filters.section_id === "" ||
          filters.term_id === "" ? (
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
                        <td style={stickyColStyle(90)}>
                          {s.name || s.student_name || "—"}
                        </td>
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