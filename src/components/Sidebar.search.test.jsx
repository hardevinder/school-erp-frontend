/* React DOM tests do not use Testing Library. */
/* eslint-disable testing-library/no-unnecessary-act, testing-library/no-render-in-setup */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { MemoryRouter, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
const mockSetWorkspace = jest.fn();
jest.mock("../hooks/useRoles", () => ({ useRoles: () => ({ activeRole: "admin" }) }));
jest.mock("../institution/InstitutionContext", () => ({ useInstitution: () => ({ isCollege: false }) }));
jest.mock("../hooks/useWorkspace", () => ({ defaultWorkspaceForRole: () => "ERP", useWorkspace: () => ({ workspace: "ERP", setWorkspace: mockSetWorkspace }) }));
jest.mock("./dashboard/DashboardInsights", () => ({ WorkspaceTabs: () => null }));
function Location() { const location = useLocation(); return <output>{location.pathname}{location.search}</output>; }
test("search displays LMS links inside the ERP sidebar and opens the exact page directly", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = () => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() });
  window.innerWidth = 1280;
  const container = document.createElement("div"); document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={["/dashboard"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Sidebar /><Location /></MemoryRouter>));
    const input = container.querySelector('input[aria-label="Search all ERP and LMS menus"]');
    await act(async () => Simulate.change(input, { target: { value: "worksheet" } }));
    const results = container.querySelector('aside [aria-label="Global menu search results"]');
    expect(results).not.toBeNull();
    expect(container.querySelector("#sidebar-submenu-panel")).toBeNull();
    expect(container.querySelector('[aria-label="Menu categories"]')).toBeNull();
    const result = [...results.querySelectorAll("button")].find((el) => el.textContent.includes("Worksheets"));
    expect(result.textContent).toContain("LMS");
    await act(async () => Simulate.click(result));
    expect(container.querySelector("output").textContent).toBe("/assessments?assessment_type=worksheet");
    expect(mockSetWorkspace).toHaveBeenCalledWith("LMS");
  } finally {
    await act(async () => root.unmount()); container.remove();
  }
});
