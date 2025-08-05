import React, { useState, useEffect } from "react";
import api from "../api"; // Your custom Axios instance
import Swal from "sweetalert2";

const AssignmentDetails = () => {
  const [assignments, setAssignments] = useState([]);
  // Holds any changes for each student assignment, keyed by its id
  const [updateFields, setUpdateFields] = useState({});

  // Filter states
  const [studentNameFilter, setStudentNameFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  // Options for class and date filters (computed from data)
  const [availableClasses, setAvailableClasses] = useState([]);
  const [availableDates, setAvailableDates] = useState([]);

  // Fetch assignments with their student assignments and files
  const fetchAssignments = async () => {
    try {
      const res = await api.get("/student-assignments");
      // Assuming the API returns { assignments: [...] }
      setAssignments(res.data.assignments || []);
    } catch (err) {
      console.error("Error fetching assignments:", err);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  // Whenever assignments change, compute distinct class names and dates
  useEffect(() => {
    const classesSet = new Set();
    const datesSet = new Set();
    assignments.forEach((assignment) => {
      assignment.StudentAssignments.forEach((sa) => {
        if (sa.Student && sa.Student.Class) {
          classesSet.add(sa.Student.Class.class_name);
        }
        if (sa.createdAt) {
          datesSet.add(new Date(sa.createdAt).toISOString().substring(0, 10));
        }
      });
    });
    setAvailableClasses(Array.from(classesSet));
    setAvailableDates(Array.from(datesSet));
  }, [assignments]);

  // Handle field changes for a given student assignment record
  const handleFieldChange = (studentAssignmentId, field, value) => {
    setUpdateFields((prev) => ({
      ...prev,
      [studentAssignmentId]: {
        ...prev[studentAssignmentId],
        [field]: value,
      },
    }));
  };

  // Update a specific student assignment using the API
  const updateStudentAssignment = async (studentAssignmentId) => {
    const fields = updateFields[studentAssignmentId] || {};
    try {
      await api.put(`/student-assignments/${studentAssignmentId}`, fields);
      Swal.fire("Success", "Student assignment updated successfully", "success");
      fetchAssignments();
    } catch (err) {
      console.error("Error updating student assignment:", err);
      Swal.fire("Error", "Failed to update student assignment", "error");
    }
  };

  // Filter function for each student assignment record based on the provided filters
  const filterStudentAssignment = (sa) => {
    let matches = true;
    if (studentNameFilter) {
      matches =
        matches &&
        sa.Student &&
        sa.Student.name.toLowerCase().includes(studentNameFilter.toLowerCase());
    }
    if (classFilter) {
      matches =
        matches &&
        sa.Student &&
        sa.Student.Class &&
        sa.Student.Class.class_name === classFilter;
    }
    if (dateFilter) {
      // Compare the createdAt date (formatted as YYYY-MM-DD) with the filter value
      const saDate = new Date(sa.createdAt).toISOString().substring(0, 10);
      matches = matches && saDate === dateFilter;
    }
    return matches;
  };

  return (
    <div className="container mt-4">
      <h1 className="mb-4">Assignment Details</h1>

      {/* Filter Section */}
      <div className="card mb-4 shadow-sm">
        <div className="card-body">
          <h5 className="card-title">Filter Student Assignments</h5>
          <div className="row">
            <div className="col-md-4 mb-2">
              <input
                type="text"
                className="form-control"
                placeholder="Filter by Student Name"
                value={studentNameFilter}
                onChange={(e) => setStudentNameFilter(e.target.value)}
              />
            </div>
            <div className="col-md-4 mb-2">
              <select
                className="form-select"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
              >
                <option value="">All Classes</option>
                {availableClasses.map((cls, idx) => (
                  <option key={idx} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4 mb-2">
              <select
                className="form-select"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              >
                <option value="">All Dates</option>
                {availableDates.map((date, idx) => (
                  <option key={idx} value={date}>
                    {date}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Assignment Cards */}
      {assignments.length === 0 ? (
        <p>No assignments found.</p>
      ) : (
        assignments.map((assignment) => (
          <div key={assignment.id} className="card mb-5 shadow">
            <div className="card-header bg-primary text-white">
              <h2 className="card-title mb-0">{assignment.title}</h2>
            </div>
            <div className="card-body">
              <p>
                <strong>Content:</strong> {assignment.content}
              </p>
              {assignment.youtubeUrl && (
                <p>
                  <strong>Video:</strong>{" "}
                  <a
                    href={assignment.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Watch Video
                  </a>
                </p>
              )}
              {assignment.AssignmentFiles &&
                assignment.AssignmentFiles.length > 0 && (
                  <div className="mb-3">
                    <h5>Files:</h5>
                    <ul className="list-group">
                      {assignment.AssignmentFiles.map((file) => (
                        <li key={file.id} className="list-group-item">
                          <a
                            href={file.filePath}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {file.fileName}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              <h3 className="mt-4">Assigned Students</h3>
              {assignment.StudentAssignments.length === 0 ? (
                <p>No students assigned.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-bordered table-hover">
                    <thead className="table-light">
                      <tr>
                        <th>Student Name</th>
                        <th>Class</th>
                        <th>Status</th>
                        <th>Grade</th>
                        <th>Due Date</th>
                        <th>Remarks</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignment.StudentAssignments.filter(filterStudentAssignment).map(
                        (studentAssignment) => (
                          <tr key={studentAssignment.id}>
                            <td>
                              {studentAssignment.Student
                                ? studentAssignment.Student.name
                                : studentAssignment.studentId}
                            </td>
                            <td>
                              {studentAssignment.Student &&
                              studentAssignment.Student.Class
                                ? studentAssignment.Student.Class.class_name
                                : "N/A"}
                            </td>
                            <td>
                              <select
                                className="form-select"
                                value={
                                  updateFields[studentAssignment.id]?.status ||
                                  studentAssignment.status
                                }
                                onChange={(e) =>
                                  handleFieldChange(
                                    studentAssignment.id,
                                    "status",
                                    e.target.value
                                  )
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
                                className="form-control"
                                value={
                                  updateFields[studentAssignment.id]?.grade ||
                                  studentAssignment.grade ||
                                  ""
                                }
                                onChange={(e) =>
                                  handleFieldChange(
                                    studentAssignment.id,
                                    "grade",
                                    e.target.value
                                  )
                                }
                                placeholder="Enter grade"
                              />
                            </td>
                            <td>
                              <input
                                type="date"
                                className="form-control"
                                value={
                                  updateFields[studentAssignment.id]?.dueDate ||
                                  (studentAssignment.dueDate
                                    ? studentAssignment.dueDate.substring(0, 10)
                                    : "")
                                }
                                onChange={(e) =>
                                  handleFieldChange(
                                    studentAssignment.id,
                                    "dueDate",
                                    e.target.value
                                  )
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-control"
                                value={
                                  updateFields[studentAssignment.id]?.remarks ||
                                  studentAssignment.remarks ||
                                  ""
                                }
                                onChange={(e) =>
                                  handleFieldChange(
                                    studentAssignment.id,
                                    "remarks",
                                    e.target.value
                                  )
                                }
                                placeholder="Enter remarks"
                              />
                            </td>
                            <td>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() =>
                                  updateStudentAssignment(studentAssignment.id)
                                }
                              >
                                Update
                              </button>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default AssignmentDetails;
