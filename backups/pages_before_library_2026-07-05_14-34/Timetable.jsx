import React, { useState, useEffect, useMemo } from 'react';
import swal from 'sweetalert';

const API_URL = process.env.REACT_APP_API_URL;
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const buttonStyle = {
  width: '20px',
  height: '20px',
  borderRadius: '50%',
  fontSize: '11px',
  padding: '0',
  cursor: 'pointer',
  border: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
};

const TimetableAssignment = () => {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [associations, setAssociations] = useState([]);
  const [hovered, setHovered] = useState({ day: null, period: null });
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);

  const [assignments, setAssignments] = useState(() => {
    const init = {};
    days.forEach((day) => {
      init[day] = {};
    });
    return init;
  });

  const [savedAssignments, setSavedAssignments] = useState(() => {
    const init = {};
    days.forEach((day) => {
      init[day] = {};
    });
    return init;
  });

  const [conflictCells, setConflictCells] = useState(() => {
    const init = {};
    days.forEach((day) => {
      init[day] = {};
    });
    return init;
  });

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  const getPdfHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      Authorization: `Bearer ${token}`,
    };
  };

  const getAssignmentKeys = (index) => {
    if (index === 0) {
      return { subjectKey: 'subjectId', teacherKey: 'teacherId' };
    }
    return { subjectKey: `subjectId_${index + 1}`, teacherKey: `teacherId_${index + 1}` };
  };

  useEffect(() => {
    fetch(`${API_URL}/classes`, { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((data) => {
        const classData = Array.isArray(data) ? data : [];
        setClasses(classData);
        if (classData.length) setSelectedClass(classData[0].id);
      })
      .catch((error) => console.error('Error fetching classes:', error));
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/periods`, { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((data) => {
        const periodData = Array.isArray(data) ? data : [];
        setPeriods(periodData);

        const newAssignments = {};
        const newConflict = {};

        days.forEach((day) => {
          newAssignments[day] = {};
          newConflict[day] = {};
          periodData.forEach((period) => {
            newAssignments[day][period.id] = [{ subjectId: 0, teacherId: 0 }];
            newConflict[day][period.id] = [''];
          });
        });

        setAssignments(newAssignments);
        setConflictCells(newConflict);
      })
      .catch((error) => console.error('Error fetching periods:', error));
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/class-subject-teachers`, { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((data) => setAssociations(Array.isArray(data) ? data : []))
      .catch((error) => console.error('Error fetching associations:', error));
  }, []);

  useEffect(() => {
    if (!selectedClass || periods.length === 0) return;

    fetch(`${API_URL}/period-class-teacher-subject/class/${selectedClass}`, {
      headers: getAuthHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        const rows = Array.isArray(data) ? data : [];
        const newAssignments = {};
        const newConflict = {};

        days.forEach((day) => {
          newAssignments[day] = {};
          newConflict[day] = {};
          periods.forEach((period) => {
            newAssignments[day][period.id] = [];
            newConflict[day][period.id] = [];
          });
        });

        rows.forEach((record) => {
          const {
            day,
            periodId,
            subjectId,
            teacherId,
            id,
            subjectId_2,
            teacherId_2,
            subjectId_3,
            teacherId_3,
            subjectId_4,
            teacherId_4,
            subjectId_5,
            teacherId_5,
          } = record;

          if (newAssignments[day] && newAssignments[day][periodId] !== undefined) {
            const cellAssignments = [];
            cellAssignments.push({ subjectId, teacherId, id });

            if (subjectId_2 || teacherId_2) {
              cellAssignments.push({ subjectId_2, teacherId_2 });
            }
            if (subjectId_3 || teacherId_3) {
              cellAssignments.push({ subjectId_3, teacherId_3 });
            }
            if (subjectId_4 || teacherId_4) {
              cellAssignments.push({ subjectId_4, teacherId_4 });
            }
            if (subjectId_5 || teacherId_5) {
              cellAssignments.push({ subjectId_5, teacherId_5 });
            }

            newAssignments[day][periodId] = cellAssignments;
            newConflict[day][periodId] = cellAssignments.map(() => 'saved');
          }
        });

        days.forEach((day) => {
          periods.forEach((period) => {
            if (!newAssignments[day][period.id] || newAssignments[day][period.id].length === 0) {
              newAssignments[day][period.id] = [{ subjectId: 0, teacherId: 0 }];
              newConflict[day][period.id] = [''];
            }
          });
        });

        setAssignments(newAssignments);
        setSavedAssignments(JSON.parse(JSON.stringify(newAssignments)));
        setConflictCells(newConflict);
      })
      .catch((error) => console.error('Error fetching timetable for class:', error));
  }, [selectedClass, periods]);

  const getAvailableSubjects = () => {
    const filtered = associations.filter((assoc) => assoc.class_id === selectedClass);
    const uniqueMap = new Map();

    filtered.forEach((assoc) => {
      if (assoc.Subject) uniqueMap.set(assoc.Subject.id, assoc.Subject);
    });

    return Array.from(uniqueMap.values());
  };

  const getAvailableTeachers = (subjectId) => {
    const filtered = associations.filter(
      (assoc) =>
        assoc.class_id === selectedClass &&
        assoc.subject_id === subjectId &&
        assoc.Teacher
    );

    const uniqueMap = new Map();
    filtered.forEach((assoc) => uniqueMap.set(assoc.Teacher.id, assoc.Teacher));

    return Array.from(uniqueMap.values());
  };

  const handleCellAssignmentChange = (day, periodId, index, fieldBase, value) => {
    const cell = assignments[day][periodId] || [];
    const { subjectKey, teacherKey } = getAssignmentKeys(index);
    const key = fieldBase === 'subjectId' ? subjectKey : teacherKey;

    const currentAssignment = cell[index] || { [subjectKey]: 0, [teacherKey]: 0 };
    const updatedAssignment = { ...currentAssignment, [key]: value };

    if (fieldBase === 'subjectId') {
      updatedAssignment[teacherKey] = 0;
    }

    const newCell = [...cell];
    newCell[index] = updatedAssignment;

    setAssignments((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [periodId]: newCell,
      },
    }));

    const savedCell = (savedAssignments[day] && savedAssignments[day][periodId]) || [];
    const savedAssignment = savedCell[index] || { [subjectKey]: 0, [teacherKey]: 0 };

    const status =
      updatedAssignment[subjectKey] === 0
        ? ''
        : updatedAssignment[subjectKey] === savedAssignment[subjectKey] &&
          updatedAssignment[teacherKey] === savedAssignment[teacherKey]
        ? 'saved'
        : 'pending';

    const cellConflicts = conflictCells[day][periodId] ? [...conflictCells[day][periodId]] : [];
    cellConflicts[index] = status;

    setConflictCells((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [periodId]: cellConflicts,
      },
    }));

    if (day === 'Monday' && updatedAssignment[subjectKey] && updatedAssignment[teacherKey]) {
      setTimeout(() => {
        swal({
          title: 'Fill for whole week?',
          text: 'Do you want to apply this assignment to every day for this period?',
          icon: 'info',
          buttons: ['No', 'Yes'],
        }).then((willFill) => {
          if (willFill) {
            setAssignments((prev) => {
              const newAssignments = { ...prev };

              days.forEach((d) => {
                const oldCell = newAssignments[d][periodId] || [];
                const clonedCell = oldCell.map((item, i) => {
                  if (i === index) return { ...updatedAssignment };
                  return item;
                });

                while (clonedCell.length <= index) {
                  const { subjectKey: sKey, teacherKey: tKey } = getAssignmentKeys(clonedCell.length);
                  clonedCell.push({ [sKey]: 0, [tKey]: 0 });
                }

                clonedCell[index] = { ...updatedAssignment };

                newAssignments[d] = {
                  ...newAssignments[d],
                  [periodId]: clonedCell,
                };
              });

              return newAssignments;
            });

            setConflictCells((prev) => {
              const newConflicts = { ...prev };

              days.forEach((d) => {
                const oldConflicts = [...(newConflicts[d][periodId] || [])];
                while (oldConflicts.length <= index) oldConflicts.push('');
                oldConflicts[index] = 'pending';

                newConflicts[d] = {
                  ...newConflicts[d],
                  [periodId]: oldConflicts,
                };
              });

              return newConflicts;
            });
          }
        });
      }, 100);
    }
  };

  const handleAddAssignment = (day, periodId) => {
    const cell = assignments[day][periodId] || [];

    if (cell.length >= 5) {
      return swal('Limit reached', 'You can add up to 5 assignments per cell.', 'warning');
    }

    const newIndex = cell.length;
    const { subjectKey, teacherKey } = getAssignmentKeys(newIndex);
    const newAssignment = { [subjectKey]: 0, [teacherKey]: 0 };
    const newCell = [...cell, newAssignment];

    setAssignments((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [periodId]: newCell,
      },
    }));

    const cellConflicts = conflictCells[day][periodId] ? [...conflictCells[day][periodId]] : [];
    cellConflicts.push('');

    setConflictCells((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [periodId]: cellConflicts,
      },
    }));
  };

  const handleRemoveAssignment = (day, periodId, index) => {
    const cell = assignments[day][periodId] || [];

    if (cell.length <= 1) {
      const { subjectKey, teacherKey } = getAssignmentKeys(0);
      const newAssignment = { [subjectKey]: 0, [teacherKey]: 0 };

      setAssignments((prev) => ({
        ...prev,
        [day]: {
          ...prev[day],
          [periodId]: [newAssignment],
        },
      }));

      setConflictCells((prev) => ({
        ...prev,
        [day]: {
          ...prev[day],
          [periodId]: [''],
        },
      }));

      return;
    }

    const newCell = cell.filter((_, i) => i !== index);
    const cellConflicts = conflictCells[day][periodId]
      ? [...conflictCells[day][periodId]]
      : [];
    cellConflicts.splice(index, 1);

    setAssignments((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [periodId]: newCell,
      },
    }));

    setConflictCells((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [periodId]: cellConflicts,
      },
    }));
  };

  const handleClearCell = (day, periodId) => {
    const clearSingle = () => {
      setAssignments((prev) => ({
        ...prev,
        [day]: {
          ...prev[day],
          [periodId]: [{ subjectId: 0, teacherId: 0 }],
        },
      }));

      setConflictCells((prev) => ({
        ...prev,
        [day]: {
          ...prev[day],
          [periodId]: [''],
        },
      }));
    };

    if (day === 'Monday') {
      swal({
        title: 'Clear full week?',
        text: 'Do you want to clear this period for the whole week?',
        icon: 'warning',
        buttons: ['No', 'Yes'],
      }).then((clearFullWeek) => {
        if (clearFullWeek) {
          setAssignments((prev) => {
            const newAssignments = { ...prev };
            days.forEach((d) => {
              newAssignments[d] = {
                ...newAssignments[d],
                [periodId]: [{ subjectId: 0, teacherId: 0 }],
              };
            });
            return newAssignments;
          });

          setConflictCells((prev) => {
            const newConflicts = { ...prev };
            days.forEach((d) => {
              newConflicts[d] = {
                ...newConflicts[d],
                [periodId]: [''],
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
          const savedCell = savedAssignments?.[day]?.[period.id];
          const currentCell = assignments?.[day]?.[period.id];

          if (
            savedCell &&
            savedCell.length > 0 &&
            currentCell &&
            currentCell.every((a) => {
              const keys = Object.keys(a).filter((key) => key !== 'id' && key !== 'combinationId');
              return keys.every((key) => a[key] === 0);
            })
          ) {
            for (const record of savedCell) {
              if (record.id) {
                const response = await fetch(
                  `${API_URL}/period-class-teacher-subject/${record.id}`,
                  {
                    method: 'DELETE',
                    headers: getAuthHeaders(),
                  }
                );

                if (!response.ok) {
                  swal('Error', 'Failed to delete assignment.', 'error');
                  setSaving(false);
                  return;
                }
              }
            }

            setSavedAssignments((prev) => ({
              ...prev,
              [day]: {
                ...prev[day],
                [period.id]: [{ subjectId: 0, teacherId: 0 }],
              },
            }));

            setConflictCells((prev) => ({
              ...prev,
              [day]: {
                ...prev[day],
                [period.id]: [''],
              },
            }));
          }
        }
      }

      const records = [];

      days.forEach((day) => {
        periods.forEach((period) => {
          const cell = assignments?.[day]?.[period.id];
          if (cell && cell.length > 0) {
            const record = {
              periodId: period.id,
              classId: selectedClass,
              day,
            };

            cell.forEach((assignment, index) => {
              const { subjectKey, teacherKey } = getAssignmentKeys(index);

              if (
                assignment[subjectKey] &&
                assignment[teacherKey] &&
                assignment[subjectKey] !== 0 &&
                assignment[teacherKey] !== 0
              ) {
                if (index === 0) {
                  record.subjectId = assignment[subjectKey];
                  record.teacherId = assignment[teacherKey];
                  if (assignment.id) record.id = assignment.id;
                } else {
                  record[subjectKey] = assignment[subjectKey];
                  record[teacherKey] = assignment[teacherKey];
                }
              }
            });

            if (record.subjectId && record.teacherId) {
              records.push(record);
            }
          }
        });
      });

      if (!records.length) {
        swal('Success', 'Timetable cleared successfully!', 'success');
        setSaving(false);
        return;
      }

      for (const record of records) {
        const response = await fetch(`${API_URL}/period-class-teacher-subject`, {
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
      }

      swal('Success', 'Timetable saved successfully!', 'success');

      const refreshResponse = await fetch(
        `${API_URL}/period-class-teacher-subject/class/${selectedClass}`,
        { headers: getAuthHeaders() }
      );
      const refreshData = await refreshResponse.json();
      const rows = Array.isArray(refreshData) ? refreshData : [];

      const newAssignments = {};
      const newConflict = {};

      days.forEach((day) => {
        newAssignments[day] = {};
        newConflict[day] = {};
        periods.forEach((period) => {
          newAssignments[day][period.id] = [];
          newConflict[day][period.id] = [];
        });
      });

      rows.forEach((record) => {
        const {
          day,
          periodId,
          subjectId,
          teacherId,
          id,
          subjectId_2,
          teacherId_2,
          subjectId_3,
          teacherId_3,
          subjectId_4,
          teacherId_4,
          subjectId_5,
          teacherId_5,
        } = record;

        if (newAssignments[day] && newAssignments[day][periodId] !== undefined) {
          const cellAssignments = [];
          cellAssignments.push({ subjectId, teacherId, id });

          if (subjectId_2 || teacherId_2) cellAssignments.push({ subjectId_2, teacherId_2 });
          if (subjectId_3 || teacherId_3) cellAssignments.push({ subjectId_3, teacherId_3 });
          if (subjectId_4 || teacherId_4) cellAssignments.push({ subjectId_4, teacherId_4 });
          if (subjectId_5 || teacherId_5) cellAssignments.push({ subjectId_5, teacherId_5 });

          newAssignments[day][periodId] = cellAssignments;
          newConflict[day][periodId] = cellAssignments.map(() => 'saved');
        }
      });

      days.forEach((day) => {
        periods.forEach((period) => {
          if (!newAssignments[day][period.id] || newAssignments[day][period.id].length === 0) {
            newAssignments[day][period.id] = [{ subjectId: 0, teacherId: 0 }];
            newConflict[day][period.id] = [''];
          }
        });
      });

      setAssignments(newAssignments);
      setSavedAssignments(JSON.parse(JSON.stringify(newAssignments)));
      setConflictCells(newConflict);
    } catch (error) {
      console.error('Error saving timetable:', error);
      swal('Error', 'Something went wrong while saving timetable.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintPdf = async () => {
    if (!selectedClass) {
      swal('Select Class', 'Please select a class first.', 'warning');
      return;
    }

    try {
      setPrinting(true);

      const response = await fetch(
        `${API_URL}/period-class-teacher-subject/class/${selectedClass}/pdf`,
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
          // ignore json parse errors
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
      console.error('Error printing class timetable PDF:', error);
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
          if (cell && cell.length > 0) {
            cell.forEach((a, index) => {
              const { subjectKey, teacherKey } = getAssignmentKeys(index);
              if (
                a[subjectKey] &&
                a[teacherKey] &&
                a[subjectKey] !== 0 &&
                a[teacherKey] !== 0
              ) {
                count++;
                weekly++;
              }
            });

            if ((conflictCells?.[day]?.[period.id] || []).some((status) => status === 'pending')) {
              pending++;
            }
          }
        });
      }

      daily[day] = count;
    });

    return { dailyWorkload: daily, weeklyWorkload: weekly, pendingCount: pending };
  }, [assignments, periods, conflictCells]);

  const selectedClassName =
    classes.find((cls) => String(cls.id) === String(selectedClass))?.class_name || 'Select Class';

  const getCellStatusStyle = (statuses = []) => {
    if (statuses.length > 0 && statuses.every((status) => status === 'saved')) {
      return { background: '#ecfdf3', borderColor: '#86efac' };
    }
    if (statuses.some((status) => status === 'pending')) {
      return { background: '#fffbeb', borderColor: '#fcd34d' };
    }
    return { background: '#ffffff', borderColor: '#e2e8f0' };
  };

  return (
    <div className="container-fluid px-2 px-md-3 py-3 class-timetable-page">
      <style>{`
        .class-timetable-page .top-card {
          border-radius: 16px;
          overflow: hidden;
        }

        .class-timetable-page .summary-chip {
          min-height: 70px;
          border-radius: 14px;
        }

        .class-timetable-page .timetable-table thead th {
          position: sticky;
          top: 0;
          z-index: 3;
          background: #f8fafc;
        }

        .class-timetable-page .day-sticky {
          position: sticky;
          left: 0;
          z-index: 2;
          background: #fff;
        }

        .class-timetable-page .day-sticky.header-sticky {
          z-index: 4;
          background: #f8fafc;
        }

        .class-timetable-page .workload-sticky {
          position: sticky;
          right: 0;
          z-index: 2;
          background: #fff;
        }

        .class-timetable-page .workload-sticky.header-sticky {
          z-index: 4;
          background: #f8fafc;
        }

        .class-timetable-page .period-header {
          line-height: 1.1;
        }

        .class-timetable-page .cell-box {
          min-height: 74px;
          border-radius: 14px;
          padding: 7px;
          position: relative;
          transition: all 0.2s ease;
        }

        .class-timetable-page .assignment-box {
          position: relative;
          border: 1px solid #dbe3ee;
          border-radius: 10px;
          padding: 6px;
          background: rgba(255,255,255,0.7);
        }

        .class-timetable-page .compact-select {
          min-height: 32px;
          font-size: 0.82rem;
          border-radius: 8px;
          padding-top: 4px;
          padding-bottom: 4px;
        }

        .class-timetable-page .mini-badge {
          font-size: 0.78rem;
          padding: 7px 10px;
          border-radius: 999px;
        }

        .class-timetable-page .icon-btn {
          position: absolute;
          z-index: 2;
        }

        .class-timetable-page .remove-btn {
          top: 5px;
          right: 5px;
          background: #fee2e2;
          color: #b91c1c;
        }

        .class-timetable-page .clear-btn {
          top: 6px;
          right: 6px;
          background: #fee2e2;
          color: #b91c1c;
        }

        .class-timetable-page .add-btn {
          bottom: 6px;
          right: 6px;
          background: #dbeafe;
          color: #1d4ed8;
        }

        @media (max-width: 1400px) {
          .class-timetable-page .period-col {
            min-width: 175px !important;
          }

          .class-timetable-page .day-col {
            min-width: 96px !important;
          }

          .class-timetable-page .workload-col {
            min-width: 72px !important;
          }
        }

        @media (max-width: 992px) {
          .class-timetable-page .period-col {
            min-width: 165px !important;
          }

          .class-timetable-page .cell-box {
            min-height: 68px;
            padding: 6px;
          }

          .class-timetable-page .compact-select {
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
              <h4 className="mb-1 fw-bold text-dark">Timetable Assignment</h4>
              <div className="small text-muted">
                Compact class-wise timetable view for smaller screens.
              </div>
            </div>

            <div className="d-flex flex-column flex-sm-row gap-2 align-items-stretch">
              <div className="bg-white border rounded-3 px-3 py-2 shadow-sm">
                <div className="small text-muted">Class</div>
                <div className="fw-semibold text-dark">{selectedClassName}</div>
              </div>

              <button
                className="btn btn-outline-dark fw-semibold px-4"
                onClick={handlePrintPdf}
                disabled={printing || !selectedClass}
                style={{ borderRadius: '10px', minWidth: '140px' }}
              >
                {printing ? 'Opening PDF...' : 'Print PDF'}
              </button>

              <button
                className="btn btn-primary fw-semibold px-4"
                onClick={handleSave}
                disabled={saving || !selectedClass}
                style={{ borderRadius: '10px', minWidth: '150px' }}
              >
                {saving ? 'Saving...' : 'Save Timetable'}
              </button>
            </div>
          </div>

          <div className="row g-2 mt-2 align-items-stretch">
            <div className="col-lg-4">
              <div className="bg-white border rounded-4 p-2 h-100 shadow-sm">
                <label htmlFor="classSelect" className="form-label fw-semibold text-dark small mb-1">
                  Select Class
                </label>
                <select
                  id="classSelect"
                  className="form-select"
                  value={selectedClass || ''}
                  onChange={(e) => setSelectedClass(parseInt(e.target.value, 10))}
                  style={{ borderRadius: '10px', minHeight: '40px' }}
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.class_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="col-4 col-lg-2">
              <div className="bg-white border shadow-sm p-2 summary-chip text-center d-flex flex-column justify-content-center">
                <div className="small text-muted">Weekly</div>
                <div className="fs-5 fw-bold text-primary">{weeklyWorkload}</div>
              </div>
            </div>

            <div className="col-4 col-lg-2">
              <div className="bg-white border shadow-sm p-2 summary-chip text-center d-flex flex-column justify-content-center">
                <div className="small text-muted">Pending</div>
                <div className="fs-5 fw-bold text-warning">{pendingCount}</div>
              </div>
            </div>

            <div className="col-4 col-lg-2">
              <div className="bg-white border shadow-sm p-2 summary-chip text-center d-flex flex-column justify-content-center">
                <div className="small text-muted">Days</div>
                <div className="fs-5 fw-bold text-dark">{days.length}</div>
              </div>
            </div>

            <div className="col-lg-2">
              <div className="bg-white border rounded-4 p-2 h-100 shadow-sm d-flex flex-column justify-content-center">
                <div className="d-flex align-items-center gap-2 small mb-1">
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
                <div className="d-flex align-items-center gap-2 small">
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
                      style={{ minWidth: '185px' }}
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
                      const cell = assignments?.[day]?.[period.id] || [{ subjectId: 0, teacherId: 0 }];
                      const cellStatuses = conflictCells?.[day]?.[period.id] || [];
                      const cellStyle = getCellStatusStyle(cellStatuses);

                      const hasFilledAssignments = cell.some((assignment, index) => {
                        const { subjectKey, teacherKey } = getAssignmentKeys(index);
                        return assignment[subjectKey] && assignment[teacherKey];
                      });

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
                            {hasFilledAssignments && (
                              <button
                                type="button"
                                className="icon-btn clear-btn"
                                style={buttonStyle}
                                title="Clear cell"
                                onClick={() => handleClearCell(day, period.id)}
                              >
                                ×
                              </button>
                            )}

                            <div className="d-grid gap-1" style={{ paddingRight: '18px', paddingBottom: '18px' }}>
                              {cell.map((assignment, index) => {
                                const { subjectKey, teacherKey } = getAssignmentKeys(index);

                                return (
                                  <div key={index} className="assignment-box">
                                    {cell.length > 1 && (
                                      <button
                                        type="button"
                                        className="icon-btn remove-btn"
                                        style={buttonStyle}
                                        title="Remove"
                                        onClick={() => handleRemoveAssignment(day, period.id, index)}
                                      >
                                        ×
                                      </button>
                                    )}

                                    <div className="d-grid gap-1 pe-3">
                                      <select
                                        className="form-select form-select-sm compact-select"
                                        value={assignment[subjectKey] || 0}
                                        onChange={(e) =>
                                          handleCellAssignmentChange(
                                            day,
                                            period.id,
                                            index,
                                            'subjectId',
                                            parseInt(e.target.value, 10)
                                          )
                                        }
                                      >
                                        <option value={0}>Select Subject</option>
                                        {getAvailableSubjects().map((subject) => (
                                          <option key={subject.id} value={subject.id}>
                                            {subject.name}
                                          </option>
                                        ))}
                                      </select>

                                      <select
                                        className="form-select form-select-sm compact-select"
                                        value={assignment[teacherKey] || 0}
                                        onChange={(e) =>
                                          handleCellAssignmentChange(
                                            day,
                                            period.id,
                                            index,
                                            'teacherId',
                                            parseInt(e.target.value, 10)
                                          )
                                        }
                                        disabled={!assignment[subjectKey] || assignment[subjectKey] === 0}
                                      >
                                        <option value={0}>Select Teacher</option>
                                        {getAvailableTeachers(assignment[subjectKey]).map((teacher) => (
                                          <option key={teacher.id} value={teacher.id}>
                                            {teacher.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {cell.length < 5 && (
                              <button
                                type="button"
                                className="icon-btn add-btn"
                                style={buttonStyle}
                                title="Add assignment"
                                onClick={() => handleAddAssignment(day, period.id)}
                              >
                                +
                              </button>
                            )}
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

export default TimetableAssignment;