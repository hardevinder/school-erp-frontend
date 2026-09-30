/* These tests use React DOM directly, not Testing Library. */
/* eslint-disable testing-library/no-unnecessary-act, testing-library/no-render-in-setup */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { MemoryRouter } from "react-router-dom";
import Assessments from "./Assessments";
import api from "../api";

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
  expect(container.querySelector('[role="alert"]').textContent).toContain("Choose a class and subject");
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
