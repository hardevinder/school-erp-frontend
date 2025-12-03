// src/pages/EnquiryForm.jsx
import React, { useState } from "react";
import Swal from "sweetalert2";
import api from "../api"; // ✅ shared API instance (dynamic baseURL)

export default function EnquiryForm() {
  const [formData, setFormData] = useState({
    student_name: "",
    father_name: "",
    mother_name: "",
    phone: "",
    email: "",
    address: "",
    class_interested: "",
    dob: "",
    gender: "",
    previous_school: "",
    remarks: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;

    // ✅ Same phone handling as Smarto form
    if (name === "phone") {
      const digitsOnly = value.replace(/\D/g, ""); // remove spaces, +, etc.
      setFormData((prev) => ({ ...prev, phone: digitsOnly }));

      if (!digitsOnly) {
        setPhoneError("Phone number is required.");
      } else if (digitsOnly.length !== 10) {
        setPhoneError("Please enter a valid 10-digit Indian mobile number.");
      } else {
        setPhoneError("");
      }
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ✅ Final phone validation before submit
    const digitsOnly = (formData.phone || "").replace(/\D/g, "");
    if (!digitsOnly) {
      setPhoneError("Phone number is required.");
      Swal.fire(
        "Invalid Phone",
        "Please enter your 10-digit mobile number (without +91).",
        "error"
      );
      return;
    }
    if (digitsOnly.length !== 10) {
      setPhoneError("Please enter a valid 10-digit Indian mobile number.");
      Swal.fire(
        "Invalid Phone",
        "Phone number must be exactly 10 digits. Example: 9876543210",
        "error"
      );
      return;
    }

    setPhoneError("");
    setIsSubmitting(true);

    // ✅ Save as +91XXXXXXXXXX
    const payload = {
      ...formData,
      phone: `+91${digitsOnly}`,
    };

    try {
      await api.post("/enquiries", payload);

      Swal.fire(
        "Thank You!",
        "Your admission enquiry has been submitted successfully.",
        "success"
      );

      setFormData({
        student_name: "",
        father_name: "",
        mother_name: "",
        phone: "",
        email: "",
        address: "",
        class_interested: "",
        dob: "",
        gender: "",
        previous_school: "",
        remarks: "",
      });
    } catch (error) {
      console.error("Error submitting enquiry:", error);

      let message = "Something went wrong. Please try again.";

      if (error.response) {
        const { status, data } = error.response;

        if (status === 400 || status === 422) {
          message =
            data?.message ||
            "Some form fields seem invalid. Please check the details and try again.";
        } else if (status >= 500) {
          message =
            "Server error while saving your enquiry. Please try again after some time.";
        } else if (data?.message) {
          message = data.message;
        }
      } else if (error.request) {
        message =
          "Unable to reach the server. Please check your internet connection and try again.";
      }

      Swal.fire("Error", message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-vh-100 d-flex align-items-center justify-content-center position-relative"
      style={{
        backgroundImage: "url(/images/SchooBackground.jpeg)",
        backgroundSize: "cover",
        backgroundPosition: "center center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Overlay */}
      <div
        className="position-absolute top-0 start-0 w-100 h-100"
        style={{
          background: "rgba(0, 0, 0, 0.55)",
          backdropFilter: "blur(3px)",
        }}
      ></div>

      <div className="container position-relative py-5">
        <div className="row justify-content-center">
          <div className="col-lg-8 col-xl-7">
            {/* Header */}
            <div className="text-center mb-4 text-white">
              <img
                src="/images/pts_logo.png"
                alt="PathSeeker Logo"
                className="mb-3"
                style={{
                  width: "90px",
                  height: "90px",
                  objectFit: "contain",
                  borderRadius: "50%",
                  backgroundColor: "rgba(255,255,255,0.15)",
                  padding: "5px",
                }}
              />
              <h2 className="fw-bold mb-1">PathSeeker International School</h2>
              <p className="mb-0 text-white fw-semibold">
                RAMGARH/VIJAYPUR, DISTRICT SAMBA (JKUT) INDIA.
              </p>
              <p className="mb-0">
                Admission Enquiry Form (Pre-Nursery to 9th Grade)
              </p>
            </div>

            {/* Form Card */}
            <div
              className="card border-0 shadow-lg"
              style={{
                borderRadius: "1rem",
                background: "rgba(20, 20, 20, 0.75)",
                color: "#f1f1f1",
                boxShadow: "0 0 25px rgba(0,0,0,0.3)",
              }}
            >
              <div className="card-body p-4 p-md-5">
                <form onSubmit={handleSubmit}>
                  {/* Option color fix */}
                  <style>{`
                    select option {
                      color: black;
                      background-color: white;
                    }
                  `}</style>

                  {/* Student details */}
                  <h5 className="fw-semibold mb-3 text-info">Student Details</h5>
                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <label className="form-label text-light">
                        Student Name <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        name="student_name"
                        className="form-control bg-transparent text-white border-secondary"
                        value={formData.student_name}
                        onChange={handleChange}
                        required
                        placeholder="Enter student name"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-light">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        name="dob"
                        className="form-control bg-transparent text-white border-secondary"
                        value={formData.dob}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  {/* Parents */}
                  <h5 className="fw-semibold mb-3 text-info">
                    Parent / Guardian
                  </h5>
                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <label className="form-label text-light">
                        Father's Name
                      </label>
                      <input
                        type="text"
                        name="father_name"
                        className="form-control bg-transparent text-white border-secondary"
                        value={formData.father_name}
                        onChange={handleChange}
                        placeholder="Enter father's name"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-light">
                        Mother's Name
                      </label>
                      <input
                        type="text"
                        name="mother_name"
                        className="form-control bg-transparent text-white border-secondary"
                        value={formData.mother_name}
                        onChange={handleChange}
                        placeholder="Enter mother's name"
                      />
                    </div>
                  </div>

                  {/* Contact & Class */}
                  <h5 className="fw-semibold mb-3 text-info">
                    Contact & Class
                  </h5>
                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <label className="form-label text-light">
                        Phone Number <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text bg-dark text-white border-secondary">
                          +91
                        </span>
                        <input
                          type="tel"
                          name="phone"
                          className="form-control bg-transparent text-white border-secondary"
                          value={formData.phone}
                          onChange={handleChange}
                          required
                          maxLength={10}
                          placeholder="10-digit mobile number"
                        />
                      </div>
                      <small className="text-muted d-block mt-1">
                        Please enter a 10-digit Indian mobile number (without
                        +91). We will save it as +91XXXXXXXXXX.
                      </small>
                      {phoneError && (
                        <div className="text-danger small mt-1">
                          {phoneError}
                        </div>
                      )}
                    </div>

                    <div className="col-md-6">
                      <label className="form-label text-light">Email</label>
                      <input
                        type="email"
                        name="email"
                        className="form-control bg-transparent text-white border-secondary"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="name@example.com"
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label text-light">
                        Class Interested <span className="text-danger">*</span>
                      </label>
                      <select
                        name="class_interested"
                        className="form-select bg-transparent text-white border-secondary"
                        value={formData.class_interested}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Select class</option>
                        {[
                          "Pre-Nursery",
                          "Nursery",
                          "LKG",
                          "UKG",
                          "1st",
                          "2nd",
                          "3rd",
                          "4th",
                          "5th",
                          "6th",
                          "7th",
                          "8th",
                          "9th",
                        ].map((cls) => (
                          <option key={cls}>{cls}</option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label text-light">Gender</label>
                      <select
                        name="gender"
                        className="form-select bg-transparent text-white border-secondary"
                        value={formData.gender}
                        onChange={handleChange}
                      >
                        <option value="">Select gender</option>
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>

                  {/* Additional Info */}
                  <h5 className="fw-semibold mb-3 text-info">
                    Additional Info
                  </h5>
                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <label className="form-label text-light">
                        Previous School (if any)
                      </label>
                      <input
                        type="text"
                        name="previous_school"
                        className="form-control bg-transparent text-white border-secondary"
                        value={formData.previous_school}
                        onChange={handleChange}
                        placeholder="Enter previous school"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-light">Address</label>
                      <textarea
                        name="address"
                        rows={2}
                        className="form-control bg-transparent text-white border-secondary"
                        value={formData.address}
                        onChange={handleChange}
                        placeholder="Enter address"
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label text-light">Remarks</label>
                      <textarea
                        name="remarks"
                        rows={2}
                        className="form-control bg-transparent text-white border-secondary"
                        value={formData.remarks}
                        onChange={handleChange}
                        placeholder="Any special requirements"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-info w-100 py-2 fw-semibold text-white"
                    disabled={isSubmitting}
                    style={{
                      transition: "background-color 0.3s, transform 0.2s",
                    }}
                  >
                    {isSubmitting ? "Submitting..." : "Submit Enquiry"}
                  </button>
                </form>
              </div>
            </div>

            {/* Footer */}
            <p
              className="text-center text-white-50 mt-3 mb-0"
              style={{ fontSize: "0.8rem" }}
            >
              © {new Date().getFullYear()} PathSeeker International School
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
