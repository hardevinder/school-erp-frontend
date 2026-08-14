import api from "../api";
const BASE = "/student-health";
const data = (r) => r?.data || {};

export const studentHealthApi = {
  capabilities: async () => data(await api.get(`${BASE}/capabilities`)),
  settings: async () => data(await api.get(`${BASE}/settings`)),
  updateSettings: async (payload) => data(await api.put(`${BASE}/settings`, payload)),
  classes: async () => data(await api.get(`${BASE}/classes`)),
  dashboard: async (params = {}) => data(await api.get(`${BASE}/dashboard`, { params })),
  students: async (params = {}) => data(await api.get(`${BASE}/students`, { params })),
  student: async (id) => data(await api.get(`${BASE}/students/${id}`)),
  updateProfile: async (id, payload) => data(await api.patch(`${BASE}/students/${id}/profile`, payload)),
  verifyProfile: async (id) => data(await api.post(`${BASE}/students/${id}/profile/verify`, {})),
  addMeasurement: async (id, payload) => data(await api.post(`${BASE}/students/${id}/measurements`, payload)),
  bulkMeasurements: async (payload) => data(await api.post(`${BASE}/measurements/bulk`, payload)),
  addScreening: async (id, payload) => data(await api.post(`${BASE}/students/${id}/screenings`, payload)),
  downloadHealthCard: async (id) => {
    const response = await api.get(`${BASE}/students/${id}/health-card.pdf`, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },
};
export default studentHealthApi;
