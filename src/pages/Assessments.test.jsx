/* These tests use React DOM directly, not Testing Library. */
/* eslint-disable testing-library/no-unnecessary-act, testing-library/no-render-in-setup */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { MemoryRouter } from "react-router-dom";
import Assessments from "./Assessments";
import api from "../api";
import Swal from "sweetalert2";

jest.mock("sweetalert2", () => ({ __esModule: true, default: { fire: jest.fn().mockResolvedValue({}) } }));

jest.mock("../api", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));
let container, root;
const button = (text) => [...container.querySelectorAll("button")].find((el) => el.textContent.trim() === text);
const click = async (text) => { const el = button(text); expect(el).toBeTruthy(); await act(async () => { Simulate.click(el); }); };
const change = async (el, value) => { await act(async () => { Simulate.change(el, { target: { value } }); }); };
const next = async () => { await act(async () => { Simulate.submit(container.querySelector("form")); }); };
const setup = async () => {
  await click("Create Worksheet");
  await click("Class 5"); await click("Maths");
  await change(container.querySelector('input[placeholder="e.g. Fractions Practice Worksheet"]'), "Fractions practice");
  await next();
};
beforeEach(async () => {
  Swal.fire.mockResolvedValue({});
  global.IS_REACT_ACT_ENVIRONMENT = true;
  window.scrollTo = jest.fn(); Element.prototype.scrollIntoView = jest.fn();
  localStorage.setItem("roles", JSON.stringify(["teacher"]));
  api.get.mockImplementation(async (url) => ({ data: url.endsWith("/options") ? [{ class_id: 5, class_name: "Class 5", subject_id: 2, subject_name: "Maths", section_id: 1, section_name: "A" }] : [] }));
  api.post.mockResolvedValue({ data: {} });
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  await act(async () => { root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/assessments?assessment_type=worksheet"]}><Assessments /></MemoryRouter>); });
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); jest.clearAllMocks(); localStorage.clear(); });

test("validates setup and uses a normal page with only the active step", async () => {
  await click("Create Worksheet");
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  expect(button("Create Worksheet")).toBeUndefined();
  expect(container.querySelector(".assessment-question-sheet")).toBeNull();
  await next();
  expect(container.querySelector('[role="alert"]').textContent).toContain("Please complete: Class, Subject, Title.");
  expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: "warning", text: "Please complete: Class, Subject, Title." }));
  expect(api.post).not.toHaveBeenCalled();
});

test("preserves question and slider values across steps and saves the reviewed payload", async () => {
  await setup(); await click("Short");
  await change(container.querySelector('textarea[placeholder="Write the question or task here…"]'), "What is one half?");
  await change(container.querySelector('input[type="range"]'), "2");
  await next();
  expect(container.querySelector(".worksheet-step-heading h2").textContent).toBe("Delivery");
  await click("Back");
  expect(container.querySelector('input[type="range"]').value).toBe("2");
  expect(container.querySelector('textarea[placeholder="Write the question or task here…"]').value).toBe("What is one half?");
  await next(); await next();
  expect(container.querySelector(".worksheet-preview").textContent).toContain("What is one half?");
  expect(api.post).not.toHaveBeenCalled();
  await next();
  const [url, payload] = api.post.mock.calls[0];
  expect(url).toBe("/api/assessments");
  expect(payload.get("title")).toBe("Fractions practice");
  expect(payload.get("assessment_type")).toBe("worksheet");
  expect(JSON.parse(payload.get("questions"))[0]).toMatchObject({ question_text: "What is one half?", difficulty: "hard", question_type: "short" });
});

test("requires a scheduled publish time and allows returning to questions", async () => {
  await setup(); await click("Short");
  await change(container.querySelector('textarea[placeholder="Write the question or task here…"]'), "Explain fractions.");
  await next(); await click("Scheduled"); await next();
  expect(container.querySelector('[role="alert"]').textContent).toContain("future publishing date");
  await click("Back");
  expect(container.querySelector(".worksheet-step-heading h2").textContent).toBe("Write questions");
  expect(api.post).not.toHaveBeenCalled();
});

test("selects syllabus topics and subtopics without replacing handwritten focus", async () => {
  api.get.mockImplementation(async (url) => ({ data: url === "/syllabus-breakdowns/link-options" ? { data: [{ id: 1, academicSession: "2026-27", term: "FULL_YEAR", items: [{ id: 2, unitTitle: "Numbers", topics: "Fractions; Decimals", subtopics: "Equivalent fractions" }, { id: 3, unitTitle: "Geometry", topics: "Shapes", subtopics: "Triangles" }] }] } : [] }));
  await click("Create Worksheet");
  await click("Class 5"); await click("Maths");
  expect(api.get).toHaveBeenCalledWith("/syllabus-breakdowns/link-options", { params: { classId: "5", subjectId: "2" } });
  const focus = container.querySelector('textarea[placeholder="Write the chapter, topic, learning focus or task in your own words…"]');
  await change(focus, "Revise examples");
  await click("Numbers");
  expect(button("Numbers").getAttribute("aria-pressed")).toBe("true");
  expect(button("Shapes")).toBeUndefined();
  expect(button("Triangles")).toBeUndefined();
  await click("Fractions"); await click("Equivalent fractions");
  await click("Geometry");
  expect(button("Fractions")).toBeUndefined();
  expect(button("Triangles")).toBeTruthy();
  expect(focus.value).toBe("Revise examples\nFractions\nEquivalent fractions");
  await click("All units");
  expect(focus.value).toBe("Revise examples\nFractions\nEquivalent fractions");
  expect(button("Fractions").getAttribute("aria-pressed")).toBe("true");
  await click("Fractions");
  expect(focus.value).toBe("Revise examples\nEquivalent fractions");
  await change(container.querySelector('input[placeholder="e.g. Fractions Practice Worksheet"]'), "Revision");
  await next(); await click("Write on paper / upload"); await next(); await next(); await next();
  expect(api.post.mock.calls[0][1].get("description")).toBe("Revise examples\nEquivalent fractions");
});
