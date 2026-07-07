import React, { useEffect, useMemo, useState } from "react";
import { IMaskInput } from "react-imask";
import api from "../api"; // Custom Axios instance
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";
import "./Periods.css";

const Periods = () => {
  const [periods, setPeriods] = useState([]);

  // For create/edit
  const [newPeriod, setNewPeriod] = useState({
    period_name: "",
    start_time: { time: "08:00", meridiem: "AM" },
    end_time: { time: "12:00", meridiem: "PM" },
  });
  const [editingPeriod, setEditingPeriod] = useState(null);

  // UI
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  /* ============================
     Helpers: time conversions
  ============================ */
  // 12h -> "HH:mm:ss"
  const convert12to24 = (timeStr, meridiem) => {
    if (!timeStr) return "00:00:00";
    const [hStr = "00", mStr = "00"] = String(timeStr).split(":");
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10) || 0;

    if (meridiem === "AM") {
      if (h === 12) h = 0;
    } else if (meridiem === "PM") {
      if (h !== 12) h += 12;
    }
    const HH = String(isNaN(h) ? 0 : h).padStart(2, "0");
    const MM = String(isNaN(m) ? 0 : m).padStart(2, "0");
    return `${HH}:${MM}:00`;
  };

  // "HH:mm" | "HH:mm:ss" -> { time: "hh:mm", meridiem: "AM"|"PM" }
  const convert24to12 = (timeStr = "00:00") => {
    const [HH = "00", MM = "00"] = timeStr.split(":");
    let h = parseInt(HH, 10) || 0;
    const m = MM;
    const meridiem = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return { time: `${String(h).padStart(2, "0")}:${m}`, meridiem };
  };

  // Format "HH:mm[:ss]" to "hh:mm AM/PM" for display
  const format24ForDisplay = (timeStr = "") => {
    const [HH = "00", MM = "00"] = timeStr.split(":");
    const { time, meridiem } = convert24to12(`${HH}:${MM}`);
    return `${time} ${meridiem}`;
  };

  /* ============================
     API
  ============================ */
  const fetchPeriods = async () => {
    try {
      const response = await api.get("/periods");
      const data = Array.isArray(response.data) ? response.data : response.data?.periods || [];
      setPeriods(data);
    } catch (error) {
      console.error("Error fetching periods:", error);
      Swal.fire("Error", "Failed to fetch periods.", "error");
    }
  };

  const savePeriod = async () => {
    try {
      // simple validation
      if (!newPeriod.period_name.trim()) {
        Swal.fire("Warning", "Please enter a period name.", "warning");
        return;
      }

      const payload = {
        period_name: newPeriod.period_name.trim(),
        start_time: convert12to24(newPeriod.start_time.time, newPeriod.start_time.meridiem),
        end_time: convert12to24(newPeriod.end_time.time, newPeriod.end_time.meridiem),
      };

      if (editingPeriod) {
        await api.put(`/periods/${editingPeriod.id}`, payload);
        Swal.fire("Updated!", "Period has been updated successfully.", "success");
      } else {
        await api.post("/periods", payload);
        Swal.fire("Added!", "Period has been added successfully.", "success");
      }

      setEditingPeriod(null);
      setNewPeriod({
        period_name: "",
        start_time: { time: "08:00", meridiem: "AM" },
        end_time: { time: "12:00", meridiem: "PM" },
      });
      setShowModal(false);
      fetchPeriods();
    } catch (error) {
      console.error("Error saving period:", error);
      Swal.fire("Error", error.response?.data?.error || error.message, "error");
    }
  };

  const deletePeriod = async (id) => {
    Swal.fire({
      title: "Are you sure?",
      text: "This will permanently delete the period.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      try {
        await api.delete(`/periods/${id}`);
        Swal.fire("Deleted!", "Period has been deleted.", "success");
        fetchPeriods();
      } catch (error) {
        console.error("Error deleting period:", error);
        Swal.fire("Error", "Failed to delete period.", "error");
      }
    });
  };

  /* ============================
     Derived: filtered periods
  ============================ */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return periods;

    return periods.filter((p) => {
      const name = p.period_name?.toLowerCase() || "";
      const startDisp = format24ForDisplay(p.start_time || "").toLowerCase();
      const endDisp = format24ForDisplay(p.end_time || "").toLowerCase();
      return name.includes(q) || startDisp.includes(q) || endDisp.includes(q);
    });
  }, [periods, search]);

  /* ============================
     Lifecycle
  ============================ */
  useEffect(() => {
    fetchPeriods();
  }, []);

  /* ============================
     Render
  ============================ */
  return (
    <div className="container mt-4">
      <h1>Periods Management</h1>

      {/* Top bar: Add + Search */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-md-between gap-2 mb-3">
        <button
          className="btn btn-success"
          onClick={() => {
            setEditingPeriod(null);
            setNewPeriod({
              period_name: "",
              start_time: { time: "08:00", meridiem: "AM" },
              end_time: { time: "12:00", meridiem: "PM" },
            });
            setShowModal(true);
          }}
        >
          Add Period
        </button>

        <div className="d-flex gap-2 w-100 w-md-auto">
          <input
            type="text"
            className="form-control"
            placeholder="Search by name or time (e.g., '9:00 am')"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search periods"
          />
          {search && (
            <button
              className="btn btn-outline-secondary"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Desktop/tablet: table */}
      <div className="table-responsive d-none d-md-block">
        <table className="table table-striped align-middle">
          <thead>
            <tr>
              <th style={{ width: 56 }}>#</th>
              <th>Period Name</th>
              <th>Start Time</th>
              <th>End Time</th>
              <th style={{ width: 200 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((period, index) => (
                <tr key={period.id}>
                  <td>{index + 1}</td>
                  <td className="wrap">
                    <span className="truncate" title={period.period_name}>
                      {period.period_name}
                    </span>
                  </td>
                  <td>{format24ForDisplay(period.start_time)}</td>
                  <td>{format24ForDisplay(period.end_time)}</td>
                  <td className="actions-cell">
                    <div className="actions-stack">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setEditingPeriod(period);
                          setNewPeriod({
                            period_name: period.period_name,
                            start_time: convert24to12(period.start_time),
                            end_time: convert24to12(period.end_time),
                          });
                          setShowModal(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => deletePeriod(period.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="text-center text-muted">
                  No periods found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <div className="d-md-none">
        {filtered.length > 0 ? (
          filtered.map((period, index) => (
            <div key={period.id} className="period-card">
              <p className="index-line">#{index + 1}</p>
              <div className="kv">
                <span className="k">Name:</span>
                <span className="v">{period.period_name || "-"}</span>
              </div>
              <div className="kv">
                <span className="k">Start:</span>
                <span className="v">{format24ForDisplay(period.start_time)}</span>
              </div>
              <div className="kv">
                <span className="k">End:</span>
                <span className="v">{format24ForDisplay(period.end_time)}</span>
              </div>
              <div className="d-flex flex-column gap-2 mt-2">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setEditingPeriod(period);
                    setNewPeriod({
                      period_name: period.period_name,
                      start_time: convert24to12(period.start_time),
                      end_time: convert24to12(period.end_time),
                    });
                    setShowModal(true);
                  }}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => deletePeriod(period.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-muted">No periods found.</p>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog">
            <div className="modal-content shadow">
              <div className="modal-header">
                <h5 className="modal-title">{editingPeriod ? "Edit Period" : "Add Period"}</h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setShowModal(false)}
                ></button>
              </div>

              <div className="modal-body">
                {/* Period Name */}
                <div className="mb-3">
                  <label htmlFor="periodName" className="form-label">
                    Period Name
                  </label>
                  <input
                    id="periodName"
                    type="text"
                    className="form-control"
                    placeholder="Enter period name"
                    value={newPeriod.period_name}
                    onChange={(e) =>
                      setNewPeriod({ ...newPeriod, period_name: e.target.value })
                    }
                  />
                </div>

                {/* Times */}
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label htmlFor="startTime" className="form-label">
                      Start Time
                    </label>
                    <div className="input-group">
                      <IMaskInput
                        id="startTime"
                        mask="00:00"
                        value={newPeriod.start_time.time}
                        unmask={false}
                        placeholder="hh:mm"
                        onAccept={(value) =>
                          setNewPeriod({
                            ...newPeriod,
                            start_time: { ...newPeriod.start_time, time: value },
                          })
                        }
                        className="form-control"
                      />
                      <select
                        className="form-select"
                        value={newPeriod.start_time.meridiem}
                        onChange={(e) =>
                          setNewPeriod({
                            ...newPeriod,
                            start_time: { ...newPeriod.start_time, meridiem: e.target.value },
                          })
                        }
                        aria-label="Start meridiem"
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>

                  <div className="col-md-6 mb-3">
                    <label htmlFor="endTime" className="form-label">
                      End Time
                    </label>
                    <div className="input-group">
                      <IMaskInput
                        id="endTime"
                        mask="00:00"
                        value={newPeriod.end_time.time}
                        unmask={false}
                        placeholder="hh:mm"
                        onAccept={(value) =>
                          setNewPeriod({
                            ...newPeriod,
                            end_time: { ...newPeriod.end_time, time: value },
                          })
                        }
                        className="form-control"
                      />
                      <select
                        className="form-select"
                        value={newPeriod.end_time.meridiem}
                        onChange={(e) =>
                          setNewPeriod({
                            ...newPeriod,
                            end_time: { ...newPeriod.end_time, meridiem: e.target.value },
                          })
                        }
                        aria-label="End meridiem"
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>
                </div>

                <p className="small text-muted">Enter time in hh:mm format and select AM/PM.</p>
              </div>

              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Close
                </button>
                <button className="btn btn-primary" onClick={savePeriod}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Periods;
