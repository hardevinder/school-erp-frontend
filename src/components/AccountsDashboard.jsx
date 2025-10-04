// File: src/components/AccountsDashboard.jsx
import React from "react";

const primaryTiles = [
  { label: "Collect Fee", icon: "bi-cash-stack", href: "/transactions", gradient: "linear-gradient(135deg, #22c55e, #16a34a)" },
  { label: "Day Summary", icon: "bi-clipboard-data", href: "/reports/day-wise", gradient: "linear-gradient(135deg, #3b82f6, #2563eb)" },
  { label: "Fee Due Report", icon: "bi-receipt", href: "/student-due", gradient: "linear-gradient(135deg, #f59e0b, #d97706)" },
  { label: "Session Summary", icon: "bi-graph-up", href: "/reports/school-fee-summary", gradient: "linear-gradient(135deg, #06b6d4, #0891b2)" },
];

const reportsTiles = [
  { label: "Cancelled Receipts", icon: "bi-trash3", href: "/cancelled-transactions", gradient: "linear-gradient(135deg, #ef4444, #dc2626)" },
  { label: "Concession Report", icon: "bi-percent", href: "/reports/concession", gradient: "linear-gradient(135deg, #a855f7, #7c3aed)" },
  { label: "Transport Fee", icon: "bi-truck-front", href: "/reports/van-fee", gradient: "linear-gradient(135deg, #0ea5e9, #0284c7)" },
  { label: "Opening Balances", icon: "bi-clipboard-check", href: "/opening-balances", gradient: "linear-gradient(135deg, #64748b, #475569)" },
];

const setupTiles = [
  { label: "Fee Structure", icon: "bi-cash-coin", href: "/fee-structure", gradient: "linear-gradient(135deg, #16a34a, #15803d)" },
  { label: "Fee Headings", icon: "bi-bookmark", href: "/fee-headings", gradient: "linear-gradient(135deg, #3b82f6, #1d4ed8)" },
  { label: "Fee Category", icon: "bi-tags", href: "/fee-category", gradient: "linear-gradient(135deg, #f59e0b, #b45309)" },
  { label: "Concessions", icon: "bi-badge-ad", href: "/concessions", gradient: "linear-gradient(135deg, #ec4899, #db2777)" },
];

function LinkTile({ href, icon, label, gradient }) {
  return (
    <a
      href={href}
      className="link-tile"
      style={{ backgroundImage: gradient }}
      aria-label={`Open ${label}`}
    >
      <span className="lt-icon">
        <i className={`bi ${icon}`} />
      </span>
      <span className="lt-text">
        <span className="lt-label">{label}</span>
        <span className="lt-arrow"><i className="bi bi-arrow-right" /></span>
      </span>
    </a>
  );
}

