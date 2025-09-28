// src/utils/normalizeUploadedUrl.js

export function normalizeUploadedUrl(input) {
  if (!input) return null;
  const s = String(input).trim();

  try {
    // 1) If already a clean absolute URL, return as-is.
    if (s.startsWith("http://") || s.startsWith("https://")) {
      // if multiple http occurrences, keep last absolute URL (handles double-prefix bug)
      const matches = s.match(/https?:\/\//g);
      if (matches && matches.length > 1) {
        const lastIdx = s.lastIndexOf("http");
        return s.slice(lastIdx);
      }
      return s;
    }

    // 2) If string contains an absolute URL somewhere, extract the last one
    const lastHttpIdx = s.lastIndexOf("http://");
    const lastHttpsIdx = s.lastIndexOf("https://");
    const lastIdx = Math.max(lastHttpIdx, lastHttpsIdx);
    if (lastIdx !== -1) {
      return s.slice(lastIdx);
    }

    // 3) Otherwise treat as relative path and ensure leading slash
    if (s.startsWith("/")) return s;
    return `/${s}`;
  } catch (e) {
    return s;
  }
}

export default normalizeUploadedUrl;
