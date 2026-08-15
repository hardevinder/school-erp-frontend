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

function token() {
  return localStorage.getItem("authToken") || localStorage.getItem("token") || "";
}
function baseUrl() {
  return (process.env.REACT_APP_API_URL || "http://localhost:3000").replace(/\/$/, "");
}
export function councilPdfUrl(sessionId) {
  return `${baseUrl()}/student-leadership/council.pdf?session_id=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token())}`;
}
export function leadershipCertificatePdfUrl(appointmentId) {
  return `${baseUrl()}/student-leadership/appointments/${appointmentId}/certificate.pdf?token=${encodeURIComponent(token())}`;
}
