import React from "react";
import { useBranch } from "../branch/BranchContext";

export default function BranchSwitcher({ compact = false }) {
  const {
    branches,
    activeBranchId,
    allowAllBranches,
    setActiveBranch,
  } = useBranch();

  if (!branches.length) return null;

  return (
    <div className={compact ? "branch-switcher branch-switcher-compact" : "branch-switcher"}>
      <label htmlFor={compact ? "branchSwitcherMobile" : "branchSwitcherDesktop"} className="visually-hidden">
        Switch branch or campus
      </label>
      <div className="input-group input-group-sm">
        {!compact && (
          <span className="input-group-text bg-light border-end-0" title="Branch / Campus">
            <i className="bi bi-diagram-3" />
          </span>
        )}
        <select
          id={compact ? "branchSwitcherMobile" : "branchSwitcherDesktop"}
          className="form-select form-select-sm bg-light"
          value={activeBranchId ?? ""}
          onChange={(e) => {
            setActiveBranch(e.target.value);
            // Existing pages generally load on mount. A controlled reload here
            // guarantees every dashboard/report immediately re-runs with the new
            // global X-Branch-Id without requiring page-specific wiring.
            window.setTimeout(() => window.location.reload(), 40);
          }}
          aria-label="Branch / Campus"
          title="Branch / Campus"
          style={{ minWidth: compact ? 135 : 170, maxWidth: compact ? 170 : 230 }}
        >
          {allowAllBranches && <option value="all">All Branches</option>}
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}{branch.medium ? ` · ${branch.medium}` : ""}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
