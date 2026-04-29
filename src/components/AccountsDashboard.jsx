// File: src/components/AccountsDashboard.jsx
import React from "react";
import { Link } from "react-router-dom";

const primaryTiles = [
  {
    label: "Collect Fee",
    sub: "Create receipts",
    icon: "bi-cash-stack",
    href: "/transactions",
    gradient: "linear-gradient(135deg, #22c55e, #16a34a)",
  },
  {
    label: "Day Summary",
    sub: "Today collection",
    icon: "bi-clipboard-data",
    href: "/reports/day-wise",
    gradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
  },
  {
    label: "Fee Due Report",
    sub: "Pending dues",
    icon: "bi-receipt",
    href: "/student-due",
    gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
  },
  {
    label: "Session Summary",
    sub: "School fee summary",
    icon: "bi-graph-up",
    href: "/reports/school-fee-summary",
    gradient: "linear-gradient(135deg, #06b6d4, #0891b2)",
  },
  {
    label: "Bulk Concessions",
    sub: "Apply to many students",
    icon: "bi-percent",
    href: "/students/bulk-concession",
    gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
    tag: "NEW",
  },
];

const reportsTiles = [
  {
    label: "Cancelled Receipts",
    sub: "Reversed transactions",
    icon: "bi-trash3",
    href: "/cancelled-transactions",
    gradient: "linear-gradient(135deg, #ef4444, #dc2626)",
  },
  {
    label: "Concession Report",
    sub: "Student concession summary",
    icon: "bi-file-earmark-bar-graph",
    href: "/reports/concession",
    gradient: "linear-gradient(135deg, #a855f7, #7c3aed)",
  },
  {
    label: "Transport Fee",
    sub: "Van fee report",
    icon: "bi-truck-front",
    href: "/reports/van-fee",
    gradient: "linear-gradient(135deg, #0ea5e9, #0284c7)",
  },
  {
    label: "Opening Balances",
    sub: "Session opening dues",
    icon: "bi-clipboard-check",
    href: "/opening-balances",
    gradient: "linear-gradient(135deg, #64748b, #475569)",
  },
];

const setupTiles = [
  {
    label: "Fee Structure",
    sub: "Configure class fee",
    icon: "bi-cash-coin",
    href: "/fee-structure",
    gradient: "linear-gradient(135deg, #16a34a, #15803d)",
  },
  {
    label: "Fee Headings",
    sub: "Manage heads",
    icon: "bi-bookmark",
    href: "/fee-headings",
    gradient: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
  },
  {
    label: "Fee Category",
    sub: "Category setup",
    icon: "bi-tags",
    href: "/fee-category",
    gradient: "linear-gradient(135deg, #f59e0b, #b45309)",
  },
  {
    label: "Concessions",
    sub: "Concession masters",
    icon: "bi-badge-ad",
    href: "/concessions",
    gradient: "linear-gradient(135deg, #ec4899, #db2777)",
  },
];

function LinkTile({ href, icon, label, sub, gradient, tag }) {
  return (
    <Link
      to={href}
      className="link-tile"
      style={{ backgroundImage: gradient }}
      aria-label={`Open ${label}`}
    >
      <span className="lt-glow" />

      <span className="lt-icon">
        <i className={`bi ${icon}`} />
      </span>

      <span className="lt-text">
        <span className="lt-top">
          <span className="lt-label">{label}</span>
          {tag ? <span className="lt-pill">{tag}</span> : null}
        </span>
        <span className="lt-sub">{sub}</span>
      </span>

      <span className="lt-arrow">
        <i className="bi bi-arrow-right" />
      </span>
    </Link>
  );
}

function TileSection({ title, subtitle, tiles }) {
  return (
    <section className="mb-4 mb-lg-5">
      <div className="section-head">
        <div>
          <h5 className="tile-section-title mb-1">{title}</h5>
          <div className="tile-section-sub">{subtitle}</div>
        </div>
        <div className="section-count">{tiles.length} items</div>
      </div>

      <div className="tile-grid">
        {tiles.map((t) => (
          <LinkTile key={t.label} {...t} />
        ))}
      </div>
    </section>
  );
}

