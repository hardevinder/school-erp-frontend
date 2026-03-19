import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import moment from "moment";
import "./UserTracking.css";

const REFRESH_MS = 30000;
const RECENT_SECONDS = 120;
const PAGE_SIZE = 10;

const UserTracking = () => {
  // ---------- View Mode ----------
  const [view, setView] = useState(() => localStorage.getItem("ut_view") || "sessions");
  useEffect(() => localStorage.setItem("ut_view", view), [view]);

  // ---------- Data ----------
  const [sessions, setSessions] = useState([]);
  const [neverUsers, setNeverUsers] = useState([]);
  const [inactiveUsers, setInactiveUsers] = useState([]);

  // ---------- Loading ----------
  const [loading, setLoading] = useState(true);

  // ---------- Filters ----------
  const [q, setQ] = useState(() => localStorage.getItem("ut_q") || "");
  const [status, setStatus] = useState(() => localStorage.getItem("ut_status") || "");
  const [roleFilter, setRoleFilter] = useState(() => localStorage.getItem("ut_role") || "");
  const [classFilter, setClassFilter] = useState(() => localStorage.getItem("ut_class") || "");

  useEffect(() => localStorage.setItem("ut_q", q), [q]);
  useEffect(() => localStorage.setItem("ut_status", status), [status]);
  useEffect(() => localStorage.setItem("ut_role", roleFilter), [roleFilter]);
  useEffect(() => localStorage.setItem("ut_class", classFilter), [classFilter]);

  // ---------- Inactive Since ----------
  const defaultSince = moment().subtract(30, "days").format("YYYY-MM-DD");
  const [since, setSince] = useState(() => localStorage.getItem("ut_since") || defaultSince);
  useEffect(() => localStorage.setItem("ut_since", since), [since]);

  // ---------- Pagination ----------
  const [currentPage, setCurrentPage] = useState(1);

  // ---------- UI ----------
  const [expanded, setExpanded] = useState(new Set());
  const [isPaused, setIsPaused] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_MS / 1000);

  // ---------- Debounced Search ----------
  const [debouncedQ, setDebouncedQ] = useState(q);
  const debounceRef = useRef();

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(debounceRef.current);
  }, [q]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQ, status, roleFilter, classFilter, view, since]);

  // ---------- Helpers ----------
  const isExpired = (t) => (t ? new Date(t) <= new Date() : true);
  const fmt = (t) => (t ? moment(t).format("DD MMM, HH:mm") : "—");
  const fmtFull = (t) => (t ? moment(t).format("YYYY-MM-DD HH:mm:ss") : "");
  const ago = (t) => (t ? moment(t).fromNow() : "—");

  const getInitials = (name) =>
    !name
      ? "?"
      : name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);

  const getBrowser = (ua) => {
    if (!ua) return "Unknown";
    if (/Edg\//.test(ua)) return "Edge";
    if (/OPR\//.test(ua)) return "Opera";
    if (/Chrome\//.test(ua)) return "Chrome";
    if (/Firefox\//.test(ua)) return "Firefox";
    if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
    return "Unknown";
  };

  const getOS = (ua) => {
    if (!ua) return "Unknown";
    if (/Windows NT/.test(ua)) return "Windows";
    if (/Mac OS X/.test(ua)) return "macOS";
    if (/Android/.test(ua)) return "Android";
    if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
    if (/Linux/.test(ua)) return "Linux";
    return "Unknown";
  };

  const formatClassSection = (className, sectionName) => {
    if (!className && !sectionName) return "—";
    if (className && sectionName) return `${className} / ${sectionName}`;
    return className || sectionName || "—";
  };

  const getPageWindow = (total, current, size = 5) => {
    if (total <= 1) {
      return {
        pages: [1],
        showFirst: false,
        showLast: false,
        showLeftEllipsis: false,
        showRightEllipsis: false,
      };
    }

    const half = Math.floor(size / 2);
    let start = Math.max(1, current - half);
    let end = Math.min(total, start + size - 1);
    start = Math.max(1, end - size + 1);

    const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

    return {
      pages,
      showFirst: start > 1,
      showLast: end < total,
      showLeftEllipsis: start > 2,
      showRightEllipsis: end < total - 1,
    };
  };

  // ---------- Fetchers ----------
  const fetchSessions = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const { data } = await api.get("/users/sessions");
      setSessions(data.sessions || []);
    } catch {
      Swal.fire("Error", "Failed to fetch sessions", "error");
    } finally {
      setLoading(false);
      setSecondsLeft(REFRESH_MS / 1000);
      setCurrentPage(1);
    }
  };

  const fetchNever = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/users/never-logged-in", {
        params: {
          page: 1,
          limit: 10000,
          search: debouncedQ || undefined,
          role: roleFilter || undefined,
        },
      });
      setNeverUsers(data.users || []);
    } catch {
      Swal.fire("Error", "Failed to fetch never-logged-in users", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchInactive = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/users/inactive-since", {
        params: {
          since,
          page: 1,
          limit: 10000,
          search: debouncedQ || undefined,
          role: roleFilter || undefined,
        },
      });
      setInactiveUsers(data.users || []);
    } catch {
      Swal.fire("Error", "Failed to fetch inactive users", "error");
    } finally {
      setLoading(false);
    }
  };

  // ---------- View lifecycle ----------
  useEffect(() => {
    if (view === "sessions") {
      fetchSessions();

      const tick = setInterval(() => {
        if (!isPaused) {
          setSecondsLeft((s) => {
            if (s <= 1) {
              fetchSessions(true);
              return REFRESH_MS / 1000;
            }
            return s - 1;
          });
        }
      }, 1000);

      return () => clearInterval(tick);
    } else if (view === "never") {
      fetchNever();
    } else {
      fetchInactive();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    if (view === "never") fetchNever();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, roleFilter]);

  useEffect(() => {
    if (view === "inactive") fetchInactive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, roleFilter, since]);

  // ---------- Group sessions per user ----------
  const grouped = useMemo(() => {
    const map = new Map();

    for (const s of sessions) {
      if (!map.has(s.user_id)) {
        map.set(s.user_id, {
          user: {
            id: s.user_id,
            username: s.username,
            name: s.name,
            email: s.email,
            roles: s.roles || [],
            primary_role: s.primary_role,
            class_id: s.class_id || null,
            class_name: s.class_name || null,
            section_id: s.section_id || null,
            section_name: s.section_name || null,
            roll_number: s.roll_number || null,
          },
          sessions: [],
        });
      }
      map.get(s.user_id).sessions.push(s);
    }

    return Array.from(map.values()).map((g) => {
      g.sessions.sort(
        (a, b) =>
          new Date(b.last_seen_at || b.created_at).getTime() -
          new Date(a.last_seen_at || a.created_at).getTime()
      );
      return g;
    });
  }, [sessions]);

  // ---------- Dropdown values ----------
  const uniqueRoles = useMemo(() => {
    if (view === "sessions") {
      const roles = new Set(grouped.map((g) => g.user.primary_role).filter(Boolean));
      return Array.from(roles).sort();
    }

    if (view === "never") {
      const roles = new Set((neverUsers || []).flatMap((u) => u.roles || []).filter(Boolean));
      return Array.from(roles).sort();
    }

    const roles = new Set((inactiveUsers || []).flatMap((u) => u.roles || []).filter(Boolean));
    return Array.from(roles).sort();
  }, [grouped, neverUsers, inactiveUsers, view]);

  const uniqueClasses = useMemo(() => {
    let names = [];

    if (view === "sessions") {
      names = grouped.map((g) => g.user.class_name).filter(Boolean);
    } else if (view === "never") {
      names = (neverUsers || []).map((u) => u.class_name).filter(Boolean);
    } else {
      names = (inactiveUsers || []).map((u) => u.class_name).filter(Boolean);
    }

    return Array.from(new Set(names)).sort((a, b) =>
      String(a).localeCompare(String(b), undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
  }, [grouped, neverUsers, inactiveUsers, view]);

  // ---------- Sessions helpers ----------
  const latestLastSeen = (g) => (g.sessions.length > 0 ? g.sessions[0].last_seen_at : null);
  const latestLogin = (g) => (g.sessions.length > 0 ? g.sessions[0].created_at : null);
  const latestSession = (g) => (g.sessions.length > 0 ? g.sessions[0] : null);
  const hasActiveSessions = (g) => g.sessions.some((s) => !isExpired(s.expires_at));

  const activeUsers = useMemo(
    () => grouped.filter((g) => hasActiveSessions(g)).length,
    [grouped]
  );

  // ---------- Filters ----------
  const filteredSessions = useMemo(() => {
    const term = debouncedQ.toLowerCase();

    return grouped.filter((g) => {
      const userText = `${g.user.username || ""} ${g.user.name || ""} ${g.user.email || ""} ${
        g.user.class_name || ""
      } ${g.user.section_name || ""}`.toLowerCase();

      const sessionsText = g.sessions
        .map((s) => `${s.ip || ""} ${s.device || ""}`)
        .join(" ")
        .toLowerCase();

      const textMatch = !term || userText.includes(term) || sessionsText.includes(term);
      const roleMatch = !roleFilter || g.user.primary_role === roleFilter;
      const classMatch = !classFilter || g.user.class_name === classFilter;

      if (!status) return textMatch && roleMatch && classMatch;

      const hasActive = hasActiveSessions(g);
      const statusMatch = status === "active" ? hasActive : !hasActive;

      return textMatch && roleMatch && classMatch && statusMatch;
    });
  }, [grouped, debouncedQ, status, roleFilter, classFilter]);

  const filterUsersList = (arr) => {
    const term = debouncedQ.toLowerCase();

    return (arr || []).filter((u) => {
      const userText = `${u.username || ""} ${u.name || ""} ${u.email || ""} ${
        u.class_name || ""
      } ${u.section_name || ""}`.toLowerCase();

      const textMatch = !term || userText.includes(term);
      const roleMatch = !roleFilter || (u.roles || []).includes(roleFilter);
      const classMatch = !classFilter || u.class_name === classFilter;

      return textMatch && roleMatch && classMatch;
    });
  };

  const filteredNever = useMemo(
    () => filterUsersList(neverUsers),
    [neverUsers, debouncedQ, roleFilter, classFilter]
  );

  const filteredInactive = useMemo(
    () => filterUsersList(inactiveUsers),
    [inactiveUsers, debouncedQ, roleFilter, classFilter]
  );

  // ---------- Pagination ----------
  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredSessions.slice(start, start + PAGE_SIZE);
  }, [filteredSessions, currentPage]);

  const paginatedNever = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredNever.slice(start, start + PAGE_SIZE);
  }, [filteredNever, currentPage]);

  const paginatedInactive = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredInactive.slice(start, start + PAGE_SIZE);
  }, [filteredInactive, currentPage]);

  const totalPages =
    view === "sessions"
      ? Math.ceil(filteredSessions.length / PAGE_SIZE)
      : view === "never"
      ? Math.ceil(filteredNever.length / PAGE_SIZE)
      : Math.ceil(filteredInactive.length / PAGE_SIZE);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  // ---------- Actions ----------
  const endSession = async (id) => {
    const ok = (
      await Swal.fire({
        title: "Terminate session?",
        text: "The user will be logged out on that device.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Terminate",
      })
    ).isConfirmed;

    if (!ok) return;

    await api.delete(`/users/sessions/${id}`);
    fetchSessions(true);
  };

  const endAllForUser = async (userId) => {
    const ok = (
      await Swal.fire({
        title: "Logout all devices?",
        text: "This will log the user out from all devices.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Logout all",
      })
    ).isConfirmed;

    if (!ok) return;

    await api.delete(`/users/${userId}/sessions`);
    fetchSessions(true);
  };

  const copyIP = async (ip) => {
    if (!ip) return;

    await navigator.clipboard.writeText(ip);
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: "IP copied",
      showConfirmButton: false,
      timer: 1200,
    });
  };

  // ---------- CSV Export ----------
  const exportCSV = () => {
    let rows = [];

    if (view === "sessions") {
      rows.push([
        "User ID",
        "Username",
        "Name",
        "Email",
        "Primary Role",
        "All Roles",
        "Class",
        "Section",
        "Roll Number",
        "Total Sessions",
        "Latest Login",
        "Latest Last Seen",
        "Latest Expires",
        "Status",
        "Latest IP",
        "Latest Browser",
        "Latest OS",
      ]);

      for (const g of filteredSessions) {
        const latest = latestSession(g);

        rows.push([
          g.user.id,
          g.user.username || "",
          g.user.name || "",
          g.user.email || "",
          g.user.primary_role || "",
          (g.user.roles || []).join("|"),
          g.user.class_name || "",
          g.user.section_name || "",
          g.user.roll_number || "",
          g.sessions.length,
          latest?.created_at ? fmtFull(latest.created_at) : "",
          latest?.last_seen_at ? fmtFull(latest.last_seen_at) : "",
          latest?.expires_at ? fmtFull(latest.expires_at) : "",
          hasActiveSessions(g) ? "Active" : "Expired",
          latest?.ip || "",
          latest?.device ? getBrowser(latest.device) : "",
          latest?.device ? getOS(latest.device) : "",
        ]);
      }
    } else if (view === "never") {
      rows.push([
        "User ID",
        "Username",
        "Name",
        "Email",
        "Roles",
        "Class",
        "Section",
        "Registered At",
        "Login Status",
      ]);

      for (const u of filteredNever) {
        rows.push([
          u.id,
          u.username || "",
          u.name || "",
          u.email || "",
          (u.roles || []).join("|"),
          u.class_name || "",
          u.section_name || "",
          u.createdAt ? moment(u.createdAt).format("YYYY-MM-DD HH:mm:ss") : "",
          "Never Logged In",
        ]);
      }
    } else {
      rows.push([
        "User ID",
        "Username",
        "Name",
        "Email",
        "Roles",
        "Class",
        "Section",
        "Registered At",
        `Inactive Since ${since}`,
      ]);

      for (const u of filteredInactive) {
        rows.push([
          u.id,
          u.username || "",
          u.name || "",
          u.email || "",
          (u.roles || []).join("|"),
          u.class_name || "",
          u.section_name || "",
          u.createdAt ? moment(u.createdAt).format("YYYY-MM-DD HH:mm:ss") : "",
          "No session on/after cutoff",
        ]);
      }
    }

    const csv = rows
      .map((r) => r.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `user-${view}-${moment().format("YYYYMMDD-HHmmss")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---------- Header subtitle ----------
  const headerSubtitle =
    view === "sessions"
      ? loading
        ? "Fetching the latest sessions..."
        : `Updated ${moment().format("HH:mm:ss")} • Auto-refresh in ${secondsLeft}s`
      : loading
      ? view === "never"
        ? "Loading users who have never logged in…"
        : `Loading users inactive since ${moment(since).format("DD MMM YYYY")}…`
      : view === "never"
      ? "Users who have never logged in"
      : `Users with no logins since ${moment(since).format("DD MMM YYYY")}`;

  // ---------- Render ----------
  return (
    <div className="container mt-4">
      <div className="card shadow-lg border-0 rounded-4 overflow-hidden">
        <div className="card-header py-3 bg-gradient-primary text-white">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div>
              <h1 className="h5 mb-1 fw-bold d-flex align-items-center gap-2">
                <span className={`live-dot ${view === "sessions" ? "bg-success" : "bg-secondary"}`} />
                User Tracking Dashboard
                <span className="badge bg-light text-dark ms-1">
                  {view === "sessions" ? "Live" : "Static"}
                </span>
              </h1>
              <div className="small opacity-75">{headerSubtitle}</div>
            </div>

            <div className="d-flex align-items-center gap-2">
              {view === "sessions" && (
                <>
                  <div className="progress refresh-progress me-2" role="progressbar" aria-label="autorefresh">
                    <div
                      className="progress-bar"
                      style={{ width: `${(secondsLeft / (REFRESH_MS / 1000)) * 100}%` }}
                    />
                  </div>

                  <button
                    className={`btn btn-sm ${isPaused ? "btn-outline-warning" : "btn-outline-light"}`}
                    onClick={() => setIsPaused((p) => !p)}
                    title={isPaused ? "Resume auto-refresh" : "Pause auto-refresh"}
                  >
                    <i className={`bi ${isPaused ? "bi-play-fill" : "bi-pause-fill"} me-1`} />
                    {isPaused ? "Resume" : "Pause"}
                  </button>
                </>
              )}

              <button
                className="btn btn-sm btn-light"
                onClick={() => {
                  if (view === "sessions") fetchSessions();
                  else if (view === "never") fetchNever();
                  else fetchInactive();
                }}
              >
                <i className="bi bi-arrow-clockwise me-1" />
                Refresh Now
              </button>

              <button className="btn btn-sm btn-outline-light" onClick={exportCSV}>
                <i className="bi bi-filetype-csv me-1" />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        <div className="card-body p-4">
          {/* Tabs */}
          <ul className="nav nav-pills mb-3">
            <li className="nav-item">
              <button
                className={`nav-link ${view === "sessions" ? "active" : ""}`}
                onClick={() => setView("sessions")}
              >
                <i className="bi bi-broadcast me-1" />
                Sessions
              </button>
            </li>

            <li className="nav-item">
              <button
                className={`nav-link ${view === "never" ? "active" : ""}`}
                onClick={() => setView("never")}
              >
                <i className="bi bi-slash-circle me-1" />
                Never Logged In
              </button>
            </li>

            <li className="nav-item">
              <button
                className={`nav-link ${view === "inactive" ? "active" : ""}`}
                onClick={() => setView("inactive")}
              >
                <i className="bi bi-hourglass-split me-1" />
                Inactive Since
              </button>
            </li>
          </ul>

          {/* Toolbar */}
          <div className="toolbar rounded-3 border p-3 mb-3 bg-white sticky-toolbar">
            <div className="row g-2 align-items-center">
              <div className="col-lg-4">
                <div className="input-group">
                  <span className="input-group-text bg-white border-end-0">
                    <i className="bi bi-search text-muted" />
                  </span>
                  <input
                    className="form-control border-start-0 ps-0"
                    placeholder={
                      view === "sessions"
                        ? "Search by user, email, IP, device, class…"
                        : "Search by user, email, class…"
                    }
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
              </div>

              {view === "sessions" && (
                <div className="col-md-2 col-6">
                  <select
                    className="form-select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="">All Status</option>
                    <option value="active">Active Users</option>
                    <option value="expired">Expired Users</option>
                  </select>
                </div>
              )}

              <div className="col-md-2 col-6">
                <select
                  className="form-select"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="">All Roles</option>
                  {uniqueRoles.map((r) => (
                    <option key={r} value={r}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-2 col-6">
                <select
                  className="form-select"
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                >
                  <option value="">All Classes</option>
                  {uniqueClasses.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {view === "inactive" && (
                <div className="col-md-2 col-6">
                  <input
                    type="date"
                    className="form-control"
                    value={since}
                    max={moment().format("YYYY-MM-DD")}
                    onChange={(e) => setSince(e.target.value)}
                    title="Cutoff date"
                  />
                </div>
              )}

              <div className="col-lg-2 d-flex justify-content-lg-end">
                <button
                  className="btn btn-outline-secondary w-100 w-lg-auto"
                  onClick={() => {
                    setQ("");
                    setStatus("");
                    setRoleFilter("");
                    setClassFilter("");
                    if (view === "inactive") setSince(defaultSince);
                  }}
                  title="Clear filters"
                >
                  <i className="bi bi-x-circle me-1" />
                  Clear
                </button>
              </div>
            </div>

            {/* Summary chips */}
            {view === "sessions" ? (
              <div className="d-flex flex-wrap gap-2 mt-3">
                <span className="chip">
                  <i className="bi bi-people me-1" />
                  Total Users: <b>{filteredSessions.length}</b> / {grouped.length}
                </span>

                <span className="chip chip-success">
                  <i className="bi bi-lightning-charge me-1" />
                  Active: <b>{status === "active" ? filteredSessions.length : activeUsers}</b>
                </span>

                <span className="chip chip-secondary">
                  <i className="bi bi-moon-stars me-1" />
                  Expired:{" "}
                  <b>
                    {status === "expired"
                      ? filteredSessions.length
                      : Math.max(grouped.length - activeUsers, 0)}
                  </b>
                </span>

                <span className="chip chip-info">
                  <i className="bi bi-diagram-3 me-1" />
                  Sessions: <b>{sessions.length}</b>
                </span>
              </div>
            ) : view === "never" ? (
              <div className="d-flex flex-wrap gap-2 mt-3">
                <span className="chip">
                  <i className="bi bi-slash-circle me-1" />
                  Never Logged In: <b>{filteredNever.length}</b> / {neverUsers.length}
                </span>
              </div>
            ) : (
              <div className="d-flex flex-wrap gap-2 mt-3">
                <span className="chip">
                  <i className="bi bi-hourglass-split me-1" />
                  Inactive Since {moment(since).format("DD MMM YYYY")}:{" "}
                  <b>{filteredInactive.length}</b> / {inactiveUsers.length}
                </span>
              </div>
            )}
          </div>

          {/* Sessions table */}
          {view === "sessions" ? (
            <div className="table-responsive users-table-wrapper border rounded-2 overflow-auto">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-dark sticky-header">
                  <tr>
                    <th className="ps-3">#</th>
                    <th>User</th>
                    <th>Role</th>
                    <th>Class</th>
                    <th>Latest Login</th>
                    <th>Latest Seen</th>
                    <th>Sessions</th>
                    <th className="text-center">Status</th>
                    <th className="text-center pe-3">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={9} className="p-0">
                          <div className="skeleton-row shimmer" />
                        </td>
                      </tr>
                    ))
                  ) : filteredSessions.length ? (
                    paginatedSessions.map((g, i) => {
                      const hasActive = hasActiveSessions(g);
                      const numSessions = g.sessions.length;
                      const isExpanded = expanded.has(g.user.id);
                      const lastSeen = latestLastSeen(g);
                      const loginAt = latestLogin(g);
                      const latest = latestSession(g);

                      const isRecent =
                        lastSeen && moment().diff(moment(lastSeen), "seconds") <= RECENT_SECONDS;

                      const rowIndex = (currentPage - 1) * PAGE_SIZE + i + 1;

                      return (
                        <React.Fragment key={g.user.id}>
                          <tr
                            className={`border-bottom user-row ${isExpanded ? "border-primary" : ""} ${
                              isRecent ? "row-recent" : ""
                            }`}
                          >
                            <td className="ps-3 fw-medium">{rowIndex}</td>

                            <td>
                              <div className="d-flex align-items-center">
                                <button
                                  className="btn btn-sm btn-link text-decoration-none p-0 me-2 expander"
                                  onClick={() => {
                                    setExpanded((prev) => {
                                      const next = new Set(prev);
                                      next.has(g.user.id) ? next.delete(g.user.id) : next.add(g.user.id);
                                      return next;
                                    });
                                  }}
                                  aria-label={isExpanded ? "Collapse" : "Expand"}
                                >
                                  <i className={`bi bi-chevron-${isExpanded ? "down" : "right"} text-muted`} />
                                </button>

                                <div className="avatar rounded-circle d-flex align-items-center justify-content-center me-2 fw-bold fs-6 text-white bg-gradient-user">
                                  {getInitials(g.user.name)}
                                </div>

                                <div className="flex-grow-1 min-w-0">
                                  <div className="fw-semibold text-truncate" style={{ maxWidth: 200 }}>
                                    {g.user.username || "—"}
                                  </div>
                                  <div className="small text-muted text-truncate" style={{ maxWidth: 200 }}>
                                    {g.user.name || "—"}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td>
                              <span className="badge bg-primary fs-6 px-2 py-1">
                                {g.user.primary_role || "—"}
                              </span>
                            </td>

                            <td className="small">
                              <div className="fw-semibold">
                                {g.user.class_name || "—"}
                              </div>
                              <small className="text-muted">{g.user.section_name || "—"}</small>
                            </td>

                            <td className="small">
                              <div>{fmt(loginAt)}</div>
                              <small className="text-muted">{ago(loginAt)}</small>
                            </td>

                            <td className="small">
                              <div>{fmt(lastSeen)}</div>
                              <small className="text-muted">{ago(lastSeen)}</small>
                            </td>

                            <td className="text-center">
                              <span className={`badge ${numSessions > 1 ? "bg-info" : "bg-secondary"}`}>
                                {numSessions} {numSessions === 1 ? "session" : "sessions"}
                              </span>
                            </td>

                            <td className="text-center">
                              <span className={`status-pill ${hasActive ? "active" : "expired"}`}>
                                <span className="dot" />
                                {hasActive ? "Active" : "Expired"}
                              </span>
                            </td>

                            <td className="text-center pe-3">
                              <div className="btn-group">
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => endAllForUser(g.user.id)}
                                  title="Logout all sessions for this user"
                                >
                                  <i className="bi bi-box-arrow-right" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className="bg-light">
                              <td colSpan={9} className="p-0 border-0">
                                <div className="border-start border-4 border-primary p-4 bg-white">
                                  <div className="row mb-4">
                                    <div className="col-md-3">
                                      <h6 className="mb-2 text-primary">
                                        <i className="bi bi-envelope me-2" /> Email
                                      </h6>
                                      <p className="mb-0 small text-muted">{g.user.email || "—"}</p>
                                    </div>

                                    <div className="col-md-3">
                                      <h6 className="mb-2 text-primary">
                                        <i className="bi bi-mortarboard me-2" /> Class / Section
                                      </h6>
                                      <p className="mb-0 small text-muted">
                                        {formatClassSection(g.user.class_name, g.user.section_name)}
                                      </p>
                                    </div>

                                    <div className="col-md-2">
                                      <h6 className="mb-2 text-primary">
                                        <i className="bi bi-person-lines-fill me-2" /> Roll No.
                                      </h6>
                                      <p className="mb-0 small text-muted">{g.user.roll_number || "—"}</p>
                                    </div>

                                    <div className="col-md-4">
                                      <h6 className="mb-2 text-primary">
                                        <i className="bi bi-person-badge me-2" /> All Roles
                                      </h6>
                                      <div>
                                        {(g.user.roles || []).map((r) => (
                                          <span key={r} className="badge bg-secondary me-1 mb-1">
                                            {r}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="row mb-4">
                                    <div className="col-md-4">
                                      <h6 className="mb-2 text-primary">
                                        <i className="bi bi-box-arrow-in-right me-2" /> Latest Login
                                      </h6>
                                      <p className="mb-0 small text-muted">
                                        {latest?.created_at ? `${fmt(latest.created_at)} (${ago(latest.created_at)})` : "—"}
                                      </p>
                                    </div>

                                    <div className="col-md-4">
                                      <h6 className="mb-2 text-primary">
                                        <i className="bi bi-clock-history me-2" /> Latest Activity
                                      </h6>
                                      <p className="mb-0 small text-muted">
                                        {latest?.last_seen_at ? `${fmt(latest.last_seen_at)} (${ago(latest.last_seen_at)})` : "—"}
                                      </p>
                                    </div>

                                    <div className="col-md-4">
                                      <h6 className="mb-2 text-primary">
                                        <i className="bi bi-shield-check me-2" /> Latest Device Summary
                                      </h6>
                                      <p className="mb-0 small text-muted">
                                        {latest?.device ? `${getBrowser(latest.device)} on ${getOS(latest.device)}` : "—"}
                                      </p>
                                    </div>
                                  </div>

                                  <h6 className="mb-3 text-primary border-bottom pb-2">
                                    <i className="bi bi-list-ul me-2" /> Session Details
                                  </h6>

                                  <div className="table-responsive">
                                    <table className="table table-sm mb-0">
                                      <thead className="table-light">
                                        <tr>
                                          <th>Device</th>
                                          <th>IP</th>
                                          <th>Created</th>
                                          <th>Last Seen</th>
                                          <th>Expires</th>
                                          <th className="text-center">Action</th>
                                        </tr>
                                      </thead>

                                      <tbody>
                                        {g.sessions.map((s) => {
                                          const expired = isExpired(s.expires_at);
                                          return (
                                            <tr key={s.id} className={expired ? "opacity-50" : ""}>
                                              <td className="small">
                                                <div className="fw-medium">
                                                  <i className="bi bi-pc-display-horizontal me-1" />
                                                  {getBrowser(s.device)}
                                                </div>
                                                <small className="text-muted">on {getOS(s.device)}</small>
                                              </td>

                                              <td>
                                                {s.ip ? (
                                                  <button
                                                    className="btn btn-link btn-sm p-0 small ip-btn"
                                                    onClick={() => copyIP(s.ip)}
                                                    title="Click to copy"
                                                  >
                                                    <code className="bg-light px-1 rounded">{s.ip}</code>
                                                    <i className="bi bi-clipboard ms-1 small" />
                                                  </button>
                                                ) : (
                                                  <span className="small">—</span>
                                                )}
                                              </td>

                                              <td className="small">
                                                <div>{fmt(s.created_at)}</div>
                                                <small className="text-muted">{ago(s.created_at)}</small>
                                              </td>

                                              <td className="small">
                                                <div>{fmt(s.last_seen_at)}</div>
                                                <small className="text-muted">{ago(s.last_seen_at)}</small>
                                              </td>

                                              <td className="small">
                                                <div className={expired ? "text-danger fw-semibold" : ""}>
                                                  {fmt(s.expires_at)}
                                                </div>
                                                {expired && <small className="text-danger d-block">(expired)</small>}
                                              </td>

                                              <td className="text-center">
                                                <button
                                                  className="btn btn-sm btn-outline-danger"
                                                  onClick={() => endSession(s.id)}
                                                  title="End this session"
                                                  disabled={expired}
                                                >
                                                  <i className="bi bi-power" />
                                                </button>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="text-center py-5 text-muted">
                        <i className="bi bi-people display-5 opacity-50 mb-2 d-block" />
                        <div className="h5 mb-1">No users found</div>
                        <small>Try adjusting your filters or search terms</small>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            // Never / Inactive table
            <div className="table-responsive users-table-wrapper border rounded-2 overflow-auto">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-dark sticky-header">
                  <tr>
                    <th className="ps-3">#</th>
                    <th>User</th>
                    <th>Role(s)</th>
                    <th>Class</th>
                    <th>Registered</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={6} className="p-0">
                          <div className="skeleton-row shimmer" />
                        </td>
                      </tr>
                    ))
                  ) : (view === "never" ? filteredNever : filteredInactive).length ? (
                    (view === "never" ? paginatedNever : paginatedInactive).map((u, i) => {
                      const rowIndex = (currentPage - 1) * PAGE_SIZE + i + 1;

                      return (
                        <tr key={u.id} className="border-bottom">
                          <td className="ps-3 fw-medium">{rowIndex}</td>

                          <td>
                            <div className="d-flex align-items-center">
                              <div className="avatar rounded-circle d-flex align-items-center justify-content-center me-2 fw-bold fs-6 text-white bg-gradient-user">
                                {getInitials(u.name)}
                              </div>

                              <div className="flex-grow-1 min-w-0">
                                <div className="fw-semibold text-truncate" style={{ maxWidth: 220 }}>
                                  {u.username || "—"}
                                </div>
                                <div className="small text-muted text-truncate" style={{ maxWidth: 220 }}>
                                  {u.name || "—"}
                                </div>
                                <div className="small text-muted text-truncate" style={{ maxWidth: 220 }}>
                                  {u.email || "—"}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td>
                            {(u.roles || []).length ? (
                              (u.roles || []).map((r) => (
                                <span key={r} className="badge bg-secondary me-1 mb-1">
                                  {r}
                                </span>
                              ))
                            ) : (
                              <span className="badge bg-light text-dark">—</span>
                            )}
                          </td>

                          <td className="small">
                            <div className="fw-semibold">{u.class_name || "—"}</div>
                            <small className="text-muted">{u.section_name || "—"}</small>
                          </td>

                          <td className="small">
                            <div>{u.createdAt ? moment(u.createdAt).format("DD MMM, HH:mm") : "—"}</div>
                            {u.createdAt && (
                              <small className="text-muted">{moment(u.createdAt).fromNow()}</small>
                            )}
                          </td>

                          <td className="text-center">
                            <span className="status-pill expired">
                              <span className="dot" />
                              {view === "never"
                                ? "Never Logged In"
                                : `Inactive since ${moment(since).format("DD MMM")}`}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-5 text-muted">
                        <i className="bi bi-person-x display-5 opacity-50 mb-2 d-block" />
                        <div className="h5 mb-1">No users found</div>
                        <small>Try adjusting your filters or search terms</small>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="d-flex justify-content-center mt-4" aria-label="User pagination">
              {(() => {
                const {
                  pages,
                  showFirst,
                  showLast,
                  showLeftEllipsis,
                  showRightEllipsis,
                } = getPageWindow(totalPages, currentPage, 5);

                return (
                  <ul className="pagination">
                    <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                      <button
                        className="page-link"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        aria-label="Previous page"
                      >
                        Previous
                      </button>
                    </li>

                    {showFirst && (
                      <li className="page-item">
                        <button className="page-link" onClick={() => handlePageChange(1)}>
                          1
                        </button>
                      </li>
                    )}

                    {showLeftEllipsis && (
                      <li className="page-item disabled">
                        <span className="page-link" aria-hidden="true">
                          …
                        </span>
                      </li>
                    )}

                    {pages.map((p) => (
                      <li key={p} className={`page-item ${currentPage === p ? "active" : ""}`}>
                        <button className="page-link" onClick={() => handlePageChange(p)}>
                          {p}
                        </button>
                      </li>
                    ))}

                    {showRightEllipsis && (
                      <li className="page-item disabled">
                        <span className="page-link" aria-hidden="true">
                          …
                        </span>
                      </li>
                    )}

                    {showLast && (
                      <li className="page-item">
                        <button className="page-link" onClick={() => handlePageChange(totalPages)}>
                          {totalPages}
                        </button>
                      </li>
                    )}

                    <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
                      <button
                        className="page-link"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        aria-label="Next page"
                      >
                        Next
                      </button>
                    </li>
                  </ul>
                );
              })()}
            </nav>
          )}

          <div className="mt-3 small text-muted text-center">
            {view === "sessions" ? (
              <>
                <i className="bi bi-info-circle me-1" /> Auto-refresh is <b>{isPaused ? "paused" : "on"}</b>.
                Click Refresh for instant updates.
              </>
            ) : (
              <>
                <i className="bi bi-info-circle me-1" /> These lists are fetched on demand.
                Use Refresh to reload with latest data.
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserTracking;