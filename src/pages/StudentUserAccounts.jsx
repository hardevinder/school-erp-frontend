// src/pages/StudentUserAccounts.jsx

import React, { useEffect, useState, useMemo } from "react";
import api from "../api";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import "./Users.css";
import { collection, addDoc, setDoc, doc, serverTimestamp } from "firebase/firestore";
import { firestore } from "../firebase/firebaseConfig.js";
import AddStudentModal from "../components/AddStudentModal";

const MySwal = withReactContent(Swal);

const getRoleFlags = () => {
  const rawMulti = JSON.parse(localStorage.getItem("roles") || "[]");
  const rawSingle = localStorage.getItem("userRole");
  const multi = rawMulti.map((r) => String(r).toLowerCase());
  const single = rawSingle ? String(rawSingle).toLowerCase() : null;
  const roles = multi.length ? multi : single ? [single] : [];
  return {
    roles,
    isAdmin: roles.includes("admin"),
    isSuperadmin: roles.includes("superadmin"),
    isCoordinator: roles.includes("academic_coordinator"),
  };
};

const StudentUserAccounts = () => {
  const { isAdmin, isSuperadmin, isCoordinator } = getRoleFlags();

  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);

  // Compute existing usernames for filtering
  const existingUsernames = useMemo(
    () => users.map((u) => String(u.username)),
    [users]
  );

  // Load classes & sections on mount
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [{ data: cls }, { data: sec }] = await Promise.all([
          api.get("/classes"),
          api.get("/sections"),
        ]);
        setClasses(cls || []);
        setSections(sec || []);
      } catch (err) {
        console.error(err);
        Swal.fire("Error", "Failed to load classes or sections.", "error");
      }
    };
    loadFilters();
  }, []);

  // Fetch users list
  const fetchUsers = async () => {
    try {
      const { data } = await api.get("/users/students", {
        params: {
          class_id: selectedClass,
          section_id: selectedSection,
          page,
          limit: 10,
        },
      });
      setUsers(
        (data.students || []).map((u) => ({
          ...u,
          status: u.status || "active",
          roles: Array.isArray(u.roles)
            ? u.roles.map((r) => String(r).toLowerCase())
            : [],
        }))
      );
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to fetch students.", "error");
    }
  };

  // Re-fetch when filters/page change
  useEffect(() => {
    fetchUsers();
  }, [selectedClass, selectedSection, page]);

  // Disable user
  const handleDisable = async (userId, userName) => {
    const { value: reason } = await MySwal.fire({
      title: `Disable ${userName}?`,
      text: "Please provide a reason for disabling this user.",
      input: "textarea",
      inputPlaceholder: "Enter reason...",
      showCancelButton: true,
      confirmButtonText: "Disable",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#d33",
      inputValidator: (value) => (!value && "Reason required"),
    });
    if (!reason) return;
    try {
      await api.put(`/users/${userId}/disable`, { reason });
      Swal.fire("Disabled!", `${userName} has been disabled.`, "success");
      fetchUsers();
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "Failed to disable user.", "error");
    }
  };

  // Enable user
  const handleEnable = async (userId, userName) => {
    const result = await Swal.fire({
      title: `Enable ${userName}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Enable",
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;
    try {
      await api.put(`/users/${userId}/enable`);
      Swal.fire("Enabled!", `${userName} has been restored.`, "success");
      fetchUsers();
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "Failed to enable user.", "error");
    }
  };

  // Save new user from modal
  const handleSaveNew = async (formValues) => {
    // 1) Register via API
    let backendId;
    try {
      const resp = await api.post("/users/register", formValues);
      backendId = resp.data.user?.id || resp.data.id;
    } catch (err) {
      console.error("API registration error:", err);
      const apiMsg = err.response?.data?.message || err.response?.data?.error;
      Swal.fire("Error", apiMsg || "Failed to add user.", "error");
      return;
    }

    // 2) Sync to Firestore (optional; failure here shouldn't block user)
    try {
      await addDoc(collection(firestore, "users"), {
        ...formValues,
        backendId,
        createdAt: serverTimestamp(),
        status: "active",
      });
    } catch (fsErr) {
      console.error("Firestore write error:", fsErr);
      Swal.fire(
        "Warning",
        "User created on server, but failed to sync to Firestore.",
        "warning"
      );
    }

    // 3) Final success
    Swal.fire("Success!", `${formValues.name} has been added.`, "success");
    fetchUsers();
    setShowAddModal(false);
  };

  // Stub for future edit
  const handleEdit = (user) => {
    Swal.fire("Info", "Edit functionality is not implemented yet.", "info");
  };

  // Filter users by search
    // Filter and sort users by name alphabetically
  const filteredUsers = useMemo(
    () =>
      users
        .filter((u) =>
          `${u.name} ${u.username} ${u.email}`
            .toLowerCase()
            .includes(search.toLowerCase())
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [users, search]
  );

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="text-primary">Student User Accounts</h1>
        <button
          className="btn btn-success"
          onClick={() => setShowAddModal(true)}
          disabled={!isCoordinator && !isAdmin && !isSuperadmin}
        >
          + Add Student
        </button>
      </div>

      {/* Filters */}
      <div className="d-flex gap-2 mb-3">
        <select
          className="form-select"
          value={selectedClass}
          onChange={(e) => { setSelectedClass(e.target.value); setPage(1); }}
        >
          <option value="">All Classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.class_name}</option>
          ))}
        </select>
        <select
          className="form-select"
          value={selectedSection}
          onChange={(e) => { setSelectedSection(e.target.value); setPage(1); }}
        >
          <option value="">All Sections</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>{s.section_name}</option>
          ))}
        </select>
        <input
          type="text"
          className="form-control"
          placeholder="Search students..."
          style={{ maxWidth: "300px" }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <table className="table table-hover shadow-sm">
        <thead className="table-dark">
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Admission No.</th>
            <th>Email</th>
            <th>Class</th>
            <th>Section</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.map((u, idx) => (
            <tr key={u.id} className={u.status === "disabled" ? "table-warning" : ""}>
              <td>{(page - 1) * 10 + idx + 1}</td>
              <td>{u.name}</td>
              <td>{u.username}</td>
              <td>{u.email || "N/A"}</td>
              <td>{classes.find((c) => c.id === u.class_id)?.class_name || "N/A"}</td>
              <td>{sections.find((s) => s.id === u.section_id)?.section_name || "N/A"}</td>
              <td>
                <span className={`badge ${u.status === "active" ? "bg-success" : "bg-warning"}`}>{u.status}</span>
              </td>
              <td>
                <button
                  className="btn btn-sm btn-primary me-2"
                  onClick={() => handleEdit(u)}
                  disabled={!isCoordinator && !isAdmin && !isSuperadmin}
                >
                  <i className="bi bi-pencil-square"></i> Edit
                </button>
                {u.status === "active" ? (
                  <button
                    className="btn btn-sm btn-warning"
                    onClick={() => handleDisable(u.id, u.name)}
                    disabled={!isCoordinator && !isAdmin && !isSuperadmin}
                  >
                    <i className="bi bi-lock"></i> Disable
                  </button>
                ) : (
                  <button
                    className="btn btn-sm btn-success"
                    onClick={() => handleEnable(u.id, u.name)}
                    disabled={!isCoordinator && !isAdmin && !isSuperadmin}
                  >
                    <i className="bi bi-unlock"></i> Enable
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="d-flex justify-content-between align-items-center">
        <div>
          <button className="btn btn-sm btn-secondary me-2" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
          <button className="btn btn-sm btn-secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
        <span>Page {page} of {totalPages}</span>
      </div>

      {/* Add Student Modal */}
      <AddStudentModal
        show={showAddModal}
        onHide={() => setShowAddModal(false)}
        classes={classes}
        sections={sections}
        existingUsernames={existingUsernames}
        onSave={handleSaveNew}
      />
    </div>
  );
};

export default StudentUserAccounts;
