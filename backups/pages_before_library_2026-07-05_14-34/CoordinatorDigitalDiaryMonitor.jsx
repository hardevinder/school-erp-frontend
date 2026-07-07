// File: src/pages/DigitalDiary.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";

const PAGE_SIZE = 25;

const TYPE_STYLES = {
  ANNOUNCEMENT: "bg-dark text-white",
  HOMEWORK: "bg-primary text-white",
  REMARK: "bg-warning text-dark",
  DEFAULT: "bg-secondary text-white",
};

const emptyForm = {
  id: null,
  sessionId: "",
  date: new Date().toISOString().slice(0, 10),
  type: "ANNOUNCEMENT",
  title: "",
  content: "",
  classId: "",
  sectionId: "",
  subjectId: "",
  attachments: [],
  selectedFiles: [],
  replaceAttachments: false,
  keepAttachmentIds: [],
};

/* ──────────────────────────────────────────────
  Role / auth helpers
────────────────────────────────────────────── */
function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function getRoleFlags() {
  const singleRole = localStorage.getItem("userRole");
  const multiRoles = safeJsonParse(localStorage.getItem("roles") || "[]", []);
  const roles = Array.isArray(multiRoles) && multiRoles.length ? multiRoles : [singleRole].filter(Boolean);
  const lc = roles.map((r) => String(r || "").toLowerCase());

  return {
    roles,
    isAdmin: lc.includes("admin"),
    isSuperadmin: lc.includes("superadmin"),
    isHR: lc.includes("hr"),
    isCoordinator: lc.includes("academic_coordinator") || lc.includes("coordinator"),
    isTeacher: lc.includes("teacher"),
    isStudent: lc.includes("student"),
  };
}

