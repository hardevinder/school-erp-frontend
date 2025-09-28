// Login.js
import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import { auth, provider, signInWithPopup } from "../firebase/firebaseConfig";
import socket from "../socket";
import "./login.css";

const ROLE_ORDER = ["superadmin", "admin", "hr", "academic_coordinator", "teacher", "student"];

// --- Background resolver (robust) ---
const BG_CANDIDATES = [
  `${process.env.PUBLIC_URL}/images/SchoolBackground.jpeg`,
  `${process.env.PUBLIC_URL}/images/SchoolBackground.jpg`,
  `${process.env.PUBLIC_URL}/images/SchooBackground.jpeg`,
  `${process.env.PUBLIC_URL}/images/SchooBackground.jpg`,
  `${process.env.PUBLIC_URL}/image/SchoolBackground.jpeg`,
  `${process.env.PUBLIC_URL}/image/SchoolBackground.jpg`,
  `${process.env.PUBLIC_URL}/image/SchooBackground.jpeg`,
  `${process.env.PUBLIC_URL}/image/SchooBackground.jpg`,
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
// -----------------------------------------------------

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
    axios
      .get(`${apiBase}/schools`)
      .then((res) => res.data?.length && setSchool(res.data[0]))
      .catch(() => {});
  }, [apiBase]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }, []);

  useEffect(() => {
    (async () => {
      const found = await resolveFirstExistingImage(BG_CANDIDATES);
      setBgUrl(found);
    })();
  }, []);

  const afterAuth = (data) => {
    const { token, user, roles } = data;
    const roleArr = Array.isArray(roles) ? roles : roles ? [roles] : [];

    if (remember) {
      localStorage.setItem("token", token);
      localStorage.setItem("roles", JSON.stringify(roleArr));
      localStorage.setItem("username", user.username);
      localStorage.setItem("userId", user.id);
      localStorage.setItem("name", user.name);
    } else {
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

    localStorage.removeItem("userRole");
    const defaultActive = ROLE_ORDER.find((r) => roleArr.includes(r)) || roleArr[0] || "";
    localStorage.setItem("activeRole", defaultActive);

    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    window.dispatchEvent(new Event("role-changed"));
    joinRooms(user, roleArr);
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
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const schoolLogoSrc = school?.logo ? `${apiBase}${school.logo}` : null;
  const schoolName = school?.name || "Pathseekers International School";
  const fallbackLogo = `${process.env.PUBLIC_URL}/images/pts_logo.png`;

  return (
    <div
      className="login-hero"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: `linear-gradient(rgba(8,8,18,0.55), rgba(8,8,18,0.8))${bgUrl ? `, url(${bgUrl})` : ""}`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="login-hero__content container">
        <div className="row justify-content-center">
          <div className="col-12 col-md-10 col-lg-7 col-xl-5">
            <div className="card glass-card shadow-xl border-0 overflow-hidden">
              <div className="card-body p-4 p-sm-5">
                <div className="text-center mb-4">
                  <img
                    src={schoolLogoSrc || fallbackLogo}
                    alt="School Logo"
                    className="brand-logo"
                    style={{ maxWidth: "120px", height: "auto" }}   // ✅ Bigger logo
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = fallbackLogo;
                    }}
                  />

                  <h4 className="mt-2 mb-0 fw-semibold text-white">{schoolName}</h4>
                  <p className="text-white-50 small mb-0">
                    Manage academics, fees, attendance, HR & more.
                  </p>
                </div>

                {error && <div className="alert alert-danger py-2">{error}</div>}

                <h5 className="fw-semibold mb-2 text-white">Sign in</h5>
                <p className="text-white-50 mb-4">Use your username/email and password to continue.</p>

                <form onSubmit={handleLogin} noValidate>
                  <div className="mb-3">
                    <label className="form-label text-white-75">User (Email or Username)</label>
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
                    <label className="form-label text-white-75">Password</label>
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
                        className="btn btn-outline-light"
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
                      <label className="form-check-label text-white-75" htmlFor="rememberMe">
                        Remember me
                      </label>
                    </div>
                    <button
                      type="button"
                      className="btn btn-link p-0 small text-white-75"
                      onClick={() => navigate("/forgot-password")}
                    >
                      Forgot password?
                    </button>
                  </div>

                  <button type="submit" className="btn btn-primary btn-lg w-100 mb-3" disabled={loading}>
                    {loading ? "Signing in…" : "Login"}
                  </button>

                  <div className="text-center text-white-50 my-2">or</div>

                  <button
                    type="button"
                    className="btn btn-outline-light btn-lg w-100 d-flex align-items-center justify-content-center gap-2"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                  >
                    <GoogleIcon />
                    <span>{loading ? "Please wait…" : "Login with Google"}</span>
                  </button>
                </form>

                <div className="mt-4 small text-white-50">
                  By continuing you agree to our{" "}
                  <button className="btn btn-link p-0 align-baseline text-white" onClick={() => navigate("/terms")}>
                    Terms
                  </button>{" "}
                  and{" "}
                  <button className="btn btn-link p-0 align-baseline text-white" onClick={() => navigate("/privacy")}>
                    Privacy Policy
                  </button>.
                </div>
              </div>

              <div className="card-footer glass-card__footer text-center small text-white-50">
                © {new Date().getFullYear()} {schoolName}
              </div>
            </div>

            {/* <div className="text-center mt-3 text-white-50 small">Powered by FeePanel</div> */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
