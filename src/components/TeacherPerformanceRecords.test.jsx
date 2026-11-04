/* eslint-disable testing-library/no-unnecessary-act */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import TeacherPerformanceRecords from "./TeacherPerformanceRecords";
import teacherPerformanceApi from "../services/teacherPerformanceApi";

jest.mock("../services/teacherPerformanceApi", () => ({ __esModule: true, default: { records: jest.fn() } }));
let container, root;
const response = (title = "Fractions") => ({ data: { data: { note: "Active diaries", period: { start: '2026-11-01', end: '2026-11-04' }, columns: [{ key: 'title', label: 'Entry' }], rows: [{ id: 1, title, content: 'Complete exercise two' }] } } });
const render = async (props = {}) => { await act(async () => root.render(<TeacherPerformanceRecords kind="DIARY" teacherId={42} teacherName="Ritu" month="2026-11" onClose={jest.fn()} {...props} />)); };
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  teacherPerformanceApi.records.mockResolvedValue(response());
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); jest.clearAllMocks(); });

test('loads selected teacher/month and shows searchable full diary content', async () => {
  await render();
  expect(teacherPerformanceApi.records).toHaveBeenCalledWith({ kind: 'DIARY', teacher_user_id: 42, month: '2026-11' });
  expect(document.querySelector('[role="dialog"]').textContent).toContain('Ritu');
  expect(document.querySelector('summary').textContent).toBe('Fractions');
  expect(document.querySelector('details').textContent).toContain('Complete exercise two');
  await act(async () => Simulate.change(document.querySelector('input[type="search"]'), { target: { value: 'nonexistent' } }));
  expect(document.body.textContent).toContain('No matching records');
});

test('failed request offers retry and does not show an empty success state', async () => {
  teacherPerformanceApi.records.mockRejectedValueOnce(new Error('offline'));
  await render();
  expect(document.querySelector('[role="alert"]').textContent).toContain('Unable to load');
  const retry = [...document.querySelectorAll('button')].find(b => b.textContent === 'Retry');
  await act(async () => Simulate.click(retry));
  expect(document.querySelector('summary').textContent).toBe('Fractions');
});

test('late responses from another teacher cannot overwrite current records', async () => {
  let finishOld;
  teacherPerformanceApi.records.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
  await render();
  await render({ teacherId: 43, teacherName: 'New teacher' });
  await act(async () => finishOld(response('Old teacher diary')));
  expect(document.querySelector('summary').textContent).toBe('Fractions');
  expect(document.body.textContent).not.toContain('Old teacher diary');
});

test('no records displays a clear empty state', async () => {
  const empty = response(); empty.data.data.rows = [];
  teacherPerformanceApi.records.mockResolvedValue(empty);
  await render();
  expect(document.body.textContent).toContain('No diaries records found');
});
