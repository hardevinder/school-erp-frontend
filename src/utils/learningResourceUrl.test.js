import { learningResourceUrl } from "./learningResourceUrl";
const base = "https://api.school.example";
const path = "/uploads/learning-resources/1790236179681-7531908-Class_9_Science_Chapter_Tissues_AI_Lesson_Source_Final.pdf";

test.each([`http://localhost:3000${path}`, `https://old.school.example${path}`, path, path.slice(1)])("resolves saved upload %s against the active API", (file_url) => {
  expect(learningResourceUrl({ file_url }, base)).toBe(`${base}${path}`);
});
test("preserves encoding, query and hash when replacing a legacy host", () => {
  expect(learningResourceUrl({ file_url: "http://localhost:3000/uploads/learning-resources/lesson%20one.pdf?download=1#page=2" }, base)).toBe(`${base}/uploads/learning-resources/lesson%20one.pdf?download=1#page=2`);
});
test("preserves external resources", () => {
  expect(learningResourceUrl({ file_url: "https://cdn.example/lesson.pdf" }, base)).toBe("https://cdn.example/lesson.pdf");
});
test("uses stored filename when the URL is absent", () => {
  expect(learningResourceUrl({ stored_name: "lesson one.pdf" }, base)).toBe(`${base}/uploads/learning-resources/lesson%20one.pdf`);
});
test("rejects unsafe protocols and invalid filename fallbacks", () => {
  expect(learningResourceUrl({ file_url: "javascript:alert(1)" }, base)).toBe("");
  expect(learningResourceUrl({ stored_name: "../secret" }, base)).toBe("");
  expect(learningResourceUrl({}, base)).toBe("");
});
