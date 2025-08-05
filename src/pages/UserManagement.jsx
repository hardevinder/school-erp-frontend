// src/pages/UserManagement.jsx
import React, { useState, useEffect, useMemo } from "react";
import api from "../api";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import "./Users.css";

import {
  collection,
  addDoc,
  setDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { firestore } from "../firebase/firebaseConfig.js";

const MySwal = withReactContent(Swal);

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [rolesList, setRolesList] = useState([]); // [{id,name,slug}]
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState("");

  /* ========================= Fetchers ========================= */
  const fetchUsers = async () => {
    try {
      // NEW ROUTE
      const { data } = await api.get("/users/all");
      setUsers(
        (data.users || []).map((u) => ({
          ...u,
          roles: Array.isArray(u.roles)
            ? // roles could be objects {id,name,slug} or strings
              u.roles.map((r) => (typeof r === "string" ? r : r.slug))
            : u.role
            ? [u.role]
            : [],
        }))
      );
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to fetch users.", "error");
    }
  };

  const fetchRoles = async () => {
    try {
      const { data } = await api.get("/roles"); // keep if your /roles works
      setRolesList(data.roles || []);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to load roles list.", "error");
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  /* ========================= Helpers ========================= */
  const renderRoleCheckboxes = (selected = []) =>
    rolesList
      .map(
        (r) => `
      <div class="form-check mb-1">
        <input class="form-check-input" type="checkbox" id="role_${r.slug}" value="${r.slug}" ${
          selected.includes(r.slug) ? "checked" : ""
        }>
        <label class="form-check-label" for="role_${r.slug}">${r.name}</label>
      </div>
    `
      )
      .join("");

  const getSelectedRolesFromDOM = () =>
    Array.from(document.querySelectorAll('input[id^="role_"]:checked')).map(
      (el) => el.value
    );

  const roleBadge = (slug) => {
    const map = {
      admin: "bg-primary",
      superadmin: "bg-danger",
      teacher: "bg-info",
      student: "bg-secondary",
      hr: "bg-warning text-dark",
      academic_coordinator: "bg-success",
    };
    return map[slug] || "bg-dark";
  };

  /* ========================= CRUD ========================= */
  const handleDelete = async (userId, userName) => {
    const result = await Swal.fire({
      title: `Delete ${userName}?`,
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#d33",
    });
    if (!result.isConfirmed) return;

    try {
      // NEW ROUTE
      await api.delete(`/users/${userId}`);
      Swal.fire("Deleted!", `${userName} has been removed.`, "success");
      fetchUsers();
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "Failed to delete the user.", "error");
    }
  };

  const handleAdd = async () => {
    const { value: formValues } = await MySwal.fire({
      title: "Add New User",
      html: `
        <div class="form-group text-start">
          <label for="name">Full Name</label>
          <input type="text" id="name" class="form-control mb-2" placeholder="Enter full name" required>
          <label for="username">Username</label>
          <input type="text" id="username" class="form-control mb-2" placeholder="Enter username/admission no." required>
          <label for="email">Email (optional)</label>
          <input type="email" id="email" class="form-control mb-2" placeholder="Enter email">
          <label for="password">Password</label>
          <input type="password" id="password" class="form-control mb-2" placeholder="Enter password" required>
          <label class="mt-2 d-block">Roles</label>
          <div id="rolesWrapper" style="max-height:180px;overflow:auto;border:1px solid #ced4da;border-radius:.375rem;padding:.5rem;">
            ${renderRoleCheckboxes(["student"])}
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Add User",
      preConfirm: () => {
        const name = document.getElementById("name").value.trim();
        const username = document.getElementById("username").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value.trim();
        const roles = getSelectedRolesFromDOM();
        if (!name || !username || !password) {
          Swal.showValidationMessage("Name, Username & Password are required");
          return false;
        }
        if (!roles.length) {
          Swal.showValidationMessage("Please select at least one role");
          return false;
        }
        return { name, username, email, password, roles };
      },
      didOpen: () => document.getElementById("name")?.focus(),
    });

    if (!formValues) return;

    try {
      // NEW ROUTE
      const resp = await api.post("/users/register", formValues);
      const backendId = resp.data?.user?.id || resp.data?.id || null;

      await addDoc(collection(firestore, "users"), {
        name: formValues.name,
        username: formValues.username,
        email: formValues.email,
        roles: formValues.roles,
        backendUserId: backendId,
        createdAt: serverTimestamp(),
      });

      Swal.fire("Success!", "User has been added.", "success");
      fetchUsers();
    } catch (error) {
      console.error(error);
      Swal.fire(
        "Error",
        error.response?.data?.message || "Failed to add the user.",
        "error"
      );
    }
  };

  const handleEdit = async (user) => {
    const { value: formValues } = await MySwal.fire({
      title: "Edit User",
      html: `
        <div class="form-group text-start">
          <label for="name">Full Name</label>
          <input type="text" id="name" class="form-control mb-2" value="${
            user.name || ""
          }" required>
          <label for="username">Username</label>
          <input type="text" id="username" class="form-control mb-2" value="${
            user.username || ""
          }" required>
          <label for="email">Email (optional)</label>
          <input type="email" id="email" class="form-control mb-2" value="${
            user.email || ""
          }">
          <label class="mt-2 d-block">Roles</label>
          <div id="rolesWrapper" style="max-height:180px;overflow:auto;border:1px solid #ced4da;border-radius:.375rem;padding:.5rem;">
            ${renderRoleCheckboxes(user.roles || [])}
          </div>
          <label for="password" class="mt-2">New Password (leave blank if unchanged)</label>
          <input type="password" id="password" class="form-control mb-2" placeholder="Enter new password">
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Save Changes",
      preConfirm: () => {
        const name = document.getElementById("name").value.trim();
        const username = document.getElementById("username").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value.trim();
        const roles = getSelectedRolesFromDOM();
        if (!name || !username) {
          Swal.showValidationMessage("Name & Username are required");
          return false;
        }
        if (!roles.length) {
          Swal.showValidationMessage("Please select at least one role");
          return false;
        }
        return {
          userId: user.id,
          name,
          username,
          email,
          roles,
          ...(password && { password }),
        };
      },
    });

    if (!formValues) return;

    try {
      // NEW ROUTE
      await api.put("/users/update", formValues);

      await setDoc(
        doc(firestore, "users", formValues.userId.toString()),
        {
          name: formValues.name,
          username: formValues.username,
          email: formValues.email,
          roles: formValues.roles,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      Swal.fire("Updated!", "User details have been updated.", "success");
      fetchUsers();
    } catch (error) {
      console.error(error);
      Swal.fire(
        "Error",
        error.response?.data?.message || "Failed to update the user.",
        "error"
      );
    }
  };

  /* ========================= Filter / Search ========================= */
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const textMatch = [u.name || "", u.username || "", u.email || ""]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());
      const roleMatch = selectedRole
        ? (u.roles || []).includes(selectedRole)
        : true;
      return textMatch && roleMatch;
    });
  }, [users, search, selectedRole]);

  /* ========================= Render ========================= */
  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="text-primary">User Management</h1>
        <button className="btn btn-success" onClick={handleAdd}>
          + Add User
        </button>
      </div>

      {/* Search & Filter */}
      <div className="d-flex mb-3 align-items-center flex-wrap gap-2">
        <input
          type="text"
          className="form-control me-2"
          style={{ maxWidth: "320px" }}
          placeholder="Search Users"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="form-select"
          style={{ maxWidth: "220px" }}
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
        >
          <option value="">All Roles</option>
          {rolesList.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {/* Users Table */}
      <table className="table table-hover shadow-sm">
        <thead className="table-dark">
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>User Name</th>
            <th>Email</th>
            <th>Roles</th>
            <th className="text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.length ? (
            filteredUsers.map((user, idx) => (
              <tr key={user.id}>
                <td>{idx + 1}</td>
                <td>{user.name}</td>
                <td>{user.username}</td>
                <td>{user.email || "N/A"}</td>
                <td>
                  {(user.roles || []).map((r) => (
                    <span key={r} className={`badge me-1 ${roleBadge(r)}`}>
                      {r}
                    </span>
                  ))}
                </td>
                <td className="text-center">
                  <button
                    className="btn btn-sm btn-primary me-2"
                    onClick={() => handleEdit(user)}
                  >
                    <i className="bi bi-pencil-square"></i> Edit
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDelete(user.id, user.name)}
                  >
                    <i className="bi bi-trash"></i> Delete
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" className="text-center">
                No Users Found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default UserManagement;
