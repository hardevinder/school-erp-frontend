import React from "react";

export default function InventoryTableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters = null,
  rightContent = null,
}) {
  return (
    <div className="card shadow-sm rounded-4 border-0 mb-3">
      <div className="card-body">
        <div className="d-flex flex-wrap align-items-end justify-content-between gap-3">
          <div className="d-flex flex-wrap align-items-end gap-3">
            {filters}

            <div>
              <label className="form-label mb-1">Search</label>
              <input
                className="form-control"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          </div>

          {rightContent ? <div className="text-muted small">{rightContent}</div> : null}
        </div>
      </div>
    </div>
  );
}
