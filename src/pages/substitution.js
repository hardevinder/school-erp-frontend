import React, { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';

const API_URL = process.env.REACT_APP_API_URL;

// Canonical internal day keys
const CANON_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const prettyDay = (d) => d.charAt(0).toUpperCase() + d.slice(1);

// Accepts "Monday", "MONDAY", "Mon" → "monday"
const normalizeDay = (val) => {
  if (!val) return null;
  const s = String(val).trim().toLowerCase();
  if (CANON_DAYS.includes(s)) return s;
  const map = {
    mon: 'monday',
    tue: 'tuesday',
    wed: 'wednesday',
    thu: 'thursday',
    thur: 'thursday',
    fri: 'friday',
    sat: 'saturday',
  };
  if (map[s]) return map[s];
  const short = s.slice(0, 3);
  if (map[short]) return map[short];
  return null;
};

const toNum = (v) => {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) ? n : null;
};

const formatDate = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// map: canonicalDay -> YYYY-MM-DD for Mon–Sat week containing pivotDateStr
const weekDatesFor = (pivotDateStr) => {
  const d = new Date(pivotDateStr);
  const dow = (d.getDay() + 6) % 7; // Monday=0
  const monday = new Date(d);
  monday.setDate(d.getDate() - dow);
  const map = {};
  CANON_DAYS.forEach((day, i) => {
    const di = new Date(monday);
    di.setDate(monday.getDate() + i);
    map[day] = formatDate(di);
  });
  return map;
};

const canonicalWeekdayFromDate = (dateStr) =>
  normalizeDay(new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' }));

const safeGetClassName = (rec) =>
  rec?.Class?.class_name ?? rec?.Class?.name ?? rec?.className ?? rec?.class_name ?? '';

const safeGetSubjectName = (rec) =>
  rec?.Subject?.name ?? rec?.subjectName ?? rec?.subject ?? 'No Subject';

/* ==== persistence keys ==== */
const LS_TEACHER = 'ttv:selectedTeacherUserId';
const LS_DATE = 'ttv:selectedDate';

const readLS = (k, d) => {
  try {
    const v = localStorage.getItem(k);
    return v ?? d;
  } catch {
    return d;
  }
};

const writeLS = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};

// initial date: prefer stored if not older than 7 days, else today
const getInitialSelectedDate = () => {
  const todayStr = formatDate(new Date());
  const stored = readLS(LS_DATE, null);
  if (!stored) return todayStr;
  const storedTime = Date.parse(stored);
  const todayTime = Date.parse(todayStr);
  if (Number.isNaN(storedTime)) return todayStr;
  const diffDays = Math.abs((todayTime - storedTime) / (1000 * 60 * 60 * 24));
  if (diffDays > 7) return todayStr;
  return stored;
};

