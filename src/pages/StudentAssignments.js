import React, { useState, useEffect } from "react";
import api from "../api"; // Your custom Axios instance
import Swal from "sweetalert2";

const GiveAssignmentToStudents = () => {
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [students, setStudents] = useState([]);
  const [classFilter, setClassFilter] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [markAll, setMarkAll] = useState(false);
  const [assignedList, setAssignedList] = useState([]);
  const [showModal, setShowModal] = useState(false);

  // Fetch available assignments
  const fetchAssignments = async () => {
    try {
      const res = await api.get("/assignments");
      // Ensure assignments is always an array
      setAssignments(res.data.assignments || []);
    } catch (err) {
      console.error("Error fetching assignments:", err);
    }
  };

  // Fetch students from teacher's assigned classes
  const fetchStudents = async () => {
    try {
      const res = await api.get("/teacher-students/students");
      // Ensure students is always an array
      setStudents(res.data.students || []);
    } catch (err) {
      console.error("Error fetching students:", err);
    }
  };

  // Fetch assignments already assigned to students (for listing)
  const fetchAssignedList = async () => {
    try {
      const res = await api.get("/student-assignments   ");
      // Ensure assignedList is always an array
      setAssignedList(res.data.assigned || []);
    } catch (err) {
      console.error("Error fetching assigned list:", err);
    }
  };

  useEffect(() => {
    fetchAssignments();
    fetchStudents();
    fetchAssignedList();
  }, []);

  // Filter students by class name if filter provided
  const filteredStudents = classFilter
    ? students.filter(
        (student) =>
          student.Class &&
          student.Class.class_name &&
          student.Class.class_name.toLowerCase().includes(classFilter.toLowerCase())
      )
    : students;

  // Toggle "Mark All" checkbox
  const handleMarkAll = (e) => {
    const checked = e.target.checked;
    setMarkAll(checked);
    if (checked) {
      setSelectedStudentIds(filteredStudents.map((s) => s.id));
    } else {
      setSelectedStudentIds([]);
    }
  };

  // Toggle individual student selection
  const handleStudentCheckbox = (studentId, isChecked) => {
    if (isChecked) {
      setSelectedStudentIds((prev) => [...prev, studentId]);
    } else {
      setSelectedStudentIds((prev) => prev.filter((id) => id !== studentId));
    }
  };

  // Handle assignment selection from dropdown
  const handleAssignmentChange = (e) => {
    setSelectedAssignmentId(e.target.value);
  };

  // Submit assignment distribution request
  const assignAssignment = async () => {
    if (!selectedAssignmentId) {
      Swal.fire("Error", "Please select an assignment", "error");
      return;
    }
    if (selectedStudentIds.length === 0) {
      Swal.fire("Error", "Please select at least one student", "error");
      return;
    }
    try {
      await api.post(`/student-assignments/${selectedAssignmentId}/assign`, {
        studentIds: selectedStudentIds,
      });
      Swal.fire("Success", "Assignment assigned successfully", "success");
      setShowModal(false);
      fetchAssignedList();
    } catch (err) {
      console.error("Error assigning assignment:", err);
      Swal.fire("Error", "Failed to assign assignment", "error");
    }
  };

  return (
    <div className="container mt-4">
      <h1>Assignment Distribution</h1>
      <button className="btn btn-primary mb-3" onClick={() => setShowModal(true)}>
        Give Assignment to Students
      </button>

      {/* Listing of Assigned Assignments */}
      <h2>Assigned Assignments</h2>
      <table className="table table-bordered">
        <thead>
          <tr>
            <th>Assignment Name</th>
            <th>Created Date</th>
            <th>Class</th>
          </tr>
        </thead>
        <tbody>
          {assignedList.map((item) => (
            <tr key={item.id}>
              <td>{item.assignment && item.assignment.title}</td>
              <td>
                {item.assignment && item.assignment.createdAt
                  ? new Date(item.assignment.createdAt).toLocaleDateString()
                  : "N/A"}
              </td>
              <td>
                {item.assignment && item.assignment.Class
                  ? item.assignment.Class.class_name
                  : "N/A"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modal for Assignment Distribution */}
      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Assign Assignment to Students</h5>
                <button className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body">
                {/* Dropdown to select assignment */}
                <div className="mb-3">
                  <label>Select Assignment:</label>
                  <select
                    className="form-select"
                    value={selectedAssignmentId}
                    onChange={handleAssignmentChange}
                  >
                    <option value="">-- Select an Assignment --</option>
                    {assignments.map((assignment) => (
                      <option key={assignment.id} value={assignment.id}>
                        {assignment.title}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Filter input for students */}
                <div className="mb-3">
                  <label>Filter Students by Class Name:</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter class name..."
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                  />
                </div>
                {/* Mark All checkbox */}
                <div className="mb-2">
                  <input type="checkbox" checked={markAll} onChange={handleMarkAll} /> Mark All
                </div>
                {/* Students List */}
                <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Select</th>
                        <th>Student Name</th>
                        <th>Class</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student) => (
                        <tr key={student.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedStudentIds.includes(student.id)}
                              onChange={(e) =>
                                handleStudentCheckbox(student.id, e.target.checked)
                              }
                            />
                          </td>
                          <td>{student.name}</td>
                          <td>{student.Class ? student.Class.class_name : "N/A"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Close
                </button>
                <button className="btn btn-primary" onClick={assignAssignment}>
                  Assign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GiveAssignmentToStudents;
