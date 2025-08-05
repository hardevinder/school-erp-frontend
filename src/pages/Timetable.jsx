import React, { useState, useEffect, useMemo } from 'react';
import swal from 'sweetalert';

const API_URL = process.env.REACT_APP_API_URL;

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Shared button style for plus and cross
const buttonStyle = {
  width: '14px',
  height: '14px',
  borderRadius: '50%',
  fontSize: '10px',
  padding: '0',
  cursor: 'pointer',
  border: 'none',
  color: 'black' // dark foreground color without transparency
};

const TimetableAssignment = () => {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [associations, setAssociations] = useState([]);
  const [hovered, setHovered] = useState({ day: null, period: null });
  const [selectedCell, setSelectedCell] = useState({ day: null, periodId: null });

  // assignments holds an array for each cell. Each element is an assignment object.
  const [assignments, setAssignments] = useState(() => {
    const init = {};
    days.forEach(day => { init[day] = {}; });
    return init;
  });
  // savedAssignments holds the fetched assignments.
  const [savedAssignments, setSavedAssignments] = useState(() => {
    const init = {};
    days.forEach(day => { init[day] = {}; });
    return init;
  });
  // conflictCells holds status for each assignment in a cell.
  const [conflictCells, setConflictCells] = useState(() => {
    const init = {};
    days.forEach(day => { init[day] = {}; });
    return init;
  });

  // New state for bulk options.
  const [bulkEffectFrom, setBulkEffectFrom] = useState('');
  const [bulkPublished, setBulkPublished] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  // Utility: Returns the keys for the assignment based on its index.
  const getAssignmentKeys = (index) => {
    if (index === 0) {
      return { subjectKey: 'subjectId', teacherKey: 'teacherId' };
    }
    return { subjectKey: `subjectId_${index + 1}`, teacherKey: `teacherId_${index + 1}` };
  };

  // Fetch classes.
  useEffect(() => {
    fetch(`${API_URL}/classes`, { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(data => {
        setClasses(data || []);
        if (data && data.length) setSelectedClass(data[0].id);
      })
      .catch(error => console.error('Error fetching classes:', error));
  }, []);

  // Fetch periods and initialize assignments and conflictCells.
  useEffect(() => {
    fetch(`${API_URL}/periods`, { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(data => {
        setPeriods(data || []);
        const newAssignments = {};
        const newConflict = {};
        days.forEach(day => {
          newAssignments[day] = {};
          newConflict[day] = {};
          (data || []).forEach(period => {
            newAssignments[day][period.id] = [{ subjectId: 0, teacherId: 0 }];
            newConflict[day][period.id] = [""];
          });
        });
        setAssignments(newAssignments);
        setConflictCells(newConflict);
      })
      .catch(error => console.error('Error fetching periods:', error));
  }, []);

  // Fetch associations.
  useEffect(() => {
    fetch(`${API_URL}/class-subject-teachers`, { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(data => setAssociations(data || []))
      .catch(error => console.error('Error fetching associations:', error));
  }, []);

  // Fetch existing timetable assignments for the selected class.
  useEffect(() => {
    if (selectedClass && periods.length > 0) {
      fetch(`${API_URL}/period-class-teacher-subject/class/${selectedClass}`, { headers: getAuthHeaders() })
        .then(res => res.json())
        .then(data => {
          const newAssignments = {};
          const newConflict = {};
          days.forEach(day => {
            newAssignments[day] = {};
            newConflict[day] = {};
            periods.forEach(period => {
              newAssignments[day][period.id] = [];
              newConflict[day][period.id] = [];
            });
          });
          data.forEach(record => {
            const { day, periodId, subjectId, teacherId, id,
              subjectId_2, teacherId_2, subjectId_3, teacherId_3,
              subjectId_4, teacherId_4, subjectId_5, teacherId_5 } = record;
            if (newAssignments[day] && newAssignments[day][periodId] !== undefined) {
              const cellAssignments = [];
              cellAssignments.push({ subjectId, teacherId, id });
              if (subjectId_2 || teacherId_2) {
                cellAssignments.push({ ['subjectId_2']: subjectId_2, ['teacherId_2']: teacherId_2 });
              }
              if (subjectId_3 || teacherId_3) {
                cellAssignments.push({ ['subjectId_3']: subjectId_3, ['teacherId_3']: teacherId_3 });
              }
              if (subjectId_4 || teacherId_4) {
                cellAssignments.push({ ['subjectId_4']: subjectId_4, ['teacherId_4']: teacherId_4 });
              }
              if (subjectId_5 || teacherId_5) {
                cellAssignments.push({ ['subjectId_5']: subjectId_5, ['teacherId_5']: teacherId_5 });
              }
              newAssignments[day][periodId] = cellAssignments;
              newConflict[day][periodId] = cellAssignments.map(() => "saved");
            }
          });
          // Ensure every cell has at least one empty assignment.
          days.forEach(day => {
            periods.forEach(period => {
              if (!newAssignments[day][period.id] || newAssignments[day][period.id].length === 0) {
                newAssignments[day][period.id] = [{ subjectId: 0, teacherId: 0 }];
                newConflict[day][period.id] = [""];
              }
            });
          });
          setAssignments(newAssignments);
          setSavedAssignments(newAssignments);
          setConflictCells(newConflict);
        })
        .catch(error => console.error('Error fetching timetable for class:', error));
    }
  }, [selectedClass, periods]);

  // Derive available subjects for the selected class.
  const getAvailableSubjects = () => {
    const filtered = associations.filter(assoc => assoc.class_id === selectedClass);
    const uniqueMap = new Map();
    filtered.forEach(assoc => {
      if (assoc.Subject) uniqueMap.set(assoc.Subject.id, assoc.Subject);
    });
    return Array.from(uniqueMap.values());
  };

  // Derive available teachers based on subject.
  const getAvailableTeachers = (subjectId) => {
    const filtered = associations.filter(
      assoc => assoc.class_id === selectedClass &&
        assoc.subject_id === subjectId &&
        assoc.Teacher
    );
    const uniqueMap = new Map();
    filtered.forEach(assoc => uniqueMap.set(assoc.Teacher.id, assoc.Teacher));
    return Array.from(uniqueMap.values());
  };

  // Change handler that updates an assignment field.
  const handleCellAssignmentChange = (day, periodId, index, fieldBase, value) => {
    const cell = assignments[day][periodId] || [];
    const { subjectKey, teacherKey } = getAssignmentKeys(index);
    const key = fieldBase === 'subjectId' ? subjectKey : teacherKey;
    const currentAssignment = cell[index] || { [subjectKey]: 0, [teacherKey]: 0 };
    const updatedAssignment = { ...currentAssignment, [key]: value };
    const newCell = [...cell];
    newCell[index] = updatedAssignment;
    setAssignments(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [periodId]: newCell
      }
    }));

    const savedCell = (savedAssignments[day] && savedAssignments[day][periodId]) || [];
    const savedAssignment = savedCell[index] || { [subjectKey]: 0, [teacherKey]: 0 };
    const status = (updatedAssignment[subjectKey] === 0)
      ? ""
      : (updatedAssignment[subjectKey] === savedAssignment[subjectKey] &&
         updatedAssignment[teacherKey] === savedAssignment[teacherKey] ? "saved" : "pending");
    const cellConflicts = conflictCells[day][periodId] ? [...conflictCells[day][periodId]] : [];
    cellConflicts[index] = status;
    setConflictCells(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [periodId]: cellConflicts
      }
    }));

    if (day === 'Monday' && updatedAssignment[subjectKey] && updatedAssignment[teacherKey]) {
      setTimeout(() => {
        swal({
          title: "Fill for the whole week?",
          text: "Do you want to apply this assignment to every day of the week for this period?",
          icon: "info",
          buttons: ["No", "Yes"],
        }).then((willFill) => {
          if (willFill) {
            setAssignments(prev => {
              const newAssignments = { ...prev };
              days.forEach(d => {
                newAssignments[d] = {
                  ...newAssignments[d],
                  [periodId]: newAssignments[d][periodId].map(() => ({ ...updatedAssignment }))
                };
              });
              return newAssignments;
            });
            setConflictCells(prev => {
              const newConflicts = { ...prev };
              days.forEach(d => {
                newConflicts[d] = {
                  ...newConflicts[d],
                  [periodId]: newConflicts[d][periodId].map(() => "pending")
                };
              });
              return newConflicts;
            });
          }
        });
      }, 100);
    }
  };

  // Add a new empty assignment to a cell.
  const handleAddAssignment = (day, periodId) => {
    const cell = assignments[day][periodId] || [];
    if (cell.length >= 5) {
      return swal("Limit reached", "You can add up to 5 assignments per cell.", "warning");
    }
    const newIndex = cell.length;
    const { subjectKey, teacherKey } = getAssignmentKeys(newIndex);
    const newAssignment = { [subjectKey]: 0, [teacherKey]: 0 };
    const newCell = [...cell, newAssignment];
    setAssignments(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [periodId]: newCell
      }
    }));
    const cellConflicts = conflictCells[day][periodId] ? [...conflictCells[day][periodId]] : [];
    cellConflicts.push("");
    setConflictCells(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [periodId]: cellConflicts
      }
    }));
  };

  // Remove an assignment from a cell.
  const handleRemoveAssignment = (day, periodId, index) => {
    const cell = assignments[day][periodId] || [];
    if (cell.length <= 1) {
      const { subjectKey, teacherKey } = getAssignmentKeys(index);
      const newAssignment = { [subjectKey]: 0, [teacherKey]: 0 };
      setAssignments(prev => ({
        ...prev,
        [day]: {
          ...prev[day],
          [periodId]: [newAssignment]
        }
      }));
      setConflictCells(prev => ({
        ...prev,
        [day]: {
          ...prev[day],
          [periodId]: [""]
        }
      }));
    } else {
      const newCell = cell.filter((_, i) => i !== index);
      setAssignments(prev => ({
        ...prev,
        [day]: {
          ...prev[day],
          [periodId]: newCell
        }
      }));
      const cellConflicts = conflictCells[day][periodId] ? [...conflictCells[day][periodId]] : [];
      cellConflicts.splice(index, 1);
      setConflictCells(prev => ({
        ...prev,
        [day]: {
          ...prev[day],
          [periodId]: cellConflicts
        }
      }));
    }
  };

  // Handle clearing an entire cell.
  const handleClearCell = (day, periodId) => {
    if (day === 'Monday') {
      swal({
        title: "Clear full week?",
        text: "Do you want to clear the timetable for this period for the entire week?",
        icon: "warning",
        buttons: ["No", "Yes"],
      }).then((clearFullWeek) => {
        if (clearFullWeek) {
          setAssignments(prev => {
            const newAssignments = { ...prev };
            days.forEach(d => {
              newAssignments[d] = {
                ...newAssignments[d],
                [periodId]: [{ subjectId: 0, teacherId: 0 }]
              };
            });
            return newAssignments;
          });
          setConflictCells(prev => {
            const newConflicts = { ...prev };
            days.forEach(d => {
              newConflicts[d] = {
                ...newConflicts[d],
                [periodId]: [""]
              };
            });
            return newConflicts;
          });
        } else {
          setAssignments(prev => ({
            ...prev,
            [day]: {
              ...prev[day],
              [periodId]: [{ subjectId: 0, teacherId: 0 }]
            }
          }));
          setConflictCells(prev => ({
            ...prev,
            [day]: { ...prev[day], [periodId]: [""] }
          }));
        }
      });
    } else {
      setAssignments(prev => ({
        ...prev,
        [day]: {
          ...prev[day],
          [periodId]: [{ subjectId: 0, teacherId: 0 }]
        }
      }));
      setConflictCells(prev => ({
        ...prev,
        [day]: { ...prev[day], [periodId]: [""] }
      }));
    }
  };

  // Save assignments.
  const handleSave = async () => {
    // Process deletions: if a saved record exists and current cell is entirely blank.
    for (let day of days) {
      for (let period of periods) {
        const savedCell = savedAssignments[day][period.id];
        const currentCell = assignments[day][period.id];
        if (
          savedCell &&
          savedCell.length > 0 &&
          currentCell &&
          currentCell.every(a => {
            const keys = Object.keys(a).filter(key => key !== 'id' && key !== 'combinationId');
            return keys.every(key => a[key] === 0);
          })
        ) {
          for (const record of savedCell) {
            if (record.id) {
              let response = await fetch(`${API_URL}/period-class-teacher-subject/${record.id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
              });
              if (!response.ok) {
                swal("Error", "Failed to delete assignment.", "error");
                return;
              }
            }
          }
          setSavedAssignments(prev => ({
            ...prev,
            [day]: { ...prev[day], [period.id]: [{ subjectId: 0, teacherId: 0 }] }
          }));
          setConflictCells(prev => ({
            ...prev,
            [day]: { ...prev[day], [period.id]: [""] }
          }));
        }
      }
    }
    
    let records = [];
    days.forEach(day => {
      periods.forEach(period => {
        const cell = assignments[day][period.id];
        if (cell && cell.length > 0) {
          const record = {
            periodId: period.id,
            classId: selectedClass,
            day,
            effectFrom: bulkEffectFrom,
            published: bulkPublished
          };
          cell.forEach((assignment, index) => {
            const { subjectKey, teacherKey } = getAssignmentKeys(index);
            if (assignment[subjectKey] && assignment[teacherKey] && assignment[subjectKey] !== 0 && assignment[teacherKey] !== 0) {
              if (index === 0) {
                record.subjectId = assignment[subjectKey];
                record.teacherId = assignment[teacherKey];
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
      return swal("Success", "Timetable cleared successfully!", "success");
    }
    let conflictResolved = true;
    for (let record of records) {
      let response = await fetch(`${API_URL}/period-class-teacher-subject`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(record),
      });
      if (response.ok) {
        setSavedAssignments(prev => ({
          ...prev,
          [record.day]: {
            ...prev[record.day],
            [record.periodId]: [{ subjectId: record.subjectId, teacherId: record.teacherId, id: record.id || null }]
          }
        }));
        setConflictCells(prev => ({
          ...prev,
          [record.day]: { ...prev[record.day], [record.periodId]: ["saved"] }
        }));
      } else {
        const errorData = await response.json();
        swal("Error", errorData.error || errorData.warning || "An error occurred while saving.", "error");
        conflictResolved = false;
        break;
      }
    }
    
    if (conflictResolved) {
      swal("Success", "Timetable saved successfully!", "success");
    }
  };

  // Compute daily and weekly workload.
  const { dailyWorkload, weeklyWorkload } = useMemo(() => {
    const daily = {};
    let weekly = 0;
    days.forEach(day => {
      let count = 0;
      if (assignments[day]) {
        periods.forEach(period => {
          const cell = assignments[day][period.id];
          if (cell && cell.length > 0) {
            cell.forEach(a => {
              const { subjectKey, teacherKey } = getAssignmentKeys(0);
              if (a[subjectKey] && a[teacherKey] && a[subjectKey] !== 0 && a[teacherKey] !== 0) {
                count++;
              }
            });
          }
        });
      }
      daily[day] = count;
      weekly += count;
    });
    return { dailyWorkload: daily, weeklyWorkload: weekly };
  }, [assignments, periods]);

  return (
    <div className="container mt-4">
      <h2>Timetable Assignment</h2>
      
      <div className="row mb-3">
        <div className="col-md-4">
          <label htmlFor="classSelect" className="form-label">
            <small>Select Class</small>
          </label>
          <select
            id="classSelect"
            className="form-select"
            value={selectedClass || ''}
            onChange={e => setSelectedClass(parseInt(e.target.value))}
          >
            {classes?.map(cls => (
              <option key={cls.id} value={cls.id}>
                {cls.class_name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <label htmlFor="bulkEffectFrom" className="form-label">
            <small>W.E.F.</small>
          </label>
          <input 
            type="date"
            id="bulkEffectFrom"
            className="form-control"
            value={bulkEffectFrom}
            onChange={(e) => setBulkEffectFrom(e.target.value)}
          />
        </div>
        <div className="col-md-4 d-flex flex-column align-items-center">
          <label className="form-label">
            <small>Publish</small>
          </label>
          <button 
            className={`btn w-100 ${bulkPublished ? "btn-success" : "btn-danger"}`}
            onClick={() => setBulkPublished(!bulkPublished)}
            style={{ fontSize: '1.1rem', padding: '0.6rem' }}
          >
            {bulkPublished ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>

      <table className="table table-bordered">
        <thead>
          <tr>
            <th>Day</th>
            {periods.map(period => (
              <th key={period.id}>{period.period_name}</th>
            ))}
         
          </tr>
        </thead>
        <tbody>
          {days.map(day => (
            <tr key={day}>
              <td
                onMouseEnter={() => setHovered({ day, period: null })}
                onMouseLeave={() => setHovered({ day: null, period: null })}
                className={hovered.day === day ? 'highlight' : ''}
              >
                <strong>{day}</strong>
              </td>
              {periods.map(period => {
                const cell = assignments[day][period.id] || [{ subjectId: 0, teacherId: 0 }];
                // Compute the conflict status for this cell.
                const cellStatus = conflictCells[day][period.id] || [];
                let cellStyle = { position: 'relative' };
                // If every assignment is saved, mark green.
                if (cellStatus.length > 0 && cellStatus.every(status => status === "saved")) {
                  cellStyle.backgroundColor = 'green';
                }
                // Otherwise, if any assignment is pending (filled but not saved), mark yellow.
                else if (cellStatus.some(status => status === "pending")) {
                  cellStyle.backgroundColor = 'yellow';
                }
                // Also, if the cell is selected and not all saved, override to yellow.
                if (selectedCell.day === day && selectedCell.periodId === period.id && !cellStatus.every(status => status === "saved")) {
                  cellStyle.backgroundColor = 'yellow';
                }
                return (
                  <td
                    key={period.id}
                    onClick={() => setSelectedCell({ day, periodId: period.id })}
                    onMouseEnter={() => setHovered({ day, period: period.id })}
                    onMouseLeave={() => setHovered({ day: null, period: null })}
                    style={cellStyle}
                    className={hovered.day === day || hovered.period === period.id ? 'highlight' : ''}
                  >
                    {cell.map((assignment, index) => {
                      const { subjectKey, teacherKey } = getAssignmentKeys(index);
                      return (
                        <div key={index} className="mb-2" style={{ border: "1px solid #ddd", padding: "5px", marginBottom: "5px", position: "relative" }}>
                          <button
                            style={{
                              ...buttonStyle,
                              position: 'absolute',
                              top: '2px',
                              right: '2px',
                              backgroundColor: 'rgba(255, 0, 0, 0.2)'
                            }}
                            onClick={() => handleRemoveAssignment(day, period.id, index)}
                          >
                            X
                          </button>
                          <select
                            className="form-select mb-1"
                            value={assignment[subjectKey] || 0}
                            onChange={e =>
                              handleCellAssignmentChange(day, period.id, index, 'subjectId', parseInt(e.target.value))
                            }
                          >
                            <option value={0}>Select Subject</option>
                            {getAvailableSubjects().map(subject => (
                              <option key={subject.id} value={subject.id}>
                                {subject.name}
                              </option>
                            ))}
                          </select>
                          <select
                            className="form-select"
                            value={assignment[teacherKey] || 0}
                            onChange={e =>
                              handleCellAssignmentChange(day, period.id, index, 'teacherId', parseInt(e.target.value))
                            }
                            disabled={!assignment[subjectKey] || assignment[subjectKey] === 0}
                          >
                            <option value={0}>Select Teacher</option>
                            {getAvailableTeachers(assignment[subjectKey]).map(teacher => (
                              <option key={teacher.id} value={teacher.id}>
                                {teacher.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                    <button 
                      className="btn btn-sm btn-primary"
                      onClick={() => handleAddAssignment(day, period.id)}
                      style={{
                        ...buttonStyle,
                        position: 'absolute',
                        bottom: '2px',
                        right: '2px',
                        backgroundColor: 'rgba(0, 123, 255, 0.2)'
                      }}
                    >
                      +
                    </button>
                  </td>
                );
              })}
             
            </tr>
          ))}
        </tbody>
       
      </table>

      <button className="btn btn-primary" onClick={handleSave}>
        Save Timetable
      </button>
    </div>
  );
};

export default TimetableAssignment;
