import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import InventoryPageHeader from "../../components/inventory/InventoryPageHeader";
import InventoryTransactionForm from "../../components/inventory/InventoryTransactionForm";
import { inventoryApi } from "../../services/inventoryApi";

const getEmptyForm = () => ({
  itemId: "",
  locationId: "",
  quantity: "",
  unitCost: "",
  supplierName: "",
  referenceNo: "",
  txnDate: new Date().toISOString().split("T")[0],
  remarks: "",
});

export default function InventoryReceiveStock() {
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formValues, setFormValues] = useState(getEmptyForm());

  const loadMasters = async () => {
    setLoading(true);
    try {
      const [itemRows, locationRows] = await Promise.all([
        inventoryApi.getItems(),
        inventoryApi.getLocations(),
      ]);
      setItems(itemRows || []);
      setLocations(locationRows || []);
    } catch (err) {
      Swal.fire(
        "Error",
        err?.response?.data?.message || err?.message || "Failed to load master data",
        "error"
      );
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
      value: String(row?.id),
    }));
  }, [items]);

  const locationOptions = useMemo(() => {
    return locations.map((row) => ({
      label: row?.name || row?.location_name || `Location #${row?.id}`,
      value: String(row?.id),
    }));
  }, [locations]);

  const buildReceivePayload = (form) => {
    return {
      item_id: Number(form.itemId),
      to_location_id: Number(form.locationId),
      quantity: Number(form.quantity),
      unit_cost: form.unitCost !== "" ? Number(form.unitCost) : null,
      supplier_name: form.supplierName?.trim() || null,
      reference_no: form.referenceNo?.trim() || null,
      txn_date: form.txnDate || null,
      remarks: form.remarks?.trim() || null,
    };
  };

  const handleSubmit = async (form) => {
    try {
      const payload = buildReceivePayload(form);

      if (!payload.item_id || !payload.to_location_id || !payload.quantity) {
        Swal.fire("Error", "Item, location and quantity are required", "error");
        return;
      }

      setSaving(true);
      await inventoryApi.receiveStock(payload);

      Swal.fire("Success", "Stock received successfully", "success");
      setFormValues(getEmptyForm());
    } catch (err) {
      Swal.fire(
        "Error",
        err?.response?.data?.message || err?.message || "Operation failed",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    {
      name: "itemId",
      label: "Item",
      type: "select",
      required: true,
      optionsSource: "items",
    },
    {
      name: "locationId",
      label: "Receive To Location",
      type: "select",
      required: true,
      optionsSource: "locations",
    },
    {
      name: "quantity",
      label: "Received Quantity",
      type: "number",
      required: true,
      min: "0",
      step: "1",
    },
    {
      name: "unitCost",
      label: "Unit Cost",
      type: "number",
      min: "0",
      step: "0.01",
    },
    {
      name: "supplierName",
      label: "Supplier Name",
      placeholder: "Optional supplier",
    },
    {
      name: "referenceNo",
      label: "Reference No",
      placeholder: "GRN / Invoice / Bill No",
    },
    {
      name: "txnDate",
      label: "Date",
      type: "date",
      required: true,
    },
    {
      name: "remarks",
      label: "Remarks",
      type: "textarea",
      colClass: "col-md-12",
      placeholder: "Optional notes",
    },
  ].map((field) => {
    if (field.optionsSource === "items") {
      return { ...field, options: itemOptions };
    }
    if (field.optionsSource === "locations") {
      return { ...field, options: locationOptions };
    }
    return field;
  });

  return (
    <div className="container-fluid px-3 py-3">
      <InventoryPageHeader
        title="Receive Stock"
        subtitle="Receive stock into the selected location"
        actions={
          <button className="btn btn-light rounded-4" onClick={loadMasters}>
            Refresh Masters
          </button>
        }
      />

      {loading ? (
        <div className="alert alert-light border">
          Loading items and locations...
        </div>
      ) : null}

      {!loading ? (
        <>
          <div className="alert alert-info">
            Connected to <strong>POST /api/inventory/transactions/receive</strong>
          </div>

          <InventoryTransactionForm
            title="Receive Stock"
            subtitle="Enter purchase / receive details and inward quantity"
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