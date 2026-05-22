// src/pages/Login.js
import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import { auth, provider, signInWithPopup } from "../firebase/firebaseConfig";
import socket from "../socket";
import "./login.css";

/* ---------------- Roles priority ---------------- */
const ROLE_ORDER = [
  "superadmin",
  "admin",
  "accounts",
  "hr",
  "academic_coordinator",
  "teacher",
  "student",
];

/* ---------------- BRANDING ---------------- */

const SCHOOL_NAME = "SIRHIND PUBLIC SCHOOL";
const SESSION_LABEL = "Session 2024-25";
const PORTAL_LABEL = "ERP Portal";

// images must exist in: public/images/
const BG_IMAGE = `${process.env.PUBLIC_URL}/images/SPSBackground.jpg`;
const LOGO_IMAGE = `${process.env.PUBLIC_URL}/images/SPS.jpeg`;

/* ---------------- Helpers ---------------- */

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
  <svg width="18" height="18" viewBox="0 0 533.5 544.3" aria-hidden="true">
    <path fill="#EA4335" d="M533.5 278.4c0-17.4-1.6-34.1-4.7-50.2H272v95.1h147.1c-6.3 34-25 62.8-53.3 82v67h86.2c50.4-46.5 81.5-115 81.5-193.9z" />
    <path fill="#34A853" d="M272 544.3c72.3 0 132.9-23.9 177.2-65.1l-86.2-67c-24 16.1-54.6 25.7-91 25.7-69.9 0-129.1-47.2-150.3-110.7H33.7v69.6C77.8 490.3 168.8 544.3 272 544.3z" />
    <path fill="#4A90E2" d="M121.7 327.2c-5.1-15.3-8-31.7-8-48.6s2.9-33.3 8-48.6V160.4H33.7C12.7 204.8 0 254.3 0 306.6c0 52.3 12.7 101.8 33.7 146.2l88-65.6z" />
    <path fill="#FBBC05" d="M272 107.7c39.2 0 74.5 13.5 102.2 39.9l76.7-76.7C404.8 26.2 344.2 0 272 0 168.8 0 77.8 54 33.7 160.4l88 69.6C142.9 154.9 202.1 107.7 272 107.7z" />
  </svg>
);

const Login = () => {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
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

  useEffect(() => {
    userInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const token =
      localStorage.getItem("token") || sessionStorage.getItem("token");

    if (token) {
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    }
  }, []);

  const setStorageValue = (key, value) => {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(key, value);
  };

  const afterAuth = async (data) => {
    const { token, user, roles } = data;

    const roleArr = Array.isArray(roles) ? roles : roles ? [roles] : [];
    const roleArrLower = roleArr.map((r) => (r || "").toLowerCase());

    setStorageValue("token", token);
    setStorageValue("roles", JSON.stringify(roleArr));
    setStorageValue("username", user.username || "");
    setStorageValue("userId", String(user.id || ""));
    setStorageValue("name", user.name || "");

    axios.defaults.headers.common.Authorization = `Bearer ${token}`;

    const defaultActive =
      ROLE_ORDER.find((r) => roleArrLower.includes(r)) ||
      roleArrLower[0] ||
      "";

    localStorage.setItem("activeRole", defaultActive);

    socket.auth = { token };
    if (socket.connected) socket.disconnect();
    socket.connect();

    joinRooms(user, roleArrLower);

    const redirectPath =
      defaultActive === "accounts" ? "/accounts-dashboard" : "/dashboard";

    navigate(redirectPath, { replace: true });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!apiBase) {
      setError("API URL is missing. Please check REACT_APP_API_URL.");
      return;
    }

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
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Invalid credentials"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");

    if (!apiBase) {
      setError("API URL is missing. Please check REACT_APP_API_URL.");
      return;
    }

    setLoading(true);

    try {
      const result = await signInWithPopup(auth, provider);
      const g = result.user;

      const { data } = await axios.post(`${apiBase}/users/login`, {
        google_id: g.uid,
        google_email: g.email,
        google_name: g.displayName,
        google_username: g.email,
      });

      await afterAuth(data);
    } catch {
      setError("Google login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="login-hero"
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: `linear-gradient(rgba(8,8,18,0.55), rgba(8,8,18,0.82)), url(${BG_IMAGE})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        padding: "20px",
      }}
    >
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-md-8 col-lg-5 col-xl-4">
            <div className="card glass-card border-0 shadow-lg">
              <div className="card-body p-4 p-sm-5 text-center">
                <img
                  src={LOGO_IMAGE}
                  alt={`${SCHOOL_NAME} Logo`}
                  style={{
                    maxWidth: 120,
                    height: 120,
                    objectFit: "contain",
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.92)",
                    padding: 8,
                  }}
                  className="mb-3 shadow-sm"
                />

                <div
                  className="d-inline-block px-3 py-1 rounded-pill mb-3"
                  style={{
                    background: "rgba(255,255,255,0.16)",
                    border: "1px solid rgba(255,255,255,0.28)",
                    color: "#fff",
                    fontWeight: 700,
                    letterSpacing: "0.4px",
                  }}
                >
                  {SESSION_LABEL}
                </div>

                <h4 className="text-white fw-bold mb-1">{SCHOOL_NAME}</h4>

                <p className="text-white-50 mb-4">
                  {PORTAL_LABEL} Login · {SESSION_LABEL}
                </p>

                {error && (
                  <div className="alert alert-danger text-start py-2">
                    {error}
                  </div>
                )}

                <form onSubmit={handleLogin}>
                  <input
                    ref={userInputRef}
                    className="form-control form-control-lg mb-3"
                    placeholder="Username / Email / Admission No."
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    autoComplete="username"
                    required
                  />

                  <div className="input-group input-group-lg mb-3">
                    <input
                      type={showPass ? "text" : "password"}
                      className="form-control"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />

                    <button
                      type="button"
                      className="btn btn-outline-light"
                      onClick={() => setShowPass((v) => !v)}
                    >
                      {showPass ? "Hide" : "Show"}
                    </button>
                  </div>

                  <div className="form-check text-start text-white-50 mb-3">
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
                    type="submit"
                    className="btn btn-primary btn-lg w-100 mb-3 fw-semibold"
                    disabled={loading}
                  >
                    {loading ? "Signing in..." : `Login for ${SESSION_LABEL}`}
                  </button>

                  <div className="text-white-50 my-2">or</div>

                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="btn btn-outline-light btn-lg w-100 d-flex justify-content-center align-items-center gap-2"
                    disabled={loading}
                  >
                    <GoogleIcon />
                    Login with Google
                  </button>
                </form>

                <div className="small text-white-50 mt-4">
                  © {new Date().getFullYear()} {SCHOOL_NAME}
                  <br />
                  {SESSION_LABEL}
                </div>
              </div>
            </div>

            <div className="text-center text-white-50 small mt-3">
              Secure access for school management system · {SESSION_LABEL}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;