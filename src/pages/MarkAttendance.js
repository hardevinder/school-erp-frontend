// src/pages/MarkAttendance.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import moment from "moment";
import api from "../api";
import Swal from "sweetalert2";
import "./Attendance.css";

const statuses = ["present", "absent", "late", "leave", "halfday"]; // ✅ added halfday

// --- URL helpers ---
const getApiBase = () =>
  (process.env.REACT_APP_API_URL || api?.defaults?.baseURL || "").replace(/\/+$/, "");

const getUploadBase = () => getApiBase().replace(/\/api(?:\/v\d+)?$/, "");

const buildPhotoURL = (photo) => {
  if (!photo) return null;
  if (/^https?:\/\//i.test(photo)) return photo;
  const base = getUploadBase();
  return `${base}/uploads/photoes/students/${photo}`;
};

const MarkAttendance = () => {
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [recordIds, setRecordIds] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [mode, setMode] = useState("create"); // "create" or "edit"
  const [loading, setLoading] = useState(false);

  const [teacherClassId, setTeacherClassId] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [query, setQuery] = useState("");

  // Fetch students for the incharge
  const fetchStudents = async () => {
    try {
      const { data } = await api.get("/incharges/students");
      const fetchedStudents = Array.isArray(data?.students) ? data.students : [];

      fetchedStudents.sort((a, b) => {
        const byName = (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
        if (byName !== 0) return byName;
        return (a.admission_number || "").localeCompare(b.admission_number || "", undefined, {
          numeric: true,
        });
      });

      setStudents(fetchedStudents);

      if (fetchedStudents.length > 0) {
        setTeacherClassId(fetchedStudents[0].class_id || null);
      }

      const initialAttendance = {};
      fetchedStudents.forEach((student) => {
        initialAttendance[student.id] = "present";
      });
      setAttendance(initialAttendance);
    } catch (error) {
      console.error("Error fetching students for attendance:", error);
      Swal.fire("Error", "Failed to fetch students.", "error");
    }
  };

  // Fetch holidays from the API
  const fetchHolidays = async () => {
    try {
      const { data } = await api.get("/holidays");
      setHolidays(data);
    } catch (error) {
      console.error("Error fetching holidays:", error);
    }
  };

  // Fetch attendance records for a given date (memoized for hook deps)
  const fetchAttendanceForDate = useCallback(
    async (date) => {
      try {
        const { data } = await api.get(`/attendance/date/${date}`);
        if (Array.isArray(data) && data.length > 0) {
          setMode("edit");
          const attendanceMap = {};
          const recordIdMap = {};
          data.forEach((record) => {
            attendanceMap[record.studentId] = record.status;
            recordIdMap[record.studentId] = record.id;
          });
          setAttendance(attendanceMap);
          setRecordIds(recordIdMap);
        } else {
          setMode("create");
          const initialAttendance = {};
          students.forEach((student) => {
            initialAttendance[student.id] = "present";
          });
          setAttendance(initialAttendance);
          setRecordIds({});
        }
      } catch (error) {
        console.error("Error fetching attendance for date:", error);
        setMode("create");
        const initialAttendance = {};
        students.forEach((student) => {
          initialAttendance[student.id] = "present";
        });
        setAttendance(initialAttendance);
        setRecordIds({});
      }
    },
    [students]
  );

  useEffect(() => {
    fetchStudents();
    fetchHolidays();
  }, []);

  useEffect(() => {
    if (students.length) {
      fetchAttendanceForDate(selectedDate);
    }
  }, [selectedDate, students, fetchAttendanceForDate]);

  const handleAttendanceChange = (studentId, status) => {
    setAttendance((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleMarkAll = (status) => {
    const updatedAttendance = {};
    students.forEach((student) => {
      updatedAttendance[student.id] = status;
    });
    setAttendance(updatedAttendance);
  };

  const summaryCounts = useMemo(() => {
    const acc = { present: 0, absent: 0, late: 0, leave: 0, halfday: 0 }; // ✅ include halfday
    students.forEach((student) => {
      const status = attendance[student.id];
      if (status && Object.prototype.hasOwnProperty.call(acc, status)) {
        acc[status] += 1;
      }
    });
    return acc;
  }, [students, attendance]);

  const totalStudents = students.length;

  const filteredStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.admission_number || "").toLowerCase().includes(q)
    );
  }, [students, query]);

  const getRowClass = (status) => {
    switch (status) {
      case "absent":
        return "table-danger";
      case "late":
        return "table-warning";
      case "leave":
        return "table-info";
      case "halfday": // ✅ visual hint for halfday
        return "table-primary";
      default:
        return "";
    }
  };

  const classLabel = useMemo(() => {
    const first = students[0];
    const cn = first?.class_name || first?.Class?.class_name;
    const sn = first?.section_name || first?.Section?.section_name;
    if (!cn && !sn) return null;
    return `${cn || "Class"}${sn ? ` - ${sn}` : ""}`;
  }, [students]);

  const selectedMoment = moment(selectedDate, "YYYY-MM-DD");
  const today = moment().startOf("day");

  // ---- Submit handler (CREATE/UPDATE with bulk + fallback) ----
  const handleSubmit = async () => {
    setLoading(true);
    try {
      const allRecords = students.map((s) => ({
        studentId: s.id,
        status: attendance[s.id] || "present",
        date: selectedDate,
        id: recordIds[s.id] || null,
      }));

      if (mode === "create") {
        const newRecords = allRecords.map(({ studentId, status }) => ({ studentId, status }));
        try {
          await api.post("/attendance/bulk", { date: selectedDate, records: newRecords });
        } catch (bulkErr) {
          for (const rec of newRecords) {
            // eslint-disable-next-line no-await-in-loop
            await api.post("/attendance", { ...rec, date: selectedDate });
          }
        }
        Swal.fire("Success", "Attendance submitted.", "success");
      } else {
        const toUpdate = allRecords.filter((r) => !!r.id);
        const toCreate = allRecords.filter((r) => !r.id);

        if (toUpdate.length) {
          try {
            await api.put("/attendance/bulk", {
              date: selectedDate,
              records: toUpdate.map((r) => ({ id: r.id, status: r.status })),
            });
          } catch (bulkUpdateErr) {
            for (const r of toUpdate) {
              // eslint-disable-next-line no-await-in-loop
              await api.put(`/attendance/${r.id}`, { status: r.status });
            }
          }
        }

        if (toCreate.length) {
          try {
            await api.post("/attendance/bulk", {
              date: selectedDate,
              records: toCreate.map((r) => ({ studentId: r.studentId, status: r.status })),
            });
          } catch (bulkCreateErr) {
            for (const r of toCreate) {
              // eslint-disable-next-line no-await-in-loop
              await api.post("/attendance", { studentId: r.studentId, status: r.status, date: selectedDate });
            }
          }
        }

        Swal.fire("Saved", "Attendance updated.", "success");
      }

      await fetchAttendanceForDate(selectedDate);
    } catch (err) {
      console.error("Save attendance failed:", err);
      Swal.fire("Error", "Failed to save attendance.", "error");
    } finally {
      setLoading(false);
    }
  };

  // ---- Early returns for invalid dates/holidays ----
  if (selectedMoment.isAfter(today)) {
    return (
      <div className="container mt-4">
        <header className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
          <h1 className="h3 m-0">Mark Attendance</h1>
          <div>
            <input
              type="date"
              id="attendanceDate"
              className="form-control"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </header>
        <div className="alert alert-info">Attendance cannot be marked for future dates.</div>
      </div>
    );
  }

  if (selectedMoment.day() === 0) {
    return (
      <div className="container mt-4">
        <header className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
          <h1 className="h3 m-0">Mark Attendance</h1>
          <div>
            <input
              type="date"
              id="attendanceDate"
              className="form-control"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </header>
        <div className="alert alert-info">{selectedMoment.format("LL")} is Sunday. No attendance required.</div>
      </div>
    );
  }

  const holidayForDate = holidays.find(
    (holiday) =>
      holiday.date === selectedDate &&
      teacherClassId &&
      holiday.class &&
      Number(holiday.class.id) === Number(teacherClassId)
  );
  if (holidayForDate) {
    return (
      <div className="container mt-4">
        <header className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
          <h1 className="h3 m-0">Mark Attendance</h1>
          <div>
            <input
              type="date"
              id="attendanceDate"
              className="form-control"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </header>
        <div className="alert alert-info">
          {selectedMoment.format("LL")} is a holiday: <strong>{holidayForDate.description}</strong>
        </div>
      </div>
    );
  }

  // ---- UI ----
  return (
    <div className="container mt-4">
      {/* Header Bar */}
      <header className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <div>
          <h1 className="h3 m-0">Mark Attendance</h1>
          {classLabel && <div className="text-muted small">{classLabel} • {moment(selectedDate).format("LL")}</div>}
        </div>
        <div className="d-flex gap-2">
          <input
            type="date"
            id="attendanceDate"
            className="form-control"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <input
            type="text"
            className="form-control"
            placeholder="Search by name or admission no..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </header>

      {/* Summary Cards */}
      <div className="row g-3 mb-2">
        <div className="col-6 col-md-3">
          <div className="card shadow-sm">
            <div className="card-body">
              <div className="text-muted small">Total Students</div>
              <div className="fs-4 fw-semibold">{totalStudents}</div>
            </div>
          </div>
        </div>
        {statuses.map((status) => (
          <div className="col-6 col-md-3" key={status}>
            <div className="card shadow-sm border-0">
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between">
                  <div className="text-muted small text-capitalize">{status}</div>
                  <span
                    className={`badge rounded-pill ${
                      status === "absent" ? "bg-danger" :
                      status === "late" ? "bg-warning" :
                      status === "leave" ? "bg-info" :
                      status === "halfday" ? "bg-primary" :
                      "bg-success"
                    }`}
                  >
                    {summaryCounts[status]}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Compact Actions near cards */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <div className="btn-group btn-group-sm" role="group" aria-label="Quick actions">
          <button className="btn btn-outline-success" onClick={() => handleMarkAll("present")}>
            All Present
          </button>
          <button className="btn btn-outline-danger" onClick={() => handleMarkAll("absent")}>
            All Absent
          </button>
          <button className="btn btn-outline-primary" onClick={() => handleMarkAll("halfday")}>
            All Halfday
          </button>
        </div>

        <div className="d-flex align-items-center gap-2">
          {mode === "edit" && (
            <span className="badge text-bg-info">
              Editing existing records
            </span>
          )}
          <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={loading}>
            {loading ? "Submitting..." : mode === "create" ? "Submit" : "Update"}
          </button>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="table-responsive">
        <table className="table align-middle table-striped">
          <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
            <tr>
              <th style={{ width: 56 }}>#</th>
              <th>Admission No.</th>
              <th>Name</th>
              <th>Attendance</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length ? (
              filteredStudents.map((s, index) => (
                <tr key={s.id} className={getRowClass(attendance[s.id])}>
                  <td>{index + 1}</td>
                  <td>
                    <span className="badge bg-secondary-subtle text-dark border" title="Admission Number">
                      {s.admission_number || "—"}
                    </span>
                  </td>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      {(() => {
                        const photoUrl = buildPhotoURL(s.photo);
                        return photoUrl ? (
                          <img
                            src={photoUrl}
                            alt={s.name}
                            width={32}
                            height={32}
                            className="rounded-circle object-fit-cover border"
                          />
                        ) : (
                          <div
                            className="rounded-circle bg-light border d-inline-flex align-items-center justify-content-center"
                            style={{ width: 32, height: 32 }}
                          >
                            <span className="small text-muted">N/A</span>
                          </div>
                        );
                      })()}
                      <div>
                        <div className="fw-semibold">{s.name}</div>
                        <div className="text-muted small">Roll: {s.roll_number ?? "—"}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="d-flex flex-wrap gap-3">
                      {statuses.map((status) => (
                        <label key={status} className="form-check form-check-inline m-0">
                          <input
                            type="radio"
                            name={`attendance-${s.id}`}
                            value={status}
                            checked={attendance[s.id] === status}
                            onChange={(e) => handleAttendanceChange(s.id, e.target.value)}
                            className="form-check-input"
                          />
                          <span className="form-check-label text-capitalize">{status}</span>
                        </label>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="text-center text-muted">No students found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Fixed Action Bar */}
      <div
        className="d-sm-none fixed-bottom bg-white border-top shadow-sm px-3 py-2"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
        }}
      >
        <div className="d-flex align-items-center justify-content-between gap-2">
          <div className="btn-group btn-group-sm" role="group" aria-label="Quick actions mobile">
            <button className="btn btn-outline-success" onClick={() => handleMarkAll("present")}>
              All Present
            </button>
            <button className="btn btn-outline-danger" onClick={() => handleMarkAll("absent")}>
              All Absent
            </button>
            <button className="btn btn-outline-primary" onClick={() => handleMarkAll("halfday")}>
              All Halfday
            </button>
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={loading}>
            {loading ? "Submitting..." : mode === "create" ? "Submit" : "Update"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MarkAttendance;
