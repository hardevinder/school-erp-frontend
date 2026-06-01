import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import { auth, provider, signInWithPopup } from "../firebase/firebaseConfig";
import socket from "../socket";
import "./login.css";

// Role preference ordering
const ROLE_ORDER = [
  "superadmin",
  "admin",
  "accounts",
  "hr",
  "academic_coordinator",
  "teacher",
  "student",
];

// Put your new branch background first
const BG_CANDIDATES = [
  `${process.env.PUBLIC_URL}/images/tpis_vijay_pur_background.png`,
  `${process.env.PUBLIC_URL}/images/SchooBackground.jpeg`,
  `${process.env.PUBLIC_URL}/image/SchooBackground.jpeg`,
];

function resolveFirstExistingImage(candidates) {
  return new Promise((resolve) => {
    let resolved = false;
    let remaining = candidates.length;

    if (!remaining) return resolve(null);

    candidates.forEach((src) => {
      const img = new Image();
      img.onload = () => {
        if (!resolved) {
          resolved = true;
          resolve(src);
        }
      };
      img.onerror = () => {
        remaining -= 1;
        if (remaining === 0 && !resolved) resolve(null);
      };
      img.src = src;
    });
  });
}

// Join socket rooms depending on roles
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
    <path
      fill="#EA4335"
      d="M533.5 278.4c0-17.4-1.6-34.1-4.7-50.2H272v95.1h147.1c-6.3 34-25 62.8-53.3 82v67h86.2c50.4-46.5 81.5-115 81.5-193.9z"
    />
    <path
      fill="#34A853"
      d="M272 544.3c72.3 0 132.9-23.9 177.2-65.1l-86.2-67c-24 16.1-54.6 25.7-91 25.7-69.9 0-129.1-47.2-150.3-110.7H33.7v69.6C77.8 490.3 168.8 544.3 272 544.3z"
    />
    <path
      fill="#4A90E2"
      d="M121.7 327.2c-5.1-15.3-8-31.7-8-48.6s2.9-33.3 8-48.6V160.4H33.7C12.7 204.8 0 254.3 0 306.6c0 52.3 12.7 101.8 33.7 146.2l88-65.6z"
    />
    <path
      fill="#FBBC05"
      d="M272 107.7c39.2 0 74.5 13.5 102.2 39.9l76.7-76.7C404.8 26.2 344.2 0 272 0 168.8 0 77.8 54 33.7 160.4l88 69.6C142.9 154.9 202.1 107.7 272 107.7z"
    />
  </svg>
);

