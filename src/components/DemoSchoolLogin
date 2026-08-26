// src/pages/Login.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import { auth, provider, signInWithPopup } from "../firebase/firebaseConfig";
import socket from "../socket";
import "./demoSchoolLogin.css";

const ROLE_ORDER = [
  "superadmin",
  "admin",
  "accounts",
  "hr",
  "academic_coordinator",
  "teacher",
  "student",
];

const joinRooms = (user, roles = []) => {
  const rl = roles.map((r) => (r || "").toLowerCase());

  if (rl.includes("student")) {
    socket.emit("joinRoom", { room: user.username });
    socket.emit("joinRoom", { room: "students" });
  }

  if (rl.includes("teacher") || rl.includes("academic_coordinator")) {
    socket.emit("joinRoom", { room: `teacher-${user.id}` });
    socket.emit("joinRoom", { room: "teachers" });
  }

  if (rl.includes("admin") || rl.includes("superadmin")) {
    socket.emit("joinRoom", { room: "admins" });
  }

  if (rl.includes("accounts")) {
    socket.emit("joinRoom", { room: "accounts" });
  }
};

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 533.5 544.3" aria-hidden="true">
    <path fill="#EA4335" d="M533.5 278.4c0-17.4-1.6-34.1-4.7-50.2H272v95.1h147.1c-6.3 34-25 62.8-53.3 82v67h86.2c50.4-46.5 81.5-115 81.5-193.9z"/>
    <path fill="#34A853" d="M272 544.3c72.3 0 132.9-23.9 177.2-65.1l-86.2-67c-24 16.1-54.6 25.7-91 25.7-69.9 0-129.1-47.2-150.3-110.7H33.7v69.6C77.8 490.3 168.8 544.3 272 544.3z"/>
    <path fill="#4A90E2" d="M121.7 327.2c-5.1-15.3-8-31.7-8-48.6s2.9-33.3 8-48.6V160.4H33.7C12.7 204.8 0 254.3 0 306.6c0 52.3 12.7 101.8 33.7 146.2l88-65.6z"/>
    <path fill="#FBBC05" d="M272 107.7c39.2 0 74.5 13.5 102.2 39.9l76.7-76.7C404.8 26.2 344.2 0 272 0 168.8 0 77.8 54 33.7 160.4l88 69.6C142.9 154.9 202.1 107.7 272 107.7z"/>
  </svg>
);

const EyeIcon = ({ open }) =>
  open ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" fill="none" stroke="currentColor" strokeWidth="1.7"/>
      <circle cx="12" cy="12" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.7"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3l18 18M10.6 6.2A10.5 10.5 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.2 2.9M6.1 7.3C3.8 9.1 2.5 12 2.5 12s3.5 6 9.5 6a10 10 0 0 0 4.1-.9M9.8 9.8a3.1 3.1 0 0 0 4.4 4.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  );

