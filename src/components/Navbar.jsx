// src/components/Navbar.js

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import { FaBell } from "react-icons/fa";
import { useRoles } from "../hooks/useRoles";

/* ================= BRANDING ================= */

const BRAND_NAME = "NEW MILTON PUBLIC SCHOOL";
const BRAND_LOGO = `${process.env.PUBLIC_URL}/images/milton_logo.png`;

/* ========================================== */

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
  const [activeStudentAdmission, setActiveStudentAdmission] = useState(() =>
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
        username
          ? `${API_BASE}/students?username=${encodeURIComponent(username)}`
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
        if (!data) continue;
        if (Array.isArray(data)) {
          if (data.length) {
            student = data[0];
            break;
          }
        } else if (typeof data === "object") {
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

    const onFamilyUpdated = () => load();
    const onStudentSwitched = () => load();

    window.addEventListener("family-updated", onFamilyUpdated);
    window.addEventListener("student-switched", onStudentSwitched);

    return () => {
      window.removeEventListener("family-updated", onFamilyUpdated);
      window.removeEventListener("student-switched", onStudentSwitched);
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

        if (
          (isStudent || isParent) &&
          localStorage.getItem("activeStudentAdmission")
        ) {
          await trySetStudentPhoto();
        } else if (user.profilePhoto) {
          const full = user.profilePhoto.startsWith("http")
            ? user.profilePhoto
            : `${API_BASE}${user.profilePhoto}`;
          setProfilePhoto(full);
        } else if (isStudent || isParent) {
          await trySetStudentPhoto();
        } else {
          setProfilePhoto(NO_STUDENT_PHOTO_SVG);
        }
      } catch (err) {
        console.error("Failed to fetch profile:", err);
        if (isStudent || isParent) {
          await trySetStudentPhoto();
        } else {
          setProfilePhoto(NO_STUDENT_PHOTO_SVG);
        }
      }
    };

    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStudent, isParent, activeStudentAdmission]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("roles");
    localStorage.removeItem("activeRole");
    localStorage.removeItem("family");
    localStorage.removeItem("activeStudentAdmission");
    navigate("/");
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
        setPendingOpen(false);
      }
    };

    const handleEsc = (e) => {
      if (e.key === "Escape") {
        setDropdownOpen(false);
        setPendingOpen(false);
      }
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

  const handleBellClick = () => {
    window.dispatchEvent(new Event("chat:open-request"));
    onBellClick();
  };

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const handleStudentSwitch = (admissionNumber) => {
    if (!admissionNumber || admissionNumber === activeStudentAdmission) return;
    try {
      localStorage.setItem("activeStudentAdmission", admissionNumber);
      setActiveStudentAdmission(admissionNumber);
      trySetStudentPhoto();

      window.dispatchEvent(
        new CustomEvent("student-switched", { detail: { admissionNumber } })
      );

      if (isStudent || isParent) {
        navigate("/dashboard", { replace: true });
      }
    } catch (e) {
      console.warn("Failed to switch student", e);
    }
  };

  // ---------- ROLE-BASED QUICK LINKS ----------
  const QUICK_LINKS_BY_ROLE = {
    admin: [
      { label: "Collect", href: "/transactions", icon: "bi-cash-stack" },
      { label: "Fee Due", href: "/student-due", icon: "bi-receipt" },
      {
        label: "Pendings",
        href: "/reports/school-fee-summary",
        icon: "bi-list-check",
        isPendingDropdown: true,
      },
      { label: "Day", href: "/reports/day-wise", icon: "bi-calendar2-check" },
      {
        label: "Transport",
        href: "/reports/transport-summary",
        icon: "bi-truck",
      },
      { label: "Students", href: "/students", icon: "bi-people" },
      {
        label: "Fee Cert",
        href: "/fee-certificates",
        icon: "bi-file-earmark-text",
      },
      { label: "Enquiries", href: "/enquiries", icon: "bi-inbox" },
    ],
    superadmin: [
      { label: "Collect", href: "/transactions", icon: "bi-cash-stack" },
      { label: "Fee Due", href: "/student-due", icon: "bi-receipt" },
      {
        label: "Pendings",
        href: "/reports/school-fee-summary",
        icon: "bi-list-check",
        isPendingDropdown: true,
      },
      { label: "Day", href: "/reports/day-wise", icon: "bi-calendar2-check" },
      {
        label: "Transport",
        href: "/reports/transport-summary",
        icon: "bi-truck",
      },
      { label: "Students", href: "/students", icon: "bi-people" },
      {
        label: "Fee Cert",
        href: "/fee-certificates",
        icon: "bi-file-earmark-text",
      },
      { label: "Enquiries", href: "/enquiries", icon: "bi-inbox" },
    ],
    accounts: [
      { label: "Collect", href: "/transactions", icon: "bi-cash-stack" },
      { label: "Fee Due", href: "/student-due", icon: "bi-receipt" },
      {
        label: "Pendings",
        href: "/reports/school-fee-summary",
        icon: "bi-list-check",
        isPendingDropdown: true,
      },
      { label: "Day", href: "/reports/day-wise", icon: "bi-calendar2-check" },
      { label: "Students", href: "/students", icon: "bi-people" },
      {
        label: "Fee Cert",
        href: "/fee-certificates",
        icon: "bi-file-earmark-text",
      },
      {
        label: "Cancel",
        href: "/cancelled-transactions",
        icon: "bi-trash3",
      },
    ],
    account: [
      { label: "Collect", href: "/transactions", icon: "bi-cash-stack" },
      { label: "Fee Due", href: "/student-due", icon: "bi-receipt" },
      {
        label: "Pendings",
        href: "/reports/school-fee-summary",
        icon: "bi-list-check",
        isPendingDropdown: true,
      },
      { label: "Day", href: "/reports/day-wise", icon: "bi-calendar2-check" },
      { label: "Students", href: "/students", icon: "bi-people" },
      {
        label: "Fee Cert",
        href: "/fee-certificates",
        icon: "bi-file-earmark-text",
      },
      {
        label: "Cancel",
        href: "/cancelled-transactions",
        icon: "bi-trash3",
      },
    ],
    fee_manager: [
      { label: "Collect", href: "/transactions", icon: "bi-cash-stack" },
      { label: "Fee Due", href: "/student-due", icon: "bi-receipt" },
      {
        label: "Pendings",
        href: "/reports/school-fee-summary",
        icon: "bi-list-check",
        isPendingDropdown: true,
      },
      { label: "Day", href: "/reports/day-wise", icon: "bi-calendar2-check" },
      { label: "Students", href: "/students", icon: "bi-people" },
      {
        label: "Fee Cert",
        href: "/fee-certificates",
        icon: "bi-file-earmark-text",
      },
      {
        label: "Cancel",
        href: "/cancelled-transactions",
        icon: "bi-trash3",
      },
    ],
    academic_coordinator: [
      { label: "TT", href: "/combined-timetable", icon: "bi-table" },
      { label: "Students", href: "/students", icon: "bi-people" },
      { label: "Assign", href: "/teacher-assignment", icon: "bi-person-check" },
      { label: "Subs", href: "/substitution", icon: "bi-arrow-repeat" },
      { label: "Exams", href: "/exams", icon: "bi-journal-bookmark" },
    ],
    teacher: [
      { label: "Mark Att.", href: "/mark-attendance", icon: "bi-check2-square" },
      {
        label: "TT",
        href: "/teacher-timetable-display",
        icon: "bi-table",
      },
      { label: "Marks", href: "/marks-entry", icon: "bi-pencil-square" },
      {
        label: "Subs",
        href: "/combined-teacher-substitution",
        icon: "bi-arrow-repeat",
      },
      { label: "Assign", href: "/assignments", icon: "bi-clipboard" },
    ],
    hr: [
      { label: "Employees", href: "/employees", icon: "bi-person-badge" },
      {
        label: "Att.",
        href: "/employee-attendance",
        icon: "bi-person-check-fill",
      },
      {
        label: "Summary",
        href: "/employee-attendance-summary",
        icon: "bi-calendar-range",
      },
      {
        label: "Leave Req",
        href: "/hr-leave-requests",
        icon: "bi-clipboard-check",
      },
      {
        label: "Balances",
        href: "/employee-leave-balances",
        icon: "bi-calendar-check",
      },
    ],
    student: [
      { label: "Home", href: "/dashboard", icon: "bi-house" },
      {
        label: "Attend.",
        href: "/student-attendance",
        icon: "bi-calendar2-check",
      },
      { label: "Diary", href: "/student-diary", icon: "bi-journal-text" },
      {
        label: "Assign",
        href: "/my-assignments",
        icon: "bi-journal-check",
      },
      { label: "Fees", href: "/student-fee", icon: "bi-cash-coin" },
    ],
    parent: [
      { label: "Home", href: "/dashboard", icon: "bi-house" },
      {
        label: "Attend.",
        href: "/student-attendance",
        icon: "bi-calendar2-check",
      },
      { label: "Diary", href: "/student-diary", icon: "bi-journal-text" },
      { label: "Fees", href: "/student-fee", icon: "bi-cash-coin" },
    ],
  };

  const quickLinks = QUICK_LINKS_BY_ROLE[roleLower] || [];

  return (
    <>
      <nav
        className="navbar fixed-top navbar-expand-lg navbar-light border-bottom app-header shadow-sm"
        role="navigation"
        style={{
          zIndex: 3000,
          background:
            "linear-gradient(90deg, #ffffff 0%, #f7faff 55%, #eef4ff 100%)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div className="container-fluid px-3">
          <Link
            to="/dashboard"
            className="navbar-brand d-flex align-items-center gap-2 ms-2"
          >
            <img
              src={BRAND_LOGO}
              alt={BRAND_NAME}
              width={36}
              height={36}
              className="rounded"
              style={{ objectFit: "contain" }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <span className="fw-bold">{BRAND_NAME}</span>
          </Link>

          {canSeeStudentSwitcher && studentsList.length > 0 && (
            <div
              className="ms-3 d-none d-lg-flex align-items-center gap-1"
              role="tablist"
              aria-label="Switch student"
            >
              {studentsList.map((s) => {
                const isActiveStu =
                  s.admission_number === activeStudentAdmission;

                return (
                  <button
                    key={s.admission_number}
                    type="button"
                    role="tab"
                    aria-selected={isActiveStu}
                    className={`btn btn-sm ${
                      isActiveStu ? "btn-primary" : "btn-outline-primary"
                    } rounded-pill px-3`}
                    onClick={() => handleStudentSwitch(s.admission_number)}
                    title={`${s.name} (${s.class?.name || "—"}-${
                      s.section?.name || "—"
                    })`}
                    style={{
                      maxWidth: 180,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.isSelf ? "Me" : s.name}
                    <span className="ms-1 text-white-50">
                      {s.class?.name
                        ? ` · ${s.class.name}-${s.section?.name || "—"}`
                        : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {roles.length > 0 && (
            <div className="ms-2 d-none d-md-block">
              <label htmlFor="roleSwitcherDesktop" className="visually-hidden">
                Switch role
              </label>
              <select
                id="roleSwitcherDesktop"
                aria-label="Switch role"
                className="form-select form-select-sm bg-light border-0 shadow-sm"
                style={{ width: 200, borderRadius: 12 }}
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

          <div
            className="ms-auto d-flex align-items-center gap-2 me-3"
            ref={dropdownRef}
          >
            {quickLinks.length > 0 && (
              <div className="d-flex align-items-center gap-2 gap-sm-3 me-2 quick-links-strip">
                {quickLinks.map((q) => {
                  if (q.isPendingDropdown) {
                    const pendingActive =
                      isActive("/reports/school-fee-summary") ||
                      isActive("/reports/student-total-due");

                    return (
                      <div
                        key="pending-dropdown"
                        className="dropdown quick-link-dropdown"
                        onMouseEnter={() => setPendingOpen(true)}
                        onMouseLeave={() => setPendingOpen(false)}
                      >
                        <button
                          type="button"
                          className={`btn btn-link p-0 border-0 text-decoration-none text-center small quick-link-icon ${
                            pendingActive ? "ql-active" : ""
                          }`}
                          onClick={() => setPendingOpen((v) => !v)}
                        >
                          <span className="ql-icon-wrap">
                            <i className={`bi ${q.icon}`} aria-hidden="true" />
                          </span>
                          <span className="qlabel">{q.label}</span>
                        </button>

                        <ul
                          className={`dropdown-menu dropdown-menu-end shadow-sm ${
                            pendingOpen ? "show" : ""
                          }`}
                        >
                          <li>
                            <Link
                              className="dropdown-item small"
                              to="/reports/school-fee-summary"
                              onClick={() => setPendingOpen(false)}
                            >
                              Fee Heading Wise Pending
                            </Link>
                          </li>
                          <li>
                            <Link
                              className="dropdown-item small"
                              to="/reports/student-total-due"
                              onClick={() => setPendingOpen(false)}
                            >
                              Student Wise Pending Till Date
                            </Link>
                          </li>
                        </ul>
                      </div>
                    );
                  }

                  const active = isActive(q.href);

                  return (
                    <Link
                      key={q.href}
                      to={q.href}
                      className={`text-decoration-none text-center small quick-link-icon ${
                        active ? "ql-active" : ""
                      }`}
                      title={q.label}
                      aria-label={q.label}
                    >
                      <span className="ql-icon-wrap">
                        <i className={`bi ${q.icon}`} aria-hidden="true" />
                      </span>
                      <span className="qlabel">{q.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              className="btn btn-outline-secondary position-relative shadow-sm nav-icon-btn"
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

            <div className="dropdown">
              <button
                className="btn btn-light d-flex align-items-center gap-2 border shadow-sm profile-btn"
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
                  style={{ width: 32, height: 32, objectFit: "cover" }}
                  onError={(e) => {
                    e.currentTarget.src = NO_STUDENT_PHOTO_SVG;
                  }}
                  referrerPolicy="no-referrer"
                />
                <span className="d-none d-sm-inline fw-semibold">
                  {userName || "User"}
                </span>
                <i
                  className={`bi ${
                    dropdownOpen ? "bi-chevron-up" : "bi-chevron-down"
                  } ms-1`}
                />
              </button>

              <ul
                className={`dropdown-menu dropdown-menu-end ${
                  dropdownOpen ? "show" : ""
                }`}
                aria-labelledby="profileDropdown"
              >
                <li>
                  <Link
                    className="dropdown-item"
                    to="/dashboard"
                    onClick={() => setDropdownOpen(false)}
                  >
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link
                    className="dropdown-item"
                    to="/edit-profile"
                    onClick={() => setDropdownOpen(false)}
                  >
                    Edit Profile
                  </Link>
                </li>
                <li>
                  <hr className="dropdown-divider" />
                </li>
                <li>
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setDropdownOpen(false);
                      handleLogout();
                    }}
                  >
                    Logout
                  </button>
                </li>
              </ul>
            </div>

            <div className="ms-2 d-md-none d-flex align-items-center gap-2">
              {roles.length > 0 && (
                <div>
                  <label
                    htmlFor="roleSwitcherMobile"
                    className="visually-hidden"
                  >
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

              {canSeeStudentSwitcher && studentsList.length > 0 && (
                <div className="w-100">
                  <label
                    htmlFor="studentSwitcherMobile"
                    className="visually-hidden"
                  >
                    Switch student
                  </label>
                  <select
                    id="studentSwitcherMobile"
                    className="form-select form-select-sm bg-light border-0"
                    value={activeStudentAdmission}
                    onChange={(e) => handleStudentSwitch(e.target.value)}
                  >
                    {studentsList.map((s) => (
                      <option
                        key={s.admission_number}
                        value={s.admission_number}
                      >
                        {(s.isSelf ? "Me: " : "") + s.name}{" "}
                        {s.class?.name
                          ? `(${s.class.name}-${s.section?.name || "—"})`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <style>{`
        .app-header {
          background-color: #ffffff !important;
        }

        .navbar-brand span {
          color: #102a56;
          letter-spacing: 0.2px;
        }

        .quick-links-strip {
          white-space: nowrap;
        }

        .quick-link-icon {
          min-width: 62px;
          color: #24324a !important;
          transition: color .2s ease, transform .15s ease;
          display: inline-flex;
          flex-direction: column;
          align-items: center;
        }

        .quick-link-icon .ql-icon-wrap {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 46px;
          height: 46px;
          border-radius: 14px;
          background: linear-gradient(145deg, #ffffff, #edf4ff);
          border: 1px solid #d8e6ff;
          box-shadow: 0 8px 18px rgba(16, 42, 86, 0.08);
          transition: all .2s ease;
        }

        .quick-link-icon i {
          font-size: 1.2rem;
          font-weight: 600;
          line-height: 1;
        }

        .quick-link-icon .qlabel {
          display: block;
          font-size: 0.75rem;
          font-weight: 600;
          margin-top: 5px;
          letter-spacing: .2px;
        }

        .quick-link-icon:hover {
          color: #0d6efd !important;
          transform: translateY(-2px) scale(1.05);
        }

        .quick-link-icon:hover .ql-icon-wrap {
          background: linear-gradient(145deg, #eef5ff, #dce9ff);
          border-color: #bfd8ff;
          box-shadow: 0 10px 22px rgba(13, 110, 253, 0.18);
        }

        .quick-link-icon.ql-active {
          color: #0b5ed7 !important;
        }

        .quick-link-icon.ql-active .ql-icon-wrap {
          background: linear-gradient(145deg, #dfeeff, #cfe2ff);
          border-color: #91c3ff;
          box-shadow: 0 0 0 3px rgba(13,110,253,.15), 0 8px 18px rgba(13,110,253,.18);
        }

        .quick-link-dropdown .dropdown-menu {
          min-width: 260px;
          padding: 0.3rem 0;
          border-radius: 14px;
          border: 1px solid #e5edff;
          overflow: hidden;
        }

        .quick-link-dropdown .dropdown-item {
          font-size: 0.82rem;
          padding: 0.45rem 0.9rem;
        }

        .profile-btn,
        .nav-icon-btn {
          border-radius: 14px !important;
        }

        @media (max-width: 1199px) {
          .quick-links-strip {
            gap: 0.6rem !important;
          }

          .quick-link-icon {
            min-width: 56px;
          }

          .quick-link-icon .ql-icon-wrap {
            width: 42px;
            height: 42px;
          }

          .quick-link-icon .qlabel {
            font-size: 0.7rem;
          }
        }

        @media (max-width: 991px) {
          .quick-links-strip {
            display: none !important;
          }
        }

        @media (prefers-color-scheme: dark) {
          .app-header {
            background: linear-gradient(90deg, #111827 0%, #0f172a 100%) !important;
          }

          .navbar-brand span {
            color: #f8fafc;
          }

          .quick-link-icon {
            color: #e5e7eb !important;
          }

          .quick-link-icon .ql-icon-wrap {
            background: linear-gradient(145deg, #1f2937, #111827);
            border-color: #374151;
            box-shadow: 0 2px 8px rgba(0,0,0,.35);
          }

          .quick-link-icon:hover .ql-icon-wrap {
            background: linear-gradient(145deg, #1d4ed8, #1e3a8a);
            border-color: #3b82f6;
          }

          .quick-link-icon.ql-active .ql-icon-wrap {
            background: linear-gradient(145deg, #2563eb, #1d4ed8);
            border-color: #60a5fa;
            box-shadow: 0 0 0 3px rgba(96,165,250,.2), 0 4px 12px rgba(37,99,235,.28);
          }
        }
      `}</style>
    </>
  );
};

export default Navbar;