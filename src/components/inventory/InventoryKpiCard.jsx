import React from "react";

export default function InventoryKpiCard({
  title,
  value,
  hint,
  valueClassName = "",
  borderColor = "#e5e7eb",
  background = "#fff",
}) {
  return (
    <div className="col-12 col-sm-6 col-xl-3">
      <div
        className="card shadow-sm rounded-4 border-0 h-100"
        style={{ background, borderLeft: `5px solid ${borderColor}` }}
      >
        <div className="card-body">
          <div className="text-uppercase small text-muted mb-2">{title}</div>
          <div className={`display-6 fw-semibold mb-2 ${valueClassName}`}>{value}</div>
          <div className="small text-muted">{hint || "—"}</div>
        </div>
      </div>
    </div>
  );
}
