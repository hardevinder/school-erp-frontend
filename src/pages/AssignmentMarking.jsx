import React, { useState, useEffect } from "react";
import api from "../api";
import Swal from "sweetalert2";

const AssignmentGrading = () => {
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [students, setStudents] = useState([]);
  const [updateFields, setUpdateFields] = useState({});
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // ==========================================================
  // 🔹 Fetch all assignments for dropdown (teacher only)
  // ==========================================================
  const fetchAssignments = async () => {
    try {
      const res = await api.get("/student-assignments");
      const list = res.data.assignments || [];

      // ✅ Extract unique assignments from StudentAssignments
      const uniqueAssignments = [];
      const seen = new Set();

      list.forEach((sa) => {
        const a = sa.Assignment;
        if (a && !seen.has(a.id)) {
          seen.add(a.id);
          uniqueAssignments.push(a);
        }
      });

      setAssignments(uniqueAssignments);
    } catch (err) {
      console.error("Error fetching assignments:", err);
      Swal.fire("Error", "Failed to load assignments", "error");
    }
  };

  // ==========================================================
  // 🔹 Fetch students assigned to a specific assignment
  // ==========================================================
  const fetchStudents = async (assignmentId) => {
    try {
      const res = await api.get(`/student-assignments/${assignmentId}`);
      setStudents(res.data.students || []);
      setPage(1);
      setUpdateFields({});
    } catch (err) {
      console.error("Error fetching students:", err);
      Swal.fire("Error", "Failed to load students", "error");
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  // ==========================================================
  // 🔹 Handle field changes (local updates before saving)
  // ==========================================================
  const handleFieldChange = (id, field, value) => {
    setUpdateFields((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  // ==========================================================
  // 🔹 Update one student record
  // ==========================================================
  const updateStudentAssignment = async (id) => {
    const fields = updateFields[id] || {};
    try {
      await api.put(`/student-assignments/${id}`, fields);
      Swal.fire("✅ Success", "Student assignment updated", "success");
      fetchStudents(selectedAssignmentId);
    } catch (err) {
      console.error("Error updating student assignment:", err);
      Swal.fire("Error", "Failed to update assignment", "error");
    }
  };

  // ==========================================================
  // 🔹 Bulk update all students (grading, marking, etc.)
  // ==========================================================
  const bulkUpdate = async (fields) => {
    const ids = students.map((s) => s.id);
    if (!ids.length) return;
    try {
      await api.put("/student-assignments/bulk-update", { ids, fields });
      Swal.fire("✅ Success", "Bulk update applied", "success");
      fetchStudents(selectedAssignmentId);
    } catch (err) {
      console.error("Error in bulk update:", err);
      Swal.fire("Error", "Bulk update failed", "error");
    }
  };

  // ==========================================================
  // 🔹 Pagination Controls
  // ==========================================================
  const startIndex = (page - 1) * pageSize;
  const currentStudents = students.slice(startIndex, startIndex + pageSize);
  const totalPages = Math.ceil(students.length / pageSize);

  return (
    <div className="container mt-4 mb-5">
      <h2 className="fw-bold mb-4">📘 Assignment Grading Panel</h2>

      {/* Assignment Dropdown */}
      <div className="card mb-4 shadow-sm">
        <div className="card-body">
          <label className="form-label fw-semibold">Select Assignment:</label>
          <select
            className="form-select"
            value={selectedAssignmentId}
            onChange={(e) => {
              setSelectedAssignmentId(e.target.value);
              if (e.target.value) fetchStudents(e.target.value);
              else setStudents([]);
            }}
          >
            <option value="">-- Select Assignment --</option>
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Student List */}
      {selectedAssignmentId && (
        <div className="card shadow-lg border-0">
          <div className="card-header bg-primary text-white sticky-top d-flex justify-content-between align-items-center">
            <h5 className="mb-0">
              Assigned Students ({students.length || 0})
            </h5>
            <div>
              <button
                className="btn btn-light btn-sm me-2"
                onClick={() => bulkUpdate({ status: "graded" })}
              >
                ✅ Mark All Graded
              </button>
              <button
                className="btn btn-warning btn-sm"
                onClick={() => bulkUpdate({ remarks: "Reviewed" })}
              >
                💬 Add Remark (All)
              </button>
            </div>
          </div>

          <div
            className="card-body p-0"
            style={{
              maxHeight: "480px",
              overflowY: "auto",
              position: "relative",
            }}
          >
            <table className="table table-striped align-middle mb-0">
              <thead className="table-light sticky-top" style={{ top: 0 }}>
                <tr>
                  <th>#</th>
                  <th>Student Name</th>
                  <th>Class</th>
                  <th>Status</th>
                  <th>Grade</th>
                  <th>Due Date</th>
                  <th>Remarks</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentStudents.length > 0 ? (
                  currentStudents.map((sa, i) => (
                    <tr key={sa.id}>
                      <td>{startIndex + i + 1}</td>
                      <td>{sa.Student?.name || "—"}</td>
                      <td>
                        {sa.Student?.Class?.class_name}{" "}
                        {sa.Student?.Section?.section_name
                          ? `(${sa.Student.Section.section_name})`
                          : ""}
                      </td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={
                            updateFields[sa.id]?.status || sa.status || "pending"
                          }
                          onChange={(e) =>
                            handleFieldChange(sa.id, "status", e.target.value)
                          }
                        >
                          <option value="pending">Pending</option>
                          <option value="submitted">Submitted</option>
                          <option value="graded">Graded</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={updateFields[sa.id]?.grade || sa.grade || ""}
                          onChange={(e) =>
                            handleFieldChange(sa.id, "grade", e.target.value)
                          }
                          placeholder="Enter grade"
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={
                            updateFields[sa.id]?.dueDate ||
                            (sa.dueDate ? sa.dueDate.slice(0, 10) : "")
                          }
                          onChange={(e) =>
                            handleFieldChange(sa.id, "dueDate", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={
                            updateFields[sa.id]?.remarks || sa.remarks || ""
                          }
                          onChange={(e) =>
                            handleFieldChange(sa.id, "remarks", e.target.value)
                          }
                          placeholder="Remarks"
                        />
                      </td>
                      <td>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => updateStudentAssignment(sa.id)}
                        >
                          💾 Save
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="text-center text-muted py-4">
                      No students found for this assignment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer with Pagination */}
          <div className="card-footer bg-light sticky-bottom d-flex justify-content-between align-items-center">
            <span className="text-muted small">
              Page {page} of {totalPages || 1}
            </span>
            <div>
              <button
                className="btn btn-outline-secondary btn-sm me-2"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                ◀ Prev
              </button>
              <button
                className="btn btn-outline-secondary btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next ▶
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignmentGrading;
