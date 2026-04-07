import React from "react";
import {
  InventoryDashboard,
  InventoryCategories,
  InventoryItems,
  InventoryLocations,
  InventoryOpeningStock,
  InventoryReceiveStock,
  InventoryIssueStock,
  InventoryTransferStock,
  InventoryAdjustStock,
  InventoryTransactions,
  InventoryStockReport,
} from "../pages/inventory";

const inventoryRoutes = [
  { path: "/inventory", element: <InventoryDashboard /> },
  { path: "/inventory/categories", element: <InventoryCategories /> },
  { path: "/inventory/items", element: <InventoryItems /> },
  { path: "/inventory/locations", element: <InventoryLocations /> },
  { path: "/inventory/opening-stock", element: <InventoryOpeningStock /> },
  { path: "/inventory/receive-stock", element: <InventoryReceiveStock /> },
  { path: "/inventory/issue-stock", element: <InventoryIssueStock /> },
  { path: "/inventory/transfer-stock", element: <InventoryTransferStock /> },
  { path: "/inventory/adjust-stock", element: <InventoryAdjustStock /> },
  { path: "/inventory/transactions", element: <InventoryTransactions /> },
  { path: "/inventory/stock-report", element: <InventoryStockReport /> },
];

export default inventoryRoutes;
