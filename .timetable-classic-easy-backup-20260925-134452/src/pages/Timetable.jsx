import React, { useEffect, useMemo, useState } from 'react';
import swal from 'sweetalert';
import './TimetablePlanner.css';

const API_URL = process.env.REACT_APP_API_URL;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MAX_ASSIGNMENTS = 5;

const emptyGrid = (periods = []) => {
  const grid = {};
  DAYS.forEach((day) => {
    grid[day] = {};
    periods.forEach((period) => {
      grid[day][period.id] = [];
    });
  });
  return grid;
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const num = (value) => Number(value || 0);

const normalisePairs = (pairs = []) =>
  pairs
    .filter((pair) => num(pair?.subjectId) && num(pair?.teacherId))
    .map((pair) => ({ subjectId: num(pair.subjectId), teacherId: num(pair.teacherId) }));

const pairsKey = (pairs = []) =>
  normalisePairs(pairs)
    .map((pair) => `${pair.subjectId}:${pair.teacherId}`)
    .join('|');

const TimetableAssignment = () => {
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [associations, setAssociations] = useState([]);
  const [allTimetableRows, setAllTimetableRows] = useState([]);

  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);

  const [assignments, setAssignments] = useState({});
  const [savedAssignments, setSavedAssignments] = useState({});
  const [recordIds, setRecordIds] = useState({});

  const [activeCell, setActiveCell] = useState(null);
  const [activeSubjectId, setActiveSubjectId] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [loadingGrid, setLoadingGrid] = useState(false);

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json',
  });

  const pdfHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  });

  const fetchJson = async (url) => {
    const response = await fetch(url, { headers: authHeaders() });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return response.json();
  };

  const refreshGlobalRows = async () => {
    try {
      const rows = await fetchJson(`${API_URL}/period-class-teacher-subject`);
      setAllTimetableRows(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error('Error loading timetable rows:', error);
      setAllTimetableRows([]);
    }
  };

  useEffect(() => {
    let mounted = true;

    Promise.all([
      fetchJson(`${API_URL}/classes`),
      fetchJson(`${API_URL}/sections`),
      fetchJson(`${API_URL}/periods`),
      fetchJson(`${API_URL}/class-subject-teachers`),
      fetchJson(`${API_URL}/period-class-teacher-subject`),
    ])
      .then(([classData, sectionData, periodData, associationData, timetableData]) => {
        if (!mounted) return;

        const cls = Array.isArray(classData) ? classData : [];
        const sec = Array.isArray(sectionData) ? sectionData : [];
        const per = Array.isArray(periodData) ? periodData : [];
        const assoc = Array.isArray(associationData) ? associationData : [];
        const rows = Array.isArray(timetableData) ? timetableData : [];

        setClasses(cls);
        setSections(sec);
        setPeriods(per);
        setAssociations(assoc);
        setAllTimetableRows(rows);
        setAssignments(emptyGrid(per));
        setSavedAssignments(emptyGrid(per));

        if (cls.length) setSelectedClass(num(cls[0].id));
      })
      .catch((error) => {
        console.error('Error loading timetable planner:', error);
        swal('Unable to load timetable', 'Please refresh the page and try again.', 'error');
      });

    return () => {
      mounted = false;
    };
  }, []);

  const classSections = useMemo(() => {
    if (!selectedClass) return [];

    const mappedIds = new Set(
      associations
        .filter((item) => num(item.class_id) === num(selectedClass))
        .map((item) => num(item.section_id))
        .filter(Boolean)
    );

    const mapped = sections.filter((section) => mappedIds.has(num(section.id)));
    return mapped.length ? mapped : sections;
  }, [associations, sections, selectedClass]);

  useEffect(() => {
    if (!selectedClass) return;

    const currentValid = classSections.some(
      (section) => num(section.id) === num(selectedSection)
    );

    if (!currentValid) {
      const preferred =
        classSections.find(
          (section) => String(section.section_name || '').trim().toUpperCase() === 'A'
        ) || classSections[0];
      setSelectedSection(preferred ? num(preferred.id) : null);
    }
  }, [classSections, selectedClass, selectedSection]);

  const parseRowPairs = (row) => {
    const pairs = [];
    for (let slot = 1; slot <= MAX_ASSIGNMENTS; slot += 1) {
      const subjectKey = slot === 1 ? 'subjectId' : `subjectId_${slot}`;
      const teacherKey = slot === 1 ? 'teacherId' : `teacherId_${slot}`;
      if (num(row?.[subjectKey]) && num(row?.[teacherKey])) {
        pairs.push({
          subjectId: num(row[subjectKey]),
          teacherId: num(row[teacherKey]),
        });
      }
    }
    return pairs;
  };

  const loadSelectedTimetable = async (classId, sectionId) => {
    if (!classId || !sectionId || !periods.length) return;

    try {
      setLoadingGrid(true);
      setActiveCell(null);
      setActiveSubjectId(null);
      setSearchText('');

      const rows = await fetchJson(
        `${API_URL}/period-class-teacher-subject/class/${classId}?sectionId=${sectionId}`
      );
      const safeRows = Array.isArray(rows) ? rows : [];
      const grid = emptyGrid(periods);
      const ids = {};

      DAYS.forEach((day) => {
        ids[day] = {};
      });

      safeRows.forEach((row) => {
        if (!grid[row.day] || grid[row.day][num(row.periodId)] === undefined) return;
        grid[row.day][num(row.periodId)] = parseRowPairs(row);
        ids[row.day][num(row.periodId)] = row.id;
      });

      setAssignments(grid);
      setSavedAssignments(clone(grid));
      setRecordIds(ids);
    } catch (error) {
      console.error('Error loading class timetable:', error);
      swal('Unable to load timetable', 'Please try again.', 'error');
    } finally {
      setLoadingGrid(false);
    }
  };

  useEffect(() => {
    if (selectedClass && selectedSection && periods.length) {
      loadSelectedTimetable(selectedClass, selectedSection);
    }
  }, [selectedClass, selectedSection, periods]);

  const selectedClassObj = useMemo(
    () => classes.find((item) => num(item.id) === num(selectedClass)),
    [classes, selectedClass]
  );

  const selectedSectionObj = useMemo(
    () => classSections.find((item) => num(item.id) === num(selectedSection)),
    [classSections, selectedSection]
  );

  const contextAssociations = useMemo(
    () =>
      associations.filter(
        (item) =>
          num(item.class_id) === num(selectedClass) &&
          num(item.section_id) === num(selectedSection)
      ),
    [associations, selectedClass, selectedSection]
  );

  const subjects = useMemo(() => {
    const map = new Map();
    contextAssociations.forEach((item) => {
      if (item.Subject?.id) map.set(num(item.Subject.id), item.Subject);
    });
    return Array.from(map.values()).sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''))
    );
  }, [contextAssociations]);

  const teachersForSubject = (subjectId) => {
    const map = new Map();
    contextAssociations
      .filter((item) => num(item.subject_id) === num(subjectId) && item.Teacher)
      .forEach((item) => map.set(num(item.Teacher.id), item.Teacher));
    return Array.from(map.values()).sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''))
    );
  };

  const subjectById = useMemo(() => {
    const map = new Map();
    associations.forEach((item) => {
      if (item.Subject?.id) map.set(num(item.Subject.id), item.Subject);
    });
    allTimetableRows.forEach((row) => {
      for (let slot = 1; slot <= MAX_ASSIGNMENTS; slot += 1) {
        const key = slot === 1 ? 'Subject' : `Subject${slot}`;
        if (row?.[key]?.id) map.set(num(row[key].id), row[key]);
      }
    });
    return map;
  }, [associations, allTimetableRows]);

  const teacherById = useMemo(() => {
    const map = new Map();
    associations.forEach((item) => {
      if (item.Teacher?.id) map.set(num(item.Teacher.id), item.Teacher);
    });
    allTimetableRows.forEach((row) => {
      for (let slot = 1; slot <= MAX_ASSIGNMENTS; slot += 1) {
        const key = slot === 1 ? 'Teacher' : `Teacher${slot}`;
        if (row?.[key]?.id) map.set(num(row[key].id), row[key]);
      }
    });
    return map;
  }, [associations, allTimetableRows]);

  const changedCells = useMemo(() => {
    const result = [];
    DAYS.forEach((day) => {
      periods.forEach((period) => {
        const current = assignments?.[day]?.[period.id] || [];
        const saved = savedAssignments?.[day]?.[period.id] || [];
        if (pairsKey(current) !== pairsKey(saved)) {
          result.push({ day, periodId: period.id });
        }
      });
    });
    return result;
  }, [assignments, savedAssignments, periods]);

  const changedKeySet = useMemo(
    () => new Set(changedCells.map((cell) => `${cell.day}:${cell.periodId}`)),
    [changedCells]
  );

  const externalBusyMap = useMemo(() => {
    const map = new Map();

    allTimetableRows.forEach((row) => {
      if (
        num(row.classId) === num(selectedClass) &&
        num(row.sectionId) === num(selectedSection)
      ) {
        return;
      }

      for (let slot = 1; slot <= MAX_ASSIGNMENTS; slot += 1) {
        const teacherId = num(row[slot === 1 ? 'teacherId' : `teacherId_${slot}`]);
        if (!teacherId) continue;

        const subjectKey = slot === 1 ? 'Subject' : `Subject${slot}`;
        const teacherKey = slot === 1 ? 'Teacher' : `Teacher${slot}`;
        const key = `${row.day}:${num(row.periodId)}:${teacherId}`;
        map.set(key, {
          className: row.Class?.class_name || `Class ${row.classId}`,
          sectionName: row.Section?.section_name || '',
          subjectName: row?.[subjectKey]?.name || '',
          teacherName: row?.[teacherKey]?.name || '',
        });
      }
    });

    return map;
  }, [allTimetableRows, selectedClass, selectedSection]);

  const getTeacherConflict = (teacherId, day, periodId) => {
    const external = externalBusyMap.get(`${day}:${num(periodId)}:${num(teacherId)}`);
    if (external) return external;

    const currentCell = assignments?.[day]?.[periodId] || [];
    const duplicateCount = currentCell.filter(
      (pair) => num(pair.teacherId) === num(teacherId)
    ).length;

    if (duplicateCount > 0) {
      return {
        local: true,
        className: selectedClassObj?.class_name || '',
        sectionName: selectedSectionObj?.section_name || '',
        subjectName: '',
      };
    }

    return null;
  };

  const cellHasConflict = (day, periodId) => {
    const cell = assignments?.[day]?.[periodId] || [];
    return cell.some((pair) => externalBusyMap.has(`${day}:${num(periodId)}:${num(pair.teacherId)}`));
  };

  const requestContextChange = async (nextClass, nextSection) => {
    if (changedCells.length) {
      const discard = await swal({
        title: 'Unsaved timetable changes',
        text: 'Changing class or section will discard your pending changes.',
        icon: 'warning',
        buttons: ['Stay Here', 'Discard & Continue'],
        dangerMode: true,
      });
      if (!discard) return;
    }

    setSelectedClass(nextClass);
    if (nextSection !== undefined) setSelectedSection(nextSection);
  };

  const handleClassChange = (classId) => {
    if (num(classId) === num(selectedClass)) return;
    requestContextChange(num(classId), null);
  };

  const handleSectionChange = (sectionId) => {
    if (num(sectionId) === num(selectedSection)) return;
    requestContextChange(selectedClass, num(sectionId));
  };

  const openCell = (day, periodId) => {
    setActiveCell({ day, periodId: num(periodId) });
    setActiveSubjectId(null);
    setSearchText('');
  };

  const setCellPairs = (day, periodId, pairs) => {
    setAssignments((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [periodId]: normalisePairs(pairs).slice(0, MAX_ASSIGNMENTS),
      },
    }));
  };

  const addAssignment = (subjectId, teacherId) => {
    if (!activeCell) return;

    const { day, periodId } = activeCell;
    const current = assignments?.[day]?.[periodId] || [];

    if (current.length >= MAX_ASSIGNMENTS) {
      swal('Limit reached', `A period can contain up to ${MAX_ASSIGNMENTS} assignments.`, 'warning');
      return;
    }

    if (
      current.some(
        (pair) =>
          num(pair.subjectId) === num(subjectId) && num(pair.teacherId) === num(teacherId)
      )
    ) {
      return;
    }

    const externalConflict = externalBusyMap.get(`${day}:${num(periodId)}:${num(teacherId)}`);
    const localDuplicate = current.some((pair) => num(pair.teacherId) === num(teacherId));

    if (externalConflict || localDuplicate) {
      const detail = externalConflict
        ? `${externalConflict.className}${externalConflict.sectionName ? ` - ${externalConflict.sectionName}` : ''}`
        : 'this same period';
      swal('Teacher is busy', `This teacher is already assigned in ${detail}.`, 'warning');
      return;
    }

    setCellPairs(day, periodId, [...current, { subjectId: num(subjectId), teacherId: num(teacherId) }]);
    setActiveSubjectId(null);
  };

  const handleSubjectClick = (subjectId) => {
    const teachers = teachersForSubject(subjectId);
    if (!teachers.length) {
      swal('Teacher not mapped', 'Assign a teacher to this subject first.', 'warning');
      return;
    }

    if (teachers.length === 1) {
      addAssignment(subjectId, teachers[0].id);
      return;
    }

    setActiveSubjectId(num(subjectId));
  };

  const removeAssignment = (index) => {
    if (!activeCell) return;
    const { day, periodId } = activeCell;
    const current = assignments?.[day]?.[periodId] || [];
    setCellPairs(
      day,
      periodId,
      current.filter((_, pairIndex) => pairIndex !== index)
    );
  };

  const clearActiveCell = () => {
    if (!activeCell) return;
    setCellPairs(activeCell.day, activeCell.periodId, []);
  };

  const applyCellToWeek = async () => {
    if (!activeCell) return;
    const { day, periodId } = activeCell;
    const sourcePairs = assignments?.[day]?.[periodId] || [];

    if (!sourcePairs.length) {
      swal('Nothing to copy', 'Assign at least one subject first.', 'info');
      return;
    }

    const blockedDays = DAYS.filter((targetDay) =>
      sourcePairs.some((pair) =>
        externalBusyMap.has(`${targetDay}:${num(periodId)}:${num(pair.teacherId)}`)
      )
    );

    const allowedDays = DAYS.filter((targetDay) => !blockedDays.includes(targetDay));

    setAssignments((prev) => {
      const next = clone(prev);
      allowedDays.forEach((targetDay) => {
        next[targetDay][periodId] = clone(sourcePairs);
      });
      return next;
    });

    if (blockedDays.length) {
      swal(
        'Copied with conflicts skipped',
        `Updated ${allowedDays.length} day(s). Skipped: ${blockedDays.join(', ')} because a mapped teacher is busy.`,
        'info'
      );
    }
  };

  const discardChanges = () => {
    setAssignments(clone(savedAssignments));
    setActiveSubjectId(null);
  };

  const buildPayload = (day, periodId, pairs) => {
    const clean = normalisePairs(pairs).slice(0, MAX_ASSIGNMENTS);
    const payload = {
      id: recordIds?.[day]?.[periodId] || undefined,
      periodId: num(periodId),
      classId: num(selectedClass),
      sectionId: num(selectedSection),
      day,
    };

    clean.forEach((pair, index) => {
      const slot = index + 1;
      const subjectKey = slot === 1 ? 'subjectId' : `subjectId_${slot}`;
      const teacherKey = slot === 1 ? 'teacherId' : `teacherId_${slot}`;
      payload[subjectKey] = pair.subjectId;
      payload[teacherKey] = pair.teacherId;
    });

    return payload;
  };

  const handleSave = async () => {
    if (!selectedClass || !selectedSection) return;
    if (!changedCells.length) {
      swal('No changes', 'The timetable is already up to date.', 'info');
      return;
    }

    const conflictCells = changedCells.filter((cell) => cellHasConflict(cell.day, cell.periodId));
    if (conflictCells.length) {
      swal(
        'Resolve teacher clashes',
        'One or more changed cells contain a teacher who is already busy in another class.',
        'warning'
      );
      return;
    }

    try {
      setSaving(true);

      for (const cell of changedCells) {
        const current = normalisePairs(assignments?.[cell.day]?.[cell.periodId] || []);
        const recordId = recordIds?.[cell.day]?.[cell.periodId];

        if (!current.length) {
          if (recordId) {
            const response = await fetch(`${API_URL}/period-class-teacher-subject/${recordId}`, {
              method: 'DELETE',
              headers: authHeaders(),
            });
            if (!response.ok) {
              const body = await response.json().catch(() => ({}));
              throw new Error(body.error || 'Failed to clear timetable cell.');
            }
          }
          continue;
        }

        const payload = buildPayload(cell.day, cell.periodId, current);
        const response = await fetch(`${API_URL}/period-class-teacher-subject`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || body.warning || 'Failed to save timetable.');
        }
      }

      await loadSelectedTimetable(selectedClass, selectedSection);
      await refreshGlobalRows();
      swal('Saved', 'Timetable changes saved successfully.', 'success');
    } catch (error) {
      console.error('Error saving timetable:', error);
      swal('Save failed', error.message || 'Something went wrong while saving.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintPdf = async () => {
    if (!selectedClass || !selectedSection) return;

    try {
      setPrinting(true);
      const response = await fetch(
        `${API_URL}/period-class-teacher-subject/class/${selectedClass}/pdf?sectionId=${selectedSection}`,
        { headers: pdfHeaders() }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to generate PDF.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const popup = window.open(url, '_blank', 'noopener,noreferrer');
      if (!popup) {
        window.URL.revokeObjectURL(url);
        swal('Popup blocked', 'Please allow popups to open the timetable PDF.', 'warning');
        return;
      }
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (error) {
      console.error('Error opening timetable PDF:', error);
      swal('Unable to open PDF', error.message, 'error');
    } finally {
      setPrinting(false);
    }
  };

  const weeklyAssignedCount = useMemo(() => {
    let count = 0;
    DAYS.forEach((day) => {
      periods.forEach((period) => {
        count += normalisePairs(assignments?.[day]?.[period.id] || []).length;
      });
    });
    return count;
  }, [assignments, periods]);

  const subjectWeeklyCount = useMemo(() => {
    const counts = new Map();
    DAYS.forEach((day) => {
      periods.forEach((period) => {
        normalisePairs(assignments?.[day]?.[period.id] || []).forEach((pair) => {
          counts.set(pair.subjectId, (counts.get(pair.subjectId) || 0) + 1);
        });
      });
    });
    return counts;
  }, [assignments, periods]);

  const activePeriod = useMemo(
    () => periods.find((period) => num(period.id) === num(activeCell?.periodId)),
    [periods, activeCell]
  );

  const activePairs = activeCell
    ? normalisePairs(assignments?.[activeCell.day]?.[activeCell.periodId] || [])
    : [];

  const filteredSubjects = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return subjects;

    return subjects.filter((subject) => {
      const teachers = teachersForSubject(subject.id);
      return (
        String(subject.name || '').toLowerCase().includes(q) ||
        teachers.some((teacher) => String(teacher.name || '').toLowerCase().includes(q))
      );
    });
  }, [subjects, searchText, contextAssociations]);

  const gridMinWidth = 118 + periods.length * 172;

  return (
    <div className="ttp-page">
      <div className="ttp-hero">
        <div>
          <div className="ttp-eyebrow">Coordinator Planner</div>
          <h3>Timetable Assignment</h3>
          <p>Choose a class, open any period, then click a subject. The mapped teacher is picked automatically.</p>
        </div>
        <div className="ttp-hero-actions">
          <button className="ttp-btn ttp-btn-ghost" onClick={handlePrintPdf} disabled={printing}>
            {printing ? 'Opening…' : 'Print PDF'}
          </button>
          <button
            className="ttp-btn ttp-btn-primary"
            onClick={handleSave}
            disabled={saving || !changedCells.length}
          >
            {saving ? 'Saving…' : changedCells.length ? `Save ${changedCells.length} Change${changedCells.length > 1 ? 's' : ''}` : 'Saved'}
          </button>
        </div>
      </div>

      <section className="ttp-selector-card">
        <div className="ttp-selector-head">
          <div>
            <span className="ttp-step">1</span>
            <strong>Select Class</strong>
          </div>
          <span className="ttp-context-label">
            {selectedClassObj?.class_name || '—'} {selectedSectionObj?.section_name ? `• ${selectedSectionObj.section_name}` : ''}
          </span>
        </div>
        <div className="ttp-chip-row">
          {classes.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`ttp-class-chip ${num(item.id) === num(selectedClass) ? 'is-active' : ''}`}
              onClick={() => handleClassChange(item.id)}
            >
              {item.class_name}
            </button>
          ))}
        </div>

        <div className="ttp-selector-head ttp-section-head">
          <div>
            <span className="ttp-step">2</span>
            <strong>Select Section</strong>
          </div>
        </div>
        <div className="ttp-chip-row ttp-section-row">
          {classSections.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`ttp-section-chip ${num(item.id) === num(selectedSection) ? 'is-active' : ''}`}
              onClick={() => handleSectionChange(item.id)}
            >
              {item.section_name}
            </button>
          ))}
          {!classSections.length && <span className="ttp-muted">No sections found.</span>}
        </div>
      </section>

      <div className="ttp-summary-row">
        <div className="ttp-summary-card"><span>Weekly Assignments</span><strong>{weeklyAssignedCount}</strong></div>
        <div className="ttp-summary-card"><span>Subjects Mapped</span><strong>{subjects.length}</strong></div>
        <div className="ttp-summary-card"><span>Pending Cells</span><strong>{changedCells.length}</strong></div>
        <div className="ttp-summary-card"><span>Periods</span><strong>{periods.length}</strong></div>
      </div>

      <div className="ttp-workspace">
        <section className="ttp-grid-card">
          <div className="ttp-grid-titlebar">
            <div>
              <span className="ttp-step">3</span>
              <strong>Click a timetable cell</strong>
              <small>Then choose a subject from the planner panel.</small>
            </div>
            <div className="ttp-legend">
              <span><i className="saved" /> Saved</span>
              <span><i className="pending" /> Pending</span>
              <span><i className="conflict" /> Clash</span>
            </div>
          </div>

          <div className={`ttp-grid-scroll ${loadingGrid ? 'is-loading' : ''}`}>
            <div className="ttp-grid" style={{ minWidth: `${gridMinWidth}px` }}>
              <div className="ttp-grid-row ttp-grid-header" style={{ gridTemplateColumns: `118px repeat(${periods.length}, minmax(172px, 1fr))` }}>
                <div className="ttp-grid-corner">Day</div>
                {periods.map((period) => (
                  <div className="ttp-period-head" key={period.id}>
                    <strong>{period.period_name}</strong>
                    {(period.start_time || period.end_time) && (
                      <small>{period.start_time || ''}{period.end_time ? ` – ${period.end_time}` : ''}</small>
                    )}
                  </div>
                ))}
              </div>

              {DAYS.map((day) => (
                <div className="ttp-grid-row" key={day} style={{ gridTemplateColumns: `118px repeat(${periods.length}, minmax(172px, 1fr))` }}>
                  <div className="ttp-day-cell">{day}</div>
                  {periods.map((period) => {
                    const pairs = normalisePairs(assignments?.[day]?.[period.id] || []);
                    const pending = changedKeySet.has(`${day}:${period.id}`);
                    const conflict = cellHasConflict(day, period.id);
                    const active = activeCell?.day === day && num(activeCell?.periodId) === num(period.id);
                    const stateClass = conflict ? 'has-conflict' : pending ? 'is-pending' : pairs.length ? 'is-saved' : 'is-empty';

                    return (
                      <button
                        type="button"
                        key={period.id}
                        className={`ttp-cell ${stateClass} ${active ? 'is-active' : ''}`}
                        onClick={() => openCell(day, period.id)}
                      >
                        {!pairs.length ? (
                          <div className="ttp-empty-cell">
                            <span>＋</span>
                            <small>Assign</small>
                          </div>
                        ) : (
                          <div className="ttp-cell-pairs">
                            {pairs.slice(0, 3).map((pair, index) => (
                              <div className="ttp-cell-pair" key={`${pair.subjectId}-${pair.teacherId}-${index}`}>
                                <strong>{subjectById.get(pair.subjectId)?.name || `Subject ${pair.subjectId}`}</strong>
                                <small>{teacherById.get(pair.teacherId)?.name || `Teacher ${pair.teacherId}`}</small>
                              </div>
                            ))}
                            {pairs.length > 3 && <span className="ttp-more">+{pairs.length - 3} more</span>}
                          </div>
                        )}
                        {conflict && <span className="ttp-cell-status">Clash</span>}
                        {!conflict && pending && <span className="ttp-cell-status">Pending</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="ttp-planner-panel">
          {!activeCell ? (
            <div className="ttp-panel-empty">
              <div className="ttp-panel-icon">▦</div>
              <h5>Choose a period</h5>
              <p>Click any timetable cell. Subjects and mapped teachers will appear here.</p>
            </div>
          ) : (
            <>
              <div className="ttp-panel-head">
                <div>
                  <span className="ttp-panel-kicker">{activeCell.day}</span>
                  <h5>{activePeriod?.period_name || 'Period'}</h5>
                  <small>{activePeriod?.start_time || ''}{activePeriod?.end_time ? ` – ${activePeriod.end_time}` : ''}</small>
                </div>
                <button type="button" className="ttp-close" onClick={() => setActiveCell(null)}>×</button>
              </div>

              <div className="ttp-current-block">
                <div className="ttp-block-title">
                  <strong>Current assignments</strong>
                  {activePairs.length > 0 && <button onClick={clearActiveCell}>Clear cell</button>}
                </div>

                {!activePairs.length && <div className="ttp-none">No subject assigned yet.</div>}
                {activePairs.map((pair, index) => (
                  <div className="ttp-current-item" key={`${pair.subjectId}-${pair.teacherId}-${index}`}>
                    <div>
                      <strong>{subjectById.get(pair.subjectId)?.name || `Subject ${pair.subjectId}`}</strong>
                      <small>{teacherById.get(pair.teacherId)?.name || `Teacher ${pair.teacherId}`}</small>
                    </div>
                    <button type="button" onClick={() => removeAssignment(index)} title="Remove">×</button>
                  </div>
                ))}
              </div>

              <div className="ttp-panel-section">
                <div className="ttp-block-title">
                  <strong>{activeSubjectId ? 'Select teacher' : 'Add subject'}</strong>
                  {activeSubjectId && <button onClick={() => setActiveSubjectId(null)}>Back</button>}
                </div>

                {!activeSubjectId && (
                  <>
                    <input
                      className="ttp-search"
                      value={searchText}
                      onChange={(event) => setSearchText(event.target.value)}
                      placeholder="Search subject or teacher…"
                    />
                    <div className="ttp-subject-list">
                      {filteredSubjects.map((subject) => {
                        const mappedTeachers = teachersForSubject(subject.id);
                        const primaryTeacher = mappedTeachers[0];
                        const conflict = mappedTeachers.length === 1 && primaryTeacher
                          ? externalBusyMap.get(`${activeCell.day}:${num(activeCell.periodId)}:${num(primaryTeacher.id)}`)
                          : null;
                        const alreadyAdded = activePairs.some((pair) => num(pair.subjectId) === num(subject.id));

                        return (
                          <button
                            type="button"
                            key={subject.id}
                            className={`ttp-subject-card ${conflict ? 'is-busy' : ''}`}
                            onClick={() => handleSubjectClick(subject.id)}
                            disabled={alreadyAdded || !mappedTeachers.length}
                          >
                            <div className="ttp-subject-main">
                              <strong>{subject.name}</strong>
                              <small>
                                {mappedTeachers.length === 1
                                  ? mappedTeachers[0].name
                                  : mappedTeachers.length > 1
                                  ? `${mappedTeachers.length} mapped teachers`
                                  : 'No teacher mapped'}
                              </small>
                            </div>
                            <div className="ttp-subject-meta">
                              <span>{subjectWeeklyCount.get(num(subject.id)) || 0} / week</span>
                              {conflict ? (
                                <em>Busy: {conflict.className}{conflict.sectionName ? `-${conflict.sectionName}` : ''}</em>
                              ) : alreadyAdded ? (
                                <em>Added</em>
                              ) : (
                                <em>＋ Add</em>
                              )}
                            </div>
                          </button>
                        );
                      })}
                      {!filteredSubjects.length && (
                        <div className="ttp-none">No mapped subjects match your search.</div>
                      )}
                    </div>
                  </>
                )}

                {activeSubjectId && (
                  <div className="ttp-teacher-list">
                    {teachersForSubject(activeSubjectId).map((teacher) => {
                      const conflict = getTeacherConflict(teacher.id, activeCell.day, activeCell.periodId);
                      return (
                        <button
                          type="button"
                          className={`ttp-teacher-card ${conflict ? 'is-busy' : ''}`}
                          key={teacher.id}
                          disabled={Boolean(conflict)}
                          onClick={() => addAssignment(activeSubjectId, teacher.id)}
                        >
                          <span className="ttp-avatar">{String(teacher.name || 'T').trim().charAt(0).toUpperCase()}</span>
                          <span className="ttp-teacher-copy">
                            <strong>{teacher.name}</strong>
                            <small>
                              {conflict
                                ? `Busy • ${conflict.className}${conflict.sectionName ? `-${conflict.sectionName}` : ''}`
                                : 'Available'}
                            </small>
                          </span>
                          <span className="ttp-select-label">Select</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="ttp-panel-actions">
                <button type="button" className="ttp-btn ttp-btn-ghost" onClick={applyCellToWeek} disabled={!activePairs.length}>
                  Apply this period to whole week
                </button>
              </div>
            </>
          )}
        </aside>
      </div>

      {changedCells.length > 0 && (
        <div className="ttp-savebar">
          <div>
            <strong>{changedCells.length} pending cell{changedCells.length > 1 ? 's' : ''}</strong>
            <span>Review clashes, then save once.</span>
          </div>
          <div>
            <button className="ttp-btn ttp-btn-ghost" onClick={discardChanges} disabled={saving}>Discard</button>
            <button className="ttp-btn ttp-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save All Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimetableAssignment;
