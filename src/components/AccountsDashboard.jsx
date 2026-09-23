// File: src/components/AccountsDashboard.jsx
import React from "react";
import { Link } from "react-router-dom";

const primaryTiles = [
  {
    label: "Collect Fee",
    sub: "Create receipts",
    icon: "bi-cash-stack",
    href: "/transactions",
    gradient: "linear-gradient(135deg, var(--edb-primary), var(--edb-primary-dark))",
  },
  {
    label: "Day Summary",
    sub: "Today collection",
    icon: "bi-clipboard-data",
    href: "/reports/day-wise",
    gradient: "linear-gradient(135deg, var(--edb-primary), var(--edb-primary-dark))",
  },
  {
    label: "Fee Due Report",
    sub: "Pending dues",
    icon: "bi-receipt",
    href: "/student-due",
    gradient: "linear-gradient(135deg, var(--edb-primary), var(--edb-primary-dark))",
  },
  {
    label: "Session Summary",
    sub: "School fee summary",
    icon: "bi-graph-up",
    href: "/reports/school-fee-summary",
    gradient: "linear-gradient(135deg, var(--edb-primary), var(--edb-primary-dark))",
  },
  {
    label: "Bulk Concessions",
    sub: "Apply to many students",
    icon: "bi-percent",
    href: "/students/bulk-concession",
    gradient: "linear-gradient(135deg, var(--edb-primary), var(--edb-primary-dark))",
    tag: "NEW",
  },
  {
    label: "Messages",
    sub: "Fee reminders & replies",
    icon: "bi-chat-dots",
    href: "/messages",
    gradient: "linear-gradient(135deg, var(--edb-primary), var(--edb-primary-dark))",
    tag: "NEW",
  },
];

const reportsTiles = [
  {
    label: "Cancelled Receipts",
    sub: "Reversed transactions",
    icon: "bi-trash3",
    href: "/cancelled-transactions",
    gradient: "linear-gradient(135deg, var(--edb-primary), var(--edb-primary-dark))",
  },
  {
    label: "Concession Report",
    sub: "Student concession summary",
    icon: "bi-file-earmark-bar-graph",
    href: "/reports/concession",
    gradient: "linear-gradient(135deg, var(--edb-primary), var(--edb-primary-dark))",
  },
  {
    label: "Fee Head Collection",
    sub: "Student collection matrix",
    icon: "bi-table",
    href: "/student-fee-head-collection",
    gradient: "linear-gradient(135deg, var(--edb-primary), var(--edb-primary-dark))",
    tag: "NEW",
  },
  {
    label: "Transport Fee",
    sub: "Van fee report",
    icon: "bi-truck-front",
    href: "/reports/van-fee",
    gradient: "linear-gradient(135deg, var(--edb-primary), var(--edb-primary-dark))",
  },
  {
    label: "Opening Balances",
    sub: "Session opening dues",
    icon: "bi-clipboard-check",
    href: "/opening-balances",
    gradient: "linear-gradient(135deg, var(--edb-primary), var(--edb-primary-dark))",
  },
];

