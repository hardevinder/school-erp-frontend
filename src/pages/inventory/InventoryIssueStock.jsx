import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import InventoryPageHeader from "../../components/inventory/InventoryPageHeader";
import InventoryTransactionForm from "../../components/inventory/InventoryTransactionForm";
import { inventoryApi } from "../../services/inventoryApi";

const getEmptyForm = () => ({
  itemId: "",
  locationId: "",
  quantity: "",
  issuedTo: "",
  referenceNo: "",
  txnDate: new Date().toISOString().split("T")[0],
  remarks: "",
});

export default function InventoryIssueStock() {
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formValues, setFormValues] = useState(getEmptyForm());

  const loadMasters = async () => {
    setLoading(true);
    try {
      const [itemRows, locationRows, userRows] = await Promise.all([
        inventoryApi.getItems(),
        inventoryApi.getLocations(),
        inventoryApi.getEligibleIssueUsers(),
      ]);
      setItems(itemRows || []);
      setLocations(locationRows || []);
      setUsers(userRows || []);
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

  const userOptions = useMemo(() => users.map((user) => ({
    value: String(user.id),
    label: `${user.name || user.username} (${(user.roles || []).join(", ")})`,
  })), [users]);

  const buildIssuePayload = (form) => {
    return {
      item_id: Number(form.itemId),
      from_location_id: Number(form.locationId),
      quantity: Number(form.quantity),
      issued_to_user_id: Number(form.issuedTo) || null,
      reference_no: form.referenceNo?.trim() || null,
      transaction_date: form.txnDate || null,
      remarks: form.remarks?.trim() || null,
    };
  };

  const handleSubmit = async (form) => {
    try {
      const payload = buildIssuePayload(form);

      if (!payload.item_id || !payload.from_location_id || !payload.issued_to_user_id || !payload.quantity) {
        Swal.fire("Error", "Item, location, issued-to user and quantity are required", "error");
        return;
      }

      setSaving(true);
      await inventoryApi.issueStock(payload);

      Swal.fire("Success", "Stock issued successfully", "success");
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
      label: "Issue From Location",
      type: "select",
      required: true,
      optionsSource: "locations",
    },
    {
      name: "quantity",
      label: "Issue Quantity",
      type: "number",
      required: true,
      min: "0",
      step: "1",
    },
    {
      name: "issuedTo",
      label: "Issued To User",
      type: "select",
      required: true,
      options: userOptions,
    },
    {
      name: "referenceNo",
      label: "Reference No",
      placeholder: "ISS-001",
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
        title="Issue Stock"
        subtitle="Issue items from the selected location"
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
            Connected to <strong>POST /api/inventory/transactions/issue</strong>
          </div>

          <InventoryTransactionForm
            title="Issue Stock"
            subtitle="Issue to an eligible user; Student and Driver roles are excluded"
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
