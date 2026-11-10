import React, { useEffect, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import teacherPerformanceApi from "../services/teacherPerformanceApi";

export default function TeacherTermAcademicIntelligence({ teacherId, isManager }) {
  const [data, setData] = useState(null);
  const [termId, setTermId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setTermId(""); }, [teacherId]);
  useEffect(() => {
    if (!teacherId) return undefined;
    let active = true;
    setLoading(true); setError(""); setData(null);
    const params = { ...(isManager ? { teacher_user_id: teacherId } : {}), ...(termId ? { term_id: termId } : {}) };
    teacherPerformanceApi.termAcademicIntelligence(params)
      .then((response) => { if (active) setData(response.data); })
      .catch((e) => { if (active) setError(e?.response?.data?.message || e.message || "Unable to load term analytics"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [teacherId, isManager, termId]);
  const summary = data?.summary || {};
  const groups = data?.groups || [];
  const assessments = data?.assessments || [];
  return <section className="card border-0 shadow-sm mb-4" aria-label="Teacher term academic intelligence">
    <div className="card-body p-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <div><div className="text-uppercase small fw-bold text-primary">Academic Result Intelligence</div>
          <h4 className="mb-1">Term Results · Assigned Classes &amp; Subjects</h4>
          <div className="text-muted small">{data?.academic_year || "Current academic year"} · Report-card calculation rules</div></div>
        <label className="small fw-semibold">Exam term
          <select className="form-select mt-1" value={termId || data?.selected_term_id || ""}
            onChange={(e) => setTermId(e.target.value)} disabled={loading || !(data?.term_options?.length)}>
            {(data?.term_options || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select></label>
      </div>
      {loading && <div className="text-muted py-4" role="status">Loading verified term results…</div>}
      {error && <div className="alert alert-warning">{error}</div>}
      {!loading && !error && data && <>
        {data.warning && <div className="alert alert-warning small">{data.warning}</div>}
        <div className="row g-3 mb-4">
          {[["Recorded assessment average", summary.average == null ? "—" : `${summary.average}%`],
            ["Students assessed", summary.assessed_students ?? 0],
            ["Class / subject groups", summary.class_subject_groups ?? 0],
            ["Assessment marks samples", summary.assessment_samples ?? 0]].map(([label, value]) =>
            <div className="col-6 col-lg-3" key={label}><div className="rounded-3 border bg-light p-3 h-100">
              <div className="small text-muted">{label}</div><div className="fs-3 fw-bold mt-1">{value}</div>
            </div></div>)}
        </div>
        {!groups.length ? <p className="text-muted mb-2">{data.message || "No assessed results found for this teacher's assigned subjects in this term."}</p> : <div className="row g-4">
          <div className="col-lg-7"><h6>Class &amp; subject averages</h6><div style={{ height: Math.max(230, Math.min(540, groups.length * 46)) }}>
            <ResponsiveContainer width="100%" height="100%"><BarChart data={groups} layout="vertical" margin={{ left: 12, right: 28 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" domain={[0, 100]} unit="%" />
              <YAxis type="category" dataKey="label" width={145} tick={{fontSize:11}}/>
              <Tooltip formatter={(value) => [`${value}%`, "Recorded assessment average"]}/><Bar dataKey="average" fill="#3478c0" radius={[0,5,5,0]}/>
            </BarChart></ResponsiveContainer></div></div>
          <div className="col-lg-5"><h6>Assessment breakdown</h6><div className="table-responsive"><table className="table table-sm align-middle">
            <thead><tr><th>Component</th><th className="text-end">Average</th><th className="text-end">Samples</th></tr></thead>
            <tbody>{assessments.map((a, i) => <tr key={`${a.name}-${i}`}><td>{a.name}</td><td className="text-end fw-semibold">{a.average}%</td><td className="text-end">{a.count}</td></tr>)}</tbody>
          </table></div></div>
        </div>}
        <p className="small text-muted mt-3 mb-0">{data.note}</p>
      </>}
    </div>
  </section>;
}
