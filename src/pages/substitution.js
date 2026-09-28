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

const ARRANGEMENT_REASONS = [
  ['ABSENT', 'Absent'],
  ['ON_LEAVE', 'On Leave'],
  ['OFFICIAL_DUTY', 'Official Duty'],
  ['EXAM_DUTY', 'Exam Duty'],
  ['MEETING', 'Meeting'],
  ['TRAINING_WORKSHOP', 'Training / Workshop'],
  ['EVENT_DUTY', 'School Event Duty'],
  ['COMPETITION_TRIP', 'Competition / Trip Duty'],
  ['ADMINISTRATIVE_WORK', 'Administrative Work'],
  ['PERSONAL_PERMISSION', 'Personal Permission'],
  ['OTHER', 'Other'],
];

const arrangementReasonLabel = (value) =>
  ARRANGEMENT_REASONS.find(([key]) => key === value)?.[1] || 'Arrangement';

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
  const [availableTeacherSearch, setAvailableTeacherSearch] = useState('');
  const [viewMode, setViewMode] = useState('day'); // day | week
  const [selectedTeacher, setSelectedTeacher] = useState(null); // { userId, employeeId?, name }

  const [periods, setPeriods] = useState([]); // [{id, name}]
  const [timetable, setTimetable] = useState([]); // records
  const [globalTimetable, setGlobalTimetable] = useState([]); // optional
  const [holidays, setHolidays] = useState([]); // [{date, description}]
  const [isLoading, setIsLoading] = useState(false);

  const [selectedDay, setSelectedDay] = useState(null); // canonical day
  const [selectedPeriod, setSelectedPeriod] = useState(null); // number

  // Teacher may be present but temporarily unavailable for selected periods.
  const [arrangementReason, setArrangementReason] = useState('ABSENT');
  const [arrangementNote, setArrangementNote] = useState('');
  const [arrangementScope, setArrangementScope] = useState('FULL_DAY');
  const [affectedPeriodIds, setAffectedPeriodIds] = useState([]);
  const [activeArrangement, setActiveArrangement] = useState(null);
  const [arrangementLoading, setArrangementLoading] = useState(false);
  const [arrangementSaving, setArrangementSaving] = useState(false);

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
    setActiveArrangement(null);
    setArrangementReason('ABSENT');
    setArrangementNote('');
    setArrangementScope('FULL_DAY');
    setAffectedPeriodIds([]);
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

  // Load the selected teacher's availability/arrangement record for this date.
  useEffect(() => {
    if (!selectedTeacher?.userId || !selectedDate) return;
    let cancelled = false;
    (async () => {
      setArrangementLoading(true);
      try {
        const res = await fetch(
          `${API_URL}/teacher-unavailability?teacherId=${encodeURIComponent(selectedTeacher.userId)}&date=${encodeURIComponent(selectedDate)}&status=ACTIVE`,
          { headers: authHeaders }
        );
        if (!res.ok) throw new Error(`GET /teacher-unavailability ${res.status}`);
        const data = await res.json();
        const item = (data?.items || [])[0] || null;
        if (cancelled) return;
        setActiveArrangement(item);
        if (item) {
          setArrangementReason(item.reasonType || 'ABSENT');
          setArrangementNote(item.reasonNote || '');
          setArrangementScope(item.scope || 'FULL_DAY');
          setAffectedPeriodIds(
            (item.Periods || [])
              .map((row) => toNum(row?.periodId ?? row?.Period?.id))
              .filter((id) => id != null)
          );
        } else {
          setArrangementReason('ABSENT');
          setArrangementNote('');
          setArrangementScope('FULL_DAY');
          setAffectedPeriodIds([]);
        }
      } catch (e) {
        console.error('Error loading teacher arrangement:', e);
        if (!cancelled) setActiveArrangement(null);
      } finally {
        if (!cancelled) setArrangementLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedTeacher?.userId, selectedDate, authHeaders]);

  const isPeriodAffected = (periodId) =>
    arrangementScope === 'FULL_DAY' || affectedPeriodIds.includes(toNum(periodId));

  const toggleAffectedPeriod = (periodId) => {
    const pid = toNum(periodId);
    if (!pid) return;
    setAffectedPeriodIds((prev) =>
      prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid]
    );
  };

  const saveTeacherArrangement = async ({ silent = false } = {}) => {
    if (!selectedTeacher?.userId || !selectedDate) {
      if (!silent) Swal.fire('Select teacher', 'Please choose the teacher to arrange.', 'warning');
      return null;
    }
    if (arrangementScope === 'SELECTED_PERIODS' && affectedPeriodIds.length === 0) {
      if (!silent) Swal.fire('Select periods', 'Choose at least one affected period.', 'warning');
      return null;
    }

    setArrangementSaving(true);
    try {
      const res = await fetch(`${API_URL}/teacher-unavailability`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          teacherId: selectedTeacher.userId,
          date: selectedDate,
          reasonType: arrangementReason,
          reasonNote: arrangementNote,
          scope: arrangementScope,
          periodIds: arrangementScope === 'SELECTED_PERIODS' ? affectedPeriodIds : [],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save teacher arrangement.');
      setActiveArrangement(data);
      if (!silent) {
        Swal.fire('Arrangement saved', `${selectedTeacher.name} • ${arrangementReasonLabel(arrangementReason)}`, 'success');
      }
      return data;
    } catch (e) {
      console.error('Error saving teacher arrangement:', e);
      if (!silent) Swal.fire('Could not save arrangement', e.message || 'Please try again.', 'error');
      return null;
    } finally {
      setArrangementSaving(false);
    }
  };

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
            photoUrl: t?.photo_url ?? null,
            teaches: Array.isArray(t?.teaches) ? t.teaches : [],
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
              const dayWorkload =
                wl?.dailyWorkload?.[prettyDay(selectedDay)] ??
                wl?.dailyWorkload?.[selectedDay] ??
                0;
              return { ...t, weeklyWorkload, dayWorkload };
            } catch {
              return { ...t, weeklyWorkload: 0, dayWorkload: 0 };
            }
          })
        );
        const targetRecords = grid[selectedDay]?.[selectedPeriod] || [];
        const targetClassIds = new Set(
          targetRecords
            .map((r) => toNum(r?.Class?.id ?? r?.classId ?? r?.class_id))
            .filter((v) => v != null)
        );
        const targetSubjectIds = new Set(
          targetRecords
            .map((r) => toNum(r?.Subject?.id ?? r?.subjectId ?? r?.subject_id))
            .filter((v) => v != null)
        );

        const scored = withWL.map((teacher) => {
          const teaches = Array.isArray(teacher.teaches) ? teacher.teaches : [];
          const sameSubject = teaches.some((x) => targetSubjectIds.has(toNum(x?.subjectId)));
          const sameClass = teaches.some((x) => targetClassIds.has(toNum(x?.classId)));
          const exactMatch = teaches.some(
            (x) =>
              targetSubjectIds.has(toNum(x?.subjectId)) &&
              targetClassIds.has(toNum(x?.classId))
          );

          let smartScore = 35;
          if (sameSubject) smartScore += 40;
          if (sameClass) smartScore += 15;
          if (exactMatch) smartScore += 10;
          smartScore -= Math.min(20, Number(teacher.dayWorkload || 0) * 4);
          smartScore -= Math.min(12, Math.round(Number(teacher.weeklyWorkload || 0) * 0.6));
          smartScore = Math.max(1, Math.min(100, Math.round(smartScore)));

          const reasons = [];
          if (exactMatch) reasons.push('same class & subject');
          else if (sameSubject) reasons.push('same subject');
          else if (sameClass) reasons.push('knows this class');
          if ((teacher.dayWorkload || 0) <= 2) reasons.push('light workload today');
          if (!reasons.length) reasons.push('available with lower workload');

          return { ...teacher, smartScore, smartReason: reasons.join(' • ') };
        });

        scored.sort(
          (a, b) =>
            b.smartScore - a.smartScore ||
            a.dayWorkload - b.dayWorkload ||
            a.weeklyWorkload - b.weeklyWorkload ||
            String(a.name).localeCompare(String(b.name))
        );
        setAvailableTeachersWithWorkload(scored);
      } catch (e) {
        console.error('Error fetching available teachers:', e);
        setAvailableTeachersWithWorkload([]);
      }
    })();
  }, [selectedDay, selectedPeriod, selectedDate, authHeaders, grid]);

  const filteredTeachers = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) =>
      `${t.name} ${t.userId} ${t.employeeId ?? ''}`.toLowerCase().includes(q)
    );
  }, [teachers, teacherSearch]);

  const filteredAvailableTeachers = useMemo(() => {
    const q = availableTeacherSearch.trim().toLowerCase();
    if (!q) return availableTeachersWithWorkload;
    return availableTeachersWithWorkload.filter((t) =>
      `${t.name} ${t.id}`.toLowerCase().includes(q)
    );
  }, [availableTeachersWithWorkload, availableTeacherSearch]);

  const recommendedTeacher = availableTeachersWithWorkload[0] || null;

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

  const useRecommendedTeacher = () => {
    if (!recommendedTeacher) {
      Swal.fire('No recommendation', 'No available teacher was found for this period.', 'info');
      return;
    }
    handleTeacherSubstitution(recommendedTeacher);
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
    let sectionId = null;
    let subjectId = null;
    for (const rec of cellRecords) {
      classId = classId ?? toNum(rec?.Class?.id ?? rec?.classId);
      sectionId = sectionId ?? toNum(rec?.Section?.id ?? rec?.sectionId);
      subjectId = subjectId ?? toNum(rec?.Subject?.id ?? rec?.subjectId);
      if (classId && sectionId && subjectId) break;
    }

    if (!classId) return { error: 'Class record lacks a valid class ID.' };
    if (!sectionId) return { error: 'Class record lacks a valid section ID.' };
    if (!subjectId) return { error: 'Class record lacks a valid subject ID.' };
    if (!selectedTeacherId) return { error: 'Selected substitute teacher is invalid.' };

    return {
      payload: {
        date: selectedDate,
        periodId,
        classId,
        sectionId,
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

    const arrangement = await saveTeacherArrangement({ silent: true });
    if (!arrangement) {
      Swal.fire('Arrangement required', 'Please complete the reason and affected period selection first.', 'warning');
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

    const arrangement = await saveTeacherArrangement({ silent: true });
    if (!arrangement) {
      Swal.fire('Arrangement required', 'Please complete the reason and affected period selection first.', 'warning');
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
    if (arrangementScope === 'SELECTED_PERIODS') {
      setAffectedPeriodIds((prev) => (prev.includes(pid) ? prev : [...prev, pid]));
    }
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
              radial-gradient(circle at top left, color-mix(in srgb, var(--edb-primary) 12%, transparent), transparent 32%),
              linear-gradient(180deg, var(--edb-surface) 0%, var(--edb-dashboard-bg) 100%);
          }

          .ttv-shell {
            width: 100%;
            max-width: 1500px;
            margin: 0 auto;
          }

          .ttv-hero {
            background: linear-gradient(135deg, var(--edb-primary-dark) 0%, var(--edb-primary) 52%, #0891b2 100%);
            color: var(--edb-on-primary);
            border-radius: 24px;
            padding: 24px;
            box-shadow: 0 20px 50px color-mix(in srgb, var(--edb-primary-dark) 18%, transparent);
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
            background: color-mix(in srgb, var(--edb-surface) 12%, transparent);
          }

          .ttv-glass-card {
            background: color-mix(in srgb, var(--edb-surface) 98%, transparent);
            border: 1px solid color-mix(in srgb, var(--edb-border) 90%, transparent);
            border-radius: 22px;
            box-shadow: 0 16px 45px color-mix(in srgb, var(--edb-primary-dark) 8%, transparent);
          }

          .ttv-stat-card {
            background: var(--edb-surface);
            border: 1px solid var(--edb-border);
            border-radius: 18px;
            padding: 16px;
            height: 100%;
            box-shadow: 0 10px 30px color-mix(in srgb, var(--edb-primary-dark) 6%, transparent);
          }

          .ttv-stat-label {
            color: var(--edb-muted-text);
            font-size: 0.78rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }

          .ttv-stat-value {
            color: var(--edb-text);
            font-size: 1.45rem;
            font-weight: 800;
            line-height: 1.2;
          }

          .ttv-toolbar {
            background: var(--edb-surface);
            border: 1px solid var(--edb-border);
            border-radius: 20px;
            padding: 16px;
            box-shadow: 0 10px 30px color-mix(in srgb, var(--edb-primary-dark) 5%, transparent);
          }

          .ttv-custom-scrollbar::-webkit-scrollbar { width: 8px; height: 9px; }
          .ttv-custom-scrollbar::-webkit-scrollbar-track { background: var(--edb-dashboard-bg); border-radius: 999px; }
          .ttv-custom-scrollbar::-webkit-scrollbar-thumb { background: var(--edb-border); border-radius: 999px; }
          .ttv-custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--edb-muted-text); }

          .ttv-table-wrap {
            max-height: 68vh;
            overflow: auto;
            border-radius: 18px;
            border: 1px solid var(--edb-border);
            background: var(--edb-surface);
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
            background: var(--edb-surface);
            color: var(--edb-text);
            font-size: 0.78rem;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            border-bottom: 1px solid var(--edb-border) !important;
          }

          .ttv-table .ttv-day-cell,
          .ttv-table .ttv-day-head {
            position: sticky;
            left: 0;
            z-index: 3;
            background: var(--edb-surface);
          }

          .ttv-table .ttv-day-head {
            z-index: 5;
            background: var(--edb-surface);
          }

          .ttv-table td,
          .ttv-table th {
            border-color: var(--edb-border) !important;
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
            background: var(--edb-surface);
            box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--edb-primary-dark) 12%, transparent);
          }

          .ttv-selected-cell {
            background: var(--edb-surface) !important;
            box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--edb-primary-dark) 100%, transparent) !important;
          }

          .ttv-sub-cell {
            background: var(--edb-primary-soft) !important;
            box-shadow: inset 0 0 0 2px #22c55e !important;
          }

          .ttv-free-cell {
            background: var(--edb-surface);
            cursor: not-allowed;
            color: var(--edb-muted-text);
          }

          .ttv-class-pill {
            background: var(--edb-surface);
            border: 1px solid var(--edb-border);
            border-left: 4px solid var(--edb-primary);
            border-radius: 12px;
            padding: 8px;
            margin-bottom: 7px;
            box-shadow: 0 6px 16px color-mix(in srgb, var(--edb-primary-dark) 8%, transparent);
          }

          .ttv-class-name {
            color: var(--edb-text);
            font-weight: 800;
            font-size: 0.86rem;
          }

          .ttv-subject-name {
            color: var(--edb-text);
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

          .ttv-badge-blue { color: var(--edb-primary-text); background: var(--edb-primary-soft); }
          .ttv-badge-green { color: #047857; background: #d1fae5; }
          .ttv-badge-orange { color: #c2410c; background: var(--edb-primary-soft); }
          .ttv-badge-gray { color: var(--edb-text); background: var(--edb-surface); }
          .ttv-badge-red { color: #b91c1c; background: var(--edb-primary-soft); }

          .ttv-sub-badge {
            position: absolute;
            bottom: 7px;
            right: 7px;
            background: #16a34a;
            color: var(--edb-on-primary);
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
            background: var(--edb-surface);
            border: 1px solid var(--edb-border);
            border-radius: 20px;
            box-shadow: 0 10px 30px color-mix(in srgb, var(--edb-primary-dark) 6%, transparent);
            overflow: hidden;
          }

          .ttv-panel-head {
            padding: 16px 18px;
            border-bottom: 1px solid var(--edb-border);
            background: var(--edb-surface);
          }

          .ttv-panel-body {
            padding: 16px 18px;
          }

          .ttv-teacher-card {
            width: 100%;
            border: 1px solid var(--edb-border);
            background: var(--edb-surface);
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
            border-color: var(--edb-primary);
            box-shadow: 0 12px 24px color-mix(in srgb, var(--edb-primary-dark) 12%, transparent);
          }

          .ttv-teacher-card.active,
          .ttv-teacher-card:disabled {
            cursor: not-allowed;
            border-color: #22c55e;
            background: var(--edb-primary-soft);
            transform: none;
          }

          .ttv-actions-bar {
            position: sticky;
            bottom: 0;
            z-index: 6;
            background: color-mix(in srgb, var(--edb-surface) 92%, transparent);
            backdrop-filter: blur(10px);
            border: 1px solid var(--edb-border);
            border-radius: 18px;
            box-shadow: 0 -8px 30px color-mix(in srgb, var(--edb-primary-dark) 7.000000000000001%, transparent);
            padding: 14px;
          }

          .ttv-empty-state {
            border: 1px dashed var(--edb-border);
            border-radius: 18px;
            padding: 24px;
            background: var(--edb-surface);
            text-align: center;
            color: var(--edb-muted-text);
          }

          .ttv-step-chip {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            padding: 7px 11px;
            border-radius: 999px;
            background: var(--edb-surface);
            color: var(--edb-muted-text);
            font-size: .78rem;
            font-weight: 700;
            border: 1px solid var(--edb-border);
          }
          .ttv-step-chip strong {
            width: 20px; height: 20px; border-radius: 50%; display: inline-grid; place-items: center;
            background: var(--edb-border); color: var(--edb-on-primary); font-size: .7rem;
          }
          .ttv-step-chip.active { background: var(--edb-surface); color: var(--edb-primary-text); border-color: var(--edb-border); }
          .ttv-step-chip.active strong { background: var(--edb-primary); }

          .ttv-day-summary {
            display: flex; justify-content: space-between; align-items: center; gap: 12px;
            padding: 14px 16px; border: 1px solid var(--edb-border); border-radius: 16px; background: var(--edb-surface);
          }
          .ttv-period-grid {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px;
          }
          .ttv-period-card {
            min-height: 150px; padding: 14px; border-radius: 16px; border: 1px solid var(--edb-border);
            background: var(--edb-surface); text-align: left; transition: .18s ease; cursor: pointer;
          }
          .ttv-period-card:hover:not(.disabled) {
            transform: translateY(-2px); border-color: var(--edb-border); box-shadow: 0 10px 22px color-mix(in srgb, var(--edb-primary-dark) 9%, transparent);
          }
          .ttv-period-card.selected { border: 2px solid var(--edb-primary); background: var(--edb-surface); }
          .ttv-period-card.assigned { box-shadow: inset 0 0 0 1px #86efac; }
          .ttv-period-card.disabled { cursor: default; background: var(--edb-surface); opacity: .72; }
          .ttv-period-label { font-size: .78rem; font-weight: 800; color: var(--edb-text); text-transform: uppercase; letter-spacing: .04em; }
          .ttv-period-empty { margin-top: 26px; text-align: center; color: var(--edb-muted-text); font-size: .85rem; font-weight: 600; }
          .ttv-assigned-teacher { padding: 7px 9px; border-radius: 10px; background: var(--edb-primary-soft); color: #047857; font-size: .78rem; font-weight: 800; }
          .ttv-recommended { padding: 3px 7px; border-radius: 999px; background: var(--edb-primary-soft); color: #92400e; font-size: .66rem; font-weight: 800; flex-shrink: 0; }

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
                <span className="ttv-badge-soft" style={{ background: "color-mix(in srgb, var(--edb-surface) 16%, transparent)", color: "var(--edb-text)" }}>
                  Weekly View
                </span>
                {hasPendingChanges && (
                  <span className="ttv-badge-soft" style={{ background: "color-mix(in srgb, var(--edb-accent) 20%, transparent)", color: "var(--edb-accent-text)" }}>
                    Unsaved Changes
                  </span>
                )}
              </div>
              <h2 className="mb-2 fw-bold">Substitution & Period Arrangement</h2>
              <p className="mb-0" style={{ color: "color-mix(in srgb, var(--edb-on-primary) 82%, transparent)", maxWidth: 760 }}>
                Arrange periods for absence, leave, official duties, meetings and temporary unavailability with smart workload-aware recommendations.
              </p>
            </div>

            <div className="col-lg-5">
              <div className="row g-2">
                <div className="col-6">
                  <div className="p-3 rounded-4" style={{ background: "color-mix(in srgb, var(--edb-surface) 14%, transparent)" }}>
                    <div className="small" style={{ color: "color-mix(in srgb, var(--edb-on-primary) 72%, transparent)" }}>Selected Teacher</div>
                    <div className="fw-bold text-truncate">{selectedTeacher?.name || '—'}</div>
                  </div>
                </div>
                <div className="col-6">
                  <div className="p-3 rounded-4" style={{ background: "color-mix(in srgb, var(--edb-surface) 14%, transparent)" }}>
                    <div className="small" style={{ color: "color-mix(in srgb, var(--edb-on-primary) 72%, transparent)" }}>Week</div>
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
              <label htmlFor="teacherSearch" className="form-label fw-semibold">Find Teacher</label>
              <input
                id="teacherSearch"
                type="text"
                className="form-control"
                placeholder="Type teacher name"
                value={teacherSearch}
                onChange={(e) => setTeacherSearch(e.target.value)}
              />
            </div>

            <div className="col-lg-3 col-md-6">
              <label htmlFor="teacherSelect" className="form-label fw-semibold">Teacher to Arrange</label>
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
                    {t.name}
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

          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
            <div className="d-flex flex-wrap gap-2">
              <span className="ttv-step-chip active"><strong>1</strong> Teacher</span>
              <span className={`ttv-step-chip ${arrangementReason ? 'active' : ''}`}><strong>2</strong> Reason & periods</span>
              <span className={`ttv-step-chip ${currentCellSubstitution ? 'active' : ''}`}><strong>3</strong> Substitute</span>
            </div>
            {pendingDeleteCount > 0 && (
              <span className="ttv-badge-soft ttv-badge-orange">{pendingDeleteCount} removal(s) pending</span>
            )}
          </div>
        </div>

        <div className="ttv-panel mb-3">
          <div className="ttv-panel-head d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <div className="fw-bold">Teacher Availability</div>
              <div className="small text-muted">The teacher may be present in school but unavailable for one or more periods.</div>
            </div>
            {arrangementLoading ? (
              <span className="ttv-badge-soft ttv-badge-gray">Loading…</span>
            ) : activeArrangement ? (
              <span className="ttv-badge-soft ttv-badge-green">Saved • {arrangementReasonLabel(activeArrangement.reasonType)}</span>
            ) : (
              <span className="ttv-badge-soft ttv-badge-blue">New arrangement</span>
            )}
          </div>
          <div className="ttv-panel-body">
            <div className="row g-3 align-items-end">
              <div className="col-lg-3 col-md-6">
                <label className="form-label fw-semibold">Reason</label>
                <select className="form-select" value={arrangementReason} onChange={(e) => setArrangementReason(e.target.value)}>
                  {ARRANGEMENT_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="col-lg-3 col-md-6">
                <label className="form-label fw-semibold">Availability</label>
                <div className="btn-group w-100" role="group">
                  <button type="button" className={`btn ${arrangementScope === 'FULL_DAY' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setArrangementScope('FULL_DAY')}>Full Day</button>
                  <button type="button" className={`btn ${arrangementScope === 'SELECTED_PERIODS' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setArrangementScope('SELECTED_PERIODS')}>Selected Periods</button>
                </div>
              </div>
              <div className="col-lg-4 col-md-8">
                <label className="form-label fw-semibold">Note <span className="text-muted fw-normal">(optional)</span></label>
                <input className="form-control" maxLength={500} placeholder="e.g. Board meeting / competition duty" value={arrangementNote} onChange={(e) => setArrangementNote(e.target.value)} />
              </div>
              <div className="col-lg-2 col-md-4">
                <button type="button" className="btn btn-dark w-100" disabled={arrangementSaving || arrangementLoading} onClick={() => saveTeacherArrangement()}>
                  {arrangementSaving ? 'Saving…' : 'Save Arrangement'}
                </button>
              </div>
            </div>

            {arrangementScope === 'SELECTED_PERIODS' && (
              <div className="mt-3 p-3 rounded-4 border bg-light">
                <div className="d-flex flex-wrap justify-content-between gap-2 align-items-center mb-2">
                  <div className="small fw-bold text-dark">Affected periods</div>
                  <div className="small text-muted">Click scheduled period cards below to add them.</div>
                </div>
                <div className="d-flex flex-wrap gap-2">
                  {affectedPeriodIds.length === 0 ? (
                    <span className="small text-muted">No period selected yet.</span>
                  ) : affectedPeriodIds.map((pid) => {
                    const period = periods.find((p) => p.id === pid);
                    return (
                      <button key={pid} type="button" className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => toggleAffectedPeriod(pid)}>
                        {period?.name || `P${pid}`} ×
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="row g-3 align-items-start">
          <div className="col-xl-9">
            <div className="ttv-glass-card p-3">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <div>
                  <h5 className="mb-1 fw-bold">Teacher Schedule</h5>
                  <div className="small text-muted">Select the affected class period. Daily view is recommended for quick marking.</div>
                </div>
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <div className="btn-group btn-group-sm" role="group" aria-label="Schedule view">
                    <button type="button" className={`btn ${viewMode === 'day' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setViewMode('day')}>Day</button>
                    <button type="button" className={`btn ${viewMode === 'week' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setViewMode('week')}>Week</button>
                  </div>
                  <span className="ttv-badge-soft ttv-badge-green">Substitutions: {substitutionCount}</span>
                </div>
              </div>

              {isLoading ? (
                <div className="text-center my-5 py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <div className="mt-3 text-muted">Loading timetable...</div>
                </div>
              ) : viewMode === 'day' ? (
                <div className="ttv-day-view">
                  <div className="ttv-day-summary mb-3">
                    <div>
                      <div className="small text-muted fw-semibold text-uppercase">Selected day</div>
                      <div className="fw-bold fs-5">{weekdayOfSelectedDate ? prettyDay(weekdayOfSelectedDate) : '—'} <span className="text-muted fw-normal fs-6">• {formatNiceDate(selectedDate)}</span></div>
                    </div>
                    <span className="ttv-badge-soft ttv-badge-blue">Click a class to assign cover</span>
                  </div>
                  <div className="ttv-period-grid">
                    {periods.map((p) => {
                      const dayKey = weekdayOfSelectedDate;
                      const records = dayKey ? (grid[dayKey]?.[p.id] || []) : [];
                      const key = dayKey ? `${dayKey}_${p.id}` : '';
                      const sub = key ? substitutions[key] : null;
                      const selected = selectedDay === dayKey && selectedPeriod === p.id;
                      const holiday = dayKey ? holidayByDate[weekDates[dayKey]] : null;
                      const disabled = !dayKey || Boolean(holiday) || !records.length;
                      return (
                        <button
                          type="button"
                          key={p.id}
                          className={`ttv-period-card ${selected ? 'selected' : ''} ${sub ? 'assigned' : ''} ${disabled ? 'disabled' : ''}`}
                          disabled={disabled}
                          onClick={() => dayKey && handleCellClick(prettyDay(dayKey), p.id)}
                        >
                          <div className="d-flex justify-content-between align-items-start gap-2">
                            <span className="ttv-period-label">{p.name}</span>
                            <div className="d-flex flex-wrap gap-1 justify-content-end">
                              {records.length > 0 && isPeriodAffected(p.id) && <span className="ttv-badge-soft ttv-badge-orange">Affected</span>}
                              {sub && <span className="ttv-badge-soft ttv-badge-green">Assigned</span>}
                            </div>
                          </div>
                          {holiday ? (
                            <div className="ttv-period-empty">Holiday</div>
                          ) : records.length ? (
                            <div className="mt-3">
                              {records.map((rec, idx) => (
                                <div key={idx} className="mb-2">
                                  <div className="fw-bold text-dark">{safeGetClassName(rec) || 'Class'}</div>
                                  <div className="small text-muted">{safeGetSubjectName(rec)}</div>
                                </div>
                              ))}
                              {sub && <div className="ttv-assigned-teacher mt-2"><i className="bi bi-person-check-fill"></i> {getSubTeacherName(sub)}</div>}
                            </div>
                          ) : (
                            <div className="ttv-period-empty">Free period</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
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
                        <th className="ttv-day-cell" style={{ background: "var(--edb-surface)" }}>Total</th>
                        {periods.map((p) => (
                          <th key={p.id} style={{ background: "var(--edb-surface)" }}>
                            <span className="ttv-badge-soft ttv-badge-gray">{columnWorkloads[p.id] || 0}</span>
                          </th>
                        ))}
                        <th style={{ background: "var(--edb-surface)" }}>
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
                        <div key={idx} className="p-3 rounded-4 mb-2" style={{ background: "var(--edb-surface)", border: "1px solid var(--edb-border)" }}>
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
                    Choose a class period from the schedule to continue.
                  </div>
                )}
              </div>
            </div>

            <div className="ttv-panel">
              <div className="ttv-panel-head">
                <div className="d-flex justify-content-between align-items-start gap-2">
                  <div>
                    <h6 className="mb-1 fw-bold">Choose Substitute</h6>
                    <div className="small text-muted">Smart match • subject/class fit • workload</div>
                  </div>
                  {selectedDay && selectedPeriod != null && (
                    <span className="ttv-badge-soft ttv-badge-green">{availableTeachersWithWorkload.length}</span>
                  )}
                </div>
              </div>

              <div className="ttv-panel-body">
                {selectedDay && selectedPeriod != null && availableTeachersWithWorkload.length > 0 && (
                  <>
                    <button type="button" className="btn btn-primary w-100 mb-2" onClick={useRecommendedTeacher}>
                      <i className="bi bi-stars me-2"></i>Use Smart Pick: {recommendedTeacher?.name}
                    </button>
                    <input
                      type="search"
                      className="form-control mb-3"
                      placeholder="Search available teacher"
                      value={availableTeacherSearch}
                      onChange={(e) => setAvailableTeacherSearch(e.target.value)}
                    />
                  </>
                )}
                <div className="ttv-custom-scrollbar" style={{ maxHeight: 390, overflowY: 'auto' }}>
                {selectedDay && selectedPeriod != null ? (
                  filteredAvailableTeachers.length ? (
                    <div className="d-flex flex-column gap-2">
                      {filteredAvailableTeachers.map((t) => {
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
                              <div className="d-flex align-items-center gap-2">
                                <div className="fw-bold text-dark text-truncate">{t.name}</div>
                                {recommendedTeacher?.id === t.id && (
                                  <span className="ttv-recommended">Recommended</span>
                                )}
                              </div>
                              <div className="small text-muted text-truncate">{t.smartReason || 'Available for this period'}</div>
                            </div>
                            <div className="text-end flex-shrink-0">
                              <span className="ttv-badge-soft ttv-badge-orange">Match {t.smartScore ?? '—'}%</span>
                              <div className="mt-1">
                                <span className="ttv-badge-soft ttv-badge-blue">Week {t.weeklyWorkload ?? 0}</span>
                              </div>
                              <div className="mt-1">
                                <span className="ttv-badge-soft ttv-badge-gray">Today {t.dayWorkload ?? 0}</span>
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
                    Choose a class period first. Available teachers will appear here.
                  </div>
                )}
                </div>
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

// EDUBRIDGE_PERIOD_ARRANGEMENT_V1
export default TeacherTimetableView;
