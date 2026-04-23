import axios, { AxiosResponse } from 'axios';
import useAuthStore from '../store/authStore';
import type {
  LoginResponse,
  User,
  LiveReadingsMap,
  SensorReading,
  AggregatedReading,
  DailyGenerationSummary,
  Alarm,
  AlarmStats,
  ScadaTag,
  ScadaSettings,
  ScadaSettingsForm,
  NotificationSetting,
  PollerStatus,
  CreateUserForm,
  PaginatedResponse,
} from '../types';

const API_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({ baseURL: API_URL, timeout: 15_000 });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err: unknown) => {
    const e = err as { response?: { status?: number } };
    if (e.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string): Promise<AxiosResponse<LoginResponse>> =>
    api.post<LoginResponse>('/auth/login', { email, password }),

  me: (): Promise<AxiosResponse<{ user: User }>> =>
    api.get<{ user: User }>('/auth/me'),

  changePassword: (data: { current_password: string; new_password: string }): Promise<AxiosResponse<void>> =>
    api.post('/auth/change-password', data),

  listUsers: (): Promise<AxiosResponse<{ users: User[] }>> =>
    api.get<{ users: User[] }>('/auth/users'),

  createUser: (data: CreateUserForm): Promise<AxiosResponse<{ user: User }>> =>
    api.post<{ user: User }>('/auth/users', data),

  updateUser: (id: string, data: Partial<User>): Promise<AxiosResponse<{ user: User }>> =>
    api.patch<{ user: User }>(`/auth/users/${id}`, data),
};

// ── Readings ─────────────────────────────────────────────────────────────────
interface HistoryParams {
  tagName:  string;
  from:     string;
  to:       string;
  limit?:   number;
  offset?:  number;
}

interface AggregatedParams {
  tagName: string;
  from:    string;
  to:      string;
  bucket:  string;
}

interface SummariesParams {
  from: string;
  to:   string;
}

export const readingsApi = {
  live: (plantId = 1): Promise<AxiosResponse<{ data: LiveReadingsMap }>> =>
    api.get<{ data: LiveReadingsMap }>('/readings/live', { params: { plantId } }),

  history: (params: HistoryParams): Promise<AxiosResponse<{ data: SensorReading[] }>> =>
    api.get<{ data: SensorReading[] }>('/readings/history', { params }),

  aggregated: (params: AggregatedParams): Promise<AxiosResponse<{ data: AggregatedReading[] }>> =>
    api.get<{ data: AggregatedReading[] }>('/readings/aggregated', { params }),

  summaries: (params: SummariesParams): Promise<AxiosResponse<{ data: DailyGenerationSummary[] }>> =>
    api.get<{ data: DailyGenerationSummary[] }>('/readings/summaries', { params }),
};

// ── Alarms ───────────────────────────────────────────────────────────────────
interface AlarmListParams {
  status?:   string;
  severity?: string;
  limit?:    number;
  offset?:   number;
}

export const alarmsApi = {
  list: (params?: AlarmListParams): Promise<AxiosResponse<PaginatedResponse<Alarm>>> =>
    api.get<PaginatedResponse<Alarm>>('/alarms', { params }),

  stats: (): Promise<AxiosResponse<AlarmStats>> =>
    api.get<AlarmStats>('/alarms/stats'),

  acknowledge: (id: number): Promise<AxiosResponse<void>> =>
    api.patch(`/alarms/${id}/acknowledge`),

  addNote: (id: number, notes: string): Promise<AxiosResponse<void>> =>
    api.patch(`/alarms/${id}/notes`, { notes }),
};

// ── Reports ──────────────────────────────────────────────────────────────────
interface DailyReportParams {
  date:    string;
  format?: string;
}

interface MonthlyReportParams {
  year:   number;
  month:  number;
}

export const reportsApi = {
  daily: (params: DailyReportParams): Promise<AxiosResponse<{ data: DailyGenerationSummary }>> =>
    api.get<{ data: DailyGenerationSummary }>('/reports/daily', { params }),

  monthly: (params: MonthlyReportParams): Promise<AxiosResponse<{ data: DailyGenerationSummary[] }>> =>
    api.get<{ data: DailyGenerationSummary[] }>('/reports/monthly', { params }),

  downloadDaily: (date: string, format: string): Promise<AxiosResponse<Blob>> =>
    api.get<Blob>('/reports/daily', { params: { date, format }, responseType: 'blob' }),

  downloadMonthly: (year: number, month: number, format: string): Promise<AxiosResponse<Blob>> =>
    api.get<Blob>('/reports/monthly', { params: { year, month, format }, responseType: 'blob' }),
};

// ── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  scadaSettings: (): Promise<AxiosResponse<{ settings: ScadaSettings }>> =>
    api.get<{ settings: ScadaSettings }>('/admin/scada-settings'),

  updateScada: (data: ScadaSettingsForm): Promise<AxiosResponse<{ settings: ScadaSettings }>> =>
    api.patch<{ settings: ScadaSettings }>('/admin/scada-settings', data),

  tags: (): Promise<AxiosResponse<{ tags: ScadaTag[] }>> =>
    api.get<{ tags: ScadaTag[] }>('/admin/tags'),

  updateTag: (id: number, data: Partial<ScadaTag>): Promise<AxiosResponse<{ tag: ScadaTag }>> =>
    api.patch<{ tag: ScadaTag }>(`/admin/tags/${id}`, data),

  createTag: (data: Partial<ScadaTag>): Promise<AxiosResponse<{ tag: ScadaTag }>> =>
    api.post<{ tag: ScadaTag }>('/admin/tags', data),

  pollerStatus: (): Promise<AxiosResponse<PollerStatus>> =>
    api.get<PollerStatus>('/admin/poller/status'),

  notifications: (): Promise<AxiosResponse<{ settings: NotificationSetting[] }>> =>
    api.get<{ settings: NotificationSetting[] }>('/admin/notifications'),

  updateNotification: (id: number, data: Partial<NotificationSetting>): Promise<AxiosResponse<void>> =>
    api.patch(`/admin/notifications/${id}`, data),

  auditLogs: (): Promise<AxiosResponse<{ logs: unknown[] }>> =>
    api.get('/admin/audit-logs'),

  triggerDailySummary: (date?: string): Promise<AxiosResponse<void>> =>
    api.post('/admin/daily-summary', { date }),
};

export default api;
