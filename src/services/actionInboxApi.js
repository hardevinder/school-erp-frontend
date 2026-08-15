import api from "../api";

const actionInboxApi = {
  list(params = {}) {
    return api.get("/action-inbox", { params });
  },
  count() {
    return api.get("/action-inbox/count");
  },
};

export default actionInboxApi;