export default function AccountsDashboard() {
  return (
    <div
      className="accounts-tiles-bg"
      style={{
        backgroundImage:
          "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(59,130,246,0.12), rgba(245,158,11,0.12)), url(/images/SchooBackground.jpeg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: "100vh",
      }}
    >
      <div className="accounts-tiles-overlay" />

      <div className="container-fluid px-4" style={{ position: "relative", zIndex: 2 }}>
        {/* Header */}
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 my-4">
          <div className="d-flex flex-column">
            <h2 className="mb-1 fw-bold" style={{ fontFamily: "'Inter', sans-serif" }}>
              Accounts — Quick Actions
            </h2>
            <small className="text-muted" style={{ fontFamily: "'Inter', sans-serif" }}>
              Everything you need for fee collection, just one tap away.
            </small>
          </div>
        </div>

        {/* Sections */}
        <section className="mb-4">
          <h5 className="tile-section-title">Primary</h5>
          <div className="tile-grid">
            {primaryTiles.map((t) => <LinkTile key={t.label} {...t} />)}
          </div>
        </section>

        <section className="mb-4">
          <h5 className="tile-section-title">Reports</h5>
          <div className="tile-grid">
            {reportsTiles.map((t) => <LinkTile key={t.label} {...t} />)}
          </div>
        </section>

        <section className="mb-5">
          <h5 className="tile-section-title">Setup</h5>
          <div className="tile-grid">
            {setupTiles.map((t) => <LinkTile key={t.label} {...t} />)}
          </div>
        </section>

        {/* Styles */}
        <style>{`
          * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .accounts-tiles-bg { position: relative; background-attachment: fixed; }
          .accounts-tiles-overlay {
            position: absolute; inset: 0;
            background: linear-gradient(135deg, rgba(255,255,255,0.85), rgba(255,255,255,0.65));
            z-index: 1; pointer-events: none;
          }

          .tile-section-title {
            font-weight: 700; letter-spacing: .2px; margin-bottom: .8rem;
            background: linear-gradient(90deg, #111827, #475569);
            -webkit-background-clip: text; background-clip: text; color: transparent;
          }

          .tile-grid {
            display: grid;
            grid-template-columns: repeat(12, 1fr);
            gap: 1rem;
          }

          /* Responsive columns */
          @media (max-width: 575.98px)   { .tile-grid { grid-template-columns: repeat(2, 1fr); } }
          @media (min-width: 576px) and (max-width: 991.98px)  { .tile-grid { grid-template-columns: repeat(3, 1fr); } }
          @media (min-width: 992px) and (max-width: 1399.98px) { .tile-grid { grid-template-columns: repeat(4, 1fr); } }
          @media (min-width: 1400px) { .tile-grid { grid-template-columns: repeat(6, 1fr); } }

          .link-tile {
            position: relative;
            display: flex; align-items: center; gap: 1rem;
            padding: 1.1rem 1.2rem;
            border-radius: 1.1rem;
            color: #fff; text-decoration: none;
            background-size: 200% 100%; background-position: 0% 50%;
            border: 1px solid rgba(255,255,255,0.18);
            box-shadow: 0 10px 30px rgba(0,0,0,.1);
            transition: transform .25s ease, box-shadow .25s ease, background-position .25s ease;
            overflow: hidden;
          }
          .link-tile:hover {
            transform: translateY(-4px);
            box-shadow: 0 18px 34px rgba(0,0,0,.18);
            background-position: 100% 50%;
          }
          .link-tile:active { transform: translateY(-1px); }

          .lt-icon {
            display: grid; place-items: center;
            width: 3rem; height: 3rem; border-radius: .9rem;
            background: rgba(255,255,255,.18);
            box-shadow: inset 0 0 0 2px rgba(255,255,255,.25);
            backdrop-filter: blur(2px);
            flex: 0 0 auto;
          }
          .lt-icon i { font-size: 1.4rem; }

          .lt-text { display: flex; align-items: center; justify-content: space-between; width: 100%; gap: .75rem; }
          .lt-label { font-size: 1.05rem; font-weight: 700; letter-spacing: .2px; }
          .lt-arrow { opacity: .9; transform: translateX(0); transition: transform .25s ease; }
          .link-tile:hover .lt-arrow { transform: translateX(4px); }

          /* Subtle animated sparkle */
          .link-tile::after {
            content: ""; position: absolute; inset: -100% 0 auto 0; height: 200%;
            background: radial-gradient(120px 120px at 0% 0%, rgba(255,255,255,.25), transparent 60%),
                        radial-gradient(160px 160px at 100% 100%, rgba(255,255,255,.18), transparent 55%);
            opacity: .35; pointer-events: none; transition: opacity .25s ease;
          }
          .link-tile:hover::after { opacity: .55; }

          /* Reduce motion preference */
          @media (prefers-reduced-motion: reduce) {
            .link-tile, .lt-arrow { transition: none !important; }
          }
        `}</style>

        {/* Bootstrap Icons */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css"
        />
        {/* Inter Font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </div>
    </div>
  );
}
