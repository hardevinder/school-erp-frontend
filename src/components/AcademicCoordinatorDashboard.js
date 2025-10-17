// src/components/Dashboard.jsx — polished & professional
import React, { useEffect, useMemo, useState } from "react";
import api from "../api";

// Charts
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function Dashboard() {
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());

  // Fetch attendance summary
  useEffect(() => {
    let mounted = true;
    async function fetchAttendanceSummary() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/attendance/summary/${selectedDate}`);
        if (mounted) {
          setAttendanceSummary(res.data);
          setLastRefreshed(Date.now());
        }
      } catch (err) {
        if (mounted) setError(err?.response?.data?.message || err.message || "Failed to load");
        console.error("Error fetching attendance summary:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchAttendanceSummary();
    return () => {
      mounted = false;
    };
  }, [selectedDate]);

  // Derived numbers
  const { total, absent, leaves, present } = useMemo(() => {
    let t = 0, a = 0, l = 0;
    if (attendanceSummary?.summary?.length) {
      for (const c of attendanceSummary.summary) {
        t += Number(c.total || 0);
        a += Number(c.absent || 0);
        l += Number(c.leave || 0);
      }
    }
    return { total: t, absent: a, leaves: l, present: Math.max(t - a - l, 0) };
  }, [attendanceSummary]);

  const pieData = useMemo(() => ({
    labels: ["Present", "Absent", "Leaves"],
    datasets: [
      {
        data: [present, absent, leaves],
        backgroundColor: ["#22c55e", "#ef4444", "#f59e0b"],
        borderWidth: 0,
      },
    ],
  }), [present, absent, leaves]);

  const pieOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { usePointStyle: true } },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = ctx.parsed || 0;
            const pct = total ? ((v / total) * 100).toFixed(1) : 0;
            return `${ctx.label}: ${v} (${pct}%)`;
          },
        },
      },
    },
    cutout: "55%",
  }), [total]);

  const formatTime = (ts) => new Intl.DateTimeFormat(undefined, {
    hour: "2-digit", minute: "2-digit",
  }).format(ts);

  const goToday = () => setSelectedDate(new Date().toISOString().split("T")[0]);
  const shiftDay = (delta) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  return (
    <div className="container-fluid px-3 py-2">
      {/* Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-3 rounded-4 p-3 shadow-sm" style={{
        background: "linear-gradient(135deg, #f8fafc, #eef2ff)",
        border: "1px solid #e5e7eb",
      }}>
        <div>
          <h4 className="mb-1 fw-semibold">Attendance Dashboard</h4>
          <div className="text-muted small">Last updated at {formatTime(lastRefreshed)}</div>
        </div>
        <div className="d-flex gap-2 align-items-end">
          <div>
            <label htmlFor="summaryDate" className="form-label mb-1 small text-muted">Date</label>
            <input
              id="summaryDate"
              type="date"
              className="form-control"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <div className="d-flex gap-2 pb-1">
            <button className="btn btn-outline-secondary" type="button" onClick={() => shiftDay(-1)} title="Previous day">◀</button>
            <button className="btn btn-outline-primary" type="button" onClick={goToday}>Today</button>
            <button className="btn btn-outline-secondary" type="button" onClick={() => shiftDay(1)} title="Next day">▶</button>
          </div>
        </div>
      </div>

      {/* States */}
      {loading && (
        <div className="mb-4">
          <div className="placeholder-glow">
            <div className="row g-3">
              {[...Array(4)].map((_, i) => (
                <div className="col-md-6" key={i}>
                  <div className="card border-0 shadow-sm rounded-4">
                    <div className="card-body">
                      <div className="placeholder col-6 mb-2"></div>
                      <div className="placeholder col-4" style={{height: 32}}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="alert alert-danger d-flex align-items-center" role="alert">
          <span className="me-2">⚠️</span>
          <div>
            Failed to load attendance for <strong>{selectedDate}</strong>. {error}
          </div>
          <button className="btn btn-sm btn-light ms-auto" onClick={() => setSelectedDate(selectedDate)}>Retry</button>
        </div>
      )}

      {!loading && !error && !attendanceSummary && (
        <div className="alert alert-info">No summary available for {selectedDate}.</div>
      )}

      {!loading && !error && attendanceSummary && (
        <>
          {/* KPIs + Chart */}
          <div className="row g-3 mb-4">
            <div className="col-lg-8">
              <div className="row g-3">
                {[
                  { title: "Total", value: total, sub: "All students", variant: "secondary" },
                  { title: "Present", value: present, sub: `${total ? Math.round((present/total)*100) : 0}% of total`, variant: "success" },
                  { title: "Absent", value: absent, sub: `${total ? Math.round((absent/total)*100) : 0}% of total`, variant: "danger" },
                  { title: "Leaves", value: leaves, sub: `${total ? Math.round((leaves/total)*100) : 0}% of total`, variant: "warning" },
                ].map((m, i) => (
                  <div className="col-md-6" key={i}>
                    <div className={"card border-0 shadow-sm rounded-4 h-100 " + "bg-" + m.variant + " bg-opacity-10"}
                         style={{transition: 'transform .2s'}}
                         onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                         onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}>
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <div className="text-uppercase small text-muted mb-1">{m.title}</div>
                            <div className="display-6 fw-semibold">{m.value}</div>
                          </div>
                        </div>
                        <div className="mt-2 small text-muted">{m.sub}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="col-lg-4 d-flex">
              <div className="card shadow-sm rounded-4 flex-fill">
                <div className="card-header bg-white border-0 fw-semibold">Overall — {attendanceSummary.date}</div>
                <div className="card-body" style={{height: 320}}>
                  <Pie data={pieData} options={pieOptions} />
                </div>
              </div>
            </div>
          </div>

          {/* Class & Section Breakdown */}
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h6 className="mb-0">Class & Section Breakdown</h6>
            <span className="text-muted small">{attendanceSummary.summary?.length || 0} sections</span>
          </div>
          <div className="row g-3">
            {attendanceSummary.summary.map((item) => {
              const pres = Number(item.total || 0) - (Number(item.absent || 0) + Number(item.leave || 0));
              const pPres = item.total ? Math.round((pres / item.total) * 100) : 0;
              const pAbs = item.total ? Math.round((item.absent / item.total) * 100) : 0;
              const pLev = item.total ? Math.round((item.leave / item.total) * 100) : 0;
              return (
                <div className="col-md-4" key={`${item.class_id}-${item.section_id}`}>
                  <div className="card h-100 shadow-sm rounded-4 border-0">
                    <div className="card-header bg-white border-0">
                      <div className="fw-semibold">Class {item.class_name} — Section {item.section_name}</div>
                      <div className="small text-muted">Total: {item.total}</div>
                    </div>
                    <div className="card-body pt-0">
                      <div className="mb-2 d-flex justify-content-between small"><span>Present</span><span className="fw-semibold">{pres}</span></div>
                      <div className="progress mb-3" style={{height: 8}}>
                        <div className="progress-bar bg-success" style={{width: `${pPres}%`}} aria-label="present"></div>
                      </div>

                      <div className="mb-2 d-flex justify-content-between small"><span>Absent</span><span className="fw-semibold">{item.absent}</span></div>
                      <div className="progress mb-3" style={{height: 8}}>
                        <div className="progress-bar bg-danger" style={{width: `${pAbs}%`}} aria-label="absent"></div>
                      </div>

                      <div className="mb-2 d-flex justify-content-between small"><span>Leaves</span><span className="fw-semibold">{item.leave}</span></div>
                      <div className="progress" style={{height: 8}}>
                        <div className="progress-bar bg-warning" style={{width: `${pLev}%`}} aria-label="leaves"></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
