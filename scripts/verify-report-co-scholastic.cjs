const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const vm = require('vm');
const assert = require('assert');
// Exercise the actual page helpers without mounting its API-dependent UI.
const source = fs.readFileSync(require('path').join(__dirname, '../src/pages/ReportCardGenerator.jsx'), 'utf8');
const ast = parser.parse(source, { sourceType: 'module', plugins: ['jsx'] });
const wanted = ['normalizeSubjectType', 'isCoScholasticComponent', 'getCoScholasticSubjectNames', 'hasValidComponentRecord', 'isNumeric', 'hasAnyMarks', 'sumMarksOnly', 'sumWeightedOnly', 'sumMaxWeight', 'getSubjectTermStats', 'mergeCoScholasticSubjectRows'];
const defs = new Map();
traverse(ast, { VariableDeclarator(path) {
  if (wanted.includes(path.node.id.name)) defs.set(path.node.id.name, source.slice(path.node.start, path.node.end));
} });
const ctx = { term1Id: 1, term2Id: 2, gradeSchema: [],
  isCompInTerm: (c, id) => c.term_id === id,
  gradeFromSchema: p => p >= 80 ? 'A' : p >= 50 ? 'B' : 'C',
  pickGrade: rows => rows.find(r => r.grade)?.grade || '-',
};
vm.createContext(ctx);
vm.runInContext(wanted.map(n => 'const ' + defs.get(n) + ';').join('\n') + '\nthis.stats=getSubjectTermStats;this.merge=mergeCoScholasticSubjectRows;', ctx);
const student = { components: [10, 90].map((marks, i) => ({
  component_id: i + 1, subject_id: 2, subject_name: 'GK', subject_type: 'Co-Scholastic',
  term_id: 1, marks, max_marks: 100, weighted_marks: marks * (i ? 0.8 : 0.2), weightage_percent: i ? 80 : 20,
})) };
assert.equal(ctx.stats(student, 'GK', 1).grade, 'B');
const map = new Map([[1, { area_name: 'Discipline', serial_order: 1, t1: { grade: 'A' } }], [2, { area_name: 'GK', t1: { grade: 'A' } }]]);
ctx.merge(map, student);
assert.deepEqual(Array.from(map.values()).map(r => r.area_name), ['GK', 'Discipline']);
assert.equal(map.get(2).t1.grade, 'B');
assert.equal(map.get(2).t2.grade, '-');
student.components[1].weighted_marks = null;
student.components[1].marks = null;
assert.equal(ctx.stats(student, 'GK', 1).grade, '-');
student.components.forEach(row => { row.marks = 0; row.weighted_marks = 0; });
assert.equal(ctx.stats(student, 'GK', 1).grade, 'C');
student.components.forEach(row => { row.marks = null; row.weighted_marks = null; row.grade = 'A'; });
assert.equal(ctx.stats(student, 'GK', 1).grade, 'A');
console.log('Report card grade, ordering, deduplication, zero, direct-grade and pending-term checks passed');
