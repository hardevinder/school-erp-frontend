const learningPaths = new Set([
  '/assignments', '/assignment-marking', '/my-assignments', '/assessments',
  '/online-classes', '/learning-resources', '/lesson-plan', '/lesson-plans', '/student-lesson-plans',
  '/syllabus-breakdown', '/digital-diary', '/student-diary', '/my-library',
  '/marks-entry', '/co-scholastic-entry', '/student-remarks-entry',
  '/report-card-generator', '/reports/classwise-result-summary',
  '/reports/final-result-summary', '/student-promotion-decision-entry',
  '/entrance-exam',
]);

export function workspaceForPath(path = '') {
  const clean = path.split('?')[0];
  return [...learningPaths].some((base) => clean === base || clean.startsWith(`${base}/`)) ? 'LMS' : 'ERP';
}

export function filterWorkspaceGroups(groups, workspace) {
  if (workspace === 'All') return groups;
  return groups.map((group) => ({ ...group, items: group.items.filter((item) =>
    item.path === '/dashboard' || workspaceForPath(item.path) === workspace
  ) })).filter((group) => group.items.length);
}

export function statusCounts(rows) {
  const counts = new Map();
  rows.forEach((row) => {
    const status = String(row.status || 'unspecified').replace(/_/g, ' ');
    counts.set(status, (counts.get(status) || 0) + 1);
  });
  return [...counts].map(([name, value]) => ({ name, value }));
}

export function upcomingClasses(rows, now = Date.now()) {
  return rows.filter((row) => {
    const start = new Date(row.start_time).getTime();
    const end = start + Number(row.duration_minutes || 0) * 60000;
    return !['cancelled', 'ended', 'completed'].includes(row.status) && end >= now;
  }).sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}
