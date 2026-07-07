import React, { useState, useEffect } from "react";
import api from "../api";
import socket from "../socket";
import { Card, Row, Col } from "react-bootstrap";
import { toast } from "react-toastify";

const LatestTeacherSubstitutions = () => {
  const [subs, setSubs] = useState([]);

  const fetchSubs = async () => {
    try {
      const { data } = await api.get("/substitutions/teacher");
      const sorted = data
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);
      setSubs(sorted);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load substitutions");
    }
  };

  useEffect(() => {
    fetchSubs();

    const update = () => fetchSubs();
    socket.on("newSubstitution", update);
    socket.on("substitutionUpdated", update);
    socket.on("substitutionDeleted", update);
    return () => {
      socket.off("newSubstitution", update);
      socket.off("substitutionUpdated", update);
      socket.off("substitutionDeleted", update);
    };
  }, []);

  if (!subs.length) return <p className="text-center">No recent substitutions.</p>;

  return (
    <Row xs={1} md={5} className="g-4">
      {subs.map(s => (
        <Col key={s.id}>
          <Card className="h-100 shadow-sm rounded-lg">
            <Card.Body>
              <Card.Title className="mb-2">{new Date(s.date).toLocaleDateString()}</Card.Title>
              <Card.Subtitle className="mb-1 text-capitalize">{s.Subject?.name || "—"}</Card.Subtitle>
              <Card.Text className="mb-1">
                <strong>Class:</strong> {s.Class?.class_name || s.classId}
              </Card.Text>
              <Card.Text className="mb-1">
                <strong>Period:</strong> {s.Period?.period_name || s.periodId}
              </Card.Text>
              <Card.Text className="mb-0">
                <strong>Covered To:</strong> {s.OriginalTeacher?.name || "—"}
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default LatestTeacherSubstitutions;