function getAuthHeaders() {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("jwt") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getCurrentUserId() {
  const raw = localStorage.getItem("userId") || localStorage.getItem("userid") || localStorage.getItem("currentUserId");
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

function isAdminLikeUI() {
  const flags = getRoleFlags();
  return flags.isAdmin || flags.isSuperadmin || flags.isHR || flags.isCoordinator;
}

function isOwnerOfDiary(diary) {
  const me = getCurrentUserId();
  if (!me) return false;
  const ownerId = Number(diary?.createdById ?? diary?.createdBy?.id ?? diary?.teacherId ?? diary?.teacher?.id);
  return Number.isFinite(ownerId) && ownerId === me;
}

function joinDiaryPath(suffix = "") {
  const s = String(suffix || "");
  return s ? `/diaries${s.startsWith("/") ? s : `/${s}`}` : "/diaries";
}

function diaryRequest({ method = "get", suffix = "", params, data, headers = {} }) {
  return api.request({
    method,
    url: joinDiaryPath(suffix),
    params,
    data,
    headers: { ...getAuthHeaders(), ...headers },
  });
}

const diaryGet = (suffix = "", params) => diaryRequest({ method: "get", suffix, params });
const diaryPost = (suffix = "", data, headers) => diaryRequest({ method: "post", suffix, data, headers });
const diaryPut = (suffix = "", data, headers) => diaryRequest({ method: "put", suffix, data, headers });
const diaryDelete = (suffix = "", params) => diaryRequest({ method: "delete", suffix, params });

async function studentsGet(params = {}) {
  const p = {};
  if (params.classId) p.class_id = params.classId;
  if (params.sectionId) p.section_id = params.sectionId;
  if (params.sessionId) p.session_id = params.sessionId;
  if (params.q) p.q = params.q;
  if (params.pageSize) p.limit = params.pageSize;
  if (params.page) p.page = params.page;

  return api.request({
    method: "get",
    url: "/students/searchByClassAndSection",
    params: p,
    headers: { ...getAuthHeaders() },
  });
}

/* ──────────────────────────────────────────────
  Utility helpers
────────────────────────────────────────────── */
function getErrorMessage(err, fallback = "Something went wrong.") {
  return err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
}

function normalizeStr(s = "") {
  return String(s || "").trim().replace(/\s+/g, " ");
}

function guessMime(fileName = "") {
  const ext = String(fileName || "").split(".").pop()?.toLowerCase();
  const map = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
  };
  return map[ext] || "application/octet-stream";
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getName(row, keys = []) {
  for (const key of keys) {
    const value = key.split(".").reduce((acc, part) => acc?.[part], row);
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function classNameOf(row) {
  return getName(row, ["class.class_name", "class.name", "Class.class_name", "Class.name"]) || (row?.classId ? `Class ${row.classId}` : "—");
}

function sectionNameOf(row) {
  return getName(row, ["section.section_name", "section.name", "Section.section_name", "Section.name"]) || (row?.sectionId ? `${row.sectionId}` : "—");
}

function subjectNameOf(row) {
  return getName(row, ["subject.name", "Subject.name"]) || "General";
}

function creatorNameOf(row) {
  return (
    getName(row, ["createdBy.name", "teacher.name", "Teacher.name", "employee.name", "Employee.name", "createdBy.username"]) ||
    row?.teacherName ||
    row?.createdByName ||
    "—"
  );
}

function creatorIdOf(row) {
  return row?.createdById ?? row?.createdBy?.id ?? row?.teacherId ?? row?.teacher?.id ?? "";
}

function normalizeAttachments(row) {
  const arr = Array.isArray(row?.attachments) ? row.attachments : [];
  return arr
    .map((a) => {
      if (typeof a === "string") {
        return { url: a, name: a.split("/").pop() || "Attachment", mimeType: guessMime(a), id: a };
      }
      const url = a?.fileUrl || a?.url || a?.href || "";
      const name = a?.originalName || a?.name || a?.label || (url ? url.split("/").pop() : "Attachment");
      return url ? { ...a, url, name, mimeType: a?.mimeType || a?.kind || guessMime(name) } : null;
    })
    .filter(Boolean);
}

function privateCount(row) {
  return Array.isArray(row?.recipients) ? row.recipients.length : Number(row?.privateCount || row?.recipientsCount || 0);
}

function ackCount(row) {
  return Array.isArray(row?.acknowledgements)
    ? row.acknowledgements.length
    : Number(row?._counts?.acks ?? row?.ackCount ?? row?.acksCount ?? 0);
}

function viewCount(row) {
  return Array.isArray(row?.views) ? row.views.length : Number(row?._counts?.views ?? row?.seenCount ?? row?.viewsCount ?? 0);
}

function targetLabel(target) {
  const cls = target?.class?.class_name || target?.class?.name || target?.Class?.class_name || target?.classId || target?.class?.id;
  const sec = target?.section?.section_name || target?.section?.name || target?.Section?.section_name || target?.sectionId || target?.section?.id;
  return `Class ${cls || "—"} - ${sec || "—"}`;
}

function attachmentsSignature(arr = []) {
  const normalized = normalizeAttachments({ attachments: arr }).map((a) => ({
    n: a.name || "",
    u: a.url || "",
    m: a.mimeType || "",
    z: a.size || 0,
  }));
  return JSON.stringify(normalized.sort((a, b) => (a.n + a.u).localeCompare(b.n + b.u)));
}

function groupDiaries(items = []) {
  const byKey = new Map();

  for (const d of items) {
    if (Array.isArray(d?.targets) && d.targets.length) {
      byKey.set(`targets-${d.id}`, { ...d, _sourceIds: [d.id] });
      continue;
    }

    const key = [
      (d?.date || "").slice(0, 10),
      d?.type,
      normalizeStr(d?.title),
      normalizeStr(d?.content),
      d?.subjectId ?? "",
      attachmentsSignature(d?.attachments),
    ].join("|");

    const classObj = d?.class ? { ...d.class } : d?.Class || null;
    const sectionObj = d?.section ? { ...d.section } : d?.Section || null;
    const target = {
      classId: d?.classId || classObj?.id,
      sectionId: d?.sectionId || sectionObj?.id,
      class: classObj || (d?.classId ? { id: d.classId } : undefined),
      section: sectionObj || (d?.sectionId ? { id: d.sectionId } : undefined),
    };

    const entry = byKey.get(key);
    if (!entry) {
      byKey.set(key, {
        ...d,
        targets: [target],
        _sourceIds: [d.id],
        _counts: {
          views: viewCount(d),
          acks: ackCount(d),
        },
      });
    } else {
      const exists = entry.targets.some(
        (t) => String(t.classId || "") === String(target.classId || "") && String(t.sectionId || "") === String(target.sectionId || "")
      );
      if (!exists) entry.targets.push(target);
      entry._sourceIds.push(d.id);
      entry._counts.views += viewCount(d);
      entry._counts.acks += ackCount(d);
    }
  }

  return Array.from(byKey.values())
    .map((x) => ({
      ...x,
      seenCount: x._counts?.views ?? x.seenCount,
      ackCount: x._counts?.acks ?? x.ackCount,
    }))
    .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));
}

function listFromResponse(data, possibleKeys = []) {
  if (Array.isArray(data)) return data;
  for (const key of possibleKeys) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return data?.data || data?.rows || data?.items || [];
}

function getClassSections(sections, classId) {
  const cid = Number(classId);
  if (!cid) return sections;
  const hasBoundSection = sections.some((s) => Number(s.classId ?? s.class_id ?? s.ClassId ?? 0));
  if (!hasBoundSection) return sections;
  return sections.filter((s) => Number(s.classId ?? s.class_id ?? s.ClassId ?? 0) === cid);
}

function Spinner({ small = false }) {
  return (
    <span
      className={`spinner-border text-primary ${small ? "spinner-border-sm" : ""}`}
      role="status"
      style={{ width: small ? "1rem" : "2rem", height: small ? "1rem" : "2rem" }}
    >
      <span className="visually-hidden">Loading...</span>
    </span>
  );
}

function TypeBadge({ type }) {
  const key = String(type || "DEFAULT").toUpperCase();
  return <span className={`badge rounded-pill px-3 py-2 fw-bold ${TYPE_STYLES[key] || TYPE_STYLES.DEFAULT}`}>{key}</span>;
}

function PaginationBar({ page, totalPages, total, pageSize, loading, onPage, position = "top" }) {
  const canPrev = page > 1 && !loading;
  const canNext = page < totalPages && !loading;

  return (
    <div className={`diary-pagination diary-pagination-${position} d-flex align-items-center justify-content-between flex-wrap gap-2 px-3 py-2`}>
      <div className="d-flex align-items-center flex-wrap gap-2">
        <span className="badge rounded-pill bg-light text-dark border px-3 py-2">
          Page <strong>{page}</strong> of <strong>{totalPages}</strong>
        </span>
        <span className="small text-muted">
          Total <strong>{total}</strong> • Showing up to <strong>{pageSize}</strong> records
        </span>
      </div>

      <div className="btn-group btn-group-sm" role="group" aria-label="Pagination">
        <button className="btn btn-outline-secondary" disabled={!canPrev} onClick={() => onPage(1)}>
          First
        </button>
        <button className="btn btn-outline-secondary" disabled={!canPrev} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <button className="btn btn-light border fw-semibold" disabled>
          {loading ? <Spinner small /> : page}
        </button>
        <button className="btn btn-outline-primary" disabled={!canNext} onClick={() => onPage(page + 1)}>
          Next
        </button>
        <button className="btn btn-outline-primary" disabled={!canNext} onClick={() => onPage(totalPages)}>
          Last
        </button>
      </div>
    </div>
  );
}

function AttachmentsInput({ value, onChange }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const add = () => {
    const cleanUrl = url.trim();
    if (!cleanUrl) return;
    const cleanName = name.trim() || cleanUrl.split("/").pop() || "Attachment";
    onChange([...(value || []), { name: cleanName, url: cleanUrl, mimeType: guessMime(cleanName) }]);
    setName("");
    setUrl("");
  };

  const remove = (index) => {
    const next = [...(value || [])];
    next.splice(index, 1);
    onChange(next);
  };

  return (
    <div>
      <div className="row g-2 align-items-end">
        <div className="col-md-4">
          <label className="form-label fw-semibold text-muted">File Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="form-control rounded-3" placeholder="Worksheet.pdf" />
        </div>
        <div className="col-md-6">
          <label className="form-label fw-semibold text-muted">URL</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} className="form-control rounded-3" placeholder="https://example.com/file.pdf" />
        </div>
        <div className="col-md-2 d-grid">
          <button type="button" onClick={add} className="btn btn-outline-primary rounded-3">
            Add
          </button>
        </div>
      </div>

      {(value || []).length > 0 && (
        <div className="mt-3 d-flex flex-column gap-2">
          {value.map((a, i) => (
            <div key={`${a.url}-${i}`} className="attachment-edit-row rounded-3 border bg-light p-2 d-flex align-items-center justify-content-between gap-2">
              <div className="min-w-0">
                <div className="fw-semibold text-truncate">{a.name || "Attachment"}</div>
                <small className="text-muted text-truncate d-block">{a.url}</small>
              </div>
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remove(i)}>
                <i className="bi bi-x-lg" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FileUploads({ files = [], setFiles, max = 10 }) {
  const inputRef = useRef(null);
  const items = Array.isArray(files) ? files : Array.from(files || []);

  const pushFiles = (incoming) => {
    const next = [...items, ...Array.from(incoming || [])].slice(0, max);
    setFiles(next);
  };

  const remove = (index) => {
    const next = [...items];
    next.splice(index, 1);
    setFiles(next);
  };

  return (
    <div>
      <div
        className="upload-zone rounded-4 border border-2 border-primary-subtle bg-primary-subtle p-4 text-center"
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDrop={(e) => {
          e.preventDefault();
          pushFiles(e.dataTransfer.files);
        }}
        onDragOver={(e) => e.preventDefault()}
      >
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => pushFiles(e.target.files)} />
        <i className="bi bi-cloud-arrow-up fs-1 text-primary d-block mb-2" />
        <div className="fw-bold">Drop files here, or click to browse</div>
        <small className="text-muted">Up to {max} files</small>
      </div>

      {items.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mt-3">
          {items.map((f, i) => (
            <span key={`${f.name}-${i}`} className="badge bg-white text-dark border rounded-pill px-3 py-2 d-flex align-items-center gap-2">
              <i className="bi bi-file-earmark" />
              <span className="text-truncate" style={{ maxWidth: 220 }}>
                {f.name || "Attachment"}
              </span>
              <button type="button" className="btn btn-sm btn-link text-danger p-0" onClick={() => remove(i)}>
                <i className="bi bi-x-lg" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function DiaryViewModal({ diary, onClose }) {
  if (!diary) return null;

  const attachments = normalizeAttachments(diary);
  const targets = Array.isArray(diary.targets) && diary.targets.length ? diary.targets : null;
  const privateStudents = Array.isArray(diary.recipients) ? diary.recipients : [];

  return (
    <div className="modal show d-block diary-modal-backdrop" tabIndex="-1" role="dialog">
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable modal-fullscreen-md-down">
        <div className="modal-content diary-view-modal border-0 rounded-4 overflow-hidden shadow-lg">
          <div className="modal-header diary-view-header text-white">
            <div className="min-w-0">
              <div className="small opacity-75">Diary Preview</div>
              <h5 className="modal-title fw-black text-truncate">{diary.title || "Untitled Diary"}</h5>
            </div>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} />
          </div>

          <div className="modal-body p-0">
            <div className="diary-view-scroll-y">
              <div className="diary-view-scroll-x">
                <div className="diary-view-canvas p-3 p-lg-4">
                  <div className="d-flex align-items-start justify-content-between flex-wrap gap-3 mb-3">
                    <div>
                      <TypeBadge type={diary.type} />
                      {privateCount(diary) > 0 && (
                        <span className="badge rounded-pill bg-danger-subtle text-danger border border-danger-subtle ms-2 px-3 py-2">
                          <i className="bi bi-lock-fill me-1" /> Private: {privateCount(diary)}
                        </span>
                      )}
                    </div>
                    <div className="text-muted small text-end">
                      <div>{formatDate(diary.date)}</div>
                      <div>Created: {formatDateTime(diary.createdAt)}</div>
                    </div>
                  </div>

                  <div className="row g-3 mb-4">
                    <div className="col-md-3">
                      <div className="info-box">
                        <span>Teacher</span>
                        <strong>{creatorNameOf(diary)}</strong>
                        {creatorIdOf(diary) ? <small>ID: {creatorIdOf(diary)}</small> : null}
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="info-box">
                        <span>Class</span>
                        <strong>{classNameOf(diary)}</strong>
                        <small>{sectionNameOf(diary)}</small>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="info-box">
                        <span>Subject</span>
                        <strong>{subjectNameOf(diary)}</strong>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="info-box">
                        <span>Status</span>
                        <strong>{viewCount(diary)} views</strong>
                        <small>{ackCount(diary)} acknowledgements</small>
                      </div>
                    </div>
                  </div>

                  {targets && (
                    <div className="mb-4">
                      <h6 className="fw-bold mb-2">Targets</h6>
                      <div className="d-flex flex-wrap gap-2">
                        {targets.map((t, idx) => (
                          <span key={idx} className="badge rounded-pill bg-light text-dark border px-3 py-2">
                            {targetLabel(t)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="content-preview-card rounded-4 border bg-white p-3 p-lg-4 mb-4">
                    <h4 className="fw-black mb-3">{diary.title || "Untitled Diary"}</h4>
                    <div className="diary-content-text">{diary.content || "—"}</div>
                  </div>

                  {attachments.length > 0 && (
                    <div className="attachments-panel rounded-4 border bg-light p-3 mb-4">
                      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                        <h6 className="fw-bold mb-0">Attachments</h6>
                        <span className="badge bg-white text-dark border">{attachments.length} file(s)</span>
                      </div>
                      <div className="d-flex flex-column gap-2">
                        {attachments.map((att, idx) => (
                          <a
                            key={`${att.url}-${idx}`}
                            href={att.url}
                            target="_blank"
                            rel="noreferrer"
                            className="attachment-link rounded-3 border bg-white p-3 text-decoration-none d-flex align-items-center gap-3"
                          >
                            <i className="bi bi-paperclip fs-5 text-primary" />
                            <div className="min-w-0 flex-grow-1">
                              <div className="fw-semibold text-dark text-truncate">{att.name || `Attachment ${idx + 1}`}</div>
                              <small className="text-muted text-truncate d-block">{att.url}</small>
                            </div>
                            <i className="bi bi-box-arrow-up-right text-muted" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {privateStudents.length > 0 && (
                    <div className="rounded-4 border bg-white p-3">
                      <h6 className="fw-bold mb-3">Private Recipients</h6>
                      <div className="table-responsive">
                        <table className="table table-sm align-middle mb-0">
                          <thead className="table-light">
                            <tr>
                              <th>#</th>
                              <th>Student ID</th>
                              <th>Name</th>
                              <th>Admission No</th>
                            </tr>
                          </thead>
                          <tbody>
                            {privateStudents.map((r, idx) => (
                              <tr key={idx}>
                                <td>{idx + 1}</td>
                                <td>{r.studentId || r.student?.id || "—"}</td>
                                <td>{r.student?.name || r.name || "—"}</td>
                                <td>{r.student?.admission_number || r.admission_number || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer bg-white">
            <button className="btn btn-outline-secondary rounded-pill px-4" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AckModal({ diary, onClose }) {
  if (!diary) return null;
  const acks = Array.isArray(diary.acknowledgements) ? diary.acknowledgements : [];

  return (
    <div className="modal show d-block diary-modal-backdrop" tabIndex="-1" role="dialog">
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
          <div className="modal-header bg-dark text-white">
            <div>
              <div className="small opacity-75">Acknowledgements</div>
              <h5 className="modal-title fw-bold mb-0">{diary.title || "Diary"}</h5>
            </div>
            <button className="btn-close btn-close-white" onClick={onClose} />
          </div>
          <div className="modal-body p-0">
            <div className="table-responsive ack-table-scroll">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light sticky-top">
                  <tr>
                    <th>#</th>
                    <th>Student</th>
                    <th>Admission No</th>
                    <th>Ack Time</th>
                  </tr>
                </thead>
                <tbody>
                  {acks.length ? (
                    acks.map((a, i) => (
                      <tr key={a.id || i}>
                        <td>{i + 1}</td>
                        <td>{a.student?.name || a.Student?.name || a.studentName || a.studentId || "—"}</td>
                        <td>{a.student?.admission_number || a.Student?.admission_number || a.admission_number || "—"}</td>
                        <td>{formatDateTime(a.createdAt || a.updatedAt)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="text-center text-muted py-5">
                        No acknowledgement details available in this list response.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="modal-footer bg-white">
            <button className="btn btn-outline-secondary rounded-pill px-4" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DiaryEditModal({
  show,
  form,
  setForm,
  saving,
  onClose,
  onSave,
  classes,
  sections,
  subjects,
  sessions,
  multiMode,
  setMultiMode,
  targets,
  draftTarget,
  setDraftTarget,
  addTarget,
  removeTarget,
  addAllTargets,
  addAllSectionsForSelectedClass,
  clearAllTargets,
  studentsForPicker,
  studentsLoading,
  studentSearch,
  setStudentSearch,
  selectedStudentIds,
  setSelectedStudentIds,
}) {
  if (!show) return null;

  const visibleSections = getClassSections(sections, form.classId);
  const targetSections = getClassSections(sections, draftTarget.classId);

  const toggleStudent = (studentId) => {
    const id = Number(studentId);
    if (!id) return;
    setSelectedStudentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="modal show d-block diary-modal-backdrop" tabIndex="-1" role="dialog">
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable modal-fullscreen-md-down">
        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
          <div className="modal-header diary-edit-header text-white">
            <div>
              <div className="small opacity-75">{form.id ? "Update diary" : "Create new diary"}</div>
              <h5 className="modal-title fw-black mb-0">{form.id ? "Edit Digital Diary" : "Add Digital Diary"}</h5>
            </div>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} disabled={saving} />
          </div>

          <div className="modal-body bg-light p-3 p-lg-4">
            <div className="row g-3">
              <div className="col-lg-7">
                <div className="section-card mb-3">
                  <div className="section-title">
                    <i className="bi bi-pencil-square" /> Diary Details
                  </div>

                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Session</label>
                      <select className="form-select rounded-3" value={form.sessionId || ""} onChange={(e) => setForm((f) => ({ ...f, sessionId: e.target.value }))}>
                        <option value="">Select</option>
                        {sessions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name || s.session_name || s.id}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Date</label>
                      <input type="date" className="form-control rounded-3" value={form.date || ""} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Type</label>
                      <select className="form-select rounded-3" value={form.type || "ANNOUNCEMENT"} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                        <option value="ANNOUNCEMENT">Announcement</option>
                        <option value="HOMEWORK">Homework</option>
                        <option value="REMARK">Remark</option>
                      </select>
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Title</label>
                      <input className="form-control form-control-lg rounded-3" value={form.title || ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Unit Test II Datesheet" />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Content</label>
                      <textarea className="form-control rounded-3" rows="6" value={form.content || ""} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} placeholder="Write diary details here..." />
                    </div>
                  </div>
                </div>

                <div className="section-card mb-3">
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                    <div className="section-title mb-0">
                      <i className="bi bi-bullseye" /> Target Classes
                    </div>
                    {!form.id && (
                      <div className="form-check form-switch">
                        <input className="form-check-input" type="checkbox" checked={multiMode} onChange={(e) => setMultiMode(e.target.checked)} id="multiModeSwitch" />
                        <label className="form-check-label fw-semibold" htmlFor="multiModeSwitch">
                          Multiple Classes
                        </label>
                      </div>
                    )}
                  </div>

                  {!multiMode || form.id ? (
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Class</label>
                        <select className="form-select rounded-3" value={form.classId || ""} onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value, sectionId: "" }))}>
                          <option value="">Select Class</option>
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.class_name || c.name || c.className || `Class ${c.id}`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Section</label>
                        <select className="form-select rounded-3" value={form.sectionId || ""} onChange={(e) => setForm((f) => ({ ...f, sectionId: e.target.value }))}>
                          <option value="">Select Section</option>
                          {visibleSections.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.section_name || s.name || s.sectionName || `Section ${s.id}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row g-2 align-items-end">
                        <div className="col-md-5">
                          <label className="form-label fw-semibold">Class</label>
                          <select className="form-select rounded-3" value={draftTarget.classId || ""} onChange={(e) => setDraftTarget({ classId: e.target.value, sectionId: "" })}>
                            <option value="">Select Class</option>
                            {classes.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.class_name || c.name || c.className || `Class ${c.id}`}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-5">
                          <label className="form-label fw-semibold">Section</label>
                          <select className="form-select rounded-3" value={draftTarget.sectionId || ""} onChange={(e) => setDraftTarget((t) => ({ ...t, sectionId: e.target.value }))}>
                            <option value="">Select Section</option>
                            {targetSections.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.section_name || s.name || s.sectionName || `Section ${s.id}`}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-2 d-grid">
                          <button type="button" className="btn btn-primary rounded-3" onClick={addTarget}>
                            Add
                          </button>
                        </div>
                      </div>

                      <div className="d-flex flex-wrap gap-2 mt-3">
                        <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill" onClick={addAllSectionsForSelectedClass}>
                          Add all sections of selected class
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill" onClick={addAllTargets}>
                          Add all class/sections
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-danger rounded-pill" onClick={clearAllTargets} disabled={!targets.length}>
                          Clear targets
                        </button>
                      </div>

                      {targets.length > 0 && (
                        <div className="d-flex flex-wrap gap-2 mt-3">
                          {targets.map((t, idx) => (
                            <span key={`${t.classId}-${t.sectionId}-${idx}`} className="badge rounded-pill bg-white text-dark border px-3 py-2 d-inline-flex align-items-center gap-2">
                              {targetLabel({ ...t, class: classes.find((c) => Number(c.id) === Number(t.classId)), section: sections.find((s) => Number(s.id) === Number(t.sectionId)) })}
                              <button type="button" className="btn btn-sm btn-link text-danger p-0" onClick={() => removeTarget(idx)}>
                                <i className="bi bi-x-lg" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="section-card">
                  <div className="section-title">
                    <i className="bi bi-paperclip" /> Attachments
                  </div>
                  <AttachmentsInput value={form.attachments} onChange={(attachments) => setForm((f) => ({ ...f, attachments }))} />

                  <div className="mt-3">
                    <FileUploads files={form.selectedFiles} setFiles={(selectedFiles) => setForm((f) => ({ ...f, selectedFiles }))} />
                  </div>

                  {form.id && (
                    <div className="form-check mt-3">
                      <input className="form-check-input" type="checkbox" checked={!!form.replaceAttachments} id="replaceAttachments" onChange={(e) => setForm((f) => ({ ...f, replaceAttachments: e.target.checked }))} />
                      <label className="form-check-label fw-semibold" htmlFor="replaceAttachments">
                        Replace existing attachments while saving
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="col-lg-5">
                <div className="section-card sticky-lg-top" style={{ top: 12 }}>
                  <div className="section-title">
                    <i className="bi bi-bookmark-check" /> Subject & Private Recipients
                  </div>

                  <label className="form-label fw-semibold">Subject</label>
                  <select className="form-select rounded-3 mb-3" value={form.subjectId || ""} onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))}>
                    <option value="">General</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name || s.subject_name || s.id}
                      </option>
                    ))}
                  </select>

                  {!form.id && !multiMode && form.classId && form.sectionId && (
                    <div className="private-box rounded-4 border bg-light p-3">
                      <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                        <div>
                          <div className="fw-bold">Private Students</div>
                          <small className="text-muted">Optional. Select only if diary is for specific students.</small>
                        </div>
                        <span className="badge bg-white text-dark border">{selectedStudentIds.length}</span>
                      </div>
                      <input className="form-control form-control-sm rounded-pill mb-2" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Search student..." />
                      <div className="student-picker-list">
                        {studentsLoading ? (
                          <div className="text-center text-muted py-3">
                            <Spinner small /> Loading students...
                          </div>
                        ) : studentsForPicker.length ? (
                          studentsForPicker.map((s) => (
                            <label key={s.id} className="student-check d-flex align-items-center gap-2 rounded-3 p-2">
                              <input type="checkbox" checked={selectedStudentIds.includes(Number(s.id))} onChange={() => toggleStudent(s.id)} />
                              <span className="min-w-0">
                                <span className="fw-semibold d-block text-truncate">{s.name || s.student_name || "Student"}</span>
                                <small className="text-muted">Adm: {s.admission_number || s.admissionNumber || "—"}</small>
                              </span>
                            </label>
                          ))
                        ) : (
                          <div className="text-muted small py-3 text-center">No students found.</div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="preview-box rounded-4 border bg-white p-3 mt-3">
                    <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                      <TypeBadge type={form.type} />
                      <small className="text-muted">{formatDate(form.date)}</small>
                    </div>
                    <h5 className="fw-black mb-2">{form.title || "Untitled Diary"}</h5>
                    <p className="text-muted mb-0" style={{ whiteSpace: "pre-wrap" }}>
                      {form.content || "Diary content preview will appear here."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer bg-white d-flex justify-content-between flex-wrap gap-2">
            <div className="small text-muted">Keep this popup open while uploading large files.</div>
            <div>
              <button className="btn btn-light border rounded-pill me-2" onClick={onClose} disabled={saving}>
                Close
              </button>
              <button className="btn btn-primary rounded-pill px-4" onClick={onSave} disabled={saving}>
                {saving ? (
                  <>
                    <Spinner small /> Saving...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check2-circle me-1" /> Save Diary
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ManageDiaries() {
  const roleFlags = getRoleFlags();
  const canManage = roleFlags.isAdmin || roleFlags.isSuperadmin || roleFlags.isHR || roleFlags.isCoordinator || roleFlags.isTeacher;

  const [diaries, setDiaries] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 });

  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [filters, setFilters] = useState({ from: "", to: "", classId: "", sectionId: "", subjectId: "", type: "", q: "" });
  const [applyLoading, setApplyLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [multiMode, setMultiMode] = useState(false);
  const [targets, setTargets] = useState([]);
  const [draftTarget, setDraftTarget] = useState({ classId: "", sectionId: "" });
  const [saving, setSaving] = useState(false);

  const [studentsForPicker, setStudentsForPicker] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  const [viewDiary, setViewDiary] = useState(null);
  const [ackDiary, setAckDiary] = useState(null);

  const total = Number(pagination.total || 0);
  const totalPages = Math.max(1, Number(pagination.totalPages || Math.ceil(total / PAGE_SIZE) || 1));

  const activeSections = useMemo(() => getClassSections(sections, filters.classId), [sections, filters.classId]);

  const loadDiaries = useCallback(
    async (nextPage = 1) => {
      setPageLoading(nextPage !== 1);
      setApplyLoading(true);

      try {
        const params = {
          page: nextPage,
          pageSize: PAGE_SIZE,
          dateFrom: filters.from || undefined,
          dateTo: filters.to || undefined,
          classId: filters.classId || undefined,
          sectionId: filters.sectionId || undefined,
          subjectId: filters.subjectId === "null" ? null : filters.subjectId || undefined,
          type: filters.type || undefined,
          q: filters.q || undefined,
        };

        const res = await diaryGet("", params);
        const list = Array.isArray(res?.data?.data) ? res.data.data : listFromResponse(res?.data, ["diaries"]);
        const grouped = groupDiaries(list);
        const pg = res?.data?.pagination || {};

        setDiaries(grouped);
        setPagination({
          total: Number(pg.total ?? grouped.length),
          page: Number(pg.page ?? nextPage),
          pageSize: Number(pg.pageSize ?? PAGE_SIZE),
          totalPages: Number(pg.totalPages ?? (Math.ceil(Number(pg.total ?? grouped.length) / PAGE_SIZE) || 1)),
        });
        setPage(nextPage);
      } catch (err) {
        Swal.fire("Error", getErrorMessage(err, "Failed to load diaries."), "error");
      } finally {
        setApplyLoading(false);
        setPageLoading(false);
      }
    },
    [filters]
  );

  const loadLists = useCallback(async () => {
    try {
      const [cls, sec] = await Promise.all([api.get("/classes"), api.get("/sections")]);
      setClasses(listFromResponse(cls.data, ["classes"]));
      setSections(listFromResponse(sec.data, ["sections"]));
    } catch {
      Swal.fire("Warning", "Failed to load classes/sections.", "warning");
    }

    try {
      const resp = await api.get("/class-subject-teachers/teacher/class-subjects", { headers: { ...getAuthHeaders() } });
      const rows = Array.isArray(resp?.data?.assignments) ? resp.data.assignments : [];
      const subjectRows = rows.map((x) => x.subject || x.Subject).filter(Boolean);
      setSubjects(Array.from(new Map(subjectRows.map((s) => [s.id, s])).values()));
    } catch {
      setSubjects([]);
    }

    try {
      const { data } = await api.get("/sessions");
      const list = listFromResponse(data, ["sessions"]);
      setSessions(list);
      const active = list.find((s) => s.is_active === true || s.isActive === true);
      setForm((f) => ({ ...f, sessionId: f.sessionId || active?.id || list[0]?.id || "" }));
    } catch {
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    if (!canManage) return;
    loadLists();
    loadDiaries(1);
  }, [canManage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const classId = Number(form.classId);
    const sectionId = Number(form.sectionId);
    const canLoadStudents = !multiMode && !form.id && classId && sectionId;

    if (!canLoadStudents) {
      setStudentsForPicker([]);
      setSelectedStudentIds([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setStudentsLoading(true);
      try {
        const { data } = await studentsGet({
          classId,
          sectionId,
          q: studentSearch.trim().length >= 2 ? studentSearch.trim() : undefined,
          pageSize: 500,
        });
        const list = listFromResponse(data, ["students"]);
        if (!cancelled) {
          setStudentsForPicker(list);
          setSelectedStudentIds((prev) => prev.filter((id) => list.some((s) => Number(s.id) === Number(id))));
        }
      } catch {
        if (!cancelled) setStudentsForPicker([]);
      } finally {
        if (!cancelled) setStudentsLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.classId, form.sectionId, studentSearch, multiMode, form.id]);

  const resetForm = () => {
    const active = sessions.find((s) => s.is_active === true || s.isActive === true);
    setForm({ ...emptyForm, sessionId: active?.id || sessions[0]?.id || "" });
    setMultiMode(false);
    setTargets([]);
    setDraftTarget({ classId: "", sectionId: "" });
    setStudentsForPicker([]);
    setSelectedStudentIds([]);
    setStudentSearch("");
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (d) => {
    if (!isAdminLikeUI() && !isOwnerOfDiary(d)) {
      Swal.fire("Not allowed", "You can only edit diaries you created.", "warning");
      return;
    }

    const existing = normalizeAttachments(d).map((a) => ({
      id: a.id,
      name: a.name,
      url: a.url,
      mimeType: a.mimeType || guessMime(a.name || a.url),
    }));

    setForm({
      id: d.id,
      sessionId: d.sessionId || d.session?.id || "",
      date: (d.date || new Date().toISOString()).slice(0, 10),
      type: d.type || "ANNOUNCEMENT",
      title: d.title || "",
      content: d.content || "",
      classId: d.classId || d.class?.id || "",
      sectionId: d.sectionId || d.section?.id || "",
      subjectId: d.subjectId || d.subject?.id || "",
      attachments: existing,
      selectedFiles: [],
      replaceAttachments: false,
      keepAttachmentIds: existing.filter((a) => a.id).map((a) => a.id),
    });
    setMultiMode(false);
    setTargets([]);
    setDraftTarget({ classId: "", sectionId: "" });
    setSelectedStudentIds([]);
    setStudentsForPicker([]);
    setStudentSearch("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
  };

  const dedupTargets = (rows) => {
    const seen = new Set();
    const output = [];
    for (const row of rows || []) {
      const classId = Number(row.classId);
      const sectionId = Number(row.sectionId);
      if (!classId || !sectionId) continue;
      const key = `${classId}-${sectionId}`;
      if (!seen.has(key)) {
        seen.add(key);
        output.push({ classId, sectionId });
      }
    }
    return output;
  };

  const addTarget = () => {
    const classId = Number(draftTarget.classId);
    const sectionId = Number(draftTarget.sectionId);
    if (!classId || !sectionId) {
      Swal.fire("Select target", "Please select class and section.", "info");
      return;
    }
    setTargets((prev) => dedupTargets([...prev, { classId, sectionId }]));
    setDraftTarget({ classId: "", sectionId: "" });
  };

  const removeTarget = (index) => setTargets((prev) => prev.filter((_, i) => i !== index));

  const addAllSectionsForSelectedClass = () => {
    const classId = Number(draftTarget.classId);
    if (!classId) {
      Swal.fire("Select class", "Choose a class first.", "info");
      return;
    }
    const rows = getClassSections(sections, classId).map((s) => ({ classId, sectionId: Number(s.id) }));
    setTargets((prev) => dedupTargets([...prev, ...rows]));
  };

  const addAllTargets = () => {
    const all = [];
    for (const c of classes) {
      for (const s of getClassSections(sections, c.id)) {
        all.push({ classId: Number(c.id), sectionId: Number(s.id) });
      }
    }
    setTargets((prev) => dedupTargets([...prev, ...all]));
  };

  const buildSavePayload = () => {
    const linkAttachments = (form.attachments || []).map((a) => ({
      fileUrl: a.url,
      url: a.url,
      originalName: a.name || a.url?.split("/").pop() || "Attachment",
      name: a.name || a.url?.split("/").pop() || "Attachment",
      mimeType: a.mimeType || guessMime(a.name || a.url),
      size: a.size || 0,
    }));

    const base = {
      sessionId: Number(form.sessionId),
      date: form.date,
      type: form.type,
      title: form.title.trim(),
      content: form.content.trim(),
      subjectId: form.subjectId ? Number(form.subjectId) : null,
    };

    const isUpdate = !!form.id;
    const hasFiles = (form.selectedFiles || []).length > 0;
    const requiresFormData = hasFiles || (isUpdate && form.replaceAttachments === true);

    if (!requiresFormData) {
      return {
        data: {
          ...base,
          attachments: linkAttachments,
          ...(isUpdate
            ? {
                replaceAttachments: !!form.replaceAttachments,
                existingFiles: Array.isArray(form.keepAttachmentIds) ? form.keepAttachmentIds : undefined,
              }
            : {}),
          ...(multiMode && !isUpdate ? { targets: dedupTargets(targets) } : { classId: Number(form.classId), sectionId: Number(form.sectionId) }),
          ...(!isUpdate && !multiMode && selectedStudentIds.length ? { studentIds: selectedStudentIds } : {}),
        },
        headers: {},
      };
    }

    const fd = new FormData();
    Object.entries(base).forEach(([k, v]) => fd.append(k, v === null || v === undefined ? "" : String(v)));
    fd.append("attachments", JSON.stringify(linkAttachments));

    if (multiMode && !isUpdate) {
      fd.append("targets", JSON.stringify(dedupTargets(targets)));
    } else {
      fd.append("classId", String(Number(form.classId || 0)));
      fd.append("sectionId", String(Number(form.sectionId || 0)));
    }

    if (!isUpdate && !multiMode && selectedStudentIds.length) fd.append("studentIds", JSON.stringify(selectedStudentIds));
    if (isUpdate) {
      fd.append("replaceAttachments", String(!!form.replaceAttachments));
      fd.append("existingFiles", JSON.stringify(form.keepAttachmentIds || []));
    }

    (form.selectedFiles || []).forEach((file) => fd.append("files", file));
    (form.selectedFiles || []).forEach((file) => fd.append("attachmentsFiles", file));

    return { data: fd, headers: { "Content-Type": "multipart/form-data" } };
  };

  const validateForm = () => {
    if (!form.sessionId) return Swal.fire("Session required", "Please select session.", "warning").then(() => false);
    if (!form.date) return Swal.fire("Date required", "Please select diary date.", "warning").then(() => false);
    if (!form.title.trim()) return Swal.fire("Title required", "Please add diary title.", "warning").then(() => false);
    if (!form.content.trim()) return Swal.fire("Content required", "Please add diary content.", "warning").then(() => false);
    if (multiMode && !form.id && !dedupTargets(targets).length) return Swal.fire("Targets required", "Please add at least one class-section target.", "warning").then(() => false);
    if ((!multiMode || form.id) && (!form.classId || !form.sectionId)) return Swal.fire("Class/Section required", "Please select class and section.", "warning").then(() => false);
    return true;
  };

  const saveDiary = async () => {
    const valid = await validateForm();
    if (!valid || saving) return;

    setSaving(true);
    try {
      const payload = buildSavePayload();
      if (form.id) {
        await diaryPut(`/${form.id}`, payload.data, payload.headers);
        await Swal.fire("Updated", "Diary updated successfully.", "success");
      } else {
        await diaryPost("", payload.data, payload.headers);
        await Swal.fire("Created", "Diary created successfully.", "success");
      }
      setShowModal(false);
      await loadDiaries(page);
    } catch (err) {
      Swal.fire("Error", getErrorMessage(err, "Failed to save diary."), "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteDiary = async (d) => {
    if (!isAdminLikeUI() && !isOwnerOfDiary(d)) {
      Swal.fire("Not allowed", "You can only delete diaries you created.", "warning");
      return;
    }

    const ids = Array.isArray(d._sourceIds) && d._sourceIds.length ? d._sourceIds : [d.id];
    const res = await Swal.fire({
      title: ids.length > 1 ? `Delete ${ids.length} grouped diaries?` : "Delete diary?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc2626",
    });
    if (!res.isConfirmed) return;

    try {
      await Promise.all(ids.map((id) => diaryDelete(`/${id}`)));
      await Swal.fire("Deleted", "Diary removed successfully.", "success");
      await loadDiaries(page);
    } catch (err) {
      Swal.fire("Error", getErrorMessage(err, "Failed to delete diary."), "error");
    }
  };

  const applyFilters = () => loadDiaries(1);
  const resetFilters = () => {
    setFilters({ from: "", to: "", classId: "", sectionId: "", subjectId: "", type: "", q: "" });
    setTimeout(() => loadDiaries(1), 0);
  };

  if (!canManage) return <StudentDiaryFeed />;

  return (
    <div className="digital-diary-page container-fluid px-3 px-lg-4 py-3">
      <div className="diary-hero rounded-4 shadow-sm mb-3">
        <div className="d-flex align-items-start justify-content-between flex-wrap gap-3">
          <div>
            <div className="eyebrow">School Communication</div>
            <h3 className="fw-black mb-1 text-white">Digital Diary Management</h3>
            <p className="mb-0 text-white-75">Create, view and monitor diary notes with clean pagination and popup previews.</p>
          </div>
          <div className="d-flex flex-wrap gap-2">
            <button className="btn btn-light rounded-pill fw-semibold px-4" onClick={openCreate}>
              <i className="bi bi-plus-lg me-2" /> Add Diary
            </button>
            <button className="btn btn-outline-light rounded-pill fw-semibold px-4" onClick={() => loadDiaries(page)} disabled={applyLoading}>
              <i className="bi bi-arrow-clockwise me-2" /> Refresh
            </button>
          </div>
        </div>

        <div className="row g-3 mt-3">
          <div className="col-md-4">
            <div className="hero-stat">
              <span className="hero-icon bg-white text-primary"><i className="bi bi-journal-text" /></span>
              <div><div className="hero-value">{total}</div><div className="hero-label">Total Notes</div></div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="hero-stat">
              <span className="hero-icon bg-white text-success"><i className="bi bi-paperclip" /></span>
              <div><div className="hero-value">{diaries.filter((d) => normalizeAttachments(d).length).length}</div><div className="hero-label">With files on this page</div></div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="hero-stat">
              <span className="hero-icon bg-white text-danger"><i className="bi bi-lock-fill" /></span>
              <div><div className="hero-value">{diaries.filter((d) => privateCount(d) > 0).length}</div><div className="hero-label">Private on this page</div></div>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body p-3">
          <div className="row g-2 align-items-end">
            <div className="col-lg-3 col-md-6">
              <label className="form-label fw-semibold text-muted">Search</label>
              <input className="form-control rounded-3" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="Title, content, teacher..." onKeyDown={(e) => e.key === "Enter" && applyFilters()} />
            </div>
            <div className="col-lg-2 col-md-3">
              <label className="form-label fw-semibold text-muted">From</label>
              <input type="date" className="form-control rounded-3" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
            </div>
            <div className="col-lg-2 col-md-3">
              <label className="form-label fw-semibold text-muted">To</label>
              <input type="date" className="form-control rounded-3" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
            </div>
            <div className="col-lg-2 col-md-4">
              <label className="form-label fw-semibold text-muted">Type</label>
              <select className="form-select rounded-3" value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
                <option value="">All Types</option>
                <option value="ANNOUNCEMENT">Announcement</option>
                <option value="HOMEWORK">Homework</option>
                <option value="REMARK">Remark</option>
              </select>
            </div>
            <div className="col-lg-3 col-md-8 d-flex gap-2">
              <button className="btn btn-primary rounded-3 flex-fill" onClick={applyFilters} disabled={applyLoading}>
                {applyLoading ? <Spinner small /> : <i className="bi bi-search me-1" />} Apply
              </button>
              <button className="btn btn-outline-secondary rounded-3" onClick={resetFilters}>
                Reset
              </button>
            </div>

            <div className="col-md-4">
              <label className="form-label fw-semibold text-muted">Class</label>
              <select className="form-select rounded-3" value={filters.classId} onChange={(e) => setFilters((f) => ({ ...f, classId: e.target.value, sectionId: "" }))}>
                <option value="">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.class_name || c.name || c.className || `Class ${c.id}`}</option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label fw-semibold text-muted">Section</label>
              <select className="form-select rounded-3" value={filters.sectionId} onChange={(e) => setFilters((f) => ({ ...f, sectionId: e.target.value }))}>
                <option value="">All Sections</option>
                {activeSections.map((s) => (
                  <option key={s.id} value={s.id}>{s.section_name || s.name || s.sectionName || `Section ${s.id}`}</option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label fw-semibold text-muted">Subject</label>
              <select className="form-select rounded-3" value={filters.subjectId} onChange={(e) => setFilters((f) => ({ ...f, subjectId: e.target.value }))}>
                <option value="">All Subjects</option>
                <option value="null">General</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name || s.subject_name || s.id}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm rounded-4 overflow-hidden diary-table-card">
        <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} loading={pageLoading} onPage={loadDiaries} position="top" />

        <div className="diary-table-scroll">
          <table className="table table-hover align-middle mb-0 diary-table">
            <thead className="diary-table-head">
              <tr>
                <th>Date</th>
                <th>Teacher</th>
                <th>Class</th>
                <th>Subject</th>
                <th>Type</th>
                <th className="diary-title-col">Diary Details</th>
                <th>Files</th>
                <th>Private</th>
                <th className="text-end diary-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {applyLoading && !pageLoading ? (
                <tr>
                  <td colSpan="9" className="text-center text-muted py-5">
                    <Spinner /> <div className="mt-2">Loading diaries...</div>
                  </td>
                </tr>
              ) : diaries.length ? (
                diaries.map((d) => {
                  const attachments = normalizeAttachments(d);
                  const pCount = privateCount(d);
                  const canModify = isAdminLikeUI() || isOwnerOfDiary(d);

                  return (
                    <tr key={`${d.id}-${(d._sourceIds || []).join("-")}`}>
                      <td className="text-nowrap fw-semibold">{formatDate(d.date)}</td>
                      <td>
                        <div className="fw-bold text-dark text-nowrap">{creatorNameOf(d)}</div>
                        {creatorIdOf(d) ? <small className="text-muted">ID: {creatorIdOf(d)}</small> : null}
                      </td>
                      <td>
                        <span className="badge rounded-pill bg-primary-subtle text-primary border border-primary-subtle px-3 py-2">
                          {Array.isArray(d.targets) && d.targets.length > 1 ? `${d.targets.length} targets` : `${classNameOf(d)} - ${sectionNameOf(d)}`}
                        </span>
                      </td>
                      <td className="text-nowrap">{subjectNameOf(d)}</td>
                      <td><TypeBadge type={d.type} /></td>
                      <td className="diary-title-cell">
                        <div className="fw-black text-dark text-truncate">{d.title || "Untitled"}</div>
                        <div className="text-muted small diary-content-line">{d.content || "—"}</div>
                      </td>
                      <td><span className="badge bg-light text-dark border px-3 py-2">{attachments.length} file(s)</span></td>
                      <td>
                        <span className={`badge rounded-pill px-3 py-2 ${pCount ? "bg-danger-subtle text-danger" : "bg-light text-muted border"}`}>
                          Private: {pCount}
                        </span>
                      </td>
                      <td className="text-end text-nowrap">
                        <div className="btn-group btn-group-sm" role="group">
                          <button className="btn btn-outline-primary" onClick={() => setViewDiary(d)}>
                            View
                          </button>
                          <button className="btn btn-outline-success" onClick={() => setAckDiary(d)}>
                            Acks
                          </button>
                          {canModify && (
                            <>
                              <button className="btn btn-outline-secondary" onClick={() => openEdit(d)} title="Edit">
                                <i className="bi bi-pencil-square" />
                              </button>
                              <button className="btn btn-outline-danger" onClick={() => deleteDiary(d)} title="Delete">
                                <i className="bi bi-trash" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9" className="text-center py-5">
                    <div className="empty-state mx-auto">
                      <i className="bi bi-journal-x fs-1 text-muted" />
                      <h6 className="fw-bold mt-2">No diary notes found</h6>
                      <p className="text-muted small mb-3">Create a diary or adjust filters.</p>
                      <button className="btn btn-primary rounded-pill" onClick={openCreate}>Add Diary</button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} loading={pageLoading} onPage={loadDiaries} position="bottom" />
      </div>

      <DiaryEditModal
        show={showModal}
        form={form}
        setForm={setForm}
        saving={saving}
        onClose={closeModal}
        onSave={saveDiary}
        classes={classes}
        sections={sections}
        subjects={subjects}
        sessions={sessions}
        multiMode={multiMode}
        setMultiMode={setMultiMode}
        targets={targets}
        draftTarget={draftTarget}
        setDraftTarget={setDraftTarget}
        addTarget={addTarget}
        removeTarget={removeTarget}
        addAllTargets={addAllTargets}
        addAllSectionsForSelectedClass={addAllSectionsForSelectedClass}
        clearAllTargets={() => setTargets([])}
        studentsForPicker={studentsForPicker}
        studentsLoading={studentsLoading}
        studentSearch={studentSearch}
        setStudentSearch={setStudentSearch}
        selectedStudentIds={selectedStudentIds}
        setSelectedStudentIds={setSelectedStudentIds}
      />

      <DiaryViewModal diary={viewDiary} onClose={() => setViewDiary(null)} />
      <AckModal diary={ackDiary} onClose={() => setAckDiary(null)} />

      <DiaryStyles />
    </div>
  );
}

function StudentDiaryFeed() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [viewDiary, setViewDiary] = useState(null);

  const total = Number(pagination.total || 0);
  const totalPages = Math.max(1, Number(pagination.totalPages || Math.ceil(total / PAGE_SIZE) || 1));

  const load = async (nextPage = 1) => {
    setLoading(true);
    try {
      const endpoints = [
        { url: "/diaries/student/feed/list", params: { page: nextPage, pageSize: PAGE_SIZE, order: "date:DESC" } },
        { url: "/diaries", params: { page: nextPage, pageSize: PAGE_SIZE } },
      ];

      let data = null;
      for (const ep of endpoints) {
        try {
          const res = await api.get(ep.url, { params: ep.params, headers: { ...getAuthHeaders() } });
          data = res.data;
          break;
        } catch {}
      }
      const list = listFromResponse(data, ["diaries"]);
      setItems(list);
      const pg = data?.pagination || {};
      setPagination({
        total: Number(pg.total ?? list.length),
        totalPages: Number(pg.totalPages ?? (Math.ceil(Number(pg.total ?? list.length) / PAGE_SIZE) || 1)),
      });
      setPage(nextPage);
    } catch (err) {
      Swal.fire("Error", getErrorMessage(err, "Failed to load diary feed."), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, []);

  const acknowledge = async (diary) => {
    try {
      await diaryPost(`/${diary.id}/ack`, {});
      Swal.fire("Acknowledged", "Thank you. Diary acknowledged successfully.", "success");
      load(page);
    } catch (err) {
      Swal.fire("Error", getErrorMessage(err, "Failed to acknowledge diary."), "error");
    }
  };

  return (
    <div className="digital-diary-page container-fluid px-3 px-lg-4 py-3">
      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        <div className="card-header bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <h5 className="fw-black mb-0">Digital Diary</h5>
            <small className="text-muted">Latest notes, homework and announcements</small>
          </div>
          <button className="btn btn-outline-primary rounded-pill" onClick={() => load(page)}>Refresh</button>
        </div>
        <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} loading={loading} onPage={load} />
        <div className="list-group list-group-flush">
          {loading ? (
            <div className="text-center text-muted py-5"><Spinner /> Loading diary...</div>
          ) : items.length ? (
            items.map((d) => (
              <div key={d.id} className="list-group-item p-3">
                <div className="d-flex align-items-start justify-content-between gap-3">
                  <div className="min-w-0">
                    <TypeBadge type={d.type} />
                    <h6 className="fw-black mt-2 mb-1">{d.title}</h6>
                    <p className="text-muted small mb-2 diary-content-line">{d.content}</p>
                    <small className="text-muted">{formatDate(d.date)} • {subjectNameOf(d)}</small>
                  </div>
                  <div className="btn-group btn-group-sm">
                    <button className="btn btn-outline-primary" onClick={() => setViewDiary(d)}>View</button>
                    <button className="btn btn-outline-success" onClick={() => acknowledge(d)}>Ack</button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-muted py-5">No diary notes found.</div>
          )}
        </div>
        <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} loading={loading} onPage={load} position="bottom" />
      </div>
      <DiaryViewModal diary={viewDiary} onClose={() => setViewDiary(null)} />
      <DiaryStyles />
    </div>
  );
}

function DiaryStyles() {
  return (
    <style>{`
      .digital-diary-page {
        background: linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
        min-height: calc(100vh - 56px);
      }
      .fw-black { font-weight: 900; }
      .text-white-75 { color: rgba(255,255,255,.78); }
      .min-w-0 { min-width: 0; }
      .diary-hero {
        padding: 22px;
        background:
          radial-gradient(circle at top right, rgba(255,255,255,.22), transparent 32%),
          linear-gradient(135deg, #1f7ae0 0%, #4f46e5 48%, #7c3aed 100%);
      }
      .eyebrow {
        text-transform: uppercase;
        letter-spacing: .13em;
        font-size: 11px;
        font-weight: 800;
        color: rgba(255,255,255,.78);
      }
      .hero-stat {
        display: flex;
        gap: 12px;
        align-items: center;
        border: 1px solid rgba(255,255,255,.18);
        background: rgba(255,255,255,.14);
        border-radius: 18px;
        padding: 14px;
        backdrop-filter: blur(10px);
      }
      .hero-icon {
        width: 42px;
        height: 42px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 14px;
        font-size: 18px;
      }
      .hero-value { color: #fff; font-size: 22px; line-height: 1; font-weight: 900; }
      .hero-label { color: rgba(255,255,255,.76); font-size: 12px; font-weight: 700; }
      .diary-pagination {
        background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
        border-color: #e5e7eb;
      }
      .diary-pagination-top { border-bottom: 1px solid #e5e7eb; }
      .diary-pagination-bottom { border-top: 1px solid #e5e7eb; }
      .diary-table-scroll {
        max-height: calc(100vh - 300px);
        min-height: 360px;
        overflow: auto;
      }
      .diary-table {
        min-width: 1240px;
      }
      .diary-table-head th {
        position: sticky;
        top: 0;
        z-index: 2;
        background: #f8fafc !important;
        color: #334155;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: .04em;
        border-bottom: 1px solid #e2e8f0;
        white-space: nowrap;
      }
      .diary-title-col { min-width: 360px; }
      .diary-title-cell { max-width: 430px; }
      .diary-actions-col { min-width: 210px; }
      .diary-content-line {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .empty-state { max-width: 360px; }
      .diary-modal-backdrop {
        background: rgba(15, 23, 42, .58);
        backdrop-filter: blur(4px);
      }
      .diary-view-header {
        background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #6d28d9 100%);
      }
      .diary-edit-header {
        background: linear-gradient(135deg, #1f2937 0%, #2563eb 60%, #7c3aed 100%);
      }
      .diary-view-scroll-y {
        max-height: 72vh;
        overflow-y: auto;
      }
      .diary-view-scroll-x {
        overflow-x: auto;
      }
      .diary-view-canvas {
        min-width: 760px;
        background: #f8fafc;
      }
      .info-box {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 16px;
        padding: 13px 14px;
        min-height: 84px;
      }
      .info-box span {
        display: block;
        color: #64748b;
        font-size: 12px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: .04em;
      }
      .info-box strong {
        display: block;
        color: #0f172a;
        margin-top: 4px;
        font-weight: 900;
      }
      .info-box small { color: #64748b; }
      .content-preview-card { box-shadow: 0 8px 26px rgba(15, 23, 42, .06); }
      .diary-content-text {
        color: #334155;
        white-space: pre-wrap;
        line-height: 1.75;
        font-size: 15px;
      }
      .attachment-link { transition: all .18s ease; }
      .attachment-link:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(15, 23, 42, .08); }
      .ack-table-scroll {
        max-height: 65vh;
        overflow: auto;
      }
      .section-card {
        border: 1px solid #e2e8f0;
        border-radius: 22px;
        background: #fff;
        padding: 18px;
        box-shadow: 0 12px 30px rgba(15, 23, 42, .06);
      }
      .section-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 900;
        color: #0f172a;
        margin-bottom: 14px;
      }
      .upload-zone { cursor: pointer; transition: all .18s ease; }
      .upload-zone:hover { transform: translateY(-1px); background: #dbeafe !important; }
      .student-picker-list {
        max-height: 320px;
        overflow-y: auto;
        padding-right: 4px;
      }
      .student-check { cursor: pointer; transition: background .15s ease; }
      .student-check:hover { background: #fff; }
      .preview-box { box-shadow: inset 0 0 0 1px rgba(15, 23, 42, .02); }
      .attachment-edit-row { min-width: 0; }
      @media (max-width: 768px) {
        .diary-table-scroll { max-height: none; min-height: 300px; }
        .diary-view-canvas { min-width: 680px; }
        .diary-hero { padding: 18px; }
      }
    `}</style>
  );
}

export default function DigitalDiary() {
  return <ManageDiaries />;
}