import React, { useState, useEffect } from "react";
import api from "../api"; // Custom Axios instance
import Swal from "sweetalert2";
import "./TeacherAssignment.css"; // Create corresponding styles if needed

const TeacherAssignment = () => {
  // State variables for assignments and dropdown data
  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);

  // For search/filtering (by class name and teacher name)
  const [searchClass, setSearchClass] = useState("");
  const [searchTeacher, setSearchTeacher] = useState("");

  // =============================
  // 1. Fetch Data from Backend
  // =============================
  const fetchAssignments = async () => {
    try {
      const response = await api.get("/class-subject-teachers");
      setAssignments(response.data);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      Swal.fire("Error", "Failed to fetch teacher assignments.", "error");
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await api.get("/classes");
      setClasses(response.data);
    } catch (error) {
      console.error("Error fetching classes:", error);
      Swal.fire("Error", "Failed to fetch classes.", "error");
    }
  };

  const fetchSections = async () => {
    try {
      const response = await api.get("/sections");
      setSections(response.data);
    } catch (error) {
      console.error("Error fetching sections:", error);
      Swal.fire("Error", "Failed to fetch sections.", "error");
    }
  };

  const fetchSubjects = async () => {
    try {
      const response = await api.get("/subjects");
      // Adjust to extract the array from the response:
      const subjectsData = Array.isArray(response.data)
        ? response.data
        : response.data.subjects;
      setSubjects(subjectsData || []);
    } catch (error) {
      console.error("Error fetching subjects:", error);
      Swal.fire("Error", "Failed to fetch subjects.", "error");
    }
  };

  const fetchTeachers = async () => {
    try {
      const response = await api.get("/teachers");
      // Check if response.data is an array or an object containing teachers
      const teachersData = Array.isArray(response.data)
        ? response.data
        : response.data.teachers;
      setTeachers(teachersData || []);
    } catch (error) {
      console.error("Error fetching teachers:", error);
      Swal.fire("Error", "Failed to fetch teachers.", "error");
    }
  };

  // =============================
  // 2. CRUD Operations
  // =============================
  const handleAdd = async () => {
    // Ensure dropdown data is loaded
    await Promise.all([fetchClasses(), fetchSections(), fetchSubjects(), fetchTeachers()]);

    // Build options for dropdowns
    const classOptions = classes
      .map((cls) => `<option value="${cls.id}">${cls.class_name}</option>`)
      .join("");
    const sectionOptions = sections
      .map((sec) => `<option value="${sec.id}">${sec.section_name}</option>`)
      .join("");
    const subjectOptions = subjects
      .map((sub) => `<option value="${sub.id}">${sub.name}</option>`)
      .join("");
    const teacherOptions = teachers
      .map((teacher) => `<option value="${teacher.id}">${teacher.name}</option>`)
      .join("");

    Swal.fire({
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
        return {
          class_id: document.getElementById("classId").value,
          section_id: document.getElementById("sectionId").value,
          subject_id: document.getElementById("subjectId").value,
          teacher_id: document.getElementById("teacherId").value,
        };
      },
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.post("/class-subject-teachers", result.value);
          Swal.fire("Added!", "Teacher assignment has been added.", "success");
          fetchAssignments();
        } catch (error) {
          if (error.response && error.response.status === 409) {
            // Show confirmation dialog if duplicate exists
            const confirmResult = await Swal.fire({
              title: "Duplicate Assignment",
              text: error.response.data.message || "An assignment with the same class, section, and subject already exists. Do you want to proceed?",
              icon: "warning",
              showCancelButton: true,
              confirmButtonText: "Yes, proceed",
            });
            if (confirmResult.isConfirmed) {
              try {
                await api.post("/class-subject-teachers", { ...result.value, confirmDuplicate: true });
                Swal.fire("Added!", "Teacher assignment has been added.", "success");
                fetchAssignments();
              } catch (err) {
                Swal.fire("Error", "Failed to add teacher assignment.", "error");
              }
            }
          } else {
            Swal.fire("Error", "Failed to add teacher assignment.", "error");
          }
        }
      }
    });
  };

  const handleEdit = async (assignment) => {
    await Promise.all([fetchClasses(), fetchSections(), fetchSubjects(), fetchTeachers()]);

    const originalClassId = assignment.Class?.id;
    const originalSectionId = assignment.Section?.id;
    const originalSubjectId = assignment.Subject?.id;
    const originalTeacherId = assignment.Teacher?.id;

    const classOptions = classes
      .map((cls) => `<option value="${cls.id}">${cls.class_name}</option>`)
      .join("");
    const sectionOptions = sections
      .map((sec) => `<option value="${sec.id}">${sec.section_name}</option>`)
      .join("");
    const subjectOptions = subjects
      .map((sub) => `<option value="${sub.id}">${sub.name}</option>`)
      .join("");
    const teacherOptions = teachers
      .map((teacher) => `<option value="${teacher.id}">${teacher.name}</option>`)
      .join("");

    Swal.fire({
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
      didOpen: () => {
        if (originalClassId) document.getElementById("classId").value = originalClassId;
        if (originalSectionId) document.getElementById("sectionId").value = originalSectionId;
        if (originalSubjectId) document.getElementById("subjectId").value = originalSubjectId;
        if (originalTeacherId) document.getElementById("teacherId").value = originalTeacherId;
      },
      preConfirm: () => {
        return {
          class_id: document.getElementById("classId").value,
          section_id: document.getElementById("sectionId").value,
          subject_id: document.getElementById("subjectId").value,
          teacher_id: document.getElementById("teacherId").value,
        };
      },
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.put(`/class-subject-teachers/${assignment.id}`, result.value);
          Swal.fire("Updated!", "Teacher assignment has been updated.", "success");
          fetchAssignments();
        } catch (error) {
          if (error.response && error.response.status === 409) {
            // Show confirmation dialog if duplicate exists
            const confirmResult = await Swal.fire({
              title: "Duplicate Assignment",
              text: error.response.data.message || "An assignment with the same class, section, and subject already exists. Do you want to proceed?",
              icon: "warning",
              showCancelButton: true,
              confirmButtonText: "Yes, proceed",
            });
            if (confirmResult.isConfirmed) {
              try {
                await api.put(`/class-subject-teachers/${assignment.id}`, { ...result.value, confirmDuplicate: true });
                Swal.fire("Updated!", "Teacher assignment has been updated.", "success");
                fetchAssignments();
              } catch (err) {
                Swal.fire("Error", "Failed to update teacher assignment.", "error");
              }
            }
          } else {
            Swal.fire("Error", "Failed to update teacher assignment.", "error");
          }
        }
      }
    });
  };

  const handleDelete = async (assignment) => {
    Swal.fire({
      title: "Are you sure you want to delete this assignment?",
      text: `Class: ${assignment.Class?.class_name || "Unknown"} - Subject: ${assignment.Subject?.name || "Unknown"} - Teacher: ${assignment.Teacher?.name || "Unknown"}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.delete(`/class-subject-teachers/${assignment.id}`);
          Swal.fire("Deleted!", "Teacher assignment has been deleted.", "success");
          fetchAssignments();
        } catch (error) {
          Swal.fire("Error", "Failed to delete teacher assignment.", "error");
        }
      }
    });
  };

  // =============================
  // 3. Search / Filter Logic
  // =============================
  const filteredAssignments = assignments.filter((assignment) => {
    const className = assignment.Class?.class_name?.toLowerCase() || "";
    const teacherName = assignment.Teacher?.name?.toLowerCase() || "";
    return (
      className.includes(searchClass.toLowerCase()) &&
      teacherName.includes(searchTeacher.toLowerCase())
    );
  });

  // =============================
  // 4. Load Data on Component Mount
  // =============================
  useEffect(() => {
    fetchAssignments();
    fetchClasses();
    fetchSections();
    fetchSubjects();
    fetchTeachers();
    // Optional: Poll for updates every 5 seconds
    const pollingInterval = setInterval(fetchAssignments, 5000);
    return () => clearInterval(pollingInterval);
  }, []);

  // =============================
  // 5. Render
  // =============================
  return (
    <div className="container mt-4">
      <h1>Teacher Assignment Management</h1>

      {/* Search Inputs */}
      <div className="row mb-3">
        <div className="col-md-6">
          <input
            type="text"
            className="form-control"
            placeholder="Search by Class"
            value={searchClass}
            onChange={(e) => setSearchClass(e.target.value)}
          />
        </div>
        <div className="col-md-6">
          <input
            type="text"
            className="form-control"
            placeholder="Search by Teacher"
            value={searchTeacher}
            onChange={(e) => setSearchTeacher(e.target.value)}
          />
        </div>
      </div>

      {/* Add Assignment Button */}
      <button className="btn btn-success mb-3" onClick={handleAdd}>
        Add Teacher Assignment
      </button>

      <table className="table table-striped">
        <thead>
          <tr>
            <th>#</th>
            <th>Class</th>
            <th>Section</th>
            <th>Subject</th>
            <th>Teacher</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredAssignments.length > 0 ? (
            filteredAssignments.map((assignment, index) => (
              <tr key={assignment.id}>
                <td>{index + 1}</td>
                <td>{assignment.Class?.class_name || "Unknown"}</td>
                <td>{assignment.Section?.section_name || "Unknown"}</td>
                <td>{assignment.Subject?.name || "Unknown"}</td>
                <td>{assignment.Teacher?.name || "Unknown"}</td>
                <td>
                  <button
                    className="btn btn-primary btn-sm me-2"
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
  );
};

export default TeacherAssignment;
