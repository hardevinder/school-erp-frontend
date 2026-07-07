import React, { useEffect, useMemo, useState, useRef } from "react";
import api from "../api";
import socket from "../socket";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/**
 * StudentCirculars
 * - Mobile: beautiful card list
 * - Desktop: elegant table
 * - Search + quick filters + attachment chip
 * - Real-time updates via socket
 * - Click to open full circular (modal with preview & download)
 */
const StudentCirculars = () => {
  const [circulars, setCirculars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("auto"); // 'auto' | 'table' | 'cards'
  const [query, setQuery] = useState("");
  const [onlyWithFiles, setOnlyWithFiles] = useState(false);
  const [sinceDays, setSinceDays] = useState("30"); // quick range

  // ---- Full view state ----
  const [selected, setSelected] = useState(null); // the circular object
  const [showModal, setShowModal] = useState(false);
  const lastFocusedRef = useRef(null);
  const modalRef = useRef(null);

  // ---- Fetch initial list ----
  const fetchCirculars = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/circulars");
      const filtered = (data?.circulars || [])
        .filter((c) => c.audience === "student" || c.audience === "both")
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setCirculars(filtered);
    } catch (err) {
      console.error("Error loading circulars:", err);
      toast.error("Couldn't load circulars. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCirculars();

    // ---- Real-time updates ----
    socket.on("newCircular", ({ circular }) => {
      if (circular.audience === "student" || circular.audience === "both") {
        toast.info(`New Circular: ${circular.title}`);
        setCirculars((prev) =>
          [circular, ...prev].sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
          )
        );
      }
    });

    socket.on("circularUpdated", ({ circular }) => {
      if (circular.audience === "student" || circular.audience === "both") {
        toast.info(`Circular Updated: ${circular.title}`);
        setCirculars((prev) =>
          prev
            .map((c) => (c.id === circular.id ? circular : c))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        );
      }
    });

    socket.on("circularDeleted", ({ id }) => {
      toast.info("Circular Removed");
      setCirculars((prev) => prev.filter((c) => c.id !== id));
    });

    return () => {
      socket.off("newCircular");
      socket.off("circularUpdated");
      socket.off("circularDeleted");
    };
  }, []);

  // ---- Helpers ----
  const formatDT = (iso) =>
    new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });

  const daysAgoToDate = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - Number(days));
    return d;
  };

  const openCircular = (c, e) => {
    if (e?.currentTarget) lastFocusedRef.current = e.currentTarget;
    setSelected(c);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelected(null);
    if (lastFocusedRef.current && typeof lastFocusedRef.current.focus === "function") {
      lastFocusedRef.current.focus();
    }
  };

  // Disable background scroll when modal open, handle Esc, basic focus trap
  useEffect(() => {
    if (!showModal) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e) => {
      if (e.key === "Escape") closeModal();
      if (e.key === "Tab" && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll(
          'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    setTimeout(() => {
      if (modalRef.current) modalRef.current.focus();
    }, 0);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showModal]);

  // ---- Derived (search / filters) ----
  const processed = useMemo(() => {
    const lowerQ = query.trim().toLowerCase();
    const sinceDate =
      sinceDays === "all" ? null : daysAgoToDate(Number(sinceDays));

    return circulars.filter((c) => {
      if (onlyWithFiles && !c.fileUrl) return false;
      if (sinceDate && new Date(c.createdAt) < sinceDate) return false;

      if (!lowerQ) return true;
      const hay =
        `${c.title ?? ""} ${c.description ?? ""} ${c.audience ?? ""}`.toLowerCase();
      return hay.includes(lowerQ);
    });
  }, [circulars, query, onlyWithFiles, sinceDays]);

  // ---- View mode resolution ----
  const prefersCards =
    viewMode === "cards" ||
    (viewMode === "auto" && typeof window !== "undefined" && window.innerWidth < 768);
  const showCards = prefersCards;
  const showTable = !prefersCards;

  // ---- Empty UI ----
  const EmptyState = () => (
    <div className="empty-state text-center py-5">
      <div className="emoji">📭</div>
      <h5 className="fw-semibold mb-2">No circulars found</h5>
      <p className="text-muted mb-0">Try changing filters or check back later.</p>
    </div>
  );

  // ---- Card ----
  const CircularCard = ({ c, index }) => (
    <button
      className="card circular-card shadow-sm animate-in text-start w-100"
      onClick={(e) => openCircular(c, e)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openCircular(c, e);
        }
      }}
      aria-label={`Open circular: ${c.title || "Untitled"}`}
    >
      <div className="card-body">
        <div className="d-flex align-items-start justify-content-between gap-3">
          <div className="flex-grow-1">
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="index-badge">{index + 1}</span>
              <h6 className="card-title mb-0 text-truncate">{c.title || "Untitled"}</h6>
            </div>
            <p className="card-text mt-2 mb-2 text-secondary small clamp-3">
              {c.description || <em className="text-muted">No description</em>}
            </p>

            <div className="d-flex flex-wrap gap-2 align-items-center">
              <span className="badge audience">
                {c.audience === "both" ? "All Students" : "Students"}
              </span>
              <span className="dot" />
              <span className="text-muted small">{formatDT(c.createdAt)}</span>
            </div>
          </div>

          <div className="text-nowrap">
            {c.fileUrl ? (
              <span className="badge rounded-pill bg-light text-primary fw-semibold">
                Attachment
              </span>
            ) : (
              <span className="badge rounded-pill bg-light text-muted">No file</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );

  // ---- Attachment preview helper (now null-safe) ----
  const getFileKind = (url) => {
    if (!url || typeof url !== "string") return "other";
    const clean = url.split("?")[0].split("#")[0];
    const dot = clean.lastIndexOf(".");
    if (dot === -1) return "other";
    const ext = clean.slice(dot + 1).toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext)) return "image";
    if (ext === "pdf") return "pdf";
    return "other";
  };

  // ---- Full view modal ----
  const FullCircularModal = () => {
    if (!selected) return null;
    const hasFile = !!(selected.fileUrl && typeof selected.fileUrl === "string");
    const kind = hasFile ? getFileKind(selected.fileUrl) : null;

    return (
      <div
        className={`modal-backdrop-custom ${showModal ? "show" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="circularModalTitle"
        onMouseDown={(e) => {
          if (e.target.classList.contains("modal-backdrop-custom")) closeModal();
        }}
      >
        <div className="modal-panel" ref={modalRef} tabIndex={-1}>
          <div className="modal-header">
            <h5 id="circularModalTitle" className="modal-title">
              {selected.title || "Untitled"}
            </h5>
            <button
              className="btn btn-light btn-close-x"
              onClick={closeModal}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="modal-body">
            <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
              <span className="badge audience">
                {selected.audience === "both" ? "All Students" : "Students"}
              </span>
              <span className="dot" />
              <span className="text-muted small">{formatDT(selected.createdAt)}</span>
            </div>

            <div className="modal-description">
              {selected.description ? (
                <p className="mb-3">{selected.description}</p>
              ) : (
                <p className="text-muted fst-italic">No description provided.</p>
              )}
            </div>

            {hasFile && (
              <div className="attachment-block">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <strong>Attachment</strong>
                  <div className="d-flex gap-2">
                    <a
                      className="btn btn-sm btn-primary-soft"
                      href={selected.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open
                    </a>
                    <a className="btn btn-sm btn-outline-primary" href={selected.fileUrl} download>
                      Download
                    </a>
                  </div>
                </div>

                <div className="attachment-preview">
                  {kind === "image" && (
                    <img
                      src={selected.fileUrl}
                      alt={`Attachment for ${selected.title || "circular"}`}
                      className="img-fluid rounded-3"
                    />
                  )}
                  {kind === "pdf" && (
                    <iframe
                      title="PDF preview"
                      src={`${selected.fileUrl}#view=FitH`}
                      className="pdf-frame"
                    />
                  )}
                  {kind === "other" && (
                    <div className="p-3 border rounded-3 bg-light text-muted">
                      Preview not available. Use the buttons above to open or download.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={closeModal}>
              Close
            </button>
            {hasFile && (
              <a
                className="btn btn-primary"
                href={selected.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Attachment
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Accent Header */}
      <div className="page-hero">
        <div className="container">
          <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
            <div>
              <h2 className="hero-title mb-1">Student Circulars</h2>
              <p className="hero-subtitle mb-0">
                Stay updated with the latest notices & announcements.
              </p>
            </div>
            <div className="d-flex gap-2 align-items-center">
              <div className="btn-group" role="group" aria-label="View mode">
                <button
                  className={`btn btn-view ${viewMode === "auto" ? "active" : ""}`}
                  onClick={() => setViewMode("auto")}
                  title="Auto (Cards on mobile, Table on desktop)"
                >
                  Auto
                </button>
                <button
                  className={`btn btn-view ${viewMode === "cards" ? "active" : ""}`}
                  onClick={() => setViewMode("cards")}
                  title="Cards"
                >
                  Cards
                </button>
                <button
                  className={`btn btn-view ${viewMode === "table" ? "active" : ""}`}
                  onClick={() => setViewMode("table")}
                  title="Table"
                >
                  Table
                </button>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="card filters shadow-sm mt-4">
            <div className="card-body">
              <div className="row g-3 align-items-center">
                <div className="col-12 col-md-6">
                  <input
                    type="search"
                    className="form-control form-control-lg"
                    placeholder="Search title or description…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="col-6 col-md-3">
                  <select
                    className="form-select form-select-lg"
                    value={sinceDays}
                    onChange={(e) => setSinceDays(e.target.value)}
                  >
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="all">All time</option>
                  </select>
                </div>
                <div className="col-6 col-md-3 d-flex align-items-center">
                  <input
                    id="withFiles"
                    type="checkbox"
                    className="form-check-input me-2"
                    checked={onlyWithFiles}
                    onChange={(e) => setOnlyWithFiles(e.target.checked)}
                  />
                  <label htmlFor="withFiles" className="form-check-label">
                    Only with attachments
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container my-4">
        {loading ? (
          <div className="skeleton-list">
            {Array.from({ length: 4 }).map((_, i) => (
              <div className="skeleton-card" key={i} />
            ))}
          </div>
        ) : processed.length === 0 ? (
          <EmptyState />
        ) : showCards ? (
          <div className="row g-3">
            {processed.map((c, i) => (
              <div className="col-12" key={c.id}>
                <CircularCard c={c} index={i} />
              </div>
            ))}
          </div>
        ) : (
          <div className="card shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 60 }}>#</th>
                    <th>Title</th>
                    <th className="w-50">Description</th>
                    <th>Date &amp; Time</th>
                    <th>Attachment</th>
                  </tr>
                </thead>
                <tbody>
                  {processed.map((c, idx) => (
                    <tr
                      key={c.id}
                      className="animate-in cursor-pointer"
                      onClick={(e) => openCircular(c, e)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openCircular(c, e);
                        }
                      }}
                      aria-label={`Open circular: ${c.title || "Untitled"}`}
                    >
                      <td>
                        <span className="index-badge">{idx + 1}</span>
                      </td>
                      <td className="fw-semibold">{c.title || "Untitled"}</td>
                      <td className="text-muted small">
                        {c.description || <em className="text-muted">No description</em>}
                      </td>
                      <td>
                        <div className="d-flex flex-column">
                          <span className="small">{formatDT(c.createdAt)}</span>
                          <span className="badge audience mt-1 align-self-start">
                            {c.audience === "both" ? "All Students" : "Students"}
                          </span>
                        </div>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {c.fileUrl ? (
                          <button
                            className="btn btn-sm btn-primary-soft"
                            onClick={(e) => openCircular(c, e)}
                          >
                            View
                          </button>
                        ) : (
                          <span className="text-muted small">No file</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Full view modal */}
      {showModal && <FullCircularModal />}

      {/* Component-scoped styles */}
      <style>{`
        /* --------- Hero --------- */
        .page-hero {
          --bg1: #1f7ae0;
          --bg2: #6aa7ff;
          background: linear-gradient(135deg, var(--bg1), var(--bg2));
          color: #fff;
          padding: 24px 0 28px;
          border-bottom-left-radius: 24px;
          border-bottom-right-radius: 24px;
        }
        .hero-title { font-weight: 800; letter-spacing: 0.2px; }
        .hero-subtitle { opacity: 0.95; }

        /* --------- Buttons (view mode) --------- */
        .btn-view {
          background: rgba(255,255,255,0.15);
          color: #fff;
          border: 0;
          padding: 8px 14px;
          backdrop-filter: blur(6px);
        }
        .btn-view:hover { background: rgba(255,255,255,0.28); }
        .btn-view.active { background: #fff; color: #1f7ae0; font-weight: 600; }

        /* --------- Filters --------- */
        .filters {
          border: 0;
          border-radius: 16px;
        }
        .filters .form-control, .filters .form-select {
          border-radius: 12px;
          padding-top: 10px; padding-bottom: 10px;
        }

        /* --------- Cards --------- */
        .circular-card {
          border: 0;
          border-radius: 16px;
          background: #fff;
        }
        .circular-card .card-body { padding: 16px 18px; }
        .index-badge {
          display: inline-flex; align-items: center; justify-content: center;
          width: 28px; height: 28px;
          border-radius: 999px;
          background: #e8f1ff; color: #1f7ae0;
          font-weight: 700; font-size: 0.9rem;
        }
        .badge.audience {
          background: #ecf5ff; color: #1b6ed6;
          border-radius: 999px; font-weight: 600;
        }
        .btn-primary-soft {
          background: #e7f0ff; color: #1f7ae0; border: 0; font-weight: 600;
        }
        .btn-primary-soft:hover { background: #d8e8ff; }

        .dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #c9d6ea; display: inline-block;
        }

        /* Clamp description lines for cards */
        .clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* --------- Table --------- */
        .table thead th {
          font-weight: 700; text-transform: uppercase; font-size: 0.75rem;
          letter-spacing: 0.6px;
        }
        .table tbody tr:hover { background: #fbfdff; }
        .table-responsive { border-radius: 14px; }
        .cursor-pointer { cursor: pointer; }

        /* --------- Skeleton --------- */
        .skeleton-list { display: grid; gap: 12px; }
        .skeleton-card {
          height: 84px; border-radius: 14px;
          background: linear-gradient(90deg, #f2f6ff 25%, #e9f1ff 37%, #f2f6ff 63%);
          background-size: 400% 100%;
          animation: shimmer 1.2s infinite;
        }
        @keyframes shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: 0 0; }
        }

        /* --------- Empty --------- */
        .empty-state .emoji { font-size: 44px; line-height: 1; margin-bottom: 8px; }

        /* --------- Animations --------- */
        .animate-in { animation: fadeInUp 260ms ease both; }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translate3d(0, 6px, 0); }
          to { opacity: 1; transform: none; }
        }

        /* --------- Modal --------- */
        .modal-backdrop-custom {
          position: fixed; inset: 0; z-index: 1050;
          background: rgba(16, 24, 40, 0.5);
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          opacity: 0; pointer-events: none;
          transition: opacity 160ms ease;
        }
        .modal-backdrop-custom.show {
          opacity: 1; pointer-events: auto;
        }
        .modal-panel {
          background: #fff;
          width: 100%;
          max-width: 900px;
          max-height: 90vh;
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(16,24,40,.2);
          display: flex; flex-direction: column;
          outline: none;
          animation: modalIn 180ms ease both;
        }
        @keyframes modalIn {
          from { transform: translateY(8px); opacity: 0.96; }
          to { transform: translateY(0); opacity: 1; }
        }
        .modal-header, .modal-footer {
          padding: 14px 18px;
          border-bottom: 1px solid #eef2f7;
        }
        .modal-footer { border-top: 1px solid #eef2f7; border-bottom: 0; }
        .modal-title { margin: 0; font-weight: 700; }
        .btn-close-x {
          border-radius: 10px; line-height: 1; padding: 6px 10px;
        }
        .modal-body {
          padding: 16px 18px;
          overflow: auto;
        }
        .attachment-block { margin-top: 12px; }
        .attachment-preview { margin-top: 8px; }
        .pdf-frame {
          width: 100%;
          height: min(75vh, 640px);
          border: 0;
          border-radius: 12px;
          background: #f8fafc;
        }
        .img-fluid { max-width: 100%; height: auto; }

        /* --------- Responsive tweaks --------- */
        @media (max-width: 575.98px) {
          .page-hero {
            padding: 18px 0 22px;
            border-bottom-left-radius: 18px; border-bottom-right-radius: 18px;
          }
          .hero-title { font-size: 1.35rem; }
          .filters .form-control, .filters .form-select { font-size: 0.95rem; }
          .circular-card .card-body { padding: 14px; }

          /* Make modal behave like a full-screen sheet on mobile */
          .modal-panel {
            max-width: 100%;
            max-height: 100vh;
            height: 96vh;
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
          }
        }
      `}</style>
    </>
  );
};

export default StudentCirculars;
