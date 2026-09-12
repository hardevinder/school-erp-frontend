import axios from "axios";
import { getActingAdmission } from "./utils/actingStudent";

// Which requests should get the admission param injected?
// Keep it broad but safe; skip if URL already carries /admission/:id or an ?admission=
const SHOULD_TAG = (url = "") => {
  const u = String(url);
  // don't touch absolute external URLs
  if (/^https?:\/\//i.test(u) && !u.includes(process.env.REACT_APP_API_URL || "")) {
    return false;
  }
  // if it already has /admission/<something> in the path, don't add param
  if (/\/admission\/[^/]+/i.test(u)) return false;
  // if param already present, skip
  if (/[?&]admission=/.test(u)) return false;

  // common student endpoints: attendance, assignments, diaries, timetable, "student" feeds, etc.
  return /(attendance\/student|student-assignments\/student|diaries\/student\/feed\/list|period-class-teacher-subject\/student\/timetable|studentsapp)/i.test(
    u
  );
};

axios.interceptors.request.use((config) => {
  try {
    const adm = getActingAdmission();
    if (adm) {
      // Always send header (backend can also use header if query not supported)
      config.headers = config.headers || {};
      config.headers["X-Acting-Admission"] = adm;

      // Add ?admission= to URLs where it helps (and is safe)
      if (config.url && SHOULD_TAG(config.url)) {
        const hasQuery = config.url.includes("?");
        const sep = hasQuery ? "&" : "?";
        config.url = `${config.url}${sep}admission=${encodeURIComponent(adm)}`;
      }
    }
  } catch {}
  return config;
});
