import React, { useState, useEffect } from "react";
import api from "../api";
import socket from "../socket";
import { toast } from "react-toastify";
import { Card, Button, Row, Col } from "react-bootstrap";

const LatestTeacherCirculars = () => {
  const [circulars, setCirculars] = useState([]);

  const fetchCirculars = async () => {
    try {
      const { data } = await api.get("/circulars");
      const sorted = data.circulars
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 3);
      setCirculars(sorted);
    } catch (err) {
      console.error("Failed to fetch circulars:", err);
    }
  };

  useEffect(() => {
    fetchCirculars();

    socket.on("newCircular", ({ circular }) => {
      toast.info(`New Circular: ${circular.title}`);
      setCirculars(prev => [circular, ...prev].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3));
    });
    socket.on("circularUpdated", ({ circular }) => {
      toast.info(`Circular Updated: ${circular.title}`);
      setCirculars(prev =>
        prev
          .map(c => (c.id === circular.id ? circular : c))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 3)
      );
    });
    socket.on("circularDeleted", ({ id }) => {
      toast.info("Circular Deleted");
      setCirculars(prev => prev.filter(c => c.id !== id).slice(0, 3));
    });

    return () => {
      socket.off("newCircular");
      socket.off("circularUpdated");
      socket.off("circularDeleted");
    };
  }, []);

  if (!circulars.length) return <p className="text-center">No circulars available.</p>;

  return (
    <Row xs={1} md={3} className="g-4">
      {circulars.map(c => (
        <Col key={c.id}>
          <Card className="h-100 shadow-sm rounded-lg">
            <Card.Body>
              <Card.Title>{c.title}</Card.Title>
              <Card.Text className="text-truncate" style={{ maxHeight: "4.5rem" }}>
                {c.description}
              </Card.Text>
            </Card.Body>
            <Card.Footer className="d-flex justify-content-between align-items-center">
              <small className="text-muted">
                {new Date(c.createdAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </small>
              {c.fileUrl ? (
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => window.open(c.fileUrl, "_blank", "noopener")}
                >
                  View
                </Button>
              ) : (
                <span className="text-muted">No File</span>
              )}
            </Card.Footer>
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default LatestTeacherCirculars;
