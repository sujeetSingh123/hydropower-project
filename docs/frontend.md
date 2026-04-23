# Frontend Architecture

Framework: **React 18** · Language: **TypeScript** · Build: **Create React App**

---

## Application Shell

```
index.tsx
  └── <App />
        └── <BrowserRouter>
              ├── /login          <Login />          (public)
              └── <ProtectedRoute>
                    └── <Layout>
                          ├── <Sidebar />
                          ├── <Header />
                          └── <Outlet>
                                ├── /                <Dashboard />
                                ├── /alarms          <Alarms />
                                ├── /historical      <Historical />
                                ├── /reports         <Reports />    (requires reports:generate)
                                └── /admin           <Admin />      (requires admin:manage)
```

### Protected Route Logic

`ProtectedRoute` checks the Zustand auth store on every render:
- No token → redirect to `/login`
- Has token but missing required permission → redirect to `/`
- Otherwise → render children

---

## State Architecture

```
┌─────────────────────────────────────────────────────┐
│                 State Layers                        │
│                                                     │
│  ┌─────────────────────┐  Persisted to localStorage │
│  │   Zustand           │  token, user, permissions  │
│  │   authStore         │  setAuth(), logout()        │
│  │                     │  hasPermission()            │
│  └─────────────────────┘                            │
│                                                     │
│  ┌─────────────────────┐  Server state cache        │
│  │   React Query       │  stale-while-revalidate    │
│  │   (TanStack)        │  background refetch        │
│  │                     │  error/loading states      │
│  └─────────────────────┘                            │
│                                                     │
│  ┌─────────────────────┐  Live streaming            │
│  │   useSocket hook    │  Socket.IO events          │
│  │   + local useState  │  rolling window arrays     │
│  └─────────────────────┘                            │
└─────────────────────────────────────────────────────┘
```

### When to use which

| Data type | Layer | Reason |
|---|---|---|
| Auth token / user / permissions | Zustand | Must survive navigation + page refresh |
| REST API data (alarms, reports, history) | React Query | Caching, background sync, deduplication |
| Live sensor readings (dashboard) | useSocket + useState | Push-based, not request-response |
| Form state | Local `useState` | Ephemeral, component-scoped |

---

## Component Tree

```
Layout
  ├── Sidebar
  │     ├── Navigation links (filtered by permissions)
  │     └── User info card (username, role badge)
  │
  ├── Header
  │     ├── SCADA status indicator  (green/red dot)
  │     ├── Active alarm count badge
  │     └── Logout button
  │
  └── <Outlet> (one of the pages below)
```

### Dashboard

```
Dashboard
  ├── KPICard × 7         (power, frequency, voltage, current, PF, water level, temp)
  ├── LiveChart × 2       (active power, frequency — rolling 60 points)
  ├── GenerationChart     (30-day bar + line: generation vs. capacity)
  └── AlarmPanel          (active alarms, quick acknowledge)
```

### Alarms

```
Alarms
  ├── Stats row           (total / active / acknowledged / resolved)
  ├── Filter bar          (status, severity dropdowns)
  ├── Alarm table         (paginated, sortable columns)
  │     └── Row actions   (Acknowledge button, Notes modal)
  └── Pagination controls
```

### Historical

```
Historical
  ├── Tag selector        (multi-select checkboxes)
  ├── Date range picker
  ├── Bucket selector     (5 min / 1 hour / 1 day)
  ├── Recharts LineChart  (one series per tag, toggleable)
  └── Raw data table      (avg / min / max per bucket)
```

### Reports

```
Reports
  ├── Report type tabs    (Daily / Monthly)
  ├── Date picker
  ├── Format selector     (Excel / PDF)
  ├── Generate button     → POST /api/reports/daily|monthly → file download
  ├── Summary KPI row     (energy, peak power, availability)
  ├── Trend chart         (daily generation bar chart)
  └── Report history list
```

### Admin (5 panels, tab-based)

