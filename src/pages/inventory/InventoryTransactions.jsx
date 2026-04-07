import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import InventoryPageHeader from "../../components/inventory/InventoryPageHeader";
import InventoryTableToolbar from "../../components/inventory/InventoryTableToolbar";
import { inventoryApi, inventoryUtils } from "../../services/inventoryApi";
import { safeLower, statusBadge } from "./shared";

export default function InventoryTransactions() {
  const [rows, setRows] = useState([]);
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [itemFilter, setItemFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [transactionRows, itemRows, locationRows] = await Promise.all([
        inventoryApi.getTransactions(),
        inventoryApi.getItems(),
        inventoryApi.getLocations(),
      ]);
      setRows(transactionRows);
      setItems(itemRows);
      setLocations(locationRows);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const itemOptions = useMemo(() => {
    return items.map((row) => ({ label: row?.name || row?.item_name || `Item #${row?.id}`, value: row?.id }));
  }, [items]);

  const locationOptions = useMemo(() => {
    return locations.map((row) => ({ label: row?.name || row?.location_name || `Location #${row?.id}`, value: row?.id }));
  }, [locations]);

  const typeOptions = useMemo(() => {
    return ["opening", "receive", "issue", "transfer", "adjust", "cancelled"];
  }, []);

  const filteredRows = useMemo(() => {
    const q = safeLower(search).trim();

    return rows.filter((row) => {
      const type = safeLower(inventoryUtils.getTransactionType(row));
      const itemId = String(row?.itemId || row?.item_id || row?.item?.id || "");
      const locationId = String(row?.locationId || row?.location_id || row?.location?.id || row?.fromLocationId || "");
      const blob = [
        inventoryUtils.getTransactionType(row),
        row?.item?.name,
        row?.item_name,
        row?.location?.name,
        row?.location_name,
        inventoryUtils.getReferenceNo(row),
        row?.remarks,
        row?.created_by,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (typeFilter !== "all" && !type.includes(typeFilter)) return false;
      if (itemFilter !== "all" && itemId !== String(itemFilter)) return false;
      if (locationFilter !== "all" && locationId !== String(locationFilter)) return false;
      if (q && !blob.includes(q)) return false;

      return true;
    });
  }, [rows, search, typeFilter, itemFilter, locationFilter]);

  const handleCancel = async (row) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Cancel transaction?",
      text: `This will cancel transaction ${inventoryUtils.getReferenceNo(row)}.`,
      showCancelButton: true,
      confirmButtonText: "Cancel Transaction",
      confirmButtonColor: "#dc2626",
    });

    if (!result.isConfirmed) return;

    try {
      await inventoryApi.cancelTransaction(row.id);
      Swal.fire("Success", "Transaction cancelled successfully", "success");
      loadAll();
    } catch (err) {
      Swal.fire("Error", err?.response?.data?.message || err?.message || "Cancel failed", "error");
    }
  };

  return (
    <div className="container-fluid px-3 py-3">
      <InventoryPageHeader
        title="Inventory Transactions"
        subtitle="View, filter and review all inventory movement entries"
        actions={<button className="btn btn-light rounded-4" onClick={loadAll}>Refresh</button>}
      />

      <InventoryTableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by item, location, reference or remarks"
        filters={
          <>
            <div>
              <label className="form-label mb-1">Type</label>
              <select className="form-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">All Types</option>
                {typeOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label mb-1">Item</label>
              <select className="form-select" value={itemFilter} onChange={(e) => setItemFilter(e.target.value)}>
                <option value="all">All Items</option>
                {itemOptions.map((opt) => (
                  <option key={String(opt.value)} value={String(opt.value)}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label mb-1">Location</label>
              <select className="form-select" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
                <option value="all">All Locations</option>
                {locationOptions.map((opt) => (
                  <option key={String(opt.value)} value={String(opt.value)}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        }
        rightContent={
          <>
            <span className="fw-semibold">{filteredRows.length}</span> visible transactions
          </>
        }
      />

      {loading ? <div className="alert alert-light border">Loading transactions...</div> : null}
      {!loading && error ? <div className="alert alert-danger">{error}</div> : null}

      {!loading && !error ? (
        <div className="card shadow-sm rounded-4 border-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Item</th>
                  <th>Location</th>
                  <th>Qty</th>
                  <th>Reference</th>
                  <th>Remarks</th>
                  <th>User</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center text-muted py-4">
                      No transactions found.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => {
                    const type = inventoryUtils.getTransactionType(row);
                    const locationName =
                      row?.location?.name ||
                      row?.location_name ||
                      row?.fromLocation?.name ||
                      row?.from_location_name ||
                      "—";

                    return (
                      <tr key={inventoryUtils.normalizeId(row) || idx}>
                        <td>{inventoryUtils.formatDateTime(inventoryUtils.getDate(row))}</td>
                        <td>
                          <span className={`badge text-uppercase ${statusBadge(type)}`}>{type}</span>
                        </td>
                        <td>{row?.item?.name || row?.item_name || row?.itemName || "—"}</td>
                        <td>{locationName}</td>
                        <td>{inventoryUtils.getQty(row, ["quantity", "qty", "issued_qty", "received_qty"])}</td>
                        <td>{inventoryUtils.getReferenceNo(row)}</td>
                        <td className="text-truncate" style={{ maxWidth: 220 }} title={row?.remarks || ""}>
                          {row?.remarks || "—"}
                        </td>
                        <td>{inventoryUtils.getUserName(row)}</td>
                        <td>
                          {!safeLower(type).includes("cancel") ? (
                            <button className="btn btn-sm btn-outline-danger" onClick={() => handleCancel(row)}>
                              Cancel
                            </button>
                          ) : (
                            <span className="text-muted small">—</span>
                          )}
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
    </div>
  );
}
