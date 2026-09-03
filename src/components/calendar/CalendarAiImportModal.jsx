import React, { useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import api from "../../api";

const EVENT_TYPES = [
  "HOLIDAY", "VACATION", "EXAM", "PTM", "ACTIVITY", "EVENT", "TRAINING",
  "SYLLABUS_DEADLINE", "RESULT", "OTHER",
];

const confidenceLabel = (value) => {
  const score = Math.round((Number(value) || 0) * 100);
  if (score >= 85) return { score, className: "text-bg-success" };
  if (score >= 70) return { score, className: "text-bg-warning" };
  return { score, className: "text-bg-danger" };
};

const updateAt = (rows, index, key, value) =>
  rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row);

export default function CalendarAiImportModal({ calendar, onClose, onImported }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [draft, setDraft] = useState(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [tab, setTab] = useState("events");

  const reviewCount = useMemo(() => {
    if (!draft) return 0;
    return [...(draft.events || []), ...(draft.notes || [])].filter((item) => item.needs_review).length;
  }, [draft]);

  const chooseFile = (selected) => {
    if (!selected) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(selected.type)) {
      Swal.fire("Unsupported file", "Please choose a PDF, JPG, PNG or WEBP calendar.", "warning");
      return;
    }
    if (selected.size > 25 * 1024 * 1024) {
      Swal.fire("File too large", "Maximum calendar file size is 25 MB.", "warning");
      return;
    }
    setFile(selected);
    setDraft(null);
  };

  const analyze = async () => {
    if (!file) return Swal.fire("Choose a file", "Upload a calendar PDF or image first.", "info");
    setAnalyzing(true);
    try {
      const form = new FormData();
      form.append("calendar_document", file);
      const response = await api.post(`/academic-calendars/${calendar.id}/ai-analyze`, form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 180000,
      });
      setDraft(response.data);
      setTab((response.data?.events || []).length ? "events" : "notes");
    } catch (error) {
      Swal.fire("AI analysis failed", error?.response?.data?.error || "The calendar could not be analyzed.", "error");
    } finally {
      setAnalyzing(false);
    }
  };

  const importDraft = async () => {
    const invalidEvents = (draft?.events || []).filter((item) => !item.title || !item.start_date || !item.end_date);
    const invalidNotes = (draft?.notes || []).filter((item) => !item.note_month || !item.note_text);
    if (invalidEvents.length || invalidNotes.length) {
      return Swal.fire("Complete highlighted rows", "Every event needs a title and dates; every note needs a month and note text.", "warning");
    }

    if (replaceExisting) {
      const confirmation = await Swal.fire({
        title: "Replace existing calendar data?",
        text: "Existing events and monthly notes in this draft calendar will be replaced.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Replace and import",
        confirmButtonColor: "#dc2626",
      });
      if (!confirmation.isConfirmed) return;
    }

    setImporting(true);
    try {
      const response = await api.post(`/academic-calendars/${calendar.id}/ai-import`, {
        events: draft?.events || [],
        notes: draft?.notes || [],
        replace_existing: replaceExisting,
      });
      const imported = response.data?.imported || {};
      await Swal.fire("Imported", `${imported.events || 0} events and ${imported.notes || 0} notes added.`, "success");
      onImported?.();
      onClose();
    } catch (error) {
      const details = error?.response?.data?.validation_errors;
      Swal.fire(
        "Import failed",
        details?.length ? details.slice(0, 8).join("\n") : error?.response?.data?.error || "Could not import the reviewed calendar.",
        "error"
      );
    } finally {
      setImporting(false);
    }
  };

  const events = draft?.events || [];
  const notes = draft?.notes || [];

  return (
    <div className="modal show d-block calendar-modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-dialog modal-fullscreen-xl-down modal-xl modal-dialog-scrollable">
        <div className="modal-content calendar-modal-shell">
          <div className="calendar-ai-header">
            <div className="calendar-ai-icon"><i className="bi bi-stars" /></div>
            <div>
              <div className="calendar-eyebrow">AI DOCUMENT IMPORT</div>
              <h4 className="mb-1">Turn a PDF or handwritten calendar into a draft</h4>
              <div className="calendar-ai-subtitle">
                {calendar?.title || "Academic Calendar"} · {calendar?.academic_session}
              </div>
            </div>
            <button className="btn-close btn-close-white ms-auto" onClick={onClose} aria-label="Close" />
          </div>

          <div className="modal-body p-0">
            {!draft ? (
              <div className="calendar-import-start">
                <div
                  className={`calendar-dropzone ${dragging ? "is-dragging" : ""}`}
                  onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    chooseFile(event.dataTransfer.files?.[0]);
                  }}
                  onClick={() => inputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => { if (event.key === "Enter") inputRef.current?.click(); }}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    hidden
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(event) => chooseFile(event.target.files?.[0])}
                  />
                  <div className="calendar-upload-orb"><i className="bi bi-cloud-arrow-up" /></div>
                  <h5>{file ? file.name : "Drop calendar here or browse"}</h5>
                  <p>Designed PDF, scanned PDF, JPG, PNG or WEBP · maximum 25 MB</p>
                  {file && <span className="badge text-bg-light border">{(file.size / 1024 / 1024).toFixed(2)} MB</span>}
                </div>

                <div className="calendar-import-promise row g-3">
                  <div className="col-md-4"><i className="bi bi-calendar2-check" /><b>Events</b><span>Dates, titles, types and class scope</span></div>
                  <div className="col-md-4"><i className="bi bi-journal-text" /><b>Monthly notes</b><span>Footer notes, themes and date ranges</span></div>
                  <div className="col-md-4"><i className="bi bi-shield-check" /><b>Human review</b><span>Uncertain handwriting is highlighted</span></div>
                </div>

                <div className="d-flex justify-content-center mt-4">
                  <button className="btn btn-primary btn-lg px-5" disabled={!file || analyzing} onClick={analyze}>
                    {analyzing ? <><span className="spinner-border spinner-border-sm me-2" />Reading every page...</> : <><i className="bi bi-stars me-2" />Analyze calendar</>}
                  </button>
                </div>
              </div>
            ) : (
              <div className="calendar-review-wrap">
                <div className="calendar-review-summary">
                  <div><span>Detected</span><b>{draft.document?.school_name || "School calendar"}</b></div>
                  <div><span>Events</span><b>{events.length}</b></div>
                  <div><span>Monthly notes</span><b>{notes.length}</b></div>
                  <div className={reviewCount ? "needs-attention" : "is-clear"}><span>Needs review</span><b>{reviewCount}</b></div>
                </div>

                {(draft.warnings || []).length > 0 && (
                  <div className="alert alert-warning d-flex gap-2 align-items-start mx-4 mt-3 mb-0">
                    <i className="bi bi-exclamation-triangle-fill" />
                    <div><b>Please review:</b> {(draft.warnings || []).join(" · ")}</div>
                  </div>
                )}

                <div className="calendar-review-tabs px-4 pt-3">
                  <button className={tab === "events" ? "active" : ""} onClick={() => setTab("events")}>Events <span>{events.length}</span></button>
                  <button className={tab === "notes" ? "active" : ""} onClick={() => setTab("notes")}>Monthly Notes <span>{notes.length}</span></button>
                  <button className="ms-auto reupload" onClick={() => setDraft(null)}><i className="bi bi-arrow-repeat me-1" />Choose another file</button>
                </div>

                {tab === "events" && (
                  <div className="table-responsive calendar-review-table-wrap">
                    <table className="table align-middle calendar-review-table">
                      <thead><tr><th>Status</th><th style={{ minWidth: 145 }}>Type</th><th style={{ minWidth: 260 }}>Event title</th><th style={{ minWidth: 145 }}>Start</th><th style={{ minWidth: 145 }}>End</th><th style={{ minWidth: 130 }}>Scope</th><th>Work</th><th /></tr></thead>
                      <tbody>
                        {events.map((item, index) => {
                          const confidence = confidenceLabel(item.confidence);
                          const invalid = !item.title || !item.start_date || !item.end_date;
                          return (
                            <tr key={item.client_id || index} className={item.needs_review || invalid ? "review-row-warning" : ""}>
                              <td><span className={`badge ${confidence.className}`}>{confidence.score}%</span>{item.needs_review && <i className="bi bi-exclamation-circle-fill text-warning ms-2" title={(item.warnings || []).join(" · ")} />}</td>
                              <td><select className="form-select form-select-sm" value={item.type} onChange={(event) => setDraft((old) => ({ ...old, events: updateAt(old.events, index, "type", event.target.value) }))}>{EVENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></td>
                              <td><input className={`form-control form-control-sm ${!item.title ? "is-invalid" : ""}`} value={item.title || ""} onChange={(event) => setDraft((old) => ({ ...old, events: updateAt(old.events, index, "title", event.target.value) }))} /><small title={item.source_text || ""}>{item.source_text || item.description || ""}</small></td>
                              <td><input type="date" className={`form-control form-control-sm ${!item.start_date ? "is-invalid" : ""}`} value={item.start_date || ""} onChange={(event) => setDraft((old) => ({ ...old, events: updateAt(old.events, index, "start_date", event.target.value) }))} /></td>
                              <td><input type="date" className={`form-control form-control-sm ${!item.end_date ? "is-invalid" : ""}`} value={item.end_date || ""} onChange={(event) => setDraft((old) => ({ ...old, events: updateAt(old.events, index, "end_date", event.target.value) }))} /></td>
                              <td><input className="form-control form-control-sm" value={item.class_scope || "ALL"} onChange={(event) => setDraft((old) => ({ ...old, events: updateAt(old.events, index, "class_scope", event.target.value) }))} /></td>
                              <td><input className="form-check-input" type="checkbox" checked={Boolean(item.is_working_day)} onChange={(event) => setDraft((old) => ({ ...old, events: updateAt(old.events, index, "is_working_day", event.target.checked) }))} /></td>
                              <td><button className="btn btn-sm btn-outline-danger" onClick={() => setDraft((old) => ({ ...old, events: old.events.filter((_, rowIndex) => rowIndex !== index) }))}><i className="bi bi-trash" /></button></td>
                            </tr>
                          );
                        })}
                        {!events.length && <tr><td colSpan="8" className="text-center text-muted py-5">No dated events detected. You can continue with monthly notes only.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}

                {tab === "notes" && (
                  <div className="table-responsive calendar-review-table-wrap">
                    <table className="table align-middle calendar-review-table">
                      <thead><tr><th>Status</th><th style={{ minWidth: 150 }}>Display month</th><th style={{ minWidth: 180 }}>Title / Theme</th><th style={{ minWidth: 320 }}>Note</th><th style={{ minWidth: 145 }}>From</th><th style={{ minWidth: 145 }}>To</th><th /></tr></thead>
                      <tbody>
                        {notes.map((item, index) => {
                          const confidence = confidenceLabel(item.confidence);
                          return (
                            <tr key={item.client_id || index} className={item.needs_review ? "review-row-warning" : ""}>
                              <td><span className={`badge ${confidence.className}`}>{confidence.score}%</span>{item.needs_review && <i className="bi bi-exclamation-circle-fill text-warning ms-2" title={(item.warnings || []).join(" · ")} />}</td>
                              <td><input type="month" className={`form-control form-control-sm ${!item.note_month ? "is-invalid" : ""}`} value={(item.note_month || "").slice(0, 7)} onChange={(event) => setDraft((old) => ({ ...old, notes: updateAt(old.notes, index, "note_month", `${event.target.value}-01`) }))} /></td>
                              <td><input className="form-control form-control-sm" value={item.title || ""} onChange={(event) => setDraft((old) => ({ ...old, notes: updateAt(old.notes, index, "title", event.target.value) }))} /></td>
                              <td><textarea rows="2" className={`form-control form-control-sm ${!item.note_text ? "is-invalid" : ""}`} value={item.note_text || ""} onChange={(event) => setDraft((old) => ({ ...old, notes: updateAt(old.notes, index, "note_text", event.target.value) }))} /></td>
                              <td><input type="date" className="form-control form-control-sm" value={item.start_date || ""} onChange={(event) => setDraft((old) => ({ ...old, notes: updateAt(old.notes, index, "start_date", event.target.value || null) }))} /></td>
                              <td><input type="date" className="form-control form-control-sm" value={item.end_date || ""} onChange={(event) => setDraft((old) => ({ ...old, notes: updateAt(old.notes, index, "end_date", event.target.value || null) }))} /></td>
                              <td><button className="btn btn-sm btn-outline-danger" onClick={() => setDraft((old) => ({ ...old, notes: old.notes.filter((_, rowIndex) => rowIndex !== index) }))}><i className="bi bi-trash" /></button></td>
                            </tr>
                          );
                        })}
                        {!notes.length && <tr><td colSpan="7" className="text-center text-muted py-5">No monthly notes detected.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer calendar-ai-footer">
            <button className="btn btn-light" onClick={onClose}>Cancel</button>
            {draft && (
              <>
                <label className="form-check d-flex gap-2 align-items-center me-auto mb-0">
                  <input className="form-check-input mt-0" type="checkbox" checked={replaceExisting} onChange={(event) => setReplaceExisting(event.target.checked)} />
                  <span>Replace existing events and notes</span>
                </label>
                <span className="text-muted small">Import stays in DRAFT until you publish.</span>
                <button className="btn btn-primary px-4" disabled={importing || (!events.length && !notes.length)} onClick={importDraft}>
                  {importing ? <><span className="spinner-border spinner-border-sm me-2" />Importing...</> : <><i className="bi bi-check2-circle me-2" />Confirm import</>}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
