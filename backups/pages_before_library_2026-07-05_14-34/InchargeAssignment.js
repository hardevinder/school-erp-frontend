import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import api from "../api"; // Custom Axios instance
import Swal from "sweetalert2";
import "./InchargeAssignment.css";

/** =============================
 *  Utilities
 *  ============================= */
/** Safely escape HTML for SweetAlert custom HTML */
const escapeHtml = (s = "") =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

/** Normalize teacher objects from various backend shapes into a stable form */
const normalizeTeacher = (t) => {
  const userId =
    t?.user?.id ??
    t?.User?.id ??
    t?.user_id ??
    (typeof t?.id === "number" && (t?.roles || t?.email) ? t.id : undefined);

  const employeeId =
    t?.employee?.id ?? t?.Employee?.id ?? t?.employee_id ?? t?.emp_id;

  const id = userId ?? employeeId ?? t?.id ?? null;
  const name =
    t?.name ??
    t?.user?.name ??
    t?.User?.name ??
    t?.employee?.name ??
    t?.Employee?.name ??
    t?.full_name ??
    "Unnamed";

  return id != null ? { id: String(id), name: String(name) } : null;
};

/** Debounce helper */
const useDebounced = (value, delay = 250) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
};

/** Pretty error toast */
const toast = (title, text, icon = "error") =>
  Swal.fire({ title, text, icon, timer: 2200, showConfirmButton: false });

/** =============================
 *  Component
 *  ============================= */
