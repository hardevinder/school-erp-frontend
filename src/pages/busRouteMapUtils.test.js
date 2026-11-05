import { uniqueStops, orderStops, estimatedNextStop, durationLabel } from "./busRouteMapUtils";

const school = { latitude: 28, longitude: 78, name: "School" };
const near = { latitude: 28.01, longitude: 78, person_type: "student", person_id: 1, person_name: "A", stop: "Near" };
const far = { latitude: 28.03, longitude: 78, person_type: "student", person_id: 2, person_name: "B", stop: "Far" };

test("groups colocated passengers, counts students separately, and deduplicates assignments", () => {
  const stops = uniqueStops([near, { ...near, assignment_id: 99 }, { ...near, person_id: 2 }, { ...near, person_type: "employee" }]);
  expect(stops).toHaveLength(1);
  expect(stops[0].passengers).toBe(3);
  expect(stops[0].studentCount).toBe(2);
  expect(stops[0].people).toHaveLength(3);
});

test("pickup and drop reverse the same suggested travel sequence", () => {
  expect(orderStops([far, near], school, "drop").map(s => s.stop)).toEqual(["Near", "Far"]);
  expect(orderStops([near, far], school, "pickup").map(s => s.stop)).toEqual(["Far", "Near"]);
});

test("infers a next stop from chronological GPS visits and ends pickup at school", () => {
  const pickup = orderStops([near, far], school, "pickup");
  expect(estimatedNextStop(pickup, school, far, [far]).stop).toBe("Near");
  expect(estimatedNextStop(pickup, school, near, [far, near])).toBe(school);
  expect(estimatedNextStop([...pickup].reverse(), null, far, [near, far])).toBeNull();
});

test("without GPS history uses nearest candidate and with no position gives no estimate", () => {
  expect(estimatedNextStop([near, far], school, far).stop).toBe("Far");
  expect(estimatedNextStop([near], school, null)).toBeNull();
});

test("unknown duration is distinct from a zero-minute first stop", () => {
  expect(durationLabel(null)).toBe("Unavailable");
  expect(durationLabel(Infinity)).toBe("Unavailable");
  expect(durationLabel(0)).toBe("0 min");
  expect(durationLabel(120000)).toBe("2 min");
});
