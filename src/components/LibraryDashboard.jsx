// File: src/components/LibraryDashboard.jsx
// ✅ Library Dashboard (Dummy Data Only)
// ✅ More functionality: KPIs, search, filters, tabs, quick actions, mini activity feed
// ✅ Role-safe (librarian/admin/superadmin can view; others see warning)
// ✅ React Router navigation (Link / useNavigate) so NO FULL PAGE RELOAD
// ✅ Uses Bootstrap classes (same style family as your FrontOfficeDashboard)

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";

/* ---------------- Roles helper ---------------- */
const getRoleFlags = () => {
  const singleRole = localStorage.getItem("userRole");
  const multiRoles = JSON.parse(localStorage.getItem("roles") || "[]");
  const roles = (multiRoles.length ? multiRoles : [singleRole].filter(Boolean)).map((r) =>
    String(r || "").toLowerCase()
  );

  return {
    roles,
    isAdmin: roles.includes("admin"),
    isSuperadmin: roles.includes("superadmin"),
    isLibrarian: roles.includes("librarian") || roles.includes("library") || roles.includes("libraryadmin"),
  };
};

/* ---------------- Small utils ---------------- */
const safe = (v, fb = "—") => (v === null || v === undefined || v === "" ? fb : String(v));

const fmtINR = (v) => {
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
};

const fmtDT = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-IN");
};

const fmtD = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-IN");
};

const initials = (name) => {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => (p[0] || "").toUpperCase()).join("") || "?";
};

const badgeForIssueStatus = (st) => {
  const s = String(st || "").toUpperCase();
  if (s === "ISSUED") return "bg-primary";
  if (s === "RETURNED") return "bg-success";
  if (s === "OVERDUE") return "bg-danger";
  if (s === "LOST") return "bg-dark";
  return "bg-secondary";
};

const badgeForRequestStatus = (st) => {
  const s = String(st || "").toUpperCase();
  if (s === "PENDING") return "bg-warning text-dark";
  if (s === "APPROVED") return "bg-success";
  if (s === "REJECTED") return "bg-danger";
  return "bg-secondary";
};

