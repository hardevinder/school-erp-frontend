import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import InventoryPageHeader from "../../components/inventory/InventoryPageHeader";
import InventoryTableToolbar from "../../components/inventory/InventoryTableToolbar";
import InventoryModal from "../../components/inventory/InventoryModal";
import { inventoryApi, inventoryUtils } from "../../services/inventoryApi";
import { bySearch, normalizeBooleanToStatus, safeLower, statusBadge } from "./shared";

const emptyForm = {
  name: "",
  code: "",
  categoryId: "",
  unit: "",
  minStock: "",
  description: "",
  status: "active",
};

export default function InventoryItems() {
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [error, setError] = useState("");

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [itemRows, categoryRows] = await Promise.all([
        inventoryApi.getItems(),
        inventoryApi.getCategories(),
      ]);

      setRows(itemRows);
      setCategories(categoryRows);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const categoryOptions = useMemo(() => {
    return categories.map((row) => ({
      label: row?.name || row?.category_name || `Category #${row?.id}`,
      value: row?.id,
    }));
  }, [categories]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (categoryFilter !== "all") {
        const rowCategoryId = String(row?.categoryId || row?.category_id || row?.category?.id || "");
        if (rowCategoryId !== String(categoryFilter)) return false;
      }

      return bySearch(row, search, [
        "name",
        "code",
        "description",
        "unit",
        "category_name",
        "status",
      ]);
    });
  }, [rows, search, categoryFilter]);

  const handleSave = async (form) => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        categoryId: form.categoryId || form.category_id || "",
        category_id: form.categoryId || form.category_id || "",
      };

      if (editingRow?.id) await inventoryApi.updateItem(editingRow.id, payload);
      else await inventoryApi.createItem(payload);

      setOpen(false);
      setEditingRow(null);
      await loadAll();

      Swal.fire("Success", `Item ${editingRow?.id ? "updated" : "created"} successfully`, "success");
    } catch (err) {
      Swal.fire("Error", err?.response?.data?.message || err?.message || "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Delete item?",
      text: `This will delete ${row?.name || "this item"}.`,
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      confirmButtonText: "Delete",
    });

    if (!result.isConfirmed) return;

    try {
      await inventoryApi.deleteItem(row.id);
      Swal.fire("Deleted", "Item deleted successfully", "success");
      loadAll();
    } catch (err) {
      Swal.fire("Error", err?.response?.data?.message || err?.message || "Delete failed", "error");
    }
  };

  return (
    <div className="container-fluid px-3 py-3">
      <InventoryPageHeader
        title="Inventory Items"
        subtitle="Manage inventory items, units, category mapping and minimum stock"
        actions={
          <button
            className="btn btn-light rounded-4"
            onClick={() => {
              setEditingRow(null);
              setOpen(true);
            }}
          >
            + Add Item
          </button>
        }
      />

      <InventoryTableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by item name, code, unit, category"
        filters={
          <div>
            <label className="form-label mb-1">Category</label>
            <select className="form-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">All Categories</option>
              {categoryOptions.map((opt) => (
                <option key={String(opt.value)} value={String(opt.value)}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        }
        rightContent={
          <>
            <span className="fw-semibold">{filteredRows.length}</span> visible items
          </>
        }
      />

      {loading ? <div className="alert alert-light border">Loading items...</div> : null}
      {!loading && error ? <div className="alert alert-danger">{error}</div> : null}

      {!loading && !error ? (
        <div className="card shadow-sm rounded-4 border-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 70 }}>#</th>
                  <th>Item</th>
                  <th>Code</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Min Stock</th>
                  <th>Status</th>
                  <th style={{ width: 170 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-4">
                      No items found.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => {
                    const status = normalizeBooleanToStatus(row?.status);
                    return (
                      <tr key={inventoryUtils.normalizeId(row) || idx}>
                        <td>{idx + 1}</td>
                        <td>
                          <div className="fw-medium">{inventoryUtils.getName(row, ["item_name"])}</div>
                          <div className="small text-muted text-truncate" style={{ maxWidth: 240 }}>
                            {row?.description || "—"}
                          </div>
                        </td>
                        <td>{inventoryUtils.getCode(row)}</td>
                        <td>{inventoryUtils.getCategoryName(row)}</td>
                        <td>{row?.unit || row?.uom || "—"}</td>
                        <td>{inventoryUtils.getMinStock(row)}</td>
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
                                  name: row?.name || row?.item_name || "",
                                  code: row?.code || row?.item_code || "",
                                  categoryId: row?.categoryId || row?.category_id || row?.category?.id || "",
                                  unit: row?.unit || row?.uom || "",
                                  minStock: row?.minStock || row?.min_stock || row?.reorder_level || "",
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
        title={editingRow?.id ? "Edit Item" : "Add Item"}
        initialValues={editingRow || emptyForm}
        submitLabel={editingRow?.id ? "Update Item" : "Create Item"}
        saving={saving}
        onClose={() => {
          setOpen(false);
          setEditingRow(null);
        }}
        onSubmit={handleSave}
        fields={[
          { name: "name", label: "Item Name", required: true, placeholder: "Physics Record Register" },
          { name: "code", label: "Code", placeholder: "ITEM-001" },
          {
            name: "categoryId",
            label: "Category",
            type: "select",
            required: true,
            options: categoryOptions,
            placeholder: "Select category",
          },
          { name: "unit", label: "Unit", placeholder: "pcs / box / book / kg" },
          { name: "minStock", label: "Minimum Stock", type: "number", min: "0", step: "1" },
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
