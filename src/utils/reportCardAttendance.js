export const excludedFromReportTotals = (row) => {
  const codes = String(row?.attendance || "").trim().toUpperCase().split("/");
  return codes.every((code) => ["ML", "LA"].includes(code.trim()));
};

export const reportLeaveDisplay = (rows = []) => [...new Set(rows
  .filter(excludedFromReportTotals)
  .flatMap((row) => String(row.attendance).trim().toUpperCase().split("/")))].join("/");

export const reportCountedMaximum = (row, weighted = false) => {
  if (excludedFromReportTotals(row)) return 0;
  const value = weighted
    ? row?.counted_weightage ?? row?.weightage_percent
    : row?.counted_max_marks ?? row?.max_marks;
  return Number.isFinite(Number(value)) ? Number(value) : 0;
};
