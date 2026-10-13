/** Resolve locally stored uploads against the active API, including legacy host URLs. */
export function learningResourceUrl(file, apiBase = process.env.REACT_APP_API_URL || "http://localhost:3000") {
  const raw = String(file?.file_url || "").trim();
  const base = new URL(apiBase, window.location.origin);
  if (raw) {
    try {
      const url = new URL(raw.replace(/^uploads\//, "/uploads/"), base);
      if (!["http:", "https:"].includes(url.protocol)) return "";
      if (url.pathname.startsWith("/uploads/learning-resources/")) {
        return new URL(`${url.pathname}${url.search}${url.hash}`, base).href;
      }
      return url.href;
    } catch (_) { return ""; }
  }
  const storedName = String(file?.stored_name || "");
  if (!storedName || /[/\\]/.test(storedName) || [".", ".."].includes(storedName)) return "";
  return new URL(`/uploads/learning-resources/${encodeURIComponent(storedName)}`, base).href;
}
