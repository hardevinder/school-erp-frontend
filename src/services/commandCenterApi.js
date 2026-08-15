import api from "../api";

const commandCenterApi = {
  summary: (params = {}) => api.get("/command-center/summary", { params }),
};

export default commandCenterApi;
