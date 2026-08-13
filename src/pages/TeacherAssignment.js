import React, { useState, useEffect, useMemo } from "react";
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
  const [subjects, setSubjects] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");

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

  const assignmentText = (assignment) =>
    `${assignment.Class?.class_name || "Unknown"} - ${
      assignment.Section?.section_name || "Unknown"
    } | ${assignment.Subject?.name || "Unknown"} | ${
      assignment.Teacher?.name || "Unknown"
    }`;

  const copyText = async (text, successMessage) => {
    try {
      await navigator.clipboard.writeText(text);
      Swal.fire({
        icon: "success",
        title: "Copied",
        text: successMessage,
        timer: 1300,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire("Copy failed", "Your browser did not allow clipboard access.", "error");
    }
  };

  // ---- Filtering ----
  const filteredAssignments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return assignments.filter((assignment) => {
      const classId = assignment.Class?.id;
      const subjectId = assignment.Subject?.id;
      const teacherId = assignment.Teacher?.id;
      const searchableText = [
        assignment.Class?.class_name,
        assignment.Section?.section_name,
        assignment.Subject?.name,
        assignment.Teacher?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        (!query || searchableText.includes(query)) &&
        (!classFilter || String(classId) === classFilter) &&
        (!subjectFilter || String(subjectId) === subjectFilter) &&
        (!teacherFilter || String(teacherId) === teacherFilter)
      );
    });
  }, [assignments, searchTerm, classFilter, subjectFilter, teacherFilter]);

  const hasActiveFilters = Boolean(
    searchTerm || classFilter || subjectFilter || teacherFilter
  );

  const teacherFilterOptions = useMemo(() => {
    const uniqueTeachers = new Map();
    assignments.forEach((assignment) => {
      if (assignment.Teacher?.id != null) {
        uniqueTeachers.set(String(assignment.Teacher.id), assignment.Teacher.name || "Unknown");
      }
    });
    return [...uniqueTeachers.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [assignments]);

  const clearFilters = () => {
    setSearchTerm("");
    setClassFilter("");
    setSubjectFilter("");
    setTeacherFilter("");
  };

  const copyVisibleAssignments = () => {
    const text = filteredAssignments
      .map((assignment, index) => `${index + 1}. ${assignmentText(assignment)}`)
      .join("\n");
    copyText(text, `${filteredAssignments.length} assignment(s) copied.`);
  };

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
    <div className="container teacher-assignment-page">
      <section className="assignment-hero">
        <div>
          <span className="assignment-eyebrow">Academic setup</span>
          <h1>Teacher Assignments</h1>
          <p>Manage who teaches each subject across classes and sections.</p>
        </div>
        <button className="btn assignment-add-btn" onClick={handleAdd}>
          <i className="bi bi-plus-lg" aria-hidden="true" />
          Add assignment
        </button>
      </section>

      <section className="assignment-filters" aria-label="Assignment filters">
        <div className="filter-heading">
          <div>
            <h2>Find assignments</h2>
            <p>Search or narrow the list using one or more filters.</p>
          </div>
          {hasActiveFilters && (
            <button className="clear-filters" type="button" onClick={clearFilters}>
              <i className="bi bi-x-circle" aria-hidden="true" /> Clear filters
            </button>
          )}
        </div>
        <div className="filter-grid">
          <label className="filter-field filter-search">
            <span>Search</span>
            <div className="input-with-icon">
              <i className="bi bi-search" aria-hidden="true" />
              <input
                type="search"
                className="form-control"
                placeholder="Class, section, subject or teacher"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </label>
          <label className="filter-field">
            <span>Class</span>
            <select className="form-select" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="">All classes</option>
              {classes.map((item) => <option key={item.id} value={item.id}>{item.class_name}</option>)}
            </select>
          </label>
          <label className="filter-field">
            <span>Subject</span>
            <select className="form-select" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
              <option value="">All subjects</option>
              {subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="filter-field">
            <span>Teacher</span>
            <select className="form-select" value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)}>
              <option value="">All teachers</option>
              {teacherFilterOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
        </div>
      </section>

      <div className="assignment-toolbar">
        <p><strong>{filteredAssignments.length}</strong> of {assignments.length} assignments</p>
        <button className="btn copy-visible-btn" disabled={!filteredAssignments.length} onClick={copyVisibleAssignments}>
          <i className="bi bi-copy" aria-hidden="true" /> Copy visible
        </button>
      </div>

      {/* Desktop / Tablet (md and up): Table */}
      <div className="table-responsive assignment-table-wrap d-none d-md-block">
        <table className="table assignment-table align-middle">
          <thead>
            <tr>
              <th>#</th>
              <th>Class</th>
              <th>Section</th>
              <th className="wrap">Subject</th>
              <th className="wrap">Teacher</th>
              <th style={{ width: 220 }}>Actions</th>
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
                      <button className="btn btn-light btn-sm" title="Copy assignment" aria-label="Copy assignment" onClick={() => copyText(assignmentText(assignment), "Assignment copied.")}>
                        <i className="bi bi-copy" aria-hidden="true" />
                      </button>
                      <button
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => handleEdit(assignment)}
                      >
                        <i className="bi bi-pencil" aria-hidden="true" /> Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(assignment)}
                      >
                        <i className="bi bi-trash3" aria-hidden="true" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="assignment-empty">
                  <i className="bi bi-search" aria-hidden="true" />
                  <strong>No assignments found</strong>
                  <span>Try changing or clearing your filters.</span>
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
              <div className="card-heading">
                <span className="index-line">#{index + 1}</span>
                <button className="card-copy" aria-label="Copy assignment" onClick={() => copyText(assignmentText(assignment), "Assignment copied.")}>
                  <i className="bi bi-copy" aria-hidden="true" /> Copy
                </button>
              </div>
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
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => handleEdit(assignment)}
                >
                  <i className="bi bi-pencil" aria-hidden="true" /> Edit
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(assignment)}
                >
                  <i className="bi bi-trash3" aria-hidden="true" /> Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="assignment-empty mobile-empty">
            <i className="bi bi-search" aria-hidden="true" />
            <strong>No assignments found</strong>
            <span>Try changing or clearing your filters.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherAssignment;
