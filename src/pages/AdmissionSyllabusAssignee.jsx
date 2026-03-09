import React, { useState, useEffect } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./TeacherAssignment.css";

/** Safely escape HTML in option labels */
const escapeHtml = (s = "") =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

/** Normalize user objects from various backend shapes */
const normalizeUser = (u) => {
  const userId =
    u?.user?.id ??
    u?.User?.id ??
    u?.user_id ??
    (typeof u?.id === "number" ? u.id : undefined);

  const employeeId =
    u?.employee?.id ?? u?.Employee?.id ?? u?.employee_id ?? u?.emp_id;

  const id = userId ?? employeeId;

  const name =
    u?.name ??
    u?.full_name ??
    u?.username ??
    u?.user?.name ??
    u?.User?.name ??
    u?.employee?.name ??
    u?.Employee?.name ??
    "Unnamed";

  return {
    id,
    userId: userId ?? null,
    employeeId: employeeId ?? null,
    name,
  };
};

const AdmissionSyllabusAssignee = () => {
  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [users, setUsers] = useState([]);

  const [searchClass, setSearchClass] = useState("");
  const [searchUser, setSearchUser] = useState("");
  const [searchSubject, setSearchSubject] = useState("");

  const BASE = "/admission-syllabus-assignees";

  // ---- Fetchers that also return data ----
  const fetchAssignments = async () => {
    const response = await api.get(BASE);
    const data = Array.isArray(response.data)
      ? response.data
      : response.data?.data || [];
    setAssignments(data);
    return data;
  };

  const fetchClasses = async () => {
    const response = await api.get("/classes");
    const data = Array.isArray(response.data)
      ? response.data
      : response.data?.data || [];
    setClasses(data);
    return data;
  };

  const fetchSubjects = async () => {
    const response = await api.get("/subjects");
    const data = Array.isArray(response.data)
      ? response.data
      : response.data?.subjects || response.data?.data || [];
    setSubjects(data);
    return data;
  };

  const fetchUsers = async () => {
    try {
      // first try /users
      const response = await api.get("/users");
      const raw = Array.isArray(response.data)
        ? response.data
        : response.data?.users || response.data?.data || [];

      const norm = raw.map(normalizeUser).filter((u) => u.id != null);
      setUsers(norm);
      return norm;
    } catch (err) {
      console.warn(
        "/users failed, trying /teachers fallback",
        err?.response?.data || err.message
      );

      // fallback to /teachers like first working page
      const response = await api.get("/teachers");
      const raw = Array.isArray(response.data)
        ? response.data
        : response.data?.teachers || response.data?.data || [];

      const norm = raw.map(normalizeUser).filter((u) => u.id != null);
      setUsers(norm);
      return norm;
    }
  };

  // ---- CRUD ----
  const handleAdd = async () => {
    try {
      const [clsList, subList, usrList] = await Promise.all([
        fetchClasses(),
        fetchSubjects(),
        fetchUsers(),
      ]);

      const classOptions = clsList
        .map(
          (cls) =>
            `<option value="${cls.id}">${escapeHtml(
              cls.class_name || cls.name || "Unnamed Class"
            )}</option>`
        )
        .join("");

      const subjectOptions = subList
        .map(
          (sub) =>
            `<option value="${sub.id}">${escapeHtml(
              sub.subject_name || sub.name || "Unnamed Subject"
            )}</option>`
        )
        .join("");

      const userOptions = usrList
        .map((u) => `<option value="${u.id}">${escapeHtml(u.name)}</option>`)
        .join("");

      await Swal.fire({
        title: "Assign Admission Syllabus",
        width: "650px",
        html: `
          <div class="form-container">
            <label>Applying Class:</label>
            <select id="applyingClassId" class="form-field">${classOptions}</select>

            <label>Subject:</label>
            <select id="subjectId" class="form-field">${subjectOptions}</select>

            <label>Assign To:</label>
            <select id="assignedTo" class="form-field">${userOptions}</select>

            <label>Status:</label>
            <select id="status" class="form-field">
              <option value="active" selected>Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <label>Remarks:</label>
            <textarea
              id="remarks"
              class="form-field"
              rows="3"
              placeholder="Enter remarks (optional)"
            ></textarea>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: "Assign",
        preConfirm: () => {
          const applying_class_id =
            document.getElementById("applyingClassId").value;
          const subject_id = document.getElementById("subjectId").value;
          const assigned_to = document.getElementById("assignedTo").value;
          const status = document.getElementById("status").value;
          const remarks = document.getElementById("remarks").value;

          if (!applying_class_id || !subject_id || !assigned_to) {
            Swal.showValidationMessage(
              "Applying class, subject and assigned user are required."
            );
            return false;
          }

          return {
            applying_class_id,
            subject_id,
            assigned_to,
            status,
            remarks,
          };
        },
      }).then(async (result) => {
        if (result.isConfirmed) {
          try {
            await api.post(BASE, result.value);
            Swal.fire(
              "Assigned!",
              "Admission syllabus assignee created successfully.",
              "success"
            );
            await fetchAssignments();
          } catch (error) {
            Swal.fire(
              "Error",
              error?.response?.data?.message ||
                "Failed to create admission syllabus assignee.",
              "error"
            );
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
      const [clsList, subList, usrList] = await Promise.all([
        fetchClasses(),
        fetchSubjects(),
        fetchUsers(),
      ]);

      const originalClassId =
        assignment.ApplyingClass?.id ?? assignment.applying_class_id;

      const originalSubjectId =
        assignment.Subject?.id ?? assignment.subject_id;

      const originalAssignedTo =
        assignment.AssignedUser?.id ??
        assignment.AssignedUser?.user_id ??
        assignment.assigned_to;

      const originalStatus = assignment.status || "active";
      const originalRemarks = assignment.remarks || "";

      const classOptions = clsList
        .map(
          (cls) =>
            `<option value="${cls.id}" ${
              String(cls.id) === String(originalClassId) ? "selected" : ""
            }>${escapeHtml(cls.class_name || cls.name || "Unnamed Class")}</option>`
        )
        .join("");

      const subjectOptions = subList
        .map(
          (sub) =>
            `<option value="${sub.id}" ${
              String(sub.id) === String(originalSubjectId) ? "selected" : ""
            }>${escapeHtml(
              sub.subject_name || sub.name || "Unnamed Subject"
            )}</option>`
        )
        .join("");

      const userOptions = usrList
        .map((u) => {
          const selected =
            originalAssignedTo != null &&
            String(u.id) === String(originalAssignedTo)
              ? "selected"
              : "";
          return `<option value="${u.id}" ${selected}>${escapeHtml(
            u.name
          )}</option>`;
        })
        .join("");

      await Swal.fire({
        title: "Edit Admission Syllabus Assignee",
        width: "650px",
        html: `
          <div class="form-container">
            <label>Applying Class:</label>
            <select id="applyingClassId" class="form-field">${classOptions}</select>

            <label>Subject:</label>
            <select id="subjectId" class="form-field">${subjectOptions}</select>

            <label>Assign To:</label>
            <select id="assignedTo" class="form-field">${userOptions}</select>

            <label>Status:</label>
            <select id="status" class="form-field">
              <option value="active" ${
                originalStatus === "active" ? "selected" : ""
              }>Active</option>
              <option value="inactive" ${
                originalStatus === "inactive" ? "selected" : ""
              }>Inactive</option>
            </select>

            <label>Remarks:</label>
            <textarea
              id="remarks"
              class="form-field"
              rows="3"
              placeholder="Enter remarks (optional)"
            >${escapeHtml(originalRemarks)}</textarea>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: "Save",
        preConfirm: () => {
          const applying_class_id =
            document.getElementById("applyingClassId").value;
          const subject_id = document.getElementById("subjectId").value;
          const assigned_to = document.getElementById("assignedTo").value;
          const status = document.getElementById("status").value;
          const remarks = document.getElementById("remarks").value;

          if (!applying_class_id || !subject_id || !assigned_to) {
            Swal.showValidationMessage(
              "Applying class, subject and assigned user are required."
            );
            return false;
          }

          return {
            applying_class_id,
            subject_id,
            assigned_to,
            status,
            remarks,
          };
        },
      }).then(async (result) => {
        if (result.isConfirmed) {
          try {
            await api.put(`${BASE}/${assignment.id}`, result.value);
            Swal.fire(
              "Updated!",
              "Admission syllabus assignee updated successfully.",
              "success"
            );
            await fetchAssignments();
          } catch (error) {
            Swal.fire(
              "Error",
              error?.response?.data?.message ||
                "Failed to update admission syllabus assignee.",
              "error"
            );
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
      text: `Class: ${
        assignment.ApplyingClass?.class_name || "Unknown"
      } - Subject: ${
        assignment.Subject?.subject_name || assignment.Subject?.name || "Unknown"
      } - Assigned To: ${assignment.AssignedUser?.name || "Unknown"}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.delete(`${BASE}/${assignment.id}`);
          Swal.fire("Deleted!", "Assignment deleted successfully.", "success");
          await fetchAssignments();
        } catch (error) {
          Swal.fire("Error", "Failed to delete assignment.", "error");
        }
      }
    });
  };

  // ---- Filtering ----
  const filteredAssignments = assignments.filter((assignment) => {
    const className =
      assignment.ApplyingClass?.class_name?.toLowerCase() || "";

    const subjectName = (
      assignment.Subject?.subject_name ||
      assignment.Subject?.name ||
      ""
    ).toLowerCase();

    const assignedUser = (
      assignment.AssignedUser?.name ||
      assignment.AssignedUser?.full_name ||
      assignment.AssignedUser?.username ||
      ""
    ).toLowerCase();

    return (
      className.includes(searchClass.toLowerCase()) &&
      subjectName.includes(searchSubject.toLowerCase()) &&
      assignedUser.includes(searchUser.toLowerCase())
    );
  });

  // ---- Initial Load + Polling ----
  useEffect(() => {
    (async () => {
      try {
        await Promise.all([
          fetchAssignments(),
          fetchClasses(),
          fetchSubjects(),
          fetchUsers(),
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
      <h1>Admission Syllabus Assignee Management</h1>

      {/* Filters */}
      <div className="row mb-3">
        <div className="col-md-4 mb-2 mb-md-0">
          <input
            type="text"
            className="form-control"
            placeholder="Search by Class"
            value={searchClass}
            onChange={(e) => setSearchClass(e.target.value)}
            aria-label="Search by Class"
          />
        </div>

        <div className="col-md-4 mb-2 mb-md-0">
          <input
            type="text"
            className="form-control"
            placeholder="Search by Subject"
            value={searchSubject}
            onChange={(e) => setSearchSubject(e.target.value)}
            aria-label="Search by Subject"
          />
        </div>

        <div className="col-md-4">
          <input
            type="text"
            className="form-control"
            placeholder="Search by Assigned User"
            value={searchUser}
            onChange={(e) => setSearchUser(e.target.value)}
            aria-label="Search by Assigned User"
          />
        </div>
      </div>

      <button className="btn btn-success mb-3" onClick={handleAdd}>
        Assign Admission Syllabus
      </button>

      {/* Desktop / Tablet */}
      <div className="table-responsive d-none d-md-block">
        <table className="table table-striped align-middle">
          <thead>
            <tr>
              <th>#</th>
              <th>Applying Class</th>
              <th className="wrap">Subject</th>
              <th className="wrap">Assigned To</th>
              <th>Status</th>
              <th className="wrap">Remarks</th>
              <th style={{ width: 180 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssignments.length > 0 ? (
              filteredAssignments.map((assignment, index) => (
                <tr key={assignment.id}>
                  <td>{index + 1}</td>

                  <td>{assignment.ApplyingClass?.class_name || "Unknown"}</td>

                  <td className="wrap">
                    <span
                      className="truncate"
                      title={
                        assignment.Subject?.subject_name ||
                        assignment.Subject?.name ||
                        "Unknown"
                      }
                    >
                      {assignment.Subject?.subject_name ||
                        assignment.Subject?.name ||
                        "Unknown"}
                    </span>
                  </td>

                  <td className="wrap">
                    <span
                      className="truncate"
                      title={
                        assignment.AssignedUser?.name ||
                        assignment.AssignedUser?.full_name ||
                        assignment.AssignedUser?.username ||
                        "Unknown"
                      }
                    >
                      {assignment.AssignedUser?.name ||
                        assignment.AssignedUser?.full_name ||
                        assignment.AssignedUser?.username ||
                        "Unknown"}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`badge ${
                        assignment.status === "active"
                          ? "bg-success"
                          : "bg-secondary"
                      }`}
                    >
                      {assignment.status || "N/A"}
                    </span>
                  </td>

                  <td className="wrap">
                    <span className="truncate" title={assignment.remarks || ""}>
                      {assignment.remarks || "-"}
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
                <td colSpan="7" className="text-center">
                  No admission syllabus assignments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="d-md-none">
        {filteredAssignments.length > 0 ? (
          filteredAssignments.map((assignment, index) => (
            <div key={assignment.id} className="assignment-card">
              <p className="index-line">#{index + 1}</p>

              <div className="kv">
                <span className="k">Applying Class:</span>
                <span className="v">
                  {assignment.ApplyingClass?.class_name || "Unknown"}
                </span>
              </div>

              <div className="kv">
                <span className="k">Subject:</span>
                <span className="v">
                  {assignment.Subject?.subject_name ||
                    assignment.Subject?.name ||
                    "Unknown"}
                </span>
              </div>

              <div className="kv">
                <span className="k">Assigned To:</span>
                <span className="v">
                  {assignment.AssignedUser?.name ||
                    assignment.AssignedUser?.full_name ||
                    assignment.AssignedUser?.username ||
                    "Unknown"}
                </span>
              </div>

              <div className="kv">
                <span className="k">Status:</span>
                <span className="v">{assignment.status || "N/A"}</span>
              </div>

              <div className="kv">
                <span className="k">Remarks:</span>
                <span className="v">{assignment.remarks || "-"}</span>
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
          <p className="text-center">No admission syllabus assignments found.</p>
        )}
      </div>
    </div>
  );
};

export default AdmissionSyllabusAssignee;