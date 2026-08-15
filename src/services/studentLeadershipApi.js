import api from "../api";

export const getLeadershipBootstrap = () => api.get("/student-leadership/bootstrap").then((r) => r.data);
export const searchLeadershipStudents = (params) => api.get("/student-leadership/students", { params }).then((r) => r.data);
export const getLeadershipAppointments = (params) => api.get("/student-leadership/appointments", { params }).then((r) => r.data);
export const createLeadershipWing = (body) => api.post("/student-leadership/wings", body).then((r) => r.data);
export const updateLeadershipWing = (id, body) => api.patch(`/student-leadership/wings/${id}`, body).then((r) => r.data);
export const createLeadershipPosition = (body) => api.post("/student-leadership/positions", body).then((r) => r.data);
export const updateLeadershipPosition = (id, body) => api.patch(`/student-leadership/positions/${id}`, body).then((r) => r.data);
export const createLeadershipAppointment = (body) => api.post("/student-leadership/appointments", body).then((r) => r.data);
export const endLeadershipAppointment = (id, body) => api.post(`/student-leadership/appointments/${id}/end`, body).then((r) => r.data);
export const addLeadershipDuty = (id, body) => api.post(`/student-leadership/appointments/${id}/duties`, body).then((r) => r.data);
export const updateLeadershipDuty = (id, body) => api.patch(`/student-leadership/duties/${id}`, body).then((r) => r.data);


function openPdfBlob(blob, fallbackName = "document.pdf") {
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

export async function openCouncilPdf(sessionId) {
  const r = await api.get("/student-leadership/council.pdf", {
    params: { session_id: sessionId },
    responseType: "blob",
  });
  openPdfBlob(r.data, `student-council-${sessionId || "session"}.pdf`);
}

export async function openLeadershipCertificatePdf(appointmentId) {
  const r = await api.get(`/student-leadership/appointments/${appointmentId}/certificate.pdf`, {
    responseType: "blob",
  });
  openPdfBlob(r.data, `leadership-appointment-${appointmentId}.pdf`);
}
