// src/components/dashboard/RoleMenuTiles.jsx
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useInstitution } from "../../institution/InstitutionContext";
import { workspaceForPath } from "./dashboardModel";
import { getRoleDashboardMenus } from "./roleMenuCatalog";
import "./RoleMenuTiles.css";

const GROUP_ICONS = {
  Main: "bi-grid-1x2-fill",
  Communication: "bi-chat-left-text-fill",
  Learning: "bi-mortarboard-fill",
  "Daily Work": "bi-lightning-charge-fill",
  Academic: "bi-book-half",
  Examination: "bi-clipboard-data-fill",
  "My HR": "bi-person-badge-fill",
  "Student Life": "bi-stars",
  College: "bi-buildings-fill",
};

function normalizeBadge(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "object") return value;
  return { text: String(value), tone: "primary" };
}

export default function RoleMenuTiles({
  role,
  workspace = "ERP",
  title,
  subtitle,
  badges = {},
  compact = false,
  showSearch = true,
}) {
  const { isCollege } = useInstitution();
  const [query, setQuery] = useState("");
  const normalizedRole = String(role || "").toLowerCase();

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = getRoleDashboardMenus(normalizedRole, isCollege)
      .filter((item) => workspace === "All" || workspaceForPath(item.path) === workspace)
      .filter((item) => !q || [item.label, item.description, item.group, item.path].some((value) =>
        String(value || "").toLowerCase().includes(q)
      ));

    return items.reduce((acc, item) => {
      const key = item.group || "More";
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [normalizedRole, isCollege, query, workspace]);

  const total = Object.values(groups).reduce((sum, items) => sum + items.length, 0);
  const defaultTitle = workspace === "LMS" ? "Learning & Academic Tools" : "All ERP Modules";
  const defaultSubtitle =
    workspace === "LMS"
      ? "Every learning module available to this role, in one place."
      : "All menus available to this role, grouped for faster access.";

  return (
    <section className={`role-menu-panel ${compact ? "role-menu-panel-compact" : ""}`}>
      <div className="role-menu-panel-head">
        <div>
          <div className="role-menu-kicker">
            <span className="role-menu-live-dot" aria-hidden="true" />
            {workspace === "LMS" ? "LMS workspace" : "ERP workspace"}
          </div>
          <h2>{title || defaultTitle}</h2>
          <p>{subtitle || defaultSubtitle}</p>
        </div>

        <div className="role-menu-head-actions">
          <span className="role-menu-count">
            <i className="bi bi-grid-3x3-gap-fill" />
            {total} modules
          </span>
          {showSearch && (
            <label className="role-menu-search">
              <i className="bi bi-search" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search modules..."
                aria-label="Search dashboard modules"
              />
              {query ? (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
                  <i className="bi bi-x-lg" />
                </button>
              ) : null}
            </label>
          )}
        </div>
      </div>

      {total === 0 ? (
        <div className="role-menu-empty">
          <i className="bi bi-search" />
          <strong>No modules found</strong>
          <span>Try another search or switch workspace.</span>
        </div>
      ) : (
        <div className="role-menu-groups">
          {Object.entries(groups).map(([groupName, items]) => (
            <div className="role-menu-group" key={groupName}>
              <div className="role-menu-group-title">
                <span className="role-menu-group-icon">
                  <i className={`bi ${GROUP_ICONS[groupName] || "bi-folder-fill"}`} />
                </span>
                <span>{groupName}</span>
                <span className="role-menu-group-count">{items.length}</span>
              </div>

              <div className="role-menu-grid">
                {items.map((item, index) => {
                  const badge = normalizeBadge(badges[item.path] ?? badges[item.key]);
                  return (
                    <Link
                      to={item.path}
                      className="role-menu-tile"
                      key={`${item.key}-${item.path}`}
                      style={{ "--tile-order": index }}
                    >
                      <span className="role-menu-tile-icon">
                        <i className={`bi ${item.icon || "bi-grid"}`} />
                      </span>
                      <span className="role-menu-tile-copy">
                        <span className="role-menu-tile-title-row">
                          <strong>{item.label}</strong>
                          {badge ? (
                            <span className={`role-menu-badge role-menu-badge-${badge.tone || "primary"}`}>
                              {badge.pulse ? <span className="role-menu-badge-pulse" /> : null}
                              {badge.text}
                            </span>
                          ) : null}
                        </span>
                        <small>{item.description || `Open ${item.label}.`}</small>
                      </span>
                      <span className="role-menu-arrow">
                        <i className="bi bi-arrow-up-right" />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
