import React, { useEffect, useMemo, useRef, useState } from "react";
import ClassTimetableAssignment from "./Timetable";
import TeacherTimetableAssignment from "./TeacherTimetableAssignment";
import "./CombinedTimetableAssignment.css";

const TABS = [
  { key: "class", label: "Class Wise" },
  { key: "teacher", label: "Teacher Wise" },
];

const getInitialTab = () => {
  try {
    const sp = new URLSearchParams(window.location.search);
    const fromUrl = sp.get("tab");
    if (fromUrl && TABS.some((t) => t.key === fromUrl)) return fromUrl;

    const fromStorage = localStorage.getItem("timetableActiveTab");
    if (fromStorage && TABS.some((t) => t.key === fromStorage)) return fromStorage;
  } catch {}
  return "class";
};

// Attach data-label="<header text>" to each TD based on its column header.
// This lets CSS show labels on mobile when we transform rows into cards.
function applyMobileLabels(root) {
  if (!root) return;

  const tables = root.querySelectorAll("table");
  tables.forEach((table) => {
    const thead = table.querySelector("thead");
    if (!thead) return;

    const headers = Array.from(thead.querySelectorAll("th")).map((th) =>
      (th.textContent || th.innerText || "").trim()
    );

    const rows = table.querySelectorAll("tbody tr");
    rows.forEach((tr) => {
      const cells = tr.querySelectorAll("td");
      cells.forEach((td, idx) => {
        // Preserve existing data-label if developer already set it.
        if (!td.getAttribute("data-label")) {
          const label = headers[idx] ?? "";
          if (label) td.setAttribute("data-label", label);
        }
        // Wrap text so value aligns right on mobile pattern
        // (only if not already wrapped by developer)
        if (!td.querySelector(".tt-cellv")) {
          const wrapper = document.createElement("span");
          wrapper.className = "tt-cellv";
          // Move all child nodes into wrapper
          while (td.firstChild) wrapper.appendChild(td.firstChild);
          td.appendChild(wrapper);
        }
      });
    });
  });
}

const CombinedTimetableAssignment = () => {
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const contentRef = useRef(null);
  const observerRef = useRef(null);

  // keep URL & localStorage in sync
  useEffect(() => {
    try {
      localStorage.setItem("timetableActiveTab", activeTab);
      const sp = new URLSearchParams(window.location.search);
      sp.set("tab", activeTab);
      const newUrl = `${window.location.pathname}?${sp.toString()}${window.location.hash}`;
      if (newUrl !== window.location.href) {
        window.history.replaceState({}, "", newUrl);
      }
    } catch {}
  }, [activeTab]);

  // Apply data-labels when tab changes and when content mutates (child renders)
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;

    // Initial run (next tick to allow child render)
    const t = setTimeout(() => applyMobileLabels(root), 0);

    // Observe mutations to re-apply on dynamic changes
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new MutationObserver(() => applyMobileLabels(root));
    observerRef.current.observe(root, {
      childList: true,
      subtree: true,
    });

    return () => {
      clearTimeout(t);
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [activeTab]);

  const activeLabel = useMemo(
    () => TABS.find((t) => t.key === activeTab)?.label || "Class Wise",
    [activeTab]
  );

  return (
    <div className="container mt-4">
      <h2 className="mb-3">Timetable Assignment</h2>

      {/* Desktop/Tablet tabs */}
      <div className="cta-tabs cta-sticky cta-desktop" role="tablist" aria-label="Timetable views">
        <div className="cta-tabrow">
          {TABS.map(({ key, label }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                className={`cta-tab ${isActive ? "is-active" : ""}`}
                onClick={() => setActiveTab(key)}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${key}`}
                id={`tab-${key}`}
                tabIndex={isActive ? 0 : -1}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile: select switcher */}
      <div className="cta-mobile mb-3">
        <label htmlFor="tabSelect" className="form-label cta-mobile-label">
          View
        </label>
        <select
          id="tabSelect"
          className="form-select cta-mobile-select"
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value)}
          aria-label="Select timetable view"
        >
          {TABS.map(({ key, label }) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Panels (wrapped in tt-responsive so child tables auto-adapt) */}
      <div className="tab-content tt-responsive" ref={contentRef}>
        <section
          id="panel-class"
          role="tabpanel"
          aria-labelledby="tab-class"
          hidden={activeTab !== "class"}
        >
          {activeTab === "class" && <ClassTimetableAssignment />}
        </section>

        <section
          id="panel-teacher"
          role="tabpanel"
          aria-labelledby="tab-teacher"
          hidden={activeTab !== "teacher"}
        >
          {activeTab === "teacher" && <TeacherTimetableAssignment />}
        </section>
      </div>
    </div>
  );
};

export default CombinedTimetableAssignment;
