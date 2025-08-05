import React, { useState, useEffect } from "react";
import api from "../api";
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

const StudentFeeSummary = () => {
  const [studentDetails, setStudentDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch fee details for the student using the username from localStorage.
  useEffect(() => {
    const username = localStorage.getItem("username");
    if (username) {
      api.get(`/StudentsApp/admission/${username}/fees`)
        .then((response) => {
          setStudentDetails(response.data);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching fee details:", err);
          setError("Failed to load fee details.");
          setLoading(false);
        });
    }
  }, []);

  // Helper function for formatting currency.
  const formatSummaryMoney = (value) => {
    if (isNaN(value)) return value;
    return "Rs. " + Number(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Compute totals from feeDetails.
  let totalDue = 0;
  let totalReceived = 0;
  let totalConcession = 0;
  if (
    studentDetails &&
    studentDetails.feeDetails &&
    studentDetails.feeDetails.length > 0
  ) {
    studentDetails.feeDetails.forEach((fee) => {
      totalDue += parseFloat(fee.finalAmountDue) || 0;
      totalReceived += parseFloat(fee.totalFeeReceived) || 0;
      totalConcession += parseFloat(fee.totalConcessionReceived) || 0;
    });
  }

  // Prepare data for the Pie Chart.
  const pieData = {
    labels: ["Total Due", "Total Received", "Total Concession"],
    datasets: [
      {
        data: [totalDue, totalReceived, totalConcession],
        backgroundColor: [
          "rgba(255, 99, 132, 0.8)",
          "rgba(54, 162, 235, 0.8)",
          "rgba(255, 206, 86, 0.8)",
        ],
        borderColor: "#fff",
        borderWidth: 2,
        hoverOffset: 10,
      },
    ],
  };

  const pieOptions = {
    responsive: true,
    plugins: {
      legend: { position: "right" },
      title: { display: false },
    },
  };

  if (loading) return <p>Loading Fee Summary...</p>;
  if (error) return <p className="text-danger">{error}</p>;

  return (
    <div className="card shadow-sm mb-4">
      <div className="card-header bg-success text-white text-center">
        Fee Summary
      </div>
      <div className="card-body">
        <div className="row align-items-center">
          {/* Medium-sized Pie Chart Container */}
          <div className="col-md-6">
            <div style={{ height: "350px" }}>
              <Pie data={pieData} options={pieOptions} />
            </div>
          </div>
          <div className="col-md-6">
            <table className="table table-bordered">
              <tbody>
                <tr>
                  <th>Total Due</th>
                  <td>{formatSummaryMoney(totalDue)}</td>
                </tr>
                <tr>
                  <th>Total Received</th>
                  <td>{formatSummaryMoney(totalReceived)}</td>
                </tr>
                <tr>
                  <th>Total Concession</th>
                  <td>{formatSummaryMoney(totalConcession)}</td>
                </tr>
              </tbody>
            </table>
            <div className="text-center mt-2">
              <a href="/student-fee" className="btn btn-primary btn-sm">
                View Full Details
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentFeeSummary;
