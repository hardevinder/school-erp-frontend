// src/components/Login.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import { auth, provider, signInWithPopup } from "../firebase/firebaseConfig";
import socket from "../socket";
import "./login.css"; // <-- add this line

// Priority order to pick default activeRole
const ROLE_ORDER = ["superadmin", "admin", "hr", "academic_coordinator", "teacher", "student"];

const joinRooms = (user, roles = []) => {
  if (roles.includes("student")) {
    socket.emit("joinRoom", { room: user.username });
    socket.emit("joinRoom", { room: "students" });
  }
  if (roles.includes("teacher") || roles.includes("academic_coordinator")) {
    socket.emit("joinRoom", { room: `teacher-${user.id}` });
    socket.emit("joinRoom", { room: "teachers" });
  }
  if (roles.includes("admin") || roles.includes("superadmin")) {
    socket.emit("joinRoom", { room: "admins" });
  }
};

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 533.5 544.3" aria-hidden="true">
    <path fill="#EA4335" d="M533.5 278.4c0-17.4-1.6-34.1-4.7-50.2H272v95.1h147.1c-6.3 34-25 62.8-53.3 82v67h86.2c50.4-46.5 81.5-115 81.5-193.9z"/>
    <path fill="#34A853" d="M272 544.3c72.3 0 132.9-23.9 177.2-65.1l-86.2-67c-24 16.1-54.6 25.7-91 25.7-69.9 0-129.1-47.2-150.3-110.7H33.7v69.6C77.8 490.3 168.8 544.3 272 544.3z"/>
    <path fill="#4A90E2" d="M121.7 327.2c-5.1-15.3-8-31.7-8-48.6s2.9-33.3 8-48.6V160.4H33.7C12.7 204.8 0 254.3 0 306.6c0 52.3 12.7 101.8 33.7 146.2l88-65.6z"/>
    <path fill="#FBBC05" d="M272 107.7c39.2 0 74.5 13.5 102.2 39.9l76.7-76.7C404.8 26.2 344.2 0 272 0 168.8 0 77.8 54 33.7 160.4l88 69.6C142.9 154.9 202.1 107.7 272 107.7z"/>
  </svg>
);

