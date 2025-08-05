import React, { useState, useEffect } from "react";
import api from "../api"; // Custom Axios instance
import Swal from "sweetalert2";

const InchargeAssignment = () => {
  // State variables for assignments and dropdown data
  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [teachers, setTeachers] = useState([]);

  // =============================
  // 1. Fetch Data from Backend
  // =============================
  const fetchAssignments = async () => {
    try {
      const response = await api.get("/incharges/all");
      setAssignments(response.data);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      Swal.fire("Error", "Failed to fetch incharge assignments.", "error");
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

  const fetchTeachers = async () => {
    try {
      const response = await api.get("/teachers");
  
      // Ensure response.data is an array, or extract it correctly
      const teachersData = Array.isArray(response.data) ? response.data : response.data.teachers || [];
  
      setTeachers(teachersData);
    } catch (error) {
      console.error("Error fetching teachers:", error);
      setTeachers([]); // Fallback to empty array to avoid `map` errors
      Swal.fire("Error", "Failed to fetch teachers.", "error");
    }
  };
  

  // =============================
  // 2. Assign Incharge
  // =============================
  const handleAdd = async () => {
    await Promise.all([fetchClasses(), fetchSections(), fetchTeachers()]);

    // Generate dropdown options
    const classOptions = classes.map((cls) => `<option value="${cls.id}">${cls.class_name}</option>`).join("");
    const sectionOptions = sections.map((sec) => `<option value="${sec.id}">${sec.section_name}</option>`).join("");
    const teacherOptions = teachers.map((teacher) => `<option value="${teacher.id}">${teacher.name}</option>`).join("");

    Swal.fire({
      title: "Assign Incharge",
      width: "600px",
      html: `
        <div>
          <label>Class:</label>
          <select id="classId" class="form-control">${classOptions}</select>
          
          <label>Section:</label>
          <select id="sectionId" class="form-control">${sectionOptions}</select>
          
          <label>Teacher:</label>
          <select id="teacherId" class="form-control">${teacherOptions}</select>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Assign",
      preConfirm: () => {
        return {
          classId: document.getElementById("classId").value,
          sectionId: document.getElementById("sectionId").value,
          teacherId: document.getElementById("teacherId").value,
        };
      },
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.post("/incharges/assign", result.value);
          Swal.fire("Assigned!", "Incharge has been assigned successfully.", "success");
          fetchAssignments();
        } catch (error) {
          if (error.response && error.response.status === 409) {
            // Show confirmation dialog if duplicate exists
            const confirmResult = await Swal.fire({
              title: "Duplicate Incharge",
              text: "This teacher is already assigned as an incharge for this Class & Section. Do you want to continue?",
              icon: "warning",
              showCancelButton: true,
              confirmButtonText: "Yes, Assign Again",
            });
            if (confirmResult.isConfirmed) {
              try {
                await api.post("/incharges/assign", { ...result.value, confirm: true });
                Swal.fire("Assigned!", "Incharge has been assigned successfully.", "success");
                fetchAssignments();
              } catch (err) {
                Swal.fire("Error", "Failed to assign incharge.", "error");
              }
            }
          } else {
            Swal.fire("Error", "Failed to assign incharge.", "error");
          }
        }
      }
    });
  };
  const handleEdit = async (assignment) => {
    await Promise.all([fetchClasses(), fetchSections(), fetchTeachers()]);
  
    // Pre-fill existing values
    const originalClassId = assignment.Class?.id;
    const originalSectionId = assignment.Section?.id;
    const originalTeacherId = assignment.Teacher?.id;
  
    // Generate dropdown options
    const classOptions = classes.map((cls) => `<option value="${cls.id}">${cls.class_name}</option>`).join("");
    const sectionOptions = sections.map((sec) => `<option value="${sec.id}">${sec.section_name}</option>`).join("");
    const teacherOptions = teachers.map((teacher) => `<option value="${teacher.id}">${teacher.name}</option>`).join("");
  
    Swal.fire({
      title: "Edit Incharge Assignment",
      width: "600px",
      html: `
        <div>
          <label>Class:</label>
          <select id="classId" class="form-control">${classOptions}</select>
          
          <label>Section:</label>
          <select id="sectionId" class="form-control">${sectionOptions}</select>
          
          <label>Teacher:</label>
          <select id="teacherId" class="form-control">${teacherOptions}</select>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Save Changes",
      didOpen: () => {
        document.getElementById("classId").value = originalClassId;
        document.getElementById("sectionId").value = originalSectionId;
        document.getElementById("teacherId").value = originalTeacherId;
      },
      preConfirm: () => {
        return {
          classId: document.getElementById("classId").value,
          sectionId: document.getElementById("sectionId").value,
          teacherId: document.getElementById("teacherId").value,
        };
      },
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.put(`/incharges/update/${assignment.id}`, result.value);
          Swal.fire("Updated!", "Incharge assignment has been updated.", "success");
          fetchAssignments();
        } catch (error) {
          Swal.fire("Error", "Failed to update incharge assignment.", "error");
        }
      }
    });
  };
  
  // =============================
  // 3. Remove Incharge
  // =============================
  const handleDelete = async (assignment) => {
    Swal.fire({
      title: "Are you sure?",
      text: `Remove ${assignment.teacher?.name} as incharge of ${assignment.Class?.class_name} - ${assignment.Section?.section_name}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Remove",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.delete(`/incharges/remove/${assignment.id}`);
          Swal.fire("Removed!", "Incharge has been removed successfully.", "success");
          fetchAssignments();
        } catch (error) {
          Swal.fire("Error", "Failed to remove incharge.", "error");
        }
      }
    });
  };

  // =============================
  // 4. Load Data on Component Mount
  // =============================
  useEffect(() => {
    fetchAssignments();
    fetchClasses();
    fetchSections();
    fetchTeachers();
  }, []);

  // =============================
  // 5. Render
  // =============================
  return (
    <div className="container mt-4">
      <h1>Incharge Assignment Management</h1>

      {/* Add Assignment Button */}
      <button className="btn btn-success mb-3" onClick={handleAdd}>
        Assign Incharge
      </button>

      <table className="table table-striped">
        <thead>
          <tr>
            <th>#</th>
            <th>Class</th>
            <th>Section</th>
            <th>Incharge</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
            {assignments.length > 0 ? (
                assignments.map((assignment, index) => (
                <tr key={assignment.id}>
                    <td>{index + 1}</td>
                    <td>{assignment.Class?.class_name || "Unknown"}</td>
                    <td>{assignment.Section?.section_name || "Unknown"}</td>
                    <td>{assignment.Teacher?.name || "Unknown"}</td>
                    <td>
                    <button className="btn btn-primary btn-sm me-2" onClick={() => handleEdit(assignment)}>
                        Edit
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(assignment)}>
                        Remove
                    </button>
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
  );
};

export default InchargeAssignment;
