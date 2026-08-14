import React, { useCallback, useEffect, useMemo, useState } from "react";
import dailyReadinessApi from "../services/dailyReadinessApi";

const API_BASE = (process.env.REACT_APP_API_URL || "http://localhost:3000").replace(/\/$/, "");
const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => today().slice(0, 7);
const errMsg = (e) => e?.response?.data?.message || e?.message || "Something went wrong.";
const asset = (u) => !u ? "" : (/^https?:\/\//i.test(u) ? u : `${API_BASE}${String(u).startsWith("/") ? "" : "/"}${u}`);

const detailOptions = [
  ["ok", "OK"], ["issue", "Issue"], ["na", "N/A"], ["not_checked", "Not checked"],
];
const yesNoOptions = [["yes", "Yes"], ["no", "No"], ["not_checked", "Not checked"]];
const hygieneOptions = [["ok", "OK"], ["concern", "Concern"], ["not_checked", "Not checked"]];
const takenOptions = [["taken", "Taken"], ["not_taken", "Not taken"], ["not_observed", "Not observed"]];
const observationOptions = [["positive", "Positive"], ["normal", "Normal"], ["needs_attention", "Needs attention"]];

const blankRecord = (studentId, allOk = false) => ({
  student_id: studentId,
  uniform_overall: allOk ? "ok" : "not_checked",
  shirt_status: allOk ? "ok" : "not_checked",
  bottom_status: allOk ? "ok" : "not_checked",
  belt_status: allOk ? "ok" : "not_checked",
  socks_status: allOk ? "ok" : "not_checked",
  shoes_status: allOk ? "ok" : "not_checked",
  headwear_status: allOk ? "na" : "not_checked",
  cleanliness_status: allOk ? "ok" : "not_checked",
  tiffin_brought_status: allOk ? "yes" : "not_checked",
  tiffin_hygiene_status: allOk ? "ok" : "not_checked",
  tiffin_taken_status: "not_observed",
  water_bottle_status: allOk ? "yes" : "not_checked",
  general_observation: "normal",
  internal_note: "",
  family_note: "",
  family_visible: true,
  concern_count: 0,
  concern_labels: [],
});

function Avatar({ student, size = 42 }) {
  const src = asset(student?.photo_url || student?.photo);
  if (src) return <img src={src} alt="" className="rounded-circle border" style={{ width: size, height: size, objectFit: "cover" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />;
  return <div className="rounded-circle bg-light border d-flex align-items-center justify-content-center fw-bold text-secondary" style={{ width: size, height: size }}>{String(student?.name || "S").slice(0,1).toUpperCase()}</div>;
}

function MiniSelect({ value, options, onChange, className = "" }) {
  const bad = ["issue", "no", "concern", "not_taken", "needs_attention"].includes(value);
  return <select className={`form-select form-select-sm ${bad ? "border-danger text-danger" : ""} ${className}`} value={value || options[options.length - 1][0]} onChange={(e) => onChange(e.target.value)}>
    {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
  </select>;
}

function statusConcernCount(r = {}) {
  let n = 0;
  const detailIssues = ["shirt_status", "bottom_status", "belt_status", "socks_status", "shoes_status", "headwear_status"].filter((f) => r[f] === "issue").length;
  n += detailIssues || (r.uniform_overall === "issue" ? 1 : 0);
  if (r.cleanliness_status === "issue") n += 1;
  if (r.tiffin_brought_status === "no") n += 1;
  if (r.tiffin_hygiene_status === "concern") n += 1;
  if (r.tiffin_taken_status === "not_taken") n += 1;
  if (r.water_bottle_status === "no") n += 1;
  if (r.general_observation === "needs_attention") n += 1;
  return n;
}

export default function DailyReadiness() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [cap, setCap] = useState({});
  const [classes, setClasses] = useState([]);
  const [pair, setPair] = useState(null);
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState(null);

  const isFamily = cap?.is_student_or_parent === true;

  const loadFamily = useCallback(async () => {
    const r = await dailyReadinessApi.myRecord({ month });
    setSummary({ family: true, students: r.data?.students || [] });
  }, [month]);

  const loadClassDay = useCallback(async (selectedPair = pair, selectedDate = date) => {
    if (!selectedPair) return;
    setLoading(true); setError(""); setMessage("");
    try {
      const r = await dailyReadinessApi.classDay({ class_id: selectedPair.class_id, section_id: selectedPair.section_id, date: selectedDate });
      const list = (r.data?.students || []).map((x) => ({ student: x.student, record: x.record ? { ...blankRecord(x.student.id), ...x.record, student_id: x.student.id } : blankRecord(x.student.id) }));
      setRows(list);
    } catch (e) { setError(errMsg(e)); }
    finally { setLoading(false); }
  }, [pair, date]);

  const boot = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const c = await dailyReadinessApi.capabilities();
      const capabilities = c.data || {};
      setCap(capabilities);
      if (capabilities.is_student_or_parent) {
        const mine = await dailyReadinessApi.myRecord({ month });
        setSummary({ family: true, students: mine.data?.students || [] });
      } else {
        const r = await dailyReadinessApi.classes();
        const list = r.data?.classes || [];
        setClasses(list);
        if (list.length) {
          setPair(list[0]);
          const day = await dailyReadinessApi.classDay({ class_id: list[0].class_id, section_id: list[0].section_id, date });
          setRows((day.data?.students || []).map((x) => ({ student: x.student, record: x.record ? { ...blankRecord(x.student.id), ...x.record, student_id: x.student.id } : blankRecord(x.student.id) })));
        }
      }
    } catch (e) { setError(errMsg(e)); }
    finally { setLoading(false); }
  }, [date, month]);

  useEffect(() => { boot(); }, [boot]);

  const patchRecord = (studentId, patch) => setRows((prev) => prev.map((row) => row.student.id === studentId ? { ...row, record: { ...row.record, ...patch } } : row));

  const markReadinessOk = () => {
    setRows((prev) => prev.map((row) => ({ ...row, record: { ...blankRecord(row.student.id, true), ...row.record, student_id: row.student.id,
      uniform_overall: "ok", shirt_status: "ok", bottom_status: "ok", belt_status: "ok", socks_status: "ok", shoes_status: "ok",
      cleanliness_status: "ok", tiffin_brought_status: "yes", tiffin_hygiene_status: "ok", water_bottle_status: "yes", general_observation: row.record?.general_observation || "normal",
      headwear_status: row.record?.headwear_status === "issue" || row.record?.headwear_status === "ok" ? row.record.headwear_status : "na",
    } })));
    setMessage("Readiness marked OK for the class. Edit only exceptions, then save.");
  };

  const markTiffinTaken = () => {
    setRows((prev) => prev.map((row) => ({ ...row, record: { ...row.record, tiffin_taken_status: "taken" } })));
    setMessage("Tiffin marked Taken for all. Change only students who did not take it or were not observed.");
  };

  const save = async () => {
    if (!pair || !rows.length) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const payload = { class_id: pair.class_id, section_id: pair.section_id, date, records: rows.map((x) => ({ ...x.record, student_id: x.student.id })) };
      const r = await dailyReadinessApi.saveClassDay(payload);
      setMessage(r.data?.message || "Daily readiness saved.");
      await loadClassDay(pair, date);
    } catch (e) { setError(errMsg(e)); }
    finally { setSaving(false); }
  };

  const loadSummary = async () => {
    setError("");
    try {
      if (isFamily) return loadFamily();
      if (!pair) return;
      const r = await dailyReadinessApi.monthlySummary({ class_id: pair.class_id, section_id: pair.section_id, month });
      setSummary(r.data || null);
    } catch (e) { setError(errMsg(e)); }
  };

  const editing = useMemo(() => rows.find((x) => x.student.id === editingId) || null, [rows, editingId]);
  const concernStudents = rows.filter((x) => statusConcernCount(x.record) > 0).length;

  if (loading && !rows.length && !summary) return <div className="container py-4"><div className="text-center py-5"><div className="spinner-border" /></div></div>;

  if (isFamily) {
    const students = summary?.students || [];
    return <div className="container-fluid py-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <div><h3 className="mb-1">My Daily Readiness</h3><div className="text-muted">School-shared readiness, hygiene and tiffin records. Food quantity is not rated.</div></div>
        <div className="d-flex gap-2"><input type="month" className="form-control" value={month} onChange={(e) => setMonth(e.target.value)} /><button className="btn btn-primary" onClick={loadFamily}>Load</button></div>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {students.length === 0 && <div className="card"><div className="card-body text-muted">No shared readiness records found.</div></div>}
      {students.map((item) => <div className="card shadow-sm border-0 mb-4" key={item.student?.id}>
        <div className="card-body">
          <div className="d-flex align-items-center gap-3 mb-3"><Avatar student={item.student} size={54}/><div><h5 className="mb-0">{item.student?.name}</h5><div className="text-muted small">Roll {item.student?.roll_number || "-"} • {item.summary?.days_recorded || 0} recorded days</div></div></div>
          <div className="row g-2 mb-3">
            <div className="col-md-3"><div className="p-3 rounded bg-light"><div className="small text-muted">All-OK days</div><div className="fs-5 fw-bold">{item.summary?.all_ok_days || 0}</div></div></div>
            <div className="col-md-3"><div className="p-3 rounded bg-light"><div className="small text-muted">Concern days</div><div className="fs-5 fw-bold">{item.summary?.concern_days || 0}</div></div></div>
            <div className="col-md-3"><div className="p-3 rounded bg-light"><div className="small text-muted">Positive days</div><div className="fs-5 fw-bold">{item.summary?.positive_days || 0}</div></div></div>
            <div className="col-md-3"><div className="p-3 rounded bg-light"><div className="small text-muted">Readiness trend</div><div className="fs-5 fw-bold">{item.summary?.readiness_percent == null ? "-" : `${item.summary.readiness_percent}%`}</div></div></div>
          </div>
          <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Date</th><th>Uniform</th><th>Cleanliness</th><th>Tiffin</th><th>Hygiene</th><th>Taken</th><th>Observation</th><th>Note</th></tr></thead><tbody>
            {(item.records || []).map((r) => <tr key={r.id}><td>{r.record_date}</td><td>{r.uniform_overall}</td><td>{r.cleanliness_status}</td><td>{r.tiffin_brought_status}</td><td>{r.tiffin_hygiene_status}</td><td>{r.tiffin_taken_status}</td><td>{String(r.general_observation || "").replaceAll("_", " ")}</td><td>{r.family_note || "-"}</td></tr>)}
          </tbody></table></div>
        </div>
      </div>)}
    </div>;
  }

  return <div className="container-fluid py-4">
    <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
      <div><h3 className="mb-1">Daily Readiness & Hygiene</h3><div className="text-muted">Quick class-incharge check. Start with defaults, then record only exceptions.</div></div>
      <div className="d-flex flex-wrap gap-2">
        <button className="btn btn-outline-success" onClick={markReadinessOk}><i className="bi bi-check2-all me-1"/>Mark Readiness OK</button>
        <button className="btn btn-outline-primary" onClick={markTiffinTaken}><i className="bi bi-lunch-box me-1"/>Mark Tiffin Taken</button>
        <button className="btn btn-primary" disabled={saving || !rows.length} onClick={save}>{saving ? "Saving..." : "Save Full Class"}</button>
      </div>
    </div>

    <div className="card border-0 shadow-sm mb-3"><div className="card-body"><div className="row g-3 align-items-end">
      <div className="col-lg-5"><label className="form-label">Class / Section</label><select className="form-select" value={pair ? `${pair.class_id}:${pair.section_id}` : ""} onChange={async (e) => { const hit = classes.find((x) => `${x.class_id}:${x.section_id}` === e.target.value); setPair(hit || null); if (hit) await loadClassDay(hit, date); }}>
        {classes.map((x) => <option key={`${x.class_id}:${x.section_id}`} value={`${x.class_id}:${x.section_id}`}>{x.class_name} - {x.section_name}{x.incharge?.name ? ` • Incharge: ${x.incharge.name}` : ""}</option>)}
      </select></div>
      <div className="col-lg-3"><label className="form-label">Date</label><input className="form-control" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="col-lg-2"><button className="btn btn-outline-secondary w-100" onClick={() => loadClassDay(pair, date)}>Load Day</button></div>
      <div className="col-lg-2"><div className={`p-2 rounded text-center ${concernStudents ? "bg-warning-subtle" : "bg-success-subtle"}`}><div className="small">Students with concern</div><strong>{concernStudents}</strong></div></div>
    </div></div></div>

    {error && <div className="alert alert-danger">{error}</div>}
    {message && <div className="alert alert-info">{message}</div>}
    {!classes.length && <div className="alert alert-warning">No class-incharge assignment found for this account.</div>}

    <div className="card border-0 shadow-sm mb-4"><div className="card-body p-0"><div className="table-responsive"><table className="table table-hover align-middle mb-0">
      <thead className="table-light"><tr><th style={{minWidth:220}}>Student</th><th>Uniform</th><th>Cleanliness</th><th>Tiffin brought</th><th>Tiffin hygiene</th><th>Tiffin taken</th><th>Observation</th><th>Details</th></tr></thead>
      <tbody>{rows.map(({ student, record }) => <tr key={student.id} className={statusConcernCount(record) ? "table-warning" : ""}>
        <td><div className="d-flex align-items-center gap-2"><Avatar student={student}/><div><div className="fw-semibold">{student.name}</div><div className="small text-muted">Roll {student.roll_number || "-"} • Adm {student.admission_number || "-"}</div></div></div></td>
        <td><MiniSelect value={record.uniform_overall} options={detailOptions} onChange={(v) => patchRecord(student.id, { uniform_overall: v })}/></td>
        <td><MiniSelect value={record.cleanliness_status} options={detailOptions} onChange={(v) => patchRecord(student.id, { cleanliness_status: v })}/></td>
        <td><MiniSelect value={record.tiffin_brought_status} options={yesNoOptions} onChange={(v) => patchRecord(student.id, { tiffin_brought_status: v })}/></td>
        <td><MiniSelect value={record.tiffin_hygiene_status} options={hygieneOptions} onChange={(v) => patchRecord(student.id, { tiffin_hygiene_status: v })}/></td>
        <td><MiniSelect value={record.tiffin_taken_status} options={takenOptions} onChange={(v) => patchRecord(student.id, { tiffin_taken_status: v })}/></td>
        <td><MiniSelect value={record.general_observation} options={observationOptions} onChange={(v) => patchRecord(student.id, { general_observation: v })}/></td>
        <td><button className={`btn btn-sm ${statusConcernCount(record) ? "btn-warning" : "btn-outline-secondary"}`} onClick={() => setEditingId(student.id)}>{statusConcernCount(record) ? `${statusConcernCount(record)} issue(s)` : "Uniform details"}</button></td>
      </tr>)}</tbody>
    </table></div></div></div>

    {editing && <div className="card border-primary shadow-sm mb-4"><div className="card-header d-flex justify-content-between align-items-center"><div className="d-flex align-items-center gap-2"><Avatar student={editing.student}/><strong>{editing.student.name} — Detailed Check</strong></div><button className="btn-close" onClick={() => setEditingId(null)}/></div><div className="card-body">
      <div className="row g-3">
        {[["shirt_status","Shirt"],["bottom_status","Trousers / Skirt"],["belt_status","Belt"],["socks_status","Socks"],["shoes_status","Shoes"],["headwear_status","Turban / Headwear (as applicable)"],["water_bottle_status","Water bottle"]].map(([field,label]) => <div className="col-md-4" key={field}><label className="form-label">{label}</label><MiniSelect value={editing.record[field]} options={field === "water_bottle_status" ? yesNoOptions : detailOptions} onChange={(v) => patchRecord(editing.student.id, { [field]: v })}/></div>)}
        <div className="col-md-4"><label className="form-label">Family visibility</label><select className="form-select" value={editing.record.family_visible === false ? "no" : "yes"} onChange={(e) => patchRecord(editing.student.id, { family_visible: e.target.value === "yes" })}><option value="yes">Visible to student/parent</option><option value="no">Internal only</option></select></div>
        <div className="col-md-6"><label className="form-label">Internal observation</label><textarea className="form-control" rows="2" value={editing.record.internal_note || ""} onChange={(e) => patchRecord(editing.student.id, { internal_note: e.target.value })} placeholder="Internal class-incharge note (optional)" /></div>
        <div className="col-md-6"><label className="form-label">Family note</label><textarea className="form-control" rows="2" value={editing.record.family_note || ""} onChange={(e) => patchRecord(editing.student.id, { family_note: e.target.value })} placeholder="Short respectful note visible in app (optional)" /></div>
      </div>
      <div className="small text-muted mt-3">Tiffin records only whether it was brought/taken and any hygiene concern. The module intentionally does not rate food quantity or compare students.</div>
    </div></div>}

    <div className="card border-0 shadow-sm"><div className="card-body">
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3"><div><h5 className="mb-1">Monthly Class Summary</h5><div className="text-muted small">Useful for class-incharge review and a branded school PDF.</div></div><div className="d-flex gap-2"><input type="month" className="form-control" value={month} onChange={(e) => setMonth(e.target.value)} /><button className="btn btn-outline-primary" onClick={loadSummary}>Load Summary</button><button className="btn btn-outline-dark" disabled={!pair} onClick={() => pair && dailyReadinessApi.downloadClassPdf({ class_id: pair.class_id, section_id: pair.section_id, month })}><i className="bi bi-file-earmark-pdf me-1"/>PDF</button></div></div>
      {summary && !summary.family && <><div className="row g-2 mb-3"><div className="col-md-4"><div className="p-3 bg-light rounded"><div className="small text-muted">Class days recorded</div><div className="fs-4 fw-bold">{summary.class_days_recorded || 0}</div></div></div><div className="col-md-8"><div className="p-3 bg-light rounded"><div className="small text-muted">Most common concerns</div><div className="fw-semibold">{(summary.common_concerns || []).slice(0,4).map((x) => `${x.label} (${x.count})`).join(" • ") || "None"}</div></div></div></div>
        <div className="table-responsive"><table className="table table-sm"><thead><tr><th>Student</th><th>Days</th><th>All OK</th><th>Concern days</th><th>Positive days</th><th>Common concerns</th></tr></thead><tbody>{(summary.rows || []).map((r) => <tr key={r.student?.id}><td>{r.student?.name}</td><td>{r.summary?.days_recorded || 0}</td><td>{r.summary?.readiness_percent == null ? "-" : `${r.summary.readiness_percent}%`}</td><td>{r.summary?.concern_days || 0}</td><td>{r.summary?.positive_days || 0}</td><td>{(r.summary?.common_concerns || []).slice(0,3).map((x) => `${x.label} (${x.count})`).join(" • ") || "-"}</td></tr>)}</tbody></table></div></>}
    </div></div>
  </div>;
}
