import React, { useState, useEffect, useMemo } from 'react';
import swal from 'sweetalert';

const API_URL = process.env.REACT_APP_API_URL;
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TeacherTimetableAssignment = () => {
  // Helper: return headers including the auth token.
  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  // State for teacher selection (top-level)
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null);

  // State for periods and associations (which include teacher, class, subject)
  const [periods, setPeriods] = useState([]);
  const [associations, setAssociations] = useState([]);

  // assignments holds the current values in each cell.
  // Each cell now holds { classId, subjectId } (and possibly an id if saved).
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
  // conflictCells holds status: "" (no change), "pending", "server", or "saved".
  const [conflictCells, setConflictCells] = useState(() => {
    const init = {};
    days.forEach(day => { init[day] = {}; });
    return init;
  });

  // New state for bulk options: effectFrom and published.
  const [bulkEffectFrom, setBulkEffectFrom] = useState('');
  const [bulkPublished, setBulkPublished] = useState(false);

  // Add hovered state for mouse events.
  const [hovered, setHovered] = useState({ day: null, period: null });

  // Define getAvailableTeachers for teacher timetable.
  // Since teacher is fixed, we simply return the selected teacher.
  const getAvailableTeachers = (subjectId) => {
    return teachers.filter(t => t.id === selectedTeacher);
  };

  // Fetch periods.
  useEffect(() => {
    fetch(`${API_URL}/periods`, {
      headers: getAuthHeaders()
    })
      .then(res => res.json())
      .then(data => {
        setPeriods(data || []);
        const newAssign = {};
        const newConflict = {};
        days.forEach(day => {
          newAssign[day] = {};
          newConflict[day] = {};
          (data || []).forEach(period => {
            newAssign[day][period.id] = { classId: 0, subjectId: 0 };
            newConflict[day][period.id] = "";
          });
        });
        setAssignments(newAssign);
        setConflictCells(newConflict);
      })
      .catch(error => console.error('Error fetching periods:', error));
  }, []);

  // Fetch associations.
  useEffect(() => {
    fetch(`${API_URL}/class-subject-teachers`, {
      headers: getAuthHeaders()
    })
      .then(res => res.json())
      .then(data => {
        const associationsData = Array.isArray(data) ? data : [];
        setAssociations(associationsData);
        const teacherMap = new Map();
        associationsData.forEach(assoc => {
          if (assoc.Teacher) {
            teacherMap.set(assoc.Teacher.id, assoc.Teacher);
          }
        });
        const teacherList = Array.from(teacherMap.values());
        setTeachers(teacherList);
        if (teacherList.length > 0) {
          setSelectedTeacher(teacherList[0].id);
        }
      })
      .catch(error => console.error('Error fetching associations:', error));
  }, []);

  // Fetch saved assignments when selectedTeacher changes and periods are loaded.
  useEffect(() => {
    if (selectedTeacher && periods.length > 0) {
      fetch(`${API_URL}/period-class-teacher-subject/timetable-teacher/${selectedTeacher}`, {
        headers: getAuthHeaders()
      })
        .then(res => res.json())
        .then(data => {
          const newAssign = {};
          days.forEach(day => {
            newAssign[day] = {};
            periods.forEach(period => {
              newAssign[day][period.id] = { classId: 0, subjectId: 0 };
            });
          });
          data.forEach(record => {
            const { day, periodId, classId, subjectId, id } = record;
            if (newAssign[day] && newAssign[day][periodId] !== undefined) {
              newAssign[day][periodId] = { classId, subjectId, id };
            }
          });
          setAssignments(newAssign);
          setSavedAssignments(newAssign);
          const newConflict = {};
          days.forEach(day => {
            newConflict[day] = {};
            periods.forEach(period => {
              newConflict[day][period.id] = "saved";
            });
          });
          setConflictCells(newConflict);
        })
        .catch(error => console.error('Error fetching timetable for teacher:', error));
    }
  }, [selectedTeacher, periods]);

  // Get available classes for the selected teacher.
  const getAvailableClasses = () => {
    if (!Array.isArray(associations)) return [];
    const filtered = associations.filter(assoc => assoc.Teacher && assoc.Teacher.id === selectedTeacher);
    const uniqueMap = new Map();
    filtered.forEach(assoc => {
      if (assoc.Class) uniqueMap.set(assoc.Class.id, assoc.Class);
    });
    return Array.from(uniqueMap.values());
  };

  // Get available subjects given a class.
  const getAvailableSubjects = (classId) => {
    if (!Array.isArray(associations)) return [];
    const filtered = associations.filter(
      assoc =>
        assoc.Teacher && assoc.Teacher.id === selectedTeacher &&
        assoc.Class && assoc.Class.id === classId &&
        assoc.Subject
    );
    const uniqueMap = new Map();
    filtered.forEach(assoc => uniqueMap.set(assoc.Subject.id, assoc.Subject));
    return Array.from(uniqueMap.values());
  };

  // Handle changes in a timetable cell.
  const handleAssignmentChange = (day, periodId, field, value) => {
    const currentCell = (assignments[day] && assignments[day][periodId])
      ? assignments[day][periodId]
      : { classId: 0, subjectId: 0 };
    const newCell = { ...currentCell, [field]: value };
    if (field === 'classId') {
      newCell.subjectId = 0;
    }
    setAssignments(prev => ({
      ...prev,
      [day]: {
        ...(prev[day] || {}),
        [periodId]: newCell
      }
    }));
    const saved = (savedAssignments[day] && savedAssignments[day][periodId]) || { classId: 0, subjectId: 0 };
    const status = (newCell.classId === 0)
      ? ""
      : (newCell.classId === saved.classId && newCell.subjectId === saved.subjectId ? "saved" : "pending");
    setConflictCells(prev => ({
      ...prev,
      [day]: { ...(prev[day] || {}), [periodId]: status }
    }));

    // If change happens on Monday and the cell is filled, prompt for full-week fill.
    if (day === 'Monday' && newCell.classId !== 0 && newCell.subjectId !== 0) {
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
                newAssignments[d] = { ...newAssignments[d], [periodId]: { ...newCell } };
              });
              return newAssignments;
            });
            setConflictCells(prev => {
              const newConflicts = { ...prev };
              days.forEach(d => {
                newConflicts[d] = { ...newConflicts[d], [periodId]: "pending" };
              });
              return newConflicts;
            });
          }
        });
      }, 100);
    }
  };

  // Handle clear of a cell.
  // For Monday, prompt to clear the full week.
  const handleClear = (day, periodId) => {
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
              newAssignments[d] = { ...newAssignments[d], [periodId]: { classId: 0, subjectId: 0 } };
            });
            return newAssignments;
          });
          setConflictCells(prev => {
            const newConflicts = { ...prev };
            days.forEach(d => {
              newConflicts[d] = { ...newConflicts[d], [periodId]: "" };
            });
            return newConflicts;
          });
        } else {
          setAssignments(prev => ({
            ...prev,
            [day]: { 
              ...prev[day], 
              [periodId]: { classId: 0, subjectId: 0 }
            }
          }));
          setConflictCells(prev => ({
            ...prev,
            [day]: { ...prev[day], [periodId]: "" }
          }));
        }
      });
    } else {
      setAssignments(prev => ({
        ...prev,
        [day]: { 
          ...prev[day], 
          [periodId]: { classId: 0, subjectId: 0 }
        }
      }));
      setConflictCells(prev => ({
        ...prev,
        [day]: { ...prev[day], [periodId]: "" }
      }));
    }
  };

  // Handle save: first process deletions, then save/update remaining cells.
  const handleSave = async () => {
    // Process deletions: if a saved record exists but the current cell is entirely blank.
    for (let day of days) {
      for (let period of periods) {
        const saved = savedAssignments[day][period.id];
        const current = assignments[day][period.id];
        if (saved && (saved.classId || saved.subjectId) && current && (current.classId === 0 && current.subjectId === 0)) {
          if (saved.id) {
            console.log("Attempting to delete record with id:", saved.id);
            let response = await fetch(`${API_URL}/period-class-teacher-subject/${saved.id}`, {
              method: 'DELETE',
              headers: getAuthHeaders(),
            });
            if (!response.ok) {
              swal("Error", "Failed to delete assignment.", "error");
              return;
            }
            setSavedAssignments(prev => ({
              ...prev,
              [day]: { ...prev[day], [period.id]: { classId: 0, subjectId: 0 } }
            }));
            setConflictCells(prev => ({
              ...prev,
              [day]: { ...prev[day], [period.id]: "" }
            }));
          }
        }
      }
    }
    
    // Prepare records to save (cells that are not blank).
    let records = [];
    days.forEach(day => {
      periods.forEach(period => {
        const cell = assignments[day][period.id];
        if (cell && cell.classId && cell.subjectId && cell.classId !== 0 && cell.subjectId !== 0) {
          records.push({
            periodId: period.id,
            teacherId: selectedTeacher,
            classId: cell.classId,
            subjectId: cell.subjectId,
            day,
            effectFrom: bulkEffectFrom,  // add bulk effectFrom
            published: bulkPublished,     // add bulk published flag
            ...(cell.id ? { id: cell.id } : {})
          });
        }
      });
    });
    if (!records.length) {
      return swal("Success", "Timetable cleared successfully!", "success");
    }
    let conflictResolved = true;
    for (let record of records) {
      let response = await fetch(`${API_URL}/period-class-teacher-subject/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(record),
      });
      if (response.ok) {
        setSavedAssignments(prev => ({
          ...prev,
          [record.day]: { 
            ...prev[record.day], 
            [record.periodId]: { classId: record.classId, subjectId: record.subjectId, id: record.id || null }
          }
        }));
        setConflictCells(prev => ({
          ...prev,
          [record.day]: { ...prev[record.day], [record.periodId]: "saved" }
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
          if (cell && cell.classId && cell.subjectId && cell.classId !== 0 && cell.subjectId !== 0) {
            count++;
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
      <h2>Teacher Timetable Assignment</h2>
      
      {/* Single Row: Teacher Select, W.E.F. and Publish controls */}
      <div className="row mb-3 align-items-center">
        <div className="col-md-4">
          <label htmlFor="teacherSelect" className="form-label">
            <small>Select Teacher</small>
          </label>
          <select
            id="teacherSelect"
            className="form-select"
            value={selectedTeacher || ''}
            onChange={e => setSelectedTeacher(parseInt(e.target.value))}
          >
            {teachers.map(teacher => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
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

      {/* Timetable Table with Daily Workload and Bottom Row for Weekly Workload */}
      <table className="table table-bordered">
        <thead>
          <tr>
            <th>Day</th>
            {periods.map(period => (
              <th key={period.id}>{period.period_name}</th>
            ))}
            <th>Workload</th>
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
                const cellAssignment = assignments[day][period.id];
                const availableTeachers = cellAssignment?.subjectId ? getAvailableTeachers(cellAssignment.subjectId) : [];
                let cellStyle = {};
                if (conflictCells[day] && conflictCells[day][period.id] === "saved") {
                  cellStyle = { backgroundColor: 'green' };
                } else if (conflictCells[day] && conflictCells[day][period.id] === "pending") {
                  cellStyle = { backgroundColor: 'yellow' };
                } else if (conflictCells[day] && conflictCells[day][period.id] === "server") {
                  cellStyle = { backgroundColor: 'red' };
                }
                if (cellAssignment?.subjectId === 0) {
                  cellStyle = {};
                }
                return (
                  <td
                    key={period.id}
                    onMouseEnter={() => setHovered({ day, period: period.id })}
                    onMouseLeave={() => setHovered({ day: null, period: null })}
                    style={{ position: 'relative', ...cellStyle }}
                    className={hovered.day === day || hovered.period === period.id ? 'highlight' : ''}
                  >
                    {cellAssignment?.subjectId !== 0 && (
                      <button
                        style={{
                          position: 'absolute',
                          top: '2px',
                          right: '2px',
                          backgroundColor: 'red',
                          color: 'white',
                          border: 'none',
                          padding: '0',
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                        onClick={() => handleClear(day, period.id)}
                      >
                        X
                      </button>
                    )}
                    <div className="mb-2">
                      <select
                        className="form-select"
                        value={cellAssignment?.classId || 0}
                        onChange={e =>
                          handleAssignmentChange(day, period.id, 'classId', parseInt(e.target.value))
                        }
                      >
                        <option value={0}>Select Class</option>
                        {getAvailableClasses().map(cls => (
                          <option key={cls.id} value={cls.id}>
                            {cls.class_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <select
                        className="form-select"
                        value={cellAssignment?.subjectId || 0}
                        onChange={e =>
                          handleAssignmentChange(day, period.id, 'subjectId', parseInt(e.target.value))
                        }
                        disabled={!cellAssignment?.classId || cellAssignment.classId === 0}
                      >
                        <option value={0}>Select Subject</option>
                        {getAvailableSubjects(cellAssignment?.classId).map(subject => (
                          <option key={subject.id} value={subject.id}>
                            {subject.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                );
              })}
              <td className="text-center">
                <span className="badge bg-primary">{dailyWorkload[day] || 0}</span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={periods.length + 2} className="text-center fw-bold">
              Weekly Workload: {weeklyWorkload}
            </td>
          </tr>
        </tfoot>
      </table>

      <button className="btn btn-primary" onClick={handleSave}>
        Save Timetable
      </button>
    </div>
  );
};

export default TeacherTimetableAssignment;
