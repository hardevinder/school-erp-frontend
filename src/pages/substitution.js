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

const parseISODateLocal = (dateStr) => {
  const parts = String(dateStr || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some((x) => Number.isNaN(x))) return new Date();
  return new Date(parts[0], parts[1] - 1, parts[2]);
};

const formatDate = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatNiceDate = (dateStr) => {
  if (!dateStr) return '—';
  return parseISODateLocal(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatShortDate = (dateStr) => {
  if (!dateStr) return '—';
  return parseISODateLocal(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
};

// map: canonicalDay -> YYYY-MM-DD for Mon–Sat week containing pivotDateStr
const weekDatesFor = (pivotDateStr) => {
  const d = parseISODateLocal(pivotDateStr);
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
  normalizeDay(
    parseISODateLocal(dateStr).toLocaleDateString('en-US', { weekday: 'long' })
  );

const safeGetClassName = (rec) =>
  rec?.Class?.class_name ?? rec?.Class?.name ?? rec?.className ?? rec?.class_name ?? '';

const safeGetSubjectName = (rec) =>
  rec?.Subject?.name ?? rec?.subjectName ?? rec?.subject ?? 'No Subject';

const getSubTeacherName = (sub) =>
  sub?.Teacher?.name || sub?.teacherName || sub?.name || sub?.teacher_name || 'Substitute';

const getSubTeacherId = (sub) =>
  toNum(sub?.teacherId ?? sub?.Teacher?.id ?? sub?.id ?? sub?.teacher_id);

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
  const storedTime = parseISODateLocal(stored).getTime();
  const todayTime = parseISODateLocal(todayStr).getTime();
  if (Number.isNaN(storedTime)) return todayStr;
  const diffDays = Math.abs((todayTime - storedTime) / (1000 * 60 * 60 * 24));
  if (diffDays > 7) return todayStr;
  return stored;
};

const TeacherTimetableView = () => {
  // Teachers stored as { userId, employeeId?, name }
  const [teachers, setTeachers] = useState([]);
  const [teacherSearch, setTeacherSearch] = useState('');
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

  const weekLabel = useMemo(() => {
    const start = weekDates?.monday;
    const end = weekDates?.saturday;
    return `${formatShortDate(start)} - ${formatShortDate(end)}`;
  }, [weekDates]);

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
          .filter((t) => t.userId != null)
          .sort((a, b) => String(a.name).localeCompare(String(b.name)));

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
          .filter((p) => p.id != null)
          .sort((a, b) => a.id - b.id);
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
        const cnt = grid[dayKey]?.[p.id]?.length || 0;
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
            a.dayWorkload - b.dayWorkload ||
            String(a.name).localeCompare(String(b.name))
        );
        setAvailableTeachersWithWorkload(withWL);
      } catch (e) {
        console.error('Error fetching available teachers:', e);
        setAvailableTeachersWithWorkload([]);
      }
    })();
  }, [selectedDay, selectedPeriod, selectedDate, authHeaders]);

  const filteredTeachers = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) =>
      `${t.name} ${t.userId} ${t.employeeId ?? ''}`.toLowerCase().includes(q)
    );
  }, [teachers, teacherSearch]);

  const currentCellKey =
    selectedDay && selectedPeriod != null
      ? `${selectedDay}_${selectedPeriod}`
      : null;

  const currentCellSubstitution = currentCellKey
    ? substitutions[currentCellKey]
    : null;

  const selectedCellRecords = useMemo(() => {
    if (!selectedDay || selectedPeriod == null) return [];
    return grid[selectedDay]?.[selectedPeriod] || [];
  }, [grid, selectedDay, selectedPeriod]);

  const selectedPeriodObj = useMemo(
    () => periods.find((p) => p.id === selectedPeriod) || null,
    [periods, selectedPeriod]
  );

  const substitutionCount = useMemo(() => Object.keys(substitutions).length, [substitutions]);

  const pendingDeleteCount = useMemo(
    () => Object.keys(originalSubs).filter((k) => !(k in substitutions)).length,
    [originalSubs, substitutions]
  );

  const hasPendingChanges = useMemo(() => {
    const keys = new Set([...Object.keys(substitutions), ...Object.keys(originalSubs)]);
    for (const key of keys) {
      const newId = getSubTeacherId(substitutions[key]);
      const oldId = getSubTeacherId(originalSubs[key]);
      if (String(newId ?? '') !== String(oldId ?? '')) return true;
    }
    return false;
  }, [substitutions, originalSubs]);

  const nothingToShow =
    !isLoading &&
    periods.length > 0 &&
    CANON_DAYS.every((d) =>
      periods.every((p) => (grid[d]?.[p.id]?.length ?? 0) === 0)
    );

  /* ===================== Handlers ===================== */

  const handleTeacherSubstitution = (teacher) => {
    if (!selectedDay || !selectedPeriod) {
      Swal.fire('No cell selected', 'Please click on a scheduled class first.', 'warning');
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

    const confirm = await Swal.fire({
      title: 'Remove substitution?',
      text: 'This will clear the assigned substitute teacher for this cell.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, remove',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc3545',
    });

    if (!confirm.isConfirmed) return;

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

  const buildSubstitutionPayload = (dayKey, periodId, teacherSub) => {
    const cellRecords = grid[dayKey]?.[periodId] || [];
    if (!cellRecords.length) return { error: 'No class record found in this cell.' };

    const originalTeacherId = toNum(
      cellRecords[0]?.teacherId ?? cellRecords[0]?.Teacher?.id
    );
    const selectedTeacherId = toNum(teacherSub.teacherId ?? teacherSub.id);

    let classId = null;
    let subjectId = null;
    for (const rec of cellRecords) {
      classId = classId ?? toNum(rec?.Class?.id ?? rec?.classId);
      subjectId = subjectId ?? toNum(rec?.Subject?.id ?? rec?.subjectId);
      if (classId && subjectId) break;
    }

    if (!classId) return { error: 'Class record lacks a valid class ID.' };
    if (!subjectId) return { error: 'Class record lacks a valid subject ID.' };
    if (!selectedTeacherId) return { error: 'Selected substitute teacher is invalid.' };

    return {
      payload: {
        date: selectedDate,
        periodId,
        classId,
        teacherId: selectedTeacherId, // USER id
        original_teacherId: originalTeacherId, // USER id
        subjectId,
        day: prettyDay(dayKey),
        published: true,
      },
      selectedTeacherId,
    };
  };

  const handleSubmitSubstitutions = async () => {
    if (!selectedDay || !selectedPeriod) {
      Swal.fire(
        'No cell selected',
        'Please click on a scheduled class to select day and period.',
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

    const { payload, selectedTeacherId, error } = buildSubstitutionPayload(
      selectedDay,
      selectedPeriod,
      teacherSub
    );

    if (error) {
      Swal.fire('Missing Information', error, 'error');
      return;
    }

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
        name: teacherSub.teacherName || teacherSub.name,
      };
      setSubstitutions((prev) => ({ ...prev, [cellKey]: returned }));
      setOriginalSubs((prev) => ({ ...prev, [cellKey]: returned }));
      Swal.fire('Success', 'Substitution saved successfully!', 'success');
    } catch (e) {
      console.error('Error submitting substitution:', e);
      Swal.fire('Error', 'Failed to submit substitution.', 'error');
    }
  };

  const handleSubmitAllSubstitutions = async () => {
    const parseCellKey = (key) => {
      const [dayKey, pidStr] = key.split('_');
      return { dayKey, periodId: toNum(pidStr) };
    };

    const upsertKeys = Object.keys(substitutions).filter(
      (key) =>
        String(getSubTeacherId(substitutions[key]) ?? '') !==
        String(getSubTeacherId(originalSubs[key]) ?? '')
    );

    const deleteKeys = Object.keys(originalSubs).filter((k) => !(k in substitutions));

    if (!upsertKeys.length && !deleteKeys.length) {
      Swal.fire('Nothing to save', 'No pending substitution changes found.', 'info');
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const updatedSubs = { ...substitutions };

    // Upserts
    for (const key of upsertKeys) {
      const teacherSub = substitutions[key];
      const { dayKey, periodId } = parseCellKey(key);
      if (!dayKey || !periodId) continue;

      const { payload, selectedTeacherId, error } = buildSubstitutionPayload(
        dayKey,
        periodId,
        teacherSub
      );

      if (error) {
        errorCount += 1;
        continue;
      }

      try {
        const resp = await fetch(`${API_URL}/substitutions`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          errorCount += 1;
        } else {
          const returned = await resp.json();
          returned.Teacher = {
            id: selectedTeacherId,
            name: teacherSub.teacherName || teacherSub.name,
          };
          updatedSubs[key] = returned;
          successCount += 1;
        }
      } catch (e) {
        console.error('Error submitting substitution:', e);
        errorCount += 1;
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
          if (!resp.ok && resp.status !== 404) {
            errorCount += 1;
          } else {
            successCount += 1;
          }
        } catch (e) {
          console.error('Error deleting substitution:', e);
          errorCount += 1;
        }
      }
    }

    setSubstitutions(updatedSubs);
    setOriginalSubs(updatedSubs);

    if (errorCount) {
      Swal.fire(
        'Partially saved',
        `${successCount} change(s) saved, ${errorCount} change(s) failed. Please check and try again.`,
        'warning'
      );
    } else {
      Swal.fire('Success', `${successCount} substitution change(s) saved successfully!`, 'success');
    }
  };

  // Clicking any weekday cell sets selectedDay/period AND updates date to that week's day
  const handleCellClick = (displayDay, periodId) => {
    const dayKey = normalizeDay(displayDay);
    if (!dayKey) return;

    const pid = toNum(periodId);
    const records = grid[dayKey]?.[pid] || [];

    if (!records.length) {
      Swal.fire(
        'Free period',
        'This period is free. You can assign substitution only where a class is scheduled.',
        'info'
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

  const changeWeek = (offsetDays) => {
    const next = parseISODateLocal(selectedDate);
    next.setDate(next.getDate() + offsetDays);
    setSelectedDate(formatDate(next));
    setSelectedDay(null);
    setSelectedPeriod(null);
  };

  const goToday = () => {
    setSelectedDate(todayStr);
    setSelectedDay(null);
    setSelectedPeriod(null);
  };

  /* ===================== UI ===================== */
  return (
    <div className="ttv-page">
      <style>
        {`
          .ttv-page {
            min-height: 100vh;
            padding: 24px;
            background:
              radial-gradient(circle at top left, rgba(59, 130, 246, 0.12), transparent 32%),
              linear-gradient(180deg, #f8fbff 0%, #eef3fb 100%);
          }

          .ttv-shell {
            width: 100%;
            max-width: 1500px;
            margin: 0 auto;
          }

          .ttv-hero {
            background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 52%, #0891b2 100%);
            color: #fff;
            border-radius: 24px;
            padding: 24px;
            box-shadow: 0 20px 50px rgba(15, 23, 42, 0.18);
            overflow: hidden;
            position: relative;
          }

          .ttv-hero::after {
            content: '';
            position: absolute;
            width: 260px;
            height: 260px;
            right: -80px;
            top: -120px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.12);
          }

          .ttv-glass-card {
            background: rgba(255, 255, 255, 0.98);
            border: 1px solid rgba(226, 232, 240, 0.9);
            border-radius: 22px;
            box-shadow: 0 16px 45px rgba(15, 23, 42, 0.08);
          }

          .ttv-stat-card {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 18px;
            padding: 16px;
            height: 100%;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
          }

          .ttv-stat-label {
            color: #64748b;
            font-size: 0.78rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }

          .ttv-stat-value {
            color: #0f172a;
            font-size: 1.45rem;
            font-weight: 800;
            line-height: 1.2;
          }

          .ttv-toolbar {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 20px;
            padding: 16px;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
          }

          .ttv-custom-scrollbar::-webkit-scrollbar { width: 8px; height: 9px; }
          .ttv-custom-scrollbar::-webkit-scrollbar-track { background: #edf2f7; border-radius: 999px; }
          .ttv-custom-scrollbar::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 999px; }
          .ttv-custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #64748b; }

          .ttv-table-wrap {
            max-height: 68vh;
            overflow: auto;
            border-radius: 18px;
            border: 1px solid #e2e8f0;
            background: #fff;
          }

          .ttv-table {
            margin-bottom: 0;
            min-width: 980px;
            table-layout: fixed;
          }

          .ttv-table thead th {
            position: sticky;
            top: 0;
            z-index: 4;
            background: #f8fafc;
            color: #334155;
            font-size: 0.78rem;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            border-bottom: 1px solid #e2e8f0 !important;
          }

          .ttv-table .ttv-day-cell,
          .ttv-table .ttv-day-head {
            position: sticky;
            left: 0;
            z-index: 3;
            background: #fff;
          }

          .ttv-table .ttv-day-head {
            z-index: 5;
            background: #f8fafc;
          }

          .ttv-table td,
          .ttv-table th {
            border-color: #e2e8f0 !important;
          }

          .ttv-cell {
            min-width: 145px;
            height: 92px;
            vertical-align: top;
            text-align: left;
            cursor: pointer;
            font-size: 0.85rem;
            position: relative;
            padding: 10px !important;
            transition: all 0.18s ease;
          }

          .ttv-cell:hover {
            background: #f8fbff;
            box-shadow: inset 0 0 0 2px rgba(37, 99, 235, 0.12);
          }

          .ttv-selected-cell {
            background: #fff7ed !important;
            box-shadow: inset 0 0 0 2px #f59e0b !important;
          }

          .ttv-sub-cell {
            background: #ecfdf5 !important;
            box-shadow: inset 0 0 0 2px #22c55e !important;
          }

          .ttv-free-cell {
            background: #f8fafc;
            cursor: not-allowed;
            color: #94a3b8;
          }

          .ttv-class-pill {
            background: #ffffff;
            border: 1px solid #dbeafe;
            border-left: 4px solid #2563eb;
            border-radius: 12px;
            padding: 8px;
            margin-bottom: 7px;
            box-shadow: 0 6px 16px rgba(37, 99, 235, 0.08);
          }

          .ttv-class-name {
            color: #0f172a;
            font-weight: 800;
            font-size: 0.86rem;
          }

          .ttv-subject-name {
            color: #475569;
            font-size: 0.79rem;
            margin-top: 2px;
          }

          .ttv-badge-soft {
            border-radius: 999px;
            padding: 5px 10px;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 0.78rem;
            font-weight: 700;
          }

          .ttv-badge-blue { color: #1d4ed8; background: #dbeafe; }
          .ttv-badge-green { color: #047857; background: #d1fae5; }
          .ttv-badge-orange { color: #c2410c; background: #ffedd5; }
          .ttv-badge-gray { color: #475569; background: #f1f5f9; }
          .ttv-badge-red { color: #b91c1c; background: #fee2e2; }

          .ttv-sub-badge {
            position: absolute;
            bottom: 7px;
            right: 7px;
            background: #16a34a;
            color: white;
            padding: 5px 9px;
            font-size: 0.72rem;
            border-radius: 999px;
            display: flex;
            align-items: center;
            gap: 7px;
            cursor: pointer;
            box-shadow: 0 8px 18px rgba(22, 163, 74, 0.25);
            max-width: calc(100% - 14px);
          }

          .ttv-sub-badge span {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .ttv-panel {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
            overflow: hidden;
          }

          .ttv-panel-head {
            padding: 16px 18px;
            border-bottom: 1px solid #e2e8f0;
            background: #f8fafc;
          }

          .ttv-panel-body {
            padding: 16px 18px;
          }

          .ttv-teacher-card {
            width: 100%;
            border: 1px solid #dbeafe;
            background: #fff;
            border-radius: 16px;
            padding: 12px 14px;
            text-align: left;
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: center;
            cursor: pointer;
            transition: all 0.18s ease;
          }

          .ttv-teacher-card:hover {
            transform: translateY(-1px);
            border-color: #2563eb;
            box-shadow: 0 12px 24px rgba(37, 99, 235, 0.12);
          }

          .ttv-teacher-card.active,
          .ttv-teacher-card:disabled {
            cursor: not-allowed;
            border-color: #22c55e;
            background: #ecfdf5;
            transform: none;
          }

          .ttv-actions-bar {
            position: sticky;
            bottom: 0;
            z-index: 6;
            background: rgba(255, 255, 255, 0.92);
            backdrop-filter: blur(10px);
            border: 1px solid #e2e8f0;
            border-radius: 18px;
            box-shadow: 0 -8px 30px rgba(15, 23, 42, 0.07);
            padding: 14px;
          }

          .ttv-empty-state {
            border: 1px dashed #cbd5e1;
            border-radius: 18px;
            padding: 24px;
            background: #f8fafc;
            text-align: center;
            color: #64748b;
          }

          @media (max-width: 991px) {
            .ttv-page { padding: 14px; }
            .ttv-hero { border-radius: 18px; padding: 18px; }
            .ttv-table-wrap { max-height: none; }
          }
        `}
      </style>

      <div className="ttv-shell">
        <div className="ttv-hero mb-4">
          <div className="row align-items-center g-3 position-relative" style={{ zIndex: 1 }}>
            <div className="col-lg-7">
              <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                <span className="ttv-badge-soft" style={{ background: 'rgba(255,255,255,0.16)', color: '#fff' }}>
                  Weekly View
                </span>
                {hasPendingChanges && (
                  <span className="ttv-badge-soft" style={{ background: 'rgba(251,191,36,0.2)', color: '#fde68a' }}>
                    Unsaved Changes
                  </span>
                )}
              </div>
              <h2 className="mb-2 fw-bold">Teacher Timetable & Substitution Planner</h2>
              <p className="mb-0" style={{ color: 'rgba(255,255,255,0.82)', maxWidth: 760 }}>
                Select a teacher, click a scheduled class, then assign the best available substitute teacher with workload visibility.
              </p>
            </div>

            <div className="col-lg-5">
              <div className="row g-2">
                <div className="col-6">
                  <div className="p-3 rounded-4" style={{ background: 'rgba(255,255,255,0.14)' }}>
                    <div className="small" style={{ color: 'rgba(255,255,255,0.72)' }}>Selected Teacher</div>
                    <div className="fw-bold text-truncate">{selectedTeacher?.name || '—'}</div>
                  </div>
                </div>
                <div className="col-6">
                  <div className="p-3 rounded-4" style={{ background: 'rgba(255,255,255,0.14)' }}>
                    <div className="small" style={{ color: 'rgba(255,255,255,0.72)' }}>Week</div>
                    <div className="fw-bold">{weekLabel}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-sm-6 col-xl-3">
            <div className="ttv-stat-card">
              <div className="ttv-stat-label">Weekly Workload</div>
              <div className="ttv-stat-value mt-1">{overallWorkload}</div>
              <div className="small text-muted">Total scheduled periods</div>
            </div>
          </div>
          <div className="col-sm-6 col-xl-3">
            <div className="ttv-stat-card">
              <div className="ttv-stat-label">Substitutions</div>
              <div className="ttv-stat-value mt-1">{substitutionCount}</div>
              <div className="small text-muted">Assigned for selected date</div>
            </div>
          </div>
          <div className="col-sm-6 col-xl-3">
            <div className="ttv-stat-card">
              <div className="ttv-stat-label">Available Teachers</div>
              <div className="ttv-stat-value mt-1">
                {selectedDay && selectedPeriod != null ? availableTeachersWithWorkload.length : '—'}
              </div>
              <div className="small text-muted">For selected period</div>
            </div>
          </div>
          <div className="col-sm-6 col-xl-3">
            <div className="ttv-stat-card">
              <div className="ttv-stat-label">Selected Date</div>
              <div className="ttv-stat-value mt-1" style={{ fontSize: '1.1rem' }}>{formatNiceDate(selectedDate)}</div>
              <div className="small text-muted">{weekdayOfSelectedDate ? prettyDay(weekdayOfSelectedDate) : '—'}</div>
            </div>
          </div>
        </div>

        <div className="ttv-toolbar mb-3">
          <div className="row g-3 align-items-end">
            <div className="col-lg-3 col-md-6">
              <label htmlFor="teacherSearch" className="form-label fw-semibold">Search Teacher</label>
              <input
                id="teacherSearch"
                type="text"
                className="form-control"
                placeholder="Name / User ID"
                value={teacherSearch}
                onChange={(e) => setTeacherSearch(e.target.value)}
              />
            </div>

            <div className="col-lg-3 col-md-6">
              <label htmlFor="teacherSelect" className="form-label fw-semibold">Select Teacher</label>
              <select
                id="teacherSelect"
                className="form-select"
                value={selectedTeacher?.userId ?? ''}
                onChange={(e) => {
                  const uid = toNum(e.target.value);
                  const found = teachers.find((t) => t.userId === uid) || null;
                  setSelectedTeacher(found);
                }}
              >
                {teachers.length === 0 && <option value="">— no teachers —</option>}
                {filteredTeachers.length === 0 && teachers.length > 0 && (
                  <option value={selectedTeacher?.userId ?? ''}>No matching teachers</option>
                )}
                {filteredTeachers.map((t) => (
                  <option key={t.userId} value={t.userId}>
                    {t.name} (User #{t.userId})
                  </option>
                ))}
              </select>
            </div>

            <div className="col-lg-2 col-md-6">
              <label htmlFor="substitutionDate" className="form-label fw-semibold">Date</label>
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

            <div className="col-lg-4 col-md-6">
              <label className="form-label fw-semibold">Week Navigation</label>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-outline-primary flex-fill" onClick={() => changeWeek(-7)}>
                  ← Previous
                </button>
                <button type="button" className="btn btn-primary flex-fill" onClick={goToday}>
                  Today
                </button>
                <button type="button" className="btn btn-outline-primary flex-fill" onClick={() => changeWeek(7)}>
                  Next →
                </button>
              </div>
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2 mt-3">
            {!API_URL && <span className="ttv-badge-soft ttv-badge-red">REACT_APP_API_URL missing</span>}
            {!token && <span className="ttv-badge-soft ttv-badge-orange">No token found</span>}
            <span className="ttv-badge-soft ttv-badge-gray">Rows: {timetable?.length ?? 0}</span>
            <span className="ttv-badge-soft ttv-badge-gray">Teachers: {teachers.length}</span>
            <span className="ttv-badge-soft ttv-badge-gray">Periods: {periods.length}</span>
            {globalTimetable?.length > 0 && (
              <span className="ttv-badge-soft ttv-badge-gray">Global records: {globalTimetable.length}</span>
            )}
            {pendingDeleteCount > 0 && (
              <span className="ttv-badge-soft ttv-badge-orange">Pending removals: {pendingDeleteCount}</span>
            )}
          </div>
        </div>

        <div className="row g-3 align-items-start">
          <div className="col-xl-9">
            <div className="ttv-glass-card p-3">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <div>
                  <h5 className="mb-1 fw-bold">Weekly Timetable</h5>
                  <div className="small text-muted">Click only on a scheduled class cell to assign substitution.</div>
                </div>
                <div className="d-flex flex-wrap gap-2">
                  <span className="ttv-badge-soft ttv-badge-blue">Selected: {selectedDay ? `${prettyDay(selectedDay)} ${selectedPeriodObj?.name || `P${selectedPeriod}`}` : 'None'}</span>
                  <span className="ttv-badge-soft ttv-badge-green">Saved/Selected Subs: {substitutionCount}</span>
                </div>
              </div>

              {isLoading ? (
                <div className="text-center my-5 py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <div className="mt-3 text-muted">Loading timetable...</div>
                </div>
              ) : (
                <div className="ttv-table-wrap ttv-custom-scrollbar">
                  <table className="table table-hover align-middle ttv-table">
                    <thead>
                      <tr>
                        <th className="ttv-day-head" style={{ width: 155 }}>Day</th>
                        {periods.map((p) => (
                          <th key={p.id} style={{ minWidth: 155 }}>
                            {p.name}
                          </th>
                        ))}
                        <th style={{ width: 130 }}>Workload</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CANON_DAYS.map((dayKey) => {
                        const dateStr = weekDates[dayKey];
                        const holiday = holidayByDate[dateStr];
                        const isToday = dateStr === todayStr;
                        return (
                          <tr key={dayKey} className={holiday ? 'table-danger' : ''}>
                            <td className="ttv-day-cell ttv-cell">
                              <div className="fw-bold text-dark">{prettyDay(dayKey)}</div>
                              <div className="small text-muted">{formatShortDate(dateStr)}</div>
                              <div className="d-flex flex-wrap gap-1 mt-2">
                                {holiday && <span className="ttv-badge-soft ttv-badge-red">Holiday</span>}
                                {isToday && <span className="ttv-badge-soft ttv-badge-blue">Today</span>}
                              </div>
                            </td>

                            {holiday ? (
                              <td colSpan={periods.length} className="text-center">
                                <div className="ttv-empty-state my-2">
                                  <div className="fw-bold text-danger">Holiday</div>
                                  <div>{holiday?.description || 'No classes scheduled.'}</div>
                                </div>
                              </td>
                            ) : (
                              periods.map((p) => {
                                const cellKey = `${dayKey}_${p.id}`;
                                const isSelected = dayKey === selectedDay && p.id === selectedPeriod;
                                const hasSub = Boolean(substitutions[cellKey]);
                                const records = grid[dayKey]?.[p.id] || [];

                                return (
                                  <td
                                    key={p.id}
                                    className={`ttv-cell ${!records.length ? 'ttv-free-cell' : ''} ${
                                      isSelected ? 'ttv-selected-cell' : ''
                                    } ${hasSub ? 'ttv-sub-cell' : ''}`}
                                    onClick={() => handleCellClick(prettyDay(dayKey), p.id)}
                                  >
                                    {records.length ? (
                                      records.map((rec, idx) => (
                                        <div key={idx} className="ttv-class-pill">
                                          <div className="ttv-class-name text-truncate">{safeGetClassName(rec) || 'Class'}</div>
                                          <div className="ttv-subject-name text-truncate">{safeGetSubjectName(rec)}</div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="h-100 d-flex align-items-center justify-content-center small fw-semibold">
                                        Free
                                      </div>
                                    )}

                                    {hasSub && (
                                      <div
                                        className="ttv-sub-badge"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeSubstitution(cellKey);
                                        }}
                                        title="Click to remove substitution"
                                      >
                                        <span>{getSubTeacherName(substitutions[cellKey])}</span>
                                        <strong>×</strong>
                                      </div>
                                    )}
                                  </td>
                                );
                              })
                            )}

                            <td className="text-center fw-bold">
                              <span className="ttv-badge-soft ttv-badge-gray">{rowWorkloads[dayKey] || 0}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th className="ttv-day-cell" style={{ background: '#f8fafc' }}>Total</th>
                        {periods.map((p) => (
                          <th key={p.id} style={{ background: '#f8fafc' }}>
                            <span className="ttv-badge-soft ttv-badge-gray">{columnWorkloads[p.id] || 0}</span>
                          </th>
                        ))}
                        <th style={{ background: '#f8fafc' }}>
                          <span className="ttv-badge-soft ttv-badge-blue">{overallWorkload}</span>
                        </th>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {!isLoading && periods.length > 0 && nothingToShow && (
                <div className="alert alert-info mt-3 mb-0">
                  <div className="fw-bold mb-1">No classes found for this teacher this week.</div>
                  <div className="small">
                    Please verify Teacher User ID <strong>{selectedTeacher?.userId ?? '—'}</strong>, timetable records, and backend day names.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="col-xl-3">
            <div className="ttv-panel mb-3">
              <div className="ttv-panel-head">
                <h6 className="mb-1 fw-bold">Selected Class</h6>
                <div className="small text-muted">Details for the clicked timetable cell</div>
              </div>
              <div className="ttv-panel-body">
                {selectedDay && selectedPeriod != null ? (
                  <>
                    <div className="d-flex flex-wrap gap-2 mb-3">
                      <span className="ttv-badge-soft ttv-badge-blue">{prettyDay(selectedDay)}</span>
                      <span className="ttv-badge-soft ttv-badge-gray">{formatNiceDate(weekDates[selectedDay])}</span>
                      <span className="ttv-badge-soft ttv-badge-orange">{selectedPeriodObj?.name || `Period ${selectedPeriod}`}</span>
                    </div>

                    {selectedCellRecords.length ? (
                      selectedCellRecords.map((rec, idx) => (
                        <div key={idx} className="p-3 rounded-4 mb-2" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                          <div className="small text-muted">Class</div>
                          <div className="fw-bold text-dark">{safeGetClassName(rec) || '—'}</div>
                          <div className="small text-muted mt-2">Subject</div>
                          <div className="fw-semibold text-dark">{safeGetSubjectName(rec)}</div>
                        </div>
                      ))
                    ) : (
                      <div className="ttv-empty-state">No class record found.</div>
                    )}

                    {currentCellSubstitution && (
                      <div className="alert alert-success py-2 px-3 mt-3 mb-0">
                        <div className="small text-muted">Assigned Substitute</div>
                        <div className="fw-bold">{getSubTeacherName(currentCellSubstitution)}</div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="ttv-empty-state">
                    Select any scheduled class cell from the timetable.
                  </div>
                )}
              </div>
            </div>

            <div className="ttv-panel">
              <div className="ttv-panel-head">
                <div className="d-flex justify-content-between align-items-start gap-2">
                  <div>
                    <h6 className="mb-1 fw-bold">Available Teachers</h6>
                    <div className="small text-muted">Sorted by lower workload first</div>
                  </div>
                  {selectedDay && selectedPeriod != null && (
                    <span className="ttv-badge-soft ttv-badge-green">{availableTeachersWithWorkload.length}</span>
                  )}
                </div>
              </div>

              <div className="ttv-panel-body ttv-custom-scrollbar" style={{ maxHeight: 460, overflowY: 'auto' }}>
                {selectedDay && selectedPeriod != null ? (
                  availableTeachersWithWorkload.length ? (
                    <div className="d-flex flex-column gap-2">
                      {availableTeachersWithWorkload.map((t) => {
                        const isSelectedSame =
                          currentCellSubstitution && getSubTeacherId(currentCellSubstitution) === t.id;

                        return (
                          <button
                            type="button"
                            key={t.id}
                            className={`ttv-teacher-card ${isSelectedSame ? 'active' : ''}`}
                            disabled={isSelectedSame}
                            onClick={() => handleTeacherSubstitution(t)}
                            title={`Weekly: ${t.weeklyWorkload ?? 0} | ${prettyDay(selectedDay)}: ${t.dayWorkload ?? 0}`}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div className="fw-bold text-dark text-truncate">{t.name}</div>
                              <div className="small text-muted">User #{t.id}</div>
                            </div>
                            <div className="text-end flex-shrink-0">
                              <span className="ttv-badge-soft ttv-badge-blue">W: {t.weeklyWorkload ?? 0}</span>
                              <div className="mt-1">
                                <span className="ttv-badge-soft ttv-badge-gray">D: {t.dayWorkload ?? 0}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="ttv-empty-state">
                      No teachers available for {prettyDay(selectedDay)}, {selectedPeriodObj?.name || `period ${selectedPeriod}`}.
                    </div>
                  )
                ) : (
                  <div className="ttv-empty-state">
                    Click a scheduled class to load available teachers.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="ttv-actions-bar mt-3">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div>
              <div className="fw-bold text-dark">
                {hasPendingChanges ? 'You have pending substitution changes.' : 'All substitution changes are saved.'}
              </div>
              <div className="small text-muted">
                Current cell: {selectedDay && selectedPeriod != null ? `${prettyDay(selectedDay)} • ${selectedPeriodObj?.name || `Period ${selectedPeriod}`}` : 'Not selected'}
              </div>
            </div>

            <div className="d-flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => {
                  setSelectedDay(null);
                  setSelectedPeriod(null);
                }}
                disabled={!selectedDay && selectedPeriod == null}
              >
                Clear Selection
              </button>
              <button
                className="btn btn-success"
                onClick={handleSubmitSubstitutions}
                disabled={!currentCellKey || !substitutions[currentCellKey]}
                title={
                  !currentCellKey
                    ? 'Select a cell first'
                    : !substitutions[currentCellKey]
                    ? 'Pick a substitute teacher'
                    : 'Submit current cell'
                }
              >
                Save Current Cell
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmitAllSubstitutions}
                disabled={!hasPendingChanges}
              >
                Save All Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherTimetableView;