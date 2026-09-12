import axios from "axios";

let installed = false;

// Covers legacy pages that import the default axios object directly instead of
// the shared src/api.js instance.
export function installBranchAxios() {
  if (installed) return;
  installed = true;
  axios.interceptors.request.use((config) => {
    try {
      config.headers = config.headers || {};
      const url = String(config.url || "");
      const active = localStorage.getItem("edubridgeActiveBranchId");
      if (active && !url.includes("/branches") && !config.headers["X-Branch-Id"]) {
        config.headers["X-Branch-Id"] = active;
      }
    } catch (_) {}
    return config;
  });
}
