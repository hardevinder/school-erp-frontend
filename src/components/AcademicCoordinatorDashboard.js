// src/components/Dashboard.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import api from "../api";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

import Classes from "../pages/Classes";
import Subjects from "../pages/Subjects";
import Students from "../pages/Students";
import FeeStructure from "../pages/FeeStructure";
import FeeHeadings from "../pages/FeeHeadings";
import FeeCategory from "../pages/FeeCategory";
import Sections from "../pages/Sections";
import Transportation from "../pages/Transportation";
import Schools from "../pages/Schools";
import Transactions from "../pages/Transactions/Transactions";
import Concessions from "../pages/Concessions";
import StudentDueTable from "../pages/StudentDueTable";
import DayWiseReport from "../pages/DayWiseReport";
import Users from "../pages/UserManagement";
import TeacherAssignment from "../pages/TeacherAssignment";
import InchargeAssignment from "../pages/InchargeAssignment";
import HolidayMarking from "../pages/HolidayMarking";
import Period from "../pages/Period";
import Timetable from "../pages/Timetable";
import CombinedTimetableAssignment from "../pages/CombinedTimetableAssignment";
import CombinedCirculars from "../pages/CombinedCirculars";
import Substitution from "../pages/substitution";
import SubstituitionListing from "../pages/SubstituitionListing";
import StudentUserAccounts from "../pages/StudentUserAccounts";
import EmployeeLeaveRequestForm from "../pages/EmployeeLeaveRequestForm";
import ExamSchemeManagement from "../pages/ExamSchemeManagement";
import TermManagement from "../pages/TermManagement";
import AssessmentComponentManagement from "../pages/AssessmentComponentManagement";
import AcademicYearManagement from "../pages/AcademicYearManagement";
import ExamScheduleManagement from "../pages/ExamScheduleManagement";
import ExamManagement from "../pages/ExamManagement"; // ✅ Adjust path if needed
import ReportBuilder from "../pages/ReportBuilder";
import GradeSchemeManagement from "../pages/GradeSchemeManagement";
import CombinedExamSchemeManagement from "../pages/CombinedExamSchemeManagement"; // ✅ NEW
import CoScholasticAreaManagement from "../pages/CoScholasticAreaManagement"; // ✅ NEW
import CoScholasticGradeManagement from "../pages/CoScholasticGradeManagement"; // ✅ NEW
import ClassCoScholasticMapping from "../pages/ClassCoScholasticMapping"; // ✅ NEW














import { Pie } from "react-chartjs-2";
import Chat from "../components/Chat";

