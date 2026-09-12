import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

const fmt = (v) => Number(v || 0).toFixed(2);
const credits = (v) => Number(v || 0).toFixed(Number(v || 0) % 1 ? 1 : 0);

export default function CollegeCgpaWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    api.get("/college-academic-progress/my-summary")
      .then(({ data: result }) => alive && setData(result))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  if (loading) return <div className="card border-0 shadow-sm rounded-4 mb-3"><div className="card-body py-4 text-center"><span className="spinner-border spinner-border-sm me-2" />Loading SGPA / CGPA…</div></div>;
  const current = data?.current_semester;
  const has = Boolean(data?.semesters?.length);
  return <div className="card border-0 shadow-sm rounded-4 mb-3 overflow-hidden">
    <div className="card-body p-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div><div className="text-primary text-uppercase small fw-semibold">College Academic Progress</div><h2 className="h5 mb-1">Credits · SGPA · CGPA</h2><div className="text-muted small">Published credit-based semester results</div></div>
        <Link className="btn btn-sm btn-outline-primary rounded-pill" to="/college-academic-progress">View grade details</Link>
      </div>
      {has ? <div className="row g-3 mt-1">
        <div className="col-6 col-md-3"><div className="p-3 rounded-4 bg-primary-subtle"><small className="text-muted d-block">Current SGPA</small><strong className="fs-4">{fmt(current?.sgpa)}</strong></div></div>
        <div className="col-6 col-md-3"><div className="p-3 rounded-4 bg-success-subtle"><small className="text-muted d-block">Overall CGPA</small><strong className="fs-4">{fmt(data?.cgpa)}</strong></div></div>
        <div className="col-6 col-md-3"><div className="p-3 rounded-4 bg-info-subtle"><small className="text-muted d-block">Credits Earned</small><strong className="fs-4">{credits(data?.earned_credits)}</strong></div></div>
        <div className="col-6 col-md-3"><div className="p-3 rounded-4 bg-warning-subtle"><small className="text-muted d-block">Attempted</small><strong className="fs-4">{credits(data?.attempted_credits)}</strong></div></div>
      </div> : <div className="text-muted mt-3">SGPA / CGPA will appear after semester grades are published.</div>}
    </div>
  </div>;
}
