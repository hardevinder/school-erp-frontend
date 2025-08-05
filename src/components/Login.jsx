// src/components/Login.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import { auth, provider, signInWithPopup } from "../firebase/firebaseConfig";
import socket from "../socket";

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

const Login = () => {
  const [login, setLogin] = useState(""); // email OR username
  const [password, setPassword] = useState("");
  const [school, setSchool] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Fetch school info (logo/name)
  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_URL}/schools`)
      .then((res) => res.data?.length && setSchool(res.data[0]))
      .catch(console.error);
  }, []);

  const afterAuth = (data) => {
    const { token, user, roles } = data;

    const roleArr = Array.isArray(roles) ? roles : roles ? [roles] : [];

    // Persist auth info
    localStorage.setItem("token", token);
    localStorage.setItem("roles", JSON.stringify(roleArr));
    localStorage.setItem("username", user.username);
    localStorage.setItem("userId", user.id);
    localStorage.setItem("name", user.name);
    localStorage.removeItem("userRole"); // legacy single-role key

    // Default activeRole
    const defaultActive = ROLE_ORDER.find((r) => roleArr.includes(r)) || roleArr[0] || "";
    localStorage.setItem("activeRole", defaultActive);

    // notify listeners
    window.dispatchEvent(new Event("role-changed"));

    // Socket rooms
    joinRooms(user, roleArr);

    // Single entry point; RoleAwareDashboard will choose view
    navigate("/dashboard", { replace: true });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await axios.post(`${process.env.REACT_APP_API_URL}/users/login`, {
        login,
        password,
      });
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

      const { data } = await axios.post(`${process.env.REACT_APP_API_URL}/users/login`, {
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

  return (
    <div
      className="container-fluid d-flex align-items-center justify-content-center"
      style={{ minHeight: "100vh" }}
    >
      <div className="card p-4 shadow-sm" style={{ maxWidth: "400px", width: "100%" }}>
        {school && (
          <div className="text-center mb-4">
            <img
              src={`${process.env.REACT_APP_API_URL}${school.logo}`}
              alt={school.name}
              className="img-fluid mb-2"
              style={{ maxWidth: "120px" }}
            />
            <h4>{school.name}</h4>
          </div>
        )}

        <h3 className="mb-4 text-center">School ERP Login</h3>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="mb-3">
            <label className="form-label">User (Email or Username)</label>
            <input
              type="text"
              className="form-control"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary w-100" disabled={loading}>
            {loading ? "Logging in…" : "Login"}
          </button>
        </form>

        <hr />

        <button
          className="btn btn-danger w-100"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          {loading ? "Please wait…" : "Login with Google"}
        </button>
      </div>
    </div>
  );
};

export default Login;
