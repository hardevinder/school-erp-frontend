// src/api.js
import axios from "axios";

/**
 * axios instance
 * - fall back to localhost if env var is not set (helps local dev)
 * - you can set withCredentials: true if your API uses cookies
 */
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:3000",
  // withCredentials: false,
});

/**
 * Request interceptor
 * - attach bearer token if present
 * - guard when headers object is missing (some libs can create empty config)
 */
api.interceptors.request.use(
  (config) => {
    try {
      const raw = localStorage.getItem("token") || localStorage.getItem("authToken") || "";
      const token = raw && raw.startsWith("Bearer ") ? raw : raw ? `Bearer ${raw}` : "";

      config.headers = config.headers || {};
      if (token) config.headers.Authorization = token;
    } catch (err) {
      // reading localStorage can throw in some edge cases (e.g. privacy mode)
      // swallow the error and allow the request to continue without Authorization
      console.warn("api: failed to attach token", err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response interceptor
 * - central handling for 401 (unauthorized)
 * - ignore aborted/cancelled requests so they don't trigger login redirect
 * - avoid redirect loop: only redirect if not already on /login
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If request was cancelled/aborted (axios v1 uses 'CanceledError')
    const isCanceled =
      error?.code === "ERR_CANCELED" ||
      error?.name === "CanceledError" ||
      error?.message === "canceled";

    if (isCanceled) {
      // don't treat cancel as an application error
      return Promise.reject(error);
    }

    const status = error?.response?.status;

    if (status === 401) {
      try {
        // remove stored token(s)
        localStorage.removeItem("token");
        localStorage.removeItem("authToken");
        // only redirect if not already on login to prevent loop
        if (!window.location.pathname.startsWith("/login")) {
          // you could show a toast instead of alert; keep simple
          // optionally preserve current path and redirect back after login
          window.location.href = "/login";
        }
      } catch (err) {
        console.error("api: error handling 401:", err);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
