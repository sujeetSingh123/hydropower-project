/**
 * Shared domain types for the Hydropower Plant Monitoring System.
 * Derived from the database schema in migrations/001_initial_schema.sql
 */

// ─── Auth / JWT ──────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string; // user UUID
  role: string;
  iat?: number;
  exp?: number;
}

// Augment Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// ─── Users & Roles ───────────────────────────────────────────────────────────

export interface RolePermissions {
  dashboard: boolean;
  alarms: boolean;
  reports: boolean;
  admin: boolean;
  historical: boolean;
  [key: string]: boolean;
}

export interface Role {
  id: number;
  name: string;
  permissions: RolePermissions;
}

/** The user record as stored in the database (with hashed password) */
export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role_id: number;
  plant_ids: number[];
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  /** Joined from roles table */
  role: string;
  /** Joined from roles table */
  permissions: RolePermissions;
}

/** Safe user representation (no password_hash) */
export type SafeUser = Omit<UserRow, 'password_hash'>;

/** The user attached to req.user after authentication */
export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role_id: number;
  role: string;
  permissions: RolePermissions;
  plant_ids: number[];
}

// ─── Plants ──────────────────────────────────────────────────────────────────

export interface Plant {
  id: number;
  name: string;
  location: string | null;
  capacity_kw: string | null; // pg returns NUMERIC as string
  commissioned_at: Date | null;
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: Date;
}

// ─── SCADA Tags ──────────────────────────────────────────────────────────────

export interface ScadaTag {
  id: number;
  plant_id: number;
  tag_name: string;
  display_name: string;
  opc_node_id: string | null;
  unit: string | null;
  data_type: string;
  category: string | null;
  description: string | null;
  alarm_low: string | null;
  alarm_high: string | null;
  warn_low: string | null;
  warn_high: string | null;
  is_active: boolean;
  poll_interval_ms: number;
  created_at: Date;
}

/** Minimal tag shape used by the poller / simulator */
export interface ActiveTag {
  id: number;
  tag_name: string;
  opc_node_id: string | null;
  unit: string | null;
}

// ─── SCADA Readings ──────────────────────────────────────────────────────────

export interface SensorReading {
  tag_name: string;
  tag_id: number;
  value: number | null;
  quality: number;
  timestamp: Date;
}

export interface ReadingRow {
  tag_name: string;
  value: string | null; // pg returns NUMERIC as string
  quality: number;
  timestamp: Date;
}

export interface AggregatedReading {
  bucket: Date;
  avg_value: string | null;
  min_value: string | null;
  max_value: string | null;
  sample_count: string;
}

// ─── Alarms ──────────────────────────────────────────────────────────────────

export type AlarmSeverity = 'info' | 'warning' | 'critical';
export type AlarmStatus = 'active' | 'acknowledged' | 'resolved';

export interface AlarmRow {
  id: number;
  plant_id: number;
  tag_name: string | null;
  alarm_type: string;
  severity: AlarmSeverity;
  status: AlarmStatus;
  message: string;
  value: string | null;
  threshold: string | null;
  triggered_at: Date;
  acknowledged_at: Date | null;
  acknowledged_by: string | null;
  resolved_at: Date | null;
  resolved_by: string | null;
  notes: string | null;
  created_at: Date;
}

export interface AlarmThreshold {
  type: string;
  severity: AlarmSeverity;
  threshold: number;
}

// ─── Daily Generation Summary ────────────────────────────────────────────────

export interface DailySummaryRow {
  id: number;
  plant_id: number;
  date: Date;
  total_generation_kwh: string;
  peak_load_kw: string | null;
  avg_load_kw: string | null;
  min_load_kw: string | null;
  avg_frequency: string | null;
  min_frequency: string | null;
  max_frequency: string | null;
  avg_voltage_ry: string | null;
  min_voltage: string | null;
  max_voltage: string | null;
  avg_power_factor: string | null;
  avg_water_level: string | null;
  min_water_level: string | null;
  downtime_minutes: number;
  alarm_count: number;
  operator_notes: string | null;
  created_at: Date;
  updated_at: Date;
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export interface ReportRow {
  id: string;
  plant_id: number;
  report_type: string;
  title: string;
  parameters: Record<string, unknown>;
  file_path: string | null;
  generated_by: string | null;
  generated_at: Date;
  status: string;
}

// ─── Notification Settings ───────────────────────────────────────────────────

export interface NotificationSettingRow {
  id: number;
  plant_id: number;
  type: string;
  config: Record<string, unknown>;
  severities: AlarmSeverity[];
  is_active: boolean;
  updated_at: Date;
}

export interface NotificationPayload {
  severity: AlarmSeverity;
  message: string;
  tagName: string;
  timestamp: string;
}

// ─── SCADA Settings ──────────────────────────────────────────────────────────

export interface ScadaSettingsRow {
  id: number;
  plant_id: number;
  connection_type: string;
  endpoint_url: string | null;
  poll_interval_ms: number;
  reconnect_delay_ms: number;
  max_retries: number;
  auth_config: Record<string, unknown>;
  is_active: boolean;
  updated_at: Date;
}

// ─── Audit Logs ──────────────────────────────────────────────────────────────

export interface AuditLogRow {
  id: number;
  user_id: string | null;
  action: string;
  resource: string | null;
  resource_id: string | null;
  payload: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  /** Joined from users */
  user_name?: string;
}

// ─── Poller Status ───────────────────────────────────────────────────────────

export interface PollerStatus {
  running: boolean;
  connected: boolean;
  simulator: boolean;
  lastPollAt: Date | null;
  consecutiveErrors: number;
  pollIntervalMs: number;
}
