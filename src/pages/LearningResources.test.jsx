/* eslint-disable testing-library/no-unnecessary-act, testing-library/no-node-access */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import LearningResources from "./LearningResources";
import api from "../api";

jest.mock("../api", () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock("../components/syllabus/ProgramSyllabusDocuments", () => () => null);
jest.mock("../institution/InstitutionContext", () => ({ useInstitution: () => ({
  isCollege: true,
  terms: { class: "Program", classLower: "program", section: "Batch", sectionsLower: "batches" },
}) }));

test("shows mapped batches, resets selection on program change, and supports unmapped programs", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.setItem("roles", '["admin"]');
  api.get.mockImplementation(async (url) => ({ data:
    url.startsWith("/classes") ? [
      { id: 1, class_name: "BCA", section_ids: [10] },
      { id: 2, class_name: "BBA", section_ids: [20] },
      { id: 3, class_name: "Unmapped", section_ids: [] },
      { id: 4, class_name: "Legacy" },
    ] : url === "/sections" ? [
      { id: 10, section_name: "2026", class_id: null },
      { id: 20, section_name: "2025", class_id: 4 },
    ] : [],
  }));
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<LearningResources />));
    await act(async () => Simulate.click([...container.querySelectorAll("button")].find((b) => b.textContent.includes("Share Study Material"))));
    const [program, batch] = container.querySelectorAll(".lr-form-section select");
    const change = async (element, value) => act(async () => Simulate.change(element, { target: { value } }));
    const options = () => [...batch.options].map((o) => o.value);
    expect(batch.disabled).toBe(true);
    await change(program, "1");
    expect(options()).toEqual(["", "10"]);
    await change(batch, "10");
    await change(program, "2");
    expect(options()).toEqual(["", "20"]);
    expect(batch.value).toBe("");
    await change(program, "3");
    expect(options()).toEqual(["", "10", "20"]);
    await change(program, "4");
    expect(options()).toEqual(["", "20"]);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    localStorage.clear();
  }
});
