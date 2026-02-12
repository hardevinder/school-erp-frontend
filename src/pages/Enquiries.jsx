// src/pages/Enquiries.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";

// ---- role helpers ---------------------------------------------------------
const getRoleFlags = () => {
  const singleRole = localStorage.getItem("userRole");

  const raw = localStorage.getItem("roles");
  let multiRoles = [];
  try {
    const parsed = JSON.parse(raw || "[]");
    multiRoles = Array.isArray(parsed) ? parsed : [];
  } catch {
    multiRoles = [];
  }

  const roles = (multiRoles.length ? multiRoles : [singleRole].filter(Boolean))
    .map((r) => String(r || "").toLowerCase().trim())
    .filter(Boolean);

  return {
    roles,
    isAdmin: roles.includes("admin"),
    isSuperadmin: roles.includes("superadmin"),
    isAdmissions: roles.includes("admissions") || roles.includes("admission"),
  };
};

// ---- helpers --------------------------------------------------------------
const safeStr = (v) => String(v ?? "").trim();
const lower = (v) => safeStr(v).toLowerCase();

const formatDate = (val) => {
  if (!val) return "-";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString();
};

const formatDateTime = (val) => {
  if (!val) return "-";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleString();
};

const parseDateInput = (ymd) => {
  if (!ymd) return null;
  const d = new Date(`${ymd}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const inDateRange = (dateVal, fromYmd, toYmd) => {
  if (!fromYmd && !toYmd) return true;
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return false;

  const from = parseDateInput(fromYmd);
  const to = parseDateInput(toYmd);
  if (to) to.setHours(23, 59, 59, 999);

  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
};

const normalizeClassKey = (v) => safeStr(v);

const getEnquiryTime = (e) => {
  const val = e?.enquiry_date || e?.createdAt || e?.created_at || e?.updatedAt;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
};

const statusBadgeClass = (status) => {
  const s = safeStr(status).toUpperCase();
  if (s === "CANCELLED") return "badge bg-danger";
  if (s === "CLOSED") return "badge bg-secondary";
  if (s === "ADMITTED") return "badge bg-success";
  return "badge bg-primary";
};

const sumFollowUps = (arr) =>
  (arr || []).reduce((acc, e) => acc + Number(e?.follow_up_count || 0), 0);

// ---- tiny inline icons (no extra lib) ------------------------------------
const IconBtn = ({ title, onClick, disabled, variant = "outline-dark", children }) => (
  <button
    type="button"
    className={`btn btn-sm btn-${variant}`}
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-label={title}
    style={{
      width: 32,
      height: 32,
      padding: 0,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
    }}
  >
    {children}
  </button>
);

const IcEye = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M12 15a3 3 0 100-6 3 3 0 000 6z"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
);

const IcEdit = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path
      d="M16.5 3.5a2.1 2.1 0 013 3L8 18l-4 1 1-4 11.5-11.5z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

const IcPlus = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 5v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IcBan = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 22a10 10 0 110-20 10 10 0 010 20z"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path d="M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IcTrash = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M8 6V4h8v2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path
      d="M19 6l-1 14H6L5 6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path d="M10 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// ---- KPI Card -------------------------------------------------------------
const KpiCard = ({ title, value, className = "bg-light", sub }) => (
  <div
    className={`card ${className}`}
    style={{
      borderRadius: 14,
      minWidth: 150,
      boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
    }}
  >
    <div className="card-body py-2">
      <div className="text-muted" style={{ fontSize: 12 }}>
        {title}
      </div>
      <div className="fw-bold" style={{ fontSize: 18, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub ? (
        <div className="text-muted" style={{ fontSize: 12 }}>
          {sub}
        </div>
      ) : null}
    </div>
  </div>
);

const Enquiries = () => {
  const { isAdmin, isSuperadmin, isAdmissions } = useMemo(getRoleFlags, []);
  const canDelete = isSuperadmin;
  const canView = isAdmin || isSuperadmin || isAdmissions;

  const [enquiries, setEnquiries] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");

  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const [editOpen, setEditOpen] = useState(false);
  const [followOpen, setFollowOpen] = useState(false);

  const [editForm, setEditForm] = useState(null);

  const [fuForm, setFuForm] = useState({
    notes: "",
    next_follow_up_at: "",
    status_after: "OPEN",
  });

  const [followUps, setFollowUps] = useState([]);
  const [fuLoading, setFuLoading] = useState(false);

  const fetchEnquiries = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/enquiries");
      const arr = Array.isArray(data) ? data : [];
      arr.sort((a, b) => getEnquiryTime(b) - getEnquiryTime(a));
      setEnquiries(arr);
      setPage(1);
    } catch (error) {
      console.error("Error fetching enquiries:", error);
      Swal.fire("Error", "Failed to fetch enquiries.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) return;
    fetchEnquiries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  const deleteEnquiry = async (id) => {
    if (!canDelete) return Swal.fire("Forbidden", "Only Super Admin can delete.", "warning");

    const ask = await Swal.fire({
      title: "Delete this enquiry?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    });
    if (!ask.isConfirmed) return;

    try {
      await api.delete(`/enquiries/${id}`);
      Swal.fire("Deleted!", "Enquiry has been deleted.", "success");
      fetchEnquiries();
    } catch (error) {
      console.error("Error deleting enquiry:", error);
      Swal.fire("Error", "Failed to delete enquiry.", "error");
    }
  };

  const cancelEnquiry = async (enq) => {
    if (!enq?.id) return;

    if (safeStr(enq.status).toUpperCase() === "CANCELLED") {
      return Swal.fire("Already Cancelled", "This enquiry is already cancelled.", "info");
    }

    const ask = await Swal.fire({
      title: "Cancel Enquiry?",
      input: "textarea",
      inputLabel: "Reason (required)",
      inputPlaceholder: "Write cancel reason...",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Cancel Enquiry",
      confirmButtonColor: "#d33",
      preConfirm: (val) => {
        if (!safeStr(val)) {
          Swal.showValidationMessage("Reason is required");
          return false;
        }
        return val;
      },
    });

    if (!ask.isConfirmed) return;

    try {
      await api.post(`/enquiries/${enq.id}/cancel`, { reason: ask.value });
      Swal.fire("Cancelled", "Enquiry has been cancelled.", "success");
      setSelected(null);
      fetchEnquiries();
    } catch (error) {
      console.error("Cancel error:", error);
      const msg = error?.response?.data?.message || "Failed to cancel enquiry.";
      Swal.fire("Error", msg, "error");
    }
  };

  const classOptions = useMemo(() => {
    const set = new Set();
    (enquiries || []).forEach((e) => {
      const v = normalizeClassKey(e?.class_interested);
      if (v) set.add(v);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [enquiries]);

  const genderOptions = useMemo(() => {
    const set = new Set();
    (enquiries || []).forEach((e) => {
      const v = safeStr(e?.gender);
      if (v) set.add(v);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [enquiries]);

  const statusOptions = useMemo(() => ["OPEN", "ADMITTED", "CLOSED", "CANCELLED"], []);

  const filtered = useMemo(() => {
    let list = Array.isArray(enquiries) ? [...enquiries] : [];

    const q = lower(search);
    if (q) {
      list = list.filter((e) => {
        const name = lower(e?.student_name);
        const phone = lower(e?.phone);
        const cls = lower(e?.class_interested);
        const email = lower(e?.email);
        const father = lower(e?.father_name);
        const mother = lower(e?.mother_name);

        return (
          name.includes(q) ||
          phone.includes(q) ||
          cls.includes(q) ||
          email.includes(q) ||
          father.includes(q) ||
          mother.includes(q)
        );
      });
    }

    if (classFilter) list = list.filter((e) => normalizeClassKey(e?.class_interested) === classFilter);
    if (genderFilter) list = list.filter((e) => safeStr(e?.gender) === genderFilter);
    if (statusFilter) list = list.filter((e) => safeStr(e?.status).toUpperCase() === statusFilter);

    if (dateFrom || dateTo) {
      list = list.filter((e) => {
        const dateVal = e?.enquiry_date || e?.createdAt || e?.created_at;
        return inDateRange(dateVal, dateFrom, dateTo);
      });
    }

    if (sortBy === "date_desc") list.sort((a, b) => getEnquiryTime(b) - getEnquiryTime(a));
    if (sortBy === "date_asc") list.sort((a, b) => getEnquiryTime(a) - getEnquiryTime(b));
    if (sortBy === "name_asc")
      list.sort((a, b) => safeStr(a?.student_name).localeCompare(safeStr(b?.student_name)));
    if (sortBy === "name_desc")
      list.sort((a, b) => safeStr(b?.student_name).localeCompare(safeStr(a?.student_name)));

    return list;
  }, [enquiries, search, classFilter, genderFilter, statusFilter, dateFrom, dateTo, sortBy]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / Number(pageSize || 25)));

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const paged = useMemo(() => {
    const ps = Number(pageSize || 25);
    const start = (page - 1) * ps;
    return filtered.slice(start, start + ps);
  }, [filtered, page, pageSize]);

  const clearFilters = () => {
    setSearch("");
    setClassFilter("");
    setGenderFilter("");
    setStatusFilter("");
    setDateFrom("");
    setDateTo("");
    setSortBy("date_desc");
    setPageSize(25);
    setPage(1);
  };

  const exportExcel = async () => {
    try {
      if (!canView) return Swal.fire("Forbidden", "You do not have permission.", "warning");
      setExporting(true);

      const res = await api.get("/enquiries/export", { responseType: "blob" });
      const blob = new Blob([res.data], {
        type:
          res.headers?.["content-type"] ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const cd = res.headers?.["content-disposition"];
      let filename = "Enquiries.xlsx";
      if (cd && typeof cd === "string") {
        const match = cd.match(/filename="?([^"]+)"?/i);
        if (match?.[1]) filename = match[1];
      }
      a.download = filename;

      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
      Swal.fire("Error", "Failed to export enquiries.", "error");
    } finally {
      setExporting(false);
    }
  };

  const openFilePicker = () => {
    if (!canView) return Swal.fire("Forbidden", "You do not have permission.", "warning");
    fileRef.current?.click();
  };

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!canView) return Swal.fire("Forbidden", "You do not have permission.", "warning");

    const ok = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");
    if (!ok) return Swal.fire("Invalid file", "Please upload an Excel file (.xlsx/.xls).", "warning");

    const ask = await Swal.fire({
      title: "Import enquiries?",
      html:
        "<div style='text-align:left'>" +
        "<div>• This will add only <b>NEW</b> enquiries.</div>" +
        "<div>• Duplicates will be skipped.</div>" +
        "</div>",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Import",
    });
    if (!ask.isConfirmed) return;

    try {
      setImporting(true);
      const form = new FormData();
      form.append("file", file);

      const { data } = await api.post("/enquiries/import", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const importedMsg = data?.message || "Import completed.";
      await Swal.fire("Import Result", importedMsg, "success");
      fetchEnquiries();
    } catch (error) {
      console.error("Import error:", error);
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.details ||
        "Failed to import enquiries.";
      Swal.fire("Error", msg, "error");
    } finally {
      setImporting(false);
    }
  };

  const stats = useMemo(() => {
    const byStatus = (s) => enquiries.filter((e) => safeStr(e?.status).toUpperCase() === s).length;

    const totalFU = sumFollowUps(enquiries);
    const studentsWithFU = enquiries.filter((e) => Number(e?.follow_up_count || 0) > 0).length;
    const studentsNoFU = enquiries.length - studentsWithFU;

    return {
      total: enquiries.length,
      filtered: filtered.length,
      open: byStatus("OPEN"),
      admitted: byStatus("ADMITTED"),
      closed: byStatus("CLOSED"),
      cancelled: byStatus("CANCELLED"),
      totalFU,
      studentsWithFU,
      studentsNoFU,
    };
  }, [enquiries, filtered.length]);

  const openView = async (enq) => {
    setSelected(enq);
    setFollowUps([]);
    setFuLoading(true);
    try {
      const { data } = await api.get(`/enquiries/${enq.id}/followups`);
      setFollowUps(Array.isArray(data?.followUps) ? data.followUps : []);
    } catch (e) {
      console.error("followups load error:", e);
    } finally {
      setFuLoading(false);
    }
  };

  const openEdit = (enq) => {
    setSelected(enq);
    setEditForm({
      id: enq.id,
      student_name: safeStr(enq.student_name),
      father_name: safeStr(enq.father_name),
      mother_name: safeStr(enq.mother_name),
      phone: safeStr(enq.phone),
      email: safeStr(enq.email),
      address: safeStr(enq.address),
      class_interested: safeStr(enq.class_interested),
      dob: enq.dob ? String(enq.dob).slice(0, 10) : "",
      gender: safeStr(enq.gender),
      previous_school: safeStr(enq.previous_school),
      remarks: safeStr(enq.remarks),
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editForm?.id) return;

    if (!safeStr(editForm.student_name) || !safeStr(editForm.phone) || !safeStr(editForm.class_interested)) {
      return Swal.fire("Required", "Student name, phone and class are required.", "warning");
    }

    try {
      await api.put(`/enquiries/${editForm.id}`, {
        student_name: editForm.student_name,
        father_name: editForm.father_name || null,
        mother_name: editForm.mother_name || null,
        phone: editForm.phone,
        email: editForm.email ? editForm.email : null,
        address: editForm.address || null,
        class_interested: editForm.class_interested,
        dob: editForm.dob ? editForm.dob : null,
        gender: editForm.gender || null,
        previous_school: editForm.previous_school || null,
        remarks: editForm.remarks || null,
      });

      Swal.fire("Saved", "Enquiry updated successfully.", "success");
      setEditOpen(false);
      setEditForm(null);
      setSelected(null);
      fetchEnquiries();
    } catch (e) {
      console.error("edit save error:", e);
      const msg = e?.response?.data?.message || "Failed to update enquiry.";
      Swal.fire("Error", msg, "error");
    }
  };

  const openFollowUp = (enq) => {
    setSelected(enq);
    setFuForm({ notes: "", next_follow_up_at: "", status_after: "OPEN" });
    setFollowOpen(true);
  };

  const saveFollowUp = async () => {
    if (!selected?.id) return;
    if (!safeStr(fuForm.notes)) return Swal.fire("Required", "Please enter follow-up notes.", "warning");

    try {
      await api.post(`/enquiries/${selected.id}/followups`, {
        notes: fuForm.notes,
        next_follow_up_at: fuForm.next_follow_up_at ? fuForm.next_follow_up_at : null,
        status_after: fuForm.status_after || "OPEN",
      });

      Swal.fire("Saved", "Follow-up recorded.", "success");
      setFollowOpen(false);

      await fetchEnquiries();
      await openView({ ...selected });
    } catch (e) {
      console.error("followup save error:", e);
      const msg = e?.response?.data?.message || "Failed to add follow-up.";
      Swal.fire("Error", msg, "error");
    }
  };

  if (!canView) {
    return (
      <div className="container mt-4">
        <div className="alert alert-warning">You don’t have permission to view/import enquiries.</div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      {/* Header */}
      <div className="d-flex align-items-start justify-content-between flex-wrap gap-3">
        <div style={{ minWidth: 240 }}>
          <h1 className="m-0">Admission Enquiries</h1>
          <div className="text-muted" style={{ fontSize: 13 }}>
            Total: <b>{stats.total}</b> • Showing: <b>{stats.filtered}</b>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="d-flex flex-wrap gap-2">
          <KpiCard title="Open" value={stats.open} className="border border-primary" />
          <KpiCard title="Admitted" value={stats.admitted} className="border border-success" />
          <KpiCard title="Closed" value={stats.closed} className="border border-secondary" />
          <KpiCard title="Cancelled" value={stats.cancelled} className="border border-danger" />
          <KpiCard title="Total Follow-ups" value={stats.totalFU} className="border border-dark" />
          <KpiCard title="Students with Follow-ups" value={stats.studentsWithFU} className="border border-info" />
          <KpiCard title="No Follow-ups" value={stats.studentsNoFU} className="border border-warning" />
        </div>

        {/* Export / Import */}
        <div className="d-flex gap-2">
          <button className="btn btn-outline-success" onClick={exportExcel} disabled={exporting || loading}>
            {exporting ? "Exporting..." : "Export"}
          </button>

          <button className="btn btn-outline-primary" onClick={openFilePicker} disabled={importing || loading}>
            {importing ? "Importing..." : "Import"}
          </button>

          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={onPickFile} />
        </div>
      </div>

      {/* Filters */}
      <div className="card mt-3" style={{ borderRadius: 14 }}>
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-md-4">
              <label className="form-label mb-1">Search</label>
              <input
                type="text"
                className="form-control"
                placeholder="Name / phone / email / class / parents..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className="col-md-2">
              <label className="form-label mb-1">Class</label>
              <select
                className="form-select"
                value={classFilter}
                onChange={(e) => {
                  setClassFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All</option>
                {classOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-2">
              <label className="form-label mb-1">Gender</label>
              <select
                className="form-select"
                value={genderFilter}
                onChange={(e) => {
                  setGenderFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All</option>
                {genderOptions.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-2">
              <label className="form-label mb-1">Status</label>
              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-2">
              <label className="form-label mb-1">From</label>
              <input
                type="date"
                className="form-control"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                max={dateTo || undefined}
              />
            </div>

            <div className="col-md-2">
              <label className="form-label mb-1">To</label>
              <input
                type="date"
                className="form-control"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                min={dateFrom || undefined}
              />
            </div>

            <div className="col-md-3">
              <label className="form-label mb-1">Sort</label>
              <select
                className="form-select"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
              >
                <option value="date_desc">Newest first</option>
                <option value="date_asc">Oldest first</option>
                <option value="name_asc">Name A → Z</option>
                <option value="name_desc">Name Z → A</option>
              </select>
            </div>

            <div className="col-md-2">
              <label className="form-label mb-1">Page size</label>
              <select
                className="form-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[10, 25, 50, 100, 250, 500, 1000].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3 d-flex gap-2">
              <button className="btn btn-outline-secondary w-100" onClick={fetchEnquiries} disabled={loading}>
                Refresh
              </button>
              <button className="btn btn-outline-danger w-100" onClick={clearFilters} disabled={loading}>
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Pagination header */}
      <div className="d-flex align-items-center justify-content-between mt-3 flex-wrap gap-2">
        <div className="text-muted" style={{ fontSize: 13 }}>
          Page <b>{page}</b> / <b>{totalPages}</b> • Records: <b>{total}</b>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={loading || page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={loading || page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="mt-2">
        <table className="table table-striped table-hover align-middle" style={{ tableLayout: "fixed", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ width: 46 }}>#</th>
              <th style={{ width: "24%" }}>Student</th>
              <th style={{ width: "11%" }}>Class</th>
              <th style={{ width: "14%" }}>Phone</th>
              <th style={{ width: "25%" }}>Status</th>
              <th style={{ width: "14%" }}>Date</th>
              <th style={{ width: 140 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading &&
              paged.map((enq, index) => {
                const isCancelled = safeStr(enq.status).toUpperCase() === "CANCELLED";
                const fuCount = Number(enq.follow_up_count || 0);

                return (
                  <tr key={enq.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {(page - 1) * Number(pageSize || 25) + index + 1}
                    </td>

                    {/* Name column reduced + 2 line wrap */}
                    <td style={{ overflow: "hidden" }}>
                      <div
                        className="fw-semibold"
                        title={enq.student_name || "-"}
                        style={{
                          fontSize: 13,
                          lineHeight: 1.15,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {enq.student_name || "-"}
                      </div>
                      <div
                        className="text-muted"
                        title={enq.email || "-"}
                        style={{
                          fontSize: 12,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {enq.email || "-"}
                      </div>
                    </td>

                    <td style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {enq.class_interested || "-"}
                    </td>

                    <td style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {enq.phone || "-"}
                    </td>

                    <td style={{ overflow: "hidden" }}>
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span className={statusBadgeClass(enq.status)}>{safeStr(enq.status || "OPEN")}</span>
                        <span className="text-muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                          Next: <b>{formatDateTime(enq.next_follow_up_at)}</b>
                        </span>
                      </div>
                    </td>

                    <td style={{ whiteSpace: "nowrap" }}>
                      {formatDate(enq.enquiry_date || enq.createdAt || enq.created_at)}
                    </td>

                    <td style={{ whiteSpace: "nowrap" }}>
                      <div className="d-flex flex-wrap gap-1">
                        <IconBtn title="View" variant="outline-primary" onClick={() => openView(enq)}>
                          <IcEye />
                        </IconBtn>

                        <IconBtn title="Edit" variant="outline-dark" onClick={() => openEdit(enq)}>
                          <IcEdit />
                        </IconBtn>

                        <IconBtn
                          title="Add Follow-up"
                          variant="outline-success"
                          onClick={() => openFollowUp(enq)}
                          disabled={isCancelled}
                        >
                          <IcPlus />
                        </IconBtn>

                        <IconBtn
                          title="Cancel Enquiry"
                          variant="outline-danger"
                          onClick={() => cancelEnquiry(enq)}
                          disabled={isCancelled}
                        >
                          <IcBan />
                        </IconBtn>

                        {canDelete && (
                          <IconBtn title="Delete" variant="danger" onClick={() => deleteEnquiry(enq.id)}>
                            <IcTrash />
                          </IconBtn>
                        )}
                      </div>

                      <div className="text-muted mt-1" style={{ fontSize: 12, lineHeight: 1.1 }}>
                        Follow-ups: <b>{fuCount}</b>
                      </div>
                    </td>
                  </tr>
                );
              })}

            {!loading && paged.length === 0 && (
              <tr>
                <td colSpan="7" className="text-center">
                  No enquiries found
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan="7" className="text-center">
                  Loading...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* View Modal */}
      {selected && !editOpen && !followOpen && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <div style={{ minWidth: 0 }}>
                  <h5 className="modal-title mb-0 text-truncate" title={selected.student_name}>
                    Enquiry - {selected.student_name}
                  </h5>
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    <span className={statusBadgeClass(selected.status)}>{safeStr(selected.status || "OPEN")}</span>
                    <span className="ms-2">
                      Follow-ups: <b>{Number(selected.follow_up_count || 0)}</b>
                    </span>
                    <span className="ms-2">
                      Next: <b>{formatDateTime(selected.next_follow_up_at)}</b>
                    </span>
                  </div>
                </div>

                <button type="button" className="btn-close" onClick={() => setSelected(null)} />
              </div>

              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-lg-6">
                    <div className="card">
                      <div className="card-header fw-semibold">Details</div>
                      <div className="card-body">
                        <div className="row mb-2">
                          <div className="col-md-6">
                            <strong>Student:</strong> {selected.student_name || "-"}
                          </div>
                          <div className="col-md-6">
                            <strong>Class:</strong> {selected.class_interested || "-"}
                          </div>
                        </div>

                        <div className="row mb-2">
                          <div className="col-md-6">
                            <strong>Father:</strong> {selected.father_name || "-"}
                          </div>
                          <div className="col-md-6">
                            <strong>Mother:</strong> {selected.mother_name || "-"}
                          </div>
                        </div>

                        <div className="row mb-2">
                          <div className="col-md-6">
                            <strong>Phone:</strong> {selected.phone || "-"}
                          </div>
                          <div className="col-md-6">
                            <strong>Email:</strong> {selected.email || "-"}
                          </div>
                        </div>

                        <div className="row mb-2">
                          <div className="col-md-6">
                            <strong>DOB:</strong> {formatDate(selected.dob)}
                          </div>
                          <div className="col-md-6">
                            <strong>Gender:</strong> {selected.gender || "-"}
                          </div>
                        </div>

                        <div className="mb-2">
                          <strong>Address:</strong>
                          <div>{selected.address || "-"}</div>
                        </div>

                        <div className="mb-2">
                          <strong>Previous School:</strong> {selected.previous_school || "-"}
                        </div>

                        <div className="mb-2">
                          <strong>Remarks:</strong>
                          <div>{selected.remarks || "-"}</div>
                        </div>

                        <div className="mb-2">
                          <strong>Submitted:</strong>{" "}
                          {formatDateTime(selected.enquiry_date || selected.createdAt || selected.created_at)}
                        </div>

                        {safeStr(selected.status).toUpperCase() === "CANCELLED" && (
                          <div className="alert alert-danger mt-3 mb-0">
                            <div>
                              <b>Cancelled</b> at {formatDateTime(selected.cancelled_at)}
                            </div>
                            <div>
                              <b>Reason:</b> {selected.cancel_reason || "-"}
                            </div>
                            <div>
                              <b>By:</b> {selected.cancelled_by || "-"}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="col-lg-6">
                    <div className="card">
                      <div className="card-header d-flex align-items-center justify-content-between">
                        <div className="fw-semibold">Follow-ups</div>
                        <button
                          className="btn btn-sm btn-outline-success"
                          onClick={() => openFollowUp(selected)}
                          disabled={safeStr(selected.status).toUpperCase() === "CANCELLED"}
                        >
                          + Add
                        </button>
                      </div>
                      <div className="card-body">
                        {fuLoading && <div className="text-center text-muted">Loading follow-ups...</div>}
                        {!fuLoading && followUps.length === 0 && (
                          <div className="text-center text-muted">No follow-ups yet.</div>
                        )}

                        {!fuLoading &&
                          followUps.map((fu) => (
                            <div
                              key={fu.id}
                              className="border rounded p-2 mb-2"
                              style={{ background: "#fafafa" }}
                            >
                              <div className="d-flex align-items-center justify-content-between">
                                <div className="fw-semibold">
                                  #{fu.follow_up_no}
                                  <span className="ms-2 text-muted" style={{ fontSize: 12 }}>
                                    {formatDateTime(fu.createdAt || fu.created_at)}
                                  </span>
                                </div>
                                <span className={statusBadgeClass(fu.status_after)}>{fu.status_after}</span>
                              </div>
                              <div className="mt-1">{fu.notes || "-"}</div>
                              <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                                Next: <b>{formatDateTime(fu.next_follow_up_at)}</b> • By:{" "}
                                <b>{fu.created_by || "-"}</b>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-outline-dark" onClick={() => openEdit(selected)}>
                  Edit
                </button>
                <button
                  className="btn btn-outline-success"
                  onClick={() => openFollowUp(selected)}
                  disabled={safeStr(selected.status).toUpperCase() === "CANCELLED"}
                >
                  Follow Up
                </button>
                <button
                  className="btn btn-outline-danger"
                  onClick={() => cancelEnquiry(selected)}
                  disabled={safeStr(selected.status).toUpperCase() === "CANCELLED"}
                >
                  Cancel
                </button>
                <button className="btn btn-secondary" onClick={() => setSelected(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editOpen && editForm && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit Enquiry</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setEditOpen(false);
                    setEditForm(null);
                  }}
                />
              </div>

              <div className="modal-body">
                <div className="row g-2">
                  <div className="col-md-6">
                    <label className="form-label mb-1">Student Name *</label>
                    <input
                      className="form-control"
                      value={editForm.student_name}
                      onChange={(e) => setEditForm({ ...editForm, student_name: e.target.value })}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label mb-1">Class Interested *</label>
                    <input
                      className="form-control"
                      value={editForm.class_interested}
                      onChange={(e) => setEditForm({ ...editForm, class_interested: e.target.value })}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label mb-1">Phone *</label>
                    <input
                      className="form-control"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label mb-1">Email</label>
                    <input
                      className="form-control"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label mb-1">Father Name</label>
                    <input
                      className="form-control"
                      value={editForm.father_name}
                      onChange={(e) => setEditForm({ ...editForm, father_name: e.target.value })}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label mb-1">Mother Name</label>
                    <input
                      className="form-control"
                      value={editForm.mother_name}
                      onChange={(e) => setEditForm({ ...editForm, mother_name: e.target.value })}
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label mb-1">DOB</label>
                    <input
                      type="date"
                      className="form-control"
                      value={editForm.dob}
                      onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })}
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label mb-1">Gender</label>
                    <input
                      className="form-control"
                      value={editForm.gender}
                      onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label mb-1">Previous School</label>
                    <input
                      className="form-control"
                      value={editForm.previous_school}
                      onChange={(e) => setEditForm({ ...editForm, previous_school: e.target.value })}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label mb-1">Address</label>
                    <textarea
                      rows={2}
                      className="form-control"
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label mb-1">Remarks</label>
                    <textarea
                      rows={3}
                      className="form-control"
                      value={editForm.remarks}
                      onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setEditOpen(false);
                    setEditForm(null);
                  }}
                >
                  Close
                </button>
                <button className="btn btn-primary" onClick={saveEdit}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Follow-up Modal */}
      {followOpen && selected && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <div>
                  <h5 className="modal-title mb-0">Add Follow-up</h5>
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    {selected.student_name} • Current: <b>{Number(selected.follow_up_count || 0)}</b>
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setFollowOpen(false)} />
              </div>

              <div className="modal-body">
                <div className="row g-2">
                  <div className="col-12">
                    <label className="form-label mb-1">Notes *</label>
                    <textarea
                      rows={4}
                      className="form-control"
                      placeholder="What did you talk / what is next?"
                      value={fuForm.notes}
                      onChange={(e) => setFuForm({ ...fuForm, notes: e.target.value })}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label mb-1">Next Follow-up Date/Time</label>
                    <input
                      type="datetime-local"
                      className="form-control"
                      value={fuForm.next_follow_up_at}
                      onChange={(e) => setFuForm({ ...fuForm, next_follow_up_at: e.target.value })}
                    />
                    <div className="text-muted" style={{ fontSize: 12 }}>
                      Optional — for reminder/next action
                    </div>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label mb-1">Status After</label>
                    <select
                      className="form-select"
                      value={fuForm.status_after}
                      onChange={(e) => setFuForm({ ...fuForm, status_after: e.target.value })}
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="ADMITTED">ADMITTED</option>
                      <option value="CLOSED">CLOSED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                    <div className="text-muted" style={{ fontSize: 12 }}>
                      If you select CANCELLED, better use Cancel button with reason.
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setFollowOpen(false)}>
                  Close
                </button>
                <button className="btn btn-success" onClick={saveFollowUp}>
                  Save Follow-up
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Enquiries;
