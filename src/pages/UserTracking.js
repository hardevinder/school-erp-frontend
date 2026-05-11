import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import moment from "moment";

const REFRESH_MS = 30000;
const SESSION_PAGE_SIZE = 50;
const REPORT_PAGE_SIZE = 50;
const RECENT_SECONDS = 120;

const AVAILABLE_REPORT_COLUMNS = [
  { key: "admission_number", label: "Admission No." },
  { key: "student_name", label: "Student Name" },
  { key: "father_name", label: "Father Name" },
  { key: "class_name", label: "Class" },
  { key: "section_name", label: "Section" },
  { key: "session_name", label: "Session" },
  { key: "roll_number", label: "Roll No." },
  { key: "username", label: "Username" },
  { key: "email", label: "Email" },
  { key: "account_presence", label: "Account" },
  { key: "user_status", label: "User Status" },
  { key: "student_status", label: "Student Status" },
  { key: "login_state", label: "Login State" },
  { key: "session_count", label: "Session Count" },
  { key: "first_login_at", label: "First Login" },
  { key: "last_login_at", label: "Last Login" },
  { key: "last_seen_at", label: "Last Seen" },
  { key: "last_device", label: "Last Device" },
  { key: "last_ip", label: "Last IP" },
  { key: "user_created_at", label: "User Created" },
  { key: "disabled_at", label: "Disabled At" },
  { key: "disable_reason", label: "Disable Reason" },
];

const DEFAULT_SELECTED_COLUMNS = [
  "admission_number",
  "student_name",
  "father_name",
  "class_name",
  "section_name",
  "username",
  "account_presence",
  "user_status",
  "student_status",
  "login_state",
  "session_count",
  "last_seen_at",
];

const REPORT_TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "never_logged_in", label: "Never Logged In" },
  { value: "inactive", label: "Inactive" },
  { value: "active", label: "Active" },
  { value: "disabled_user", label: "Disabled User" },
  { value: "disabled_student", label: "Disabled Student" },
  { value: "not_active", label: "Not Active" },
];

const useStoredState = (key, initialValue) => {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw != null ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [key, state]);

  return [state, setState];
};

const fmt = (value) => (value ? moment(value).format("DD MMM, hh:mm A") : "—");
const ago = (value) => (value ? moment(value).fromNow() : "—");
const isExpired = (expiresAt) => (expiresAt ? new Date(expiresAt) <= new Date() : true);

