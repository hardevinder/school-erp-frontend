// File: src/components/Navbar.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import { FaBell } from "react-icons/fa";
import { useRoles } from "../hooks/useRoles";

const Navbar = ({ notificationsCount = 0, onBellClick = () => {} }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef(null);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(
    "https://via.placeholder.com/40"
  );
  const [userName, setUserName] = useState("");

  const [pendingOpen, setPendingOpen] = useState(false);

  const [family, setFamily] = useState(null);
  const [activeStudentAdmission, setActiveStudentAdmission] = useState(
    () =>
      localStorage.getItem("activeStudentAdmission") ||
      localStorage.getItem("username") ||
      ""
  );

  const { roles = [], activeRole, changeRole } = useRoles();

  const roleLower = (activeRole || "").toLowerCase();
  const isSuperAdmin =
    roleLower === "superadmin" || roleLower === "super_admin";
  const isAdmin = isSuperAdmin || roleLower === "admin";
  const isStudent = roleLower === "student";
  const isParent = roleLower === "parent";

  const canSeeStudentSwitcher = isStudent || isParent;

  const API_BASE = (process.env.REACT_APP_API_URL || "").replace(/\/+$/, "");
  const buildStudentPhotoURL = (fileName) =>
    fileName
      ? `${API_BASE}/uploads/photoes/students/${encodeURIComponent(fileName)}`
      : "";

  const NO_STUDENT_PHOTO_SVG =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
         <rect width="100%" height="100%" fill="#f0f0f0"/>
         <circle cx="32" cy="24" r="14" fill="#d9d9d9"/>
         <rect x="10" y="42" width="44" height="14" rx="7" fill="#d9d9d9"/>
       </svg>`
    );

  const studentsList = useMemo(() => {
    if (!family) return [];
    const list = [];
    if (family.student) list.push({ ...family.student, isSelf: true });
    (family.siblings || []).forEach((s) => list.push({ ...s, isSelf: false }));
    return list;
  }, [family]);

  const trySetStudentPhoto = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return setProfilePhoto(NO_STUDENT_PHOTO_SVG);

      const admission =
        localStorage.getItem("activeStudentAdmission") ||
        localStorage.getItem("username");
      const userId = localStorage.getItem("userId");
      const username = admission || localStorage.getItem("username");

      const tryEndpoints = [
        username
          ? `${API_BASE}/students?admission_number=${encodeURIComponent(
              username
            )}`
          : null,
        `${API_BASE}/students/me`,
        userId
          ? `${API_BASE}/students/by-user/${encodeURIComponent(userId)}`
          : null,
      ].filter(Boolean);

      let student = null;
      const headers = { Authorization: `Bearer ${token}` };

      for (const url of tryEndpoints) {
        const resp = await axios.get(url, { headers });
        const data = resp.data;
        if (Array.isArray(data) && data.length) {
          student = data[0];
          break;
        } else if (data && typeof data === "object") {
          student = data;
          break;
        }
      }

      const studentPhoto = student?.photo
        ? buildStudentPhotoURL(student.photo)
        : null;
      setProfilePhoto(studentPhoto || NO_STUDENT_PHOTO_SVG);
    } catch {
      setProfilePhoto(NO_STUDENT_PHOTO_SVG);
    }
  };

  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem("family");
        setFamily(raw ? JSON.parse(raw) : null);
        const stored =
          localStorage.getItem("activeStudentAdmission") ||
          localStorage.getItem("username") ||
          "";
        setActiveStudentAdmission(stored);
      } catch {
        setFamily(null);
      }
    };
    load();

    window.addEventListener("family-updated", load);
    window.addEventListener("student-switched", load);
    return () => {
      window.removeEventListener("family-updated", load);
      window.removeEventListener("student-switched", load);
    };
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const { data } = await axios.get(`${API_BASE}/users/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const user = data?.user || {};
        if (user.name) setUserName(user.name);

        if ((isStudent || isParent) && activeStudentAdmission) {
          await trySetStudentPhoto();
        } else if (user.profilePhoto) {
          const full = user.profilePhoto.startsWith("http")
            ? user.profilePhoto
            : `${API_BASE}${user.profilePhoto}`;
          setProfilePhoto(full);
        } else {
          setProfilePhoto(NO_STUDENT_PHOTO_SVG);
        }
      } catch {
        if (isStudent || isParent) await trySetStudentPhoto();
      }
    };
    fetchProfile();
  }, [isStudent, isParent, activeStudentAdmission]);

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const handleBellClick = () => {
    window.dispatchEvent(new Event("chat:open-request"));
    onBellClick();
  };

  // ✅ Demo branding
  const brandLogo = `${process.env.PUBLIC_URL}/images/DemoLogo.png`;
  const brandName = "DEMO PUBLIC SCHOOL";

  return (
    <nav
      className="navbar fixed-top navbar-expand-lg navbar-light bg-white border-bottom shadow-sm"
      style={{ zIndex: 3000 }}
    >
      <div className="container-fluid px-3">
        {/* Brand */}
        <Link to="/dashboard" className="navbar-brand d-flex align-items-center gap-2">
          <img
            src={brandLogo}
            alt={brandName}
            width={36}
            height={36}
            style={{ objectFit: "contain" }}
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          <span className="fw-semibold">{brandName}</span>
        </Link>

        <div className="ms-auto d-flex align-items-center gap-2" ref={dropdownRef}>
          <button
            type="button"
            className="btn btn-outline-secondary position-relative"
            onClick={handleBellClick}
          >
            <FaBell size={16} />
            {notificationsCount > 0 && (
              <span className="position-absolute top-0 start-100 translate-middle badge bg-danger">
                {notificationsCount}
              </span>
            )}
          </button>

          <div className="dropdown">
            <button
              className="btn btn-light d-flex align-items-center gap-2 border"
              onClick={() => setDropdownOpen((s) => !s)}
            >
              <img
                src={profilePhoto}
                alt="Profile"
                className="rounded-circle"
                style={{ width: 30, height: 30, objectFit: "cover" }}
              />
              <span className="d-none d-sm-inline">{userName || "User"}</span>
            </button>

            {dropdownOpen && (
              <ul className="dropdown-menu dropdown-menu-end show">
                <li>
                  <Link className="dropdown-item" to="/dashboard">
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link className="dropdown-item" to="/edit-profile">
                    Edit Profile
                  </Link>
                </li>
                <li>
                  <hr className="dropdown-divider" />
                </li>
                <li>
                  <button className="dropdown-item" onClick={handleLogout}>
                    Logout
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
