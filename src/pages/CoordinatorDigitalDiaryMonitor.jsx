import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";

const PAGE_SIZE = 25;

const getAuthHeaders = () => {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("jwt") ||
    localStorage.getItem("accessToken");

  return token ? { Authorization: `Bearer ${token}` } : {};
};

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatDate = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
};

const getClassName = (d) =>
  d?.class?.class_name ||
  d?.Class?.class_name ||
  d?.class?.name ||
  d?.classId ||
  "-";

const getSectionName = (d) =>
  d?.section?.section_name ||
  d?.Section?.section_name ||
  d?.section?.name ||
  d?.sectionId ||
  "-";

const getSubjectName = (d) =>
  d?.subject?.name || d?.Subject?.name || (d?.subjectId ? `Subject ${d.subjectId}` : "General");

const getTeacherName = (d) =>
  d?.createdBy?.name ||
  d?.CreatedBy?.name ||
  d?.teacher?.name ||
  d?.createdByName ||
  `User ${d?.createdById || "-"}`;

export default function CoordinatorDigitalDiaryMonitor() {
  const [diaries, setDiaries] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 0,
  });

  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const [filters, setFilters] = useState({
    from: "",
    to: "",
    classId: "",
    sectionId: "",
    sessionId: "",
    type: "",
    q: "",
  });

  const currentPageStats = useMemo(() => {
    const privateCount = diaries.filter(
      (d) => Array.isArray(d.recipients) && d.recipients.length > 0
    ).length;

    const teachers = new Set(diaries.map(getTeacherName).filter(Boolean));

    return {
      shown: diaries.length,
      privateCount,
      teachers: teachers.size,
    };
  }, [diaries]);

  const loadMasterData = async () => {
    try {
      const [clsRes, secRes, sessRes] = await Promise.allSettled([
        api.get("/classes", { headers: getAuthHeaders() }),
        api.get("/sections", { headers: getAuthHeaders() }),
        api.get("/sessions", { headers: getAuthHeaders() }),
      ]);

      if (clsRes.status === "fulfilled") {
        const data = clsRes.value.data;
        setClasses(Array.isArray(data) ? data : data.classes || data.data || []);
      }

      if (secRes.status === "fulfilled") {
        const data = secRes.value.data;
        setSections(Array.isArray(data) ? data : data.sections || data.data || []);
      }

      if (sessRes.status === "fulfilled") {
        const data = sessRes.value.data;
        const list = Array.isArray(data) ? data : data.items || data.data || [];
        setSessions(list);

        const active = list.find((s) => s.is_active === true || s.isActive === true);
        if (active?.id) {
          setFilters((f) => ({ ...f, sessionId: String(active.id) }));
        }
      }
    } catch (e) {
      console.error("Master data load error:", e);
    }
  };

  const loadDiaries = async (nextPage = 1) => {
    setLoading(true);

    try {
      const params = {
        page: nextPage,
        pageSize: PAGE_SIZE,
        dateFrom: filters.from || undefined,
        dateTo: filters.to || undefined,
        classId: filters.classId || undefined,
        sectionId: filters.sectionId || undefined,
        sessionId: filters.sessionId || undefined,
        type: filters.type || undefined,
        q: filters.q?.trim()?.length >= 2 ? filters.q.trim() : undefined,
        order: "date:DESC",
      };

      const res = await api.get("/diaries", {
        params,
        headers: getAuthHeaders(),
      });

      setDiaries(Array.isArray(res?.data?.data) ? res.data.data : []);
      setPagination(
        res?.data?.pagination || {
          total: 0,
          page: nextPage,
          pageSize: PAGE_SIZE,
          totalPages: 0,
        }
      );
      setPage(nextPage);
    } catch (e) {
      console.error("Diary monitor load error:", e);
      Swal.fire(
        "Error",
        e?.response?.data?.error ||
          e?.response?.data?.message ||
          "Failed to load digital diaries.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMasterData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadDiaries(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.sessionId]);

  const applyFilters = () => loadDiaries(1);

  const resetFilters = () => {
    setFilters({
      from: "",
      to: "",
      classId: "",
      sectionId: "",
      sessionId: filters.sessionId || "",
      type: "",
      q: "",
    });
  };

  const openAcknowledgements = async (diary) => {
    try {
      const res = await api.get(`/diaries/${diary.id}/acknowledgements`, {
        headers: getAuthHeaders(),
      });

      const acks = res?.data?.acknowledgements || [];

      const html = acks.length
        ? `
          <div style="text-align:left; max-height:420px; overflow:auto;">
            <table class="table table-sm table-bordered align-middle">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Admission No.</th>
                  <th>Roll No.</th>
                  <th>Note</th>
                  <th>Acknowledged At</th>
                </tr>
              </thead>
              <tbody>
                ${acks
                  .map((a) => {
                    const s = a.student || {};
                    return `
                      <tr>
                        <td>${escapeHtml(s.name || "-")}</td>
                        <td>${escapeHtml(s.admission_number || "-")}</td>
                        <td>${escapeHtml(s.roll_number || "-")}</td>
                        <td>${escapeHtml(a.note || "-")}</td>
                        <td>${escapeHtml(formatDate(a.createdAt))}</td>
                      </tr>
                    `;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        `
        : `<div class="text-muted">No acknowledgements yet.</div>`;

      Swal.fire({
        title: "Diary Acknowledgements",
        html,
        width: 900,
        confirmButtonText: "Close",
      });
    } catch (e) {
      Swal.fire(
        "Error",
        e?.response?.data?.error || "Failed to load acknowledgements.",
        "error"
      );
    }
  };

  return (
    <div className="container-fluid py-3">
      {/* Header */}
      <div
        className="rounded-4 p-3 p-md-4 mb-3 shadow-sm"
        style={{
          background: "linear-gradient(135deg, #0f172a, #1d4ed8)",
          color: "#fff",
        }}
      >
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
          <div>
            <h3 className="mb-1 fw-bold">
              <i className="bi bi-journal-text me-2" />
              Digital Diary Monitor
            </h3>
            <div className="text-white-50">
              Coordinator can check which teacher sent diary to which class/section.
            </div>
          </div>

          <button
            className="btn btn-light rounded-pill px-4"
            onClick={() => loadDiaries(page)}
            disabled={loading}
          >
            <i className="bi bi-arrow-clockwise me-1" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="row g-3 mb-3">
        <div className="col-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body">
              <div className="text-muted small">Total Diaries</div>
              <div className="fs-3 fw-bold">{pagination.total || 0}</div>
            </div>
          </div>
        </div>

        <div className="col-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body">
              <div className="text-muted small">Shown on Page</div>
              <div className="fs-3 fw-bold">{currentPageStats.shown}</div>
            </div>
          </div>
        </div>

        <div className="col-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body">
              <div className="text-muted small">Teachers on Page</div>
              <div className="fs-3 fw-bold">{currentPageStats.teachers}</div>
            </div>
          </div>
        </div>

        <div className="col-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body">
              <div className="text-muted small">Private Diaries</div>
              <div className="fs-3 fw-bold">{currentPageStats.privateCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-2">
              <label className="form-label small fw-semibold">From</label>
              <input
                type="date"
                className="form-control"
                value={filters.from}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              />
            </div>

            <div className="col-12 col-md-2">
              <label className="form-label small fw-semibold">To</label>
              <input
                type="date"
                className="form-control"
                value={filters.to}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              />
            </div>

            <div className="col-12 col-md-2">
              <label className="form-label small fw-semibold">Class</label>
              <select
                className="form-select"
                value={filters.classId}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, classId: e.target.value }))
                }
              >
                <option value="">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.class_name || c.name || `Class ${c.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-md-2">
              <label className="form-label small fw-semibold">Section</label>
              <select
                className="form-select"
                value={filters.sectionId}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, sectionId: e.target.value }))
                }
              >
                <option value="">All Sections</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.section_name || s.name || `Section ${s.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-md-2">
              <label className="form-label small fw-semibold">Type</label>
              <select
                className="form-select"
                value={filters.type}
                onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
              >
                <option value="">All Types</option>
                <option value="HOMEWORK">Homework</option>
                <option value="REMARK">Remark</option>
                <option value="ANNOUNCEMENT">Announcement</option>
              </select>
            </div>

            <div className="col-12 col-md-2">
              <label className="form-label small fw-semibold">Session</label>
              <select
                className="form-select"
                value={filters.sessionId}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, sessionId: e.target.value }))
                }
              >
                <option value="">All Sessions</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.session_name || `Session ${s.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-md-8">
              <label className="form-label small fw-semibold">Search</label>
              <input
                className="form-control"
                placeholder="Search title or content..."
                value={filters.q}
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFilters();
                }}
              />
            </div>

            <div className="col-12 col-md-4 d-flex gap-2">
              <button
                className="btn btn-primary w-100"
                onClick={applyFilters}
                disabled={loading}
              >
                <i className="bi bi-funnel me-1" />
                Apply
              </button>

              <button className="btn btn-outline-secondary w-100" onClick={resetFilters}>
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" />
              <div className="text-muted mt-2">Loading diaries...</div>
            </div>
          ) : diaries.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-inbox fs-1 d-block mb-2" />
              No digital diary found.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Date</th>
                    <th>Teacher</th>
                    <th>Class / Section</th>
                    <th>Subject</th>
                    <th>Type</th>
                    <th>Title / Message</th>
                    <th>Files</th>
                    <th>Visibility</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {diaries.map((d) => {
                    const isExpanded = expandedId === d.id;
                    const attachments = Array.isArray(d.attachments) ? d.attachments : [];
                    const recipients = Array.isArray(d.recipients) ? d.recipients : [];

                    return (
                      <React.Fragment key={d.id}>
                        <tr>
                          <td className="text-nowrap">{formatDate(d.date)}</td>

                          <td>
                            <div className="fw-semibold">{getTeacherName(d)}</div>
                            <small className="text-muted">ID: {d.createdById || "-"}</small>
                          </td>

                          <td>
                            <span className="badge bg-primary-subtle text-primary border rounded-pill px-3 py-2">
                              {getClassName(d)} - {getSectionName(d)}
                            </span>
                          </td>

                          <td>{getSubjectName(d)}</td>

                          <td>
                            <span className="badge bg-dark rounded-pill px-3 py-2">
                              {d.type || "-"}
                            </span>
                          </td>

                          <td style={{ minWidth: 260 }}>
                            <div className="fw-semibold text-dark">{d.title || "-"}</div>
                            <small className="text-muted">
                              {String(d.content || "").slice(0, 90)}
                              {String(d.content || "").length > 90 ? "..." : ""}
                            </small>
                          </td>

                          <td>
                            <span className="badge bg-light text-dark border">
                              {attachments.length} file(s)
                            </span>
                          </td>

                          <td>
                            {recipients.length > 0 ? (
                              <span className="badge bg-danger-subtle text-danger border rounded-pill">
                                Private: {recipients.length}
                              </span>
                            ) : (
                              <span className="badge bg-success-subtle text-success border rounded-pill">
                                Public
                              </span>
                            )}
                          </td>

                          <td className="text-end">
                            <div className="btn-group">
                              <button
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => setExpandedId(isExpanded ? null : d.id)}
                              >
                                {isExpanded ? "Hide" : "View"}
                              </button>

                              <button
                                className="btn btn-sm btn-outline-success"
                                onClick={() => openAcknowledgements(d)}
                              >
                                Acks
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan="9" className="bg-light">
                              <div className="p-3">
                                <div className="fw-bold mb-2">Full Diary Content</div>
                                <div
                                  className="bg-white border rounded-3 p-3 mb-3"
                                  style={{ whiteSpace: "pre-wrap" }}
                                >
                                  {d.content || "-"}
                                </div>

                                {attachments.length > 0 && (
                                  <>
                                    <div className="fw-bold mb-2">Attachments</div>
                                    <div className="d-flex flex-wrap gap-2">
                                      {attachments.map((a, idx) => {
                                        const href = a.fileUrl || a.url || "";
                                        const label =
                                          a.originalName ||
                                          a.name ||
                                          href.split("/").pop() ||
                                          `Attachment ${idx + 1}`;

                                        return href ? (
                                          <a
                                            key={`${href}-${idx}`}
                                            href={href}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="btn btn-sm btn-outline-primary rounded-pill"
                                          >
                                            <i className="bi bi-paperclip me-1" />
                                            {label}
                                          </a>
                                        ) : null;
                                      })}
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="card-footer bg-white d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div className="text-muted small">
            Page {pagination.page || page} of {pagination.totalPages || 1} • Total{" "}
            {pagination.total || 0}
          </div>

          <div className="btn-group">
            <button
              className="btn btn-outline-secondary"
              disabled={loading || page <= 1}
              onClick={() => loadDiaries(page - 1)}
            >
              Previous
            </button>

            <button
              className="btn btn-outline-secondary"
              disabled={loading || page >= (pagination.totalPages || 1)}
              onClick={() => loadDiaries(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}