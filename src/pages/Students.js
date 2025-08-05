// src/pages/Students.jsx
import React, { useState, useEffect } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./Students.css";

// ---- role helpers ---------------------------------------------------------
const getRoleFlags = () => {
  const singleRole = localStorage.getItem("userRole");
  const multiRoles = JSON.parse(localStorage.getItem("roles") || "[]");
  const roles = multiRoles.length ? multiRoles : [singleRole].filter(Boolean);
  return {
    roles,
    isAdmin: roles.includes("admin"),
    isSuperadmin: roles.includes("superadmin"),
  };
};

const Students = () => {
  const { isAdmin, isSuperadmin } = getRoleFlags();
  const isAdminOrSuperAdmin = isAdmin || isSuperadmin;

  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [concessions, setConcessions] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  // ------------------- API Calls ------------------------------------------
  const fetchStudents = async () => {
    try {
      const { data } = await api.get("/students");
      setStudents(data);
    } catch (error) {
      console.error("Error fetching students:", error);
      Swal.fire("Error", "Failed to fetch students.", "error");
    }
  };

  const fetchClasses = async () => {
    try {
      const { data } = await api.get("/classes");
      setClasses(data);
    } catch (error) {
      console.error("Error fetching classes:", error);
      Swal.fire("Error", "Failed to fetch classes.", "error");
    }
  };

  const fetchSections = async () => {
    try {
      const { data } = await api.get("/sections");
      setSections(data);
    } catch (error) {
      console.error("Error fetching sections:", error);
      Swal.fire("Error", "Failed to fetch sections.", "error");
    }
  };

  const fetchConcessions = async () => {
    try {
      const { data } = await api.get("/concessions");
      setConcessions(data);
    } catch (error) {
      console.error("Error fetching concessions:", error);
      Swal.fire("Error", "Failed to fetch concessions.", "error");
    }
  };

  // enable/disable toggle
  const toggleStudentStatus = async (student) => {
    if (!isAdminOrSuperAdmin) return;
    const newStatus = student.status === "enabled" ? "disabled" : "enabled";
    const result = await Swal.fire({
      title: `Are you sure you want to ${newStatus} ${student.name}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: `Yes, ${newStatus} it!`,
    });
    if (result.isConfirmed) {
      try {
        await api.put(`/students/toggle/${student.id}`, { status: newStatus });
        Swal.fire("Updated!", `Student has been ${newStatus}.`, "success");
        fetchStudents();
      } catch (error) {
        console.error("Error toggling student status:", error);
        Swal.fire("Error", "Failed to update the student's status.", "error");
      }
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchClasses();
    fetchSections();
    if (isAdminOrSuperAdmin) fetchConcessions();
  }, [isAdminOrSuperAdmin]);

  // ------------------- CRUD Handlers --------------------------------------
  // DELETE ONLY SUPERADMIN
  const handleDelete = async (studentId, studentName) => {
    if (!isSuperadmin) return;
    const result = await Swal.fire({
      title: `Delete ${studentName}?`,
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/students/delete/${studentId}`);
        Swal.fire("Deleted!", "Student has been deleted.", "success");
        fetchStudents();
      } catch (error) {
        console.error("Error deleting student:", error);
        Swal.fire("Error", "Failed to delete the student.", "error");
      }
    }
  };

  // VIEW (row click)
  const handleView = (student) => {
    const concessionRow = isAdminOrSuperAdmin
      ? `<tr><th>Concession</th><td>${student.concession_name || "-"}</td></tr>`
      : "";

    Swal.fire({
      title: "Student Details",
      width: 600,
      html: `
        <div class="table-responsive">
          <table class="table table-bordered table-sm text-start">
            <tbody>
              <tr><th>Admission #</th><td>${student.admission_number || "-"}</td></tr>
              <tr><th>Name</th><td>${student.name}</td></tr>
              <tr><th>Father's Name</th><td>${student.father_name}</td></tr>
              <tr><th>Mother's Name</th><td>${student.mother_name}</td></tr>
              <tr><th>Class</th><td>${student.class_name || "-"}</td></tr>
              <tr><th>Section</th><td>${student.section_name || "-"}</td></tr>
              <tr><th>Aadhaar</th><td>${student.aadhaar_number || "-"}</td></tr>
              <tr><th>Admission Type</th><td>${student.admission_type}</td></tr>
              ${concessionRow}
              <tr><th>Status</th><td>${student.status}</td></tr>
              <tr><th>Address</th><td>${student.address || "-"}</td></tr>
              <tr><th>Father Phone</th><td>${student.father_phone || "-"}</td></tr>
              <tr><th>Mother Phone</th><td>${student.mother_phone || "-"}</td></tr>
            </tbody>
          </table>
        </div>
      `,
      showConfirmButton: true,
      confirmButtonText: "Close",
    });
  };

