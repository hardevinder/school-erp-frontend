import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./Transportation.css";

const blankForm = { route_name: "", route_code: "", description: "", active: true };
const blankStop = {
  stop_name: "",
  address: "",
  latitude: "",
  longitude: "",
  pickup_time: "",
  drop_time: "",
  notification_radius_meters: 1500,
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

const timeLabel = (value) => {
  if (!value) return "—";
  const text = String(value).slice(0, 5);
  const [hh, mm] = text.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return text;
  const hour = hh % 12 || 12;
  return `${hour}:${String(mm).padStart(2, "0")} ${hh >= 12 ? "PM" : "AM"}`;
};

export default function ActualRoutes() {
  const roles = useMemo(getRoles, []);
  const canManage = roles.some((role) => ["transport", "admin", "superadmin"].includes(role));
  const [routes, setRoutes] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [stops, setStops] = useState([]);
  const [usage, setUsage] = useState({ students: 0, employees: 0, total: 0 });
  const [stopForm, setStopForm] = useState(blankStop);
  const [editingStopId, setEditingStopId] = useState(null);
  const [stopSaving, setStopSaving] = useState(false);
  const [stopsLoading, setStopsLoading] = useState(false);

  const selectedRoute = useMemo(
    () => routes.find((route) => Number(route.id) === Number(selectedRouteId)) || null,
    [routes, selectedRouteId],
  );

  const loadRoutes = async () => {
    setLoading(true);
    try {
      const response = await api.get("/bus-operational-routes?include_inactive=1&include_inactive_stops=1");
      const rows = Array.isArray(response.data?.routes) ? response.data.routes : [];
      setRoutes(rows);
      if (selectedRouteId && !rows.some((r) => Number(r.id) === Number(selectedRouteId))) {
        setSelectedRouteId(null);
      }
    } catch (error) {
      Swal.fire("Unable to Load", error?.response?.data?.error || "Failed to load actual routes.", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadStops = async (routeId) => {
    if (!routeId) return;
    setStopsLoading(true);
    try {
      const response = await api.get(`/bus-operational-routes/${routeId}/stops?include_inactive=1`);
      setStops(Array.isArray(response.data?.stops) ? response.data.stops : []);
      setUsage(response.data?.usage || { students: 0, employees: 0, total: 0 });
    } catch (error) {
      Swal.fire("Unable to Load Stops", error?.response?.data?.error || "Failed to load route stops.", "error");
    } finally {
      setStopsLoading(false);
    }
  };

  useEffect(() => { loadRoutes(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (selectedRouteId) loadStops(selectedRouteId); }, [selectedRouteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleRoutes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return routes;
    return routes.filter((route) => [route.route_name, route.route_code, route.description]
      .some((value) => String(value || "").toLowerCase().includes(term)));
  }, [routes, search]);

  const resetForm = () => { setEditingId(null); setForm(blankForm); };
  const resetStopForm = () => { setEditingStopId(null); setStopForm(blankStop); };

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
      const response = editingId
        ? await api.put(`/bus-operational-routes/${editingId}`, payload)
        : await api.post("/bus-operational-routes", payload);
      await loadRoutes();
      if (!editingId && response.data?.route?.id) setSelectedRouteId(response.data.route.id);
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
      text: `${route.route_name}. All stops under this route will also be removed.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      confirmButtonColor: "#dc3545",
    });
    if (!confirmation.isConfirmed) return;
    try {
      await api.delete(`/bus-operational-routes/${route.id}`);
      if (editingId === route.id) resetForm();
      if (Number(selectedRouteId) === Number(route.id)) setSelectedRouteId(null);
      await loadRoutes();
      Swal.fire("Deleted", "Actual route deleted successfully.", "success");
    } catch (error) {
      Swal.fire("Unable to Delete", error?.response?.data?.error || "Failed to delete actual route.", "error");
    }
  };

  const editStop = (stop) => {
    setEditingStopId(stop.id);
    setStopForm({
      stop_name: stop.stop_name || "",
      address: stop.address || "",
      latitude: stop.latitude ?? "",
      longitude: stop.longitude ?? "",
      pickup_time: stop.pickup_time ? String(stop.pickup_time).slice(0, 5) : "",
      drop_time: stop.drop_time ? String(stop.drop_time).slice(0, 5) : "",
      notification_radius_meters: stop.notification_radius_meters || 1500,
      active: Boolean(stop.active),
    });
  };

  const saveStop = async (event) => {
    event.preventDefault();
    if (!selectedRouteId || !stopForm.stop_name.trim()) {
      Swal.fire("Stop Name Required", "Enter a stop name first.", "warning");
      return;
    }
    setStopSaving(true);
    try {
      const payload = {
        ...stopForm,
        stop_name: stopForm.stop_name.trim(),
        address: stopForm.address.trim() || null,
        latitude: stopForm.latitude === "" ? null : Number(stopForm.latitude),
        longitude: stopForm.longitude === "" ? null : Number(stopForm.longitude),
        pickup_time: stopForm.pickup_time || null,
        drop_time: stopForm.drop_time || null,
        notification_radius_meters: Number(stopForm.notification_radius_meters || 1500),
        sequence: editingStopId
          ? (stops.find((s) => Number(s.id) === Number(editingStopId))?.sequence || 1)
          : (stops.length ? Math.max(...stops.map((s) => Number(s.sequence) || 0)) + 1 : 1),
      };
      if (editingStopId) {
        await api.put(`/bus-operational-routes/${selectedRouteId}/stops/${editingStopId}`, payload);
      } else {
        await api.post(`/bus-operational-routes/${selectedRouteId}/stops`, payload);
      }
      resetStopForm();
      await Promise.all([loadStops(selectedRouteId), loadRoutes()]);
    } catch (error) {
      Swal.fire("Unable to Save Stop", error?.response?.data?.error || "Failed to save route stop.", "error");
    } finally {
      setStopSaving(false);
    }
  };

  const toggleStop = async (stop) => {
    try {
      await api.put(`/bus-operational-routes/${selectedRouteId}/stops/${stop.id}`, { active: !stop.active });
      await Promise.all([loadStops(selectedRouteId), loadRoutes()]);
    } catch (error) {
      Swal.fire("Unable to Update", error?.response?.data?.error || "Failed to update stop.", "error");
    }
  };

  const deleteStop = async (stop) => {
    const confirmation = await Swal.fire({
      title: "Delete stop?",
      text: stop.stop_name,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      confirmButtonColor: "#dc3545",
    });
    if (!confirmation.isConfirmed) return;
    try {
      await api.delete(`/bus-operational-routes/${selectedRouteId}/stops/${stop.id}`);
      if (editingStopId === stop.id) resetStopForm();
      await Promise.all([loadStops(selectedRouteId), loadRoutes()]);
    } catch (error) {
      Swal.fire("Unable to Delete", error?.response?.data?.error || "Failed to delete stop.", "error");
    }
  };

  const moveStop = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= stops.length) return;
    const ordered = [...stops];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    setStops(ordered.map((stop, i) => ({ ...stop, sequence: i + 1 })));
    try {
      await api.put(`/bus-operational-routes/${selectedRouteId}/stops/reorder`, {
        stop_ids: ordered.map((stop) => stop.id),
      });
      await loadRoutes();
    } catch (error) {
      await loadStops(selectedRouteId);
      Swal.fire("Unable to Reorder", error?.response?.data?.error || "Failed to reorder stops.", "error");
    }
  };

  const totalStops = routes.reduce((sum, route) => sum + (Array.isArray(route.stops) ? route.stops.length : 0), 0);
  const activeRoutes = routes.filter((route) => route.active).length;

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
        <div>
          <div className="text-uppercase text-primary fw-semibold small mb-1">Transport Setup</div>
          <h3 className="mb-1">Routes & Stop Master</h3>
          <p className="text-muted mb-0">Build reusable, ordered pickup/drop stops for live operations, ETA and parent notifications.</p>
        </div>
        <button className="btn btn-outline-secondary" onClick={loadRoutes} disabled={loading}>
          <i className="bi bi-arrow-clockwise me-2" />Refresh
        </button>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-4"><div className="card border-0 shadow-sm h-100"><div className="card-body">
          <div className="text-muted small">Active Routes</div><div className="display-6 fw-semibold">{activeRoutes}</div>
        </div></div></div>
        <div className="col-md-4"><div className="card border-0 shadow-sm h-100"><div className="card-body">
          <div className="text-muted small">Configured Stops</div><div className="display-6 fw-semibold">{totalStops}</div>
        </div></div></div>
        <div className="col-md-4"><div className="card border-0 shadow-sm h-100"><div className="card-body">
          <div className="text-muted small">Selected Route Usage</div><div className="display-6 fw-semibold">{selectedRoute ? usage.total : "—"}</div>
          <div className="small text-muted">{selectedRoute ? `${usage.students} students · ${usage.employees} employees` : "Select a route to view"}</div>
        </div></div></div>
      </div>

      {canManage && (
        <div className="card shadow-sm border-0 mb-4">
          <div className="card-body">
            <h5 className="card-title mb-3">{editingId ? "Edit Route" : "Add Route"}</h5>
            <form onSubmit={saveRoute}><div className="row g-3">
              <div className="col-md-5"><label className="form-label">Route Name *</label><input className="form-control" maxLength={150} value={form.route_name} onChange={(e) => setForm({ ...form, route_name: e.target.value })} /></div>
              <div className="col-md-3"><label className="form-label">Route Code</label><input className="form-control" maxLength={50} value={form.route_code} onChange={(e) => setForm({ ...form, route_code: e.target.value })} /></div>
              <div className="col-md-4 d-flex align-items-end"><div className="form-check form-switch mb-2"><input className="form-check-input" type="checkbox" id="actualRouteActive" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /><label className="form-check-label" htmlFor="actualRouteActive">Active</label></div></div>
              <div className="col-12"><label className="form-label">Description</label><textarea className="form-control" rows="2" maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="col-12 d-flex gap-2"><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Update Route" : "Create Route"}</button>{editingId && <button className="btn btn-outline-secondary" type="button" onClick={resetForm}>Cancel</button>}</div>
            </div></form>
          </div>
        </div>
      )}

      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <h5 className="mb-0">Routes ({visibleRoutes.length})</h5>
            <input className="form-control" style={{ maxWidth: 320 }} placeholder="Search route name or code…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="table-responsive"><table className="table table-hover align-middle">
            <thead><tr><th>Route</th><th>Stops</th><th>Description</th><th>Status</th><th>Stop Master</th>{canManage && <th className="text-end">Actions</th>}</tr></thead>
            <tbody>
              {visibleRoutes.map((route) => {
                const routeStops = Array.isArray(route.stops) ? route.stops : [];
                return <tr key={route.id} className={Number(selectedRouteId) === Number(route.id) ? "table-primary" : ""}>
                  <td><div className="fw-semibold">{route.route_name}</div><div className="small text-muted">{route.route_code || "No code"}</div></td>
                  <td><span className="badge text-bg-light border">{routeStops.length} stops</span></td>
                  <td>{route.description || "—"}</td>
                  <td><span className={`badge ${route.active ? "text-bg-success" : "text-bg-secondary"}`}>{route.active ? "Active" : "Inactive"}</span></td>
                  <td><button className="btn btn-sm btn-primary" onClick={() => setSelectedRouteId(route.id)}><i className="bi bi-geo-alt me-1" />Manage Stops</button></td>
                  {canManage && <td className="text-end text-nowrap"><button className="btn btn-sm btn-outline-primary me-2" onClick={() => editRoute(route)}>Edit</button><button className="btn btn-sm btn-outline-secondary me-2" onClick={() => toggleStatus(route)}>{route.active ? "Deactivate" : "Activate"}</button><button className="btn btn-sm btn-outline-danger" onClick={() => deleteRoute(route)}>Delete</button></td>}
                </tr>;
              })}
              {!loading && visibleRoutes.length === 0 && <tr><td colSpan={canManage ? 6 : 5} className="text-center text-muted py-4">No actual routes found.</td></tr>}
              {loading && <tr><td colSpan={canManage ? 6 : 5} className="text-center text-muted py-4">Loading…</td></tr>}
            </tbody>
          </table></div>
        </div>
      </div>

      {selectedRoute && (
        <div className="card shadow-sm border-0">
          <div className="card-header bg-white border-0 pt-4 px-4 d-flex justify-content-between align-items-start flex-wrap gap-2">
            <div><div className="text-primary small fw-semibold text-uppercase">Stop Master</div><h4 className="mb-1">{selectedRoute.route_name}</h4><div className="text-muted small">Arrange stops in the actual travel order. Pickup and drop timings can be maintained separately.</div></div>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => { setSelectedRouteId(null); resetStopForm(); }}>Close</button>
          </div>
          <div className="card-body p-4">
            {canManage && <form onSubmit={saveStop} className="bg-light rounded-3 p-3 mb-4"><div className="row g-3">
              <div className="col-md-4"><label className="form-label">Stop Name *</label><input className="form-control" value={stopForm.stop_name} onChange={(e) => setStopForm({ ...stopForm, stop_name: e.target.value })} placeholder="e.g. Jyoti Swarup Chowk" /></div>
              <div className="col-md-4"><label className="form-label">Address / Landmark</label><input className="form-control" value={stopForm.address} onChange={(e) => setStopForm({ ...stopForm, address: e.target.value })} /></div>
              <div className="col-md-2"><label className="form-label">Pickup Time</label><input type="time" className="form-control" value={stopForm.pickup_time} onChange={(e) => setStopForm({ ...stopForm, pickup_time: e.target.value })} /></div>
              <div className="col-md-2"><label className="form-label">Drop Time</label><input type="time" className="form-control" value={stopForm.drop_time} onChange={(e) => setStopForm({ ...stopForm, drop_time: e.target.value })} /></div>
              <div className="col-md-3"><label className="form-label">Latitude</label><input type="number" step="0.0000001" className="form-control" value={stopForm.latitude} onChange={(e) => setStopForm({ ...stopForm, latitude: e.target.value })} /></div>
              <div className="col-md-3"><label className="form-label">Longitude</label><input type="number" step="0.0000001" className="form-control" value={stopForm.longitude} onChange={(e) => setStopForm({ ...stopForm, longitude: e.target.value })} /></div>
              <div className="col-md-3"><label className="form-label">Approach Radius (m)</label><input type="number" min="100" max="10000" step="100" className="form-control" value={stopForm.notification_radius_meters} onChange={(e) => setStopForm({ ...stopForm, notification_radius_meters: e.target.value })} /></div>
              <div className="col-md-3 d-flex align-items-end"><div className="form-check form-switch mb-2"><input className="form-check-input" type="checkbox" id="stopActive" checked={stopForm.active} onChange={(e) => setStopForm({ ...stopForm, active: e.target.checked })} /><label className="form-check-label" htmlFor="stopActive">Active Stop</label></div></div>
              <div className="col-12 d-flex gap-2"><button className="btn btn-primary" type="submit" disabled={stopSaving}>{stopSaving ? "Saving…" : editingStopId ? "Update Stop" : "Add Stop"}</button>{editingStopId && <button className="btn btn-outline-secondary" type="button" onClick={resetStopForm}>Cancel</button>}</div>
            </div></form>}

            <div className="table-responsive"><table className="table align-middle">
              <thead><tr><th style={{ width: 70 }}>Order</th><th>Stop</th><th>Pickup</th><th>Drop</th><th>Geo</th><th>Radius</th><th>Status</th>{canManage && <th className="text-end">Actions</th>}</tr></thead>
              <tbody>
                {stops.map((stop, index) => <tr key={stop.id}>
                  <td><div className="d-flex align-items-center gap-1"><span className="badge rounded-pill text-bg-primary">{index + 1}</span>{canManage && <div className="btn-group btn-group-sm"><button type="button" className="btn btn-outline-secondary" disabled={index === 0} onClick={() => moveStop(index, -1)}>↑</button><button type="button" className="btn btn-outline-secondary" disabled={index === stops.length - 1} onClick={() => moveStop(index, 1)}>↓</button></div>}</div></td>
                  <td><div className="fw-semibold">{stop.stop_name}</div><div className="small text-muted">{stop.address || "No landmark"}</div></td>
                  <td>{timeLabel(stop.pickup_time)}</td><td>{timeLabel(stop.drop_time)}</td>
                  <td>{stop.latitude !== null && stop.longitude !== null ? <span className="badge text-bg-success">Mapped</span> : <span className="badge text-bg-warning">Not mapped</span>}</td>
                  <td>{stop.notification_radius_meters || 1500} m</td>
                  <td><span className={`badge ${stop.active ? "text-bg-success" : "text-bg-secondary"}`}>{stop.active ? "Active" : "Inactive"}</span></td>
                  {canManage && <td className="text-end text-nowrap"><button className="btn btn-sm btn-outline-primary me-2" onClick={() => editStop(stop)}>Edit</button><button className="btn btn-sm btn-outline-secondary me-2" onClick={() => toggleStop(stop)}>{stop.active ? "Disable" : "Enable"}</button><button className="btn btn-sm btn-outline-danger" onClick={() => deleteStop(stop)}>Delete</button></td>}
                </tr>)}
                {!stopsLoading && stops.length === 0 && <tr><td colSpan={canManage ? 8 : 7} className="text-center text-muted py-4">No stops yet. Add the first stop for this route.</td></tr>}
                {stopsLoading && <tr><td colSpan={canManage ? 8 : 7} className="text-center text-muted py-4">Loading stops…</td></tr>}
              </tbody>
            </table></div>
          </div>
        </div>
      )}
    </div>
  );
}
