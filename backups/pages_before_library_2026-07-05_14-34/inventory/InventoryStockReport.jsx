import React, { useEffect, useMemo, useState } from "react";
import InventoryPageHeader from "../../components/inventory/InventoryPageHeader";
import InventoryTableToolbar from "../../components/inventory/InventoryTableToolbar";
import { inventoryApi, inventoryUtils } from "../../services/inventoryApi";
import { safeLower } from "./shared";

export default function InventoryStockReport() {
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAll = async () => {
    setLoading(true);
    setError("");

    try {
      const [stockRows, categoryRows, locationRows] = await Promise.all([
        inventoryApi.getStockReport(),
        inventoryApi.getCategories(),
        inventoryApi.getLocations(),
      ]);

      setRows(stockRows);
      setCategories(categoryRows);
      setLocations(locationRows);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load stock report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const categoryOptions = useMemo(() => {
    return categories.map((row) => ({ label: row?.name || row?.category_name || `Category #${row?.id}`, value: row?.id }));
  }, [categories]);

  const locationOptions = useMemo(() => {
    return locations.map((row) => ({ label: row?.name || row?.location_name || `Location #${row?.id}`, value: row?.id }));
  }, [locations]);

  const filteredRows = useMemo(() => {
    const q = safeLower(search).trim();

    return rows.filter((row) => {
      const categoryId = String(row?.categoryId || row?.category_id || row?.category?.id || "");
      const locationId = String(row?.locationId || row?.location_id || row?.location?.id || "");
      const qty = inventoryUtils.getQty(row);
      const minStock = inventoryUtils.getMinStock(row);

      const blob = [
        row?.item?.name,
        row?.item_name,
        row?.name,
        inventoryUtils.getCategoryName(row),
        inventoryUtils.getLocationName(row),
        inventoryUtils.getCode(row),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (categoryFilter !== "all" && categoryId !== String(categoryFilter)) return false;
      if (locationFilter !== "all" && locationId !== String(locationFilter)) return false;
      if (onlyLowStock && !(minStock > 0 && qty <= minStock)) return false;
      if (q && !blob.includes(q)) return false;

      return true;
    });
  }, [rows, search, categoryFilter, locationFilter, onlyLowStock]);

  const totalQty = useMemo(() => {
    return filteredRows.reduce((sum, row) => sum + inventoryUtils.getQty(row), 0);
  }, [filteredRows]);

  return (
    <div className="container-fluid px-3 py-3">
      <InventoryPageHeader
        title="Stock Report"
        subtitle="Current stock status by item, category and location"
        actions={<button className="btn btn-light rounded-4" onClick={loadAll}>Refresh</button>}
      />

      <InventoryTableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by item, code, category or location"
        filters={
          <>
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

            <div className="form-check mt-4">
              <input
                id="lowStockOnly"
                type="checkbox"
                className="form-check-input"
                checked={onlyLowStock}
                onChange={(e) => setOnlyLowStock(e.target.checked)}
              />
              <label htmlFor="lowStockOnly" className="form-check-label">
                Low stock only
              </label>
            </div>
          </>
        }
        rightContent={
          <>
            <span className="fw-semibold">{filteredRows.length}</span> visible rows · Total Qty{" "}
            <span className="fw-semibold">{totalQty}</span>
          </>
        }
      />

      {loading ? <div className="alert alert-light border">Loading stock report...</div> : null}
      {!loading && error ? <div className="alert alert-danger">{error}</div> : null}

      {!loading && !error ? (
        <div className="card shadow-sm rounded-4 border-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Item</th>
                  <th>Code</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Available Qty</th>
                  <th>Min Stock</th>
                  <th>Unit</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      No stock records found.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => {
                    const qty = inventoryUtils.getQty(row);
                    const minStock = inventoryUtils.getMinStock(row);
                    const isLow = minStock > 0 && qty <= minStock;

                    return (
                      <tr
                        key={inventoryUtils.normalizeId(row) || idx}
                        style={isLow ? { background: "#fff5f5" } : undefined}
                      >
                        <td className="fw-medium">{row?.item?.name || row?.item_name || row?.name || "—"}</td>
                        <td>{inventoryUtils.getCode(row)}</td>
                        <td>{inventoryUtils.getCategoryName(row)}</td>
                        <td>{inventoryUtils.getLocationName(row)}</td>
                        <td className={isLow ? "text-danger fw-semibold" : ""}>{qty}</td>
                        <td>{minStock}</td>
                        <td>{row?.unit || row?.uom || "—"}</td>
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
