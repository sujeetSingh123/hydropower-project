# Database Schema

Database: **PostgreSQL 16**

---

## Entity-Relationship Overview

```
roles ──< users >──────────────< audit_logs
              │
              │
plants ──< scada_tags >──────────< scada_readings
                │                         │
                │                         ▼
                └──────────────────> alarms
                                          │
                                 alarm_thresholds
                                 (embedded in tag)

daily_generation_summary  (aggregated daily)
equipment_runtime          (per-tag uptime)
maintenance_logs           (work orders)
reports                    (generated file records)
notification_settings      (per-user channel prefs)
scada_settings             (global SCADA config)
```

---

## Tables

### `roles`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | SERIAL | PK | |
| `name` | VARCHAR(50) | UNIQUE NOT NULL | `admin` / `operator` / `viewer` |
| `permissions` | JSONB | NOT NULL | Array of permission strings |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |

**Seed data**

| Role | Permissions |
|---|---|
| `admin` | `readings:read`, `alarms:read`, `alarms:acknowledge`, `reports:generate`, `admin:manage`, `users:manage` |
| `operator` | `readings:read`, `alarms:read`, `alarms:acknowledge`, `reports:generate` |
| `viewer` | `readings:read`, `alarms:read` |

---

### `users`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | SERIAL | PK | |
| `username` | VARCHAR(50) | UNIQUE NOT NULL | Login name |
| `password_hash` | VARCHAR(255) | NOT NULL | bcrypt hash |
| `email` | VARCHAR(255) | UNIQUE | |
| `full_name` | VARCHAR(100) | | |
| `role_id` | INTEGER | FK → roles.id | |
| `is_active` | BOOLEAN | DEFAULT true | Soft disable |
| `last_login` | TIMESTAMPTZ | | Updated on login |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | |

---

### `plants`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | SERIAL | PK | |
| `name` | VARCHAR(100) | NOT NULL | Plant display name |
| `location` | VARCHAR(255) | | |
| `installed_capacity_kw` | DECIMAL(10,2) | | Nameplate capacity |
| `commissioned_date` | DATE | | |
| `is_active` | BOOLEAN | DEFAULT true | |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |

---

### `scada_tags`

Central configuration table for every monitored signal.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | SERIAL | PK | |
| `plant_id` | INTEGER | FK → plants.id | |
| `tag_name` | VARCHAR(100) | UNIQUE NOT NULL | Internal key (e.g. `active_power`) |
| `display_name` | VARCHAR(100) | NOT NULL | Human label |
| `unit` | VARCHAR(20) | | `kW`, `Hz`, `V`, etc. |
| `data_type` | VARCHAR(20) | | `float`, `integer`, `boolean` |
| `opc_node_id` | VARCHAR(255) | | OPC UA node address |
| `high_limit` | DECIMAL(15,4) | | Trip / hard limit |
| `low_limit` | DECIMAL(15,4) | | |
| `warning_high` | DECIMAL(15,4) | | Soft warning threshold |
| `warning_low` | DECIMAL(15,4) | | |
| `is_active` | BOOLEAN | DEFAULT true | Include in polling |
| `polling_interval_ms` | INTEGER | DEFAULT 5000 | Per-tag interval |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |

**Key tags in the default seed**

| tag_name | Display Name | Unit |
|---|---|---|
| `active_power` | Active Power | kW |
| `reactive_power` | Reactive Power | kVAR |
| `frequency` | Grid Frequency | Hz |
| `voltage_l1` | Voltage L1-N | V |
| `voltage_l2` | Voltage L2-N | V |
| `voltage_l3` | Voltage L3-N | V |
| `current_l1` | Current L1 | A |
| `power_factor` | Power Factor | — |
| `water_level` | Head Water Level | m |
| `tail_water_level` | Tail Water Level | m |
| `flow_rate` | Water Flow Rate | m³/s |
| `turbine_speed` | Turbine Speed | RPM |
| `bearing_temp` | Bearing Temperature | °C |
| `oil_pressure` | Oil Pressure | bar |

---

### `scada_readings`

Time-series table. High write volume — indexed heavily.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | BIGSERIAL | PK | |
| `tag_name` | VARCHAR(100) | NOT NULL | Denormalized for query speed |
| `value` | DECIMAL(15,4) | NOT NULL | |
| `unit` | VARCHAR(20) | | |
| `quality` | VARCHAR(20) | DEFAULT 'good' | `good` / `bad` / `uncertain` |
| `timestamp` | TIMESTAMPTZ | NOT NULL | Measurement time |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Insert time |

**Indexes**

| Index | Columns | Purpose |
|---|---|---|
| `idx_readings_tag_time` | `(tag_name, timestamp DESC)` | Primary query pattern |
| `idx_readings_timestamp` | `(timestamp DESC)` | Time-range scans |

---

