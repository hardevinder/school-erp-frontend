import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_URL = (process.env.REACT_APP_API_URL || "").replace(/\/+$/, "");

const asText = (value, fallback = "—") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

const statusClass = (status) => {
  const normalized = String(status || "").toUpperCase();
  if (["WINNER", "VERIFIED", "PUBLISHED", "COMPLETED"].includes(normalized)) {
    return "text-bg-success";
  }
  if (["SELECTED", "CONFIRMED", "APPROVED"].includes(normalized)) {
    return "text-bg-primary";
  }
  if (["ABSENT", "CANCELLED", "REJECTED"].includes(normalized)) {
    return "text-bg-danger";
  }
  return "text-bg-secondary";
};

const EmptyState = ({ icon, children }) => (
  <div className="text-center border rounded-4 bg-light p-5 text-muted">
    <i className={`bi ${icon} fs-1 d-block mb-2`} />
    {children}
  </div>
);

export default function StudentActivitiesAchievements() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [participations, setParticipations] = useState([]);
  const [achievements, setAchievements] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_URL}/department-management/student/my-activities`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      setParticipations(response.data?.participations || []);
      setAchievements(response.data?.achievements || []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to load activities and achievements."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({ participations: participations.length, achievements: achievements.length }),
    [participations, achievements]
  );

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  return (
    <div className="container-fluid py-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h2 className="mb-1">My Activities & Achievements</h2>
          <p className="text-muted mb-0">
            Department events, competitions, participation and verified results.
          </p>
        </div>
        <button type="button" className="btn btn-outline-primary" onClick={load}>
          <i className="bi bi-arrow-clockwise me-2" />Refresh
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body d-flex align-items-center gap-3">
              <div className="rounded-circle bg-primary-subtle text-primary p-3">
                <i className="bi bi-people-fill fs-4" />
              </div>
              <div><div className="text-muted">Participations</div><div className="fs-2 fw-bold">{counts.participations}</div></div>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body d-flex align-items-center gap-3">
              <div className="rounded-circle bg-warning-subtle text-warning-emphasis p-3">
                <i className="bi bi-trophy-fill fs-4" />
              </div>
              <div><div className="text-muted">Achievements</div><div className="fs-2 fw-bold">{counts.achievements}</div></div>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white py-3"><h5 className="mb-0"><i className="bi bi-calendar-event me-2" />Events & Competitions</h5></div>
        <div className="card-body">
          {participations.length === 0 ? (
            <EmptyState icon="bi-calendar2-x">No department event participation recorded yet.</EmptyState>
          ) : (
            <div className="row g-3">
              {participations.map((participation) => {
                const event = participation.event || {};
                const department = event.department || {};
                return (
                  <div className="col-md-6 col-xl-4" key={participation.id}>
                    <div className="border rounded-4 p-3 h-100">
                      <div className="d-flex justify-content-between gap-2 mb-2">
                        <h6 className="mb-0">{asText(event.title)}</h6>
                        <span className={`badge ${statusClass(participation.participation_status)}`}>
                          {asText(participation.participation_status, "RECORDED").replaceAll("_", " ")}
                        </span>
                      </div>
                      <div className="small text-muted mb-2">
                        <i className="bi bi-building me-1" />{asText(department.name, "School")}
                      </div>
                      <div className="small mb-1"><i className="bi bi-calendar3 me-2" />{formatDate(event.start_date)}</div>
                      <div className="small mb-1"><i className="bi bi-person-badge me-2" />{asText(participation.participant_role, "PARTICIPANT").replaceAll("_", " ")}</div>
                      <div className="small"><i className="bi bi-award me-2" />{asText(participation.position, asText(participation.result, "Result pending"))}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white py-3"><h5 className="mb-0"><i className="bi bi-trophy me-2" />Verified Achievements</h5></div>
        <div className="card-body">
          {achievements.length === 0 ? (
            <EmptyState icon="bi-award">No verified achievement recorded yet.</EmptyState>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead><tr><th>Achievement</th><th>Department</th><th>Date</th><th>Level</th><th>Position</th><th>Status</th></tr></thead>
                <tbody>
                  {achievements.map((achievement) => (
                    <tr key={achievement.id}>
                      <td><strong>{asText(achievement.title)}</strong><div className="small text-muted">{asText(achievement.description, "")}</div></td>
                      <td>{asText(achievement.department?.name, "School")}</td>
                      <td>{formatDate(achievement.achievement_date)}</td>
                      <td>{asText(achievement.level, "SCHOOL")}</td>
                      <td>{asText(achievement.position, "Achievement")}</td>
                      <td><span className={`badge ${statusClass(achievement.status)}`}>{asText(achievement.status, "VERIFIED")}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
