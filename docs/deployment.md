# Deployment

## Docker Compose Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Network                           │
│                                                             │
│  ┌───────────────┐    ┌───────────────┐                    │
│  │   postgres    │    │     redis     │                    │
│  │   :5432       │    │    :6379      │                    │
│  └───────┬───────┘    └───────┬───────┘                    │
│          │                    │                            │
│  ┌───────▼────────────────────▼───────┐                    │
│  │          server (Node.js)          │                    │
│  │          :3001                     │                    │
│  └───────────────────┬────────────────┘                    │
│                      │                                     │
│  ┌───────────────────▼────────────────┐                    │
│  │       client (React + Nginx)       │                    │
│  │       :3000  →  proxy /api         │                    │
│  └────────────────────────────────────┘                    │
│                      │                                     │
└──────────────────────┼─────────────────────────────────────┘
                       │
                  Browser :3000
```

All four services run in a shared bridge network. The Nginx container proxies `/api` requests to `server:3001` so the browser only ever talks to one origin.

---

## Services

| Service | Image | Internal Port | External Port | Health Check |
|---|---|---|---|---|
| `postgres` | `postgres:16-alpine` | 5432 | 5432 | `pg_isready` |
| `redis` | `redis:7-alpine` | 6379 | 6379 | `redis-cli ping` |
| `server` | `Dockerfile.server` | 3001 | 3001 | `GET /health` |
| `client` | `Dockerfile.client` (Nginx) | 80 | 3000 | — |

---

## Quick Start

```bash
# 1. Copy and edit environment file
cp server/.env.example server/.env

# 2. Start all services
docker-compose up -d

# 3. Run database migrations + seed
docker-compose exec server npm run migrate
docker-compose exec server npm run seed

# 4. Open the app
open http://localhost:3000
```

---

## Environment Variables

All variables are set in `server/.env` and passed to the `server` container.

### Database

| Variable | Default | Description |
|---|---|---|
| `DB_HOST` | `postgres` | PostgreSQL hostname |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `hydropower` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | *(required)* | Database password |
| `DB_SSL` | `false` | Enable SSL for DB connection |

### Redis

| Variable | Default | Description |
|---|---|---|
| `REDIS_HOST` | `redis` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | — | Redis AUTH password |

### Application

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `production` | `development` \| `production` |
| `PORT` | `3001` | Express listen port |
| `JWT_SECRET` | *(required)* | Secret for HS256 signing — keep long and random |
| `JWT_EXPIRES_IN` | `24h` | Token lifetime |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed CORS origin |

### SCADA

| Variable | Default | Description |
|---|---|---|
| `SCADA_MODE` | `simulator` | `opcua` \| `simulator` |
| `OPC_ENDPOINT` | `opc.tcp://localhost:4840` | OPC UA server address |
| `OPC_SECURITY_MODE` | `None` | `None` \| `Sign` \| `SignAndEncrypt` |
| `SCADA_POLLING_INTERVAL_MS` | `5000` | Poll rate in milliseconds |

### Notifications (optional)

| Variable | Description |
|---|---|
| `SMTP_HOST` | Email server hostname |
| `SMTP_PORT` | Email server port |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | Sender address |
| `TWILIO_ACCOUNT_SID` | Twilio SID for SMS |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_FROM_NUMBER` | SMS sender number |
| `WHATSAPP_API_URL` | WhatsApp Business API URL |
| `WHATSAPP_API_TOKEN` | WhatsApp API token |

---

## Dockerfiles

### `docker/Dockerfile.server`

```
Node 20 Alpine
  → WORKDIR /app
  → COPY package*.json
  → npm ci --only=production
  → COPY src/ (compiled JS from dist/)
  → EXPOSE 3001
  → CMD ["node", "dist/index.js"]
```

Build steps: `npm run build` (tsc) before Docker build, or use multi-stage.

### `docker/Dockerfile.client`

```
Stage 1: Node 20 Alpine (builder)
  → npm ci
  → npm run build   (CRA build → /app/build)

Stage 2: Nginx Alpine (runner)
  → COPY --from=builder /app/build /usr/share/nginx/html
  → COPY nginx.conf /etc/nginx/conf.d/default.conf
  → EXPOSE 80
```

### `docker/nginx.conf` (key rules)

```nginx
location /api {
    proxy_pass         http://server:3001;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;   # WebSocket support
    proxy_set_header   Connection "upgrade";
}

location / {
    try_files $uri $uri/ /index.html;           # SPA fallback
}
```

---

## Local Development (without Docker)

```bash
# Terminal 1 — start postgres + redis only
docker-compose up postgres redis -d

# Terminal 2 — backend
cd server
cp .env.example .env          # edit DB/Redis to localhost
npm install
npm run migrate
npm run seed
npm run dev                   # ts-node with hot reload

# Terminal 3 — frontend
cd client
npm install
npm start                     # CRA dev server on :3000
```

The CRA dev server proxies `/api` to `http://localhost:3001` via the `proxy` field in `client/package.json`.

---

## Production Checklist

| Item | Notes |
|---|---|
| Set strong `JWT_SECRET` | Minimum 32 random characters |
| Set `NODE_ENV=production` | Disables stack traces in error responses |
| Enable `DB_SSL=true` | Required for managed Postgres (RDS, Cloud SQL) |
| Set `CORS_ORIGIN` | Exact production frontend URL |
| Configure `SMTP_*` | Required for email alarm notifications |
| Set `SCADA_MODE=opcua` | Switch from simulator to real hardware |
| Mount log volume | `./logs:/app/logs` for persistent log rotation |
| Enable Postgres backups | Daily pg_dump + offsite storage |
| Rotate `JWT_SECRET` schedule | Invalidates all sessions — plan downtime |
