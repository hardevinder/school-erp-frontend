import React, { useState, useEffect } from 'react';

const API_URL = process.env.REACT_APP_API_URL;

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TeacherTimetableDisplay = () => {
  const [periods, setPeriods] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [grid, setGrid] = useState({});
  const [holidays, setHolidays] = useState([]);
  // Separate states for the two substitution types:
  const [originalSubs, setOriginalSubs] = useState({});
  const [substitutedSubs, setSubstitutedSubs] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // State for the current week's Monday.
  const [currentMonday, setCurrentMonday] = useState(() => {
    const today = new Date();
    const dayIndex = (today.getDay() + 6) % 7; // Monday as index 0.
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayIndex);
    return monday;
  });

  const token = localStorage.getItem("token");
  const selectedTeacherId = 668; // Logged in teacher ID

  const formatDate = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const today = new Date();
  const currentDateStr = formatDate(today);

  // Calculate week dates based on currentMonday.
  const weekDates = {};
  days.forEach((day, index) => {
    const d = new Date(currentMonday);
    d.setDate(currentMonday.getDate() + index);
    weekDates[day] = formatDate(d);
  });

  const handlePrevWeek = () => {
    const prevMonday = new Date(currentMonday);
    prevMonday.setDate(currentMonday.getDate() - 7);
    setCurrentMonday(prevMonday);
  };

  const handleNextWeek = () => {
    const nextMonday = new Date(currentMonday);
    nextMonday.setDate(currentMonday.getDate() + 7);
    setCurrentMonday(nextMonday);
  };

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

  useEffect(() => {
    fetch(`${API_URL}/period-class-teacher-subject/timetable-teacher`, {
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
  }, [token]);

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

  // Fetch substitutions from both endpoints.
  useEffect(() => {
    const fetchSubstitutions = async () => {
      const origSubsByDate = {};
      const subSubsByDate = {};
      await Promise.all(
        Object.values(weekDates).map(async (date) => {
          // Fetch original substitutions (where logged in teacher is freed).
          try {
            const resOrig = await fetch(`${API_URL}/substitutions/by-date/original?date=${date}`, {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              }
            });
            const dataOrig = await resOrig.json();
            origSubsByDate[date] = dataOrig;
          } catch (err) {
            console.error("Error fetching original substitutions for date", date, err);
            origSubsByDate[date] = [];
          }
          // Fetch substituted substitutions (where logged in teacher is covering).
          try {
            const resSub = await fetch(`${API_URL}/substitutions/by-date/substituted?date=${date}`, {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              }
            });
            const dataSub = await resSub.json();
            subSubsByDate[date] = dataSub;
          } catch (err) {
            console.error("Error fetching substituted substitutions for date", date, err);
            subSubsByDate[date] = [];
          }
        })
      );
      setOriginalSubs(origSubsByDate);
      setSubstitutedSubs(subSubsByDate);
    };

    fetchSubstitutions();
  }, [token, weekDates]);

  // Build the grid for timetable records.
  useEffect(() => {
    if (!Array.isArray(timetable)) {
      console.error("timetable is not an array:", timetable);
      return;
    }
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

  // Calculate workload and substitution counts per day.
  let rowWorkloadsRegular = {};
  let rowWorkloadsRed = {};   // Count from originalSubs (redish)
  let rowWorkloadsGreen = {}; // Count from substitutedSubs (greenish)
  let rowHasSubstitution = {};

  if (!isLoading && periods.length > 0) {
    days.forEach(day => {
      let regCount = 0;
      let redCount = 0;
      let greenCount = 0;
      const holidayForDay = holidays.find(holiday => holiday.date === weekDates[day]);
      // Get substitution records for the day.
      const origSubsForDay = originalSubs[weekDates[day]] || [];
      const subSubsForDay = substitutedSubs[weekDates[day]] || [];
      
      if (!holidayForDay && grid[day]) {
        periods.forEach(period => {
          regCount += grid[day][period.id] ? grid[day][period.id].length : 0;
          const origForPeriod = origSubsForDay.filter(
            sub =>
              sub.periodId === period.id &&
              sub.day === day &&
              sub.date === weekDates[day]
          );
          const subForPeriod = subSubsForDay.filter(
            sub =>
              sub.periodId === period.id &&
              sub.day === day &&
              sub.date === weekDates[day]
          );
          redCount += origForPeriod.length;
          greenCount += subForPeriod.length;
        });
      }
      rowWorkloadsRegular[day] = regCount;
      rowWorkloadsRed[day] = redCount;
      rowWorkloadsGreen[day] = greenCount;
      rowHasSubstitution[day] = (redCount + greenCount) > 0;
    });
  }

  // Compute net workload per day: adjusted = regular - red + green.
  const getNetWorkload = (day) => {
    const regular = rowWorkloadsRegular[day] || 0;
    const red = rowWorkloadsRed[day] || 0;
    const green = rowWorkloadsGreen[day] || 0;
    return regular - red + green;
  };

  // Compute adjusted workload per period (column) by iterating over days.
  let columnAdjustedWorkloads = {};
  if (!isLoading && periods.length > 0) {
    periods.forEach(period => {
      let regCount = 0;
      let redCount = 0;
      let greenCount = 0;
      days.forEach(day => {
        const holidayForDay = holidays.find(holiday => holiday.date === weekDates[day]);
        if (!holidayForDay && grid[day]) {
          regCount += grid[day][period.id] ? grid[day][period.id].length : 0;
        }
        const origSubsForDay = originalSubs[weekDates[day]] || [];
        const subSubsForDay = substitutedSubs[weekDates[day]] || [];
        const origForPeriod = origSubsForDay.filter(
          sub =>
            sub.periodId === period.id &&
            sub.day === day &&
            sub.date === weekDates[day]
        );
        const subForPeriod = subSubsForDay.filter(
          sub =>
            sub.periodId === period.id &&
            sub.day === day &&
            sub.date === weekDates[day]
        );
        redCount += origForPeriod.length;
        greenCount += subForPeriod.length;
      });
      columnAdjustedWorkloads[period.id] = regCount - redCount + greenCount;
    });
  }

  // Overall adjusted workload is the sum of daily net workloads.
  const overallAdjustedWorkload = days.reduce((acc, day) => acc + getNetWorkload(day), 0);

  const cellStyle = {
    minWidth: '200px',
    height: '80px',
    verticalAlign: 'middle',
    textAlign: 'center'
  };

  const workloadStyle = {
    backgroundColor: "#e9ecef",
    padding: "3px 6px",
    borderRadius: "4px",
    display: "inline-block",
    margin: "2px"
  };

  return (
    <div className="container mt-4">
      <div className="card shadow">
        <div className="card-header bg-white text-dark">
          <h3 className="mb-0">My Timetable</h3>
        </div>
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <button
              onClick={handlePrevWeek}
              title="Previous Week"
              className="btn btn-light rounded-circle shadow-sm d-flex align-items-center justify-content-center"
              style={{ width: '50px', height: '50px' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L6.707 7l4.647 4.646a.5.5 0 0 1-.708.708l-5-5a.5.5 0 0 1 0-.708l5-5a.5.5 0 0 1 .708 0z"/>
              </svg>
            </button>
            <div className="text-center font-weight-bold">
              Week: {formatDate(currentMonday)} to {formatDate(new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() + 5))}
            </div>
            <button
              onClick={handleNextWeek}
              title="Next Week"
              className="btn btn-light rounded-circle shadow-sm d-flex align-items-center justify-content-center"
              style={{ width: '50px', height: '50px' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l5 5a.5.5 0 0 1 0 .708l-5 5a.5.5 0 1 1-.708-.708L9.293 7 4.646 2.354a.5.5 0 0 1 0-.708z"/>
              </svg>
            </button>
          </div>
          {isLoading ? (
            <div className="text-center my-5">
              <div className="spinner-border text-primary" role="status">
                <span className="sr-only">Loading...</span>
              </div>
            </div>
          ) : (
            <div>
              <table className="table table-striped table-bordered table-hover" style={{ tableLayout: 'fixed', width: '100%' }}>
                <thead className="thead-dark">
                  <tr>
                    <th style={cellStyle}>Day</th>
                    {periods.map(period => (
                      <th key={period.id} style={cellStyle}>
                        {period.period_name}
                      </th>
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
                          <br />
                          <small>{weekDates[day]}</small>
                        </td>
                        {holidayForDay ? (
                          <td colSpan={periods.length} style={cellStyle}>
                            {holidayForDay.description}
                          </td>
                        ) : (
                          periods.map(period => {
                            const cellRecords = (grid[day] && grid[day][period.id]) ? grid[day][period.id] : [];
                            const origSubsForDay = originalSubs[weekDates[day]] || [];
                            const subSubsForDay = substitutedSubs[weekDates[day]] || [];
                            // Find matching original substitution record.
                            const origSubRecord = origSubsForDay.find(
                              sub =>
                                sub.periodId === period.id &&
                                sub.day === day &&
                                sub.date === weekDates[day]
                            );
                            // Find matching substituted record.
                            const subSubRecord = subSubsForDay.find(
                              sub =>
                                sub.periodId === period.id &&
                                sub.day === day &&
                                sub.date === weekDates[day]
                            );
                            
                            if (origSubRecord) {
                              return (
                                <td key={period.id} style={cellStyle}>
                                  <div 
                                    className="p-2 border rounded shadow-sm" 
                                    style={{ backgroundColor: '#f8d7da' }}  // Redish background
                                  >
                                    <div className="small font-weight-bold">Freed by:</div>
                                    <div className="small">
                                      {origSubRecord.Teacher ? origSubRecord.Teacher.name : ''} - <strong>{origSubRecord.Class ? origSubRecord.Class.class_name : ''}</strong> - {origSubRecord.Subject ? origSubRecord.Subject.name : ''}
                                    </div>
                                  </div>
                                </td>
                              );
                            } else if (subSubRecord) {
                              return (
                                <td key={period.id} style={cellStyle}>
                                  <div 
                                    className="p-2 border rounded shadow-sm" 
                                    style={{ backgroundColor: '#d4edda' }}  // Greenish background
                                  >
                                    <div className="small font-weight-bold">Covering:</div>
                                    <div className="small">
                                      {subSubRecord.OriginalTeacher ? subSubRecord.OriginalTeacher.name : ''} - <strong>{subSubRecord.Class ? subSubRecord.Class.class_name : ''}</strong> - {subSubRecord.Subject ? subSubRecord.Subject.name : ''}
                                    </div>
                                  </div>
                                </td>
                              );
                            }
                            
                            // Otherwise, render the regular timetable cell.
                            return (
                              <td key={period.id} style={cellStyle} className={cellRecords.length === 0 ? 'bg-light' : ''}>
                                {cellRecords.length > 0 ? (
                                  cellRecords.map((record, index) => (
                                    <div key={index} className="mb-2 p-2 border rounded shadow-sm">
                                      <div className="small">
                                        <strong>{record.Class ? record.Class.class_name : ''}</strong>
                                      </div>
                                      <div className="small">
                                        {record.Subject ? record.Subject.name : record.subjectId}
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div>&nbsp;</div>
                                )}
                              </td>
                            );
                          })
                        )}
                        <td className="text-center font-weight-bold" style={cellStyle}>
                          <span style={workloadStyle}>
                            {(() => {
                              const regular = rowWorkloadsRegular[day] || 0;
                              const red = rowWorkloadsRed[day] || 0;
                              const green = rowWorkloadsGreen[day] || 0;
                              if(red > 0 || green > 0) {
                                return `${regular} - ${red} + ${green} = ${regular - red + green}`;
                              }
                              return `${regular}`;
                            })()}
                          </span>
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
                        <span style={workloadStyle}>{columnAdjustedWorkloads[period.id] || 0}</span>
                      </th>
                    ))}
                    <th style={cellStyle}>
                      <span style={workloadStyle}>{overallAdjustedWorkload}</span>
                    </th>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherTimetableDisplay;
