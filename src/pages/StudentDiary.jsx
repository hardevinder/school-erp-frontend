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

const normalizeAdmission = (s) => String(s || "").replace(/\//g, "-").trim();
const normalizeRole = (r) => String(r || "").toLowerCase();

const TYPE_BADGE = {
  HOMEWORK: "primary",
  REMARK: "warning",
  ANNOUNCEMENT: "info",
};

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
  // -------- Roles (for showing switcher to student/parent) ----------
  const parseJwt = (token) => {
    try {
      const p = token.split(".")[1];
      return JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
      return null;
    }
  };

  const roles = useMemo(() => {
    try {
      const stored = localStorage.getItem("roles");
      if (stored) return JSON.parse(stored).map(normalizeRole);
    } catch {}
    const single = localStorage.getItem("userRole");
    if (single) return [normalizeRole(single)];
    const token = localStorage.getItem("token");
    if (token) {
      const payload = parseJwt(token);
      if (payload) {
        if (Array.isArray(payload.roles)) return payload.roles.map(normalizeRole);
        if (payload.role) return [normalizeRole(payload.role)];
      }
    }
    return [];
  }, []);

  const isStudent = roles.includes("student");
  const isParent = roles.includes("parent");
  const canSeeStudentSwitcher = isStudent || isParent;

  // -------- Family + active student (sibling switcher parity) ----------
  const [family, setFamily] = useState(null);
  const [activeStudentAdmission, setActiveStudentAdmission] = useState(
    () => localStorage.getItem("activeStudentAdmission") || localStorage.getItem("username") || ""
  );

  const studentsList = useMemo(() => {
    if (!family) return [];
    const list = [];
    if (family.student) list.push({ ...family.student, isSelf: true });
    (family.siblings || []).forEach((s) => list.push({ ...s, isSelf: false }));
    return list;
  }, [family]);

  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem("family");
        setFamily(raw ? JSON.parse(raw) : null);
        const stored =
          localStorage.getItem("activeStudentAdmission") || localStorage.getItem("username") || "";
        setActiveStudentAdmission(stored);
      } catch {
        setFamily(null);
      }
    };
    load();

    const onFamilyUpdated = () => load();
    const onStudentSwitched = () => {
      load();
      // refetch for new student
      fetchDiaries({ keepLoading: true, admissionOverride: localStorage.getItem("activeStudentAdmission") });
    };

    window.addEventListener("family-updated", onFamilyUpdated);
    window.addEventListener("student-switched", onStudentSwitched);
    return () => {
      window.removeEventListener("family-updated", onFamilyUpdated);
      window.removeEventListener("student-switched", onStudentSwitched);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStudentSwitch = (admissionNumber) => {
    const norm = normalizeAdmission(admissionNumber);
    if (!norm || norm === activeStudentAdmission) return;
    try {
      localStorage.setItem("activeStudentAdmission", norm);
      setActiveStudentAdmission(norm);
      // notify app (Navbar, other pages listen to this)
      window.dispatchEvent(new CustomEvent("student-switched", { detail: { admissionNumber: norm } }));
      // this page: refetch immediately
      fetchDiaries({ keepLoading: true, admissionOverride: norm });
    } catch (e) {
      console.warn("Failed to switch student", e);
    }
  };

  // -------- Filters & state ----------
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [onlyUnack, setOnlyUnack] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortDir, setSortDir] = useState("desc"); // 'asc' | 'desc'

  const token = localStorage.getItem("token");
  const abortRef = useRef(null);

  // Prefer active student admission for API
  const admissionForQuery = useMemo(() => {
    const storedActive = localStorage.getItem("activeStudentAdmission");
    if (storedActive) return normalizeAdmission(storedActive);
    const stored = localStorage.getItem("username");
    if (stored) return normalizeAdmission(stored);
    const payload = token ? parseJwt(token) : null;
    const adm = (payload && (payload.admission_number || payload.username)) || "";
    return normalizeAdmission(adm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStudentAdmission]);

  // Admission from logged-in token (not the switcher)
  const loggedInAdmission = useMemo(() => {
    const stored = localStorage.getItem("username");
    if (stored) return normalizeAdmission(stored);
    const payload = token ? parseJwt(token) : null;
    const adm = (payload && (payload.admission_number || payload.username)) || "";
    return normalizeAdmission(adm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // If not a student, or the active admission differs from logged-in admission → use by-admission endpoint
  const shouldUseByAdmission = useMemo(() => {
    const active = normalizeAdmission(
      (localStorage.getItem("activeStudentAdmission") || activeStudentAdmission || "").trim()
    );
    return !isStudent || (active && active !== loggedInAdmission);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStudent, activeStudentAdmission, loggedInAdmission]);

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

    // Keep for convenience; removed from query when we put it into path
    if (admissionForQuery) p.admissionNumber = admissionForQuery;

    return p;
  }, [
    pagination.page,
    pagination.pageSize,
    sortDir,
    typeFilter,
    onlyUnack,
    dateFrom,
    dateTo,
    searchText,
    admissionForQuery,
  ]);

  // -------- Fetch diaries ----------
  const fetchDiaries = async (opts = { keepLoading: false, admissionOverride: null }) => {
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

      // Build params (allow override admission for immediate switch)
      const finalParams = { ...params };
      if (opts.admissionOverride) finalParams.admissionNumber = normalizeAdmission(opts.admissionOverride);

      // Decide endpoint:
      // - Default: legacy (scoped by token)
      // - If shouldUseByAdmission: new by-admission route with admission in path
      let url = `${API_URL}/diaries/student/feed/list`;
      if (shouldUseByAdmission) {
        const adm = normalizeAdmission(finalParams.admissionNumber || admissionForQuery);
        if (!adm) {
          setError("No active student selected.");
          setItems([]);
          setLoading(false);
          setIsRefreshing(false);
          return;
        }
        url = `${API_URL}/diaries/by-admission/${encodeURIComponent(adm)}`;
        // remove admissionNumber from query when it's in the path
        delete finalParams.admissionNumber;
      }

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        params: finalParams,
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

  // Refetch when params or switching mode changes (debounce search)
  const [debouncedParams, setDebouncedParams] = useState(params);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedParams(params), 250);
    return () => clearTimeout(t);
  }, [params]);

  useEffect(() => {
    fetchDiaries({ keepLoading: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedParams, shouldUseByAdmission, admissionForQuery]);

  // Live updates via socket
  useEffect(() => {
    const onChanged = () => {
      // simple strategy: refetch on any change
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
      if (onlyUnack) {
        setItems((prev) =>
          prev.map((d) => (d.id === id ? { ...d, acknowledgements: [{ id: "temp" }] } : d))
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
        className="rounded-3 p-4 mb-3 text-white"
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

          {/* Stats */}
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

        {/* Student switcher UI (Desktop pills + Mobile select) */}
        {canSeeStudentSwitcher && studentsList.length > 0 && (
          <>
            <div className="d-none d-lg-flex align-items-center gap-1 mt-3" role="tablist" aria-label="Switch student">
              {studentsList.map((s) => {
                const isActive = s.admission_number === activeStudentAdmission;
                return (
                  <button
                    key={s.admission_number}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`btn btn-sm ${isActive ? "btn-warning" : "btn-outline-light"} rounded-pill px-3`}
                    onClick={() => handleStudentSwitch(s.admission_number)}
                    title={`${s.name} (${s.class?.name || "—"}-${s.section?.name || "—"})`}
                    style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {s.isSelf ? "Me" : s.name}
                    <span className="ms-1" style={{ opacity: 0.85 }}>
                      {s.class?.name ? ` · ${s.class.name}-${s.section?.name || "—"}` : ""}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="d-lg-none mt-3">
              <label htmlFor="studentSwitcherMobileDiary" className="visually-hidden">
                Switch student
              </label>
              <select
                id="studentSwitcherMobileDiary"
                className="form-select form-select-sm bg-light border-0"
                value={activeStudentAdmission}
                onChange={(e) => handleStudentSwitch(e.target.value)}
              >
                {studentsList.map((s) => (
                  <option key={s.admission_number} value={s.admission_number}>
                    {(s.isSelf ? "Me: " : "") + s.name}{" "}
                    {s.class?.name ? `(${s.class.name}-${s.section?.name || "—"})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
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

        <div className="col-12 col-md-3 d-flex gap-2">
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
                    {subject?.name && <span className="badge bg-light text-dark">{subject.name}</span>}
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
                            <a href={a?.url} target="_blank" rel="noopener noreferrer" className="link-primary">
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

      {/* Local style helpers to match the rest of your app */}
      <style>{`
        .placeholder-glow .placeholder { display: inline-block; background-color: rgba(0,0,0,.08); }
        .fancy-chip-row { scrollbar-width: thin; }
        .fancy-chip-row::-webkit-scrollbar { height: 8px; }
        .fancy-chip-row::-webkit-scrollbar-thumb { background: rgba(0,0,0,.15); border-radius: 8px; }
      `}</style>
    </div>
  );
};

export default StudentDiary;
