// src/pages/StudentDiary.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import socket from "../socket"; // adjust path if needed

const API_URL = process.env.REACT_APP_API_URL || "";

/* ──────────────────────────────────────────────
  Helpers
────────────────────────────────────────────── */
const formatDate = (d) => {
  if (!d) return "N/A";
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return "N/A";
  }
};

const formatDateTime = (d) => {
  if (!d) return "N/A";
  try {
    const dt = new Date(d);
    return `${dt.toLocaleDateString()} ${dt.toLocaleTimeString()}`;
  } catch {
    return "N/A";
  }
};

const truncate = (text, max = 180) => {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
};

// badges per diary type
const TYPE_BADGE = {
  HOMEWORK: "primary",
  REMARK: "warning",
  ANNOUNCEMENT: "info",
};

/* ──────────────────────────────────────────────
  Skeleton (loading cards)
────────────────────────────────────────────── */
const SkeletonCard = () => (
  <div className="col-md-6 col-lg-4 mb-4">
    <div className="card shadow-sm h-100">
      <div className="card-body">
        <div className="placeholder-glow">
          <span className="placeholder col-7 mb-2"></span>
          <span className="placeholder col-12 mb-2"></span>
          <span className="placeholder col-10 mb-2"></span>
          <span className="placeholder col-5"></span>
        </div>
      </div>
    </div>
  </div>
);

