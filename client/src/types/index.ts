// ─── Domain types derived from server/migrations/001_initial_schema.sql ───────

export type AlarmSeverity = 'info' | 'warning' | 'critical';
export type AlarmStatus   = 'active' | 'acknowledged' | 'resolved';

export interface Permissions {
  dashboard:  boolean;
  alarms:     boolean;
  reports:    boolean;
  admin:      boolean;
  historical: boolean;
  [key: string]: boolean;
}

export interface User {
  id:            string;
  name:          string;
  email:         string;
  role:          string;         // 'admin' | 'operator' | 'viewer'
  role_id:       number;
  plant_ids:     number[];
  is_active:     boolean;
  permissions:   Permissions;
  last_login_at: string | null;
  created_at:    string;
  updated_at:    string;
}

export interface Plant {
  id:             number;
  name:           string;
  location:       string | null;
  capacity_kw:    number | null;
  commissioned_at: string | null;
  metadata:       Record<string, unknown>;
  is_active:      boolean;
  created_at:     string;
}

export interface ScadaTag {
  id:               number;
  plant_id:         number;
  tag_name:         string;
  display_name:     string;
  opc_node_id:      string | null;
  unit:             string | null;
  data_type:        string;
  category:         string | null;
  description:      string | null;
  alarm_low:        number | null;
  alarm_high:       number | null;
  warn_low:         number | null;
  warn_high:        number | null;
  is_active:        boolean;
  poll_interval_ms: number;
  created_at:       string;
}

/** One live reading entry for a single tag (value from REST /readings/live) */
export interface LiveReading {
  value:     number;
  ts:        string;   // ISO timestamp
  quality:   number;
  tag_name:  string;
}

/** Map of tagName → LiveReading returned by the /readings/live endpoint */
export type LiveReadingsMap = Record<string, LiveReading>;

/** A raw scada_readings row (used in history queries) */
export interface SensorReading {
  id:         number;
  plant_id:   number;
  tag_id:     number;
  tag_name:   string;
  value:      number;
  quality:    number;
  timestamp:  string;
  created_at: string;
}

/** Aggregated bucket returned by /readings/aggregated */
export interface AggregatedReading {
  bucket:     string;   // ISO timestamp for the bucket start
  tag_name:   string;
  avg_value:  string;   // Postgres numeric comes as string
  min_value:  string;
  max_value:  string;
  count:      number;
}

/** One row from daily_generation_summary */
export interface DailyGenerationSummary {
  id:                    number;
  plant_id:              number;
  date:                  string;
  total_generation_kwh:  number;
  peak_load_kw:          number | null;
  avg_load_kw:           number | null;
  min_load_kw:           number | null;
  avg_frequency:         number | null;
  min_frequency:         number | null;
  max_frequency:         number | null;
  avg_voltage_ry:        number | null;
  min_voltage:           number | null;
  max_voltage:           number | null;
  avg_power_factor:      number | null;
  avg_water_level:       number | null;
  min_water_level:       number | null;
  downtime_minutes:      number;
  alarm_count:           number;
  operator_notes:        string | null;
  created_at:            string;
  updated_at:            string;
}

export interface Alarm {
  id:               number;
  plant_id:         number;
  tag_name:         string | null;
  alarm_type:       string;
  severity:         AlarmSeverity;
  status:           AlarmStatus;
  message:          string;
  value:            number | null;
  threshold:        number | null;
  triggered_at:     string;
  acknowledged_at:  string | null;
  acknowledged_by:  string | null;
  resolved_at:      string | null;
  resolved_by:      string | null;
  notes:            string | null;
  created_at:       string;
}

export interface AlarmStats {
  active_count:   number;
  critical_count: number;
  last_24h:       number;
  last_7d:        number;
}

export interface NotificationSetting {
  id:         number;
  plant_id:   number;
  type:       string;
  config:     Record<string, unknown>;
  severities: AlarmSeverity[];
  is_active:  boolean;
  updated_at: string;
}

export interface ScadaSettings {
  id:                  number;
  plant_id:            number;
  connection_type:     string;
  endpoint_url:        string | null;
  poll_interval_ms:    number;
  reconnect_delay_ms:  number;
  max_retries:         number;
  auth_config:         Record<string, unknown>;
  is_active:           boolean;
  updated_at:          string;
}

/** Partial of ScadaSettings for form edits */
export type ScadaSettingsForm = Partial<Pick<ScadaSettings,
  'connection_type' | 'endpoint_url' | 'poll_interval_ms' | 'reconnect_delay_ms'>>;

/** Partial of ScadaTag for form edits */
export type ScadaTagForm = Partial<Pick<ScadaTag,
  'display_name' | 'unit' | 'alarm_low' | 'alarm_high' | 'warn_low' | 'warn_high' | 'is_active'>> & { id: number };

export interface CreateUserForm {
  name:     string;
  email:    string;
  password: string;
  role_id:  number;
}

export interface PollerStatus {
  [key: string]: string | number | boolean;
}

// ─── API response wrappers ────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data:  T[];
  total: number;
}

export interface LoginResponse {
  token: string;
  user:  User;
}
