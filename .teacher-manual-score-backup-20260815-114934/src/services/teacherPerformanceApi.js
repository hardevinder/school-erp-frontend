import api from "../api";

const teacherPerformanceApi = {
  capabilities: () => api.get("/teacher-performance/capabilities"),
  teachers: (params = {}) => api.get("/teacher-performance/teachers", { params }),
  dashboard: (params = {}) => api.get("/teacher-performance/dashboard", { params }),
  myDashboard: (params = {}) => api.get("/teacher-performance/me", { params }),
  trend: (params = {}) => api.get("/teacher-performance/trend", { params }),
  teamSummary: (params = {}) => api.get("/teacher-performance/team-summary", { params }),
  weights: (params = {}) => api.get("/teacher-performance/weights", { params }),
  saveWeights: (payload) => api.put("/teacher-performance/weights", payload),
  overrides: (params = {}) => api.get("/teacher-performance/day-overrides", { params }),
  saveOverride: (payload) => api.post("/teacher-performance/day-overrides", payload),
  deleteOverride: (id) => api.delete(`/teacher-performance/day-overrides/${id}`),
  manualEntries: (params = {}) => api.get("/teacher-performance/manual-entries", { params }),
  createManualEntry: (payload) => api.post("/teacher-performance/manual-entries", payload),
  deleteManualEntry: (id) => api.delete(`/teacher-performance/manual-entries/${id}`),
  aiInsight: (payload) => api.post("/teacher-performance/ai-insight", payload),
  downloadPdf: async (params = {}) => {
    const response = await api.get("/teacher-performance/report.pdf", { params, responseType: "blob" });
    const blob = new Blob([response.data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Teacher-Performance-${params.teacher_user_id || "me"}-${params.month || "period"}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },
};

export default teacherPerformanceApi;
