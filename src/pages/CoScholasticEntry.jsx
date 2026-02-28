import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";

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

const CoScholasticEntry = () => {
  const { roles, isGlobal } = useMemo(getRoleFlags, []);

  const [filters, setFilters] = useState({
    class_id: "",
    section_id: "",
    term_id: "",
  });

  // Teacher/incharge assigned classes list
  const [assignedClasses, setAssignedClasses] = useState([]);

  // Global lists
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);

  const [terms, setTerms] = useState([]);
  const [students, setStudents] = useState([]);
  const [areas, setAreas] = useState([]);
  const [evaluations, setEvaluations] = useState({});
  const [grades, setGrades] = useState([]);
  const inputRefs = useRef({});

  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(Date.now());

  /* ---------------- Initial Loads ---------------- */
  useEffect(() => {
    init();
    // eslint-disable-next-line
  }, []);

  const init = async () => {
    setLoading(true);
    try {
      await Promise.all([loadTerms(), loadGrades()]);
      if (isGlobal) {
        await loadAllClasses();
      } else {
        await loadAssignedClasses();
      }
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Loaders ---------------- */
  const loadAssignedClasses = async () => {
    try {
      const res = await api.get("/coscholastic-evaluations/assigned-classes");
      const list = Array.isArray(res.data) ? res.data : [];
      setAssignedClasses(list);

      // Auto-select first if empty
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

  // ✅ For global roles
  const loadAllClasses = async () => {
    try {
      // try common endpoints
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
    }
  };

  const loadSectionsForClass = async (class_id) => {
    if (!class_id) return;
    try {
      // try common endpoints
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

      // If API returns all sections, filter locally by class
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

  const loadGrades = async () => {
    try {
      const res = await api.get("/co-scholastic-grades");
      const list = Array.isArray(res.data) ? res.data : res?.data?.grades || [];
      setGrades(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Failed to load grades", err);
      Swal.fire("Error", "Failed to load grades", "error");
      setGrades([]);
    }
  };

  /* ---------------- Fetch Evaluation Data ---------------- */
  useEffect(() => {
    const { class_id, section_id, term_id } = filters;
    if (class_id && section_id && term_id) {
      fetchEvaluationData();
    } else {
      setStudents([]);
      setAreas([]);
      setEvaluations({});
    }
    // eslint-disable-next-line
  }, [filters.class_id, filters.section_id, filters.term_id]);

  const fetchEvaluationData = async () => {
    const { class_id, section_id, term_id } = filters;
    setLoading(true);
    try {
      const res = await api.get("/coscholastic-evaluations", {
        params: { class_id, section_id, term_id },
      });

      const studentsData = Array.isArray(res.data.students) ? res.data.students : [];
      const areasData = Array.isArray(res.data.areas) ? res.data.areas : [];
      const existing = Array.isArray(res.data.existingEvaluations) ? res.data.existingEvaluations : [];

      setStudents(studentsData);
      setAreas(areasData);

      const map = {};
      existing.forEach((ev) => {
        map[`${ev.student_id}_${ev.co_scholastic_area_id}`] = {
          grade_id: ev.grade_id || "",
          locked: ev.locked || false,
        };
      });
      setEvaluations(map);

      if (areasData.length === 0) {
        Swal.fire("Info", "No co-scholastic areas mapped for this class.", "info");
      }
      if (Object.values(map).some((e) => e.locked)) {
        Swal.fire("Notice", "Evaluations for this class-section-term are locked.", "info");
      }

      setLastUpdated(Date.now());
    } catch (err) {
      console.error("Failed to fetch evaluation data", err);
      Swal.fire("Error", err?.response?.data?.message || "Failed to fetch evaluation data", "error");
      setStudents([]);
      setAreas([]);
      setEvaluations({});
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Table Handlers ---------------- */
  const handleChange = (student_id, area_id, field, value) => {
    const key = `${student_id}_${area_id}`;
    setEvaluations((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [field]: value },
    }));
  };

  const handleKeyDown = (e, studentIndex, areaIndex) => {
    // allow normal typing inside select
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(e.key)) {
      e.preventDefault();
    }

    const nextInput = (nextStudentIndex, nextAreaIndex) => {
      if (
        nextStudentIndex >= 0 &&
        nextStudentIndex < students.length &&
        nextAreaIndex >= 0 &&
        nextAreaIndex < areas.length
      ) {
        const key = `${students[nextStudentIndex].id}_${areas[nextAreaIndex].id}`;
        const input = inputRefs.current[key];
        if (input) {
          input.focus();
          input.click();
        }
      }
    };

    switch (e.key) {
      case "Enter":
      case "ArrowDown":
        nextInput(studentIndex + 1, areaIndex);
        break;
      case "ArrowUp":
        nextInput(studentIndex - 1, areaIndex);
        break;
      case "ArrowRight":
        nextInput(studentIndex, areaIndex + 1);
        break;
      case "ArrowLeft":
        nextInput(studentIndex, areaIndex - 1);
        break;
      default:
        if (e.key.length === 1) {
          const grade = grades.find((g) => g.grade?.toLowerCase() === e.key.toLowerCase());
          if (grade) {
            handleChange(students[studentIndex].id, areas[areaIndex].id, "grade_id", grade.id);
          }
        }
        break;
    }
  };

  /* ---------------- Actions ---------------- */
  const handleSave = async () => {
    const { class_id, section_id, term_id } = filters;
    const payload = [];

    students.forEach((student) => {
      areas.forEach((area) => {
        const key = `${student.id}_${area.id}`;
        const data = evaluations[key] || {};
        if (data.grade_id) {
          payload.push({
            student_id: student.id,
            co_scholastic_area_id: area.id,
            grade_id: data.grade_id,
            class_id,
            section_id,
            term_id,
          });
        }
      });
    });

    if (payload.length === 0) return Swal.fire("Info", "No grades to save.", "info");

    try {
      await api.post("/coscholastic-evaluations/save", { evaluations: payload });
      Swal.fire("Success", "Evaluations saved", "success");
      fetchEvaluationData();
    } catch (err) {
      console.error("Failed to save evaluations", err);
      Swal.fire("Error", err?.response?.data?.message || "Failed to save evaluations", "error");
    }
  };

  const handleExport = async () => {
    const { class_id, section_id, term_id } = filters;
    try {
      const res = await api.get("/coscholastic-evaluations/export", {
        params: { class_id, section_id, term_id },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `co-scholastic-${class_id}-${section_id}-${term_id}-${Date.now()}.xlsx`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Failed to export", err);
      Swal.fire("Error", err?.response?.data?.message || "Failed to export", "error");
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    const { class_id, section_id, term_id } = filters;

    if (!file || !class_id || !section_id || !term_id) {
      Swal.fire("Error", "Please select a file and all filters (class, section, term)", "error");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("class_id", class_id);
    formData.append("section_id", section_id);
    formData.append("term_id", term_id);

    try {
      setStudents([]);
      setAreas([]);
      setEvaluations({});

      await api.post("/coscholastic-evaluations/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      Swal.fire("Success", "Imported successfully", "success");
      await fetchEvaluationData();
    } catch (err) {
      console.error("Failed to import", err);
      Swal.fire(
        "Error",
        "Failed to import: " + (err.response?.data?.message || err.message || "Unknown error"),
        "error"
      );
      await fetchEvaluationData();
    } finally {
      e.target.value = "";
    }
  };

  const handleLock = async () => {
    const { class_id, section_id, term_id } = filters;

    const confirm = await Swal.fire({
      title: "Lock Evaluation?",
      text: "After locking, entries cannot be edited unless unlocked by Exam Head.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Lock it!",
    });

    if (!confirm.isConfirmed) return;

    try {
      await api.patch("/coscholastic-evaluations/lock", { class_id, section_id, term_id });
      Swal.fire("Locked", "Evaluations locked successfully", "success");
      fetchEvaluationData();
    } catch (err) {
      console.error("Failed to lock", err);
      Swal.fire("Error", err?.response?.data?.message || "Failed to lock", "error");
    }
  };

  const anyLocked = Object.values(evaluations).some((e) => e.locked);

  return (
    <div className="container-fluid px-3 py-3">
      {/* Header */}
      <div
        className="d-flex flex-wrap align-items-center justify-content-between mb-3 rounded-4 p-3 shadow-sm"
        style={{
          background: "linear-gradient(135deg, #f8fafc, #eef2ff)",
          border: "1px solid #e5e7eb",
        }}
      >
        <div>
          <h4 className="mb-1 fw-semibold">Co-Scholastic Evaluation Entry</h4>
          <div className="text-muted small">
            Role:{" "}
            {roles.length ? roles.map((r) => (
              <span key={r} className="badge bg-light text-dark border me-1">
                {r}
              </span>
            )) : <span className="badge bg-light text-dark border">unknown</span>}
            <span className="ms-2 text-muted">• Last update: {new Date(lastUpdated).toLocaleTimeString()}</span>
          </div>
        </div>

        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-outline-dark" onClick={init} disabled={loading}>
            ⟳ Refresh
          </button>
          {anyLocked && <span className="badge bg-danger align-self-center">LOCKED</span>}
        </div>
      </div>

      {/* Filters */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body">
          <div className="row g-3">
            {/* Class */}
            <div className="col-md-4">
              <label className="form-label fw-semibold">Class</label>
              <select
                className="form-select"
                value={filters.class_id}
                onChange={async (e) => {
                  const class_id = e.target.value;
                  setFilters((prev) => ({ ...prev, class_id, section_id: "" }));
                  setStudents([]);
                  setAreas([]);
                  setEvaluations({});

                  if (isGlobal) {
                    await loadSectionsForClass(class_id);
                  }
                }}
              >
                <option value="">Select Class</option>

                {!isGlobal
                  ? [...new Map(assignedClasses.map((c) => [c.class_id, c])).values()].map((item) => (
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

              <div className="text-muted small mt-1">
                {isGlobal ? "Global access: all classes" : "Teacher access: assigned classes only"}
              </div>
            </div>

            {/* Section */}
            <div className="col-md-4">
              <label className="form-label fw-semibold">Section</label>
              <select
                className="form-select"
                value={filters.section_id}
                onChange={(e) => setFilters((prev) => ({ ...prev, section_id: e.target.value }))}
              >
                <option value="">Select Section</option>

                {!isGlobal
                  ? assignedClasses
                      .filter((c) => String(c.class_id) === String(filters.class_id))
                      .map((item) => (
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
              <label className="form-label fw-semibold">Term</label>
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
        </div>
      </div>

      {/* Actions + Table */}
      {students.length > 0 && areas.length > 0 && (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
              <div className="fw-semibold">Evaluation Table</div>
              <span className="badge bg-light text-dark border">
                Students: {students.length}
              </span>
              <span className="badge bg-light text-dark border">
                Areas: {areas.length}
              </span>

              <div className="ms-auto d-flex gap-2 flex-wrap">
                <button className="btn btn-success" onClick={handleSave} disabled={loading || anyLocked}>
                  💾 Save
                </button>
                <button className="btn btn-outline-primary" onClick={handleExport} disabled={loading}>
                  ⬇️ Export Excel
                </button>
                <label className={"btn btn-outline-secondary mb-0 " + (loading ? "disabled" : "")}>
                  ⬆️ Import Excel
                  <input type="file" accept=".xlsx" onChange={handleImport} style={{ display: "none" }} />
                </label>

                {/* ✅ Lock: show to global roles only (change if you want teacher lock too) */}
                {isGlobal && (
                  <button className="btn btn-outline-danger" onClick={handleLock} disabled={loading || anyLocked}>
                    🔒 Lock
                  </button>
                )}
              </div>
            </div>

            {anyLocked && (
              <div className="alert alert-warning d-flex align-items-center rounded-4">
                <span className="me-2">🔒</span>
                <div>Evaluations are locked for this class-section-term.</div>
              </div>
            )}

            <div className="table-responsive" style={{ maxHeight: 520 }}>
              <table className="table table-bordered table-hover align-middle mb-0">
                <thead className="table-light sticky-top">
                  <tr>
                    <th style={{ width: 90 }}>Roll</th>
                    <th style={{ minWidth: 200 }}>Name</th>
                    {areas.map((a) => (
                      <th key={a.id} className="text-center" style={{ minWidth: 160 }}>
                        {a.name}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {students.map((s, studentIndex) => (
                    <tr key={s.id}>
                      <td>{s.roll_number}</td>
                      <td className="fw-semibold">{s.name}</td>

                      {areas.map((area, areaIndex) => {
                        const key = `${s.id}_${area.id}`;
                        const evalData = evaluations[key] || {};
                        const locked = !!evalData.locked;

                        return (
                          <td key={key}>
                            <select
                              ref={(el) => (inputRefs.current[key] = el)}
                              className="form-select"
                              value={String(evalData.grade_id || "")}
                              onChange={(e) => handleChange(s.id, area.id, "grade_id", e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, studentIndex, areaIndex)}
                              disabled={locked}
                            >
                              <option value="">-</option>
                              {grades.map((g) => (
                                <option key={g.id} value={String(g.id)}>
                                  {g.grade}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="small text-muted mt-3">
              Tip: Keyboard navigation works (↑ ↓ ← → / Enter). Type grade letter (A/B/C...) to quick fill.
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading &&
        students.length === 0 &&
        areas.length === 0 &&
        filters.class_id &&
        filters.section_id &&
        filters.term_id && (
          <div className="alert alert-info rounded-4">
            No students or co-scholastic areas found for this selection.
          </div>
        )}

      {loading && (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <div className="placeholder-glow">
              <div className="placeholder col-4 mb-2"></div>
              <div className="placeholder col-8"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoScholasticEntry;