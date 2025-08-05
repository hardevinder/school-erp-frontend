import React, { useState, useEffect } from "react";
import moment from "moment";
import api from "../api"; // Custom Axios instance with auth
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";

const HolidayMarking = () => {
  const [classes, setClasses] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]); // Array of selected class IDs
  const [holidayDate, setHolidayDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  // Holiday records fetched for the selected date for aggregated listing
  const [holidayRecords, setHolidayRecords] = useState([]);
  // If editing a group, store the group key (based on original description and date)
  const [editingGroupKey, setEditingGroupKey] = useState(null);

  // Fetch list of classes
  const fetchClasses = async () => {
    try {
      const { data } = await api.get("/classes");
      setClasses(data);
    } catch (error) {
      console.error("Error fetching classes:", error);
      Swal.fire("Error", "Failed to fetch classes.", "error");
    }
  };

  // Fetch holiday records for the selected date
  const fetchHolidayRecords = async (date) => {
    try {
      // You can pass the date as a query param
      const { data } = await api.get(`/holidays?date=${date}`);
      setHolidayRecords(data);
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

  // Handle checkbox change for class selection
  const handleCheckboxChange = (e, classId) => {
    if (e.target.checked) {
      setSelectedClasses((prev) => [...prev, classId]);
    } else {
      setSelectedClasses((prev) => prev.filter((id) => id !== classId));
    }
  };

  // Toggle card selection (click on card toggles checkbox)
  const toggleCardSelection = (classId) => {
    if (selectedClasses.includes(classId)) {
      setSelectedClasses(selectedClasses.filter((id) => id !== classId));
    } else {
      setSelectedClasses([...selectedClasses, classId]);
    }
  };

  // Mark All / Unmark All classes
  const handleMarkAll = () => {
    if (selectedClasses.length === classes.length) {
      setSelectedClasses([]);
    } else {
      setSelectedClasses(classes.map((cls) => cls.id));
    }
  };

  // Aggregate holidayRecords by description and date
  const aggregatedHolidays = holidayRecords.reduce((acc, record) => {
    const key = `${record.description.trim()}_${record.date}`;
    if (!acc[key]) {
      acc[key] = {
        date: record.date,
        description: record.description,
        classIds: [],
        classNames: [],
        recordIds: [],
      };
    }
    acc[key].classIds.push(record.classId);
    acc[key].recordIds.push(record.id);
    const cls = classes.find((c) => c.id === record.classId);
    if (cls && !acc[key].classNames.includes(cls.class_name)) {
      acc[key].classNames.push(cls.class_name);
    }
    return acc;
  }, {});

  const holidayGroups = Object.values(aggregatedHolidays);

  // Delete a holiday group (all records in the group)
  const handleDeleteGroup = async (group) => {
    const confirm = await Swal.fire({
      title: "Are you sure?",
      text: "This will delete the holiday marking for the selected record(s).",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
    });
    if (confirm.isConfirmed) {
      try {
        await Promise.all(
          group.recordIds.map((id) => api.delete(`/holidays/${id}`))
        );
        Swal.fire("Deleted!", "Holiday marking has been deleted.", "success");
        fetchHolidayRecords(holidayDate);
      } catch (error) {
        console.error("Error deleting holiday group:", error);
        Swal.fire("Error", "Failed to delete holiday marking.", "error");
      }
    }
  };

  // Pre-fill form when editing a group
  const handleEditGroup = (group) => {
    setHolidayDate(group.date);
    setDescription(group.description);
    setSelectedClasses(group.classIds);
    setEditingGroupKey(`${group.description.trim()}_${group.date}`);
  };

  // Handle form submission for holiday marking
  const handleSubmit = async () => {
    if (!holidayDate || !description || selectedClasses.length === 0) {
      Swal.fire(
        "Warning",
        "Please fill all fields and select at least one class.",
        "warning"
      );
      return;
    }
    setLoading(true);
    try {
      if (editingGroupKey) {
        // Editing mode: update the holiday group
        // Get the group records based on the original group key
        const groupRecords = holidayRecords.filter(
          (record) => `${record.description.trim()}_${record.date}` === editingGroupKey
        );
        // Get existing class IDs in the group
        const existingClassIds = groupRecords.map((record) => record.classId);
        // Determine which class IDs to delete, update, or add
        const classesToDelete = existingClassIds.filter(
          (id) => !selectedClasses.includes(id)
        );
        const classesToUpdate = existingClassIds.filter((id) =>
          selectedClasses.includes(id)
        );
        const classesToAdd = selectedClasses.filter(
          (id) => !existingClassIds.includes(id)
        );

        // Delete holiday records that are no longer selected
        await Promise.all(
          groupRecords
            .filter((record) => classesToDelete.includes(record.classId))
            .map((record) => api.delete(`/holidays/${record.id}`))
        );
        // Update holiday records that remain
        await Promise.all(
          groupRecords
            .filter((record) => classesToUpdate.includes(record.classId))
            .map((record) =>
              api.put(`/holidays/${record.id}`, {
                classId: record.classId,
                date: holidayDate,
                description,
              })
            )
        );
        // Create new holiday records for newly selected classes
        await Promise.all(
          classesToAdd.map((classId) =>
            api.post("/holidays", { classId, date: holidayDate, description })
          )
        );
        Swal.fire("Success", "Holiday updated successfully.", "success");
      } else {
        // Creating new holiday markings.
        const records = selectedClasses.map((classId) => ({
          classId,
          date: holidayDate,
          description,
        }));
        await Promise.all(records.map((record) => api.post("/holidays", record)));
        Swal.fire("Success", "Holiday marked successfully.", "success");
      }
      // Reset form fields after submission.
      setDescription("");
      setSelectedClasses([]);
      setEditingGroupKey(null);
      fetchHolidayRecords(holidayDate);
    } catch (error) {
      console.error("Error marking holiday:", error);
      Swal.fire(
        "Error",
        error.response?.data?.error || "Failed to mark holiday.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-4">
      <h1>Mark Holiday</h1>

      {/* Date Picker */}
      <div className="mb-3">
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

      {/* Holiday Description */}
      <div className="mb-3">
        <label htmlFor="description" className="form-label">
          Holiday Description
        </label>
        <textarea
          id="description"
          className="form-control"
          rows="3"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        ></textarea>
      </div>

      {/* Mark All / Unmark All Button */}
      <div className="mb-3">
        <button className="btn btn-secondary" onClick={handleMarkAll}>
          {selectedClasses.length === classes.length ? "Unmark All" : "Mark All"}
        </button>
      </div>

      {/* Classes List as Cards */}
      <div className="mb-3">
        <h5>Select Classes</h5>
        <div className="d-flex flex-wrap">
          {classes.length > 0 ? (
            classes.map((cls) => {
              const isSelected = selectedClasses.includes(cls.id);
              return (
                <div
                  key={cls.id}
                  className="card m-2"
                  style={{
                    width: "10rem",
                    border: "1px solid #dee2e6",
                    backgroundColor: isSelected ? "#d4edda" : "white",
                    cursor: "pointer",
                  }}
                  onClick={() => toggleCardSelection(cls.id)}
                >
                  <div className="card-body text-center">
                    <div className="form-check form-check-inline">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={isSelected}
                        onChange={(e) => handleCheckboxChange(e, cls.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <h6 className="card-title">{cls.class_name}</h6>
                  </div>
                </div>
              );
            })
          ) : (
            <p>No classes available.</p>
          )}
        </div>
      </div>

      {/* Submit Button */}
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

      {/* Detailed Holiday Markings Listing */}
      <div>
        <h4>Detailed Holiday Markings for {holidayDate}</h4>
        {holidayGroups.length > 0 ? (
          <table className="table table-bordered">
            <thead className="thead-light">
              <tr>
                <th>#</th>
                <th>Description</th>
                <th>Date</th>
                <th>Classes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {holidayGroups.map((group, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{group.description}</td>
                  <td>{group.date}</td>
                  <td>{group.classNames.join(", ")}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-warning me-2"
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No holiday markings found for this date.</p>
        )}
      </div>
    </div>
  );
};

export default HolidayMarking;
