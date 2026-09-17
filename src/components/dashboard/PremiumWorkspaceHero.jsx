import React, { useEffect, useMemo, useRef, useState } from "react";
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
  // WORKSPACE_DRAG_CUSTOMIZE_V1
  const [workspaceOrder, setWorkspaceOrder] = useState(["LMS", "ERP"]);
  const [isCustomizingWorkspaces, setIsCustomizingWorkspaces] = useState(false);
  const draggedWorkspaceRef = useRef(null);


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

  const workspaceOrderStorageKey = useMemo(() => {
    const institutionKey = school?.id || school?.school_id || schoolName || "institution";
    return `edubridge.workspace-order.${institutionKey}.${roleLabel}`;
  }, [school?.id, school?.school_id, schoolName, roleLabel]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(workspaceOrderStorageKey) || "null");
      const valid = Array.isArray(stored)
        ? stored.filter((value) => WORKSPACES.some((item) => item.value === value))
        : [];
      const missing = WORKSPACES.map((item) => item.value).filter((value) => !valid.includes(value));
      setWorkspaceOrder([...valid, ...missing]);
    } catch (_) {
      setWorkspaceOrder(WORKSPACES.map((item) => item.value));
    }
  }, [workspaceOrderStorageKey]);

  const orderedWorkspaces = useMemo(() => {
    const byValue = new Map(WORKSPACES.map((item) => [item.value, item]));
    const ordered = workspaceOrder.map((value) => byValue.get(value)).filter(Boolean);
    const missing = WORKSPACES.filter((item) => !workspaceOrder.includes(item.value));
    return [...ordered, ...missing];
  }, [workspaceOrder]);

  const persistWorkspaceOrder = (nextOrder) => {
    setWorkspaceOrder(nextOrder);
    try {
      localStorage.setItem(workspaceOrderStorageKey, JSON.stringify(nextOrder));
    } catch (_) {
      // localStorage can be unavailable in restricted/private browser modes.
    }
  };

  const handleWorkspaceDragStart = (event, value) => {
    if (!isCustomizingWorkspaces) {
      event.preventDefault();
      return;
    }
    draggedWorkspaceRef.current = value;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", value);
    // React's event.currentTarget may be null by the time requestAnimationFrame runs.
    // Capture the DOM node synchronously before leaving the event handler.
    const draggedElement = event.currentTarget;
    requestAnimationFrame(() => draggedElement?.classList.add("is-dragging"));
  };

  const handleWorkspaceDragOver = (event) => {
    if (!isCustomizingWorkspaces) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleWorkspaceDrop = (event, targetValue) => {
    if (!isCustomizingWorkspaces) return;
    event.preventDefault();
    const sourceValue = draggedWorkspaceRef.current || event.dataTransfer.getData("text/plain");
    if (!sourceValue || sourceValue === targetValue) return;

    const next = [...workspaceOrder];
    const sourceIndex = next.indexOf(sourceValue);
    const targetIndex = next.indexOf(targetValue);
    if (sourceIndex < 0 || targetIndex < 0) return;
    next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, sourceValue);
    persistWorkspaceOrder(next);
  };

  const handleWorkspaceDragEnd = (event) => {
    draggedWorkspaceRef.current = null;
    event.currentTarget?.classList?.remove("is-dragging");
  };

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

        <div className="premium-portal__head-actions">
          <div className="premium-portal__hint">
            <span>LMS + ERP</span>
            <strong>{isCustomizingWorkspaces ? "Drag cards to reorder" : "Choose your workspace"}</strong>
          </div>

          <button
            type="button"
            className={`premium-portal__customize ${isCustomizingWorkspaces ? "is-active" : ""}`}
            onClick={() => setIsCustomizingWorkspaces((current) => !current)}
            aria-pressed={isCustomizingWorkspaces}
            aria-label={isCustomizingWorkspaces ? "Finish customizing workspace order" : "Customize workspace order"}
            title={isCustomizingWorkspaces ? "Done" : "Customize"}
          >
            <i className={`bi ${isCustomizingWorkspaces ? "bi-check-lg" : "bi-sliders"}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="premium-portal__workspaces">
        {orderedWorkspaces.map((item) => {
          const selected = workspace === item.value;
          return (
            <button
              key={item.value}
              type="button"
              className={`premium-workspace-card ${selected ? "is-active" : ""} ${isCustomizingWorkspaces ? "is-customizing" : ""}`}
              onClick={() => {
                if (!isCustomizingWorkspaces) selectWorkspace(item.value);
              }}
              draggable={isCustomizingWorkspaces}
              onDragStart={(event) => handleWorkspaceDragStart(event, item.value)}
              onDragOver={handleWorkspaceDragOver}
              onDrop={(event) => handleWorkspaceDrop(event, item.value)}
              onDragEnd={handleWorkspaceDragEnd}
              aria-pressed={selected}
              aria-grabbed={isCustomizingWorkspaces ? undefined : false}
              title={isCustomizingWorkspaces ? `Drag ${item.value} to reorder` : undefined}
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
                {isCustomizingWorkspaces ? (
                  <>
                    <span>Drag</span>
                    <i className="bi bi-grip-vertical" aria-hidden="true" />
                  </>
                ) : (
                  <>
                    <span>{selected ? "Current" : "Open"}</span>
                    <i className={`bi ${selected ? "bi-check2" : "bi-arrow-right"}`} aria-hidden="true" />
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
