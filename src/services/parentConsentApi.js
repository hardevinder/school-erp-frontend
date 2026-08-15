import api from "../api";

const BASE = "/parent-consents";
const unwrap = (r) => r?.data || {};

function openBlob(response, fallbackName = "document") {
  const type = response.headers?.["content-type"] || "application/octet-stream";
  const blob = new Blob([response.data], { type });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return fallbackName;
}

const parentConsentApi = {
  async capabilities() { return unwrap(await api.get(`${BASE}/capabilities`)); },
  async catalog() { return unwrap(await api.get(`${BASE}/catalog`)); },
  async students(params = {}) { return unwrap(await api.get(`${BASE}/students`, { params })); },
  async requests(params = {}) { return unwrap(await api.get(`${BASE}/requests`, { params })); },
  async request(id) { return unwrap(await api.get(`${BASE}/requests/${id}`)); },
  async create(formData) {
    return unwrap(await api.post(`${BASE}/requests`, formData, { headers: { "Content-Type": "multipart/form-data" } }));
  },
  async issue(id) { return unwrap(await api.patch(`${BASE}/requests/${id}/issue`)); },
  async close(id) { return unwrap(await api.patch(`${BASE}/requests/${id}/close`)); },
  async remind(id) { return unwrap(await api.post(`${BASE}/requests/${id}/remind`)); },
  async verifyScan(recipientId) { return unwrap(await api.patch(`${BASE}/recipients/${recipientId}/verify-scan`)); },
  async rejectScan(recipientId, reason) { return unwrap(await api.patch(`${BASE}/recipients/${recipientId}/reject-scan`, { reason })); },
  async openForm(recipientId) {
    const response = await api.get(`${BASE}/recipients/${recipientId}/form`, { responseType: "blob" });
    return openBlob(response, "consent-form");
  },
  async openSignedScan(recipientId) {
    const response = await api.get(`${BASE}/recipients/${recipientId}/signed-scan`, { responseType: "blob" });
    return openBlob(response, "signed-consent");
  },
};

export default parentConsentApi;
