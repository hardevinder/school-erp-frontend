import React, { useState } from 'react';
import ClassTimetableAssignment from './Timetable';
import TeacherTimetableAssignment from './TeacherTimetableAssignment';

const CombinedTimetableAssignment = () => {
  // 'class' for Class Wise; 'teacher' for Teacher Wise.
  const [activeTab, setActiveTab] = useState('class');

  return (
    <div className="container mt-4">
      <h2>Timetable Assignment</h2>
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'class' ? 'active' : ''}`}
            onClick={() => setActiveTab('class')}
          >
            Class Wise
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'teacher' ? 'active' : ''}`}
            onClick={() => setActiveTab('teacher')}
          >
            Teacher Wise
          </button>
        </li>
      </ul>
      <div className="tab-content">
        {activeTab === 'class' ? <ClassTimetableAssignment /> : <TeacherTimetableAssignment />}
      </div>
    </div>
  );
};

export default CombinedTimetableAssignment;
