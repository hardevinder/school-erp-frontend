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
  type: "",
  description: "",
  status: "active",
};

export default function InventoryLocations() {
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
      setRows(await inventoryApi.getLocations());
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load locations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => bySearch(row, search, ["name", "code", "description", "status", "type", "location_name"]));
  }, [rows, search]);

  const handleSave = async (form) => {
    setSaving(true);
    try {
      if (editingRow?.id) await inventoryApi.updateLocation(editingRow.id, form);
      else await inventoryApi.createLocation(form);

      setOpen(false);
      setEditingRow(null);
      await loadRows();

      Swal.fire("Success", `Location ${editingRow?.id ? "updated" : "created"} successfully`, "success");
    } catch (err) {
      Swal.fire("Error", err?.response?.data?.message || err?.message || "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Delete location?",
      text: `This will delete ${row?.name || "this location"}.`,
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      confirmButtonText: "Delete",
    });

    if (!result.isConfirmed) return;

    try {
      await inventoryApi.deleteLocation(row.id);
      Swal.fire("Deleted", "Location deleted successfully", "success");
      loadRows();
    } catch (err) {
      Swal.fire("Error", err?.response?.data?.message || err?.message || "Delete failed", "error");
    }
  };

  return (
    <div className="container-fluid px-3 py-3">
      <InventoryPageHeader
        title="Inventory Locations"
        subtitle="Manage stores, labs, rooms, stock points and internal locations"
        actions={
          <button
            className="btn btn-light rounded-4"
            onClick={() => {
              setEditingRow(null);
              setOpen(true);
            }}
          >
            + Add Location
          </button>
        }
      />

      <InventoryTableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, code, type or description"
        rightContent={
          <>
            <span className="fw-semibold">{filteredRows.length}</span> visible locations
          </>
        }
      />

      {loading ? <div className="alert alert-light border">Loading locations...</div> : null}
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
                  <th>Type</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th style={{ width: 170 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      No locations found.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => {
                    const status = normalizeBooleanToStatus(row?.status);
                    return (
                      <tr key={inventoryUtils.normalizeId(row) || idx}>
                        <td>{idx + 1}</td>
                        <td className="fw-medium">{inventoryUtils.getName(row, ["location_name"])}</td>
                        <td>{inventoryUtils.getCode(row)}</td>
                        <td>{row?.type || row?.location_type || "—"}</td>
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
                                  name: row?.name || row?.location_name || "",
                                  code: row?.code || row?.location_code || "",
                                  type: row?.type || row?.location_type || "",
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
        title={editingRow?.id ? "Edit Location" : "Add Location"}
        initialValues={editingRow || emptyForm}
        submitLabel={editingRow?.id ? "Update Location" : "Create Location"}
        saving={saving}
        onClose={() => {
          setOpen(false);
          setEditingRow(null);
        }}
        onSubmit={handleSave}
        fields={[
          { name: "name", label: "Location Name", required: true, placeholder: "Main Store / Physics Lab / Library" },
          { name: "code", label: "Code", placeholder: "LOC-001" },
          { name: "type", label: "Type", placeholder: "Store / Lab / Room / Shelf" },
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
