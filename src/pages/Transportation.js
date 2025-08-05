// src/pages/Transportation.jsx
import React, { useState, useEffect, useMemo } from "react";
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
  };
};

const Transportation = () => {
  const { isSuperadmin } = useMemo(getRoleFlags, []);
  const [routes, setRoutes] = useState([]);
  const [search, setSearch] = useState("");

  // Fetch all routes
  const fetchRoutes = async () => {
    try {
      const res = await api.get("/transportations");
      setRoutes(res.data);
    } catch (error) {
      console.error("Error fetching routes:", error);
      Swal.fire("Error", "Failed to fetch routes.", "error");
    }
  };

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
          Swal.fire("Error", "Failed to add the route.", "error");
        }
      }
    });
  };

  // Edit Route Modal
  const handleEdit = (route) => {
    Swal.fire({
      title: "Edit Route",
      width: "500px",
      allowOutsideClick: false,
      allowEscapeKey: false,
      html: `
        <div class="form-container">
          <input type="text" id="RouteName" class="form-field" value="${route.RouteName}" placeholder="Route Name">
          <input type="text" id="Villages" class="form-field" value="${route.Villages}" placeholder="Villages (comma-separated)">
          <input type="number" id="Cost" class="form-field" value="${route.Cost}" placeholder="Cost">
          <input type="number" id="finePercentage" class="form-field" value="${route.finePercentage || ""}" placeholder="Fine Percentage (%)">
          <input type="date" id="fineStartDate" class="form-field" value="${
            route.fineStartDate ? route.fineStartDate.split("T")[0] : ""
          }">
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
          Swal.fire("Error", "Failed to update the route.", "error");
        }
      }
    });
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  const filtered = routes.filter(
    (r) =>
      r.RouteName.toLowerCase().includes(search.toLowerCase()) ||
      r.Villages.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1>Transportation Management</h1>
        <button className="btn btn-success" onClick={handleAdd}>
          Add Route
        </button>
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
              <td>{route.RouteName}</td>
              <td>{route.Villages}</td>
              <td>{route.Cost}</td>
              <td>{route.finePercentage || "0"}</td>
              <td>
                {route.fineStartDate
                  ? new Date(route.fineStartDate).toLocaleDateString()
                  : "N/A"}
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
