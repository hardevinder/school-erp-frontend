import React, { useEffect, useMemo, useState } from "react";
import api from "../../api";
import { useBranch } from "../../branch/BranchContext";
import { useInstitution } from "../../institution/InstitutionContext";
import "./PremiumWorkspaceHero.css";

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

const WORKSPACES = [
  {
    value: "LMS",
    kicker: "Teaching & Learning",
    title: "Learning Management System",
    description: "Classes, content, homework, tests, assessments and results.",
    icon: "bi-mortarboard",
  },
  {
    value: "ERP",
    kicker: "Administration & Operations",
    title: "School ERP",
    description: "Students, fees, attendance, HR, transport and examinations.",
    icon: "bi-buildings",
  },
];

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

  return (
    <section className="premium-portal" aria-label="LMS and ERP workspace selector">
      <div className="premium-portal__head">
        <div className="premium-portal__identity">
          <div className={`premium-portal__crest ${logo ? "" : "show-fallback"}`}>
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
            <i className="bi bi-bank premium-portal__fallback" aria-hidden="true" />
          </div>

          <div className="premium-portal__copy">
            <span className="premium-portal__eyebrow">Institution Portal</span>
            <h1>{schoolName}</h1>
            <div className="premium-portal__meta">
              <span>{branchLabel}</span>
              <i aria-hidden="true" />
              <span>{roleLabel}</span>
              {schoolCode ? (
                <>
                  <i aria-hidden="true" />
                  <span>{schoolCode}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="premium-portal__hint">
          <span>LMS + ERP</span>
          <strong>Choose your workspace</strong>
        </div>
      </div>

      <div className="premium-portal__workspaces">
        {WORKSPACES.map((item) => {
          const selected = workspace === item.value;
          return (
            <button
              key={item.value}
              type="button"
              className={`premium-workspace-card ${selected ? "is-active" : ""}`}
              onClick={() => selectWorkspace(item.value)}
              aria-pressed={selected}
            >
              <span className="premium-workspace-card__icon">
                <i className={`bi ${item.icon}`} aria-hidden="true" />
              </span>

              <span className="premium-workspace-card__copy">
                <span className="premium-workspace-card__kicker">{item.kicker}</span>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </span>

              <span className="premium-workspace-card__action">
                <span>{selected ? "Current" : "Open"}</span>
                <i className={`bi ${selected ? "bi-check2" : "bi-arrow-right"}`} aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