const InchargeAssignment = () => {
  // Data
  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [teachers, setTeachers] = useState([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search + paging
  const [searchClass, setSearchClass] = useState("");
  const [searchSection, setSearchSection] = useState("");
  const [searchTeacher, setSearchTeacher] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const searchClassDeb = useDebounced(searchClass);
  const searchSectionDeb = useDebounced(searchSection);
  const searchTeacherDeb = useDebounced(searchTeacher);

  /* ============================
     1) Fetchers
  ============================ */
  const fetchAssignments = useCallback(async () => {
    try {
      const res = await api.get("/incharges/all");
      const data = res.data || [];
      setAssignments(Array.isArray(data) ? data : []);
      return data;
    } catch (error) {
      console.error("Error fetching assignments:", error);
      toast("Error", "Failed to fetch incharge assignments.");
      return [];
    }
  }, []);

  const fetchClasses = useCallback(async () => {
    try {
      const res = await api.get("/classes");
      const data = res.data || [];
      setClasses(Array.isArray(data) ? data : []);
      return data;
    } catch (error) {
      console.error("Error fetching classes:", error);
      toast("Error", "Failed to fetch classes.");
      return [];
    }
  }, []);

  const fetchSections = useCallback(async () => {
    try {
      const res = await api.get("/sections");
      const data = res.data || [];
      setSections(Array.isArray(data) ? data : []);
      return data;
    } catch (error) {
      console.error("Error fetching sections:", error);
      toast("Error", "Failed to fetch sections.");
      return [];
    }
  }, []);

  const fetchTeachers = useCallback(async () => {
    try {
      const res = await api.get("/teachers");
      const raw = Array.isArray(res.data) ? res.data : res.data?.teachers || [];
      const norm = raw.map(normalizeTeacher).filter(Boolean);
      setTeachers(norm);
      return norm;
    } catch (error) {
      console.error("Error fetching teachers:", error);
      toast("Error", "Failed to fetch teachers.");
      setTeachers([]);
      return [];
    }
  }, []);

  const hydrateLists = useCallback(async () => {
    const [a] = await Promise.all([
      fetchAssignments(),
      fetchClasses(),
      fetchSections(),
      fetchTeachers(),
    ]);
    return a;
  }, [fetchAssignments, fetchClasses, fetchSections, fetchTeachers]);

  /* ============================
     2) CRUD
  ============================ */
  const handleAdd = async () => {
    const [clsList, secList, tchList] = await Promise.all([
      fetchClasses(),
      fetchSections(),
      fetchTeachers(),
    ]);

    if (!clsList.length || !secList.length || !tchList.length) {
      return toast(
        "Can't open form",
        "Make sure Classes, Sections and Teachers exist first.",
        "warning"
      );
    }

    const classOptions = clsList
      .map((c) => `<option value="${c.id}">${escapeHtml(c.class_name)}</option>`)
      .join("");
    const sectionOptions = secList
      .map((s) => `<option value="${s.id}">${escapeHtml(s.section_name)}</option>`)
      .join("");
    const teacherOptions = tchList
      .map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`)
      .join("");

    Swal.fire({
      title: "Assign Incharge",
      width: "600px",
      html: `
        <div class="ia-form">
          <label>Class</label>
          <select id="classId" class="form-field">${classOptions}</select>

          <label>Section</label>
          <select id="sectionId" class="form-field">${sectionOptions}</select>

          <label>Teacher</label>
          <select id="teacherId" class="form-field">${teacherOptions}</select>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Assign",
      focusConfirm: false,
      preConfirm: () => {
        const classId = document.getElementById("classId").value;
        const sectionId = document.getElementById("sectionId").value;
        const teacherId = document.getElementById("teacherId").value;
        if (!classId || !sectionId || !teacherId) {
          Swal.showValidationMessage("All fields are required");
          return false;
        }
        return { classId, sectionId, teacherId };
      },
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      try {
        await api.post("/incharges/assign", result.value);
        Swal.fire("Assigned!", "Incharge has been assigned successfully.", "success");
        await fetchAssignments();
      } catch (error) {
        if (error?.response?.status === 409) {
          const confirmDup = await Swal.fire({
            title: "Duplicate Incharge",
            text:
              error.response.data?.message ||
              "This teacher is already an incharge for that Class & Section. Assign again?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Yes, Assign Again",
          });
          if (confirmDup.isConfirmed) {
            await api.post("/incharges/assign", { ...result.value, confirm: true });
            Swal.fire("Assigned!", "Incharge has been assigned successfully.", "success");
            await fetchAssignments();
          }
        } else {
          toast("Error", "Failed to assign incharge.");
        }
      }
    });
  };

  const handleEdit = async (assignment) => {
    const [clsList, secList, tchList] = await Promise.all([
      fetchClasses(),
      fetchSections(),
      fetchTeachers(),
    ]);

    if (!clsList.length || !secList.length || !tchList.length) {
      return toast(
        "Can't open form",
        "Make sure Classes, Sections and Teachers exist first.",
        "warning"
      );
    }

    const originalClassId = String(assignment.Class?.id ?? "");
    const originalSectionId = String(assignment.Section?.id ?? "");
    const originalTeacherId = String(
      assignment.Teacher?.id ?? assignment.teacher_id ?? assignment.user_id ?? ""
    );

    const classOptions = clsList
      .map(
        (c) =>
          `<option value="${c.id}" ${String(c.id) === originalClassId ? "selected" : ""}>${escapeHtml(
            c.class_name
          )}</option>`
      )
      .join("");

    const sectionOptions = secList
      .map(
        (s) =>
          `<option value="${s.id}" ${String(s.id) === originalSectionId ? "selected" : ""}>${escapeHtml(
            s.section_name
          )}</option>`
      )
      .join("");

    const teacherOptions = tchList
      .map(
        (t) =>
          `<option value="${t.id}" ${String(t.id) === originalTeacherId ? "selected" : ""}>${escapeHtml(
            t.name
          )}</option>`
      )
      .join("");

    Swal.fire({
      title: "Edit Incharge Assignment",
      width: "600px",
      html: `
        <div class="ia-form">
          <label>Class</label>
          <select id="classId" class="form-field">${classOptions}</select>

          <label>Section</label>
          <select id="sectionId" class="form-field">${sectionOptions}</select>

          <label>Teacher</label>
          <select id="teacherId" class="form-field">${teacherOptions}</select>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Save Changes",
      didOpen: () => {
        const c = document.getElementById("classId");
        const s = document.getElementById("sectionId");
        const t = document.getElementById("teacherId");
        if (c && originalClassId) c.value = originalClassId;
        if (s && originalSectionId) s.value = originalSectionId;
        if (t && originalTeacherId) t.value = originalTeacherId;
      },
      preConfirm: () => {
        const classId = document.getElementById("classId").value;
        const sectionId = document.getElementById("sectionId").value;
        const teacherId = document.getElementById("teacherId").value;
        if (!classId || !sectionId || !teacherId) {
          Swal.showValidationMessage("All fields are required");
          return false;
        }
        return { classId, sectionId, teacherId };
      },
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      try {
        await api.put(`/incharges/update/${assignment.id}`, result.value);
        Swal.fire("Updated!", "Incharge assignment has been updated.", "success");
        await fetchAssignments();
      } catch (error) {
        toast("Error", "Failed to update incharge assignment.");
      }
    });
  };

  const handleDelete = async (assignment) => {
    Swal.fire({
      title: "Are you sure?",
      text: `Remove ${assignment.Teacher?.name || "Unknown"} as incharge of ${
        assignment.Class?.class_name || "Unknown"
      } - ${assignment.Section?.section_name || "Unknown"}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Remove",
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      try {
        await api.delete(`/incharges/remove/${assignment.id}`);
        Swal.fire("Removed!", "Incharge has been removed successfully.", "success");
        await fetchAssignments();
      } catch (error) {
        toast("Error", "Failed to remove incharge.");
      }
    });
  };

  /* ============================
     3) Initial load
  ============================ */
  useEffect(() => {
    (async () => {
      setLoading(true);
      await hydrateLists();
      setLoading(false);
    })();
  }, [hydrateLists]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await hydrateLists();
    setRefreshing(false);
  };

  /* ============================
     4) Derived: filtered + paginated view
  ============================ */
  const filteredAssignments = useMemo(() => {
    const qClass = searchClassDeb.trim().toLowerCase();
    const qSection = searchSectionDeb.trim().toLowerCase();
    const qTeacher = searchTeacherDeb.trim().toLowerCase();

    const out = assignments.filter((a) => {
      const c = a.Class?.class_name?.toLowerCase() || "";
      const s = a.Section?.section_name?.toLowerCase() || "";
      const t = a.Teacher?.name?.toLowerCase() || "";
      return c.includes(qClass) && s.includes(qSection) && t.includes(qTeacher);
    });

    // Reset to page 1 if the current page would be empty after filtering
    const totalPages = Math.max(1, Math.ceil(out.length / pageSize));
    if (page > totalPages) setPage(1);

    return out;
  }, [assignments, searchClassDeb, searchSectionDeb, searchTeacherDeb, page, pageSize]);

  const pagedAssignments = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAssignments.slice(start, start + pageSize);
  }, [filteredAssignments, page, pageSize]);

  const total = filteredAssignments.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  /* ============================
     5) Render (responsive)
  ============================ */
  return (
    <div className="container mt-4 incharge-root">
      <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-3">
        <div>
          <h1 className="h4 mb-0">Incharge Assignment</h1>
          <small className="text-muted">Assign class-section incharges and manage quickly.</small>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary" onClick={handleRefresh} disabled={refreshing || loading}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button className="btn btn-success" onClick={handleAdd} disabled={loading}>
            Assign Incharge
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label">Class</label>
              <input
                type="text"
                className="form-control"
                placeholder="Search by Class"
                value={searchClass}
                onChange={(e) => setSearchClass(e.target.value)}
                aria-label="Search by Class"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Section</label>
              <input
                type="text"
                className="form-control"
                placeholder="Search by Section"
                value={searchSection}
                onChange={(e) => setSearchSection(e.target.value)}
                aria-label="Search by Section"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Teacher</label>
              <input
                type="text"
                className="form-control"
                placeholder="Search by Teacher"
                value={searchTeacher}
                onChange={(e) => setSearchTeacher(e.target.value)}
                aria-label="Search by Teacher"
              />
            </div>
            <div className="col-md-3">
              <div className="d-flex gap-2">
                <div className="flex-grow-1">
                  <label className="form-label">Page Size</label>
                  <select
                    className="form-select"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    {[5, 10, 20, 50, 100].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-grow-1">
                  <label className="form-label">Page</label>
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-outline-secondary w-100"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Prev
                    </button>
                    <button
                      className="btn btn-outline-secondary w-100"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="placeholder-wave">
              <div className="placeholder col-12 mb-2" style={{ height: 16 }} />
              <div className="placeholder col-12 mb-2" style={{ height: 16 }} />
              <div className="placeholder col-10" style={{ height: 16 }} />
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop/tablet: sticky-header table */}
          <div className="table-responsive d-none d-md-block">
            <table className="table table-hover align-middle table-bordered table-striped">
              <thead className="table-light sticky-top">
                <tr>
                  <th style={{ width: 60 }}>#</th>
                  <th>Class</th>
                  <th>Section</th>
                  <th className="wrap">Incharge</th>
                  <th style={{ width: 200 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedAssignments.length > 0 ? (
                  pagedAssignments.map((assignment, index) => (
                    <tr key={assignment.id}>
                      <td>
                        <span className="badge bg-secondary">{(page - 1) * pageSize + index + 1}</span>
                      </td>
                      <td>
                        <span className="fw-semibold">{assignment.Class?.class_name || "Unknown"}</span>
                      </td>
                      <td>
                        <span className="badge bg-info-subtle text-info-emphasis border border-info rounded-pill px-3 py-2">
                          {assignment.Section?.section_name || "Unknown"}
                        </span>
                      </td>
                      <td className="wrap">
                        <span className="truncate" title={assignment.Teacher?.name || "Unknown"}>
                          {assignment.Teacher?.name || "Unknown"}
                        </span>
                      </td>
                      <td className="actions-cell">
                        <div className="d-flex gap-2 flex-wrap">
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleEdit(assignment)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => handleDelete(assignment)}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="text-center py-4 text-muted">
                      No incharge assignments found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: card list */}
          <div className="d-md-none">
            {pagedAssignments.length > 0 ? (
              pagedAssignments.map((assignment, index) => (
                <div key={assignment.id} className="ia-card">
                  <p className="index-line">#{(page - 1) * pageSize + index + 1}</p>
                  <div className="kv">
                    <span className="k">Class</span>
                    <span className="v">{assignment.Class?.class_name || "Unknown"}</span>
                  </div>
                  <div className="kv">
                    <span className="k">Section</span>
                    <span className="v">{assignment.Section?.section_name || "Unknown"}</span>
                  </div>
                  <div className="kv">
                    <span className="k">Incharge</span>
                    <span className="v">{assignment.Teacher?.name || "Unknown"}</span>
                  </div>

                  <div className="actions-stack mt-2">
                    <button className="btn btn-primary btn-sm" onClick={() => handleEdit(assignment)}>
                      Edit
                    </button>
                    <button className="btn btn-outline-danger btn-sm" onClick={() => handleDelete(assignment)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted">No incharge assignments found.</p>
            )}
          </div>

          {/* Footer: results info */}
          <div className="d-flex justify-content-between align-items-center mt-3">
            <small className="text-muted">
              Showing <strong>{pagedAssignments.length}</strong> of <strong>{total}</strong> result{total === 1 ? "" : "s"}
            </small>
            <small className="text-muted">Page {page} of {totalPages}</small>
          </div>
        </>
      )}
    </div>
  );
};

export default InchargeAssignment;
