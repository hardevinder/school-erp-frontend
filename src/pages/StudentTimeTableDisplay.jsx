import React, { useState, useEffect } from 'react';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const StudentTimetableDisplay = () => {
  const [periods, setPeriods] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [grid, setGrid] = useState({});
  const [holidays, setHolidays] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [studentSubs, setStudentSubs] = useState({});

  const token = localStorage.getItem("token");

  // Helper: format Date as "YYYY-MM-DD"
  const formatDate = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Manage navigation: store the current week's Monday.
  const [currentMonday, setCurrentMonday] = useState(() => {
    const today = new Date();
    const dayIndex = (today.getDay() + 6) % 7; // Adjust so Monday is index 0.
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayIndex);
    return monday;
  });

  // Build a map of dates for each day in the current week.
  const weekDates = {};
  days.forEach((day, index) => {
    const d = new Date(currentMonday);
    d.setDate(currentMonday.getDate() + index);
    weekDates[day] = formatDate(d);
  });

  // Today's date string (for highlighting the current day).
  const currentDateStr = formatDate(new Date());

  // Fetch periods for table columns.
  useEffect(() => {
    fetch('http://localhost:3000/periods', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => setPeriods(data || []))
      .catch(err => console.error("Error fetching periods:", err));
  }, [token]);

  // Fetch timetable details.
  useEffect(() => {
    fetch('http://localhost:3000/period-class-teacher-subject/student/timetable', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        console.log("Timetable API response:", data);
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

  // Fetch holidays.
  useEffect(() => {
    fetch('http://localhost:3000/holidays', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => setHolidays(data || []))
      .catch(err => console.error("Error fetching holidays:", err));
  }, [token]);

  // Build grid: grid[day][periodId] = array of timetable records.
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

  // Fetch student substitutions for each day of the week.
  useEffect(() => {
    const fetchSubs = async () => {
      const subs = {};
      const dates = [];
      days.forEach((_, index) => {
        const d = new Date(currentMonday);
        d.setDate(currentMonday.getDate() + index);
        dates.push(formatDate(d));
      });
      await Promise.all(
        dates.map(async (date) => {
          try {
            const res = await fetch(`http://localhost:3000/substitutions/by-date/student?date=${date}`, {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              }
            });
            const data = await res.json();
            subs[date] = data;
          } catch (err) {
            console.error(`Error fetching substitutions for date ${date}:`, err);
            subs[date] = [];
          }
        })
      );
      setStudentSubs(subs);
    };
    fetchSubs();
  }, [token, currentMonday]);

  // Week navigation handlers.
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

  // Define cell styling.
  const cellStyle = {
    minWidth: '200px',
    height: '80px',
    verticalAlign: 'middle',
    textAlign: 'center'
  };

  return (
    <div className="container mt-4">
      <div className="card shadow">
        <div className="card-header bg-white text-dark">
          <h3 className="mb-0">My Timetable</h3>
        </div>
        <div className="card-body">
          {/* Navigation Controls with Angle Icons */}
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
            <div>
              Week: {formatDate(currentMonday)} - {formatDate(new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() + 5))}
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
              <table
                className="table table-striped table-bordered table-hover"
                style={{ tableLayout: 'fixed', width: '100%' }}
              >
                <thead className="thead-dark">
                  <tr>
                    <th style={cellStyle}>Day</th>
                    {periods.map(period => (
                      <th key={period.id} style={cellStyle}>
                        {period.period_name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {days.map(day => {
                    // Check for a holiday on this day.
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
                            // Check if a substitution record exists for this day and period.
                            const subsForDay = studentSubs[weekDates[day]] || [];
                            const subsForPeriod = subsForDay.filter(
                              sub => sub.periodId === period.id && sub.day === day
                            );
                            
                            if (subsForPeriod.length > 0) {
                              // If a substitution is found, show a cell with the updated teacher and subject.
                              const substitution = subsForPeriod[0];
                              return (
                                <td key={period.id} style={cellStyle}>
                                  <div 
                                    className="p-2 border rounded shadow-sm" 
                                    style={{ backgroundColor: '#e2f0fb' }} // subtle light-blue background
                                  >
                                    <div className="small font-weight-bold">
                                      Updated Teacher
                                    </div>
                                    <div className="small">
                                      {substitution.Teacher ? substitution.Teacher.name : ''}
                                    </div>
                                    <div className="small">
                                      {substitution.Subject ? substitution.Subject.name : ''}
                                    </div>
                                  </div>
                                </td>
                              );
                            } else {
                              // Otherwise, render the regular timetable cell.
                              const cellRecords = (grid[day] && grid[day][period.id]) ? grid[day][period.id] : [];
                              return (
                                <td
                                  key={period.id}
                                  style={cellStyle}
                                  className={cellRecords.length === 0 ? 'bg-light' : ''}
                                >
                                  {cellRecords.length > 0 ? (
                                    cellRecords.map((record, index) => (
                                      <div key={index} className="mb-2 p-2 border rounded shadow-sm">
                                        <div className="small">
                                          <strong>{record.Teacher ? record.Teacher.name : ''}</strong>
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
                            }
                          })
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentTimetableDisplay;
