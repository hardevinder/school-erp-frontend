export const DEFAULT_PORTAL_THEME = Object.freeze({
  primary: "#66131b",
  primaryDark: "#470a11",
  accent: "#c49a45",
  sidebarBg: "#fcf8f2",
  navbarBg: "#fffdf9",
  navbarTitle: "#66131b",
  navbarSubtitle: "#c49a45",
  dashboardBg: "#f6f3ee",
  surface: "#fffdfa",
  text: "#261f1d",
});

const safeHex = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toLowerCase() : fallback;

const hexToRgb = (hex) => {
  const value = safeHex(hex, "#000000").slice(1);
  return `${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)}`;
};

export function normalizePortalTheme(theme = {}) {
  const source = theme && typeof theme === "object" && !Array.isArray(theme) ? theme : {};
  return Object.keys(DEFAULT_PORTAL_THEME).reduce((acc, key) => {
    acc[key] = safeHex(source[key], DEFAULT_PORTAL_THEME[key]);
    return acc;
  }, {});
}

export function applyPortalTheme(themeConfig) {
  const theme = normalizePortalTheme(themeConfig);
  const root = document.documentElement;
  const values = {
    "--theme-primary": theme.primary,
    "--theme-primary-dark": theme.primaryDark,
    "--theme-accent": theme.accent,
    "--theme-sidebar-bg": theme.sidebarBg,
    "--theme-navbar-bg": theme.navbarBg,
    "--theme-navbar-title": theme.navbarTitle,
    "--theme-navbar-subtitle": theme.navbarSubtitle,
    "--theme-dashboard-bg": theme.dashboardBg,
    "--theme-surface": theme.surface,
    "--theme-text": theme.text,
    "--theme-primary-rgb": hexToRgb(theme.primary),
    "--theme-accent-rgb": hexToRgb(theme.accent),
  };
  Object.entries(values).forEach(([key, value]) => root.style.setProperty(key, value));
  return theme;
}

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
