// src/pages/StudentTimetableDisplay.jsx
import React, { useState, useEffect, useMemo } from "react";
import "bootstrap/dist/css/bootstrap.min.css";

const API_URL = process.env.REACT_APP_API_URL || "";
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/* Helpers */
const normalizeAdmission = (s) => String(s || "").replace(/\//g, "-").trim();
const normalizeRole = (r) => String(r || "").toLowerCase();

const StudentTimetableDisplay = () => {
  const [periods, setPeriods] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [grid, setGrid] = useState({});
  const [holidays, setHolidays] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [studentSubs, setStudentSubs] = useState({});

  // NEW: which accordion is open on mobile
  const [mobileOpenIdx, setMobileOpenIdx] = useState(0);

  // NEW: roles + switcher state (parity with Diary/Navbar)
  const token = localStorage.getItem("token");
  const parseJwt = (tkn) => {
    try {
      const p = tkn.split(".")[1];
      return JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
      return null;
    }
  };

  const roles = useMemo(() => {
    try {
      const stored = localStorage.getItem("roles");
      if (stored) return JSON.parse(stored).map(normalizeRole);
    } catch {}
    const single = localStorage.getItem("userRole");
    if (single) return [normalizeRole(single)];
    const payload = token ? parseJwt(token) : null;
    if (payload) {
      if (Array.isArray(payload.roles)) return payload.roles.map(normalizeRole);
      if (payload.role) return [normalizeRole(payload.role)];
    }
    return [];
  }, [token]);

  const isStudent = roles.includes("student");
  const isParent = roles.includes("parent");
  const canSeeStudentSwitcher = isStudent || isParent;

  // Family + active student selection
  const [family, setFamily] = useState(null);
  const [activeStudentAdmission, setActiveStudentAdmission] = useState(
    () =>
      localStorage.getItem("activeStudentAdmission") ||
      localStorage.getItem("username") ||
      ""
  );

  const studentsList = useMemo(() => {
    if (!family) return [];
    const list = [];
    if (family.student) list.push({ ...family.student, isSelf: true });
    (family.siblings || []).forEach((s) => list.push({ ...s, isSelf: false }));
    return list;
  }, [family]);

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
    const onStudentSwitched = () => {
      load();
      // refetch for new student
      fetchTimetable({
        admissionOverride: localStorage.getItem("activeStudentAdmission"),
      });
      fetchSubstitutionsForWeek(); // keep subs in sync (uses student context endpoint)
    };

    window.addEventListener("family-updated", onFamilyUpdated);
    window.addEventListener("student-switched", onStudentSwitched);
    return () => {
      window.removeEventListener("family-updated", onFamilyUpdated);
      window.removeEventListener("student-switched", onStudentSwitched);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStudentSwitch = (admissionNumber) => {
    const norm = normalizeAdmission(admissionNumber);
    if (!norm || norm === activeStudentAdmission) return;
    try {
      localStorage.setItem("activeStudentAdmission", norm);
      setActiveStudentAdmission(norm);
      window.dispatchEvent(
        new CustomEvent("student-switched", {
          detail: { admissionNumber: norm },
        })
      );
      fetchTimetable({ admissionOverride: norm });
      fetchSubstitutionsForWeek();
    } catch (e) {
      console.warn("Failed to switch student", e);
    }
  };

  // Utils
  const formatDate = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const [currentMonday, setCurrentMonday] = useState(() => {
    const today = new Date();
    const dayIndex = (today.getDay() + 6) % 7; // Monday=0
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayIndex);
    return monday;
  });

  // Build this week's date map
  const weekDates = useMemo(() => {
    const map = {};
    days.forEach((_, index) => {
      const d = new Date(currentMonday);
      d.setDate(currentMonday.getDate() + index);
      map[days[index]] = formatDate(d);
    });
    return map;
  }, [currentMonday]);

  const currentDateStr = formatDate(new Date());

  // NEW: compute today's index inside this week (or -1 if not in this week)
  const todaysIdx = useMemo(() => {
    const idx = days.findIndex((d) => weekDates[d] === currentDateStr);
    return idx; // -1 if not found
  }, [weekDates, currentDateStr]);

  // Determine which admission we should query for
  const admissionForQuery = useMemo(() => {
    const storedActive = localStorage.getItem("activeStudentAdmission");
    if (storedActive) return normalizeAdmission(storedActive);
    const stored = localStorage.getItem("username");
    if (stored) return normalizeAdmission(stored);
    const payload = token ? parseJwt(token) : null;
    const adm = (payload && (payload.admission_number || payload.username)) || "";
    return normalizeAdmission(adm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStudentAdmission]);

  // Admission tied to the logged-in token
  const loggedInAdmission = useMemo(() => {
    const stored = localStorage.getItem("username");
    if (stored) return normalizeAdmission(stored);
    const payload = token ? parseJwt(token) : null;
    const adm = (payload && (payload.admission_number || payload.username)) || "";
    return normalizeAdmission(adm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // If not a student, or the active admission differs from logged-in → use by-admission endpoint
  const shouldUseByAdmission = useMemo(() => {
    const active = normalizeAdmission(
      (localStorage.getItem("activeStudentAdmission") ||
        activeStudentAdmission ||
        "").trim()
    );
    return !isStudent || (active && active !== loggedInAdmission);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStudent, activeStudentAdmission, loggedInAdmission]);

  // ✅ FIX: get active student object + classId, then filter holidays by classId
  const activeStudent = useMemo(() => {
    const active = normalizeAdmission(activeStudentAdmission);
    return (studentsList || []).find(
      (s) => normalizeAdmission(s?.admission_number) === active
    );
  }, [studentsList, activeStudentAdmission]);

  const activeClassId = useMemo(() => {
    if (!activeStudent) return null;
    return (
      activeStudent.classId ??
      activeStudent.class_id ??
      activeStudent.class?.id ??
      null
    );
  }, [activeStudent]);

  const getHolidayForDate = (dateStr) => {
    if (!Array.isArray(holidays) || !dateStr) return null;
    if (activeClassId == null) return null;

    return (
      holidays.find(
        (h) =>
          h?.date === dateStr &&
          ((h?.classId ?? h?.class?.id) === activeClassId)
      ) || null
    );
  };

  /* Data: periods */
  useEffect(() => {
    if (!API_URL) return;
    fetch(`${API_URL}/periods`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => setPeriods(data || []))
      .catch((err) => console.error("Error fetching periods:", err));
  }, [token]);

  /* Data: timetable (supports switcher) */
  const fetchTimetable = async (opts = { admissionOverride: null }) => {
    if (!API_URL) return;
    setIsLoading(true);
    try {
      let url = `${API_URL}/period-class-teacher-subject/student/timetable`;
      if (shouldUseByAdmission) {
        const adm = normalizeAdmission(opts.admissionOverride || admissionForQuery);
        if (!adm) throw new Error("No active student selected.");
        url = `${API_URL}/period-class-teacher-subject/timetable/by-admission/${encodeURIComponent(
          adm
        )}`;
      }

      const res = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (Array.isArray(data)) setTimetable(data);
      else if (data && Array.isArray(data.timetable)) setTimetable(data.timetable);
      else setTimetable([]);
    } catch (err) {
      console.error("Error fetching timetable:", err);
      setTimetable([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTimetable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, shouldUseByAdmission, admissionForQuery]);

  /* Data: holidays */
  useEffect(() => {
    if (!API_URL) return;
    fetch(`${API_URL}/holidays`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => setHolidays(data || []))
      .catch((err) => console.error("Error fetching holidays:", err));
  }, [token]);

  /* Build grid */
  useEffect(() => {
    if (!Array.isArray(timetable)) return;

    const newGrid = {};
    days.forEach((day) => {
      newGrid[day] = {};
      (periods || []).forEach((period) => {
        newGrid[day][period.id] = [];
      });
    });

    timetable.forEach((record) => {
      const { day, periodId } = record || {};
      if (
        day &&
        periodId != null &&
        newGrid[day] &&
        newGrid[day][periodId] !== undefined
      ) {
        newGrid[day][periodId].push(record);
      }
    });

    setGrid(newGrid);
  }, [timetable, periods]);

  /* Data: substitutions per date of current week
     NOTE: This still uses the student-context endpoint:
           /substitutions/by-date/student?date=YYYY-MM-DD
     If you later add a by-admission variant for substitutions too,
     you can mirror the same shouldUseByAdmission logic here. */
  const fetchSubstitutionsForWeek = async () => {
    if (!API_URL) return;
    const subs = {};
    const dates = days.map((_, i) => {
      const d = new Date(currentMonday);
      d.setDate(currentMonday.getDate() + i);
      return formatDate(d);
    });

    await Promise.all(
      dates.map(async (date) => {
        try {
          const res = await fetch(
            `${API_URL}/substitutions/by-date/student?date=${date}`,
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
            }
          );
          const data = await res.json();
          subs[date] = data;
        } catch (err) {
          console.error(`Error fetching substitutions for ${date}:`, err);
          subs[date] = [];
        }
      })
    );
    setStudentSubs(subs);
  };

  useEffect(() => {
    fetchSubstitutionsForWeek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, currentMonday]);

  /* Week nav */
  const handlePrevWeek = () => {
    const prevMonday = new Date(currentMonday);
    prevMonday.setDate(currentMonday.getDate() - 7);
    setCurrentMonday(prevMonday);
  };

  const handleNextWeek = () => {
    const nextMonday = new Date(currentMonday);
    nextMonday.setDate(currentMonday.getDate() + 7);
    setCurrentMonday(nextMonday);
  };

  const handleThisWeek = () => {
    const today = new Date();
    const dayIndex = (today.getDay() + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayIndex);
    setCurrentMonday(monday);
  };

  // THEME (bluish & cleaner)
  const theme = {
    header: {
      background: "linear-gradient(135deg, #0d6efd 0%, #5aa1ff 100%)",
      color: "white",
    },
    chip: {
      background: "rgba(13,110,253,.08)",
      border: "1px solid rgba(13,110,253,.25)",
      borderRadius: 12,
    },
    substitution: {
      background: "rgba(13,110,253,.06)",
      border: "1px dashed rgba(13,110,253,.45)",
      borderRadius: 12,
    },
    todayOutline: {
      boxShadow: "inset 0 0 0 2px #0d6efd",
      borderRadius: "12px",
    },
  };

  const cellBase = {
    minWidth: "160px",
    height: "84px",
    verticalAlign: "middle",
    textAlign: "center",
  };

  const weekRangeText = `${formatDate(currentMonday)} — ${formatDate(
    new Date(
      currentMonday.getFullYear(),
      currentMonday.getMonth(),
      currentMonday.getDate() + 5
    )
  )}`;

  const DayHeading = ({ day }) => {
    const isCurrentDay = weekDates[day] === currentDateStr;
    const holidayForDay = getHolidayForDate(weekDates[day]);

    return (
      <div className="d-flex align-items-center gap-2">
        <span className="fw-semibold">{day}</span>
        {isCurrentDay && <span className="badge text-bg-primary">Today</span>}
        {holidayForDay && <span className="badge text-bg-danger">Holiday</span>}
      </div>
    );
  };

  // NEW: when week changes, open Today's accordion on mobile if present; else open first day
  useEffect(() => {
    setMobileOpenIdx(todaysIdx >= 0 ? todaysIdx : 0);
  }, [todaysIdx, currentMonday]);

  return (
    <div className="container py-3">
      {/* Header */}
      <div className="card shadow-sm border-0 overflow-hidden">
        <div className="card-header border-0" style={theme.header}>
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
            <div>
              <h3 className="mb-1">My Timetable</h3>
              <div className="opacity-75 small">Week: {weekRangeText}</div>
            </div>

            <div className="d-flex align-items-center gap-2">
              <button
                onClick={handlePrevWeek}
                className="btn btn-light btn-sm rounded-pill px-3"
                title="Previous Week"
              >
                ‹ Prev
              </button>
              <button
                onClick={handleThisWeek}
                className="btn btn-outline-light btn-sm rounded-pill px-3"
                title="Jump to This Week"
              >
                This Week
              </button>
              <button
                onClick={handleNextWeek}
                className="btn btn-light btn-sm rounded-pill px-3"
                title="Next Week"
              >
                Next ›
              </button>
            </div>
          </div>

          {/* Student switcher UI (Desktop pills + Mobile select), placed in header for visibility */}
          {canSeeStudentSwitcher && studentsList.length > 0 && (
            <div className="mt-3">
              {/* Desktop pills */}
              <div
                className="d-none d-lg-flex align-items-center gap-1"
                role="tablist"
                aria-label="Switch student"
              >
                {studentsList.map((s) => {
                  const isActive =
                    normalizeAdmission(s.admission_number) ===
                    normalizeAdmission(activeStudentAdmission);

                  return (
                    <button
                      key={s.admission_number}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`btn btn-sm ${
                        isActive ? "btn-warning" : "btn-outline-light"
                      } rounded-pill px-3`}
                      onClick={() => handleStudentSwitch(s.admission_number)}
                      title={`${s.name} (${s.class?.name || "—"}-${
                        s.section?.name || "—"
                      })`}
                      style={{
                        maxWidth: 220,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.isSelf ? "Me" : s.name}
                      <span className="ms-1" style={{ opacity: 0.85 }}>
                        {s.class?.name
                          ? ` · ${s.class.name}-${s.section?.name || "—"}`
                          : ""}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Mobile select */}
              <div className="d-lg-none mt-2">
                <label htmlFor="studentSwitcherMobileTT" className="visually-hidden">
                  Switch student
                </label>
                <select
                  id="studentSwitcherMobileTT"
                  className="form-select form-select-sm bg-light border-0"
                  value={activeStudentAdmission}
                  onChange={(e) => handleStudentSwitch(e.target.value)}
                >
                  {studentsList.map((s) => (
                    <option key={s.admission_number} value={s.admission_number}>
                      {(s.isSelf ? "Me: " : "") + s.name}{" "}
                      {s.class?.name ? `(${s.class.name}-${s.section?.name || "—"})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="card-body">
          {isLoading ? (
            <div className="text-center my-5">
              <div
                className="spinner-border text-primary"
                role="status"
                aria-label="Loading timetable"
              ></div>
              <div className="small mt-2 text-muted">Fetching your timetable…</div>
            </div>
          ) : (
            <>
              {/* Legend */}
              <div className="d-flex flex-wrap gap-2 mb-3">
                <span className="badge rounded-pill text-bg-primary">Today</span>
                <span className="badge rounded-pill text-bg-danger">Holiday</span>
                <span className="badge rounded-pill text-bg-info">Substitution</span>
              </div>

              {/* Desktop / Tablet table */}
              <div className="d-none d-md-block">
                <div className="table-responsive-md">
                  <table className="table align-middle table-bordered table-hover">
                    <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                      <tr>
                        <th style={{ ...cellBase, minWidth: "200px" }}>Day</th>
                        {periods.map((p) => (
                          <th key={p.id} className="text-center" style={cellBase}>
                            <div className="fw-semibold">{p.period_name}</div>
                            {p.start_time && p.end_time && (
                              <small className="text-muted">
                                {p.start_time}–{p.end_time}
                              </small>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {days.map((day) => {
                        const holidayForDay = getHolidayForDate(weekDates[day]);
                        const isCurrentDay = weekDates[day] === currentDateStr;

                        return (
                          <tr
                            key={day}
                            className={holidayForDay ? "table-danger" : ""}
                            style={isCurrentDay ? theme.todayOutline : {}}
                          >
                            <td style={{ ...cellBase, textAlign: "left" }}>
                              <DayHeading day={day} />
                              <small className="text-muted">{weekDates[day]}</small>
                            </td>

                            {holidayForDay ? (
                              <td colSpan={periods.length} style={cellBase}>
                                <div className="fw-semibold">
                                  {holidayForDay.description || "Holiday"}
                                </div>
                              </td>
                            ) : (
                              periods.map((period) => {
                                const subsForDay = studentSubs[weekDates[day]] || [];
                                const subsForPeriod = subsForDay.filter(
                                  (sub) => sub.periodId === period.id && sub.day === day
                                );

                                if (subsForPeriod.length > 0) {
                                  const s = subsForPeriod[0];
                                  return (
                                    <td key={period.id} style={cellBase}>
                                      <div className="p-2 small" style={theme.substitution}>
                                        <div className="fw-semibold mb-1">Substitution</div>
                                        <div>{s.Subject ? s.Subject.name : ""}</div>
                                        <div className="text-muted">{s.Teacher ? s.Teacher.name : ""}</div>
                                      </div>
                                    </td>
                                  );
                                }

                                const cellRecords = grid[day]?.[period.id] || [];
                                return (
                                  <td
                                    key={period.id}
                                    style={cellBase}
                                    className={cellRecords.length === 0 ? "bg-light" : ""}
                                  >
                                    {cellRecords.length > 0 ? (
                                      cellRecords.map((record, i) => (
                                        <div key={i} className="p-2 small mb-2" style={theme.chip}>
                                          <div className="fw-semibold">
                                            {record.Subject ? record.Subject.name : record.subjectId}
                                          </div>
                                          <div className="text-muted">
                                            {record.Teacher ? record.Teacher.name : ""}
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <span className="text-muted small">—</span>
                                    )}
                                  </td>
                                );
                              })
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile cards / accordion — NOW auto-opens Today */}
              <div className="d-md-none">
                <div className="accordion" id="timetableAccordion">
                  {days.map((day, idx) => {
                    const holidayForDay = getHolidayForDate(weekDates[day]);
                    const isCurrentDay = weekDates[day] === currentDateStr;
                    const expanded = mobileOpenIdx === idx;

                    return (
                      <div className="accordion-item mb-2 border-0 shadow-sm" key={day}>
                        <h2 className="accordion-header">
                          <button
                            className={`accordion-button ${
                              holidayForDay ? "bg-danger-subtle" : ""
                            } ${expanded ? "" : "collapsed"}`}
                            type="button"
                            onClick={() => setMobileOpenIdx(expanded ? -1 : idx)}
                            aria-expanded={expanded}
                            aria-controls={`pane-${idx}`}
                            style={isCurrentDay ? theme.todayOutline : {}}
                          >
                            <div className="d-flex flex-column">
                              <DayHeading day={day} />
                              <small className="text-muted">{weekDates[day]}</small>
                            </div>
                          </button>
                        </h2>

                        <div
                          id={`pane-${idx}`}
                          className={`accordion-collapse collapse ${expanded ? "show" : ""}`}
                        >
                          <div className="accordion-body">
                            {holidayForDay ? (
                              <div className="alert alert-danger mb-0">
                                {holidayForDay.description || "Holiday"}
                              </div>
                            ) : (
                              <div className="d-flex flex-column gap-2">
                                {periods.map((p) => {
                                  const subsForDay = studentSubs[weekDates[day]] || [];
                                  const subsForPeriod = subsForDay.filter(
                                    (sub) => sub.periodId === p.id && sub.day === day
                                  );

                                  if (subsForPeriod.length > 0) {
                                    const s = subsForPeriod[0];
                                    return (
                                      <div key={p.id} className="card border-0 shadow-sm">
                                        <div className="card-body p-3">
                                          <div className="d-flex justify-content-between align-items-center mb-1">
                                            <div className="fw-semibold">{p.period_name}</div>
                                            {p.start_time && p.end_time && (
                                              <small className="text-muted">
                                                {p.start_time}–{p.end_time}
                                              </small>
                                            )}
                                          </div>
                                          <div className="p-2 small" style={theme.substitution}>
                                            <div className="fw-semibold mb-1">Substitution</div>
                                            <div>{s.Subject ? s.Subject.name : ""}</div>
                                            <div className="text-muted">
                                              {s.Teacher ? s.Teacher.name : ""}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }

                                  const cellRecords = grid[day]?.[p.id] || [];
                                  return (
                                    <div key={p.id} className="card border-0 shadow-sm">
                                      <div className="card-body p-3">
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                          <div className="fw-semibold">{p.period_name}</div>
                                          {p.start_time && p.end_time && (
                                            <small className="text-muted">
                                              {p.start_time}–{p.end_time}
                                            </small>
                                          )}
                                        </div>

                                        {cellRecords.length > 0 ? (
                                          cellRecords.map((record, i) => (
                                            <div key={i} className="p-2 small mb-1" style={theme.chip}>
                                              <div className="fw-semibold">
                                                {record.Subject ? record.Subject.name : record.subjectId}
                                              </div>
                                              <div className="text-muted">
                                                {record.Teacher ? record.Teacher.name : ""}
                                              </div>
                                            </div>
                                          ))
                                        ) : (
                                          <span className="text-muted small">No class</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="text-muted small mt-2">
        Tip: Use “This Week” to jump back to the current week.
      </div>
    </div>
  );
};

export default StudentTimetableDisplay;
