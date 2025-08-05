import React, { useEffect, useState, useMemo } from "react";
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

const EmployeeUserAccounts = () => {
  const { isAdmin, isSuperadmin, isHR } = getRoleFlags();

  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const existingUsernames = useMemo(
    () => users.map((u) => String(u.username)),
    [users]
  );

  useEffect(() => {
    const loadFiltersAndEmployees = async () => {
      try {
        const { data: deptData } = await api.get("/departments");
        if (Array.isArray(deptData)) {
          setDepartments(deptData);
        } else if (Array.isArray(deptData.departments)) {
          setDepartments(deptData.departments);
        }

        const { data: empData } = await api.get("/employees");
        const filtered = empData.employees?.filter((e) => !e.userAccount) || [];
        setAllEmployees(filtered);
      } catch (err) {
        console.error(err);
        Swal.fire("Error", "Failed to load filters or employees.", "error");
      }
    };
    loadFiltersAndEmployees();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data } = await api.get("/users/employees", {
        params: { department_id: selectedDept, page, limit: 10 },
      });
      setUsers(
        (data.employees || []).map((u) => ({
          ...u,
          status: u.status || "active",
          roles: Array.isArray(u.roles) ? u.roles.map((r) => String(r).toLowerCase()) : [],
        }))
      );
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to fetch employees.", "error");
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [selectedDept, page]);

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
      const backendId = resp.data.user?.id || resp.data.id;

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

  const filteredUsers = useMemo(
    () =>
      users
        .filter((u) =>
          `${u.name} ${u.username} ${u.email}`.toLowerCase().includes(search.toLowerCase())
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [users, search]
  );

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="text-primary">Employee User Accounts</h1>
        <button
          className="btn btn-success"
          onClick={() => {
            setShowAddModal(true);
            setEditingUser(null);
          }}
          disabled={!isHR && !isAdmin && !isSuperadmin}
        >
          + Add Employee
        </button>
      </div>

      <div className="d-flex gap-2 mb-3">
        <select
          className="form-select"
          value={selectedDept}
          onChange={(e) => {
            setSelectedDept(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <input
          type="text"
          className="form-control"
          placeholder="Search employees..."
          style={{ maxWidth: "300px" }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <table className="table table-hover shadow-sm">
        <thead className="table-dark">
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Username</th>
            <th>Email</th>
            <th>Department</th>
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
              <td>{departments.find((d) => d.id === u.department_id)?.name || "N/A"}</td>
              <td>
                <span className={`badge ${u.status === "active" ? "bg-success" : "bg-warning"}`}>{u.status}</span>
              </td>
              <td>
                <button
                  className="btn btn-sm btn-primary me-1"
                  onClick={() => {
                    setEditingUser(u);
                    setShowAddModal(true);
                  }}
                  disabled={!isHR && !isAdmin && !isSuperadmin}
                >
                  <i className="bi bi-pencil"></i> Edit
                </button>

                {u.status === "active" ? (
                  <button
                    className="btn btn-sm btn-warning"
                    onClick={() => handleDisable(u.id, u.name)}
                    disabled={!isHR && !isAdmin && !isSuperadmin}
                  >
                    <i className="bi bi-lock"></i> Disable
                  </button>
                ) : (
                  <button
                    className="btn btn-sm btn-success"
                    onClick={() => handleEnable(u.id, u.name)}
                    disabled={!isHR && !isAdmin && !isSuperadmin}
                  >
                    <i className="bi bi-unlock"></i> Enable
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="d-flex justify-content-between align-items-center">
        <div>
          <button className="btn btn-sm btn-secondary me-2" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
          <button className="btn btn-sm btn-secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
        <span>Page {page} of {totalPages}</span>
      </div>

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
