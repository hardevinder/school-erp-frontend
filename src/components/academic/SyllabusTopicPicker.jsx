import React, { useEffect, useState } from "react";
import api from "../../api";

const splitTopics = (text) => [...new Set(String(text || "").split(/\r?\n|,|;/).map((part) => part.trim()).filter(Boolean))];

export default function SyllabusTopicPicker({ classId, subjectId, description, onChange }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");
  const [retry, setRetry] = useState(0);
  const [unit, setUnit] = useState("");
  useEffect(() => {
    let active = true;
    setRows([]);
    setUnit("");
    if (!classId || !subjectId) { setStatus(""); return () => { active = false; }; }
    setStatus("loading");
    api.get("/syllabus-breakdowns/link-options", { params: { classId, subjectId } })
      .then((response) => {
        if (!active) return;
        const data = response?.data?.data ?? response?.data;
        setRows(Array.isArray(data) ? data : []);
        setStatus("");
      })
      .catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [classId, subjectId, retry]);

  const selected = String(description || "").split(/\r?\n/).map((line) => line.trim());
  const unitKey = (row, item) => `${row.id}:${item.id}`;
  const unitLabel = (item) => [item.unitNumber, item.unitTitle].filter(Boolean).join(" · ") || `Unit ${item.sequence || item.id}`;
  const visibleRows = rows.map((row) => ({ ...row, items: (row.items || []).filter((item) => !unit || unitKey(row, item) === unit) })).filter((row) => row.items.length);
  const toggle = (topic) => {
    const lines = String(description || "").split(/\r?\n/);
    onChange(selected.includes(topic)
      ? lines.filter((line) => line.trim() !== topic).join("\n")
      : [...lines.filter((line) => line.trim()), topic].join("\n"));
  };
  return <div className="my-3 p-3 border rounded" aria-label="Syllabus topics">
    <strong>Select from syllabus breakup</strong>
    <p className="small text-muted mb-2">Select topic or subtopic buttons to add them to the learning focus below. Click again to remove.</p>
    {!classId || !subjectId ? <p className="small mb-0">Choose a class and subject to see syllabus topics.</p>
      : status === "loading" ? <p role="status" className="small mb-0">Loading syllabus topics…</p>
      : status === "error" ? <div role="alert">Could not load syllabus topics. <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>
      : !rows.some((row) => row.items?.length) ? <p className="small mb-0">No syllabus breakup is available for this class and subject. You can enter topics below.</p>
      : <>
      <div role="group" aria-label="Filter by unit" className="mb-3">
        <div className="small fw-semibold mb-2">Filter by unit</div>
        <button type="button" aria-pressed={!unit} className={`btn btn-sm ${!unit ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setUnit("")}>All units</button>
        {rows.filter((row) => row.items?.length).map((row) => <div key={row.id} className="mt-2">
          {rows.length > 1 && <div className="small text-muted mb-1">{[row.academicSession, row.term || "Full year", row.teacher?.name, row.status].filter(Boolean).join(" · ")}</div>}
          <div className="d-flex flex-wrap gap-2">{row.items.map((item) => <button key={item.id} type="button" aria-pressed={unit === unitKey(row, item)} className={`btn btn-sm ${unit === unitKey(row, item) ? "btn-primary" : "btn-outline-primary"}`} style={{ whiteSpace: "normal", textAlign: "left" }} onClick={() => setUnit(unitKey(row, item))}>{unitLabel(item)}</button>)}</div>
        </div>)}
      </div>
      <p className="small text-muted">Filtering keeps topics already added to your learning focus.</p>
      {visibleRows.map((row) => <details key={row.id} open={Boolean(unit) || visibleRows.length === 1} className="mb-2">
        <summary>{[row.academicSession, String(row.term || "Full year").replaceAll("_", " "), row.teacher?.name, row.status].filter(Boolean).join(" · ")}</summary>
        {(row.items || []).map((item) => <div key={item.id} className="mt-3">
          <div className="fw-semibold small mb-2">{unitLabel(item)}</div>
          {[["Topics", item.topics], ["Subtopics", item.subtopics]].map(([label, value]) => <div key={label}>
            {splitTopics(value).length > 0 && <><div className="small text-muted mb-1">{label}</div><div className="d-flex flex-wrap gap-2 mb-2">{splitTopics(value).map((topic) => <button key={topic} type="button" aria-pressed={selected.includes(topic)} className={`btn btn-sm ${selected.includes(topic) ? "btn-primary" : "btn-outline-primary"}`} style={{ whiteSpace: "normal", textAlign: "left" }} onClick={() => toggle(topic)}>{topic}</button>)}</div></>}
          </div>)}
        </div>)}
      </details>)}</>}
  </div>;
}
