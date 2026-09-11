import { waitForCalendarAnalysis } from "./calendarAnalysis";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
const tick = async () => {
  jest.advanceTimersByTime(2500);
  await new Promise(jest.requireActual("timers").setImmediate);
};

test("polls through processing and returns the review draft", async () => {
  const draft = { events: [{ title: "Holiday" }], notes: [] };
  const api = { get: jest.fn()
    .mockResolvedValueOnce({ data: { status: "processing" } })
    .mockResolvedValueOnce({ data: { status: "completed", result: draft } }) };
  const request = new AbortController();
  const result = waitForCalendarAnalysis(api, 2, "job-id", request.signal);
  await tick();
  await tick();
  await expect(result).resolves.toEqual(draft);
  expect(api.get).toHaveBeenCalledWith("/academic-calendars/2/ai-analyze/job-id", {
    signal: request.signal, timeout: 15000,
  });
});

test("retries a gateway failure without uploading again", async () => {
  const api = { get: jest.fn()
    .mockRejectedValueOnce({ response: { status: 504 } })
    .mockResolvedValueOnce({ data: { status: "completed", result: { notes: [] } } }) };
  const result = waitForCalendarAnalysis(api, 2, "job-id", new AbortController().signal);
  await tick();
  await tick();
  await expect(result).resolves.toEqual({ notes: [] });
});

test("reports terminal analysis failures", async () => {
  const api = { get: jest.fn().mockResolvedValue({ data: { status: "failed", error: "Unreadable scan" } }) };
  const result = waitForCalendarAnalysis(api, 2, "job-id", new AbortController().signal);
  await Promise.all([expect(result).rejects.toThrow("Unreadable scan"), tick()]);
});

test("stops polling when the modal closes", async () => {
  const api = { get: jest.fn() };
  const request = new AbortController();
  const result = waitForCalendarAnalysis(api, 2, "job-id", request.signal);
  request.abort();
  await expect(result).rejects.toMatchObject({ code: "ERR_CANCELED" });
  await tick();
  expect(api.get).not.toHaveBeenCalled();
});
