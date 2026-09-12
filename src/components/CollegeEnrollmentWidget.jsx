import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import "../pages/CollegeUniversityEnrollment.css";

export default function CollegeEnrollmentWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api.get("/college-enrollment/my")
      .then(({ data: d }) => active && setData(d || {}))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);
  if (loading) return null;
  const x = data?.identity || {};
  return <div className="cue-enrollment-widget mb-3">
    <div className="d-flex justify-content-between align-items-start gap-3 mb-3"><div><div className="text-primary text-uppercase small fw-semibold">College Academic Identity</div><h2 className="h5 mb-1">University Registration · Enrollment</h2><div className="text-muted small">Verified university and enrollment identifiers</div></div><span className={`badge rounded-pill text-bg-${x.verification_status === "verified" ? "success" : x.verification_status === "needs_review" ? "danger" : "warning"}`}>{x.verification_status === "verified" ? "Verified" : x.verification_status === "needs_review" ? "Needs Review" : "Draft"}</span></div>
    <div className="grid"><div className="item"><span>University Registration</span><strong>{x.university_registration_number || "Not added"}</strong></div><div className="item"><span>Enrollment No.</span><strong>{x.enrollment_number || "Not added"}</strong></div><div className="item"><span>University Roll No.</span><strong>{x.university_roll_number || "Not added"}</strong></div></div>
    <div className="mt-3"><Link to="/college-enrollment" className="btn btn-sm btn-outline-primary">View Academic Identity</Link></div>
  </div>;
}
