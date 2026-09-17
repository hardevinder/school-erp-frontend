import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import api from "../api";
import { useInstitution } from "../institution/InstitutionContext";
import { applyPortalTheme, DEFAULT_PORTAL_THEME, normalizePortalTheme } from "../utils/institutionBranding";
import "./PortalThemeSettings.css";

const FIELDS = [
  ["primary", "Primary Color", "Main buttons, active items and brand highlights"],
  ["primaryDark", "Primary Dark", "Gradients and stronger active states"],
  ["accent", "Accent Color", "Borders, indicators and premium highlights"],
  ["sidebarBg", "Sidebar Background", "Left navigation background"],
  ["navbarBg", "Navbar Background", "Top navigation background"],
  ["dashboardBg", "Dashboard Background", "Main workspace background"],
  ["surface", "Card / Surface", "Cards, menus and panels"],
  ["text", "Text Color", "Primary readable text"],
];

const PRESETS = [
  { name: "Burgundy & Gold", theme: DEFAULT_PORTAL_THEME },
  { name: "Royal Blue", theme: { primary: "#164e8a", primaryDark: "#0b315c", accent: "#d6a84b", sidebarBg: "#f5f8fc", navbarBg: "#ffffff", dashboardBg: "#f2f6fb", surface: "#ffffff", text: "#1e293b" } },
  { name: "Emerald", theme: { primary: "#12634a", primaryDark: "#0a3f30", accent: "#d3a93f", sidebarBg: "#f4f9f6", navbarBg: "#ffffff", dashboardBg: "#f1f6f3", surface: "#ffffff", text: "#1f2d28" } },
  { name: "Indigo", theme: { primary: "#4338ca", primaryDark: "#29227e", accent: "#d4a72c", sidebarBg: "#f7f7fc", navbarBg: "#ffffff", dashboardBg: "#f4f4f8", surface: "#ffffff", text: "#26243a" } },
];

