// TeacherDashboard.jsx
import LatestLeaveRequests from "../pages/LatestLeaveRequests";

// ... existing code ...

{activeSection === "dashboard" && (
  <div className="row">
    <div className="col-12 mb-4">
      <h2 className="mb-3">Latest Circulars</h2>
      <LatestTeacherCirculars />
    </div>
    <div className="col-12 mb-4">
      <h2 className="mb-3">Latest Substitutions</h2>
      <LatestTeacherSubstitutions />
    </div>
    <div className="col-12 mb-4">
      <h2 className="mb-3">Latest Leave Requests</h2>
      <LatestLeaveRequests leaveUpdateTrigger={leaveUpdateTrigger} />
    </div>
  </div>
)}
