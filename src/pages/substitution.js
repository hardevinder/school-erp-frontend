import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';

const API_URL = process.env.REACT_APP_API_URL;
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Helper function to format a Date as "YYYY-MM-DD"
const formatDate = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const TeacherTimetableView = () => {
  // State declarations
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [globalTimetable, setGlobalTimetable] = useState([]);
  const [grid, setGrid] = useState({});
  const [holidays, setHolidays] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [availableTeachersWithWorkload, setAvailableTeachersWithWorkload] = useState([]);
  // substitutions state holds current user selections (or deletions) for cells.
  const [substitutions, setSubstitutions] = useState({});
  // originalSubs holds the substitutions as loaded from the backend.
  const [originalSubs, setOriginalSubs] = useState({});
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));

  const token = localStorage.getItem("token");

  // Calculate week dates mapping.
  const today = new Date();
  const weekDates = {};
  const dayIndex = (today.getDay() + 6) % 7; // Adjust so Monday is index 0.
  const monday = new Date(today);
  monday.setDate(today.getDate() - dayIndex);
  days.forEach((day, index) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + index);
    weekDates[day] = formatDate(d);
  });
  const currentDateStr = formatDate(today);

  // Fetch teachers for dropdown.
  useEffect(() => {
    fetch(`${API_URL}/teachers`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.teachers) {
          setTeachers(data.teachers);
          setSelectedTeacher(data.teachers[0]?.id);
        }
      })
      .catch(err => console.error("Error fetching teachers:", err));
  }, [token]);

  // Fetch periods for table columns.
  useEffect(() => {
    fetch(`${API_URL}/periods`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => setPeriods(data || []))
      .catch(err => console.error("Error fetching periods:", err));
  }, [token]);

  // Fetch holidays.
  useEffect(() => {
    fetch(`${API_URL}/holidays`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => setHolidays(data || []))
      .catch(err => console.error("Error fetching holidays:", err));
  }, [token]);

  // Fetch the selected teacher's timetable.
  useEffect(() => {
    if (!selectedTeacher) return;
    setIsLoading(true);
    fetch(`${API_URL}/period-class-teacher-subject/timetable-teacher/${selectedTeacher}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setTimetable(data);
        } else if (data && Array.isArray(data.timetable)) {
          setTimetable(data.timetable);
        } else {
          console.error("Unexpected timetable data format:", data);
          setTimetable([]);
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Error fetching timetable:", err);
        setIsLoading(false);
      });
  }, [selectedTeacher, token]);

  // When teacher changes, clear current substitutions and selected cell.
  useEffect(() => {
    setSubstitutions({});
    setOriginalSubs({});
    setSelectedDay(null);
    setSelectedPeriod(null);
  }, [selectedTeacher]);

  // Fetch global timetable records.
  useEffect(() => {
    fetch(`${API_URL}/period-class-teacher-subject`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => setGlobalTimetable(data || []))
      .catch(err => console.error("Error fetching global timetable:", err));
  }, [token]);

  // Build grid: grid[day][periodId] = array of timetable records.
  useEffect(() => {
    const newGrid = {};
    days.forEach(day => {
      newGrid[day] = {};
      periods.forEach(period => {
        newGrid[day][period.id] = [];
      });
    });
    timetable.forEach(record => {
      const { day, periodId } = record;
      if (newGrid[day] && newGrid[day][periodId] !== undefined) {
        newGrid[day][periodId].push(record);
      }
    });
    setGrid(newGrid);
  }, [timetable, periods]);

  // Calculate timetable workloads.
  let rowWorkloads = {};
  let columnWorkloads = {};
  let overallWorkload = 0;
  if (!isLoading && periods.length > 0) {
    days.forEach(day => {
      let count = 0;
      const holidayForDay = holidays.find(holiday => holiday.date === weekDates[day]);
      if (!holidayForDay && grid[day]) {
        periods.forEach(period => {
          count += (grid[day][period.id] ? grid[day][period.id].length : 0);
        });
      }
      rowWorkloads[day] = count;
    });
    periods.forEach(period => {
      let count = 0;
      days.forEach(day => {
        const holidayForDay = holidays.find(holiday => holiday.date === weekDates[day]);
        if (!holidayForDay && grid[day] && grid[day][period.id]) {
          count += grid[day][period.id].length;
        }
      });
      columnWorkloads[period.id] = count;
    });
    overallWorkload = days.reduce((acc, day) => acc + rowWorkloads[day], 0);
  }

  // Fetch substitutions for the selected date.
  useEffect(() => {
    if (!selectedDate || !selectedTeacher) return;
    fetch(`${API_URL}/substitutions/by-date?date=${selectedDate}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        const subs = {};
        data.forEach(sub => {
          if (parseInt(sub.original_teacherId) === parseInt(selectedTeacher)) {
            const key = `${sub.day.toLowerCase().trim()}_${sub.periodId}`;
            subs[key] = sub;
          }
        });
        setSubstitutions(subs);
        setOriginalSubs(subs);
      })
      .catch(err => console.error('Error fetching substitutions by date:', err));
  }, [selectedDate, selectedTeacher, token]);

  // Fetch available teachers.
  useEffect(() => {
    async function fetchAvailableTeachers() {
      try {
        const response = await fetch(`${API_URL}/period-class-teacher-subject/teacher-availability-by-date?date=${selectedDate}&periodId=${selectedPeriod}`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        const available = data.availableTeachers || [];
        const teacherPromises = available.map(teacher => {
          return fetch(`${API_URL}/period-class-teacher-subject/teacher-workload/${teacher.id}`, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          })
            .then(res => res.json())
            .then(workloadData => ({
              ...teacher,
              weeklyWorkload: workloadData.weeklyWorkload,
              dayWorkload: workloadData.dailyWorkload[selectedDay] || 0
            }));
        });
        let teachersWithWorkload = await Promise.all(teacherPromises);
        teachersWithWorkload.sort((a, b) => {
          if (a.weeklyWorkload !== b.weeklyWorkload) {
            return a.weeklyWorkload - b.weeklyWorkload;
          }
          return a.dayWorkload - b.dayWorkload;
        });
        setAvailableTeachersWithWorkload(teachersWithWorkload);
      } catch (error) {
        console.error("Error fetching available teachers:", error);
        setAvailableTeachersWithWorkload([]);
      }
    }
    if (selectedDay && selectedPeriod) {
      fetchAvailableTeachers();
    } else {
      setAvailableTeachersWithWorkload([]);
    }
  }, [selectedDay, selectedPeriod, token, selectedDate]);

  // Styling definitions.
  const cellStyle = {
    minWidth: '120px',
    height: '60px',
    verticalAlign: 'middle',
    textAlign: 'center',
    cursor: 'pointer',
    fontSize: '0.8rem',
    position: 'relative'
  };
  const workloadStyle = {
    padding: "2px 4px",
    borderRadius: "4px",
    display: "inline-block",
    fontSize: "0.8rem",
    fontWeight: 'bold'
  };
  const selectedCellStyle = {
    backgroundColor: "#ffedcc",
    border: "2px solid #ffa500"
  };
  const teacherButtonStyle = {
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 15px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    width: '100%',
    cursor: 'pointer'
  };
  const teacherButtonHoverStyle = {
    transform: 'scale(1.02)',
    boxShadow: '0 6px 8px rgba(0,0,0,0.15)'
  };
  const teacherButtonDisabledStyle = {
    backgroundColor: '#cccccc',
    color: '#666666',
    cursor: 'not-allowed'
  };
  const teacherItemStyle = {
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '5px 10px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };
  const substitutionBadgeStyle = {
    position: 'absolute',
    bottom: '2px',
    right: '2px',
    backgroundColor: 'orange',
    color: 'white',
    padding: '2px 4px',
    fontSize: '0.7rem',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer'
  };

  // Handler: when selecting a teacher for a cell.
  const handleTeacherSubstitution = (teacher) => {
    if (selectedDay && selectedPeriod) {
      const key = `${selectedDay.toLowerCase().trim()}_${selectedPeriod}`;
      const teacherToStore = { ...teacher, teacherId: teacher.id, teacherName: teacher.name };
      setSubstitutions(prev => ({ ...prev, [key]: teacherToStore }));
    } else {
      Swal.fire('No cell selected', 'Please click on a cell first.', 'warning');
    }
  };

  // Handler: Remove a substitution.
  const removeSubstitution = async (cellKey) => {
    const subToRemove = substitutions[cellKey];
    if (subToRemove && subToRemove.id) {
      try {
        const response = await fetch(`${API_URL}/substitutions/${subToRemove.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) {
          Swal.fire('Error', 'Failed to delete substitution from backend.', 'error');
          return;
        }
      } catch (error) {
        console.error('Error deleting substitution:', error);
        Swal.fire('Error', 'Failed to delete substitution from backend.', 'error');
        return;
      }
    }
    setSubstitutions(prev => {
      const newSubs = { ...prev };
      delete newSubs[cellKey];
      return newSubs;
    });
  };

  // Single-cell submission handler.
  const handleSubmitSubstitutions = async () => {
    if (!selectedDay || !selectedPeriod) {
      Swal.fire('No cell selected', 'Please click on a cell to select day and period.', 'warning');
      return;
    }
    const cellKey = `${selectedDay.toLowerCase().trim()}_${selectedPeriod}`;
    const teacherSub = substitutions[cellKey];
    if (!teacherSub) {
      Swal.fire('No substitution selected', 'Please select a teacher for substitution.', 'warning');
      return;
    }
    // Get cell's timetable records.
    const cellRecords = grid[selectedDay] && grid[selectedDay][selectedPeriod] ? grid[selectedDay][selectedPeriod] : [];
    if (cellRecords.length === 0) {
      Swal.fire('No Class Found', 'No class record found in this cell.', 'error');
      return;
    }
    let previousClassId = null;
    let previousSubjectId = null;
    for (let record of cellRecords) {
      if (!previousClassId) {
        if (record.Class && record.Class.id) {
          previousClassId = record.Class.id;
        } else if (record.classId) {
          previousClassId = record.classId;
        }
      }
      if (!previousSubjectId) {
        if (record.Subject && record.Subject.id) {
          previousSubjectId = record.Subject.id;
        } else if (record.subjectId) {
          previousSubjectId = record.subjectId;
        }
      }
      if (previousClassId && previousSubjectId) break;
    }
    if (!previousClassId) {
      Swal.fire('No Class Info', 'Class record lacks a valid class ID.', 'error');
      return;
    }
    if (!previousSubjectId) {
      Swal.fire('No Subject Info', 'Class record lacks a valid subject ID.', 'error');
      return;
    }
    const originalTeacherId = cellRecords[0].teacherId;
    const selectedTeacherId = teacherSub.teacherId || teacherSub.id;
    const payload = {
      date: selectedDate,
      periodId: selectedPeriod,
      classId: previousClassId,
      teacherId: selectedTeacherId,
      original_teacherId: originalTeacherId,
      subjectId: previousSubjectId,
      day: selectedDay,
      published: true
    };
    try {
      const response = await fetch(`${API_URL}/substitutions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        const returnedSubstitution = await response.json();
        returnedSubstitution.Teacher = { id: selectedTeacherId, name: teacherSub.teacherName };
        setSubstitutions(prev => ({ ...prev, [cellKey]: returnedSubstitution }));
        Swal.fire('Success', 'Substitution processed successfully!', 'success');
      } else {
        Swal.fire('Error', 'Failed to process substitution.', 'error');
      }
    } catch (error) {
      console.error('Error submitting substitution:', error);
      Swal.fire('Error', 'Failed to submit substitution.', 'error');
    }
  };

  // Submit all cells.
  const handleSubmitAllSubstitutions = async () => {
    for (const day of days) {
      for (const period of periods) {
        const cellKey = `${day.toLowerCase().trim()}_${period.id}`;
        const teacherSub = substitutions[cellKey];
        const cellRecords = grid[day] && grid[day][period.id] ? grid[day][period.id] : [];
        if (cellRecords.length === 0) continue;
        let previousClassId = null;
        let previousSubjectId = null;
        for (let record of cellRecords) {
          if (!previousClassId) {
            if (record.Class && record.Class.id) {
              previousClassId = record.Class.id;
            } else if (record.classId) {
              previousClassId = record.classId;
            }
          }
          if (!previousSubjectId) {
            if (record.Subject && record.Subject.id) {
              previousSubjectId = record.Subject.id;
            } else if (record.subjectId) {
              previousSubjectId = record.subjectId;
            }
          }
          if (previousClassId && previousSubjectId) break;
        }
        if (!previousClassId || !previousSubjectId) continue;
        const originalTeacherId = cellRecords[0].teacherId;
        if (teacherSub) {
          const selectedTeacherId = teacherSub.teacherId || teacherSub.id;
          const payload = {
            date: selectedDate,
            periodId: period.id,
            classId: previousClassId,
            teacherId: selectedTeacherId,
            original_teacherId: originalTeacherId,
            subjectId: previousSubjectId,
            day: day,
            published: true
          };
          try {
            const response = await fetch(`${API_URL}/substitutions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(payload)
            });
            if (response.ok) {
              const returnedSubstitution = await response.json();
              returnedSubstitution.Teacher = { id: selectedTeacherId, name: teacherSub.teacherName };
              setSubstitutions(prev => ({ ...prev, [cellKey]: returnedSubstitution }));
            } else {
              Swal.fire('Error', `Failed to upsert substitution for ${day} period ${period.period_name}.`, 'error');
            }
          } catch (error) {
            console.error('Error submitting substitution:', error);
            Swal.fire('Error', `Failed to submit substitution for ${day} period ${period.period_name}.`, 'error');
          }
        } else {
          if (originalSubs[cellKey] && originalSubs[cellKey].id) {
            try {
              const response = await fetch(`${API_URL}/substitutions/${originalSubs[cellKey].id}`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                }
              });
              if (!response.ok) {
                Swal.fire('Error', `Failed to delete substitution for ${day} period ${period.period_name}.`, 'error');
              } else {
                setSubstitutions(prev => {
                  const newSubs = { ...prev };
                  delete newSubs[cellKey];
                  return newSubs;
                });
              }
            } catch (error) {
              console.error('Error deleting substitution:', error);
              Swal.fire('Error', `Failed to delete substitution for ${day} period ${period.period_name}.`, 'error');
            }
          }
        }
      }
    }
    Swal.fire('Success', 'All substitutions processed successfully!', 'success');
  };

  // Only allow selecting cells that match the day of the selected date.
  const handleCellClick = (day, periodId) => {
    const selectedDateDay = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' });
    if (day !== selectedDateDay) {
      Swal.fire('Invalid selection', `You can only select cells for ${selectedDateDay}.`, 'warning');
      return;
    }
    setSelectedDay(day);
    setSelectedPeriod(periodId);
  };

  const currentCellKey = selectedDay && selectedPeriod ? `${selectedDay.toLowerCase().trim()}_${selectedPeriod}` : null;
  const currentCellSubstitution = currentCellKey ? substitutions[currentCellKey] : null;

  return (
    <div className="container mt-4">
      {/* Global custom scrollbar styles */}
      <style>
        {`
          .custom-scrollbar::-webkit-scrollbar { width: 8px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 8px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #888; border-radius: 8px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
        `}
      </style>
      <div className="card shadow">
        <div className="card-header bg-white text-dark">
          <h3 className="mb-0">Teacher Timetable</h3>
        </div>
        <div className="card-body">
          {/* Top Row: Teacher Select, Date Picker, and Count Button */}
          <div className="d-flex flex-wrap align-items-center mb-3" style={{ gap: '1rem' }}>
            <div style={{ flex: '1 1 250px' }}>
              <label htmlFor="teacherSelect" className="form-label">Select Teacher:</label>
              <select
                id="teacherSelect"
                className="form-select"
                value={selectedTeacher || ''}
                onChange={(e) => {
                  setSelectedTeacher(e.target.value);
                  setSubstitutions({});
                  setOriginalSubs({});
                  setSelectedDay(null);
                  setSelectedPeriod(null);
                }}
              >
                {teachers.map(teacher => (
                  <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: '1 1 250px' }}>
              <label htmlFor="substitutionDate" className="form-label">Select Date:</label>
              <input
                type="date"
                id="substitutionDate"
                className="form-control"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <button 
                type="button" 
                style={{
                  ...teacherButtonStyle,
                  backgroundColor: '#28a745',
                  cursor: 'default'
                }}
                disabled
              >
                {selectedDay && selectedPeriod
                  ? `${availableTeachersWithWorkload.length} Teachers Available`
                  : 'N/A'}
              </button>
            </div>
          </div>

          <div className="d-flex flex-wrap" style={{ gap: '1rem' }}>
            {/* Left: Timetable with horizontal scroll */}
            <div style={{ flex: 2, overflowX: 'auto' }} className="custom-scrollbar">
              {isLoading ? (
                <div className="text-center my-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="sr-only">Loading...</span>
                  </div>
                </div>
              ) : (
                <table className="table table-striped table-bordered table-hover" style={{ tableLayout: 'fixed', width: '100%' }}>
                  <thead className="thead-dark">
                    <tr>
                      <th style={cellStyle}>Day</th>
                      {periods.map(period => (
                        <th key={period.id} style={cellStyle}>{period.period_name}</th>
                      ))}
                      <th style={cellStyle}>Workload</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map(day => {
                      const holidayForDay = holidays.find(holiday => holiday.date === weekDates[day]);
                      const isCurrentDay = weekDates[day] === currentDateStr;
                      const rowClasses = `${holidayForDay ? 'table-danger' : ''} ${isCurrentDay ? 'border border-primary' : ''}`;
                      return (
                        <tr key={day} className={rowClasses}>
                          <td className="font-weight-bold" style={cellStyle}>
                            {day} {holidayForDay ? `(Holiday)` : ''} {isCurrentDay ? `(Today)` : ''}
                          </td>
                          {holidayForDay ? (
                            <td colSpan={periods.length} style={cellStyle}>{holidayForDay.description}</td>
                          ) : (
                            periods.map(period => {
                              const cellKey = `${day.toLowerCase().trim()}_${period.id}`;
                              const isSelected = day === selectedDay && period.id === selectedPeriod;
                              return (
                                <td
                                  key={period.id}
                                  style={{
                                    ...cellStyle,
                                    ...(isSelected ? selectedCellStyle : {}),
                                    ...(substitutions[cellKey] ? { backgroundColor: '#e0ffe0', border: '2px solid green' } : {})
                                  }}
                                  onClick={() => handleCellClick(day, period.id)}
                                >
                                  {grid[day] && grid[day][period.id] && grid[day][period.id].length > 0 ? (
                                    grid[day][period.id].map((record, index) => (
                                      <div key={index} className="mb-1 p-1 border rounded shadow-sm">
                                        <div className="small">
                                          <strong>{record.Class ? record.Class.class_name : ''}</strong>
                                        </div>
                                        <div className="small">
                                          {record.Subject && record.Subject.name ? record.Subject.name : 'No Subject'}
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div>&nbsp;</div>
                                  )}
                                  {substitutions[cellKey] && (
                                    <div
                                      style={substitutionBadgeStyle}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeSubstitution(cellKey);
                                      }}
                                    >
                                      {substitutions[cellKey].Teacher && substitutions[cellKey].Teacher.name
                                        ? substitutions[cellKey].Teacher.name
                                        : substitutions[cellKey].name || substitutions[cellKey].teacherId || substitutions[cellKey].id} ×
                                    </div>
                                  )}
                                </td>
                              );
                            })
                          )}
                          <td className="text-center font-weight-bold" style={cellStyle}>
                            <span style={workloadStyle}>{rowWorkloads[day] || 0}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-light">
                    <tr>
                      <th style={cellStyle}>Total Workload</th>
                      {periods.map(period => (
                        <th key={period.id} style={cellStyle}>
                          <span style={workloadStyle}>{columnWorkloads[period.id] || 0}</span>
                        </th>
                      ))}
                      <th style={cellStyle}>
                        <span style={workloadStyle}>{overallWorkload}</span>
                      </th>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Right: List of Available Teachers */}
            <div style={{ flex: 1, marginLeft: "20px", maxHeight: '500px', overflowY: 'auto' }} className="custom-scrollbar">
              {selectedDay && selectedPeriod ? (
                availableTeachersWithWorkload.length > 0 ? (
                  <div className="d-flex flex-column" style={{ gap: '0.5rem' }}>
                    {availableTeachersWithWorkload.map(teacher => (
                      <button
                        type="button"
                        key={teacher.id}
                        style={{
                          ...teacherItemStyle,
                          ...(currentCellSubstitution && currentCellSubstitution.teacherId === teacher.id
                            ? teacherButtonDisabledStyle
                            : {})
                        }}
                        disabled={currentCellSubstitution && currentCellSubstitution.teacherId === teacher.id}
                        onClick={() => handleTeacherSubstitution(teacher)}
                        onMouseOver={e => {
                          if (!(currentCellSubstitution && currentCellSubstitution.teacherId === teacher.id)) {
                            Object.assign(e.currentTarget.style, teacherButtonHoverStyle);
                          }
                        }}
                        onMouseOut={e => {
                          if (!(currentCellSubstitution && currentCellSubstitution.teacherId === teacher.id)) {
                            Object.assign(e.currentTarget.style, { transform: 'scale(1)', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' });
                          }
                        }}
                      >
                        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 'bold' }}>{teacher.name}</span>
                          <span style={{ fontSize: '0.8rem' }}>
                            W: {teacher.weeklyWorkload} | D: {teacher.dayWorkload}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p>No teachers available for {selectedDay}, period {selectedPeriod}.</p>
                )
              ) : (
                <p>Click on a cell to see available teachers and their workload.</p>
              )}
            </div>
          </div>

          {/* Buttons for submission */}
          <div className="mt-3 d-flex gap-3">
            <button className="btn btn-success" onClick={handleSubmitSubstitutions}>
              Submit Current Cell
            </button>
            <button className="btn btn-primary" onClick={handleSubmitAllSubstitutions}>
              Submit All Substitutions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherTimetableView;
