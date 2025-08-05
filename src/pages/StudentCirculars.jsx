import React, { useState, useEffect } from "react";
import api from "../api";
import socket from "../socket";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const StudentCirculars = () => {
  const [circulars, setCirculars] = useState([]);

  // Fetch initial list
  const fetchCirculars = async () => {
    try {
      const { data } = await api.get("/circulars");
      const filtered = data.circulars
        .filter(c => c.audience === "student" || c.audience === "both")
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setCirculars(filtered);
    } catch (err) {
      console.error("Error loading circulars:", err);
    }
  };

  useEffect(() => {
    fetchCirculars();

    // Real‑time updates
    socket.on("newCircular", ({ circular }) => {
      if (circular.audience === "student" || circular.audience === "both") {
        toast.info(`New Circular: ${circular.title}`);
        setCirculars(prev => [circular, ...prev].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      }
    });

    socket.on("circularUpdated", ({ circular }) => {
      if (circular.audience === "student" || circular.audience === "both") {
        toast.info(`Circular Updated: ${circular.title}`);
        setCirculars(prev =>
          prev
            .map(c => (c.id === circular.id ? circular : c))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        );
      }
    });

    socket.on("circularDeleted", ({ id }) => {
      toast.info("Circular Removed");
      setCirculars(prev => prev.filter(c => c.id !== id));
    });

    return () => {
      socket.off("newCircular");
      socket.off("circularUpdated");
      socket.off("circularDeleted");
    };
  }, []);

  return (
    <div className="container mt-5">
      <h2 className="mb-4">Student Circulars</h2>
      {circulars.length === 0 ? (
        <p>No circulars available for students.</p>
      ) : (
        <table className="table table-bordered table-hover">
          <thead className="table-light">
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Description</th>
              <th>Date &amp; Time</th>
              <th>Attachment</th>
            </tr>
          </thead>
          <tbody>
            {circulars.map((c, idx) => (
              <tr key={c.id}>
                <td>{idx + 1}</td>
                <td>{c.title}</td>
                <td>{c.description}</td>
                <td>
                  {new Date(c.createdAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </td>
                <td>
                  {c.fileUrl ? (
                    <button
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => window.open(c.fileUrl, "_blank", "noopener")}
                    >
                      View
                    </button>
                  ) : (
                    <span className="text-muted">No File</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default StudentCirculars;
