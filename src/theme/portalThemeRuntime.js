// PORTAL_THEME_RUNTIME_V2
// Applies the saved institution theme to stable EduBridge CSS variables.

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

const HEX = /^#[0-9a-f]{6}$/i;

const cleanTheme = (input) => {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const out = { ...DEFAULT_PORTAL_THEME };
  Object.keys(DEFAULT_PORTAL_THEME).forEach((key) => {
    const value = String(source[key] || "").trim();
    if (HEX.test(value)) out[key] = value.toLowerCase();
  });
  return out;
};

export function applyPortalTheme(themeConfig) {
  if (typeof document === "undefined") return cleanTheme(themeConfig);

  const theme = cleanTheme(themeConfig);
  const root = document.documentElement;
  const map = {
    primary: "--edb-saved-primary",
    primaryDark: "--edb-saved-primary-dark",
    accent: "--edb-saved-accent",
    sidebarBg: "--edb-saved-sidebar-bg",
    navbarBg: "--edb-saved-navbar-bg",
    navbarTitle: "--edb-saved-navbar-title",
    navbarSubtitle: "--edb-saved-navbar-subtitle",
    dashboardBg: "--edb-saved-dashboard-bg",
    surface: "--edb-saved-surface",
    text: "--edb-saved-text",
  };

  Object.entries(map).forEach(([key, cssVar]) => {
    root.style.setProperty(cssVar, theme[key]);
  });

  root.dataset.portalTheme = "dynamic";
  return theme;
}
