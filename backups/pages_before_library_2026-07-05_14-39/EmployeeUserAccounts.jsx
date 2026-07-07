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

const pageLimitDefault = 10;

const wait = (ms = 150) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const getRoleFlags = () => {
  let rawMulti = [];

  try {
    rawMulti = JSON.parse(localStorage.getItem("roles") || "[]");
  } catch {
    rawMulti = [];
  }

  const rawSingle = localStorage.getItem("userRole");

  const multi = Array.isArray(rawMulti)
    ? rawMulti.map((r) => String(r).toLowerCase())
    : [];

  const single = rawSingle ? String(rawSingle).toLowerCase() : null;
  const roles = multi.length ? multi : single ? [single] : [];

  return {
    roles,
    isAdmin: roles.includes("admin"),
    isSuperadmin: roles.includes("superadmin"),
    isHR: roles.includes("hr"),
  };
};

const getApiErrorMessage = (err, fallback = "Something went wrong.") => {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    fallback
  );
};

const EmployeeUserAccounts = () => {
  const { isAdmin, isSuperadmin, isHR } = getRoleFlags();

  // Data
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);

  // UI state
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
  const [refreshing, setRefreshing] = useState(false);

  const canManage = isHR || isAdmin || isSuperadmin;

  const existingUsernames = useMemo(
    () => users.map((u) => String(u.username || "")),
    [users]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim().toLowerCase());
    }, 250);

    return () => clearTimeout(timer);
  }, [search]);

  const deptById = useMemo(() => {
    const map = new Map();

    (departments || []).forEach((dept) => {
      map.set(String(dept.id), dept);
    });

    return map;
  }, [departments]);

  const loadFiltersAndEmployees = useCallback(async () => {
    setLoadingFilters(true);

    try {
      const { data: deptData } = await api.get("/departments");

      const deptArr = Array.isArray(deptData)
        ? deptData
        : Array.isArray(deptData?.departments)
        ? deptData.departments
        : [];

      setDepartments(deptArr);

      const { data: empData } = await api.get("/employees");

      const employees = Array.isArray(empData?.employees)
        ? empData.employees
        : Array.isArray(empData)
        ? empData
        : [];

      const hasAccount = (employee) =>
        Boolean(employee.user_id || employee.userAccount?.id);

      const filteredEmployees = employees
        .filter((employee) => !hasAccount(employee))
        .filter((employee) =>
          employee.status
            ? String(employee.status).toLowerCase() !== "disabled"
            : true
        )
        .sort((a, b) =>
          String(a.name || "").localeCompare(String(b.name || ""))
        );

      setAllEmployees(filteredEmployees);
    } catch (err) {
      console.error("Filter/employee load error:", err);

      await Swal.fire({
        icon: "error",
        title: "Unable to Load Filters",
        text: getApiErrorMessage(
          err,
          "Failed to load departments or employees for the drop-down."
        ),
        confirmButtonText: "OK",
      });
    } finally {
      setLoadingFilters(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);

    try {
      const { data } = await api.get("/users/employees", {
        params: {
          department_id: selectedDept,
          page,
          limit,
        },
      });

      const normalizedUsers = Array.isArray(data?.employees)
        ? data.employees.map((user) => ({
            ...user,
            status: user.status || "active",
            roles: Array.isArray(user.roles)
              ? user.roles.map((role) => String(role).toLowerCase())
              : [],
          }))
        : [];

      setUsers(normalizedUsers);
      setTotalPages(Number(data?.totalPages) || 1);
    } catch (err) {
      console.error("Fetch employee users error:", err);

      await Swal.fire({
        icon: "error",
        title: "Unable to Fetch Users",
        text: getApiErrorMessage(
          err,
          "Failed to fetch employee user accounts."
        ),
        confirmButtonText: "OK",
      });
    } finally {
      setLoadingUsers(false);
    }
  }, [selectedDept, page, limit]);

  useEffect(() => {
    loadFiltersAndEmployees();
  }, [loadFiltersAndEmployees]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRefresh = async () => {
    setRefreshing(true);

    const results = await Promise.allSettled([
      fetchUsers(),
      loadFiltersAndEmployees(),
    ]);

    setRefreshing(false);

    const failed = results.some((result) => result.status === "rejected");

    if (!failed) {
      Swal.fire({
        icon: "success",
        title: "Refreshed",
        text: "Employee user account data has been refreshed.",
        timer: 1400,
        showConfirmButton: false,
      });
    }
  };

  const handleDisable = async (userId, userName) => {
    const { value: reason } = await MySwal.fire({
      title: `Disable ${userName}?`,
      text: "Please provide a reason for disabling this user.",
      input: "textarea",
      inputPlaceholder: "Enter reason...",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Disable User",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#d33",
      inputValidator: (value) => (!value ? "Reason is required." : undefined),
    });

    if (!reason) return;

    try {
      Swal.fire({
        title: "Disabling user...",
        text: "Please wait.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      await api.put(`/users/${userId}/disable`, { reason });

      await fetchUsers();

      await Swal.fire({
        icon: "success",
        title: "User Disabled",
        text: `${userName} has been disabled successfully.`,
        confirmButtonText: "OK",
      });
    } catch (err) {
      console.error("Disable user error:", err);

      await Swal.fire({
        icon: "error",
        title: "User Not Disabled",
        text: getApiErrorMessage(err, "Failed to disable user."),
        confirmButtonText: "OK",
      });
    }
  };

  const handleEnable = async (userId, userName) => {
    const result = await Swal.fire({
      title: `Enable ${userName}?`,
      text: "This user will be allowed to access the system again.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Enable User",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#198754",
    });

    if (!result.isConfirmed) return;

    try {
      Swal.fire({
        title: "Enabling user...",
        text: "Please wait.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      await api.put(`/users/${userId}/enable`);

      await fetchUsers();

      await Swal.fire({
        icon: "success",
        title: "User Enabled",
        text: `${userName} has been restored successfully.`,
        confirmButtonText: "OK",
      });
    } catch (err) {
      console.error("Enable user error:", err);

      await Swal.fire({
        icon: "error",
        title: "User Not Enabled",
        text: getApiErrorMessage(err, "Failed to enable user."),
        confirmButtonText: "OK",
      });
    }
  };

  const handleSaveNew = async (formValues) => {
    const employeeName =
      String(formValues?.name || "").trim() ||
      String(formValues?.username || "").trim() ||
      "Employee";

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

      Swal.fire({
        title: "Creating User Account",
        text: "Please wait while the employee user account is being created.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      const resp = await api.post("/users/register", payload);
      const backendId = resp.data?.user?.id || resp.data?.id;

      /*
        Important:
        Backend user is the source of truth.
        Firestore sync should not block user creation screen.
        If Firestore fails with 400/permission/network issue, user creation still succeeds.
      */
      addDoc(collection(firestore, "users"), {
        ...payload,
        backendId,
        createdAt: serverTimestamp(),
        status: "active",
      }).catch((fsErr) => {
        console.error("Firestore sync error:", fsErr);
      });

      setShowAddModal(false);
      setEditingUser(null);

      Swal.close();

      // Give modal/backdrop small time to close before showing success alert
      await wait(180);

      await Swal.fire({
        icon: "success",
        title: "User Created Successfully",
        html: `
          <div style="text-align:left">
            <p class="mb-2"><b>${employeeName}</b> account has been created.</p>
            <p class="mb-0 text-muted">The employee can now login based on assigned role permissions.</p>
          </div>
        `,
        confirmButtonText: "OK",
        confirmButtonColor: "#198754",
      });

      // Refresh list/dropdowns in background. Do not block success flow.
      Promise.allSettled([fetchUsers(), loadFiltersAndEmployees()]).catch(
        (refreshErr) => {
          console.error("Post-create refresh error:", refreshErr);
        }
      );
    } catch (err) {
      console.error("API registration error:", err);

      Swal.close();

      await wait(120);

      await Swal.fire({
        icon: "error",
        title: "User Not Created",
        html: `
          <div style="text-align:left">
            <p class="mb-2">The employee user account could not be created.</p>
            <p class="mb-0 text-muted">${getApiErrorMessage(
              err,
              "Please check required fields and try again."
            )}</p>
          </div>
        `,
        confirmButtonText: "OK",
        confirmButtonColor: "#d33",
      });
    }
  };

  const handleSaveEdit = async (formValues) => {
    const employeeName =
      String(formValues?.name || "").trim() ||
      String(formValues?.username || "").trim() ||
      "Employee";

    try {
      const payload = {
        ...formValues,
        roles: formValues.roles || [],
      };

      Swal.fire({
        title: "Updating User Account",
        text: "Please wait while the employee user account is being updated.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      await api.put(`/users/${formValues.id}`, payload);

      setShowAddModal(false);
      setEditingUser(null);

      Swal.close();

      await wait(180);

      await fetchUsers();

      await Swal.fire({
        icon: "success",
        title: "User Updated",
        text: `${employeeName} account has been updated successfully.`,
        confirmButtonText: "OK",
        confirmButtonColor: "#198754",
      });
    } catch (err) {
      console.error("API update error:", err);

      Swal.close();

      await wait(120);

      await Swal.fire({
        icon: "error",
        title: "User Not Updated",
        text: getApiErrorMessage(err, "Failed to update user."),
        confirmButtonText: "OK",
        confirmButtonColor: "#d33",
      });
    }
  };

  const filteredUsers = useMemo(() => {
    const query = debouncedSearch;

    return users
      .filter((user) => {
        if (!query) return true;

        return `${user.name || ""} ${user.username || ""} ${user.email || ""}`
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""))
      );
  }, [users, debouncedSearch]);

  const loadedCount = users.length;
  const activeCount = users.filter((user) => user.status === "active").length;
  const disabledCount = users.filter(
    (user) => user.status === "disabled"
  ).length;

  const fromRecord =
    loadingUsers || filteredUsers.length === 0 ? 0 : (page - 1) * limit + 1;

  const toRecord =
    loadingUsers || filteredUsers.length === 0
      ? 0
      : Math.min((page - 1) * limit + filteredUsers.length, page * limit);

  return (
    <div className="container-fluid px-3 px-md-4 my-4">
      {/* Header */}
      <div className="card shadow-sm border-0 mb-3 overflow-hidden">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
            <div>
              <div className="d-flex align-items-center gap-2 mb-2">
                <span className="badge rounded-pill text-bg-primary px-3 py-2">
                  Staff Access
                </span>
                {!canManage && (
                  <span className="badge rounded-pill text-bg-warning px-3 py-2">
                    View Only
                  </span>
                )}
              </div>

              <h2 className="h3 mb-1 fw-bold d-flex align-items-center gap-2">
                <i className="bi bi-people-fill text-primary"></i>
                Employee User Accounts
              </h2>

              <p className="text-muted mb-0">
                Create, update, enable, and disable staff login accounts with
                role-based access.
              </p>
            </div>

            <div className="d-flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary d-flex align-items-center gap-2"
                onClick={handleRefresh}
                disabled={loadingUsers || loadingFilters || refreshing}
              >
                <i
                  className={`bi ${
                    refreshing ? "bi-arrow-repeat" : "bi-arrow-clockwise"
                  }`}
                ></i>
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>

              <button
                type="button"
                className="btn btn-success d-flex align-items-center gap-2"
                onClick={() => {
                  setEditingUser(null);
                  setShowAddModal(true);
                }}
                disabled={!canManage || loadingFilters}
              >
                <i className="bi bi-person-plus-fill"></i>
                Add Employee User
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="row g-3 mb-3">
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted small">Loaded Accounts</div>
                <div className="h4 fw-bold mb-0">{loadedCount}</div>
              </div>
              <div
                className="rounded-circle bg-primary-subtle text-primary d-flex align-items-center justify-content-center"
                style={{ width: 46, height: 46 }}
              >
                <i className="bi bi-person-lines-fill fs-4"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted small">Active Users</div>
                <div className="h4 fw-bold mb-0 text-success">{activeCount}</div>
              </div>
              <div
                className="rounded-circle bg-success-subtle text-success d-flex align-items-center justify-content-center"
                style={{ width: 46, height: 46 }}
              >
                <i className="bi bi-check-circle-fill fs-4"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted small">Disabled Users</div>
                <div className="h4 fw-bold mb-0 text-warning">
                  {disabledCount}
                </div>
              </div>
              <div
                className="rounded-circle bg-warning-subtle text-warning d-flex align-items-center justify-content-center"
                style={{ width: 46, height: 46 }}
              >
                <i className="bi bi-lock-fill fs-4"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!canManage && (
        <div className="alert alert-warning border-0 shadow-sm d-flex align-items-start gap-2">
          <i className="bi bi-shield-lock-fill mt-1"></i>
          <div>
            <div className="fw-semibold">Limited Access</div>
            <div className="small">
              Your current role can view employee user accounts but cannot add,
              edit, enable, or disable users.
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-12 col-md-4">
              <label className="form-label text-muted small mb-1">
                Department
              </label>
              <select
                className="form-select"
                value={selectedDept}
                onChange={(e) => {
                  setSelectedDept(e.target.value);
                  setPage(1);
                }}
                disabled={loadingFilters}
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-md-5">
              <label className="form-label text-muted small mb-1">
                Search
              </label>
              <div className="input-group">
                <span className="input-group-text bg-light border-end-0">
                  <i className="bi bi-search"></i>
                </span>
                <input
                  type="text"
                  className="form-control bg-light border-start-0"
                  placeholder="Search by name, username, or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setSearch("")}
                    title="Clear search"
                  >
                    <i className="bi bi-x-lg"></i>
                  </button>
                )}
              </div>
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label text-muted small mb-1">
                Rows Per Page
              </label>
              <select
                className="form-select"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value) || pageLimitDefault);
                  setPage(1);
                }}
              >
                {[10, 20, 50].map((value) => (
                  <option key={value} value={value}>
                    {value} / page
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card shadow-sm border-0">
        <div className="card-header bg-white border-0 py-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div>
            <div className="fw-bold">Employee Login Accounts</div>
            <div className="small text-muted">
              Showing accounts according to selected department and search
              filter.
            </div>
          </div>

          <span className="badge rounded-pill text-bg-light border px-3 py-2">
            {loadingUsers ? "Loading..." : `${filteredUsers.length} visible`}
          </span>
        </div>

        <div className="table-responsive" style={{ maxHeight: "62vh" }}>
          <table className="table align-middle table-hover mb-0">
            <thead
              className="table-dark"
              style={{ position: "sticky", top: 0, zIndex: 1 }}
            >
              <tr>
                <th style={{ width: 70 }}>#</th>
                <th>Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Department</th>
                <th style={{ width: 140 }}>Status</th>
                <th style={{ width: 230 }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loadingUsers ? (
                [...Array(6)].map((_, index) => (
                  <tr key={`skeleton-${index}`}>
                    <td colSpan={7} className="py-3">
                      <div className="placeholder-glow">
                        <span
                          className="placeholder col-12 rounded"
                          style={{ height: 18 }}
                        ></span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-5">
                    <div className="d-flex flex-column align-items-center gap-2 text-muted">
                      <i className="bi bi-inboxes fs-1"></i>
                      <div className="fw-semibold">No users found</div>
                      <div className="small">
                        Try changing department, search text, or refresh the
                        list.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, index) => {
                  const isDisabled = user.status === "disabled";
                  const departmentName =
                    deptById.get(String(user.department_id))?.name || "N/A";

                  const initials = String(user.name || "?")
                    .split(" ")
                    .filter(Boolean)
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <tr
                      key={user.id}
                      className={isDisabled ? "table-warning" : ""}
                    >
                      <td>{(page - 1) * limit + index + 1}</td>

                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div
                            className={`rounded-circle text-white d-flex align-items-center justify-content-center ${
                              isDisabled ? "bg-secondary" : "bg-primary"
                            }`}
                            style={{
                              width: 40,
                              height: 40,
                              fontWeight: 700,
                              flex: "0 0 auto",
                            }}
                            title={user.name}
                          >
                            {initials || "?"}
                          </div>

                          <div className="min-w-0">
                            <div className="fw-semibold text-truncate">
                              {user.name || "N/A"}
                            </div>

                            {Array.isArray(user.roles) &&
                              user.roles.length > 0 && (
                                <div className="small mt-1">
                                  {user.roles.map((role) => (
                                    <span
                                      key={role}
                                      className="badge text-bg-light border me-1 mb-1"
                                    >
                                      <i className="bi bi-shield-lock me-1"></i>
                                      {role}
                                    </span>
                                  ))}
                                </div>
                              )}
                          </div>
                        </div>
                      </td>

                      <td className="text-muted">{user.username || "N/A"}</td>
                      <td className="text-muted">{user.email || "N/A"}</td>
                      <td>{departmentName}</td>

                      <td>
                        <span
                          className={`badge rounded-pill px-3 py-2 ${
                            isDisabled ? "text-bg-warning" : "text-bg-success"
                          }`}
                        >
                          <i
                            className={`bi ${
                              isDisabled ? "bi-lock-fill" : "bi-check-circle"
                            } me-1`}
                          ></i>
                          {isDisabled ? "Disabled" : "Active"}
                        </span>
                      </td>

                      <td>
                        <div className="d-flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                              setEditingUser(user);
                              setShowAddModal(true);
                            }}
                            disabled={!canManage}
                            title="Edit user"
                          >
                            <i className="bi bi-pencil-square me-1"></i>
                            Edit
                          </button>

                          {!isDisabled ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-warning"
                              onClick={() =>
                                handleDisable(user.id, user.name || "User")
                              }
                              disabled={!canManage}
                              title="Disable user"
                            >
                              <i className="bi bi-lock me-1"></i>
                              Disable
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-success"
                              onClick={() =>
                                handleEnable(user.id, user.name || "User")
                              }
                              disabled={!canManage}
                              title="Enable user"
                            >
                              <i className="bi bi-unlock me-1"></i>
                              Enable
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="card-footer bg-white d-flex flex-wrap justify-content-between align-items-center gap-2 py-3">
          <div className="text-muted small">
            {loadingUsers
              ? "Loading records..."
              : filteredUsers.length === 0
              ? "No records to show"
              : `Showing ${fromRecord}–${toRecord}`}
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={page <= 1 || loadingUsers}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              <i className="bi bi-chevron-left"></i>
              Prev
            </button>

            <span className="small text-muted">
              Page <b>{page}</b> of <b>{totalPages}</b>
            </span>

            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={page >= totalPages || loadingUsers}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Next
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
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