import React, { useState, useEffect, useRef } from "react";
import api from "../api"; // Custom Axios instance
import Swal from "sweetalert2";
import { getDoc, doc } from "firebase/firestore";
import { firestore } from "../firebase/firebaseConfig";


// Assignment Management Component (Create, Edit, Delete)
const Assignments = () => {
  const [assignments, setAssignments] = useState([]);
  const [newAssignment, setNewAssignment] = useState({
    title: "",
    content: "",
    youtubeUrl: "",
    subjectId: ""
  });
  const [subjects, setSubjects] = useState([]);
  const [files, setFiles] = useState([]); // For new file uploads
  const [existingFiles, setExistingFiles] = useState([]); // For files already attached (edit mode)
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Reference to hidden file input for adding more files
  const hiddenFileInput = useRef(null);

  // Fetch assignments from API
  const fetchAssignments = async () => {
    try {
      const response = await api.get("/assignments");
      console.log("Fetched assignments:", response.data.assignments);
      setAssignments(response.data.assignments);
    } catch (error) {
      console.error("Error fetching assignments:", error);
    }
  };

  // Fetch subjects from API
  const fetchSubjects = async () => {
    try {
      const response = await api.get("/class-subject-teachers/teacher/class-subjects");
      // Extract subjects from assignments and remove duplicates if needed
      const subjectsFromAssignments = response.data.assignments.map(item => item.subject);
      
      // Optional: remove duplicate subjects (if needed)
      const uniqueSubjects = Array.from(
        new Map(subjectsFromAssignments.map(subj => [subj.id, subj])).values()
      );
      
      setSubjects(uniqueSubjects);
    } catch (error) {
      console.error("Error fetching subjects:", error);
    }
  };
  

  useEffect(() => {
    fetchAssignments();
    fetchSubjects();
  }, []);

  // Trigger hidden file input when plus button is clicked
  const handleAddMoreFiles = () => {
    if (hiddenFileInput.current) {
      hiddenFileInput.current.click();
    }
  };

  // Append additional new files from hidden input
  const handleAdditionalFiles = (e) => {
    setFiles((prevFiles) => [...prevFiles, ...Array.from(e.target.files)]);
  };

  // Remove a new file by index (small "×" button)
  const removeFile = (indexToRemove) => {
    setFiles((prevFiles) =>
      prevFiles.filter((_, index) => index !== indexToRemove)
    );
  };

  // Remove an existing file by index (in edit mode)
  const removeExistingFile = (indexToRemove) => {
    setExistingFiles((prevFiles) =>
      prevFiles.filter((_, index) => index !== indexToRemove)
    );
  };

  // Save assignment (create or update)
  const saveAssignment = async () => {
    try {
      const formData = new FormData();
      formData.append("title", newAssignment.title);
      formData.append("content", newAssignment.content);
      formData.append("youtubeUrl", newAssignment.youtubeUrl);
      formData.append("subjectId", newAssignment.subjectId);
      // Append new files if any
      files.forEach((file) => formData.append("files", file));
      // If editing, send the list of existing file IDs to keep
      if (editingAssignment) {
        const existingFileIds = existingFiles.map((file) => file.id);
        formData.append("existingFiles", JSON.stringify(existingFileIds));
      }

      // Debug: log non-file FormData entries
      for (let pair of formData.entries()) {
        if (typeof pair[1] === "string") {
          console.log(pair[0] + ": ", pair[1]);
        }
      }

      if (editingAssignment) {
        await api.put(`/assignments/${editingAssignment.id}`, formData);
        Swal.fire("Updated!", "Assignment updated successfully.", "success");
      } else {
        await api.post("/assignments", formData);
        Swal.fire("Added!", "Assignment added successfully.", "success");
      }

      setEditingAssignment(null);
      setNewAssignment({ title: "", content: "", youtubeUrl: "", subjectId: "" });
      setFiles([]);
      setExistingFiles([]);
      setShowModal(false);
      fetchAssignments();
      window.dispatchEvent(new Event("assignmentsUpdated"));
    } catch (error) {
      console.error("Error saving assignment:", error);
      Swal.fire("Error", "Failed to save assignment", "error");
    }
  };

  // Delete an assignment
  const deleteAssignment = async (id) => {
    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!"
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.delete(`/assignments/${id}`);
          Swal.fire("Deleted!", "Assignment deleted successfully.", "success");
          fetchAssignments();
          window.dispatchEvent(new Event("assignmentsUpdated"));
        } catch (error) {
          console.error("Error deleting assignment:", error);
          Swal.fire("Error", "Failed to delete assignment", "error");
        }
      }
    });
  };

  // Filter assignments based on search text
  const handleSearch = () => {
    if (search) {
      return assignments.filter((assignment) =>
        assignment.title.toLowerCase().includes(search.toLowerCase())
      );
    }
    return assignments;
  };

  return (
    <div className="mb-5">
      <button
        className="btn btn-success mb-3"
        onClick={() => {
          setEditingAssignment(null);
          setNewAssignment({ title: "", content: "", youtubeUrl: "", subjectId: "" });
          setFiles([]);
          setExistingFiles([]);
          setShowModal(true);
        }}
      >
        Add Assignment
      </button>

      <div className="mb-3">
        <input
          type="text"
          className="form-control w-50 d-inline"
          placeholder="Search Assignments"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <table className="table table-striped">
        <thead>
          <tr>
            <th>#</th>
            <th>Title</th>
            <th>Subject</th>
            <th>YouTube Video</th>
            <th>Files</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {handleSearch().map((assignment, index) => (
            <tr key={assignment.id}>
              <td>{index + 1}</td>
              <td>{assignment.title}</td>
              <td>
                {assignment.Subject
                  ? assignment.Subject.name
                  : assignment.subject
                  ? assignment.subject.name
                  : "N/A"}
              </td>
              <td>
                {assignment.youtubeUrl ? (
                  <button
                    className="btn btn-sm btn-info"
                    onClick={() =>
                      window.open(assignment.youtubeUrl, "_blank", "noopener noreferrer")
                    }
                  >
                    Watch Video
                  </button>
                ) : (
                  "N/A"
                )}
              </td>
              <td>
                {assignment.AssignmentFiles && assignment.AssignmentFiles.length > 0 ? (
                  <ul style={{ paddingLeft: "1rem" }}>
                    {assignment.AssignmentFiles.map((file, i) => (
                      <li key={i}>
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
                ) : (
                  "No Files"
                )}
              </td>
              <td>
                <button
                  className="btn btn-primary btn-sm me-2"
                  onClick={() => {
                    setEditingAssignment(assignment);
                    setNewAssignment({
                      title: assignment.title,
                      content: assignment.content,
                      youtubeUrl: assignment.youtubeUrl,
                      subjectId:
                        assignment.Subject
                          ? assignment.Subject.id
                          : assignment.subject
                          ? assignment.subject.id
                          : ""
                    });
                    // Load existing attachments into state for edit mode
                    setExistingFiles(assignment.AssignmentFiles || []);
                    setFiles([]); // Reset new files
                    setShowModal(true);
                  }}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => deleteAssignment(assignment.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modal for Adding/Editing Assignment */}
      {showModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingAssignment ? "Edit Assignment" : "Add Assignment"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <input
                  type="text"
                  className="form-control mb-3"
                  placeholder="Title"
                  value={newAssignment.title}
                  onChange={(e) =>
                    setNewAssignment({ ...newAssignment, title: e.target.value })
                  }
                />
                <textarea
                  className="form-control mb-3"
                  placeholder="Content"
                  value={newAssignment.content}
                  onChange={(e) =>
                    setNewAssignment({ ...newAssignment, content: e.target.value })
                  }
                ></textarea>
                <input
                  type="text"
                  className="form-control mb-3"
                  placeholder="YouTube URL"
                  value={newAssignment.youtubeUrl}
                  onChange={(e) =>
                    setNewAssignment({
                      ...newAssignment,
                      youtubeUrl: e.target.value
                    })
                  }
                />
                <div className="mb-3">
                  <label>Select Subject:</label>
                  <select
                    className="form-select"
                    value={newAssignment.subjectId}
                    onChange={(e) =>
                      setNewAssignment({ ...newAssignment, subjectId: e.target.value })
                    }
                  >
                    <option value="">-- Select a Subject --</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Display existing attachments in Edit Mode */}
                {editingAssignment && existingFiles.length > 0 && (
                  <div className="mb-3">
                    <strong>Existing Files:</strong>
                    <ul className="list-unstyled">
                      {existingFiles.map((file, index) => (
                        <li key={file.id} className="d-flex align-items-center">
                          <span className="me-2">{file.fileName}</span>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger p-0"
                            style={{
                              width: "20px",
                              height: "20px",
                              lineHeight: "20px"
                            }}
                            onClick={() => removeExistingFile(index)}
                          >
                            &times;
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* Display new files selected */}
                {files.length > 0 && (
                  <div className="mb-3">
                    <strong>New Files:</strong>
                    <ul className="list-unstyled">
                      {files.map((file, index) => (
                        <li key={index} className="d-flex align-items-center">
                          <span className="me-2">{file.name}</span>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger p-0"
                            style={{
                              width: "20px",
                              height: "20px",
                              lineHeight: "20px"
                            }}
                            onClick={() => removeFile(index)}
                          >
                            &times;
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <input
                  type="file"
                  style={{ display: "none" }}
                  multiple
                  ref={hiddenFileInput}
                  onChange={handleAdditionalFiles}
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={handleAddMoreFiles}
                >
                  + Add More Files
                </button>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Close
                </button>
                <button className="btn btn-primary" onClick={saveAssignment}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Assignment Distribution Component (Assign assignment to students)
const GiveAssignmentToStudents = () => {
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [students, setStudents] = useState([]);
  const [classFilter, setClassFilter] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [markAll, setMarkAll] = useState(false);
  const [assignedList, setAssignedList] = useState([]);
  const [showModal, setShowModal] = useState(false);

  // Fetch available assignments (with subjects)
  const fetchAssignments = async () => {
    try {
      const res = await api.get("/assignments");
      setAssignments(res.data.assignments || []);
    } catch (err) {
      console.error("Error fetching assignments:", err);
    }
  };

  // Listen for custom event to refresh assignments dropdown
  useEffect(() => {
    const refreshAssignments = () => {
      fetchAssignments();
    };
    window.addEventListener("assignmentsUpdated", refreshAssignments);
    return () => {
      window.removeEventListener("assignmentsUpdated", refreshAssignments);
    };
  }, []);

  // Fetch students from teacher's assigned classes
  const fetchStudents = async () => {
    try {
      const res = await api.get("/teacher-students/students");
      setStudents(res.data.students || []);
    } catch (err) {
      console.error("Error fetching students:", err);
    }
  };

  // Fetch assigned assignments with a cache-buster to force fresh data
  const fetchAssignedList = async () => {
    try {
      const res = await api.get("/student-assignments", {
        params: { t: new Date().getTime() }
      });
      const data = res.data.assignments || [];
      const processedAssignments = data.map((assignment) => {
        if (assignment.StudentAssignments && assignment.StudentAssignments.length > 0) {
          const seenTimestamps = new Set();
          const uniqueStudentAssignments = assignment.StudentAssignments.filter((sa) => {
            if (!seenTimestamps.has(sa.createdAt)) {
              seenTimestamps.add(sa.createdAt);
              return true;
            }
            return false;
          });
          return { ...assignment, StudentAssignments: uniqueStudentAssignments };
        }
        return assignment;
      });
      setAssignedList(processedAssignments);
    } catch (err) {
      console.error("Error fetching assigned list:", err);
      Swal.fire("Error", "Failed to fetch assigned assignments", "error");
    }
  };

  useEffect(() => {
    fetchAssignments();
    fetchStudents();
    fetchAssignedList();
  }, []);

  // Delete assigned record by exact datetime.
  const deleteAssignedRecord = async (saCreatedAt) => {
    const datetime = encodeURIComponent(new Date(saCreatedAt).toISOString());
    Swal.fire({
      title: "Are you sure?",
      text: "This will delete the assigned record for the exact date and time.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!"
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.delete(`/student-assignments/by-date/${datetime}`);
          Swal.fire("Deleted!", "Assigned record deleted successfully.", "success");
          fetchAssignedList();
        } catch (err) {
          console.error("Error deleting assigned record by datetime:", err);
          Swal.fire("Error", "Failed to delete assigned record", "error");
        }
      }
    });
  };

  // Filter students by class name
  const filteredStudents = classFilter
    ? students.filter(
        (student) =>
          student.Class &&
          student.Class.class_name &&
          student.Class.class_name.toLowerCase().includes(classFilter.toLowerCase())
      )
    : students;

  const handleMarkAll = (e) => {
    const checked = e.target.checked;
    setMarkAll(checked);
    if (checked) {
      setSelectedStudentIds(filteredStudents.map((s) => s.id));
    } else {
      setSelectedStudentIds([]);
    }
  };

  const handleStudentCheckbox = (studentId, isChecked) => {
    if (isChecked) {
      setSelectedStudentIds((prev) => [...prev, studentId]);
    } else {
      setSelectedStudentIds((prev) => prev.filter((id) => id !== studentId));
    }
  };

  const handleAssignmentChange = (e) => {
    setSelectedAssignmentId(e.target.value);
  };

  // Assign assignment to selected students and update UI immediately
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
      // 🔔 Send notification to assigned students
      try {
        const assignment = assignments.find((a) => a.id === selectedAssignmentId);
        const title = assignment?.title || "New Assignment";

        for (const studentId of selectedStudentIds) {
          const userDoc = await getDoc(doc(firestore, "users", String(studentId)));
          const fcmToken = userDoc.exists() ? userDoc.data().fcmToken : null;

          if (fcmToken) {
            await fetch(`${process.env.REACT_APP_API_URL}/fcm/send-notification`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fcmToken,
                title: "📘 Assignment Assigned",
                body: `You've received: ${title}`,
              }),
            });
          }
        }
      } catch (notificationError) {
        console.warn("❌ Failed to send push notifications:", notificationError);
      }

      setTimeout(() => {
        fetchAssignedList();
      }, 500);
      Swal.fire("Success", "Assignment assigned successfully", "success");
      setShowModal(false);
      setSelectedAssignmentId("");
      setSelectedStudentIds([]);
      setMarkAll(false);
    } catch (err) {
      console.error("Error assigning assignment:", err);
      Swal.fire("Error", "Failed to assign assignment", "error");
    }
  };

  const renderAssignedRows = () => {
    return assignedList.flatMap((assignment) => {
      if (assignment.StudentAssignments && assignment.StudentAssignments.length > 0) {
        return assignment.StudentAssignments.map((sa) => (
          <tr key={`${assignment.id}-${sa.createdAt}`}>
            <td>{assignment.title}</td>
            <td>
              {assignment.Subject
                ? assignment.Subject.name
                : assignment.subject
                ? assignment.subject.name
                : "N/A"}
            </td>
            <td>{new Date(sa.createdAt).toLocaleString()}</td>
            <td>{sa.Student && sa.Student.Class ? sa.Student.Class.class_name : "N/A"}</td>
            <td>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => deleteAssignedRecord(sa.createdAt)}
              >
                Delete
              </button>
            </td>
          </tr>
        ));
      }
      return [];
    });
  };

  return (
    <div className="mb-5">
      <button
        className="btn btn-primary mb-3"
        onClick={() => setShowModal(true)}
      >
        Give Assignment to Students
      </button>

      <h2>Assigned Assignments Summary</h2>
      <table className="table table-bordered">
        <thead>
          <tr>
            <th>Assignment Name</th>
            <th>Subject</th>
            <th>Assigned Date & Time</th>
            <th>Student Class</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>{renderAssignedRows()}</tbody>
      </table>

      {/* Modal for Assignment Distribution */}
      {showModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Assign Assignment to Students</h5>
                <button
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                ></button>
              </div>
              <div className="modal-body">
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
                        {assignment.title}{" "}
                        {assignment.Subject
                          ? `(${assignment.Subject.name})`
                          : assignment.subject
                          ? `(${assignment.subject.name})`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>
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
                <div className="mb-2">
                  <input
                    type="checkbox"
                    checked={markAll}
                    onChange={handleMarkAll}
                  />{" "}
                  Mark All
                </div>
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
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
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

// Parent component that renders both sections
const CombinedAssignments = () => {
  return (
    <div className="container mt-4">
      <h1>Assignment Management</h1>
      <Assignments />
      <hr />
      <h1>Assignment Distribution</h1>
      <GiveAssignmentToStudents />
    </div>
  );
};

export default CombinedAssignments;
