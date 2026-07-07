import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import InventoryPageHeader from "../../components/inventory/InventoryPageHeader";
import InventoryTableToolbar from "../../components/inventory/InventoryTableToolbar";
import InventoryModal from "../../components/inventory/InventoryModal";
import { inventoryApi, inventoryUtils } from "../../services/inventoryApi";
import { bySearch, normalizeBooleanToStatus, statusBadge } from "./shared";

const emptyForm = {
  name: "",
  code: "",
  description: "",
  status: "active",
};

export default function InventoryCategories() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [error, setError] = useState("");

  const loadRows = async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await inventoryApi.getCategories());
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => bySearch(row, search, ["name", "code", "description", "status", "category_name"]));
  }, [rows, search]);

  const handleSave = async (form) => {
    setSaving(true);
    try {
      if (editingRow?.id) await inventoryApi.updateCategory(editingRow.id, form);
      else await inventoryApi.createCategory(form);

      setOpen(false);
      setEditingRow(null);
      await loadRows();

      Swal.fire("Success", `Category ${editingRow?.id ? "updated" : "created"} successfully`, "success");
    } catch (err) {
      Swal.fire("Error", err?.response?.data?.message || err?.message || "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Delete category?",
      text: `This will delete ${row?.name || "this category"}.`,
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      confirmButtonText: "Delete",
    });

    if (!result.isConfirmed) return;

    try {
      await inventoryApi.deleteCategory(row.id);
      Swal.fire("Deleted", "Category deleted successfully", "success");
      loadRows();
    } catch (err) {
      Swal.fire("Error", err?.response?.data?.message || err?.message || "Delete failed", "error");
    }
  };

  return (
    <div className="container-fluid px-3 py-3">
      <InventoryPageHeader
        title="Inventory Categories"
        subtitle="Create and manage inventory category master data"
        actions={
          <button
            className="btn btn-light rounded-4"
            onClick={() => {
              setEditingRow(null);
              setOpen(true);
            }}
          >
            + Add Category
          </button>
        }
      />

      <InventoryTableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, code, description"
        rightContent={
          <>
            <span className="fw-semibold">{filteredRows.length}</span> visible categories
          </>
        }
      />

      {loading ? <div className="alert alert-light border">Loading categories...</div> : null}
      {!loading && error ? <div className="alert alert-danger">{error}</div> : null}

      {!loading && !error ? (
        <div className="card shadow-sm rounded-4 border-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 70 }}>#</th>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th style={{ width: 170 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4">
                      No categories found.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => {
                    const status = normalizeBooleanToStatus(row?.status);
                    return (
                      <tr key={inventoryUtils.normalizeId(row) || idx}>
                        <td>{idx + 1}</td>
                        <td className="fw-medium">{inventoryUtils.getName(row)}</td>
                        <td>{inventoryUtils.getCode(row)}</td>
                        <td>{row?.description || "—"}</td>
                        <td>
                          <span className={`badge text-uppercase ${statusBadge(status)}`}>{status}</span>
                        </td>
                        <td>
                          <div className="d-flex gap-2">
                            <button
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => {
                                setEditingRow({
                                  id: row.id,
                                  name: row?.name || "",
                                  code: row?.code || "",
                                  description: row?.description || "",
                                  status: normalizeBooleanToStatus(row?.status) || "active",
                                });
                                setOpen(true);
                              }}
                            >
                              Edit
                            </button>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(row)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <InventoryModal
        open={open}
        title={editingRow?.id ? "Edit Category" : "Add Category"}
        initialValues={editingRow || emptyForm}
        submitLabel={editingRow?.id ? "Update Category" : "Create Category"}
        saving={saving}
        onClose={() => {
          setOpen(false);
          setEditingRow(null);
        }}
        onSubmit={handleSave}
        fields={[
          { name: "name", label: "Category Name", required: true, placeholder: "Books / Physics Lab / Uniform" },
          { name: "code", label: "Code", placeholder: "CAT-001" },
          {
            name: "status",
            label: "Status",
            type: "select",
            options: [
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
            ],
          },
          {
            name: "description",
            label: "Description",
            type: "textarea",
            colClass: "col-md-12",
            placeholder: "Optional notes",
          },
        ]}
      />
    </div>
  );
}
