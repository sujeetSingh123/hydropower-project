import axios from 'axios';
import useAuthStore from '../store/authStore';

const API_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({ baseURL: API_URL, timeout: 15_000 });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
  listUsers: () => api.get('/auth/users'),
  createUser: (data) => api.post('/auth/users', data),
  updateUser: (id, data) => api.patch(`/auth/users/${id}`, data),
};

// ── Readings ─────────────────────────────────────────────────────────────────
export const readingsApi = {
  live: (plantId = 1) => api.get('/readings/live', { params: { plantId } }),
  history: (params) => api.get('/readings/history', { params }),
  aggregated: (params) => api.get('/readings/aggregated', { params }),
  summaries: (params) => api.get('/readings/summaries', { params }),
};

// ── Alarms ───────────────────────────────────────────────────────────────────
export const alarmsApi = {
  list: (params) => api.get('/alarms', { params }),
  stats: () => api.get('/alarms/stats'),
  acknowledge: (id) => api.patch(`/alarms/${id}/acknowledge`),
  addNote: (id, notes) => api.patch(`/alarms/${id}/notes`, { notes }),
};

// ── Reports ──────────────────────────────────────────────────────────────────
export const reportsApi = {
  daily: (params) => api.get('/reports/daily', { params }),
  monthly: (params) => api.get('/reports/monthly', { params }),
  downloadDaily: (date, format) =>
    api.get('/reports/daily', { params: { date, format }, responseType: 'blob' }),
  downloadMonthly: (year, month, format) =>
    api.get('/reports/monthly', { params: { year, month, format }, responseType: 'blob' }),
};

// ── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  scadaSettings: () => api.get('/admin/scada-settings'),
  updateScada: (data) => api.patch('/admin/scada-settings', data),
  tags: () => api.get('/admin/tags'),
  updateTag: (id, data) => api.patch(`/admin/tags/${id}`, data),
  createTag: (data) => api.post('/admin/tags', data),
  pollerStatus: () => api.get('/admin/poller/status'),
  notifications: () => api.get('/admin/notifications'),
  updateNotification: (id, data) => api.patch(`/admin/notifications/${id}`, data),
  auditLogs: () => api.get('/admin/audit-logs'),
  triggerDailySummary: (date) => api.post('/admin/daily-summary', { date }),
};

export default api;
