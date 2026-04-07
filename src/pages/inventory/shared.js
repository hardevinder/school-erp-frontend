export const statusBadge = (value) => {
  const v = String(value || "").toLowerCase();

  if (v.includes("cancel")) return "bg-danger";
  if (v.includes("issue")) return "bg-warning text-dark";
  if (v.includes("receive")) return "bg-success";
  if (v.includes("opening")) return "bg-primary";
  if (v.includes("transfer")) return "bg-info text-dark";
  if (v.includes("adjust")) return "bg-secondary";
  if (v.includes("active") || v === "enabled") return "bg-success";
  if (v.includes("inactive") || v === "disabled") return "bg-secondary";
  return "bg-light text-dark border";
};

export const safeLower = (value) => String(value || "").toLowerCase();

export const bySearch = (row, search, fields = []) => {
  const q = safeLower(search).trim();
  if (!q) return true;
  const blob = fields.map((field) => String(row?.[field] ?? "")).join(" ").toLowerCase();
  return blob.includes(q);
};

export const normalizeBooleanToStatus = (value) => {
  if (value === true || value === 1 || value === "1") return "active";
  if (value === false || value === 0 || value === "0") return "inactive";
  return value || "active";
};
