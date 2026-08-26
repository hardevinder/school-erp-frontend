import React from "react";
import { Link } from "react-router-dom";
import "./DashboardSupportBanner.css";

export default function DashboardSupportBanner() {
  return (
    <aside className="dashboard-support-banner" aria-label="Help and support">
      <span className="dashboard-support-icon" aria-hidden="true">
        <i className="bi bi-life-preserver" />
      </span>

      <span className="dashboard-support-copy">
        <strong>Need help?</strong>
        <span>Report an issue and track its resolution with Edubridge Support.</span>
      </span>

      <Link className="dashboard-support-action" to="/support?new=1">
        <i className="bi bi-ticket-perforated" aria-hidden="true" />
        Raise a ticket
      </Link>

      <Link className="dashboard-support-history" to="/support">
        My tickets
      </Link>
    </aside>
  );
}
