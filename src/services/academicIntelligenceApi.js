import api from "../api";
export default { overview: (params = {}) => api.get("/academic-intelligence/overview", { params }) };
