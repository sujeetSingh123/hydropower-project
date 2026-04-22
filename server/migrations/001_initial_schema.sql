-- Hydropower Plant Monitoring System - Initial Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─── ROLES ────────────────────────────────────────────────────────────────────
CREATE TABLE roles (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}'
);

INSERT INTO roles (name, permissions) VALUES
  ('admin',    '{"dashboard":true,"alarms":true,"reports":true,"admin":true,"historical":true}'),
  ('operator', '{"dashboard":true,"alarms":true,"reports":true,"admin":false,"historical":true}'),
  ('viewer',   '{"dashboard":true,"alarms":false,"reports":true,"admin":false,"historical":true}');

-- ─── USERS ────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role_id       INTEGER REFERENCES roles(id) DEFAULT 2,
  plant_ids     INTEGER[] DEFAULT '{}',
  is_active     BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PLANTS ───────────────────────────────────────────────────────────────────
CREATE TABLE plants (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  location      VARCHAR(255),
  capacity_kw   NUMERIC(10,2),
  commissioned_at DATE,
  metadata      JSONB DEFAULT '{}',
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO plants (name, location, capacity_kw, commissioned_at) VALUES
  ('Hydro Plant Alpha', 'Himalayan Region, Unit 1', 5000.00, '2020-01-15');

-- ─── SCADA TAGS ───────────────────────────────────────────────────────────────
CREATE TABLE scada_tags (
  id            SERIAL PRIMARY KEY,
  plant_id      INTEGER REFERENCES plants(id) DEFAULT 1,
  tag_name      VARCHAR(200) UNIQUE NOT NULL,
  display_name  VARCHAR(200) NOT NULL,
  opc_node_id   VARCHAR(500),
  unit          VARCHAR(30),
  data_type     VARCHAR(20) DEFAULT 'float',
  category      VARCHAR(50),
  description   TEXT,
  -- alarm thresholds
  alarm_low     NUMERIC(12,4),
  alarm_high    NUMERIC(12,4),
  warn_low      NUMERIC(12,4),
  warn_high     NUMERIC(12,4),
  is_active     BOOLEAN DEFAULT TRUE,
  poll_interval_ms INTEGER DEFAULT 10000,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO scada_tags (tag_name, display_name, opc_node_id, unit, data_type, category, alarm_low, alarm_high, warn_low, warn_high) VALUES
  ('Generator.Power',         'Active Power',           'ns=2;s=Generator.Power',         'kW',   'float', 'generator',  100,   5500,  500,  5000),
  ('Generator.Frequency',     'Frequency',              'ns=2;s=Generator.Frequency',     'Hz',   'float', 'generator',  49.0,  51.0,  49.5, 50.5),
  ('Generator.Voltage_RY',    'Voltage R-Y',            'ns=2;s=Generator.Voltage_RY',    'V',    'float', 'generator',  380,   440,   395,  425),
  ('Generator.Voltage_YB',    'Voltage Y-B',            'ns=2;s=Generator.Voltage_YB',    'V',    'float', 'generator',  380,   440,   395,  425),
  ('Generator.Voltage_BR',    'Voltage B-R',            'ns=2;s=Generator.Voltage_BR',    'V',    'float', 'generator',  380,   440,   395,  425),
  ('Generator.Current_R',     'Current Phase R',        'ns=2;s=Generator.Current_R',     'A',    'float', 'generator',  0,     750,   50,   700),
  ('Generator.Current_Y',     'Current Phase Y',        'ns=2;s=Generator.Current_Y',     'A',    'float', 'generator',  0,     750,   50,   700),
  ('Generator.Current_B',     'Current Phase B',        'ns=2;s=Generator.Current_B',     'A',    'float', 'generator',  0,     750,   50,   700),
  ('Generator.PowerFactor',   'Power Factor',           'ns=2;s=Generator.PowerFactor',   '',     'float', 'generator',  0.7,   1.0,   0.8,  0.99),
  ('Generator.kVAR',          'Reactive Power',         'ns=2;s=Generator.kVAR',          'kVAR', 'float', 'generator',  NULL,  2000,  NULL, 1500),
  ('Generator.Temperature',   'Generator Temperature',  'ns=2;s=Generator.Temperature',   '°C',   'float', 'generator',  NULL,  90,    NULL, 80),
  ('Plant.TotalEnergy',       'Total Energy',           'ns=2;s=Plant.TotalEnergy',       'kWh',  'float', 'plant',      NULL,  NULL,  NULL, NULL),
  ('Plant.WaterLevel',        'Water Level (Forebay)',  'ns=2;s=Plant.WaterLevel',        'm',    'float', 'plant',      5.0,   NULL,  6.0,  NULL),
  ('Turbine.Speed',           'Turbine Speed',          'ns=2;s=Turbine.Speed',           'RPM',  'float', 'turbine',    200,   600,   250,  550);

-- ─── SCADA READINGS ───────────────────────────────────────────────────────────
CREATE TABLE scada_readings (
  id          BIGSERIAL PRIMARY KEY,
  plant_id    INTEGER REFERENCES plants(id) DEFAULT 1,
  tag_id      INTEGER REFERENCES scada_tags(id),
  tag_name    VARCHAR(200) NOT NULL,
  value       NUMERIC(16,6),
  quality     SMALLINT DEFAULT 192,       -- OPC UA quality: 192=Good
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_readings_tag_ts   ON scada_readings (tag_name, timestamp DESC);
CREATE INDEX idx_readings_ts       ON scada_readings (timestamp DESC);
CREATE INDEX idx_readings_plant_ts ON scada_readings (plant_id, timestamp DESC);

-- Partition hint for large deployments (manual partitioning by month)
-- ALTER TABLE scada_readings PARTITION BY RANGE (timestamp);

-- ─── DAILY GENERATION SUMMARY ─────────────────────────────────────────────────
CREATE TABLE daily_generation_summary (
  id                  SERIAL PRIMARY KEY,
  plant_id            INTEGER REFERENCES plants(id) DEFAULT 1,
  date                DATE NOT NULL,
  total_generation_kwh NUMERIC(12,3) DEFAULT 0,
  peak_load_kw        NUMERIC(10,2),
  avg_load_kw         NUMERIC(10,2),
  min_load_kw         NUMERIC(10,2),
  avg_frequency       NUMERIC(6,3),
  min_frequency       NUMERIC(6,3),
  max_frequency       NUMERIC(6,3),
  avg_voltage_ry      NUMERIC(8,2),
  min_voltage         NUMERIC(8,2),
  max_voltage         NUMERIC(8,2),
  avg_power_factor    NUMERIC(5,4),
  avg_water_level     NUMERIC(8,3),
  min_water_level     NUMERIC(8,3),
  downtime_minutes    INTEGER DEFAULT 0,
  alarm_count         INTEGER DEFAULT 0,
  operator_notes      TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (plant_id, date)
);

-- ─── ALARMS ───────────────────────────────────────────────────────────────────
CREATE TYPE alarm_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE alarm_status   AS ENUM ('active', 'acknowledged', 'resolved');

CREATE TABLE alarms (
  id              BIGSERIAL PRIMARY KEY,
  plant_id        INTEGER REFERENCES plants(id) DEFAULT 1,
  tag_name        VARCHAR(200),
  alarm_type      VARCHAR(100) NOT NULL,
  severity        alarm_severity DEFAULT 'warning',
  status          alarm_status   DEFAULT 'active',
  message         TEXT NOT NULL,
  value           NUMERIC(16,6),
  threshold       NUMERIC(16,6),
  triggered_at    TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES users(id),
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alarms_status    ON alarms (status, triggered_at DESC);
CREATE INDEX idx_alarms_plant_ts  ON alarms (plant_id, triggered_at DESC);

-- ─── MAINTENANCE LOGS ─────────────────────────────────────────────────────────
CREATE TABLE maintenance_logs (
  id            SERIAL PRIMARY KEY,
  plant_id      INTEGER REFERENCES plants(id) DEFAULT 1,
  equipment     VARCHAR(200) NOT NULL,
  maintenance_type VARCHAR(50),           -- preventive, corrective, predictive
  description   TEXT,
  performed_by  VARCHAR(150),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  downtime_minutes INTEGER DEFAULT 0,
  cost          NUMERIC(12,2),
  attachments   JSONB DEFAULT '[]',
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── REPORTS ──────────────────────────────────────────────────────────────────
CREATE TABLE reports (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id      INTEGER REFERENCES plants(id) DEFAULT 1,
  report_type   VARCHAR(100) NOT NULL,    -- daily, monthly, alarm_summary, etc.
  title         VARCHAR(255) NOT NULL,
  parameters    JSONB DEFAULT '{}',
  file_path     TEXT,
  generated_by  UUID REFERENCES users(id),
  generated_at  TIMESTAMPTZ DEFAULT NOW(),
  status        VARCHAR(20) DEFAULT 'pending'
);

-- ─── SCADA CONNECTION SETTINGS ────────────────────────────────────────────────
CREATE TABLE scada_settings (
  id              SERIAL PRIMARY KEY,
  plant_id        INTEGER REFERENCES plants(id) DEFAULT 1,
  connection_type VARCHAR(20) DEFAULT 'opcua',   -- opcua, rest, modbus
  endpoint_url    VARCHAR(500),
  poll_interval_ms INTEGER DEFAULT 10000,
  reconnect_delay_ms INTEGER DEFAULT 5000,
  max_retries     INTEGER DEFAULT 10,
  auth_config     JSONB DEFAULT '{}',
  is_active       BOOLEAN DEFAULT TRUE,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO scada_settings (plant_id, connection_type, endpoint_url) VALUES
  (1, 'opcua', 'opc.tcp://localhost:4840');

-- ─── NOTIFICATION SETTINGS ────────────────────────────────────────────────────
CREATE TABLE notification_settings (
  id          SERIAL PRIMARY KEY,
  plant_id    INTEGER REFERENCES plants(id) DEFAULT 1,
  type        VARCHAR(20) NOT NULL,   -- email, whatsapp, sms
  config      JSONB DEFAULT '{}',
  severities  alarm_severity[] DEFAULT '{warning,critical}',
  is_active   BOOLEAN DEFAULT FALSE,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO notification_settings (type, config) VALUES
  ('email',    '{"host":"smtp.example.com","port":587,"user":"","recipients":[]}'),
  ('whatsapp', '{"api_url":"","api_key":"","numbers":[]}'),
  ('sms',      '{"provider":"twilio","sid":"","token":"","numbers":[]}');

-- ─── AUDIT LOGS ───────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id),
  action      VARCHAR(100) NOT NULL,
  resource    VARCHAR(100),
  resource_id TEXT,
  payload     JSONB DEFAULT '{}',
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user_ts ON audit_logs (user_id, created_at DESC);

-- ─── EQUIPMENT RUNTIME ────────────────────────────────────────────────────────
CREATE TABLE equipment_runtime (
  id              SERIAL PRIMARY KEY,
  plant_id        INTEGER REFERENCES plants(id) DEFAULT 1,
  equipment_name  VARCHAR(150) NOT NULL,
  total_hours     NUMERIC(10,2) DEFAULT 0,
  last_started_at TIMESTAMPTZ,
  last_stopped_at TIMESTAMPTZ,
  maintenance_due_hours NUMERIC(10,2),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO equipment_runtime (equipment_name, maintenance_due_hours) VALUES
  ('Generator Unit 1', 5000),
  ('Turbine Unit 1',   5000),
  ('Main Transformer', 8760),
  ('Exciter',          2000);

-- ─── HELPER FUNCTION: updated_at trigger ──────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at              BEFORE UPDATE ON users              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_daily_summary_updated_at      BEFORE UPDATE ON daily_generation_summary FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_scada_settings_updated_at     BEFORE UPDATE ON scada_settings     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_notification_settings_updated BEFORE UPDATE ON notification_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_equipment_runtime_updated     BEFORE UPDATE ON equipment_runtime  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
