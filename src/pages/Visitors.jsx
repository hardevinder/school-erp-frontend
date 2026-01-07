// src/pages/Visitors.jsx
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

const Visitors = () => {
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

  // modal + form
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const emptyForm = {
    // Visitor basics
    name: "",
    phone: "",
    gender: "",
    address: "",

    // visit info
    purpose: "",
    whom_to_meet: "",
    department: "",

    // links (optional)
    link_to: "NONE", // NONE | STUDENT | EMPLOYEE
    class_id: "", // for student selection
    student_id: "",
    employee_id: "",

    // id proof
    id_proof_type: "",
    id_proof_no: "",

    // timing
    expected_out_at: "",

    // remarks
    remarks: "",
  };

  const [form, setForm] = useState(emptyForm);

  // ---------------- Fetch visitors ----------------
  const fetchVisitors = async () => {
    if (!canUse) return;

    setLoadingRows(true);
    try {
      const params = {};
      if (status) params.status = status;
      if (search) params.q = search;

      const { data } = await api.get("/visitors", { params });
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching visitors:", error);
      Swal.fire("Error", "Failed to fetch visitors.", "error");
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
    fetchVisitors();
    fetchMasters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchVisitors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // ---------------- Create / Update ----------------
  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setStudentSearch("");
    setEmployeeSearch("");
    setStudents([]);
    setShowModal(true);
  };

  const openEdit = async (v) => {
    setEditing(v);

    const linkTo =
      v?.student_id ? "STUDENT" : v?.employee_id ? "EMPLOYEE" : "NONE";

    const classId = v?.student?.class_id || "";

    setForm({
      name: v?.name || "",
      phone: v?.phone || "",
      gender: v?.gender || "",
      address: v?.address || "",

      purpose: v?.purpose || "",
      whom_to_meet: v?.whom_to_meet || "",
      department: v?.department || "",

      link_to: linkTo,
      class_id: classId || "",
      student_id: v?.student_id || "",
      employee_id: v?.employee_id || "",

      id_proof_type: v?.id_proof_type || "",
      id_proof_no: v?.id_proof_no || "",

      expected_out_at: v?.expected_out_at
        ? new Date(v.expected_out_at).toISOString().slice(0, 16)
        : "",

      remarks: v?.remarks || "",
    });

    setStudentSearch("");
    setEmployeeSearch("");
    setShowModal(true);

    if (linkTo === "STUDENT" && classId) {
      await fetchStudentsByClass(classId);
    }
  };

  const validateForm = () => {
    if (!form.name.trim()) return "Visitor name is required";
    if (!form.purpose.trim()) return "Purpose is required";

    if (form.phone) {
      const digits = String(form.phone).replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) {
        return "Phone must be 10–15 digits";
      }
    }

    if (form.link_to === "STUDENT") {
      if (!String(form.class_id).trim()) return "Please select Class";
      if (!String(form.student_id).trim()) return "Please select Student";
    }

    if (form.link_to === "EMPLOYEE" && !String(form.employee_id).trim()) {
      return "Please select an Employee";
    }

    if (form.id_proof_no && !form.id_proof_type) {
      return "Please select ID Proof Type";
    }

    return null;
  };

  const saveVisitor = async () => {
    try {
      const err = validateForm();
      if (err) {
        Swal.fire("Error", err, "error");
        return;
      }

      const payload = {
        name: form.name,
        phone: form.phone || null,
        gender: form.gender || null,
        address: form.address || null,

        purpose: form.purpose,
        whom_to_meet: form.whom_to_meet || null,
        department: form.department || null,

        id_proof_type: form.id_proof_type || null,
        id_proof_no: form.id_proof_no || null,

        expected_out_at: form.expected_out_at ? new Date(form.expected_out_at) : null,
        remarks: form.remarks || null,
      };

      if (form.link_to === "STUDENT") payload.student_id = Number(form.student_id);
      if (form.link_to === "EMPLOYEE") payload.employee_id = Number(form.employee_id);

      if (editing) {
        await api.put(`/visitors/${editing.id}`, payload);
        Swal.fire("Updated!", "Visitor updated successfully.", "success");
      } else {
        await api.post("/visitors", payload);
        Swal.fire("Created!", "Visitor checked-in successfully.", "success");
      }

      setShowModal(false);
      setEditing(null);
      setForm(emptyForm);
      setStudents([]);
      fetchVisitors();
    } catch (error) {
      console.error("Error saving visitor:", error);
      Swal.fire(
        "Error",
        error?.response?.data?.error || "Failed to save visitor.",
        "error"
      );
    }
  };

  // ---------------- Actions: OUT / CANCEL ----------------
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
      fetchVisitors();
    } catch (error) {
      console.error("Action failed:", error);
      Swal.fire("Error", error?.response?.data?.error || "Action failed.", "error");
    }
  };

  const markOut = (id) =>
    confirmAndDo({
      title: "Check-out visitor?",
      text: "This will mark visitor as CHECKED_OUT.",
      apiCall: () => api.post(`/visitors/${id}/out`),
      successMsg: "Checked-out successfully.",
    });

  const cancelVisitor = (v) =>
    Swal.fire({
      title: "Cancel visitor entry?",
      input: "textarea",
      inputLabel: "Cancel Reason",
      inputPlaceholder: "Enter reason (optional)...",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Cancel Entry",
      allowOutsideClick: false,
      allowEscapeKey: false,
    }).then(async (res) => {
      if (!res.isConfirmed) return;

      try {
        await api.post(`/visitors/${v.id}/cancel`, {
          cancel_reason: res.value || "Cancelled",
        });
        Swal.fire("Cancelled!", "Visitor entry cancelled.", "success");
        fetchVisitors();
      } catch (error) {
        console.error("Cancel failed:", error);
        Swal.fire("Error", error?.response?.data?.error || "Failed to cancel.", "error");
      }
    });

  // ---------------- PDF (blob) ----------------
  const handlePdf = async (v) => {
    try {
      const resp = await api.get(`/visitors/${v.id}/pdf`, { responseType: "blob" });
      const blob = new Blob([resp.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `Visitor_${v.visitor_no || v.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.error("Visitor PDF error:", err);
      const msg = err?.response?.data?.error || err?.message || "PDF not available.";
      Swal.fire("Error", msg, "error");
    }
  };

  // ---------------- Filter table ----------------
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;

    return rows.filter((v) => {
      const no = String(v.visitor_no || "").toLowerCase();
      const name = String(v.name || "").toLowerCase();
      const phone = String(v.phone || "").toLowerCase();
      const purpose = String(v.purpose || "").toLowerCase();
      const idNo = String(v.id_proof_no || "").toLowerCase();
      const stuName = String(v.student?.name || "").toLowerCase();
      const empName = String(v.employee?.name || "").toLowerCase();
      return (
        no.includes(s) ||
        name.includes(s) ||
        phone.includes(s) ||
        purpose.includes(s) ||
        idNo.includes(s) ||
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
        <h1>Visitors</h1>
        <div className="alert alert-warning">You don’t have access to Visitor module.</div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h1>Visitors</h1>

      {/* Top actions */}
      <div className="d-flex gap-2 align-items-center flex-wrap mb-3">
        <button className="btn btn-success" onClick={openAdd}>
          Add Visitor (Check-in)
        </button>

        <button className="btn btn-outline-secondary" onClick={fetchVisitors} disabled={loadingRows}>
          {loadingRows ? "Loading..." : "Refresh"}
        </button>

        <button className="btn btn-outline-primary" onClick={fetchMasters} disabled={loadingMasters}>
          {loadingMasters ? "Loading..." : "Reload Lists"}
        </button>

        <div style={{ flex: 1 }} />

        <select className="form-select" style={{ width: 220 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="CHECKED_IN">CHECKED_IN</option>
          <option value="INSIDE">INSIDE</option>
          <option value="CHECKED_OUT">CHECKED_OUT</option>
          <option value="CANCELLED">CANCELLED</option>
          <option value="BLACKLISTED">BLACKLISTED</option>
        </select>

        <input
          type="text"
          className="form-control"
          style={{ width: 360 }}
          placeholder="Search: visitor no / name / phone / purpose / id / student / employee"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <table className="table table-striped">
        <thead>
          <tr>
            <th>#</th>
            <th>Visitor No</th>
            <th>Name</th>
            <th>Phone</th>
            <th>Purpose</th>
            <th>Meet</th>
            <th>Status</th>
            <th>Check-in</th>
            <th>Check-out</th>
            <th style={{ width: 320 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((v, index) => {
            const meet =
              v.employee?.name
                ? `Emp: ${v.employee.name}`
                : v.student?.name
                ? `Stu: ${v.student.name} (${v.student.admission_number || "N/A"})`
                : v.whom_to_meet || "-";

            const inAt = v.check_in_at ? new Date(v.check_in_at).toLocaleString() : "-";
            const outAt = v.check_out_at ? new Date(v.check_out_at).toLocaleString() : "-";

            const canOut = v.status !== "CHECKED_OUT" && v.status !== "CANCELLED";
            const canCancel = v.status !== "CANCELLED" && v.status !== "CHECKED_OUT";

            return (
              <tr key={v.id}>
                <td>{index + 1}</td>
                <td>{v.visitor_no}</td>
                <td>{v.name}</td>
                <td>{v.phone || "-"}</td>
                <td style={{ maxWidth: 260, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={v.purpose || ""}>
                  {v.purpose}
                </td>
                <td style={{ maxWidth: 240, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={meet}>
                  {meet}
                </td>
                <td>
                  <span
                    className={
                      v.status === "CANCELLED"
                        ? "badge bg-danger"
                        : v.status === "CHECKED_OUT"
                        ? "badge bg-secondary"
                        : v.status === "INSIDE"
                        ? "badge bg-success"
                        : v.status === "BLACKLISTED"
                        ? "badge bg-dark"
                        : "badge bg-primary"
                    }
                  >
                    {v.status}
                  </span>
                </td>
                <td>{inAt}</td>
                <td>{outAt}</td>
                <td>
                  <div className="d-flex gap-2 flex-wrap">
                    <button className="btn btn-outline-dark btn-sm" onClick={() => handlePdf(v)}>
                      PDF
                    </button>

                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => openEdit(v)}
                      disabled={v.status === "CANCELLED" || v.status === "CHECKED_OUT"}
                    >
                      Edit
                    </button>

                    <button className="btn btn-outline-success btn-sm" onClick={() => markOut(v.id)} disabled={!canOut}>
                      OUT
                    </button>

                    <button className="btn btn-outline-danger btn-sm" onClick={() => cancelVisitor(v)} disabled={!canCancel}>
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}

          {filtered.length === 0 && (
            <tr>
              <td colSpan={10} className="text-center">
                {loadingRows ? "Loading…" : "No visitors found"}
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
                <h5 className="modal-title">{editing ? "Edit Visitor" : "Add Visitor (Check-in)"}</h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)} />
              </div>

              <div className="modal-body">
                <div className="row g-3">
                  {/* Basic */}
                  <div className="col-12 col-md-4">
                    <label className="form-label">Visitor Name *</label>
                    <input
                      className="form-control"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Visitor Name"
                    />
                  </div>

                  <div className="col-12 col-md-4">
                    <label className="form-label">Phone</label>
                    <input
                      className="form-control"
                      value={form.phone}
                      onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="10–15 digits"
                    />
                  </div>

                  <div className="col-12 col-md-2">
                    <label className="form-label">Gender</label>
                    <select
                      className="form-select"
                      value={form.gender}
                      onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}
                    >
                      <option value="">--</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="col-12 col-md-2">
                    <label className="form-label">Expected Out</label>
                    <input
                      type="datetime-local"
                      className="form-control"
                      value={form.expected_out_at}
                      onChange={(e) => setForm((p) => ({ ...p, expected_out_at: e.target.value }))}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label">Address</label>
                    <input
                      className="form-control"
                      value={form.address}
                      onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                      placeholder="Address (optional)"
                    />
                  </div>

                  {/* Visit info */}
                  <div className="col-12">
                    <label className="form-label">Purpose *</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={form.purpose}
                      onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))}
                      placeholder="Purpose of visit"
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label">Whom to meet</label>
                    <input
                      className="form-control"
                      value={form.whom_to_meet}
                      onChange={(e) => setForm((p) => ({ ...p, whom_to_meet: e.target.value }))}
                      placeholder="Teacher / Employee / Department"
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label">Department</label>
                    <input
                      className="form-control"
                      value={form.department}
                      onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
                      placeholder="Office/Accounts/Principal/Transport etc."
                    />
                  </div>

                  {/* Link to student/employee */}
                  <div className="col-12 col-lg-4">
                    <label className="form-label">Link To</label>
                    <select
                      className="form-select"
                      value={form.link_to}
                      disabled={!!editing} // keep stable in edit (optional)
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((p) => ({
                          ...p,
                          link_to: v,
                          class_id: "",
                          student_id: "",
                          employee_id: "",
                        }));
                        setStudents([]);
                        setStudentSearch("");
                        setEmployeeSearch("");
                      }}
                    >
                      <option value="NONE">NONE</option>
                      <option value="STUDENT">STUDENT</option>
                      <option value="EMPLOYEE">EMPLOYEE</option>
                    </select>
                    <div className="form-text">Optional: Link this visit to a student/employee.</div>
                  </div>

                  <div className="col-12 col-lg-8">
                    {form.link_to === "STUDENT" && (
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
                            onChange={(e) => setForm((p) => ({ ...p, student_id: e.target.value }))}
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

                    {form.link_to === "EMPLOYEE" && (
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
                          onChange={(e) => setForm((p) => ({ ...p, employee_id: e.target.value }))}
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
                  </div>

                  {/* ID Proof */}
                  <div className="col-12 col-md-4">
                    <label className="form-label">ID Proof Type</label>
                    <select
                      className="form-select"
                      value={form.id_proof_type}
                      onChange={(e) => setForm((p) => ({ ...p, id_proof_type: e.target.value }))}
                    >
                      <option value="">--</option>
                      <option value="Aadhaar">Aadhaar</option>
                      <option value="Driving License">Driving License</option>
                      <option value="PAN">PAN</option>
                      <option value="Voter ID">Voter ID</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="col-12 col-md-8">
                    <label className="form-label">ID Proof No</label>
                    <input
                      className="form-control"
                      value={form.id_proof_no}
                      onChange={(e) => setForm((p) => ({ ...p, id_proof_no: e.target.value }))}
                      placeholder="ID number"
                    />
                  </div>

                  {/* Remarks */}
                  <div className="col-12">
                    <label className="form-label">Remarks</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={form.remarks}
                      onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                      placeholder="Optional remarks"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Close
                </button>
                <button className="btn btn-primary" onClick={saveVisitor}>
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

export default Visitors;
