// src/App.js
import React, { useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { onMessage } from 'firebase/messaging';
import { messaging } from './firebase/firebaseConfig';

import Login from './components/Login';
import RoleAwareDashboard from './components/RoleAwareDashboard';
import EditProfile from './components/EditProfile';
import Chat from './components/Chat';
import ChatContainer from './components/ChatContainer';

import Classes from './pages/Classes';
import Subjects from './pages/Subjects';
import Student from './pages/Students';
import FeeStructure from './pages/FeeStructure';
import FeeHeadings from './pages/FeeHeadings';
import Sections from "./pages/Sections";
import Transportation from "./pages/Transportation";
import Transactions from './pages/Transactions/Transactions';
import CancelledTransactions from './pages/Transactions/CancelledTransactions';
import Schools from './pages/Schools';
import Concessions from "./pages/Concessions";
import StudentDueTable from './pages/StudentDueTable';
import FeeCategory from './pages/FeeCategory';
import DayWiseReport from './pages/DayWiseReport';
import DayWiseCategoryReports from './pages/DayWiseCategoryReports';
import SchoolFeeSummary from './pages/SchoolFeeSummary';
import ConcessionReport from './pages/ConcessionReport';
import VanFeeDetailedReport from './pages/VanFeeDetailedReport';
import UserManagement from './pages/UserManagement';
import TeacherAssignment from './pages/TeacherAssignment';
import InchargeAssignment from './pages/InchargeAssignment';
import HolidayMarking from './pages/HolidayMarking';
import Period from './pages/Period';
import Timetable from './pages/Timetable';
import CombinedTimetableAssignment from './pages/CombinedTimetableAssignment';
import TeacherTimetableDisplay from './pages/TeacherTimetableDisplay';
import StudentTimetableDisplay from './pages/StudentTimeTableDisplay';
import Substitution from './pages/substitution';
import SubstitutionList from './pages/SubstituitionListing';
import TeacherSubstitutionListing from './pages/TeacherSubstitutionListing';
import TeacherSubstitutedListing from './pages/TeacherSubstitutedListing';
import TeacherCombinedSubstitutionPage from './pages/TeacherCombinedSubstitutionPage';
import LessonPlan from './pages/LessonPlan';
import MarkAttendance from './pages/MarkAttendance';
import AttendanceCalendar from './pages/AttendanceCalendar';
import TeacherTimetableAssignment from './pages/TeacherTimetableAssignment';
import Assignments from './pages/Assignments';
import StudentAssignments from './pages/StudentAssignments';
import AssignmentMarking from './pages/AssignmentMarking';
import StudentSideAssignment from './pages/StudentSideAssignment';
import StudentFeePage from './pages/StudentFeePage';
import StudentAttendance from './pages/StudentAttendance';
import TeacherLeaveRequests from './pages/TeacherLeaveRequests';
import AttendanceSummary from './pages/AttendanceSummary';
import ReceiptPrint from "./pages/Transactions/ReceiptPage";
import CombinedCirculars from './pages/CombinedCirculars';
import ViewCirculars from './pages/ViewCirculars';
import StudentCirculars from './pages/StudentCirculars';
import StudentUserAccounts from './pages/StudentUserAccounts';
import Departments from './pages/Departments';
import EmployeeManagement from './pages/EmployeeManagement';
import EmployeeUserAccounts from './pages/EmployeeUserAccounts';
import LeaveTypeManagement from './pages/LeaveTypeManagement';
import EmployeeLeaveBalance from './pages/EmployeeLeaveBalance';
import EmployeeLeaveRequestForm from './pages/EmployeeLeaveRequestForm'; // adjust path if needed
import HRLeaveRequests from './pages/HRLeaveRequests'; // adjust path if different
import EmployeeAttendance from "./pages/EmployeeAttendance";
import EmployeeAttendanceCalendar from './pages/EmployeeAttendanceCalendar';
import EmployeeAttendanceSummary from './pages/EmployeeAttendanceSummary';
import ExamSchemeManagement from './pages/ExamSchemeManagement'; // Adjust the path if needed
import TermManagement from './pages/TermManagement';
import AssessmentComponentManagement from './pages/AssessmentComponentManagement';
import AcademicYearManagement from './pages/AcademicYearManagement';
import ExamScheduleManagement from './pages/ExamScheduleManagement'; // adjust path if needed
import ExamManagement from './pages/ExamManagement'; // ✅ Adjust path if needed
import RollNumberManagement from './pages/RollNumberManagement'; // adjust path if needed
import MarksEntry from './pages/MarksEntry'; // ✅ Add this
import ReportBuilder from './pages/ReportBuilder';
import ClasswiseResultSummary from './pages/ClasswiseResultSummary';
import ResultReportDesigner from './pages/ResultReportDesigner'; // 📄 Add this
import GradeSchemeManagement from './pages/GradeSchemeManagement'; // ✅ Add this line
import CombinedExamSchemeManagement from './pages/CombinedExamSchemeManagement'; // ✅ Add this
import FinalResultSummary from './pages/FinalResultSummary'; // ✅ Add this















function App() {
  useEffect(() => {
    const unsubscribe = onMessage(messaging, payload => {
      if (payload.notification) {
        const { title = 'Notification', body = '' } = payload.notification;
        alert(`${title}: ${body}`);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />

        {/* Everything else goes through our dashboard layout */}
        <Route element={<RoleAwareDashboard />}>
          {/* Profile & Chat */}
          <Route path="/edit-profile" element={<EditProfile />} />
          <Route path="/chat" element={<Chat chatId="chat_room_1" currentUserId={localStorage.getItem("userId")} />} />
          <Route path="/chat-container" element={<ChatContainer currentUserId={localStorage.getItem("userId")} />} />

          {/* Flat routes */}
          <Route path="/classes" element={<Classes />} />
          <Route path="/subjects" element={<Subjects />} />
          <Route path="/students" element={<Student />} />
          <Route path="/departments" element={<Departments />} />
          <Route path="/student-user-accounts" element={<StudentUserAccounts />} />

          {/* Fee & Reports */}
          <Route path="/fee-structure" element={<FeeStructure />} />
          <Route path="/fee-headings" element={<FeeHeadings />} />
          <Route path="/fee-category" element={<FeeCategory />} />
          <Route path="/student-due" element={<StudentDueTable />} />
          <Route path="/reports/day-wise" element={<DayWiseReport />} />
          <Route path="/reports/day-wise-category" element={<DayWiseCategoryReports />} />
          <Route path="/reports/school-fee-summary" element={<SchoolFeeSummary />} />
          <Route path="/reports/concession" element={<ConcessionReport />} />
          <Route path="/reports/van-fee" element={<VanFeeDetailedReport />} />

          {/* Transactions */}
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/cancelled-transactions" element={<CancelledTransactions />} />

          {/* Transport & settings */}
          <Route path="/sections" element={<Sections />} />
          <Route path="/transportation" element={<Transportation />} />
          <Route path="/schools" element={<Schools />} />
          <Route path="/concessions" element={<Concessions />} />

          {/* Academic & attendance */}
          <Route path="/teacher-assignment" element={<TeacherAssignment />} />
          <Route path="/incharge-assignment" element={<InchargeAssignment />} />
          <Route path="/exam-schemes" element={<ExamSchemeManagement />} />
          <Route path="/holiday-marking" element={<HolidayMarking />} />
          <Route path="/periods" element={<Period />} />
          <Route path="/timetable" element={<Timetable />} />
          <Route path="/combined-timetable" element={<CombinedTimetableAssignment />} />
          <Route path="/teacher-timetable-display" element={<TeacherTimetableDisplay />} />
          <Route path="/student-timetable-display" element={<StudentTimetableDisplay />} />
          <Route path="/substitution" element={<Substitution />} />
          <Route path="/substitution-listing" element={<SubstitutionList />} />
          <Route path="/teacher-substitution-listing" element={<TeacherSubstitutionListing />} />
          <Route path="/teacher-substituted-listing" element={<TeacherSubstitutedListing />} />
          <Route path="/combined-teacher-substitution" element={<TeacherCombinedSubstitutionPage />} />
          <Route path="/lesson-plan" element={<LessonPlan />} />
          <Route path="/mark-attendance" element={<MarkAttendance />} />
          <Route path="/attendance-calendar" element={<AttendanceCalendar />} />
          <Route path="/leave-requests" element={<TeacherLeaveRequests />} />
          <Route path="/attendance-summary" element={<AttendanceSummary />} />

          {/* Assignments */}
          <Route path="/assignments" element={<Assignments />} />
          <Route path="/student-assignments" element={<StudentAssignments />} />
          <Route path="/assignment-marking" element={<AssignmentMarking />} />
          <Route path="/my-assignments" element={<StudentSideAssignment />} />

          {/* Other pages */}
          <Route path="/student-fee" element={<StudentFeePage />} />
          <Route path="/student-attendance" element={<StudentAttendance />} />
          <Route path="/receipt/:slipId" element={<ReceiptPrint />} />
          <Route path="/combined-circulars" element={<CombinedCirculars />} />
          <Route path="/view-circulars" element={<ViewCirculars />} />
          <Route path="/student-circulars" element={<StudentCirculars />} />
          <Route path="/users" element={<UserManagement />} />
          <Route path="/departments" element={<Departments />} />
          <Route path="/employees" element={<EmployeeManagement />} />
          <Route path="/employee-user-accounts" element={<EmployeeUserAccounts />} />
          <Route path="/leave-types" element={<LeaveTypeManagement />} />
          <Route path="/employee-leave-balances" element={<EmployeeLeaveBalance />} />
          <Route path="/employee-leave-request" element={<EmployeeLeaveRequestForm />} />
          <Route path="/hr-leave-requests" element={<HRLeaveRequests />} />
          <Route path="/hr-leave-requests" element={<HRLeaveRequests />} />
          <Route path="/employee-attendance" element={<EmployeeAttendance />} />
          <Route path="/my-attendance-calendar" element={<EmployeeAttendanceCalendar />} />
          <Route path="/employee-attendance-summary" element={<EmployeeAttendanceSummary />} />
          <Route path="/terms" element={<TermManagement />} />
          <Route path="/assessment-components" element={<AssessmentComponentManagement />} />
          <Route path="/academic-years" element={<AcademicYearManagement />} />
          <Route path="/exam-schedules" element={<ExamScheduleManagement />} />
          <Route path="/exams" element={<ExamManagement />} />  // ✅ NEW
          <Route path="/roll-numbers" element={<RollNumberManagement />} />
          <Route path="/marks-entry" element={<MarksEntry />} />  // ✅ NEW
          <Route path="/report-builder" element={<ReportBuilder />} />
          <Route path="/reports/classwise-result-summary" element={<ClasswiseResultSummary />} />
          <Route path="/reports/result-report-designer" element={<ResultReportDesigner />} />
          <Route path="/grade-schemes" element={<GradeSchemeManagement />} />  // ✅ New route
          <Route path="/combined-exam-schemes" element={<CombinedExamSchemeManagement />} />  // ✅ NEW
          <Route path="/reports/final-result-summary" element={<FinalResultSummary />} />  // ✅ NEW


          {/* Catch all for logged‑in */}
          <Route path="*" element={<h1>404: Page Not Found</h1>} />
        </Route>

        {/* Any other URL → login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
