import React, { useEffect, useMemo, useState } from "react";
import api from "../../api";
import { useBranch } from "../../branch/BranchContext";
import { useInstitution } from "../../institution/InstitutionContext";
import "./PremiumWorkspaceHero.css";

const ERP_FEATURES = ["Students", "Fees", "Attendance", "HR", "Transport", "Examination"];
const LMS_FEATURES = ["Classes", "Study Material", "Homework", "Tests", "Assessments", "Results"];

const titleCase = (value = "") =>
  String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const normalizeRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.schools)) return payload.schools;
  return [];
};

const resolveLogo = (school) => {
  const raw = school?.logo || school?.logo_url || school?.school_logo || school?.image || "";
  if (!raw) return "";
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("data:")) return raw;
  const base = String(process.env.REACT_APP_API_URL || "").replace(/\/+$/, "");
  return base ? `${base}/${String(raw).replace(/^\/+/, "")}` : raw;
};

export default function PremiumWorkspaceHero({
  workspace = "ERP",
  onSelectWorkspace,
  role = "",
}) {
  const { institution } = useInstitution();
  const { activeBranch, allBranches } = useBranch();
  const [fallbackSchool, setFallbackSchool] = useState(null);

  useEffect(() => {
    if (institution?.name) return undefined;

    const controller = new AbortController();
    api
      .get("/schools", { signal: controller.signal })
      .then(({ data }) => {
        const rows = normalizeRows(data);
        if (rows.length) setFallbackSchool(rows[0]);
      })
      .catch((error) => {
        if (error?.code !== "ERR_CANCELED" && error?.name !== "CanceledError") {
          console.warn("Dashboard branding could not be loaded:", error?.message || error);
        }
      });

    return () => controller.abort();
  }, [institution?.name]);

  const school = institution?.name ? institution : fallbackSchool || institution || {};
  const schoolName = school?.name || school?.school_name || "Your Institution";
  const schoolCode =
    school?.code ||
    school?.school_code ||
    school?.affiliation_no ||
    school?.affiliation_number ||
    "";
  const logo = useMemo(() => resolveLogo(school), [school]);
  const branchLabel = allBranches
    ? "All Branches"
    : activeBranch?.name || activeBranch?.branch_name || "Current Branch";
  const roleLabel = titleCase(role || "Administration");

  const selectWorkspace = (value) => {
    if (typeof onSelectWorkspace === "function") onSelectWorkspace(value);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const renderFolder = ({ value, eyebrow, title, description, icon, features }) => {
    const selected = workspace === value;
    return (
      <button
        type="button"
        className={`classic-workspace-folder ${selected ? "is-active" : ""}`}
        onClick={() => selectWorkspace(value)}
        aria-pressed={selected}
      >
        <span className="classic-workspace-folder__tab" aria-hidden="true" />
        <span className="classic-workspace-folder__shine" aria-hidden="true" />

        <span className="classic-workspace-folder__topline">
          <span className="classic-workspace-folder__icon">
            <i className={`bi ${icon}`} aria-hidden="true" />
          </span>
          <span className="classic-workspace-folder__state">
            {selected ? "Current Workspace" : "Open Workspace"}
          </span>
        </span>

        <span className="classic-workspace-folder__eyebrow">{eyebrow}</span>
        <span className="classic-workspace-folder__title">{title}</span>
        <span className="classic-workspace-folder__description">{description}</span>

        <span className="classic-workspace-folder__features" aria-label={`${title} modules`}>
          {features.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </span>

        <span className="classic-workspace-folder__action">
          {selected ? "You are here" : `Enter ${value}`}
          <i className={`bi ${selected ? "bi-check-circle-fill" : "bi-arrow-right"}`} aria-hidden="true" />
        </span>
      </button>
    );
  };

  return (
    <section className="classic-workspace-hero" aria-label="Institution workspace selector">
      <div className="classic-workspace-hero__ornament classic-workspace-hero__ornament--one" aria-hidden="true" />
      <div className="classic-workspace-hero__ornament classic-workspace-hero__ornament--two" aria-hidden="true" />

      <div className="classic-workspace-hero__header">
        <div className="classic-workspace-brand">
          <div className={`classic-workspace-brand__crest ${logo ? "" : "show-fallback"}`}>
            {logo ? (
              <img
                src={logo}
                alt=""
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                  event.currentTarget.parentElement?.classList.add("show-fallback");
                }}
              />
            ) : null}
            <i className="bi bi-bank2 classic-workspace-brand__fallback" aria-hidden="true" />
          </div>

          <div className="classic-workspace-brand__copy">
            <div className="classic-workspace-kicker">Institution Workspace</div>
            <h1>{schoolName}</h1>
            <div className="classic-workspace-meta">
              <span><i className="bi bi-diagram-3" aria-hidden="true" /> {branchLabel}</span>
              <span><i className="bi bi-person-badge" aria-hidden="true" /> {roleLabel}</span>
              {schoolCode ? <span><i className="bi bi-shield-check" aria-hidden="true" /> {schoolCode}</span> : null}
            </div>
          </div>
        </div>

        <div className="classic-workspace-hero__message">
          <span className="classic-workspace-hero__message-kicker">ERP + LMS</span>
          <strong>Everything organized. Nothing hidden.</strong>
          <small>Choose a workspace to continue.</small>
        </div>
      </div>

      <div className="classic-workspace-divider" aria-hidden="true">
        <span />
        <i className="bi bi-stars" />
        <span />
      </div>

      <div className="classic-workspace-folders">
        {renderFolder({
          value: "ERP",
          eyebrow: "Administration & Operations",
          title: "School ERP",
          description: "Run the institution's daily administration from one clear operational workspace.",
          icon: "bi-buildings-fill",
          features: ERP_FEATURES,
        })}
        {renderFolder({
          value: "LMS",
          eyebrow: "Teaching & Learning",
          title: "Learning Management System",
          description: "Manage learning, academic content, assessments and student progress in one place.",
          icon: "bi-mortarboard-fill",
          features: LMS_FEATURES,
        })}
      </div>
    </section>
  );
}
