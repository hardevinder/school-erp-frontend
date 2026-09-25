import React from "react";
import { useInstitution } from "../../institution/InstitutionContext";
import { useBranch } from "../../branch/BranchContext";
import "./AcademicBrandStrip.css";

const API_BASE = (process.env.REACT_APP_API_URL || "http://localhost:3000").replace(/\/+$/, "");
const assetUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(https?:|data:)/i.test(raw)) return raw;
  return `${API_BASE}${raw.startsWith("/") ? "" : "/"}${raw}`;
};

export default function AcademicBrandStrip({ documentType = "ACADEMIC WORK", title = "", className = "", subjectName = "", topic = "" }) {
  const { institution } = useInstitution();
  const { activeBranch, allBranches } = useBranch();
  const logo = assetUrl(institution?.logo || institution?.picture);
  const institutionName = institution?.name || institution?.school_name || "Institution";
  const branchName = !allBranches ? activeBranch?.name : "";
  const meta = [className, subjectName, topic].filter(Boolean);

  return (
    <div className="academic-brand-strip">
      <div className="academic-brand-strip__identity">
        {logo ? <img src={logo} alt="Institution logo" /> : <div className="academic-brand-strip__logo-fallback"><i className="bi bi-building" /></div>}
        <div className="min-w-0">
          <div className="academic-brand-strip__school">{institutionName}</div>
          {branchName && <div className="academic-brand-strip__branch">{branchName}</div>}
        </div>
      </div>
      <div className="academic-brand-strip__document">
        <span>{documentType}</span>
        {title && <strong>{title}</strong>}
        <div className="academic-brand-strip__meta">
          {meta.map((item, index) => <React.Fragment key={`${item}-${index}`}><span>{item}</span>{index < meta.length - 1 && <b>•</b>}</React.Fragment>)}
        </div>
      </div>
    </div>
  );
}
