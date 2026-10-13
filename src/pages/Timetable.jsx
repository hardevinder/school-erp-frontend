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
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
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
    fetch(`${API_URL}/sections`, { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((data) => setSections(Array.isArray(data) ? data : []))
      .catch((error) => console.error('Error fetching sections:', error));
  }, []);

  const classSections = useMemo(
    () => sections,
    [sections]
  );

  useEffect(() => {
    const stillValid = classSections.some(
      (section) => String(section.id) === String(selectedSection)
    );
    if (!stillValid) {
      const sectionA =
        classSections.find(
          (section) => String(section.section_name || '').trim().toUpperCase() === 'A'
        ) || classSections[0];
      setSelectedSection(sectionA?.id || null);
    }
  }, [classSections, selectedSection]);

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
    if (!selectedClass || !selectedSection || periods.length === 0) return;

    fetch(`${API_URL}/period-class-teacher-subject/class/${selectedClass}?sectionId=${selectedSection}`, {
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
  }, [selectedClass, selectedSection, periods]);

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

  const getTeacherName = (teacherId) =>
    associations.find(
      (assoc) => assoc.Teacher && String(assoc.Teacher.id) === String(teacherId)
    )?.Teacher?.name || `Teacher #${teacherId}`;

  const getPlannedTeacherSlots = () => {
    const slots = [];

    days.forEach((day) => {
      periods.forEach((period) => {
        const cell = assignments?.[day]?.[period.id] || [];
        cell.forEach((assignment, index) => {
          const { subjectKey, teacherKey } = getAssignmentKeys(index);
          const teacherId = Number(assignment?.[teacherKey] || 0);
          const subjectId = Number(assignment?.[subjectKey] || 0);
          if (teacherId && subjectId) {
            slots.push({
              day,
              periodId: Number(period.id),
              periodName: period.period_name,
              teacherId,
              subjectId,
            });
          }
        });
      });
    });

    return slots;
  };

  const getExistingTeacherIds = (row) =>
    [row.teacherId, row.teacherId_2, row.teacherId_3, row.teacherId_4, row.teacherId_5]
      .map((id) => Number(id || 0))
      .filter(Boolean);

  const checkTeacherConflictsBeforeSave = async () => {
    try {
      const plannedSlots = getPlannedTeacherSlots();
      if (!plannedSlots.length) return [];

      const response = await fetch(`${API_URL}/period-class-teacher-subject`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        console.warn('Could not pre-check timetable conflicts. Saving will use existing server behaviour.');
        return [];
      }

      const existingRows = await response.json();
      if (!Array.isArray(existingRows)) return [];

      const conflicts = [];
      const seen = new Set();

      plannedSlots.forEach((slot) => {
        existingRows.forEach((row) => {
          const sameSlot =
            String(row.day) === String(slot.day) &&
            Number(row.periodId) === Number(slot.periodId);

          const sameClassSection =
            Number(row.classId) === Number(selectedClass) &&
            Number(row.sectionId || 0) === Number(selectedSection || 0);

          if (!sameSlot || sameClassSection) return;
          if (!getExistingTeacherIds(row).includes(Number(slot.teacherId))) return;

          const className = row.Class?.class_name || `Class ${row.classId}`;
          const sectionLabel = sections.find(
            (section) => Number(section.id) === Number(row.sectionId)
          )?.section_name;
          const sectionName = sectionLabel ? `-${sectionLabel}` : '';
          const label = `${slot.day} • ${slot.periodName}: ${getTeacherName(slot.teacherId)} is already assigned to ${className}${sectionName}`;

          if (!seen.has(label)) {
            seen.add(label);
            conflicts.push(label);
          }
        });
      });

      return conflicts;
    } catch (error) {
      console.warn('Timetable conflict pre-check failed:', error);
      return [];
    }
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
        const overwriteDays = days.slice(1).filter((d) => {
          const otherCell = assignments?.[d]?.[periodId] || [];
          const otherAssignment = otherCell[index];
          if (!otherAssignment) return false;

          const { subjectKey: otherSubjectKey, teacherKey: otherTeacherKey } =
            getAssignmentKeys(index);
          const otherSubject = Number(otherAssignment?.[otherSubjectKey] || 0);
          const otherTeacher = Number(otherAssignment?.[otherTeacherKey] || 0);

          if (!otherSubject && !otherTeacher) return false;

          return (
            otherSubject !== Number(updatedAssignment[subjectKey] || 0) ||
            otherTeacher !== Number(updatedAssignment[teacherKey] || 0)
          );
        });

        const hasOverrides = overwriteDays.length > 0;

        swal({
          title: hasOverrides ? 'Override existing week entries?' : 'Fill for whole week?',
          text: hasOverrides
            ? `This will replace the current assignment on ${overwriteDays.join(', ')} for this period. Continue?`
            : 'Do you want to apply this assignment to every day for this period?',
          icon: hasOverrides ? 'warning' : 'info',
          buttons: hasOverrides ? ['Cancel', 'Override Whole Week'] : ['No', 'Yes'],
          dangerMode: hasOverrides,
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

      const teacherConflicts = await checkTeacherConflictsBeforeSave();
      if (teacherConflicts.length > 0) {
        const preview = teacherConflicts.slice(0, 6).join('\n');
        const more = teacherConflicts.length > 6 ? `\n...and ${teacherConflicts.length - 6} more conflict(s).` : '';

        const allowOverride = await swal({
          title: 'Teacher timetable conflict',
          text: `${preview}${more}\n\nSaving can override the teacher's existing slot. Do you want to continue?`,
          icon: 'warning',
          buttons: ['Cancel', 'Override & Save'],
          dangerMode: true,
        });

        if (!allowOverride) {
          setSaving(false);
          return;
        }
      }

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
              sectionId: selectedSection,
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
        `${API_URL}/period-class-teacher-subject/class/${selectedClass}?sectionId=${selectedSection}`,
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
    if (!selectedClass || !selectedSection) {
      swal('Select Class & Section', 'Please select a class and section first.', 'warning');
      return;
    }

    try {
      setPrinting(true);

      const response = await fetch(
        `${API_URL}/period-class-teacher-subject/class/${selectedClass}/pdf?sectionId=${selectedSection}`,
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
  const selectedSectionName =
    classSections.find((section) => String(section.id) === String(selectedSection))
      ?.section_name || 'Select Section';

  const getCellStatusStyle = (statuses = []) => {
    if (statuses.length > 0 && statuses.every((status) => status === 'saved')) {
      return { background: 'var(--edb-primary-soft, #ecfdf3)', borderColor: 'var(--edb-primary, #86efac)' };
    }
    if (statuses.some((status) => status === 'pending')) {
      return { background: 'var(--edb-accent-soft, #fffbeb)', borderColor: 'var(--edb-accent, #fcd34d)' };
    }
    return { background: 'var(--edb-surface, #ffffff)', borderColor: 'var(--edb-border, #e2e8f0)' };
  };

  return (
    <div className="container-fluid px-2 px-md-3 py-3 class-timetable-page">
      <style>{`
        .class-timetable-page {
          color: var(--edb-text, #1f2937);
        }

        .class-timetable-page .bg-white {
          background-color: var(--edb-surface, #fff) !important;
        }

        .class-timetable-page .text-dark {
          color: var(--edb-text, #1f2937) !important;
        }

        .class-timetable-page .text-muted {
          color: var(--edb-muted, #64748b) !important;
        }

        .class-timetable-page .border {
          border-color: var(--edb-border, #e2e8f0) !important;
        }

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
          background: var(--edb-primary-soft-2, #f8fafc);
        }

        .class-timetable-page .day-sticky {
          position: sticky;
          left: 0;
          z-index: 2;
          background: var(--edb-surface, #fff);
        }

        .class-timetable-page .day-sticky.header-sticky {
          z-index: 4;
          background: var(--edb-primary-soft-2, #f8fafc);
        }

        .class-timetable-page .workload-sticky {
          position: sticky;
          right: 0;
          z-index: 2;
          background: var(--edb-surface, #fff);
        }

        .class-timetable-page .workload-sticky.header-sticky {
          z-index: 4;
          background: var(--edb-primary-soft-2, #f8fafc);
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
          border: 1px solid var(--edb-border, #dbe3ee);
          border-radius: 10px;
          padding: 6px;
          background: var(--edb-surface, rgba(255,255,255,0.7));
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
          background: var(--edb-primary-soft, #dbeafe);
          color: var(--edb-primary, #1d4ed8);
        }

        .class-timetable-page .form-select {
          border-color: var(--edb-border, #dbe3ee);
          background-color: var(--edb-surface, #fff);
          color: var(--edb-text, #1f2937);
        }

        .class-timetable-page .form-select:focus {
          border-color: var(--edb-primary, #2563eb);
          box-shadow: 0 0 0 0.18rem var(--edb-primary-soft, rgba(37,99,235,0.12));
        }

        .class-timetable-page .theme-primary-btn {
          background: var(--edb-primary, #2563eb);
          border-color: var(--edb-primary, #2563eb);
          color: #fff;
        }

        .class-timetable-page .theme-primary-btn:hover,
        .class-timetable-page .theme-primary-btn:focus {
          background: var(--edb-primary-dark, #1d4ed8);
          border-color: var(--edb-primary-dark, #1d4ed8);
          color: #fff;
        }

        .class-timetable-page .theme-outline-btn {
          background: var(--edb-surface, #fff);
          border: 1px solid var(--edb-primary, #2563eb);
          color: var(--edb-primary, #2563eb);
        }

        .class-timetable-page .theme-outline-btn:hover {
          background: var(--edb-primary-soft, #eef2ff);
          color: var(--edb-primary-dark, #1d4ed8);
        }

        .class-timetable-page .workflow-note {
          border: 1px solid var(--edb-border, #e2e8f0);
          background: var(--edb-surface, #fff);
          border-radius: 12px;
          padding: 8px 10px;
          color: var(--edb-muted, #64748b);
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
          style={{ background: 'linear-gradient(135deg, var(--edb-dashboard-bg, #f8fafc) 0%, var(--edb-primary-soft, #eef2ff) 100%)' }}
        >
          <div className="d-flex flex-column flex-xl-row justify-content-between align-items-xl-center gap-3">
            <div>
              <h4 className="mb-1 fw-bold text-dark">Timetable Assignment</h4>
              <div className="small text-muted">
                Compact class and section-wise timetable view for smaller screens.
              </div>
            </div>

            <div className="d-flex flex-column flex-sm-row gap-2 align-items-stretch">
              <div className="bg-white border rounded-3 px-3 py-2 shadow-sm">
                <div className="small text-muted">Class</div>
                <div className="fw-semibold text-dark">
                  {selectedClassName} - {selectedSectionName}
                </div>
              </div>

              <button
                className="btn theme-outline-btn fw-semibold px-4"
                onClick={handlePrintPdf}
                disabled={printing || !selectedClass || !selectedSection}
                style={{ borderRadius: '10px', minWidth: '140px' }}
              >
                {printing ? 'Opening PDF...' : 'Print PDF'}
              </button>

              <button
                className="btn theme-primary-btn fw-semibold px-4"
                onClick={handleSave}
                disabled={saving || !selectedClass || !selectedSection}
                style={{ borderRadius: '10px', minWidth: '150px' }}
              >
                {saving ? 'Saving...' : 'Save Timetable'}
              </button>
            </div>
          </div>

          <div className="row g-2 mt-2 align-items-stretch">
            <div className="col-lg-3">
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

            <div className="col-lg-3">
              <div className="bg-white border rounded-4 p-2 h-100 shadow-sm">
                <label htmlFor="sectionSelect" className="form-label fw-semibold text-dark small mb-1">
                  Select Section
                </label>
                <select
                  id="sectionSelect"
                  className="form-select"
                  value={selectedSection || ''}
                  onChange={(e) => setSelectedSection(parseInt(e.target.value, 10))}
                  disabled={!selectedClass || !classSections.length}
                  style={{ borderRadius: '10px', minHeight: '40px' }}
                >
                  {!classSections.length && <option value="">No sections</option>}
                  {classSections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.section_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="col-4 col-lg-2">
              <div className="bg-white border shadow-sm p-2 summary-chip text-center d-flex flex-column justify-content-center">
                <div className="small text-muted">Weekly</div>
                <div className="fs-5 fw-bold" style={{ color: 'var(--edb-primary, #2563eb)' }}>{weeklyWorkload}</div>
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
                      background: 'var(--edb-primary-soft, #ecfdf3)',
                      border: '1px solid var(--edb-primary, #86efac)',
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
                      background: 'var(--edb-accent-soft, #fffbeb)',
                      border: '1px solid var(--edb-accent, #fcd34d)',
                      display: 'inline-block',
                    }}
                  />
                  <span className="text-muted">Pending</span>
                </div>
              </div>
            </div>
          </div>

          <div className="workflow-note small mt-2 d-flex flex-wrap gap-3 align-items-center">
            <span><strong style={{ color: 'var(--edb-text, #1f2937)' }}>Monday:</strong> completing Subject + Teacher keeps the existing <strong>Fill Whole Week</strong> option.</span>
            <span><strong style={{ color: 'var(--edb-text, #1f2937)' }}>Safety:</strong> existing week entries and teacher-slot conflicts show an override warning before replacement.</span>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm" style={{ borderRadius: '16px', background: 'var(--edb-surface, #fff)' }}>
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
                        background: hovered.day === day ? 'var(--edb-primary-soft-2, #f8fafc)' : 'var(--edb-surface, #fff)',
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
                                ? 'var(--edb-primary-soft-2, #f8fafc)'
                                : 'var(--edb-surface, #fff)',
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
                      <span className="badge mini-badge" style={{ background: 'var(--edb-primary, #2563eb)' }}>{dailyWorkload[day] || 0}</span>
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr>
                  <td
                    colSpan={periods.length + 2}
                    className="text-center fw-bold py-2"
                    style={{ background: 'var(--edb-primary-soft-2, #f8fafc)', fontSize: '0.95rem', color: 'var(--edb-text, #1f2937)' }}
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
