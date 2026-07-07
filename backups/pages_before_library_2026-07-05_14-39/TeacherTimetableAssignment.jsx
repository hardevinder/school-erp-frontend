import React, { useState, useEffect, useMemo } from 'react';
import swal from 'sweetalert';

const API_URL = process.env.REACT_APP_API_URL;
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TeacherTimetableAssignment = () => {
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  const getPdfHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      Authorization: `Bearer ${token}`,
    };
  };

  const createEmptyGrid = (periodList = []) => {
    const grid = {};
    days.forEach((day) => {
      grid[day] = {};
      periodList.forEach((period) => {
        grid[day][period.id] = { classId: 0, subjectId: 0, id: null };
      });
    });
    return grid;
  };

  const createEmptyConflictGrid = (periodList = []) => {
    const grid = {};
    days.forEach((day) => {
      grid[day] = {};
      periodList.forEach((period) => {
        grid[day][period.id] = '';
      });
    });
    return grid;
  };

  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [periods, setPeriods] = useState([]);
  const [associations, setAssociations] = useState([]);

  const [assignments, setAssignments] = useState({});
  const [savedAssignments, setSavedAssignments] = useState({});
  const [conflictCells, setConflictCells] = useState({});
  const [hovered, setHovered] = useState({ day: null, period: null });
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/periods`, {
      headers: getAuthHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        const periodData = Array.isArray(data) ? data : [];
        setPeriods(periodData);
        setAssignments(createEmptyGrid(periodData));
        setSavedAssignments(createEmptyGrid(periodData));
        setConflictCells(createEmptyConflictGrid(periodData));
      })
      .catch((error) => console.error('Error fetching periods:', error));
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/class-subject-teachers`, {
      headers: getAuthHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        const associationsData = Array.isArray(data) ? data : [];
        setAssociations(associationsData);

        const teacherMap = new Map();
        associationsData.forEach((assoc) => {
          if (assoc.Teacher) {
            teacherMap.set(assoc.Teacher.id, assoc.Teacher);
          }
        });

        const teacherList = Array.from(teacherMap.values());
        setTeachers(teacherList);

        if (teacherList.length > 0) {
          setSelectedTeacher(String(teacherList[0].id));
        }
      })
      .catch((error) => console.error('Error fetching associations:', error));
  }, []);

  useEffect(() => {
    if (!selectedTeacher || periods.length === 0) return;

    fetch(`${API_URL}/period-class-teacher-subject/timetable-teacher/${selectedTeacher}`, {
      headers: getAuthHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        const newAssign = createEmptyGrid(periods);
        const newConflict = createEmptyConflictGrid(periods);

        (Array.isArray(data) ? data : []).forEach((record) => {
          const { day, periodId, classId, subjectId, id } = record;
          if (newAssign[day] && newAssign[day][periodId] !== undefined) {
            newAssign[day][periodId] = {
              classId: classId || 0,
              subjectId: subjectId || 0,
              id: id || null,
            };
            newConflict[day][periodId] = classId && subjectId ? 'saved' : '';
          }
        });

        setAssignments(newAssign);
        setSavedAssignments(JSON.parse(JSON.stringify(newAssign)));
        setConflictCells(newConflict);
      })
      .catch((error) => console.error('Error fetching timetable for teacher:', error));
  }, [selectedTeacher, periods]);

  const getAvailableClasses = () => {
    if (!Array.isArray(associations) || !selectedTeacher) return [];

    const filtered = associations.filter(
      (assoc) => assoc.Teacher && String(assoc.Teacher.id) === String(selectedTeacher)
    );

    const uniqueMap = new Map();
    filtered.forEach((assoc) => {
      if (assoc.Class) uniqueMap.set(assoc.Class.id, assoc.Class);
    });

    return Array.from(uniqueMap.values());
  };

  const getAvailableSubjects = (classId) => {
    if (!Array.isArray(associations) || !selectedTeacher || !classId) return [];

    const filtered = associations.filter(
      (assoc) =>
        assoc.Teacher &&
        String(assoc.Teacher.id) === String(selectedTeacher) &&
        assoc.Class &&
        assoc.Class.id === classId &&
        assoc.Subject
    );

    const uniqueMap = new Map();
    filtered.forEach((assoc) => uniqueMap.set(assoc.Subject.id, assoc.Subject));

    return Array.from(uniqueMap.values());
  };

  const updateConflictStatus = (day, periodId, newCell) => {
    const saved = savedAssignments?.[day]?.[periodId] || { classId: 0, subjectId: 0 };

    const status =
      newCell.classId === 0 && newCell.subjectId === 0
        ? ''
        : newCell.classId === saved.classId && newCell.subjectId === saved.subjectId
        ? 'saved'
        : 'pending';

    setConflictCells((prev) => ({
      ...prev,
      [day]: {
        ...(prev[day] || {}),
        [periodId]: status,
      },
    }));
  };

  const handleAssignmentChange = (day, periodId, field, value) => {
    const currentCell =
      assignments?.[day]?.[periodId] || { classId: 0, subjectId: 0, id: null };

    const newCell = {
      ...currentCell,
      [field]: value,
    };

    if (field === 'classId') {
      newCell.subjectId = 0;
    }

    setAssignments((prev) => ({
      ...prev,
      [day]: {
        ...(prev[day] || {}),
        [periodId]: newCell,
      },
    }));

    updateConflictStatus(day, periodId, newCell);

    if (day === 'Monday' && newCell.classId !== 0 && newCell.subjectId !== 0) {
      setTimeout(() => {
        swal({
          title: 'Apply to full week?',
          text: 'Do you want to copy this same assignment to all days for this period?',
          icon: 'info',
          buttons: ['No', 'Yes'],
        }).then((willFill) => {
          if (willFill) {
            setAssignments((prev) => {
              const newAssignments = { ...prev };

              days.forEach((d) => {
                newAssignments[d] = {
                  ...newAssignments[d],
                  [periodId]: {
                    ...(newAssignments[d][periodId] || {}),
                    classId: newCell.classId,
                    subjectId: newCell.subjectId,
                  },
                };
              });

              return newAssignments;
            });

            setConflictCells((prev) => {
              const newConflicts = { ...prev };
              days.forEach((d) => {
                newConflicts[d] = {
                  ...newConflicts[d],
                  [periodId]: 'pending',
                };
              });
              return newConflicts;
            });
          }
        });
      }, 100);
    }
  };

  const handleClear = (day, periodId) => {
    const clearSingle = () => {
      setAssignments((prev) => ({
        ...prev,
        [day]: {
          ...prev[day],
          [periodId]: {
            ...(prev[day]?.[periodId] || {}),
            classId: 0,
            subjectId: 0,
          },
        },
      }));

      setConflictCells((prev) => ({
        ...prev,
        [day]: {
          ...prev[day],
          [periodId]: '',
        },
      }));
    };

    if (day === 'Monday') {
      swal({
        title: 'Clear full week?',
        text: 'Do you want to clear this period for the complete week?',
        icon: 'warning',
        buttons: ['No', 'Yes'],
      }).then((clearFullWeek) => {
        if (clearFullWeek) {
          setAssignments((prev) => {
            const newAssignments = { ...prev };
            days.forEach((d) => {
              newAssignments[d] = {
                ...newAssignments[d],
                [periodId]: {
                  ...(newAssignments[d]?.[periodId] || {}),
                  classId: 0,
                  subjectId: 0,
                },
              };
            });
            return newAssignments;
          });

          setConflictCells((prev) => {
            const newConflicts = { ...prev };
            days.forEach((d) => {
              newConflicts[d] = {
                ...newConflicts[d],
                [periodId]: '',
              };
            });
            return newConflicts;
          });
        } else {
          clearSingle();
        }
      });
    } else {
      clearSingle();
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      for (const day of days) {
        for (const period of periods) {
          const saved = savedAssignments?.[day]?.[period.id];
          const current = assignments?.[day]?.[period.id];

          if (
            saved &&
            (saved.classId || saved.subjectId) &&
            current &&
            current.classId === 0 &&
            current.subjectId === 0 &&
            saved.id
          ) {
            const response = await fetch(`${API_URL}/period-class-teacher-subject/${saved.id}`, {
              method: 'DELETE',
              headers: getAuthHeaders(),
            });

            if (!response.ok) {
              swal('Error', 'Failed to delete assignment.', 'error');
              setSaving(false);
              return;
            }

            setSavedAssignments((prev) => ({
              ...prev,
              [day]: {
                ...prev[day],
                [period.id]: { classId: 0, subjectId: 0, id: null },
              },
            }));
          }
        }
      }

      const records = [];
      days.forEach((day) => {
        periods.forEach((period) => {
          const cell = assignments?.[day]?.[period.id];
          if (cell && cell.classId && cell.subjectId) {
            records.push({
              periodId: period.id,
              teacherId: Number(selectedTeacher),
              classId: cell.classId,
              subjectId: cell.subjectId,
              day,
              source: 'teacher',
              ...(cell.id ? { id: cell.id } : {}),
            });
          }
        });
      });

      if (!records.length) {
        swal('Success', 'Timetable cleared successfully!', 'success');
        setSaving(false);
        return;
      }

      for (const record of records) {
        const response = await fetch(`${API_URL}/period-class-teacher-subject/`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(record),
        });

        if (!response.ok) {
          const errorData = await response.json();
          swal(
            'Error',
            errorData.error || errorData.warning || 'An error occurred while saving.',
            'error'
          );
          setSaving(false);
          return;
        }

        const savedRow = await response.json();

        setSavedAssignments((prev) => ({
          ...prev,
          [record.day]: {
            ...prev[record.day],
            [record.periodId]: {
              classId: savedRow.classId,
              subjectId: savedRow.subjectId,
              id: savedRow.id || null,
            },
          },
        }));

        setAssignments((prev) => ({
          ...prev,
          [record.day]: {
            ...prev[record.day],
            [record.periodId]: {
              ...prev[record.day][record.periodId],
              id: savedRow.id || null,
            },
          },
        }));

        setConflictCells((prev) => ({
          ...prev,
          [record.day]: {
            ...prev[record.day],
            [record.periodId]: 'saved',
          },
        }));
      }

      swal('Success', 'Timetable saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving timetable:', error);
      swal('Error', 'Something went wrong while saving timetable.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintPdf = async () => {
    if (!selectedTeacher) {
      swal('Select Teacher', 'Please select a teacher first.', 'warning');
      return;
    }

    try {
      setPrinting(true);

      const response = await fetch(
        `${API_URL}/period-class-teacher-subject/timetable-teacher/${selectedTeacher}/pdf`,
        {
          method: 'GET',
          headers: getPdfHeaders(),
        }
      );

      if (!response.ok) {
        let errorMessage = 'Failed to generate PDF.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // ignore
        }
        swal('Error', errorMessage, 'error');
        return;
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const printWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer');

      if (!printWindow) {
        swal('Popup Blocked', 'Please allow popups to open the PDF.', 'warning');
        window.URL.revokeObjectURL(blobUrl);
        return;
      }

      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 60000);
    } catch (error) {
      console.error('Error printing teacher timetable PDF:', error);
      swal('Error', 'Unable to open timetable PDF.', 'error');
    } finally {
      setPrinting(false);
    }
  };

  const { dailyWorkload, weeklyWorkload, pendingCount } = useMemo(() => {
    const daily = {};
    let weekly = 0;
    let pending = 0;

    days.forEach((day) => {
      let count = 0;

      if (assignments[day]) {
        periods.forEach((period) => {
          const cell = assignments[day][period.id];
          if (cell && cell.classId && cell.subjectId) {
            count++;
            weekly++;
          }
          if (conflictCells?.[day]?.[period.id] === 'pending') {
            pending++;
          }
        });
      }

      daily[day] = count;
    });

    return {
      dailyWorkload: daily,
      weeklyWorkload: weekly,
      pendingCount: pending,
    };
  }, [assignments, periods, conflictCells]);

  const selectedTeacherName =
    teachers.find((t) => String(t.id) === String(selectedTeacher))?.name || 'Select Teacher';

  const getCellStatusStyle = (status) => {
    if (status === 'saved') {
      return { background: '#ecfdf3', borderColor: '#86efac' };
    }
    if (status === 'pending') {
      return { background: '#fffbeb', borderColor: '#fcd34d' };
    }
    if (status === 'server') {
      return { background: '#fff1f2', borderColor: '#fda4af' };
    }
    return { background: '#ffffff', borderColor: '#e2e8f0' };
  };

  return (
    <div className="container-fluid px-2 px-md-3 py-3 teacher-timetable-page">
      <style>{`
        .teacher-timetable-page .top-card {
          border-radius: 16px;
          overflow: hidden;
        }

        .teacher-timetable-page .summary-chip {
          min-height: 70px;
          border-radius: 14px;
        }

        .teacher-timetable-page .timetable-table {
          table-layout: auto;
        }

        .teacher-timetable-page .timetable-table thead th {
          position: sticky;
          top: 0;
          z-index: 3;
          background: #f8fafc;
        }

        .teacher-timetable-page .day-sticky {
          position: sticky;
          left: 0;
          z-index: 2;
          background: #fff;
        }

        .teacher-timetable-page .day-sticky.header-sticky {
          z-index: 4;
          background: #f8fafc;
        }

        .teacher-timetable-page .workload-sticky {
          position: sticky;
          right: 0;
          z-index: 2;
          background: #fff;
        }

        .teacher-timetable-page .workload-sticky.header-sticky {
          z-index: 4;
          background: #f8fafc;
        }

        .teacher-timetable-page .period-header {
          line-height: 1.1;
        }

        .teacher-timetable-page .cell-box {
          min-height: 76px;
          border-radius: 14px;
          padding: 8px;
          position: relative;
          transition: all 0.2s ease;
        }

        .teacher-timetable-page .compact-select {
          min-height: 34px;
          font-size: 0.86rem;
          border-radius: 9px;
          padding-top: 4px;
          padding-bottom: 4px;
        }

        .teacher-timetable-page .clear-btn {
          top: 6px;
          right: 6px;
          width: 20px;
          height: 20px;
          line-height: 12px;
          border-radius: 50%;
          padding: 0;
          font-size: 11px;
        }

        .teacher-timetable-page .mini-badge {
          font-size: 0.78rem;
          padding: 7px 10px;
          border-radius: 999px;
        }

        .teacher-timetable-page .table td,
        .teacher-timetable-page .table th {
          vertical-align: middle;
        }

        @media (max-width: 1400px) {
          .teacher-timetable-page .period-col {
            min-width: 165px !important;
          }

          .teacher-timetable-page .day-col {
            min-width: 96px !important;
          }

          .teacher-timetable-page .workload-col {
            min-width: 72px !important;
          }

          .teacher-timetable-page .cell-box {
            min-height: 72px;
            padding: 7px;
          }

          .teacher-timetable-page .compact-select {
            min-height: 32px;
            font-size: 0.82rem;
          }
        }

        @media (max-width: 992px) {
          .teacher-timetable-page .period-col {
            min-width: 155px !important;
          }

          .teacher-timetable-page .cell-box {
            min-height: 68px;
            padding: 6px;
          }

          .teacher-timetable-page .compact-select {
            min-height: 30px;
            font-size: 0.8rem;
          }
        }
      `}</style>

      <div className="card border-0 shadow-sm mb-3 top-card">
        <div
          className="card-body py-3"
          style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)' }}
        >
          <div className="d-flex flex-column flex-xl-row justify-content-between align-items-xl-center gap-3">
            <div>
              <h4 className="mb-1 fw-bold text-dark">Teacher Timetable Assignment</h4>
              <div className="small text-muted">
                Compact weekly view for faster assignment on smaller screens.
              </div>
            </div>

            <div className="d-flex flex-column flex-sm-row gap-2 align-items-stretch">
              <div className="bg-white border rounded-3 px-3 py-2 shadow-sm">
                <div className="small text-muted">Teacher</div>
                <div className="fw-semibold text-dark">{selectedTeacherName}</div>
              </div>

              <button
                className="btn btn-outline-dark fw-semibold px-4"
                onClick={handlePrintPdf}
                disabled={printing || !selectedTeacher}
                style={{ borderRadius: '10px', minWidth: '140px' }}
              >
                {printing ? 'Opening PDF...' : 'Print PDF'}
              </button>

              <button
                className="btn btn-primary fw-semibold px-4"
                onClick={handleSave}
                disabled={saving || !selectedTeacher}
                style={{ borderRadius: '10px', minWidth: '150px' }}
              >
                {saving ? 'Saving...' : 'Save Timetable'}
              </button>
            </div>
          </div>

          <div className="row g-2 mt-2 align-items-stretch">
            <div className="col-lg-4">
              <div className="bg-white border rounded-4 p-2 h-100 shadow-sm">
                <label htmlFor="teacherSelect" className="form-label fw-semibold text-dark small mb-1">
                  Select Teacher
                </label>
                <select
                  id="teacherSelect"
                  className="form-select"
                  value={selectedTeacher}
                  onChange={(e) => setSelectedTeacher(e.target.value)}
                  style={{ borderRadius: '10px', minHeight: '40px' }}
                >
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="col-6 col-lg-2">
              <div className="bg-white border shadow-sm p-2 summary-chip text-center d-flex flex-column justify-content-center">
                <div className="small text-muted">Weekly</div>
                <div className="fs-5 fw-bold text-primary">{weeklyWorkload}</div>
              </div>
            </div>

            <div className="col-6 col-lg-2">
              <div className="bg-white border shadow-sm p-2 summary-chip text-center d-flex flex-column justify-content-center">
                <div className="small text-muted">Pending</div>
                <div className="fs-5 fw-bold text-warning">{pendingCount}</div>
              </div>
            </div>

            <div className="col-lg-4">
              <div className="bg-white border rounded-4 p-2 h-100 shadow-sm">
                <div className="d-flex flex-wrap gap-3 align-items-center small">
                  <div className="d-flex align-items-center gap-2">
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 99,
                        background: '#ecfdf3',
                        border: '1px solid #86efac',
                        display: 'inline-block',
                      }}
                    />
                    <span className="text-muted">Saved</span>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 99,
                        background: '#fffbeb',
                        border: '1px solid #fcd34d',
                        display: 'inline-block',
                      }}
                    />
                    <span className="text-muted">Pending</span>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 99,
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        display: 'inline-block',
                      }}
                    />
                    <span className="text-muted">Empty</span>
                  </div>
                </div>

                <div className="small text-muted mt-2">
                  Monday entry can still copy the same period to the full week.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm" style={{ borderRadius: '16px' }}>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table align-middle mb-0 timetable-table">
              <thead>
                <tr>
                  <th
                    className="fw-bold text-dark border-0 px-2 py-2 day-col day-sticky header-sticky"
                    style={{ minWidth: '105px' }}
                  >
                    Day
                  </th>

                  {periods.map((period) => (
                    <th
                      key={period.id}
                      className="fw-bold text-dark border-0 px-2 py-2 text-center period-col"
                      style={{ minWidth: '175px' }}
                    >
                      <div className="period-header">
                        <div className="fw-semibold">{period.period_name}</div>
                        {(period.start_time || period.end_time) && (
                          <small className="text-muted">
                            {period.start_time} {period.end_time ? `- ${period.end_time}` : ''}
                          </small>
                        )}
                      </div>
                    </th>
                  ))}

                  <th
                    className="fw-bold text-dark border-0 px-2 py-2 text-center workload-col workload-sticky header-sticky"
                    style={{ minWidth: '80px' }}
                  >
                    Load
                  </th>
                </tr>
              </thead>

              <tbody>
                {days.map((day) => (
                  <tr key={day}>
                    <td
                      className="fw-semibold px-2 py-2 day-sticky"
                      onMouseEnter={() => setHovered({ day, period: null })}
                      onMouseLeave={() => setHovered({ day: null, period: null })}
                      style={{
                        background: hovered.day === day ? '#f8fafc' : '#fff',
                        verticalAlign: 'top',
                        fontSize: '0.9rem',
                      }}
                    >
                      {day}
                    </td>

                    {periods.map((period) => {
                      const cellAssignment = assignments?.[day]?.[period.id] || {
                        classId: 0,
                        subjectId: 0,
                        id: null,
                      };

                      const cellStatus = conflictCells?.[day]?.[period.id] || '';
                      const cellStyle = getCellStatusStyle(cellStatus);

                      return (
                        <td
                          key={period.id}
                          className="px-1 py-1"
                          onMouseEnter={() => setHovered({ day, period: period.id })}
                          onMouseLeave={() => setHovered({ day: null, period: null })}
                          style={{
                            background:
                              hovered.day === day || hovered.period === period.id
                                ? '#f8fafc'
                                : '#fff',
                          }}
                        >
                          <div className="border cell-box" style={cellStyle}>
                            {cellAssignment.subjectId !== 0 && (
                              <button
                                type="button"
                                onClick={() => handleClear(day, period.id)}
                                title="Clear"
                                className="btn btn-sm btn-danger position-absolute clear-btn"
                              >
                                ×
                              </button>
                            )}

                            <div className="d-grid gap-1">
                              <select
                                className="form-select form-select-sm compact-select"
                                value={cellAssignment.classId || 0}
                                onChange={(e) =>
                                  handleAssignmentChange(
                                    day,
                                    period.id,
                                    'classId',
                                    parseInt(e.target.value, 10)
                                  )
                                }
                              >
                                <option value={0}>Select Class</option>
                                {getAvailableClasses().map((cls) => (
                                  <option key={cls.id} value={cls.id}>
                                    {cls.class_name}
                                  </option>
                                ))}
                              </select>

                              <select
                                className="form-select form-select-sm compact-select"
                                value={cellAssignment.subjectId || 0}
                                onChange={(e) =>
                                  handleAssignmentChange(
                                    day,
                                    period.id,
                                    'subjectId',
                                    parseInt(e.target.value, 10)
                                  )
                                }
                                disabled={!cellAssignment.classId || cellAssignment.classId === 0}
                              >
                                <option value={0}>Select Subject</option>
                                {getAvailableSubjects(cellAssignment.classId).map((subject) => (
                                  <option key={subject.id} value={subject.id}>
                                    {subject.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </td>
                      );
                    })}

                    <td className="text-center px-2 py-2 workload-sticky">
                      <span className="badge bg-primary mini-badge">{dailyWorkload[day] || 0}</span>
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr>
                  <td
                    colSpan={periods.length + 2}
                    className="text-center fw-bold py-2"
                    style={{ background: '#f8fafc', fontSize: '0.95rem' }}
                  >
                    Weekly Workload: {weeklyWorkload}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherTimetableAssignment;