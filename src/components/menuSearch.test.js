import { searchMenuItems } from "./menuSearch";
const items = [
  { label: "Worksheets", group: "Academic", path: "/assessments?assessment_type=worksheet", workspace: "LMS" },
  { label: "Assignments", group: "Academic", path: "/assessments?assessment_type=assignment", workspace: "LMS" },
  { label: "Fee Collection", group: "Accounts", path: "/fees", workspace: "ERP" },
];
test("finds direct destinations across workspaces, including workspace and group terms", () => {
  expect(searchMenuItems(items, "worksheet")[0].path).toContain("assessment_type=worksheet");
  expect(searchMenuItems(items, "ERP fee")).toEqual([items[2]]);
  expect(searchMenuItems(items, " lms ACADEMIC ")).toHaveLength(2);
});
test("does not merge query-specific pages or show duplicate destinations", () => {
  expect(searchMenuItems([...items, { ...items[0], group: "Quick" }], "assessments")).toHaveLength(2);
});
test("does not truncate results or include inaccessible items", () => {
  const many = Array.from({ length: 75 }, (_, i) => ({ label: `Report ${i}`, path: `/report/${i}` }));
  expect(searchMenuItems(many, "report")).toHaveLength(75);
  expect(searchMenuItems([items[0]], "fee")).toEqual([]);
  expect(searchMenuItems(items, "   ")).toEqual([]);
});
