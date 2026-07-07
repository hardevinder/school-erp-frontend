import React, { useState, useEffect } from "react";
import api from "../api";

const LatestStudentCirculars = () => {
  const [circulars, setCirculars] = useState([]);

  useEffect(() => {
    const fetchCirculars = async () => {
      try {
        const { data } = await api.get("/circulars");
        const filtered = data.circulars
          .filter(c => c.audience === "student" || c.audience === "both")
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 3); // take latest three
        setCirculars(filtered);
      } catch (err) {
        console.error("Error loading circulars:", err);
      }
    };

    fetchCirculars();
  }, []);

  return (
    <div className="mb-5">
      <h3>Latest Circulars</h3>
      {circulars.length === 0 ? (
        <p>No circulars available for students.</p>
      ) : (
        <div className="row">
          {circulars.map((c) => (
            <div key={c.id} className="col-md-4 mb-3">
              <div className="card h-100">
                <div className="card-body">
                  <h5 className="card-title">{c.title}</h5>
                  <p className="card-text">{c.description}</p>
                </div>
                <div className="card-footer d-flex justify-content-between align-items-center">
                  <small className="text-muted">
                    {new Date(c.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </small>
                  {c.fileUrl && (
                    <button
                      className="btn btn-outline-primary btn-sm"
                      onClick={() =>
                        window.open(c.fileUrl, "_blank", "noopener")
                      }
                    >
                      View
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LatestStudentCirculars;
