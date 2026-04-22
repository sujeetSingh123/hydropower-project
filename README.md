# Hydropower Plant Monitoring System

A production-ready full-stack SCADA data acquisition, monitoring, and reporting platform for hydropower plants. Replaces manual Excel data entry with automated real-time data collection, dashboards, alarms, and reports.

## Architecture

```
Sensors / PLCs / Meters
    └─> SCADA / PLC
         └─> OPC UA (or REST / Modbus)
              └─> Node.js Backend (Express + Socket.IO)
                   ├─> PostgreSQL (time-series readings + summaries)
                   ├─> Redis (optional caching)
                   └─> React Frontend (real-time dashboard)
```

## Tech Stack

| Layer      | Technology                              |
|------------|------------------------------------------|
| Frontend   | React 18, Tailwind CSS, Recharts, Zustand, React Query |
| Backend    | Node.js 20, Express, Socket.IO           |
| Database   | PostgreSQL 16                            |
| SCADA      | node-opcua (OPC UA client), Simulator    |
| Auth       | JWT (RS256-compatible, HS256 default)    |
| Reports    | ExcelJS (xlsx), PDFKit (PDF)             |
| Deployment | Docker + Docker Compose                  |

## Quick Start (Docker)

```bash
# 1. Clone and configure
cp server/.env.example server/.env
# Edit server/.env — set JWT_SECRET, POSTGRES_PASSWORD at minimum

# 2. Start all services
docker compose up -d

# 3. Wait for postgres health, then seed
docker compose exec server node seeds/seed.js

# 4. Open browser
open http://localhost
```

## Local Development

### Prerequisites
- Node.js 20+
- PostgreSQL 16
- Redis (optional — not required for basic operation)

### Backend

```bash
cd server
cp .env.example .env        # edit as needed
npm install
# Apply schema
psql -U hydro_user -d hydropower -f migrations/001_initial_schema.sql
# Seed demo data
node seeds/seed.js
# Start dev server (with nodemon)
npm run dev
```

### Frontend

```bash
cd client
npm install
npm start          # starts on http://localhost:3000
```

## Default Credentials

| Role     | Email                          | Password       |
|----------|-------------------------------|----------------|
| Admin    | admin@hydropower.local        | Admin@123      |
| Operator | operator@hydropower.local     | Operator@123   |
| Viewer   | viewer@hydropower.local       | Viewer@123     |

## SCADA Configuration

### Simulator Mode (default)
Set `SCADA_SIMULATOR=true` in `.env`. The system generates realistic synthetic data for all 14 tags — no hardware needed.

### OPC UA (real SCADA)
```env
SCADA_SIMULATOR=false
OPC_UA_ENDPOINT=opc.tcp://your-scada-server:4840
POLL_INTERVAL_MS=10000
```

Tag node IDs are configured per-tag in the `scada_tags` table (admin panel → Tags).

### REST API / Modbus
Extend `server/src/services/scada.service.js` — add a new class implementing `connect()`, `readTags()`, `disconnect()`, and switch the `_mode` in `ScadaService`.

## Feature Overview

### Dashboard
- Live KPI cards: Power, Frequency, Voltage (3-phase), Current (3-phase), Power Factor, kVAR, Water Level, Turbine Speed, Temperature
- Energy meter (total kWh)
- Real-time rolling charts via WebSocket (Socket.IO)
- Active alarm panel
- 30-day generation trend chart

### Alarm System
- Configurable per-tag thresholds: alarm_low, alarm_high, warn_low, warn_high
- Severity levels: critical / warning / info
- Auto-resolve when value returns to normal
- Acknowledge with user attribution
- No-data alarm after consecutive poll failures
- Notification service abstraction (email / WhatsApp / SMS — configure credentials in DB)

### Reports
- Daily report: summary KPIs + hourly readings + alarms
- Monthly report: per-day summary table + trend chart
- Export formats: Excel (.xlsx), PDF
- Triggered manually or via cron (daily at 00:05)

### Historical
- Multi-tag time-series chart
- Configurable aggregation bucket (1 min to 1 hour)
- Raw data table with paginated export

### Admin Panel
- SCADA connection settings
- Tag management (thresholds, node IDs, enable/disable)
- User management (create, enable/disable, role assignment)
- Notification settings (email, WhatsApp, SMS)
- Poller status + manual daily summary trigger

