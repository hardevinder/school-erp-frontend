import React, { useState, useEffect } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./Students.css"; // Reuse styles
import "./Departments.css";

const getRoleFlags = () => {
  const singleRole = localStorage.getItem("userRole");
  const multiRoles = JSON.parse(localStorage.getItem("roles") || "[]");
  const roles = multiRoles.length ? multiRoles : [singleRole].filter(Boolean);
  return {
    roles,
    isAdmin: roles.includes("admin"),
    isSuperadmin: roles.includes("superadmin"),
    isHR: roles.includes("hr"),
  };
};

const Departments = () => {
  const { isAdmin, isSuperadmin, isHR } = getRoleFlags();
  const canEdit = isAdmin || isSuperadmin || isHR;

  const [departments, setDepartments] = useState([]);
  const [trashedDepartments, setTrashedDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [showTrash, setShowTrash] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const selectImportFile = (files) => {
    if (importing || !files?.length) return;
    if (files.length !== 1 || !/\.(xlsx|xls)$/i.test(files[0].name)) {
      Swal.fire("Invalid file", "Choose one Excel file (.xlsx or .xls).", "warning");
      return;
    }
    if (files[0].size > 5 * 1024 * 1024) {
      Swal.fire("File too large", "Excel file must be 5 MB or smaller.", "warning");
      return;
    }
    setImportFile(files[0]);
  };

  const handleExport = async (template = false) => {
    setExporting(true);
    try {
      const { data } = await api.get("/departments/export", {
        params: { template }, responseType: "blob",
      });
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `departments_${template ? "template" : "export"}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      Swal.fire("Error", "Failed to export departments.", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    if (!importFile || importing) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const { data } = await api.post("/departments/import", formData);
      setImportFile(null);
      await fetchDepartments();
      Swal.fire({
        title: "Import complete",
        text: `Added: ${data.insertedCount}. Skipped: ${data.skippedCount}.` +
          (data.skippedRows?.length ? "\n" + data.skippedRows.slice(0, 20).map((row) => `Row ${row.row}: ${row.reason}`).join("\n") +
            (data.skippedRows.length > 20 ? "\nShowing the first 20 skipped rows." : "") : ""),
        icon: data.skippedCount ? "warning" : "success",
        customClass: { htmlContainer: "department-import-result" },
      });
    } catch (error) {
      Swal.fire("Error", error.response?.data?.message || "Failed to import departments.", "error");
    } finally {
      setImporting(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data } = await api.get("/departments");
      setDepartments(data.departments || []);
    } catch (error) {
      Swal.fire("Error", "Failed to fetch departments.", "error");
    }
  };

  const fetchTrashed = async () => {
    try {
      const { data } = await api.get("/departments/trashed");
      setTrashedDepartments(data.trashed || []);
    } catch (error) {
      console.error("Error fetching trashed departments:", error);
    }
  };

  useEffect(() => {
    fetchDepartments();
    fetchTrashed();
  }, []);

  const handleAdd = async () => {
    const { value: formValues } = await Swal.fire({
      title: "Add Department",
      html:
        '<input id="swal-name" class="swal2-input" placeholder="Department Name">' +
        '<textarea id="swal-description" class="swal2-textarea" placeholder="Description (optional)"></textarea>',
      focusConfirm: false,
      preConfirm: () => {
        const name = document.getElementById("swal-name").value.trim();
        const description = document.getElementById("swal-description").value.trim();
        if (!name) {
          Swal.showValidationMessage("Department name is required");
          return;
        }
        return { name, description };
      },
      showCancelButton: true,
      confirmButtonText: "Add",
    });

    if (formValues) {
      try {
        await api.post("/departments", formValues);
        Swal.fire("Success", "Department added", "success");
        fetchDepartments();
      } catch (error) {
        Swal.fire("Error", error.response?.data?.message || "Failed to add department", "error");
      }
    }
  };

  const handleEdit = async (dept) => {
    const { value: formValues } = await Swal.fire({
      title: "Edit Department",
      html:
        `<input id="swal-name" class="swal2-input" value="${dept.name}" placeholder="Name">` +
        `<textarea id="swal-description" class="swal2-textarea" placeholder="Description (optional)">${dept.description || ""}</textarea>`,
      focusConfirm: false,
      preConfirm: () => {
        const name = document.getElementById("swal-name").value.trim();
        const description = document.getElementById("swal-description").value.trim();
        if (!name) {
          Swal.showValidationMessage("Name is required");
          return;
        }
        return { name, description };
      },
      showCancelButton: true,
      confirmButtonText: "Update",
    });

    if (formValues) {
      try {
        await api.put(`/departments/${dept.id}`, formValues);
        Swal.fire("Updated!", "Department updated successfully.", "success");
        fetchDepartments();
      } catch (error) {
        Swal.fire("Error", error.response?.data?.message || "Failed to update", "error");
      }
    }
  };

  const handleTrash = async (dept) => {
    const result = await Swal.fire({
      title: `Move ${dept.name} to Trash?`,
      text: "You can restore it later from the Trash list.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, move to Trash",
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/departments/${dept.id}`);
        Swal.fire("Trashed!", "Department has been moved to trash.", "success");
        fetchDepartments();
        fetchTrashed();
      } catch (error) {
        Swal.fire("Error", error.response?.data?.message || "Failed to delete department", "error");
      }
    }
  };

  const handleRestore = async (dept) => {
    try {
      await api.post(`/departments/${dept.id}/restore`);
      Swal.fire("Restored", "Department has been restored.", "success");
      fetchDepartments();
      fetchTrashed();
    } catch (error) {
      Swal.fire("Error", error.response?.data?.message || "Failed to restore department", "error");
    }
  };

  const handlePermanentDelete = async (dept) => {
    const result = await Swal.fire({
      title: `Permanently delete ${dept.name}?`,
      text: "This cannot be undone!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete Forever",
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/departments/${dept.id}/force`);
        Swal.fire("Deleted", "Department permanently deleted", "success");
        fetchTrashed();
      } catch (error) {
        Swal.fire("Error", error.response?.data?.message || "Failed to delete permanently", "error");
      }
    }
  };

  const filteredDepartments = departments.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredTrashed = trashedDepartments.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container-fluid mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h1>{showTrash ? "Trashed Departments" : "Departments"}</h1>
        <div className="d-flex gap-2 flex-wrap">
          {!showTrash && canEdit && (
            <button className="btn btn-success" onClick={handleAdd}>
              Add Department
            </button>
          )}
          {(isSuperadmin || isHR || isAdmin) && (
            <button
              className="btn btn-outline-secondary"
              onClick={() => setShowTrash((prev) => !prev)}
            >
              {showTrash ? "Show Active Departments" : "Show Trashed Departments"}
            </button>
          )}
        </div>
      </div>

      {!showTrash && canEdit && (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <button className="btn btn-outline-secondary" disabled={exporting} onClick={() => handleExport(true)}>
            Export Template
          </button>
          <button className="btn btn-secondary" disabled={exporting} onClick={() => handleExport(false)}>
            Export All Departments
          </button>
          <label
            className={`department-import-dropzone${dragging ? " is-dragging" : ""}`}
            onDragEnter={(event) => { event.preventDefault(); if (!importing) setDragging(true); }}
            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = importing ? "none" : "copy"; }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
            onDrop={(event) => { event.preventDefault(); setDragging(false); selectImportFile(event.dataTransfer.files); }}
          >
            <input
              type="file" className="visually-hidden" accept=".xlsx,.xls" disabled={importing}
              aria-label="Choose departments Excel file"
              onChange={(event) => { selectImportFile(event.target.files); event.target.value = ""; }}
            />
            <span className="department-import-filename" title={importFile?.name} aria-live="polite">
              {importFile ? importFile.name : "Drop Excel file or click to browse"}
            </span>
            <small>{dragging ? "Drop file here" : ".xlsx or .xls · Max 5 MB · 5,000 rows"}</small>
          </label>
          <button className="btn btn-primary" disabled={!importFile || importing} onClick={handleImport}>
            {importing ? "Importing…" : "Import"}
          </button>
          <small className="text-muted w-100">Department Name is required; Description is optional. Existing names (including Trash) are skipped.</small>
        </div>
      )}

      <input
        type="text"
        className="form-control mb-3"
        placeholder={`Search ${showTrash ? "trashed" : "active"} departments...`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* ========== Active Departments ========== */}
      {!showTrash && (
        <table className="table table-striped table-hover">
          <thead>
            <tr>
              <th>#</th>
              <th>Department Name</th>
              <th>Description</th>
              {canEdit && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredDepartments.length > 0 ? (
              filteredDepartments.map((dept, idx) => (
                <tr key={dept.id}>
                  <td>{idx + 1}</td>
                  <td>{dept.name}</td>
                  <td>{dept.description || "-"}</td>
                  {canEdit && (
                    <td>
                      <button
                        className="btn btn-primary btn-sm me-2"
                        onClick={() => handleEdit(dept)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleTrash(dept)}
                      >
                        Trash
                      </button>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="text-center">
                  No departments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* ========== Trashed Departments ========== */}
      {showTrash && (
        <table className="table table-bordered table-sm">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Description</th>
              <th>Deleted At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTrashed.length > 0 ? (
              filteredTrashed.map((dept, idx) => (
                <tr key={dept.id}>
                  <td>{idx + 1}</td>
                  <td>{dept.name}</td>
                  <td>{dept.description || "-"}</td>
                  <td>{new Date(dept.deletedAt).toLocaleString()}</td>
                  <td>
                    <button
                      className="btn btn-warning btn-sm me-2"
                      onClick={() => handleRestore(dept)}
                    >
                      Restore
                    </button>
                    {isSuperadmin && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handlePermanentDelete(dept)}
                      >
                        Delete Permanently
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="text-center">
                  No trashed departments.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Departments;
