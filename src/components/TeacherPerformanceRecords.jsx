import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "react-bootstrap";
import teacherPerformanceApi from "../services/teacherPerformanceApi";

export const RECORD_VIEWS = [
  { kind: "TIMETABLE", label: "Timetable", icon: "calendar-week", hint: "Days, periods & subjects" },
  { kind: "ATTENDANCE", label: "Attendance", icon: "person-check", hint: "Daily status & punch times" },
  { kind: "DIARY", label: "Diaries", icon: "journal-text", hint: "Homework & class updates" },
  { kind: "LESSON_PLAN", label: "Lesson plans", icon: "journal-check", hint: "Topics & planning status" },
  { kind: "SYLLABUS", label: "Syllabus", icon: "book", hint: "Units & planned months" },
];

export default function TeacherPerformanceRecords({ kind, teacherId, teacherName, month, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setData(null); setError(""); setQuery(""); setPage(0);
    teacherPerformanceApi.records({ kind, teacher_user_id: teacherId, month })
      .then(response => { if (active) setData(response.data.data); })
      .catch(e => { if (active) setError(e?.response?.data?.message || "Unable to load records. Please try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind, teacherId, month, attempt]);
  const rows = useMemo(() => (data?.rows || []).filter(row =>
    [...(data?.columns || []).map(c => row[c.key]), row.content].some(value =>
      String(value || "").toLowerCase().includes(query.trim().toLowerCase()))), [data, query]);
  const visible = rows.slice(page * 20, page * 20 + 20);
  const title = RECORD_VIEWS.find(view => view.kind === kind)?.label || "Records";
  return <Modal show onHide={onClose} size="xl" centered scrollable aria-labelledby="performance-records-title" className="performance-records-modal">
    <Modal.Header closeButton>
      <div><Modal.Title id="performance-records-title">{title}</Modal.Title>
        <div className="small text-muted mt-1">{teacherName} · {month}</div>
      </div>
    </Modal.Header>
    <Modal.Body>
      {loading && <div role="status" className="text-center py-5"><span className="spinner-border spinner-border-sm me-2" />Loading {title.toLowerCase()}…</div>}
      {error && <div role="alert" className="alert alert-danger">{error}<button className="btn btn-sm btn-outline-danger ms-3" onClick={() => setAttempt(n => n + 1)}>Retry</button></div>}
      {!loading && !error && data && <>
        <div className="alert alert-light border small">{data.note}</div>
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div className="small text-muted">{rows.length} of {data.rows.length} records · {data.period?.start} to {data.period?.end}</div>
          <input type="search" className="form-control" style={{ maxWidth: 320 }} aria-label={`Search ${title.toLowerCase()}`} placeholder="Search these records…" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} />
        </div>
        {!rows.length ? <div className="text-center border rounded p-5"><i className="bi bi-search fs-2 text-muted" /><h6 className="mt-3">{query ? "No matching records" : `No ${title.toLowerCase()} records found`}</h6><p className="text-muted mb-0">{query ? "Try another search or clear the filter." : "No entries are available for this teacher in the scope described above."}</p></div> : <>
          <div className="table-responsive"><table className="table table-hover align-middle">
            <caption className="visually-hidden">{teacherName} — {title} — {month}</caption>
            <thead className="table-light"><tr>{data.columns.map(c => <th scope="col" key={c.key}>{c.label}</th>)}</tr></thead>
            <tbody>{visible.map((row, i) => <tr key={row.id ?? i}>{data.columns.map(c => <td key={c.key}>
              {c.key === "title" && row.content ? <details><summary className="fw-semibold">{row.title || "Read entry"}</summary><div className="performance-record-content mt-2">{row.content}</div></details> : String(row[c.key] ?? "—") || "—"}
            </td>)}</tr>)}</tbody>
          </table></div>
          {rows.length > 20 && <nav aria-label="Record pages" className="d-flex justify-content-end gap-3 align-items-center mt-3">
            <button className="btn btn-sm btn-outline-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
            <span className="small">Page {page + 1} of {Math.ceil(rows.length / 20)}</span>
            <button className="btn btn-sm btn-outline-secondary" disabled={(page + 1) * 20 >= rows.length} onClick={() => setPage(p => p + 1)}>Next</button>
          </nav>}
        </>}
      </>}
    </Modal.Body>
    <Modal.Footer><button className="btn btn-secondary" onClick={onClose}>Close</button></Modal.Footer>
  </Modal>;
}
