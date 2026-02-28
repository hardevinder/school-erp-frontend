import React, { useState, useEffect, useMemo, useRef } from "react";
import api from "../api";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import "./Users.css";

import { collection, addDoc, setDoc, doc, serverTimestamp } from "firebase/firestore";
import { firestore } from "../firebase/firebaseConfig.js";

const MySwal = withReactContent(Swal);

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [rolesList, setRolesList] = useState([]); // [{id,name,slug}]
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [loading, setLoading] = useState(true);

  // simple debounce (300ms) for search input UX
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimer = useRef(null);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debounceTimer.current);
  }, [search]);

  /* ========================= Error popup helper ========================= */
  const showApiError = (error, fallbackTitle = "Error") => {
    const data = error?.response?.data;

    // Backend validation array support:
    const errorsArr = Array.isArray(data?.errors) ? data.errors : [];

    const html = errorsArr.length
      ? errorsArr
          .map(
            (e) =>
              `• <b>${String(e.field || "field")}</b>: ${String(e.message || "")}`
          )
          .join("<br/>")
      : data?.message || error?.message || "Something went wrong.";

    Swal.fire({
      icon: "error",
      title: fallbackTitle,
      html,
    });
  };

  /* ========================= Fetchers ========================= */
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/users/all");
      setUsers(
        (data.users || []).map((u) => ({
          ...u,
          roles: Array.isArray(u.roles)
            ? u.roles.map((r) => (typeof r === "string" ? r : r.slug))
            : u.role
            ? [u.role]
            : [],
        }))
      );
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to fetch users.", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const { data } = await api.get("/roles");
      setRolesList(data.roles || []);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to load roles list.", "error");
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      await api.delete(`/users/${userId}`);
      Swal.fire("Deleted!", `${userName} has been removed.`, "success");
      fetchUsers();
    } catch (error) {
      console.error(error);
      showApiError(error, "Failed to delete user");
    }
  };

  const handleAdd = async () => {
    const { value: formValues } = await MySwal.fire({
      title: "Add New User",
      html: `
        <div class="form-group text-start">
          <label for="name" class="form-label">Full Name</label>
          <input type="text" id="name" class="form-control mb-2" placeholder="Enter full name" required>
          <label for="username" class="form-label">Username</label>
          <input type="text" id="username" class="form-control mb-2" placeholder="Enter username/admission no." required>
          <label for="email" class="form-label">Email (optional)</label>
          <input type="email" id="email" class="form-control mb-2" placeholder="Enter email">
          <label for="password" class="form-label">Password</label>
          <input type="password" id="password" class="form-control mb-2" placeholder="Enter password" required>
          <label class="mt-2 d-block">Roles</label>
          <div id="rolesWrapper" class="roles-wrapper">
            ${renderRoleCheckboxes(["student"])}
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Add User",
      confirmButtonColor: "#198754",
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

        // basic client check (backend will still validate)
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          Swal.showValidationMessage(
            "Please enter a valid email address (or leave empty)."
          );
          return false;
        }

        return { name, username, email, password, roles };
      },
      didOpen: () => document.getElementById("name")?.focus(),
      customClass: { popup: "swal2-elevated" },
    });

    if (!formValues) return;

    try {
      // show loader while saving
      Swal.fire({
        title: "Saving...",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      // ✅ Only await backend (this is reliable)
      const resp = await api.post("/users/register", formValues);
      const backendId = resp.data?.user?.id || resp.data?.id || null;

      // Prepare Firestore payload
      const payload = {
        name: formValues.name,
        username: formValues.username,
        email: formValues.email,
        roles: formValues.roles,
        backendUserId: backendId,
        createdAt: serverTimestamp(),
      };

      // ✅ Firestore mirror (NON-BLOCKING, do not await)
      (async () => {
        try {
          if (backendId) {
            await setDoc(doc(firestore, "users", String(backendId)), payload, {
              merge: true,
            });
          } else {
            await addDoc(collection(firestore, "users"), payload);
          }
        } catch (e) {
          console.warn("Firestore mirror skipped (token issue):", e?.message || e);
        }
      })();

      // close loader
      Swal.close();

      // ✅ success popup then refresh
      await Swal.fire({
        icon: "success",
        title: "Success!",
        text: "User added. Refreshing page...",
        timer: 900,
        showConfirmButton: false,
      });

      window.location.reload();
    } catch (error) {
      console.error(error);
      Swal.close(); // close loading if any
      showApiError(error, "Failed to add user");
    }
  };

  const handleEdit = async (user) => {
    const { value: formValues } = await MySwal.fire({
      title: "Edit User",
      html: `
        <div class="form-group text-start">
          <label for="name" class="form-label">Full Name</label>
          <input type="text" id="name" class="form-control mb-2" value="${user.name || ""}" required>
          <label for="username" class="form-label">Username</label>
          <input type="text" id="username" class="form-control mb-2" value="${user.username || ""}" required>
          <label for="email" class="form-label">Email (optional)</label>
          <input type="email" id="email" class="form-control mb-2" value="${user.email || ""}">
          <label class="mt-2 d-block">Roles</label>
          <div id="rolesWrapper" class="roles-wrapper">
            ${renderRoleCheckboxes(user.roles || [])}
          </div>
          <label for="password" class="form-label mt-2">New Password (leave blank if unchanged)</label>
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
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          Swal.showValidationMessage(
            "Please enter a valid email address (or leave empty)."
          );
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
      customClass: { popup: "swal2-elevated" },
    });

    if (!formValues) return;

    try {
      await api.put(`/users/${formValues.userId}`, {
        name: formValues.name,
        username: formValues.username,
        email: formValues.email,
        roles: formValues.roles,
        ...(formValues.password && { password: formValues.password }),
      });

      // ⚠️ keeping this await for edit is okay, but it can hang too if Firebase token is stuck.
      // If you want, make this also non-blocking like create.
      try {
        await setDoc(
          doc(firestore, "users", String(formValues.userId)),
          {
            name: formValues.name,
            username: formValues.username,
            email: formValues.email,
            roles: formValues.roles,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn("Firestore mirror skipped (edit):", e?.message || e);
      }

      Swal.fire("Updated!", "User details have been updated.", "success");
      fetchUsers();
    } catch (error) {
      console.error(error);
      showApiError(error, "Failed to update user");
    }
  };

  /* ========================= Filter / Search ========================= */
  const filteredUsers = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return users.filter((u) => {
      const textMatch = [u.name || "", u.username || "", u.email || ""]
        .join(" ")
        .toLowerCase()
        .includes(q);

      const roleMatch = selectedRole ? (u.roles || []).includes(selectedRole) : true;
      return textMatch && roleMatch;
    });
  }, [users, debouncedSearch, selectedRole]);

  /* ========================= Render ========================= */
  return (
    <div className="container mt-4">
      <div className="card shadow-sm border-0">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <h1 className="h4 mb-0 text-primary">User Management</h1>
              <span className="badge bg-light text-secondary border">{users.length} total</span>
            </div>
            <button className="btn btn-success" onClick={handleAdd}>
              <i className="bi bi-plus-lg me-1"></i> Add User
            </button>
          </div>

          {/* Search & Filter */}
          <div className="d-flex mb-3 align-items-center flex-wrap gap-2">
            <div className="input-group" style={{ maxWidth: 360 }}>
              <span className="input-group-text bg-white">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Search name, username, email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className="form-select"
              style={{ maxWidth: 240 }}
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
          <div className="table-responsive users-table-wrapper">
            <table className="table table-hover align-middle">
              <thead className="table-dark sticky-header">
                <tr>
                  <th style={{ width: 56 }}>#</th>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Roles</th>
                  <th className="text-center" style={{ width: 180 }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={`s-${i}`}>
                      <td colSpan={6}>
                        <div className="skeleton-row" />
                      </td>
                    </tr>
                  ))
                ) : filteredUsers.length ? (
                  filteredUsers.map((user, idx) => (
                    <tr key={user.id || user.username || `u-${idx}`}>
                      <td>{idx + 1}</td>
                      <td className="fw-semibold">{user.name}</td>
                      <td>
                        <span className="text-monospace">{user.username}</span>
                      </td>
                      <td>{user.email || <span className="text-muted">N/A</span>}</td>
                      <td>
                        {(user.roles || []).map((r) => (
                          <span key={r} className={`badge me-1 ${roleBadge(r)}`}>
                            {r}
                          </span>
                        ))}
                      </td>
                      <td className="text-center">
                        <div className="btn-group">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => handleEdit(user)}
                            title="Edit"
                          >
                            <i className="bi bi-pencil-square"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDelete(user.id, user.name)}
                            title="Delete"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center py-5">
                      <div className="text-muted">
                        <i className="bi bi-people me-2"></i>No matching users found
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-2 small text-muted">
            Tip: Use the search box to filter by <em>name</em>, <em>username</em>, or <em>email</em>. Use the dropdown
            to narrow by role.
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;