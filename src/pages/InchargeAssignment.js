import React, { useState, useEffect, useMemo } from "react";
import api from "../api"; // Custom Axios instance
import Swal from "sweetalert2";
import "./InchargeAssignment.css";

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

const InchargeAssignment = () => {
  // Data
  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [teachers, setTeachers] = useState([]);

  // Search filters
  const [searchClass, setSearchClass] = useState("");
  const [searchSection, setSearchSection] = useState("");
  const [searchTeacher, setSearchTeacher] = useState("");

  /* ============================
     1) Fetchers
  ============================ */
  const fetchAssignments = async () => {
    try {
      const res = await api.get("/incharges/all");
      setAssignments(res.data || []);
      return res.data || [];
    } catch (error) {
      console.error("Error fetching assignments:", error);
      Swal.fire("Error", "Failed to fetch incharge assignments.", "error");
      return [];
    }
  };

  const fetchClasses = async () => {
    try {
      const res = await api.get("/classes");
      const data = res.data || [];
      setClasses(data);
      return data;
    } catch (error) {
      console.error("Error fetching classes:", error);
      Swal.fire("Error", "Failed to fetch classes.", "error");
      return [];
    }
  };

  const fetchSections = async () => {
    try {
      const res = await api.get("/sections");
      const data = res.data || [];
      setSections(data);
      return data;
    } catch (error) {
      console.error("Error fetching sections:", error);
      Swal.fire("Error", "Failed to fetch sections.", "error");
      return [];
    }
  };

  const fetchTeachers = async () => {
    try {
      const res = await api.get("/teachers");
      const raw = Array.isArray(res.data) ? res.data : res.data?.teachers || [];
      const norm = raw.map(normalizeTeacher).filter(Boolean);
      setTeachers(norm);
      return norm;
    } catch (error) {
      console.error("Error fetching teachers:", error);
      Swal.fire("Error", "Failed to fetch teachers.", "error");
      setTeachers([]);
      return [];
    }
  };

  /* ============================
     2) CRUD
  ============================ */
  const handleAdd = async () => {
    const [clsList, secList, tchList] = await Promise.all([
      fetchClasses(),
      fetchSections(),
      fetchTeachers(),
    ]);

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
          <label>Class:</label>
          <select id="classId" class="form-field">${classOptions}</select>

          <label>Section:</label>
          <select id="sectionId" class="form-field">${sectionOptions}</select>

          <label>Teacher:</label>
          <select id="teacherId" class="form-field">${teacherOptions}</select>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Assign",
      preConfirm: () => {
        const classId = document.getElementById("classId").value;
        const sectionId = document.getElementById("sectionId").value;
        const teacherId = document.getElementById("teacherId").value;
        return { classId, sectionId, teacherId };
      },
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      try {
        await api.post("/incharges/assign", result.value);
        Swal.fire("Assigned!", "Incharge has been assigned successfully.", "success");
        fetchAssignments();
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
            fetchAssignments();
          }
        } else {
          Swal.fire("Error", "Failed to assign incharge.", "error");
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

    const originalClassId = String(assignment.Class?.id ?? "");
    const originalSectionId = String(assignment.Section?.id ?? "");
    const originalTeacherId = String(
      assignment.Teacher?.id ?? assignment.teacher_id ?? assignment.user_id ?? ""
    );

    const classOptions = clsList
      .map(
        (c) =>
          `<option value="${c.id}" ${
            String(c.id) === originalClassId ? "selected" : ""
          }>${escapeHtml(c.class_name)}</option>`
      )
      .join("");

    const sectionOptions = secList
      .map(
        (s) =>
          `<option value="${s.id}" ${
            String(s.id) === originalSectionId ? "selected" : ""
          }>${escapeHtml(s.section_name)}</option>`
      )
      .join("");

    const teacherOptions = tchList
      .map(
        (t) =>
          `<option value="${t.id}" ${
            String(t.id) === originalTeacherId ? "selected" : ""
          }>${escapeHtml(t.name)}</option>`
      )
      .join("");

    Swal.fire({
      title: "Edit Incharge Assignment",
      width: "600px",
      html: `
        <div class="ia-form">
          <label>Class:</label>
          <select id="classId" class="form-field">${classOptions}</select>

          <label>Section:</label>
          <select id="sectionId" class="form-field">${sectionOptions}</select>

          <label>Teacher:</label>
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
        return { classId, sectionId, teacherId };
      },
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      try {
        await api.put(`/incharges/update/${assignment.id}`, result.value);
        Swal.fire("Updated!", "Incharge assignment has been updated.", "success");
        fetchAssignments();
      } catch (error) {
        Swal.fire("Error", "Failed to update incharge assignment.", "error");
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
        fetchAssignments();
      } catch (error) {
        Swal.fire("Error", "Failed to remove incharge.", "error");
      }
    });
  };

  /* ============================
     3) Initial load
  ============================ */
  useEffect(() => {
    fetchAssignments();
    fetchClasses();
    fetchSections();
    fetchTeachers();
  }, []);

  /* ============================
     4) Derived: filtered view
  ============================ */
  const filteredAssignments = useMemo(() => {
    const qClass = searchClass.trim().toLowerCase();
    const qSection = searchSection.trim().toLowerCase();
    const qTeacher = searchTeacher.trim().toLowerCase();

    return assignments.filter((a) => {
      const c = a.Class?.class_name?.toLowerCase() || "";
      const s = a.Section?.section_name?.toLowerCase() || "";
      const t = a.Teacher?.name?.toLowerCase() || "";
      return c.includes(qClass) && s.includes(qSection) && t.includes(qTeacher);
    });
  }, [assignments, searchClass, searchSection, searchTeacher]);

  /* ============================
     5) Render (responsive)
  ============================ */
  return (
    <div className="container mt-4">
      <h1>Incharge Assignment Management</h1>

      {/* Filters */}
      <div className="row g-2 mb-3">
        <div className="col-md-4">
          <input
            type="text"
            className="form-control"
            placeholder="Search by Class"
            value={searchClass}
            onChange={(e) => setSearchClass(e.target.value)}
            aria-label="Search by Class"
          />
        </div>
        <div className="col-md-4">
          <input
            type="text"
            className="form-control"
            placeholder="Search by Section"
            value={searchSection}
            onChange={(e) => setSearchSection(e.target.value)}
            aria-label="Search by Section"
          />
        </div>
        <div className="col-md-4">
          <input
            type="text"
            className="form-control"
            placeholder="Search by Teacher"
            value={searchTeacher}
            onChange={(e) => setSearchTeacher(e.target.value)}
            aria-label="Search by Teacher"
          />
        </div>
      </div>

      <button className="btn btn-success mb-3" onClick={handleAdd}>
        Assign Incharge
      </button>

      {/* Desktop/tablet: sticky-header table */}
      <div className="table-responsive d-none d-md-block">
        <table className="table table-striped align-middle">
          <thead>
            <tr>
              <th>#</th>
              <th>Class</th>
              <th>Section</th>
              <th className="wrap">Incharge</th>
              <th style={{ width: 180 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssignments.length > 0 ? (
              filteredAssignments.map((assignment, index) => (
                <tr key={assignment.id}>
                  <td>{index + 1}</td>
                  <td>{assignment.Class?.class_name || "Unknown"}</td>
                  <td>{assignment.Section?.section_name || "Unknown"}</td>
                  <td className="wrap">
                    <span
                      className="truncate"
                      title={assignment.Teacher?.name || "Unknown"}
                    >
                      {assignment.Teacher?.name || "Unknown"}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <div className="actions-stack">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleEdit(assignment)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
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
                <td colSpan="5" className="text-center">
                  No incharge assignments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: card list */}
      <div className="d-md-none">
        {filteredAssignments.length > 0 ? (
          filteredAssignments.map((assignment, index) => (
            <div key={assignment.id} className="ia-card">
              <p className="index-line">#{index + 1}</p>
              <div className="kv">
                <span className="k">Class:</span>
                <span className="v">{assignment.Class?.class_name || "Unknown"}</span>
              </div>
              <div className="kv">
                <span className="k">Section:</span>
                <span className="v">{assignment.Section?.section_name || "Unknown"}</span>
              </div>
              <div className="kv">
                <span className="k">Incharge:</span>
                <span className="v">{assignment.Teacher?.name || "Unknown"}</span>
              </div>

              <div className="actions-stack mt-2">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleEdit(assignment)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(assignment)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center">No incharge assignments found.</p>
        )}
      </div>
    </div>
  );
};

export default InchargeAssignment;
