import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "./OnlineClasses.css";
import OnlineClassAttendanceModal from "../components/OnlineClassAttendanceModal";

const unwrap = (response) => response?.data?.data ?? response?.data ?? [];
const list = (value) => Array.isArray(value) ? value : value?.rows || value?.classes || value?.subjects || value?.sections || [];
const stored = (key) => {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch (_) { return []; }
};
const roleSet = () => new Set([...stored("roles"), localStorage.getItem("role")].filter(Boolean).map((v) => String(v).toLowerCase()));
const uniqueBy = (rows, key, nameKey) => [...new Map(rows.map((row) => [Number(row[key]), { id: Number(row[key]), [nameKey]: row[nameKey] }])).values()];
const initialForm = {
  class_id: "", section_id: "", subject_id: "", title: "", agenda: "",
  date: "", time: "", duration_minutes: 40,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
  waiting_room: true, mute_upon_entry: true, join_before_host: false, recording_setting: "none",
  create_assessment: false,
};

export default function OnlineClasses() {
  const navigate = useNavigate();
  const roles = useMemo(roleSet, []);
  const canSchedule = ["teacher", "admin", "superadmin", "super_admin", "academic_coordinator"].some((r) => roles.has(r));
  const [zoom, setZoom] = useState({ connected: false });
  const [rows, setRows] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [attendanceRow, setAttendanceRow] = useState(null);

  const flash = useCallback((type, text) => setNotice({ type, text }), []);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const calls = [api.get("/api/online-classes")];
      if (canSchedule) calls.push(api.get("/api/zoom/status"), api.get("/api/online-classes/options"));
      const results = await Promise.all(calls);
      setRows(list(unwrap(results[0])));
      if (canSchedule) {
        setZoom(unwrap(results[1]));
        setAssignments(list(unwrap(results[2])));
      }
    } catch (e) { flash("danger", e.response?.data?.message || "Could not load online classes."); }
    finally { setLoading(false); }
  }, [canSchedule, flash]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("zoom") === "connected") flash("success", "Zoom account connected.");
    if (q.get("zoom") === "error") flash("danger", q.get("message") || "Zoom connection failed.");
    if (q.has("zoom")) window.history.replaceState({}, "", window.location.pathname);
  }, [flash]);

  const connect = async () => {
    try { const r = await api.get("/api/zoom/connect"); window.location.assign(unwrap(r).authorization_url); }
    catch (e) { flash("danger", e.response?.data?.message || "Could not start Zoom authorization."); }
  };
  const disconnect = async () => {
    if (!window.confirm("Disconnect your Zoom account? Existing class history will remain.")) return;
    try { await api.delete("/api/zoom/disconnect"); setZoom({ connected: false }); flash("success", "Zoom account disconnected."); }
    catch (e) { flash("danger", e.response?.data?.message || "Could not disconnect Zoom."); }
  };
  const openCreate = () => { setEditing(null); setForm(initialForm); setShowForm(true); };
  const openEdit = (row) => {
    const date = new Date(row.start_time);
    setEditing(row);
    setForm({
      ...initialForm, class_id: row.class_id, section_id: row.section_id || "", subject_id: row.subject_id,
      title: row.title, agenda: row.agenda || "", date: date.toLocaleDateString("en-CA"),
      time: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
      duration_minutes: row.duration_minutes, timezone: row.timezone,
      waiting_room: row.settings?.waiting_room !== false, mute_upon_entry: row.settings?.mute_upon_entry !== false,
      recording_setting: row.settings?.auto_recording || "none",
    });
    setShowForm(true);
  };
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const createAssessment = Boolean(form.create_assessment) && !editing;
      const payload = { ...form, start_time: new Date(`${form.date}T${form.time}`).toISOString(), duration_minutes: Number(form.duration_minutes) };
      delete payload.date; delete payload.time; delete payload.create_assessment;
      let saved;
      if (editing) saved = unwrap(await api.patch(`/api/online-classes/${editing.id}`, payload));
      else saved = unwrap(await api.post("/api/online-classes", payload));
      setShowForm(false); flash("success", editing ? "Online class updated." : "Online class scheduled."); await load();
      if (createAssessment && saved?.id) navigate(`/assessments?create=1&online_class_id=${saved.id}`);
    } catch (err) {
      const data = err.response?.data;
      flash("danger", data?.errors?.join(". ") || data?.message || "Could not save online class.");
    } finally { setBusy(false); }
  };
  const action = async (row, type) => {
    try {
      if (type === "cancel") {
        if (!window.confirm(`Cancel “${row.title}”?`)) return;
        await api.delete(`/api/online-classes/${row.id}`); flash("success", "Class cancelled."); await load();
      } else {
        const r = await api[type === "start" ? "post" : "get"](`/api/online-classes/${row.id}/${type}`);
        const url = unwrap(r)[`${type}_url`]; window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (e) { flash("danger", e.response?.data?.message || `Could not ${type} class.`); }
  };
  const classAssignments = assignments.filter((a) => !form.class_id || Number(a.class_id) === Number(form.class_id));
  const sectionAssignments = classAssignments.filter((a) => !form.section_id || Number(a.section_id) === Number(form.section_id));
  const classes = uniqueBy(assignments, "class_id", "class_name");
  const sections = uniqueBy(classAssignments, "section_id", "section_name");
  const subjects = uniqueBy(sectionAssignments, "subject_id", "subject_name");

  return <div className="online-classes-page container-fluid py-3">
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
      <div><h2 className="mb-1">Online Classes</h2><div className="text-muted">Schedule and join secure Zoom classes.</div></div>
      {canSchedule && <button className="btn btn-primary" disabled={!zoom.connected} onClick={openCreate}><i className="bi bi-plus-lg me-2" />Schedule Class</button>}
    </div>
    {notice && <div className={`alert alert-${notice.type} alert-dismissible`} role="alert">{notice.text}<button className="btn-close" onClick={() => setNotice(null)} aria-label="Close" /></div>}

    {canSchedule && <section className="zoom-card card border-0 shadow-sm mb-4">
      <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div className="d-flex gap-3 align-items-center">
          <div className="zoom-mark"><i className="bi bi-camera-video-fill" /></div>
          <div>{zoom.connected ? <><div className="d-flex gap-2 align-items-center"><h5 className="mb-0">Zoom connected</h5><span className="badge text-bg-success">Connected</span></div><div className="text-muted mt-1">{zoom.zoom_email} · Connected {new Date(zoom.connected_at).toLocaleDateString()}</div></> : <><h5 className="mb-1">Connect Zoom</h5><div className="text-muted">Connect your Zoom account to schedule online classes.</div></>}</div>
        </div>
        {zoom.connected ? <button className="btn btn-outline-danger" onClick={disconnect}>Disconnect</button> : <button className="btn btn-primary" onClick={connect}>Connect Zoom Account</button>}
      </div>
    </section>}

    <div className="card border-0 shadow-sm"><div className="card-body p-0">
      <div className="table-responsive"><table className="table align-middle mb-0">
        <thead><tr><th>Class</th><th>Schedule</th><th>Teacher</th><th>Status</th><th className="text-end">Actions</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan="5" className="text-center py-5">Loading…</td></tr> : rows.length === 0 ? <tr><td colSpan="5" className="text-center text-muted py-5">No online classes found.</td></tr> : rows.map((row) =>
          <tr key={row.id}><td><div className="fw-semibold">{row.title}</div><small className="text-muted">{row.class?.class_name}{row.section?.section_name ? ` – ${row.section.section_name}` : ""} · {row.subject?.name}</small></td>
          <td>{new Date(row.start_time).toLocaleString()}<small className="d-block text-muted">{row.duration_minutes} minutes</small></td>
          <td>{row.teacher?.name || "—"}</td><td><span className={`badge status-${row.status}`}>{row.status}</span></td>
          <td><div className="d-flex justify-content-end flex-wrap gap-2">
            {row.status !== "cancelled" && <button className="btn btn-sm btn-outline-primary" onClick={() => action(row, "join")}>Join</button>}
            {(row.can_manage || roles.has("student")) && <button className="btn btn-sm btn-outline-dark" onClick={() => setAttendanceRow(row)}>{roles.has("student") && !row.can_manage ? "My Attendance" : "Attendance"}</button>}
            <button className="btn btn-sm btn-outline-success" onClick={() => navigate(`/assessments?online_class_id=${row.id}`)}>Tests</button>
            {row.can_start && row.status !== "cancelled" && <button className="btn btn-sm btn-primary" onClick={() => action(row, "start")}>Start</button>}
            {row.can_manage && row.status !== "cancelled" && <><button className="btn btn-sm btn-outline-secondary" onClick={() => openEdit(row)}>Edit</button><button className="btn btn-sm btn-outline-danger" onClick={() => action(row, "cancel")}>Cancel</button></>}
          </div></td></tr>)}</tbody>
      </table></div>
    </div></div>


    {attendanceRow && <OnlineClassAttendanceModal
      onlineClass={attendanceRow}
      canManage={Boolean(attendanceRow.can_manage)}
      onClose={() => setAttendanceRow(null)}
      onNotice={flash}
    />}

    {showForm && <div className="online-modal-backdrop" role="presentation"><div className="online-modal card shadow-lg" role="dialog" aria-modal="true">
      <form onSubmit={submit}><div className="card-header d-flex justify-content-between align-items-center"><h5 className="mb-0">{editing ? "Edit" : "Schedule"} Online Class</h5><button type="button" className="btn-close" onClick={() => setShowForm(false)} /></div>
      <div className="card-body"><div className="row g-3">
        <Select label="Class" value={form.class_id} onChange={(v) => setForm({ ...form, class_id: v, section_id: "", subject_id: "" })} options={classes} nameKey="class_name" />
        <Select label="Section" value={form.section_id} onChange={(v) => setForm({ ...form, section_id: v, subject_id: "" })} options={sections} nameKey="section_name" />
        <Select label="Subject" value={form.subject_id} onChange={(v) => setForm({ ...form, subject_id: v })} options={subjects} nameKey="subject_name" />
        <Field label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
        <div className="col-12"><label className="form-label">Agenda</label><textarea className="form-control" rows="3" value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} /></div>
        <Field label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
        <Field label="Start time" type="time" value={form.time} onChange={(v) => setForm({ ...form, time: v })} />
        <Field label="Duration (minutes)" type="number" min="10" max="1440" value={form.duration_minutes} onChange={(v) => setForm({ ...form, duration_minutes: v })} />
        <Field label="Timezone" value={form.timezone} onChange={(v) => setForm({ ...form, timezone: v })} />
        <Select label="Recording" value={form.recording_setting} onChange={(v) => setForm({ ...form, recording_setting: v })} options={[{ id: "none", name: "Disabled" }, { id: "local", name: "Local" }, { id: "cloud", name: "Cloud" }]} nameKey="name" />
        <div className="col-12 d-flex flex-wrap gap-4">{[["waiting_room", "Waiting room"], ["mute_upon_entry", "Mute on entry"]].map(([key, label]) => <label className="form-check" key={key}><input className="form-check-input" type="checkbox" checked={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} /><span className="form-check-label">{label}</span></label>)}</div>
        {!editing && <div className="col-12"><label className="form-check assessment-link-check"><input className="form-check-input" type="checkbox" checked={form.create_assessment} onChange={(e) => setForm({ ...form, create_assessment: e.target.checked })} /><span className="form-check-label"><strong>Create a test for this class</strong><small className="d-block text-muted">After scheduling, open AI/online/offline assessment builder linked to this class.</small></span></label></div>}
      </div></div><div className="card-footer text-end"><button type="button" className="btn btn-light me-2" onClick={() => setShowForm(false)}>Close</button><button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save Class"}</button></div></form>
    </div></div>}
  </div>;
}
function Field({ label, onChange, ...props }) { return <div className="col-md-6"><label className="form-label">{label}</label><input className="form-control" required onChange={(e) => onChange(e.target.value)} {...props} /></div>; }
function Select({ label, value, onChange, options, nameKey, optional }) { return <div className="col-md-6"><label className="form-label">{label}</label><select className="form-select" required={!optional} value={value} onChange={(e) => onChange(e.target.value)}><option value="">{optional ? "All / none" : `Select ${label.toLowerCase()}`}</option>{options.map((o) => <option value={o.id} key={o.id}>{o[nameKey]}</option>)}</select></div>; }
