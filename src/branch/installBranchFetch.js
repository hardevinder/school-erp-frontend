// Install once to make legacy window.fetch API calls branch-aware too.
// Axios calls are covered separately by api.js/setupAxios.js.
export function installBranchFetch() {
  if (typeof window === "undefined" || window.__edubridgeBranchFetchInstalled) return;
  const originalFetch = window.fetch?.bind(window);
  if (!originalFetch) return;

  window.fetch = (input, init = {}) => {
    try {
      const active = localStorage.getItem("edubridgeActiveBranchId");
      const url = typeof input === "string" ? input : input?.url || "";
      if (active && !String(url).includes("/branches")) {
        const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
        if (!headers.has("X-Branch-Id")) headers.set("X-Branch-Id", active);
        init = { ...init, headers };
      }
    } catch (_) {}
    return originalFetch(input, init);
  };
  window.__edubridgeBranchFetchInstalled = true;
}
