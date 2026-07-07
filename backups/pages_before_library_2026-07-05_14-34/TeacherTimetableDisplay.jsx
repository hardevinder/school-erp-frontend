import React, { useState, useEffect, useMemo } from 'react';

const API_URL = process.env.REACT_APP_API_URL;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const normalizeDay = (val) => {
  if (!val) return '';
  const s = String(val).trim().toLowerCase();
  const map = {
    mon: 'monday', monday: 'monday',
    tue: 'tuesday', tues: 'tuesday', tuesday: 'tuesday',
    wed: 'wednesday', weds: 'wednesday', wednesday: 'wednesday',
    thu: 'thursday', thur: 'thursday', thurs: 'thursday', thursday: 'thursday',
    fri: 'friday', friday: 'friday',
    sat: 'saturday', saturday: 'saturday',
  };
  const norm = map[s] || s;
  const cap = norm.charAt(0).toUpperCase() + norm.slice(1);
  return DAYS.includes(cap) ? cap : '';
};

const getPeriodId = (rec) =>
  rec?.periodId ?? rec?.period_id ?? rec?.PeriodId ?? rec?.Period?.id ?? rec?.period?.id;

const formatDate = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const TeacherTimetableDisplay = () => {
  const [periods, setPeriods] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [grid, setGrid] = useState({});
  const [holidays, setHolidays] = useState([]);

  // Separate states for the two substitution types:
  const [originalSubs, setOriginalSubs] = useState({});
  const [substitutedSubs, setSubstitutedSubs] = useState({});

  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState([]);

  // Current week Monday
  const [currentMonday, setCurrentMonday] = useState(() => {
    const today = new Date();
    const dayIndex = (today.getDay() + 6) % 7; // Monday=0
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayIndex);
    return monday;
  });

  const token = localStorage.getItem('token');
  const selectedTeacherId = 668; // TODO: replace with logged-in teacher id

  const todayStr = useMemo(() => formatDate(new Date()), []);

  // Memoized weekDates so effects don't refire every render
  const weekDates = useMemo(() => {
    const obj = {};
    DAYS.forEach((day, index) => {
      const d = new Date(currentMonday);
      d.setDate(currentMonday.getDate() + index);
      obj[day] = formatDate(d);
    });
    return obj;
  }, [currentMonday]);

  const pushError = (msg) => setErrors((prev) => [...prev, msg]);

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

  // Guard early
  useEffect(() => {
    if (!API_URL) pushError('REACT_APP_API_URL is not set.');
    if (!token) pushError('Auth token not found. Please login again.');
  }, [token]);

  // Fetch periods
  useEffect(() => {
    if (!API_URL || !token) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/periods`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        setPeriods(Array.isArray(data) ? data : (data?.periods || []));
      } catch (err) {
        console.error('Error fetching periods:', err);
        pushError('Failed to fetch periods.');
      }
    })();
  }, [token]);

  // Fetch timetable for the teacher (make sure we pass teacherId)
  useEffect(() => {
    if (!API_URL || !token) return;
    (async () => {
      try {
        const url = new URL(`${API_URL}/period-class-teacher-subject/timetable-teacher`);
        // Many backends expect teacherId / teacher_id; we set both safely
        url.searchParams.set('teacherId', String(selectedTeacherId));
        url.searchParams.set('teacher_id', String(selectedTeacherId));

        const res = await fetch(url.toString(), {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();

        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.timetable)
          ? data.timetable
          : [];

        // Normalize day/period so grid build is robust
        const normalized = list
          .map((rec) => ({
            ...rec,
            _dayNorm: normalizeDay(rec?.day),
            _periodId: getPeriodId(rec),
          }))
          .filter((rec) => rec._dayNorm && rec._periodId);

        setTimetable(normalized);
      } catch (err) {
        console.error('Error fetching timetable:', err);
        pushError('Failed to fetch timetable.');
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedTeacherId, currentMonday]); // refetch when week changes (if API is week-aware)

  // Fetch holidays (optionally send a range to reduce payload)
  useEffect(() => {
    if (!API_URL || !token) return;
    (async () => {
      try {
        const start = weekDates['Monday'];
        const end = weekDates['Saturday'];
        const url = new URL(`${API_URL}/holidays`);
        url.searchParams.set('start', start);
        url.searchParams.set('end', end);

        const res = await fetch(url.toString(), {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        setHolidays(Array.isArray(data) ? data : (data?.holidays || []));
      } catch (err) {
        console.error('Error fetching holidays:', err);
        pushError('Failed to fetch holidays.');
      }
    })();
  }, [token, weekDates]);

  // Fetch substitutions for each day of current week
  useEffect(() => {
    if (!API_URL || !token) return;
    const fetchSubstitutions = async () => {
      const origSubsByDate = {};
      const subSubsByDate = {};

      await Promise.all(
        Object.values(weekDates).map(async (date) => {
          // Original substitutions (teacher freed)
          try {
            const u = new URL(`${API_URL}/substitutions/by-date/original`);
            u.searchParams.set('date', date);
            u.searchParams.set('teacherId', String(selectedTeacherId));
            u.searchParams.set('teacher_id', String(selectedTeacherId));

            const res = await fetch(u.toString(), {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
            });
            const data = await res.json();
            origSubsByDate[date] = Array.isArray(data) ? data : (data?.rows || []);
          } catch (err) {
            console.error('Error fetching original substitutions for', date, err);
            origSubsByDate[date] = [];
          }

          // Substituted substitutions (teacher covering)
          try {
            const u2 = new URL(`${API_URL}/substitutions/by-date/substituted`);
            u2.searchParams.set('date', date);
            u2.searchParams.set('teacherId', String(selectedTeacherId));
            u2.searchParams.set('teacher_id', String(selectedTeacherId));

            const res2 = await fetch(u2.toString(), {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
            });
            const data2 = await res2.json();
            subSubsByDate[date] = Array.isArray(data2) ? data2 : (data2?.rows || []);
          } catch (err) {
            console.error('Error fetching substituted substitutions for', date, err);
            subSubsByDate[date] = [];
          }
        })
      );

      setOriginalSubs(origSubsByDate);
      setSubstitutedSubs(subSubsByDate);
    };

    fetchSubstitutions();
  }, [token, weekDates, selectedTeacherId]);

  // Build grid once periods & timetable are ready
  useEffect(() => {
    if (!Array.isArray(timetable) || periods.length === 0) {
      setGrid({});
      return;
    }
    const newGrid = {};
    DAYS.forEach((day) => {
      newGrid[day] = {};
      periods.forEach((p) => {
        newGrid[day][p.id] = [];
      });
    });

    timetable.forEach((rec) => {
      const dayKey = rec._dayNorm || normalizeDay(rec?.day);
      const pid = rec._periodId ?? getPeriodId(rec);
      if (dayKey && newGrid[dayKey] && pid != null && newGrid[dayKey][pid] !== undefined) {
        newGrid[dayKey][pid].push(rec);
      }
    });

    setGrid(newGrid);
  }, [timetable, periods]);

  // Workload calculations
  let rowWorkloadsRegular = {};
  let rowWorkloadsRed = {};
  let rowWorkloadsGreen = {};
  if (!isLoading && periods.length > 0) {
    DAYS.forEach((day) => {
      const date = weekDates[day];
      const holidayForDay = holidays.find((h) => h.date === date);
      let reg = 0,
        red = 0,
        green = 0;

      const origForDay = originalSubs[date] || [];
      const subForDay = substitutedSubs[date] || [];

      if (!holidayForDay && grid[day]) {
        periods.forEach((p) => {
          reg += (grid[day][p.id]?.length || 0);

          const origP = origForDay.filter(
            (s) =>
              (s.periodId ?? s.period_id ?? s.PeriodId) === p.id &&
              normalizeDay(s.day) === day &&
              s.date === date
          );
          const subP = subForDay.filter(
            (s) =>
              (s.periodId ?? s.period_id ?? s.PeriodId) === p.id &&
              normalizeDay(s.day) === day &&
              s.date === date
          );
          red += origP.length;
          green += subP.length;
        });
      }

      rowWorkloadsRegular[day] = reg;
      rowWorkloadsRed[day] = red;
      rowWorkloadsGreen[day] = green;
    });
  }

  const getNetWorkload = (day) =>
    (rowWorkloadsRegular[day] || 0) - (rowWorkloadsRed[day] || 0) + (rowWorkloadsGreen[day] || 0);

  let columnAdjustedWorkloads = {};
  if (!isLoading && periods.length > 0) {
    periods.forEach((p) => {
      let reg = 0,
        red = 0,
        green = 0;
      DAYS.forEach((day) => {
        const date = weekDates[day];
        const holidayForDay = holidays.find((h) => h.date === date);
        if (!holidayForDay && grid[day]) reg += grid[day][p.id]?.length || 0;

        const origForDay = originalSubs[date] || [];
        const subForDay = substitutedSubs[date] || [];

        red += origForDay.filter(
          (s) =>
            (s.periodId ?? s.period_id ?? s.PeriodId) === p.id &&
            normalizeDay(s.day) === day &&
            s.date === date
        ).length;

        green += subForDay.filter(
          (s) =>
            (s.periodId ?? s.period_id ?? s.PeriodId) === p.id &&
            normalizeDay(s.day) === day &&
            s.date === date
        ).length;
      });
      columnAdjustedWorkloads[p.id] = reg - red + green;
    });
  }

  const overallAdjustedWorkload = DAYS.reduce((acc, d) => acc + getNetWorkload(d), 0);

  const cellStyle = {
    minWidth: '200px',
    height: '80px',
    verticalAlign: 'middle',
    textAlign: 'center',
  };

  const workloadStyle = {
    backgroundColor: '#e9ecef',
    padding: '3px 6px',
    borderRadius: '4px',
    display: 'inline-block',
    margin: '2px',
  };

  return (
    <div className="container mt-4">
      <div className="card shadow">
        <div className="card-header bg-white text-dark d-flex align-items-center justify-content-between">
          <h3 className="mb-0">My Timetable</h3>
          <small className="text-muted">Teacher ID: {selectedTeacherId}</small>
        </div>

        {errors.length > 0 && (
          <div className="alert alert-warning m-3">
            {errors.map((e, i) => (
              <div key={i}>• {e}</div>
            ))}
          </div>
        )}

        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <button
              onClick={handlePrevWeek}
              title="Previous Week"
              className="btn btn-light rounded-circle shadow-sm d-flex align-items-center justify-content-center"
              style={{ width: '50px', height: '50px' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                <path
                  fillRule="evenodd"
                  d="M11.354 1.646a.5.5 0 0 1 0 .708L6.707 7l4.647 4.646a.5.5 0 0 1-.708.708l-5-5a.5.5 0 0 1 0-.708l5-5a.5.5 0 0 1 .708 0z"
                />
              </svg>
            </button>

            <div className="text-center fw-bold">
              Week: {formatDate(currentMonday)} to{' '}
              {formatDate(new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() + 5))}
            </div>

            <button
              onClick={handleNextWeek}
              title="Next Week"
              className="btn btn-light rounded-circle shadow-sm d-flex align-items-center justify-content-center"
              style={{ width: '50px', height: '50px' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                <path
                  fillRule="evenodd"
                  d="M4.646 1.646a.5.5 0 0 1 .708 0l5 5a.5.5 0 0 1 0 .708l-5 5a.5.5 0 1 1-.708-.708L9.293 7 4.646 2.354a.5.5 0 0 1 0-.708z"
                />
              </svg>
            </button>
          </div>

          {isLoading ? (
            <div className="text-center my-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-bordered table-hover" style={{ tableLayout: 'fixed', width: '100%' }}>
                <thead className="thead-dark">
                  <tr>
                    <th style={cellStyle}>Day</th>
                    {periods.map((period) => (
                      <th key={period.id} style={cellStyle}>
                        {period.period_name ?? period.name ?? `Period ${period.id}`}
                      </th>
                    ))}
                    <th style={cellStyle}>Workload</th>
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((day) => {
                    const date = weekDates[day];
                    const holidayForDay = holidays.find((h) => h.date === date);
                    const isToday = date === todayStr;
                    const rowClasses = `${holidayForDay ? 'table-danger' : ''} ${isToday ? 'border border-primary' : ''}`;

                    return (
                      <tr key={day} className={rowClasses}>
                        <td className="fw-bold" style={cellStyle}>
                          {day} {holidayForDay ? '(Holiday)' : ''} {isToday ? '(Today)' : ''}
                          <br />
                          <small>{date}</small>
                        </td>

                        {holidayForDay ? (
                          <td colSpan={periods.length} style={cellStyle}>
                            {holidayForDay.description ?? 'Holiday'}
                          </td>
                        ) : (
                          periods.map((p) => {
                            const cellRecords = grid?.[day]?.[p.id] || [];

                            // Match substitution records
                            const origForDay = originalSubs[date] || [];
                            const subForDay = substitutedSubs[date] || [];

                            const hasOrig = origForDay.find(
                              (s) =>
                                (s.periodId ?? s.period_id ?? s.PeriodId) === p.id &&
                                normalizeDay(s.day) === day &&
                                s.date === date
                            );

                            const hasSub = subForDay.find(
                              (s) =>
                                (s.periodId ?? s.period_id ?? s.PeriodId) === p.id &&
                                normalizeDay(s.day) === day &&
                                s.date === date
                            );

                            if (hasOrig) {
                              return (
                                <td key={p.id} style={cellStyle}>
                                  <div className="p-2 border rounded shadow-sm" style={{ backgroundColor: '#f8d7da' }}>
                                    <div className="small fw-bold">Freed by:</div>
                                    <div className="small">
                                      {hasOrig.Teacher?.name || ''} - <strong>{hasOrig.Class?.class_name || ''}</strong> -{' '}
                                      {hasOrig.Subject?.name || ''}
                                    </div>
                                  </div>
                                </td>
                              );
                            }

                            if (hasSub) {
                              return (
                                <td key={p.id} style={cellStyle}>
                                  <div className="p-2 border rounded shadow-sm" style={{ backgroundColor: '#d4edda' }}>
                                    <div className="small fw-bold">Covering:</div>
                                    <div className="small">
                                      {hasSub.OriginalTeacher?.name || ''} - <strong>{hasSub.Class?.class_name || ''}</strong> -{' '}
                                      {hasSub.Subject?.name || ''}
                                    </div>
                                  </div>
                                </td>
                              );
                            }

                            return (
                              <td key={p.id} style={cellStyle} className={cellRecords.length === 0 ? 'bg-light' : ''}>
                                {cellRecords.length > 0 ? (
                                  cellRecords.map((rec, i) => (
                                    <div key={i} className="mb-2 p-2 border rounded shadow-sm">
                                      <div className="small">
                                        <strong>{rec.Class?.class_name || ''}</strong>
                                      </div>
                                      <div className="small">{rec.Subject?.name || rec.subjectId || ''}</div>
                                    </div>
                                  ))
                                ) : (
                                  <div>&nbsp;</div>
                                )}
                              </td>
                            );
                          })
                        )}

                        <td className="text-center fw-bold" style={cellStyle}>
                          <span style={workloadStyle}>
                            {(() => {
                              const regular = rowWorkloadsRegular[day] || 0;
                              const red = rowWorkloadsRed[day] || 0;
                              const green = rowWorkloadsGreen[day] || 0;
                              return red > 0 || green > 0 ? `${regular} - ${red} + ${green} = ${regular - red + green}` : `${regular}`;
                            })()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot className="bg-light">
                  <tr>
                    <th style={cellStyle}>Total Workload</th>
                    {periods.map((p) => (
                      <th key={p.id} style={cellStyle}>
                        <span style={workloadStyle}>{columnAdjustedWorkloads[p.id] || 0}</span>
                      </th>
                    ))}
                    <th style={cellStyle}>
                      <span style={workloadStyle}>{overallAdjustedWorkload}</span>
                    </th>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherTimetableDisplay;
