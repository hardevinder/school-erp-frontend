import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import "./Users.css";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { firestore } from "../firebase/firebaseConfig.js";

const MySwal = withReactContent(Swal);

const swalButtons = {
  confirmButtonColor: "#2563eb",
  cancelButtonColor: "#64748b",
};

const initialRoleStyles = {
  admin: "user-role--admin",
  superadmin: "user-role--superadmin",
  teacher: "user-role--teacher",
  student: "user-role--student",
  hr: "user-role--hr",
  academic_coordinator: "user-role--coordinator",
};

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const normalizeRoles = (user = {}) => {
  if (Array.isArray(user.roles)) {
    return user.roles
      .map((role) => (typeof role === "string" ? role : role?.slug || role?.name))
      .filter(Boolean);
  }

  return user.role ? [user.role] : [];
};

const getInitials = (name = "") => {
  const cleanName = String(name || "User").trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);

  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [rolesList, setRolesList] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimer = useRef(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => clearTimeout(debounceTimer.current);
  }, [search]);

  const showApiError = (error, fallbackTitle = "Error") => {
    const data = error?.response?.data;
    const errorsArr = Array.isArray(data?.errors) ? data.errors : [];

    const html = errorsArr.length
      ? errorsArr
          .map(
            (e) =>
              `• <b>${escapeHtml(e.field || "field")}</b>: ${escapeHtml(
                e.message || ""
              )}`
          )
          .join("<br/>")
      : escapeHtml(data?.message || error?.message || "Something went wrong.");

    return Swal.fire({
      icon: "error",
      title: fallbackTitle,
      html,
      ...swalButtons,
    });
  };

  const showSaving = (title = "Saving changes...") => {
    Swal.fire({
      title,
      text: "Please wait while we update the latest data.",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      customClass: { popup: "users-swal users-swal--loading" },
      didOpen: () => Swal.showLoading(),
    });
  };

  const showSuccess = (title, text) =>
    Swal.fire({
      icon: "success",
      title,
      text,
      confirmButtonText: "OK",
      timer: 1600,
      timerProgressBar: true,
      customClass: { popup: "users-swal" },
      ...swalButtons,
    });

  const fetchUsers = async ({ showLoader = true, silent = false } = {}) => {
    try {
      if (showLoader) setLoading(true);
      if (!showLoader) setRefreshing(true);

      const { data } = await api.get("/users/all");
      const safeUsers = (data.users || []).map((user) => ({
        ...user,
        roles: normalizeRoles(user),
      }));

      setUsers(safeUsers);
      return true;
    } catch (err) {
      console.error("Failed to fetch users:", err);
      if (!silent) {
        await Swal.fire({
          icon: "error",
          title: "Failed to fetch users",
          text: "Please check your connection or backend API and try again.",
          ...swalButtons,
        });
      }
      return false;
    } finally {
      if (showLoader) setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const { data } = await api.get("/roles");
      setRolesList(data.roles || []);
    } catch (err) {
      console.error("Failed to fetch roles:", err);
      await Swal.fire({
        icon: "error",
        title: "Failed to load roles",
        text: "Roles list could not be loaded. Please refresh once.",
        ...swalButtons,
      });
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roleNameBySlug = useMemo(() => {
    return rolesList.reduce((acc, role) => {
      acc[role.slug] = role.name;
      return acc;
    }, {});
  }, [rolesList]);

  const stats = useMemo(() => {
    const assignedRoles = users.reduce((set, user) => {
      (user.roles || []).forEach((role) => set.add(role));
      return set;
    }, new Set());

    return {
      total: users.length,
      filtered: 0,
      roles: assignedRoles.size,
      withoutEmail: users.filter((user) => !user.email).length,
    };
  }, [users]);

  const renderRoleCheckboxes = (selected = []) => {
    if (!rolesList.length) {
      return `
        <div class="roles-empty-state">
          No roles loaded. Please close this popup and refresh roles.
        </div>
      `;
    }

    return rolesList
      .map((role) => {
        const slug = escapeHtml(role.slug);
        const label = escapeHtml(role.name || role.slug);
        const checked = selected.includes(role.slug) ? "checked" : "";

        return `
          <label class="user-role-check" for="role_${slug}">
            <input class="form-check-input" type="checkbox" id="role_${slug}" value="${slug}" ${checked}>
            <span>${label}</span>
          </label>
        `;
      })
      .join("");
  };

  const getSelectedRolesFromDOM = () =>
    Array.from(document.querySelectorAll('input[id^="role_"]:checked'))
      .map((el) => el.value)
      .filter(Boolean);

  const mirrorFirestoreUser = (userId, payload) => {
    (async () => {
      try {
        if (userId) {
          await setDoc(doc(firestore, "users", String(userId)), payload, {
            merge: true,
          });
        } else {
          await addDoc(collection(firestore, "users"), payload);
        }
      } catch (error) {
        console.warn("Firestore mirror skipped:", error?.message || error);
      }
    })();
  };

  const removeFirestoreUser = (userId) => {
    if (!userId) return;

    (async () => {
      try {
        await deleteDoc(doc(firestore, "users", String(userId)));
      } catch (error) {
        console.warn("Firestore delete skipped:", error?.message || error);
      }
    })();
  };

  const openUserForm = async ({ mode = "add", user = null } = {}) => {
    const isEdit = mode === "edit";
    const safeUser = user || {};

    return MySwal.fire({
      title: isEdit ? "Edit User" : "Add New User",
      html: `
        <div class="user-swal-form text-start">
          <div class="user-swal-grid">
            <div>
              <label for="name" class="form-label">Full Name <span>*</span></label>
              <input
                type="text"
                id="name"
                class="form-control"
                value="${escapeHtml(safeUser.name || "")}"
                placeholder="Enter full name"
                autocomplete="off"
              />
            </div>

            <div>
              <label for="username" class="form-label">Username / Admission No. <span>*</span></label>
              <input
                type="text"
                id="username"
                class="form-control"
                value="${escapeHtml(safeUser.username || "")}"
                placeholder="Enter username"
                autocomplete="off"
              />
            </div>
          </div>

          <div class="user-swal-grid">
            <div>
              <label for="email" class="form-label">Email</label>
              <input
                type="email"
                id="email"
                class="form-control"
                value="${escapeHtml(safeUser.email || "")}"
                placeholder="Enter email, optional"
                autocomplete="off"
              />
            </div>

            <div>
              <label for="password" class="form-label">
                ${isEdit ? "New Password" : "Password <span>*</span>"}
              </label>
              <input
                type="password"
                id="password"
                class="form-control"
                placeholder="${isEdit ? "Leave blank if unchanged" : "Enter password"}"
                autocomplete="new-password"
              />
            </div>
          </div>

          <div class="mt-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <label class="form-label mb-0">Assign Roles <span>*</span></label>
              <small class="text-muted">Select one or more</small>
            </div>
            <div id="rolesWrapper" class="user-role-check-grid">
              ${renderRoleCheckboxes(isEdit ? safeUser.roles || [] : ["student"])}
            </div>
          </div>
        </div>
      `,
      width: 760,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: isEdit ? "Save Changes" : "Add User",
      cancelButtonText: "Cancel",
      customClass: {
        popup: "users-swal users-swal--form",
        confirmButton: "users-swal-confirm",
      },
      ...swalButtons,
      didOpen: () => document.getElementById("name")?.focus(),
      preConfirm: () => {
        const name = document.getElementById("name")?.value.trim();
        const username = document.getElementById("username")?.value.trim();
        const email = document.getElementById("email")?.value.trim();
        const password = document.getElementById("password")?.value.trim();
        const roles = getSelectedRolesFromDOM();

        if (!name || !username || (!isEdit && !password)) {
          Swal.showValidationMessage(
            isEdit
              ? "Name and Username are required."
              : "Name, Username and Password are required."
          );
          return false;
        }

        if (!roles.length) {
          Swal.showValidationMessage("Please select at least one role.");
          return false;
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          Swal.showValidationMessage("Please enter a valid email address or leave it empty.");
          return false;
        }

        return {
          userId: safeUser.id,
          name,
          username,
          email,
          roles,
          ...(password && { password }),
        };
      },
    });
  };

  const handleAdd = async () => {
    const { value: formValues } = await openUserForm({ mode: "add" });
    if (!formValues) return;

    try {
      showSaving("Adding user...");

      const { data } = await api.post("/users/register", formValues);
      const backendId = data?.user?.id || data?.id || null;

      mirrorFirestoreUser(backendId, {
        name: formValues.name,
        username: formValues.username,
        email: formValues.email,
        roles: formValues.roles,
        backendUserId: backendId,
        createdAt: serverTimestamp(),
      });

      const refreshed = await fetchUsers({ showLoader: false, silent: true });
      Swal.close();

      await showSuccess(
        "User Added",
        refreshed
          ? "User has been saved and the list is updated."
          : "User has been saved, but the list could not refresh automatically. Please use Refresh."
      );
    } catch (error) {
      console.error("Failed to add user:", error);
      Swal.close();
      await showApiError(error, "Failed to add user");
    }
  };

  const handleEdit = async (user) => {
    const { value: formValues } = await openUserForm({ mode: "edit", user });
    if (!formValues) return;

    try {
      showSaving("Updating user...");

      await api.put(`/users/${formValues.userId}`, {
        name: formValues.name,
        username: formValues.username,
        email: formValues.email,
        roles: formValues.roles,
        ...(formValues.password && { password: formValues.password }),
      });

      mirrorFirestoreUser(formValues.userId, {
        name: formValues.name,
        username: formValues.username,
        email: formValues.email,
        roles: formValues.roles,
        updatedAt: serverTimestamp(),
      });

      const refreshed = await fetchUsers({ showLoader: false, silent: true });
      Swal.close();

      await showSuccess(
        "User Updated",
        refreshed
          ? "User details have been updated successfully."
          : "User details have been updated, but the list could not refresh automatically. Please use Refresh."
      );
    } catch (error) {
      console.error("Failed to update user:", error);
      Swal.close();
      await showApiError(error, "Failed to update user");
    }
  };

  const handleDelete = async (userId, userName = "this user") => {
    const result = await Swal.fire({
      title: `Delete ${userName}?`,
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      customClass: { popup: "users-swal" },
    });

    if (!result.isConfirmed) return;

    try {
      showSaving("Deleting user...");

      await api.delete(`/users/${userId}`);
      removeFirestoreUser(userId);

      const refreshed = await fetchUsers({ showLoader: false, silent: true });
      Swal.close();

      await showSuccess(
        "User Deleted",
        refreshed
          ? `${userName} has been removed from the list.`
          : `${userName} has been deleted, but the list could not refresh automatically. Please use Refresh.`
      );
    } catch (error) {
      console.error("Failed to delete user:", error);
      Swal.close();
      await showApiError(error, "Failed to delete user");
    }
  };

  const filteredUsers = useMemo(() => {
    const query = debouncedSearch.toLowerCase();

    return users.filter((user) => {
      const userText = [user.name || "", user.username || "", user.email || ""]
        .join(" ")
        .toLowerCase();

      const matchesSearch = query ? userText.includes(query) : true;
      const matchesRole = selectedRole ? (user.roles || []).includes(selectedRole) : true;

      return matchesSearch && matchesRole;
    });
  }, [users, debouncedSearch, selectedRole]);

  const visibleStats = useMemo(
    () => ({ ...stats, filtered: filteredUsers.length }),
    [stats, filteredUsers.length]
  );

  const clearFilters = () => {
    setSearch("");
    setSelectedRole("");
  };

  const roleBadgeClass = (slug) => initialRoleStyles[slug] || "user-role--default";

  const renderRoleBadge = (slug) => (
    <span key={slug} className={`user-role-badge ${roleBadgeClass(slug)}`}>
      {roleNameBySlug[slug] || slug}
    </span>
  );

  return (
    <div className="users-page-shell">
      <div className="users-hero-card">
        <div>
          <span className="users-eyebrow">Administration</span>
          <h1>User Management</h1>
          <p>
            Manage staff, students and dashboard access from one clean control panel.
          </p>
        </div>

        <div className="users-hero-actions">
          <button
            type="button"
            className="btn users-refresh-btn"
            onClick={() => fetchUsers({ showLoader: false })}
            disabled={loading || refreshing}
          >
            <i className={`bi bi-arrow-clockwise me-2 ${refreshing ? "users-spin" : ""}`} />
            Refresh
          </button>

          <button
            type="button"
            className="btn users-add-btn"
            onClick={handleAdd}
            disabled={!rolesList.length}
            title={!rolesList.length ? "Roles are still loading" : "Add new user"}
          >
            <i className="bi bi-person-plus-fill me-2" />
            Add User
          </button>
        </div>
      </div>

      <div className="users-stats-grid">
        <div className="users-stat-card">
          <span className="users-stat-icon users-stat-icon--blue">
            <i className="bi bi-people-fill" />
          </span>
          <div>
            <p>Total Users</p>
            <h3>{visibleStats.total}</h3>
          </div>
        </div>

        <div className="users-stat-card">
          <span className="users-stat-icon users-stat-icon--green">
            <i className="bi bi-funnel-fill" />
          </span>
          <div>
            <p>Showing</p>
            <h3>{visibleStats.filtered}</h3>
          </div>
        </div>

        <div className="users-stat-card">
          <span className="users-stat-icon users-stat-icon--purple">
            <i className="bi bi-shield-lock-fill" />
          </span>
          <div>
            <p>Active Roles</p>
            <h3>{visibleStats.roles}</h3>
          </div>
        </div>

        <div className="users-stat-card">
          <span className="users-stat-icon users-stat-icon--orange">
            <i className="bi bi-envelope-exclamation-fill" />
          </span>
          <div>
            <p>No Email</p>
            <h3>{visibleStats.withoutEmail}</h3>
          </div>
        </div>
      </div>

      <div className="users-panel-card">
        <div className="users-toolbar">
          <div className="users-toolbar-title">
            <h2>Users Directory</h2>
            <p>Search, filter, edit roles and update credentials quickly.</p>
          </div>

          <div className="users-filter-row">
            <div className="users-search-box">
              <i className="bi bi-search" />
              <input
                type="text"
                placeholder="Search name, username or email..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search ? (
                <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
                  <i className="bi bi-x-lg" />
                </button>
              ) : null}
            </div>

            <select
              className="users-role-select"
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value)}
            >
              <option value="">All Roles</option>
              {rolesList.map((role) => (
                <option key={role.slug} value={role.slug}>
                  {role.name}
                </option>
              ))}
            </select>

            {(search || selectedRole) && (
              <button type="button" className="btn users-clear-btn" onClick={clearFilters}>
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="users-table-card">
          <div className="table-responsive users-table-wrapper">
            <table className="table users-table align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ width: 72 }}>#</th>
                  <th>User</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Roles</th>
                  <th className="text-end" style={{ width: 160 }}>
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  Array.from({ length: 7 }).map((_, index) => (
                    <tr key={`loading-${index}`}>
                      <td colSpan={6}>
                        <div className="users-skeleton-row" />
                      </td>
                    </tr>
                  ))
                ) : filteredUsers.length ? (
                  filteredUsers.map((user, index) => (
                    <tr key={user.id || user.username || `user-${index}`}>
                      <td>
                        <span className="users-row-number">{index + 1}</span>
                      </td>

                      <td>
                        <div className="users-person-cell">
                          <span className="users-avatar">{getInitials(user.name)}</span>
                          <div>
                            <strong>{user.name || "Unnamed User"}</strong>
                            <small>ID: {user.id || "N/A"}</small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="users-username">{user.username || "N/A"}</span>
                      </td>

                      <td>
                        {user.email ? (
                          <a className="users-email" href={`mailto:${user.email}`}>
                            {user.email}
                          </a>
                        ) : (
                          <span className="users-muted">Not added</span>
                        )}
                      </td>

                      <td>
                        <div className="users-role-list">
                          {(user.roles || []).length ? (
                            user.roles.map(renderRoleBadge)
                          ) : (
                            <span className="users-muted">No role</span>
                          )}
                        </div>
                      </td>

                      <td>
                        <div className="users-action-group">
                          <button
                            type="button"
                            className="users-icon-btn users-icon-btn--edit"
                            onClick={() => handleEdit(user)}
                            title="Edit user"
                          >
                            <i className="bi bi-pencil-square" />
                          </button>

                          <button
                            type="button"
                            className="users-icon-btn users-icon-btn--delete"
                            onClick={() => handleDelete(user.id, user.name || user.username)}
                            title="Delete user"
                          >
                            <i className="bi bi-trash3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <div className="users-empty-state">
                        <span>
                          <i className="bi bi-search" />
                        </span>
                        <h3>No users found</h3>
                        <p>Try changing the search text or role filter.</p>
                        {(search || selectedRole) && (
                          <button type="button" className="btn users-clear-btn" onClick={clearFilters}>
                            Clear Filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {refreshing && !loading ? (
            <div className="users-refresh-overlay">
              <span className="spinner-border spinner-border-sm me-2" />
              Updating list...
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default UserManagement;