const Login = () => {
  const [login, setLogin] = useState("");          // email OR username
  const [password, setPassword] = useState("");
  const [school, setSchool] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);

  const navigate = useNavigate();
  const userInputRef = useRef(null);
  const apiBase = useMemo(() => process.env.REACT_APP_API_URL?.replace(/\/+$/, ""), []);

  // Focus first field & fetch school details
  useEffect(() => {
    userInputRef.current?.focus();
    axios
      .get(`${apiBase}/schools`)
      .then((res) => res.data?.length && setSchool(res.data[0]))
      .catch(() => {}); // silent fail
  }, [apiBase]);

  // Persist axios token on app boot if already logged in
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }, []);

  const afterAuth = (data) => {
    const { token, user, roles } = data;
    const roleArr = Array.isArray(roles) ? roles : roles ? [roles] : [];

    // Persist auth info
    if (remember) {
      localStorage.setItem("token", token);
      localStorage.setItem("roles", JSON.stringify(roleArr));
      localStorage.setItem("username", user.username);
      localStorage.setItem("userId", user.id);
      localStorage.setItem("name", user.name);
    } else {
      // session-only: store in-memory-like (fallback to localStorage but clear on unload)
      localStorage.setItem("token", token);
      localStorage.setItem("roles", JSON.stringify(roleArr));
      localStorage.setItem("username", user.username);
      localStorage.setItem("userId", user.id);
      localStorage.setItem("name", user.name);
      window.addEventListener("beforeunload", () => {
        localStorage.removeItem("token");
        localStorage.removeItem("roles");
        localStorage.removeItem("username");
        localStorage.removeItem("userId");
        localStorage.removeItem("name");
        localStorage.removeItem("activeRole");
      });
    }

    // legacy cleanup
    localStorage.removeItem("userRole");

    const defaultActive = ROLE_ORDER.find((r) => roleArr.includes(r)) || roleArr[0] || "";
    localStorage.setItem("activeRole", defaultActive);

    // Make token available to axios immediately
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    // notify listeners (e.g., header role chip)
    window.dispatchEvent(new Event("role-changed"));

    // Socket rooms
    joinRooms(user, roleArr);

    // Navigate to dashboard
    navigate("/dashboard", { replace: true });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await axios.post(`${apiBase}/users/login`, { login, password });
      afterAuth(data);
    } catch (err) {
      setError(err.response?.data?.error || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;
      const { data } = await axios.post(`${apiBase}/users/login`, {
        google_id: googleUser.uid,
        google_email: googleUser.email,
        google_name: googleUser.displayName,
        google_username: googleUser.email,
      });
      afterAuth(data);
    } catch (err) {
      setError(err.response?.data?.error || "Google login failed");
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const schoolLogoSrc =
    school?.logo ? `${apiBase}${school.logo}` : null;

  return (
    <div className="login-wrap">
      {/* Decorative gradient blobs */}
      <div className="blob blob-1" />
      <div className="blob blob-2" />

      <div className="container py-5">
        <div className="row justify-content-center g-0">
          <div className="col-12 col-lg-10">
            <div className="card login-card shadow-lg border-0 overflow-hidden">
              <div className="row g-0">
                {/* Brand / Illustration side (hidden on <lg) */}
                <div className="col-lg-6 d-none d-lg-flex align-items-stretch bg-brand">
                  <div className="brand-pane w-100 p-4 p-xl-5 d-flex flex-column justify-content-between">
                    <div>
                      {schoolLogoSrc ? (
                        <img
                          src={schoolLogoSrc}
                          alt={school?.name || "School"}
                          className="brand-logo mb-3"
                          onError={(e) => (e.currentTarget.style.display = "none")}
                        />
                      ) : (
                        <div className="brand-logo--placeholder mb-3">🏫</div>
                      )}
                      <h2 className="brand-title mb-2">{school?.name || "School ERP"}</h2>
                      <p className="brand-subtitle mb-0">
                        Welcome back! Manage academics, fees, attendance, HR, and more from a single dashboard.
                      </p>
                    </div>
                    <div className="brand-footer text-muted small">
                      <span>© {new Date().getFullYear()} {school?.name || "Your School"}</span>
                    </div>
                  </div>
                </div>

                {/* Form side */}
                <div className="col-12 col-lg-6 d-flex align-items-stretch">
                  <div className="p-4 p-sm-5 w-100">
                    <div className="text-center d-lg-none mb-4">
                      {schoolLogoSrc ? (
                        <img
                          src={schoolLogoSrc}
                          alt={school?.name || "School"}
                          className="mobile-logo"
                          onError={(e) => (e.currentTarget.style.display = "none")}
                        />
                      ) : (
                        <div className="brand-logo--placeholder mb-2">🏫</div>
                      )}
                      <h4 className="mb-0">{school?.name || "School ERP"}</h4>
                    </div>

                    <h3 className="fw-semibold mb-1">Sign in</h3>
                    <p className="text-muted mb-4">Use your username/email and password to continue.</p>

                    {error && (
                      <div className="alert alert-danger py-2" role="alert">
                        {error}
                      </div>
                    )}

                    <form onSubmit={handleLogin} noValidate>
                      <div className="mb-3">
                        <label className="form-label">User (Email or Username)</label>
                        <input
                          ref={userInputRef}
                          type="text"
                          className="form-control form-control-lg"
                          value={login}
                          onChange={(e) => setLogin(e.target.value)}
                          placeholder="e.g., principal@school.edu or admin01"
                          autoComplete="username"
                          required
                        />
                      </div>

                      <div className="mb-2">
                        <label className="form-label">Password</label>
                        <div className="input-group input-group-lg">
                          <input
                            type={showPass ? "text" : "password"}
                            className="form-control"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            autoComplete="current-password"
                            required
                          />
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => setShowPass((s) => !s)}
                            aria-label={showPass ? "Hide password" : "Show password"}
                          >
                            {showPass ? "Hide" : "Show"}
                          </button>
                        </div>
                      </div>

                      <div className="d-flex justify-content-between align-items-center mb-4">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="rememberMe"
                            checked={remember}
                            onChange={(e) => setRemember(e.target.checked)}
                          />
                          <label className="form-check-label" htmlFor="rememberMe">
                            Remember me
                          </label>
                        </div>
                        <button
                          type="button"
                          className="btn btn-link p-0 small"
                          onClick={() => navigate("/forgot-password")}
                        >
                          Forgot password?
                        </button>
                      </div>

                      <button
                        type="submit"
                        className="btn btn-primary btn-lg w-100 mb-3"
                        disabled={loading}
                      >
                        {loading ? "Signing in…" : "Login"}
                      </button>

                      <div className="text-center text-muted my-2">or</div>

                      <button
                        type="button"
                        className="btn btn-outline-dark btn-lg w-100 d-flex align-items-center justify-content-center gap-2"
                        onClick={handleGoogleLogin}
                        disabled={loading}
                      >
                        <GoogleIcon />
                        <span>{loading ? "Please wait…" : "Login with Google"}</span>
                      </button>
                    </form>

                    <div className="mt-4 small text-muted">
                      By continuing you agree to our{" "}
                      <button className="btn btn-link p-0 align-baseline" onClick={() => navigate("/terms")}>
                        Terms
                      </button>{" "}
                      and{" "}
                      <button className="btn btn-link p-0 align-baseline" onClick={() => navigate("/privacy")}>
                        Privacy Policy
                      </button>.
                    </div>

                    <div className="mt-4">
                      <div className="login-hint card border-0 bg-light-subtle">
                        <div className="card-body py-2 small text-muted">
                          Tip: You can use your email or username in the first field.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* /Form side */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
