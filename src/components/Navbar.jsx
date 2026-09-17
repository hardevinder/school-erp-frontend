import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import axios from "axios";

import "bootstrap/dist/css/bootstrap.min.css";

import { FaBell } from "react-icons/fa";

import { useRoles } from "../hooks/useRoles";
import BranchSwitcher from "./BranchSwitcher";

const CollegeNavbar = ({
  notificationsCount = 0,
  onBellClick = () => {},
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const dropdownRef = useRef(null);

  const [dropdownOpen, setDropdownOpen] =
    useState(false);

  const [pendingOpen, setPendingOpen] =
    useState(false);

  const [profilePhoto, setProfilePhoto] =
    useState("");

  const [userName, setUserName] =
    useState("");

  const [college, setCollege] =
    useState(null);

  const [family, setFamily] =
    useState(null);

  const [
    activeStudentAdmission,
    setActiveStudentAdmission,
  ] = useState(
    () =>
      localStorage.getItem(
        "activeStudentAdmission"
      ) ||
      localStorage.getItem("username") ||
      ""
  );

  const {
    roles = [],
    activeRole,
    changeRole,
  } = useRoles();

  /* =====================================================
     API
  ===================================================== */

  const API_BASE =
    (
      process.env.REACT_APP_API_URL ||
      ""
    ).replace(/\/+$/, "");

  /* =====================================================
     ROLE HELPERS
  ===================================================== */

  const roleLower =
    (activeRole || "").toLowerCase();

  const isSuperAdmin =
    roleLower === "superadmin" ||
    roleLower === "super_admin";

  const isAdmin =
    isSuperAdmin ||
    roleLower === "admin";

  const isPrincipal =
    roleLower === "principal";

  const isStudent =
    roleLower === "student";

  const isParent =
    roleLower === "parent";

  const canSeeStudentSwitcher =
    isStudent || isParent;

  /* =====================================================
     COLLEGE BRANDING
  ===================================================== */

  useEffect(() => {
    if (!API_BASE) return;

    axios
      .get(`${API_BASE}/schools`)
      .then((res) => {
        const rows =
          Array.isArray(res.data)
            ? res.data
            : Array.isArray(
                res.data?.data
              )
            ? res.data.data
            : [];

        if (rows.length) {
          setCollege(rows[0]);
        }
      })
      .catch((err) => {
        console.warn(
          "Unable to fetch college:",
          err?.message
        );
      });
  }, [API_BASE]);

  const collegeName =
    college?.name ||
    "EduBridge Demo College";

  const fallbackLogo =
    `${process.env.PUBLIC_URL}/images/DemoLogo.png`;

  const collegeLogo =
    college?.logo
      ? `${API_BASE}${college.logo}`
      : fallbackLogo;

  /* =====================================================
     DEFAULT PROFILE PHOTO
  ===================================================== */

  const NO_PHOTO =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg"
           width="64"
           height="64">
        <rect width="100%"
              height="100%"
              fill="#eef4fa"/>

        <circle cx="32"
                cy="23"
                r="13"
                fill="#cbd7e4"/>

        <rect x="10"
              y="41"
              width="44"
              height="15"
              rx="8"
              fill="#cbd7e4"/>
      </svg>
    `);

  /* =====================================================
     FAMILY / STUDENT SWITCHER
  ===================================================== */

  const studentsList =
    useMemo(() => {
      if (!family) return [];

      const list = [];

      if (family.student) {
        list.push({
          ...family.student,
          isSelf: true,
        });
      }

      (
        family.siblings || []
      ).forEach((student) => {
        list.push({
          ...student,
          isSelf: false,
        });
      });

      return list;
    }, [family]);

  useEffect(() => {
    const loadFamily = () => {
      try {
        const raw =
          localStorage.getItem(
            "family"
          );

        setFamily(
          raw
            ? JSON.parse(raw)
            : null
        );

        setActiveStudentAdmission(
          localStorage.getItem(
            "activeStudentAdmission"
          ) ||
            localStorage.getItem(
              "username"
            ) ||
            ""
        );
      } catch {
        setFamily(null);
      }
    };

    loadFamily();

    window.addEventListener(
      "family-updated",
      loadFamily
    );

    window.addEventListener(
      "student-switched",
      loadFamily
    );

    return () => {
      window.removeEventListener(
        "family-updated",
        loadFamily
      );

      window.removeEventListener(
        "student-switched",
        loadFamily
      );
    };
  }, []);

  /* =====================================================
     STUDENT PHOTO
  ===================================================== */

  const buildStudentPhotoURL = (
    fileName
  ) =>
    fileName
      ? `${API_BASE}/uploads/photoes/students/${encodeURIComponent(
          fileName
        )}`
      : "";

  const trySetStudentPhoto =
    async () => {
      try {
        const token =
          localStorage.getItem(
            "token"
          );

        if (!token) {
          setProfilePhoto(
            NO_PHOTO
          );
          return;
        }

        const admission =
          localStorage.getItem(
            "activeStudentAdmission"
          ) ||
          localStorage.getItem(
            "username"
          );

        const userId =
          localStorage.getItem(
            "userId"
          );

        const username =
          admission ||
          localStorage.getItem(
            "username"
          );

        const endpoints = [
          username
            ? `${API_BASE}/students?admission_number=${encodeURIComponent(
                username
              )}`
            : null,

          username
            ? `${API_BASE}/students?username=${encodeURIComponent(
                username
              )}`
            : null,

          `${API_BASE}/students/me`,

          userId
            ? `${API_BASE}/students/by-user/${encodeURIComponent(
                userId
              )}`
            : null,
        ].filter(Boolean);

        let student = null;

        const headers = {
          Authorization:
            `Bearer ${token}`,
        };

        for (
          const url of endpoints
        ) {
          try {
            const resp =
              await axios.get(
                url,
                { headers }
              );

            const data =
              resp.data;

            if (
              Array.isArray(data)
            ) {
              if (data.length) {
                student =
                  data[0];

                break;
              }
            } else if (
              data &&
              typeof data ===
                "object"
            ) {
              student = data;

              break;
            }
          } catch {
            // try next endpoint
          }
        }

        const photo =
          student?.photo
            ? buildStudentPhotoURL(
                student.photo
              )
            : null;

        setProfilePhoto(
          photo || NO_PHOTO
        );
      } catch {
        setProfilePhoto(
          NO_PHOTO
        );
      }
    };

  /* =====================================================
     FETCH USER PROFILE
  ===================================================== */

  useEffect(() => {
    const fetchProfile =
      async () => {
        try {
          const token =
            localStorage.getItem(
              "token"
            );

          if (!token) return;

          const { data } =
            await axios.get(
              `${API_BASE}/users/profile`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            );

          const user =
            data?.user || {};

          if (user.name) {
            setUserName(
              user.name
            );
          }

          if (
            (
              isStudent ||
              isParent
            ) &&
            localStorage.getItem(
              "activeStudentAdmission"
            )
          ) {
            await trySetStudentPhoto();
          } else if (
            user.profilePhoto
          ) {
            setProfilePhoto(
              user.profilePhoto.startsWith(
                "http"
              )
                ? user.profilePhoto
                : `${API_BASE}${user.profilePhoto}`
            );
          } else {
            setProfilePhoto(
              NO_PHOTO
            );
          }
        } catch (err) {
          console.error(
            "Failed to fetch profile:",
            err
          );

          if (
            isStudent ||
            isParent
          ) {
            await trySetStudentPhoto();
          } else {
            setProfilePhoto(
              NO_PHOTO
            );
          }
        }
      };

    fetchProfile();

    // eslint-disable-next-line
  }, [
    roleLower,
    activeStudentAdmission,
  ]);

  /* =====================================================
     LOGOUT
  ===================================================== */

  const handleLogout = () => {
    [
      "token",
      "roles",
      "permissions",
      "activeRole",
      "family",
      "activeStudentAdmission",
    ].forEach((key) =>
      localStorage.removeItem(
        key
      )
    );

    navigate("/");
  };

  /* =====================================================
     DROPDOWN EVENTS
  ===================================================== */

  useEffect(() => {
    const outsideClick = (
      event
    ) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(
          event.target
        )
      ) {
        setDropdownOpen(
          false
        );

        setPendingOpen(
          false
        );
      }
    };

    const escapeKey = (
      event
    ) => {
      if (
        event.key ===
        "Escape"
      ) {
        setDropdownOpen(
          false
        );

        setPendingOpen(
          false
        );
      }
    };

    document.addEventListener(
      "mousedown",
      outsideClick
    );

    document.addEventListener(
      "keydown",
      escapeKey
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        outsideClick
      );

      document.removeEventListener(
        "keydown",
        escapeKey
      );
    };
  }, []);

  /* =====================================================
     ROLE SWITCH
  ===================================================== */

  const handleRoleChange = (
    newRole
  ) => {
    if (
      !newRole ||
      newRole === activeRole
    ) {
      return;
    }

    changeRole(newRole);

    localStorage.setItem(
      "activeRole",
      newRole
    );

    window.dispatchEvent(
      new Event(
        "role-changed"
      )
    );

    setDropdownOpen(
      false
    );

    navigate(
      "/dashboard",
      {
        replace: true,
      }
    );
  };

  /* =====================================================
     STUDENT SWITCH
  ===================================================== */

  const handleStudentSwitch = (
    admissionNumber
  ) => {
    if (
      !admissionNumber ||
      admissionNumber ===
        activeStudentAdmission
    ) {
      return;
    }

    localStorage.setItem(
      "activeStudentAdmission",
      admissionNumber
    );

    setActiveStudentAdmission(
      admissionNumber
    );

    window.dispatchEvent(
      new CustomEvent(
        "student-switched",
        {
          detail: {
            admissionNumber,
          },
        }
      )
    );

    if (
      isStudent ||
      isParent
    ) {
      navigate(
        "/dashboard",
        {
          replace: true,
        }
      );
    }
  };

  /* =====================================================
     NOTIFICATION
  ===================================================== */

  const handleBellClick =
    () => {
      window.dispatchEvent(
        new Event(
          "chat:open-request"
        )
      );

      onBellClick();
    };

  const isActive = (
    path
  ) =>
    location.pathname === path ||
    location.pathname.startsWith(
      path + "/"
    );

  /* =====================================================
     COLLEGE QUICK LINKS
  ===================================================== */

  const ADMIN_LINKS = [
    {
      label: "Students",
      href: "/students",
      icon: "bi-people",
    },
    {
      label: "Collect",
      href: "/transactions",
      icon: "bi-cash-stack",
    },
    {
      label: "Fee Due",
      href: "/student-due",
      icon: "bi-receipt",
    },
    {
      label: "Timetable",
      href: "/combined-timetable",
      icon: "bi-table",
    },
    {
      label: "Exams",
      href: "/exams",
      icon:
        "bi-journal-bookmark",
    },
    {
      label: "Staff",
      href: "/employees",
      icon: "bi-person-badge",
    },
  ];

  const QUICK_LINKS_BY_ROLE =
    {
      admin: ADMIN_LINKS,

      superadmin:
        ADMIN_LINKS,

      super_admin:
        ADMIN_LINKS,

      principal: [
        {
          label: "Students",
          href: "/students",
          icon: "bi-people",
        },
        {
          label: "Timetable",
          href:
            "/combined-timetable",
          icon: "bi-table",
        },
        {
          label: "Exams",
          href: "/exams",
          icon:
            "bi-journal-bookmark",
        },
        {
          label: "Staff",
          href: "/employees",
          icon:
            "bi-person-badge",
        },
        {
          label: "Fee Due",
          href: "/student-due",
          icon: "bi-receipt",
        },
      ],

      accounts: [
        {
          label: "Collect",
          href: "/transactions",
          icon:
            "bi-cash-stack",
        },
        {
          label: "Fee Due",
          href:
            "/student-due",
          icon:
            "bi-receipt",
        },
        {
          label: "Day",
          href:
            "/reports/day-wise",
          icon:
            "bi-calendar2-check",
        },
        {
          label: "Students",
          href: "/students",
          icon: "bi-people",
        },
      ],

      account: [
        {
          label: "Collect",
          href: "/transactions",
          icon:
            "bi-cash-stack",
        },
        {
          label: "Fee Due",
          href:
            "/student-due",
          icon:
            "bi-receipt",
        },
        {
          label: "Students",
          href: "/students",
          icon: "bi-people",
        },
      ],

      academic_coordinator: [
        {
          label: "Timetable",
          href:
            "/combined-timetable",
          icon: "bi-table",
        },
        {
          label: "Students",
          href: "/students",
          icon: "bi-people",
        },
        {
          label: "Assign",
          href:
            "/teacher-assignment",
          icon:
            "bi-person-check",
        },
        {
          label: "Subs",
          href:
            "/substitution",
          icon:
            "bi-arrow-repeat",
        },
        {
          label: "Exams",
          href: "/exams",
          icon:
            "bi-journal-bookmark",
        },
      ],

      coordinator: [
        {
          label: "Timetable",
          href:
            "/combined-timetable",
          icon: "bi-table",
        },
        {
          label: "Students",
          href: "/students",
          icon: "bi-people",
        },
        {
          label: "Assign",
          href:
            "/teacher-assignment",
          icon:
            "bi-person-check",
        },
        {
          label: "Subs",
          href:
            "/substitution",
          icon:
            "bi-arrow-repeat",
        },
      ],

      teacher: [
        {
          label: "Mark Att.",
          href:
            "/mark-attendance",
          icon:
            "bi-check2-square",
        },
        {
          label: "Timetable",
          href:
            "/teacher-timetable-display",
          icon: "bi-table",
        },
        {
          label: "Marks",
          href:
            "/marks-entry",
          icon:
            "bi-pencil-square",
        },
        {
          label: "Subs",
          href:
            "/combined-teacher-substitution",
          icon:
            "bi-arrow-repeat",
        },
        {
          label: "Assign",
          href:
            "/assignments",
          icon:
            "bi-clipboard",
        },
      ],

      hr: [
        {
          label: "Employees",
          href: "/employees",
          icon:
            "bi-person-badge",
        },
        {
          label: "Attendance",
          href:
            "/employee-attendance",
          icon:
            "bi-person-check-fill",
        },
        {
          label: "Summary",
          href:
            "/employee-attendance-summary",
          icon:
            "bi-calendar-range",
        },
        {
          label: "Leave",
          href:
            "/hr-leave-requests",
          icon:
            "bi-clipboard-check",
        },
      ],

      student: [
        {
          label: "Home",
          href: "/dashboard",
          icon: "bi-house",
        },
        {
          label: "Attendance",
          href:
            "/student-attendance",
          icon:
            "bi-calendar2-check",
        },
        {
          label: "Diary",
          href:
            "/student-diary",
          icon:
            "bi-journal-text",
        },
        {
          label: "Assignments",
          href:
            "/my-assignments",
          icon:
            "bi-journal-check",
        },
        {
          label: "Fees",
          href:
            "/student-fee",
          icon:
            "bi-cash-coin",
        },
      ],

      parent: [
        {
          label: "Home",
          href: "/dashboard",
          icon: "bi-house",
        },
        {
          label: "Attendance",
          href:
            "/student-attendance",
          icon:
            "bi-calendar2-check",
        },
        {
          label: "Fees",
          href:
            "/student-fee",
          icon:
            "bi-cash-coin",
        },
      ],
    };

  const quickLinks =
    QUICK_LINKS_BY_ROLE[
      roleLower
    ] || [];

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <>
      <nav
        className="
          navbar
          fixed-top
          navbar-expand-lg
          college-navbar
        "
        style={{
          zIndex: 3000,
        }}
      >
        <div className="container-fluid px-3">

          {/* BRAND */}

          <Link
            to="/dashboard"
            className="
              navbar-brand
              college-navbar__brand
            "
          >
            <img
              src={collegeLogo}
              alt={`${collegeName} logo`}
              onError={(e) => {
                e.currentTarget.onerror =
                  null;

                e.currentTarget.src =
                  fallbackLogo;
              }}
            />

            <div>
              <strong>
                {collegeName}
              </strong>

              <small>
                College Management
              </small>
            </div>
          </Link>

          {/* BRANCH */}

          <div className="ms-3 d-none d-lg-block">
            <BranchSwitcher />
          </div>

          {/* ROLE */}

          {roles.length > 0 && (
            <div className="ms-3 d-none d-md-block">

              <select
                className="
                  form-select
                  form-select-sm
                  college-role-select
                "
                value={
                  activeRole || ""
                }
                onChange={(e) =>
                  handleRoleChange(
                    e.target.value
                  )
                }
              >

                {roles.map(
                  (role) => (
                    <option
                      key={role}
                      value={role}
                    >
                      {role
                        .replace(
                          /_/g,
                          " "
                        )
                        .toUpperCase()}
                    </option>
                  )
                )}

              </select>

            </div>
          )}

          {/* RIGHT */}

          <div
            className="
              ms-auto
              d-flex
              align-items-center
              gap-2
            "
            ref={dropdownRef}
          >

            {/* QUICK LINKS */}

            {quickLinks.length >
              0 && (
              <div className="college-quick-links d-none d-xl-flex">

                {quickLinks.map(
                  (item) => {
                    const active =
                      isActive(
                        item.href
                      );

                    return (
                      <Link
                        key={
                          item.href
                        }
                        to={
                          item.href
                        }
                        className={`college-quick-link ${
                          active
                            ? "active"
                            : ""
                        }`}
                        title={
                          item.label
                        }
                      >

                        <span>
                          <i
                            className={`bi ${item.icon}`}
                          />
                        </span>

                        <small>
                          {item.label}
                        </small>

                      </Link>
                    );
                  }
                )}

              </div>
            )}

            {/* BELL */}

            <button
              type="button"
              className="
                btn
                college-navbar__bell
                position-relative
              "
              onClick={
                handleBellClick
              }
            >

              <FaBell size={16} />

              {notificationsCount >
                0 && (
                <span
                  className="
                    position-absolute
                    top-0
                    start-100
                    translate-middle
                    badge
                    rounded-pill
                    bg-danger
                  "
                >
                  {
                    notificationsCount
                  }
                </span>
              )}

            </button>

            {/* PROFILE */}

            <div className="dropdown">

              <button
                type="button"
                className="
                  btn
                  college-profile-button
                "
                onClick={() =>
                  setDropdownOpen(
                    (open) =>
                      !open
                  )
                }
              >

                <img
                  src={
                    profilePhoto ||
                    NO_PHOTO
                  }
                  alt="Profile"
                  onError={(e) => {
                    e.currentTarget.src =
                      NO_PHOTO;
                  }}
                />

                <span className="d-none d-sm-inline">
                  {userName ||
                    "User"}
                </span>

                <i
                  className={`bi ${
                    dropdownOpen
                      ? "bi-chevron-up"
                      : "bi-chevron-down"
                  }`}
                />

              </button>

              <ul
                className={`dropdown-menu dropdown-menu-end college-profile-menu ${
                  dropdownOpen
                    ? "show"
                    : ""
                }`}
              >

                <li>
                  <Link
                    className="dropdown-item"
                    to="/dashboard"
                    onClick={() =>
                      setDropdownOpen(
                        false
                      )
                    }
                  >
                    <i className="bi bi-speedometer2 me-2" />
                    Dashboard
                  </Link>
                </li>

                <li>
                  <Link
                    className="dropdown-item"
                    to="/edit-profile"
                    onClick={() =>
                      setDropdownOpen(
                        false
                      )
                    }
                  >
                    <i className="bi bi-person me-2" />
                    Edit Profile
                  </Link>
                </li>

                <li>
                  <hr className="dropdown-divider" />
                </li>

                <li>
                  <button
                    className="dropdown-item text-danger"
                    onClick={
                      handleLogout
                    }
                  >
                    <i className="bi bi-box-arrow-right me-2" />
                    Logout
                  </button>
                </li>

              </ul>

            </div>

            {/* MOBILE */}

            <div className="d-md-none">

              <BranchSwitcher
                compact
              />

            </div>

          </div>
        </div>
      </nav>

      <style>{`

        .college-navbar {
          min-height: 68px;
          background: linear-gradient(90deg, rgba(255,253,249,.985), rgba(250,244,236,.985));
          backdrop-filter: blur(18px);
          border-bottom: 1px solid #e7d7c2;
          box-shadow: 0 8px 26px rgba(92, 28, 32, .07);
        }


        .college-navbar__brand {
          display: flex;

          align-items: center;

          gap: 11px;

          text-decoration: none;
        }


        .college-navbar__brand img {
          width: 42px;

          height: 42px;

          object-fit: contain;

          padding: 3px;

          background: white;

          border-radius: 12px;

          border: 1px solid #ead9c5;

          box-shadow: 0 5px 15px rgba(92, 28, 32, .08);
        }


        .college-navbar__brand strong {
          display: block;

          max-width: 230px;

          overflow: hidden;

          text-overflow:
            ellipsis;

          white-space:
            nowrap;

          color: #65131a;

          font-family:
            Georgia,
            serif;

          font-size: 16px;

          line-height: 1.2;
        }


        .college-navbar__brand small {
          display: block;

          margin-top: 2px;

          color: #a27635;

          font-size: 9px;

          font-weight: 800;

          letter-spacing:
            .10em;

          text-transform:
            uppercase;
        }


        .college-role-select {
          min-width: 165px;

          border: 1px solid #ead9c5 !important;
          border-radius: 10px;
          background: #fbf4eb;
          color: #6d2027;

          font-size: 11px;

          font-weight: 700;
        }


        .college-quick-links {
          align-items: center;

          gap: 7px;

          margin-right: 8px;
        }


        .college-quick-link {
          min-width: 55px;

          display: flex;

          flex-direction: column;

          align-items: center;

          gap: 3px;

          text-decoration: none;

          color: #6f5449;

          transition: .18s ease;
        }


        .college-quick-link > span {
          width: 36px;

          height: 36px;

          display: grid;

          place-items: center;

          border-radius: 11px;

          background: #fffaf4;
          border: 1px solid #eadbca;

          transition:
            .18s ease;
        }


        .college-quick-link i {
          font-size: 16px;
        }


        .college-quick-link small {
          font-size: 9.5px;

          font-weight: 700;
        }


        .college-quick-link:hover {
          color: #74151d;

          transform:
            translateY(-1px);
        }


        .college-quick-link:hover > span {
          background: #f8eee3;
          border-color: #dfc39d;
        }


        .college-quick-link.active {
          color: #74151d;
        }


        .college-quick-link.active > span {
          background: linear-gradient(135deg, #6a1119, #8e2a33);
          color: #fff;
          border-color: #74151d;
          box-shadow: 0 0 0 3px rgba(116, 21, 29, .08);
        }


        .college-navbar__bell {
          width: 41px;

          height: 41px;

          display: grid;

          place-items: center;

          padding: 0;

          border-radius: 12px;

          border: 1px solid #ead9c5;
          background: #fffaf4;
          color: #74151d;
        }


        .college-navbar__bell:hover {
          color: #5f1017;
          background: #f7eadc;
          border-color: #dfc39d;
        }


        .college-profile-button {
          min-height: 43px;

          display: flex;

          align-items: center;

          gap: 8px;

          padding:
            5px
            10px
            5px
            6px;

          border-radius: 13px;

          border: 1px solid #ead9c5;
          background: #fffdf9;
          color: #652026;

          font-size: 12px;

          font-weight: 650;
        }



        .college-profile-button:hover {
          background: #fbf1e7;
          border-color: #dfc39d;
          color: #5f1017;
        }

        .college-profile-button img {
          width: 31px;

          height: 31px;

          object-fit: cover;

          border-radius: 10px;
        }


        .college-profile-menu {
          margin-top: 10px !important;

          min-width: 190px;

          padding: 7px;

          border: 1px solid #ead9c5;

          border-radius: 13px;

          box-shadow: 0 14px 40px rgba(92, 28, 32, .14);
        }


        .college-profile-menu
        .dropdown-item {
          padding:
            9px
            11px;

          border-radius: 8px;

          font-size: 12px;
        }




        .college-navbar .branch-switcher .input-group-text {
          background: #f7eee4 !important;
          border-color: #e7d5bf !important;
          color: #74151d !important;
        }

        .college-navbar .branch-switcher .form-select {
          background-color: #fffaf4 !important;
          border-color: #e7d5bf !important;
          color: #5f2a2f !important;
          font-weight: 650;
        }

        .college-navbar .branch-switcher .form-select:focus,
        .college-role-select:focus {
          border-color: #c99a4a !important;
          box-shadow: 0 0 0 3px rgba(201,154,74,.12) !important;
        }

        .college-quick-link small {
          color: #6f5a4e;
        }

        .college-quick-link.active small,
        .college-quick-link:hover small {
          color: #74151d;
        }

        .college-profile-menu .dropdown-item:hover {
          background: #fbf1e7;
          color: #74151d;
        }

        @media (
          max-width: 1200px
        ) {

          .college-navbar__brand strong {
            max-width: 170px;
          }

        }


        @media (
          max-width: 767px
        ) {

          .college-navbar {
            min-height: 64px;
          }


          .college-navbar__brand img {
            width: 37px;

            height: 37px;
          }


          .college-navbar__brand strong {
            max-width: 150px;

            font-size: 14px;
          }


          .college-navbar__brand small {
            display: none;
          }

        }


        /* =====================================================
           V6 — DEEP BURGUNDY TOP BAR
           Matches the premium sidebar/workspace shell while
           keeping all existing controls and behaviours intact.
           ===================================================== */
        .college-navbar {
          min-height: 70px;
          background:
            radial-gradient(circle at 88% -60%, rgba(230,190,118,.11), transparent 240px),
            linear-gradient(90deg, #641116 0%, #560a0f 52%, #45070b 100%);
          border-bottom: 1px solid rgba(225,183,118,.24);
          box-shadow: 0 8px 26px rgba(45,0,5,.16);
          backdrop-filter: none;
        }

        .college-navbar__brand img {
          background: #fffdf9;
          border-color: rgba(226,190,128,.68);
          box-shadow: 0 5px 15px rgba(30,0,3,.24);
        }

        .college-navbar__brand strong {
          color: #fff9f5;
          font-family: inherit;
          font-weight: 780;
          letter-spacing: -.01em;
        }

        .college-navbar__brand small {
          color: #e7c77f;
          letter-spacing: .12em;
        }

        .college-role-select {
          border-color: rgba(230,197,140,.24) !important;
          background-color: rgba(255,255,255,.075) !important;
          color: #fff3ef !important;
          font-weight: 760;
          box-shadow: none !important;
        }

        .college-role-select option {
          background: #561016;
          color: #fff;
        }

        .college-quick-link {
          color: #e2cbc5;
        }

        .college-quick-link > span {
          background: rgba(255,255,255,.06);
          border-color: rgba(229,196,140,.18);
          color: #efd9b0;
        }

        .college-quick-link small {
          color: #dbc1bb;
          font-weight: 720;
        }

        .college-quick-link:hover,
        .college-quick-link.active {
          color: #fff;
        }

        .college-quick-link:hover > span {
          background: rgba(255,255,255,.10);
          border-color: rgba(230,197,140,.30);
        }

        .college-quick-link:hover small,
        .college-quick-link.active small {
          color: #fff;
        }

        .college-quick-link.active > span {
          background: rgba(217,167,78,.18);
          color: #ffe3a8;
          border-color: rgba(233,197,129,.38);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.025);
        }

        .college-navbar__bell {
          border-color: rgba(229,196,140,.20);
          background: rgba(255,255,255,.065);
          color: #efd8ab;
        }

        .college-navbar__bell:hover {
          color: #fff1d2;
          background: rgba(255,255,255,.10);
          border-color: rgba(229,196,140,.34);
        }

        .college-profile-button {
          border-color: rgba(229,196,140,.20);
          background: rgba(255,255,255,.065);
          color: #fff0eb;
          box-shadow: none;
        }

        .college-profile-button:hover {
          background: rgba(255,255,255,.10);
          border-color: rgba(229,196,140,.34);
          color: #fff;
        }

        .college-profile-button img {
          border: 1px solid rgba(229,196,140,.24);
          background: #fff;
        }

        .college-navbar .branch-switcher .input-group-text {
          background: rgba(218,171,90,.14) !important;
          border-color: rgba(229,196,140,.22) !important;
          color: #f1d394 !important;
        }

        .college-navbar .branch-switcher .form-select {
          background-color: rgba(255,255,255,.075) !important;
          border-color: rgba(229,196,140,.22) !important;
          color: #fff3ef !important;
          font-weight: 700;
        }

        .college-navbar .branch-switcher .form-select option {
          background: #561016;
          color: #fff;
        }

        .college-navbar .branch-switcher .form-select:focus,
        .college-role-select:focus {
          border-color: rgba(231,191,112,.64) !important;
          box-shadow: 0 0 0 3px rgba(218,171,90,.10) !important;
        }

        .college-profile-menu {
          border-color: #dcc49a;
          background: #fffaf4;
          box-shadow: 0 16px 40px rgba(45,0,5,.22);
        }

        .college-profile-menu .dropdown-item {
          color: #5b2227;
        }

        .college-profile-menu .dropdown-item:hover {
          background: #f5e8de;
          color: #641116;
        }

        .college-navbar .navbar-toggler,
        .college-navbar .btn-light {
          border-color: rgba(229,196,140,.22) !important;
          background: rgba(255,255,255,.07) !important;
          color: #fff !important;
        }

        @media (max-width: 767px) {
          .college-navbar { min-height: 66px; }
        }

      `}</style>
    </>
  );
};

export default CollegeNavbar;