import React from "react";

export default function InventoryPageHeader({
  title,
  subtitle,
  actions = null,
  gradient = "linear-gradient(135deg, #0ea5e9, #6366f1)",
}) {
  const renderActions = () => {
    if (!actions) return null;

    // If already valid JSX, render directly
    if (!Array.isArray(actions)) {
      return actions;
    }

    // If array of config objects, render buttons
    return actions.map((action, index) => {
      if (!action) return null;

      const {
        label = "Action",
        onClick,
        className = "btn-light",
        type = "button",
        disabled = false,
      } = action;

      return (
        <button
          key={action.key || action.label || index}
          type={type}
          className={`btn rounded-4 ${className}`}
          onClick={onClick}
          disabled={disabled}
        >
          {label}
        </button>
      );
    });
  };

  return (
    <div
      className="d-flex flex-wrap align-items-center justify-content-between mb-3 rounded-4 p-3 shadow-sm"
      style={{
        background: gradient,
        color: "white",
        border: "1px solid rgba(255,255,255,0.15)",
      }}
    >
      <div>
        <h4 className="mb-1 fw-bold">{title}</h4>
        {subtitle ? <div className="opacity-75 small">{subtitle}</div> : null}
      </div>

      {actions ? (
        <div className="d-flex flex-wrap gap-2 align-items-center">
          {renderActions()}
        </div>
      ) : null}
    </div>
  );
}