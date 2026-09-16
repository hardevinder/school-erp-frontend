// src/components/dashboard/roleMenuCatalog.js
// Shared Student/Teacher dashboard menu catalog.
// Keep this in sync with Sidebar.js when new role menus are introduced.

const menu = (key, label, icon, path, group, options = {}) => ({
  key,
  label,
  icon,
  path,
  group,
  ...options,
});

export const STUDENT_DASHBOARD_MENUS = [
  menu("student-home", "Dashboard Home", "bi-house-door-fill", "/dashboard", "Main", { description: "Your personal ERP overview and live school updates." }),
  menu("student-attendance", "Attendance", "bi-calendar2-check", "/student-attendance", "Main", { description: "Monthly attendance, holidays and attendance history.", schoolOnly: true }),
  menu("student-lecture-attendance", "Lecture Attendance", "bi-person-check", "/student-lecture-attendance", "Main", { description: "Subject-wise lecture attendance and shortage status.", collegeOnly: true }),
  menu("student-timetable", "Timetable", "bi-clock-history", "/student-timetable-display", "Main", { description: "Today’s periods, teachers and schedule." }),
  menu("student-circulars", "Circulars", "bi-megaphone-fill", "/student-circulars", "Main", { description: "Latest notices, circulars and announcements." }),
  menu("student-fee", "Fees", "bi-wallet2", "/student-fee", "Main", { description: "Fee dues, concessions, receipts and payment details." }),
  menu("student-messages", "Messages", "bi-envelope-fill", "/messages", "Communication", { description: "Messages and conversations with your institution." }),
  menu("student-chat", "Chat", "bi-chat-dots-fill", "/chat", "Communication", { description: "Quick chat and help conversations." }),
  menu("student-school-chat", "Secure School Chat", "bi-shield-lock-fill", "/school-chat", "Communication", { description: "Secure role-based school communication." }),
  menu("student-support", "Help & Support", "bi-life-preserver", "/support", "Communication", { description: "Raise and track EduBridge support requests." }),

  menu("student-assessments", "Tests & Results", "bi-clipboard2-check-fill", "/assessments", "Learning", { description: "Take assessments and view published results." }),
  menu("student-lms-assignments", "Assignments & Submissions", "bi-journal-check", "/assessments?assessment_type=assignment", "Learning", { description: "LMS assignments, submissions, marks and feedback." }),
  menu("student-legacy-assignments", "Legacy Assignments", "bi-archive-fill", "/my-assignments", "Learning", { description: "Earlier assignments, due dates and grades." }),
  menu("student-online-classes", "Online Classes", "bi-camera-video-fill", "/online-classes", "Learning", { description: "View and join live online classes." }),
  menu("student-diary", "My Diary", "bi-journal-text", "/student-diary", "Learning", { description: "Classwork, homework and diary updates." }),
  menu("student-lesson-plans", "Learning Plans", "bi-journal-bookmark-fill", "/student-lesson-plans", "Learning", { description: "Published lesson plans, homework and evaluations." }),
  menu("student-learning-resources", "Learning Resources", "bi-collection-play-fill", "/learning-resources", "Learning", { description: "Notes, PDFs, study material and learning links." }),
  menu("student-library", "My Library", "bi-journal-bookmark", "/my-library", "Learning", { description: "Issued books, due dates and library activity." }),
  menu("student-entrance-exam", "Entrance Exam", "bi-ui-checks-grid", "/entrance-exam", "Learning", { description: "Start or continue assigned entrance assessments." }),
  menu("student-academic-calendar", "Academic Calendar", "bi-calendar3", "/academic-calendar-view", "Learning", { description: "Academic events, holidays, tests and key dates." }),
  menu("student-clubs", "My Clubs & Activities", "bi-trophy-fill", "/clubs-activities", "Learning", { description: "Clubs, houses, activities and participation." }),

  menu("student-activities", "Activities & Achievements", "bi-award-fill", "/student/activities-achievements", "Student Life", { description: "Your participation, awards and achievements." }),
  menu("student-documents", "My Documents", "bi-person-vcard-fill", "/document-vault", "Student Life", { description: "Access your approved institutional documents." }),
  menu("student-growth", "My Growth & Recognition", "bi-stars", "/anecdotal-records", "Student Life", { description: "Recognition, observations and growth records." }),
  menu("student-readiness", "My Daily Readiness", "bi-check2-circle", "/daily-readiness", "Student Life", { description: "Daily readiness, hygiene and wellbeing records." }),
  menu("student-lost-found", "Lost & Found", "bi-search", "/lost-found", "Student Life", { description: "Report or check lost and found items." }),
  menu("student-grievance", "Report & Support", "bi-shield-lock-fill", "/student-grievances", "Student Life", { description: "Confidential grievance, safety and support channel." }),
  menu("student-mentoring", "My Mentor & Support", "bi-person-heart", "/student-mentoring", "Student Life", { description: "Mentor updates, follow-ups and student support." }),
  menu("student-scholarships", "My Scholarships", "bi-award", "/scholarships", "Student Life", { description: "Scholarships, financial aid and application status." }),
  menu("student-alumni", "Alumni Network & Mentors", "bi-mortarboard-fill", "/alumni-engagement", "Student Life", { description: "Connect with alumni, mentors and community." }),

  menu("student-subject-registration", "Subject Registration", "bi-ui-checks-grid", "/college-subject-registration", "College", { collegeOnly: true, description: "Choose electives and semester subject options." }),
  menu("student-college-exams", "Internal + External Exams", "bi-journal-check", "/college-examinations", "College", { collegeOnly: true, description: "College examination schedules, components and results." }),
  menu("student-academic-progress", "Credits · SGPA · CGPA", "bi-award-fill", "/college-academic-progress", "College", { collegeOnly: true, description: "Credits, semester performance and cumulative progress." }),
  menu("student-certificates", "My Certificates & Requests", "bi-file-earmark-check-fill", "/college-student-requests", "College", { collegeOnly: true, description: "Request documents and track issue status." }),
  menu("student-internship", "My Internship", "bi-building-check", "/college-internships", "College", { collegeOnly: true, description: "Internship logbook, mentor feedback and evaluation." }),
  menu("student-projects", "Projects / Dissertation", "bi-kanban-fill", "/college-projects", "College", { collegeOnly: true, description: "Milestones, submissions, guide feedback and viva." }),
  menu("student-360", "360° Student Profile", "bi-person-bounding-box", "/college-student-360", "College", { collegeOnly: true, description: "Complete college academic and student profile." }),
  menu("student-enrollment", "University Enrollment", "bi-person-vcard-fill", "/college-enrollment", "College", { collegeOnly: true, description: "University registration and enrollment status." }),
  menu("student-graduation", "Graduation & Degree", "bi-mortarboard-fill", "/college-graduation", "College", { collegeOnly: true, description: "Eligibility, no-dues, convocation and degree status." }),
  menu("student-grade-cards", "Grade Card · Transcript", "bi-file-earmark-bar-graph-fill", "/college-grade-cards", "College", { collegeOnly: true, description: "Semester grade cards and transcript access." }),
  menu("student-backlogs", "Backlog / Reappear", "bi-arrow-counterclockwise", "/college-backlogs", "College", { collegeOnly: true, description: "Backlog subjects and reappear status." }),
  menu("student-placement", "Placement & Career", "bi-briefcase-fill", "/placement-cell", "College", { collegeOnly: true, description: "Placement opportunities and career activity." }),
  menu("student-hostel", "My Hostel", "bi-building-fill-gear", "/college-hostel", "College", { collegeOnly: true, description: "Room, outings, complaints and hostel charges." }),
  menu("student-leave", "My Leave & On-Duty", "bi-calendar2-check-fill", "/college-student-leave", "College", { collegeOnly: true, description: "Request leave or on-duty and track approval." }),
];

