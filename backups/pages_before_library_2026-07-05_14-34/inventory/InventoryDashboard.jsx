import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import InventoryPageHeader from "../../components/inventory/InventoryPageHeader";
import InventoryKpiCard from "../../components/inventory/InventoryKpiCard";
import { inventoryApi, inventoryUtils } from "../../services/inventoryApi";
import { statusBadge, safeLower } from "./shared";

export default function InventoryDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [stockRows, setStockRows] = useState([]);

  const loadAll = async () => {
    setLoading(true);
    setError("");

    try {
      const [categoryRows, itemRows, locationRows, transactionRows, stockReportRows] = await Promise.all([
        inventoryApi.getCategories(),
        inventoryApi.getItems(),
        inventoryApi.getLocations(),
        inventoryApi.getTransactions(),
        inventoryApi.getStockReport(),
      ]);

      setCategories(categoryRows);
      setItems(itemRows);
      setLocations(locationRows);
      setTransactions(transactionRows);
      setStockRows(stockReportRows);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load inventory dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const totalAvailableQty = useMemo(() => {
    return stockRows.reduce((sum, row) => sum + inventoryUtils.getQty(row), 0);
  }, [stockRows]);

  const lowStockRows = useMemo(() => {
    return stockRows.filter((row) => {
      const qty = inventoryUtils.getQty(row);
      const minStock = inventoryUtils.getMinStock(row);
      return minStock > 0 && qty <= minStock;
    });
  }, [stockRows]);

  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => {
        const ta = new Date(inventoryUtils.getDate(a)).getTime() || 0;
        const tb = new Date(inventoryUtils.getDate(b)).getTime() || 0;
        return tb - ta;
      })
      .slice(0, 8);
  }, [transactions]);

  const receivedToday = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return transactions.filter((row) => {
      const type = safeLower(inventoryUtils.getTransactionType(row));
      const date = inventoryUtils.formatDate(inventoryUtils.getDate(row));
      return type.includes("receive") && date === today;
    }).length;
  }, [transactions]);

  const issuedToday = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return transactions.filter((row) => {
      const type = safeLower(inventoryUtils.getTransactionType(row));
      const date = inventoryUtils.formatDate(inventoryUtils.getDate(row));
      return type.includes("issue") && date === today;
    }).length;
  }, [transactions]);

  const topMovingItems = useMemo(() => {
    const map = new Map();

    transactions.forEach((row) => {
      const itemName =
        row?.item?.name ||
        row?.item_name ||
        row?.itemName ||
        row?.name ||
        "Unknown Item";
      const qty = inventoryUtils.getQty(row, ["quantity", "qty", "issued_qty", "received_qty"]);
      map.set(itemName, (map.get(itemName) || 0) + qty);
    });

    return [...map.entries()]
      .map(([name, totalQty]) => ({ name, totalQty }))
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, 6);
  }, [transactions]);

  const handleQuickNav = (message) => {
    Swal.fire({
      icon: "info",
      title: "Quick Action",
      text: `${message} page route can be connected from your sidebar/router.`,
      timer: 1700,
      showConfirmButton: false,
    });
  };

  return (
    <div className="container-fluid px-3 py-3">
      <InventoryPageHeader
        title="Inventory Dashboard"
        subtitle="Overview of categories, items, locations, stock levels and recent inventory activity"
        actions={
          <>
            <button className="btn btn-light rounded-4" onClick={() => handleQuickNav("Receive Stock")}>
              Receive Stock
            </button>
            <button className="btn btn-outline-light rounded-4" onClick={() => handleQuickNav("Issue Stock")}>
              Issue Stock
            </button>
            <button className="btn btn-light rounded-4" onClick={loadAll}>
              Refresh
            </button>
          </>
        }
      />

      {loading ? <div className="alert alert-light border">Loading inventory dashboard...</div> : null}
      {!loading && error ? <div className="alert alert-danger">{error}</div> : null}

      {!loading && !error ? (
        <>
          <div className="row g-3 mb-4">
            <InventoryKpiCard
              title="Categories"
              value={categories.length}
              hint="Inventory categories configured"
              valueClassName="text-primary"
              borderColor="#60a5fa"
            />
            <InventoryKpiCard
              title="Items"
              value={items.length}
              hint="Inventory items / products"
              valueClassName="text-info"
              borderColor="#22d3ee"
            />
            <InventoryKpiCard
              title="Locations"
              value={locations.length}
              hint="Stores / labs / rooms / stock points"
              valueClassName="text-secondary"
              borderColor="#a78bfa"
            />
            <InventoryKpiCard
              title="Available Qty"
              value={totalAvailableQty}
              hint="Total current stock across report rows"
              valueClassName="text-success"
              borderColor="#34d399"
            />
            <InventoryKpiCard
              title="Low Stock Items"
              value={lowStockRows.length}
              hint="Qty less than or equal to min stock"
              valueClassName="text-danger"
              borderColor="#f87171"
            />
            <InventoryKpiCard
              title="Transactions"
              value={transactions.length}
              hint="All inventory movement entries"
              valueClassName="text-dark"
              borderColor="#94a3b8"
            />
            <InventoryKpiCard
              title="Received Today"
              value={receivedToday}
              hint="Receive entries for today"
              valueClassName="text-success"
              borderColor="#4ade80"
            />
            <InventoryKpiCard
              title="Issued Today"
              value={issuedToday}
              hint="Issue entries for today"
              valueClassName="text-warning"
              borderColor="#facc15"
            />
          </div>

          <div className="row g-3 mb-4">
            <div className="col-xl-7">
              <div className="card shadow-sm rounded-4 border-0 h-100">
                <div className="card-header bg-white border-0 fw-semibold d-flex justify-content-between align-items-center">
                  <span>Recent Transactions</span>
                  <span className="badge bg-secondary">{recentTransactions.length}</span>
                </div>
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Reference</th>
                        <th>User</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center text-muted py-4">
                            No transactions found.
                          </td>
                        </tr>
                      ) : (
                        recentTransactions.map((row, idx) => (
                          <tr key={`${inventoryUtils.normalizeId(row) || idx}-txn`}>
                            <td>{inventoryUtils.formatDateTime(inventoryUtils.getDate(row))}</td>
                            <td>
                              <span className={`badge text-uppercase ${statusBadge(inventoryUtils.getTransactionType(row))}`}>
                                {inventoryUtils.getTransactionType(row)}
                              </span>
                            </td>
                            <td>{row?.item?.name || row?.item_name || row?.itemName || "—"}</td>
                            <td>{inventoryUtils.getQty(row, ["quantity", "qty", "issued_qty", "received_qty"])}</td>
                            <td>{inventoryUtils.getReferenceNo(row)}</td>
                            <td>{inventoryUtils.getUserName(row)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="col-xl-5">
              <div className="card shadow-sm rounded-4 border-0 h-100">
                <div className="card-header bg-white border-0 fw-semibold d-flex justify-content-between align-items-center">
                  <span>Low Stock Alerts</span>
                  <span className="badge bg-danger">{lowStockRows.length}</span>
                </div>
                <div className="card-body">
                  {lowStockRows.length === 0 ? (
                    <div className="text-muted">No low stock alerts right now.</div>
                  ) : (
                    <div className="list-group list-group-flush">
                      {lowStockRows.slice(0, 8).map((row, idx) => {
                        const qty = inventoryUtils.getQty(row);
                        const minStock = inventoryUtils.getMinStock(row);
                        return (
                          <div
                            key={`${inventoryUtils.normalizeId(row) || idx}-low`}
                            className="list-group-item px-0 d-flex align-items-center justify-content-between gap-3"
                          >
                            <div>
                              <div className="fw-semibold">
                                {row?.item?.name || row?.item_name || row?.name || "—"}
                              </div>
                              <div className="small text-muted">
                                {inventoryUtils.getCategoryName(row)} · {inventoryUtils.getLocationName(row)}
                              </div>
                            </div>
                            <div className="text-end">
                              <div className="fw-semibold text-danger">{qty}</div>
                              <div className="small text-muted">Min {minStock}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-lg-6">
              <div className="card shadow-sm rounded-4 border-0 h-100">
                <div className="card-header bg-white border-0 fw-semibold">Top Moving Items</div>
                <div className="card-body">
                  {topMovingItems.length === 0 ? (
                    <div className="text-muted">No movement data available yet.</div>
                  ) : (
                    <div className="list-group list-group-flush">
                      {topMovingItems.map((row, idx) => (
                        <div
                          key={`${row.name}-${idx}`}
                          className="list-group-item px-0 d-flex justify-content-between align-items-center"
                        >
                          <div className="fw-medium">{row.name}</div>
                          <span className="badge bg-primary">{row.totalQty}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="card shadow-sm rounded-4 border-0 h-100">
                <div className="card-header bg-white border-0 fw-semibold">Stock Report Preview</div>
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Item</th>
                        <th>Category</th>
                        <th>Location</th>
                        <th>Qty</th>
                        <th>Min</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center text-muted py-4">
                            Stock report is empty.
                          </td>
                        </tr>
                      ) : (
                        stockRows.slice(0, 8).map((row, idx) => (
                          <tr key={`${inventoryUtils.normalizeId(row) || idx}-stock`}>
                            <td>{row?.item?.name || row?.item_name || row?.name || "—"}</td>
                            <td>{inventoryUtils.getCategoryName(row)}</td>
                            <td>{inventoryUtils.getLocationName(row)}</td>
                            <td>{inventoryUtils.getQty(row)}</td>
                            <td>{inventoryUtils.getMinStock(row)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
