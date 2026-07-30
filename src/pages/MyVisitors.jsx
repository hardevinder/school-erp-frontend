import React, { useCallback, useEffect, useState } from "react";
import api from "../api";

const fmt = (value) => (value ? new Date(value).toLocaleString() : "—");

export default function MyVisitors() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/visitors/my");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.response?.data?.error || "Could not load your visitors.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const post = async (id, suffix, body = {}) => {
    try {
      await api.post(`/visitors/${id}/${suffix}`, body);
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || "Visitor action failed.");
    }
  };

  return (
    <div className="container-fluid py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 className="mb-1">My Visitors</h2>
          <div className="text-muted">Respond to visitor requests and keep an accurate meeting record.</div>
        </div>
        <button className="btn btn-outline-primary" onClick={load}>Refresh</button>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? <div>Loading visitors…</div> : (
        <div className="row g-3">
          {rows.map((v) => {
            const pending = v.approval_status === "PENDING";
            const accepted = v.approval_status === "ACCEPTED";
            return (
              <div className="col-12 col-lg-6" key={v.id}>
                <div className="card h-100 shadow-sm">
                  <div className="card-body">
                    <div className="d-flex justify-content-between">
                      <h5>{v.name}</h5>
                      <span className={`badge ${accepted ? "bg-success" : pending ? "bg-warning text-dark" : "bg-danger"}`}>
                        {v.approval_status}
                      </span>
                    </div>
                    <p className="mb-2">{v.purpose}</p>
                    <div className="small text-muted">Arrived: {fmt(v.check_in_at)}</div>
                    <div className="small text-muted">Meeting started: {fmt(v.meeting_started_at)}</div>
                    <div className="small text-muted">Meeting completed: {fmt(v.meeting_ended_at)}</div>
                    <div className="d-flex gap-2 mt-3">
                      {pending && <>
                        <button className="btn btn-success" onClick={() => post(v.id, "respond", { decision: "ACCEPTED" })}>Accept</button>
                        <button className="btn btn-outline-danger" onClick={() => post(v.id, "respond", { decision: "DECLINED" })}>Decline</button>
                      </>}
                      {accepted && !v.meeting_started_at &&
                        <button className="btn btn-primary" onClick={() => post(v.id, "meeting/start")}>Start Meeting</button>}
                      {accepted && v.meeting_started_at && !v.meeting_ended_at &&
                        <button className="btn btn-primary" onClick={() => post(v.id, "meeting/end")}>Complete Meeting</button>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {!rows.length && <div className="text-muted">No visitor records found.</div>}
        </div>
      )}
    </div>
  );
}
