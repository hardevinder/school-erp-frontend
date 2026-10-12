import { excludedFromReportTotals, reportLeaveDisplay, reportCountedMaximum } from './reportCardAttendance';

test.each(['ML', 'LA', ' ml ', 'ML/LA'])('%s is displayed and excluded even with stale numeric marks', (attendance) => {
  const row = { attendance, marks: 20, max_marks: 25, weightage_percent: 10 };
  expect(excludedFromReportTotals(row)).toBe(true);
  expect(reportLeaveDisplay([row])).toBe(attendance.trim().toUpperCase());
  expect(reportCountedMaximum(row)).toBe(0);
  expect(reportCountedMaximum(row, true)).toBe(0);
});

test('absent and unentered assessments retain their maximum', () => {
  for (const attendance of ['A', 'NOT_ENTERED', 'P']) {
    const row = { attendance, max_marks: 25, weightage_percent: 10 };
    expect(excludedFromReportTotals(row)).toBe(false);
    expect(reportCountedMaximum(row)).toBe(25);
    expect(reportCountedMaximum(row, true)).toBe(10);
  }
});

test('partial grouped exemptions use adjusted maximum while headings keep configured values', () => {
  const row = { attendance: 'P', max_marks: 10, weightage_percent: 10, counted_max_marks: 5, counted_weightage: 5 };
  expect(reportCountedMaximum(row)).toBe(5);
  expect(reportCountedMaximum(row, true)).toBe(5);
});
