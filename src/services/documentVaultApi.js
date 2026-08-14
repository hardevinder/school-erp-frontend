import api from "../api";

const BASE = "/document-vault";

const unwrap = (response) => response?.data || {};

export const documentVaultApi = {
  async myVault(scope) {
    return unwrap(await api.get(`${BASE}/me`, { params: scope ? { scope } : {} }));
  },

  async uploadMine(formData) {
    return unwrap(
      await api.post(`${BASE}/me/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    );
  },

  async dashboard(ownerType) {
    return unwrap(
      await api.get(`${BASE}/dashboard`, {
        params: ownerType ? { owner_type: ownerType } : {},
      })
    );
  },

  async documentTypes(scope, includeInactive = false) {
    return unwrap(
      await api.get(`${BASE}/document-types`, {
        params: {
          ...(scope ? { scope } : {}),
          ...(includeInactive ? { include_inactive: 1 } : {}),
        },
      })
    );
  },

  async createDocumentType(payload) {
    return unwrap(await api.post(`${BASE}/document-types`, payload));
  },

  async updateDocumentType(id, payload) {
    return unwrap(await api.put(`${BASE}/document-types/${id}`, payload));
  },

  async subjects(ownerType, q = "", page = 1) {
    return unwrap(
      await api.get(`${BASE}/subjects`, {
        params: { owner_type: ownerType, q, page, limit: 40 },
      })
    );
  },

  async subjectVault(ownerType, ownerId) {
    return unwrap(await api.get(`${BASE}/subjects/${ownerType}/${ownerId}`));
  },

  async uploadFor(ownerType, ownerId, formData) {
    return unwrap(
      await api.post(`${BASE}/subjects/${ownerType}/${ownerId}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    );
  },

  async verify(id, note = "") {
    return unwrap(await api.patch(`${BASE}/documents/${id}/verify`, { note }));
  },

  async reject(id, reason) {
    return unwrap(await api.patch(`${BASE}/documents/${id}/reject`, { reason }));
  },

  async archive(id, scope) {
    return unwrap(
      await api.delete(`${BASE}/documents/${id}`, {
        params: scope ? { scope } : {},
      })
    );
  },

  async openDocument(doc, scope) {
    const response = await api.get(`${BASE}/documents/${doc.id}/download`, {
      params: scope ? { scope } : {},
      responseType: "blob",
    });
    const blob = new Blob([response.data], {
      type: response.headers?.["content-type"] || doc.mime_type || "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },

  async officialCapabilities() {
    return unwrap(await api.get(`${BASE}/official/capabilities`));
  },

  async officialMine(scope) {
    return unwrap(await api.get(`${BASE}/official/me`, { params: scope ? { scope } : {} }));
  },

  async officialTypes(recipientType, includeInactive = false) {
    return unwrap(await api.get(`${BASE}/official/types`, {
      params: {
        ...(recipientType ? { recipient_type: recipientType } : {}),
        ...(includeInactive ? { include_inactive: 1 } : {}),
      },
    }));
  },

  async createOfficialType(payload) {
    return unwrap(await api.post(`${BASE}/official/types`, payload));
  },

  async updateOfficialType(id, payload) {
    return unwrap(await api.put(`${BASE}/official/types/${id}`, payload));
  },

  async officialRecipients(ownerType, q = "") {
    return unwrap(await api.get(`${BASE}/official/recipients`, { params: { owner_type: ownerType, q, limit: 50 } }));
  },

  async officialDashboard() {
    return unwrap(await api.get(`${BASE}/official/dashboard`));
  },

  async officialIssued(params = {}) {
    return unwrap(await api.get(`${BASE}/official/issued`, { params }));
  },

  async issueOfficial(formData) {
    return unwrap(await api.post(`${BASE}/official/issue`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }));
  },

  async issueOfficialDraft(id) {
    return unwrap(await api.patch(`${BASE}/official/${id}/issue`));
  },

  async acknowledgeOfficial(id, note = "") {
    return unwrap(await api.patch(`${BASE}/official/${id}/acknowledge`, { note }));
  },

  async revokeOfficial(id, reason) {
    return unwrap(await api.patch(`${BASE}/official/${id}/revoke`, { reason }));
  },

  async officialAudit(id) {
    return unwrap(await api.get(`${BASE}/official/${id}/audit`));
  },

  async openOfficial(doc, scope) {
    const response = await api.get(`${BASE}/official/${doc.id}/download`, {
      params: scope ? { scope } : {},
      responseType: "blob",
    });
    const blob = new Blob([response.data], {
      type: response.headers?.["content-type"] || doc.mime_type || "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
};

export default documentVaultApi;