/* ──────────────────────────────────────────────
  Component
────────────────────────────────────────────── */
const StudentDiary = () => {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  // Filters
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [onlyUnack, setOnlyUnack] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortDir, setSortDir] = useState("desc"); // 'asc' | 'desc'

  const token = localStorage.getItem("token");
  const abortRef = useRef(null);

  const params = useMemo(() => {
    const p = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      order: `date:${(sortDir || "desc").toUpperCase()}`,
    };
    if (typeFilter !== "all") p.type = typeFilter;
    if (onlyUnack) p.onlyUnacknowledged = "true";
    if (dateFrom) p.dateFrom = dateFrom;
    if (dateTo) p.dateTo = dateTo;

    const s = searchText.trim();
    if (s.length >= 2) p.q = s;

    return p;
  }, [pagination.page, pagination.pageSize, sortDir, typeFilter, onlyUnack, dateFrom, dateTo, searchText]);

  const fetchDiaries = async (opts = { keepLoading: false }) => {
    if (!API_URL) {
      setError("API URL is not configured. Please set REACT_APP_API_URL.");
      setLoading(false);
      return;
    }
    if (!token) {
      setError("You are not logged in. Please log in to view diary entries.");
      setLoading(false);
      return;
    }

    // cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    try {
      if (!opts.keepLoading) {
        if (!loading) setIsRefreshing(true);
      }
      const res = await axios.get(`${API_URL}/diaries/student/feed/list`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
        signal: abortRef.current.signal,
      });

      const list = Array.isArray(res?.data?.data) ? res.data.data : [];
      setItems(list);
      const pg = res?.data?.pagination || {};
      setPagination((prev) => ({
        page: Number(pg.page) || prev.page,
        pageSize: Number(pg.pageSize) || prev.pageSize,
        totalPages: Number(pg.totalPages) || prev.totalPages || 1,
      }));
      setError(null);
      setLastSyncedAt(new Date());
    } catch (err) {
      if (axios.isCancel(err) || err.name === "CanceledError") return;
      console.error(err);
      setError(err?.response?.data?.error || "Error fetching diaries");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDiaries();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Refetch when params change (debounce search)
  const [debouncedParams, setDebouncedParams] = useState(params);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedParams(params), 250);
    return () => clearTimeout(t);
  }, [params]);

  useEffect(() => {
    // avoid showing skeleton again during filter changes
    fetchDiaries({ keepLoading: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedParams]);

  // Live updates via socket
  useEffect(() => {
    const onChanged = (payload) => {
      // payload: { diaryId, type, title, date, classId, sectionId, subjectId, verb }
      // simple strategy: refetch
      fetchDiaries({ keepLoading: true });
    };
    socket.on("diaryChanged", onChanged);
    return () => socket.off("diaryChanged", onChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stats (by type + unack count if present)
  const stats = useMemo(() => {
    const s = { total: items.length, homework: 0, remark: 0, announcement: 0, withAttachments: 0, unack: 0 };
    items.forEach((d) => {
      const t = (d?.type || "").toUpperCase();
      if (t === "HOMEWORK") s.homework += 1;
      if (t === "REMARK") s.remark += 1;
      if (t === "ANNOUNCEMENT") s.announcement += 1;
      if (Array.isArray(d?.attachments) && d.attachments.length) s.withAttachments += 1;

      // if acknowledgements array is present, count unack when empty
      if (Array.isArray(d?.acknowledgements) && d.acknowledgements.length === 0) s.unack += 1;
    });
    return s;
  }, [items]);

  const onAcknowledge = async (id) => {
    if (!id) return;
    try {
      await axios.post(`${API_URL}/diaries/${id}/ack`, null, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // soft update client-side: remove from unack-only view, or refresh
      if (onlyUnack) {
        setItems((prev) =>
          prev.map((d) =>
            d.id === id ? { ...d, acknowledgements: [{ id: "temp" }] } : d
          )
        );
      } else {
        fetchDiaries({ keepLoading: true });
      }
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || "Failed to acknowledge.");
    }
  };

  const changePage = (next) => {
    setPagination((p) => ({ ...p, page: Math.min(Math.max(1, next), p.totalPages || 1) }));
  };

  return (
    <div className="container py-4">
      {/* Header */}
      <div
        className="rounded-3 p-4 mb-4 text-white"
        style={{
          background:
            "linear-gradient(135deg, rgba(6,95,212,1) 0%, rgba(12,119,214,1) 50%, rgba(22,82,240,1) 100%)",
        }}
      >
        <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3">
          <div>
            <h1 className="h3 mb-1">Your Diary</h1>
            <div className="opacity-75">
              {lastSyncedAt ? `Last synced: ${lastSyncedAt.toLocaleTimeString()}` : "Syncing…"}
            </div>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <span className="badge bg-light text-dark">Total: {stats.total}</span>
            <span className="badge bg-primary">Homework: {stats.homework}</span>
            <span className="badge bg-warning text-dark">Remark: {stats.remark}</span>
            <span className="badge bg-info text-dark">Ann.: {stats.announcement}</span>
            <span className="badge bg-success">With files: {stats.withAttachments}</span>
            <button
              className="btn btn-light btn-sm"
              onClick={() => fetchDiaries({ keepLoading: true })}
              disabled={isRefreshing}
            >
              {isRefreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-5">
          <input
            type="text"
            className="form-control"
            placeholder="Search title/content (min 2 chars)…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        <div className="col-6 col-md-2">
          <select
            className="form-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All types</option>
            <option value="HOMEWORK">Homework</option>
            <option value="REMARK">Remark</option>
            <option value="ANNOUNCEMENT">Announcement</option>
          </select>
        </div>

        <div className="col-6 col-md-2 d-flex align-items-center gap-2">
          <div className="form-check">
            <input
              id="onlyUnack"
              className="form-check-input"
              type="checkbox"
              checked={onlyUnack}
              onChange={(e) => setOnlyUnack(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="onlyUnack">
              Only unacknowledged
            </label>
          </div>
        </div>

        <div className="col-6 col-md-3 d-flex gap-2">
          <input
            type="date"
            className="form-control"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="From date"
          />
          <input
            type="date"
            className="form-control"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="To date"
          />
          <button
            className="btn btn-outline-secondary"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            title="Toggle sort direction by date"
          >
            {sortDir === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="row">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="alert alert-danger text-center" role="alert">
          {error}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && items.length === 0 && (
        <div className="text-center py-5">
          <h5 className="mb-2">No diary entries found</h5>
          <p className="text-muted mb-3">Try adjusting your filters or search.</p>
          <button className="btn btn-primary" onClick={() => fetchDiaries({ keepLoading: true })}>
            Reload
          </button>
        </div>
      )}

      {/* List */}
      <div className="row">
        {items.map((d) => {
          const {
            id,
            title,
            content,
            date,
            type,
            createdAt,
            updatedAt,
            class: cls,
            section,
            subject,
            attachments = [],
            acknowledgements = [],
          } = d || {};

          const isAcknowledged = Array.isArray(acknowledgements) && acknowledgements.length > 0;
          const badgeVariant = TYPE_BADGE[type] || "secondary";

          return (
            <div key={id} className="col-md-6 col-lg-4 mb-4">
              <div className="card shadow-sm h-100">
                <div className="card-body d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                    <h2 className="h5 mb-0">{title || "Untitled"}</h2>
                    <span className={`badge bg-${badgeVariant}`} style={{ fontSize: "0.8rem" }}>
                      {type || "NOTE"}
                    </span>
                  </div>

                  <p className="text-muted mb-2">
                    Date: {formatDate(date)} · Updated: {formatDateTime(updatedAt)}
                  </p>

                  {/* Chips: class / section / subject */}
                  <div className="d-flex flex-wrap gap-2 mb-2">
                    {cls?.class_name && (
                      <span className="badge bg-light text-dark">Class {cls.class_name}</span>
                    )}
                    {section?.section_name && (
                      <span className="badge bg-light text-dark">Sec {section.section_name}</span>
                    )}
                    {subject?.name && (
                      <span className="badge bg-light text-dark">{subject.name}</span>
                    )}
                    {isAcknowledged ? (
                      <span className="badge bg-success">Acknowledged</span>
                    ) : (
                      <span className="badge bg-danger">Pending Ack</span>
                    )}
                  </div>

                  <div className="mb-3" style={{ whiteSpace: "pre-wrap" }}>
                    {truncate(content, 240)}
                  </div>

                  {/* Attachments */}
                  {attachments.length > 0 && (
                    <div className="mb-3">
                      <h6 className="mb-2">Attachments</h6>
                      <ul className="list-unstyled mb-0">
                        {attachments.map((a) => (
                          <li key={a?.id || a?.url} className="mb-1">
                            <a
                              href={a?.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link-primary"
                            >
                              {a?.name || a?.url || "Download"}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-auto d-flex justify-content-between align-items-center pt-2">
                    <a className="btn btn-outline-primary btn-sm" href={`#/diary/${id}`}>
                      Open
                    </a>
                    <button
                      className={`btn btn-${isAcknowledged ? "secondary" : "success"} btn-sm`}
                      onClick={() => onAcknowledge(id)}
                      disabled={isAcknowledged}
                      title={isAcknowledged ? "Already acknowledged" : "Mark as read/acknowledged"}
                    >
                      {isAcknowledged ? "Acknowledged" : "Acknowledge"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {!loading && !error && items.length > 0 && (
        <div className="d-flex justify-content-center align-items-center gap-3 mt-3">
          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={pagination.page <= 1}
            onClick={() => changePage(pagination.page - 1)}
          >
            Prev
          </button>
          <span className="text-muted">
            Page {pagination.page} / {pagination.totalPages || 1}
          </span>
          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={pagination.page >= (pagination.totalPages || 1)}
            onClick={() => changePage(pagination.page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default StudentDiary;
