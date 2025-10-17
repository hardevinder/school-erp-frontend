// src/pages/DigitalDiary.jsx
import React, { useEffect, useRef, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";

/* ──────────────────────────────────────────────
  Role helpers
────────────────────────────────────────────── */
const getRoleFlags = () => {
  const singleRole = localStorage.getItem("userRole");
  const multiRoles = JSON.parse(localStorage.getItem("roles") || "[]");
  const roles = multiRoles.length ? multiRoles : [singleRole].filter(Boolean);
  const lc = roles.map((r) => String(r || "").toLowerCase());
  return {
    roles,
    isAdmin: lc.includes("admin"),
    isSuperadmin: lc.includes("superadmin"),
    isHR: lc.includes("hr"),
    isCoordinator: lc.includes("academic_coordinator"),
    isTeacher: lc.includes("teacher"),
    isStudent: lc.includes("student"),
  };
};

/* ──────────────────────────────────────────────
  Ownership helpers (match server rules)
────────────────────────────────────────────── */
const getCurrentUserId = () => {
  const v =
    localStorage.getItem("userId") ||
    localStorage.getItem("userid") ||
    localStorage.getItem("currentUserId");
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const isAdminLikeUI = () => {
  const { isAdmin, isSuperadmin, isHR, isCoordinator } = getRoleFlags();
  return isAdmin || isSuperadmin || isHR || isCoordinator;
};

const isOwnerOfDiary = (d) => {
  const me = getCurrentUserId();
  if (!me) return false;
  const createdById = Number(d?.createdById ?? d?.createdBy?.id);
  return Number.isFinite(createdById) && createdById === me;
};

/* ──────────────────────────────────────────────
  Diary networking aligned to /diaries (relative)
────────────────────────────────────────────── */
const getAuthHeaders = () => {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("jwt") ||
    localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Always hit /diaries relative to the shared axios baseURL (.env)
function joinDiaryPath(suffix = "") {
  const base = "/diaries";
  const s = String(suffix || "");
  return s ? `${base}${s.startsWith("/") ? s : `/${s}`}` : base;
}

async function diaryRequest({ method = "get", suffix = "", params, data, headers = {} }) {
  return api.request({
    method,
    url: joinDiaryPath(suffix),
    params,
    data,
    headers: { ...getAuthHeaders(), ...headers },
  });
}


const diaryGet = (suffix = "", params) =>
  diaryRequest({ method: "get", suffix, params });
const diaryPost = (suffix = "", data, headers) =>
  diaryRequest({ method: "post", suffix, data, headers });
const diaryPut = (suffix = "", data, headers) =>
  diaryRequest({ method: "put", suffix, data, headers });
const diaryDelete = (suffix = "", params) =>
  diaryRequest({ method: "delete", suffix, params });

/* ──────────────────────────────────────────────
  Students (for per-student targeting)
────────────────────────────────────────────── */
/* ──────────────────────────────────────────────
  Students (for per-student targeting) — strict class+section
  Uses server: GET /students/searchByClassAndSection?class_id=..&section_id=..&session_id=..&q=..
────────────────────────────────────────────── */
async function studentsGet(params = {}) {
  // map camelCase frontend params -> snake_case server params
  const p = {};
  if (params.classId) p.class_id = params.classId;
  if (params.sectionId) p.section_id = params.sectionId;
  if (params.sessionId) p.session_id = params.sessionId;
  if (params.q) p.q = params.q;
  // some callers pass pageSize — map to limit (server uses page/limit in other handlers)
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
  Utilities
────────────────────────────────────────────── */
const PAGE_SIZE = 20;

function guessMime(fileName = "") {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  const map = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
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

/* Enhanced spinner helper with custom styles */
const Spinner = ({ small = false }) => (
  <div
    className={`spinner-border text-primary ${small ? "spinner-border-sm" : ""}`}
    role="status"
    style={{ width: small ? "1rem" : "2rem", height: small ? "1rem" : "2rem" }}
  >
    <span className="visually-hidden">Loading...</span>
  </div>
);

/* ──────────────────────────────────────────────
  Merge duplicates: same message across classes
────────────────────────────────────────────── */
function normalizeStr(s = "") {
  return String(s || "").trim().replace(/\s+/g, " ");
}
function attachmentsSignature(arr = []) {
  if (!Array.isArray(arr)) return "";
  const norm = arr.map((a) => ({
    n: a.originalName || a.name || "",
    u: a.fileUrl || a.url || "",
    m: a.mimeType || a.kind || "",
    z: a.size || 0,
  }));
  return JSON.stringify(norm.sort((a, b) => (a.n + a.u).localeCompare(b.n + b.u)));
}
function groupDiaries(items = []) {
  const byKey = new Map();
  for (const d of items) {
    if (Array.isArray(d.targets) && d.targets.length) {
      const k = `targets-${d.id}`;
      byKey.set(k, { ...d, _sourceIds: [d.id] });
      continue;
    }
    const key = [
      d.date?.slice(0, 10) || d.date,
      d.type,
      normalizeStr(d.title),
      normalizeStr(d.content),
      d.subjectId ?? "",
      attachmentsSignature(d.attachments),
    ].join("|");

    const entry = byKey.get(key);
    const classObj = d.class ? { ...d.class } : d.Class || null;
    const sectionObj = d.section ? { ...d.section } : d.Section || null;
    const target = {
      classId: d.classId || classObj?.id,
      sectionId: d.sectionId || sectionObj?.id,
      class: classObj || (d.classId ? { id: d.classId } : undefined),
      section: sectionObj || (d.sectionId ? { id: d.sectionId } : undefined),
    };

    if (!entry) {
      byKey.set(key, {
        ...d,
        targets: [target],
        _sourceIds: [d.id],
        _counts: {
          views: d.views?.length ?? d._counts?.views ?? d.seenCount ?? 0,
          acks: d.acknowledgements?.length ?? d._counts?.acks ?? d.ackCount ?? 0,
        },
      });
    } else {
      const exists = entry.targets.some((t) => t.classId === target.classId && t.sectionId === target.sectionId);
      if (!exists) entry.targets.push(target);
      entry._sourceIds.push(d.id);
      entry._counts.views += d.views?.length ?? d._counts?.views ?? d.seenCount ?? 0;
      entry._counts.acks += d.acknowledgements?.length ?? d._counts?.acks ?? d.ackCount ?? 0;
    }
  }

  return Array.from(byKey.values()).map((x) => ({
    ...x,
    seenCount: x._counts?.views ?? x.seenCount,
    ackCount: x._counts?.acks ?? x.ackCount,
  }));
}

/* ──────────────────────────────────────────────
  Attachment inputs
────────────────────────────────────────────── */
function AttachmentsInput({ value, onChange }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const add = () => {
    if (!url.trim()) return;
    const n = name.trim() || url.split("/").pop() || "Attachment";
    onChange([...(value || []), { name: n, url, kind: "" }]);
    setName("");
    setUrl("");
  };

  const remove = (i) => {
    const next = [...(value || [])];
    next.splice(i, 1);
    onChange(next);
  };

  return (
    <div className="position-relative">
      <div className="row g-2 align-items-end">
        <div className="col-md-4">
          <label className="form-label fw-semibold text-muted">File Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="form-control rounded-pill shadow-sm"
            placeholder="Worksheet.pdf"
          />
        </div>
        <div className="col-md-6">
          <label className="form-label fw-semibold text-muted">URL</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="form-control rounded-pill shadow-sm"
            placeholder="https://example.com/file.pdf"
          />
        </div>
        <div className="col-md-2 d-grid">
          <button type="button" onClick={add} className="btn btn-outline-primary rounded-pill shadow-sm">
            ➕ Add
          </button>
        </div>
      </div>

      {(value || []).length > 0 && (
        <ul className="list-group mt-3 border rounded-3 shadow-sm">
          {value.map((a, i) => (
            <li
              key={`${a.url}-${i}`}
              className="list-group-item d-flex justify-content-between align-items-center px-3 py-2"
            >
              <div className="d-flex align-items-center gap-2 flex-grow-1">
                <i className="bi bi-paperclip text-primary fs-5"></i>
                <div className="flex-grow-1">
                  <div className="fw-semibold text-truncate" style={{ maxWidth: "200px" }}>
                    {a.name}
                  </div>
                  <small className="text-muted d-block text-truncate">{a.url}</small>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger rounded-circle p-1 shadow-sm"
                onClick={() => remove(i)}
              >
                <i className="bi bi-x"></i>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────
  Computer uploads (drag & drop or click)
────────────────────────────────────────────── */
function FileUploads({ files = [], setFiles, max = 10 }) {
  const inputRef = useRef(null);

  const asArray = (f) => (Array.isArray(f) ? f : Array.from(f || []));

  const getDisplayName = (f) => {
    if (!f) return "Attachment";
    if (typeof f === "string") return f.split("/").pop() || f;
    return f.name || f.fileName || f.path || "Attachment";
  };
  const getSizeKB = (f) => {
    const s = (f && typeof f === "object" && "size" in f && f.size) || 0;
    return Math.ceil(s / 1024);
  };

  const items = asArray(files);

  const pushAndClamp = (incoming) => {
    const next = [...items, ...incoming].slice(0, max);
    setFiles(next);
  };

  const onPick = (e) => {
    const picked = Array.from(e.target.files || []);
    if (picked.length) pushAndClamp(picked);
    e.target.value = "";
  };

  const onDrop = (e) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer?.files || []);
    if (dropped.length) pushAndClamp(dropped);
  };

  const onDragOver = (e) => e.preventDefault();

  const remove = (idx) => {
    const next = [...items];
    next.splice(idx, 1);
    setFiles(next);
  };

  return (
    <div>
      <div
        className="border border-2 border-primary border-dashed rounded-4 p-4 text-center bg-light-subtle"
        style={{ cursor: "pointer" }}
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <input type="file" multiple ref={inputRef} className="d-none" onChange={onPick} />
        <i className="bi bi-cloud-arrow-up fs-1 text-primary d-block mb-2"></i>
        <div className="fw-semibold">Drop files here, or click to browse</div>
        <small className="text-muted d-block">Up to {max} files</small>
      </div>

      {items.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mt-3">
          {items.map((f, i) => (
            <span
              key={i}
              className="badge bg-white text-dark border rounded-pill px-3 py-2 shadow-sm d-flex align-items-center gap-2"
            >
              <i className="bi bi-file-earmark"></i>
              <span className="text-truncate" style={{ maxWidth: 220 }}>
                {getDisplayName(f)} <small className="text-muted">({getSizeKB(f)} KB)</small>
              </span>
              <button
                type="button"
                className="btn btn-sm btn-link text-danger p-0 ms-1"
                onClick={() => remove(i)}
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────
  Enhanced Diary card with proper contrast
────────────────────────────────────────────── */
function DiaryCard({ item, canAck }) {
  const [acked, setAcked] = useState((item.acknowledgements || []).length > 0);
  const [note, setNote] = useState("");
  const [loadingAck, setLoadingAck] = useState(false);

  const doAck = async () => {
    if (!canAck) return;
    setLoadingAck(true);
    try {
      await diaryPost(`/${item.id}/ack`, note ? { note } : undefined);
      setAcked(true);
      setNote("");
    } catch (e) {
      Swal.fire(
        "Error",
        e?.response?.status === 401 ? "Please login again." : "Failed to acknowledge",
        "error"
      );
    } finally {
      setLoadingAck(false);
    }
  };

  const seenCount = item.views?.length ?? item._counts?.views ?? item.seenCount ?? 0;
  const ackCount = item.acknowledgements?.length ?? item._counts?.acks ?? item.ackCount ?? 0;

  const hasMultipleTargets = item.targets && Array.isArray(item.targets) && item.targets.length > 0;
  const targetsDisplay = hasMultipleTargets
    ? item.targets.map((t, idx) => (
        <span key={idx} className="badge bg-light text-dark border rounded-pill px-3 py-2 small shadow-sm">
          <i className="bi bi-people me-1"></i>
          {t.class?.class_name || t.class?.name || `Class ${t.classId || t.class?.id}`}{" "}
          {t.section?.section_name || t.section?.name || `Sec ${t.sectionId || t.section?.id}`}
        </span>
      ))
    : null;

  const singleTargetDisplay = !hasMultipleTargets ? (
    <div className="d-flex align-items-center gap-2 mb-3 p-2 bg-light rounded-3">
      <i className="bi bi-target text-primary fs-5"></i>
      <small className="text-muted fw-medium">
        {item.class?.class_name || item.class?.name || `Class ${item.classId}`} -{" "}
        {item.section?.section_name || item.section?.name || item.sectionId}
        {item.subject?.name ? (
          <>
            {" "}
            <i className="bi bi-circle-fill text-primary mx-1"></i>
            <span className="text-primary fw-semibold">{item.subject.name}</span>
          </>
        ) : null}
      </small>
    </div>
  ) : null;

  const TYPE_THEMES = {
    HOMEWORK: { header: "bg-warning text-dark", badge: "bg-dark text-warning" },
    REMARK: { header: "bg-info text-white", badge: "bg-white text-info border border-info" },
    ANNOUNCEMENT: { header: "bg-success text-white", badge: "bg-white text-success border border-success" },
    DEFAULT: { header: "bg-primary text-white", badge: "bg-white text-primary border border-primary" },
  };

  const theme = TYPE_THEMES[item.type] || TYPE_THEMES.DEFAULT;
  const headerClass = `bg-gradient ${theme.header}`;
  const badgeClass = `badge rounded-pill px-3 py-2 fw-semibold ${theme.badge}`;

  const normalizedAttachments = Array.isArray(item.attachments)
    ? item.attachments
        .map((a) => {
          const href = a?.fileUrl || a?.url || (typeof a === "string" ? a : "");
          const label =
            a?.originalName || a?.name || (href ? href.split("/").pop() : "") || "Attachment";
          return href ? { href, label } : null;
        })
        .filter(Boolean)
    : [];

  return (
    <div
      className="card border-0 shadow-lg rounded-4 overflow-hidden h-100 transition-all"
      style={{ transition: "transform 0.2s ease" }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-4px)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
    >
      <div className={`card-header ${headerClass} py-3 px-4`}>
        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3">
            <div className="rounded-circle p-2" style={{ background: "rgba(255,255,255,.2)" }}>
              <i className="bi bi-calendar3" style={{ color: "currentColor" }}></i>
            </div>
            <div>
              <small className="fw-semibold d-block">
                {new Date(item.date).toLocaleDateString("en-US", {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </small>
              <span className={badgeClass}>
                <i className="bi bi-tag me-1"></i>
                {item.type}
              </span>
              {Array.isArray(item.recipients) && item.recipients.length > 0 && (
                <span className="badge rounded-pill bg-danger-subtle text-danger border border-danger ms-2">
                  <i className="bi bi-lock-fill me-1"></i> Private ({item.recipients.length})
                </span>
              )}
            </div>
          </div>
          <div className="text-end" style={{ opacity: 0.85 }}>
            <small className="d-block fw-semibold">
              <i className="bi bi-eye me-1"></i>
              {seenCount}
            </small>
            <small className="d-block fw-semibold">
              <i className="bi bi-check-circle me-1"></i>
              {ackCount}
            </small>
          </div>
        </div>
      </div>

      <div className="card-body p-4">
        <h5 className="card-title mb-3 fw-bold text-dark lh-sm">{item.title}</h5>
        <p
          className="card-text mb-4 text-secondary lh-lg"
          style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: "0.95rem" }}
        >
          {item.content}
        </p>

        <div className="mb-4">
          {hasMultipleTargets && (
            <>
              <small className="text-muted d-block mb-2 fw-semibold">
                <i className="bi bi-bullseye me-1"></i>
                Targets
              </small>
              <div className="d-flex flex-wrap gap-2">{targetsDisplay}</div>
            </>
          )}
          {singleTargetDisplay}
        </div>

        {normalizedAttachments.length > 0 && (
          <div className="d-flex flex-wrap gap-2 mb-4">
            {normalizedAttachments.map((att, idx) => (
              <a
                key={`${att.href}-${idx}`}
                href={att.href}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline-primary rounded-pill px-4 py-2 text-decoration-none shadow-sm d-flex align-items-center gap-2 transition-all"
                style={{ transition: "all 0.2s ease" }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                <i className="bi bi-paperclip"></i>
                {att.label}
              </a>
            ))}
          </div>
        )}

        {canAck && (
          <div className="mt-auto p-3 bg-light rounded-3">
            <div className="d-flex flex-wrap gap-2 align-items-center">
              {acked ? (
                <div className="badge bg-success bg-opacity-75 rounded-pill px-4 py-3 d-flex align-items-center gap-2">
                  <i className="bi bi-check-circle-fill"></i>
                  Acknowledged
                </div>
              ) : (
                <>
                  <input
                    className="form-control form-control-sm flex-grow-1 rounded-pill shadow-sm"
                    placeholder="Optional note..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    style={{ maxWidth: 300 }}
                  />
                  <button
                    className="btn btn-primary rounded-pill px-4 py-2 shadow-sm d-flex align-items-center gap-2"
                    disabled={loadingAck}
                    onClick={doAck}
                  >
                    {loadingAck ? (
                      <>
                        <Spinner small /> <span>Acknowledging...</span>
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-lg"></i>
                        Acknowledge
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
  Manage (CRUD) — non-students only
────────────────────────────────────────────── */
function ManageDiaries() {
  const roleFlags = getRoleFlags();
  const canManage =
    roleFlags.isAdmin ||
    roleFlags.isSuperadmin ||
    roleFlags.isHR ||
    roleFlags.isCoordinator ||
    roleFlags.isTeacher;

  const [diaries, setDiaries] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pageSize: PAGE_SIZE });

  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [filters, setFilters] = useState({
    from: "",
    to: "",
    classId: "",
    sectionId: "",
    subjectId: "",
    type: "",
    q: "",
  });

  const [applyLoading, setApplyLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);

  const [form, setForm] = useState({
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
  });

  const [multiMode, setMultiMode] = useState(false);
  const [targets, setTargets] = useState([]);
  const [draftTarget, setDraftTarget] = useState({ classId: "", sectionId: "" });
  const [saving, setSaving] = useState(false);

  const [studentsForPicker, setStudentsForPicker] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  useEffect(() => {
    if (!canManage) return;

    const loadLists = async () => {
      try {
        const [cls, sec] = await Promise.all([api.get("/classes"), api.get("/sections")]);
        const clsData = Array.isArray(cls.data) ? cls.data : cls.data.classes || [];
        const secData = Array.isArray(sec.data) ? sec.data : sec.data.sections || [];
        setClasses(clsData);
        setSections(secData);
      } catch {
        Swal.fire("Error", "Failed to load classes/sections", "error");
      }

      try {
        const resp = await api.get("/class-subject-teachers/teacher/class-subjects", {
          headers: { ...getAuthHeaders() },
        });
        const arr = resp?.data?.assignments?.map((x) => x.subject).filter(Boolean) || [];
        const unique = Array.from(new Map(arr.map((s) => [s.id, s])).values());
        setSubjects(unique);
      } catch {
        setSubjects([]);
      }

      try {
        const { data } = await api.get("/sessions");
        const list = Array.isArray(data) ? data : data.items || [];
        setSessions(list);
        const active = list.find((s) => s.is_active === true);
        setForm((f) => ({ ...f, sessionId: active?.id || list[0]?.id || "" }));
      } catch {
        setSessions([]);
      }
    };

    const loadDiaries = async (p = 1) => {
      setApplyLoading(true);
      try {
        const params = {
          page: p,
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
        const list = Array.isArray(res?.data?.data) ? res.data.data : [];
        setDiaries(groupDiaries(list));
        setPagination(res?.data?.pagination || { total: 0, pageSize: PAGE_SIZE, page: 1 });
        setPage(p);
      } catch (e) {
        const status = e?.response?.status;
        const msg = status === 401 ? "Unauthorized. Please login again." : "Failed to load diaries";
        Swal.fire("Error", msg, "error");
      } finally {
        setApplyLoading(false);
      }
    };

    loadLists();
    loadDiaries(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  useEffect(() => {
    const classId = Number(form.classId);
    const sectionId = Number(form.sectionId);
    const isCreateSingle = !multiMode && !form.id;

    if (!isCreateSingle || !classId || !sectionId) {
      setStudentsForPicker([]);
      setSelectedStudentIds([]);
      return;
    }

    const loadStudents = async () => {
      setStudentsLoading(true);
      try {
        const { data } = await studentsGet({
          classId,
          sectionId,
          q: studentSearch && studentSearch.trim().length >= 2 ? studentSearch.trim() : undefined,
          pageSize: 500,
        });

        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.items)
          ? data.items
          : [];

        setStudentsForPicker(list);
        setSelectedStudentIds((prev) => prev.filter((id) => list.some((s) => s.id === id)));
      } catch {
        setStudentsForPicker([]);
      } finally {
        setStudentsLoading(false);
      }
    };

    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.classId, form.sectionId, studentSearch, multiMode, form.id]);

  const resetForm = () => {
    setForm((prev) => ({
      id: null,
      sessionId: sessions.find((s) => s.is_active)?.id || sessions[0]?.id || "",
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
    }));
    setMultiMode(false);
    setTargets([]);
    setDraftTarget({ classId: "", sectionId: "" });
    setStudentsForPicker([]);
    setSelectedStudentIds([]);
    setStudentSearch("");
  };

  const [showModal, setShowModal] = useState(false);

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (d) => {
    if (!isAdminLikeUI() && !isOwnerOfDiary(d)) {
      Swal.fire("Not allowed", "You can only edit diaries you created.", "warning");
      return;
    }
    const existing = (d.attachments || []).map((a) => ({
      id: a.id,
      name: a.originalName || a.name || (a.fileUrl?.split("/").pop() || "Attachment"),
      url: a.fileUrl || a.url,
      kind: a.kind || "",
    }));
    setForm({
      id: d.id,
      sessionId: d.sessionId,
      date: d.date.slice(0, 10),
      type: d.type,
      title: d.title,
      content: d.content,
      classId: d.classId,
      sectionId: d.sectionId,
      subjectId: d.subjectId || "",
      attachments: existing,
      selectedFiles: [],
      replaceAttachments: false,
      keepAttachmentIds: existing.filter((a) => a.id).map((a) => a.id),
    });
    setMultiMode(false);
    setTargets([]);
    setDraftTarget({ classId: "", sectionId: "" });
    setStudentsForPicker([]);
    setSelectedStudentIds([]);
    setStudentSearch("");
    setShowModal(true);
  };

  const addTarget = () => {
    const c = Number(draftTarget.classId);
    const s = Number(draftTarget.sectionId);
    if (!c || !s) return;
    const exists = targets.some((t) => t.classId === c && t.sectionId === s);
    if (exists) return;
    setTargets([...targets, { classId: c, sectionId: s }]);
    setDraftTarget({ classId: "", sectionId: "" });
  };

  const removeTarget = (idx) => {
    const next = [...targets];
    next.splice(idx, 1);
    setTargets(next);
  };

  const dedupTargets = (arr) => {
    const seen = new Set();
    const out = [];
    for (const t of arr) {
      if (!t.classId || !t.sectionId) continue;
      const k = `${Number(t.classId)}-${Number(t.sectionId)}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ classId: Number(t.classId), sectionId: Number(t.sectionId) });
      }
    }
    return out;
  };

  const addAllTargets = () => {
    if (!classes.length || !sections.length) {
      Swal.fire("Missing", "Classes/Sections not loaded yet.", "warning");
      return;
    }

    const getSectionClassId = (s) =>
      Number(s.classId ?? s.class_id ?? s.class ?? s.ClassId ?? 0);

    const sectionsAreBound = sections.some((s) => getSectionClassId(s));

    const all = [];
    if (sectionsAreBound) {
      for (const c of classes) {
        const cid = Number(c.id);
        for (const s of sections) {
          if (getSectionClassId(s) === cid) {
            all.push({ classId: cid, sectionId: Number(s.id) });
          }
        }
      }
    } else {
      for (const c of classes) {
        for (const s of sections) {
          all.push({ classId: Number(c.id), sectionId: Number(s.id) });
        }
      }
    }

    setTargets((prev) => dedupTargets([...prev, ...all]));
  };

  const addAllSectionsForSelectedClass = () => {
    const c = Number(draftTarget.classId);
    if (!c) {
      Swal.fire("Select class", "Choose a class first to add all its sections.", "info");
      return;
    }
    const getSectionClassId = (s) =>
      Number(s.classId ?? s.class_id ?? s.class ?? s.ClassId ?? 0);

    const rows = sections
      .filter((s) => !getSectionClassId(s) || getSectionClassId(s) === c)
      .map((s) => ({ classId: c, sectionId: Number(s.id) }));

    setTargets((prev) => dedupTargets([...prev, ...rows]));
  };

  const clearAllTargets = () => setTargets([]);

  const buildSavePayload = () => {
    const linkAttachments = (form.attachments || []).map((a) => ({
      fileUrl: a.url,
      originalName: a.name || (a.url?.split("/").pop() || "Attachment"),
      mimeType: a.mimeType || guessMime(a.name || a.url),
      size: a.size || 0,
    }));

    const base = {
      sessionId: Number(form.sessionId),
      date: form.date,
      type: form.type,
      title: form.title,
      content: form.content,
      subjectId: form.subjectId ? Number(form.subjectId) : null,
    };

    const hasFiles = (form.selectedFiles || []).length > 0;
    const isUpdate = !!form.id;
    const requiresFormData = hasFiles || (isUpdate && form.replaceAttachments === true);

    if (!requiresFormData) {
      const payload = {
        ...base,
        attachments: linkAttachments,
        ...(isUpdate
          ? {
              replaceAttachments: !!form.replaceAttachments,
              existingFiles: Array.isArray(form.keepAttachmentIds)
                ? form.keepAttachmentIds
                : undefined,
            }
          : {}),
        ...(multiMode && !form.id
          ? { targets }
          : { classId: Number(form.classId), sectionId: Number(form.sectionId) }),
        ...(!isUpdate && !multiMode && selectedStudentIds.length
          ? { studentIds: selectedStudentIds }
          : {}),
      };
      return { data: payload, headers: {} };
    }

    const fd = new FormData();

    Object.entries(base).forEach(([k, v]) => {
      fd.append(k, v === null || v === undefined ? "" : String(v));
    });

    fd.append("attachments", JSON.stringify(linkAttachments));

    if (multiMode && !form.id) {
      fd.append("targets", JSON.stringify(targets));
      (targets || []).forEach((t, i) => {
        fd.append(`targets[${i}][classId]`, String(Number(t.classId || 0)));
        fd.append(`targets[${i}][sectionId]`, String(Number(t.sectionId || 0)));
      });
    } else {
      fd.append("classId", String(Number(form.classId || 0)));
      fd.append("sectionId", String(Number(form.sectionId || 0)));
    }

    if (!isUpdate && !multiMode && selectedStudentIds.length) {
      fd.append("studentIds", selectedStudentIds.join(","));
    }

    if (isUpdate) {
      if (form.replaceAttachments) {
        fd.append("replaceAttachments", "true");
      } else if (Array.isArray(form.keepAttachmentIds)) {
        fd.append("existingFiles", JSON.stringify(form.keepAttachmentIds));
      }
    }

    (form.selectedFiles || [])
      .filter((f) => f && typeof f === "object" && "name" in f)
      .forEach((f) => fd.append("files", f));

    return { data: fd, headers: {} };
  };

  const save = async () => {
    if (!form.sessionId || !form.date || !form.type || !form.title || !form.content) {
      Swal.fire("Missing", "Please fill session, date, type, title and content.", "warning");
      return;
    }

    if (multiMode) {
      if (targets.length === 0) {
        Swal.fire("Missing", "Please add at least one Class & Section in Targets.", "warning");
        return;
      }
    } else if (!form.id) {
      if (!form.classId || !form.sectionId) {
        Swal.fire("Missing", "Please select Class & Section.", "warning");
        return;
      }
    }

    try {
      setSaving(true);
      const { data, headers } = buildSavePayload();

      if (form.id) {
        await diaryPut(`/${form.id}`, data, headers);
      } else {
        await diaryPost("", data, headers);
      }

      Swal.fire("Success", form.id ? "Diary updated" : "Diary created", "success");
      setShowModal(false);

      setApplyLoading(true);
      const resp = await diaryGet("", {
        page: 1,
        pageSize: PAGE_SIZE,
        dateFrom: filters.from || undefined,
        dateTo: filters.to || undefined,
        classId: filters.classId || undefined,
        sectionId: filters.sectionId || undefined,
        subjectId: filters.subjectId === "null" ? null : filters.subjectId || undefined,
        type: filters.type || undefined,
        q: filters.q || undefined,
      });
      const raw = Array.isArray(resp?.data?.data) ? resp.data.data : [];
      setDiaries(groupDiaries(raw));
      setPagination(resp?.data?.pagination || { total: 0, pageSize: PAGE_SIZE, page: 1 });
      setPage(1);
    } catch (e) {
      Swal.fire(
        "Error",
        e.response?.data?.error || e.response?.data?.message || "Failed to save diary",
        "error"
      );
    } finally {
      setSaving(false);
      setApplyLoading(false);
    }
  };

  const del = async (idOrIds) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    const result = await Swal.fire({
      title: ids.length > 1 ? "Delete this message from all classes?" : "Delete this diary?",
      text:
        ids.length > 1
          ? "This will remove all copies of this message across selected classes/sections."
          : "This will archive (hide) the note. You can hard-delete later if needed.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
    });
    if (!result.isConfirmed) return;

    try {
      setApplyLoading(true);
      for (const id of ids) {
        await diaryDelete(`/${id}`);
      }
      Swal.fire("Deleted", ids.length > 1 ? "Message removed from all classes." : "Diary deleted", "success");
      const { data } = await diaryGet("", { page: 1, pageSize: PAGE_SIZE });
      const raw = Array.isArray(data?.data) ? data.data : [];
      setDiaries(groupDiaries(raw));
      setPagination(data?.pagination || { total: 0, pageSize: PAGE_SIZE, page: 1 });
      setPage(1);
    } catch (e) {
      Swal.fire("Error", e.response?.data?.error || "Failed to delete", "error");
    } finally {
      setApplyLoading(false);
    }
  };

  if (!canManage) return null;

  const toggleKeep = (id, checked) => {
    setForm((f) => {
      const set = new Set(f.keepAttachmentIds || []);
      if (checked) set.add(id);
      else set.delete(id);
      return { ...f, keepAttachmentIds: Array.from(set) };
    });
  };

  return (
    <div className="mb-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="m-0 fw-bold text-dark mb-1">Digital Diary Management</h2>
          <p className="text-muted mb-0">Create, attach files, and manage notes across classes.</p>
        </div>
        <button className="btn btn-success rounded-pill px-5 py-2 shadow-lg" onClick={openCreate}>
          <i className="bi bi-plus-circle me-2"></i>
          Add Diary
        </button>
      </div>

      {/* Filters */}
      <div className="card border-0 shadow-lg mb-4 rounded-4 overflow-hidden">
        <div className="card-header bg-gradient bg-light border-0 py-3 px-4">
          <h6 className="mb-0 fw-semibold text-dark">
            <i className="bi bi-funnel me-2"></i>Filters & Search
          </h6>
        </div>
        <div className="card-body p-4">
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label fw-semibold text-muted">From Date</label>
              <input
                type="date"
                className="form-control rounded-pill shadow-sm"
                value={filters.from}
                onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold text-muted">To Date</label>
              <input
                type="date"
                className="form-control rounded-pill shadow-sm"
                value={filters.to}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold text-muted">Type</label>
              <select
                className="form-select rounded-pill shadow-sm"
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              >
                <option value="">All Types</option>
                <option value="HOMEWORK">Homework</option>
                <option value="REMARK">Remark</option>
                <option value="ANNOUNCEMENT">Announcement</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold text-muted">Search</label>
              <input
                className="form-control rounded-pill shadow-sm"
                placeholder="Title or content..."
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold text-muted">Class</label>
              <select
                className="form-select rounded-pill shadow-sm"
                value={filters.classId}
                onChange={(e) => setFilters({ ...filters, classId: e.target.value })}
              >
                <option value="">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.class_name || c.name || `Class ${c.id}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold text-muted">Section</label>
              <select
                className="form-select rounded-pill shadow-sm"
                value={filters.sectionId}
                onChange={(e) => setFilters({ ...filters, sectionId: e.target.value })}
              >
                <option value="">All Sections</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.section_name || s.name || s.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold text-muted">Subject</label>
              <select
                className="form-select rounded-pill shadow-sm"
                value={filters.subjectId}
                onChange={(e) => setFilters({ ...filters, subjectId: e.target.value })}
              >
                <option value="">All Subjects</option>
                <option value="null">General</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3 d-grid">
              <label className="form-label fw-semibold text-muted">&nbsp;</label>
              <button
                className="btn btn-primary rounded-pill shadow-lg px-4"
                onClick={() => {
                  setApplyLoading(true);
                  diaryGet("", {
                    page: 1,
                    pageSize: PAGE_SIZE,
                    dateFrom: filters.from || undefined,
                    dateTo: filters.to || undefined,
                    classId: filters.classId || undefined,
                    sectionId: filters.sectionId || undefined,
                    subjectId:
                      filters.subjectId === "null" ? null : filters.subjectId || undefined,
                    type: filters.type || undefined,
                    q: filters.q || undefined,
                  })
                    .then(({ data }) => {
                      const raw = Array.isArray(data?.data) ? data.data : [];
                      setDiaries(groupDiaries(raw));
                      setPagination(
                        data?.pagination || { total: 0, pageSize: PAGE_SIZE, page: 1 }
                      );
                      setPage(1);
                    })
                    .catch(() =>
                      Swal.fire("Error", "Failed to load diaries with filters", "error")
                    )
                    .finally(() => setApplyLoading(false));
                }}
                disabled={applyLoading}
              >
                {applyLoading ? (
                  <>
                    <Spinner small /> Applying…
                  </>
                ) : (
                  <>
                    <i className="bi bi-search me-2"></i>
                    Apply
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="row g-4 mb-4">
        {diaries.map((d) => (
          <div className="col-12 col-md-6 col-xl-4" key={d.id}>
            <div className="position-relative">
              <DiaryCard item={d} canAck={false} />
              {(isAdminLikeUI() || isOwnerOfDiary(d)) && (
                <div className="d-flex gap-2 mt-3">
                  <button
                    className="btn btn-outline-primary rounded-pill px-4 py-2 shadow-sm flex-grow-1"
                    onClick={() => {
                      if (!isAdminLikeUI() && !isOwnerOfDiary(d)) {
                        Swal.fire("Not allowed", "You can only edit diaries you created.", "warning");
                        return;
                      }
                      openEdit(d);
                    }}
                  >
                    <i className="bi bi-pencil me-2"></i>
                    Edit
                  </button>
                  <button
                    className="btn btn-outline-danger rounded-pill px-4 py-2 shadow-sm"
                    onClick={() => {
                      if (!isAdminLikeUI() && !isOwnerOfDiary(d)) {
                        Swal.fire("Not allowed", "You can only delete diaries you created.", "warning");
                        return;
                      }
                      del(d._sourceIds?.length ? d._sourceIds : d.id);
                    }}
                    title={
                      d._sourceIds?.length > 1 ? "Delete this message from all classes" : "Delete"
                    }
                  >
                    <i className="bi bi-trash me-2"></i>
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination?.total > (pagination?.pageSize || PAGE_SIZE) && (
        <div className="d-flex justify-content-center align-items-center gap-3 mt-5 p-4 bg-light rounded-4 shadow-sm">
          <button
            className="btn btn-outline-secondary btn-lg rounded-pill px-4 shadow-sm"
            disabled={page <= 1 || pageLoading}
            onClick={() => {
              const newP = page - 1;
              setPageLoading(true);
              diaryGet("", {
                page: newP,
                pageSize: PAGE_SIZE,
                dateFrom: filters.from || undefined,
                dateTo: filters.to || undefined,
                classId: filters.classId || undefined,
                sectionId: filters.sectionId || undefined,
                subjectId: filters.subjectId || undefined,
                type: filters.type || undefined,
                q: filters.q || undefined,
              })
                .then(({ data }) => {
                  const raw = Array.isArray(data?.data) ? data.data : [];
                  setDiaries(groupDiaries(raw));
                  setPagination(
                    data?.pagination || { total: 0, pageSize: PAGE_SIZE, page: newP }
                  );
                  setPage(newP);
                })
                .finally(() => setPageLoading(false));
            }}
          >
            {pageLoading ? <Spinner small /> : <i className="bi bi-chevron-left"></i>} Prev
          </button>
          <div className="fw-bold fs-5 text-dark">
            Page {page} of {Math.ceil(pagination.total / (pagination.pageSize || PAGE_SIZE))}
          </div>
          <button
            className="btn btn-outline-secondary btn-lg rounded-pill px-4 shadow-sm"
            disabled={page * (pagination.pageSize || PAGE_SIZE) >= pagination.total || pageLoading}
            onClick={() => {
              const newP = page + 1;
              setPageLoading(true);
              diaryGet("", {
                page: newP,
                pageSize: PAGE_SIZE,
                dateFrom: filters.from || undefined,
                dateTo: filters.to || undefined,
                classId: filters.classId || undefined,
                sectionId: filters.sectionId || undefined,
                subjectId: filters.subjectId || undefined,
                type: filters.type || undefined,
                q: filters.q || undefined,
              })
                .then(({ data }) => {
                  const raw = Array.isArray(data?.data) ? data.data : [];
                  setDiaries(groupDiaries(raw));
                  setPagination(
                    data?.pagination || { total: 0, pageSize: PAGE_SIZE, page: newP }
                  );
                  setPage(newP);
                })
                .finally(() => setPageLoading(false));
            }}
          >
            Next <i className="bi bi-chevron-right"></i>{" "}
            {pageLoading ? <Spinner small className="ms-2" /> : null}
          </button>
        </div>
      )}

      {/* Create/Edit modal */}
      {showModal && (
        <div
          className="modal show d-block position-fixed"
          style={{ backgroundColor: "rgba(0,0,0,.5)" }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content rounded-5 border-0 shadow-xl">
              <div className="modal-header bg-gradient bg-primary text-white rounded-top-5 py-3 px-4">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-journal-text fs-4"></i>
                  <h5 className="modal-title mb-0 fw-bold">
                    {form.id ? "Edit Diary Entry" : "Create New Diary Entry"}
                  </h5>
                </div>
                <button
                  className="btn-close btn-close-white"
                  onClick={() => setShowModal(false)}
                  type="button"
                ></button>
              </div>
              <div className="modal-body p-4">
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label fw-semibold text-muted">Session</label>
                    <select
                      className="form-select rounded-pill shadow-sm"
                      value={form.sessionId}
                      onChange={(e) => setForm({ ...form, sessionId: e.target.value })}
                    >
                      <option value="">Select Session</option>
                      {sessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name || `${s.start_date} - ${s.end_date}`}
                          {s.is_active ? " (Active)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold text-muted">Date</label>
                    <input
                      type="date"
                      className="form-control rounded-pill shadow-sm"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold text-muted">Type</label>
                    <select
                      className="form-select rounded-pill shadow-sm"
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                    >
                      <option value="ANNOUNCEMENT">Announcement</option>
                      <option value="HOMEWORK">Homework</option>
                      <option value="REMARK">Remark</option>
                    </select>
                  </div>

                  {!multiMode && !form.id && (
                    <>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold text-muted">Class</label>
                        <select
                          className="form-select rounded-pill shadow-sm"
                          value={form.classId}
                          onChange={(e) => setForm({ ...form, classId: e.target.value })}
                        >
                          <option value="">Select Class</option>
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.class_name || c.name || c.id}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold text-muted">Section</label>
                        <select
                          className="form-select rounded-pill shadow-sm"
                          value={form.sectionId}
                          onChange={(e) => setForm({ ...form, sectionId: e.target.value })}
                        >
                          <option value="">Select Section</option>
                          {sections.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.section_name || s.name || s.id}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  {!multiMode && !form.id && (
                    <div className="col-12">
                      <div className="p-3 rounded-4 border bg-light-subtle">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <div className="fw-semibold">
                            Students {form.classId && form.sectionId ? `(${studentsForPicker.length})` : ""}
                          </div>
                          <div className="d-flex align-items-center gap-2">
                            <input
                              type="text"
                              className="form-control form-control-sm rounded-pill"
                              placeholder="Search (min 2 chars)…"
                              style={{ maxWidth: 220 }}
                              value={studentSearch}
                              onChange={(e) => setStudentSearch(e.target.value)}
                              disabled={!form.classId || !form.sectionId}
                            />
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm rounded-pill"
                              onClick={() => setSelectedStudentIds(studentsForPicker.map((s) => s.id))}
                              disabled={!studentsForPicker.length}
                              title="Select all"
                            >
                              Select all
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm rounded-pill"
                              onClick={() => setSelectedStudentIds([])}
                              disabled={!selectedStudentIds.length}
                              title="Clear"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        {!form.classId || !form.sectionId ? (
                          <div className="text-muted small">Pick Class & Section to load students.</div>
                        ) : studentsLoading ? (
                          <div className="d-flex align-items-center gap-2 text-muted">
                            <Spinner small /> <span>Loading students…</span>
                          </div>
                        ) : !studentsForPicker.length ? (
                          <div className="text-muted small">No students found.</div>
                        ) : (
                          <>
                            <div className="max-h-50 overflow-auto" style={{ maxHeight: 260 }}>
                              <div className="row row-cols-1 row-cols-md-2 g-2">
                                {studentsForPicker.map((s) => (
                                  <div className="col" key={s.id}>
                                    <label className="d-flex align-items-center gap-2 small bg-white border rounded-pill px-3 py-2 shadow-sm">
                                      <input
                                        type="checkbox"
                                        className="form-check-input m-0"
                                        checked={selectedStudentIds.includes(s.id)}
                                        onChange={() =>
                                          setSelectedStudentIds((prev) =>
                                            prev.includes(s.id)
                                              ? prev.filter((x) => x !== s.id)
                                              : [...prev, s.id]
                                          )
                                        }
                                      />
                                      <span className="text-truncate">
                                        {s.roll_number ? `${s.roll_number}. ` : ""}
                                        {s.name}
                                        {s.admission_number ? ` (${s.admission_number})` : ""}
                                      </span>
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="small mt-2 text-muted">
                              {selectedStudentIds.length
                                ? `Private: will send only to ${selectedStudentIds.length} selected student(s).`
                                : "Public: will send to the entire class/section."}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {!form.id && (
                    <div className="col-12">
                      <div className="form-check form-switch d-flex align-items-center gap-3 p-3 bg-light rounded-4">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="multiSendSwitch"
                          checked={multiMode}
                          onChange={(e) => setMultiMode(e.target.checked)}
                        />
                        <label className="form-check-label fw-semibold mb-0" htmlFor="multiSendSwitch">
                          <i className="bi bi-share me-2 text-primary"></i>
                          Send to multiple classes/sections
                        </label>
                      </div>

                      {multiMode && (
                        <div className="mt-3 p-4 bg-gradient bg-light rounded-4 shadow-sm">
                          <div className="d-flex flex-wrap gap-2 mb-3">
                            <button
                              type="button"
                              className="btn btn-outline-dark rounded-pill shadow-sm"
                              onClick={addAllTargets}
                            >
                              <i className="bi bi-check2-all me-2"></i>
                              Add All (Classes × Sections)
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-secondary rounded-pill shadow-sm"
                              onClick={addAllSectionsForSelectedClass}
                            >
                              <i className="bi bi-collection me-2"></i>
                              Add All Sections of Selected Class
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-danger rounded-pill shadow-sm"
                              onClick={clearAllTargets}
                            >
                              <i className="bi bi-trash3 me-2"></i>
                              Clear Targets
                            </button>
                            {!!targets.length && (
                              <span className="badge bg-primary rounded-pill align-self-center ms-1">
                                {targets.length} selected
                              </span>
                            )}
                          </div>

                          <div className="row g-3 align-items-end">
                            <div className="col-md-4">
                              <label className="form-label fw-semibold text-muted">Class</label>
                              <select
                                className="form-select rounded-pill shadow-sm"
                                value={draftTarget.classId}
                                onChange={(e) =>
                                  setDraftTarget({ ...draftTarget, classId: e.target.value })
                                }
                              >
                                <option value="">Select Class</option>
                                {classes.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.class_name || c.name || c.id}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="col-md-4">
                              <label className="form-label fw-semibold text-muted">Section</label>
                              <select
                                className="form-select rounded-pill shadow-sm"
                                value={draftTarget.sectionId}
                                onChange={(e) =>
                                  setDraftTarget({ ...draftTarget, sectionId: e.target.value })
                                }
                              >
                                <option value="">Select Section</option>
                                {sections.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.section_name || s.name || s.id}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="col-md-4 d-grid">
                              <button
                                type="button"
                                className="btn btn-outline-primary rounded-pill shadow-lg"
                                onClick={addTarget}
                              >
                                <i className="bi bi-plus-circle me-2"></i>
                                Add Target
                              </button>
                            </div>
                          </div>

                          {targets.length > 0 && (
                            <div className="mt-4">
                              <small className="text-muted d-block mb-2 fw-semibold">
                                Selected Targets ({targets.length})
                              </small>
                              <div className="d-flex flex-wrap gap-2">
                                {targets.map((t, idx) => {
                                  const className =
                                    classes.find((c) => Number(c.id) === Number(t.classId))?.class_name ||
                                    `Class ${t.classId}`;
                                  const sectionName =
                                    sections.find((s) => Number(s.id) === Number(t.sectionId))?.section_name ||
                                    `Sec ${t.sectionId}`;
                                  return (
                                    <span
                                      key={`${t.classId}-${t.sectionId}-${idx}`}
                                      className="badge bg-primary text-white rounded-pill px-4 py-2 shadow-sm d-flex align-items-center gap-2"
                                    >
                                      <i className="bi bi-people"></i>
                                      {className} - {sectionName}
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-link text-white ms-2 p-0"
                                        onClick={() => removeTarget(idx)}
                                        title="Remove"
                                      >
                                        <i className="bi bi-x"></i>
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="col-md-6">
                    <label className="form-label fw-semibold text-muted">Subject (Optional)</label>
                    <select
                      className="form-select rounded-pill shadow-sm"
                      value={form.subjectId}
                      onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                    >
                      <option value="">General</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold text-danger">Title (Mendatory) <span className="text-danger">*</span></label>
                    <input
                      className="form-control rounded-pill px-4 py-2 shadow-sm fs-5"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="Enter a compelling title..."
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold text-danger">Content (Mendatory) <span className="text-danger">*</span></label>
                    <textarea
                      rows={5}
                      className="form-control rounded-4 shadow-sm"
                      value={form.content}
                      onChange={(e) => setForm({ ...form, content: e.target.value })}
                      placeholder="Write your message here..."
                      style={{ fontSize: "1rem", lineHeight: 1.6 }}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label fw-semibold text-muted">Attachments (Links)</label>
                    <AttachmentsInput
                      value={form.attachments}
                      onChange={(v) => {
                        const merged = v.map((x) => ({
                          id: x.id,
                          name: x.name,
                          url: x.url,
                          kind: x.kind
                        }));
                        setForm({ ...form, attachments: merged });
                      }}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label fw-semibold text-muted">Upload Files from Computer</label>
                    <FileUploads
                      files={form.selectedFiles}
                      setFiles={(files) => setForm({ ...form, selectedFiles: files })}
                    />
                  </div>

                  {form.id && (
                    <div className="col-12">
                      <div className="p-3 bg-light rounded-4 border">
                        <div className="form-check form-switch mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="replaceSwitch"
                            checked={form.replaceAttachments}
                            onChange={(e) =>
                              setForm({ ...form, replaceAttachments: e.target.checked })
                            }
                          />
                          <label className="form-check-label fw-semibold" htmlFor="replaceSwitch">
                            Replace all existing attachments with the ones above
                          </label>
                        </div>

                        {!form.replaceAttachments && (form.attachments || []).some((a) => a.id) && (
                          <>
                            <small className="text-muted d-block mb-2">
                              Keep / remove existing attachments:
                            </small>
                            <div className="d-flex flex-wrap gap-2">
                              {form.attachments
                                .filter((a) => a.id)
                                .map((a) => (
                                  <label
                                    key={a.id}
                                    className="badge bg-white text-dark border rounded-pill px-3 py-2 shadow-sm d-flex align-items-center gap-2"
                                  >
                                    <input
                                      type="checkbox"
                                      className="form-check-input me-2"
                                      checked={form.keepAttachmentIds.includes(a.id)}
                                      onChange={(e) => toggleKeep(a.id, e.target.checked)}
                                    />
                                    <i className="bi bi-paperclip"></i>
                                    <span className="text-truncate" style={{ maxWidth: 220 }}>
                                      {a.name}
                                    </span>
                                  </label>
                                ))}
                            </div>
                            <small className="text-muted d-block mt-2">
                              Unchecked items will be removed on save.
                            </small>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer rounded-bottom-5 bg-light border-0 p-4">
                <button
                  className="btn btn-outline-secondary rounded-pill px-5 py-2 shadow-sm"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                >
                  <i className="bi bi-x-circle me-2"></i>
                  Cancel
                </button>
                <button
                  className="btn btn-primary rounded-pill px-5 py-2 shadow-lg d-flex align-items-center gap-2"
                  onClick={save}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Spinner small /> <span>{form.id ? "Updating…" : "Saving…"}</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle"></i>
                      {form.id ? "Update" : "Save"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────
  Feed (non-students must pick Class & Section)
────────────────────────────────────────────── */
function DiaryFeedOnly() {
  const roles = getRoleFlags();
  const isNonStudent = !roles.isStudent;

  const [diaries, setDiaries] = useState([]);
  const [loading, setLoading] = useState(true);

  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [sel, setSel] = useState({ classId: "", sectionId: "" });

  useEffect(() => {
    const loadLists = async () => {
      if (!isNonStudent) return;
      try {
        const [cls, sec] = await Promise.all([api.get("/classes"), api.get("/sections")]);
        const clsData = Array.isArray(cls.data) ? cls.data : cls.data.classes || [];
        const secData = Array.isArray(sec.data) ? sec.data : sec.data.sections || [];
        setClasses(clsData);
        setSections(secData);
      } catch {
        // no-op
      }
    };
    loadLists();
  }, [isNonStudent]);

  const load = async () => {
    setLoading(true);
    try {
      if (isNonStudent) {
        const classId = Number(sel.classId);
        const sectionId = Number(sel.sectionId);
        if (!classId || !sectionId) {
          setDiaries([]);
          return;
        }
        const { data } = await diaryGet("/student/feed/list", {
          page: 1,
          pageSize: PAGE_SIZE,
          classId,
          sectionId,
        });
        const raw = data.data || [];
        setDiaries(groupDiaries(raw));
      } else {
        const { data } = await diaryGet("/student/feed/list", {
          page: 1,
          pageSize: PAGE_SIZE,
        });
        const raw = data.data || [];
        setDiaries(groupDiaries(raw));
      }
    } catch (e) {
      Swal.fire("Error", e?.response?.data?.error || "Failed to load diary feed", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isNonStudent) {
      if (sel.classId && sel.sectionId) load();
    } else {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.classId, sel.sectionId, isNonStudent]);

  return (
    <div>
      {isNonStudent && (
        <div className="card border-0 shadow-lg mb-5 rounded-4 overflow-hidden">
          <div className="card-header bg-gradient bg-primary text-white py-3 px-4">
            <h6 className="mb-0 fw-bold">
              <i className="bi bi-gear me-2"></i>Select View
            </h6>
          </div>
          <div className="card-body p-4">
            <div className="row g-3 align-items-end">
              <div className="col-md-4">
                <label className="form-label fw-semibold text-muted">Class</label>
                <select
                  className="form-select rounded-pill shadow-sm"
                  value={sel.classId}
                  onChange={(e) => setSel({ ...sel, classId: e.target.value })}
                >
                  <option value="">Select Class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.class_name || c.name || `Class ${c.id}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label fw-semibold text-muted">Section</label>
                <select
                  className="form-select rounded-pill shadow-sm"
                  value={sel.sectionId}
                  onChange={(e) => setSel({ ...sel, sectionId: e.target.value })}
                >
                  <option value="">Select Section</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.section_name || s.name || s.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-4 d-grid">
                <button className="btn btn-primary rounded-pill px-5 shadow-lg" onClick={load} disabled={loading}>
                  {loading ? (
                    <>
                      <Spinner small /> Loading…
                    </>
                  ) : (
                    <>
                      <i className="bi bi-eye me-2"></i>
                      Load Feed
                    </>
                  )}
                </button>
              </div>
            </div>
            <div className="small text-muted mt-3">
              Choose a class and section to view their personalized diary feed.
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary mb-3" style={{ width: "4rem", height: "4rem" }} role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <h5 className="text-primary mb-3">Fetching Latest Notes</h5>
          <div className="text-muted">Please wait while we load your diary entries...</div>
        </div>
      ) : (
        <>
          <h3 className="mb-4 fw-bold text-primary d-flex align-items-center gap-2">
            <i className="bi bi-journal-bookmark"></i>
            Recent Diary Notes
          </h3>
          <div className="row g-4">
            {diaries.map((d) => (
              <div className="col-12 col-md-6 col-xl-4" key={d.id}>
                <DiaryCard item={d} canAck={true} />
              </div>
            ))}
            {!diaries.length && (
              <div className="col-12 text-center py-5">
                <div className="text-muted">
                  <i className="bi bi-journal-text fs-1 mb-4 d-block text-primary opacity-75"></i>
                  <h5 className="fw-semibold text-primary mb-2">No Diary Notes Yet</h5>
                  <p className="mb-0">Check back later for updates from your teachers.</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────
  Page (non-students only manage; all can view feed)
────────────────────────────────────────────── */
export default function DigitalDiary() {
  const r = getRoleFlags();
  const showManage =
    r.isAdmin || r.isSuperadmin || r.isHR || r.isCoordinator || r.isTeacher;

  return (
    <div className="container-fluid mt-4">
      {showManage && (
        <>
          <ManageDiaries />
          <hr className="my-5 border-primary border-2 opacity-25" />
        </>
      )}
      <DiaryFeedOnly />
    </div>
  );
}