const getInitials = (name) => {
  if (!name) return "?";
  return String(name)
    .trim()
    .split(/\s+/)
    .map((x) => x[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

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

const parseFileNameFromDisposition = (disposition, fallback) => {
  if (!disposition) return fallback;
  const match = disposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
};

const downloadBlob = (blob, fileName) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

const getBadgeClass = (value) => {
  const v = String(value || "").toLowerCase();

  if (v.includes("active") || v.includes("enabled")) return "bg-success-subtle text-success border border-success-subtle";
  if (v.includes("inactive")) return "bg-warning-subtle text-warning border border-warning-subtle";
  if (v.includes("never")) return "bg-danger-subtle text-danger border border-danger-subtle";
  if (v.includes("disabled")) return "bg-danger-subtle text-danger border border-danger-subtle";
  if (v.includes("missing")) return "bg-dark-subtle text-dark border";
  if (v.includes("created")) return "bg-info-subtle text-info border border-info-subtle";
  return "bg-secondary-subtle text-secondary border";
};

const UserTracking = () => {
  const [view, setView] = useStoredState("ut_view_bootstrap", "sessions");

  // sessions
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionSearch, setSessionSearch] = useStoredState("ut_session_search_bootstrap", "");
  const [sessionStatus, setSessionStatus] = useStoredState("ut_session_status_bootstrap", "");
  const [sessionRole, setSessionRole] = useStoredState("ut_session_role_bootstrap", "");
  const [sessionPage, setSessionPage] = useState(1);
  const [expanded, setExpanded] = useState(new Set());
  const [isPaused, setIsPaused] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_MS / 1000);

  // report
  const [reportRows, setReportRows] = useState([]);
  const [reportSummary, setReportSummary] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    never_logged_in: 0,
    missing_account: 0,
    disabled_user: 0,
    disabled_student: 0,
  });
  const [reportLoading, setReportLoading] = useState(false);
  const [reportPage, setReportPage] = useState(1);
  const [reportTotalPages, setReportTotalPages] = useState(1);

  const [reportSearch, setReportSearch] = useStoredState("ut_report_search_bootstrap", "");
  const [loginStatus, setLoginStatus] = useStoredState("ut_login_status_bootstrap", "all");
  const [inactiveDays, setInactiveDays] = useStoredState("ut_inactive_days_bootstrap", 2);

  const [selectedClassId, setSelectedClassId] = useStoredState("ut_class_id_bootstrap", "");
  const [selectedSectionId, setSelectedSectionId] = useStoredState("ut_section_id_bootstrap", "");
  const [selectedSessionId, setSelectedSessionId] = useStoredState("ut_session_id_bootstrap", "");
  const [selectedUserStatus, setSelectedUserStatus] = useStoredState("ut_user_status_bootstrap", "");
  const [selectedStudentStatus, setSelectedStudentStatus] = useStoredState("ut_student_status_bootstrap", "");

  const [reportMetaRows, setReportMetaRows] = useState([]);
  const [exporting, setExporting] = useState("");
  const [selectedColumns, setSelectedColumns] = useStoredState(
    "ut_selected_columns_bootstrap",
    DEFAULT_SELECTED_COLUMNS
  );
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  const sessionDebounceRef = useRef();
  const reportDebounceRef = useRef();
  const columnSelectorRef = useRef(null);
  const [debouncedSessionSearch, setDebouncedSessionSearch] = useState(sessionSearch);
  const [debouncedReportSearch, setDebouncedReportSearch] = useState(reportSearch);

  useEffect(() => {
    clearTimeout(sessionDebounceRef.current);
    sessionDebounceRef.current = setTimeout(() => {
      setDebouncedSessionSearch(sessionSearch.trim());
    }, 300);
    return () => clearTimeout(sessionDebounceRef.current);
  }, [sessionSearch]);

  useEffect(() => {
    clearTimeout(reportDebounceRef.current);
    reportDebounceRef.current = setTimeout(() => {
      setDebouncedReportSearch(reportSearch.trim());
    }, 300);
    return () => clearTimeout(reportDebounceRef.current);
  }, [reportSearch]);

  useEffect(() => {
    if (!showColumnSelector) return undefined;

    const handleClickOutside = (event) => {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target)) {
        setShowColumnSelector(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowColumnSelector(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showColumnSelector]);

  const showError = (title, error, fallback) => {
    const message =
      error?.response?.data?.message ||
      error?.response?.data?.details ||
      fallback ||
      "Something went wrong";
    Swal.fire(title, message, "error");
  };

  const fetchSessions = useCallback(async (silent = false) => {
    try {
      if (!silent) setSessionsLoading(true);
      const { data } = await api.get("/users/sessions");
      setSessions(data?.sessions || []);
    } catch (error) {
      showError("Error", error, "Failed to fetch live sessions");
    } finally {
      if (!silent) setSessionsLoading(false);
      setSecondsLeft(REFRESH_MS / 1000);
    }
  }, []);

  const buildReportParams = useCallback(
    (pageOverride = reportPage) => ({
      page: pageOverride,
      limit: REPORT_PAGE_SIZE,
      search: debouncedReportSearch || undefined,
      login_status: loginStatus || "all",
      inactive_days:
        loginStatus === "inactive" || loginStatus === "not_active"
          ? Number(inactiveDays || 2)
          : undefined,
      class_id: selectedClassId || undefined,
      section_id: selectedSectionId || undefined,
      session_id: selectedSessionId || undefined,
      user_status: selectedUserStatus || undefined,
      student_status: selectedStudentStatus || undefined,
    }),
    [
      reportPage,
      debouncedReportSearch,
      loginStatus,
      inactiveDays,
      selectedClassId,
      selectedSectionId,
      selectedSessionId,
      selectedUserStatus,
      selectedStudentStatus,
    ]
  );

  const fetchReport = useCallback(
    async (pageOverride = 1, silent = false) => {
      try {
        if (!silent) setReportLoading(true);

        const { data } = await api.get("/users/student-login-activity", {
          params: buildReportParams(pageOverride),
        });

        setReportRows(data?.records || []);
        setReportSummary(
          data?.summary || {
            total: 0,
            active: 0,
            inactive: 0,
            never_logged_in: 0,
            missing_account: 0,
            disabled_user: 0,
            disabled_student: 0,
          }
        );
        setReportTotalPages(data?.totalPages || 1);
        setReportPage(data?.currentPage || 1);
      } catch (error) {
        showError("Error", error, "Failed to fetch student login activity");
      } finally {
        if (!silent) setReportLoading(false);
      }
    },
    [buildReportParams]
  );

  const fetchReportMeta = useCallback(async () => {
    try {
      const { data } = await api.get("/users/student-login-activity", {
        params: {
          page: 1,
          limit: 1000,
          login_status: "all",
        },
      });
      setReportMetaRows(data?.records || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (view === "sessions") {
      fetchSessions();

      const timer = setInterval(() => {
        if (isPaused) return;

        setSecondsLeft((prev) => {
          if (prev <= 1) {
            fetchSessions(true);
            return REFRESH_MS / 1000;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }

    if (view === "report") {
      fetchReport(1);
      fetchReportMeta();
    }
  }, [view, fetchSessions, fetchReport, fetchReportMeta, isPaused]);

  useEffect(() => {
    if (view === "report") {
      setReportPage(1);
      fetchReport(1);
    }
  }, [
    view,
    debouncedReportSearch,
    loginStatus,
    inactiveDays,
    selectedClassId,
    selectedSectionId,
    selectedSessionId,
    selectedUserStatus,
    selectedStudentStatus,
    fetchReport,
  ]);

  useEffect(() => {
    setSessionPage(1);
  }, [debouncedSessionSearch, sessionStatus, sessionRole]);

  useEffect(() => {
    if (!selectedClassId && selectedSectionId) {
      setSelectedSectionId("");
    }
  }, [selectedClassId, selectedSectionId, setSelectedSectionId]);

  const groupedSessions = useMemo(() => {
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

    return Array.from(map.values()).map((entry) => {
      entry.sessions.sort(
        (a, b) =>
          new Date(b.last_seen_at || b.created_at).getTime() -
          new Date(a.last_seen_at || a.created_at).getTime()
      );
      return entry;
    });
  }, [sessions]);

  const hasActiveSessions = useCallback((group) => {
    return group.sessions.some((s) => !isExpired(s.expires_at));
  }, []);

  const filteredSessionGroups = useMemo(() => {
    const term = debouncedSessionSearch.toLowerCase();

    return groupedSessions.filter((g) => {
      const userText = `${g.user.username || ""} ${g.user.name || ""} ${g.user.email || ""} ${
        g.user.class_name || ""
      } ${g.user.section_name || ""}`.toLowerCase();

      const deviceText = g.sessions
        .map((s) => `${s.device || ""} ${s.ip || ""}`)
        .join(" ")
        .toLowerCase();

      const textMatch = !term || userText.includes(term) || deviceText.includes(term);
      const roleMatch = !sessionRole || g.user.primary_role === sessionRole;

      if (!sessionStatus) return textMatch && roleMatch;

      const active = hasActiveSessions(g);
      const statusMatch = sessionStatus === "active" ? active : !active;

      return textMatch && roleMatch && statusMatch;
    });
  }, [groupedSessions, debouncedSessionSearch, sessionRole, sessionStatus, hasActiveSessions]);

  const sessionRoles = useMemo(() => {
    return Array.from(
      new Set(groupedSessions.map((g) => g.user.primary_role).filter(Boolean))
    ).sort();
  }, [groupedSessions]);

  const sessionStats = useMemo(() => {
    const activeUsers = filteredSessionGroups.filter((g) => hasActiveSessions(g)).length;
    const expiredUsers = Math.max(filteredSessionGroups.length - activeUsers, 0);
    const liveSessions = filteredSessionGroups.reduce((sum, g) => sum + g.sessions.length, 0);

    return {
      users: filteredSessionGroups.length,
      activeUsers,
      expiredUsers,
      liveSessions,
    };
  }, [filteredSessionGroups, hasActiveSessions]);

  const paginatedSessionGroups = useMemo(() => {
    const start = (sessionPage - 1) * SESSION_PAGE_SIZE;
    return filteredSessionGroups.slice(start, start + SESSION_PAGE_SIZE);
  }, [filteredSessionGroups, sessionPage]);

  const sessionTotalPages = Math.max(
    1,
    Math.ceil(filteredSessionGroups.length / SESSION_PAGE_SIZE)
  );

  const classOptions = useMemo(() => {
    const map = new Map();
    for (const row of reportMetaRows) {
      if (row.class_id && row.class_name && !map.has(String(row.class_id))) {
        map.set(String(row.class_id), {
          id: String(row.class_id),
          name: row.class_name,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      String(a.name).localeCompare(String(b.name), undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
  }, [reportMetaRows]);

  const sectionOptions = useMemo(() => {
    const map = new Map();
    for (const row of reportMetaRows) {
      if (selectedClassId && String(row.class_id) !== String(selectedClassId)) continue;
      if (row.section_id && row.section_name && !map.has(String(row.section_id))) {
        map.set(String(row.section_id), {
          id: String(row.section_id),
          name: row.section_name,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      String(a.name).localeCompare(String(b.name), undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
  }, [reportMetaRows, selectedClassId]);

  const sessionOptions = useMemo(() => {
    const map = new Map();
    for (const row of reportMetaRows) {
      if (row.session_id && row.session_name && !map.has(String(row.session_id))) {
        map.set(String(row.session_id), {
          id: String(row.session_id),
          name: row.session_name,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      String(a.name).localeCompare(String(b.name), undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
  }, [reportMetaRows]);

  const selectedColumnObjects = useMemo(() => {
    return AVAILABLE_REPORT_COLUMNS.filter((col) => selectedColumns.includes(col.key));
  }, [selectedColumns]);

  const activeReportType = useMemo(
    () => REPORT_TYPE_OPTIONS.find((option) => option.value === loginStatus) || REPORT_TYPE_OPTIONS[0],
    [loginStatus]
  );

  const selectAllColumns = () => {
    setSelectedColumns(AVAILABLE_REPORT_COLUMNS.map((col) => col.key));
  };

  const applyQuickReportType = (value) => {
    setLoginStatus(value);
    setReportPage(1);
  };

  const toggleColumn = (key) => {
    setSelectedColumns((prev) => {
      const has = prev.includes(key);
      if (has) {
        const next = prev.filter((c) => c !== key);
        return next.length ? next : prev;
      }
      return [...prev, key];
    });
  };

  const getPrintableCell = (row, key) => {
    switch (key) {
      case "first_login_at":
      case "last_login_at":
      case "last_seen_at":
      case "user_created_at":
      case "disabled_at":
        return row[key] ? moment(row[key]).format("DD-MM-YYYY hh:mm A") : "—";
      default:
        return row[key] ?? "—";
    }
  };

  const handlePrintCurrentPage = () => {
    const columns = selectedColumnObjects;
    const rows = reportRows || [];

    const html = `
      <html>
        <head>
          <title>Student Login Activity</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
            h1 { margin: 0 0 6px; font-size: 22px; }
            .sub { margin-bottom: 16px; color: #555; font-size: 13px; }
            table { border-collapse: collapse; width: 100%; font-size: 11px; }
            th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
            th { background: #f2f6fb; }
          </style>
        </head>
        <body>
          <h1>Student Login Activity</h1>
          <div class="sub">
            Printed on ${moment().format("DD MMM YYYY, hh:mm A")}<br/>
            Showing current page only (${rows.length} rows)
          </div>
          <table>
            <thead>
              <tr>
                ${columns.map((c) => `<th>${c.label}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${
                rows.length
                  ? rows
                      .map(
                        (row) => `
                    <tr>
                      ${columns
                        .map(
                          (c) =>
                            `<td>${String(getPrintableCell(row, c.key) ?? "").replace(/</g, "&lt;")}</td>`
                        )
                        .join("")}
                    </tr>
                  `
                      )
                      .join("")
                  : `<tr><td colspan="${columns.length}">No records found</td></tr>`
              }
            </tbody>
          </table>
        </body>
      </html>
    `;

    const win = window.open("", "_blank", "width=1200,height=800");
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const handleExport = async (type) => {
    try {
      setExporting(type);

      const response = await api.get(
        type === "excel"
          ? "/users/student-login-activity/export/excel"
          : "/users/student-login-activity/export/pdf",
        {
          params: {
            ...buildReportParams(1),
            columns: selectedColumns,
          },
          responseType: "blob",
        }
      );

      const fallback =
        type === "excel"
          ? `student-login-activity-${moment().format("YYYYMMDD-HHmmss")}.xlsx`
          : `student-login-activity-${moment().format("YYYYMMDD-HHmmss")}.pdf`;

      const fileName = parseFileNameFromDisposition(
        response.headers["content-disposition"],
        fallback
      );

      downloadBlob(response.data, fileName);
    } catch (error) {
      showError("Export Failed", error, `Failed to export ${type.toUpperCase()}`);
    } finally {
      setExporting("");
    }
  };

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

    try {
      await api.delete(`/users/sessions/${id}`);
      fetchSessions(true);
    } catch (error) {
      showError("Error", error, "Failed to terminate session");
    }
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

    try {
      await api.delete(`/users/${userId}/sessions`);
      fetchSessions(true);
    } catch (error) {
      showError("Error", error, "Failed to logout all sessions");
    }
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

  const exportSessionsCsv = () => {
    const rows = [
      [
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
      ],
    ];

    filteredSessionGroups.forEach((g) => {
      const latest = g.sessions[0];
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
        latest?.created_at ? moment(latest.created_at).format("YYYY-MM-DD HH:mm:ss") : "",
        latest?.last_seen_at ? moment(latest.last_seen_at).format("YYYY-MM-DD HH:mm:ss") : "",
        latest?.expires_at ? moment(latest.expires_at).format("YYYY-MM-DD HH:mm:ss") : "",
        hasActiveSessions(g) ? "Active" : "Expired",
        latest?.ip || "",
        latest?.device ? getBrowser(latest.device) : "",
        latest?.device ? getOS(latest.device) : "",
      ]);
    });

    const csv = rows
      .map((row) => row.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `live-sessions-${moment().format("YYYYMMDD-HHmmss")}.csv`);
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

    return {
      pages: Array.from({ length: end - start + 1 }, (_, i) => start + i),
      showFirst: start > 1,
      showLast: end < total,
      showLeftEllipsis: start > 2,
      showRightEllipsis: end < total - 1,
    };
  };

  const renderPagination = (current, total, onChange) => {
    if (total <= 1) return null;

    const { pages, showFirst, showLast, showLeftEllipsis, showRightEllipsis } =
      getPageWindow(total, current, 5);

    return (
      <nav aria-label="pagination">
        <ul className="pagination pagination-sm mb-0">
          <li className={`page-item ${current === 1 ? "disabled" : ""}`}>
            <button
              className="page-link"
              onClick={() => onChange(current - 1)}
              disabled={current === 1}
            >
              Previous
            </button>
          </li>

          {showFirst && (
            <li className="page-item">
              <button className="page-link" onClick={() => onChange(1)}>
                1
              </button>
            </li>
          )}

          {showLeftEllipsis && (
            <li className="page-item disabled">
              <span className="page-link">…</span>
            </li>
          )}

          {pages.map((p) => (
            <li key={p} className={`page-item ${current === p ? "active" : ""}`}>
              <button className="page-link" onClick={() => onChange(p)}>
                {p}
              </button>
            </li>
          ))}

          {showRightEllipsis && (
            <li className="page-item disabled">
              <span className="page-link">…</span>
            </li>
          )}

          {showLast && (
            <li className="page-item">
              <button className="page-link" onClick={() => onChange(total)}>
                {total}
              </button>
            </li>
          )}

          <li className={`page-item ${current === total ? "disabled" : ""}`}>
            <button
              className="page-link"
              onClick={() => onChange(current + 1)}
              disabled={current === total}
            >
              Next
            </button>
          </li>
        </ul>
      </nav>
    );
  };

  const headerSubtitle =
    view === "sessions"
      ? sessionsLoading
        ? "Fetching the latest active devices..."
        : `Updated ${moment().format("HH:mm:ss")} • Auto-refresh in ${secondsLeft}s`
      : reportLoading
      ? "Loading student login activity..."
      : "Find never logged, inactive, disabled users and export selected columns";

  return (
    <div className="container-fluid px-3 px-lg-4 mt-4">
      <div className="card shadow-lg border-0 rounded-4 overflow-hidden">
        <div
          className="card-header border-0 text-white p-4"
          style={{
            background:
              "linear-gradient(135deg, #1e3a8a 0%, #2563eb 45%, #0891b2 100%)",
          }}
        >
          <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
            <div>
              <div className="text-uppercase small opacity-75 fw-semibold">
                Administration Dashboard
              </div>
              <h3 className="mb-1 fw-bold">User Tracking & Login Analytics</h3>
              <div className="small opacity-75">{headerSubtitle}</div>
            </div>

            <div className="d-flex flex-wrap gap-2">
              {view === "sessions" ? (
                <>
                  <button
                    className={`btn btn-sm ${isPaused ? "btn-warning" : "btn-light"}`}
                    onClick={() => setIsPaused((p) => !p)}
                  >
                    <i className={`bi ${isPaused ? "bi-play-fill" : "bi-pause-fill"} me-1`} />
                    {isPaused ? "Resume" : "Pause"}
                  </button>

                  <button className="btn btn-sm btn-outline-light" onClick={() => fetchSessions()}>
                    <i className="bi bi-arrow-clockwise me-1" />
                    Refresh
                  </button>

                  <button className="btn btn-sm btn-outline-light" onClick={exportSessionsCsv}>
                    <i className="bi bi-filetype-csv me-1" />
                    Export CSV
                  </button>
                </>
              ) : (
                <>
                  <div className="position-relative" ref={columnSelectorRef}>
                    <button
                      className={`btn btn-sm ${showColumnSelector ? "btn-light text-primary" : "btn-outline-light"}`}
                      type="button"
                      onClick={() => setShowColumnSelector((prev) => !prev)}
                    >
                      <i className="bi bi-layout-text-sidebar-reverse me-1" />
                      Columns
                      <span className="badge bg-secondary ms-2">{selectedColumns.length}</span>
                    </button>

                    {showColumnSelector && (
                      <div
                        className="position-absolute end-0 mt-2 bg-white rounded-4 shadow-lg border p-3"
                        style={{ width: 380, maxWidth: "90vw", zIndex: 1080 }}
                      >
                        <div className="d-flex align-items-start justify-content-between gap-3 mb-2">
                          <div>
                            <div className="fw-bold text-dark">Columns for Print / Export</div>
                            <div className="small text-muted">
                              Select the columns you want in Print, Excel, and PDF
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn-close"
                            aria-label="Close"
                            onClick={() => setShowColumnSelector(false)}
                          />
                        </div>

                        <div className="d-flex flex-wrap gap-2 mb-3">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={selectAllColumns}
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => setSelectedColumns(DEFAULT_SELECTED_COLUMNS)}
                          >
                            Reset Default
                          </button>
                        </div>

                        <div
                          className="border rounded-3 p-2"
                          style={{ maxHeight: 320, overflowY: "auto", background: "#f8fafc" }}
                        >
                          {AVAILABLE_REPORT_COLUMNS.map((col) => {
                            const checked = selectedColumns.includes(col.key);
                            return (
                              <label
                                key={col.key}
                                htmlFor={`col-${col.key}`}
                                className="d-flex align-items-center gap-2 px-2 py-2 rounded-3 mb-1"
                                style={{
                                  cursor: "pointer",
                                  background: checked ? "#eff6ff" : "#ffffff",
                                  border: checked ? "1px solid #bfdbfe" : "1px solid #e5e7eb",
                                  color: "#111827",
                                }}
                              >
                                <input
                                  id={`col-${col.key}`}
                                  className="form-check-input mt-0"
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleColumn(col.key)}
                                />
                                <span className="fw-medium" style={{ color: "#111827" }}>{col.label}</span>
                              </label>
                            );
                          })}
                        </div>

                        <div className="d-flex justify-content-between align-items-center pt-3">
                          <div className="small text-muted">
                            {selectedColumns.length} column{selectedColumns.length === 1 ? "" : "s"} selected
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => setShowColumnSelector(false)}
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <button className="btn btn-sm btn-outline-light" onClick={handlePrintCurrentPage}>
                    <i className="bi bi-printer me-1" />
                    Print
                  </button>

                  <button
                    className="btn btn-sm btn-outline-light"
                    onClick={() => {
                      fetchReport(reportPage);
                      fetchReportMeta();
                    }}
                  >
                    <i className="bi bi-arrow-clockwise me-1" />
                    Refresh
                  </button>

                  <button
                    className="btn btn-sm btn-light"
                    onClick={() => handleExport("excel")}
                    disabled={exporting === "excel"}
                  >
                    <i className="bi bi-file-earmark-excel me-1" />
                    {exporting === "excel" ? "Exporting..." : "Excel"}
                  </button>

                  <button
                    className="btn btn-sm btn-outline-light"
                    onClick={() => handleExport("pdf")}
                    disabled={exporting === "pdf"}
                  >
                    <i className="bi bi-file-earmark-pdf me-1" />
                    {exporting === "pdf" ? "Exporting..." : "PDF"}
                  </button>
                </>
              )}
            </div>
          </div>

          {view === "sessions" && (
            <div className="progress mt-3" style={{ height: 5 }}>
              <div
                className="progress-bar bg-light"
                style={{ width: `${(secondsLeft / (REFRESH_MS / 1000)) * 100}%` }}
              />
            </div>
          )}
        </div>

        <div className="card-body p-4">
          <div className="d-flex flex-wrap gap-2 mb-4">
            <button
              className={`btn ${view === "sessions" ? "btn-primary" : "btn-outline-primary"} rounded-pill`}
              onClick={() => setView("sessions")}
            >
              <i className="bi bi-broadcast me-2" />
              Live Sessions
            </button>

            <button
              className={`btn ${view === "report" ? "btn-primary" : "btn-outline-primary"} rounded-pill`}
              onClick={() => setView("report")}
            >
              <i className="bi bi-bar-chart-line me-2" />
              Student Login Activity
            </button>
          </div>

          {view === "sessions" ? (
            <>
              <div className="card border-0 shadow-sm mb-4 rounded-4">
                <div className="card-body">
                  <div className="row g-3 align-items-end">
                    <div className="col-lg-5">
                      <label className="form-label small text-uppercase fw-semibold text-muted">
                        Search
                      </label>
                      <div className="input-group">
                        <span className="input-group-text bg-white">
                          <i className="bi bi-search" />
                        </span>
                        <input
                          className="form-control"
                          placeholder="Search by username, email, device, IP, class..."
                          value={sessionSearch}
                          onChange={(e) => setSessionSearch(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="col-md-3 col-lg-2">
                      <label className="form-label small text-uppercase fw-semibold text-muted">
                        Status
                      </label>
                      <select
                        className="form-select"
                        value={sessionStatus}
                        onChange={(e) => setSessionStatus(e.target.value)}
                      >
                        <option value="">All Status</option>
                        <option value="active">Active Users</option>
                        <option value="expired">Expired Users</option>
                      </select>
                    </div>

                    <div className="col-md-3 col-lg-2">
                      <label className="form-label small text-uppercase fw-semibold text-muted">
                        Role
                      </label>
                      <select
                        className="form-select"
                        value={sessionRole}
                        onChange={(e) => setSessionRole(e.target.value)}
                      >
                        <option value="">All Roles</option>
                        {sessionRoles.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-6 col-lg-3 d-grid d-lg-flex justify-content-lg-end">
                      <button
                        className="btn btn-outline-secondary"
                        onClick={() => {
                          setSessionSearch("");
                          setSessionStatus("");
                          setSessionRole("");
                        }}
                      >
                        <i className="bi bi-x-circle me-1" />
                        Clear Filters
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="row g-3 mb-4">
                <div className="col-md-6 col-xl-3">
                  <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-body">
                      <div className="small text-muted text-uppercase fw-semibold">Users</div>
                      <div className="display-6 fw-bold">{sessionStats.users}</div>
                    </div>
                  </div>
                </div>

                <div className="col-md-6 col-xl-3">
                  <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-body">
                      <div className="small text-muted text-uppercase fw-semibold">Active Users</div>
                      <div className="display-6 fw-bold text-success">{sessionStats.activeUsers}</div>
                    </div>
                  </div>
                </div>

                <div className="col-md-6 col-xl-3">
                  <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-body">
                      <div className="small text-muted text-uppercase fw-semibold">Expired Users</div>
                      <div className="display-6 fw-bold text-warning">{sessionStats.expiredUsers}</div>
                    </div>
                  </div>
                </div>

                <div className="col-md-6 col-xl-3">
                  <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-body">
                      <div className="small text-muted text-uppercase fw-semibold">Live Sessions</div>
                      <div className="display-6 fw-bold text-info">{sessionStats.liveSessions}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="table-responsive border rounded-4">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-dark">
                    <tr>
                      <th className="ps-3">#</th>
                      <th>User</th>
                      <th>Role</th>
                      <th>Class / Section</th>
                      <th>Latest Login</th>
                      <th>Last Seen</th>
                      <th>Sessions</th>
                      <th className="text-center">Status</th>
                      <th className="text-center pe-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionsLoading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i}>
                          <td colSpan={9} className="text-center py-4 text-muted">
                            Loading...
                          </td>
                        </tr>
                      ))
                    ) : paginatedSessionGroups.length ? (
                      paginatedSessionGroups.map((group, idx) => {
                        const latest = group.sessions[0];
                        const active = hasActiveSessions(group);
                        const expandedRow = expanded.has(group.user.id);
                        const recent =
                          latest?.last_seen_at &&
                          moment().diff(moment(latest.last_seen_at), "seconds") <= RECENT_SECONDS;
                        const rowIndex = (sessionPage - 1) * SESSION_PAGE_SIZE + idx + 1;

                        return (
                          <React.Fragment key={group.user.id}>
                            <tr className={recent ? "table-primary" : ""}>
                              <td className="ps-3 fw-semibold">{rowIndex}</td>

                              <td>
                                <div className="d-flex align-items-center gap-2">
                                  <button
                                    className="btn btn-sm btn-link text-decoration-none p-0"
                                    onClick={() => {
                                      setExpanded((prev) => {
                                        const next = new Set(prev);
                                        next.has(group.user.id)
                                          ? next.delete(group.user.id)
                                          : next.add(group.user.id);
                                        return next;
                                      });
                                    }}
                                  >
                                    <i className={`bi bi-chevron-${expandedRow ? "down" : "right"}`} />
                                  </button>

                                  <div
                                    className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white"
                                    style={{
                                      width: 38,
                                      height: 38,
                                      background: "linear-gradient(135deg, #2563eb, #0891b2)",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {getInitials(group.user.name)}
                                  </div>

                                  <div className="min-w-0">
                                    <div className="fw-semibold">{group.user.username || "—"}</div>
                                    <div className="small text-muted">{group.user.name || "—"}</div>
                                  </div>
                                </div>
                              </td>

                              <td>
                                <span className="badge bg-primary-subtle text-primary border">
                                  {group.user.primary_role || "—"}
                                </span>
                              </td>

                              <td>
                                <div className="fw-semibold">{group.user.class_name || "—"}</div>
                                <small className="text-muted">{group.user.section_name || "—"}</small>
                              </td>

                              <td>
                                <div>{fmt(latest?.created_at)}</div>
                                <small className="text-muted">{ago(latest?.created_at)}</small>
                              </td>

                              <td>
                                <div>{fmt(latest?.last_seen_at)}</div>
                                <small className="text-muted">{ago(latest?.last_seen_at)}</small>
                              </td>

                              <td className="text-center">
                                <span className="badge bg-info-subtle text-info border">
                                  {group.sessions.length}
                                </span>
                              </td>

                              <td className="text-center">
                                <span className={`badge rounded-pill ${active ? "bg-success-subtle text-success border" : "bg-danger-subtle text-danger border"}`}>
                                  {active ? "Active" : "Expired"}
                                </span>
                              </td>

                              <td className="text-center pe-3">
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => endAllForUser(group.user.id)}
                                  title="Logout all sessions"
                                >
                                  <i className="bi bi-box-arrow-right" />
                                </button>
                              </td>
                            </tr>

                            {expandedRow && (
                              <tr>
                                <td colSpan={9} className="bg-light">
                                  <div className="row g-3 p-2">
                                    <div className="col-md-3">
                                      <div className="card border-0 shadow-sm h-100">
                                        <div className="card-body">
                                          <div className="small text-muted text-uppercase fw-semibold">Email</div>
                                          <div>{group.user.email || "—"}</div>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="col-md-3">
                                      <div className="card border-0 shadow-sm h-100">
                                        <div className="card-body">
                                          <div className="small text-muted text-uppercase fw-semibold">Class / Section</div>
                                          <div>{group.user.class_name || "—"} / {group.user.section_name || "—"}</div>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="col-md-2">
                                      <div className="card border-0 shadow-sm h-100">
                                        <div className="card-body">
                                          <div className="small text-muted text-uppercase fw-semibold">Roll No.</div>
                                          <div>{group.user.roll_number || "—"}</div>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="col-md-4">
                                      <div className="card border-0 shadow-sm h-100">
                                        <div className="card-body">
                                          <div className="small text-muted text-uppercase fw-semibold">All Roles</div>
                                          <div className="d-flex flex-wrap gap-1">
                                            {(group.user.roles || []).length ? (
                                              group.user.roles.map((role) => (
                                                <span key={role} className="badge bg-secondary-subtle text-secondary border">
                                                  {role}
                                                </span>
                                              ))
                                            ) : (
                                              <span className="text-muted">—</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="table-responsive mt-3">
                                    <table className="table table-sm align-middle mb-0">
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
                                        {group.sessions.map((s) => {
                                          const expired = isExpired(s.expires_at);
                                          return (
                                            <tr key={s.id} className={expired ? "opacity-50" : ""}>
                                              <td>
                                                <div className="fw-semibold">{getBrowser(s.device)}</div>
                                                <small className="text-muted">on {getOS(s.device)}</small>
                                              </td>

                                              <td>
                                                {s.ip ? (
                                                  <button
                                                    className="btn btn-link btn-sm p-0 text-decoration-none"
                                                    onClick={() => copyIP(s.ip)}
                                                  >
                                                    <code>{s.ip}</code>
                                                    <i className="bi bi-clipboard ms-1" />
                                                  </button>
                                                ) : (
                                                  "—"
                                                )}
                                              </td>

                                              <td>
                                                <div>{fmt(s.created_at)}</div>
                                                <small className="text-muted">{ago(s.created_at)}</small>
                                              </td>

                                              <td>
                                                <div>{fmt(s.last_seen_at)}</div>
                                                <small className="text-muted">{ago(s.last_seen_at)}</small>
                                              </td>

                                              <td>
                                                <div className={expired ? "text-danger fw-semibold" : ""}>
                                                  {fmt(s.expires_at)}
                                                </div>
                                              </td>

                                              <td className="text-center">
                                                <button
                                                  className="btn btn-sm btn-outline-danger"
                                                  onClick={() => endSession(s.id)}
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
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="text-center py-5 text-muted">
                          No live session records found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mt-3">
                <div className="small text-muted">
                  Showing {(filteredSessionGroups.length === 0) ? 0 : ((sessionPage - 1) * SESSION_PAGE_SIZE + 1)}
                  {filteredSessionGroups.length > 0 ? ` to ${Math.min(sessionPage * SESSION_PAGE_SIZE, filteredSessionGroups.length)}` : ""}
                  {' '}of {filteredSessionGroups.length} users
                </div>
                {renderPagination(sessionPage, sessionTotalPages, setSessionPage)}
              </div>
            </>
          ) : (
            <>
              <div className="card border-0 shadow-sm mb-4 rounded-4">
                <div className="card-body">
                  <div className="row g-3">
                    <div className="col-lg-4">
                      <label className="form-label small text-uppercase fw-semibold text-muted">Search</label>
                      <div className="input-group">
                        <span className="input-group-text bg-white">
                          <i className="bi bi-search" />
                        </span>
                        <input
                          className="form-control"
                          placeholder="Search student, username, class, section..."
                          value={reportSearch}
                          onChange={(e) => setReportSearch(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="col-md-4 col-lg-2">
                      <label className="form-label small text-uppercase fw-semibold text-muted">Report Type</label>
                      <select
                        className="form-select"
                        value={loginStatus}
                        onChange={(e) => applyQuickReportType(e.target.value)}
                      >
                        {REPORT_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-4 col-lg-2">
                      <label className="form-label small text-uppercase fw-semibold text-muted">Inactive Days</label>
                      <input
                        type="number"
                        min="1"
                        className="form-control"
                        value={inactiveDays}
                        onChange={(e) => setInactiveDays(e.target.value)}
                        disabled={!(loginStatus === "inactive" || loginStatus === "not_active")}
                      />
                    </div>

                    <div className="col-md-4 col-lg-2">
                      <label className="form-label small text-uppercase fw-semibold text-muted">Class</label>
                      <select
                        className="form-select"
                        value={selectedClassId}
                        onChange={(e) => {
                          setSelectedClassId(e.target.value);
                          setSelectedSectionId("");
                        }}
                      >
                        <option value="">All Classes</option>
                        {classOptions.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-4 col-lg-2">
                      <label className="form-label small text-uppercase fw-semibold text-muted">Section</label>
                      <select
                        className="form-select"
                        value={selectedSectionId}
                        onChange={(e) => setSelectedSectionId(e.target.value)}
                      >
                        <option value="">All Sections</option>
                        {sectionOptions.map((sec) => (
                          <option key={sec.id} value={sec.id}>
                            {sec.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-4 col-lg-2">
                      <label className="form-label small text-uppercase fw-semibold text-muted">Session</label>
                      <select
                        className="form-select"
                        value={selectedSessionId}
                        onChange={(e) => setSelectedSessionId(e.target.value)}
                      >
                        <option value="">All Sessions</option>
                        {sessionOptions.map((session) => (
                          <option key={session.id} value={session.id}>
                            {session.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-4 col-lg-2">
                      <label className="form-label small text-uppercase fw-semibold text-muted">User Status</label>
                      <select
                        className="form-select"
                        value={selectedUserStatus}
                        onChange={(e) => setSelectedUserStatus(e.target.value)}
                      >
                        <option value="">All User Status</option>
                        <option value="active">Active</option>
                        <option value="disabled">Disabled</option>
                        <option value="missing">Missing Account</option>
                      </select>
                    </div>

                    <div className="col-md-4 col-lg-2">
                      <label className="form-label small text-uppercase fw-semibold text-muted">Student Status</label>
                      <select
                        className="form-select"
                        value={selectedStudentStatus}
                        onChange={(e) => setSelectedStudentStatus(e.target.value)}
                      >
                        <option value="">All Student Status</option>
                        <option value="enabled">Enabled</option>
                        <option value="disabled">Disabled</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-top">
                    <div className="small text-uppercase fw-semibold text-muted mb-2">Quick Report Filters</div>
                    <div className="d-flex flex-wrap gap-2">
                      {REPORT_TYPE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`btn btn-sm rounded-pill ${loginStatus === option.value ? "btn-primary" : "btn-outline-primary"}`}
                          onClick={() => applyQuickReportType(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div className="small text-muted mt-2">
                      Current report type: <span className="fw-semibold text-dark">{activeReportType.label}</span>
                    </div>
                  </div>

                  <div className="d-flex flex-wrap gap-2 justify-content-end mt-3">
                    <button
                      className="btn btn-outline-secondary"
                      onClick={() => {
                        setReportSearch("");
                        setLoginStatus("all");
                        setInactiveDays(2);
                        setSelectedClassId("");
                        setSelectedSectionId("");
                        setSelectedSessionId("");
                        setSelectedUserStatus("");
                        setSelectedStudentStatus("");
                        setShowColumnSelector(false);
                        setReportPage(1);
                      }}
                    >
                      <i className="bi bi-x-circle me-1" />
                      Clear Filters
                    </button>
                  </div>
                </div>
              </div>

              <div className="row g-3 mb-4">
                <div className="col-md-6 col-xl-3">
                  <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-body">
                      <div className="small text-muted text-uppercase fw-semibold">Total Records</div>
                      <div className="display-6 fw-bold">{reportSummary.total}</div>
                    </div>
                  </div>
                </div>

                <div className="col-md-6 col-xl-3">
                  <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-body">
                      <div className="small text-muted text-uppercase fw-semibold">Active</div>
                      <div className="display-6 fw-bold text-success">{reportSummary.active}</div>
                    </div>
                  </div>
                </div>

                <div className="col-md-6 col-xl-3">
                  <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-body">
                      <div className="small text-muted text-uppercase fw-semibold">Inactive</div>
                      <div className="display-6 fw-bold text-warning">{reportSummary.inactive}</div>
                    </div>
                  </div>
                </div>

                <div className="col-md-6 col-xl-3">
                  <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-body">
                      <div className="small text-muted text-uppercase fw-semibold">Never Logged In</div>
                      <div className="display-6 fw-bold text-danger">{reportSummary.never_logged_in}</div>
                    </div>
                  </div>
                </div>

                <div className="col-md-6 col-xl-4">
                  <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-body">
                      <div className="small text-muted text-uppercase fw-semibold">Missing Account</div>
                      <div className="display-6 fw-bold text-secondary">{reportSummary.missing_account}</div>
                    </div>
                  </div>
                </div>

                <div className="col-md-6 col-xl-4">
                  <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-body">
                      <div className="small text-muted text-uppercase fw-semibold">Disabled User</div>
                      <div className="display-6 fw-bold text-danger">{reportSummary.disabled_user}</div>
                    </div>
                  </div>
                </div>

                <div className="col-md-6 col-xl-4">
                  <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-body">
                      <div className="small text-muted text-uppercase fw-semibold">Disabled Student</div>
                      <div className="display-6 fw-bold text-danger">{reportSummary.disabled_student}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="table-responsive border rounded-4">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-dark">
                    <tr>
                      <th className="ps-3">#</th>
                      <th>Student</th>
                      <th>Class / Section</th>
                      <th>Username</th>
                      <th>Account</th>
                      <th>User Status</th>
                      <th>Student Status</th>
                      <th>Login State</th>
                      <th>Sessions</th>
                      <th>First Login</th>
                      <th>Last Seen</th>
                    </tr>
                  </thead>

                  <tbody>
                    {reportLoading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i}>
                          <td colSpan={11} className="text-center py-4 text-muted">
                            Loading...
                          </td>
                        </tr>
                      ))
                    ) : reportRows.length ? (
                      reportRows.map((row, idx) => (
                        <tr key={`${row.student_id}-${row.user_id || "nouser"}`}>
                          <td className="ps-3 fw-semibold">
                            {(reportPage - 1) * REPORT_PAGE_SIZE + idx + 1}
                          </td>

                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <div
                                className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white"
                                style={{
                                  width: 36,
                                  height: 36,
                                  background: "linear-gradient(135deg, #2563eb, #0891b2)",
                                  flexShrink: 0,
                                }}
                              >
                                {getInitials(row.student_name)}
                              </div>

                              <div>
                                <div className="fw-semibold">{row.student_name || "—"}</div>
                                <div className="small text-muted">Adm No: {row.admission_number || "—"}</div>
                                <div className="small text-muted">Father: {row.father_name || "—"}</div>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div className="fw-semibold">{row.class_name || "—"}</div>
                            <small className="text-muted">
                              {row.section_name || "—"} • {row.session_name || "—"}
                            </small>
                          </td>

                          <td>
                            <div className="fw-semibold">{row.username || "—"}</div>
                            <small className="text-muted">{row.email || "—"}</small>
                          </td>

                          <td>
                            <span className={`badge rounded-pill ${getBadgeClass(row.account_presence)}`}>
                              {row.account_presence || "—"}
                            </span>
                          </td>

                          <td>
                            <span className={`badge rounded-pill ${getBadgeClass(row.user_status)}`}>
                              {row.user_status || "—"}
                            </span>
                          </td>

                          <td>
                            <span className={`badge rounded-pill ${getBadgeClass(row.student_status)}`}>
                              {row.student_status || "—"}
                            </span>
                          </td>

                          <td>
                            <span className={`badge rounded-pill ${getBadgeClass(row.login_state)}`}>
                              {row.login_state || "—"}
                            </span>
                          </td>

                          <td className="text-center">
                            <span className="badge bg-info-subtle text-info border">
                              {row.session_count ?? 0}
                            </span>
                          </td>

                          <td>
                            <div>{fmt(row.first_login_at)}</div>
                            <small className="text-muted">{ago(row.first_login_at)}</small>
                          </td>

                          <td>
                            <div>{fmt(row.last_seen_at)}</div>
                            <small className="text-muted">{ago(row.last_seen_at)}</small>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={11} className="text-center py-5 text-muted">
                          No activity records found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mt-3">
                <div className="small text-muted">
                  Showing {(reportSummary.total === 0) ? 0 : ((reportPage - 1) * REPORT_PAGE_SIZE + 1)}
                  {reportSummary.total > 0 ? ` to ${Math.min(reportPage * REPORT_PAGE_SIZE, reportSummary.total)}` : ""}
                  {' '}of {reportSummary.total} records
                </div>
                {renderPagination(reportPage, reportTotalPages, (page) => fetchReport(page))}
              </div>
            </>
          )}
        </div>
       
      </div>
    </div>
  );
};

export default UserTracking;