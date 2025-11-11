// src/pages/EnquiryForm.jsx
import React, { useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";

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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await axios.post("/enquiries", formData);
      Swal.fire("Success", "We’ve received your enquiry.", "success");
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
      Swal.fire("Error", "Something went wrong. Please try again.", "error");
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
                  <h5 className="fw-semibold mb-3 text-info">Parent / Guardian</h5>
                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <label className="form-label text-light">Father's Name</label>
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
                      <label className="form-label text-light">Mother's Name</label>
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
                  <h5 className="fw-semibold mb-3 text-info">Contact & Class</h5>
                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <label className="form-label text-light">
                        Phone Number <span className="text-danger">*</span>
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        className="form-control bg-transparent text-white border-secondary"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                        placeholder="e.g. 9876543210"
                      />
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
                  <h5 className="fw-semibold mb-3 text-info">Additional Info</h5>
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
                        rows="2"
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
                        rows="2"
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
