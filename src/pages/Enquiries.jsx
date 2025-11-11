// src/pages/Enquiries.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";

// ---- role helpers ---------------------------------------------------------
const getRoleFlags = () => {
  const singleRole = localStorage.getItem("userRole");
  const multiRoles = JSON.parse(localStorage.getItem("roles") || "[]");
  const roles = multiRoles.length ? multiRoles : [singleRole].filter(Boolean);
  return {
    roles,
    isAdmin: roles.includes("admin"),
    isSuperadmin: roles.includes("superadmin"),
  };
};

const Enquiries = () => {
  const { isAdmin, isSuperadmin } = useMemo(getRoleFlags, []);
  const canDelete = isSuperadmin; // only superadmin deletes
  const canView = isAdmin || isSuperadmin; // adjust if you want

  const [enquiries, setEnquiries] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null); // for view modal
  const [loading, setLoading] = useState(false);

  // fetch all enquiries
  const fetchEnquiries = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/enquiries");
      setEnquiries(data);
    } catch (error) {
      console.error("Error fetching enquiries:", error);
      Swal.fire("Error", "Failed to fetch enquiries.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnquiries();
  }, []);

  // delete
  const deleteEnquiry = async (id) => {
    if (!canDelete) {
      return Swal.fire("Forbidden", "Only Super Admin can delete.", "warning");
    }
    Swal.fire({
      title: "Delete this enquiry?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.delete(`/enquiries/${id}`);
          Swal.fire("Deleted!", "Enquiry has been deleted.", "success");
          fetchEnquiries();
        } catch (error) {
          console.error("Error deleting enquiry:", error);
          Swal.fire("Error", "Failed to delete enquiry.", "error");
        }
      }
    });
  };

  // filter by search (name / phone / class / email)
  const filtered = search
    ? enquiries.filter((e) => {
        const q = search.toLowerCase();
        return (
          (e.student_name && e.student_name.toLowerCase().includes(q)) ||
          (e.phone && e.phone.toLowerCase().includes(q)) ||
          (e.class_interested &&
            e.class_interested.toLowerCase().includes(q)) ||
          (e.email && e.email.toLowerCase().includes(q))
        );
      })
    : enquiries;

  // small helper to format date
  const formatDate = (val) => {
    if (!val) return "-";
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return val;
    return d.toLocaleDateString();
  };

  return (
    <div className="container mt-4">
      <h1>Admission Enquiries</h1>

      {/* search */}
      <div className="mb-3 d-flex gap-2">
        <input
          type="text"
          className="form-control w-50"
          placeholder="Search by student, phone, email, class..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn btn-outline-secondary" onClick={fetchEnquiries}>
          Refresh
        </button>
      </div>

      {/* table */}
      <table className="table table-striped table-hover">
        <thead>
          <tr>
            <th>#</th>
            <th>Student</th>
            <th>Class</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Enquiry Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {!loading &&
            filtered.map((enq, index) => (
              <tr key={enq.id}>
                <td>{index + 1}</td>
                <td>{enq.student_name || "-"}</td>
                <td>{enq.class_interested || "-"}</td>
                <td>{enq.phone || "-"}</td>
                <td>{enq.email || "-"}</td>
                <td>{formatDate(enq.enquiry_date || enq.createdAt)}</td>
                <td>
                  <button
                    className="btn btn-sm btn-primary me-2"
                    onClick={() => setSelected(enq)}
                  >
                    View
                  </button>
                  {canDelete && (
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => deleteEnquiry(enq.id)}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          {!loading && filtered.length === 0 && (
            <tr>
              <td colSpan="7" className="text-center">
                No enquiries found
              </td>
            </tr>
          )}
          {loading && (
            <tr>
              <td colSpan="7" className="text-center">
                Loading...
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* view modal */}
      {selected && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Enquiry - {selected.student_name}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelected(null)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="row mb-3">
                  <div className="col-md-6">
                    <strong>Student Name:</strong> {selected.student_name || "-"}
                  </div>
                  <div className="col-md-6">
                    <strong>Class Interested:</strong>{" "}
                    {selected.class_interested || "-"}
                  </div>
                </div>

                <div className="row mb-3">
                  <div className="col-md-6">
                    <strong>Father's Name:</strong>{" "}
                    {selected.father_name || "-"}
                  </div>
                  <div className="col-md-6">
                    <strong>Mother's Name:</strong>{" "}
                    {selected.mother_name || "-"}
                  </div>
                </div>

                <div className="row mb-3">
                  <div className="col-md-6">
                    <strong>Phone:</strong> {selected.phone || "-"}
                  </div>
                  <div className="col-md-6">
                    <strong>Email:</strong> {selected.email || "-"}
                  </div>
                </div>

                <div className="row mb-3">
                  <div className="col-md-6">
                    <strong>DOB:</strong> {formatDate(selected.dob)}
                  </div>
                  <div className="col-md-6">
                    <strong>Gender:</strong> {selected.gender || "-"}
                  </div>
                </div>

                <div className="mb-3">
                  <strong>Address:</strong>
                  <div>{selected.address || "-"}</div>
                </div>

                <div className="mb-3">
                  <strong>Previous School:</strong>{" "}
                  {selected.previous_school || "-"}
                </div>

                <div className="mb-3">
                  <strong>Remarks:</strong>
                  <div>{selected.remarks || "-"}</div>
                </div>

                <div className="mb-3">
                  <strong>Submitted On:</strong>{" "}
                  {formatDate(selected.enquiry_date || selected.createdAt)}
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setSelected(null)}
                >
                  Close
                </button>
                {canDelete && (
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      const id = selected.id;
                      setSelected(null);
                      deleteEnquiry(id);
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Enquiries;