```
Admin
  ├── SCADA Settings      (endpoint URL, mode, polling interval, connect/disconnect)
  ├── Tag Manager         (inline-editable table, add/delete tags)
  ├── User Management     (create users, enable/disable, role assignment)
  ├── Notifications       (per-channel toggles: email, WhatsApp, SMS)
  └── System Status       (poller health, last poll time, error count)
```

---

## API Service Layer

`src/services/api.ts` — single Axios instance shared by all pages.

```
api (axios instance)
  │  baseURL: /api
  │  interceptors:
  │    request → attach Authorization header from authStore
  │    response → on 401 → authStore.logout() → redirect /login
  │
  ├── auth.login(credentials)
  ├── auth.me()
  ├── auth.changePassword(data)
  ├── auth.getUsers()
  ├── auth.createUser(data)
  ├── auth.updateUser(id, data)
  │
  ├── readings.getLive()
  ├── readings.getHistory(params)
  ├── readings.getAggregated(params)
  ├── readings.getDailySummaries(params)
  │
  ├── alarms.getAlarms(params)
  ├── alarms.getStats()
  ├── alarms.acknowledge(id, notes)
  ├── alarms.addNotes(id, notes)
  │
  ├── reports.generateDaily(params)
  ├── reports.generateMonthly(params)
  ├── reports.getReports()
  │
  └── admin.getScadaSettings()
      admin.updateScadaSettings(data)
      admin.getTags()
      admin.createTag(data)
      admin.updateTag(id, data)
      admin.deleteTag(id)
      admin.getPollerStatus()
      admin.triggerDailySummary()
      admin.getNotificationSettings()
      admin.updateNotificationSettings(data)
      admin.getAuditLogs(params)
```

---

## Real-time Hook

`src/hooks/useSocket.ts`

```typescript
// Module-level singleton — one connection shared across the app
let socket: Socket | null = null;

function getSocket(): Socket          // lazy-init, auto-reconnect
function subscribe<T>(event, cb): () => void  // returns unsubscribe fn

// High-level hook used by Dashboard
function useLiveData(): {
  readings: SensorReading[];
  alarms: AlarmRow[];
  pollerStatus: PollerStatus | null;
  connected: boolean;
}
```

The singleton pattern ensures only one WebSocket connection exists regardless of how many components call `useLiveData()`.

---

## Routing & Permissions Matrix

| Route | Component | Required Permission |
|---|---|---|
| `/login` | `Login` | None |
| `/` | `Dashboard` | `readings:read` |
| `/alarms` | `Alarms` | `alarms:read` |
| `/historical` | `Historical` | `readings:read` |
| `/reports` | `Reports` | `reports:generate` |
| `/admin` | `Admin` | `admin:manage` |

Sidebar links are filtered client-side using `hasPermission()` from the auth store, so users only see routes they can access.

---

## TypeScript Type System (Frontend)

All domain types live in `src/types/index.ts` and are imported by every component and service.

```
src/types/
  ├── index.ts          Domain interfaces (User, Alarm, SensorReading, …)
  └── declarations.d.ts CSS module wildcard declaration
```

Key interfaces:

```typescript
interface User {
  id: number;
  username: string;
  role: 'admin' | 'operator' | 'viewer';
  permissions: string[];
  email?: string;
  fullName?: string;
}

interface SensorReading {
  tag_name: string;
  value: number;
  unit: string;
  timestamp: string;
  quality: 'good' | 'bad' | 'uncertain';
}

interface Alarm {
  id: number;
  tag_name: string;
  alarm_type: 'high' | 'low' | 'no_data';
  severity: 'info' | 'warning' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved';
  value_at_trigger: number;
  threshold_value: number;
  triggered_at: string;
  acknowledged_by: number | null;
  notes: string | null;
}

interface AggregatedReading {
  bucket: string;
  tag_name: string;
  avg_value: number;
  min_value: number;
  max_value: number;
}
```
