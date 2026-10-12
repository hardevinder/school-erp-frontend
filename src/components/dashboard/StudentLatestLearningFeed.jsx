import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";

export default function StudentLatestLearningFeed({ refreshKey = 0 }) {
  const [items, setItems] = useState([]);
  const [read, setRead] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([
      api.get("/learning-resources/my"),
      api.get("/api/assessments"),
      api.get("/learning-resources/my/views"),
    ]).then(([materials, assessments, views]) => {
      if (!active) return;
      const output = [];
      if (materials.status === "fulfilled") (materials.value.data?.resources || []).forEach((m) => output.push({
        key: `material:${m.id}`, kind: "material", id: m.id, category: "Study Material", title: m.title,
        date: m.published_at || m.createdAt, subject: m.subject?.name, to: "/learning-resources",
      }));
      if (assessments.status === "fulfilled") {
        const rows = assessments.value.data?.data || [];
        (Array.isArray(rows) ? rows : []).filter((a) => ["published", "closed", "evaluated", "result_published"].includes(a.status)).forEach((a) => output.push({
          key: `assessment:${a.id}`, kind: "assessment", id: a.id,
          category: ({ test: "Test", quiz: "Quiz", worksheet: "Worksheet", assignment: "Assignment", practice: "Practice" })[a.assessment_type] || "Assessment",
          title: a.title, date: a.published_at || a.created_at || a.createdAt, subject: a.subject?.name, deadline: a.ends_at,
          to: "/assessments",
        }));
      }
      output.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      setItems(output.slice(0, 30));
      setRead(new Set(views.status === "fulfilled" ? views.value.data?.read || [] : []));
      setError(materials.status === "rejected" && assessments.status === "rejected" ? "Learning updates are temporarily unavailable." : views.status === "rejected" ? "Read tracking is unavailable until the database migration is applied." : "");
      setLoading(false);
    }).catch(() => { if (active) { setLoading(false); setError("Unable to load learning updates."); } });
    return () => { active = false; };
  }, [refreshKey]);
  const viewed = (item) => {
    if (read.has(item.key)) return;
    api.post(`/learning-resources/my/views/${item.kind}/${item.id}`).then(() => setRead((old) => new Set([...old, item.key]))).catch(() => {});
  };
  return <section className="mb-3 rounded-4 p-3 p-md-4" style={{ background: "linear-gradient(120deg,#ffffff,#f1f4ff)", border: "1px solid #d8e2f8", boxShadow: "0 6px 22px rgba(23,41,88,.08)" }} aria-label="Latest learning updates">
    <div className="d-flex justify-content-between align-items-center gap-2 mb-3 flex-wrap">
      <div><div className="small text-uppercase fw-bold text-primary">Your personal learning feed</div><h2 className="h4 mb-1 fw-bold">Latest for You ✨</h2><p className="text-muted small mb-0">New notes, tests, worksheets and assignments from your teachers.</p></div>
      <span className="badge text-bg-danger rounded-pill px-3 py-2">{items.filter((x) => !read.has(x.key)).length} unread</span>
    </div>
    {error && <div className="alert alert-warning small py-2" role="status">{error}</div>}
    {loading ? <p className="text-muted mb-0">Loading learning updates…</p> : items.length ? <div className="row g-2">{items.slice(0, 8).map((item) => {
      const isNew = !read.has(item.key);
      return <div className="col-12 col-lg-6" key={item.key}><Link to={item.to} onClick={() => viewed(item)} className="d-flex rounded-3 h-100 p-3 gap-3 text-decoration-none" style={{ background: isNew ? "#fff7df" : "#fff", border: `1px solid ${isNew ? "#efc568" : "#e5e7eb"}`, color: "#282d3e" }}>
        <span className="rounded-3 flex-shrink-0 d-flex align-items-center justify-content-center" style={{ background: isNew ? "#ffdfa2" : "#eef2ff", width: 46, height: 46 }}><i className={`bi ${item.kind === "material" ? "bi-book" : "bi-journal-check"} fs-4`} /></span>
        <span className="flex-grow-1" style={{ minWidth: 0 }}><span className="d-flex gap-2 flex-wrap align-items-center mb-1"><span className="small text-primary fw-semibold">{item.category}</span>{isNew && <span className="badge text-bg-danger rounded-pill">NEW</span>}</span><strong className="d-block text-truncate">{item.title}</strong><small className="text-muted">{[item.subject, item.date && new Date(item.date).toLocaleDateString(), item.deadline && `Due ${new Date(item.deadline).toLocaleDateString()}`].filter(Boolean).join(" · ")}</small></span>
        <i className="bi bi-arrow-up-right text-muted" /></Link></div>;
    })}</div> : <div className="text-muted bg-white rounded-3 p-4 text-center">No published learning activities assigned to you yet.</div>}
    {items.length > 8 && <p className="small text-muted mt-3 mb-0">Showing the latest 8 updates. Open your learning modules to explore more.</p>}
  </section>;
}
