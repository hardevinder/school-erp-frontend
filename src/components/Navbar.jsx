// File: src/components/Navbar.jsx
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
    if (!newRole || newRole === activeRole) return;

    changeRole(newRole);
    localStorage.setItem("activeRole", newRole);
    window.dispatchEvent(new Event("role-changed"));

    setDropdownOpen(false);
    navigate("/dashboard", { replace: true });
  };

  const closeDropdownAnd = (fn) => () => {
    setDropdownOpen(false);
    if (typeof fn === "function") fn();
  };

  // Open chat widget when bell is clicked
  const handleBellClick = () => {
    window.dispatchEvent(new Event("chat:open-request"));
    onBellClick();
  };

  // Small quick links (icon on top, tiny text below)
  const quickLinks = [
    { label: "Collect", href: "/transactions", icon: "bi-cash-stack" },
    { label: "Fee Due", href: "/student-due", icon: "bi-receipt" },
    { label: "Pending", href: "/reports/school-fee-summary", icon: "bi-list-check" },
    { label: "Day", href: "/reports/day-wise", icon: "bi-calendar2-check" },
    { label: "Transport", href: "/reports/van-fee", icon: "bi-truck" },
    { label: "Students", href: "/students", icon: "bi-people" },
  ];

  // ✅ Brand logo from same location as Login page:
  const brandLogo = `${process.env.PUBLIC_URL}/images/pts_logo.png`;

  return (
    <>
      <nav
        className="navbar fixed-top navbar-expand-lg navbar-light bg-white border-bottom app-header shadow-sm"
        role="navigation"
        style={{ zIndex: 3000 }}
      >
        <div className="container-fluid px-3">
          {/* Brand */}
          <Link to="/dashboard" className="navbar-brand d-flex align-items-center gap-2 ms-2">
            <img
              src={brandLogo}
              alt="Pathseekers International School logo"
              width={34}
              height={34}
              className="rounded"
              style={{ objectFit: "contain" }}
              onError={(e) => {
                // Hide image if not found — avoids a broken icon
                e.currentTarget.style.display = "none";
              }}
            />
            <span className="fw-semibold">Pathseekers International School</span>
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
            {/* Quick links strip (before bell + profile) */}
            <div className="d-flex align-items-center gap-3 me-2 quick-links-strip">
              {quickLinks.map((q) => (
                <Link
                  key={q.href}
                  to={q.href}
                  className="text-decoration-none text-center small quick-link-icon"
                  title={q.label}
                >
                  <i className={`bi ${q.icon} d-block`} aria-hidden="true" />
                  <span className="qlabel">{q.label}</span>
                </Link>
              ))}
            </div>

            {/* Notifications */}
            <button
              type="button"
              className="btn btn-outline-secondary position-relative"
              onClick={handleBellClick}
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
                  onError={(e) => {
                    e.currentTarget.src = "https://via.placeholder.com/40";
                  }}
                  referrerPolicy="no-referrer"
                />
                <span className="d-none d-sm-inline">{userName || "User"}</span>
                <i
                  className={`bi ${dropdownOpen ? "bi-chevron-up" : "bi-chevron-down"} ms-1`}
                />
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

      {/* Little CSS helpers */}
      <style>{`
        /* Keep quick links in one line and compact */
        .quick-links-strip { white-space: nowrap; }
        .quick-link-icon {
          min-width: 48px;
          color: #495057 !important;
          transition: color .2s ease;
        }
        .quick-link-icon:hover { color: #0d6efd !important; }
        .quick-link-icon i {
          font-size: 1rem;     /* small icon size */
          line-height: 1;      /* tight line height */
        }
        .quick-link-icon .qlabel {
          display: block;
          font-size: 0.7rem;   /* tiny label */
          margin-top: 2px;
        }
      `}</style>
    </>
  );
};

export default Navbar;
