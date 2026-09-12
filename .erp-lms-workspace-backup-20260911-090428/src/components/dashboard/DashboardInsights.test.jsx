import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import api from '../../api';
import DashboardInsights from './DashboardInsights';

jest.mock('../../api', () => ({ get: jest.fn() }));
jest.mock('recharts', () => {
  const React = require('react');
  const Container = ({ children }) => React.createElement('div', null, children);
  return { ResponsiveContainer: Container, BarChart: Container, Bar: Container, XAxis: () => null, YAxis: () => null, Tooltip: () => null, Cell: () => null };
});
let container, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  api.get.mockReset();
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = async (props) => {
  await act(async () => { root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DashboardInsights {...props} /></MemoryRouter>); });
};

test('teacher summary uses full unread total and keeps successful cards when one source fails', async () => {
  api.get.mockImplementation((url, options) => {
    if (url === '/api/assessments') return Promise.reject(new Error('Unavailable'));
    if (url === '/api/online-classes') return Promise.resolve({ data: { data: [] } });
    return Promise.resolve({ data: { data: options.params.unreadOnly ? [] : [{ id: 1, thread: { subject: 'Parent question', messages: [{ body: 'Please review' }] } }], pagination: { total: options.params.unreadOnly ? 42 : 1 } } });
  });
  await render({ role: 'teacher' });
  expect(container.textContent).toContain('42 unread conversations');
  expect(container.textContent).toContain('Parent question');
  expect(container.textContent).toContain('Summary unavailable');
  expect(container.textContent).toContain('No upcoming online classes');
});

test('student message requests carry admission and abort when the selected student changes', async () => {
  api.get.mockResolvedValue({ data: { data: [], pagination: { total: 0 } } });
  await render({ role: 'student', admission: 'A001' });
  const firstSignal = api.get.mock.calls[0][1].signal;
  expect(api.get.mock.calls).toHaveLength(2);
  expect(api.get.mock.calls[0][1].params.admissionNumber).toBe('A001');
  await render({ role: 'student', admission: 'A002' });
  expect(firstSignal.aborted).toBe(true);
  expect(api.get.mock.calls[2][1].params.admissionNumber).toBe('A002');
  expect(api.get.mock.calls.every(([url]) => url === '/messages/me')).toBe(true);
});

test('failed message requests display unavailable instead of a misleading zero', async () => {
  api.get.mockRejectedValue(new Error('Network error'));
  await render({ role: 'student', admission: 'A001' });
  expect(container.textContent).toContain('Unread count unavailable');
  expect(container.textContent).toContain('Messages unavailable');
  expect(container.textContent).not.toContain('0 unread');
});
