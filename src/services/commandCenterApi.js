import api from "../api";

const commandCenterApi = {
  summary: (params = {}) => api.get("/command-center/summary", { params }),
  termOneSummary: (params = {}) => api.get("/command-center/term-one-summary", { params }),
};

export default commandCenterApi;