export default function AccountsDashboard() {
  return (
    <div
      className="accounts-tiles-bg"
      style={{
        background:
          "radial-gradient(circle at top left, rgba(99,102,241,.10), transparent 28%), radial-gradient(circle at top right, rgba(34,197,94,.10), transparent 25%), linear-gradient(135deg, #f8fafc, #eef2ff)",
        minHeight: "100vh",
      }}
    >
      <div className="accounts-tiles-overlay" />

      <div
        className="container-fluid px-3 px-md-4 px-xl-4"
        style={{ position: "relative", zIndex: 2 }}
      >
        {/* Header */}
        <div className="hero-wrap my-3 my-md-4">
          <div className="hero-card">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div className="hero-copy">
                <div className="hero-badge">
                  <i className="bi bi-speedometer2 me-2" />
                  Accounts Dashboard
                </div>

                <h2 className="hero-title mb-1">Quick Actions</h2>
                <p className="hero-sub mb-0">
                  Clean, fast access to fee collection, due reports, concessions,
                  and daily accounts work.
                </p>
              </div>

              <div className="hero-actions">
                <Link to="/transactions" className="hero-btn hero-btn-primary">
                  <i className="bi bi-cash-stack me-2" />
                  Collect Fee
                </Link>

                <Link
                  to="/students/bulk-concession"
                  className="hero-btn hero-btn-secondary"
                >
                  <i className="bi bi-percent me-2" />
                  Bulk Concessions
                </Link>
              </div>
            </div>

            <div className="hero-stats">
              <div className="hero-stat">
                <span className="dot dot-green" />
                Collection
              </div>
              <div className="hero-stat">
                <span className="dot dot-blue" />
                Reports
              </div>
              <div className="hero-stat">
                <span className="dot dot-purple" />
                Concessions
              </div>
              <div className="hero-stat">
                <span className="dot dot-orange" />
                Setup
              </div>
            </div>
          </div>
        </div>

        {/* Sections */}
        <TileSection
          title="Primary"
          subtitle="Most-used actions for daily accounts work"
          tiles={primaryTiles}
        />

        <TileSection
          title="Reports"
          subtitle="Quick access to summaries and verification screens"
          tiles={reportsTiles}
        />

        <TileSection
          title="Setup"
          subtitle="Manage fee masters and account configurations"
          tiles={setupTiles}
        />

        <style>{`
          * {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }

          .accounts-tiles-bg {
            position: relative;
            background-attachment: fixed;
          }

          .accounts-tiles-overlay {
            position: absolute;
            inset: 0;
            background: linear-gradient(
              135deg,
              rgba(255,255,255,0.82),
              rgba(255,255,255,0.68)
            );
            z-index: 1;
            pointer-events: none;
          }

          .hero-wrap {
            position: sticky;
            top: 0.85rem;
            z-index: 4;
          }

          .hero-card {
            padding: 1rem 1rem 0.9rem;
            border-radius: 1.35rem;
            background: rgba(255,255,255,0.82);
            border: 1px solid rgba(255,255,255,0.65);
            backdrop-filter: blur(16px) saturate(1.2);
            box-shadow: 0 10px 35px rgba(15, 23, 42, 0.10);
          }

          .hero-badge {
            display: inline-flex;
            align-items: center;
            padding: 0.42rem 0.72rem;
            margin-bottom: 0.7rem;
            border-radius: 999px;
            background: rgba(59,130,246,0.10);
            color: #1d4ed8;
            border: 1px solid rgba(59,130,246,0.15);
            font-size: 0.82rem;
            font-weight: 700;
            letter-spacing: .2px;
          }

          .hero-title {
            font-size: clamp(1.35rem, 2vw, 2rem);
            font-weight: 800;
            color: #0f172a;
            letter-spacing: .1px;
          }

          .hero-sub {
            color: #64748b;
            font-size: 0.95rem;
            max-width: 760px;
            line-height: 1.5;
          }

          .hero-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.7rem;
          }

          .hero-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            text-decoration: none;
            border-radius: 0.95rem;
            padding: 0.78rem 1rem;
            font-weight: 700;
            font-size: 0.92rem;
            box-shadow: 0 8px 22px rgba(15, 23, 42, 0.10);
            transition: transform .22s ease, box-shadow .22s ease;
            white-space: nowrap;
          }

          .hero-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 14px 28px rgba(15, 23, 42, 0.14);
          }

          .hero-btn-primary {
            color: #fff;
            background: linear-gradient(135deg, #22c55e, #16a34a);
          }

          .hero-btn-secondary {
            color: #fff;
            background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          }

          .hero-stats {
            display: flex;
            flex-wrap: wrap;
            gap: 0.6rem;
            margin-top: 0.9rem;
          }

          .hero-stat {
            display: inline-flex;
            align-items: center;
            gap: 0.42rem;
            padding: 0.4rem 0.7rem;
            border-radius: 999px;
            background: rgba(248,250,252,0.9);
            border: 1px solid rgba(226,232,240,0.95);
            color: #475569;
            font-size: 0.8rem;
            font-weight: 600;
          }

          .dot {
            width: 0.52rem;
            height: 0.52rem;
            border-radius: 999px;
            display: inline-block;
          }
          .dot-green { background: #22c55e; }
          .dot-blue { background: #3b82f6; }
          .dot-purple { background: #8b5cf6; }
          .dot-orange { background: #f59e0b; }

          .section-head {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 1rem;
            margin-bottom: 0.95rem;
          }

          .tile-section-title {
            font-weight: 800;
            letter-spacing: .2px;
            margin-bottom: .2rem;
            background: linear-gradient(90deg, #111827, #475569);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
          }

          .tile-section-sub {
            color: #64748b;
            font-size: .88rem;
          }

          .section-count {
            padding: .4rem .65rem;
            border-radius: 999px;
            background: rgba(255,255,255,0.8);
            border: 1px solid rgba(226,232,240,0.9);
            color: #475569;
            font-size: .78rem;
            font-weight: 700;
            white-space: nowrap;
          }

          .tile-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 0.95rem;
          }

          .link-tile {
            position: relative;
            display: flex;
            align-items: center;
            gap: 0.9rem;
            min-height: 92px;
            padding: 1rem 1rem;
            border-radius: 1.15rem;
            color: #fff;
            text-decoration: none;
            background-size: 200% 100%;
            background-position: 0% 50%;
            border: 1px solid rgba(255,255,255,0.18);
            box-shadow: 0 10px 26px rgba(0,0,0,.10);
            transition: transform .25s ease, box-shadow .25s ease, background-position .25s ease;
            overflow: hidden;
            isolation: isolate;
          }

          .link-tile:hover {
            transform: translateY(-4px);
            box-shadow: 0 18px 34px rgba(0,0,0,.18);
            background-position: 100% 50%;
            color: #fff;
          }

          .link-tile:active {
            transform: translateY(-1px);
          }

          .lt-glow {
            position: absolute;
            inset: -35%;
            background:
              radial-gradient(circle at 20% 20%, rgba(255,255,255,.28), transparent 28%),
              radial-gradient(circle at 80% 80%, rgba(255,255,255,.20), transparent 32%);
            pointer-events: none;
            z-index: 0;
          }

          .lt-icon {
            position: relative;
            z-index: 1;
            display: grid;
            place-items: center;
            width: 3rem;
            height: 3rem;
            border-radius: .95rem;
            background: rgba(255,255,255,.18);
            box-shadow: inset 0 0 0 2px rgba(255,255,255,.22);
            backdrop-filter: blur(2px);
            flex: 0 0 auto;
          }

          .lt-icon i {
            font-size: 1.35rem;
          }

          .lt-text {
            position: relative;
            z-index: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: .18rem;
            min-width: 0;
            flex: 1;
          }

          .lt-top {
            display: flex;
            align-items: center;
            gap: .45rem;
            min-width: 0;
          }

          .lt-label {
            font-size: 1rem;
            font-weight: 800;
            letter-spacing: .15px;
            line-height: 1.15;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .lt-sub {
            font-size: .78rem;
            opacity: .92;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .lt-pill {
            font-size: .62rem;
            font-weight: 800;
            padding: .18rem .42rem;
            border-radius: 999px;
            background: rgba(255,255,255,.22);
            border: 1px solid rgba(255,255,255,.25);
            white-space: nowrap;
          }

          .lt-arrow {
            position: relative;
            z-index: 1;
            width: 2rem;
            height: 2rem;
            display: inline-grid;
            place-items: center;
            border-radius: .85rem;
            background: rgba(255,255,255,.16);
            border: 1px solid rgba(255,255,255,.20);
            flex: 0 0 auto;
            transition: transform .25s ease;
          }

          .link-tile:hover .lt-arrow {
            transform: translateX(4px);
          }

          @media (max-width: 1399.98px) {
            .container-fluid {
              max-width: 100%;
            }
            .tile-grid {
              grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
              gap: 0.85rem;
            }
          }

          @media (max-width: 1199.98px) {
            .hero-card {
              padding: .95rem .95rem .85rem;
            }
            .link-tile {
              min-height: 86px;
              padding: .92rem .92rem;
            }
            .lt-label {
              font-size: .96rem;
            }
          }

          @media (max-width: 991.98px) {
            .hero-wrap {
              position: static;
            }
            .hero-actions {
              width: 100%;
            }
            .hero-btn {
              flex: 1 1 220px;
            }
            .tile-grid {
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            }
          }

          @media (max-width: 767.98px) {
            .section-head {
              align-items: flex-start;
              flex-direction: column;
              gap: .45rem;
            }
            .hero-sub {
              font-size: .9rem;
            }
            .tile-grid {
              grid-template-columns: 1fr;
            }
            .link-tile {
              min-height: 82px;
            }
          }

          @media (max-width: 575.98px) {
            .hero-card {
              border-radius: 1.1rem;
            }
            .hero-btn {
              width: 100%;
            }
            .lt-icon {
              width: 2.75rem;
              height: 2.75rem;
            }
            .lt-label {
              font-size: .94rem;
            }
            .lt-sub {
              font-size: .76rem;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .link-tile,
            .lt-arrow,
            .hero-btn {
              transition: none !important;
            }
          }
        `}</style>

        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </div>
    </div>
  );
}