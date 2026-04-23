# System Architecture

## Overview

The system is a layered, full-stack SCADA monitoring platform. Physical sensors and PLCs are polled via OPC UA (or a built-in simulator), readings are stored in PostgreSQL, and live data is streamed to the React frontend over WebSockets.

```
┌─────────────────────────────────────────────────────────────────┐
│                        PHYSICAL LAYER                           │
│   Turbines · Generators · Water Level Sensors · Flow Meters     │
│               │ OPC UA / Modbus / REST                          │
└───────────────┼─────────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────────┐
│                      BACKEND (Node.js / Express)                │
│                                                                 │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────────────┐  │
│  │ SCADA Poller │  │ Daily Summary │  │   Express REST API  │  │
│  │  (Worker)    │  │  Cron Worker  │  │   + Socket.IO       │  │
│  └──────┬───────┘  └───────┬───────┘  └──────────┬──────────┘  │
│         │                  │                      │             │
│  ┌──────▼──────────────────▼──────────────────────▼──────────┐  │
│  │              Service Layer                                 │  │
│  │  Auth · Alarm · SCADA · Notification · Report             │  │
│  └──────────────────────┬─────────────────────────────────── ┘  │
│                         │                                       │
│  ┌──────────────────────▼─────────────────────────────────────┐ │
│  │           Data Layer (PostgreSQL + Redis)                   │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                │ HTTP / WebSocket
┌───────────────▼─────────────────────────────────────────────────┐
│                     FRONTEND (React / Vite)                     │
│                                                                 │
│   Dashboard · Alarms · Historical · Reports · Admin             │
│   Zustand (auth) · React Query (server state) · Recharts        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Backend

| Concern | Technology | Version |
|---|---|---|
| Runtime | Node.js | 20+ |
| Framework | Express | 4.19 |
| Language | TypeScript | 5.x |
| Real-time | Socket.IO | 4.7 |
| Database | PostgreSQL | 16 |
| Cache | Redis (ioredis) | 5.4 |
| SCADA protocol | OPC UA (node-opcua) | 2.118 |
| Authentication | JWT (jsonwebtoken) | 9.x |
| Password hashing | bcryptjs | 2.4 |
| Request validation | express-validator | 7.1 |
| Logging | Winston + daily-rotate | 3.x |
| Job scheduling | node-cron | 3.x |
| Excel reports | ExcelJS | 4.x |
| PDF reports | PDFKit | 0.15 |
| Security headers | Helmet | 7.x |

### Frontend

| Concern | Technology | Version |
|---|---|---|
| Framework | React | 18.3 |
| Language | TypeScript | 5.x |
| Routing | React Router DOM | 6.x |
| Server state | TanStack React Query | 5.x |
| Client state | Zustand | 4.x |
| HTTP client | Axios | 1.7 |
| Real-time | Socket.IO Client | 4.7 |
| Charts | Recharts | 2.x |
| Styling | Tailwind CSS | 3.x |
| Notifications | react-hot-toast | 2.x |
| Date utilities | date-fns | 3.x |

### Infrastructure

| Concern | Technology |
|---|---|
| Container orchestration | Docker Compose |
| Reverse proxy | Nginx |
| Database | PostgreSQL 16 (containerized) |
| Cache / pub-sub | Redis 7 (containerized) |

---

## Layered Architecture (Backend)

```
┌─────────────────────────────────────────────────────────────┐
│  HTTP Request / Socket Event                                │
├─────────────────────────────────────────────────────────────┤
│  Middleware Chain                                           │
│    helmet → cors → morgan → rate-limit → json-parser       │
│    → authenticateToken → requirePermission                  │
├─────────────────────────────────────────────────────────────┤
│  Router Layer                                               │
│    /api/auth  /api/readings  /api/alarms                    │
│    /api/admin  /api/reports  /health                        │
├─────────────────────────────────────────────────────────────┤
│  Controller Layer                                           │
│    Input validation → call service → format response        │
├─────────────────────────────────────────────────────────────┤
│  Service Layer                                              │
│    Business logic, orchestration, cross-cutting concerns    │
├─────────────────────────────────────────────────────────────┤
│  Repository Layer                                           │
│    SQL queries, typed pg results                            │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL                                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Role-Based Access Control

Three roles are enforced on every protected route via the `requirePermission` middleware.

| Permission | Admin | Operator | Viewer |
|---|:---:|:---:|:---:|
| `readings:read` | ✓ | ✓ | ✓ |
| `alarms:read` | ✓ | ✓ | ✓ |
| `alarms:acknowledge` | ✓ | ✓ | — |
| `reports:generate` | ✓ | ✓ | — |
| `admin:manage` | ✓ | — | — |
| `users:manage` | ✓ | — | — |

---

## SCADA Adapter Pattern

The `ScadaService` uses a runtime-selectable adapter so the same poller code works against real hardware or a built-in simulator.

```
ScadaService
    │
    ├─── OpcUaAdapter      (node-opcua, connects to real PLCs)
    │
    └─── SimulatorAdapter  (deterministic + drift, used in dev/demo)
```

The active adapter is chosen at startup from `SCADA_MODE` env var (`opcua` | `simulator`). Adding a Modbus or REST adapter only requires implementing the `IScadaAdapter` interface.

```typescript
interface IScadaAdapter {
  connect(): Promise<void>;
  readTags(tags: ActiveTag[]): Promise<SensorReading[]>;
  disconnect(): Promise<void>;
}
```

---

## Directory Structure

```
hydropower-project/
├── client/                      # React frontend
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── Dashboard/       # KPI cards, live charts, alarm panel
│   │   │   └── Layout/          # Shell: sidebar, header, outlet
│   │   ├── hooks/               # useSocket — WebSocket hook
│   │   ├── pages/               # Route-level views
│   │   ├── services/            # Axios API client
│   │   ├── store/               # Zustand auth store
│   │   └── types/               # Shared TypeScript interfaces
│   ├── tsconfig.json
│   └── package.json
│
├── server/                      # Express backend
│   ├── src/
│   │   ├── config/              # env.ts, database.ts
│   │   ├── controllers/         # Request handlers
│   │   ├── middleware/          # auth.ts, errorHandler.ts
│   │   ├── repositories/        # SQL queries
│   │   ├── routes/              # Route definitions
│   │   ├── services/            # Business logic
│   │   ├── types/               # Domain interfaces
│   │   ├── utils/               # Winston logger
│   │   ├── workers/             # scadaPoller, dailySummary
│   │   └── index.ts             # App entry point
│   ├── migrations/              # SQL schema files
│   ├── seeds/                   # Database seed script
│   ├── tsconfig.json
│   └── package.json
│
├── docker/                      # Dockerfiles + nginx.conf
├── docker-compose.yml
└── docs/                        # This documentation
```
