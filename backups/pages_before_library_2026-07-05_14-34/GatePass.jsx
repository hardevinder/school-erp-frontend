// src/pages/GatePass.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";

// ---- role helpers ---------------------------------------------------------
const getRoleFlags = () => {
  const singleRole = localStorage.getItem("userRole");
  const multiRoles = JSON.parse(localStorage.getItem("roles") || "[]");
  const roles = multiRoles.length ? multiRoles : [singleRole].filter(Boolean);

  const norm = roles.map((r) => String(r || "").toLowerCase());

  return {
    roles: norm,
    isAdmin: norm.includes("admin"),
    isSuperadmin: norm.includes("superadmin"),
    isFrontoffice: norm.includes("frontoffice"),
  };
};

const GatePass = () => {
  const { isAdmin, isSuperadmin, isFrontoffice } = useMemo(getRoleFlags, []);
  const canUse = isAdmin || isSuperadmin || isFrontoffice;

  // data
  const [rows, setRows] = useState([]);

  // masters
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]); // selected class students
  const [employees, setEmployees] = useState([]);

  const [loadingMasters, setLoadingMasters] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);

  // dropdown search
  const [studentSearch, setStudentSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");

  // filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");

  // modal + form
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const emptyForm = {
    type: "STUDENT", // STUDENT | EMPLOYEE | VISITOR
    class_id: "", // NEW
    student_id: "",
    employee_id: "",
    visitor_name: "",
    visitor_phone: "",
    reason: "",
    destination: "",
  };

  const [form, setForm] = useState(emptyForm);

  // ---------------- Fetch gate passes ----------------
  const fetchGatePasses = async () => {
    if (!canUse) return;

    setLoadingRows(true);
    try {
      const params = {};
      if (status) params.status = status;
      if (type) params.type = type;
      if (search) params.q = search;

      const { data } = await api.get("/gate-pass", { params });
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching gate passes:", error);
      Swal.fire("Error", "Failed to fetch gate passes.", "error");
    } finally {
      setLoadingRows(false);
    }
  };

  // ---------------- Load masters (classes + employees) ----------------
  const fetchMasters = async () => {
    if (!canUse) return;
    setLoadingMasters(true);
    try {
      const [clsRes, empRes] = await Promise.all([
        api.get("/classes").catch(() => ({ data: [] })),
        api.get("/employees", { params: { limit: 5000 } }).catch(() => ({ data: [] })),
      ]);

      const cls = Array.isArray(clsRes.data) ? clsRes.data : clsRes.data?.rows || [];
      const emp = Array.isArray(empRes.data) ? empRes.data : empRes.data?.rows || [];

      setClasses(Array.isArray(cls) ? cls : []);
      setEmployees(Array.isArray(emp) ? emp : []);
    } catch (e) {
      console.error("Error loading masters:", e);
    } finally {
      setLoadingMasters(false);
    }
  };

  // ---------------- Load students by class ----------------
  const fetchStudentsByClass = async (classId) => {
    if (!classId) {
      setStudents([]);
      return;
    }
    setLoadingStudents(true);
    try {
      const res = await api.get(`/students/class/${Number(classId)}`);
      const stu = Array.isArray(res.data) ? res.data : res.data?.rows || [];
      setStudents(Array.isArray(stu) ? stu : []);
    } catch (e) {
      console.error("Error loading students by class:", e);
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    fetchGatePasses();
    fetchMasters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchGatePasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, type]);

  // ---------------- Create / Update ----------------
  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setStudentSearch("");
    setEmployeeSearch("");
    setStudents([]);
    setShowModal(true);
  };

  const openEdit = async (gp) => {
    setEditing(gp);

    const classId = gp?.student?.class_id || "";
    setForm({
      type: gp.type || "STUDENT",
      class_id: classId || "",
      student_id: gp.student_id || "",
      employee_id: gp.employee_id || "",
      visitor_name: gp.visitor_name || "",
      visitor_phone: gp.visitor_phone || "",
      reason: gp.reason || "",
      destination: gp.destination || "",
    });

    setStudentSearch("");
    setEmployeeSearch("");
    setShowModal(true);

    if ((gp.type || "") === "STUDENT" && classId) {
      await fetchStudentsByClass(classId);
    }
  };

  const validateForm = () => {
    if (!form.type) return "Type is required";
    if (!form.reason.trim()) return "Reason is required";

    if (form.type === "STUDENT") {
      if (!String(form.class_id).trim()) return "Please select Class";
      if (!String(form.student_id).trim()) return "Please select Student";
    }

    if (form.type === "EMPLOYEE" && !String(form.employee_id).trim()) {
      return "Please select an Employee";
    }

    if (form.type === "VISITOR" && !String(form.visitor_name).trim()) {
      return "Visitor name is required for VISITOR gate pass";
    }

    if (form.type === "VISITOR" && form.visitor_phone) {
      const digits = String(form.visitor_phone).replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) {
        return "Visitor phone must be 10–15 digits";
      }
    }

    return null;
  };

  const saveGatePass = async () => {
    try {
      const err = validateForm();
      if (err) {
        Swal.fire("Error", err, "error");
        return;
      }

      const payload = {
        type: form.type,
        reason: form.reason,
        destination: form.destination || null,
      };

      if (form.type === "STUDENT") payload.student_id = Number(form.student_id);
      if (form.type === "EMPLOYEE") payload.employee_id = Number(form.employee_id);
      if (form.type === "VISITOR") {
        payload.visitor_name = form.visitor_name;
        payload.visitor_phone = form.visitor_phone || null;
      }

      if (editing) {
        await api.put(`/gate-pass/${editing.id}`, {
          reason: payload.reason,
          destination: payload.destination,
          visitor_name: payload.visitor_name,
          visitor_phone: payload.visitor_phone,
        });
        Swal.fire("Updated!", "Gate pass updated successfully.", "success");
      } else {
        await api.post("/gate-pass", payload);
        Swal.fire("Created!", "Gate pass created successfully.", "success");
      }

      setShowModal(false);
      setEditing(null);
      setForm(emptyForm);
      setStudents([]);
      fetchGatePasses();
    } catch (error) {
      console.error("Error saving gate pass:", error);
      Swal.fire("Error", error?.response?.data?.error || "Failed to save gate pass.", "error");
    }
  };

  // ---------------- Actions: OUT / IN / CANCEL ----------------
  const confirmAndDo = async ({ title, text, apiCall, successMsg }) => {
    const result = await Swal.fire({
      title,
      text,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#0d6efd",
      confirmButtonText: "Yes",
      cancelButtonText: "No",
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    if (!result.isConfirmed) return;

    try {
      await apiCall();
      Swal.fire("Done!", successMsg, "success");
      fetchGatePasses();
    } catch (error) {
      console.error("Action failed:", error);
      Swal.fire("Error", error?.response?.data?.error || "Action failed.", "error");
    }
  };

  const markOut = (id) =>
    confirmAndDo({
      title: "Mark OUT?",
      text: "This will mark the gate pass as OUT.",
      apiCall: () => api.post(`/gate-pass/${id}/out`),
      successMsg: "Marked OUT successfully.",
    });

  const markIn = (id) =>
    confirmAndDo({
      title: "Mark IN?",
      text: "This will mark the gate pass as IN.",
      apiCall: () => api.post(`/gate-pass/${id}/in`),
      successMsg: "Marked IN successfully.",
    });

  const cancelPass = (gp) =>
    Swal.fire({
      title: "Cancel Gate Pass?",
      input: "textarea",
      inputLabel: "Cancel Reason",
      inputPlaceholder: "Enter reason (optional)...",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Cancel Pass",
      allowOutsideClick: false,
      allowEscapeKey: false,
    }).then(async (res) => {
      if (!res.isConfirmed) return;

      try {
        await api.post(`/gate-pass/${gp.id}/cancel`, {
          cancel_reason: res.value || "Cancelled",
        });
        Swal.fire("Cancelled!", "Gate pass cancelled.", "success");
        fetchGatePasses();
      } catch (error) {
        console.error("Cancel failed:", error);
        Swal.fire("Error", error?.response?.data?.error || "Failed to cancel.", "error");
      }
    });

  // ---------------- PDF (✅ SAME AS TRANSFER CERTIFICATE: blob) ----------------
  const handlePdf = async (gp) => {
    try {
      // IMPORTANT: this uses axios instance `api`, so auth header is included
      const resp = await api.get(`/gate-pass/${gp.id}/pdf`, {
        responseType: "blob",
      });

      const blob = new Blob([resp.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `GatePass_${gp.pass_no || gp.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.error("GatePass PDF error:", err);
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "PDF not available.";
      Swal.fire("Error", msg, "error");
    }
  };

  // ---------------- Filter table ----------------
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;

    return rows.filter((gp) => {
      const passNo = String(gp.pass_no || "").toLowerCase();
      const vName = String(gp.visitor_name || "").toLowerCase();
      const vPhone = String(gp.visitor_phone || "").toLowerCase();
      const reason = String(gp.reason || "").toLowerCase();
      const stuName = String(gp.student?.name || "").toLowerCase();
      const empName = String(gp.employee?.name || "").toLowerCase();
      return (
        passNo.includes(s) ||
        vName.includes(s) ||
        vPhone.includes(s) ||
        reason.includes(s) ||
        stuName.includes(s) ||
        empName.includes(s)
      );
    });
  }, [rows, search]);

  // ---------------- Filter employees dropdown ----------------
  const filteredEmployees = useMemo(() => {
    const s = employeeSearch.trim().toLowerCase();
    if (!s) return employees.slice(0, 200);
    return employees
      .filter((e) => {
        const name = String(e.name || "").toLowerCase();
        const phone = String(e.phone || "").toLowerCase();
        const des = String(e.designation || "").toLowerCase();
        const dept = String(e.department?.name || "").toLowerCase();
        return name.includes(s) || phone.includes(s) || des.includes(s) || dept.includes(s);
      })
      .slice(0, 200);
  }, [employees, employeeSearch]);

  // ---------------- Filter students dropdown ----------------
  const filteredStudents = useMemo(() => {
    const s = studentSearch.trim().toLowerCase();
    if (!s) return students.slice(0, 200);
    return students
      .filter((st) => {
        const name = String(st.name || "").toLowerCase();
        const adm = String(st.admission_number || "").toLowerCase();
        return name.includes(s) || adm.includes(s);
      })
      .slice(0, 200);
  }, [students, studentSearch]);

  if (!canUse) {
    return (
      <div className="container mt-4">
        <h1>Gate Pass</h1>
        <div className="alert alert-warning">You don’t have access to Gate Pass module.</div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h1>Gate Pass</h1>

      {/* Top actions */}
      <div className="d-flex gap-2 align-items-center flex-wrap mb-3">
        <button className="btn btn-success" onClick={openAdd}>
          Create Gate Pass
        </button>

        <button className="btn btn-outline-secondary" onClick={fetchGatePasses} disabled={loadingRows}>
          {loadingRows ? "Loading..." : "Refresh"}
        </button>

        <button className="btn btn-outline-primary" onClick={fetchMasters} disabled={loadingMasters}>
          {loadingMasters ? "Loading..." : "Reload Lists"}
        </button>

        <div style={{ flex: 1 }} />

        <select className="form-select" style={{ width: 180 }} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All Types</option>
          <option value="STUDENT">STUDENT</option>
          <option value="EMPLOYEE">EMPLOYEE</option>
          <option value="VISITOR">VISITOR</option>
        </select>

        <select className="form-select" style={{ width: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="ISSUED">ISSUED</option>
          <option value="OUT">OUT</option>
          <option value="IN">IN</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>

        <input
          type="text"
          className="form-control"
          style={{ width: 320 }}
          placeholder="Search: pass no / student / employee / visitor / reason"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <table className="table table-striped">
        <thead>
          <tr>
            <th>#</th>
            <th>Pass No</th>
            <th>Type</th>
            <th>Person</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Issued At</th>
            <th style={{ width: 340 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((gp, index) => {
            const person =
              gp.type === "STUDENT"
                ? gp.student?.name
                  ? `${gp.student.name} (${gp.student.admission_number || "N/A"})`
                  : `Student ID: ${gp.student_id || "N/A"}`
                : gp.type === "EMPLOYEE"
                ? gp.employee?.name
                  ? `${gp.employee.name}${gp.employee?.phone ? ` (${gp.employee.phone})` : ""}`
                  : `Employee ID: ${gp.employee_id || "N/A"}`
                : gp.visitor_name
                ? `${gp.visitor_name}${gp.visitor_phone ? ` (${gp.visitor_phone})` : ""}`
                : "Visitor";

            const issuedAt = gp.issued_at ? new Date(gp.issued_at).toLocaleString() : "-";

            const canOut = gp.status === "ISSUED";
            const canIn = gp.status === "OUT";
            const canCancel = gp.status !== "CANCELLED" && gp.status !== "IN";

            return (
              <tr key={gp.id}>
                <td>{index + 1}</td>
                <td>{gp.pass_no}</td>
                <td>{gp.type}</td>
                <td>{person}</td>
                <td style={{ maxWidth: 300, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={gp.reason || ""}>
                  {gp.reason}
                </td>
                <td>
                  <span
                    className={
                      gp.status === "CANCELLED"
                        ? "badge bg-danger"
                        : gp.status === "IN"
                        ? "badge bg-success"
                        : gp.status === "OUT"
                        ? "badge bg-warning text-dark"
                        : "badge bg-primary"
                    }
                  >
                    {gp.status}
                  </span>
                </td>
                <td>{issuedAt}</td>
                <td>
                  <div className="d-flex gap-2 flex-wrap">
                    {/* ✅ FIXED PDF */}
                    <button className="btn btn-outline-dark btn-sm" onClick={() => handlePdf(gp)}>
                      PDF
                    </button>

                    <button className="btn btn-primary btn-sm" onClick={() => openEdit(gp)} disabled={gp.status === "CANCELLED" || gp.status === "IN"}>
                      Edit
                    </button>

                    <button className="btn btn-outline-warning btn-sm" onClick={() => markOut(gp.id)} disabled={!canOut}>
                      OUT
                    </button>

                    <button className="btn btn-outline-success btn-sm" onClick={() => markIn(gp.id)} disabled={!canIn}>
                      IN
                    </button>

                    <button className="btn btn-outline-danger btn-sm" onClick={() => cancelPass(gp)} disabled={!canCancel}>
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}

          {filtered.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center">
                {loadingRows ? "Loading…" : "No gate passes found"}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Modal */}
      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editing ? "Edit Gate Pass" : "Create Gate Pass"}</h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)} />
              </div>

              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-12 col-lg-4">
                    <label className="form-label">Type</label>
                    <select
                      className="form-select"
                      value={form.type}
                      disabled={!!editing}
                      onChange={(e) => {
                        const nextType = e.target.value;
                        setForm((p) => ({
                          ...p,
                          type: nextType,
                          class_id: "",
                          student_id: "",
                          employee_id: "",
                          visitor_name: "",
                          visitor_phone: "",
                        }));
                        setStudents([]);
                        setStudentSearch("");
                        setEmployeeSearch("");
                      }}
                    >
                      <option value="STUDENT">STUDENT</option>
                      <option value="EMPLOYEE">EMPLOYEE</option>
                      <option value="VISITOR">VISITOR</option>
                    </select>
                    <div className="form-text">{editing ? "Type is locked in edit mode." : "Choose gate pass type."}</div>
                  </div>

                  <div className="col-12 col-lg-8">
                    {/* STUDENT: Class -> Student */}
                    {form.type === "STUDENT" && (
                      <div className="row g-2">
                        <div className="col-12 col-md-5">
                          <label className="form-label">Class</label>
                          <select
                            className="form-select"
                            value={form.class_id}
                            disabled={!!editing}
                            onChange={async (e) => {
                              const classId = e.target.value;
                              setForm((p) => ({ ...p, class_id: classId, student_id: "" }));
                              setStudentSearch("");
                              await fetchStudentsByClass(classId);
                            }}
                          >
                            <option value="">-- Select Class --</option>
                            {classes.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.class_name || c.name || `Class ${c.id}`}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-12 col-md-7">
                          <label className="form-label">Student</label>

                          <input
                            className="form-control mb-2"
                            placeholder={form.class_id ? "Search student by name / admission..." : "Select class first..."}
                            value={studentSearch}
                            disabled={!!editing || !form.class_id}
                            onChange={(e) => setStudentSearch(e.target.value)}
                          />

                          <select
                            className="form-select"
                            value={form.student_id}
                            disabled={!!editing || !form.class_id || loadingStudents}
                            onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                          >
                            <option value="">
                              {loadingStudents ? "Loading students..." : form.class_id ? "-- Select Student --" : "Select class first"}
                            </option>
                            {filteredStudents.map((st) => (
                              <option key={st.id} value={st.id}>
                                {st.name || "Student"} ({st.admission_number || "N/A"})
                              </option>
                            ))}
                          </select>

                          {form.class_id && students.length > 200 && (
                            <div className="form-text">Showing max 200 results. Use search to narrow.</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* EMPLOYEE */}
                    {form.type === "EMPLOYEE" && (
                      <>
                        <label className="form-label">Employee</label>
                        <input
                          className="form-control mb-2"
                          placeholder="Search by name / phone / designation / department..."
                          value={employeeSearch}
                          disabled={!!editing}
                          onChange={(e) => setEmployeeSearch(e.target.value)}
                        />
                        <select
                          className="form-select"
                          value={form.employee_id}
                          disabled={!!editing}
                          onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                        >
                          <option value="">-- Select Employee --</option>
                          {filteredEmployees.map((e) => {
                            const dept = e.department?.name ? ` • ${e.department.name}` : "";
                            const des = e.designation ? ` • ${e.designation}` : "";
                            const ph = e.phone ? ` • ${e.phone}` : "";
                            return (
                              <option key={e.id} value={e.id}>
                                {e.name || "Employee"}
                                {ph}
                                {des}
                                {dept}
                              </option>
                            );
                          })}
                        </select>
                      </>
                    )}

                    {/* VISITOR */}
                    {form.type === "VISITOR" && (
                      <div className="row g-2">
                        <div className="col-12 col-md-6">
                          <label className="form-label">Visitor Name</label>
                          <input
                            type="text"
                            className="form-control"
                            value={form.visitor_name}
                            onChange={(e) => setForm({ ...form, visitor_name: e.target.value })}
                            placeholder="Visitor Name"
                          />
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="form-label">Visitor Phone</label>
                          <input
                            type="text"
                            className="form-control"
                            value={form.visitor_phone}
                            onChange={(e) => setForm({ ...form, visitor_phone: e.target.value })}
                            placeholder="10–15 digits"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Reason */}
                  <div className="col-12">
                    <label className="form-label">Reason *</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={form.reason}
                      onChange={(e) => setForm({ ...form, reason: e.target.value })}
                      placeholder="Reason for gate pass"
                    />
                  </div>

                  {/* Destination */}
                  <div className="col-12">
                    <label className="form-label">Destination</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.destination}
                      onChange={(e) => setForm({ ...form, destination: e.target.value })}
                      placeholder="Where going (optional)"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Close
                </button>
                <button className="btn btn-primary" onClick={saveGatePass}>
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

export default GatePass;
