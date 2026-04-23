# API Reference

Base URL: `http://localhost:3001/api`

All protected endpoints require `Authorization: Bearer <jwt_token>`.

---

## Health Check

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | None | Service health + DB connectivity |

**Response**
```json
{
  "status": "ok",
  "timestamp": "2026-04-23T10:00:00.000Z",
  "database": "connected"
}
```

---

## Authentication

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `POST` | `/auth/login` | None | — | Obtain JWT token |
| `GET` | `/auth/me` | JWT | — | Current user profile |
| `POST` | `/auth/change-password` | JWT | — | Change own password |
| `GET` | `/auth/users` | JWT | `users:manage` | List all users |
| `POST` | `/auth/users` | JWT | `users:manage` | Create a user |
| `PUT` | `/auth/users/:id` | JWT | `users:manage` | Update a user |
| `DELETE` | `/auth/users/:id` | JWT | `users:manage` | Deactivate a user |

### POST /auth/login

**Request**
```json
{ "username": "admin", "password": "admin123" }
```

**Response 200**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "permissions": ["readings:read", "alarms:read", "alarms:acknowledge", "reports:generate", "admin:manage", "users:manage"]
  }
}
```

---

## Readings

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `GET` | `/readings/live` | JWT | `readings:read` | Latest value per tag |
| `GET` | `/readings/history` | JWT | `readings:read` | Raw time-series for one tag |
| `GET` | `/readings/aggregated` | JWT | `readings:read` | Bucketed time-series (multi-tag) |
| `GET` | `/readings/daily-summaries` | JWT | `readings:read` | Daily aggregation records |

### GET /readings/live

No query params required.

**Response**
```json
[
  { "tag_name": "active_power", "value": 4850.2, "unit": "kW", "timestamp": "…", "quality": "good" },
  { "tag_name": "frequency",    "value": 50.01,  "unit": "Hz", "timestamp": "…", "quality": "good" }
]
```

### GET /readings/history

| Query Param | Type | Required | Description |
|---|---|---|---|
| `tag` | string | Yes | SCADA tag name |
| `from` | ISO 8601 | Yes | Start of range |
| `to` | ISO 8601 | Yes | End of range |
| `limit` | number | No | Max rows (default 1000) |

### GET /readings/aggregated

| Query Param | Type | Required | Description |
|---|---|---|---|
| `tags` | comma-separated | Yes | One or more tag names |
| `from` | ISO 8601 | Yes | Start of range |
| `to` | ISO 8601 | Yes | End of range |
| `bucket` | string | No | `5min` `1hour` `1day` (default `1hour`) |

**Response**
```json
[
  {
    "bucket": "2026-04-23T09:00:00.000Z",
    "tag_name": "active_power",
    "avg_value": 4780.5,
    "min_value": 4650.0,
    "max_value": 4900.0
  }
]
```

### GET /readings/daily-summaries

| Query Param | Type | Required | Description |
|---|---|---|---|
| `from` | ISO 8601 | No | Start date |
| `to` | ISO 8601 | No | End date |
| `limit` | number | No | Max rows (default 30) |

---

## Alarms

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `GET` | `/alarms` | JWT | `alarms:read` | Paginated alarm list |
| `GET` | `/alarms/stats` | JWT | `alarms:read` | Counts by status & severity |
| `POST` | `/alarms/:id/acknowledge` | JWT | `alarms:acknowledge` | Acknowledge an alarm |
| `POST` | `/alarms/:id/notes` | JWT | `alarms:acknowledge` | Add a note to an alarm |

### GET /alarms

| Query Param | Type | Default | Description |
|---|---|---|---|
| `status` | `active` \| `acknowledged` \| `resolved` | — | Filter by status |
| `severity` | `info` \| `warning` \| `critical` | — | Filter by severity |
| `from` | ISO 8601 | — | Triggered after |
| `to` | ISO 8601 | — | Triggered before |
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Page size |

**Response**
```json
{
  "data": [
    {
      "id": 42,
      "tag_name": "active_power",
      "alarm_type": "high",
      "severity": "critical",
      "status": "active",
      "value_at_trigger": 5400.0,
      "threshold_value": 5000.0,
      "triggered_at": "2026-04-23T08:30:00.000Z",
      "acknowledged_by": null,
      "notes": null
    }
  ],
  "total": 148,
  "page": 1,
  "limit": 20
}
```

### GET /alarms/stats

```json
{
  "total": 148,
  "active": 3,
  "acknowledged": 12,
  "resolved": 133,
  "by_severity": {
    "critical": 5,
    "warning": 28,
    "info": 115
  }
}
```

### POST /alarms/:id/acknowledge

**Request**
```json
{ "notes": "Investigated — within acceptable transient range" }
```

---

## Reports

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `POST` | `/reports/daily` | JWT | `reports:generate` | Generate daily report (Excel or PDF) |
| `POST` | `/reports/monthly` | JWT | `reports:generate` | Generate monthly report |
| `GET` | `/reports` | JWT | `reports:generate` | List previously generated reports |

### POST /reports/daily

**Request**
```json
{ "date": "2026-04-22", "format": "excel" }
```

`format`: `"excel"` or `"pdf"`.

**Response**: Binary file stream with `Content-Disposition: attachment`.

### POST /reports/monthly

**Request**
```json
{ "year": 2026, "month": 4, "format": "pdf" }
```

---

## Admin

All admin endpoints require `admin:manage` permission.

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/scada-settings` | Get SCADA connection settings |
| `PUT` | `/admin/scada-settings` | Update SCADA settings |
| `GET` | `/admin/tags` | List all SCADA tags |
| `POST` | `/admin/tags` | Create a new tag |
| `PUT` | `/admin/tags/:id` | Update a tag |
| `DELETE` | `/admin/tags/:id` | Delete a tag |
| `GET` | `/admin/poller-status` | Live poller health |
| `POST` | `/admin/daily-summary` | Manually trigger daily summary |
| `GET` | `/admin/notifications` | Get notification settings |
| `PUT` | `/admin/notifications` | Update notification settings |
| `GET` | `/admin/audit-logs` | Paginated audit log |

### SCADA Tag Object

```json
{
  "id": 7,
  "tag_name": "active_power",
  "display_name": "Active Power",
  "unit": "kW",
  "data_type": "float",
  "opc_node_id": "ns=2;s=Generator.ActivePower",
  "high_limit": 5000,
  "low_limit": 0,
  "warning_high": 4800,
  "warning_low": 100,
  "is_active": true,
  "polling_interval_ms": 5000
}
```

### GET /admin/poller-status

```json
{
  "running": true,
  "lastPollTime": "2026-04-23T10:05:00.000Z",
  "lastPollSuccess": true,
  "pollCount": 10842,
  "errorCount": 3,
  "activeTagCount": 12,
  "mode": "simulator"
}
```

---

## Error Responses

All errors follow a consistent envelope:

```json
{
  "error": "Unauthorized",
  "message": "Token has expired",
  "statusCode": 401
}
```

| Status | Meaning |
|---|---|
| `400` | Validation error (body includes `errors[]`) |
| `401` | Missing or invalid JWT |
| `403` | Valid JWT but insufficient permissions |
| `404` | Resource not found |
| `429` | Rate limit exceeded (300 req/min) |
| `500` | Internal server error |

### Rate Limiting

| Endpoint group | Limit |
|---|---|
| All endpoints (default) | 300 requests / minute |
| `/readings/live` | Exempt (WebSocket preferred) |
