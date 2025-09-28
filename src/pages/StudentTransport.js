import React, { useState, useEffect, useRef } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./Students.css";

const StudentTransport = () => {
  const singleRole = localStorage.getItem("userRole");
  const multiRoles = JSON.parse(localStorage.getItem("roles") || "[]");
  const roles = multiRoles.length ? multiRoles : [singleRole].filter(Boolean);
  const isAdmin = roles.includes("admin");
  const isSuperadmin = roles.includes("superadmin");
  const isAdminOrSuperAdmin = isAdmin || isSuperadmin;

  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterRoute, setFilterRoute] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(false);

  const [selectedSession, setSelectedSession] = useState("");
  const sessionsLoadedRef = useRef(false);

  // ---------- Fetch helpers ----------
  const fetchSessions = async () => {
    try {
      const res = await api.get("/sessions");
      console.log("fetchSessions response:", res);

      const sList = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];
      setSessions(sList);

      const activeSession =
        sList.find((s) => s.active === true || s.is_active === true) ||
        sList[0];
      if (activeSession) {
        setSelectedSession(String(activeSession.id));
        sessionsLoadedRef.current = true;
        return String(activeSession.id);
      } else {
        setSelectedSession("");
        sessionsLoadedRef.current = true;
        return "";
      }
    } catch (err) {
      console.error("fetchSessions error:", err);
      sessionsLoadedRef.current = true;
      return "";
    }
  };

  const fetchClasses = async () => {
    try {
      const res = await api.get("/classes");
      const list = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];
      setClasses(list);
    } catch (err) {
      console.error("fetchClasses:", err);
    }
  };

  const fetchSections = async () => {
    try {
      const res = await api.get("/sections");
      const list = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];
      setSections(list);
    } catch (err) {
      console.error("fetchSections:", err);
    }
  };

  const fetchRoutes = async () => {
    try {
      const res = await api.get("/transportations");
      const list = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];
      setRoutes(list);
    } catch (err) {
      console.error("fetchRoutes:", err);
    }
  };

  const fetchStudentsForCache = async (sessId) => {
    try {
      const qs = sessId ? `?session_id=${sessId}` : "";
      const res = await api.get(`/students${qs}`);
      console.log("fetchStudentsForCache response:", res);
      const list = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];
      setStudents(list);
    } catch (err) {
      console.error("fetchStudentsForCache:", err);
    }
  };

  /**
   * fetchAssignments
   * - will try with session filter if sessionId param or selectedSession present
   * - on server error will retry without session param (useful if DB doesn't have session column)
   */
  const fetchAssignments = async (quiet = false, overrideSessionId = null) => {
    if (!quiet) setLoading(true);
    try {
      const sessToUse =
        overrideSessionId !== null ? overrideSessionId : selectedSession;
      const qParts = [];
      if (filterClass) qParts.push(`class_id=${filterClass}`);
      if (filterSection) qParts.push(`section_id=${filterSection}`);
      if (filterRoute) qParts.push(`transport_id=${filterRoute}`);
      if (filterStatus) qParts.push(`status=${filterStatus}`);
      if (sessToUse) qParts.push(`session_id=${sessToUse}`);
      const qs = qParts.length ? `?${qParts.join("&")}` : "";

      console.log("fetchAssignments: requesting /student-transport" + qs);
      const resp = await api.get(`/student-transport${qs}`);
      console.log("/student-transport response:", resp);

      const rows = Array.isArray(resp.data?.data)
        ? resp.data.data
        : Array.isArray(resp.data)
        ? resp.data
        : resp.data?.data ?? [];

      const normalized = rows.map((r) => {
        const item = typeof r.toJSON === "function" ? r.toJSON() : r;

        // ensure class_id / section_id are set from either assignment row, association, or Student fallback
        const class_id =
          item.class_id ?? (item.Class && item.Class.id) ?? (item.Student && item.Student.class_id) ?? null;
        const section_id =
          item.section_id ?? (item.Section && item.Section.id) ?? (item.Student && item.Student.section_id) ?? null;

        return {
          ...item,
          session_id:
            item.session_id ?? (item.Session && item.Session.id) ?? null,
          class_id,
          section_id,
        };
      });

      console.log("fetchAssignments normalized:", normalized);
      setAssignments(normalized);
      return;
    } catch (err) {
      console.error("fetchAssignments error (with session maybe):", err);

      try {
        const errMsg = err?.response?.data || err?.message || "";
        const triedWithSession = selectedSession || overrideSessionId;
        const shouldRetry =
          triedWithSession &&
          (errMsg?.message?.includes?.("Unknown column") ||
            err.response?.status >= 500 ||
            typeof errMsg === "string");

        if (shouldRetry) {
          console.warn(
            "Retrying fetchAssignments without session filter due to server error:",
            errMsg
          );
          const qParts2 = [];
          if (filterClass) qParts2.push(`class_id=${filterClass}`);
          if (filterSection) qParts2.push(`section_id=${filterSection}`);
          if (filterRoute) qParts2.push(`transport_id=${filterRoute}`);
          if (filterStatus) qParts2.push(`status=${filterStatus}`);
          const qs2 = qParts2.length ? `?${qParts2.join("&")}` : "";
          const resp2 = await api.get(`/student-transport${qs2}`);
          console.log("/student-transport retry response:", resp2);

          const rows2 = Array.isArray(resp2.data?.data)
            ? resp2.data.data
            : Array.isArray(resp2.data)
            ? resp2.data
            : resp2.data?.data ?? [];

          const normalized2 = rows2.map((r) => {
            const item = typeof r.toJSON === "function" ? r.toJSON() : r;
            const class_id =
              item.class_id ?? (item.Class && item.Class.id) ?? (item.Student && item.Student.class_id) ?? null;
            const section_id =
              item.section_id ?? (item.Section && item.Section.id) ?? (item.Student && item.Student.section_id) ?? null;

            return {
              ...item,
              session_id:
                item.session_id ?? (item.Session && item.Session.id) ?? null,
              class_id,
              section_id,
            };
          });

          setAssignments(normalized2);
          return;
        }
      } catch (retryErr) {
        console.error("fetchAssignments retry error:", retryErr);
      }

      setAssignments([]);
      Swal.fire("Error", "Failed to fetch assignments", "error");
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  // ---------- Lifecycle ----------
  useEffect(() => {
    (async () => {
      const initialSessionId = await fetchSessions();
      await Promise.all([fetchClasses(), fetchSections(), fetchRoutes()]);
      await fetchStudentsForCache(initialSessionId);
      await fetchAssignments(true, initialSessionId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sessionsLoadedRef.current) return;
    fetchStudentsForCache(selectedSession);
    fetchAssignments(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSession]);

  useEffect(() => {
    fetchAssignments(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterClass, filterSection, filterRoute, filterStatus]);

  // ---------- Import / Export ----------
  const openImportDialog = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";
    input.onchange = (e) => {
      const f = e.target.files[0];
      if (f) handleImport(f);
    };
    input.click();
  };

  const handleImport = async (file) => {
    if (!file) return;
    setImporting(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await api.post("/student-transport/import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      Swal.fire("Imported", res.data?.message || "Import finished", "success");
      await fetchAssignments();
    } catch (err) {
      console.error("handleImport:", err);
      Swal.fire("Error", err.response?.data?.message || "Import failed", "error");
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    try {
      const qs = selectedSession ? `?session_id=${selectedSession}` : "";
      const resp = await api.get(`/student-transport/export${qs}`, {
        responseType: "blob",
      });
      const blob = new Blob([resp.data], {
        type: resp.headers["content-type"] || "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `StudentTransportAssignments_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("handleExport:", err);
      Swal.fire("Error", "Failed to export assignments", "error");
    }
  };

  // ---------- CRUD ----------
  const handleDelete = async (id) => {
    if (!isSuperadmin) return;
    const result = await Swal.fire({
      title: `Delete assignment?`,
      text: `This will permanently delete the assignment.`,
      icon: "warning",
      showCancelButton: true,
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/student-transport/${id}`);
      Swal.fire("Deleted", "Assignment deleted", "success");
      fetchAssignments();
    } catch (err) {
      console.error("delete assignment:", err);
      Swal.fire("Error", "Failed to delete", "error");
    }
  };

  const toggleStatus = async (assignment) => {
    const newStatus = assignment.status === "active" ? "inactive" : "active";
    try {
      await api.patch(`/student-transport/${assignment.id}/status`, {
        status: newStatus,
      });
      Swal.fire("Updated", `Assignment set to ${newStatus}`, "success");
      fetchAssignments();
    } catch (err) {
      console.error("toggleStatus:", err);
      Swal.fire("Error", "Failed to update status", "error");
    }
  };

  // ---------- Add / Edit modal (session first required) ----------
  const showAssignmentForm = async (mode = "add", assignment = null) => {
    await fetchSessions();
    await Promise.all([fetchClasses(), fetchSections(), fetchRoutes()]);
    await fetchStudentsForCache(selectedSession);

    const isEdit = mode === "edit";
    const a = assignment || {};

    const sessionOptions =
      `<option value="">Select Session</option>` +
      sessions
        .map(
          (ss) =>
            `<option value="${ss.id}" ${String(ss.id) === String(a.session_id || selectedSession) ? "selected" : ""
            }>${ss.name}</option>`
        )
        .join("");

    const classOptions =
      `<option value="">Select Class</option>` +
      classes
        .map(
          (c) =>
            `<option value="${c.id}" ${String(c.id) === String(a.class_id) ? "selected" : ""}>${c.class_name}</option>`
        )
        .join("");

    const sectionOptionsMarkup = sections
      .map(
        (s) =>
          `<option value="${s.id}" data-class="${s.class_id}" ${String(s.id) === String(a.section_id) ? "selected" : ""
          }>${s.section_name}</option>`
      )
      .join("");

    const routeOptions =
      `<option value="">Select Route</option>` +
      routes
        .map(
          (r) =>
            `<option value="${r.id}" ${r.id === a.transport_id ? "selected" : ""
            }>${r.RouteName}</option>`
        )
        .join("");

    const html = `
      <div style="max-height:60vh;overflow:auto;padding-right:8px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label>Session <span style="color:#d00">*</span></label>
            <select id="f_session_id" class="form-field form-select">${sessionOptions}</select>
          </div>

          <div>
            <label>Class <span style="color:#d00">*</span></label>
            <select id="f_class_id" class="form-field form-select">${classOptions}</select>
          </div>

          <div>
            <label>Section <span style="color:#d00">*</span></label>
            <select id="f_section_id" class="form-field form-select">
              <option value="">Select Section</option>
              ${sectionOptionsMarkup}
            </select>
          </div>

          <div>
            <label>Student <span style="color:#d00">*</span></label>
            <select id="f_student_id" class="form-field form-select">
              <option value="">Select student</option>
            </select>
          </div>

          <div>
            <label>Route <span style="color:#d00">*</span></label>
            <select id="f_transport_id" class="form-field form-select">${routeOptions}</select>
          </div>

          <div>
            <label>Start Date</label>
            <input id="f_start_date" class="form-field form-control" type="date" value="${a.start_date ? a.start_date.split("T")[0] : ""}" />
          </div>

          <div>
            <label>End Date</label>
            <input id="f_end_date" class="form-field form-control" type="date" value="${a.end_date ? a.end_date.split("T")[0] : ""}" />
          </div>

          <div>
            <label>Status</label>
            <select id="f_status" class="form-field form-select">
              <option value="active" ${a.status === "active" ? "selected" : ""}>Active</option>
              <option value="inactive" ${a.status === "inactive" ? "selected" : ""}>Inactive</option>
            </select>
          </div>
        </div>
      </div>
    `;

    const popup = await Swal.fire({
      title: isEdit ? "Edit Transport Assignment" : "Assign Route to Student",
      width: "900px",
      html,
      showCancelButton: true,
      focusConfirm: false,
      preConfirm: () => {
        const payload = {
          session_id: document.getElementById("f_session_id")?.value || null,
          class_id: document.getElementById("f_class_id")?.value || null,    // <- ADDED
          section_id: document.getElementById("f_section_id")?.value || null, // <- ADDED
          student_id: document.getElementById("f_student_id")?.value || null,
          transport_id: document.getElementById("f_transport_id")?.value || null,
          start_date: document.getElementById("f_start_date")?.value || null,
          end_date: document.getElementById("f_end_date")?.value || null,
          status: document.getElementById("f_status")?.value || "active",
        };

        if (!payload.session_id) Swal.showValidationMessage("Session is required");
        if (!payload.student_id) Swal.showValidationMessage("Student is required");
        if (!payload.transport_id) Swal.showValidationMessage("Route is required");
        return payload;
      },
      didOpen: () => {
        const sessionSel = document.getElementById("f_session_id");
        const classSel = document.getElementById("f_class_id");
        const sectionSel = document.getElementById("f_section_id");
        const studentSel = document.getElementById("f_student_id");

        const populateSectionsForClass = (classId) => {
          const opts = [`<option value="">Select Section</option>`].concat(
            sections
              .filter((s) => !classId || String(s.class_id) === String(classId))
              .map((s) => `<option value="${s.id}" ${String(s.id) === String(a.section_id) ? "selected" : ""}>${s.section_name}</option>`)
          );
          sectionSel.innerHTML = opts.join("");
        };

        const fetchAndPopulateStudents = async (classId, sectionId, sessId) => {
          studentSel.innerHTML = `<option value="">Loading...</option>`;
          if (!sessId) {
            studentSel.innerHTML = `<option value="">Select session first</option>`;
            return;
          }
          if (!classId) {
            studentSel.innerHTML = `<option value="">Select class first</option>`;
            return;
          }
          try {
            const url = `/students/sibling-list?class_id=${classId}${sectionId ? `&section_id=${sectionId}` : ""}${sessId ? `&session_id=${sessId}` : ""}`;
            const { data } = await api.get(url);
            const list = Array.isArray(data) ? data : data?.data ?? [];
            if (!Array.isArray(list) || list.length === 0) {
              studentSel.innerHTML = `<option value="">No students</option>`;
              return;
            }
            const opts = [`<option value="">Select student</option>`].concat(
              list.map((st) => `<option value="${st.id}" ${String(st.id) === String(a.student_id) ? "selected" : ""}>${st.name}${st.admission_number ? ` (AN:${st.admission_number})` : ""}</option>`)
            );
            studentSel.innerHTML = opts.join("");
          } catch (err) {
            console.error("fetch students:", err);
            studentSel.innerHTML = `<option value="">Error loading</option>`;
          }
        };

        sessionSel.onchange = async () => {
          await fetchAndPopulateStudents(classSel.value, sectionSel.value || "", sessionSel.value || selectedSession);
        };

        classSel.onchange = async () => {
          populateSectionsForClass(classSel.value);
          await fetchAndPopulateStudents(classSel.value, sectionSel.value || "", sessionSel.value || selectedSession);
        };
        sectionSel.onchange = async () => {
          await fetchAndPopulateStudents(classSel.value, sectionSel.value || "", sessionSel.value || selectedSession);
        };

        (async () => {
          const initialSession = a.session_id ? String(a.session_id) : (selectedSession ? String(selectedSession) : "");
          if (initialSession) sessionSel.value = initialSession;

          if (a.class_id) {
            classSel.value = a.class_id;
            populateSectionsForClass(a.class_id);
            if (a.section_id) sectionSel.value = a.section_id;
            await fetchAndPopulateStudents(a.class_id, a.section_id || "", sessionSel.value || initialSession);
          } else {
            populateSectionsForClass("");
            studentSel.innerHTML = `<option value="">Select session & class first</option>`;
          }
        })();
      },
    });

    if (!popup.isConfirmed) return;
    const payload = popup.value;

    try {
      if (isEdit) {
        await api.put(`/student-transport/${assignment.id}`, payload);
        Swal.fire("Saved", "Assignment updated", "success");
      } else {
        await api.post("/student-transport", payload);
        Swal.fire("Added", "Assignment created", "success");
      }
      fetchAssignments();
    } catch (err) {
      console.error("submit assignment:", err);
      Swal.fire("Error", err.response?.data?.message || "Failed to save assignment", "error");
    }
  };

  // ---------- View & filter ----------
  function handleView(item) {
    const html = `
      <div class="table-responsive">
        <table class="table table-bordered table-sm text-start">
          <tbody>
            <tr><th>ID</th><td>${item.id}</td></tr>
            <tr><th>Student</th><td>${item.Student?.name || "-"} (${item.student_id})</td></tr>
            <tr><th>Admission #</th><td>${item.Student?.admission_number || "-"}</td></tr>
            <tr><th>Route</th><td>${item.Transportation?.RouteName || "-"}</td></tr>
            <tr><th>Start</th><td>${item.start_date ? item.start_date.split("T")[0] : "-"}</td></tr>
            <tr><th>End</th><td>${item.end_date ? item.end_date.split("T")[0] : "-"}</td></tr>
            <tr><th>Status</th><td>${item.status}</td></tr>
            <tr><th>Session</th><td>${item.session_id ?? (item.Session?.id ?? "-")}</td></tr>
            <tr><th>Class</th><td>${item.Class?.class_name || item.Student?.class_name || "-"}</td></tr>
            <tr><th>Section</th><td>${item.Section?.section_name || item.Student?.section_name || "-"}</td></tr>
          </tbody>
        </table>
      </div>
    `;
    Swal.fire({ title: "Assignment", html, width: 650 });
  }

  const filtered = assignments.filter((a) => {
    const q = search.trim().toLowerCase();
    const textMatch =
      !q ||
      [
        a.Student?.name,
        a.Student?.admission_number,
        a.Transportation?.RouteName,
      ].some((v) => (v || "").toString().toLowerCase().includes(q));

    // check either assignment-level or student-level class/section
    const assignmentClassId = a.class_id ?? a.Class?.id ?? a.Student?.class_id;
    const assignmentSectionId = a.section_id ?? a.Section?.id ?? a.Student?.section_id;

    const classMatch = !filterClass || String(assignmentClassId) === String(filterClass);
    const sectionMatch = !filterSection || String(assignmentSectionId) === String(filterSection);
    const routeMatch = !filterRoute || String(a.transport_id) === String(filterRoute);
    const statusMatch = !filterStatus || a.status === filterStatus;

    const assignmentSession = a.session_id ?? (a.Session && a.Session.id) ?? "";
    const sessionMatch = !selectedSession || String(assignmentSession) === String(selectedSession);

    return textMatch && classMatch && sectionMatch && routeMatch && statusMatch && sessionMatch;
  });

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1>Student Transport Assignments</h1>
        <div className="d-flex gap-2">
          {isAdminOrSuperAdmin && (
            <>
              <button className="btn btn-success" onClick={() => showAssignmentForm("add", null)}>Assign Route</button>
              <button className="btn btn-secondary" onClick={openImportDialog} disabled={importing}>{importing ? "Importing..." : "Import XLSX"}</button>
            </>
          )}
          <button className="btn btn-outline-primary" onClick={handleExport}>Export XLSX</button>
        </div>
      </div>

      <div className="mb-3 d-flex gap-2 align-items-center">
        <label style={{ marginBottom: 0, marginRight: 8 }}>Session:</label>
        <select className="form-select" style={{ maxWidth: 300 }} value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)}>
          <option value="">All Sessions</option>
          {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}{s.active || s.is_active ? " — active" : ""}</option>)}
        </select>
      </div>

      <div className="row mb-3">
        <div className="col-md-3">
          <div className="card text-white bg-info mb-3">
            <div className="card-body">
              <h5 className="card-title">Total</h5>
              <p className="card-text">{filtered.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="d-flex mb-3 gap-2 align-items-center flex-wrap">
        <input type="text" className="form-control" style={{ maxWidth: 320 }} placeholder="Search by student/route/admission" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="form-select" style={{ maxWidth: 220 }} value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
          <option value="">All Classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.class_name}</option>)}
        </select>
        <select className="form-select" style={{ maxWidth: 220 }} value={filterSection} onChange={(e) => setFilterSection(e.target.value)}>
          <option value="">All Sections</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.section_name}</option>)}
        </select>
        <select className="form-select" style={{ maxWidth: 220 }} value={filterRoute} onChange={(e) => setFilterRoute(e.target.value)}>
          <option value="">All Routes</option>
          {routes.map((r) => <option key={r.id} value={r.id}>{r.RouteName}</option>)}
        </select>
        <select className="form-select" style={{ maxWidth: 180 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button className="btn btn-outline-secondary" onClick={() => { setSearch(""); setFilterClass(""); setFilterSection(""); setFilterRoute(""); setFilterStatus(""); }}>Reset</button>
      </div>

      <table className="table table-striped table-hover">
        <thead>
          <tr>
            <th>#</th>
            <th>Student (Admission)</th>
            <th>Route</th>
            <th>Class</th>
            <th>Section</th>
            <th>Start</th>
            <th>End</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length ? filtered.map((a, idx) => (
            <tr key={a.id}>
              <td>{idx + 1}</td>
              <td style={{ cursor: "pointer" }} onClick={() => handleView(a)}>{a.Student?.name || "-"} <small>({a.Student?.admission_number || "-"})</small></td>
              <td>{a.Transportation?.RouteName || "-"}</td>
              <td>{a.Class?.class_name || a.Student?.class_name || "-"}</td>
              <td>{a.Section?.section_name || a.Student?.section_name || "-"}</td>
              <td>{a.start_date ? a.start_date.split("T")[0] : "-"}</td>
              <td>{a.end_date ? a.end_date.split("T")[0] : "-"}</td>
              <td><span style={{ textTransform: "capitalize" }}>{a.status}</span></td>
              <td>
                <div style={{ display: "flex", gap: 8 }}>
                  {isAdminOrSuperAdmin && (
                    <>
                      <button className="btn btn-sm btn-outline-primary" onClick={() => showAssignmentForm("edit", a)}>Edit</button>
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => toggleStatus(a)}>{a.status === "active" ? "Deactivate" : "Activate"}</button>
                    </>
                  )}
                  {isSuperadmin && <button className="btn btn-sm btn-danger" onClick={() => handleDelete(a.id)}>Delete</button>}
                </div>
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan={9} className="text-center">{loading ? "Loading..." : "No assignments found"}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default StudentTransport;
