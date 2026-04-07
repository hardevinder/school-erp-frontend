import api from "../api";

const BASE = "/api/inventory";

const pickArray = (payload, keys = []) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  for (const value of Object.values(payload)) {
    if (Array.isArray(value)) return value;
  }
  return [];
};

const pickObject = (payload, keys = []) => {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    for (const key of keys) {
      if (payload[key] && typeof payload[key] === "object") return payload[key];
    }
    return payload;
  }
  return {};
};

const request = async (method, url, options = {}) => {
  const { data, params } = options;
  const response = await api({
    method,
    url,
    data,
    params,
  });
  return response?.data;
};

export const inventoryApi = {
  // Categories
  async getCategories(params) {
    const data = await request("get", `${BASE}/categories`, { params });
    return pickArray(data, ["data", "categories", "rows", "items"]);
  },

  async getCategoryById(id) {
    const data = await request("get", `${BASE}/categories/${id}`);
    return pickObject(data, ["data", "category"]);
  },

  async createCategory(payload) {
    return request("post", `${BASE}/categories`, { data: payload });
  },

  async updateCategory(id, payload) {
    return request("put", `${BASE}/categories/${id}`, { data: payload });
  },

  async deleteCategory(id) {
    return request("delete", `${BASE}/categories/${id}`);
  },

  // Items
  async getItems(params) {
    const data = await request("get", `${BASE}/items`, { params });
    return pickArray(data, ["data", "items", "rows"]);
  },

  async getItemById(id) {
    const data = await request("get", `${BASE}/items/${id}`);
    return pickObject(data, ["data", "item"]);
  },

  async createItem(payload) {
    return request("post", `${BASE}/items`, { data: payload });
  },

  async updateItem(id, payload) {
    return request("put", `${BASE}/items/${id}`, { data: payload });
  },

  async deleteItem(id) {
    return request("delete", `${BASE}/items/${id}`);
  },

  // Locations
  async getLocations(params) {
    const data = await request("get", `${BASE}/locations`, { params });
    return pickArray(data, ["data", "locations", "rows"]);
  },

  async getLocationById(id) {
    const data = await request("get", `${BASE}/locations/${id}`);
    return pickObject(data, ["data", "location"]);
  },

  async createLocation(payload) {
    return request("post", `${BASE}/locations`, { data: payload });
  },

  async updateLocation(id, payload) {
    return request("put", `${BASE}/locations/${id}`, { data: payload });
  },

  async deleteLocation(id) {
    return request("delete", `${BASE}/locations/${id}`);
  },

  // Transactions
  async getTransactions(params) {
    const data = await request("get", `${BASE}/transactions`, { params });
    return pickArray(data, ["data", "transactions", "rows"]);
  },

  async getTransactionById(id) {
    const data = await request("get", `${BASE}/transactions/${id}`);
    return pickObject(data, ["data", "transaction"]);
  },

  async addOpeningStock(payload) {
    return request("post", `${BASE}/transactions/opening`, { data: payload });
  },

  async receiveStock(payload) {
    return request("post", `${BASE}/transactions/receive`, { data: payload });
  },

  async issueStock(payload) {
    return request("post", `${BASE}/transactions/issue`, { data: payload });
  },

  async transferStock(payload) {
    return request("post", `${BASE}/transactions/transfer`, { data: payload });
  },

  async adjustStock(payload) {
    return request("post", `${BASE}/transactions/adjust`, { data: payload });
  },

  async cancelTransaction(id) {
    return request("patch", `${BASE}/transactions/${id}/cancel`);
  },

  // Stock report
  async getStockReport(params) {
    const data = await request("get", `${BASE}/stock-report`, { params });
    return pickArray(data, ["data", "rows", "report", "stock", "stockReport"]);
  },
};

export const inventoryUtils = {
  normalizeId(row) {
    return (
      row?.id ??
      row?._id ??
      row?.inventory_id ??
      row?.item_id ??
      row?.category_id ??
      row?.location_id
    );
  },

  getName(row, fallbacks = []) {
    const candidates = [
      "name",
      "title",
      "label",
      "category_name",
      "item_name",
      "location_name",
      ...fallbacks,
    ];

    for (const key of candidates) {
      if (row?.[key] !== undefined && row?.[key] !== null && String(row[key]).trim() !== "") {
        return row[key];
      }
    }
    return "—";
  },

  getCode(row) {
    return row?.code || row?.item_code || row?.sku || row?.short_code || "—";
  },

  getCategoryName(item) {
    return (
      item?.category?.name ||
      item?.categoryName ||
      item?.category_name ||
      item?.category ||
      "—"
    );
  },

  getItemName(item) {
    return (
      item?.item?.name ||
      item?.item?.item_name ||
      item?.name ||
      item?.item_name ||
      item?.itemName ||
      item?.product_name ||
      item?.title ||
      (item?.item_id ? `Item #${item.item_id}` : "—")
    );
  },

  getLocationName(item) {
    return (
      item?.location?.name ||
      item?.locationName ||
      item?.location_name ||
      item?.location ||
      item?.fromLocation?.name ||
      item?.toLocation?.name ||
      "—"
    );
  },

  getFromLocationName(item) {
    return (
      item?.fromLocation?.name ||
      item?.from_location?.name ||
      item?.from_location_name ||
      item?.source_location_name ||
      item?.sourceLocationName ||
      (item?.from_location_id ? `Location #${item.from_location_id}` : "—")
    );
  },

  getToLocationName(item) {
    return (
      item?.toLocation?.name ||
      item?.to_location?.name ||
      item?.to_location_name ||
      item?.destination_location_name ||
      item?.destinationLocationName ||
      (item?.to_location_id ? `Location #${item.to_location_id}` : "—")
    );
  },

  getQty(row, keys = ["quantity", "qty", "availableQty", "available_qty", "stock", "current_stock"]) {
    for (const key of keys) {
      const val = row?.[key];
      if (val !== undefined && val !== null && val !== "") return Number(val) || 0;
    }
    return 0;
  },

  getDate(row, keys = ["date", "txnDate", "txn_date", "transaction_date", "createdAt", "updatedAt"]) {
    for (const key of keys) {
      const val = row?.[key];
      if (val) return val;
    }
    return "";
  },

  formatDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toISOString().split("T")[0];
  },

  formatDateTime(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return `${d.toISOString().split("T")[0]} ${d.toTimeString().slice(0, 5)}`;
  },

  getTransactionType(row) {
    return row?.type || row?.transaction_type || row?.txnType || row?.transactionType || "—";
  },

  getReferenceNo(row) {
    return row?.referenceNo || row?.reference_no || row?.voucherNo || row?.voucher_no || "—";
  },

  getUserName(row) {
    return row?.user?.name || row?.createdBy?.name || row?.creator?.name || row?.created_by || "—";
  },

  getMinStock(row) {
    return Number(row?.minStock ?? row?.min_stock ?? row?.reorder_level ?? 0) || 0;
  },
};