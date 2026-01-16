// src/pages/Transportation.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
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
  if (!val) return "N/A";
  try {
    // if ISO date string
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

const Transportation = () => {
  const { isSuperadmin } = useMemo(getRoleFlags, []);
  const [routes, setRoutes] = useState([]);
  const [search, setSearch] = useState("");
  const fileRef = useRef(null);

  // Fetch all routes
  const fetchRoutes = async () => {
    try {
      const res = await api.get("/transportations");
      setRoutes(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Error fetching routes:", error);
      Swal.fire("Error", "Failed to fetch routes.", "error");
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  // Delete a route (Superadmin only)
  const handleDelete = async (id, routeName) => {
    if (!isSuperadmin) {
      return Swal.fire("Forbidden", "Only Super Admin can delete.", "warning");
    }

    const result = await Swal.fire({
      title: `Delete route (${routeName})?`,
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/transportations/${id}`);
        Swal.fire("Deleted!", "Route has been deleted.", "success");
        fetchRoutes();
      } catch (error) {
        console.error("Error deleting route:", error);
        Swal.fire("Error", "Failed to delete the route.", "error");
      }
    }
  };

  // ✅ Export Excel
  const handleExport = async () => {
    try {
      const res = await api.get("/transportations/export", {
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

      // try to use filename from header, else fallback
      const disposition = res.headers?.["content-disposition"] || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      a.download = match?.[1] || "Transportations.xlsx";

      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      Swal.fire("Error", "Failed to export Excel.", "error");
    }
  };

  // ✅ Import Excel (field name must be "file")
  const handleImport = async (file) => {
    if (!file) return;

    const ok = await Swal.fire({
      title: "Import Transportations?",
      text: "This will upload Excel and add routes into system.",
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

      const res = await api.post("/transportations/import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      Swal.fire(
        "Imported!",
        res?.data?.message || "Excel imported successfully.",
        "success"
      );

      // refresh
      fetchRoutes();
    } catch (err) {
      console.error("Import error:", err);

      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Failed to import Excel.";

      Swal.fire("Error", msg, "error");
    } finally {
      // reset file input
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // Add Route Modal
  const handleAdd = () => {
    Swal.fire({
      title: "Add New Route",
      width: "500px",
      allowOutsideClick: false,
      allowEscapeKey: false,
      html: `
        <div class="form-container">
          <input type="text" id="RouteName" class="form-field" placeholder="Route Name">
          <input type="text" id="Villages" class="form-field" placeholder="Villages (comma-separated)">
          <input type="number" id="Cost" class="form-field" placeholder="Cost">
          <input type="number" id="finePercentage" class="form-field" placeholder="Fine Percentage (%)">
          <input type="date" id="fineStartDate" class="form-field">
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Add",
      preConfirm: () => {
        return {
          RouteName: document.getElementById("RouteName").value,
          Villages: document.getElementById("Villages").value,
          Cost: document.getElementById("Cost").value,
          finePercentage: document.getElementById("finePercentage").value || 0,
          fineStartDate: document.getElementById("fineStartDate").value || null,
        };
      },
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.post("/transportations", result.value);
          Swal.fire("Added!", "Route has been added successfully.", "success");
          fetchRoutes();
        } catch (error) {
          console.error("Add route error:", error);
          Swal.fire("Error", "Failed to add the route.", "error");
        }
      }
    });
  };

  // Edit Route Modal
  const handleEdit = (route) => {
    const routeName = safeStr(route?.RouteName);
    const villages = safeStr(route?.Villages);
    const cost = route?.Cost ?? "";
    const finePct = route?.finePercentage ?? "";
    const fineDate = route?.fineStartDate ? String(route.fineStartDate).split("T")[0] : "";

    Swal.fire({
      title: "Edit Route",
      width: "500px",
      allowOutsideClick: false,
      allowEscapeKey: false,
      html: `
        <div class="form-container">
          <input type="text" id="RouteName" class="form-field" value="${routeName}" placeholder="Route Name">
          <input type="text" id="Villages" class="form-field" value="${villages}" placeholder="Villages (comma-separated)">
          <input type="number" id="Cost" class="form-field" value="${cost}" placeholder="Cost">
          <input type="number" id="finePercentage" class="form-field" value="${finePct}" placeholder="Fine Percentage (%)">
          <input type="date" id="fineStartDate" class="form-field" value="${fineDate}">
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Save",
      preConfirm: () => {
        return {
          RouteName: document.getElementById("RouteName").value,
          Villages: document.getElementById("Villages").value,
          Cost: document.getElementById("Cost").value,
          finePercentage: document.getElementById("finePercentage").value || 0,
          fineStartDate: document.getElementById("fineStartDate").value || null,
        };
      },
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.put(`/transportations/${route.id}`, result.value);
          Swal.fire("Updated!", "Route has been updated successfully.", "success");
          fetchRoutes();
        } catch (error) {
          console.error("Update route error:", error);
          Swal.fire("Error", "Failed to update the route.", "error");
        }
      }
    });
  };

  const filtered = routes.filter((r) => {
    const rn = safeStr(r?.RouteName).toLowerCase();
    const vil = safeStr(r?.Villages).toLowerCase();
    const s = safeStr(search).toLowerCase();
    return rn.includes(s) || vil.includes(s);
  });

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h1 className="m-0">Transportation Management</h1>

        <div className="d-flex gap-2 flex-wrap">
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
            Add Route
          </button>
        </div>
      </div>

      <div className="mb-3 d-flex">
        <input
          type="text"
          className="form-control w-50 me-2"
          placeholder="Search Routes"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <table className="table table-striped">
        <thead>
          <tr>
            <th>#</th>
            <th>Route Name</th>
            <th>Villages</th>
            <th>Cost</th>
            <th>Fine (%)</th>
            <th>Fine Start Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((route, index) => (
            <tr key={route.id}>
              <td>{index + 1}</td>
              <td>{safeStr(route.RouteName)}</td>
              <td>{safeStr(route.Villages)}</td>
              <td>{route.Cost}</td>
              <td>{route.finePercentage ?? 0}</td>
              <td>{formatDDMMYYYY(route.fineStartDate)}</td>
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

          {filtered.length === 0 && (
            <tr>
              <td colSpan="7" className="text-center">
                No routes found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Transportation;
