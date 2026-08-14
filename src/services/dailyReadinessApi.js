import api from "../api";

const dailyReadinessApi = {
  capabilities: () => api.get("/daily-readiness/capabilities"),
  classes: () => api.get("/daily-readiness/classes"),
  classDay: (params) => api.get("/daily-readiness/class-day", { params }),
  saveClassDay: (payload) => api.post("/daily-readiness/class-day", payload),
  monthlySummary: (params) => api.get("/daily-readiness/monthly-summary", { params }),
  myRecord: (params = {}) => api.get("/daily-readiness/me", { params }),
  downloadClassPdf: async (params) => {
    const response = await api.get("/daily-readiness/class-pdf", { params, responseType: "blob" });
    const blob = new Blob([response.data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Daily-Readiness-${params.class_id}-${params.section_id}-${params.month}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  },
};
export default dailyReadinessApi;
