// src/pages/RolePermissions.js
import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import api from "../api";

const RolePermissions = () => {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedPermissionIds, setSelectedPermissionIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const selectedRole = useMemo(
    () => roles.find((r) => String(r.id) === String(selectedRoleId)) || null,
    [roles, selectedRoleId]
  );

  const groupedPermissions = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = permissions.filter((p) => {
      if (!q) return true;
      return (
        String(p.name || "").toLowerCase().includes(q) ||
        String(p.slug || "").toLowerCase().includes(q) ||
        String(p.module || "").toLowerCase().includes(q)
      );
    });

    return filtered.reduce((acc, perm) => {
      const moduleName = perm.module || "other";
      if (!acc[moduleName]) acc[moduleName] = [];
      acc[moduleName].push(perm);
      return acc;
    }, {});
  }, [permissions, search]);

  const allVisiblePermissionIds = useMemo(() => {
    return Object.values(groupedPermissions)
      .flat()
      .map((p) => p.id);
  }, [groupedPermissions]);

  const fetchRoles = async () => {
    try {
      const { data } = await api.get("/roles");
      const list = Array.isArray(data) ? data : data?.roles || [];
      setRoles(list);

      if (!selectedRoleId && list.length) {
        setSelectedRoleId(String(list[0].id));
      }
    } catch (err) {
      console.error("fetchRoles error:", err);
      Swal.fire("Error", "Failed to load roles", "error");
    }
  };

  const fetchPermissions = async () => {
    try {
      const { data } = await api.get("/permissions");
      const list = Array.isArray(data) ? data : data?.permissions || [];
      setPermissions(list);
    } catch (err) {
      console.error("fetchPermissions error:", err);
      Swal.fire("Error", "Failed to load permissions", "error");
    }
  };

  const fetchRolePermissions = async (roleId) => {
    if (!roleId) {
      setSelectedPermissionIds([]);
      return;
    }

    try {
      setLoading(true);
      const { data } = await api.get(`/roles/${roleId}/permissions`);

      const assigned =
        data?.permissionIds ||
        data?.permissions?.map((p) => p.id) ||
        [];

      setSelectedPermissionIds(assigned.map((id) => Number(id)));
    } catch (err) {
      console.error("fetchRolePermissions error:", err);
      Swal.fire("Error", "Failed to load role permissions", "error");
      setSelectedPermissionIds([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedRoleId) {
      fetchRolePermissions(selectedRoleId);
    }
  }, [selectedRoleId]);

  const isChecked = (permissionId) =>
    selectedPermissionIds.includes(Number(permissionId));

  const togglePermission = (permissionId) => {
    const id = Number(permissionId);
    setSelectedPermissionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllVisible = () => {
    setSelectedPermissionIds((prev) => {
      const merged = new Set([...prev, ...allVisiblePermissionIds.map(Number)]);
      return Array.from(merged);
    });
  };

  const clearAllVisible = () => {
    const visibleSet = new Set(allVisiblePermissionIds.map(Number));
    setSelectedPermissionIds((prev) =>
      prev.filter((id) => !visibleSet.has(Number(id)))
    );
  };

  const selectModule = (moduleName) => {
    const moduleIds = (groupedPermissions[moduleName] || []).map((p) => Number(p.id));
    setSelectedPermissionIds((prev) => {
      const merged = new Set([...prev, ...moduleIds]);
      return Array.from(merged);
    });
  };

  const clearModule = (moduleName) => {
    const moduleSet = new Set(
      (groupedPermissions[moduleName] || []).map((p) => Number(p.id))
    );
    setSelectedPermissionIds((prev) =>
      prev.filter((id) => !moduleSet.has(Number(id)))
    );
  };

  const handleSave = async () => {
    if (!selectedRoleId) {
      Swal.fire("Warning", "Please select a role first", "warning");
      return;
    }

    try {
      setSaving(true);

      await api.put(`/roles/${selectedRoleId}/permissions`, {
        permissionIds: selectedPermissionIds,
      });

      Swal.fire("Success", "Role permissions updated successfully", "success");
      fetchRolePermissions(selectedRoleId);
    } catch (err) {
      console.error("handleSave error:", err);
      Swal.fire(
        "Error",
        err.response?.data?.message || "Failed to save role permissions",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const moduleCards = Object.keys(groupedPermissions).sort();

  return (
    <div className="container-fluid py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h3 className="mb-1">Role Permission Management</h3>
          <p className="text-muted mb-0">
            Assign module permissions to each role.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={!selectedRoleId || saving}
        >
          {saving ? "Saving..." : "Save Permissions"}
        </button>
      </div>

      <div className="row g-4">
        <div className="col-lg-3">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body">
              <h5 className="mb-3">Roles</h5>

              <div className="list-group">
                {roles.map((role) => {
                  const active = String(role.id) === String(selectedRoleId);
                  return (
                    <button
                      key={role.id}
                      type="button"
                      className={`list-group-item list-group-item-action text-start ${
                        active ? "active" : ""
                      }`}
                      onClick={() => setSelectedRoleId(String(role.id))}
                    >
                      <div className="fw-semibold">
                        {role.name || role.slug || `Role #${role.id}`}
                      </div>
                      {role.slug && (
                        <small className={active ? "text-white-50" : "text-muted"}>
                          {role.slug}
                        </small>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-9">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                <div>
                  <h5 className="mb-1">
                    {selectedRole
                      ? `Permissions for ${selectedRole.name || selectedRole.slug}`
                      : "Select a role"}
                  </h5>
                  <small className="text-muted">
                    Total selected: {selectedPermissionIds.length}
                  </small>
                </div>

                <div className="d-flex flex-wrap gap-2">
                  <input
                    type="text"
                    className="form-control"
                    style={{ minWidth: 260 }}
                    placeholder="Search permission..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-success"
                    onClick={selectAllVisible}
                    disabled={!selectedRoleId || loading}
                  >
                    Select Visible
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={clearAllVisible}
                    disabled={!selectedRoleId || loading}
                  >
                    Clear Visible
                  </button>
                </div>
              </div>

              {!selectedRoleId ? (
                <div className="alert alert-info mb-0">
                  Please select a role from the left side.
                </div>
              ) : loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border" role="status" />
                  <div className="mt-2 text-muted">Loading permissions...</div>
                </div>
              ) : moduleCards.length === 0 ? (
                <div className="alert alert-warning mb-0">
                  No permissions found.
                </div>
              ) : (
                <div className="row g-3">
                  {moduleCards.map((moduleName) => {
                    const modulePerms = groupedPermissions[moduleName] || [];
                    const selectedInModule = modulePerms.filter((p) =>
                      selectedPermissionIds.includes(Number(p.id))
                    ).length;

                    return (
                      <div className="col-12" key={moduleName}>
                        <div className="border rounded-3 p-3">
                          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                            <div>
                              <h6 className="mb-1 text-capitalize">{moduleName}</h6>
                              <small className="text-muted">
                                {selectedInModule} / {modulePerms.length} selected
                              </small>
                            </div>

                            <div className="d-flex gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-success"
                                onClick={() => selectModule(moduleName)}
                              >
                                Select All
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => clearModule(moduleName)}
                              >
                                Clear
                              </button>
                            </div>
                          </div>

                          <div className="row g-2">
                            {modulePerms.map((perm) => (
                              <div className="col-md-6 col-xl-4" key={perm.id}>
                                <label className="form-check border rounded-3 p-3 h-100 d-flex gap-2 align-items-start">
                                  <input
                                    className="form-check-input mt-1"
                                    type="checkbox"
                                    checked={isChecked(perm.id)}
                                    onChange={() => togglePermission(perm.id)}
                                  />
                                  <span>
                                    <div className="fw-semibold">
                                      {perm.name || perm.slug}
                                    </div>
                                    <small className="text-muted d-block">
                                      {perm.slug}
                                    </small>
                                  </span>
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 d-flex justify-content-end">
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={!selectedRoleId || saving}
                >
                  {saving ? "Saving..." : "Save Permissions"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RolePermissions;