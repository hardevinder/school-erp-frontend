import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import api from "../../api";

const BulkPromotion = () => {
  const navigate = useNavigate();

  const [loadingMasters, setLoadingMasters] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [executeLoading, setExecuteLoading] = useState(false);

  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [form, setForm] = useState({
    from_session_id: "",
    from_class_id: "",
    from_section_id: "",
    to_session_id: "",
    to_class_id: "",
    to_section_id: "",
  });

  const [previewRows, setPreviewRows] = useState([]);
  const [previewMeta, setPreviewMeta] = useState(null);

  useEffect(() => {
    fetchMasters();
  }, []);

  const fetchMasters = async () => {
    try {
      setLoadingMasters(true);

      const [classesRes, sectionsRes, sessionsRes] = await Promise.all([
        api.get("/classes"),
        api.get("/sections"),
        api.get("/sessions"),
      ]);

      const classesData = Array.isArray(classesRes?.data) ? classesRes.data : [];
      const sectionsData = Array.isArray(sectionsRes?.data) ? sectionsRes.data : [];
      const sessionsData = Array.isArray(sessionsRes?.data) ? sessionsRes.data : [];

      setClasses(classesData);
      setSections(sectionsData);
      setSessions(sessionsData);

      // Try to prefill active session if available
      const activeSession =
        sessionsData.find((s) => s.is_active || s.isActive || s.active) || null;

      if (activeSession?.id) {
        setForm((prev) => ({
          ...prev,
          from_session_id: String(activeSession.id),
        }));
      }
    } catch (error) {
      console.error("Failed to load masters:", error);
      Swal.fire("Error", "Failed to load classes, sections or sessions.", "error");
    } finally {
      setLoadingMasters(false);
    }
  };

  const getClassName = (id) => {
    const found = classes.find((c) => String(c.id) === String(id));
    return found?.class_name || found?.name || "-";
  };

  const getSectionName = (id) => {
    const found = sections.find((s) => String(s.id) === String(id));
    return found?.section_name || found?.name || "-";
  };

  const getSessionName = (id) => {
    const found = sessions.find((s) => String(s.id) === String(id));
    return found?.name || found?.session_name || "-";
  };

  // Sections API is returning global sections, not class-wise mapped sections
  const fromSections = useMemo(() => {
    return Array.isArray(sections) ? sections : [];
  }, [sections]);

  const toSections = useMemo(() => {
    return Array.isArray(sections) ? sections : [];
  }, [sections]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => {
      const updated = { ...prev, [name]: value };

      // reset dependent sections when class changes
      if (name === "from_class_id") updated.from_section_id = "";
      if (name === "to_class_id") updated.to_section_id = "";

      return updated;
    });

    // clear previous preview when user changes filters
    setPreviewRows([]);
    setPreviewMeta(null);
  };

  const validateForm = () => {
    if (!form.from_session_id) return "Please select current session.";
    if (!form.from_class_id) return "Please select current class.";
    if (!form.from_section_id) return "Please select current section.";
    if (!form.to_session_id) return "Please select new session.";
    if (!form.to_class_id) return "Please select new class.";
    if (!form.to_section_id) return "Please select new section.";

    if (
      String(form.from_session_id) === String(form.to_session_id) &&
      String(form.from_class_id) === String(form.to_class_id) &&
      String(form.from_section_id) === String(form.to_section_id)
    ) {
      return "Current and new session/class/section cannot be exactly the same.";
    }

    return null;
  };

  const buildPayload = () => ({
    from_session_id: Number(form.from_session_id),
    from_class_id: Number(form.from_class_id),
    from_section_id: Number(form.from_section_id),
    to_session_id: Number(form.to_session_id),
    to_class_id: Number(form.to_class_id),
    to_section_id: Number(form.to_section_id),
  });

  const handlePreview = async () => {
    const validationError = validateForm();
    if (validationError) {
      Swal.fire("Validation", validationError, "warning");
      return;
    }

    try {
      setPreviewLoading(true);
      setPreviewRows([]);
      setPreviewMeta(null);

      const payload = buildPayload();
      const res = await api.post("/students/bulk-promotion/preview", payload);

      const data = res?.data || {};
      const rows =
        data.students ||
        data.data ||
        data.records ||
        data.preview ||
        [];

      if (!Array.isArray(rows) || rows.length === 0) {
        Swal.fire(
          "No Students Found",
          "No students matched the selected current session, class and section.",
          "info"
        );
        return;
      }

      setPreviewRows(rows);
      setPreviewMeta(data);

      Swal.fire("Preview Ready", `${rows.length} student(s) found for promotion.`, "success");
    } catch (error) {
      console.error("Preview bulk promotion failed:", error);
      Swal.fire(
        "Error",
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          "Failed to preview students for promotion.",
        "error"
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleExecute = async () => {
    const validationError = validateForm();
    if (validationError) {
      Swal.fire("Validation", validationError, "warning");
      return;
    }

    if (!previewRows.length) {
      Swal.fire("Preview Required", "Please preview students before executing promotion.", "warning");
      return;
    }

    const confirm = await Swal.fire({
      title: "Confirm Bulk Promotion",
      html: `
        <div style="text-align:left">
          <p><strong>From:</strong> ${getSessionName(form.from_session_id)} / ${getClassName(
        form.from_class_id
      )} / ${getSectionName(form.from_section_id)}</p>
          <p><strong>To:</strong> ${getSessionName(form.to_session_id)} / ${getClassName(
        form.to_class_id
      )} / ${getSectionName(form.to_section_id)}</p>
          <p><strong>Total Students:</strong> ${previewRows.length}</p>
          <p style="color:#b91c1c;font-weight:600;margin-top:10px;">
            This action will promote all previewed students.
          </p>
        </div>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Promote",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#198754",
    });

    if (!confirm.isConfirmed) return;

    try {
      setExecuteLoading(true);

      const payload = buildPayload();
      const res = await api.post("/students/bulk-promotion/execute", payload);

      Swal.fire(
        "Success",
        res?.data?.message || "Students promoted successfully.",
        "success"
      );

      setPreviewRows([]);
      setPreviewMeta(null);

      // keep destination as next "from" if user wants another promotion batch
      setForm((prev) => ({
        ...prev,
        from_session_id: prev.to_session_id,
        from_class_id: prev.to_class_id,
        from_section_id: prev.to_section_id,
      }));
    } catch (error) {
      console.error("Execute bulk promotion failed:", error);
      Swal.fire(
        "Error",
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          "Failed to execute bulk promotion.",
        "error"
      );
    } finally {
      setExecuteLoading(false);
    }
  };

  return (
    <div className="container-fluid py-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <div>
          <h3 className="mb-1">Bulk Student Promotion</h3>
          <div className="text-muted" style={{ fontSize: "14px" }}>
            Preview students first, then promote them to a new session/class/section.
          </div>
        </div>

        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => navigate(-1)}
          >
            Back
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handlePreview}
            disabled={previewLoading || executeLoading || loadingMasters}
          >
            {previewLoading ? "Previewing..." : "Preview Students"}
          </button>

          <button
            type="button"
            className="btn btn-success"
            onClick={handleExecute}
            disabled={
              executeLoading ||
              previewLoading ||
              loadingMasters ||
              previewRows.length === 0
            }
          >
            {executeLoading ? "Promoting..." : "Execute Promotion"}
          </button>
        </div>
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          {loadingMasters ? (
            <div className="text-center py-4">Loading...</div>
          ) : (
            <div className="row g-3">
              <div className="col-md-6">
                <div className="border rounded p-3 h-100">
                  <h5 className="mb-3">Current Details</h5>

                  <div className="mb-3">
                    <label className="form-label">Current Session</label>
                    <select
                      name="from_session_id"
                      className="form-select"
                      value={form.from_session_id}
                      onChange={handleChange}
                    >
                      <option value="">Select Session</option>
                      {sessions.map((session) => (
                        <option key={session.id} value={session.id}>
                          {session.name || session.session_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Current Class</label>
                    <select
                      name="from_class_id"
                      className="form-select"
                      value={form.from_class_id}
                      onChange={handleChange}
                    >
                      <option value="">Select Class</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.class_name || cls.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Current Section</label>
                    <select
                      name="from_section_id"
                      className="form-select"
                      value={form.from_section_id}
                      onChange={handleChange}
                    >
                      <option value="">Select Section</option>
                      {fromSections.map((sec) => (
                        <option key={sec.id} value={sec.id}>
                          {sec.section_name || sec.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <div className="border rounded p-3 h-100">
                  <h5 className="mb-3">Promotion Target</h5>

                  <div className="mb-3">
                    <label className="form-label">New Session</label>
                    <select
                      name="to_session_id"
                      className="form-select"
                      value={form.to_session_id}
                      onChange={handleChange}
                    >
                      <option value="">Select Session</option>
                      {sessions.map((session) => (
                        <option key={session.id} value={session.id}>
                          {session.name || session.session_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">New Class</label>
                    <select
                      name="to_class_id"
                      className="form-select"
                      value={form.to_class_id}
                      onChange={handleChange}
                    >
                      <option value="">Select Class</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.class_name || cls.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">New Section</label>
                    <select
                      name="to_section_id"
                      className="form-select"
                      value={form.to_section_id}
                      onChange={handleChange}
                    >
                      <option value="">Select Section</option>
                      {toSections.map((sec) => (
                        <option key={sec.id} value={sec.id}>
                          {sec.section_name || sec.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-body">
          <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
            <div>
              <h5 className="mb-1">Preview Students</h5>
              <div className="text-muted" style={{ fontSize: "13px" }}>
                Students matching selected current session, class and section.
              </div>
            </div>

            {previewRows.length > 0 && (
              <span className="badge bg-primary" style={{ fontSize: "13px" }}>
                Total: {previewRows.length}
              </span>
            )}
          </div>

          {previewMeta && (
            <div className="alert alert-light border mb-3">
              <div>
                <strong>From:</strong> {getSessionName(form.from_session_id)} /{" "}
                {getClassName(form.from_class_id)} / {getSectionName(form.from_section_id)}
              </div>
              <div>
                <strong>To:</strong> {getSessionName(form.to_session_id)} /{" "}
                {getClassName(form.to_class_id)} / {getSectionName(form.to_section_id)}
              </div>
            </div>
          )}

          {!previewRows.length ? (
            <div className="text-center text-muted py-4">
              No preview data yet. Select details and click <strong>Preview Students</strong>.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-bordered table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: "70px" }}>#</th>
                    <th>Admission No.</th>
                    <th>Name</th>
                    <th>Father Name</th>
                    <th>Current Class</th>
                    <th>Current Section</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((stu, idx) => (
                    <tr key={stu.id || idx}>
                      <td>{idx + 1}</td>
                      <td>{stu.admission_number || "-"}</td>
                      <td>{stu.name || "-"}</td>
                      <td>{stu.father_name || "-"}</td>
                      <td>
                        {stu.class_name ||
                          stu.Class?.class_name ||
                          getClassName(form.from_class_id)}
                      </td>
                      <td>
                        {stu.section_name ||
                          stu.Section?.section_name ||
                          getSectionName(form.from_section_id)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkPromotion;