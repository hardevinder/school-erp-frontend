import React, { useState, useEffect } from "react";
import { IMaskInput } from "react-imask"; // Import IMaskInput
import api from "../api"; // Custom Axios instance
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";

const Periods = () => {
  // State for the list of periods
  const [periods, setPeriods] = useState([]);
  // For creating or editing a period. The start_time and end_time are objects containing the time string (hh:mm) and meridiem.
  const [newPeriod, setNewPeriod] = useState({
    period_name: "",
    start_time: { time: "08:00", meridiem: "AM" },
    end_time: { time: "12:00", meridiem: "PM" },
  });
  const [editingPeriod, setEditingPeriod] = useState(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Fetch periods from the API
  const fetchPeriods = async () => {
    try {
      const response = await api.get("/periods");
      setPeriods(response.data);
    } catch (error) {
      console.error("Error fetching periods:", error);
    }
  };

  // Helper to convert 12-hour time (hh:mm + AM/PM) to 24-hour time string "HH:mm:ss"
  const convert12to24 = (timeStr, meridiem) => {
    const [hoursStr, minutesStr] = timeStr.split(":");
    let hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    if (meridiem === "AM") {
      if (hours === 12) hours = 0;
    } else if (meridiem === "PM") {
      if (hours !== 12) hours += 12;
    }
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:00`;
  };

  // Save period: create new or update existing
  const savePeriod = async () => {
    try {
      const payload = {
        period_name: newPeriod.period_name,
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
      Swal.fire("Error", error.message, "error");
    }
  };

  // Delete a period
  const deletePeriod = async (id) => {
    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.delete(`/periods/${id}`);
          Swal.fire("Deleted!", "Period has been deleted.", "success");
          fetchPeriods();
        } catch (error) {
          console.error("Error deleting period:", error);
        }
      }
    });
  };

  // Filter periods based on search
  const handleSearch = () => {
    if (search) {
      return periods.filter((period) =>
        period.period_name.toLowerCase().includes(search.toLowerCase())
      );
    }
    return periods;
  };

  useEffect(() => {
    fetchPeriods();
  }, []);

  return (
    <div className="container mt-4">
      <h1>Periods Management</h1>
      {/* Add Period Button */}
      <button
        className="btn btn-success mb-3"
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

      {/* Search Input */}
      <div className="mb-3">
        <input
          type="text"
          className="form-control w-50"
          placeholder="Search Periods"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Periods Table */}
      <table className="table table-striped">
        <thead>
          <tr>
            <th>#</th>
            <th>Period Name</th>
            <th>Start Time</th>
            <th>End Time</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {handleSearch().map((period, index) => (
            <tr key={period.id}>
              <td>{index + 1}</td>
              <td>{period.period_name}</td>
              <td>{period.start_time}</td>
              <td>{period.end_time}</td>
              <td>
                <button
                  className="btn btn-primary btn-sm me-2"
                  onClick={() => {
                    setEditingPeriod(period);
                    // Convert the 24-hour time to 12-hour format for editing
                    const convert24to12 = (timeStr) => {
                      const [hourStr, minuteStr] = timeStr.split(":");
                      let hour = parseInt(hourStr, 10);
                      const minute = minuteStr;
                      const meridiem = hour >= 12 ? "PM" : "AM";
                      hour = hour % 12 || 12;
                      return { time: `${hour.toString().padStart(2, "0")}:${minute}`, meridiem };
                    };
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modal for Adding/Editing Period */}
      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog">
            <div className="modal-content shadow">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingPeriod ? "Edit Period" : "Add Period"}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body">
                {/* Period Name */}
                <div className="mb-3">
                  <label htmlFor="periodName" className="form-label">Period Name</label>
                  <input
                    type="text"
                    id="periodName"
                    className="form-control"
                    placeholder="Enter period name"
                    value={newPeriod.period_name}
                    onChange={(e) =>
                      setNewPeriod({ ...newPeriod, period_name: e.target.value })
                    }
                  />
                </div>
                {/* Time Pickers */}
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label htmlFor="startTime" className="form-label">Start Time</label>
                    <div className="input-group">
                      <IMaskInput
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
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label htmlFor="endTime" className="form-label">End Time</label>
                    <div className="input-group">
                      <IMaskInput
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
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>
                </div>
                <p className="small text-muted">
                  Enter the time in hh:mm format and select AM/PM.
                </p>
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
