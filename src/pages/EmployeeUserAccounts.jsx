// File: src/pages/EmployeeUserAccounts.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import api from "../api";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import "./Users.css";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { firestore } from "../firebase/firebaseConfig.js";
import AddEmployeeModal from "../components/AddEmployeeModal";

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
    isHR: roles.includes("hr"),
  };
};

const pageLimitDefault = 10;

const EmployeeUserAccounts = () => {
  const { isAdmin, isSuperadmin, isHR } = getRoleFlags();

  // data
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);

  // ui state
  const [selectedDept, setSelectedDept] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(pageLimitDefault);
  const [totalPages, setTotalPages] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const existingUsernames = useMemo(
    () => users.map((u) => String(u.username)),
    [users]
  );

  // Debounce search (nice UX)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Department map for quick lookup
  const deptById = useMemo(() => {
    const m = new Map();
    (departments || []).forEach((d) => m.set(d.id, d));
    return m;
  }, [departments]);

  const loadFiltersAndEmployees = useCallback(async () => {
    setLoadingFilters(true);
    try {
      // Departments
      const { data: deptData } = await api.get("/departments");
      const deptArr = Array.isArray(deptData)
        ? deptData
        : Array.isArray(deptData?.departments)
        ? deptData.departments
        : [];
      setDepartments(deptArr);

      // Employees for drop-down (only those without user accounts)
      const { data: empData } = await api.get("/employees");
      const employees = Array.isArray(empData?.employees) ? empData.employees : [];
      const hasAccount = (e) => Boolean(e.user_id || e.userAccount?.id);
      const filtered = employees
        .filter((e) => !hasAccount(e))
        .filter((e) => (e.status ? String(e.status).toLowerCase() !== "disabled" : true))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
      setAllEmployees(filtered);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to load departments or employees for the drop-down.", "error");
    } finally {
      setLoadingFilters(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const { data } = await api.get("/users/employees", {
        params: { department_id: selectedDept, page, limit },
      });

      const normalized = (data?.employees || []).map((u) => ({
        ...u,
        status: u.status || "active",
        roles: Array.isArray(u.roles) ? u.roles.map((r) => String(r).toLowerCase()) : [],
      }));

      setUsers(normalized);
      setTotalPages(Number(data?.totalPages) || 1);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to fetch employee user accounts.", "error");
    } finally {
      setLoadingUsers(false);
    }
  }, [selectedDept, page, limit]);

  // initial load
  useEffect(() => {
    loadFiltersAndEmployees();
  }, [loadFiltersAndEmployees]);

  // users fetch on filters/page/limit change
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDisable = async (userId, userName) => {
    const { value: reason } = await MySwal.fire({
      title: `Disable ${userName}?`,
      text: "Please provide a reason for disabling this user.",
      input: "textarea",
      inputPlaceholder: "Enter reason...",
      showCancelButton: true,
      confirmButtonText: "Disable",
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

  const handleEnable = async (userId, userName) => {
    const result = await Swal.fire({
      title: `Enable ${userName}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Enable",
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

  const handleSaveNew = async (formValues) => {
    try {
      const payload = {
        ...formValues,
        roles: formValues.roles || [],
      };

      if (formValues.employee_id) {
        payload.employee_id = formValues.employee_id;
      } else {
        delete payload.employee_id;
      }

      const resp = await api.post("/users/register", payload);
      const backendId = resp.data?.user?.id || resp.data?.id;

      // Firestore sync (best-effort)
      try {
        await addDoc(collection(firestore, "users"), {
          ...payload,
          backendId,
          createdAt: serverTimestamp(),
          status: "active",
        });
      } catch (fsErr) {
        console.error("Firestore sync error:", fsErr);
        Swal.fire("Warning", "User registered but failed to sync with Firestore.", "warning");
      }

      Swal.fire("Success!", `${formValues.name} has been added.`, "success");
      fetchUsers();
      setShowAddModal(false);
    } catch (err) {
      console.error("API registration error:", err);
      const apiMsg = err.response?.data?.message || err.response?.data?.error;
      Swal.fire("Error", apiMsg || "Failed to add user.", "error");
    }
  };

  const handleSaveEdit = async (formValues) => {
    try {
      const payload = {
        ...formValues,
        roles: formValues.roles || [],
      };

      await api.put(`/users/${formValues.id}`, payload);

      Swal.fire("Updated!", `${formValues.name} has been updated.`, "success");
      fetchUsers();
      setShowAddModal(false);
      setEditingUser(null);
    } catch (err) {
      console.error("API update error:", err);
      const apiMsg = err.response?.data?.message || err.response?.data?.error;
      Swal.fire("Error", apiMsg || "Failed to update user.", "error");
    }
  };

  const filteredUsers = useMemo(() => {
    const q = debouncedSearch;
    return users
      .filter((u) => `${u.name} ${u.username} ${u.email}`.toLowerCase().includes(q))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [users, debouncedSearch]);

  const canManage = isHR || isAdmin || isSuperadmin;

  return (
    <div className="container my-4">
      {/* Header Card */}
      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <h2 className="h4 mb-1 d-flex align-items-center gap-2">
              <i className="bi bi-people-fill"></i>
              Employee User Accounts
            </h2>
            <div className="text-muted small">
              Manage login access for staff. Create accounts only for employees who don’t already have one.
            </div>
          </div>
          <button
            className="btn btn-success d-flex align-items-center gap-2"
            onClick={() => {
              setShowAddModal(true);
              setEditingUser(null);
            }}
            disabled={!canManage || loadingFilters}
          >
            <i className="bi bi-person-plus-fill"></i>
            Add Employee
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body d-flex flex-wrap gap-2 align-items-center">
          <div className="d-flex align-items-center gap-2">
            <label className="text-muted small mb-0">Department</label>
            <select
              className="form-select"
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setPage(1);
              }}
              style={{ minWidth: 220 }}
              disabled={loadingFilters}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="ms-auto d-flex flex-wrap gap-2">
            <div className="input-group" style={{ minWidth: 280 }}>
              <span className="input-group-text border-0 bg-light">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control border-0 bg-light"
                placeholder="Search name, username, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className="form-select"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value) || pageLimitDefault);
                setPage(1);
              }}
              title="Rows per page"
              style={{ width: 120 }}
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card shadow-sm border-0">
        <div className="table-responsive" style={{ maxHeight: "62vh" }}>
          <table className="table align-middle table-hover mb-0">
            <thead className="table-dark" style={{ position: "sticky", top: 0, zIndex: 1 }}>
              <tr>
                <th style={{ width: 60 }}>#</th>
                <th>Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Department</th>
                <th style={{ width: 140 }}>Status</th>
                <th style={{ width: 220 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingUsers ? (
                // Loading rows
                [...Array(5)].map((_, i) => (
                  <tr key={`skeleton-${i}`}>
                    <td colSpan={7}>
                      <div className="placeholder-glow">
                        <span className="placeholder col-12" style={{ height: 18 }}></span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-5">
                    <div className="text-muted">
                      <i className="bi bi-inboxes"></i> No users found for the selected filters.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, idx) => (
                  <tr key={u.id} className={u.status === "disabled" ? "table-warning" : ""}>
                    <td>{(page - 1) * limit + idx + 1}</td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <div
                          className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center"
                          style={{ width: 36, height: 36, fontWeight: 600 }}
                          title={u.name}
                        >
                          {String(u.name || "?")
                            .split(" ")
                            .map((p) => p[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <div className="fw-semibold">{u.name}</div>
                          {/* roles chip(s) */}
                          {Array.isArray(u.roles) && u.roles.length > 0 && (
                            <div className="small">
                              {u.roles.map((r) => (
                                <span key={r} className="badge text-bg-light border me-1">
                                  <i className="bi bi-shield-lock me-1"></i>
                                  {r}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-muted">{u.username}</td>
                    <td className="text-muted">{u.email || "N/A"}</td>
                    <td>{deptById.get(u.department_id)?.name || "N/A"}</td>
                    <td>
                      <span
                        className={`badge rounded-pill ${
                          u.status === "active" ? "text-bg-success" : "text-bg-warning"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td>
                      <div className="d-flex flex-wrap gap-2">
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => {
                            setEditingUser(u);
                            setShowAddModal(true);
                          }}
                          disabled={!canManage}
                          title="Edit user"
                        >
                          <i className="bi bi-pencil"></i> Edit
                        </button>

                        {u.status === "active" ? (
                          <button
                            className="btn btn-sm btn-outline-warning"
                            onClick={() => handleDisable(u.id, u.name)}
                            disabled={!canManage}
                            title="Disable user"
                          >
                            <i className="bi bi-lock"></i> Disable
                          </button>
                        ) : (
                          <button
                            className="btn btn-sm btn-outline-success"
                            onClick={() => handleEnable(u.id, u.name)}
                            disabled={!canManage}
                            title="Enable user"
                          >
                            <i className="bi bi-unlock"></i> Enable
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination */}
        <div className="card-footer d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div className="text-muted small">
            Showing{" "}
            {loadingUsers
              ? "—"
              : `${(page - 1) * limit + 1}–${Math.min(page * limit, filteredUsers.length + (page - 1) * limit)}`
            }
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              className="btn btn-sm btn-secondary"
              disabled={page <= 1 || loadingUsers}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <i className="bi bi-chevron-left"></i> Prev
            </button>
            <span className="small">
              Page {page} of {totalPages}
            </span>
            <button
              className="btn btn-sm btn-secondary"
              disabled={page >= totalPages || loadingUsers}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <i className="bi bi-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      <AddEmployeeModal
        show={showAddModal}
        onHide={() => {
          setShowAddModal(false);
          setEditingUser(null);
        }}
        employees={allEmployees}
        existingUsernames={existingUsernames}
        onSave={editingUser ? handleSaveEdit : handleSaveNew}
        editingUser={editingUser}
      />
    </div>
  );
};

export default EmployeeUserAccounts;
