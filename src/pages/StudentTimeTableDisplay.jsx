// src/pages/StudentTimetableDisplay.jsx
import React, { useState, useEffect, useMemo } from "react";
import "bootstrap/dist/css/bootstrap.min.css";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const StudentTimetableDisplay = () => {
  const [periods, setPeriods] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [grid, setGrid] = useState({});
  const [holidays, setHolidays] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [studentSubs, setStudentSubs] = useState({});

  // NEW: which accordion is open on mobile
  const [mobileOpenIdx, setMobileOpenIdx] = useState(0);

  const token = localStorage.getItem("token");

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

  // Data: periods
  useEffect(() => {
    fetch("http://localhost:3000/periods", {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setPeriods(data || []))
      .catch((err) => console.error("Error fetching periods:", err));
  }, [token]);

  // Data: timetable
  useEffect(() => {
    fetch("http://localhost:3000/period-class-teacher-subject/student/timetable", {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setTimetable(data);
        else if (data && Array.isArray(data.timetable)) setTimetable(data.timetable);
        else setTimetable([]);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching timetable:", err);
        setIsLoading(false);
      });
  }, [token]);

  // Data: holidays
  useEffect(() => {
    fetch("http://localhost:3000/holidays", {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setHolidays(data || []))
      .catch((err) => console.error("Error fetching holidays:", err));
  }, [token]);

  // Build grid
  useEffect(() => {
    if (!Array.isArray(timetable)) return;

    const newGrid = {};
    days.forEach((day) => {
      newGrid[day] = {};
      periods.forEach((period) => {
        newGrid[day][period.id] = [];
      });
    });

    timetable.forEach((record) => {
      const { day, periodId } = record;
      if (newGrid[day] && newGrid[day][periodId] !== undefined) {
        newGrid[day][periodId].push(record);
      }
    });

    setGrid(newGrid);
  }, [timetable, periods]);

  // Data: substitutions per date of current week
  useEffect(() => {
    const fetchSubs = async () => {
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
              `http://localhost:3000/substitutions/by-date/student?date=${date}`,
              { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }
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

    fetchSubs();
  }, [token, currentMonday]);

  // Week nav
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
    header: { background: "linear-gradient(135deg, #0d6efd 0%, #5aa1ff 100%)", color: "white" },
    chip: { background: "rgba(13,110,253,.08)", border: "1px solid rgba(13,110,253,.25)", borderRadius: 12 },
    substitution: { background: "rgba(13,110,253,.06)", border: "1px dashed rgba(13,110,253,.45)", borderRadius: 12 },
    todayOutline: { boxShadow: "inset 0 0 0 2px #0d6efd", borderRadius: "12px" },
  };

  const cellBase = { minWidth: "160px", height: "84px", verticalAlign: "middle", textAlign: "center" };

  const weekRangeText = `${formatDate(currentMonday)} — ${formatDate(
    new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() + 5)
  )}`;

  const DayHeading = ({ day }) => {
    const isCurrentDay = weekDates[day] === currentDateStr;
    const holidayForDay = holidays.find((h) => h.date === weekDates[day]);
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
              <button onClick={handlePrevWeek} className="btn btn-light btn-sm rounded-pill px-3" title="Previous Week">
                ‹ Prev
              </button>
              <button
                onClick={handleThisWeek}
                className="btn btn-outline-light btn-sm rounded-pill px-3"
                title="Jump to This Week"
              >
                This Week
              </button>
              <button onClick={handleNextWeek} className="btn btn-light btn-sm rounded-pill px-3" title="Next Week">
                Next ›
              </button>
            </div>
          </div>
        </div>

        <div className="card-body">
          {isLoading ? (
            <div className="text-center my-5">
              <div className="spinner-border text-primary" role="status" aria-label="Loading timetable"></div>
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
                        const holidayForDay = holidays.find((h) => h.date === weekDates[day]);
                        const isCurrentDay = weekDates[day] === currentDateStr;

                        return (
                          <tr key={day} className={holidayForDay ? "table-danger" : ""} style={isCurrentDay ? theme.todayOutline : {}}>
                            <td style={{ ...cellBase, textAlign: "left" }}>
                              <DayHeading day={day} />
                              <small className="text-muted">{weekDates[day]}</small>
                            </td>

                            {holidayForDay ? (
                              <td colSpan={periods.length} style={cellBase}>
                                <div className="fw-semibold">{holidayForDay.description || "Holiday"}</div>
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
                                  <td key={period.id} style={cellBase} className={cellRecords.length === 0 ? "bg-light" : ""}>
                                    {cellRecords.length > 0 ? (
                                      cellRecords.map((record, i) => (
                                        <div key={i} className="p-2 small mb-2" style={theme.chip}>
                                          <div className="fw-semibold">
                                            {record.Subject ? record.Subject.name : record.subjectId}
                                          </div>
                                          <div className="text-muted">{record.Teacher ? record.Teacher.name : ""}</div>
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
                    const holidayForDay = holidays.find((h) => h.date === weekDates[day]);
                    const isCurrentDay = weekDates[day] === currentDateStr;
                    const expanded = mobileOpenIdx === idx;

                    return (
                      <div className="accordion-item mb-2 border-0 shadow-sm" key={day}>
                        <h2 className="accordion-header">
                          <button
                            className={`accordion-button ${holidayForDay ? "bg-danger-subtle" : ""} ${expanded ? "" : "collapsed"}`}
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

                        <div id={`pane-${idx}`} className={`accordion-collapse collapse ${expanded ? "show" : ""}`}>
                          <div className="accordion-body">
                            {holidayForDay ? (
                              <div className="alert alert-danger mb-0">{holidayForDay.description || "Holiday"}</div>
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
                                            <div className="text-muted">{s.Teacher ? s.Teacher.name : ""}</div>
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
                                              <div className="text-muted">{record.Teacher ? record.Teacher.name : ""}</div>
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

      <div className="text-muted small mt-2">Tip: Use “This Week” to jump back to the current week.</div>
    </div>
  );
};

export default StudentTimetableDisplay;