const handleAdd = async () => {
  await fetchClasses();
  await fetchSections();
  if (isAdminOrSuperAdmin) await fetchConcessions();

  const concessionFieldHTML = isAdminOrSuperAdmin
    ? `
      <div class="full-row">
        <label for="concession_id">Concession</label>
        <select id="concession_id" class="form-field form-select">
          <option value="">Select Concession</option>
          ${concessions
            .map((c) => `<option value="${c.id}">${c.concession_name}</option>`)
            .join("")}
        </select>
      </div>
    `
    : "";

  Swal.fire({
    title: "Add New Student",
    width: "650px",
    allowOutsideClick: false,
    allowEscapeKey: false,
    html: `
      <div class="two-col-grid form-container">
        <div class="full-row">
          <label for="name">Student Name *</label>
          <input type="text" id="name" class="form-field form-control" placeholder="Name">
        </div>

        <div>
          <label for="father_name">Father Name</label>
          <input type="text" id="father_name" class="form-field form-control" placeholder="Father Name">
        </div>

        <div>
          <label for="mother_name">Mother Name</label>
          <input type="text" id="mother_name" class="form-field form-control" placeholder="Mother Name">
        </div>

        <div>
          <label for="class_id">Class *</label>
          <select id="class_id" class="form-field form-select">
            <option value="">Select Class</option>
            ${classes.map((cls) => `<option value="${cls.id}">${cls.class_name}</option>`).join("")}
          </select>
        </div>

        <div>
          <label for="section_id">Section *</label>
          <select id="section_id" class="form-field form-select">
            <option value="">Select Section</option>
            ${sections.map((s) => `<option value="${s.id}">${s.section_name}</option>`).join("")}
          </select>
        </div>

        <div>
          <label for="father_phone">Father Phone</label>
          <input type="text" id="father_phone" class="form-field form-control" placeholder="10 digits" maxlength="10">
        </div>

        <div>
          <label for="mother_phone">Mother Phone</label>
          <input type="text" id="mother_phone" class="form-field form-control" placeholder="10 digits" maxlength="10">
        </div>

        <div>
          <label for="aadhaar_number">Aadhaar Number</label>
          <input type="text" id="aadhaar_number" class="form-field form-control" placeholder="12 digits" maxlength="12">
        </div>

        <div>
          <label for="admission_type">Admission Type</label>
          <select id="admission_type" class="form-field form-select">
            <option value="New">New</option>
            <option value="Old">Old</option>
          </select>
        </div>

        <div class="full-row">
          <label for="address">Address</label>
          <input type="text" id="address" class="form-field form-control" placeholder="Address">
        </div>

        ${concessionFieldHTML}
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Add",
    preConfirm: () => {
      const name = document.getElementById("name").value.trim();
      const class_id = document.getElementById("class_id").value;
      const section_id = document.getElementById("section_id").value;

      if (!name) return Swal.showValidationMessage("Student Name is required");
      if (!class_id) return Swal.showValidationMessage("Class is required");
      if (!section_id) return Swal.showValidationMessage("Section is required");

      const data = {
        name,
        father_name: document.getElementById("father_name").value.trim() || "Father Name",
        mother_name: document.getElementById("mother_name").value.trim() || "Mother Name",
        class_id,
        section_id,
        address: document.getElementById("address").value.trim(),
        father_phone: document.getElementById("father_phone").value.trim() || "0000000000",
        mother_phone: document.getElementById("mother_phone").value.trim() || "0000000000",
        aadhaar_number: document.getElementById("aadhaar_number").value.trim() || "000000000000",
        admission_type: document.getElementById("admission_type").value,
      };

      if (isAdminOrSuperAdmin) {
        const concessionValue = document.getElementById("concession_id")?.value;
        data.concession_id = concessionValue ? parseInt(concessionValue, 10) : null;
      }
      return data;
    },
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        await api.post("/students/add", result.value);
        Swal.fire("Added!", "Student has been added successfully.", "success");
        fetchStudents();
      } catch (error) {
        console.error("Error adding student:", error);
        Swal.fire("Error", error.response?.data?.error || "Failed to add the student.", "error");
      }
    }
  });
};


  // EDIT
  const handleEdit = async (student) => {
    await fetchClasses();
    await fetchSections();
    if (isAdminOrSuperAdmin) await fetchConcessions();

    const concessionFieldHTML = isAdminOrSuperAdmin
      ? `
          <select id="concession_id" class="form-field">
            <option value="">Select Concession</option>
            ${concessions
              .map(
                (c) => `<option value="${c.id}" ${c.id === student.concession_id ? "selected" : ""}>${c.concession_name}</option>`
              )
              .join("")}
          </select>
        `
      : "";

    Swal.fire({
      title: "Edit Student",
      width: "500px",
      allowOutsideClick: false,
      html: `
        <div class="form-container">
          <input type="text" id="name" class="form-field" placeholder="Name" value="${student.name}">
          <input type="text" id="father_name" class="form-field" placeholder="Father Name" value="${student.father_name}">
          <input type="text" id="mother_name" class="form-field" placeholder="Mother Name" value="${student.mother_name}">
          <select id="class_id" class="form-field">
            <option value="">Select Class</option>
            ${classes.map((cls) => `<option value="${cls.id}" ${cls.id === student.class_id ? "selected" : ""}>${cls.class_name}</option>`).join("")}
          </select>
          <select id="section_id" class="form-field">
            <option value="">Select Section</option>
            ${sections.map((section) => `<option value="${section.id}" ${section.id === student.section_id ? "selected" : ""}>${section.section_name}</option>`).join("")}
          </select>
          <input type="text" id="address" class="form-field" placeholder="Address" value="${student.address || ""}">
          <input type="text" id="father_phone" class="form-field" placeholder="Father Phone" value="${student.father_phone || ""}" maxlength="10">
          <input type="text" id="mother_phone" class="form-field" placeholder="Mother Phone" value="${student.mother_phone || ""}" maxlength="10">
          <input type="text" id="aadhaar_number" class="form-field" placeholder="Aadhaar Number" value="${student.aadhaar_number || ""}" maxlength="12">
          <select id="admission_type" class="form-field">
            <option value="New" ${student.admission_type === "New" ? "selected" : ""}>New</option>
            <option value="Old" ${student.admission_type === "Old" ? "selected" : ""}>Old</option>
          </select>
          ${concessionFieldHTML}
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Save",
      preConfirm: () => {
        const name = document.getElementById("name").value.trim();
        const father_name = document.getElementById("father_name").value.trim();
        const mother_name = document.getElementById("mother_name").value.trim();
        const class_id = document.getElementById("class_id").value;
        const section_id = document.getElementById("section_id").value;
        const address = document.getElementById("address").value.trim();
        const father_phone = document.getElementById("father_phone").value.trim();
        const mother_phone = document.getElementById("mother_phone").value.trim();
        const aadhaar_number = document.getElementById("aadhaar_number").value.trim();
        const admission_type = document.getElementById("admission_type").value;

        if (!name) return Swal.showValidationMessage("Name is required");
        if (!father_name) return Swal.showValidationMessage("Father’s name is required");
        if (!mother_name) return Swal.showValidationMessage("Mother’s name is required");
        if (!class_id) return Swal.showValidationMessage("Please select a class");
        if (!section_id) return Swal.showValidationMessage("Please select a section");
        if (!/^\d{10}$/.test(father_phone)) return Swal.showValidationMessage("Father’s phone must be 10 digits");
        if (!/^\d{10}$/.test(mother_phone)) return Swal.showValidationMessage("Mother’s phone must be 10 digits");
        if (!/^\d{12}$/.test(aadhaar_number)) return Swal.showValidationMessage("Aadhaar must be exactly 12 digits");

        const data = {
          name,
          father_name,
          mother_name,
          class_id,
          section_id,
          address,
          father_phone,
          mother_phone,
          aadhaar_number,
          admission_type,
        };

        if (isAdminOrSuperAdmin) {
          const c = document.getElementById("concession_id").value;
          data.concession_id = c ? parseInt(c, 10) : null;
        }
        return data;
      },
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.put(`/students/edit/${student.id}`, result.value);
          Swal.fire("Updated!", "Student has been updated successfully.", "success");
          fetchStudents();
        } catch (error) {
          console.error("Error updating student:", error);
          Swal.fire("Error", error.response?.data?.error || "Failed to update the student.", "error");
        }
      }
    });
  };

  // ------------------- Filters & Counts -----------------------------------
  const filteredStudents = students.filter((student) => {
    const textMatch = [student.name, student.father_name, student.aadhaar_number]
      .some((field) => (field || "").toLowerCase().includes(search.toLowerCase()));
    const classMatch = selectedClass ? student.class_id?.toString() === selectedClass : true;
    const statusMatch = selectedStatus ? student.status === selectedStatus : true;
    return textMatch && classMatch && statusMatch;
  });

  const totalCount = filteredStudents.length;
  const enabledCount = filteredStudents.filter((s) => s.status === "enabled").length;
  const disabledCount = filteredStudents.filter((s) => s.status === "disabled").length;

  // ------------------- JSX -------------------------------------------------
  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1>Students Management</h1>
        {isAdminOrSuperAdmin && (
          <button className="btn btn-success" onClick={handleAdd}>
            Add Student
          </button>
        )}
      </div>

      {/* Cards */}
      <div className="row mb-3">
        <div className="col-md-4">
          <div className="card text-white bg-success mb-3">
            <div className="card-body">
              <h5 className="card-title">Enabled Students</h5>
              <p className="card-text">{enabledCount}</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-white bg-danger mb-3">
            <div className="card-body">
              <h5 className="card-title">Disabled Students</h5>
              <p className="card-text">{disabledCount}</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-white bg-info mb-3">
            <div className="card-body">
              <h5 className="card-title">Total Students</h5>
              <p className="card-text">{totalCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="d-flex mb-3 align-items-center flex-wrap gap-2">
        <input
          type="text"
          className="form-control"
          style={{ maxWidth: "300px" }}
          placeholder="Search Students"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="form-select"
          style={{ maxWidth: "200px" }}
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
        >
          <option value="">All Classes</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.class_name}
            </option>
          ))}
        </select>
        <select
          className="form-select"
          style={{ maxWidth: "200px" }}
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
          <option value="">All Students</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      <table className="table table-striped table-hover">
        <thead>
          <tr>
            <th>#</th>
            <th>Admission Number</th>
            <th>Name</th>
            <th>Father Name</th>
            <th>Class</th>
            <th>Section</th>
            <th>Aadhaar</th>
            <th>Admission Type</th>
            {isAdminOrSuperAdmin && <th>Concession</th>}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredStudents.length > 0 ? (
            filteredStudents
              .slice()
              .reverse()
              .map((student, idx) => (
                <tr
                  key={student.id}
                  className="clickable-row"
                  onClick={() => handleView(student)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleView(student);
                  }}
                >
                  <td>{idx + 1}</td>
                  <td>{student.admission_number}</td>
                  <td>{student.name}</td>
                  <td>{student.father_name}</td>
                  <td>{student.class_name || "Unknown"}</td>
                  <td>{student.section_name || "Unknown"}</td>
                  <td>{student.aadhaar_number}</td>
                  <td>{student.admission_type}</td>
                  {isAdminOrSuperAdmin && <td>{student.concession_name || "Unknown"}</td>}

                  {/* Actions cell - stop row click */}
                  <td
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    {isAdminOrSuperAdmin && (
                      <>
                        {/* Enable/Disable */}
                        <div className="form-check form-switch d-inline-block me-2 align-middle">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`toggle-${student.id}`}
                            checked={student.status === "enabled"}
                            onChange={() => toggleStudentStatus(student)}
                          />
                          <label
                            className="form-check-label"
                            htmlFor={`toggle-${student.id}`}
                          >
                            {student.status === "enabled" ? "On" : "Off"}
                          </label>
                        </div>

                        {/* EDIT */}
                        <button
                          className="btn btn-primary btn-sm me-2"
                          onClick={() => handleEdit(student)}
                        >
                          Edit
                        </button>
                      </>
                    )}

                    {/* DELETE only for superadmin */}
                    {isSuperadmin && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(student.id, student.name)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))
          ) : (
            <tr>
              <td colSpan={isAdminOrSuperAdmin ? "10" : "9"} className="text-center">
                No Students Found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Students;
