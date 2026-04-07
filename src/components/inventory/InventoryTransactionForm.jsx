import React, { useEffect, useState } from "react";

export default function InventoryTransactionForm({
  title,
  subtitle,
  fields = [],
  initialValues = {},
  saving = false,
  onSubmit,
}) {
  const [form, setForm] = useState(initialValues);

  useEffect(() => {
    setForm(initialValues || {});
  }, [initialValues]);

  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.(form);
  };

  return (
    <div className="card shadow-sm rounded-4 border-0">
      <div className="card-body">
        <div className="mb-3">
          <h5 className="mb-1">{title}</h5>
          {subtitle ? <div className="text-muted">{subtitle}</div> : null}
        </div>

        <form onSubmit={handleSubmit}>
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

          <div className="mt-4 d-flex justify-content-end">
            <button type="submit" className="btn btn-primary rounded-4" disabled={saving}>
              {saving ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
