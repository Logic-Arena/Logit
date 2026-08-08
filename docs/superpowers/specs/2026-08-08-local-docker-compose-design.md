# Local Docker Compose Design

## Goal

Run Logit locally as three containers: an Nginx-served React frontend, a Node.js backend, and PostgreSQL 16. This stage uses HTTP only. Route 53, Certbot, and production HTTPS are intentionally deferred until the AWS host and DNS exist.

## Architecture

- `frontend` builds the Vite application in a Node.js build stage and serves `dist` from Nginx.
- Nginx is the only published application port. It serves the SPA, proxies `/api/` to the backend, and proxies `/socket.io/` with WebSocket upgrade headers.
- `backend` runs one Node.js process on port 4000. It is not published to the host because room state, timers, and login session nonces are process-local.
- `postgres` uses PostgreSQL 16 and a named volume. Port 5432 is not published.
- The backend waits for PostgreSQL health. The frontend waits for backend health.

## Configuration and secrets

- Compose reads values from a root `.env`; only `.env.example` is committed.
- The frontend is built with `VITE_API_URL=/api` so HTTP and Socket.IO use the same origin.
- Backend secrets and database credentials are injected at runtime and are never copied into images.

## Health and persistence

- PostgreSQL uses `pg_isready`.
- The backend uses the existing `/health` endpoint.
- Nginx exposes `/healthz` without proxying to the backend.
- PostgreSQL data lives in the `postgres_data` named volume.
- Containers use `restart: unless-stopped` and bounded Docker JSON logs.

## Acceptance criteria

1. `docker compose --env-file .env.example config` succeeds.
2. Only frontend port 80 is published to the host.
3. Backend and PostgreSQL are reachable only on the Compose network.
4. Frontend requests to `/api/health` reach the backend.
5. WebSocket upgrade requests under `/socket.io/` reach the backend.
6. PostgreSQL data survives container recreation.
7. Frontend and backend images build from lockfiles with `npm ci`.
