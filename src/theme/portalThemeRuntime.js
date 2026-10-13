// PORTAL_THEME_RUNTIME_V2
// Applies the saved institution theme to stable EduBridge CSS variables.

export const DEFAULT_PORTAL_THEME = Object.freeze({
  primary: "#66131b",
  primaryDark: "#470a11",
  accent: "#c49a45",
  sidebarBg: "#fcf8f2",
  sidebarText: "#261f1d",
  navbarBg: "#fffdf9",
  navbarTitle: "#66131b",
  navbarSubtitle: "#c49a45",
  dashboardBg: "#f6f3ee",
  surface: "#fffdfa",
  text: "#261f1d",
  inputText: "#261f1d",
});

const HEX = /^#[0-9a-f]{6}$/i;

export const normalizePortalTheme = (input) => {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const out = { ...DEFAULT_PORTAL_THEME };
  Object.keys(DEFAULT_PORTAL_THEME).forEach((key) => {
    const value = String(source[key] || "").trim();
    if (HEX.test(value)) out[key] = value.toLowerCase();
  });
  return out;
};

// Resolve text against its actual background; keep the requested color when readable.
const rgb = (hex) => hex.slice(1).match(/../g).map((part) => parseInt(part, 16));
const luminance = (hex) => rgb(hex).map((n) => {
  const c = n / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
export const contrastRatio = (a, b) => {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
};
export const readableText = (preferred, background) => {
  if (contrastRatio(preferred, background) >= 4.5) return preferred;
  return contrastRatio("#ffffff", background) > contrastRatio("#000000", background)
    ? "#ffffff" : "#000000";
};
const mix = (a, b, weight) => "#" + rgb(a).map((n, i) =>
  Math.round(n * weight + rgb(b)[i] * (1 - weight)).toString(16).padStart(2, "0")
).join("");

export function applyPortalTheme(themeConfig) {
  const theme = normalizePortalTheme(themeConfig);
  if (typeof document === "undefined") return theme;
  const root = document.documentElement;
  const values = {
    primary: theme.primary,
    "primary-dark": theme.primaryDark,
    accent: theme.accent,
    "sidebar-bg": theme.sidebarBg,
    "sidebar-text": readableText(theme.sidebarText, theme.sidebarBg),
    "navbar-bg": theme.navbarBg,
    "navbar-title": readableText(theme.navbarTitle, theme.navbarBg),
    "navbar-subtitle": readableText(theme.navbarSubtitle, theme.navbarBg),
    "dashboard-bg": theme.dashboardBg,
    surface: theme.surface,
    text: readableText(theme.text, theme.surface),
    "input-text": readableText(theme.inputText, theme.surface),
    "on-primary": readableText("#ffffff", theme.primary),
    "on-primary-dark": readableText("#ffffff", theme.primaryDark),
    "on-accent": readableText("#ffffff", theme.accent),
    "on-dashboard": readableText(theme.text, theme.dashboardBg),
    "primary-text": readableText(theme.primary, theme.surface),
    "primary-dark-text": readableText(theme.primaryDark, theme.surface),
    "accent-text": readableText(theme.accent, theme.surface),
    "primary-soft": mix(theme.primary, theme.surface, 0.1),
    "primary-soft-2": mix(theme.primary, theme.surface, 0.05),
    "accent-soft": mix(theme.accent, theme.surface, 0.12),
  };
  values["muted-text"] = readableText(mix(values.text, theme.surface, 0.72), theme.surface);
  values.border = mix(values.text, theme.surface, 0.22);
  values["on-primary-soft"] = readableText(theme.text, values["primary-soft"]);
  values["on-accent-soft"] = readableText(theme.text, values["accent-soft"]);
  Object.entries(values).forEach(([key, value]) => {
    root.style.setProperty(`--edb-${key}`, value);
    // Compatibility for existing consumers; all aliases come from this runtime.
    root.style.setProperty(`--theme-${key}`, value);
    root.style.setProperty(`--edb-saved-${key}`, value);
  });
  ["primary", "accent"].forEach((key) => {
    root.style.setProperty(`--edb-${key}-rgb`, rgb(theme[key]).join(", "));
    root.style.setProperty(`--theme-${key}-rgb`, rgb(theme[key]).join(", "));
  });
  root.style.setProperty("--edb-muted", values["muted-text"]);
  root.style.setProperty("--edb-input-muted", values["muted-text"]);
  root.dataset.portalTheme = "dynamic";
  return theme;
}
