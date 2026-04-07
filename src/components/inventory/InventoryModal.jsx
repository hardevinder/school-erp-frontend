import React, { useEffect, useState } from "react";

const backdropStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 1050,
};

export default function InventoryModal({
  open,
  title,
  fields = [],
  initialValues = {},
  submitLabel = "Save",
  saving = false,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(initialValues);

  useEffect(() => {
    setForm(initialValues || {});
  }, [initialValues, open]);

  if (!open) return null;

  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.(form);
  };

  return (
    <div style={backdropStyle}>
      <div className="card shadow rounded-4 border-0" style={{ width: "100%", maxWidth: 760 }}>
        <div className="card-header bg-white border-0 d-flex justify-content-between align-items-center">
          <h5 className="mb-0">{title}</h5>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="card-body">
            <div className="row g-3">
              {fields.map((field) => {
                const value = form?.[field.name] ?? "";
                const colClass = field.colClass || "col-md-6";

                if (field.type === "select") {
                  return (
                    <div className={colClass} key={field.name}>
                      <label className="form-label">{field.label}</label>
                      <select
                        className="form-select"
                        value={value}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        required={field.required}
                      >
                        <option value="">{field.placeholder || "Select"}</option>
                        {(field.options || []).map((opt) => (
                          <option key={String(opt.value)} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }

                if (field.type === "textarea") {
                  return (
                    <div className={colClass} key={field.name}>
                      <label className="form-label">{field.label}</label>
                      <textarea
                        className="form-control"
                        rows={field.rows || 3}
                        value={value}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        required={field.required}
                        placeholder={field.placeholder}
                      />
                    </div>
                  );
                }

                return (
                  <div className={colClass} key={field.name}>
                    <label className="form-label">{field.label}</label>
                    <input
                      type={field.type || "text"}
                      className="form-control"
                      value={value}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                      required={field.required}
                      placeholder={field.placeholder}
                      min={field.min}
                      step={field.step}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card-footer bg-white border-0 d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary rounded-4" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary rounded-4" disabled={saving}>
              {saving ? "Saving..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
