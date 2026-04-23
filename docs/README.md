# Hydropower Plant Monitoring System — Documentation

A production-ready full-stack SCADA monitoring platform for hydropower plants.

## Documentation Index

| Document | Description |
|---|---|
| [Architecture Overview](./architecture.md) | System architecture, tech stack, component boundaries |
| [Data Flow](./data-flow.md) | Live data, alarms, reports — end-to-end flows with sequence diagrams |
| [API Reference](./api-reference.md) | All REST endpoints, request/response shapes, auth requirements |
| [Database Schema](./database.md) | Table definitions, relationships, indexes |
| [Frontend Architecture](./frontend.md) | Component tree, routing, state management, real-time updates |
| [Deployment](./deployment.md) | Docker Compose setup, environment variables, infrastructure |

---

## Quick Start

```bash
# Clone and start all services
cp server/.env.example server/.env
docker-compose up -d

# Server runs at  http://localhost:3001
# Client runs at  http://localhost:3000
```

**Default credentials**

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Operator | `operator` | `operator123` |
| Viewer | `viewer` | `viewer123` |
