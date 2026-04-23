# Data Flow

## 1. Live SCADA Data Flow

The SCADA poller runs as a background worker and is the origin of all sensor data in the system.

```
┌─────────┐     poll every N sec     ┌──────────────┐
│  PLC /  │ ◄──────────────────────► │ ScadaPoller  │
│  OPC UA │    (configurable interval)│   Worker     │
└─────────┘                          └──────┬───────┘
                                            │
                              ┌─────────────▼─────────────┐
                              │  ScadaService.readTags()   │
                              │  (OpcUaAdapter or Sim)     │
                              └─────────────┬─────────────┘
                                            │ SensorReading[]
                              ┌─────────────▼─────────────┐
                              │  Bulk INSERT               │
                              │  scada_readings table      │
                              └─────────────┬─────────────┘
                                            │
                         ┌──────────────────┼──────────────────┐
                         │                  │                  │
              ┌──────────▼───────┐ ┌────────▼────────┐ ┌──────▼──────────┐
              │  AlarmService    │ │  Socket.IO       │ │  Redis (cache)  │
              │  .evaluate()     │ │  broadcast       │ │  latest values  │
              │  threshold check │ │  live_data event │ └─────────────────┘
              └──────────┬───────┘ └────────┬────────┘
                         │                  │
              ┌──────────▼───────┐ ┌────────▼────────┐
              │  INSERT alarm    │ │  React Dashboard │
              │  if threshold    │ │  re-renders KPIs │
              │  exceeded        │ │  + live charts   │
              └──────────────────┘ └─────────────────┘
```

### Poller Sequence

```
ScadaPoller          ScadaService         Database            Socket.IO
    │                     │                   │                   │
    │── readTags(active) ─►│                   │                   │
    │                     │── OPC UA read ────►│                   │
    │◄── SensorReading[] ─│                   │                   │
    │                     │                   │                   │
    │── bulkInsert ───────────────────────────►│                   │
    │                     │                   │                   │
    │── evaluateAlarms ──►│                   │                   │
    │                     │── INSERT alarm ──►│                   │
    │                     │                   │                   │
    │── broadcast ─────────────────────────────────────────────── ►│
    │                     │                   │         live_data event
    │                     │                   │         to all clients
```

---

## 2. Authentication Flow

```
Browser                   Express API               PostgreSQL
   │                           │                        │
   │── POST /api/auth/login ──►│                        │
   │   { username, password }  │                        │
   │                           │── SELECT user ─────── ►│
   │                           │◄── UserRow ────────────│
   │                           │                        │
   │                           │  bcrypt.compare()      │
   │                           │  (password vs hash)    │
   │                           │                        │
   │                           │  jwt.sign(payload)     │
   │                           │  { userId, role,       │
   │                           │    permissions[] }     │
   │                           │                        │
   │◄── 200 { token, user } ──│                        │
   │                           │                        │
   │  Store token in           │                        │
   │  Zustand (localStorage)   │                        │
   │                           │                        │
   │── GET /api/readings/live  │                        │
   │   Authorization: Bearer…  │                        │
   │                           │  jwt.verify(token)     │
   │                           │  attach req.user       │
   │                           │  requirePermission     │
   │                           │  ('readings:read')     │
   │◄── 200 { data }  ────────│                        │
```

### Token Payload Shape

```typescript
interface JwtPayload {
  userId: number;
  username: string;
  role: 'admin' | 'operator' | 'viewer';
  permissions: string[];
}
```

---

## 3. Alarm Lifecycle

```
                    New sensor reading arrives
                             │
                    ┌────────▼────────┐
                    │ Load thresholds │
                    │ for tag from DB │
                    └────────┬────────┘
                             │
              ┌──────────────▼──────────────┐
              │     value > threshold?       │
              └──────────────┬──────────────┘
                    No        │ Yes
                    │         │
                    │  ┌──────▼──────────────────────┐
                    │  │  Is there already an ACTIVE  │
                    │  │  alarm for this tag?         │
                    │  └──────┬──────────────────────┘
                    │    Yes  │ No
                    │    │    │
                    │    │  ┌─▼───────────────────────┐
                    │    │  │  INSERT alarm record     │
                    │    │  │  severity: info/warning/ │
                    │    │  │  critical (by deviation) │
                    │    │  │  status: active          │
                    │    │  └─┬───────────────────────┘
                    │    │    │
                    │    │  ┌─▼───────────────────────┐
                    │    │  │  NotificationService     │
                    │    │  │  .send() → email/SMS     │
                    │    │  └─────────────────────────┘
                    │    │
              ┌─────▼────▼─────────────────────────┐
              │  value back within range?           │
              │  → UPDATE alarm SET status='resolved'│
              └─────────────────────────────────────┘
```