const Dashboard = () => {
  const location = useLocation();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [showChatPopup, setShowChatPopup] = useState(false);

  // Roles array
  const userRoles = useMemo(() => {
    try {
      const arr = JSON.parse(localStorage.getItem("roles"));
      if (Array.isArray(arr) && arr.length) return arr;
    } catch {}
    const single = localStorage.getItem("userRole");
    return single ? [single] : [];
  }, []);
  const hasRole = (...r) => r.some(x => userRoles.includes(x));
  const currentUserId = localStorage.getItem("userId") || "user_123";

  // 1) Sync section from URL
  useEffect(() => {
    const slug = location.pathname.replace(/^\//, "");
    setActiveSection(slug || "dashboard");
  }, [location.pathname]);

  // Fetch attendance summary
  useEffect(() => {
    async function fetchAttendanceSummary() {
      setLoading(true);
      try {
        const res = await api.get(`/attendance/summary/${selectedDate}`);
        setAttendanceSummary(res.data);
      } catch (err) {
        console.error("Error fetching attendance summary:", err);
      }
      setLoading(false);
    }
    if (
      activeSection === "dashboard" ||
      activeSection === "attendance-summary"
    ) {
      fetchAttendanceSummary();
    }
  }, [activeSection, selectedDate]);

  // Compute pie data
  let total = 0, absent = 0, leaves = 0, present = 0;
  if (attendanceSummary?.summary) {
    total = attendanceSummary.summary.reduce((a, c) => a + c.total, 0);
    absent = attendanceSummary.summary.reduce((a, c) => a + c.absent, 0);
    leaves = attendanceSummary.summary.reduce((a, c) => a + c.leave, 0);
    present = total - absent - leaves;
  }
  const pieData = {
    labels: ["Present", "Absent", "Leaves"],
    datasets: [{
      data: [present, absent, leaves],
      backgroundColor: ["#36A2EB", "#FF6384", "#FFCE56"],
    }],
  };

  // Chat popup handlers
  const handleChatIconClick = () => setShowChatPopup(true);
  const handleCloseChat     = () => setShowChatPopup(false);

  // Valid section list in dash‑case
  const knownSections = [
    "dashboard",
    "attendance-summary",
    "subjects",
    "classes",
    "students",
    "fee-structure",
    "fee-headings",
    "fee-category",
    "sections",
    "transportation",
    "transactions",
    "schools",
    "concessions",
    "student-due",
    "day-wise-report",
    "users",
    "teacher-assignment",
    "incharge-assignment",
    "holiday-marking",
    "periods",
    "substitution",
    "substitution-listing",
    "timetable",
    "combined-timetable",
    "combined-circulars",
    "student-user-accounts",
    "exam-schemes",
    "term-management",
    "assessment-components",
    "academic-years",
    "exam-schedules",
    "exams", // ✅ Add this line    
    "report-builder", 
    "grade-schemes", // ✅ Add this
    "combined-exam-schemes", // ✅ NEW
    "co-scholastic-areas", // ✅ NEW
    "co-scholastic-grades", // ✅ NEW
    "class-co-scholastic-mapping", // ✅ NEW





  ];

  return (
    <div className="App">
      <Navbar />

      <div className="d-flex">
        <Sidebar
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          isExpanded={isSidebarExpanded}
          setIsExpanded={setIsSidebarExpanded}
          userRoles={userRoles}
        />

        <div
          className="content container"
          style={{
            marginTop: "70px",
            marginLeft: isSidebarExpanded ? "250px" : "60px",
            transition: "margin-left 0.3s ease",
          }}
        >
          {/* Dashboard / Attendance Summary */}
          {(activeSection === "dashboard" ||
            activeSection === "attendance-summary") && (
            <>
              <h1>Dashboard</h1>

              <div className="mb-4">
                <label htmlFor="summaryDate">Select Date:</label>
                <input
                  id="summaryDate"
                  type="date"
                  className="form-control"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                />
              </div>

              {loading ? (
                <p>Loading attendance summary...</p>
              ) : attendanceSummary ? (
                <>
                  <h3>
                    Overall Attendance — {attendanceSummary.date}
                  </h3>
                  <div className="row mb-4">
                    <div className="col-md-8">
                      {/* Cards */}
                      <div className="row">
                        {[
                          { title: "Total",    value: total,     bg: "bg-secondary" },
                          { title: "Present",  value: present,   bg: "bg-success"   },
                          { title: "Absent",   value: absent,    bg: "bg-danger"    },
                          { title: "Leaves",   value: leaves,    bg: "bg-warning"   },
                        ].map((m,i) => (
                          <div className="col-md-6 mb-3" key={i}>
                            <div className={`card text-white ${m.bg}`}>
                              <div className="card-body text-center">
                                <h6>{m.title}</h6>
                                <p className="display-6">{m.value}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="col-md-4 d-flex align-items-center">
                      <div className="card w-100">
                        <div className="card-body d-flex justify-content-center">
                          <div style={{ width: 300, height: 300 }}>
                            <Pie data={pieData} options={{ maintainAspectRatio: false }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <h3>Class & Section Breakdown</h3>
                  <div className="row">
                    {attendanceSummary.summary.map(item => {
                      const pres = item.total - (item.absent + item.leave);
                      return (
                        <div
                          className="col-md-4 mb-3"
                          key={`${item.class_id}-${item.section_id}`}
                        >
                          <div className="card border-primary">
                            <div className="card-header bg-primary text-white">
                              Class {item.class_name} — Section {item.section_name}
                            </div>
                            <div className="card-body">
                              <p>Total: {item.total}</p>
                              <p>Present: {pres}</p>
                              <p>Absent: {item.absent}</p>
                              <p>Leaves: {item.leave}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p>No summary available for this date.</p>
              )}
            </>
          )}

          {/* Other pages */}
          {activeSection === "subjects"            && <Subjects />}
          {activeSection === "classes"             && <Classes />}
          {activeSection === "students"            && <Students />}
          {activeSection === "fee-structure"       && <FeeStructure />}
          {activeSection === "fee-headings"        && <FeeHeadings />}
          {activeSection === "fee-category"        && <FeeCategory />}
          {activeSection === "sections"            && <Sections />}
          {activeSection === "transportation"      && <Transportation />}
          {activeSection === "transactions"        && <Transactions />}
          {activeSection === "schools"             && <Schools />}
          {activeSection === "concessions"         && <Concessions />}
          {activeSection === "student-due"         && <StudentDueTable />}
          {activeSection === "day-wise-report"     && <DayWiseReport />}
          {activeSection === "users"               && <Users />}
          {activeSection === "teacher-assignment"  && <TeacherAssignment />}
          {activeSection === "incharge-assignment" && <InchargeAssignment />}
          {activeSection === "holiday-marking"     && <HolidayMarking />}
          {activeSection === "periods"             && <Period />}
          {activeSection === "substitution"        && <Substitution />}
          {activeSection === "substitution-listing"&& <SubstituitionListing />}
          {activeSection === "timetable"           && <Timetable />}
          {activeSection === "combined-timetable"  && <CombinedTimetableAssignment />}
          {activeSection === "combined-circulars" && <CombinedCirculars />}
          {activeSection === "employee-leave-request" && <EmployeeLeaveRequestForm />}
          {activeSection === "exam-schemes" &&
            hasRole("academic_coordinator", "admin") && (
              <ExamSchemeManagement />
          )}

          {activeSection === "academic-years" && hasRole("academic_coordinator", "admin") && (
            <AcademicYearManagement />
          )}
          {activeSection === "term-management" && hasRole("academic_coordinator", "admin") && (
            <TermManagement />
          )}
          {activeSection === "assessment-components" && hasRole("academic_coordinator", "admin") && (
            <AssessmentComponentManagement />
          )}

          {activeSection === "exam-schedules" &&
              hasRole("academic_coordinator", "admin") && (
                <ExamScheduleManagement />
          )}
          {activeSection === "exams" &&
            hasRole("academic_coordinator", "admin") && (
              <ExamManagement />
          )}
          
          {activeSection === "report-builder" &&
              hasRole("academic_coordinator", "admin", "superadmin") && (
                <ReportBuilder />
            )}

          {/* student-user-accounts */}
          {activeSection === "student-user-accounts" &&
            hasRole("academic_coordinator") && (
              <StudentUserAccounts />
          )}
          {activeSection === "grade-schemes" &&
            hasRole("academic_coordinator", "superadmin") && (
              <GradeSchemeManagement />
          )}

          {activeSection === "combined-exam-schemes" &&
              hasRole("academic_coordinator", "admin") && (
                <CombinedExamSchemeManagement />
            )}

            {activeSection === "co-scholastic-areas" &&
              hasRole("academic_coordinator", "superadmin") && (
                <CoScholasticAreaManagement />
            )}

            {activeSection === "co-scholastic-grades" &&
                hasRole("academic_coordinator", "superadmin") && (
                  <CoScholasticGradeManagement />
              )}
              {activeSection === "class-co-scholastic-mapping" &&
                hasRole("academic_coordinator", "superadmin") && (
                  <ClassCoScholasticMapping />
              )}




          {/* 404 */}
          {!knownSections.includes(activeSection) && (
            <div>
              <h1>404: Page Not Found</h1>
              <p>This section does not exist.</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Bubble & Popup (unchanged) */}
      {/* … */}
    </div>
  );
};

export default Dashboard;