const Login = () => {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [school, setSchool] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);

  const navigate = useNavigate();
  const userInputRef = useRef(null);

  const apiBase = useMemo(
    () => process.env.REACT_APP_API_URL?.replace(/\/+$/, ""),
    []
  );

  const backgroundImage = `${process.env.PUBLIC_URL}/images/demoSchool.png`;
  const demoLogo = `${process.env.PUBLIC_URL}/images/DemoLogo.png`;

  useEffect(() => {
    userInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!apiBase) return;

    axios
      .get(`${apiBase}/schools`)
      .then((res) => {
        if (res.data?.length) setSchool(res.data[0]);
      })
      .catch(() => {});
  }, [apiBase]);

  useEffect(() => {
    const token =
      localStorage.getItem("token") || sessionStorage.getItem("token");

    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }
  }, []);

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (res) => res,
      (err) => {
        const status = err?.response?.status;

        if (status === 401) {
          delete axios.defaults.headers.common["Authorization"];

          [
            "token",
            "roles",
            "username",
            "userId",
            "name",
            "activeRole",
            "family",
            "activeStudentAdmission",
          ].forEach((key) => localStorage.removeItem(key));

          ["token", "roles", "username", "userId", "name"].forEach((key) =>
            sessionStorage.removeItem(key)
          );

          window.dispatchEvent(new Event("user-logged-out"));
          navigate("/login", { replace: true });
        }

        return Promise.reject(err);
      }
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, [navigate]);

  const afterAuth = async (data) => {
    const { token, user, roles } = data;
    const roleArr = Array.isArray(roles) ? roles : roles ? [roles] : [];
    const roleArrLower = roleArr.map((r) => (r || "").toLowerCase());

    try {
      const storage = remember ? localStorage : sessionStorage;
      storage.setItem("token", token);
      storage.setItem("roles", JSON.stringify(roleArr));
      storage.setItem("username", user.username);
      storage.setItem("userId", user.id);
      storage.setItem("name", user.name);

      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } catch (e) {
      console.warn("Storage failed", e);
    }

    try {
      if (data.family) {
        localStorage.setItem("family", JSON.stringify(data.family));
        localStorage.setItem(
          "activeStudentAdmission",
          data.family?.student?.admission_number || user.username
        );
      } else {
        localStorage.removeItem("family");
        localStorage.removeItem("activeStudentAdmission");
      }

      window.dispatchEvent(new Event("family-updated"));
    } catch (e) {
      console.warn("Failed to store family", e);
    }

    localStorage.removeItem("userRole");

    const defaultActive =
      ROLE_ORDER.find((r) => roleArrLower.includes(r)) ||
      roleArrLower[0] ||
      "";

    localStorage.setItem("activeRole", defaultActive);

    try {
      const fcm = window.FCMTOKEN;
      if (fcm) {
        axios
          .post(`${apiBase}/users/save-token`, {
            username: user.username,
            token: fcm,
          })
          .catch((e) => {
            console.warn("save-token failed", e?.response?.data || e.message);
          });
      }
    } catch (e) {
      console.warn("save-token call error", e);
    }

    try {
      if (token) {
        socket.auth = { token };
        if (socket.connected) socket.disconnect();
        socket.connect();
      }
    } catch (e) {
      console.warn("socket auth setup failed", e);
    }

    try {
      joinRooms(user, roleArrLower);
    } catch (e) {
      console.warn("joinRooms failed", e);
    }

    window.dispatchEvent(new Event("role-changed"));

    const redirectPath =
      defaultActive === "accounts" ? "/accounts-dashboard" : "/dashboard";

    navigate(redirectPath, { replace: true });
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!apiBase) {
      setError("API URL is not configured.");
      return;
    }

    if (!login.trim() || !password) {
      setError("Please enter your username/email and password.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const device = navigator.userAgent || "web";

      const { data } = await axios.post(`${apiBase}/users/login`, {
        login: login.trim(),
        password,
        device,
      });

      await afterAuth(data);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Invalid credentials";

      setError(msg);
      console.error("login error", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!apiBase) {
      setError("API URL is not configured.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;
      const device = navigator.userAgent || "web";

      const { data } = await axios.post(`${apiBase}/users/login`, {
        google_id: googleUser.uid,
        google_email: googleUser.email,
        google_name: googleUser.displayName,
        google_username: googleUser.email,
        device,
      });

      await afterAuth(data);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Google login failed";

      setError(msg);
      console.error("Google login error", err);
    } finally {
      setLoading(false);
    }
  };

  const schoolName = school?.name || "Demo School";

  return (
    <main className="demo-login">
      <section
        className="demo-login__visual"
        style={{ backgroundImage: `url("${backgroundImage}")` }}
        aria-label="Demo School campus"
      >
        <div className="demo-login__visual-overlay" />

        <div className="demo-login__visual-content">
          <div className="demo-login__mini-brand">
            <img src={demoLogo} alt="Demo School" />
            <span>DEMO SCHOOL</span>
          </div>

          <div className="demo-login__visual-copy">
            <span className="demo-login__eyebrow">
              SMART SCHOOL MANAGEMENT
            </span>

            <h1>
              One school.
              <br />
              One connected experience.
            </h1>

            <p>
              Academics, attendance, communication, fees, transport and
              administration — thoughtfully connected in one secure platform.
            </p>
          </div>

          <div className="demo-login__visual-footer">
            <span className="demo-login__dot" />
            Secure school access
          </div>
        </div>
      </section>

      <section className="demo-login__panel">
        <div className="demo-login__panel-inner">
          <div className="demo-login__brand-row">
            <img src={demoLogo} alt="Demo School logo" />
            <div>
              <span>DEMO SCHOOL</span>
              <small>School Management Portal</small>
            </div>
          </div>

          <div className="demo-login__heading">
            <h2>Welcome back</h2>
            <p>Sign in to continue to your school dashboard.</p>
          </div>

          {error && (
            <div className="demo-login__alert" role="alert">
              <span className="demo-login__alert-icon">!</span>
              <span>{error}</span>
            </div>
          )}

          <form className="demo-login__form" onSubmit={handleLogin} noValidate>
            <div className="demo-login__field">
              <label htmlFor="login">Username or email</label>

              <div className="demo-login__input-wrap">
                <span className="demo-login__input-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M4 20c.8-4 3.4-6 8-6s7.2 2 8 6M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
                  </svg>
                </span>

                <input
                  ref={userInputRef}
                  id="login"
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="Enter username or email"
                  autoComplete="username"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="demo-login__field">
              <div className="demo-login__label-row">
                <label htmlFor="password">Password</label>

                <button
                  type="button"
                  className="demo-login__forgot"
                  onClick={() => navigate("/forgot-password")}
                >
                  Forgot password?
                </button>
              </div>

              <div className="demo-login__input-wrap">
                <span className="demo-login__input-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <rect x="4" y="10" width="16" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7"/>
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
                  </svg>
                </span>

                <input
                  id="password"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={loading}
                  required
                />

                <button
                  type="button"
                  className="demo-login__eye"
                  onClick={() => setShowPass((value) => !value)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  <EyeIcon open={showPass} />
                </button>
              </div>
            </div>

            <label className="demo-login__remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                disabled={loading}
              />
              <span>Keep me signed in</span>
            </label>

            <button
              type="submit"
              className="demo-login__submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="demo-login__spinner" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign In
                  <span aria-hidden="true">→</span>
                </>
              )}
            </button>

            <div className="demo-login__divider">
              <span>or continue with</span>
            </div>

            <button
              type="button"
              className="demo-login__google"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <GoogleIcon />
              <span>Continue with Google</span>
            </button>
          </form>

          <div className="demo-login__security">
            <span className="demo-login__security-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 3 5 6v5c0 4.6 2.7 8 7 10 4.3-2 7-5.4 7-10V6l-7-3Z" fill="none" stroke="currentColor" strokeWidth="1.6"/>
                <path d="m9.2 12 1.8 1.8 3.8-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>

            <div>
              <strong>Secure access</strong>
              <span>Your sign-in is protected and encrypted.</span>
            </div>
          </div>

          <footer className="demo-login__footer">
            <span>© {new Date().getFullYear()} {schoolName}</span>

            <div>
              <button type="button" onClick={() => navigate("/privacy")}>
                Privacy
              </button>
              <span>•</span>
              <button type="button" onClick={() => navigate("/terms")}>
                Terms
              </button>
            </div>
          </footer>
        </div>
      </section>
    </main>
  );
};

export default Login;