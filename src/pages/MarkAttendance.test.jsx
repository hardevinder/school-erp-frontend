/* eslint-disable testing-library/no-unnecessary-act, testing-library/no-render-in-setup */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import MarkAttendance from "./MarkAttendance";
import api from "../api";
import Swal from "sweetalert2";

jest.mock("../api", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock("sweetalert2", () => ({ __esModule: true, default: { fire: jest.fn() } }));
let container, root;
const click = async (element) => { expect(element).toBeTruthy(); await act(async () => Simulate.click(element)); };
const unmark = () => container.querySelector('[aria-label="Unmark attendance for Alice"]');
const status = (id, value) => container.querySelector(`input[name="attendance-${id}"][value="${value}"]`);
const select = async (id, value) => { await act(async () => Simulate.change(status(id, value), { target: { value } })); };
const save = () => [...container.querySelectorAll("button")].find((button) => button.textContent.trim() === "Update");

beforeEach(async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-10-12T06:00:00Z"));
  global.IS_REACT_ACT_ENVIRONMENT = true;
  Swal.fire.mockResolvedValue({ isConfirmed: true });
  api.get.mockImplementation(async (url) => ({ data:
    url === "/incharges/students" ? { students: [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }] } :
    url.startsWith("/attendance/date/") ? [{ studentId: 1, status: "present" }, { studentId: 2, status: "present" }] :
    url === "/attendance/settings" ? {} : []
  }));
  api.post.mockResolvedValue({ data: { deleted: 1, saved: 1 } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<MarkAttendance />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  jest.clearAllMocks();
  jest.useRealTimers();
});

test("unmarks only the selected student, preserves edits and excludes that student from save", async () => {
  await select(2, "absent");
  await click(unmark());
  expect(api.post).toHaveBeenCalledWith("/attendance/unmark", { date: "2026-10-12", studentIds: [1] });
  expect(status(1, "present").checked).toBe(false);
  expect(status(2, "absent").checked).toBe(true);
  expect(unmark()).toBeNull();
  await click(save());
  expect(api.post).toHaveBeenLastCalledWith("/attendance/bulk", { date: "2026-10-12", records: [{ studentId: 2, status: "absent", remarks: null }] });
});

test("an unmarked student can explicitly be marked present again", async () => {
  await click(unmark());
  await select(1, "present");
  expect(save().disabled).toBe(false);
  await click(save());
  expect(api.post.mock.calls.at(-1)[1].records).toContainEqual({ studentId: 1, status: "present", remarks: null });
});

test("cancel does not remove attendance", async () => {
  Swal.fire.mockResolvedValueOnce({ isConfirmed: false });
  await click(unmark());
  expect(api.post).not.toHaveBeenCalled();
  expect(status(1, "present").checked).toBe(true);
});

test("failed unmark retains saved attendance", async () => {
  api.post.mockRejectedValueOnce(new Error("Network error"));
  await click(unmark());
  expect(status(1, "present").checked).toBe(true);
  expect(unmark()).not.toBeNull();
  expect(Swal.fire).toHaveBeenLastCalledWith("Error", "Failed to unmark student attendance.", "error");
});


test("new dates start unmarked and submit only explicitly selected students", async () => {
  api.get.mockResolvedValue({ data: [] });
  await act(async () => Simulate.change(container.querySelector('input[type="date"]'), { target: { value: "2026-10-10" } }));
  expect(container.querySelectorAll('input[type="radio"]:checked')).toHaveLength(0);
  const submit = () => [...container.querySelectorAll("button")].find((button) => button.textContent.trim() === "Submit");
  expect(submit().disabled).toBe(true);
  await select(1, "present");
  expect(submit().disabled).toBe(false);
  await click(submit());
  expect(api.post).toHaveBeenLastCalledWith("/attendance/bulk", {
    date: "2026-10-10", records: [{ studentId: 1, status: "present", remarks: null }],
  });
});

test("All Present remains an explicit choice on a new date", async () => {
  api.get.mockResolvedValue({ data: [] });
  await act(async () => Simulate.change(container.querySelector('input[type="date"]'), { target: { value: "2026-10-10" } }));
  expect(container.querySelectorAll('input[type="radio"]:checked')).toHaveLength(0);
  await click([...container.querySelectorAll("button")].find((button) => button.textContent.trim() === "All Present"));
  expect(status(1, "present").checked).toBe(true);
  expect(status(2, "present").checked).toBe(true);
});

test("bulk Late Admission submits selected student and range while preserving other edits", async () => {
  window.scrollTo = jest.fn();
  await select(2, "absent");
  await click(container.querySelector('[aria-label="Bulk Late Admission for Alice"]'));
  await act(async () => Simulate.change(container.querySelector('#late-admission-from'), { target: { value: "2026-10-01" } }));
  api.post.mockResolvedValueOnce({ data: { saved: 10, skipped: 2, dates: ["2026-10-12"] } });
  await click([...container.querySelectorAll('button')].find(button => button.textContent === 'Mark Late Admission'));
  expect(api.post).toHaveBeenCalledWith('/attendance/late-admission-range', { studentId: 1, dateFrom: '2026-10-01', dateTo: '2026-10-12' });
  expect(status(1, 'late_admission').checked).toBe(true);
  expect(status(2, 'absent').checked).toBe(true);
});

test("cancel bulk confirmation leaves attendance unchanged", async () => {
  window.scrollTo = jest.fn();
  await click(container.querySelector('[aria-label="Bulk Late Admission for Alice"]'));
  Swal.fire.mockResolvedValueOnce({ isConfirmed: false });
  await click([...container.querySelectorAll('button')].find(button => button.textContent === 'Mark Late Admission'));
  expect(api.post).not.toHaveBeenCalled();
  expect(status(1, 'present').checked).toBe(true);
});
