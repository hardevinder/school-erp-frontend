import React, { useEffect, useMemo, useState } from "react";
import api from "../../api";
import Swal from "sweetalert2";

const PromotionHistory = () => {
  const [loading, setLoading] = useState(false);
  const [promotions, setPromotions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);

  const [filters, setFilters] = useState({
    from_session_id: "",
    to_session_id: "",
    from_class_id: "",
    to_class_id: "",
    from_section_id: "",
    to_section_id: "",
    promotion_type: "",
    search: "",
  });

  useEffect(() => {
    fetchMasters();
    fetchPromotionHistory();
  }, []);

  const fetchMasters = async () => {
    try {
      const [sessionsRes, classesRes, sectionsRes] = await Promise.all([
        api.get("/sessions"),
        api.get("/classes"),
        api.get("/sections"),
      ]);

      setSessions(Array.isArray(sessionsRes?.data) ? sessionsRes.data : []);
      setClasses(Array.isArray(classesRes?.data) ? classesRes.data : []);
      setSections(Array.isArray(sectionsRes?.data) ? sectionsRes.data : []);
    } catch (error) {
      console.error("Failed to load masters:", error);
      Swal.fire("Error", "Failed to load filter master data.", "error");
    }
  };

  const fetchPromotionHistory = async (customFilters = filters) => {
    try {
      setLoading(true);

      const params = {};

      Object.entries(customFilters || {}).forEach(([key, value]) => {
        if (
          value !== undefined &&
          value !== null &&
          String(value).trim() !== ""
        ) {
          params[key] = value;
        }
      });

      const res = await api.get("/students/promotion-history", { params });

      const rows =
        res?.data?.data ||
        res?.data?.rows ||
        res?.data?.promotions ||
        res?.data ||
        [];

      setPromotions(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error("Failed to fetch promotion history:", error);
      Swal.fire("Error", "Failed to load promotion history.", "error");
    } finally {
      setLoading(false);
    }
  };

  const getSessionName = (id) => {
    const found = sessions.find((s) => String(s.id) === String(id));
    return found?.session_name || found?.name || "-";
  };

  const getClassName = (id) => {
    const found = classes.find((c) => String(c.id) === String(id));
    return found?.class_name || found?.name || "-";
  };

  const getSectionName = (id) => {
    const found = sections.find((s) => String(s.id) === String(id));
    return found?.section_name || found?.name || "-";
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleApplyFilters = () => {
    fetchPromotionHistory(filters);
  };

  const clearFilters = () => {
    const cleared = {
      from_session_id: "",
      to_session_id: "",
      from_class_id: "",
      to_class_id: "",
      from_section_id: "",
      to_section_id: "",
      promotion_type: "",
      search: "",
    };
    setFilters(cleared);
    fetchPromotionHistory(cleared);
  };

  const filteredRows = useMemo(() => {
    return Array.isArray(promotions) ? promotions : [];
  }, [promotions]);

  return (
    <div className="container-fluid py-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <div>
          <h3 className="mb-1">Promotion History</h3>
          <div className="text-muted" style={{ fontSize: "14px" }}>
            View all student promotions with source and target details.
          </div>
        </div>

        <div className="d-flex gap-2">
          <button
            className="btn btn-primary"
            onClick={handleApplyFilters}
            disabled={loading}
          >
            {loading ? "Loading..." : "Apply Filters"}
          </button>

          <button
            className="btn btn-outline-primary"
            onClick={() => fetchPromotionHistory(filters)}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label">From Session</label>
              <select
                name="from_session_id"
                className="form-select"
                value={filters.from_session_id}
                onChange={handleChange}
              >
                <option value="">All</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.session_name || session.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label">To Session</label>
              <select
                name="to_session_id"
                className="form-select"
                value={filters.to_session_id}
                onChange={handleChange}
              >
                <option value="">All</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.session_name || session.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label">From Class</label>
              <select
                name="from_class_id"
                className="form-select"
                value={filters.from_class_id}
                onChange={handleChange}
              >
                <option value="">All</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.class_name || cls.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label">To Class</label>
              <select
                name="to_class_id"
                className="form-select"
                value={filters.to_class_id}
                onChange={handleChange}
              >
                <option value="">All</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.class_name || cls.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label">From Section</label>
              <select
                name="from_section_id"
                className="form-select"
                value={filters.from_section_id}
                onChange={handleChange}
              >
                <option value="">All</option>
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.section_name || sec.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label">To Section</label>
              <select
                name="to_section_id"
                className="form-select"
                value={filters.to_section_id}
                onChange={handleChange}
              >
                <option value="">All</option>
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.section_name || sec.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label">Promotion Type</label>
              <select
                name="promotion_type"
                className="form-select"
                value={filters.promotion_type}
                onChange={handleChange}
              >
                <option value="">All</option>
                <option value="promoted">Promoted</option>
                <option value="transferred">Transferred</option>
                <option value="repeated">Repeated</option>
                <option value="section_changed">Section Changed</option>
                <option value="session_rollover">Session Rollover</option>
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label">Search</label>
              <input
                type="text"
                name="search"
                className="form-control"
                placeholder="Student / Admission no / Father name"
                value={filters.search}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="mt-3 d-flex gap-2">
            <button
              className="btn btn-outline-secondary"
              onClick={clearFilters}
              disabled={loading}
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-body">
          <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
            <div>
              <h5 className="mb-1">Promotion Records</h5>
              <div className="text-muted" style={{ fontSize: "13px" }}>
                Total Records: {filteredRows.length}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center text-muted py-4">
              No promotion history found.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-bordered table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: "60px" }}>#</th>
                    <th>Student</th>
                    <th>Admission No.</th>
                    <th>Father Name</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Promotion Type</th>
                    <th>Remarks</th>
                    <th>Promoted By</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, index) => {
                    const studentName =
                      row?.student?.name ||
                      row?.student?.student_name ||
                      row?.student_name ||
                      row?.studentName ||
                      row?.name ||
                      "-";

                    const admissionNo =
                      row?.student?.admission_number ||
                      row?.admission_number ||
                      row?.admissionNo ||
                      "-";

                    const fatherName =
                      row?.student?.father_name ||
                      row?.father_name ||
                      "-";

                    const promotedBy =
                      row?.promotedByUser?.name ||
                      row?.promotedByUser?.username ||
                      row?.promoted_by_name ||
                      row?.promotedByName ||
                      row?.promoted_by ||
                      "-";

                    const promotedAt =
                      row?.promoted_at ||
                      row?.createdAt ||
                      row?.updatedAt ||
                      null;

                    return (
                      <tr key={row.id || index}>
                        <td>{index + 1}</td>
                        <td>{studentName}</td>
                        <td>{admissionNo}</td>
                        <td>{fatherName}</td>

                        <td>
                          <div>
                            <strong>Session:</strong>{" "}
                            {row?.fromSession?.session_name ||
                              row?.fromSession?.name ||
                              getSessionName(row?.from_session_id)}
                          </div>
                          <div>
                            <strong>Class:</strong>{" "}
                            {row?.fromClass?.class_name ||
                              row?.fromClass?.name ||
                              getClassName(row?.from_class_id)}
                          </div>
                          <div>
                            <strong>Section:</strong>{" "}
                            {row?.fromSection?.section_name ||
                              row?.fromSection?.name ||
                              getSectionName(row?.from_section_id)}
                          </div>
                        </td>

                        <td>
                          <div>
                            <strong>Session:</strong>{" "}
                            {row?.toSession?.session_name ||
                              row?.toSession?.name ||
                              getSessionName(row?.to_session_id)}
                          </div>
                          <div>
                            <strong>Class:</strong>{" "}
                            {row?.toClass?.class_name ||
                              row?.toClass?.name ||
                              getClassName(row?.to_class_id)}
                          </div>
                          <div>
                            <strong>Section:</strong>{" "}
                            {row?.toSection?.section_name ||
                              row?.toSection?.name ||
                              getSectionName(row?.to_section_id)}
                          </div>
                        </td>

                        <td style={{ textTransform: "capitalize" }}>
                          {String(row?.promotion_type || "promoted").replaceAll(
                            "_",
                            " "
                          )}
                        </td>

                        <td>{row?.remarks || "-"}</td>
                        <td>{promotedBy}</td>
                        <td>
                          {promotedAt
                            ? new Date(promotedAt).toLocaleString()
                            : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PromotionHistory;