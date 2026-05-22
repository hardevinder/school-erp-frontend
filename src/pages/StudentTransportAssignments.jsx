// src/pages/StudentTransportAssignments.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./Transportation.css";

// ---- role helpers ---------------------------------------------------------
const getRoleFlags = () => {
  const singleRole = localStorage.getItem("userRole");
  const multiRoles = JSON.parse(localStorage.getItem("roles") || "[]");
  const roles = multiRoles.length ? multiRoles : [singleRole].filter(Boolean);
  return {
    roles,
    isAdmin: roles.includes("admin"),
    isSuperadmin: roles.includes("superadmin"),
    isAccounts: roles.includes("accounts"),
    isTransport: roles.includes("transport"),
  };
};

const safeStr = (v) => String(v ?? "").trim();

const fmtYYYYMMDD = (d = new Date()) => {
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return "";
  }
};

const StudentTransportAssignments = () => {
  useMemo(getRoleFlags, []); // keep existing pattern

  const [students, setStudents] = useState([]);
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);

  const [search, setSearch] = useState("");
  const [selectedRouteFilterId, setSelectedRouteFilterId] = useState("");
  const [transportStatusFilter, setTransportStatusFilter] = useState("all");
  const [studentStatusFilter, setStudentStatusFilter] = useState("all");

  const [loading, setLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(40);

  // -------------------- Load dropdown data --------------------
  const fetchStudents = async () => {
    const res = await api.get("/students");
    const list = Array.isArray(res.data)
      ? res.data
      : Array.isArray(res.data?.students)
      ? res.data.students
      : [];
    setStudents(list);
  };

  const fetchBuses = async () => {
    const res = await api.get("/buses");
    setBuses(Array.isArray(res.data) ? res.data : []);
  };

  const fetchRoutes = async () => {
    const res = await api.get("/transportations");
    setRoutes(Array.isArray(res.data) ? res.data : []);
  };

  const refreshAll = async (showToast = true) => {
    setLoading(true);
    try {
      await Promise.all([fetchStudents(), fetchBuses(), fetchRoutes()]);
      if (showToast) {
        Swal.fire({
          icon: "success",
          title: "Refreshed",
          text: "Latest transport data loaded successfully.",
          timer: 1400,
          showConfirmButton: false,
        });
      }
    } catch (e) {
      console.error("Refresh error:", e);
      Swal.fire("Error", "Failed to refresh data.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------- Active assignment fetch --------------------
  const fetchActiveAssignment = async (studentId, dateStr) => {
    if (!studentId) return null;
    try {
      const res = await api.get(
        `/student-transport-assignments/student/${studentId}/active`,
        { params: { date: dateStr } }
      );
      return res.data || null;
    } catch {
      return null;
    }
  };

  // -------------------- helpers: names/labels --------------------
  const findBusNo = (id) => {
    const b = buses.find((x) => String(x.id) === String(id));
    if (!b) return "—";
    const label = `${safeStr(b.bus_no)}${
      b.reg_no ? ` (${safeStr(b.reg_no)})` : ""
    }`;
    return label || "—";
  };

  const getStudentLabel = (studentId) => {
    const s = students.find((x) => String(x.id) === String(studentId));
    if (!s) return `ID: ${safeStr(studentId) || "—"}`;
    const nm = safeStr(s?.name) || "—";
    const adm = safeStr(s?.admission_number);
    return `${nm}${adm ? ` (${adm})` : ""}`;
  };

  const getClassName = (s) =>
    safeStr(s?.class_name || s?.Class?.class_name || s?.ClassName || "") || "—";

  const getSectionName = (s) =>
    safeStr(s?.section_name || s?.Section?.section_name || s?.SectionName || "") ||
    "—";

  const getStudentStatus = (s) => {
    const status = safeStr(s?.status).toLowerCase();
    if (status === "enabled") return "enabled";
    if (status === "disabled") return "disabled";
    return "unknown";
  };

  const getRouteObjectByStudent = (s) => {
    return routes.find((r) => String(r.id) === String(s?.route_id || "")) || null;
  };

  const getStudentPlaceName = (s) => {
    const routeObj = getRouteObjectByStudent(s);

    const placeName = safeStr(
      routeObj?.Villages ||
        routeObj?.villages ||
        routeObj?.City ||
        routeObj?.city ||
        s?.village ||
        s?.city ||
        s?.route_name ||
        ""
    );

    return placeName || "—";
  };

  const getStudentRouteDisplay = (s) => {
    const routeObj = getRouteObjectByStudent(s);
    const placeName = getStudentPlaceName(s);
    const cost = routeObj?.Cost ?? routeObj?.cost ?? s?.route_cost;

    if (placeName && placeName !== "—") {
      return `${placeName}${
        cost != null && String(cost).trim() !== "" ? ` — ₹${cost}` : ""
      }`;
    }

    return "—";
  };

  const hasTransportAssigned = (s) => {
    const routeObj = getRouteObjectByStudent(s);

    return Boolean(
      s?.route_id ||
        safeStr(s?.route_name) ||
        safeStr(routeObj?.RouteName) ||
        safeStr(routeObj?.Villages) ||
        safeStr(routeObj?.villages) ||
        safeStr(routeObj?.City) ||
        safeStr(routeObj?.city)
    );
  };

  // -------------------- export helpers --------------------
  const getExportRows = (rows) =>
    rows.map((s, idx) => ({
      "S. No.": idx + 1,
      Name: safeStr(s?.name) || "—",
      "Admission No": safeStr(s?.admission_number) || "—",
      Status: getStudentStatus(s),
      Class: getClassName(s),
      Section: getSectionName(s),
      "Village / City": getStudentPlaceName(s),
      Route: getStudentRouteDisplay(s),
      "Transport Assigned": hasTransportAssigned(s) ? "Yes" : "No",
      "Route Cost": s?.route_cost ?? getRouteObjectByStudent(s)?.Cost ?? "—",
    }));

  const downloadAssignmentsExcel = async () => {
    try {
      const exportRows = getExportRows(filteredStudents);

      if (!exportRows.length) {
        return Swal.fire(
          "No Data",
          "No filtered student data available for Excel export.",
          "info"
        );
      }

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "TransportAssignments");
      XLSX.writeFile(wb, `StudentTransportAssignments_${fmtYYYYMMDD()}.xlsx`);

      Swal.fire({
        icon: "success",
        title: "Downloaded",
        text: "Excel file downloaded successfully.",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (e) {
      console.error("Excel download error:", e);
      Swal.fire("Error", "Failed to download Excel file.", "error");
    }
  };

  const downloadAssignmentsPdf = async () => {
    try {
      const exportRows = getExportRows(filteredStudents);

      if (!exportRows.length) {
        return Swal.fire(
          "No Data",
          "No filtered student data available for PDF export.",
          "info"
        );
      }

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });
      doc.setFontSize(16);
      doc.text("Student Transport Assignments", 40, 36);
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 40, 54);

      autoTable(doc, {
        startY: 70,
        head: [[
          "S. No.",
          "Name",
          "Admission No",
          "Status",
          "Class",
          "Section",
          "Village / City",
          "Route",
          "Transport Assigned",
          "Route Cost",
        ]],
        body: exportRows.map((r) => [
          r["S. No."],
          r.Name,
          r["Admission No"],
          r.Status,
          r.Class,
          r.Section,
          r["Village / City"],
          r.Route,
          r["Transport Assigned"],
          r["Route Cost"],
        ]),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [36, 68, 120] },
        alternateRowStyles: { fillColor: [245, 248, 252] },
        margin: { left: 24, right: 24 },
      });

      doc.save(`StudentTransportAssignments_${fmtYYYYMMDD()}.pdf`);

      Swal.fire({
        icon: "success",
        title: "Downloaded",
        text: "PDF file downloaded successfully.",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (e) {
      console.error("PDF download error:", e);
      Swal.fire("Error", "Failed to download PDF file.", "error");
    }
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedRouteFilterId("");
    setTransportStatusFilter("all");
    setStudentStatusFilter("all");
    setVisibleCount(40);
  };

  // -------------------- Assignment modal (SweetAlert2) --------------------
  const openAssignDialog = async (studentId) => {
    if (!studentId) {
      return Swal.fire("Validation", "Please select a student.", "warning");
    }

    const defaultDate = fmtYYYYMMDD(new Date());
    const current = await fetchActiveAssignment(studentId, defaultDate);

    const curPickupBus = current?.pickup_bus_id ? String(current.pickup_bus_id) : "";
    const curDropBus = current?.drop_bus_id ? String(current.drop_bus_id) : "";

    const busOptionsHtml = buses
      .filter((b) => b.active !== false)
      .map((b) => {
        const label = `${safeStr(b.bus_no)}${
          b.reg_no ? ` (${safeStr(b.reg_no)})` : ""
        }`;
        return `<option value="${b.id}">${label}</option>`;
      })
      .join("");

    const result = await Swal.fire({
      title: "Assign Pickup / Drop Bus",
      icon: "info",
      position: "center",
      focusConfirm: false,
      scrollbarPadding: false,
      showCancelButton: true,
      confirmButtonText: "Save Assignment",
      cancelButtonText: "Cancel",
      allowOutsideClick: false,
      allowEscapeKey: false,
      width: 860,

      willOpen: () => {
        document.body.style.overflow = "hidden";
      },
      willClose: () => {
        document.body.style.overflow = "";
      },

      customClass: {
        title: "swal-title-compact",
        popup: "swal-transport-card",
        confirmButton: "btn btn-success",
        cancelButton: "btn btn-outline-secondary",
        actions: "swal-actions-row",
      },
      buttonsStyling: false,

      html: `
        <style>
          .swal-transport-card{ padding: 16px 16px 14px 16px !important; border-radius: 18px !important; }
          .swal-title-compact{ font-size: 20px !important; margin: 6px 0 10px 0 !important; font-weight: 800 !important; }
          .swal-actions-row{ gap: 10px !important; }

          .ta-head{
            display:flex; justify-content:space-between; align-items:flex-start; gap:12px;
            padding: 12px 14px; border: 1px solid rgba(0,0,0,0.08);
            border-radius: 14px; background: linear-gradient(180deg, rgba(13,110,253,0.05), rgba(25,135,84,0.03));
            margin-bottom: 14px; text-align:left;
          }
          .ta-student{ font-weight: 800; font-size: 15px; }
          .ta-sub{ font-size: 12px; opacity: 0.9; margin-top: 5px; line-height: 1.4; }
          .ta-pill{
            display:inline-flex; align-items:center; gap:6px;
            padding: 4px 10px; border-radius: 999px; font-size: 11px;
            background: rgba(255,255,255,0.8); border: 1px solid rgba(0,0,0,0.08);
            margin-right: 6px; margin-top: 6px;
          }
          .ta-grid{ display:grid; grid-template-columns: 1fr 1fr; gap: 12px; text-align:left; }
          .ta-field label{ display:block; font-size: 12px; font-weight: 800; margin: 0 0 6px 0; }
          .ta-field select, .ta-field input{
            width: 100%; height: 42px; border-radius: 12px;
            border: 1px solid rgba(0,0,0,0.14); padding: 8px 10px; outline: none;
            background: #fff;
          }
          .ta-field select:focus, .ta-field input:focus{ border-color: rgba(13,110,253,0.55); }
          .ta-full{ grid-column: 1 / span 2; }
          .ta-note{
            margin-top: 8px; font-size: 12px; opacity: 0.95;
            padding: 10px 12px; border-left: 4px solid rgba(25,135,84,0.55);
            background: rgba(25,135,84,0.06); border-radius: 12px;
          }
          .ta-mini{
            font-size: 12px; opacity: 0.85; margin-top: 4px;
          }
          @media (max-width: 620px){
            .ta-grid{ grid-template-columns: 1fr; }
            .ta-full{ grid-column: auto; }
          }
        </style>

        <div class="ta-head">
          <div>
            <div class="ta-student">${safeStr(getStudentLabel(studentId))}</div>
            <div class="ta-sub">
              <span class="ta-pill">Pickup: <b>${findBusNo(current?.pickup_bus_id)}</b></span>
              <span class="ta-pill">Drop: <b>${findBusNo(current?.drop_bus_id)}</b></span>
              <span class="ta-pill">Start: <b>${safeStr(current?.start_date || "—")}</b></span>
              <span class="ta-pill">Status: <b>${safeStr(current?.status || "—")}</b></span>
            </div>
            <div class="ta-mini">Saving this entry will close the previous active assignment automatically.</div>
          </div>
        </div>

        <div class="ta-grid">
          <div class="ta-field">
            <label>Pickup Bus</label>
            <select id="sw_pickupBus">
              <option value="">-- Select Pickup Bus --</option>
              ${busOptionsHtml}
            </select>
          </div>

          <div class="ta-field">
            <label>Drop Bus</label>
            <select id="sw_dropBus">
              <option value="">-- Select Drop Bus --</option>
              ${busOptionsHtml}
            </select>
          </div>

          <div class="ta-field">
            <label>Pickup Stop (optional)</label>
            <input id="sw_pickupStop" type="text" placeholder="e.g. Main Gate" />
          </div>

          <div class="ta-field">
            <label>Drop Stop (optional)</label>
            <input id="sw_dropStop" type="text" placeholder="e.g. Bus Stand" />
          </div>

          <div class="ta-field ta-full">
            <label>Effective From</label>
            <input id="sw_start" type="date" value="${defaultDate}" />
            <div class="ta-note">
              Tip: Choose the date from which the new bus assignment should start.
            </div>
          </div>
        </div>
      `,

      didOpen: () => {
        const pb = document.getElementById("sw_pickupBus");
        const db = document.getElementById("sw_dropBus");
        const ps = document.getElementById("sw_pickupStop");
        const ds = document.getElementById("sw_dropStop");

        if (pb) pb.value = curPickupBus || "";
        if (db) db.value = curDropBus || "";

        if (ps && current?.pickup_stop) ps.value = safeStr(current.pickup_stop);
        if (ds && current?.drop_stop) ds.value = safeStr(current.drop_stop);

        const popup = Swal.getPopup();
        if (popup) popup.scrollTop = 0;
      },

      preConfirm: () => {
        const pb = document.getElementById("sw_pickupBus")?.value || "";
        const db = document.getElementById("sw_dropBus")?.value || "";
        const ps = document.getElementById("sw_pickupStop")?.value || "";
        const ds = document.getElementById("sw_dropStop")?.value || "";
        const start = document.getElementById("sw_start")?.value || "";

        if (!start) {
          Swal.showValidationMessage("Please select Start Date.");
          return false;
        }

        if (!pb && !db) {
          Swal.showValidationMessage("Please select at least Pickup Bus or Drop Bus.");
          return false;
        }

        return { pb, db, ps, ds, start };
      },
    });

    if (!result.isConfirmed) return;

    const { pb, db, ps, ds, start } = result.value || {};

    const payload = {
      student_id: Number(studentId),
      pickup_bus_id: pb ? Number(pb) : null,
      drop_bus_id: db ? Number(db) : null,
      pickup_stop: safeStr(ps) || null,
      drop_stop: safeStr(ds) || null,
      start_date: start,
    };

    setLoading(true);
    try {
      const res = await api.post("/student-transport-assignments/assign", payload);

      Swal.fire({
        icon: "success",
        title: "Saved",
        text: res?.data?.message || "Bus assignment saved successfully.",
        timer: 1500,
        showConfirmButton: false,
      });

      await fetchActiveAssignment(studentId, start);
    } catch (e) {
      console.error("Assign error:", e);
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.response?.data?.details ||
        "Failed to save transport assignment.";
      Swal.fire("Error", msg, "error");
    } finally {
      setLoading(false);
    }
  };

  // -------------------- Search helpers --------------------
  const placeOptions = useMemo(() => {
    const unique = new Map();

    students.forEach((s) => {
      const place = getStudentPlaceName(s);
      if (place && place !== "—" && !unique.has(place)) {
        unique.set(place, place);
      }
    });

    return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
  }, [students, routes]);

  const filteredStudents = useMemo(() => {
    const q = safeStr(search).toLowerCase();
    const selectedPlace = safeStr(selectedRouteFilterId).toLowerCase();

    return students.filter((s) => {
      const name = safeStr(s?.name).toLowerCase();
      const adm = safeStr(s?.admission_number).toLowerCase();
      const place = getStudentPlaceName(s).toLowerCase();
      const hasTransport = hasTransportAssigned(s);
      const studentStatus = getStudentStatus(s);

      const textOk = !q || name.includes(q) || adm.includes(q);
      const placeOk = !selectedPlace || place === selectedPlace;
      const transportOk =
        transportStatusFilter === "all" ||
        (transportStatusFilter === "with_transport" && hasTransport) ||
        (transportStatusFilter === "without_transport" && !hasTransport);

      const statusOk =
        studentStatusFilter === "all" ||
        (studentStatusFilter === "enabled" && studentStatus === "enabled") ||
        (studentStatusFilter === "disabled" && studentStatus === "disabled");

      return textOk && placeOk && transportOk && statusOk;
    });
  }, [
    students,
    search,
    selectedRouteFilterId,
    transportStatusFilter,
    studentStatusFilter,
    routes,
  ]);

  const visibleStudents = filteredStudents.slice(0, visibleCount);

  const stats = useMemo(() => {
    const enabledStudents = students.filter(
      (s) => getStudentStatus(s) === "enabled"
    ).length;

    const disabledStudents = students.filter(
      (s) => getStudentStatus(s) === "disabled"
    ).length;

    const withTransport = students.filter((s) => hasTransportAssigned(s)).length;

    return {
      totalStudents: students.length,
      enabledStudents,
      disabledStudents,
      filteredStudents: filteredStudents.length,
      totalPlaces: placeOptions.length,
      withTransport,
    };
  }, [students, filteredStudents, placeOptions, routes]);

  // -------------------- UI --------------------
  return (
    <div className="container-fluid mt-3">
      <style>{`
        .sta-shell{ padding-bottom: 16px; }
        .sta-hero{
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 18px;
          padding: 16px;
          background: linear-gradient(180deg, #ffffff, #f8fbff);
          box-shadow: 0 8px 24px rgba(0,0,0,0.05);
          margin-bottom: 14px;
        }
        .sta-toolbar{ position: sticky; top: 0; z-index: 5; }
        .sta-title{ font-weight: 800; letter-spacing: 0.2px; color: #13233a; }
        .sta-subtitle{ font-size: 13px; color: #5c6b7a; margin-top: 4px; }
        .sta-top-actions{ display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
        .sta-card{
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 16px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.04);
          background: #fff;
        }
        .sta-stat{
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 14px;
          background: #fff;
          padding: 12px 14px;
          min-height: 86px;
        }
        .sta-stat-label{ font-size: 12px; font-weight: 700; color: #6b7785; margin-bottom: 4px; }
        .sta-stat-value{ font-size: 24px; font-weight: 800; color: #0f2744; line-height: 1.1; }

        .sta-stat-enabled{
          background: linear-gradient(180deg, #f3fff7, #ffffff);
          border: 1px solid rgba(25,135,84,0.18);
        }
        .sta-stat-enabled .sta-stat-value{ color: #198754; }

        .sta-stat-disabled{
          background: linear-gradient(180deg, #fff5f5, #ffffff);
          border: 1px solid rgba(220,53,69,0.18);
        }
        .sta-stat-disabled .sta-stat-value{ color: #dc3545; }

        .sta-filter label{ font-size: 12px; font-weight: 800; margin-bottom: 6px; color: #364253; }
        .sta-filter .form-select,
        .sta-filter .form-control{
          height: 42px;
          border-radius: 12px;
          border: 1px solid rgba(0,0,0,0.12);
        }
        .sta-filter .form-select:focus,
        .sta-filter .form-control:focus{
          border-color: rgba(13,110,253,0.45);
          box-shadow: 0 0 0 0.14rem rgba(13,110,253,0.1);
        }
        .sta-table-wrap{ border-radius: 14px; overflow: hidden; }
        .sta-table{ margin: 0; }
        .sta-table thead th{
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
          background: #f4f7fb;
          color: #253344;
          border-bottom: 1px solid rgba(0,0,0,0.08);
          padding-top: 12px;
          padding-bottom: 12px;
        }
        .sta-table tbody td{ font-size: 13px; padding-top: 10px; padding-bottom: 10px; vertical-align: middle; }
        .sta-row:hover{ background: rgba(13,110,253,0.035); }

        .sta-pill{
          display:inline-flex;
          align-items:center;
          gap:6px;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid rgba(13,110,253,0.15);
          background: rgba(13,110,253,0.06);
          font-size: 12px;
          white-space: nowrap;
          color: #1f4f91;
          font-weight: 700;
        }

        .sta-status-badge{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          border: 1px solid transparent;
          text-transform: capitalize;
        }
        .sta-status-enabled{
          color: #146c43;
          background: rgba(25,135,84,0.10);
          border-color: rgba(25,135,84,0.18);
        }
        .sta-status-disabled{
          color: #b02a37;
          background: rgba(220,53,69,0.10);
          border-color: rgba(220,53,69,0.18);
        }
        .sta-status-unknown{
          color: #6c757d;
          background: rgba(108,117,125,0.10);
          border-color: rgba(108,117,125,0.18);
        }

        .sta-route-chip{
          display:inline-flex;
          align-items:center;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(25,135,84,0.08);
          color: #146c43;
          border: 1px solid rgba(25,135,84,0.14);
          font-size: 12px;
          font-weight: 700;
        }
        .sta-btn{ border-radius: 10px; padding: 8px 12px; font-weight: 700; font-size: 12px; }
        .sta-btn-primary{ border-radius: 10px; padding: 7px 12px; font-weight: 700; font-size: 12px; min-width: 92px; }
        .sta-loading{
          position: fixed;
          inset: 0;
          background: rgba(255,255,255,0.55);
          backdrop-filter: blur(3px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
        }
        .sta-loading .box{
          border: 1px solid rgba(0,0,0,0.12);
          background: #fff;
          border-radius: 14px;
          padding: 14px 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.10);
          font-weight: 800;
          color: #183153;
        }
        .sta-empty{ padding: 28px 16px; text-align: center; color: #6c7785; }
        .sta-empty-title{ font-size: 15px; font-weight: 800; color: #3a4758; margin-bottom: 4px; }
        .sta-empty-sub{ font-size: 13px; }

        @media (max-width: 768px){
          .sta-title{ font-size: 22px !important; }
          .sta-top-actions{ justify-content:flex-start; }
        }
      `}</style>

      {loading && (
        <div className="sta-loading">
          <div className="box">Please wait…</div>
        </div>
      )}

      <div className="sta-shell">
        <div className="sta-toolbar">
          <div className="sta-hero">
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
              <div>
                <div className="sta-title h4 m-0">Student Transport Assignments</div>
                <div className="sta-subtitle">
                  Manage pickup and drop bus allocation for students with clean
                  village/city filtering, transport-status filtering, student
                  status filtering, and export exactly what is visible on screen.
                </div>
              </div>

              <div className="sta-top-actions">
                <button
                  className="btn btn-outline-success sta-btn"
                  onClick={downloadAssignmentsExcel}
                  disabled={loading}
                >
                  Download Excel
                </button>
                <button
                  className="btn btn-outline-danger sta-btn"
                  onClick={downloadAssignmentsPdf}
                  disabled={loading}
                >
                  Download PDF
                </button>
                <button
                  className="btn btn-outline-secondary sta-btn"
                  onClick={refreshAll}
                  disabled={loading}
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="row g-3 mt-1">
              <div className="col-6 col-md-2">
                <div className="sta-stat">
                  <div className="sta-stat-label">Total Students</div>
                  <div className="sta-stat-value">{stats.totalStudents}</div>
                </div>
              </div>

              <div className="col-6 col-md-2">
                <div className="sta-stat sta-stat-enabled">
                  <div className="sta-stat-label">Enabled</div>
                  <div className="sta-stat-value">{stats.enabledStudents}</div>
                </div>
              </div>

              <div className="col-6 col-md-2">
                <div className="sta-stat sta-stat-disabled">
                  <div className="sta-stat-label">Disabled</div>
                  <div className="sta-stat-value">{stats.disabledStudents}</div>
                </div>
              </div>

              <div className="col-6 col-md-2">
                <div className="sta-stat">
                  <div className="sta-stat-label">Filtered Result</div>
                  <div className="sta-stat-value">{stats.filteredStudents}</div>
                </div>
              </div>

              <div className="col-6 col-md-2">
                <div className="sta-stat">
                  <div className="sta-stat-label">Villages / Cities</div>
                  <div className="sta-stat-value">{stats.totalPlaces}</div>
                </div>
              </div>

              <div className="col-6 col-md-2">
                <div className="sta-stat">
                  <div className="sta-stat-label">With Transport</div>
                  <div className="sta-stat-value">{stats.withTransport}</div>
                </div>
              </div>
            </div>

            <div className="row g-3 mt-1 sta-filter">
              <div className="col-md-3">
                <label className="form-label">Student Status</label>
                <select
                  className="form-select"
                  value={studentStatusFilter}
                  onChange={(e) => {
                    setStudentStatusFilter(e.target.value);
                    setVisibleCount(40);
                  }}
                >
                  <option value="all">All Students</option>
                  <option value="enabled">Enabled Only</option>
                  <option value="disabled">Disabled Only</option>
                </select>
                <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                  Filter by student enabled/disabled status.
                </div>
              </div>

              <div className="col-md-3">
                <label className="form-label">Filter by Village / City</label>
                <select
                  className="form-select"
                  value={selectedRouteFilterId}
                  onChange={(e) => {
                    setSelectedRouteFilterId(e.target.value);
                    setVisibleCount(40);
                  }}
                >
                  <option value="">All Villages / Cities</option>
                  {placeOptions.map((place) => (
                    <option key={place} value={place}>
                      {place}
                    </option>
                  ))}
                </select>
                <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                  Filter is based on the same village/city text shown in the table.
                </div>
              </div>

              <div className="col-md-3">
                <label className="form-label">Search Student</label>
                <input
                  className="form-control"
                  placeholder="Search by student name or admission number..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setVisibleCount(40);
                  }}
                />
                <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                  Search works on name and admission number.
                </div>
              </div>

              <div className="col-md-2">
                <label className="form-label">Transport Status</label>
                <select
                  className="form-select"
                  value={transportStatusFilter}
                  onChange={(e) => {
                    setTransportStatusFilter(e.target.value);
                    setVisibleCount(40);
                  }}
                >
                  <option value="all">All</option>
                  <option value="with_transport">With Transport</option>
                  <option value="without_transport">Without Transport</option>
                </select>
                <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                  Filter by assigned transport.
                </div>
              </div>

              <div className="col-md-1 d-flex align-items-end">
                <button
                  className="btn btn-outline-dark sta-btn w-100"
                  onClick={clearFilters}
                  disabled={loading}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="sta-card p-2 p-md-3">
          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <div className="h6 m-0" style={{ fontWeight: 800, color: "#213247" }}>
                Student List
              </div>
              <span className="sta-pill">
                Showing <b>{visibleStudents.length}</b> / {filteredStudents.length}
                <span style={{ opacity: 0.7 }}> / {students.length}</span>
              </span>
            </div>

            {filteredStudents.length > visibleCount && (
              <button
                className="btn btn-outline-primary sta-btn"
                onClick={() => setVisibleCount((v) => v + 40)}
                disabled={loading}
              >
                Show More
              </button>
            )}
          </div>

          <div className="table-responsive sta-table-wrap">
            <table className="table table-hover sta-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>#</th>
                  <th>Name</th>
                  <th style={{ width: 150 }}>Admission</th>
                  <th style={{ width: 120 }}>Student Status</th>
                  <th style={{ width: 120 }}>Class</th>
                  <th style={{ width: 90 }}>Sec</th>
                  <th style={{ width: 150 }}>Transport Status</th>
                  <th>Village / City</th>
                  <th style={{ width: 130 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleStudents.map((s, idx) => {
                  const studentStatus = getStudentStatus(s);

                  return (
                    <tr key={s.id} className="sta-row">
                      <td>{idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: 800, color: "#1f2f45" }}>
                          {safeStr(s?.name) || "—"}
                        </div>
                      </td>
                      <td>{safeStr(s?.admission_number) || "—"}</td>
                      <td>
                        <span
                          className={`sta-status-badge ${
                            studentStatus === "enabled"
                              ? "sta-status-enabled"
                              : studentStatus === "disabled"
                              ? "sta-status-disabled"
                              : "sta-status-unknown"
                          }`}
                        >
                          {studentStatus}
                        </span>
                      </td>
                      <td>{getClassName(s)}</td>
                      <td>{getSectionName(s)}</td>
                      <td>
                        <span
                          className={`sta-pill ${
                            hasTransportAssigned(s) ? "" : "text-secondary"
                          }`}
                        >
                          {hasTransportAssigned(s) ? "Assigned" : "Not Assigned"}
                        </span>
                      </td>
                      <td style={{ minWidth: 220 }}>
                        <span className="sta-route-chip">
                          {getStudentRouteDisplay(s)}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-primary sta-btn-primary"
                          disabled={loading}
                          onClick={() => openAssignDialog(String(s.id))}
                        >
                          Assign Bus
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan="9">
                      <div className="sta-empty">
                        <div className="sta-empty-title">No students found</div>
                        <div className="sta-empty-sub">
                          Try clearing filters or changing the student status,
                          village/city, or transport-status selection.
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredStudents.length > visibleCount && (
            <div className="text-muted mt-2" style={{ fontSize: 12 }}>
              Showing first {visibleCount} records. Use <b>Show More</b> to load
              the next batch.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentTransportAssignments;