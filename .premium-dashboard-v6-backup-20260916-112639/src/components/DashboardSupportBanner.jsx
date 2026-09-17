import React from "react";
import { Link } from "react-router-dom";
import "./DashboardSupportBanner.css";

export default function DashboardSupportBanner() {
  return (
    <div className="dashboard-support-compact" aria-label="Help and support">
      <Link
        className="dashboard-support-compact__button"
        to="/support?new=1"
        title="Open Edubridge Support"
      >
        <span className="dashboard-support-compact__icon" aria-hidden="true">
          <i className="bi bi-life-preserver" />
        </span>
        <span>Need help?</span>
        <i className="bi bi-arrow-right-short dashboard-support-compact__arrow" aria-hidden="true" />
      </Link>
    </div>
  );
}
