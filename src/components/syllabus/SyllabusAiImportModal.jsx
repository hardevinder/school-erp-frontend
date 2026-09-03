import React, { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Swal from "sweetalert2";
import api from "../../api";
import "./SyllabusAiImportModal.css";

const aiAlert = (options) =>
  Swal.fire({
    ...options,
    customClass: {
      ...(options?.customClass || {}),
      container: `sb-ai-swal ${options?.customClass?.container || ""}`.trim(),
    },
  });

const confidenceLabel = (value) => {
  const score = Math.round((Number(value) || 0) * 100);
  if (score >= 85) return { score, className: "text-bg-success" };
  if (score >= 70) return { score, className: "text-bg-warning" };
  return { score, className: "text-bg-danger" };
};

const updateAt = (rows, index, key, value) =>
  rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row));

const allowedFile = (file) => {
  const type = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();
  return ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(type) ||
    /\.(pdf|jpe?g|png|webp)$/.test(name);
};

export default function SyllabusAiImportModal({ context, onClose, onUseDraft }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [draft, setDraft] = useState(null);

  const units = draft?.units || [];
  const reviewCount = useMemo(
    () => units.filter((item) => item.needs_review || !String(item.unit_title || "").trim()).length,
    [units]
  );

  const chooseFile = (selected) => {
    if (!selected) return;
    if (!allowedFile(selected)) {
      aiAlert({ title: "Unsupported file", text: "Please choose a PDF, JPG, PNG or WEBP syllabus file.", icon: "warning" });
      return;
    }
    if (selected.size > 25 * 1024 * 1024) {
      aiAlert({ title: "File too large", text: "Maximum syllabus file size is 25 MB.", icon: "warning" });
      return;
    }
    setFile(selected);
    setDraft(null);
  };

  const analyze = async () => {
    if (!file) return aiAlert({ title: "Choose a file", text: "Upload a syllabus PDF or handwritten image first.", icon: "info" });
    setAnalyzing(true);
    try {
      const form = new FormData();
      form.append("syllabus_document", file);
      form.append("classId", context.classId);
      form.append("subjectId", context.subjectId);
      form.append("academicSession", context.academicSession || "");
      form.append("term", context.term || "FULL_YEAR");

      const response = await api.post("/syllabus-breakdowns/ai-analyze", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 180000,
      });
      setDraft(response.data);
    } catch (error) {
      aiAlert({
        title: "AI analysis failed",
        text: error?.response?.data?.message || "The syllabus could not be analyzed. Try a clearer scan or PDF.",
        icon: "error",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const updateUnit = (index, key, value) => {
    setDraft((old) => ({ ...old, units: updateAt(old.units || [], index, key, value) }));
  };

  const removeUnit = (index) => {
    setDraft((old) => ({
      ...old,
      units: (old.units || [])
        .filter((_, rowIndex) => rowIndex !== index)
        .map((row, rowIndex) => ({ ...row, seq_no: rowIndex + 1 })),
    }));
  };

  const addUnit = () => {
    setDraft((old) => ({
      ...old,
      units: [
        ...(old.units || []),
        {
          client_id: `manual-${Date.now()}`,
          seq_no: (old.units || []).length + 1,
          unit_no: "",
          unit_title: "",
          topics: "",
          subtopics: "",
          periods: null,
          planned_month: "",
          remarks: "",
          confidence: 1,
          needs_review: false,
          warnings: [],
        },
      ],
    }));
  };

  const useDraft = () => {
    const invalid = units.filter((item) => !String(item.unit_title || "").trim());
    if (!units.length) {
      return aiAlert({ title: "No units", text: "No syllabus units are available to use.", icon: "warning" });
    }
    if (invalid.length) {
      return aiAlert({ title: "Complete highlighted rows", text: "Every unit/chapter needs a title before using this draft.", icon: "warning" });
    }
    onUseDraft?.(draft);
  };

  return createPortal(
    <div className="modal show d-block sb-ai-backdrop" role="dialog" aria-modal="true">
      <div className="modal-dialog modal-xl modal-dialog-scrollable sb-ai-dialog">
        <div className="modal-content sb-ai-shell">
          <div className="sb-ai-header">
            <div className="sb-ai-icon"><i className="bi bi-stars" /></div>
            <div>
              <div className="sb-ai-eyebrow">AI SYLLABUS IMPORT</div>
              <h4 className="mb-1">Turn a PDF or handwriting into syllabus breakup rows</h4>
              <div className="sb-ai-subtitle">
                {context.className || "Selected class"} · {context.subjectName || "Selected subject"}
                {context.academicSession ? ` · ${context.academicSession}` : ""}
              </div>
            </div>
            <button type="button" className="btn-close btn-close-white ms-auto" onClick={onClose} aria-label="Close" />
          </div>

          <div className="modal-body p-0">
            {!draft ? (
              <div className="sb-ai-start">
                <div
                  className={`sb-ai-dropzone ${dragging ? "is-dragging" : ""}`}
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
                  <div className="sb-ai-upload-orb"><i className="bi bi-cloud-arrow-up" /></div>
                  <h5>{file ? file.name : "Drop syllabus here or browse"}</h5>
                  <p>PDF, scanned PDF, handwritten photo or screenshot · maximum 25 MB</p>
                  {file && <span className="badge text-bg-light border">{(file.size / 1024 / 1024).toFixed(2)} MB</span>}
                </div>

                <div className="row g-3 sb-ai-promise">
                  <div className="col-md-4"><i className="bi bi-journal-bookmark" /><b>Chapters & units</b><span>Number, title, topics and subtopics</span></div>
                  <div className="col-md-4"><i className="bi bi-calendar3" /><b>Planning details</b><span>Periods, month and remarks when visible</span></div>
                  <div className="col-md-4"><i className="bi bi-shield-check" /><b>Teacher review</b><span>Nothing is saved until you review and Save</span></div>
                </div>

                <div className="d-flex justify-content-center mt-4">
                  <button type="button" className="btn btn-primary btn-lg px-5" disabled={!file || analyzing} onClick={analyze}>
                    {analyzing ? (
                      <><span className="spinner-border spinner-border-sm me-2" />Reading syllabus...</>
                    ) : (
                      <><i className="bi bi-stars me-2" />Analyze syllabus</>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="sb-ai-review">
                <div className="sb-ai-summary">
                  <div><span>Document</span><b>{draft.document?.title || draft.book_reference || "Syllabus"}</b></div>
                  <div><span>Units detected</span><b>{units.length}</b></div>
                  <div><span>Language</span><b>{draft.document?.detected_language || "—"}</b></div>
                  <div className={reviewCount ? "needs-attention" : "is-clear"}><span>Needs review</span><b>{reviewCount}</b></div>
                </div>

                {(draft.warnings || []).length > 0 && (
                  <div className="alert alert-warning d-flex gap-2 align-items-start mx-4 mt-3 mb-0">
                    <i className="bi bi-exclamation-triangle-fill" />
                    <div><b>Please review:</b> {(draft.warnings || []).join(" · ")}</div>
                  </div>
                )}

                <div className="row g-3 px-4 pt-3">
                  <div className="col-md-5">
                    <label className="form-label small fw-semibold">Book Reference</label>
                    <input
                      className="form-control"
                      value={draft.book_reference || ""}
                      onChange={(e) => setDraft((old) => ({ ...old, book_reference: e.target.value }))}
                      placeholder="Book / publisher / edition"
                    />
                  </div>
                  <div className="col-md-7">
                    <label className="form-label small fw-semibold">Overall Objectives</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={draft.objectives || ""}
                      onChange={(e) => setDraft((old) => ({ ...old, objectives: e.target.value }))}
                      placeholder="Objectives detected from the document"
                    />
                  </div>
                </div>

                <div className="d-flex align-items-center justify-content-between px-4 pt-3 pb-2">
                  <div>
                    <b>Review extracted units</b>
                    <div className="text-muted small">Yellow rows need extra attention. You can edit everything.</div>
                  </div>
                  <div className="d-flex gap-2">
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setDraft(null)}>
                      <i className="bi bi-arrow-repeat me-1" />Another file
                    </button>
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={addUnit}>
                      + Add Unit
                    </button>
                  </div>
                </div>

                <div className="table-responsive sb-ai-table-wrap">
                  <table className="table table-bordered align-middle mb-0 sb-ai-table">
                    <thead>
                      <tr>
                        <th>Status</th><th>#</th><th>Unit No</th><th>Unit / Chapter Title *</th><th>Topics</th><th>Subtopics</th><th>Periods</th><th>Month</th><th>Remarks</th><th />
                      </tr>
                    </thead>
                    <tbody>
                      {units.map((item, index) => {
                        const confidence = confidenceLabel(item.confidence);
                        const invalid = !String(item.unit_title || "").trim();
                        return (
                          <tr key={item.client_id || index} className={item.needs_review || invalid ? "sb-ai-warning-row" : ""}>
                            <td>
                              <span className={`badge ${confidence.className}`}>{confidence.score}%</span>
                              {(item.needs_review || invalid) && (
                                <i className="bi bi-exclamation-circle-fill text-warning ms-2" title={(item.warnings || []).join(" · ")} />
                              )}
                            </td>
                            <td className="text-center">{index + 1}</td>
                            <td><input className="form-control form-control-sm" value={item.unit_no || ""} onChange={(e) => updateUnit(index, "unit_no", e.target.value)} /></td>
                            <td><input className={`form-control form-control-sm ${invalid ? "is-invalid" : ""}`} value={item.unit_title || ""} onChange={(e) => updateUnit(index, "unit_title", e.target.value)} /></td>
                            <td><textarea rows="2" className="form-control form-control-sm" value={item.topics || ""} onChange={(e) => updateUnit(index, "topics", e.target.value)} /></td>
                            <td><textarea rows="2" className="form-control form-control-sm" value={item.subtopics || ""} onChange={(e) => updateUnit(index, "subtopics", e.target.value)} /></td>
                            <td><input type="number" min="0" className="form-control form-control-sm" value={item.periods ?? ""} onChange={(e) => updateUnit(index, "periods", e.target.value)} /></td>
                            <td><input className="form-control form-control-sm" value={item.planned_month || ""} onChange={(e) => updateUnit(index, "planned_month", e.target.value)} placeholder="April" /></td>
                            <td><input className="form-control form-control-sm" value={item.remarks || ""} onChange={(e) => updateUnit(index, "remarks", e.target.value)} /></td>
                            <td><button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeUnit(index)}><i className="bi bi-trash" /></button></td>
                          </tr>
                        );
                      })}
                      {!units.length && <tr><td colSpan="10" className="text-center text-muted py-5">No units detected. Try a clearer file or add a unit manually.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer sb-ai-footer">
            <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
            {draft && (
              <>
                <span className="text-muted small me-auto"><i className="bi bi-lock me-1" />AI draft is not saved yet.</span>
                <button type="button" className="btn btn-primary px-4" disabled={!units.length} onClick={useDraft}>
                  <i className="bi bi-check2-circle me-2" />Use draft in syllabus form
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