const setupTiles = [
  {
    label: "Fee Structure",
    sub: "Configure class fee",
    icon: "bi-cash-coin",
    href: "/fee-structure",
    gradient: "linear-gradient(135deg, var(--edb-primary), var(--edb-primary-dark))",
  },
  {
    label: "Fee Headings",
    sub: "Manage heads",
    icon: "bi-bookmark",
    href: "/fee-headings",
    gradient: "linear-gradient(135deg, var(--edb-primary), var(--edb-primary-dark))",
  },
  {
    label: "Fee Category",
    sub: "Category setup",
    icon: "bi-tags",
    href: "/fee-category",
    gradient: "linear-gradient(135deg, var(--edb-primary), var(--edb-primary-dark))",
  },
  {
    label: "Concessions",
    sub: "Concession masters",
    icon: "bi-badge-ad",
    href: "/concessions",
    gradient: "linear-gradient(135deg, var(--edb-primary), var(--edb-primary-dark))",
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
      className="accounts-tiles-bg dashboard-surface"
      style={{
        background:
          "radial-gradient(circle at top left, color-mix(in srgb, var(--edb-primary) 10%, transparent), transparent 28%), radial-gradient(circle at top right, rgba(34,197,94,.10), transparent 25%), linear-gradient(135deg, var(--edb-surface), var(--edb-surface))",
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
                  fee reminders, messages, and daily accounts work.
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

                <Link
                  to="/student-fee-head-collection"
                  className="hero-btn hero-btn-tertiary"
                >
                  <i className="bi bi-table me-2" />
                  Fee Head Collection
                </Link>

                <Link
                  to="/messages"
                  className="hero-btn hero-btn-messages"
                >
                  <i className="bi bi-chat-dots me-2" />
                  Messages
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
              <div className="hero-stat">
                <span className="dot dot-indigo" />
                Messages
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
              color-mix(in srgb, var(--edb-surface) 82%, transparent),
              color-mix(in srgb, var(--edb-surface) 68%, transparent)
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
            background: color-mix(in srgb, var(--edb-surface) 82%, transparent);
            border: 1px solid color-mix(in srgb, var(--edb-border) 65%, transparent);
            backdrop-filter: blur(16px) saturate(1.2);
            box-shadow: 0 10px 35px color-mix(in srgb, var(--edb-primary-dark) 10%, transparent);
          }

          .hero-badge {
            display: inline-flex;
            align-items: center;
            padding: 0.42rem 0.72rem;
            margin-bottom: 0.7rem;
            border-radius: 999px;
            background: color-mix(in srgb, var(--edb-primary) 10%, transparent);
            color: var(--edb-primary-text);
            border: 1px solid color-mix(in srgb, var(--edb-primary) 15%, transparent);
            font-size: 0.82rem;
            font-weight: 700;
            letter-spacing: .2px;
          }

          .hero-title {
            font-size: clamp(1.35rem, 2vw, 2rem);
            font-weight: 800;
            color: var(--edb-text);
            letter-spacing: .1px;
          }

          .hero-sub {
            color: var(--edb-muted-text);
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
            box-shadow: 0 8px 22px color-mix(in srgb, var(--edb-primary-dark) 10%, transparent);
            transition: transform .22s ease, box-shadow .22s ease;
            white-space: nowrap;
          }

          .hero-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 14px 28px color-mix(in srgb, var(--edb-primary-dark) 14.000000000000002%, transparent);
          }

          .hero-btn-primary {
            color: var(--edb-on-primary);
            background: linear-gradient(135deg, #22c55e, #16a34a);
          }

          .hero-btn-secondary {
            color: var(--edb-on-primary);
            background: linear-gradient(135deg, var(--edb-primary), var(--edb-primary));
          }

          .hero-btn-tertiary {
            color: var(--edb-on-primary);
            background: linear-gradient(135deg, #14b8a6, #0f766e);
          }

          .hero-btn-messages {
            color: var(--edb-on-primary);
            background: linear-gradient(135deg, var(--edb-primary), var(--edb-primary));
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
            background: color-mix(in srgb, var(--edb-surface) 90%, transparent);
            border: 1px solid color-mix(in srgb, var(--edb-border) 95%, transparent);
            color: var(--edb-text);
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
          .dot-blue { background: var(--edb-primary); }
          .dot-purple { background: var(--edb-primary); }
          .dot-orange { background: var(--edb-accent); }
          .dot-indigo { background: var(--edb-primary); }

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
            background: linear-gradient(90deg, var(--edb-primary-dark), var(--edb-muted-text));
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
          }

          .tile-section-sub {
            color: var(--edb-muted-text);
            font-size: .88rem;
          }

          .section-count {
            padding: .4rem .65rem;
            border-radius: 999px;
            background: color-mix(in srgb, var(--edb-surface) 80%, transparent);
            border: 1px solid color-mix(in srgb, var(--edb-border) 90%, transparent);
            color: var(--edb-text);
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
            color: var(--edb-on-primary);
            text-decoration: none;
            background-size: 200% 100%;
            background-position: 0% 50%;
            border: 1px solid color-mix(in srgb, var(--edb-border) 18%, transparent);
            box-shadow: 0 10px 26px color-mix(in srgb, var(--edb-primary-dark) 10%, transparent);
            transition: transform .25s ease, box-shadow .25s ease, background-position .25s ease;
            overflow: hidden;
            isolation: isolate;
          }

          .link-tile:hover {
            transform: translateY(-4px);
            box-shadow: 0 18px 34px color-mix(in srgb, var(--edb-primary-dark) 18%, transparent);
            background-position: 100% 50%;
            color: var(--edb-on-primary);
          }

          .link-tile:active {
            transform: translateY(-1px);
          }

          .lt-glow {
            position: absolute;
            inset: -35%;
            background:
              radial-gradient(circle at 20% 20%, color-mix(in srgb, var(--edb-surface) 28%, transparent), transparent 28%),
              radial-gradient(circle at 80% 80%, color-mix(in srgb, var(--edb-surface) 20%, transparent), transparent 32%);
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
            background: color-mix(in srgb, var(--edb-surface) 18%, transparent);
            box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--edb-primary-dark) 22%, transparent);
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
            background: color-mix(in srgb, var(--edb-surface) 22%, transparent);
            border: 1px solid color-mix(in srgb, var(--edb-border) 25%, transparent);
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
            background: color-mix(in srgb, var(--edb-surface) 16%, transparent);
            border: 1px solid color-mix(in srgb, var(--edb-border) 20%, transparent);
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