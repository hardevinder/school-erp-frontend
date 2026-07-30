import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./Transportation.css";

const blankForm = {
  route_name: "",
  route_code: "",
  description: "",
  active: true,
};

const getRoles = () => {
  try {
    const many = JSON.parse(localStorage.getItem("roles") || "[]");
    const one = localStorage.getItem("userRole");
    return (many.length ? many : [one]).filter(Boolean).map((role) => String(role).toLowerCase());
  } catch {
    return [localStorage.getItem("userRole")].filter(Boolean);
  }
};

export default function ActualRoutes() {
  const roles = useMemo(getRoles, []);
  const canManage = roles.some((role) =>
    ["transport", "admin", "superadmin"].includes(role),
  );
  const [routes, setRoutes] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadRoutes = async () => {
    setLoading(true);
    try {
      const response = await api.get("/bus-operational-routes?include_inactive=1");
      setRoutes(Array.isArray(response.data?.routes) ? response.data.routes : []);
    } catch (error) {
      Swal.fire("Unable to Load", error?.response?.data?.error || "Failed to load actual routes.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoutes();
  }, []);

  const visibleRoutes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return routes;
    return routes.filter((route) =>
      [route.route_name, route.route_code, route.description]
        .some((value) => String(value || "").toLowerCase().includes(term)),
    );
  }, [routes, search]);

  const resetForm = () => {
    setEditingId(null);
    setForm(blankForm);
  };

  const editRoute = (route) => {
    setEditingId(route.id);
    setForm({
      route_name: route.route_name || "",
      route_code: route.route_code || "",
      description: route.description || "",
      active: Boolean(route.active),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveRoute = async (event) => {
    event.preventDefault();
    if (!form.route_name.trim()) {
      Swal.fire("Route Name Required", "Enter a name for the actual route.", "warning");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        route_name: form.route_name.trim(),
        route_code: form.route_code.trim() || null,
        description: form.description.trim() || null,
        active: form.active,
      };
      if (editingId) {
        await api.put(`/bus-operational-routes/${editingId}`, payload);
      } else {
        await api.post("/bus-operational-routes", payload);
      }
      await loadRoutes();
      resetForm();
      Swal.fire("Saved", `Actual route ${editingId ? "updated" : "created"} successfully.`, "success");
    } catch (error) {
      Swal.fire("Unable to Save", error?.response?.data?.error || "Failed to save actual route.", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (route) => {
    try {
      await api.put(`/bus-operational-routes/${route.id}`, { active: !route.active });
      await loadRoutes();
    } catch (error) {
      Swal.fire("Unable to Update", error?.response?.data?.error || "Failed to update route status.", "error");
    }
  };

  const deleteRoute = async (route) => {
    const confirmation = await Swal.fire({
      title: "Delete actual route?",
      text: route.route_name,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      confirmButtonColor: "#dc3545",
    });
    if (!confirmation.isConfirmed) return;
    try {
      await api.delete(`/bus-operational-routes/${route.id}`);
      if (editingId === route.id) resetForm();
      await loadRoutes();
      Swal.fire("Deleted", "Actual route deleted successfully.", "success");
    } catch (error) {
      Swal.fire("Unable to Delete", error?.response?.data?.error || "Failed to delete actual route.", "error");
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
        <div>
          <h3 className="mb-1">Actual Routes</h3>
          <p className="text-muted mb-0">Manage the operational routes used for student pickup and drop assignments.</p>
        </div>
        <button className="btn btn-outline-secondary" onClick={loadRoutes} disabled={loading}>
          <i className="bi bi-arrow-clockwise me-2" />Refresh
        </button>
      </div>

      {canManage && (
        <div className="card shadow-sm border-0 mb-4">
          <div className="card-body">
            <h5 className="card-title mb-3">{editingId ? "Edit Actual Route" : "Add Actual Route"}</h5>
            <form onSubmit={saveRoute}>
              <div className="row g-3">
                <div className="col-md-5">
                  <label className="form-label">Route Name *</label>
                  <input className="form-control" maxLength={150} value={form.route_name}
                    onChange={(e) => setForm({ ...form, route_name: e.target.value })} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Route Code</label>
                  <input className="form-control" maxLength={50} value={form.route_code}
                    onChange={(e) => setForm({ ...form, route_code: e.target.value })} />
                </div>
                <div className="col-md-4 d-flex align-items-end">
                  <div className="form-check form-switch mb-2">
                    <input className="form-check-input" type="checkbox" id="actualRouteActive"
                      checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                    <label className="form-check-label" htmlFor="actualRouteActive">Active</label>
                  </div>
                </div>
                <div className="col-12">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" rows="2" maxLength={500} value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="col-12 d-flex gap-2">
                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    {saving ? "Saving…" : editingId ? "Update Route" : "Create Route"}
                  </button>
                  {editingId && <button className="btn btn-outline-secondary" type="button" onClick={resetForm}>Cancel</button>}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card shadow-sm border-0">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <h5 className="mb-0">All Actual Routes ({visibleRoutes.length})</h5>
            <input className="form-control" style={{ maxWidth: 320 }} placeholder="Search routes…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead><tr><th>Name</th><th>Code</th><th>Description</th><th>Status</th>{canManage && <th className="text-end">Actions</th>}</tr></thead>
              <tbody>
                {visibleRoutes.map((route) => (
                  <tr key={route.id}>
                    <td className="fw-semibold">{route.route_name}</td>
                    <td>{route.route_code || "—"}</td>
                    <td>{route.description || "—"}</td>
                    <td><span className={`badge ${route.active ? "text-bg-success" : "text-bg-secondary"}`}>{route.active ? "Active" : "Inactive"}</span></td>
                    {canManage && <td className="text-end text-nowrap">
                      <button className="btn btn-sm btn-outline-primary me-2" onClick={() => editRoute(route)}>Edit</button>
                      <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => toggleStatus(route)}>{route.active ? "Deactivate" : "Activate"}</button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => deleteRoute(route)}>Delete</button>
                    </td>}
                  </tr>
                ))}
                {!loading && visibleRoutes.length === 0 && <tr><td colSpan={canManage ? 5 : 4} className="text-center text-muted py-4">No actual routes found.</td></tr>}
                {loading && <tr><td colSpan={canManage ? 5 : 4} className="text-center text-muted py-4">Loading…</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
