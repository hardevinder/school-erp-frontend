// src/pages/Transportation.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
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
  };
};

// ---- helpers --------------------------------------------------------------
const safeStr = (v) => String(v ?? "").trim();

const formatDDMMYYYY = (val) => {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return safeStr(val);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  } catch (e) {
    return safeStr(val);
  }
};

const yyyyMMDD = (val) => {
  if (!val) return "";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

// Basic session guess (you can change to your ERP logic)
const guessCurrentSession = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1..12
  // session usually starts April
  const startYear = m >= 4 ? y : y - 1;
  const endYear2 = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}-${endYear2}`; // e.g. 2025-26
};

const Transportation = () => {
  const { isSuperadmin } = useMemo(getRoleFlags, []);
  const fileRef = useRef(null);

  // --- UI state
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("route"); // route | cost
  const [sortDir, setSortDir] = useState("asc"); // asc | desc

  const [session, setSession] = useState(() => {
    // try saved session
    const saved = safeStr(localStorage.getItem("academic_session"));
    return saved || guessCurrentSession();
  });

  // --- API: fetch
  const fetchRoutes = async (s = session) => {
    setLoading(true);
    try {
      const res = await api.get("/transportations", {
        params: { session: s },
        headers: { "x-session": s },
      });
      setRoutes(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Error fetching routes:", error);
      Swal.fire("Error", "Failed to fetch routes.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes(session);
    localStorage.setItem("academic_session", session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Delete a route (Superadmin only)
  const handleDelete = async (id, routeName) => {
    if (!isSuperadmin) {
      return Swal.fire("Forbidden", "Only Super Admin can delete.", "warning");
    }

    const result = await Swal.fire({
      title: `Delete route (${safeStr(routeName)})?`,
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    if (!result.isConfirmed) return;

    try {
      await api.delete(`/transportations/${id}`, {
        params: { session },
        headers: { "x-session": session },
      });
      Swal.fire("Deleted!", "Route has been deleted.", "success");
      fetchRoutes(session);
    } catch (error) {
      console.error("Error deleting route:", error);
      const msg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Failed to delete the route.";
      Swal.fire("Error", msg, "error");
    }
  };

  // ✅ Export Excel (session-wise)
  const handleExport = async () => {
    try {
      const res = await api.get("/transportations/export", {
        params: { session },
        headers: { "x-session": session },
        responseType: "blob",
      });

      const blob = new Blob([res.data], {
        type:
          res.headers?.["content-type"] ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const disposition = res.headers?.["content-disposition"] || "";
      const match = disposition.match(/filename="?([^"]+)"?/);

      // nicer default name
      a.download = match?.[1] || `Transportations_${session}.xlsx`;

      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      Swal.fire("Error", "Failed to export Excel.", "error");
    }
  };

  // ✅ Import Excel (session supported)
  const handleImport = async (file) => {
    if (!file) return;

    const ok = await Swal.fire({
      title: `Import Transportations (${session})?`,
      html: `
        <div style="text-align:left">
          <div><b>Session:</b> ${session}</div>
          <div style="margin-top:6px;color:#666;font-size:13px">
            Excel rows can have <b>session</b> column.
            If missing, we will import using the selected session above.
          </div>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, import",
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    if (!ok.isConfirmed) return;

    try {
      const fd = new FormData();
      fd.append("file", file);
      // fallback session if Excel doesn't have it
      fd.append("session", session);

      const res = await api.post("/transportations/import", fd, {
        params: { session },
        headers: {
          "Content-Type": "multipart/form-data",
          "x-session": session,
        },
      });

      // show invalid rows summary if any
      const invalidCount = res?.data?.invalid?.length || 0;

      if (invalidCount > 0) {
        Swal.fire({
          title: "Imported with warnings",
          icon: "warning",
          html: `
            <div style="text-align:left">
              <div><b>${res?.data?.message || "Import completed."}</b></div>
              <div style="margin-top:6px">Invalid rows: <b>${invalidCount}</b></div>
              <div style="margin-top:6px;color:#666;font-size:13px">
                Check response JSON for details (invalid array).
              </div>
            </div>
          `,
        });
      } else {
        Swal.fire(
          "Imported!",
          res?.data?.message || "Excel imported successfully.",
          "success"
        );
      }

      fetchRoutes(session);
    } catch (err) {
      console.error("Import error:", err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Failed to import Excel.";
      Swal.fire("Error", msg, "error");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // --- Add / Edit dialogs (session included)
  const openRouteDialog = async ({ mode, route }) => {
    const isEdit = mode === "edit";

    const routeName = safeStr(route?.RouteName);
    const villages = safeStr(route?.Villages);
    const cost = route?.Cost ?? "";
    const finePct = route?.finePercentage ?? 0;
    const fineDate = route?.fineStartDate ? yyyyMMDD(route.fineStartDate) : "";

    const { isConfirmed, value } = await Swal.fire({
      title: isEdit ? "Edit Route" : "Add New Route",
      width: "640px",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showCancelButton: true,
      confirmButtonText: isEdit ? "Save" : "Add",
      html: `
        <div style="text-align:left">
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <div style="flex:1;min-width:220px">
              <label style="font-weight:600;font-size:13px">Session</label>
              <input id="session" class="swal2-input" style="margin:6px 0 0 0" value="${safeStr(
                route?.session || session
              )}" placeholder="2025-26"/>
            </div>
            <div style="flex:2;min-width:260px">
              <label style="font-weight:600;font-size:13px">Route Name</label>
              <input id="RouteName" class="swal2-input" style="margin:6px 0 0 0" value="${routeName}" placeholder="Route Name"/>
            </div>
          </div>

          <div style="margin-top:10px">
            <label style="font-weight:600;font-size:13px">Villages (comma-separated)</label>
            <input id="Villages" class="swal2-input" style="margin:6px 0 0 0" value="${villages}" placeholder="Village1, Village2"/>
          </div>

          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
            <div style="flex:1;min-width:180px">
              <label style="font-weight:600;font-size:13px">Cost</label>
              <input id="Cost" type="number" class="swal2-input" style="margin:6px 0 0 0" value="${cost}" placeholder="Cost"/>
            </div>
            <div style="flex:1;min-width:180px">
              <label style="font-weight:600;font-size:13px">Fine Percentage (%)</label>
              <input id="finePercentage" type="number" class="swal2-input" style="margin:6px 0 0 0" value="${finePct}" placeholder="0"/>
            </div>
          </div>

          <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;align-items:end">
            <div style="flex:1;min-width:220px">
              <label style="font-weight:600;font-size:13px">Fine Start Date</label>
              <input id="fineStartDate" type="date" class="swal2-input" style="margin:6px 0 0 0" value="${fineDate}"/>
            </div>
            <div style="flex:2;min-width:260px;color:#666;font-size:12px">
              Tip: Keep fine fields empty if no fine is applied.
            </div>
          </div>
        </div>
      `,
      preConfirm: () => {
        const v = (id) => document.getElementById(id)?.value;

        return {
          session: safeStr(v("session")),
          RouteName: safeStr(v("RouteName")),
          Villages: safeStr(v("Villages")),
          Cost: v("Cost"),
          finePercentage: v("finePercentage") || 0,
          fineStartDate: v("fineStartDate") || null,
        };
      },
      didOpen: () => {
        // autofocus route name
        const el = document.getElementById("RouteName");
        if (el) el.focus();
      },
    });

    if (!isConfirmed) return;

    // validations (frontend)
    if (!value?.session) {
      return Swal.fire("Validation", "Session is required.", "warning");
    }
    if (!value?.RouteName) {
      return Swal.fire("Validation", "Route Name is required.", "warning");
    }
    if (!value?.Villages) {
      return Swal.fire("Validation", "Villages is required.", "warning");
    }
    if (value?.Cost === "" || value?.Cost === null || value?.Cost === undefined) {
      return Swal.fire("Validation", "Cost is required.", "warning");
    }

    try {
      if (isEdit) {
        await api.put(`/transportations/${route.id}`, value, {
          params: { session: value.session },
          headers: { "x-session": value.session },
        });
        Swal.fire("Updated!", "Route has been updated successfully.", "success");
      } else {
        await api.post("/transportations", value, {
          params: { session: value.session },
          headers: { "x-session": value.session },
        });
        Swal.fire("Added!", "Route has been added successfully.", "success");
      }

      // If they added/edited with different session than selected, move UI session to it
      if (safeStr(value.session) && value.session !== session) {
        setSession(value.session);
      } else {
        fetchRoutes(session);
      }
    } catch (error) {
      console.error(isEdit ? "Update route error:" : "Add route error:", error);
      const msg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        (isEdit ? "Failed to update the route." : "Failed to add the route.");
      Swal.fire("Error", msg, "error");
    }
  };

  const handleAdd = () => openRouteDialog({ mode: "add" });
  const handleEdit = (route) => openRouteDialog({ mode: "edit", route });

  // --- filtered + sorted
  const filtered = useMemo(() => {
    const s = safeStr(search).toLowerCase();
    const list = (routes || []).filter((r) => {
      const rn = safeStr(r?.RouteName).toLowerCase();
      const vil = safeStr(r?.Villages).toLowerCase();
      const sess = safeStr(r?.session).toLowerCase();
      return rn.includes(s) || vil.includes(s) || sess.includes(s);
    });

    const dir = sortDir === "asc" ? 1 : -1;

    list.sort((a, b) => {
      if (sortBy === "cost") {
        const ac = Number(a?.Cost ?? 0);
        const bc = Number(b?.Cost ?? 0);
        return ac === bc ? 0 : ac > bc ? dir : -dir;
      }
      // default route
      const ar = safeStr(a?.RouteName).toLowerCase();
      const br = safeStr(b?.RouteName).toLowerCase();
      return ar.localeCompare(br) * dir;
    });

    return list;
  }, [routes, search, sortBy, sortDir]);

  const totalRoutes = filtered.length;
  const avgCost = useMemo(() => {
    if (!filtered.length) return 0;
    const sum = filtered.reduce((acc, r) => acc + Number(r?.Cost ?? 0), 0);
    return sum / filtered.length;
  }, [filtered]);

  // quick UI actions
  const toggleSort = (key) => {
    if (sortBy !== key) {
      setSortBy(key);
      setSortDir("asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  };

  const setQuickSession = (kind) => {
    const cur = safeStr(session);
    if (!cur) return;

    // Parse "2025-26"
    const m = cur.match(/^(\d{4})-(\d{2})$/);
    if (!m) {
      // fallback: just set guess
      setSession(guessCurrentSession());
      return;
    }
    const startYear = Number(m[1]);
    const nextStart = kind === "next" ? startYear + 1 : startYear - 1;
    const endYear2 = String((nextStart + 1) % 100).padStart(2, "0");
    setSession(`${nextStart}-${endYear2}`);
  };

  return (
    <div className="container mt-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
        <div>
          <h1 className="m-0">Transportation Management</h1>
          <div className="text-muted" style={{ fontSize: 13 }}>
            Session-wise routes • Import/Export Excel • Fine fields supported
          </div>
        </div>

        <div className="d-flex gap-2 flex-wrap align-items-center">
          <div className="d-flex align-items-center gap-2">
            <span className="badge text-bg-light border" title="Selected session">
              Session
            </span>
            <input
              className="form-control"
              style={{ width: 140 }}
              value={session}
              onChange={(e) => setSession(e.target.value)}
              placeholder="2025-26"
            />
            <button
              className="btn btn-outline-secondary"
              title="Previous session"
              onClick={() => setQuickSession("prev")}
            >
              ◀
            </button>
            <button
              className="btn btn-outline-secondary"
              title="Next session"
              onClick={() => setQuickSession("next")}
            >
              ▶
            </button>
          </div>

          <button className="btn btn-outline-primary" onClick={handleExport}>
            Export Excel
          </button>

          <label className="btn btn-outline-secondary m-0">
            Import Excel
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: "none" }}
              onChange={(e) => handleImport(e.target.files?.[0])}
            />
          </label>

          <button className="btn btn-success" onClick={handleAdd}>
            + Add Route
          </button>

          <button
            className="btn btn-outline-dark"
            onClick={() => fetchRoutes(session)}
            disabled={loading}
            title="Refresh"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="row g-2 mb-3">
        <div className="col-12 col-md-4">
          <div className="p-3 border rounded bg-white">
            <div className="text-muted" style={{ fontSize: 12 }}>
              Showing Routes
            </div>
            <div className="fw-bold" style={{ fontSize: 20 }}>
              {totalRoutes}
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="p-3 border rounded bg-white">
            <div className="text-muted" style={{ fontSize: 12 }}>
              Average Cost
            </div>
            <div className="fw-bold" style={{ fontSize: 20 }}>
              {Number.isFinite(avgCost) ? avgCost.toFixed(2) : "0.00"}
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="p-3 border rounded bg-white">
            <div className="text-muted" style={{ fontSize: 12 }}>
              Permission
            </div>
            <div className="fw-bold" style={{ fontSize: 20 }}>
              {isSuperadmin ? "Super Admin" : "Standard"}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <input
          type="text"
          className="form-control"
          style={{ maxWidth: 420 }}
          placeholder="Search by Route / Villages / Session..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="d-flex gap-2 flex-wrap">
          <button
            className={`btn btn-sm ${
              sortBy === "route" ? "btn-primary" : "btn-outline-primary"
            }`}
            onClick={() => toggleSort("route")}
            title="Sort by Route Name"
          >
            Sort: Route {sortBy === "route" ? (sortDir === "asc" ? "▲" : "▼") : ""}
          </button>

          <button
            className={`btn btn-sm ${
              sortBy === "cost" ? "btn-primary" : "btn-outline-primary"
            }`}
            onClick={() => toggleSort("cost")}
            title="Sort by Cost"
          >
            Sort: Cost {sortBy === "cost" ? (sortDir === "asc" ? "▲" : "▼") : ""}
          </button>

          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => {
              setSearch("");
              setSortBy("route");
              setSortDir("asc");
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-responsive border rounded bg-white">
        <table className="table table-striped table-hover m-0 align-middle">
          <thead className="table-light">
            <tr>
              <th style={{ width: 60 }}>#</th>
              <th>Route Name</th>
              <th>Villages</th>
              <th style={{ width: 120 }}>Cost</th>
              <th style={{ width: 110 }}>Fine (%)</th>
              <th style={{ width: 160 }}>Fine Start Date</th>
              <th style={{ width: 140 }}>Session</th>
              <th style={{ width: 170 }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan="8" className="text-center py-4">
                  Loading...
                </td>
              </tr>
            )}

            {!loading &&
              filtered.map((route, index) => (
                <tr key={route.id}>
                  <td>{index + 1}</td>
                  <td className="fw-semibold">{safeStr(route.RouteName)}</td>
                  <td style={{ whiteSpace: "pre-wrap" }}>
                    {safeStr(route.Villages)}
                  </td>
                  <td>{route.Cost}</td>
                  <td>{route.finePercentage ?? 0}</td>
                  <td>{formatDDMMYYYY(route.fineStartDate)}</td>
                  <td>
                    <span className="badge text-bg-light border">
                      {safeStr(route.session) || "—"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-primary btn-sm me-2"
                      onClick={() => handleEdit(route)}
                    >
                      Edit
                    </button>

                    {isSuperadmin && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(route.id, route.RouteName)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan="8" className="text-center py-4">
                  No routes found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      <div className="text-muted mt-2" style={{ fontSize: 12 }}>
        Tip: While importing, include a <b>session</b> column in Excel. If you
        don’t include it, current selected session (<b>{session}</b>) will be used.
      </div>
    </div>
  );
};

export default Transportation;