const daysBetween = (a, b) => {
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return 0;
  const diff = db.getTime() - da.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

const nowISO = () => new Date().toISOString();

/* ---------------- Dummy data generator ---------------- */
function makeDummyData() {
  const today = new Date();
  const addDays = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d.toISOString();
  };

  const books = [
    { id: 1, accession: "A-10231", title: "Oxford English Reader 5", author: "OUP", category: "English", copies: 12, available: 5, shelf: "E-2", tags: ["curriculum"] },
    { id: 2, accession: "A-11209", title: "Mathematics (Class 6)", author: "NCERT", category: "Math", copies: 18, available: 0, shelf: "M-1", tags: ["ncert"] },
    { id: 3, accession: "A-14001", title: "Science Explorer 7", author: "Pearson", category: "Science", copies: 10, available: 2, shelf: "S-3", tags: ["lab"] },
    { id: 4, accession: "A-15117", title: "Punjabi Vyakaran", author: "PSEB", category: "Punjabi", copies: 8, available: 1, shelf: "P-1", tags: ["regional"] },
    { id: 5, accession: "A-16044", title: "Computer Basics", author: "CBSE", category: "Computer", copies: 7, available: 7, shelf: "C-2", tags: ["it"] },
    { id: 6, accession: "A-17110", title: "Harry Potter (Vol 1)", author: "J.K. Rowling", category: "Fiction", copies: 6, available: 1, shelf: "F-7", tags: ["novel"] },
  ];

  const members = [
    { id: 1, type: "STUDENT", name: "Harpreet Singh", class: "6-A", admission: "GPS-2041", phone: "98765 12345", active: true },
    { id: 2, type: "STUDENT", name: "Simran Kaur", class: "7-B", admission: "GPS-2198", phone: "98111 22233", active: true },
    { id: 3, type: "STUDENT", name: "Armaan Sharma", class: "9-A", admission: "GPS-1750", phone: "99000 11122", active: true },
    { id: 4, type: "TEACHER", name: "Neha Verma", dept: "English", empCode: "EMP-031", phone: "98888 55566", active: true },
    { id: 5, type: "TEACHER", name: "Rohit Kumar", dept: "Science", empCode: "EMP-044", phone: "97777 66611", active: true },
  ];

  const issues = [
    {
      id: 9001,
      memberId: 1,
      memberName: "Harpreet Singh",
      memberMeta: "6-A · GPS-2041",
      bookId: 2,
      bookTitle: "Mathematics (Class 6)",
      accession: "A-11209",
      issuedAt: addDays(-2),
      dueAt: addDays(+5),
      returnedAt: null,
      status: "ISSUED",
      fine: 0,
      handledBy: "Librarian",
    },
    {
      id: 9002,
      memberId: 2,
      memberName: "Simran Kaur",
      memberMeta: "7-B · GPS-2198",
      bookId: 6,
      bookTitle: "Harry Potter (Vol 1)",
      accession: "A-17110",
      issuedAt: addDays(-12),
      dueAt: addDays(-2),
      returnedAt: null,
      status: "OVERDUE",
      fine: 40,
      handledBy: "FrontOffice",
    },
    {
      id: 9003,
      memberId: 4,
      memberName: "Neha Verma",
      memberMeta: "English · EMP-031",
      bookId: 1,
      bookTitle: "Oxford English Reader 5",
      accession: "A-10231",
      issuedAt: addDays(-7),
      dueAt: addDays(0),
      returnedAt: addDays(-1),
      status: "RETURNED",
      fine: 0,
      handledBy: "Librarian",
    },
    {
      id: 9004,
      memberId: 3,
      memberName: "Armaan Sharma",
      memberMeta: "9-A · GPS-1750",
      bookId: 3,
      bookTitle: "Science Explorer 7",
      accession: "A-14001",
      issuedAt: addDays(-20),
      dueAt: addDays(-10),
      returnedAt: null,
      status: "LOST",
      fine: 350,
      handledBy: "Admin",
    },
  ];

  const requests = [
    {
      id: 7001,
      memberName: "Harpreet Singh",
      memberMeta: "6-A · GPS-2041",
      bookTitle: "Computer Basics",
      requestedAt: addDays(-1),
      status: "PENDING",
      note: "Need for project",
    },
    {
      id: 7002,
      memberName: "Simran Kaur",
      memberMeta: "7-B · GPS-2198",
      bookTitle: "Punjabi Vyakaran",
      requestedAt: addDays(-3),
      status: "APPROVED",
      note: "Exam prep",
    },
    {
      id: 7003,
      memberName: "Rohit Kumar",
      memberMeta: "Science · EMP-044",
      bookTitle: "Science Explorer 7",
      requestedAt: addDays(-2),
      status: "REJECTED",
      note: "All copies reserved",
    },
  ];

  const inventoryAlerts = [
    { id: 1, type: "LOW_STOCK", bookTitle: "Punjabi Vyakaran", accession: "A-15117", available: 1, threshold: 2, severity: "warning" },
    { id: 2, type: "OUT_OF_STOCK", bookTitle: "Mathematics (Class 6)", accession: "A-11209", available: 0, threshold: 1, severity: "danger" },
    { id: 3, type: "DAMAGED", bookTitle: "Oxford English Reader 5", accession: "A-10231", available: 5, threshold: 2, severity: "info" },
  ];

  const activity = [
    { id: 1, at: addDays(0), icon: "bi-arrow-repeat", text: "Auto sync completed" },
    { id: 2, at: addDays(-1), icon: "bi-journal-check", text: "Book returned: Oxford English Reader 5" },
    { id: 3, at: addDays(-2), icon: "bi-person-plus", text: "New member added: Harpreet Singh" },
  ];

  return { books, members, issues, requests, inventoryAlerts, activity };
}

