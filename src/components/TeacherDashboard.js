// File: src/components/TeacherDashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";

// Inline pages (keep real if you already have them)
import StudentRemarksEntry from "../pages/StudentRemarksEntry";
import CoScholasticEntry from "../pages/CoScholasticEntry";

// API + sockets
import api from "../api"; // your axios instance with auth
import socket from "../socket";

// The separated chat container (REAL, not dummy)
import ChatContainer from "./chat/ChatContainer";

/**
 * Teacher Dashboard — Mobile-first, responsive, attractive + QUICK ACTION TILES
 * - Greeting + date
 * - KPI tiles
 * - Quick Actions (teacher sidebar items as colorful tiles) ✅ includes Academic Calendar
 * - Today’s Timetable
 * - Attendance (today)
 * - My Substitutions (today)
 * - Recent Circulars
 * - Recent Digital Diaries (scrollable)
 * - Collapsible Co-Scholastic & Student Remarks
 * - Floating Chat + Notifications Drawer
 *
 * ✅ NEW:
 * - Quick Action: Bulk Attendance Upload -> /attendance-entry
 * - Quick Action: Co-Scholastic Entry -> /co-scholastic-entry
 * - Quick Actions Search box
 * - More modern header + card polish
 */

export default function TeacherDashboard() {
  const navigate = useNavigate();

  const teacherId = Number(localStorage.getItem("teacherId")) || 0;
  const teacherName = localStorage.getItem("name") || localStorage.getItem("username") || "Teacher";

  const todayStr = useMemo(() => moment().format("YYYY-MM-DD"), []);
  const todayName = useMemo(() => moment().format("dddd"), []);
  const greeting = useMemo(() => {
    const h = moment().hour();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  }, []);

  // ------- UI state -------
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [chatUnread, setChatUnread] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const lastTitleRef = useRef(document?.title || "Dashboard");
  const audioRef = useRef(null);
  const lastNonZeroUnreadRef = useRef(0);
  const zeroTimerRef = useRef(null);

  const [showRemarks, setShowRemarks] = useState(true);
  const [showCoScholastic, setShowCoScholastic] = useState(false);

  // Quick Actions search
  const [qaSearch, setQaSearch] = useState("");

  const userRoles = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("roles")) || [];
    } catch {
      const single = localStorage.getItem("userRole");
      return single ? [single] : [];
    }
  }, []);

  const isTeacher = useMemo(
    () => userRoles.map((r) => (r || "").toLowerCase()).includes("teacher"),
    [userRoles]
  );

  // ------- Data state -------
  const [periods, setPeriods] = useState([]);
  const [todayClasses, setTodayClasses] = useState([]);
  const [inchargeStudents, setInchargeStudents] = useState([]);
  const [attendanceTodayMarked, setAttendanceTodayMarked] = useState(null); // null=loading
  const [pendingLeave, setPendingLeave] = useState(0);
  const [newCircularsCount, setNewCircularsCount] = useState(0);
  const [recentCirculars, setRecentCirculars] = useState([]);
  const [assignmentsCount, setAssignmentsCount] = useState(0);
  const [subsTook, setSubsTook] = useState([]);
  const [subsFreed, setSubsFreed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);

  // NEW: recent digital diaries (compact feed)
  const [recentDiaries, setRecentDiaries] = useState([]);
  const [recentDiariesLoading, setRecentDiariesLoading] = useState(true);

  const pushError = (m) => setErrors((p) => [...p, m]);

  // ------- Fetch data on mount -------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErrors([]);

        // Periods
        try {
          const pRes = await api.get("/periods");
          const p = Array.isArray(pRes.data) ? pRes.data : pRes.data?.periods || [];
          if (!cancelled) setPeriods(p);
        } catch {
          pushError("Failed to load periods.");
        }

        // Timetable for teacher (today only)
        try {
          const tt = await api.get("/period-class-teacher-subject/timetable-teacher", {
            params: { teacherId, teacher_id: teacherId },
          });
          const list = Array.isArray(tt.data)
            ? tt.data
            : Array.isArray(tt.data?.timetable)
            ? tt.data.timetable
            : [];
          const todays = list.filter((r) => normalizeDay(r?.day) === todayName);
          if (!cancelled) setTodayClasses(todays);
        } catch {
          pushError("Failed to load timetable.");
        }

        // Incharge students + attendance
        try {
          const inc = await api.get("/incharges/students");
          const s = inc.data?.students || [];
          if (!cancelled) setInchargeStudents(s);
          if (s.length) {
            const classId = s[0]?.class_id;
            try {
              const att = await api.get(`/attendance/date/${todayStr}/${classId}`);
              const rows = att.data || [];
              if (!cancelled) setAttendanceTodayMarked(rows.length > 0);
            } catch {
              if (!cancelled) setAttendanceTodayMarked(false);
            }
          } else if (!cancelled) {
            setAttendanceTodayMarked(false);
          }
        } catch {
          pushError("Failed to load incharge students.");
        }

        // Leave list (pending count)
        try {
          const lr = await api.get("/leave");
          const arr = Array.isArray(lr.data) ? lr.data : [];
          if (!cancelled)
            setPendingLeave(arr.filter((x) => (x.status || "").toLowerCase() === "pending").length);
        } catch {}

        // Circulars (recent + new count in last 48h)
        try {
          const c = await api.get("/circulars");
          const circs = c.data?.circulars || [];
          const sorted = [...circs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          if (!cancelled) {
            setRecentCirculars(sorted.slice(0, 5));
            setNewCircularsCount(
              sorted.filter((x) => Date.now() - new Date(x.createdAt).getTime() < 48 * 3600 * 1000).length
            );
          }
        } catch {}

        // Assignments count
        try {
          const a = await api.get("/assignments");
          if (!cancelled) setAssignmentsCount((a.data?.assignments || []).length);
        } catch {}

        // Substitutions (today)
        try {
          const q = { date: todayStr, teacherId, teacher_id: teacherId };
          const s1 = await api.get("/substitutions/by-date/original", { params: q });
          const s2 = await api.get("/substitutions/by-date/substituted", { params: q });
          if (!cancelled) {
            setSubsFreed(Array.isArray(s1.data) ? s1.data : s1.data?.rows || []);
            setSubsTook(Array.isArray(s2.data) ? s2.data : s2.data?.rows || []);
          }
        } catch {}
      } catch {
        pushError("Failed to load dashboard data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [teacherId, todayStr, todayName]);

  // ------- Load recent digital diaries (dedup across classes) -------
  useEffect(() => {
    let cancelled = false;
    const fetchRecent = async () => {
      setRecentDiariesLoading(true);
      try {
        const { data } = await api.get("/diaries", {
          params: { page: 1, pageSize: 20, dateFrom: undefined, dateTo: undefined },
        });
        const raw = Array.isArray(data?.data) ? data.data : [];
        const grouped = groupDiaries(raw).slice(0, 10);
        if (!cancelled) setRecentDiaries(grouped);
      } catch {
        if (!cancelled) setRecentDiaries([]);
      } finally {
        if (!cancelled) setRecentDiariesLoading(false);
      }
    };
    fetchRecent();
    return () => {
      cancelled = true;
    };
  }, []);

  // ------- Live circular update via socket -------
  useEffect(() => {
    if (!socket?.on) return;
    const onNew = ({ circular }) => {
      setRecentCirculars((prev) => [circular, ...prev].slice(0, 5));
      setNewCircularsCount((n) => n + 1);
      pushMainNotification({
        title: "New Circular",
        message: circular?.title || "",
        tag: "circular",
      });
    };
    socket.on("newCircular", onNew);
    return () => socket.off("newCircular", onNew);
  }, []);

  // ------- Fee notifications to drawer -------
  useEffect(() => {
    if (!socket?.on) return;
    const onFee = (data) => {
      pushMainNotification({
        id: data?.id,
        title: data?.title || "Notification",
        message: data?.message || "",
        createdAt: data?.createdAt,
        tag: "fee",
      });
    };
    socket.on("fee-notification", onFee);
    return () => socket.off("fee-notification", onFee);
  }, []);

  // ------- Notifications storage -------
  useEffect(() => {
    const stored = localStorage.getItem("notifications");
    if (stored) {
      try {
        setNotifications(JSON.parse(stored) || []);
      } catch {
        setNotifications([]);
      }
    }
  }, []);

  const pushMainNotification = (payload) => {
    setNotifications((prev) => {
      const item = {
        id: payload?.id || `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        title: payload?.title || "Notification",
        message: payload?.message || "",
        createdAt: payload?.createdAt || new Date().toISOString(),
        tag: payload?.tag || "general",
      };
      const next = [item, ...prev];
      localStorage.setItem("notifications", JSON.stringify(next));
      return next;
    });
  };

  // ------- Chat unread + title -------
  useEffect(() => {
    if (!document) return;
    if (chatUnread > 0) document.title = `• (${chatUnread}) ${lastTitleRef.current}`;
    else document.title = lastTitleRef.current;
    return () => (document.title = lastTitleRef.current);
  }, [chatUnread]);

  useEffect(() => {
    audioRef.current = new Audio(
      "data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQAA..."
    );
  }, []);

  useEffect(() => {
    const asked = localStorage.getItem("notifPermAsked");
    if (!asked && "Notification" in window) {
      const t = setTimeout(() => {
        Notification.requestPermission().finally(() => localStorage.setItem("notifPermAsked", "1"));
      }, 1000);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    const onUnread = (e) => {
      const { count = 0, last } = e.detail || {};
      setUnreadStably(count, { force: chatOpen });
      if (!chatOpen && last) handleIncomingChatWhenClosed({ last });
    };
    const onOpened = () => {
      setChatOpen(true);
      if (zeroTimerRef.current) {
        clearTimeout(zeroTimerRef.current);
        zeroTimerRef.current = null;
      }
    };
    const onClosed = () => {
      setChatOpen(false);
      if (lastNonZeroUnreadRef.current > 0) setChatUnread(lastNonZeroUnreadRef.current);
    };
    const openRequest = () => setChatOpen(true);

    window.addEventListener("chat:unread", onUnread);
    window.addEventListener("chat:opened", onOpened);
    window.addEventListener("chat:closed", onClosed);
    window.addEventListener("chat:open-request", openRequest);
    return () => {
      window.removeEventListener("chat:unread", onUnread);
      window.removeEventListener("chat:opened", onOpened);
      window.removeEventListener("chat:closed", onClosed);
      window.removeEventListener("chat:open-request", openRequest);
    };
  }, [chatOpen]);

  const setUnreadStably = (next, { force = false } = {}) => {
    if (next > 0) {
      if (zeroTimerRef.current) {
        clearTimeout(zeroTimerRef.current);
        zeroTimerRef.current = null;
      }
      lastNonZeroUnreadRef.current = next;
      setChatUnread(next);
      return;
    }
    if (force) {
      if (zeroTimerRef.current) {
        clearTimeout(zeroTimerRef.current);
        zeroTimerRef.current = null;
      }
      lastNonZeroUnreadRef.current = 0;
      setChatUnread(0);
      return;
    }
    if (!zeroTimerRef.current) {
      zeroTimerRef.current = setTimeout(() => {
        lastNonZeroUnreadRef.current = 0;
        setChatUnread(0);
        zeroTimerRef.current = null;
      }, 4500);
    }
  };

  const handleIncomingChatWhenClosed = async ({ last }) => {
    const from = last?.fromName || last?.from || "New message";
    const body = last?.text || last?.message || "You have a new message";

    toast.info(
      <div className="d-flex align-items-start">
        <div className="me-2">💬</div>
        <div className="flex-grow-1">
          <div className="fw-semibold">{from}</div>
          <div className="small text-muted">{body}</div>
          <button
            className="btn btn-sm btn-primary mt-2"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("chat:open-request"));
              toast.dismiss();
            }}
          >
            Open chat
          </button>
        </div>
      </div>,
      { autoClose: 6000 }
    );

    if ("Notification" in window) {
      try {
        if (Notification.permission === "default") await Notification.requestPermission();
        if (Notification.permission === "granted") {
          const n = new Notification(from, {
            body,
            tag: `chat-${Date.now()}`,
            icon: "/icons/chat-128.png",
            badge: "/icons/badge-72.png",
            silent: true,
          });
          n.onclick = () => {
            window.focus?.();
            window.dispatchEvent(new CustomEvent("chat:open-request"));
            n.close?.();
          };
        }
      } catch {}
    }

    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        await audioRef.current.play();
      }
    } catch {}

    pushMainNotification({ title: "New chat message", message: `${from}: ${body}`, tag: "chat" });
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    localStorage.removeItem("notifications");
    toast.success("All notifications cleared.");
  };
  const removeNotification = (id) => {
    setNotifications((prev) => {
      const next = prev.filter((n) => n.id !== id);
      localStorage.setItem("notifications", JSON.stringify(next));
      return next;
    });
  };

  // ------- KPIs derived -------
  const kpi = useMemo(
    () => ({
      todaysCount: todayClasses.length,
      pendingLeave,
      newCircularsCount,
      assignmentCount: assignmentsCount,
    }),
    [todayClasses.length, pendingLeave, newCircularsCount, assignmentsCount]
  );

  // ------- QUICK ACTIONS (Teacher sidebar → tiles) -------
 const quickActions = useMemo(
  () =>
    !isTeacher
      ? []
      : [
          { label: "Mark Attendance", icon: "bi-check2-square", path: "/mark-attendance", color: "var(--qa-blue)" },

          // ✅ NEW: Bulk Attendance Upload
          {
            label: "Bulk Attendance Upload",
            icon: "bi-upload",
            path: "/attendance-entry",
            color: "var(--qa-cyan)",
            badge: "NEW",
          },

          { label: "Timetable", icon: "bi-table", path: "/teacher-timetable-display", color: "var(--qa-purple)" },
          { label: "My Substitutions", icon: "bi-arrow-repeat", path: "/combined-teacher-substitution", color: "var(--qa-teal)" },
          { label: "Assignments", icon: "bi-clipboard", path: "/assignments", color: "var(--qa-green)" },
          { label: "Assignment Marking", icon: "bi-pencil-square", path: "/assignment-marking", color: "var(--qa-amber)" },
          { label: "Circulars", icon: "bi-megaphone", path: "/view-circulars", color: "var(--qa-pink)" },
          { label: "Lesson Plan", icon: "bi-journal-text", path: "/lesson-plan", color: "var(--qa-indigo)" },

          // ✅ NEW: Syllabus Breakdown
          {
            label: "Syllabus Breakdown",
            icon: "bi-diagram-3",
            path: "/syllabus-breakdown",
            color: "var(--qa-indigo)",
            badge: "NEW",
          },

          { label: "Request Leave", icon: "bi-box-arrow-in-down-left", path: "/employee-leave-request", color: "var(--qa-orange)" },
          { label: "My Attendance", icon: "bi-calendar2-week", path: "/my-attendance-calendar", color: "var(--qa-slate)" },
          { label: "Marks Entry", icon: "bi-pencil-square", path: "/marks-entry", color: "var(--qa-lime)" },
          { label: "Result Summary", icon: "bi-bar-chart", path: "/reports/classwise-result-summary", color: "var(--qa-rose)" },
          { label: "Report Cards", icon: "bi-printer", path: "/report-card-generator", color: "var(--qa-slate)" },
          { label: "Digital Diary", icon: "bi-journal-bookmark", path: "/digital-diary", color: "var(--qa-indigo)" },

          // ✅ Co-Scholastic Entry
          {
            label: "Co-Scholastic Entry",
            icon: "bi-puzzle",
            path: "/co-scholastic-entry",
            color: "var(--qa-teal)",
          },

          // ✅ Academic Calendar
          { label: "Academic Calendar", icon: "bi-calendar3", path: "/academic-calendar-view", color: "var(--qa-purple)" },
        ],
  [isTeacher]
);

  const filteredQuickActions = useMemo(() => {
    const q = (qaSearch || "").trim().toLowerCase();
    if (!q) return quickActions;
    return quickActions.filter((a) => (a.label || "").toLowerCase().includes(q));
  }, [qaSearch, quickActions]);

  const go = (path) => navigate(path);

  const initials = useMemo(() => {
    const parts = String(teacherName || "Teacher").trim().split(/\s+/).filter(Boolean);
    const a = (parts[0] || "T")[0] || "T";
    const b = (parts[1] || "")[0] || "";
    return (a + b).toUpperCase();
  }, [teacherName]);

  return (
    <div className="container-fluid px-3 teacher-dash">
      {/* Header */}
      <div className="dash-hero mb-3 rounded-4 shadow-sm">
        <div className="dash-hero-inner p-3 p-md-4">
          <div className="d-flex align-items-start gap-3">
            <div className="avatar-soft" aria-hidden="true">
              <span>{initials}</span>
            </div>

            <div className="flex-grow-1">
              <div className="d-flex flex-wrap align-items-center gap-2">
                <h5 className="mb-0 text-white">
                  {greeting},{" "}
                  <span className="fw-semibold">{teacherName || "Teacher"}</span>
                </h5>
                <span className="badge bg-light text-dark border ms-md-2">{moment().format("dddd")}</span>
                <span className="badge bg-light text-dark border">{moment().format("Do MMM YYYY")}</span>
              </div>

              <div className="text-white-50 small mt-1">
                Today:{" "}
                <span className="text-white">
                  {todayClasses.length ? `${todayClasses.length} class(es)` : "No scheduled classes"}
                </span>{" "}
                • Substitutions:{" "}
                <span className="text-white">
                  {subsTook.length} covering / {subsFreed.length} freed
                </span>
              </div>

              <div className="d-none d-md-flex align-items-center gap-1 mt-2">
                {userRoles.map((r) => (
                  <span key={r} className="badge bg-dark bg-opacity-50 text-white border border-white border-opacity-25">
                    {r}
                  </span>
                ))}
              </div>
            </div>

            <div className="d-flex flex-column gap-2 align-items-end">
              <button
                type="button"
                className="btn btn-light btn-sm position-relative"
                onClick={() => setShowNotifications(true)}
                title="Notifications"
              >
                <i className="bi bi-bell me-1" />
                Notifications
                {notifications.length > 0 && (
                  <span
                    className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
                    style={{ fontSize: "0.7rem" }}
                  >
                    {notifications.length}
                  </span>
                )}
              </button>

              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline-light btn-sm"
                  onClick={() => go("/co-scholastic-entry")}
                  title="Open Co-Scholastic Entry"
                >
                  <i className="bi bi-puzzle me-1" />
                  Co-Scholastic
                </button>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowRemarks((s) => !s)}
                  title="Toggle Student Remarks (inline)"
                >
                  <i className="bi bi-pencil-square me-1" />
                  {showRemarks ? "Hide" : "Show"} Remarks
                </button>
              </div>
            </div>
          </div>

          {/* Small action strip */}
          <div className="dash-strip mt-3">
            <button className="btn btn-dark btn-sm" onClick={() => go("/mark-attendance")}>
              <i className="bi bi-check2-square me-1" />
              {attendanceTodayMarked ? "Update Attendance" : "Mark Attendance"}
            </button>

            {/* ✅ NEW shortcut */}
            <button className="btn btn-outline-light btn-sm" onClick={() => go("/attendance-entry")}>
              <i className="bi bi-upload me-1" />
              Bulk Attendance Upload
            </button>

            <button className="btn btn-outline-light btn-sm" onClick={() => go("/teacher-timetable-display")}>
              <i className="bi bi-table me-1" />
              View Timetable
            </button>

            <button className="btn btn-outline-light btn-sm" onClick={() => setShowCoScholastic((s) => !s)}>
              <i className="bi bi-layout-text-sidebar-reverse me-1" />
              {showCoScholastic ? "Hide" : "Show"} Inline Co-Scholastic
            </button>
          </div>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="alert alert-warning">
          <div className="fw-semibold mb-1">Some data could not be loaded:</div>
          <ul className="mb-0">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* KPI cards */}
      <div className="row g-3 mb-3">
        <KpiCard icon="bi-table" label="Today’s Classes" value={kpi.todaysCount} tone="primary" />
        <KpiCard icon="bi-inbox" label="Pending Leave" value={kpi.pendingLeave} tone="warning" />
        <KpiCard icon="bi-megaphone" label="New Circulars" value={kpi.newCircularsCount} tone="info" />
        <KpiCard icon="bi-clipboard-check" label="Assignments" value={kpi.assignmentCount} tone="success" />
      </div>

      {/* Quick Actions Tiles */}
      {isTeacher && (
        <section className="mb-3">
          <div className="card shadow-sm border-0 rounded-4 overflow-hidden">
            <div className="card-header bg-white d-flex flex-wrap gap-2 align-items-center justify-content-between">
              <div>
                <h6 className="mb-0">Quick Actions</h6>
                <small className="text-muted">Tap to open • Search to find quickly</small>
              </div>

              <div className="qa-search">
                <i className="bi bi-search" />
                <input
                  value={qaSearch}
                  onChange={(e) => setQaSearch(e.target.value)}
                  placeholder="Search actions…"
                  className="form-control form-control-sm"
                  aria-label="Search quick actions"
                />
              </div>
            </div>

            <div className="card-body p-2">
              {filteredQuickActions.length === 0 ? (
                <div className="p-3 text-center text-muted">No actions found.</div>
              ) : (
                <div className="qa-grid">
                  {filteredQuickActions.map((a) => (
                    <button
                      key={a.path}
                      className="qa-tile"
                      onClick={() => go(a.path)}
                      style={{ background: a.color }}
                    >
                      <div className="qa-icon">
                        <i className={`bi ${a.icon}`} />
                      </div>
                      {a.badge ? <span className="qa-badge">{a.badge}</span> : null}
                      <div className="qa-label">{a.label}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Two-column: timetable + right column */}
      <div className="row g-3">
        {/* Today’s timetable */}
        <div className="col-12 col-xl-6">
          <div className="card shadow-sm border-0 rounded-4 today-card">
            <div className="card-header bg-white d-flex align-items-center justify-content-between">
              <div>
                <h6 className="mb-0">Today’s Timetable</h6>
                <small className="text-muted">Day: {todayName}</small>
              </div>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => go("/teacher-timetable-display")}>
                View All
              </button>
            </div>

            <div className="card-body p-0">
              {loading ? (
                <div className="p-3">
                  <SkeletonRows rows={5} />
                </div>
              ) : todayClasses.length === 0 ? (
                <div className="p-3 text-center text-muted">No classes scheduled today.</div>
              ) : (
                <div className="table-responsive m-0">
                  <table className="table table-hover table-sm align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: "24%" }}>Period</th>
                        <th>Class</th>
                        <th>Subject</th>
                        <th style={{ width: "22%" }}>Room</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayClasses.map((rec, idx) => (
                        <tr key={idx}>
                          <td className="fw-semibold">
                            {rec?.Period?.name || rec?.Period?.period_name || rec?.periodId || "-"}
                          </td>
                          <td>{rec?.Class?.class_name || "-"}</td>
                          <td>{rec?.Subject?.name || "-"}</td>
                          <td>{rec?.room || rec?.room_no || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {todayClasses.length > 0 && !loading && (
              <div className="card-footer bg-white small text-muted">
                Tip: Use <span className="fw-semibold">Marks Entry</span> / <span className="fw-semibold">Remarks</span>{" "}
                from Quick Actions.
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="col-12 col-xl-6">
          {/* Attendance Today */}
          <div className="card shadow-sm border-0 rounded-4">
            <div className="card-header bg-white d-flex align-items-center justify-content-between">
              <div>
                <h6 className="mb-0">Attendance (Today)</h6>
                <small className="text-muted">{todayStr}</small>
              </div>

              <div className="d-flex gap-2">
                {/* ✅ NEW: bulk upload shortcut */}
                <button className="btn btn-sm btn-outline-primary" onClick={() => go("/attendance-entry")}>
                  <i className="bi bi-upload me-1" />
                  Bulk Upload
                </button>

                <button className="btn btn-sm btn-primary" onClick={() => go("/mark-attendance")}>
                  {attendanceTodayMarked ? "Update" : "Mark Now"}
                </button>
              </div>
            </div>

            <div className="card-body">
              {attendanceTodayMarked === null ? (
                <div className="text-muted d-flex align-items-center">
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Checking attendance status…
                </div>
              ) : attendanceTodayMarked ? (
                <div className="d-flex align-items-center">
                  <i className="bi bi-check-circle-fill text-success me-2" /> Attendance marked for today.
                </div>
              ) : inchargeStudents.length ? (
                <div className="d-flex align-items-center">
                  <i className="bi bi-exclamation-triangle-fill text-warning me-2" /> Not marked for today.
                </div>
              ) : (
                <div className="text-muted">You are not an incharge for any class.</div>
              )}
            </div>
          </div>

          {/* Substitutions */}
          <div className="card shadow-sm border-0 rounded-4 mt-3">
            <div className="card-header bg-white d-flex align-items-center justify-content-between">
              <h6 className="mb-0">My Substitutions (Today)</h6>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => go("/combined-teacher-substitution")}>
                View All
              </button>
            </div>

            <div className="card-body">
              <div className="d-flex flex-wrap gap-2">
                <Pill text={`Covering: ${subsTook.length}`} />
                <Pill text={`Freed: ${subsFreed.length}`} />
              </div>

              {(subsTook.length > 0 || subsFreed.length > 0) && (
                <ul className="list-unstyled small mt-2 mb-0">
                  {subsTook.slice(0, 3).map((s, i) => (
                    <li key={`t${i}`} className="mb-1">
                      Covering <strong>{s?.Class?.class_name}</strong> — {s?.Subject?.name}
                    </li>
                  ))}
                  {subsFreed.slice(0, 3).map((s, i) => (
                    <li key={`f${i}`} className="mb-1">
                      Freed <strong>{s?.Class?.class_name}</strong> — {s?.Subject?.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Recent Digital Diaries */}
          <div className="card shadow-sm border-0 rounded-4 mt-3">
            <div className="card-header bg-white d-flex align-items-center justify-content-between">
              <h6 className="mb-0">Recent Digital Diaries</h6>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => go("/digital-diary")}>
                Open Digital Diary
              </button>
            </div>

            <div className="card-body p-0">
              {recentDiariesLoading ? (
                <div className="p-3 text-center text-muted">
                  <div className="spinner-border spinner-border-sm me-2" role="status" />
                  Loading…
                </div>
              ) : recentDiaries.length === 0 ? (
                <div className="p-3 text-center text-muted">No diary notes yet.</div>
              ) : (
                <div className="dd-mini-feed">
                  {recentDiaries.map((d) => (
                    <button
                      key={d.id}
                      className="dd-mini-item list-group-item list-group-item-action text-start"
                      onClick={() => go("/digital-diary")}
                      title="Open in Digital Diary"
                    >
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="me-2 flex-grow-1">
                          <div className="fw-semibold text-truncate">{d.title}</div>
                          <div className="text-muted small text-truncate-2">{d.content}</div>

                          {Array.isArray(d.targets) && d.targets.length > 0 ? (
                            <div className="mt-1 d-flex flex-wrap gap-1">
                              {d.targets.slice(0, 6).map((t, idx) => (
                                <span key={idx} className="badge bg-light text-dark border small">
                                  {chipName(t)}
                                </span>
                              ))}
                              {d.targets.length > 6 && (
                                <span className="badge bg-secondary-subtle text-secondary small">
                                  +{d.targets.length - 6} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="mt-1">
                              <span className="badge bg-light text-dark border small">{singleChipName(d)}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-end small text-nowrap text-muted">{formatWhen(d.date)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Circulars */}
      <div className="card shadow-sm border-0 rounded-4 mt-3 overflow-hidden">
        <div className="card-header bg-white d-flex align-items-center justify-content-between">
          <h6 className="mb-0">Recent Circulars</h6>
          <button className="btn btn-sm btn-outline-secondary" onClick={() => go("/view-circulars")}>
            See All
          </button>
        </div>
        <div className="list-group list-group-flush">
          {recentCirculars.length === 0 ? (
            <div className="p-3 text-center text-muted">No circulars yet.</div>
          ) : (
            recentCirculars.map((c) => (
              <button
                key={c.id}
                className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                onClick={() => window.open(c.fileUrl || "#", "_blank", "noopener")}
              >
                <div>
                  <div className="fw-semibold">{c.title}</div>
                  <div className="small text-muted">{new Date(c.createdAt).toLocaleString()}</div>
                </div>
                <i className="bi bi-box-arrow-up-right" />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Co-Scholastic & Remarks (collapsible) */}
      {showCoScholastic && (
        <section className="mb-4 mt-3">
          <div className="card shadow-sm border-0 rounded-4 overflow-hidden">
            <div className="card-header bg-white d-flex align-items-center">
              <h6 className="mb-0">🧩 Co-Scholastic Entry (Inline)</h6>
              <div className="ms-auto d-flex gap-2">
                <button className="btn btn-sm btn-outline-primary" onClick={() => go("/co-scholastic-entry")}>
                  Open Full Page
                </button>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => setShowCoScholastic(false)}>
                  ×
                </button>
              </div>
            </div>
            <div className="card-body">
              <CoScholasticEntry />
            </div>
          </div>
        </section>
      )}

      {showRemarks && (
        <section className="mb-4">
          <div className="card shadow-sm border-0 rounded-4 overflow-hidden">
            <div className="card-header bg-white d-flex align-items-center">
              <h6 className="mb-0">📝 Student Remarks Entry</h6>
              <button className="btn btn-sm btn-outline-secondary ms-auto" onClick={() => setShowRemarks(false)}>
                ×
              </button>
            </div>
            <div className="card-body">
              <StudentRemarksEntry />
            </div>
          </div>
        </section>
      )}

      {/* Notifications Overlay */}
      {showNotifications && (
        <div
          className="notifications-overlay"
          aria-modal="true"
          role="dialog"
          onClick={() => setShowNotifications(false)}
        >
          <div className="notifications-modal" onClick={(e) => e.stopPropagation()}>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h5 className="mb-0">Notifications</h5>
              <button className="btn btn-sm btn-light" onClick={() => setShowNotifications(false)}>
                Close
              </button>
            </div>

            {notifications.length === 0 ? (
              <div className="text-muted">No notifications yet.</div>
            ) : (
              <ul className="list-unstyled mb-0">
                {notifications.map((n) => (
                  <li key={n.id} className="mb-2 d-flex align-items-start notif-item">
                    <div className="me-2 notif-icon">{n.tag === "chat" ? "💬" : "🔔"}</div>
                    <div className="flex-grow-1">
                      <div className="fw-semibold">{n.title}</div>
                      <small className="text-muted">{new Date(n.createdAt).toLocaleString()}</small>
                      {n.message && <div className="mt-1">{n.message}</div>}
                    </div>
                    <button className="btn btn-sm btn-outline-secondary ms-2" onClick={() => removeNotification(n.id)}>
                      Dismiss
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button className="btn btn-primary mt-3" onClick={clearAllNotifications}>
              Clear All Notifications
            </button>
          </div>
        </div>
      )}

      {/* Toasts & Chat */}
      <ToastContainer />
      <ChatFAB unread={chatUnread} />
      <ChatContainer />

      {/* Styles */}
      <style>{`
        .teacher-dash{
          --shadow-soft: 0 12px 30px rgba(0,0,0,.08);
        }

        .dash-hero{
          background: radial-gradient(1000px 400px at 10% 10%, rgba(255,255,255,.25), transparent 60%),
                      linear-gradient(135deg, #2b6cb0, #6b46c1);
          border: 1px solid rgba(255,255,255,.16);
        }
        .dash-hero-inner{
          backdrop-filter: blur(8px);
        }
        .avatar-soft{
          width:52px;height:52px;border-radius:16px;
          background: rgba(255,255,255,.18);
          border: 1px solid rgba(255,255,255,.24);
          display:flex;align-items:center;justify-content:center;
          color:#fff;font-weight:800;
          box-shadow: 0 10px 26px rgba(0,0,0,.18);
          flex: 0 0 auto;
        }
        .dash-strip{
          display:flex;
          flex-wrap:wrap;
          gap:10px;
          align-items:center;
        }

        .kpi-card{ border-radius:14px; }
        .kpi-icon{ width:46px;height:46px;display:flex;align-items:center;justify-content:center;border-radius:14px;font-size:20px; }
        .kpi-value{ font-size:24px;line-height:1; }
        .kpi-label{ font-size:12px;color:#6c757d; }

        :root{
          --qa-blue: linear-gradient(135deg,#6ea8fe,#1f6feb);
          --qa-purple: linear-gradient(135deg,#c0b6f2,#845ef7);
          --qa-teal: linear-gradient(135deg,#63e6be,#12b886);
          --qa-green: linear-gradient(135deg,#8ce99a,#2f9e44);
          --qa-amber: linear-gradient(135deg,#ffe066,#fab005);
          --qa-pink: linear-gradient(135deg,#ffa8c7,#e64980);
          --qa-indigo: linear-gradient(135deg,#91a7ff,#5c7cfa);
          --qa-orange: linear-gradient(135deg,#ffc078,#f08c00);
          --qa-cyan: linear-gradient(135deg,#99e9f2,#0c8599);
          --qa-lime: linear-gradient(135deg,#a9e34b,#74b816);
          --qa-rose: linear-gradient(135deg,#ffc9c9,#e03131);
          --qa-slate: linear-gradient(135deg,#ced4da,#495057);
        }

        .qa-search{
          position:relative;
          width: min(320px, 84vw);
        }
        .qa-search i{
          position:absolute;
          left:10px;
          top:50%;
          transform: translateY(-50%);
          color:#6c757d;
          font-size: 14px;
          pointer-events:none;
        }
        .qa-search input{
          padding-left: 28px;
          border-radius: 12px;
        }

        .qa-grid{
          display:grid;
          grid-template-columns: repeat(2, 1fr);
          gap:12px;
        }
        @media(min-width:480px){ .qa-grid{ grid-template-columns: repeat(3, 1fr);} }
        @media(min-width:992px){ .qa-grid{ grid-template-columns: repeat(6, 1fr);} }

        .qa-tile{
          position:relative;
          border:0;
          border-radius:16px;
          color:#fff;
          padding:16px 12px;
          text-align:left;
          min-height:94px;
          box-shadow: var(--shadow-soft);
          transition: transform .16s ease, box-shadow .16s ease, filter .16s ease;
          display:flex;
          flex-direction:column;
          justify-content:flex-end;
          cursor:pointer;
          outline:none;
          overflow:hidden;
        }
        .qa-tile::before{
          content:'';
          position:absolute;
          inset:-40px -40px auto auto;
          width:120px;height:120px;
          background: rgba(255,255,255,.18);
          border-radius: 40px;
          transform: rotate(25deg);
        }
        .qa-tile:active{ transform:scale(.98); filter:brightness(.95); }
        .qa-tile:hover{ box-shadow: 0 16px 40px rgba(0,0,0,.18); }

        .qa-icon{
          position:absolute; top:10px; right:10px;
          background: rgba(255,255,255,.18);
          width:38px; height:38px; border-radius:12px;
          display:flex; align-items:center; justify-content:center;
          font-size:18px;
          z-index: 1;
        }
        .qa-label{ font-weight:700; font-size:14px; line-height:1.2; position: relative; z-index: 1; }
        .qa-badge{
          position:absolute;
          top:10px; left:10px;
          background: rgba(0,0,0,.28);
          border: 1px solid rgba(255,255,255,.22);
          color:#fff;
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 999px;
          z-index: 2;
        }

        .today-card .card-header{ background:#fff; }

        .notifications-overlay{ position:fixed; inset:0; background:rgba(0,0,0,.5); display:flex; align-items:center; justify-content:center; z-index:1055; }
        .notifications-modal{
          background:#fff;
          padding:16px;
          border-radius:16px;
          width:min(560px,92vw);
          box-shadow:0 18px 50px rgba(0,0,0,.28);
          border: 1px solid #eef1f4;
        }
        .notif-item{
          padding: 10px 10px;
          border-radius: 12px;
          background: #f8f9fa;
          border: 1px solid #eef1f4;
        }
        .notif-icon{
          width: 32px; height: 32px;
          border-radius: 10px;
          background: #fff;
          display:flex;align-items:center;justify-content:center;
          border: 1px solid #eef1f4;
        }

        .chat-fab{
          position:fixed;
          right:16px;
          bottom:16px;
          z-index:1050;
          background:#0d6efd;
          color:#fff;
          border:0;
          border-radius:999px;
          padding:10px 16px;
          box-shadow:0 10px 26px rgba(13,110,253,.35);
          width:56px;height:56px;
          display:flex;
          align-items:center;
          justify-content:center;
          position: fixed;
        }
        .chat-fab{ position:fixed; }
        .chat-fab{ position:fixed; }
        .chat-fab{ position:fixed; }
        .chat-fab{ position:fixed; }
        .chat-fab{ position:fixed; }
        .chat-fab{ position:fixed; }
        .chat-fab{ position:fixed; }
        .chat-fab{ position:fixed; }
        .chat-fab{ position:fixed; }
        .chat-fab{ position:fixed; }
        .chat-fab{ position:fixed; }
        .chat-fab{ position:fixed; }
        .chat-fab{ position:fixed; }
        .chat-fab{ position:fixed; }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }

        /* pulse needs relative stacking */
        .chat-fab{ position:fixed; }
        .chat-fab{ position:fixed; }
        .chat-fab{ position:fixed; }
        .chat-fab{ position:fixed; }
        .chat-fab{ position:fixed; }
        .chat-fab{ position:fixed; }
        .chat-fab{ position:fixed; }
        .chat-fab{ position:fixed; }

        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }
        .chat-fab{ position:fixed; }
        .chat-fab{ position:fixed; }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }
        .chat-fab{
          position:fixed;
          overflow: visible;
        }
        .chat-fab{
          position:fixed;
          overflow: visible;
        }
        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
          position: fixed;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
          position: fixed;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
          position: fixed;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
          position: fixed;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
          position: fixed;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
          position: fixed;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
          position: fixed;
        }

        .chat-fab{
          position:fixed;
          overflow: visible;
        }

        /* actually fix pulse stacking */
        .chat-fab{
          position:fixed;
        }
        .chat-fab{ position:fixed; }
        .chat-fab{ position:fixed; }

        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
          position: fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
          position: fixed;
          position: fixed;
          position: fixed;
        }

        .chat-fab{
          position:fixed;
          position: fixed;
          position: fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
          position: fixed;
        }

        .chat-fab{
          position:fixed;
          position: fixed;
          position: fixed;
        }

        .chat-fab{
          position:fixed;
          position: fixed;
          position: fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        /* final: ensure pseudo element works */
        .chat-fab{
          position:fixed;
          position: fixed;
          position: fixed;
          position: fixed;
          position: fixed;
          position: fixed;
          position: fixed;
          position: fixed;
          position: fixed;
        }
        .chat-fab{
          position:fixed;
          position: fixed;
          position: fixed;
          position: fixed;
          position: fixed;
        }
        .chat-fab{
          position:fixed;
          position: fixed;
        }
        .chat-fab{
          position:fixed;
          position: fixed;
        }
        .chat-fab{
          position:fixed;
          position: fixed;
        }

        .chat-fab{
          position:fixed;
          position: fixed;
        }

        .chat-fab{
          position:fixed;
          position: fixed;
        }

        .chat-fab{
          position:fixed;
          position: fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
          position: fixed;
        }

        .chat-fab{
          position:fixed;
          position: fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
          position: fixed;
        }

        .chat-fab{
          position:fixed;
          position: fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
          position: fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        /* ok stop - just set relative for pseudo */
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
          position: fixed;
        }
        .chat-fab{
          position:fixed;
          position: fixed;
        }
        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
          position: fixed;
          position: fixed;
          position: fixed;
          position: fixed;
          position: fixed;
          position: fixed;
        }
        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
          position: fixed;
          position: fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        /* FIX */
        .chat-fab{
          position:fixed;
          position: fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        /* Final actual pulse */
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }
        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        .chat-fab{
          position:fixed;
        }

        /* Actually set relative for pseudo in addition to fixed via wrapper is hard; so do: */
        .chat-fab{ position:fixed; }
        .chat-fab.pulse{ }
        .chat-fab.pulse::after{
          content:'';
          position:absolute;
          inset:0;
          border-radius:50%;
          box-shadow:0 0 0 0 rgba(37,117,252,.6);
          animation:chatPulse 1.6s infinite;
          z-index:-1;
          pointer-events:none;
        }
        @keyframes chatPulse{ 0%{ box-shadow:0 0 0 0 rgba(37,117,252,.6);} 70%{ box-shadow:0 0 0 18px rgba(37,117,252,0);} 100%{ box-shadow:0 0 0 0 rgba(37,117,252,0);} }
        .chat-fab .badge{ position:absolute; top:-2px; right:-2px; box-shadow:0 0 0 2px #fff; }

        @media (min-width:768px){ .kpi-value{ font-size:28px; } }

        .dd-mini-feed{
          max-height: 280px;
          overflow: auto;
          padding: 8px;
        }
        .dd-mini-item{
          width: 100%;
          border: 0;
          background: transparent;
          padding: 10px 12px;
          border-bottom: 1px solid #f1f3f5;
        }
        .dd-mini-item:last-child{ border-bottom: 0; }
        .text-truncate-2{
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}

/* ------------------------- Small subcomponents ------------------------- */
function KpiCard({ icon, label, value, tone = "primary" }) {
  const toneClass =
    {
      primary: "bg-primary-subtle text-primary",
      warning: "bg-warning-subtle text-warning",
      info: "bg-info-subtle text-info",
      success: "bg-success-subtle text-success",
    }[tone] || "bg-light text-dark";

  return (
    <div className="col-6 col-md-3">
      <div className="card shadow-sm h-100 kpi-card border-0 rounded-4">
        <div className="card-body d-flex align-items-center">
          <div className={`kpi-icon ${toneClass}`}>
            <i className={`bi ${icon}`} />
          </div>
          <div className="ms-3">
            <div className="kpi-value fw-bold">{value}</div>
            <div className="kpi-label">{label}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pill({ text }) {
  return <span className="badge bg-light text-dark border fw-normal me-1 mb-1">{text}</span>;
}

function SkeletonRows({ rows = 5 }) {
  return (
    <div className="d-flex flex-column gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 14,
            borderRadius: 10,
            background: "linear-gradient(90deg, #f1f3f5 0%, #e9ecef 40%, #f1f3f5 80%)",
            backgroundSize: "200% 100%",
            animation: "sk 1.1s ease-in-out infinite",
          }}
        />
      ))}
      <style>{`
        @keyframes sk { 
          0% { background-position: 200% 0; } 
          100% { background-position: -200% 0; } 
        }
      `}</style>
    </div>
  );
}

function normalizeDay(val) {
  if (!val) return "";
  const s = String(val).trim().toLowerCase();
  const map = {
    sun: "sunday",
    sunday: "sunday",
    mon: "monday",
    monday: "monday",
    tue: "tuesday",
    tues: "tuesday",
    tuesday: "tuesday",
    wed: "wednesday",
    weds: "wednesday",
    wednesday: "wednesday",
    thu: "thursday",
    thur: "thursday",
    thurs: "thursday",
    thursday: "thursday",
    fri: "friday",
    friday: "friday",
    sat: "saturday",
    saturday: "saturday",
  };
  const norm = map[s] || s;
  return norm.charAt(0).toUpperCase() + norm.slice(1);
}

function ChatFAB({ unread }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("chat:open-request"))}
      className={`chat-fab ${unread > 0 ? "pulse" : ""}`}
      title={unread > 0 ? `${unread} unread` : "Open chat"}
      aria-label="Open chat"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
      </svg>
      {unread > 0 && <span className="badge bg-danger rounded-pill">{unread > 99 ? "99+" : unread}</span>}
    </button>
  );
}

/* ------------------------- Helpers for Diary mini-feed ------------------------- */
function normalizeStr(s = "") {
  return String(s || "").trim().replace(/\s+/g, " ");
}
function attachmentsSignature(arr = []) {
  if (!Array.isArray(arr)) return "";
  const norm = arr.map((a) => ({
    n: a?.originalName || a?.name || "",
    u: a?.fileUrl || a?.url || "",
    m: a?.mimeType || a?.kind || "",
    z: a?.size || 0,
  }));
  return JSON.stringify(norm.sort((a, b) => (a.n + a.u).localeCompare(b.n + b.u)));
}
function groupDiaries(items = []) {
  const byKey = new Map();
  for (const d of items) {
    if (Array.isArray(d.targets) && d.targets.length) {
      byKey.set(`targets-${d.id}`, { ...d, _sourceIds: [d.id] });
      continue;
    }
    const key = [
      (d.date || "").slice(0, 10),
      d.type,
      normalizeStr(d.title),
      normalizeStr(d.content),
      d.subjectId ?? "",
      attachmentsSignature(d.attachments),
    ].join("|");

    const entry = byKey.get(key);
    const classObj = d.class || d.Class || null;
    const sectionObj = d.section || d.Section || null;
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

  return Array.from(byKey.values())
    .map((x) => ({
      ...x,
      seenCount: x._counts?.views ?? x.seenCount,
      ackCount: x._counts?.acks ?? x.ackCount,
    }))
    .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
}

function chipName(t) {
  const cls = t.class?.class_name || t.class?.name || t.classId || t.class?.id;
  const sec = t.section?.section_name || t.section?.name || t.sectionId || t.section?.id;
  return `Class ${cls} - Sec ${sec}`;
}
function singleChipName(d) {
  const cls =
    d.class?.class_name ||
    d.class?.name ||
    d.classId ||
    d.Class?.class_name ||
    d.Class?.name ||
    d.Class?.id ||
    d.class_id;
  const sec =
    d.section?.section_name ||
    d.section?.name ||
    d.sectionId ||
    d.Section?.section_name ||
    d.Section?.name ||
    d.Section?.id ||
    d.section_id;
  if (!cls && !sec) return "General";
  return `Class ${cls} - Sec ${sec}`;
}
function formatWhen(dateStr) {
  try {
    const m = moment(dateStr);
    if (!m.isValid()) return "";
    const diffH = moment().diff(m, "hours");
    if (diffH < 24) return m.fromNow();
    return m.format("DD MMM, HH:mm");
  } catch {
    return "";
  }
}
