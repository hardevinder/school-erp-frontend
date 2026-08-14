import api from "../api";

const q = (params = {}) => ({ params });

const anecdotalApi = {
  capabilities: () => api.get("/anecdotal-records/capabilities"),
  dimensions: () => api.get("/anecdotal-records/dimensions"),
  classes: () => api.get("/anecdotal-records/classes"),
  students: (params) => api.get("/anecdotal-records/students", q(params)),
  observations: (params) => api.get("/anecdotal-records/observations", q(params)),
  createObservation: (payload) => api.post("/anecdotal-records/observations", payload),
  updateObservation: (id, payload) => api.put(`/anecdotal-records/observations/${id}`, payload),
  archiveObservation: (id, reason) => api.patch(`/anecdotal-records/observations/${id}/archive`, { reason }),
  myRecord: () => api.get("/anecdotal-records/me"),
  classSummary: (params) => api.get("/anecdotal-records/class-summary", q(params)),
  leaderboard: (params) => api.get("/anecdotal-records/recognition/leaderboard", q(params)),
  recognitions: (params) => api.get("/anecdotal-records/recognition", q(params)),
  saveRecognition: (payload) => api.post("/anecdotal-records/recognition", payload),
  downloadClassPdf: async (params) => {
    const response = await api.get("/anecdotal-records/class-pdf", { params, responseType: "blob" });
    const blob = new Blob([response.data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Anecdotal-Class-${params.class_id}-${params.section_id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  },
};

export default anecdotalApi;