### `alarms`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | SERIAL | PK | |
| `tag_name` | VARCHAR(100) | NOT NULL | FK (logical) → scada_tags |
| `plant_id` | INTEGER | FK → plants.id | |
| `alarm_type` | VARCHAR(50) | NOT NULL | `high` / `low` / `no_data` |
| `severity` | VARCHAR(20) | NOT NULL | `info` / `warning` / `critical` |
| `status` | VARCHAR(20) | DEFAULT 'active' | `active` / `acknowledged` / `resolved` |
| `value_at_trigger` | DECIMAL(15,4) | | Measured value that caused alarm |
| `threshold_value` | DECIMAL(15,4) | | Configured threshold |
| `message` | TEXT | | Auto-generated description |
| `triggered_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `acknowledged_at` | TIMESTAMPTZ | | |
| `acknowledged_by` | INTEGER | FK → users.id | |
| `resolved_at` | TIMESTAMPTZ | | |
| `notes` | TEXT | | Operator notes |

**Indexes**

| Index | Columns |
|---|---|
| `idx_alarms_status` | `(status)` |
| `idx_alarms_tag_status` | `(tag_name, status)` |
| `idx_alarms_triggered` | `(triggered_at DESC)` |

---

### `daily_generation_summary`

Pre-aggregated daily rollup written by the cron worker.

| Column | Type | Description |
|---|---|---|
| `id` | SERIAL PK | |
| `plant_id` | INTEGER | FK → plants.id |
| `summary_date` | DATE UNIQUE | One row per day |
| `total_energy_kwh` | DECIMAL(12,2) | Sum of generated energy |
| `peak_power_kw` | DECIMAL(10,2) | Max active power |
| `avg_power_kw` | DECIMAL(10,2) | Mean active power |
| `min_power_kw` | DECIMAL(10,2) | Min active power |
| `operating_hours` | DECIMAL(6,2) | Hours with non-zero generation |
| `avg_water_level` | DECIMAL(8,2) | Mean head water level |
| `avg_flow_rate` | DECIMAL(8,2) | Mean flow rate |
| `total_alarms` | INTEGER | Alarm count for the day |
| `critical_alarms` | INTEGER | Critical alarm count |
| `availability_percent` | DECIMAL(5,2) | Uptime % |
| `created_at` | TIMESTAMPTZ | |

---

### `equipment_runtime`

Tracks cumulative run-hours per tag (e.g., each generating unit).

| Column | Type | Description |
|---|---|---|
| `id` | SERIAL PK | |
| `tag_name` | VARCHAR(100) | |
| `plant_id` | INTEGER | |
| `runtime_date` | DATE | |
| `hours_running` | DECIMAL(6,2) | Hours in operational state |
| `hours_idle` | DECIMAL(6,2) | |
| `hours_fault` | DECIMAL(6,2) | |
| `created_at` | TIMESTAMPTZ | |

---

### `maintenance_logs`

| Column | Type | Description |
|---|---|---|
| `id` | SERIAL PK | |
| `plant_id` | INTEGER | |
| `equipment_name` | VARCHAR(100) | |
| `maintenance_type` | VARCHAR(50) | `preventive` / `corrective` / `emergency` |
| `description` | TEXT | |
| `performed_by` | INTEGER | FK → users.id |
| `start_time` | TIMESTAMPTZ | |
| `end_time` | TIMESTAMPTZ | |
| `cost` | DECIMAL(10,2) | |
| `created_at` | TIMESTAMPTZ | |

---

### `reports`

Metadata record for every generated report file.

| Column | Type | Description |
|---|---|---|
| `id` | SERIAL PK | |
| `plant_id` | INTEGER | |
| `report_type` | VARCHAR(50) | `daily` / `monthly` / `alarm` |
| `report_date` | DATE | Date the report covers |
| `format` | VARCHAR(10) | `excel` / `pdf` |
| `file_path` | VARCHAR(500) | Server-side storage path |
| `generated_by` | INTEGER | FK → users.id |
| `generated_at` | TIMESTAMPTZ | |

---

### `notification_settings`

Per-user configuration of alert delivery channels.

| Column | Type | Description |
|---|---|---|
| `id` | SERIAL PK | |
| `user_id` | INTEGER UNIQUE | FK → users.id |
| `email_enabled` | BOOLEAN | Default true |
| `email_address` | VARCHAR(255) | |
| `whatsapp_enabled` | BOOLEAN | Default false |
| `whatsapp_number` | VARCHAR(20) | |
| `sms_enabled` | BOOLEAN | Default false |
| `sms_number` | VARCHAR(20) | |
| `min_severity` | VARCHAR(20) | Minimum alarm level to notify |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

---

### `scada_settings`

Single-row global SCADA connection configuration (updated via Admin UI).

| Column | Type | Description |
|---|---|---|
| `id` | SERIAL PK | |
| `plant_id` | INTEGER | |
| `mode` | VARCHAR(20) | `opcua` / `simulator` |
| `opc_endpoint` | VARCHAR(255) | OPC UA server URL |
| `opc_security_mode` | VARCHAR(50) | `None` / `Sign` / `SignAndEncrypt` |
| `polling_interval_ms` | INTEGER | Global default poll rate |
| `connection_timeout_ms` | INTEGER | |
| `retry_interval_ms` | INTEGER | |
| `max_retries` | INTEGER | |
| `updated_by` | INTEGER | FK → users.id |
| `updated_at` | TIMESTAMPTZ | |

---

### `audit_logs`

Immutable append-only log of all state-changing API actions.

| Column | Type | Description |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `user_id` | INTEGER | FK → users.id |
| `action` | VARCHAR(100) | e.g. `alarm.acknowledge` |
| `resource_type` | VARCHAR(50) | e.g. `alarm` |
| `resource_id` | INTEGER | |
| `details` | JSONB | Before/after or context |
| `ip_address` | INET | |
| `created_at` | TIMESTAMPTZ | |

---

## Migration Strategy

Migrations live in `server/migrations/` as numbered SQL files. Run with:

```bash
cd server
npm run migrate
```

Seed initial roles, plant, tags, and demo users:

```bash
npm run seed
```
