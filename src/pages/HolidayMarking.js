import React, { useState, useEffect, useMemo } from "react";
import moment from "moment";
import api from "../api"; // Custom Axios instance with auth
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";
import "./HolidayMarking.css";

const HolidayMarking = () => {
  const [classes, setClasses] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]); // selected class IDs
  const [holidayDate, setHolidayDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  // Holiday records for the selected date (raw)
  const [holidayRecords, setHolidayRecords] = useState([]);
  // If editing an existing group, we track the original group key
  const [editingGroupKey, setEditingGroupKey] = useState(null);

  // ---- Search boxes ----
  const [classSearch, setClassSearch] = useState("");       // filters class cards
  const [recordSearch, setRecordSearch] = useState("");     // filters holiday listing

  // =============================
  // Fetchers
  // =============================
  const fetchClasses = async () => {
    try {
      const { data } = await api.get("/classes");
      setClasses(Array.isArray(data) ? data : data?.classes || []);
    } catch (error) {
      console.error("Error fetching classes:", error);
      Swal.fire("Error", "Failed to fetch classes.", "error");
      setClasses([]);
    }
  };

  const fetchHolidayRecords = async (date) => {
    try {
      const { data } = await api.get(`/holidays?date=${date}`);
      setHolidayRecords(Array.isArray(data) ? data : data?.records || data || []);
    } catch (error) {
      console.error("Error fetching holiday records:", error);
      setHolidayRecords([]);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchHolidayRecords(holidayDate);
  }, [holidayDate]);

  // =============================
  // Class selection helpers
  // =============================
  const handleCheckboxChange = (e, classId) => {
    if (e.target.checked) {
      setSelectedClasses((prev) => [...prev, classId]);
    } else {
      setSelectedClasses((prev) => prev.filter((id) => id !== classId));
    }
  };

  const toggleCardSelection = (classId) => {
    setSelectedClasses((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  // Filter class cards by search
  const filteredClasses = useMemo(() => {
    const q = classSearch.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter((c) => c.class_name?.toLowerCase().includes(q));
  }, [classes, classSearch]);

  // Mark/Unmark all on the *filtered* class set
  const handleMarkAll = () => {
    const visibleIds = filteredClasses.map((c) => c.id);
    const allVisibleSelected = visibleIds.every((id) => selectedClasses.includes(id));
    if (allVisibleSelected) {
      // Unmark only the currently visible ones
      setSelectedClasses((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      // Add all visible ones
      setSelectedClasses((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  // =============================
  // Aggregate holiday records into groups (by description+date)
  // =============================
  const aggregatedHolidays = useMemo(() => {
    const acc = {};
    for (const record of holidayRecords) {
      const key = `${(record.description || "").trim()}_${record.date}`;
      if (!acc[key]) {
        acc[key] = {
          date: record.date,
          description: record.description || "",
          classIds: [],
          classNames: [],
          recordIds: [],
        };
      }
      acc[key].classIds.push(record.classId);
      acc[key].recordIds.push(record.id);
      const cls = classes.find((c) => c.id === record.classId);
      const cname = cls?.class_name || String(record.classId);
      if (!acc[key].classNames.includes(cname)) {
        acc[key].classNames.push(cname);
      }
    }
    return Object.values(acc);
  }, [holidayRecords, classes]);

  // Search filter for holiday groups (by description or class names)
  const filteredHolidayGroups = useMemo(() => {
    const q = recordSearch.trim().toLowerCase();
    if (!q) return aggregatedHolidays;
    return aggregatedHolidays.filter((g) => {
      const inDesc = g.description?.toLowerCase().includes(q);
      const inClasses = g.classNames.join(", ").toLowerCase().includes(q);
      const inDate = (g.date || "").toLowerCase().includes(q);
      return inDesc || inClasses || inDate;
    });
  }, [aggregatedHolidays, recordSearch]);

  // =============================
  // Delete / Edit a group
  // =============================
  const handleDeleteGroup = async (group) => {
    const confirm = await Swal.fire({
      title: "Are you sure?",
      text: "This will delete the holiday marking for the selected record(s).",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
    });
    if (!confirm.isConfirmed) return;

    try {
      await Promise.all(group.recordIds.map((id) => api.delete(`/holidays/${id}`)));
      Swal.fire("Deleted!", "Holiday marking has been deleted.", "success");
      fetchHolidayRecords(holidayDate);
    } catch (error) {
      console.error("Error deleting holiday group:", error);
      Swal.fire("Error", "Failed to delete holiday marking.", "error");
    }
  };

  const handleEditGroup = (group) => {
    setHolidayDate(group.date);
    setDescription(group.description);
    setSelectedClasses(group.classIds);
    setEditingGroupKey(`${group.description.trim()}_${group.date}`);
  };

  // =============================
  // Submit
  // =============================
  const handleSubmit = async () => {
    if (!holidayDate || !description || selectedClasses.length === 0) {
      Swal.fire("Warning", "Please fill all fields and select at least one class.", "warning");
      return;
    }
    setLoading(true);
    try {
      if (editingGroupKey) {
        // Update existing group
        const groupRecords = holidayRecords.filter(
          (r) => `${(r.description || "").trim()}_${r.date}` === editingGroupKey
        );
        const existingClassIds = groupRecords.map((r) => r.classId);

        const classesToDelete = existingClassIds.filter((id) => !selectedClasses.includes(id));
        const classesToUpdate = existingClassIds.filter((id) => selectedClasses.includes(id));
        const classesToAdd = selectedClasses.filter((id) => !existingClassIds.includes(id));

        // Delete removed classes
        await Promise.all(
          groupRecords
            .filter((r) => classesToDelete.includes(r.classId))
            .map((r) => api.delete(`/holidays/${r.id}`))
        );

        // Update remaining
        await Promise.all(
          groupRecords
            .filter((r) => classesToUpdate.includes(r.classId))
            .map((r) =>
              api.put(`/holidays/${r.id}`, {
                classId: r.classId,
                date: holidayDate,
                description,
              })
            )
        );

        // Add newly selected
        await Promise.all(
          classesToAdd.map((classId) =>
            api.post("/holidays", { classId, date: holidayDate, description })
          )
        );

        Swal.fire("Success", "Holiday updated successfully.", "success");
      } else {
        // Create new records
        const payloads = selectedClasses.map((classId) => ({
          classId,
          date: holidayDate,
          description,
        }));
        await Promise.all(payloads.map((p) => api.post("/holidays", p)));
        Swal.fire("Success", "Holiday marked successfully.", "success");
      }

      // Reset
      setDescription("");
      setSelectedClasses([]);
      setEditingGroupKey(null);
      fetchHolidayRecords(holidayDate);
    } catch (error) {
      console.error("Error marking holiday:", error);
      Swal.fire("Error", error.response?.data?.error || "Failed to mark holiday.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-4">
      <h1>Mark Holiday</h1>

      {/* Date + Description */}
      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <label htmlFor="holidayDate" className="form-label">
            Select Date
          </label>
          <input
            type="date"
            id="holidayDate"
            className="form-control"
            value={holidayDate}
            onChange={(e) => setHolidayDate(e.target.value)}
          />
        </div>

        <div className="col-md-8">
          <label htmlFor="description" className="form-label">
            Holiday Description
          </label>
          <textarea
            id="description"
            className="form-control"
            rows="2"
            placeholder="e.g., Diwali, Sports Day, Emergency Closure…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      {/* Classes: Search + Mark All */}
      <div className="mb-2 d-flex flex-column flex-md-row align-items-md-center justify-content-md-between gap-2">
        <h5 className="mb-0">Select Classes</h5>
        <div className="d-flex gap-2 w-100 w-md-auto">
          <input
            type="text"
            className="form-control"
            placeholder="Search classes"
            value={classSearch}
            onChange={(e) => setClassSearch(e.target.value)}
            aria-label="Search classes"
          />
          <button className="btn btn-outline-secondary" onClick={handleMarkAll}>
            {/* toggles based on filtered set */}
            {filteredClasses.length > 0 &&
            filteredClasses.every((c) => selectedClasses.includes(c.id))
              ? "Unmark All (Shown)"
              : "Mark All (Shown)"}
          </button>
        </div>
      </div>

      {/* Classes as responsive cards */}
      <div className="mb-3">
        {filteredClasses.length > 0 ? (
          <div className="hm-class-grid">
            {filteredClasses.map((cls) => {
              const isSelected = selectedClasses.includes(cls.id);
              return (
                <div
                  key={cls.id}
                  className={`hm-class-card ${isSelected ? "is-selected" : ""}`}
                  onClick={() => toggleCardSelection(cls.id)}
                  role="button"
                  aria-pressed={isSelected}
                >
                  <div className="d-flex align-items-center justify-content-between">
                    <h6 className="mb-0">{cls.class_name}</h6>
                    <input
                      type="checkbox"
                      className="form-check-input ms-2"
                      checked={isSelected}
                      onChange={(e) => handleCheckboxChange(e, cls.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted">No classes match your search.</p>
        )}
      </div>

      {/* Submit */}
      <button
        className="btn btn-primary mb-4"
        onClick={handleSubmit}
        disabled={loading}
      >
        {loading
          ? "Submitting..."
          : editingGroupKey
          ? "Update Holiday Marking"
          : "Submit Holiday Marking"}
      </button>

      {/* Listing header with search */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-md-between gap-2 mb-2">
        <h4 className="mb-0">
          Holiday Markings for {moment(holidayDate).format("YYYY-MM-DD")}
        </h4>
        <input
          type="text"
          className="form-control"
          placeholder="Search records (description, class, date)"
          value={recordSearch}
          onChange={(e) => setRecordSearch(e.target.value)}
          aria-label="Search holiday records"
        />
      </div>

      {/* Desktop/tablet: table */}
      <div className="table-responsive d-none d-md-block">
        {filteredHolidayGroups.length > 0 ? (
          <table className="table table-bordered align-middle">
            <thead className="thead-light">
              <tr>
                <th style={{ width: 56 }}>#</th>
                <th>Description</th>
                <th>Date</th>
                <th>Classes</th>
                <th style={{ width: 200 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredHolidayGroups.map((group, index) => (
                <tr key={`${group.description}_${group.date}`}>
                  <td>{index + 1}</td>
                  <td className="wrap">{group.description}</td>
                  <td>{group.date}</td>
                  <td className="wrap">
                    <span className="truncate" title={group.classNames.join(", ")}>
                      {group.classNames.join(", ")}
                    </span>
                  </td>
                  <td>
                    <div className="d-inline-flex flex-wrap gap-2">
                      <button
                        className="btn btn-sm btn-warning"
                        onClick={() => handleEditGroup(group)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeleteGroup(group)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted">No holiday markings found.</p>
        )}
      </div>

      {/* Mobile: cards */}
      <div className="d-md-none">
        {filteredHolidayGroups.length > 0 ? (
          filteredHolidayGroups.map((group, index) => (
            <div key={`${group.description}_${group.date}`} className="hm-record-card">
              <p className="index-line">#{index + 1}</p>
              <div className="kv">
                <span className="k">Description:</span>
                <span className="v">{group.description || "-"}</span>
              </div>
              <div className="kv">
                <span className="k">Date:</span>
                <span className="v">{group.date}</span>
              </div>
              <div className="kv">
                <span className="k">Classes:</span>
                <span className="v">{group.classNames.join(", ")}</span>
              </div>
              <div className="d-flex flex-column gap-2 mt-2">
                <button className="btn btn-warning btn-sm" onClick={() => handleEditGroup(group)}>
                  Edit
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteGroup(group)}>
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-muted">No holiday markings found.</p>
        )}
      </div>
    </div>
  );
};

export default HolidayMarking;
