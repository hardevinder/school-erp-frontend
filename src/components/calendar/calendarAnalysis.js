const delay = (ms, signal) => new Promise((resolve, reject) => {
  const cancel = () => {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
    reject(Object.assign(new Error("canceled"), { code: "ERR_CANCELED" }));
  };
  const timer = setTimeout(() => {
    signal.removeEventListener("abort", cancel);
    resolve();
  }, ms);
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
});

export async function waitForCalendarAnalysis(api, calendarId, analysisId, signal) {
  const deadline = Date.now() + 11 * 60 * 1000;
  while (Date.now() < deadline) {
    await delay(2500, signal);
    let data;
    try {
      ({ data } = await api.get(`/academic-calendars/${calendarId}/ai-analyze/${analysisId}`, {
        signal, timeout: 15000,
      }));
    } catch (error) {
      if (signal.aborted || error?.code === "ERR_CANCELED") throw error;
      // Polling is safe to retry; never re-upload after a transient failure.
      if (!error.response || error.response.status >= 500 || error.response.status === 429) continue;
      throw error;
    }
    if (data.status === "completed") return data.result;
    if (data.status === "failed") throw new Error(data.error || "Calendar analysis failed. Please try again.");
    if (data.status !== "processing") throw new Error("Unexpected calendar analysis status.");
  }
  throw new Error("Calendar analysis took too long. Please try again with a smaller document.");
}
