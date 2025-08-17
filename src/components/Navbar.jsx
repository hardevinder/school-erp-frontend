import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import { FaBell } from "react-icons/fa";
import { useRoles } from "../hooks/useRoles";

const Navbar = ({ notificationsCount = 0, onBellClick = () => {} }) => {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState("https://via.placeholder.com/40");
  const [userName, setUserName] = useState("");

  const { roles, activeRole, changeRole } = useRoles();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const { data } = await axios.get(
          `${process.env.REACT_APP_API_URL}/users/profile`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const user = data.user || {};
        if (user.profilePhoto) {
          const full = user.profilePhoto.startsWith("http")
            ? user.profilePhoto
            : `${process.env.REACT_APP_API_URL}${user.profilePhoto}`;
          setProfilePhoto(full);
        }
        if (user.name) setUserName(user.name);
      } catch (err) {
        console.error("Failed to fetch profile:", err);
      }
    };
    fetchProfile();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("roles");
    localStorage.removeItem("activeRole");
    navigate("/");
  };

  // Close dropdown on outside click + on Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const handleRoleChange = (newRole) => {
    changeRole(newRole);
    navigate(`/dashboard/${newRole}`);
  };

  // Close dropdown after selecting an item
  const closeDropdownAnd = (fn) => () => {
    setDropdownOpen(false);
    if (typeof fn === "function") fn();
  };

  return (
    <nav
      className="navbar fixed-top navbar-expand-lg navbar-light bg-white border-bottom app-header shadow-sm"
      role="navigation"
      style={{ zIndex: 3000 }} // ensure it's above the sidebar (which is 2000)
    >
      <div className="container-fluid px-3">
        {/* Brand */}
        <Link to="/dashboard" className="navbar-brand d-flex align-items-center gap-2 ms-2">
          <span
            className="d-inline-grid place-items-center rounded-3 text-white"
            style={{
              width: 32,
              height: 32,
              background: "linear-gradient(135deg, #0d6efd 0%, #5bc0de 100%)",
              boxShadow: "0 4px 10px rgba(13,110,253,.25)",
            }}
            aria-hidden="true"
          >
            <i className="bi bi-mortarboard" />
          </span>
          <span className="fw-semibold">School Suite</span>
        </Link>

        {/* Role switcher (desktop) */}
        {roles.length > 0 && (
          <div className="ms-2 d-none d-md-block">
            <label htmlFor="roleSwitcherDesktop" className="visually-hidden">
              Switch role
            </label>
            <select
              id="roleSwitcherDesktop"
              aria-label="Switch role"
              className="form-select form-select-sm bg-light border-0"
              style={{ width: 200 }}
              value={activeRole}
              onChange={(e) => handleRoleChange(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, " ").toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Right cluster */}
        <div
          className="ms-auto d-flex align-items-center gap-2 me-3"
          ref={dropdownRef}
        >
          {/* Notifications */}
          <button
            type="button"
            className="btn btn-outline-secondary position-relative"
            onClick={onBellClick}
            aria-label="Notifications"
            title="Notifications"
          >
            <FaBell size={16} />
            {notificationsCount > 0 && (
              <span
                className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
                style={{ fontSize: "0.65rem" }}
              >
                {notificationsCount}
              </span>
            )}
          </button>

          {/* Profile dropdown */}
          <div className="dropdown">
            <button
              className="btn btn-light d-flex align-items-center gap-2 border"
              type="button"
              id="profileDropdown"
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
              onClick={() => setDropdownOpen((s) => !s)}
            >
              <img
                src={profilePhoto}
                alt="Profile"
                className="rounded-circle"
                style={{ width: 30, height: 30, objectFit: "cover" }}
                onError={(e) => { e.currentTarget.src = "https://via.placeholder.com/40"; }}
                referrerPolicy="no-referrer"
              />
              <span className="d-none d-sm-inline">{userName || "User"}</span>
              <i className={`bi ${dropdownOpen ? "bi-chevron-up" : "bi-chevron-down"} ms-1`} />
            </button>

            <ul
              className={`dropdown-menu dropdown-menu-end ${dropdownOpen ? "show" : ""}`}
              aria-labelledby="profileDropdown"
            >
              <li>
                <Link className="dropdown-item" to="/dashboard" onClick={() => setDropdownOpen(false)}>
                  Dashboard
                </Link>
              </li>
              <li>
                <Link className="dropdown-item" to="/edit-profile" onClick={() => setDropdownOpen(false)}>
                  Edit Profile
                </Link>
              </li>
              <li><hr className="dropdown-divider" /></li>
              <li>
                <button className="dropdown-item" onClick={closeDropdownAnd(handleLogout)}>
                  Logout
                </button>
              </li>
            </ul>
          </div>

          {/* Mobile role switcher */}
          {roles.length > 0 && (
            <div className="ms-2 d-md-none">
              <label htmlFor="roleSwitcherMobile" className="visually-hidden">
                Switch role
              </label>
              <select
                id="roleSwitcherMobile"
                aria-label="Switch role"
                className="form-select form-select-sm bg-light border-0"
                value={activeRole}
                onChange={(e) => handleRoleChange(e.target.value)}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r.replace(/_/g, " ").toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