## API Reference

```
POST   /api/auth/login
GET    /api/auth/me
POST   /api/auth/users              (admin)
GET    /api/auth/users              (admin)

GET    /api/readings/live
GET    /api/readings/history?tagName=&from=&to=
GET    /api/readings/aggregated?tagName=&from=&to=&bucket=60
GET    /api/readings/summaries?from=&to=

GET    /api/alarms?status=&severity=&limit=&offset=
GET    /api/alarms/stats
PATCH  /api/alarms/:id/acknowledge  (operator+)

GET    /api/reports/daily?date=&format=json|excel|pdf
GET    /api/reports/monthly?year=&month=&format=json|excel
GET    /api/reports/alarms?from=&to=

GET    /api/admin/scada-settings    (admin)
PATCH  /api/admin/scada-settings    (admin)
GET    /api/admin/tags
PATCH  /api/admin/tags/:id          (admin)
POST   /api/admin/tags              (admin)
GET    /api/admin/poller/status
POST   /api/admin/daily-summary     (admin)
GET    /api/admin/notifications     (admin)
GET    /api/admin/audit-logs        (admin)

GET    /api/health
```

## Database Schema

Key tables:
- `scada_tags` — tag definitions, node IDs, thresholds
- `scada_readings` — raw time-series values (indexed on tag+timestamp)
- `daily_generation_summary` — pre-aggregated daily KPIs
- `alarms` — alarm history with severity, status, acknowledgement
- `users` / `roles` — authentication and RBAC
- `maintenance_logs` — equipment maintenance records
- `equipment_runtime` — cumulative runtime tracking
- `audit_logs` — user action audit trail
- `notification_settings` — email/WhatsApp/SMS config
- `scada_settings` — SCADA connection parameters

## Environment Variables

See `server/.env.example` for the full list. Key variables:

| Variable           | Description                              | Default         |
|--------------------|------------------------------------------|-----------------|
| `JWT_SECRET`       | **Change in production**                 | dev_secret      |
| `DATABASE_URL`     | PostgreSQL connection string             | —               |
| `SCADA_SIMULATOR`  | Use built-in data simulator              | `true`          |
| `OPC_UA_ENDPOINT`  | OPC UA server endpoint                   | localhost:4840  |
| `POLL_INTERVAL_MS` | SCADA polling frequency                  | `10000`         |

## Folder Structure

```
hydropower-project/
├── client/
│   └── src/
│       ├── components/
│       │   ├── Dashboard/   KPICard, LiveChart, AlarmPanel, GenerationChart
│       │   └── Layout/      Sidebar, Header, Layout
│       ├── hooks/           useSocket, useLiveData
│       ├── pages/           Dashboard, Alarms, Reports, Historical, Admin, Login
│       ├── services/        api.js (axios client)
│       └── store/           authStore (zustand + persist)
├── server/
│   ├── migrations/          001_initial_schema.sql
│   ├── seeds/               seed.js
│   └── src/
│       ├── config/          database.js, env.js
│       ├── controllers/     auth, readings, alarms, reports, admin
│       ├── middleware/       auth (JWT), errorHandler
│       ├── repositories/    readings
│       ├── routes/          index, auth, readings, alarms, reports, admin
│       ├── services/        auth, scada, alarm, report, notification
│       ├── utils/           logger (winston)
│       └── workers/         scadaPoller, dailySummary (cron)
└── docker/
    ├── Dockerfile.server
    ├── Dockerfile.client
    └── nginx.conf
```

## Extending the System

### Add a new SCADA tag
1. Insert into `scada_tags` via admin panel (or SQL)
2. Set OPC UA `opc_node_id` to the server's node ID
3. The poller picks it up automatically on the next cycle

### Add Modbus support
Implement a `ModbusScadaClient` in `scada.service.js` using the `modbus-serial` npm package, mirroring the `OpcUaScadaClient` interface.

### Add REST API historian support
Implement `RestScadaClient` that hits your historian's HTTP API and maps the response to the `{ tag_name, value, quality, timestamp }` shape.

### Enable email alarms
1. Configure SMTP in `.env`
2. Admin → Notifications → Email → Enable + enter SMTP config
3. Implement `_sendEmail()` in `notification.service.js` using `nodemailer`
