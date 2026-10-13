import { applyPortalTheme } from "../theme/portalThemeRuntime";
export { applyPortalTheme, DEFAULT_PORTAL_THEME, normalizePortalTheme } from "../theme/portalThemeRuntime";

// Update browser branding from the same institution record used by the UI.
export function applyInstitutionBranding(institution) {
  applyPortalTheme(institution?.theme_config);
  if (!institution?.name) return;
  const name = institution.name.trim();
  const title = `${name} | ERP & LMS Portal`;
  const description = institution.description || `${name}: your portal for academics, attendance, fees, examinations and campus updates.`;
  document.title = title;
  const setMeta = (attribute, key, value) => {
    let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
    if (!element) {
      element = document.createElement("meta");
      element.setAttribute(attribute, key);
      document.head.appendChild(element);
    }
    element.content = value;
  };
  setMeta("name", "description", description);
  setMeta("name", "author", name);
  setMeta("property", "og:title", title);
  setMeta("property", "og:site_name", name);
  setMeta("property", "og:description", description);
  setMeta("name", "twitter:title", title);
  setMeta("name", "twitter:description", description);
  const home = new URL(process.env.PUBLIC_URL || "/", window.location.origin).href;
  setMeta("property", "og:url", home);
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = home;
  const assetUrl = (path) => {
    if (!path) return "";
    try {
      const base = `${(process.env.REACT_APP_API_URL || window.location.origin).replace(/\/+$/, "")}/`;
      const url = new URL(path, base);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch (_) { return ""; }
  };
  const logo = assetUrl(institution.logo);
  document.head.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]').forEach((link) => {
    link.href = logo || `${process.env.PUBLIC_URL || ""}/institution-icon.svg`;
  });
  const image = assetUrl(institution.picture) || logo;
  setMeta("property", "og:image", image);
  setMeta("name", "twitter:image", image);
}
