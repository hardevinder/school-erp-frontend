// src/services/whatsappApi.js
import api from "../api";

const WA_BASE = "/api/whatsapp";

const normalizeSchoolId = (schoolId) => {
  const n = Number(schoolId || 1);
  return Number.isFinite(n) && n > 0 ? n : 1;
};

export const getWhatsAppStatus = async (schoolId = 1) => {
  const sid = normalizeSchoolId(schoolId);
  const { data } = await api.get(`${WA_BASE}/embedded-signup/status/${sid}`);
  return data;
};

export const exchangeEmbeddedSignupCode = async (payload = {}) => {
  const { data } = await api.post(`${WA_BASE}/embedded-signup/exchange-code`, payload);
  return data;
};

export const syncWhatsAppStatus = async (schoolId = 1) => {
  const sid = normalizeSchoolId(schoolId);
  const { data } = await api.post(`${WA_BASE}/embedded-signup/sync/${sid}`);
  return data;
};

export const listWhatsAppTemplates = async (schoolId = 1) => {
  const sid = normalizeSchoolId(schoolId);
  const { data } = await api.get(`${WA_BASE}/templates/${sid}`);
  return data;
};

export const createWhatsAppTemplate = async (schoolId = 1, payload = {}) => {
  const sid = normalizeSchoolId(schoolId);
  const { data } = await api.post(`${WA_BASE}/templates/${sid}`, payload);
  return data;
};

export const sendWhatsAppTextMessage = async (payload = {}) => {
  const { data } = await api.post(`${WA_BASE}/send-text`, payload);
  return data;
};

const whatsappApi = {
  getWhatsAppStatus,
  exchangeEmbeddedSignupCode,
  syncWhatsAppStatus,
  listWhatsAppTemplates,
  createWhatsAppTemplate,
  sendWhatsAppTextMessage,
};

export default whatsappApi;
