import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

const money = (v) =>
  `₹${Number(v || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const rowsFrom = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
};

export default function TransportFeeCollection() {
  const [rows, setRows] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [sessionName, setSessionName] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [amounts, setAmounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await api.get("/transport/pending-per-head", {
        params: { includeZeroPending: false },
      });
      setRows(rowsFrom(res.data));
      setSessionId(res.data?.session_id || null);
      setSessionName(res.data?.session_name || "");
    } catch (e) {
      setRows([]);
      setMessage(e?.response?.data?.message || "Unable to load transport pending fees.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = rows.filter((r) => Number(r.totalPending || 0) > 0);
    if (!q) return base;
    return base.filter((r) =>
      [r.name, r.admission_number, r.routeName, r.routeNumber]
        .map((v) => String(v || "").toLowerCase())
        .some((v) => v.includes(q))
    );
  }, [rows, search]);

  const chooseStudent = (student) => {
    setSelected(student);
    const next = {};
    (student.heads || []).forEach((h) => {
      const pending = Number(
        h.pendingTillDate ?? h.pending_till_date ?? h.pending ?? 0
      );
      if (pending > 0) next[String(h.fee_heading_id)] = pending;
    });
    setAmounts(next);
    setMessage("");
  };

  const total = useMemo(
    () =>
      Object.values(amounts).reduce(
        (sum, value) => sum + Math.max(0, Number(value || 0)),
        0
      ),
    [amounts]
  );

  const submit = async () => {
    if (!selected) return;

    const heads = (selected.heads || []).filter(
      (h) => Number(amounts[String(h.fee_heading_id)] || 0) > 0
    );

    if (!heads.length) {
      setMessage("Enter at least one transport fee amount.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");

      const transactions = heads.map((h) => ({
        AdmissionNumber: selected.admission_number,
        Student_ID: selected.student_id,
        Class_ID: selected.class_id || null,
        Section_ID: null,
        DateOfTransaction: `${yyyy}-${mm}-${dd}T12:00:00`,
        Fee_Head: h.fee_heading_id,
        Fee_Recieved: 0,
        Concession: 0,
        VanFee: Number(amounts[String(h.fee_heading_id)] || 0),
        Van_Fee_Concession: 0,
        Route_ID: Number(h.route_id || selected.route_id || 0) || null,
        PaymentMode: "Cash",
        Fine_Amount: 0,
        session_id: sessionId,
        Remarks: "Transport fee collection",
      }));

      const res = await api.post("/transactions/bulk", { transactions });
      const slip = res.data?.slipId || res.data?.slip_id;

      setMessage(
        slip
          ? `Transport fee collected successfully. Slip ID: ${slip}`
          : "Transport fee collected successfully."
      );
      setSelected(null);
      setAmounts({});
      await load();
    } catch (e) {
      setMessage(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          "Transport fee collection failed."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-fluid px-4 py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h2 className="mb-1">Collect Transport Fee</h2>
          <div className="text-muted">
            Transport-only collection {sessionName ? `· ${sessionName}` : ""}
          </div>
        </div>
        <Link to="/transport-dashboard" className="btn btn-outline-secondary">
          Back to Transport
        </Link>
      </div>

      {message ? (
        <div className={`alert ${message.includes("successfully") ? "alert-success" : "alert-warning"}`}>
          {message}
        </div>
      ) : null}

      <div className="row g-4">
        <div className="col-12 col-lg-5">
          <div className="card shadow-sm border-0 rounded-4">
            <div className="card-body">
              <input
                className="form-control mb-3"
                placeholder="Search student / admission no. / route"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              {loading ? (
                <div className="py-4 text-center">Loading pending transport fees…</div>
              ) : (
                <div style={{ maxHeight: 560, overflowY: "auto" }}>
                  {filtered.map((r) => (
                    <button
                      type="button"
                      key={r.student_id}
                      className={`btn w-100 text-start border rounded-3 mb-2 p-3 ${
                        selected?.student_id === r.student_id ? "btn-primary" : "btn-light"
                      }`}
                      onClick={() => chooseStudent(r)}
                    >
                      <div className="fw-semibold">{r.name || "Student"}</div>
                      <div className="small">
                        {r.admission_number || "—"} · {r.routeName || r.routeNumber || "No route"}
                      </div>
                      <div className="small fw-semibold mt-1">
                        Pending: {money(r.totalPendingTillDate ?? r.totalPending)}
                      </div>
                    </button>
                  ))}

                  {!filtered.length ? (
                    <div className="text-muted text-center py-4">
                      No pending transport fee found.
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-7">
          <div className="card shadow-sm border-0 rounded-4">
            <div className="card-body">
              {!selected ? (
                <div className="text-muted py-5 text-center">
                  Select a student to collect transport fee.
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    <div className="h5 mb-1">{selected.name}</div>
                    <div className="text-muted">
                      {selected.admission_number} · {selected.routeName || selected.routeNumber || "No route"}
                    </div>
                  </div>

                  {(selected.heads || [])
                    .filter(
                      (h) =>
                        Number(
                          h.pendingTillDate ??
                            h.pending_till_date ??
                            h.pending ??
                            0
                        ) > 0
                    )
                    .map((h) => {
                      const key = String(h.fee_heading_id);
                      const pending = Number(
                        h.pendingTillDate ??
                          h.pending_till_date ??
                          h.pending ??
                          0
                      );

                      return (
                        <div className="border rounded-3 p-3 mb-3" key={key}>
                          <div className="d-flex justify-content-between gap-3 mb-2">
                            <div>
                              <div className="fw-semibold">
                                {h.fee_heading_name || `Fee Head ${key}`}
                              </div>
                              <div className="small text-muted">
                                Expected {money(h.due)} · Received {money(h.paid)}
                              </div>
                            </div>
                            <span className="badge text-bg-warning h-100">
                              Due {money(pending)}
                            </span>
                          </div>

                          <label className="form-label mb-1">Amount to receive</label>
                          <input
                            type="number"
                            min="0"
                            max={pending}
                            step="0.01"
                            className="form-control"
                            value={amounts[key] ?? ""}
                            onChange={(e) => {
                              const value = Math.min(
                                pending,
                                Math.max(0, Number(e.target.value || 0))
                              );
                              setAmounts((prev) => ({ ...prev, [key]: value }));
                            }}
                          />
                        </div>
                      );
                    })}

                  <div className="d-flex justify-content-between align-items-center border-top pt-3">
                    <div>
                      <div className="text-muted small">Payment mode</div>
                      <div className="fw-semibold">Cash</div>
                    </div>
                    <div className="text-end">
                      <div className="text-muted small">Total to receive</div>
                      <div className="h4 mb-0">{money(total)}</div>
                    </div>
                  </div>

                  <button
                    className="btn btn-success w-100 mt-3 py-2"
                    disabled={saving || total <= 0}
                    onClick={submit}
                  >
                    {saving ? "Saving…" : "Collect Transport Fee"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
