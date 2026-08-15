import api from "../api";

const schoolAiApi = {
  capabilities: () => api.get("/school-ai/capabilities"),
  ask: (question, history = []) => api.post("/school-ai/ask", { question, history }),
};

export default schoolAiApi;