const TeacherTimetableView = () => {
  // Teachers stored as { userId, employeeId?, name }
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null); // { userId, employeeId?, name }

  const [periods, setPeriods] = useState([]); // [{id, name}]
  const [timetable, setTimetable] = useState([]); // records
  const [globalTimetable, setGlobalTimetable] = useState([]); // optional
  const [holidays, setHolidays] = useState([]); // [{date, description}]
  const [isLoading, setIsLoading] = useState(false);

  const [selectedDay, setSelectedDay] = useState(null); // canonical day
  const [selectedPeriod, setSelectedPeriod] = useState(null); // number

  const [availableTeachersWithWorkload, setAvailableTeachersWithWorkload] = useState([]);

  // substitutions = current UI state per cell; originalSubs = snapshot from backend for selected date
  const [substitutions, setSubstitutions] = useState({});
  const [originalSubs, setOriginalSubs] = useState({});

  const [selectedDate, setSelectedDate] = useState(getInitialSelectedDate);
  const token = useMemo(() => localStorage.getItem('token') || '', []);

  // Derived
  const todayStr = useMemo(() => formatDate(new Date()), []);
  const weekDates = useMemo(() => weekDatesFor(selectedDate), [selectedDate]);
  const weekdayOfSelectedDate = useMemo(
    () => canonicalWeekdayFromDate(selectedDate),
    [selectedDate]
  );

  // Headers
  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  /* ===================== Loaders ===================== */

  // Load teachers → normalize to {userId, employeeId, name} and restore persisted selection
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/teachers`, { headers: authHeaders });
        if (!res.ok) throw new Error(`GET /teachers ${res.status}`);
        const data = await res.json();
        const raw = data?.teachers || data || [];

        const list = raw
          .map((t) => ({
            userId: toNum(t?.user_id ?? t?.User?.id ?? t?.id),
            employeeId: toNum(t?.employee_id ?? t?.Employee?.id ?? null),
            name: t?.name ?? t?.Employee?.name ?? t?.User?.name ?? 'Unnamed',
          }))
          .filter((t) => t.userId != null);

        setTeachers(list);

        // try to restore previous teacher; fall back to first
        const fromLS = toNum(readLS(LS_TEACHER, null));
        const found = fromLS ? list.find((x) => x.userId === fromLS) : null;
        setSelectedTeacher(found || list[0] || null);
      } catch (e) {
        console.error('Error fetching teachers:', e);
        setTeachers([]);
        setSelectedTeacher(null);
      }
    })();
  }, [authHeaders]);

  // Persist teacher & date whenever they change
  useEffect(() => {
    if (selectedTeacher?.userId != null) {
      writeLS(LS_TEACHER, String(selectedTeacher.userId));
    }
  }, [selectedTeacher]);

  useEffect(() => {
    if (selectedDate) {
      writeLS(LS_DATE, selectedDate);
    }
  }, [selectedDate]);

  // Load periods
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/periods`, { headers: authHeaders });
        if (!res.ok) throw new Error(`GET /periods ${res.status}`);
        const data = await res.json();
        const arr = Array.isArray(data) ? data : data?.periods || [];
        const normalized = arr
          .map((p) => ({
            id: toNum(p?.id ?? p?.periodId),
            name: p?.period_name ?? p?.name ?? `P${p?.id ?? ''}`,
          }))
          .filter((p) => p.id != null);
        setPeriods(normalized);
      } catch (e) {
        console.error('Error fetching periods:', e);
        setPeriods([]);
      }
    })();
  }, [authHeaders]);

  // Load holidays
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/holidays`, { headers: authHeaders });
        if (!res.ok) throw new Error(`GET /holidays ${res.status}`);
        const data = await res.json();
        const arr = Array.isArray(data) ? data : data?.holidays || [];
        setHolidays(arr);
      } catch (e) {
        console.error('Error fetching holidays:', e);
        setHolidays([]);
      }
    })();
  }, [authHeaders]);

  // Load selected teacher's timetable using USER ID
  useEffect(() => {
    if (!selectedTeacher?.userId) return;
    (async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `${API_URL}/period-class-teacher-subject/timetable-teacher/${selectedTeacher.userId}`,
          { headers: authHeaders }
        );
        if (!res.ok)
          throw new Error(
            `GET /timetable-teacher/${selectedTeacher.userId} ${res.status}`
          );
        const data = await res.json();
        const t = Array.isArray(data)
          ? data
          : Array.isArray(data?.timetable)
          ? data.timetable
          : [];
        setTimetable(t);
      } catch (e) {
        console.error('Error fetching timetable:', e);
        setTimetable([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [selectedTeacher, authHeaders]);

  // Reset selection & subs when teacher changes
  useEffect(() => {
    setSubstitutions({});
    setOriginalSubs({});
    setSelectedDay(null);
    setSelectedPeriod(null);
  }, [selectedTeacher]);

  // Optional: global timetable (kept for future use, not shown in UI)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/period-class-teacher-subject`, {
          headers: authHeaders,
        });
        if (!res.ok) throw new Error(`GET /period-class-teacher-subject ${res.status}`);
        const data = await res.json();
        setGlobalTimetable(Array.isArray(data) ? data : data?.items || []);
      } catch (e) {
        console.error('Error fetching global timetable:', e);
        setGlobalTimetable([]);
      }
    })();
  }, [authHeaders]);

  // Build grid: canonicalDay -> periodId -> records[]
  const grid = useMemo(() => {
    const g = {};
    CANON_DAYS.forEach((d) => (g[d] = {}));
    periods.forEach((p) => CANON_DAYS.forEach((d) => (g[d][p.id] = [])));

    (timetable || []).forEach((rec) => {
      const dayNorm = normalizeDay(rec?.day ?? rec?.Day ?? rec?.weekday);
      const pid = toNum(rec?.periodId ?? rec?.Period?.id ?? rec?.period_id);
      if (!dayNorm || !g[dayNorm] || pid == null || g[dayNorm][pid] === undefined) return;
      g[dayNorm][pid].push(rec);
    });

    return g;
  }, [timetable, periods]);

  // Holidays map
  const holidayByDate = useMemo(() => {
    const m = {};
    (holidays || []).forEach((h) => {
      if (h?.date) m[h.date] = h;
    });
    return m;
  }, [holidays]);

  // Workloads (skip holidays)
  const { rowWorkloads, columnWorkloads, overallWorkload } = useMemo(() => {
    const rows = {};
    const cols = {};
    let overall = 0;

    periods.forEach((p) => (cols[p.id] = 0));

    CANON_DAYS.forEach((dayKey) => {
      const dateStr = weekDates[dayKey];
      if (holidayByDate[dateStr]) {
        rows[dayKey] = 0;
        return;
      }
      let rowCnt = 0;
      periods.forEach((p) => {
        const cnt = (grid[dayKey]?.[p.id]?.length) || 0;
        rowCnt += cnt;
        cols[p.id] += cnt;
      });
      rows[dayKey] = rowCnt;
      overall += rowCnt;
    });

    return {
      rowWorkloads: rows,
      columnWorkloads: cols,
      overallWorkload: overall,
    };
  }, [grid, periods, weekDates, holidayByDate]);

  // Load substitutions for selected date
  useEffect(() => {
    if (!selectedDate || !selectedTeacher?.userId) return;
    (async () => {
      try {
        const res = await fetch(
          `${API_URL}/substitutions/by-date?date=${encodeURIComponent(selectedDate)}`,
          {
            headers: authHeaders,
          }
        );
        if (!res.ok) throw new Error(`GET /substitutions/by-date ${res.status}`);
        const data = await res.json();
        const subsMap = {};
        (Array.isArray(data) ? data : data?.items || []).forEach((sub) => {
          const otid = toNum(
            sub?.original_teacherId ??
              sub?.original_teacherID ??
              sub?.originalTeacherId
          );
          if (otid === selectedTeacher.userId) {
            const dayKey = normalizeDay(sub?.day);
            const pid = toNum(sub?.periodId);
            if (dayKey && pid != null) subsMap[`${dayKey}_${pid}`] = sub;
          }
        });
        setSubstitutions(subsMap);
        setOriginalSubs(subsMap);
      } catch (e) {
        console.error('Error fetching substitutions by date:', e);
        setSubstitutions({});
        setOriginalSubs({});
      }
    })();
  }, [selectedDate, selectedTeacher, authHeaders]);

  // Available teachers + workload (using USER IDs)
  useEffect(() => {
    if (!selectedDay || !selectedPeriod) {
      setAvailableTeachersWithWorkload([]);
      return;
    }
    (async () => {
      try {
        const url = `${API_URL}/period-class-teacher-subject/teacher-availability-by-date?date=${encodeURIComponent(
          selectedDate
        )}&periodId=${encodeURIComponent(selectedPeriod)}`;
        const res = await fetch(url, { headers: authHeaders });
        if (!res.ok) {
          setAvailableTeachersWithWorkload([]);
          return;
        }
        const data = await res.json();
        const available = (data?.availableTeachers || data || [])
          .map((t) => ({
            id: toNum(t?.user_id ?? t?.User?.id ?? t?.id),
            name: t?.name ?? t?.User?.name ?? 'Unnamed',
          }))
          .filter((t) => t.id != null);

        const withWL = await Promise.all(
          available.map(async (t) => {
            try {
              const r = await fetch(
                `${API_URL}/period-class-teacher-subject/teacher-workload/${t.id}`,
                {
                  headers: authHeaders,
                }
              );
              if (!r.ok) return { ...t, weeklyWorkload: 0, dayWorkload: 0 };
              const wl = await r.json();
              const weeklyWorkload = wl?.weeklyWorkload ?? 0;
              const dayWorkload = wl?.dailyWorkload?.[selectedDay] ?? 0;
              return { ...t, weeklyWorkload, dayWorkload };
            } catch {
              return { ...t, weeklyWorkload: 0, dayWorkload: 0 };
            }
          })
        );
        withWL.sort(
          (a, b) =>
            a.weeklyWorkload - b.weeklyWorkload ||
            (a.dayWorkload - b.dayWorkload)
        );
        setAvailableTeachersWithWorkload(withWL);
      } catch (e) {
        console.error('Error fetching available teachers:', e);
        setAvailableTeachersWithWorkload([]);
      }
    })();
  }, [selectedDay, selectedPeriod, selectedDate, authHeaders]);

  /* ===================== Styles ===================== */
  const cellStyle = {
    minWidth: '140px',
    height: '68px',
    verticalAlign: 'middle',
    textAlign: 'center',
    cursor: 'pointer',
    fontSize: '0.85rem',
    position: 'relative',
  };

  const selectedCellStyle = {
    backgroundColor: '#ffedcc',
    border: '2px solid #ffa500',
  };

  const workloadStyle = {
    padding: '2px 6px',
    borderRadius: '6px',
    display: 'inline-block',
    fontSize: '0.8rem',
    fontWeight: 'bold',
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
  };

  const teacherButtonStyle = {
    backgroundColor: '#0d6efd',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 14px',
    boxShadow: '0 6px 16px rgba(13,110,253,0.18)',
    width: '100%',
    cursor: 'pointer',
  };

  const teacherButtonHoverStyle = { transform: 'translateY(-1px)' };

  const teacherButtonDisabledStyle = {
    backgroundColor: '#9ca3af',
    color: '#f9fafb',
    cursor: 'not-allowed',
  };

  const teacherItemStyle = {
    backgroundColor: '#0d6efd',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    padding: '8px 10px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const substitutionBadgeStyle = {
    position: 'absolute',
    bottom: '4px',
    right: '4px',
    backgroundColor: '#f59e0b',
    color: 'white',
    padding: '2px 6px',
    fontSize: '0.7rem',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
  };

  /* ===================== Handlers ===================== */

  const handleTeacherSubstitution = (teacher) => {
    if (!selectedDay || !selectedPeriod) {
      Swal.fire('No cell selected', 'Please click on a cell first.', 'warning');
      return;
    }
    const key = `${selectedDay}_${selectedPeriod}`;
    const teacherToStore = {
      ...teacher,
      teacherId: teacher.id, // USER id
      teacherName: teacher.name,
    };
    setSubstitutions((prev) => ({ ...prev, [key]: teacherToStore }));
  };

  const removeSubstitution = async (cellKey) => {
    const subInUI = substitutions[cellKey];

    if (subInUI?.id) {
      try {
        const resp = await fetch(`${API_URL}/substitutions/${subInUI.id}`, {
          method: 'DELETE',
          headers: authHeaders,
        });

        if (!resp.ok && resp.status !== 404) {
          console.error('Error deleting substitution:', resp.status);
          Swal.fire('Error', 'Failed to delete substitution from backend.', 'error');
          return;
        }

        if (resp.status === 404) {
          Swal.fire(
            'Info',
            'This substitution was already removed from the server. Updating screen.',
            'info'
          );
        }
      } catch (e) {
        console.error('Error deleting substitution:', e);
        Swal.fire('Error', 'Failed to delete substitution from backend.', 'error');
        return;
      }
    }

    setSubstitutions((prev) => {
      const copy = { ...prev };
      delete copy[cellKey];
      return copy;
    });

    setOriginalSubs((prev) => {
      const copy = { ...prev };
      delete copy[cellKey];
      return copy;
    });
  };

  const handleSubmitSubstitutions = async () => {
    if (!selectedDay || !selectedPeriod) {
      Swal.fire(
        'No cell selected',
        'Please click on a cell to select day and period.',
        'warning'
      );
      return;
    }
    const cellKey = `${selectedDay}_${selectedPeriod}`;
    const teacherSub = substitutions[cellKey];
    if (!teacherSub) {
      Swal.fire(
        'No substitution selected',
        'Please select a teacher for substitution.',
        'warning'
      );
      return;
    }
    const cellRecords = grid[selectedDay]?.[selectedPeriod] || [];
    if (!cellRecords.length) {
      Swal.fire(
        'No Class Found',
        'No class record found in this cell.',
        'error'
      );
      return;
    }

    const originalTeacherId = toNum(
      cellRecords[0]?.teacherId ?? cellRecords[0]?.Teacher?.id
    );
    const selectedTeacherId = toNum(
      teacherSub.teacherId ?? teacherSub.id
    );

    let classId = null;
    let subjectId = null;
    for (const rec of cellRecords) {
      classId = classId ?? toNum(rec?.Class?.id ?? rec?.classId);
      subjectId = subjectId ?? toNum(rec?.Subject?.id ?? rec?.subjectId);
      if (classId && subjectId) break;
    }
    if (!classId) {
      Swal.fire(
        'No Class Info',
        'Class record lacks a valid class ID.',
        'error'
      );
      return;
    }
    if (!subjectId) {
      Swal.fire(
        'No Subject Info',
        'Class record lacks a valid subject ID.',
        'error'
      );
      return;
    }

    const payload = {
      date: selectedDate,
      periodId: selectedPeriod,
      classId,
      teacherId: selectedTeacherId, // USER id
      original_teacherId: originalTeacherId, // USER id
      subjectId,
      day: prettyDay(selectedDay),
      published: true,
    };

    try {
      const resp = await fetch(`${API_URL}/substitutions`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        Swal.fire('Error', 'Failed to process substitution.', 'error');
        return;
      }
      const returned = await resp.json();
      returned.Teacher = {
        id: selectedTeacherId,
        name: teacherSub.teacherName,
      };
      setSubstitutions((prev) => ({ ...prev, [cellKey]: returned }));
      Swal.fire('Success', 'Substitution processed successfully!', 'success');
    } catch (e) {
      console.error('Error submitting substitution:', e);
      Swal.fire('Error', 'Failed to submit substitution.', 'error');
    }
  };

  const handleSubmitAllSubstitutions = async () => {
    const upsertKeys = Object.keys(substitutions);
    const deleteKeys = Object.keys(originalSubs).filter(
      (k) => !(k in substitutions)
    );
    const parseCellKey = (key) => {
      const [dayKey, pidStr] = key.split('_');
      return { dayKey, periodId: toNum(pidStr) };
    };

    // Upserts
    for (const key of upsertKeys) {
      const teacherSub = substitutions[key];
      const { dayKey, periodId } = parseCellKey(key);
      if (!dayKey || !periodId) continue;

      const cellRecords = grid[dayKey]?.[periodId] || [];
      if (!cellRecords.length) continue;

      let classId = null;
      let subjectId = null;
      for (const rec of cellRecords) {
        classId = classId ?? toNum(rec?.Class?.id ?? rec?.classId);
        subjectId = subjectId ?? toNum(rec?.Subject?.id ?? rec?.subjectId);
        if (classId && subjectId) break;
      }
      if (!classId || !subjectId) continue;

      const originalTeacherId = toNum(
        cellRecords[0]?.teacherId ?? cellRecords[0]?.Teacher?.id
      );
      const selectedTeacherId = toNum(
        teacherSub.teacherId ?? teacherSub.id
      );

      const payload = {
        date: selectedDate,
        periodId,
        classId,
        teacherId: selectedTeacherId,
        original_teacherId: originalTeacherId,
        subjectId,
        day: prettyDay(dayKey),
        published: true,
      };

      try {
        const resp = await fetch(`${API_URL}/substitutions`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          Swal.fire(
            'Error',
            `Failed to upsert substitution for ${prettyDay(
              dayKey
            )} period ${periodId}.`,
            'error'
          );
        } else {
          const returned = await resp.json();
          returned.Teacher = {
            id: selectedTeacherId,
            name: teacherSub.teacherName || teacherSub.name,
          };
          setSubstitutions((prev) => ({ ...prev, [key]: returned }));
        }
      } catch (e) {
        console.error('Error submitting substitution:', e);
        Swal.fire(
          'Error',
          `Failed to submit substitution for ${prettyDay(
            dayKey
          )} period ${periodId}.`,
          'error'
        );
      }
    }

    // Deletions
    for (const key of deleteKeys) {
      const orig = originalSubs[key];
      if (orig?.id) {
        try {
          const resp = await fetch(`${API_URL}/substitutions/${orig.id}`, {
            method: 'DELETE',
            headers: authHeaders,
          });
          if (!resp.ok) {
            const { dayKey, periodId } = parseCellKey(key);
            Swal.fire(
              'Error',
              `Failed to delete substitution for ${prettyDay(
                dayKey
              )} period ${periodId}.`,
              'error'
            );
          }
        } catch (e) {
          console.error('Error deleting substitution:', e);
          const { dayKey, periodId } = parseCellKey(key);
          Swal.fire(
            'Error',
            `Failed to delete substitution for ${prettyDay(
              dayKey
            )} period ${periodId}.`,
            'error'
          );
        }
      }
    }

    Swal.fire('Success', 'All substitutions processed successfully!', 'success');
    setOriginalSubs({ ...substitutions });
  };

  // ✅ UPDATED: clicking any weekday cell sets selectedDay/period AND updates date to that week's day
  const handleCellClick = (displayDay, periodId) => {
    const dayKey = normalizeDay(displayDay);
    if (!dayKey) return;

    const pid = toNum(periodId);
    const records = grid[dayKey]?.[pid] || [];

    if (!records.length) {
      Swal.fire(
        'Invalid selection',
        'This period is free. You can only assign substitution where a class is scheduled.',
        'warning'
      );
      return;
    }

    // date of that day in the current week
    const newDate = weekDates[dayKey];
    if (newDate && newDate !== selectedDate) {
      setSelectedDate(newDate);
    }

    setSelectedDay(dayKey);
    setSelectedPeriod(pid);
  };

  const currentCellKey =
    selectedDay && selectedPeriod != null
      ? `${selectedDay}_${selectedPeriod}`
      : null;
  const currentCellSubstitution = currentCellKey
    ? substitutions[currentCellKey]
    : null;

  const nothingToShow =
    !isLoading &&
    periods.length > 0 &&
    CANON_DAYS.every((d) =>
      periods.every((p) => (grid[d]?.[p.id]?.length ?? 0) === 0)
    );

  /* ===================== UI ===================== */
  return (
    <div className="container mt-4">
      <style>
        {`
          .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 8px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #888; border-radius: 8px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }

          .sticky-head thead th { position: sticky; top: 0; z-index: 2; background: #fff; }
        `}
      </style>

      <div className="card shadow">
        <div className="card-header bg-white text-dark d-flex align-items-center justify-content-between">
          <h3 className="mb-0">Teacher Timetable</h3>
          <div className="d-flex align-items-center gap-2">
            {!API_URL && (
              <span className="badge bg-danger">
                REACT_APP_API_URL missing
              </span>
            )}
            {!token && (
              <span className="badge bg-warning text-dark">No token</span>
            )}
          </div>
        </div>

        <div className="card-body">
          <div className="mb-2 small text-muted">
            Selected:{' '}
            <strong>{selectedTeacher?.name || '—'}</strong> &nbsp;|&nbsp; User ID:{' '}
            {selectedTeacher?.userId || '—'} &nbsp;|&nbsp; Rows:{' '}
            {timetable?.length ?? 0}
          </div>

          {/* Top controls */}
          <div
            className="d-flex flex-wrap align-items-center mb-3"
            style={{ gap: '1rem' }}
          >
            <div style={{ flex: '1 1 280px' }}>
              <label htmlFor="teacherSelect" className="form-label">
                Select Teacher:
              </label>
              <select
                id="teacherSelect"
                className="form-select"
                value={selectedTeacher?.userId ?? ''}
                onChange={(e) => {
                  const uid = toNum(e.target.value);
                  const found =
                    teachers.find((t) => t.userId === uid) || null;
                  setSelectedTeacher(found);
                }}
              >
                {teachers.length === 0 && (
                  <option value="">— no teachers —</option>
                )}
                {teachers.map((t) => (
                  <option key={t.userId} value={t.userId}>
                    {t.name} (User #{t.userId})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: '1 1 250px' }}>
              <label htmlFor="substitutionDate" className="form-label">
                Select Date:
              </label>
              <input
                type="date"
                id="substitutionDate"
                className="form-control"
                value={selectedDate}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedDate(v);
                  setSelectedDay(null);
                  setSelectedPeriod(null);
                }}
              />
            </div>

            <div style={{ flex: '1 1 220px' }}>
              <button
                type="button"
                style={{
                  ...teacherButtonStyle,
                  backgroundColor: '#198754',
                  cursor: 'default',
                }}
                disabled
              >
                {selectedDay && selectedPeriod != null
                  ? `${availableTeachersWithWorkload.length} Teachers Available`
                  : 'N/A'}
              </button>
            </div>
          </div>

          <div className="d-flex flex-wrap" style={{ gap: '1rem' }}>
            {/* Timetable grid */}
            <div
              style={{ flex: 2, overflowX: 'auto' }}
              className="custom-scrollbar"
            >
              {isLoading ? (
                <div className="text-center my-5">
                  <div
                    className="spinner-border text-primary"
                    role="status"
                  >
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : (
                <table
                  className="table table-striped table-bordered table-hover sticky-head"
                  style={{ tableLayout: 'fixed', width: '100%' }}
                >
                  <thead className="thead-dark">
                    <tr>
                      <th style={cellStyle}>Day</th>
                      {periods.map((p) => (
                        <th key={p.id} style={cellStyle}>
                          {p.name}
                        </th>
                      ))}
                      <th style={cellStyle}>Workload</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CANON_DAYS.map((dayKey) => {
                      const dateStr = weekDates[dayKey];
                      const holiday = holidayByDate[dateStr];
                      const isToday = dateStr === todayStr;
                      const rowClasses = `${holiday ? 'table-danger' : ''} ${
                        isToday ? 'border border-primary' : ''
                      }`;
                      return (
                        <tr key={dayKey} className={rowClasses}>
                          <td className="fw-bold" style={cellStyle}>
                            {prettyDay(dayKey)}{' '}
                            {holiday ? '(Holiday)' : ''}{' '}
                            {isToday ? '(Today)' : ''}
                          </td>

                          {holiday ? (
                            <td colSpan={periods.length} style={cellStyle}>
                              {holiday?.description || 'Holiday'}
                            </td>
                          ) : (
                            periods.map((p) => {
                              const cellKey = `${dayKey}_${p.id}`;
                              const isSelected =
                                dayKey === selectedDay &&
                                p.id === selectedPeriod;
                              const hasSub = Boolean(
                                substitutions[cellKey]
                              );
                              const records =
                                grid[dayKey]?.[p.id] || [];
                              return (
                                <td
                                  key={p.id}
                                  style={{
                                    ...cellStyle,
                                    ...(isSelected
                                      ? selectedCellStyle
                                      : {}),
                                    ...(hasSub
                                      ? {
                                          backgroundColor: '#e0ffe0',
                                          border:
                                            '2px solid #22c55e',
                                        }
                                      : {}),
                                  }}
                                  onClick={() =>
                                    handleCellClick(
                                      prettyDay(dayKey),
                                      p.id
                                    )
                                  }
                                >
                                  {records.length ? (
                                    records.map((rec, idx) => (
                                      <div
                                        key={idx}
                                        className="mb-1 p-1 border rounded shadow-sm"
                                      >
                                        <div className="small">
                                          <strong>
                                            {safeGetClassName(
                                              rec
                                            )}
                                          </strong>
                                        </div>
                                        <div className="small">
                                          {safeGetSubjectName(
                                            rec
                                          )}
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-muted small">
                                      Free
                                    </div>
                                  )}

                                  {hasSub && (
                                    <div
                                      style={substitutionBadgeStyle}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeSubstitution(cellKey);
                                      }}
                                      title="Remove substitution"
                                    >
                                      {substitutions[cellKey]
                                        ?.Teacher?.name ||
                                        substitutions[cellKey]
                                          ?.teacherName ||
                                        substitutions[cellKey]
                                          ?.name ||
                                        substitutions[cellKey]
                                          ?.teacherId ||
                                        substitutions[cellKey]?.id}{' '}
                                      ×
                                    </div>
                                  )}
                                </td>
                              );
                            })
                          )}

                          <td
                            className="text-center fw-bold"
                            style={cellStyle}
                          >
                            <span style={workloadStyle}>
                              {rowWorkloads[dayKey] || 0}
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
                          <span style={workloadStyle}>
                            {columnWorkloads[p.id] || 0}
                          </span>
                        </th>
                      ))}
                      <th style={cellStyle}>
                        <span style={workloadStyle}>
                          {overallWorkload}
                        </span>
                      </th>
                    </tr>
                  </tfoot>
                </table>
              )}

              {!isLoading && periods.length > 0 && nothingToShow && (
                <div className="alert alert-info mt-2">
                  No classes found for this teacher this week. Check:
                  <ul className="mb-0">
                    <li>
                      Teacher User ID: {selectedTeacher?.userId ?? '—'}
                    </li>
                    <li>
                      Timetable endpoint returns records for this userId
                    </li>
                    <li>
                      Day keys: backend day should match actual weekday
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Right: Available teachers */}
            <div
              style={{
                flex: 1,
                marginLeft: '20px',
                maxHeight: '500px',
                overflowY: 'auto',
              }}
              className="custom-scrollbar"
            >
              {selectedDay && selectedPeriod != null ? (
                availableTeachersWithWorkload.length ? (
                  <div
                    className="d-flex flex-column"
                    style={{ gap: '0.5rem' }}
                  >
                    {availableTeachersWithWorkload.map((t) => {
                      const isSelectedSame =
                        currentCellSubstitution &&
                        toNum(
                          currentCellSubstitution.teacherId ??
                            currentCellSubstitution.id
                        ) === t.id;
                      return (
                        <button
                          type="button"
                          key={t.id}
                          style={{
                            ...teacherItemStyle,
                            ...(isSelectedSame
                              ? teacherButtonDisabledStyle
                              : {}),
                          }}
                          disabled={isSelectedSame}
                          onClick={() =>
                            handleTeacherSubstitution(t)
                          }
                          onMouseOver={(e) => {
                            if (!isSelectedSame)
                              Object.assign(
                                e.currentTarget.style,
                                teacherButtonHoverStyle
                              );
                          }}
                          onMouseOut={(e) => {
                            if (!isSelectedSame)
                              Object.assign(
                                e.currentTarget.style,
                                { transform: 'none' }
                              );
                          }}
                          title={`Weekly: ${
                            t.weeklyWorkload ?? 0
                          } | ${prettyDay(
                            selectedDay
                          )}: ${t.dayWorkload ?? 0}`}
                        >
                          <div
                            style={{
                              width: '100%',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span style={{ fontWeight: 'bold' }}>
                              {t.name}
                            </span>
                            <span style={{ fontSize: '0.8rem' }}>
                              W: {t.weeklyWorkload ?? 0} | D:{' '}
                              {t.dayWorkload ?? 0}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p>
                    No teachers available for {prettyDay(selectedDay)}, period{' '}
                    {String(selectedPeriod)}.
                  </p>
                )
              ) : (
                <p>
                  Click on a cell with a scheduled class to see available
                  teachers and their workload.
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-3 d-flex gap-3">
            <button
              className="btn btn-success"
              onClick={handleSubmitSubstitutions}
              disabled={!currentCellKey || !substitutions[currentCellKey]}
              title={
                !currentCellKey
                  ? 'Select a cell first'
                  : !substitutions[currentCellKey]
                  ? 'Pick a substitute teacher'
                  : 'Submit'
              }
            >
              Submit Current Cell
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSubmitAllSubstitutions}
            >
              Submit All Substitutions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherTimetableView;