export const TEACHER_DASHBOARD_MENUS = [
  menu("teacher-home", "Dashboard Home", "bi-speedometer2", "/dashboard", "Main", { description: "Your live teaching, attendance and school overview." }),
  menu("teacher-actions", "My Actions", "bi-inboxes-fill", "/action-inbox", "Main", { description: "Tasks, approvals and action items assigned to you." }),
  menu("teacher-circulars", "Circulars", "bi-megaphone-fill", "/view-circulars", "Main", { description: "Latest staff notices and institutional circulars." }),
  menu("teacher-school-chat", "Secure School Chat", "bi-chat-dots-fill", "/school-chat", "Main", { teacherOnly: true, description: "Secure role-based school communication." }),
  menu("teacher-messages", "Messages", "bi-envelope-fill", "/messages", "Main", { teacherOnly: true, description: "Messages and communication with school users." }),
  menu("teacher-support", "Help & Support", "bi-life-preserver", "/support", "Main", { description: "Raise and track EduBridge support requests." }),

  menu("teacher-mark-attendance", "Mark Attendance", "bi-check2-square", "/mark-attendance", "Daily Work", { description: "Mark or update attendance for your class." }),
  menu("teacher-bulk-attendance", "Bulk Attendance Upload", "bi-upload", "/attendance-entry", "Daily Work", { description: "Upload attendance in bulk for faster entry." }),
  menu("teacher-attendance-calendar", "Attendance Calendar", "bi-calendar2-check", "/attendance-calendar", "Daily Work", { description: "Review class attendance in calendar view." }),
  menu("teacher-timetable", "Timetable", "bi-table", "/teacher-timetable-display", "Daily Work", { description: "Your periods, subjects and daily teaching schedule." }),
  menu("teacher-substitutions", "My Substitutions", "bi-arrow-repeat", "/combined-teacher-substitution", "Daily Work", { description: "Covering and freed periods with substitutions." }),
  menu("teacher-ptm", "PTM Feedback", "bi-people-fill", "/ptm-management", "Daily Work", { description: "Record and review parent-teacher meeting feedback." }),
  menu("teacher-visitors", "My Visitors", "bi-person-badge-fill", "/my-visitors", "Daily Work", { description: "View visitor appointments linked to you." }),
  menu("teacher-department", "Department Management", "bi-building-gear", "/department-management", "Daily Work", { description: "Department tasks, events, duties and monitoring." }),
  menu("teacher-documents", "My Documents", "bi-person-vcard", "/document-vault", "Daily Work", { description: "Your institutional and staff documents." }),
  menu("teacher-anecdotal", "Anecdotal Records", "bi-journal-check", "/anecdotal-records", "Daily Work", { description: "Record student observations and recognition." }),
  menu("teacher-readiness", "Daily Readiness & Hygiene", "bi-clipboard2-check", "/daily-readiness", "Daily Work", { description: "Track daily readiness and hygiene observations." }),
  menu("teacher-lost-found", "Lost & Found", "bi-search", "/lost-found", "Daily Work", { description: "Report and manage lost and found items." }),
  menu("teacher-growth", "My Professional Growth", "bi-graph-up-arrow", "/teacher-performance", "Daily Work", { description: "Performance indicators and professional growth." }),
  menu("teacher-leadership", "My Leadership & Responsibilities", "bi-person-workspace", "/staff-leadership", "Daily Work", { description: "Leadership roles, duties and responsibilities." }),
  menu("teacher-house-duty", "My House Duties & Assembly", "bi-flag-fill", "/house-duty", "Daily Work", { description: "House, assembly and co-curricular responsibilities." }),

  menu("teacher-assessments", "Assessments & Tests", "bi-clipboard2-check-fill", "/assessments", "Learning", { description: "Create tests, evaluate work and publish results." }),
  menu("teacher-lms-assignments", "LMS Assignments", "bi-journal-check", "/assessments?assessment_type=assignment", "Learning", { description: "Create and manage LMS assignments and submissions." }),
  menu("teacher-legacy-assignments", "Legacy Assignments", "bi-clipboard-fill", "/assignments", "Learning", { description: "Manage earlier assignment workflow." }),
  menu("teacher-assignment-marking", "Assignment Marking", "bi-pencil-square", "/assignment-marking", "Learning", { description: "Review submissions and record marks or feedback." }),
  menu("teacher-online-classes", "Online Classes", "bi-camera-video-fill", "/online-classes", "Learning", { description: "Schedule, start and manage live online classes." }),
  menu("teacher-lesson-plan", "Lesson Plan", "bi-journal-richtext", "/lesson-plan", "Learning", { description: "Plan lessons and track classroom delivery." }),
  menu("teacher-syllabus", "Syllabus Breakdown", "bi-diagram-3-fill", "/syllabus-breakdown", "Learning", { description: "Break up syllabus and track completion." }),
  menu("teacher-admission-syllabus", "Admission Syllabus", "bi-journal-check", "/admission-syllabus", "Learning", { description: "Manage admission or entrance syllabus content." }),
  menu("teacher-diary", "Digital Diary", "bi-journal-bookmark-fill", "/digital-diary", "Learning", { description: "Classwork, homework, diary notes and attachments." }),
  menu("teacher-learning-resources", "Learning Resources", "bi-collection-play-fill", "/learning-resources", "Learning", { description: "Upload notes, PDFs, study material and links." }),
  menu("teacher-library", "My Library", "bi-journal-bookmark", "/my-library", "Learning", { description: "Your issued books and library activity." }),
  menu("teacher-notebook", "Notebook / Copy Checking", "bi-journal-check", "/notebook-checking", "Learning", { schoolOnly: true, description: "Track notebook checking, corrections and verification." }),
  menu("teacher-clubs", "Clubs, Houses & Activities", "bi-trophy-fill", "/clubs-activities", "Learning", { description: "Student clubs, houses, activities and results." }),
  menu("teacher-mentoring", "Student Mentoring & Support", "bi-person-heart", "/student-mentoring", "Learning", { description: "Mentor follow-ups and student support records." }),

  menu("teacher-classes", "Classes", "bi-list-task", "/classes", "Academic", { description: "View class structure used across academic modules." }),
  menu("teacher-subjects", "Subjects", "bi-book-fill", "/subjects", "Academic", { description: "View and work with institutional subjects." }),
  menu("teacher-roll-numbers", "Roll Numbers", "bi-list-ol", "/roll-numbers", "Examination", { description: "Review examination roll number setup." }),
  menu("teacher-marks", "Marks Entry", "bi-pencil-square", "/marks-entry", "Examination", { description: "Enter and update student marks." }),
  menu("teacher-health-details", "Health Details", "bi-heart-pulse-fill", "/report-card-health", "Examination", { description: "Enter report-card health and physical details." }),
  menu("teacher-class-result", "Class Result", "bi-bar-chart-fill", "/reports/classwise-result-summary", "Examination", { description: "Review class-wise result summaries." }),
  menu("teacher-final-result", "Final Result Summary", "bi-bar-chart-line-fill", "/reports/final-result-summary", "Examination", { description: "Review consolidated final result summaries." }),
  menu("teacher-coscholastic", "Co-Scholastic Entry", "bi-stars", "/co-scholastic-entry", "Examination", { description: "Record co-scholastic grades and observations." }),
  menu("teacher-remarks", "Student Remarks Entry", "bi-chat-square-text-fill", "/student-remarks-entry", "Examination", { description: "Enter report-card remarks for students." }),
  menu("teacher-promotion", "Promotion Decisions", "bi-person-check-fill", "/student-promotion-decision-entry", "Examination", { description: "Record promotion or retention decisions." }),
  menu("teacher-report-cards", "Print Report Cards", "bi-printer-fill", "/report-card-generator", "Examination", { description: "Generate and print student report cards." }),

  menu("teacher-leave-request", "Request Leave", "bi-box-arrow-in-down-left", "/employee-leave-request", "My HR", { description: "Apply for staff leave." }),
  menu("teacher-leave-list", "Leave Requests", "bi-envelope-paper-fill", "/leave-requests", "My HR", { description: "Review your leave request history and status." }),
  menu("teacher-my-attendance", "My Attendance", "bi-calendar2-week", "/my-attendance-calendar", "My HR", { description: "View your own attendance calendar." }),
  menu("teacher-payslips", "My Payslips", "bi-receipt-cutoff", "/my-payslips", "My HR", { description: "Access available salary slips." }),
  menu("teacher-academic-calendar", "Academic Calendar", "bi-calendar3", "/academic-calendar-view", "My HR", { description: "Teaching days, holidays, events and examinations." }),

  menu("teacher-internship", "Internship Management", "bi-building-check", "/college-internships", "College", { collegeOnly: true, description: "Track student internships, logbooks and feedback." }),
  menu("teacher-projects", "Projects / Dissertation", "bi-kanban-fill", "/college-projects", "College", { collegeOnly: true, description: "Guide projects, milestones, submissions and viva." }),
  menu("teacher-research", "Research & Publications", "bi-journal-richtext", "/research-publications", "College", { collegeOnly: true, description: "Research, publications and R&D activity." }),
  menu("teacher-naac", "NAAC / IQAC", "bi-award-fill", "/naac-iqac", "College", { collegeOnly: true, description: "Quality, accreditation and IQAC evidence." }),
  menu("teacher-workload", "Faculty Workload", "bi-person-workspace", "/college-faculty-workload", "College", { collegeOnly: true, description: "Teaching load and faculty workload overview." }),
  menu("teacher-lecture-attendance", "Lecture Attendance", "bi-person-check", "/lecture-attendance", "College", { collegeOnly: true, description: "Record and review lecture-wise attendance." }),
  menu("teacher-alumni", "Alumni & Engagement", "bi-mortarboard-fill", "/alumni-engagement", "College", { collegeOnly: true, description: "Alumni engagement and mentoring activity." }),
];

export function getRoleDashboardMenus(role, isCollege) {
  const normalized = String(role || "").toLowerCase();
  const source =
    normalized === "student"
      ? STUDENT_DASHBOARD_MENUS
      : ["teacher", "department_hod"].includes(normalized)
      ? TEACHER_DASHBOARD_MENUS
      : [];

  return source.filter((item) => {
    if (item.collegeOnly && !isCollege) return false;
    if (item.schoolOnly && isCollege) return false;
    if (item.teacherOnly && normalized === "department_hod") return false;
    return true;
  });
}