const Login = () => {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [school, setSchool] = useState(null);
  const [bgUrl, setBgUrl] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);

  const navigate = useNavigate();
  const userInputRef = useRef(null);
  const apiBase = useMemo(() => process.env.REACT_APP_API_URL?.replace(/\/+$/, ""), []);

  useEffect(() => {
    userInputRef.current?.focus();
  }, []);

  // Fetch school info
  useEffect(() => {
    if (!apiBase) return;

    axios
      .get(`${apiBase}/schools`)
      .then((res) => {
        if (res.data?.length) setSchool(res.data[0]);
      })
      .catch(() => {});
  }, [apiBase]);

  // Apply stored token
  useEffect(() => {
    const token =
      localStorage.getItem("token") || sessionStorage.getItem("token");
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }
  }, []);

  // Resolve background image
  useEffect(() => {
    (async () => {
      const found = await resolveFirstExistingImage(BG_CANDIDATES);
      setBgUrl(found);
    })();
  }, []);

  // Global axios interceptor
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (res) => res,
      (err) => {
        const status = err?.response?.status;
        if (status === 401) {
          delete axios.defaults.headers.common["Authorization"];
          localStorage.removeItem("token");
          localStorage.removeItem("roles");
          localStorage.removeItem("username");
          localStorage.removeItem("userId");
          localStorage.removeItem("name");
          localStorage.removeItem("activeRole");
          localStorage.removeItem("family");
          localStorage.removeItem("activeStudentAdmission");
          sessionStorage.removeItem("token");
          sessionStorage.removeItem("roles");
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
      if (remember) {
        localStorage.setItem("token", token);
        localStorage.setItem("roles", JSON.stringify(roleArr));
        localStorage.setItem("username", user.username);
        localStorage.setItem("userId", user.id);
        localStorage.setItem("name", user.name);
      } else {
        sessionStorage.setItem("token", token);
        sessionStorage.setItem("roles", JSON.stringify(roleArr));
        sessionStorage.setItem("username", user.username);
        sessionStorage.setItem("userId", user.id);
        sessionStorage.setItem("name", user.name);
      }

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
      (roleArrLower[0] || "");

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
    setError("");
    setLoading(true);

    try {
      const device = navigator.userAgent || "web";
      const { data } = await axios.post(`${apiBase}/users/login`, {
        login,
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

  const fallbackLogo = `${process.env.PUBLIC_URL}/images/pts_logo.png`;
  const schoolLogoSrc = school?.logo
    ? `${apiBase}${school.logo}`
    : fallbackLogo;

  const schoolName = school?.name || "Pathseekers International School";
  const campusName = "Vijaypur Campus";
  const schoolTagline =
    school?.description ||
    "Smart campus operations for academics, fees, attendance and administration.";

  return (
    <div
      style={{
        minHeight: "100dvh",
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#071120",
        backgroundImage: bgUrl
          ? `linear-gradient(135deg, rgba(4,10,24,0.88), rgba(8,23,45,0.78)), url(${bgUrl})`
          : "linear-gradient(135deg, #071120, #0b2545)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Soft overlay circles */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at top left, rgba(255,255,255,0.12), transparent 28%), radial-gradient(circle at bottom right, rgba(255,255,255,0.08), transparent 24%)",
          pointerEvents: "none",
        }}
      />

      <div className="container py-4 py-lg-5 position-relative">
        <div className="row justify-content-center align-items-center min-vh-100">
          <div className="col-12 col-xl-11">
            <div
              className="shadow-lg overflow-hidden"
              style={{
                borderRadius: "28px",
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
              }}
            >
              <div className="row g-0">
                {/* Left showcase panel */}
                <div className="col-lg-6 d-none d-lg-block">
                  <div
                    style={{
                      minHeight: "760px",
                      height: "100%",
                      position: "relative",
                      padding: "42px",
                      color: "#fff",
                      backgroundImage: bgUrl
                        ? `linear-gradient(180deg, rgba(5,16,36,0.30), rgba(5,16,36,0.82)), url(${bgUrl})`
                        : "linear-gradient(180deg, rgba(8,25,50,0.95), rgba(10,38,77,0.92))",
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    <div className="d-flex align-items-center gap-3 mb-4">
                      <div
                        style={{
                          width: 70,
                          height: 70,
                          borderRadius: "18px",
                          background: "rgba(255,255,255,0.16)",
                          display: "grid",
                          placeItems: "center",
                          border: "1px solid rgba(255,255,255,0.20)",
                          overflow: "hidden",
                          flexShrink: 0,
                        }}
                      >
                        <img
                          src={schoolLogoSrc}
                          alt="School Logo"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            padding: "8px",
                          }}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = fallbackLogo;
                          }}
                        />
                      </div>

                      <div>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 12,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            padding: "7px 12px",
                            borderRadius: "999px",
                            background: "rgba(255,255,255,0.12)",
                            border: "1px solid rgba(255,255,255,0.18)",
                            marginBottom: 10,
                          }}
                        >
                          Branch Portal
                        </div>
                        <h4 className="mb-0 fw-bold">{schoolName}</h4>
                      </div>
                    </div>

                    <div className="mb-4">
                      <h1
                        className="fw-bold mb-3"
                        style={{
                          fontSize: "clamp(2rem, 3vw, 3.4rem)",
                          lineHeight: 1.1,
                        }}
                      >
                        Welcome to
                        <br />
                        {campusName}
                      </h1>
                      <p
                        className="mb-0"
                        style={{
                          fontSize: "1.04rem",
                          color: "rgba(255,255,255,0.82)",
                          maxWidth: "520px",
                          lineHeight: 1.7,
                        }}
                      >
                        A refreshed branch login experience with a distinct campus
                        identity, while keeping your existing ERP login system,
                        Google login, roles, token handling, and dashboard flow
                        unchanged.
                      </p>
                    </div>

                    <div className="row g-3 mt-4">
                      <div className="col-12">
                        <div
                          style={{
                            borderRadius: "22px",
                            background: "rgba(255,255,255,0.10)",
                            border: "1px solid rgba(255,255,255,0.16)",
                            padding: "18px 20px",
                          }}
                        >
                          <div className="small text-uppercase opacity-75 mb-2">
                            Campus Access
                          </div>
                          <div className="fw-semibold fs-5">
                            Secure login for students, teachers, accounts and
                            admins
                          </div>
                        </div>
                      </div>

                      <div className="col-md-6">
                        <div
                          style={{
                            borderRadius: "20px",
                            background: "rgba(255,255,255,0.08)",
                            border: "1px solid rgba(255,255,255,0.14)",
                            padding: "18px",
                            height: "100%",
                          }}
                        >
                          <div className="fw-semibold mb-2">Academic Control</div>
                          <div className="small text-white-50">
                            Attendance, timetable, results, assignments and student
                            engagement tools.
                          </div>
                        </div>
                      </div>

                      <div className="col-md-6">
                        <div
                          style={{
                            borderRadius: "20px",
                            background: "rgba(255,255,255,0.08)",
                            border: "1px solid rgba(255,255,255,0.14)",
                            padding: "18px",
                            height: "100%",
                          }}
                        >
                          <div className="fw-semibold mb-2">Admin & Accounts</div>
                          <div className="small text-white-50">
                            Fees, reports, payroll, notifications and branch
                            operations in one place.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      className="mt-4"
                      style={{
                        borderTop: "1px solid rgba(255,255,255,0.14)",
                        paddingTop: "20px",
                      }}
                    >
                      <div className="small text-white-50 mb-2">
                        Branch Message
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.92)" }}>
                        {schoolTagline}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right form panel */}
                <div className="col-lg-6">
                  <div
                    style={{
                      minHeight: "760px",
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,251,255,0.94))",
                      padding: "28px 22px",
                    }}
                  >
                    <div
                      className="mx-auto d-flex flex-column justify-content-center h-100"
                      style={{ maxWidth: "470px" }}
                    >
                      {/* Mobile header */}
                      <div className="d-lg-none text-center mb-4">
                        <img
                          src={schoolLogoSrc}
                          alt="School Logo"
                          style={{
                            width: "82px",
                            height: "82px",
                            objectFit: "contain",
                            marginBottom: "14px",
                          }}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = fallbackLogo;
                          }}
                        />
                        <div
                          className="d-inline-block mb-2"
                          style={{
                            padding: "6px 12px",
                            borderRadius: "999px",
                            background: "#eef4ff",
                            color: "#16438b",
                            fontSize: "12px",
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                          }}
                        >
                          {campusName}
                        </div>
                        <h3 className="fw-bold mb-1">{schoolName}</h3>
                        <p className="text-muted mb-0">{schoolTagline}</p>
                      </div>

                      <div className="mb-4">
                        <div
                          className="mb-2"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            background: "#eef4ff",
                            color: "#16438b",
                            padding: "7px 12px",
                            borderRadius: "999px",
                            fontSize: "12px",
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                          }}
                        >
                          Secure Access
                        </div>

                        <h2
                          className="fw-bold mb-2"
                          style={{ color: "#10233f", letterSpacing: "-0.02em" }}
                        >
                          Sign in to continue
                        </h2>

                        <p className="text-muted mb-0" style={{ lineHeight: 1.7 }}>
                          Use your username or email to access the {campusName} ERP
                          portal.
                        </p>
                      </div>

                      {error && (
                        <div
                          className="alert border-0"
                          style={{
                            background: "#fff0f0",
                            color: "#a32020",
                            borderRadius: "16px",
                            padding: "14px 16px",
                          }}
                        >
                          {error}
                        </div>
                      )}

                      <form onSubmit={handleLogin} noValidate>
                        <div className="mb-3">
                          <label
                            className="form-label fw-semibold"
                            style={{ color: "#1b3357" }}
                          >
                            Username or Email
                          </label>
                          <input
                            ref={userInputRef}
                            type="text"
                            className="form-control form-control-lg"
                            value={login}
                            onChange={(e) => setLogin(e.target.value)}
                            placeholder="Enter your username or email"
                            autoComplete="username"
                            required
                            style={{
                              borderRadius: "16px",
                              minHeight: "56px",
                              border: "1px solid #dbe4f0",
                              boxShadow: "none",
                              paddingLeft: "16px",
                            }}
                          />
                        </div>

                        <div className="mb-2">
                          <label
                            className="form-label fw-semibold"
                            style={{ color: "#1b3357" }}
                          >
                            Password
                          </label>
                          <div className="input-group input-group-lg">
                            <input
                              type={showPass ? "text" : "password"}
                              className="form-control"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="Enter your password"
                              autoComplete="current-password"
                              required
                              style={{
                                borderTopLeftRadius: "16px",
                                borderBottomLeftRadius: "16px",
                                minHeight: "56px",
                                border: "1px solid #dbe4f0",
                                boxShadow: "none",
                                paddingLeft: "16px",
                              }}
                            />
                            <button
                              type="button"
                              className="btn"
                              onClick={() => setShowPass((s) => !s)}
                              aria-label={showPass ? "Hide password" : "Show password"}
                              style={{
                                borderTopRightRadius: "16px",
                                borderBottomRightRadius: "16px",
                                border: "1px solid #dbe4f0",
                                borderLeft: "none",
                                background: "#fff",
                                color: "#1b3357",
                                fontWeight: 600,
                                minWidth: "88px",
                              }}
                            >
                              {showPass ? "Hide" : "Show"}
                            </button>
                          </div>
                        </div>

                        <div className="d-flex justify-content-between align-items-center mb-4 mt-3 flex-wrap gap-2">
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id="rememberMe"
                              checked={remember}
                              onChange={(e) => setRemember(e.target.checked)}
                            />
                            <label
                              className="form-check-label text-muted"
                              htmlFor="rememberMe"
                            >
                              Keep me signed in
                            </label>
                          </div>

                          <button
                            type="button"
                            className="btn btn-link p-0 text-decoration-none"
                            onClick={() => navigate("/forgot-password")}
                            style={{ color: "#1a56b5", fontWeight: 600 }}
                          >
                            Forgot password?
                          </button>
                        </div>

                        <button
                          type="submit"
                          className="btn w-100 mb-3"
                          disabled={loading}
                          style={{
                            minHeight: "58px",
                            borderRadius: "16px",
                            border: "none",
                            background:
                              "linear-gradient(135deg, #0e4ea8 0%, #1f73e8 100%)",
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: "1rem",
                            boxShadow: "0 18px 40px rgba(31,115,232,0.28)",
                          }}
                        >
                          {loading ? "Signing in..." : "Login to Dashboard"}
                        </button>

                        <div className="text-center text-muted my-3">or continue with</div>

                        <button
                          type="button"
                          className="btn w-100 d-flex align-items-center justify-content-center gap-2"
                          onClick={handleGoogleLogin}
                          disabled={loading}
                          style={{
                            minHeight: "56px",
                            borderRadius: "16px",
                            border: "1px solid #dbe4f0",
                            background: "#fff",
                            color: "#10233f",
                            fontWeight: 600,
                          }}
                        >
                          <GoogleIcon />
                          <span>{loading ? "Please wait..." : "Login with Google"}</span>
                        </button>
                      </form>

                      <div
                        className="mt-4 p-3"
                        style={{
                          borderRadius: "18px",
                          background: "#f4f8ff",
                          border: "1px solid #e2ebf8",
                        }}
                      >
                        <div className="fw-semibold mb-1" style={{ color: "#12315f" }}>
                          Branch Portal Access
                        </div>
                        <div className="small text-muted">
                          This login page is styled separately for the {campusName},
                          while using the same secure backend authentication flow.
                        </div>
                      </div>

                      <div className="mt-4 small text-muted" style={{ lineHeight: 1.7 }}>
                        By continuing you agree to our{" "}
                        <button
                          className="btn btn-link p-0 align-baseline text-decoration-none"
                          onClick={() => navigate("/terms")}
                          style={{ color: "#1a56b5", fontWeight: 600 }}
                        >
                          Terms
                        </button>{" "}
                        and{" "}
                        <button
                          className="btn btn-link p-0 align-baseline text-decoration-none"
                          onClick={() => navigate("/privacy")}
                          style={{ color: "#1a56b5", fontWeight: 600 }}
                        >
                          Privacy Policy
                        </button>
                        .
                      </div>

                      <div className="text-center mt-4 text-muted small">
                        © {new Date().getFullYear()} {schoolName} · {campusName}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center mt-3 text-white-50 small d-lg-none">
              Designed as a separate branch login experience.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;