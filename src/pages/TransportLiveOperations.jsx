import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";

const today = () => new Date().toISOString().slice(0, 10);
const asArray = (v) => Array.isArray(v) ? v : v?.data || v?.rows || v?.items || [];
const nice = (v) => String(v || "").toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
const staffName = (s) => s?.user?.name || s?.user?.username || `User ${s?.user_id || ""}`;

const reasonOptions = [
  ["BUS_BREAKDOWN", "Bus Breakdown"], ["MAINTENANCE", "Maintenance"],
  ["DRIVER_UNAVAILABLE", "Driver Unavailable"], ["OFFICIAL_DUTY", "Official Duty"],
  ["EMERGENCY", "Emergency"], ["OTHER", "Other"],
];
const alertOptions = [
  ["FOG", "Fog"], ["HEAVY_RAIN", "Heavy Rain"], ["TRAFFIC", "Heavy Traffic"],
  ["ROAD_BLOCK", "Road Block / Diversion"], ["BREAKDOWN", "Bus Breakdown"],
  ["DELAY", "Unexpected Delay"], ["OTHER", "Other"],
];

export default function TransportLiveOperations() {
  const [date, setDate] = useState(today());
  const [buses, setBuses] = useState([]);
  const [staff, setStaff] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    trip_type: "both", original_bus_id: "", replacement_bus_id: "",
    replacement_driver_user_id: "", replacement_conductor_user_id: "",
    reason_type: "BUS_BREAKDOWN", reason_note: "", notify_students: true,
  });
  const [alertForm, setAlertForm] = useState({ bus_id: "", trip_type: "pickup", alert_type: "FOG", delay_minutes: "10", message: "" });

  const drivers = useMemo(() => staff.filter((s) => String(s.staff_type).toLowerCase() === "driver" && String(s.status || "active").toLowerCase() === "active"), [staff]);
  const conductors = useMemo(() => staff.filter((s) => String(s.staff_type).toLowerCase() === "conductor" && String(s.status || "active").toLowerCase() === "active"), [staff]);
  const busById = useMemo(() => new Map(buses.map((b) => [Number(b.id), b])), [buses]);

  const load = async () => {
    setBusy(true);
    try {
      const [b, s, o, a] = await Promise.all([
        api.get("/buses"), api.get("/transport-staff"),
        api.get(`/transport-live-ops/overrides?date=${date}`),
        api.get(`/transport-live-ops/alerts?date=${date}`),
      ]);
      setBuses(asArray(b.data).filter((x) => x.active !== false));
      setStaff(s.data?.staff || asArray(s.data));
      setOverrides(o.data?.data || []);
      setAlerts(a.data?.data || []);
    } catch (e) {
      Swal.fire("Error", e?.response?.data?.message || "Unable to load transport live operations.", "error");
    } finally { setBusy(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [date]);

  const saveOverride = async () => {
    if (!form.original_bus_id) return Swal.fire("Select Bus", "Choose the regular bus first.", "warning");
    if (!form.replacement_bus_id && !form.replacement_driver_user_id && !form.replacement_conductor_user_id) {
      return Swal.fire("Nothing Changed", "Choose a temporary bus, driver or conductor.", "warning");
    }
    setBusy(true);
    try {
      const r = await api.post("/transport-live-ops/overrides", { ...form, override_date: date });
      const n = r.data?.notification;
      await Swal.fire("Temporary arrangement saved", n ? `Notifications sent: ${n.sent || 0}` : "Saved successfully.", "success");
      setForm((f) => ({ ...f, replacement_bus_id: "", replacement_driver_user_id: "", replacement_conductor_user_id: "", reason_note: "" }));
      await load();
    } catch (e) { Swal.fire("Could not save", e?.response?.data?.message || "Please try again.", "error"); }
    finally { setBusy(false); }
  };

  const cancelOverride = async (id) => {
    const ok = await Swal.fire({ title: "Cancel temporary arrangement?", icon: "question", showCancelButton: true, confirmButtonText: "Cancel arrangement" });
    if (!ok.isConfirmed) return;
    await api.patch(`/transport-live-ops/overrides/${id}/cancel`, {});
    await load();
  };

  const sendAlert = async () => {
    if (!alertForm.bus_id) return Swal.fire("Select Bus", "Choose the affected bus.", "warning");
    setBusy(true);
    try {
      const r = await api.post("/transport-live-ops/alerts", { ...alertForm, alert_date: date, delay_minutes: alertForm.delay_minutes === "" ? null : Number(alertForm.delay_minutes) });
      const n = r.data?.notification;
      await Swal.fire("Alert sent", `Push sent to ${n?.sent || 0} student/parent app${(n?.sent || 0) === 1 ? "" : "s"}.`, "success");
      await load();
    } catch (e) { Swal.fire("Could not send", e?.response?.data?.message || "Please try again.", "error"); }
    finally { setBusy(false); }
  };

  const resolveAlert = async (id) => {
    const r = await api.patch(`/transport-live-ops/alerts/${id}/resolve`, {});
    const n = r.data?.notification;
    await Swal.fire("Back on schedule", `Update sent to ${n?.sent || 0} app${(n?.sent || 0) === 1 ? "" : "s"}.`, "success");
    await load();
  };

  return <div className="container py-4" style={{ maxWidth: 1180 }}>
    <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-4">
      <div><h2 className="mb-1">Transport Live Operations</h2><div className="text-muted">Temporary bus/driver changes and live route delay alerts.</div></div>
      <div className="d-flex gap-2"><input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} /><button className="btn btn-outline-secondary" onClick={load} disabled={busy}>Refresh</button></div>
    </div>

    <div className="card shadow-sm border-0 mb-4"><div className="card-body p-4">
      <div className="d-flex justify-content-between flex-wrap gap-2 mb-3"><div><h5 className="mb-1">Temporary Transport Override</h5><div className="small text-muted">Permanent student assignment remains unchanged. Override expires automatically after the selected date.</div></div><span className="badge text-bg-primary align-self-start">Parent notification default ON</span></div>
      <div className="row g-3">
        <div className="col-md-4"><label className="form-label">Regular Bus *</label><select className="form-select" value={form.original_bus_id} onChange={(e) => setForm({ ...form, original_bus_id: e.target.value })}><option value="">Select bus</option>{buses.map((b) => <option key={b.id} value={b.id}>{b.bus_no}{b.reg_no ? ` • ${b.reg_no}` : ""}</option>)}</select></div>
        <div className="col-md-4"><label className="form-label">Applies To</label><select className="form-select" value={form.trip_type} onChange={(e) => setForm({ ...form, trip_type: e.target.value })}><option value="both">Pickup + Drop</option><option value="pickup">Pickup only</option><option value="drop">Drop only</option></select></div>
        <div className="col-md-4"><label className="form-label">Reason</label><select className="form-select" value={form.reason_type} onChange={(e) => setForm({ ...form, reason_type: e.target.value })}>{reasonOptions.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div className="col-md-4"><label className="form-label">Temporary Bus</label><select className="form-select" value={form.replacement_bus_id} onChange={(e) => setForm({ ...form, replacement_bus_id: e.target.value })}><option value="">No bus change</option>{buses.filter((b) => String(b.id) !== String(form.original_bus_id)).map((b) => <option key={b.id} value={b.id}>{b.bus_no}{b.reg_no ? ` • ${b.reg_no}` : ""}</option>)}</select></div>
        <div className="col-md-4"><label className="form-label">Temporary Driver</label><select className="form-select" value={form.replacement_driver_user_id} onChange={(e) => setForm({ ...form, replacement_driver_user_id: e.target.value })}><option value="">Keep regular driver</option>{drivers.map((s) => <option key={s.id} value={s.user?.id || s.user_id}>{staffName(s)}</option>)}</select></div>
        <div className="col-md-4"><label className="form-label">Temporary Conductor</label><select className="form-select" value={form.replacement_conductor_user_id} onChange={(e) => setForm({ ...form, replacement_conductor_user_id: e.target.value })}><option value="">Keep regular conductor</option>{conductors.map((s) => <option key={s.id} value={s.user?.id || s.user_id}>{staffName(s)}</option>)}</select></div>
        <div className="col-md-9"><label className="form-label">Note</label><input className="form-control" placeholder="e.g. Regular bus under maintenance" value={form.reason_note} onChange={(e) => setForm({ ...form, reason_note: e.target.value })} /></div>
        <div className="col-md-3 d-flex align-items-end"><div className="form-check mb-2"><input id="notifyStudents" className="form-check-input" type="checkbox" checked={form.notify_students} onChange={(e) => setForm({ ...form, notify_students: e.target.checked })}/><label className="form-check-label" htmlFor="notifyStudents">Notify student/parent app</label></div></div>
      </div>
      <div className="mt-3"><button className="btn btn-primary" onClick={saveOverride} disabled={busy}><i className="bi bi-shuffle me-2"/>Save Temporary Arrangement</button></div>
    </div></div>

    <div className="card shadow-sm border-0 mb-4"><div className="card-body p-4">
      <h5>Today's Temporary Arrangements</h5>
      <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Regular</th><th>Temporary</th><th>Shift</th><th>Reason</th><th>Status</th><th/></tr></thead><tbody>
        {overrides.length === 0 ? <tr><td colSpan="6" className="text-center text-muted py-4">No temporary arrangements for this date.</td></tr> : overrides.map((o) => <tr key={o.id}>
          <td><b>{o.original_bus?.bus_no || `Bus ${o.original_bus_id}`}</b></td>
          <td>{[o.replacement_bus?.bus_no && `Bus: ${o.replacement_bus.bus_no}`, o.replacement_driver && `Driver: ${o.replacement_driver.name || o.replacement_driver.username}`, o.replacement_conductor && `Conductor: ${o.replacement_conductor.name || o.replacement_conductor.username}`].filter(Boolean).map((x) => <div key={x}>{x}</div>)}</td>
          <td><span className="badge text-bg-light border">{nice(o.trip_type)}</span></td><td><b>{nice(o.reason_type)}</b>{o.reason_note && <div className="small text-muted">{o.reason_note}</div>}</td>
          <td><span className={`badge ${o.status === "ACTIVE" ? "text-bg-success" : "text-bg-secondary"}`}>{o.status}</span></td>
          <td>{o.status === "ACTIVE" && <button className="btn btn-sm btn-outline-danger" onClick={() => cancelOverride(o.id)}>Cancel</button>}</td>
        </tr>)}</tbody></table></div>
    </div></div>

    <div className="card shadow-sm border-0 mb-4"><div className="card-body p-4">
      <div className="d-flex justify-content-between flex-wrap gap-2"><div><h5 className="mb-1">Send Live Delay Alert</h5><div className="small text-muted">Driver/conductor can send the same alert from the mobile app while safely stopped.</div></div></div>
      <div className="row g-3 mt-1">
        <div className="col-md-3"><label className="form-label">Bus</label><select className="form-select" value={alertForm.bus_id} onChange={(e) => setAlertForm({ ...alertForm, bus_id: e.target.value })}><option value="">Select bus</option>{buses.map((b) => <option key={b.id} value={b.id}>{b.bus_no}</option>)}</select></div>
        <div className="col-md-2"><label className="form-label">Trip</label><select className="form-select" value={alertForm.trip_type} onChange={(e) => setAlertForm({ ...alertForm, trip_type: e.target.value })}><option value="pickup">Pickup</option><option value="drop">Drop</option></select></div>
        <div className="col-md-3"><label className="form-label">Cause</label><select className="form-select" value={alertForm.alert_type} onChange={(e) => setAlertForm({ ...alertForm, alert_type: e.target.value })}>{alertOptions.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div className="col-md-2"><label className="form-label">Delay (min)</label><input type="number" min="0" max="240" className="form-control" value={alertForm.delay_minutes} onChange={(e) => setAlertForm({ ...alertForm, delay_minutes: e.target.value })}/></div>
        <div className="col-md-2 d-flex align-items-end"><button className="btn btn-warning w-100" onClick={sendAlert} disabled={busy}>Send Alert</button></div>
        <div className="col-12"><input className="form-control" placeholder="Optional custom message (otherwise a professional message is generated automatically)" value={alertForm.message} onChange={(e) => setAlertForm({ ...alertForm, message: e.target.value })}/></div>
      </div>
    </div></div>

    <div className="card shadow-sm border-0"><div className="card-body p-4"><h5>Live Alert History</h5>
      <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Bus</th><th>Trip</th><th>Alert</th><th>Delay</th><th>Sent By</th><th>Status</th><th/></tr></thead><tbody>
        {alerts.length === 0 ? <tr><td colSpan="7" className="text-center text-muted py-4">No alerts for this date.</td></tr> : alerts.map((a) => <tr key={a.id}><td><b>{a.bus?.bus_no || `Bus ${a.bus_id}`}</b>{a.effective_bus && <div className="small text-primary">Physical: {a.effective_bus.bus_no}</div>}</td><td>{nice(a.trip_type)}</td><td>{nice(a.alert_type)}{a.message && <div className="small text-muted">{a.message}</div>}</td><td>{a.delay_minutes != null ? `${a.delay_minutes} min` : "—"}</td><td>{a.sender?.name || a.sender?.username || "—"}</td><td><span className={`badge ${a.status === "ACTIVE" ? "text-bg-warning" : "text-bg-success"}`}>{a.status}</span></td><td>{a.status === "ACTIVE" && <button className="btn btn-sm btn-outline-success" onClick={() => resolveAlert(a.id)}>Back on Schedule</button>}</td></tr>)}
      </tbody></table></div>
    </div></div>
  </div>;
}
