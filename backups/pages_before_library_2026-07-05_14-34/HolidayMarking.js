import React, { useEffect, useMemo, useState } from "react";
import moment from "moment";
import api from "../api";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";

const todayYMD = () => new Date().toISOString().split("T")[0];

const normalizeArrayResponse = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.holidays)) return data.holidays;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const getRecordDate = (record) => {
  const raw = record?.date || record?.holidayDate || record?.holiday_date;
  if (!raw) return "";
  return String(raw).slice(0, 10);
};

const getRecordClassId = (record) => {
  return record?.classId || record?.class_id || record?.class?.id || null;
};

const getClassName = (record, classes) => {
  const classId = getRecordClassId(record);

  return (
    record?.class?.class_name ||
    record?.className ||
    classes.find((c) => Number(c.id) === Number(classId))?.class_name ||
    String(classId || "-")
  );
};

const HolidayMarking = () => {
  const [classes, setClasses] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]);

  const [startDate, setStartDate] = useState(todayYMD());
  const [endDate, setEndDate] = useState(todayYMD());
  const [description, setDescription] = useState("");

  const [holidayRecords, setHolidayRecords] = useState([]);
  const [editingGroupKey, setEditingGroupKey] = useState(null);

  const [classSearch, setClassSearch] = useState("");
  const [recordSearch, setRecordSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  const isEditing = Boolean(editingGroupKey);

  const selectedDateCount = useMemo(() => {
    if (!startDate || !endDate) return 0;

    const start = moment(startDate, "YYYY-MM-DD");
    const end = moment(endDate, "YYYY-MM-DD");

    if (!start.isValid() || !end.isValid() || end.isBefore(start)) return 0;

    return end.diff(start, "days") + 1;
  }, [startDate, endDate]);

  const fetchClasses = async () => {
    try {
      const { data } = await api.get("/classes");
      setClasses(Array.isArray(data) ? data : data?.classes || []);
    } catch (error) {
      console.error("Error fetching classes:", error);
      setClasses([]);
      Swal.fire("Error", "Failed to fetch classes.", "error");
    }
  };

  const fetchHolidayRecords = async (fromDate = startDate, toDate = endDate) => {
    if (!fromDate || !toDate) return;

    const start = moment(fromDate, "YYYY-MM-DD");
    const end = moment(toDate, "YYYY-MM-DD");

    if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
      setHolidayRecords([]);
      return;
    }

    try {
      setListLoading(true);

      const query = new URLSearchParams({
        startDate: fromDate,
        endDate: toDate,
      }).toString();

      const { data } = await api.get(`/holidays?${query}`);
      setHolidayRecords(normalizeArrayResponse(data));
    } catch (error) {
      console.error("Error fetching holiday records:", error);
      setHolidayRecords([]);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchHolidayRecords(startDate, endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const filteredClasses = useMemo(() => {
    const q = classSearch.trim().toLowerCase();
    if (!q) return classes;

    return classes.filter((cls) =>
      String(cls?.class_name || "")
        .toLowerCase()
        .includes(q)
    );
  }, [classes, classSearch]);

  const visibleClassIds = useMemo(() => {
    return filteredClasses.map((cls) => cls.id);
  }, [filteredClasses]);

  const allVisibleSelected = useMemo(() => {
    if (visibleClassIds.length === 0) return false;
    return visibleClassIds.every((id) => selectedClasses.includes(id));
  }, [visibleClassIds, selectedClasses]);

  const toggleClassSelection = (classId) => {
    setSelectedClasses((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId]
    );
  };

  const handleCheckboxChange = (e, classId) => {
    e.stopPropagation();

    if (e.target.checked) {
      setSelectedClasses((prev) => Array.from(new Set([...prev, classId])));
    } else {
      setSelectedClasses((prev) => prev.filter((id) => id !== classId));
    }
  };

  const handleMarkAllShown = () => {
    if (filteredClasses.length === 0) return;

    if (allVisibleSelected) {
      setSelectedClasses((prev) =>
        prev.filter((id) => !visibleClassIds.includes(id))
      );
    } else {
      setSelectedClasses((prev) =>
        Array.from(new Set([...prev, ...visibleClassIds]))
      );
    }
  };

  const handleClearSelection = () => {
    setSelectedClasses([]);
  };

  const aggregatedHolidays = useMemo(() => {
    const grouped = {};

    for (const record of holidayRecords) {
      const date = getRecordDate(record);
      const descriptionText = String(record?.description || "").trim();
      const classId = getRecordClassId(record);

      const key = `${descriptionText}_${date}`;

      if (!grouped[key]) {
        grouped[key] = {
          key,
          date,
          description: descriptionText,
          classIds: [],
          classNames: [],
          recordIds: [],
        };
      }

      if (classId && !grouped[key].classIds.includes(classId)) {
        grouped[key].classIds.push(classId);
      }

      if (record?.id) {
        grouped[key].recordIds.push(record.id);
      }

      const className = getClassName(record, classes);

      if (className && !grouped[key].classNames.includes(className)) {
        grouped[key].classNames.push(className);
      }
    }

    return Object.values(grouped).sort((a, b) => {
      const dateCompare = String(a.date).localeCompare(String(b.date));
      if (dateCompare !== 0) return dateCompare;
      return String(a.description).localeCompare(String(b.description));
    });
  }, [holidayRecords, classes]);

  const filteredHolidayGroups = useMemo(() => {
    const q = recordSearch.trim().toLowerCase();
    if (!q) return aggregatedHolidays;

    return aggregatedHolidays.filter((group) => {
      const descriptionMatch = group.description.toLowerCase().includes(q);
      const dateMatch = String(group.date || "").toLowerCase().includes(q);
      const classMatch = group.classNames.join(", ").toLowerCase().includes(q);

      return descriptionMatch || dateMatch || classMatch;
    });
  }, [aggregatedHolidays, recordSearch]);

  const uniqueDatesInListing = useMemo(() => {
    return new Set(holidayRecords.map((r) => getRecordDate(r)).filter(Boolean))
      .size;
  }, [holidayRecords]);

  const resetForm = () => {
    setDescription("");
    setSelectedClasses([]);
    setEditingGroupKey(null);
  };

  const handleEditGroup = (group) => {
    setStartDate(group.date);
    setEndDate(group.date);
    setDescription(group.description);
    setSelectedClasses(group.classIds);
    setEditingGroupKey(group.key);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleDeleteGroup = async (group) => {
    const confirm = await Swal.fire({
      title: "Delete holiday marking?",
      html: `
        <div class="text-start">
          <p class="mb-1"><b>Date:</b> ${moment(group.date).format(
            "DD MMM YYYY"
          )}</p>
          <p class="mb-1"><b>Description:</b> ${group.description || "-"}</p>
          <p class="mb-0"><b>Classes:</b> ${
            group.classNames.join(", ") || "-"
          }</p>
        </div>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc3545",
    });

    if (!confirm.isConfirmed) return;

    try {
      await Promise.all(
        group.recordIds.map((id) => api.delete(`/holidays/${id}`))
      );

      Swal.fire("Deleted", "Holiday marking deleted successfully.", "success");
      fetchHolidayRecords(startDate, endDate);
    } catch (error) {
      console.error("Error deleting holiday group:", error);
      Swal.fire(
        "Error",
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to delete holiday marking.",
        "error"
      );
    }
  };

  const validateForm = () => {
    const cleanDescription = description.trim();

    if (!startDate || !endDate) {
      Swal.fire("Warning", "Please select start date and end date.", "warning");
      return false;
    }

    if (moment(endDate).isBefore(moment(startDate))) {
      Swal.fire("Warning", "End date cannot be before start date.", "warning");
      return false;
    }

    if (!cleanDescription) {
      Swal.fire("Warning", "Please enter holiday description.", "warning");
      return false;
    }

    if (selectedClasses.length === 0) {
      Swal.fire("Warning", "Please select at least one class.", "warning");
      return false;
    }

    if (isEditing && startDate !== endDate) {
      Swal.fire(
        "Range not allowed while editing",
        "For editing an existing row, keep Start Date and End Date same. To mark a new range, click Cancel Edit and create a fresh range holiday.",
        "info"
      );
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const cleanDescription = description.trim();

    setLoading(true);

    try {
      if (isEditing) {
        const groupRecords = holidayRecords.filter((record) => {
          const key = `${String(record?.description || "").trim()}_${getRecordDate(
            record
          )}`;
          return key === editingGroupKey;
        });

        const existingClassIds = groupRecords.map((record) =>
          getRecordClassId(record)
        );

        const classesToDelete = existingClassIds.filter(
          (id) => !selectedClasses.includes(id)
        );

        const classesToUpdate = existingClassIds.filter((id) =>
          selectedClasses.includes(id)
        );

        const classesToAdd = selectedClasses.filter(
          (id) => !existingClassIds.includes(id)
        );

        await Promise.all(
          groupRecords
            .filter((record) => classesToDelete.includes(getRecordClassId(record)))
            .map((record) => api.delete(`/holidays/${record.id}`))
        );

        await Promise.all(
          groupRecords
            .filter((record) => classesToUpdate.includes(getRecordClassId(record)))
            .map((record) =>
              api.put(`/holidays/${record.id}`, {
                classId: getRecordClassId(record),
                date: startDate,
                description: cleanDescription,
              })
            )
        );

        await Promise.all(
          classesToAdd.map((classId) =>
            api.post("/holidays", {
              classId,
              date: startDate,
              description: cleanDescription,
            })
          )
        );

        Swal.fire("Success", "Holiday marking updated successfully.", "success");
      } else {
        const { data } = await api.post("/holidays", {
          classIds: selectedClasses,
          startDate,
          endDate,
          description: cleanDescription,
          updateExisting: true,
        });

        const summary = data?.summary;

        Swal.fire({
          icon: "success",
          title: "Holiday marked successfully",
          html: summary
            ? `
              <div class="text-start">
                <p class="mb-1"><b>Dates:</b> ${
                  summary.totalDates || selectedDateCount
                }</p>
                <p class="mb-1"><b>Classes:</b> ${
                  summary.totalClasses || selectedClasses.length
                }</p>
                <p class="mb-1"><b>Created:</b> ${summary.created || 0}</p>
                <p class="mb-0"><b>Updated:</b> ${summary.updated || 0}</p>
              </div>
            `
            : "Holiday range has been saved successfully.",
        });
      }

      resetForm();
      fetchHolidayRecords(startDate, endDate);
    } catch (error) {
      console.error("Error saving holiday:", error);

      Swal.fire(
        "Error",
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to save holiday marking.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid bg-light min-vh-100 py-4">
      <div className="container-fluid">
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body p-4">
            <div className="row g-3 align-items-center">
              <div className="col-lg-8">
                <div className="text-uppercase text-primary fw-bold small mb-1">
                  Attendance Settings
                </div>
                <h2 className="fw-bold mb-1">Holiday Marking</h2>
                <p className="text-muted mb-0">
                  Mark holidays for single or multiple classes across a selected
                  date range.
                </p>
              </div>

              <div className="col-lg-4">
                <div className="row g-2">
                  <div className="col-4">
                    <div className="border rounded-3 bg-white p-3 text-center h-100">
                      <div className="fs-4 fw-bold text-primary">
                        {classes.length}
                      </div>
                      <div className="small text-muted">Classes</div>
                    </div>
                  </div>

                  <div className="col-4">
                    <div className="border rounded-3 bg-white p-3 text-center h-100">
                      <div className="fs-4 fw-bold text-success">
                        {selectedClasses.length}
                      </div>
                      <div className="small text-muted">Selected</div>
                    </div>
                  </div>

                  <div className="col-4">
                    <div className="border rounded-3 bg-white p-3 text-center h-100">
                      <div className="fs-4 fw-bold text-warning">
                        {selectedDateCount}
                      </div>
                      <div className="small text-muted">Days</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-4">
          <div className="col-xl-5 col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 p-4 pb-2">
                <div className="d-flex justify-content-between align-items-start gap-3">
                  <div>
                    <h5 className="fw-bold mb-1">
                      {isEditing ? "Edit Holiday" : "Create Holiday"}
                    </h5>
                    <p className="text-muted mb-0 small">
                      {isEditing
                        ? "Editing works for one existing date row at a time."
                        : "Choose a date range and selected classes."}
                    </p>
                  </div>

                  {isEditing && (
                    <span className="badge text-bg-warning">Edit Mode</span>
                  )}
                </div>
              </div>

              <div className="card-body p-4">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label htmlFor="startDate" className="form-label fw-semibold">
                      Start Date
                    </label>
                    <input
                      type="date"
                      id="startDate"
                      className="form-control"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>

                  <div className="col-md-6">
                    <label htmlFor="endDate" className="form-label fw-semibold">
                      End Date
                    </label>
                    <input
                      type="date"
                      id="endDate"
                      className="form-control"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>

                  <div className="col-12">
                    <div className="alert alert-primary py-2 mb-0">
                      {selectedDateCount > 0 ? (
                        <>
                          <strong>{selectedDateCount}</strong>{" "}
                          day{selectedDateCount > 1 ? "s" : ""} selected
                        </>
                      ) : (
                        "Please select a valid date range"
                      )}
                    </div>
                  </div>

                  <div className="col-12">
                    <label htmlFor="description" className="form-label fw-semibold">
                      Holiday Description
                    </label>
                    <textarea
                      id="description"
                      className="form-control"
                      rows="4"
                      placeholder="e.g., Diwali Break, Sports Day, Emergency Closure..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  <div className="col-12">
                    <div className="d-flex flex-wrap gap-2">
                      <button
                        className="btn btn-primary fw-semibold"
                        onClick={handleSubmit}
                        disabled={loading}
                      >
                        {loading
                          ? "Saving..."
                          : isEditing
                          ? "Update Holiday"
                          : "Save Holiday Range"}
                      </button>

                      {isEditing && (
                        <button
                          className="btn btn-outline-secondary"
                          onClick={resetForm}
                          disabled={loading}
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-7 col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 p-4 pb-2">
                <div className="d-flex justify-content-between align-items-start gap-3">
                  <div>
                    <h5 className="fw-bold mb-1">Select Classes</h5>
                    <p className="text-muted mb-0 small">
                      Click class cards or use checkbox.
                    </p>
                  </div>

                  <span className="badge text-bg-success">
                    {selectedClasses.length} selected
                  </span>
                </div>
              </div>

              <div className="card-body p-4">
                <div className="row g-2 mb-3">
                  <div className="col-md">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search classes..."
                      value={classSearch}
                      onChange={(e) => setClassSearch(e.target.value)}
                    />
                  </div>

                  <div className="col-md-auto">
                    <button
                      className="btn btn-outline-primary w-100"
                      onClick={handleMarkAllShown}
                      disabled={filteredClasses.length === 0}
                    >
                      {allVisibleSelected ? "Unmark Shown" : "Mark Shown"}
                    </button>
                  </div>

                  <div className="col-md-auto">
                    <button
                      className="btn btn-outline-secondary w-100"
                      onClick={handleClearSelection}
                      disabled={selectedClasses.length === 0}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {filteredClasses.length > 0 ? (
                  <div className="row g-2">
                    {filteredClasses.map((cls) => {
                      const isSelected = selectedClasses.includes(cls.id);

                      return (
                        <div className="col-xl-3 col-lg-4 col-md-4 col-sm-6" key={cls.id}>
                          <div
                            className={`card h-100 ${
                              isSelected
                                ? "border-primary bg-primary-subtle"
                                : "border"
                            }`}
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleClassSelection(cls.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                toggleClassSelection(cls.id);
                              }
                            }}
                          >
                            <div className="card-body p-3">
                              <div className="d-flex justify-content-between align-items-start gap-2">
                                <div>
                                  <h6 className="fw-bold mb-1">
                                    {cls.class_name}
                                  </h6>
                                  <small
                                    className={
                                      isSelected ? "text-primary" : "text-muted"
                                    }
                                  >
                                    {isSelected ? "Selected" : "Click to select"}
                                  </small>
                                </div>

                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  checked={isSelected}
                                  onChange={(e) =>
                                    handleCheckboxChange(e, cls.id)
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="alert alert-light border mb-0 text-center">
                    No classes match your search.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm mt-4">
          <div className="card-header bg-white border-0 p-4 pb-2">
            <div className="row g-3 align-items-center">
              <div className="col-lg">
                <h5 className="fw-bold mb-1">Holiday Records</h5>
                <p className="text-muted mb-0 small">
                  Showing records from{" "}
                  <strong>{moment(startDate).format("DD MMM YYYY")}</strong> to{" "}
                  <strong>{moment(endDate).format("DD MMM YYYY")}</strong>
                </p>
              </div>

              <div className="col-lg-auto">
                <div className="d-flex flex-wrap gap-2">
                  <span className="badge text-bg-primary p-2">
                    {uniqueDatesInListing} Dates
                  </span>
                  <span className="badge text-bg-success p-2">
                    {filteredHolidayGroups.length} Groups
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="card-body p-4">
            <div className="row g-2 mb-3">
              <div className="col-md">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search records by description, class, or date..."
                  value={recordSearch}
                  onChange={(e) => setRecordSearch(e.target.value)}
                />
              </div>

              <div className="col-md-auto">
                <button
                  className="btn btn-outline-secondary w-100"
                  onClick={() => fetchHolidayRecords(startDate, endDate)}
                  disabled={listLoading}
                >
                  {listLoading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>

            <div className="d-none d-md-block">
              {listLoading ? (
                <div className="alert alert-light border text-center mb-0">
                  Loading holiday records...
                </div>
              ) : filteredHolidayGroups.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-bordered table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>#</th>
                        <th>Description</th>
                        <th>Date</th>
                        <th>Classes</th>
                        <th>Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredHolidayGroups.map((group, index) => (
                        <tr key={group.key}>
                          <td>{index + 1}</td>

                          <td>
                            <strong>{group.description || "-"}</strong>
                          </td>

                          <td>{moment(group.date).format("DD MMM YYYY")}</td>

                          <td>
                            <div className="d-flex flex-wrap gap-1">
                              {group.classNames.slice(0, 6).map((name) => (
                                <span
                                  key={name}
                                  className="badge rounded-pill text-bg-light border"
                                >
                                  {name}
                                </span>
                              ))}

                              {group.classNames.length > 6 && (
                                <span
                                  className="badge rounded-pill text-bg-secondary"
                                  title={group.classNames.join(", ")}
                                >
                                  +{group.classNames.length - 6} more
                                </span>
                              )}
                            </div>
                          </td>

                          <td>
                            <div className="d-flex flex-wrap gap-2">
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
                </div>
              ) : (
                <div className="alert alert-light border text-center mb-0">
                  No holiday markings found for this date range.
                </div>
              )}
            </div>

            <div className="d-md-none">
              {listLoading ? (
                <div className="alert alert-light border text-center mb-0">
                  Loading holiday records...
                </div>
              ) : filteredHolidayGroups.length > 0 ? (
                <div className="row g-3">
                  {filteredHolidayGroups.map((group, index) => (
                    <div className="col-12" key={group.key}>
                      <div className="card border shadow-sm">
                        <div className="card-body">
                          <div className="d-flex justify-content-between gap-2 mb-2">
                            <span className="badge text-bg-primary">
                              #{index + 1}
                            </span>
                            <strong>{moment(group.date).format("DD MMM YYYY")}</strong>
                          </div>

                          <div className="mb-2">
                            <div className="small text-muted">Description</div>
                            <div className="fw-semibold">
                              {group.description || "-"}
                            </div>
                          </div>

                          <div className="mb-3">
                            <div className="small text-muted">Classes</div>
                            <div className="fw-semibold">
                              {group.classNames.join(", ")}
                            </div>
                          </div>

                          <div className="d-grid gap-2">
                            <button
                              className="btn btn-warning btn-sm"
                              onClick={() => handleEditGroup(group)}
                            >
                              Edit
                            </button>

                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteGroup(group)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="alert alert-light border text-center mb-0">
                  No holiday markings found for this date range.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HolidayMarking;