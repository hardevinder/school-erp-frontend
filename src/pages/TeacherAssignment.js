import React, { useState, useEffect } from "react";
import api from "../api"; // Custom Axios instance
import Swal from "sweetalert2";
import "./TeacherAssignment.css";

/** Safely escape HTML in option labels (avoid XSS in SweetAlert html mode) */
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
    (typeof t?.id === "number" && t?.roles ? t.id : undefined); // if it's a User row with roles
  const employeeId =
    t?.employee?.id ?? t?.Employee?.id ?? t?.employee_id ?? t?.emp_id;

  const id = userId ?? employeeId; // controller accepts either
  const name =
    t?.name ??
    t?.user?.name ??
    t?.User?.name ??
    t?.employee?.name ??
    t?.Employee?.name ??
    "Unnamed";

  return { id, userId: userId ?? null, employeeId: employeeId ?? null, name };
};

const TeacherAssignment = () => {
  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);

  const [searchClass, setSearchClass] = useState("");
  const [searchTeacher, setSearchTeacher] = useState("");

  // ---- Fetchers that also return data (so callers can use fresh arrays immediately) ----
  const fetchAssignments = async () => {
    const response = await api.get("/class-subject-teachers");
    setAssignments(response.data || []);
    return response.data || [];
  };

  const fetchClasses = async () => {
    const response = await api.get("/classes");
    const data = response.data || [];
    setClasses(data);
    return data;
  };

  const fetchSections = async () => {
    const response = await api.get("/sections");
    const data = response.data || [];
    setSections(data);
    return data;
  };

  const fetchSubjects = async () => {
    const response = await api.get("/subjects");
    const data = Array.isArray(response.data)
      ? response.data
      : response.data?.subjects || [];
    setSubjects(data);
    return data;
  };

  const fetchTeachers = async () => {
    const response = await api.get("/teachers");
    const raw = Array.isArray(response.data)
      ? response.data
      : response.data?.teachers || [];
    const norm = raw.map(normalizeTeacher).filter((t) => t.id != null);
    setTeachers(norm);
    return norm;
  };

  // ---- CRUD ----
  const handleAdd = async () => {
    try {
      // Fetch fresh lists LOCALLY (don’t trust state right here)
      const [clsList, secList, subList, tchList] = await Promise.all([
        fetchClasses(),
        fetchSections(),
        fetchSubjects(),
        fetchTeachers(),
      ]);

      // Build options from these local arrays
      const classOptions = clsList
        .map((cls) => `<option value="${cls.id}">${escapeHtml(cls.class_name)}</option>`)
        .join("");
      const sectionOptions = secList
        .map((sec) => `<option value="${sec.id}">${escapeHtml(sec.section_name)}</option>`)
        .join("");
      const subjectOptions = subList
        .map((sub) => `<option value="${sub.id}">${escapeHtml(sub.name)}</option>`)
        .join("");
      const teacherOptions = tchList
        .map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`)
        .join("");

      await Swal.fire({
        title: "Add Teacher Assignment",
        width: "600px",
        html: `
          <div class="form-container">
            <label>Class:</label>
            <select id="classId" class="form-field">${classOptions}</select>

            <label>Section:</label>
            <select id="sectionId" class="form-field">${sectionOptions}</select>

            <label>Subject:</label>
            <select id="subjectId" class="form-field">${subjectOptions}</select>

            <label>Teacher:</label>
            <select id="teacherId" class="form-field">${teacherOptions}</select>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: "Add",
        preConfirm: () => {
          const class_id = document.getElementById("classId").value;
          const section_id = document.getElementById("sectionId").value;
          const subject_id = document.getElementById("subjectId").value;
          const teacher_id = document.getElementById("teacherId").value;
          return { class_id, section_id, subject_id, teacher_id };
        },
      }).then(async (result) => {
        if (result.isConfirmed) {
          try {
            await api.post("/class-subject-teachers", result.value);
            Swal.fire("Added!", "Teacher assignment has been added.", "success");
            await fetchAssignments();
          } catch (error) {
            if (error.response?.status === 409) {
              const confirmResult = await Swal.fire({
                title: "Duplicate Assignment",
                text:
                  error.response.data?.message ||
                  "An assignment exists with the same class, section, and subject. Proceed?",
                icon: "warning",
                showCancelButton: true,
                confirmButtonText: "Yes, proceed",
              });
              if (confirmResult.isConfirmed) {
                await api.post("/class-subject-teachers", {
                  ...result.value,
                  confirmDuplicate: true,
                });
                Swal.fire("Added!", "Teacher assignment has been added.", "success");
                await fetchAssignments();
              }
            } else {
              Swal.fire("Error", "Failed to add teacher assignment.", "error");
            }
          }
        }
      });
    } catch (err) {
      console.error("handleAdd:", err);
      Swal.fire("Error", "Failed to load dropdowns.", "error");
    }
  };

  const handleEdit = async (assignment) => {
    try {
      const [clsList, secList, subList, tchList] = await Promise.all([
        fetchClasses(),
        fetchSections(),
        fetchSubjects(),
        fetchTeachers(),
      ]);

      const originalClassId = assignment.Class?.id;
      const originalSectionId = assignment.Section?.id;
      const originalSubjectId = assignment.Subject?.id;
      const originalTeacherUserId = assignment.Teacher?.id; // this is User.id

      const classOptions = clsList
        .map(
          (cls) =>
            `<option value="${cls.id}" ${
              String(cls.id) === String(originalClassId) ? "selected" : ""
            }>${escapeHtml(cls.class_name)}</option>`
        )
        .join("");
      const sectionOptions = secList
        .map(
          (sec) =>
            `<option value="${sec.id}" ${
              String(sec.id) === String(originalSectionId) ? "selected" : ""
            }>${escapeHtml(sec.section_name)}</option>`
        )
        .join("");
      const subjectOptions = subList
        .map(
          (sub) =>
            `<option value="${sub.id}" ${
              String(sub.id) === String(originalSubjectId) ? "selected" : ""
            }>${escapeHtml(sub.name)}</option>`
        )
        .join("");
      const teacherOptions = tchList
        .map((t) => {
          const selected =
            originalTeacherUserId != null &&
            String(t.id) === String(originalTeacherUserId)
              ? "selected"
              : "";
          return `<option value="${t.id}" ${selected}>${escapeHtml(t.name)}</option>`;
        })
        .join("");

      await Swal.fire({
        title: "Edit Teacher Assignment",
        width: "600px",
        html: `
          <div class="form-container">
            <label>Class:</label>
            <select id="classId" class="form-field">${classOptions}</select>

            <label>Section:</label>
            <select id="sectionId" class="form-field">${sectionOptions}</select>

            <label>Subject:</label>
            <select id="subjectId" class="form-field">${subjectOptions}</select>

            <label>Teacher:</label>
            <select id="teacherId" class="form-field">${teacherOptions}</select>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: "Save",
        preConfirm: () => {
          const class_id = document.getElementById("classId").value;
          const section_id = document.getElementById("sectionId").value;
          const subject_id = document.getElementById("subjectId").value;
          const teacher_id = document.getElementById("teacherId").value;
          return { class_id, section_id, subject_id, teacher_id };
        },
      }).then(async (result) => {
        if (result.isConfirmed) {
          try {
            await api.put(`/class-subject-teachers/${assignment.id}`, result.value);
            Swal.fire("Updated!", "Teacher assignment has been updated.", "success");
            await fetchAssignments();
          } catch (error) {
            if (error.response?.status === 409) {
              const confirmResult = await Swal.fire({
                title: "Duplicate Assignment",
                text:
                  error.response.data?.message ||
                  "An assignment exists with the same class, section, and subject. Proceed?",
                icon: "warning",
                showCancelButton: true,
                confirmButtonText: "Yes, proceed",
              });
              if (confirmResult.isConfirmed) {
                await api.put(`/class-subject-teachers/${assignment.id}`, {
                  ...result.value,
                  confirmDuplicate: true,
                });
                Swal.fire("Updated!", "Teacher assignment has been updated.", "success");
                await fetchAssignments();
              }
            } else {
              Swal.fire("Error", "Failed to update teacher assignment.", "error");
            }
          }
        }
      });
    } catch (err) {
      console.error("handleEdit:", err);
      Swal.fire("Error", "Failed to load dropdowns.", "error");
    }
  };

  const handleDelete = async (assignment) => {
    Swal.fire({
      title: "Are you sure you want to delete this assignment?",
      text: `Class: ${assignment.Class?.class_name || "Unknown"} - Subject: ${
        assignment.Subject?.name || "Unknown"
      } - Teacher: ${assignment.Teacher?.name || "Unknown"}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.delete(`/class-subject-teachers/${assignment.id}`);
          Swal.fire("Deleted!", "Teacher assignment has been deleted.", "success");
          await fetchAssignments();
        } catch (error) {
          Swal.fire("Error", "Failed to delete teacher assignment.", "error");
        }
      }
    });
  };

  // ---- Filtering ----
  const filteredAssignments = assignments.filter((assignment) => {
    const className = assignment.Class?.class_name?.toLowerCase() || "";
    const teacherName = assignment.Teacher?.name?.toLowerCase() || "";
    return (
      className.includes(searchClass.toLowerCase()) &&
      teacherName.includes(searchTeacher.toLowerCase())
    );
  });

  // ---- Initial Load + Polling ----
  useEffect(() => {
    (async () => {
      try {
        await Promise.all([
          fetchAssignments(),
          fetchClasses(),
          fetchSections(),
          fetchSubjects(),
          fetchTeachers(),
        ]);
      } catch (e) {
        console.error(e);
        Swal.fire("Error", "Failed to load initial data.", "error");
      }
    })();

    const pollingInterval = setInterval(fetchAssignments, 5000);
    return () => clearInterval(pollingInterval);
  }, []);

  return (
    <div className="container mt-4">
      <h1>Teacher Assignment Management</h1>

      {/* Filters */}
      <div className="row mb-3">
        <div className="col-md-6 mb-2 mb-md-0">
          <input
            type="text"
            className="form-control"
            placeholder="Search by Class"
            value={searchClass}
            onChange={(e) => setSearchClass(e.target.value)}
            aria-label="Search by Class"
          />
        </div>
        <div className="col-md-6">
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
        Add Teacher Assignment
      </button>

      {/* Desktop / Tablet (md and up): Table */}
      <div className="table-responsive d-none d-md-block">
        <table className="table table-striped align-middle">
          <thead>
            <tr>
              <th>#</th>
              <th>Class</th>
              <th>Section</th>
              <th className="wrap">Subject</th>
              <th className="wrap">Teacher</th>
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
                      title={assignment.Subject?.name || "Unknown"}
                    >
                      {assignment.Subject?.name || "Unknown"}
                    </span>
                  </td>
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
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="text-center">
                  No teacher assignments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile (below md): Card list */}
      <div className="d-md-none">
        {filteredAssignments.length > 0 ? (
          filteredAssignments.map((assignment, index) => (
            <div key={assignment.id} className="assignment-card">
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
                <span className="k">Subject:</span>
                <span className="v">{assignment.Subject?.name || "Unknown"}</span>
              </div>
              <div className="kv">
                <span className="k">Teacher:</span>
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
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center">No teacher assignments found.</p>
        )}
      </div>
    </div>
  );
};

export default TeacherAssignment;
