export const reportDate = (date) => {
  if (!date) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
export const sessionOf = (row) => row.Session?.name || (row.session_id ? `Session ${row.session_id}` : "Unassigned");
export const receiptKey = (row) => JSON.stringify([row.session_id ?? row.Session?.id ?? null, row.Student_ID ?? row.Student?.id ?? row.Student?.admission_number ?? row.AdmissionNumber ?? null, row.Slip_ID ?? row.Serial]);
export const downloadReport = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};


// Report dates always follow the school's IST calendar.
export const formatTransactionDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric" });
};
export const formatRecordedDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) + " IST";
};
