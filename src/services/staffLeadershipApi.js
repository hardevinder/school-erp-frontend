import api from "../api";

export const getStaffLeadershipBootstrap = () => api.get("/staff-leadership/bootstrap").then((r) => r.data);
export const searchStaffLeadershipEmployees = (params) => api.get("/staff-leadership/employees", { params }).then((r) => r.data);
export const getStaffLeadershipAppointments = (params) => api.get("/staff-leadership/appointments", { params }).then((r) => r.data);
export const getMyStaffLeadership = () => api.get("/staff-leadership/me").then((r) => r.data);
export const createStaffLeadershipPosition = (body) => api.post("/staff-leadership/positions", body).then((r) => r.data);
export const updateStaffLeadershipPosition = (id, body) => api.patch(`/staff-leadership/positions/${id}`, body).then((r) => r.data);
export const createStaffLeadershipAppointment = (body) => api.post("/staff-leadership/appointments", body).then((r) => r.data);
export const endStaffLeadershipAppointment = (id, body) => api.post(`/staff-leadership/appointments/${id}/end`, body).then((r) => r.data);
export const addStaffLeadershipDuty = (id, body) => api.post(`/staff-leadership/appointments/${id}/duties`, body).then((r) => r.data);
export const updateStaffLeadershipDuty = (id, body) => api.patch(`/staff-leadership/duties/${id}`, body).then((r) => r.data);

function openPdfBlob(blob, fallbackName) {
  const pdfBlob = blob instanceof Blob ? blob : new Blob([blob], { type: "application/pdf" });
  const url = URL.createObjectURL(pdfBlob);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    const a = document.createElement("a");
    a.href = url;
    a.download = fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function openStaffLeadershipPdf(sessionId) {
  const r = await api.get("/staff-leadership/team.pdf", { params: { session_id: sessionId }, responseType: "blob" });
  openPdfBlob(r.data, `staff-leadership-${sessionId || "session"}.pdf`);
}

export async function openStaffLeadershipCertificatePdf(appointmentId) {
  const r = await api.get(`/staff-leadership/appointments/${appointmentId}/certificate.pdf`, { responseType: "blob" });
  openPdfBlob(r.data, `staff-leadership-appointment-${appointmentId}.pdf`);
}
