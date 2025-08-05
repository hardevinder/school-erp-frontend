// src/pages/CancelledTransactions.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import api from "../../api";
import Swal from "sweetalert2";
import { useRoles } from "../../hooks/useRoles";
import dayjs from "dayjs";

const DEFAULT_PAGE_SIZE = 20;

const CancelledTransactions = () => {
  const { roles } = useRoles();
  const canRestore = roles.includes("admin") || roles.includes("superadmin");
  const canDeleteForever = roles.includes("superadmin");

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [minAmt, setMinAmt] = useState("");
  const [maxAmt, setMaxAmt] = useState("");

  // Pagination
  const [page, setPage] = useState(1);

  // Detail drawer
  const [showDetail, setShowDetail] = useState(false);
  const [activeTxn, setActiveTxn] = useState(null);

  const queryParams = useMemo(() => {
    const params = { page, limit: DEFAULT_PAGE_SIZE };
    if (search.trim()) params.search = search.trim();
    if (fromDate) params.from = fromDate;
    if (toDate) params.to = toDate;
    if (minAmt) params.minAmt = minAmt;
    if (maxAmt) params.maxAmt = maxAmt;
    return params;
  }, [page, search, fromDate, toDate, minAmt, maxAmt]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/transactions/cancelled", { params: queryParams });
      console.log("CANCELLED RESPONSE SAMPLE:", data.rows?.[0]); // debug
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch (err) {
      Swal.fire("Error", "Failed to load cancelled transactions", "error");
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---- helpers ----
  const ensureId = (txn) => {
    if (!txn?.id) {
      console.error("Row without id:", txn);
      Swal.fire("Error", "Invalid transaction id (backend didn't send id).", "error");
      return null;
    }
    return txn.id;
  };

  const axiosError = (err, fallback) =>
    Swal.fire("Error", err?.response?.data?.message || fallback, "error");

  // ---- actions ----
  const restoreTxn = async (txn) => {
    const id = ensureId(txn);
    if (!id) return;

    const res = await Swal.fire({
      title: "Restore this transaction?",
      text: "It will appear again in all reports.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, restore",
    });
    if (!res.isConfirmed) return;

    try {
      await api.patch(`/transactions/${id}/restore`);
      Swal.fire("Restored!", "Transaction has been restored.", "success");
      fetchData();
    } catch (err) {
      axiosError(err, "Could not restore.");
    }
  };

  const deleteForever = async (txn) => {
    const id = ensureId(txn);
    if (!id) return;

    const res = await Swal.fire({
      title: "Delete permanently?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Yes, delete permanently",
    });
    if (!res.isConfirmed) return;

    try {
      await api.delete(`/transactions/${id}`);
      Swal.fire("Deleted!", "Transaction removed permanently.", "success");
      fetchData();
    } catch (err) {
      axiosError(err, "Could not delete.");
    }
  };

  // ---- UI helpers ----
  const openDetail = (txn) => {
    setActiveTxn(txn);
    setShowDetail(true);
  };

  const closeDetail = () => {
    setActiveTxn(null);
    setShowDetail(false);
  };

  const totalPages = Math.ceil(total / DEFAULT_PAGE_SIZE) || 1;

  const clearFilters = () => {
    setSearch("");
    setFromDate("");
    setToDate("");
    setMinAmt("");
    setMaxAmt("");
    setPage(1);
  };

  return (
    <div className="container-fluid mt-3">
      <h2 className="mb-3">Cancelled Transactions</h2>

      {/* Filters */}
      <div className="card mb-3 shadow-sm">
        <div className="card-body row gy-2 gx-3 align-items-end">
          <div className="col-md-3">
            <label className="form-label">Search (Student / Admission / Receipt #)</label>
            <input
              className="form-control"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Type & press Enter"
              onKeyDown={(e) => e.key === "Enter" && fetchData()}
            />
          </div>

          <div className="col-md-2">
            <label className="form-label">From Date</label>
            <input
              type="date"
              className="form-control"
              value={fromDate}
              onChange={(e) => {
                setPage(1);
                setFromDate(e.target.value);
              }}
            />
          </div>

          <div className="col-md-2">
            <label className="form-label">To Date</label>
            <input
              type="date"
              className="form-control"
              value={toDate}
              onChange={(e) => {
                setPage(1);
                setToDate(e.target.value);
              }}
            />
          </div>

          <div className="col-md-2">
            <label className="form-label">Min Amount</label>
            <input
              type="number"
              className="form-control"
              value={minAmt}
              onChange={(e) => {
                setPage(1);
                setMinAmt(e.target.value);
              }}
            />
          </div>

          <div className="col-md-2">
            <label className="form-label">Max Amount</label>
            <input
              type="number"
              className="form-control"
              value={maxAmt}
              onChange={(e) => {
                setPage(1);
                setMaxAmt(e.target.value);
              }}
            />
          </div>

          <div className="col-md-1 d-grid">
            <button className="btn btn-outline-secondary" onClick={clearFilters}>
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-responsive" style={{ maxHeight: "70vh", overflow: "auto" }}>
        <table className="table table-hover table-sm mb-0">
          <thead className="table-light sticky-top" style={{ top: 0, zIndex: 1 }}>
            <tr>
              <th>#</th>
              <th>Receipt No</th>
              <th>Student</th>
              <th>Admission No</th>
              <th>Amount (₹)</th>
              <th>Cancelled At</th>
              <th>Cancelled By</th>
              <th style={{ width: 160 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="8" className="text-center py-4">
                  Loading...
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan="8" className="text-center py-4">
                  No cancelled transactions found.
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((txn, i) => (
                <tr key={txn.id ?? i} className="align-middle">
                  <td>{(page - 1) * DEFAULT_PAGE_SIZE + i + 1}</td>
                  <td>
                    <button
                      className="btn btn-link p-0"
                      onClick={() => openDetail(txn)}
                      style={{ fontSize: "0.9rem" }}
                    >
                      {txn.receipt_no || txn.id}
                    </button>
                  </td>
                  <td>{txn.student_name}</td>
                  <td>{txn.admission_number}</td>
                  <td>{Number(txn.amount || 0).toLocaleString("en-IN")}</td>
                  <td>
                    {txn.cancelled_at
                      ? dayjs(txn.cancelled_at).format("DD MMM YYYY HH:mm")
                      : "-"}
                  </td>
                  <td>{txn.cancelled_by || "-"}</td>
                  <td>
                    {canRestore && (
                      <button
                        className="btn btn-success btn-sm me-2"
                        onClick={() => restoreTxn(txn)}
                      >
                        Restore
                      </button>
                    )}
                    {canDeleteForever && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteForever(txn)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="d-flex justify-content-between align-items-center mt-2">
        <span className="text-muted">
          Showing {(page - 1) * DEFAULT_PAGE_SIZE + 1}–
          {Math.min(page * DEFAULT_PAGE_SIZE, total)} of {total}
        </span>
        <div className="btn-group">
          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ‹ Prev
          </button>
          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next ›
          </button>
        </div>
      </div>

      {/* Detail Offcanvas */}
      {showDetail && activeTxn && (
        <div className="offcanvas offcanvas-end show" style={{ visibility: "visible", width: 420, background: "#fff" }}>
          <div className="offcanvas-header">
            <h5 className="offcanvas-title">Txn #{activeTxn.receipt_no || activeTxn.id}</h5>
          </div>
          <div className="offcanvas-body small">
            <dl className="row">
              <dt className="col-5">Student</dt>
              <dd className="col-7">{activeTxn.student_name}</dd>

              <dt className="col-5">Admission No</dt>
              <dd className="col-7">{activeTxn.admission_number}</dd>

              <dt className="col-5">Amount</dt>
              <dd className="col-7">₹{Number(activeTxn.amount || 0).toLocaleString("en-IN")}</dd>

              <dt className="col-5">Paid On</dt>
              <dd className="col-7">
                {activeTxn.paid_at ? dayjs(activeTxn.paid_at).format("DD MMM YYYY HH:mm") : "-"}
              </dd>

              <dt className="col-5">Cancelled On</dt>
              <dd className="col-7">
                {activeTxn.cancelled_at
                  ? dayjs(activeTxn.cancelled_at).format("DD MMM YYYY HH:mm")
                  : "-"}
              </dd>

              <dt className="col-5">Cancelled By</dt>
              <dd className="col-7">{activeTxn.cancelled_by || "-"}</dd>

              <dt className="col-5">Reason</dt>
              <dd className="col-7">{activeTxn.cancel_reason || "-"}</dd>
            </dl>

            <hr />
            <h6>Fee Heads</h6>
            <ul className="list-group list-group-flush mb-3">
              {(activeTxn.items || []).map((it) => (
                <li key={it.id} className="list-group-item d-flex justify-content-between">
                  <span>{it.fee_heading_name}</span>
                  <span>₹{Number(it.amount || 0).toLocaleString("en-IN")}</span>
                </li>
              ))}
            </ul>

            <div className="d-flex gap-2">
              {canRestore && (
                <button className="btn btn-success btn-sm flex-fill" onClick={() => restoreTxn(activeTxn)}>
                  Restore
                </button>
              )}
              {canDeleteForever && (
                <button className="btn btn-danger btn-sm flex-fill" onClick={() => deleteForever(activeTxn)}>
                  Delete
                </button>
              )}
              <button className="btn btn-outline-secondary btn-sm flex-fill" onClick={closeDetail}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {showDetail && (
        <div className="offcanvas-backdrop fade show" onClick={closeDetail} style={{ cursor: "pointer" }} />
      )}
    </div>
  );
};

export default CancelledTransactions;
