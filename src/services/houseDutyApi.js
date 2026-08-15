import api from "../api";

const data = (p) => p.then((r) => r.data);
export const getHouseDutyBootstrap = () => data(api.get("/house-duty/bootstrap"));
export const searchHouseDutyPeople = (params) => data(api.get("/house-duty/people", { params }));
export const getHouseDutyWeeks = (params) => data(api.get("/house-duty/weeks", { params }));
export const createHouseDutyWeek = (body) => data(api.post("/house-duty/weeks", body));
export const updateHouseDutyWeek = (id, body) => data(api.patch(`/house-duty/weeks/${id}`, body));
export const getHouseDutyAssignments = (params) => data(api.get("/house-duty/assignments", { params }));
export const createHouseDutyAssignment = (body) => data(api.post("/house-duty/assignments", body));
export const updateHouseDutyAssignment = (id, body) => data(api.patch(`/house-duty/assignments/${id}`, body));
export const markHouseDutyAttendance = (id, body) => data(api.post(`/house-duty/assignments/${id}/attendance`, body));
export const rateHouseDutyAssignment = (id, body) => data(api.post(`/house-duty/assignments/${id}/rating`, body));
export const getMyHouseDuties = () => data(api.get("/house-duty/me"));
export const getHouseAssemblies = (params) => data(api.get("/house-duty/assemblies", { params }));
export const createHouseAssembly = (body) => data(api.post("/house-duty/assemblies", body));
export const updateHouseAssembly = (id, body) => data(api.patch(`/house-duty/assemblies/${id}`, body));
export const addHouseAssemblyItem = (id, body) => data(api.post(`/house-duty/assemblies/${id}/items`, body));
export const updateHouseAssemblyItem = (id, body) => data(api.patch(`/house-duty/assembly-items/${id}`, body));
export const getHouseCompetitions = (params) => data(api.get("/house-duty/competitions", { params }));
export const createHouseCompetition = (body) => data(api.post("/house-duty/competitions", body));
export const configureHouseCompetition = (id, body) => data(api.post(`/house-duty/competitions/${id}/configure`, body));
export const scoreHouseCompetition = (id, body) => data(api.post(`/house-duty/competitions/${id}/score`, body));
export const publishHouseCompetition = (id) => data(api.post(`/house-duty/competitions/${id}/publish`));
export const addHousePoints = (body) => data(api.post("/house-duty/house-points", body));
export const getHouseLeaderboard = (params) => data(api.get("/house-duty/leaderboard", { params }));

async function openPdf(url, params = {}) {
  const r = await api.get(url, { params, responseType: "blob" });
  const blobUrl = window.URL.createObjectURL(new Blob([r.data], { type: "application/pdf" }));
  const w = window.open(blobUrl, "_blank", "noopener,noreferrer");
  if (!w) {
    const a = document.createElement("a"); a.href = blobUrl; a.target = "_blank"; a.rel = "noopener noreferrer"; a.click();
  }
  window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
}
export const openHouseDutyWeekPdf = (id) => openPdf(`/house-duty/weeks/${id}/duty-chart.pdf`);
export const openHouseAssemblyPdf = (id) => openPdf(`/house-duty/assemblies/${id}/print.pdf`);
export const openHouseCompetitionPdf = (id) => openPdf(`/house-duty/competitions/${id}/result.pdf`);
export const openHouseLeaderboardPdf = (sessionId) => openPdf("/house-duty/leaderboard.pdf", { session_id: sessionId });