/* ---------------- Component ---------------- */
export default function LibraryDashboard() {
  const navigate = useNavigate();
  const { isAdmin, isSuperadmin, isLibrarian } = useMemo(getRoleFlags, []);
  const canUse = isLibrarian || isAdmin || isSuperadmin;

  // Dummy data (stateful so we can simulate actions)
  const [db, setDb] = useState(() => makeDummyData());

  // UI state
  const [activeTab, setActiveTab] = useState("issues"); // issues | overdue | requests | inventory
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const timersRef = useRef({});

  // Drawer-ish “quick action” modal (simple)
  const [actionToast, setActionToast] = useState({ show: false, text: "" });

  const POLLING_INTERVAL = 20000;

  // Simulate refresh (shuffle-ish)
  const refreshAll = useCallback(() => {
    setDb((prev) => {
      // tiny dummy mutation: add ₹10 fine to overdue items (just to show change)
      const issues = prev.issues.map((i) => {
        if (String(i.status).toUpperCase() === "OVERDUE") {
          return { ...i, fine: Number(i.fine || 0) + 10 };
        }
        return i;
      });
      return { ...prev, issues };
    });
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    Object.values(timersRef.current || {}).forEach(clearInterval);
    timersRef.current = {};
    if (!autoRefresh || !canUse) return;

    timersRef.current.main = setInterval(refreshAll, POLLING_INTERVAL);
    return () => Object.values(timersRef.current || {}).forEach(clearInterval);
  }, [autoRefresh, canUse, refreshAll]);

  /* ---------------- Derived data ---------------- */
  const categories = useMemo(() => {
    const set = new Set(db.books.map((b) => b.category).filter(Boolean));
    return ["ALL", ...Array.from(set).sort()];
  }, [db.books]);

  const issueStatusOptions = useMemo(() => ["ALL", "ISSUED", "OVERDUE", "RETURNED", "LOST"], []);
  const requestStatusOptions = useMemo(() => ["ALL", "PENDING", "APPROVED", "REJECTED"], []);

  const kpis = useMemo(() => {
    const totalBooks = db.books.reduce((s, b) => s + Number(b.copies || 0), 0);
    const availableBooks = db.books.reduce((s, b) => s + Number(b.available || 0), 0);

    const totalMembers = db.members.filter((m) => m.active).length;

    const issuedCount = db.issues.filter((i) => String(i.status).toUpperCase() === "ISSUED").length;
    const overdueCount = db.issues.filter((i) => String(i.status).toUpperCase() === "OVERDUE").length;
    const lostCount = db.issues.filter((i) => String(i.status).toUpperCase() === "LOST").length;

    const totalFine = db.issues.reduce((s, i) => s + Number(i.fine || 0), 0);
    const lowStock = db.inventoryAlerts.filter((a) => a.type === "LOW_STOCK" || a.type === "OUT_OF_STOCK").length;

    // Issued today (dummy logic)
    const issuedToday = db.issues.filter((i) => {
      const d = new Date(i.issuedAt);
      const t = new Date();
      return d.toDateString() === t.toDateString();
    }).length;

    return {
      totalBooks,
      availableBooks,
      totalMembers,
      issuedCount,
      overdueCount,
      lostCount,
      totalFine,
      lowStock,
      issuedToday,
    };
  }, [db]);

  const quickLinks = useMemo(
    () => [
      {
        label: "Books",
        icon: "bi-journals",
        href: "/library/books",
        gradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
      },
      {
        label: "Members",
        icon: "bi-people",
        href: "/library/members",
        gradient: "linear-gradient(135deg, #22c55e, #16a34a)",
      },
      {
        label: "Issue / Return",
        icon: "bi-arrow-left-right",
        href: "/library/issue-return",
        gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
      },
      {
        label: "Requests",
        icon: "bi-inbox",
        href: "/library/requests",
        gradient: "linear-gradient(135deg, #a855f7, #7c3aed)",
      },
      {
        label: "Reports",
        icon: "bi-bar-chart",
        href: "/library/reports",
        gradient: "linear-gradient(135deg, #0ea5e9, #0369a1)",
      },
      {
        label: "Settings",
        icon: "bi-gear",
        href: "/library/settings",
        gradient: "linear-gradient(135deg, #64748b, #475569)",
      },
    ],
    []
  );

  const filteredIssues = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    return db.issues
      .map((i) => {
        const dueDays = daysBetween(i.dueAt, nowISO()); // positive => overdue days
        return {
          ...i,
          dueDays,
        };
      })
      .filter((i) => {
        if (filterStatus !== "ALL" && String(i.status).toUpperCase() !== String(filterStatus).toUpperCase()) return false;

        if (filterCategory !== "ALL") {
          const book = db.books.find((b) => b.id === i.bookId);
          if (!book || String(book.category) !== String(filterCategory)) return false;
        }

        if (!q) return true;
        const hay = [
          i.memberName,
          i.memberMeta,
          i.bookTitle,
          i.accession,
          i.status,
          String(i.id),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
  }, [db.issues, db.books, search, filterCategory, filterStatus]);

  const overdueOnly = useMemo(
    () => filteredIssues.filter((i) => String(i.status).toUpperCase() === "OVERDUE").sort((a, b) => (b.dueDays || 0) - (a.dueDays || 0)),
    [filteredIssues]
  );

  const filteredRequests = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    return db.requests
      .filter((r) => {
        if (filterStatus !== "ALL" && String(r.status).toUpperCase() !== String(filterStatus).toUpperCase()) return false;
        if (!q) return true;
        const hay = [r.memberName, r.memberMeta, r.bookTitle, r.status, r.note, String(r.id)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  }, [db.requests, search, filterStatus]);

  const filteredInventoryAlerts = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    return db.inventoryAlerts
      .filter((a) => {
        if (filterCategory !== "ALL") {
          const book = db.books.find((b) => String(b.title) === String(a.bookTitle));
          if (!book || String(book.category) !== String(filterCategory)) return false;
        }
        if (!q) return true;
        const hay = [a.bookTitle, a.accession, a.type, String(a.available)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const rank = (x) => (x.severity === "danger" ? 3 : x.severity === "warning" ? 2 : 1);
        return rank(b) - rank(a);
      });
  }, [db.inventoryAlerts, db.books, search, filterCategory]);

  /* ---------------- Dummy actions ---------------- */
  const toast = (text) => {
    setActionToast({ show: true, text });
    setTimeout(() => setActionToast({ show: false, text: "" }), 2200);
  };

  const markReturned = (issueId) => {
    setDb((prev) => {
      const issues = prev.issues.map((i) => {
        if (i.id !== issueId) return i;
        if (String(i.status).toUpperCase() === "RETURNED") return i;
        return { ...i, status: "RETURNED", returnedAt: new Date().toISOString(), fine: 0 };
      });
      return { ...prev, issues };
    });
    toast(`Marked as RETURNED (Issue #${issueId})`);
    setLastUpdated(new Date());
  };

  const approveRequest = (reqId) => {
    setDb((prev) => {
      const requests = prev.requests.map((r) => (r.id === reqId ? { ...r, status: "APPROVED" } : r));
      return { ...prev, requests };
    });
    toast(`Approved request #${reqId}`);
    setLastUpdated(new Date());
  };

  const rejectRequest = (reqId) => {
    setDb((prev) => {
      const requests = prev.requests.map((r) => (r.id === reqId ? { ...r, status: "REJECTED" } : r));
      return { ...prev, requests };
    });
    toast(`Rejected request #${reqId}`);
    setLastUpdated(new Date());
  };

  const sendOverdueReminder = (issueId) => {
    toast(`Reminder sent (dummy) for Issue #${issueId}`);
  };

  /* ---------------- Access guard ---------------- */
  if (!canUse) {
    return (
      <div className="container mt-4">
        <h1 className="h3 mb-2">Library Dashboard</h1>
        <div className="alert alert-warning">You don’t have access to Library dashboard.</div>
      </div>
    );
  }

  /* ---------------- Render ---------------- */
  const statusOptionsForTab =
    activeTab === "requests" ? requestStatusOptions : issueStatusOptions;

  return (
    <div
      className="lib-bg"
      style={{
        backgroundImage:
          "linear-gradient(135deg, rgba(59,130,246,.10), rgba(168,85,247,.08), rgba(34,197,94,.10), rgba(245,158,11,.08))",
        minHeight: "100vh",
      }}
    >
      <div className="container-fluid px-4 py-3">
        {/* Header */}
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3 rounded-4 p-3 shadow-sm bg-white">
          <div>
            <h4 className="mb-1 fw-semibold">Library Dashboard</h4>
            <div className="text-muted small">
              Books · Members · Issue/Return · Requests · Reports{" · "}
              {lastUpdated ? `Last updated: ${lastUpdated.toLocaleString("en-IN")}` : "—"}
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2 align-items-center">
            <div className="input-group input-group-sm" style={{ width: 320 }}>
              <span className="input-group-text bg-white">
                <i className="bi bi-search" />
              </span>
              <input
                className="form-control"
                placeholder="Search issues / members / books…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search ? (
                <button className="btn btn-outline-secondary" onClick={() => setSearch("")} title="Clear">
                  <i className="bi bi-x-lg" />
                </button>
              ) : null}
            </div>

            <button
              className={`btn btn-sm btn-outline-${autoRefresh ? "secondary" : "success"} shadow-sm`}
              onClick={() => setAutoRefresh((v) => !v)}
            >
              {autoRefresh ? "Pause Auto-Refresh" : "Resume Auto-Refresh"}
            </button>

            <button className="btn btn-sm btn-primary shadow-sm" onClick={refreshAll}>
              <i className="bi bi-arrow-clockwise me-1" /> Refresh
            </button>
          </div>
        </div>

        {/* Quick Links */}
        <div className="row g-3 mb-4">
          {quickLinks.map((q) => (
            <div key={q.label} className="col-12 col-sm-6 col-lg-4 col-xxl-2">
              <Link
                to={q.href}
                className="btn w-100 text-white shadow-sm rounded-4 p-3 d-flex align-items-center gap-3 lib-link"
                style={{ backgroundImage: q.gradient, textDecoration: "none" }}
              >
                <span
                  className="d-inline-grid place-items-center rounded-circle"
                  style={{
                    width: 44,
                    height: 44,
                    background: "rgba(255,255,255,0.22)",
                    border: "1px solid rgba(255,255,255,0.25)",
                  }}
                >
                  <i className={`bi ${q.icon} fs-4`} />
                </span>
                <div className="text-start">
                  <div className="fw-semibold">{q.label}</div>
                  <div className="small opacity-75">Open</div>
                </div>
                <div className="ms-auto">
                  <i className="bi bi-arrow-right fs-5 opacity-75" />
                </div>
              </Link>
            </div>
          ))}
        </div>

        {/* KPI Tiles */}
        <div className="row g-3 mb-4">
          {[
            { title: "Total Books", value: kpis.totalBooks, variant: "primary", hint: "All copies" },
            { title: "Available Now", value: kpis.availableBooks, variant: "success", hint: "Ready to issue" },
            { title: "Members", value: kpis.totalMembers, variant: "secondary", hint: "Active" },
            { title: "Issued", value: kpis.issuedCount, variant: "info", hint: "Currently issued" },
            { title: "Overdue", value: kpis.overdueCount, variant: "danger", hint: "Needs follow-up", onClick: () => setActiveTab("overdue") },
            { title: "Lost", value: kpis.lostCount, variant: "dark", hint: "Marked lost" },
            { title: "Fine Total", value: fmtINR(kpis.totalFine), variant: "warning", hint: "Dummy fines" },
            { title: "Inventory Alerts", value: kpis.lowStock, variant: "secondary", hint: "Low/Out stock", onClick: () => setActiveTab("inventory") },
          ].map((k, idx) => (
            <div key={idx} className="col-12 col-sm-6 col-lg-3">
              <div
                className={`card border-0 shadow-sm rounded-4 h-100 bg-${k.variant} bg-opacity-10`}
                style={{ cursor: k.onClick ? "pointer" : "default" }}
                onClick={k.onClick}
                title={k.onClick ? "Open related tab" : undefined}
              >
                <div className="card-body">
                  <div className="text-uppercase small text-muted mb-1">{k.title}</div>
                  <div className="display-6 fw-semibold">{k.value}</div>
                  <div className="small text-muted">{k.hint || "—"}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Controls row */}
        <div className="row g-3 mb-3">
          <div className="col-12 col-xl-9">
            <div className="card shadow-sm rounded-4">
              <div className="card-body d-flex flex-wrap gap-2 align-items-center justify-content-between">
                <div className="d-flex flex-wrap gap-2 align-items-center">
                  <div className="btn-group" role="group" aria-label="Tabs">
                    <button
                      className={`btn btn-sm ${activeTab === "issues" ? "btn-primary" : "btn-outline-primary"}`}
                      onClick={() => setActiveTab("issues")}
                    >
                      <i className="bi bi-journal-text me-1" /> Issues
                    </button>
                    <button
                      className={`btn btn-sm ${activeTab === "overdue" ? "btn-danger" : "btn-outline-danger"}`}
                      onClick={() => setActiveTab("overdue")}
                    >
                      <i className="bi bi-exclamation-triangle me-1" /> Overdue
                    </button>
                    <button
                      className={`btn btn-sm ${activeTab === "requests" ? "btn-warning" : "btn-outline-warning"}`}
                      onClick={() => setActiveTab("requests")}
                    >
                      <i className="bi bi-inbox me-1" /> Requests
                    </button>
                    <button
                      className={`btn btn-sm ${activeTab === "inventory" ? "btn-secondary" : "btn-outline-secondary"}`}
                      onClick={() => setActiveTab("inventory")}
                    >
                      <i className="bi bi-box-seam me-1" /> Inventory
                    </button>
                  </div>

                  <div className="vr d-none d-md-block" />

                  <div className="d-flex gap-2 flex-wrap">
                    <select
                      className="form-select form-select-sm"
                      style={{ width: 180 }}
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      title="Category filter"
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c === "ALL" ? "All Categories" : c}
                        </option>
                      ))}
                    </select>

                    <select
                      className="form-select form-select-sm"
                      style={{ width: 160 }}
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      title="Status filter"
                    >
                      {statusOptionsForTab.map((s) => (
                        <option key={s} value={s}>
                          {s === "ALL" ? "All Status" : s}
                        </option>
                      ))}
                    </select>

                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => {
                        setFilterCategory("ALL");
                        setFilterStatus("ALL");
                        setSearch("");
                        toast("Filters cleared");
                      }}
                    >
                      <i className="bi bi-eraser me-1" />
                      Clear
                    </button>
                  </div>
                </div>

                <div className="d-flex gap-2 flex-wrap">
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => {
                      toast("Open Issue/Return (dummy)");
                      navigate("/library/issue-return");
                    }}
                  >
                    <i className="bi bi-arrow-left-right me-1" />
                    Issue/Return
                  </button>

                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => {
                      setActiveTab("overdue");
                      toast("Showing overdue list");
                    }}
                  >
                    <i className="bi bi-bell me-1" />
                    Reminders
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Activity feed */}
          <div className="col-12 col-xl-3">
            <div className="card shadow-sm rounded-4 h-100">
              <div className="card-header bg-white border-0 fw-semibold">Activity</div>
              <div className="card-body">
                {db.activity.map((a) => (
                  <div key={a.id} className="d-flex gap-2 mb-3">
                    <div
                      className="rounded-circle d-inline-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: 36, height: 36, background: "rgba(59,130,246,.12)" }}
                    >
                      <i className={`bi ${a.icon}`} />
                    </div>
                    <div className="flex-grow-1">
                      <div className="small fw-semibold">{a.text}</div>
                      <div className="small text-muted">{fmtDT(a.at)}</div>
                    </div>
                  </div>
                ))}
                <button
                  className="btn btn-sm btn-outline-secondary w-100"
                  onClick={() => toast("Activity refreshed (dummy)")}
                >
                  <i className="bi bi-arrow-clockwise me-1" />
                  Refresh Activity
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main table card */}
        <div className="row g-4">
          <div className="col-12">
            <div className="card shadow-sm rounded-4">
              <div className="card-header bg-white border-0 d-flex flex-wrap justify-content-between align-items-center gap-2">
                <div className="fw-semibold">
                  {activeTab === "issues" && "Recent Issues"}
                  {activeTab === "overdue" && "Overdue Items"}
                  {activeTab === "requests" && "Book Requests"}
                  {activeTab === "inventory" && "Inventory Alerts"}
                </div>
                <div className="d-flex gap-2 flex-wrap">
                  {activeTab !== "requests" ? (
                    <button
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => {
                        toast("Export CSV (dummy)");
                      }}
                    >
                      <i className="bi bi-filetype-csv me-1" />
                      Export
                    </button>
                  ) : null}
                  <button className="btn btn-sm btn-outline-secondary" onClick={refreshAll}>
                    <i className="bi bi-arrow-clockwise me-1" />
                    Refresh
                  </button>
                </div>
              </div>

              <div className="table-responsive">
                {/* ISSUES / OVERDUE */}
                {(activeTab === "issues" || activeTab === "overdue") && (
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: 70 }}>#</th>
                        <th>Member</th>
                        <th>Book</th>
                        <th style={{ width: 140 }}>Issued</th>
                        <th style={{ width: 140 }}>Due</th>
                        <th style={{ width: 110 }}>Status</th>
                        <th style={{ width: 110 }} className="text-end">
                          Fine
                        </th>
                        <th style={{ width: 260 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activeTab === "overdue" ? overdueOnly : filteredIssues).slice(0, 25).map((i, idx) => {
                        const isOverdue = String(i.status).toUpperCase() === "OVERDUE";
                        const isReturned = String(i.status).toUpperCase() === "RETURNED";
                        const isLost = String(i.status).toUpperCase() === "LOST";

                        return (
                          <tr key={i.id}>
                            <td className="text-muted">{idx + 1}</td>
                            <td>
                              <div className="d-flex gap-2 align-items-center">
                                <div
                                  className="rounded-circle d-inline-flex align-items-center justify-content-center flex-shrink-0"
                                  style={{
                                    width: 38,
                                    height: 38,
                                    background: "#eef2ff",
                                    color: "#3730a3",
                                    fontWeight: 700,
                                  }}
                                  title={i.memberName}
                                >
                                  {initials(i.memberName)}
                                </div>
                                <div>
                                  <div className="fw-semibold">{safe(i.memberName)}</div>
                                  <div className="small text-muted">{safe(i.memberMeta)}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ maxWidth: 420 }} className="text-truncate" title={`${i.bookTitle} (${i.accession})`}>
                              <div className="fw-semibold">{safe(i.bookTitle)}</div>
                              <div className="small text-muted">
                                Accession: {safe(i.accession)} · Handled by: {safe(i.handledBy)}
                              </div>
                            </td>
                            <td className="text-muted">{fmtD(i.issuedAt)}</td>
                            <td className="text-muted">
                              {fmtD(i.dueAt)}
                              {isOverdue ? (
                                <span className="badge text-bg-danger ms-2">{Math.max(1, i.dueDays || 1)}d late</span>
                              ) : null}
                            </td>
                            <td>
                              <span className={`badge ${badgeForIssueStatus(i.status)}`}>{safe(i.status)}</span>
                            </td>
                            <td className="text-end fw-semibold">{fmtINR(i.fine || 0)}</td>
                            <td>
                              <div className="d-flex gap-2 flex-wrap">
                                <button
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => toast(`Open Issue #${i.id} (dummy)`)}
                                >
                                  <i className="bi bi-eye me-1" />
                                  View
                                </button>

                                <button
                                  className="btn btn-sm btn-outline-success"
                                  disabled={isReturned || isLost}
                                  onClick={() => markReturned(i.id)}
                                  title={isLost ? "Lost cannot be returned" : "Mark returned"}
                                >
                                  <i className="bi bi-check2-circle me-1" />
                                  Return
                                </button>

                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  disabled={!isOverdue}
                                  onClick={() => sendOverdueReminder(i.id)}
                                  title="Send reminder (dummy)"
                                >
                                  <i className="bi bi-bell me-1" />
                                  Remind
                                </button>

                                <button
                                  className="btn btn-sm btn-outline-secondary"
                                  onClick={() => toast("Print slip (dummy)")}
                                >
                                  <i className="bi bi-printer me-1" />
                                  Slip
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {(activeTab === "overdue" ? overdueOnly : filteredIssues).length === 0 && (
                        <tr>
                          <td colSpan={8} className="text-center py-4 text-muted">
                            No records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {/* REQUESTS */}
                {activeTab === "requests" && (
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: 70 }}>#</th>
                        <th>Member</th>
                        <th>Book</th>
                        <th style={{ width: 160 }}>Requested</th>
                        <th style={{ width: 120 }}>Status</th>
                        <th style={{ width: 280 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequests.slice(0, 25).map((r, idx) => (
                        <tr key={r.id}>
                          <td className="text-muted">{idx + 1}</td>
                          <td>
                            <div className="fw-semibold">{safe(r.memberName)}</div>
                            <div className="small text-muted">{safe(r.memberMeta)}</div>
                          </td>
                          <td style={{ maxWidth: 520 }} className="text-truncate" title={safe(r.bookTitle, "")}>
                            <div className="fw-semibold">{safe(r.bookTitle)}</div>
                            {r.note ? <div className="small text-muted">Note: {r.note}</div> : null}
                          </td>
                          <td className="text-muted">{fmtDT(r.requestedAt)}</td>
                          <td>
                            <span className={`badge ${badgeForRequestStatus(r.status)}`}>{safe(r.status)}</span>
                          </td>
                          <td>
                            <div className="d-flex gap-2 flex-wrap">
                              <button className="btn btn-sm btn-outline-primary" onClick={() => toast(`Open request #${r.id} (dummy)`)}>
                                <i className="bi bi-eye me-1" />
                                View
                              </button>

                              <button
                                className="btn btn-sm btn-outline-success"
                                disabled={String(r.status).toUpperCase() !== "PENDING"}
                                onClick={() => approveRequest(r.id)}
                              >
                                <i className="bi bi-check2 me-1" />
                                Approve
                              </button>

                              <button
                                className="btn btn-sm btn-outline-danger"
                                disabled={String(r.status).toUpperCase() !== "PENDING"}
                                onClick={() => rejectRequest(r.id)}
                              >
                                <i className="bi bi-x-lg me-1" />
                                Reject
                              </button>

                              <button className="btn btn-sm btn-outline-secondary" onClick={() => toast("Notify (dummy)")}>
                                <i className="bi bi-send me-1" />
                                Notify
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {filteredRequests.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-4 text-muted">
                            No requests found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {/* INVENTORY */}
                {activeTab === "inventory" && (
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: 70 }}>#</th>
                        <th>Alert</th>
                        <th>Book</th>
                        <th style={{ width: 140 }} className="text-end">
                          Available
                        </th>
                        <th style={{ width: 140 }} className="text-end">
                          Threshold
                        </th>
                        <th style={{ width: 260 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInventoryAlerts.slice(0, 25).map((a, idx) => (
                        <tr key={a.id}>
                          <td className="text-muted">{idx + 1}</td>
                          <td>
                            <span
                              className={`badge ${
                                a.severity === "danger"
                                  ? "text-bg-danger"
                                  : a.severity === "warning"
                                  ? "text-bg-warning"
                                  : "text-bg-info"
                              }`}
                            >
                              {a.type.replaceAll("_", " ")}
                            </span>
                          </td>
                          <td style={{ maxWidth: 520 }} className="text-truncate" title={`${a.bookTitle} (${a.accession})`}>
                            <div className="fw-semibold">{safe(a.bookTitle)}</div>
                            <div className="small text-muted">Accession: {safe(a.accession)}</div>
                          </td>
                          <td className="text-end fw-semibold">{safe(a.available, "0")}</td>
                          <td className="text-end text-muted">{safe(a.threshold, "—")}</td>
                          <td>
                            <div className="d-flex gap-2 flex-wrap">
                              <button className="btn btn-sm btn-outline-primary" onClick={() => toast("Open book (dummy)")}>
                                <i className="bi bi-journal-text me-1" />
                                Open
                              </button>
                              <button className="btn btn-sm btn-outline-success" onClick={() => toast("Create PO (dummy)")}>
                                <i className="bi bi-bag-plus me-1" />
                                Reorder
                              </button>
                              <button className="btn btn-sm btn-outline-secondary" onClick={() => toast("Mark resolved (dummy)")}>
                                <i className="bi bi-check2-circle me-1" />
                                Resolve
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {filteredInventoryAlerts.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-4 text-muted">
                            No alerts found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="card-footer bg-white border-0 small text-muted d-flex flex-wrap justify-content-between gap-2">
                <div>
                  Showing{" "}
                  <span className="fw-semibold">
                    {activeTab === "requests"
                      ? filteredRequests.length
                      : activeTab === "inventory"
                      ? filteredInventoryAlerts.length
                      : activeTab === "overdue"
                      ? overdueOnly.length
                      : filteredIssues.length}
                  </span>{" "}
                  records (dummy).
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => toast("Pagination (dummy)")}>
                    Prev
                  </button>
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => toast("Pagination (dummy)")}>
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Toast (simple) */}
        {actionToast.show ? (
          <div
            className="position-fixed bottom-0 end-0 p-3"
            style={{ zIndex: 9999, width: 360 }}
          >
            <div className="toast show shadow-sm rounded-4 border-0">
              <div className="toast-body d-flex align-items-start gap-2">
                <i className="bi bi-check2-circle text-success fs-5" />
                <div className="flex-grow-1">
                  <div className="fw-semibold">Done</div>
                  <div className="small text-muted">{actionToast.text}</div>
                </div>
                <button className="btn btn-sm btn-light border" onClick={() => setActionToast({ show: false, text: "" })}>
                  <i className="bi bi-x-lg" />
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Styles */}
        <style>{`
          .lib-link { transition: transform .2s ease, box-shadow .2s ease; }
          .lib-link:hover { transform: translateY(-2px); box-shadow: 0 10px 22px rgba(0,0,0,.12); }
          .card { animation: fadeInUp .45s ease-out; }
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px);} to { opacity: 1; transform: translateY(0);} }
          .toast { background: white; }
        `}</style>

        {/* Bootstrap Icons */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css"
        />
      </div>
    </div>
  );
}