export default function PortalThemeSettings() {
  const { institution, refreshInstitution } = useInstitution();
  const [theme, setTheme] = useState(() => normalizePortalTheme(institution?.theme_config));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTheme(normalizePortalTheme(institution?.theme_config));
  }, [institution?.id, institution?.theme_config]);

  useEffect(() => {
    applyPortalTheme(theme);
  }, [theme]);

  useEffect(() => {
    const savedTheme = institution?.theme_config;
    return () => applyPortalTheme(savedTheme);
  }, [institution?.id, institution?.theme_config]);

  const institutionName = institution?.name || "Current Institution";
  const isDefault = useMemo(
    () => Object.keys(DEFAULT_PORTAL_THEME).every((key) => theme[key] === DEFAULT_PORTAL_THEME[key]),
    [theme]
  );

  const setColor = (key, value) => setTheme((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    try {
      setSaving(true);
      await api.put("/schools/current/theme", {
        school_id: institution?.id,
        theme_config: theme,
      });
      await refreshInstitution();
      Swal.fire({ icon: "success", title: "Theme saved", text: "The portal theme is now active for this institution.", timer: 1800, showConfirmButton: false });
    } catch (error) {
      Swal.fire("Unable to save theme", error?.response?.data?.error || error?.response?.data?.message || error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    const result = await Swal.fire({
      title: "Reset portal theme?",
      text: "Burgundy & Gold will become the default again.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Reset theme",
    });
    if (!result.isConfirmed) return;

    try {
      setSaving(true);
      await api.put("/schools/current/theme", { school_id: institution?.id, reset: true });
      setTheme({ ...DEFAULT_PORTAL_THEME });
      applyPortalTheme(DEFAULT_PORTAL_THEME);
      await refreshInstitution();
      Swal.fire({ icon: "success", title: "Default theme restored", timer: 1500, showConfirmButton: false });
    } catch (error) {
      Swal.fire("Unable to reset theme", error?.response?.data?.error || error?.response?.data?.message || error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-fluid py-4 portal-theme-settings portal-theme-aware">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <div className="text-uppercase small fw-bold portal-theme-kicker">Institution Settings</div>
          <h2 className="mb-1">Portal Theme</h2>
          <p className="text-muted mb-0">Customize Dashboard, Sidebar and Navbar colors for <strong>{institutionName}</strong>.</p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary" onClick={reset} disabled={saving || isDefault}>
            <i className="bi bi-arrow-counterclockwise me-2" />Reset Default
          </button>
          <button className="btn portal-theme-save" onClick={save} disabled={saving}>
            <i className="bi bi-check2-circle me-2" />{saving ? "Saving..." : "Save Theme"}
          </button>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-xl-7">
          <div className="card border-0 shadow-sm portal-theme-card">
            <div className="card-body p-4">
              <h5 className="mb-3">Color Palette</h5>
              <div className="row g-3">
                {FIELDS.map(([key, label, help]) => (
                  <div className="col-md-6" key={key}>
                    <label className="form-label fw-semibold">{label}</label>
                    <div className="portal-color-control">
                      <input type="color" value={theme[key]} onChange={(e) => setColor(key, e.target.value)} aria-label={`${label} color picker`} />
                      <input className="form-control text-uppercase" value={theme[key]} maxLength={7} onChange={(e) => setColor(key, e.target.value)} />
                    </div>
                    <div className="form-text">{help}</div>
                  </div>
                ))}
              </div>

              <hr className="my-4" />
              <h6 className="mb-3">Quick Presets</h6>
              <div className="d-flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
                  <button key={preset.name} type="button" className="btn btn-sm portal-preset" onClick={() => setTheme(normalizePortalTheme(preset.theme))}>
                    <span className="portal-preset-dot" style={{ background: preset.theme.primary }} />
                    <span className="portal-preset-dot" style={{ background: preset.theme.accent }} />
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-5">
          <div className="portal-preview-shell" style={{ background: theme.dashboardBg }}>
            <div className="portal-preview-navbar" style={{ background: theme.navbarBg }}>
              <div className="portal-preview-logo" style={{ color: theme.primary, borderColor: theme.accent }}><i className="bi bi-buildings" /></div>
              <div><strong style={{ color: theme.primary }}>{institutionName}</strong><small style={{ color: theme.accent }}>ERP & LMS PORTAL</small></div>
            </div>
            <div className="portal-preview-body">
              <aside style={{ background: theme.sidebarBg }}>
                {["Dashboard", "Students", "Academics", "Reports"].map((label, index) => (
                  <div key={label} className={`portal-preview-navitem ${index === 0 ? "active" : ""}`} style={index === 0 ? { color: theme.primary, borderColor: theme.accent } : { color: theme.text }}>
                    <span style={{ background: index === 0 ? theme.primary : theme.surface, color: index === 0 ? theme.accent : theme.primary }}><i className={`bi ${["bi-grid", "bi-people", "bi-journal-text", "bi-bar-chart"][index]}`} /></span>{label}
                  </div>
                ))}
              </aside>
              <main>
                <div className="portal-preview-hero" style={{ background: `linear-gradient(135deg, ${theme.primaryDark}, ${theme.primary})`, borderColor: theme.accent }}>
                  <small style={{ color: theme.accent }}>WELCOME BACK</small>
                  <strong>Dashboard Overview</strong>
                </div>
                <div className="portal-preview-cards">
                  {["Students", "Attendance", "Fee"].map((label, i) => <div key={label} style={{ background: theme.surface, color: theme.text }}><b style={{ color: i === 1 ? theme.accent : theme.primary }}>{[1248, "92%", "₹4.2L"][i]}</b><small>{label}</small></div>)}
                </div>
              </main>
            </div>
          </div>
          <div className="alert alert-light border mt-3 mb-0 small">
            <i className="bi bi-eye me-2" />Changes preview instantly. They are saved for all users only after clicking <strong>Save Theme</strong>.
          </div>
        </div>
      </div>
    </div>
  );
}
