import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import InventoryPageHeader from "./inventory/InventoryPageHeader";
import InventoryKpiCard from "./inventory/InventoryKpiCard";
import { inventoryApi, inventoryUtils } from "../services/inventoryApi";
import { statusBadge, safeLower } from "../pages/inventory/shared";

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
      const [categoryRows, itemRows, locationRows, transactionRows, stockReportRows] =
        await Promise.all([
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
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load inventory dashboard"
      );
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

  const recentReceived = useMemo(() => {
    return recentTransactions.filter((row) =>
      safeLower(inventoryUtils.getTransactionType(row)).includes("receive")
    ).slice(0, 5);
  }, [recentTransactions]);

  const recentIssued = useMemo(() => {
    return recentTransactions.filter((row) =>
      safeLower(inventoryUtils.getTransactionType(row)).includes("issue")
    ).slice(0, 5);
  }, [recentTransactions]);

  const handleRefresh = async () => {
    await loadAll();
    Swal.fire("Done", "Inventory dashboard refreshed", "success");
  };

  return (
    <div className="container-fluid px-3 py-3">
      <InventoryPageHeader
        title="Inventory Dashboard"
        subtitle="Overview of categories, items, stock, low stock alerts and recent transactions"
        actions={[
          { label: "Refresh", onClick: handleRefresh, className: "btn-outline-primary" },
        ]}
      />

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="row g-3 mb-4">
        <div className="col-md-6 col-xl-3">
          <InventoryKpiCard
            title="Categories"
            value={categories.length}
            subtitle="Inventory groups"
            icon="bi-tags"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <InventoryKpiCard
            title="Items"
            value={items.length}
            subtitle="Registered items"
            icon="bi-box2"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <InventoryKpiCard
            title="Locations"
            value={locations.length}
            subtitle="Stores / labs / rooms"
            icon="bi-geo-alt"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <InventoryKpiCard
            title="Available Qty"
            value={totalAvailableQty}
            subtitle="Current stock quantity"
            icon="bi-stack"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <InventoryKpiCard
            title="Low Stock"
            value={lowStockRows.length}
            subtitle="Needs attention"
            icon="bi-exclamation-triangle"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <InventoryKpiCard
            title="Transactions"
            value={transactions.length}
            subtitle="All movements"
            icon="bi-journal-text"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <InventoryKpiCard
            title="Received Today"
            value={receivedToday}
            subtitle="Today receive entries"
            icon="bi-box-arrow-in-down"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <InventoryKpiCard
            title="Issued Today"
            value={issuedToday}
            subtitle="Today issue entries"
            icon="bi-box-arrow-up"
          />
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-lg-6">
          <div className="card shadow-sm border-0 rounded-4 h-100">
            <div className="card-header bg-white border-0 fw-semibold">
              Low Stock Alert
            </div>
            <div className="card-body">
              {loading ? (
                <div className="text-muted">Loading...</div>
              ) : lowStockRows.length === 0 ? (
                <div className="text-muted">No low stock items right now.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Item</th>
                        <th>Location</th>
                        <th>Qty</th>
                        <th>Min</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowStockRows.slice(0, 8).map((row, idx) => (
                        <tr key={row.id || idx}>
                          <td>{inventoryUtils.getItemName(row)}</td>
                          <td>{inventoryUtils.getLocationName(row)}</td>
                          <td>{inventoryUtils.getQty(row)}</td>
                          <td>{inventoryUtils.getMinStock(row)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card shadow-sm border-0 rounded-4 h-100">
            <div className="card-header bg-white border-0 fw-semibold">
              Recent Transactions
            </div>
            <div className="card-body">
              {loading ? (
                <div className="text-muted">Loading...</div>
              ) : recentTransactions.length === 0 ? (
                <div className="text-muted">No transactions found.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Item</th>
                        <th>Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTransactions.map((row, idx) => (
                        <tr key={row.id || idx}>
                          <td>{inventoryUtils.formatDate(inventoryUtils.getDate(row))}</td>
                          <td>{statusBadge(inventoryUtils.getTransactionType(row))}</td>
                          <td>{inventoryUtils.getItemName(row)}</td>
                          <td>{inventoryUtils.getQty(row)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card shadow-sm border-0 rounded-4 h-100">
            <div className="card-header bg-white border-0 fw-semibold">
              Latest Received Stock
            </div>
            <div className="card-body">
              {loading ? (
                <div className="text-muted">Loading...</div>
              ) : recentReceived.length === 0 ? (
                <div className="text-muted">No receive entries found.</div>
              ) : (
                <ul className="list-group list-group-flush">
                  {recentReceived.map((row, idx) => (
                    <li
                      className="list-group-item px-0 d-flex justify-content-between align-items-center"
                      key={row.id || idx}
                    >
                      <div>
                        <div className="fw-semibold">{inventoryUtils.getItemName(row)}</div>
                        <div className="small text-muted">
                          {inventoryUtils.formatDate(inventoryUtils.getDate(row))}
                        </div>
                      </div>
                      <span className="badge bg-success">
                        {inventoryUtils.getQty(row)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card shadow-sm border-0 rounded-4 h-100">
            <div className="card-header bg-white border-0 fw-semibold">
              Latest Issued Stock
            </div>
            <div className="card-body">
              {loading ? (
                <div className="text-muted">Loading...</div>
              ) : recentIssued.length === 0 ? (
                <div className="text-muted">No issue entries found.</div>
              ) : (
                <ul className="list-group list-group-flush">
                  {recentIssued.map((row, idx) => (
                    <li
                      className="list-group-item px-0 d-flex justify-content-between align-items-center"
                      key={row.id || idx}
                    >
                      <div>
                        <div className="fw-semibold">{inventoryUtils.getItemName(row)}</div>
                        <div className="small text-muted">
                          {inventoryUtils.formatDate(inventoryUtils.getDate(row))}
                        </div>
                      </div>
                      <span className="badge bg-primary">
                        {inventoryUtils.getQty(row)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}