### Alarm Severity Matrix

| Deviation from Threshold | Severity |
|---|---|
| 0 – 10 % | `info` |
| 10 – 25 % | `warning` |
| > 25 % | `critical` |

### Alarm Status Transitions

```
active ──── acknowledged ──── resolved
  │                               ▲
  └───────────────────────────────┘
       (auto-resolve when value
        returns within range)
```

---

## 4. Historical Data Query Flow

```
React (Historical page)        Express API            PostgreSQL
        │                           │                      │
        │  Select tags + time range │                      │
        │  Select bucket size       │                      │
        │                           │                      │
        │── GET /api/readings/      │                      │
        │   aggregated?             │                      │
        │   tags=power,voltage&     │                      │
        │   from=…&to=…&            │                      │
        │   bucket=1hour            │                      │
        │                           │── SELECT             │
        │                           │   time_bucket(       │
        │                           │     '1 hour',        │
        │                           │     timestamp        │
        │                           │   ),                 │
        │                           │   AVG(value),        │
        │                           │   MIN(value),        │
        │                           │   MAX(value)         │
        │                           │   FROM scada_readings│
        │                           │   WHERE tag IN (…)   │
        │                           │   GROUP BY 1, tag    │
        │                           │   ORDER BY 1         │
        │                           │◄── AggregatedReading[]│
        │◄── 200 { data[] } ───────│                      │
        │                           │                      │
        │  Recharts renders         │                      │
        │  multi-tag line chart     │                      │
```

---

## 5. Report Generation Flow

### Daily Cron (00:05 every night)

```
node-cron (00:05)
       │
       ▼
dailySummary Worker
       │
       ├── Query previous day's readings
       │   AVG(power), SUM(energy_kwh),
       │   MIN/MAX(water_level), etc.
       │
       ├── Query alarm counts by severity
       │
       ├── INSERT daily_generation_summary
       │
       └── Done (no notification by default)
```

### On-Demand Report (user request)

```
User clicks "Generate Report"
          │
          ▼
POST /api/reports/daily  (or /monthly)
          │
          ▼
ReportService.generateDailyReport()
          │
    ┌─────┴──────┐
    │            │
    ▼            ▼
ExcelJS        PDFKit
workbook       document
    │            │
    └─────┬──────┘
          │
    Stream file to browser
    (Content-Disposition: attachment)
```

### Report Contents

| Section | Excel | PDF |
|---|:---:|:---:|
| Summary KPIs (energy, peak power, uptime) | ✓ | ✓ |
| Hourly generation table | ✓ | ✓ |
| Alarm summary by severity | ✓ | ✓ |
| Sensor readings table | ✓ | — |
| Charts (generation trend) | — | ✓ |

---

## 6. WebSocket Live Data Flow

```
Server (Socket.IO)               Client (useSocket hook)
        │                                   │
        │  on connect                       │
        │◄──────────────────────────────────│
        │  emit: connection_ack             │
        │──────────────────────────────────►│
        │                                   │
        │  [SCADA poller fires]             │
        │  emit: live_data                  │
        │  { readings: [...],               │
        │    alarms: [...],                 │
        │    pollerStatus: {...} }          │
        │──────────────────────────────────►│
        │                                   │  Dashboard re-renders:
        │                                   │  KPI cards update
        │                                   │  LiveChart appends point
        │                                   │  AlarmPanel refreshes
        │  [repeat every poll interval]     │
        │──────────────────────────────────►│
        │                                   │
        │  on disconnect / error            │
        │  client shows "SCADA Disconnected"│
        │  indicator in Header              │
```

### Socket Events

| Event | Direction | Payload |
|---|---|---|
| `connection` | Client → Server | — |
| `connection_ack` | Server → Client | `{ message: string }` |
| `live_data` | Server → Client | `LiveDataPayload` |
| `disconnect` | Client → Server | — |

```typescript
interface LiveDataPayload {
  readings: SensorReading[];
  alarms: AlarmRow[];
  pollerStatus: PollerStatus;
}
```
