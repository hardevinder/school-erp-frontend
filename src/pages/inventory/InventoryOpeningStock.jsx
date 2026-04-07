import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import InventoryPageHeader from "../../components/inventory/InventoryPageHeader";
import InventoryTransactionForm from "../../components/inventory/InventoryTransactionForm";
import { inventoryApi } from "../../services/inventoryApi";

const emptyForm = {
  itemId: "",
  locationId: "",
  quantity: "",
  unitCost: "",
  referenceNo: "",
  txnDate: new Date().toISOString().split("T")[0],
  remarks: "",
};

export default function InventoryOpeningStock() {
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formValues, setFormValues] = useState(emptyForm);

  const loadMasters = async () => {
    setLoading(true);
    try {
      const [itemRows, locationRows] = await Promise.all([
        inventoryApi.getItems(),
        inventoryApi.getLocations(),
      ]);
      setItems(itemRows);
      setLocations(locationRows);
    } catch (err) {
      Swal.fire("Error", err?.response?.data?.message || err?.message || "Failed to load master data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMasters();
  }, []);

  const itemOptions = useMemo(() => {
    return items.map((row) => ({
      label: row?.name || row?.item_name || `Item #${row?.id}`,
      value: row?.id,
    }));
  }, [items]);

  const locationOptions = useMemo(() => {
    return locations.map((row) => ({
      label: row?.name || row?.location_name || `Location #${row?.id}`,
      value: row?.id,
    }));
  }, [locations]);

  const handleSubmit = async (form) => {
    setSaving(true);
    try {
      await inventoryApi.addOpeningStock(form);
      Swal.fire("Success", "Opening stock added successfully", "success");
      setFormValues({ ...emptyForm });
    } catch (err) {
      Swal.fire("Error", err?.response?.data?.message || err?.message || "Operation failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const fields = [
  { name: "itemId", label: "Item", type: "select", required: true, optionsSource: "items" },
  { name: "locationId", label: "Location", type: "select", required: true, optionsSource: "locations" },
  { name: "quantity", label: "Opening Quantity", type: "number", required: true, min: "0", step: "1" },
  { name: "unitCost", label: "Unit Cost", type: "number", min: "0", step: "0.01" },
  { name: "referenceNo", label: "Reference No", placeholder: "OPEN-001" },
  { name: "txnDate", label: "Date", type: "date", required: true },
  { name: "remarks", label: "Remarks", type: "textarea", colClass: "col-md-12", placeholder: "Optional notes" },
].map((field) => {
    if (field.optionsSource === "items") return { ...field, options: itemOptions };
    if (field.optionsSource === "locations") return { ...field, options: locationOptions };
    return field;
  });

  return (
    <div className="container-fluid px-3 py-3">
      <InventoryPageHeader
        title="Opening Stock"
        subtitle="Create initial stock balances before regular movement starts"
        actions={
          <button className="btn btn-light rounded-4" onClick={loadMasters}>
            Refresh Masters
          </button>
        }
      />

      {loading ? <div className="alert alert-light border">Loading items and locations...</div> : null}

      {!loading ? (
        <>
          <div className="alert alert-info">
            Connected to <strong>POST /api/inventory/transactions/opening</strong>. Payload fields are flexible, but you may need
            small key-name adjustments based on your controller.
          </div>

          <InventoryTransactionForm
            title="Opening Stock"
            subtitle="Enter item, location and opening quantity details"
            initialValues={formValues}
            fields={fields}
            saving={saving}
            onSubmit={handleSubmit}
          />
        </>
      ) : null}
    </div>
  );
}
