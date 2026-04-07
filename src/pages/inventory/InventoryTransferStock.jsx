import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import InventoryPageHeader from "../../components/inventory/InventoryPageHeader";
import InventoryTransactionForm from "../../components/inventory/InventoryTransactionForm";
import { inventoryApi } from "../../services/inventoryApi";

const getEmptyForm = () => ({
  itemId: "",
  fromLocationId: "",
  toLocationId: "",
  quantity: "",
  referenceNo: "",
  txnDate: new Date().toISOString().split("T")[0],
  remarks: "",
});

export default function InventoryTransferStock() {
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

  const buildTransferPayload = (form) => {
    return {
      item_id: Number(form.itemId),
      from_location_id: Number(form.fromLocationId),
      to_location_id: Number(form.toLocationId),
      quantity: Number(form.quantity),
      reference_no: form.referenceNo?.trim() || null,
      txn_date: form.txnDate || null,
      remarks: form.remarks?.trim() || null,
    };
  };

  const handleSubmit = async (form) => {
    try {
      const payload = buildTransferPayload(form);

      if (
        !payload.item_id ||
        !payload.from_location_id ||
        !payload.to_location_id ||
        !payload.quantity
      ) {
        Swal.fire(
          "Error",
          "Item, from location, to location and quantity are required",
          "error"
        );
        return;
      }

      if (payload.from_location_id === payload.to_location_id) {
        Swal.fire(
          "Error",
          "From location and To location cannot be the same",
          "error"
        );
        return;
      }

      setSaving(true);
      await inventoryApi.transferStock(payload);

      Swal.fire("Success", "Stock transferred successfully", "success");
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
      name: "fromLocationId",
      label: "From Location",
      type: "select",
      required: true,
      optionsSource: "locations",
    },
    {
      name: "toLocationId",
      label: "To Location",
      type: "select",
      required: true,
      optionsSource: "locations",
    },
    {
      name: "quantity",
      label: "Transfer Quantity",
      type: "number",
      required: true,
      min: "0",
      step: "1",
    },
    {
      name: "referenceNo",
      label: "Reference No",
      placeholder: "TRN-001",
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
        title="Transfer Stock"
        subtitle="Transfer inventory between two locations"
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
            Connected to <strong>POST /api/inventory/transactions/transfer</strong>
          </div>

          <InventoryTransactionForm
            title="Transfer Stock"
            subtitle="Move stock from one room/store/lab to another"
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