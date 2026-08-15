import api from "../api";

export async function getStudent360Timeline(studentId, params = {}) {
  const { data } = await api.get(`/student-360-timeline/${studentId}/timeline`, { params });
  return data;
}
