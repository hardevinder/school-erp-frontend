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
  const [profilePhoto, setProfilePhoto] = useState("https://via.placeholder.com/40");
  const [userName, setUserName] = useState("");

  // NEW: family + active student admission for switcher
  const [family, setFamily] = useState(null);
  const [activeStudentAdmission, setActiveStudentAdmission] = useState(
    () => localStorage.getItem("activeStudentAdmission") || localStorage.getItem("username") || ""
  );

  const { roles = [], activeRole, changeRole } = useRoles();

  // --- role helpers ---
  const roleLower = (activeRole || "").toLowerCase();
  const isSuperAdmin = roleLower === "superadmin" || roleLower === "super_admin";
  const isAdmin = isSuperAdmin || roleLower === "admin";
  const isStudent = roleLower === "student";
  const isParent = roleLower === "parent";

  // show switcher for student or parent roles
  const canSeeStudentSwitcher = isStudent || isParent;

  // --- api base + helpers ---
  const API_BASE = (process.env.REACT_APP_API_URL || "").replace(/\/+$/, "");
  const buildStudentPhotoURL = (fileName) =>
    fileName ? `${API_BASE}/uploads/photoes/students/${encodeURIComponent(fileName)}` : "";

  const NO_STUDENT_PHOTO_SVG =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
         <rect width="100%" height="100%" fill="#f0f0f0"/>
         <circle cx="32" cy="24" r="14" fill="#d9d9d9"/>
         <rect x="10" y="42" width="44" height="14" rx="7" fill="#d9d9d9"/>
       </svg>`
    );

  // Build list: current student first, then siblings
  const studentsList = useMemo(() => {
    if (!family) return [];
    const list = [];
    if (family.student) list.push({ ...family.student, isSelf: true });
    (family.siblings || []).forEach((s) => list.push({ ...s, isSelf: false }));
    return list;
  }, [family]);

  // Try to resolve the student's photo (prefer active student's photo)
  const trySetStudentPhoto = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return setProfilePhoto(NO_STUDENT_PHOTO_SVG);

      const admission = localStorage.getItem("activeStudentAdmission") || localStorage.getItem("username");
      const userId = localStorage.getItem("userId");
      const username = admission || localStorage.getItem("username");

      const tryEndpoints = [
        // if you expose an endpoint by admission number:
        username ? `${API_BASE}/students?admission_number=${encodeURIComponent(username)}` : null,
        // fallback by username param:
        username ? `${API_BASE}/students?username=${encodeURIComponent(username)}` : null,
        // by current user:
        `${API_BASE}/students/me`,
        userId ? `${API_BASE}/students/by-user/${encodeURIComponent(userId)}` : null,
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

      const studentPhoto = student?.photo ? buildStudentPhotoURL(student.photo) : null;
      setProfilePhoto(studentPhoto || NO_STUDENT_PHOTO_SVG);
    } catch {
      setProfilePhoto(NO_STUDENT_PHOTO_SVG);
    }
  };

  // Load family from storage, keep active admission in sync
  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem("family");
        setFamily(raw ? JSON.parse(raw) : null);
        const stored =
          localStorage.getItem("activeStudentAdmission") || localStorage.getItem("username") || "";
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

  // Fetch profile (name/photo). If student/parent, prefer active student's photo.
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

        if ((isStudent || isParent) && localStorage.getItem("activeStudentAdmission")) {
          // Show active student's photo if available
          await trySetStudentPhoto();
        } else if (user.profilePhoto) {
          const full = user.profilePhoto.startsWith("http")
            ? user.profilePhoto
            : `${API_BASE}${user.profilePhoto}`;
          setProfilePhoto(full);
        } else if (isStudent) {
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
    localStorage.removeItem("family");                 // ensure cleanup
    localStorage.removeItem("activeStudentAdmission"); // ensure cleanup
    // localStorage.removeItem("username");
    // localStorage.removeItem("userId");
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

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  // Handle student switch (admission number)
  const handleStudentSwitch = (admissionNumber) => {
    if (!admissionNumber || admissionNumber === activeStudentAdmission) return;
    try {
      localStorage.setItem("activeStudentAdmission", admissionNumber);
      setActiveStudentAdmission(admissionNumber);

      // Update header photo to the selected student's
      trySetStudentPhoto();

      // Notify app to refetch student-bound data (attendance, fees, diary, etc.)
      window.dispatchEvent(
        new CustomEvent("student-switched", { detail: { admissionNumber } })
      );

      // Optional UX: navigate to dashboard
      if (isStudent || isParent) {
        navigate("/dashboard", { replace: true });
      }
    } catch (e) {
      console.warn("Failed to switch student", e);
    }
  };

  // ---------- ROLE-BASED QUICK LINKS ----------
  const QUICK_LINKS_BY_ROLE = {
    // Admin & Superadmin
    admin: [
      { label: "Collect", href: "/transactions", icon: "bi-cash-stack" },
      { label: "Fee Due", href: "/student-due", icon: "bi-receipt" },
      { label: "Pending", href: "/reports/school-fee-summary", icon: "bi-list-check" },
      { label: "Day", href: "/reports/day-wise", icon: "bi-calendar2-check" },
      { label: "Transport", href: "/reports/transport-summary", icon: "bi-truck" },
      { label: "Students", href: "/students", icon: "bi-people" },
      { label: "Tracking", href: "/users-tracking", icon: "bi-activity" },
    ],
    superadmin: [
      { label: "Collect", href: "/transactions", icon: "bi-cash-stack" },
      { label: "Fee Due", href: "/student-due", icon: "bi-receipt" },
      { label: "Pending", href: "/reports/school-fee-summary", icon: "bi-list-check" },
      { label: "Day", href: "/reports/day-wise", icon: "bi-calendar2-check" },
      { label: "Transport", href: "/reports/transport-summary", icon: "bi-truck" },
      { label: "Students", href: "/students", icon: "bi-people" },
      { label: "Tracking", href: "/users-tracking", icon: "bi-activity" },
    ],
    // Accounts
    accounts: [
      { label: "Collect", href: "/transactions", icon: "bi-cash-stack" },
      { label: "Fee Due", href: "/student-due", icon: "bi-receipt" },
      { label: "Day", href: "/reports/day-wise", icon: "bi-calendar2-check" },
      { label: "Summary", href: "/reports/school-fee-summary", icon: "bi-graph-up" },
      { label: "Cancel", href: "/cancelled-transactions", icon: "bi-trash3" },
    ],
    account: [
      { label: "Collect", href: "/transactions", icon: "bi-cash-stack" },
      { label: "Fee Due", href: "/student-due", icon: "bi-receipt" },
      { label: "Day", href: "/reports/day-wise", icon: "bi-calendar2-check" },
      { label: "Summary", href: "/reports/school-fee-summary", icon: "bi-graph-up" },
      { label: "Cancel", href: "/cancelled-transactions", icon: "bi-trash3" },
    ],
    fee_manager: [
      { label: "Collect", href: "/transactions", icon: "bi-cash-stack" },
      { label: "Fee Due", href: "/student-due", icon: "bi-receipt" },
      { label: "Day", href: "/reports/day-wise", icon: "bi-calendar2-check" },
      { label: "Summary", href: "/reports/school-fee-summary", icon: "bi-graph-up" },
      { label: "Cancel", href: "/cancelled-transactions", icon: "bi-trash3" },
    ],
    // Academic Coordinator
    academic_coordinator: [
      { label: "TT", href: "/combined-timetable", icon: "bi-table" },
      { label: "Students", href: "/students", icon: "bi-people" },
      { label: "Assign", href: "/teacher-assignment", icon: "bi-person-check" },
      { label: "Subs", href: "/substitution", icon: "bi-arrow-repeat" },
      { label: "Exams", href: "/exams", icon: "bi-journal-bookmark" },
    ],
    // Teacher
    teacher: [
      { label: "Mark Att.", href: "/mark-attendance", icon: "bi-check2-square" },
      { label: "TT", href: "/teacher-timetable-display", icon: "bi-table" },
      { label: "Marks", href: "/marks-entry", icon: "bi-pencil-square" },
      { label: "Subs", href: "/combined-teacher-substitution", icon: "bi-arrow-repeat" },
      { label: "Assign", href: "/assignments", icon: "bi-clipboard" },
    ],
    // HR
    hr: [
      { label: "Employees", href: "/employees", icon: "bi-person-badge" },
      { label: "Att.", href: "/employee-attendance", icon: "bi-person-check-fill" },
      { label: "Summary", href: "/employee-attendance-summary", icon: "bi-calendar-range" },
      { label: "Leave Req", href: "/hr-leave-requests", icon: "bi-clipboard-check" },
      { label: "Balances", href: "/employee-leave-balances", icon: "bi-calendar-check" },
    ],
    // Student
    student: [
      { label: "Home", href: "/dashboard", icon: "bi-house" },
      { label: "Attend.", href: "/student-attendance", icon: "bi-calendar2-check" },
      { label: "Diary", href: "/student-diary", icon: "bi-journal-text" },
      { label: "Assign", href: "/my-assignments", icon: "bi-journal-check" },
      { label: "Fees", href: "/student-fee", icon: "bi-cash-coin" },
    ],
    // Parent (optional quick links – adjust to your app)
    parent: [
      { label: "Home", href: "/dashboard", icon: "bi-house" },
      { label: "Attend.", href: "/student-attendance", icon: "bi-calendar2-check" },
      { label: "Diary", href: "/student-diary", icon: "bi-journal-text" },
      { label: "Fees", href: "/student-fee", icon: "bi-cash-coin" },
    ],
  };

  const quickLinks = QUICK_LINKS_BY_ROLE[roleLower] || [];
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
                e.currentTarget.style.display = "none";
              }}
            />
            <span className="fw-semibold">Pathseekers International School</span>
          </Link>

          {/* Student switcher (desktop pills) */}
          {canSeeStudentSwitcher && studentsList.length > 0 && (
            <div className="ms-3 d-none d-lg-flex align-items-center gap-1" role="tablist" aria-label="Switch student">
              {studentsList.map((s) => {
                const isActive = s.admission_number === activeStudentAdmission;
                return (
                  <button
                    key={s.admission_number}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`btn btn-sm ${isActive ? "btn-primary" : "btn-outline-primary"} rounded-pill px-3`}
                    onClick={() => handleStudentSwitch(s.admission_number)}
                    title={`${s.name} (${s.class?.name || "—"}-${s.section?.name || "—"})`}
                    style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {s.isSelf ? "Me" : s.name}
                    <span className="ms-1 text-white-50">
                      {s.class?.name ? ` · ${s.class.name}-${s.section?.name || "—"}` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

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
          <div className="ms-auto d-flex align-items-center gap-2 me-3" ref={dropdownRef}>
            {/* Quick links strip */}
            {quickLinks.length > 0 && (
              <div className="d-flex align-items-center gap-2 gap-sm-3 me-2 quick-links-strip">
                {quickLinks.map((q) => {
                  const active = isActive(q.href);
                  return (
                    <Link
                      key={q.href}
                      to={q.href}
                      className={`text-decoration-none text-center small quick-link-icon ${active ? "ql-active" : ""}`}
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
                    e.currentTarget.src = NO_STUDENT_PHOTO_SVG;
                  }}
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

            {/* Mobile role + student switchers */}
            <div className="ms-2 d-md-none d-flex align-items-center gap-2">
              {roles.length > 0 && (
                <div>
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

              {canSeeStudentSwitcher && studentsList.length > 0 && (
                <div className="w-100">
                  <label htmlFor="studentSwitcherMobile" className="visually-hidden">Switch student</label>
                  <select
                    id="studentSwitcherMobile"
                    className="form-select form-select-sm bg-light border-0"
                    value={activeStudentAdmission}
                    onChange={(e) => handleStudentSwitch(e.target.value)}
                  >
                    {studentsList.map((s) => (
                      <option key={s.admission_number} value={s.admission_number}>
                        {(s.isSelf ? "Me: " : "") + s.name} {s.class?.name ? `(${s.class.name}-${s.section?.name || "—"})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Little CSS helpers */}
      <style>{`
        /* Keep quick links in one line and compact */
        .quick-links-strip { white-space: nowrap; }

        .quick-link-icon {
          min-width: 60px;
          color: #343a40 !important;
          transition: color .2s ease, transform .15s ease;
          display: inline-flex;
          flex-direction: column;
          align-items: center;
        }

        .quick-link-icon .ql-icon-wrap {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(145deg, #f8f9fa, #e9ecef);
          border: 1px solid #dee2e6;
          box-shadow: 0 2px 4px rgba(0,0,0,.08);
          transition: all .2s ease;
        }

        .quick-link-icon i {
          font-size: 1.25rem;
          font-weight: 600;
          line-height: 1;
        }

        .quick-link-icon .qlabel {
          display: block;
          font-size: 0.75rem;
          font-weight: 500;
          margin-top: 4px;
          letter-spacing: .3px;
        }

        /* Hover state */
        .quick-link-icon:hover {
          color: #0d6efd !important;
          transform: translateY(-2px) scale(1.05);
        }
        .quick-link-icon:hover .ql-icon-wrap {
          background: linear-gradient(145deg, #eaf3ff, #dbe7ff);
          border-color: #cfe2ff;
          box-shadow: 0 4px 8px rgba(13,110,253,.2);
        }

        /* Active route state */
        .quick-link-icon.ql-active {
          color: #0b5ed7 !important;
        }
        .quick-link-icon.ql-active .ql-icon-wrap {
          background: linear-gradient(145deg, #e0edff, #cfe2ff);
          border-color: #91c3ff;
          box-shadow: 0 0 0 3px rgba(13,110,253,.2), 0 4px 10px rgba(13,110,253,.25);
        }

        /* Tighten pill buttons a bit */
        @media (min-width: 992px) {
          .btn.rounded-pill { line-height: 1.1; }
        }

        /* Dark mode tweaks */
        @media (prefers-color-scheme: dark) {
          .quick-link-icon { color: #e9ecef !important; }
          .quick-link-icon .ql-icon-wrap {
            background: linear-gradient(145deg, #2a2f36, #23272e);
            border-color: #3a3f47;
            box-shadow: 0 2px 4px rgba(0,0,0,.4);
          }
          .quick-link-icon:hover .ql-icon-wrap {
            background: linear-gradient(145deg, #1e2d44, #24344f);
            border-color: #2f4b6a;
            box-shadow: 0 4px 10px rgba(0,0,0,.55);
          }
          .quick-link-icon.ql-active .ql-icon-wrap {
            background: linear-gradient(145deg, #23406a, #1e3557);
            border-color: #3a6db8;
            box-shadow: 0 0 0 3px rgba(13,110,253,.35), 0 4px 12px rgba(13,110,253,.35);
          }
        }
      `}</style>
    </>
  );
};

export default Navbar;
