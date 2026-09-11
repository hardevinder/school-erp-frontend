import { workspaceForPath, filterWorkspaceGroups, statusCounts, upcomingClasses } from './dashboardModel';

test('LMS assignment query links and lesson detail routes remain in learning workspace', () => {
  expect(workspaceForPath('/assessments?assessment_type=assignment')).toBe('LMS');
  expect(workspaceForPath('/lesson-plans/42/evaluations')).toBe('LMS');
  expect(workspaceForPath('/student-fee')).toBe('ERP');
  expect(workspaceForPath('/mark-attendance')).toBe('ERP');
});

test('workspace filtering preserves existing role-filtered links and does not mutate menus', () => {
  const groups = [{ heading: 'Daily Work', items: [{ path: '/dashboard' }, { path: '/assessments' }, { path: '/mark-attendance' }] }];
  expect(filterWorkspaceGroups(groups, 'LMS')[0].items.map((x) => x.path)).toEqual(['/dashboard', '/assessments']);
  expect(filterWorkspaceGroups(groups, 'ERP')[0].items.map((x) => x.path)).toEqual(['/dashboard', '/mark-attendance']);
  expect(groups[0].items).toHaveLength(3);
  expect(filterWorkspaceGroups(groups, 'All')).toBe(groups);
});

test('counts actual assessment statuses without inventing completion', () => {
  expect(statusCounts([{ status: 'draft' }, { status: 'draft' }, { status: 'result_published' }])).toEqual([
    { name: 'draft', value: 2 }, { name: 'result published', value: 1 },
  ]);
  expect(statusCounts([])).toEqual([]);
});

test('upcoming classes include ongoing sessions and exclude cancelled, completed and invalid dates', () => {
  const rows = [
    { id: 1, start_time: '2026-09-11T11:00:00Z', duration_minutes: 30, status: 'scheduled' },
    { id: 2, start_time: '2026-09-11T09:45:00Z', duration_minutes: 30, status: 'started' },
    { id: 3, start_time: '2026-09-11T09:00:00Z', duration_minutes: 30, status: 'scheduled' },
    { id: 4, start_time: '2026-09-11T11:00:00Z', duration_minutes: 30, status: 'cancelled' },
    { id: 5, start_time: 'invalid', status: 'scheduled' },
    { id: 6, start_time: '2026-09-11T11:00:00Z', status: 'completed' },
  ];
  expect(upcomingClasses(rows, Date.parse('2026-09-11T10:00:00Z')).map((x) => x.id)).toEqual([2, 1]);
});
