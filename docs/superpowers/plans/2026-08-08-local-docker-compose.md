# Local Docker Compose Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Containerize the React frontend, Node.js backend, and PostgreSQL database so the complete application runs locally through one Nginx HTTP endpoint.

**Architecture:** A multi-stage frontend image compiles Vite assets and serves them from Nginx. Nginx proxies API and Socket.IO traffic to one internal backend container, which connects to an internal PostgreSQL 16 container with named-volume persistence.

**Tech Stack:** Docker Engine, Docker Compose, Node.js 24, Nginx 1.28, PostgreSQL 16, Prisma 7, Bash

## Global Constraints

- This stage is HTTP-only; do not add Route 53, Certbot, TLS, ALB, ECS, ECR, or RDS.
- Publish only frontend port 80.
- Keep backend replica count at one because room and session state is process-local.
- Do not copy `.env` or secrets into Docker images.
- Use existing npm lockfiles with `npm ci`.
- Persist PostgreSQL through a named Docker volume.

---

### Task 1: Docker configuration contract

**Files:**
- Create: `deploy/test-docker-config.sh`

**Interfaces:**
- Consumes: Docker Compose CLI and repository files.
- Produces: A repeatable command that rejects missing services, unsafe published ports, missing health checks, and missing proxy rules.

- [ ] **Step 1: Write the failing configuration test**

Create a Bash test that requires `compose.yaml`, both Dockerfiles, both `.dockerignore` files, `nginx.conf`, and `.env.production.example`. Parse `docker compose config --format json` with `jq` and require services `frontend`, `backend`, and `postgres`; require only frontend to publish port 80; require a `postgres_data` volume; and grep for `/api/`, `/socket.io/`, and WebSocket upgrade headers in Nginx.

- [ ] **Step 2: Run the test and verify RED**

Run: `bash deploy/test-docker-config.sh`

Expected: FAIL because `compose.yaml` does not exist.

### Task 2: Backend container

**Files:**
- Create: `logic-arena-backend/Dockerfile`
- Create: `logic-arena-backend/.dockerignore`

**Interfaces:**
- Consumes: `logic-arena-backend/package-lock.json`, `src/server.js`, `prisma/schema.prisma`, runtime environment variables.
- Produces: A non-root backend image listening on port 4000 with Prisma Client generated during the build.

- [ ] **Step 1: Add the minimal backend image**

Use `node:24-bookworm-slim`, `npm ci --omit=dev`, `npx prisma generate`, a non-root `node` user, `NODE_ENV=production`, and `CMD ["node", "src/server.js"]`.

- [ ] **Step 2: Exclude local and secret files**

Exclude `node_modules`, `.env*`, logs, coverage, generated output, and tests from the backend build context.

- [ ] **Step 3: Run the contract test**

Run: `bash deploy/test-docker-config.sh`

Expected: FAIL on the next missing frontend or Compose artifact, not on the backend files.

### Task 3: Frontend Nginx container

**Files:**
- Create: `logic-arena-frontend/Dockerfile`
- Create: `logic-arena-frontend/.dockerignore`
- Create: `logic-arena-frontend/nginx.conf`

**Interfaces:**
- Consumes: `logic-arena-frontend/package-lock.json`, Vite source, `VITE_API_URL` build argument.
- Produces: An Nginx image serving the SPA on port 80 and proxying `/api/` and `/socket.io/` to `backend:4000`.

- [ ] **Step 1: Add the multi-stage frontend image**

Build with `node:24-bookworm-slim`, `npm ci`, and `npm run build`; copy `/app/dist` into `nginx:1.28-alpine`.

- [ ] **Step 2: Add Nginx routing**

Serve `/usr/share/nginx/html`, use `try_files $uri $uri/ /index.html`, proxy `/api/` to `http://backend:4000/api/`, proxy `/socket.io/` to `http://backend:4000/socket.io/`, and forward WebSocket upgrade headers.

- [ ] **Step 3: Exclude local artifacts**

Exclude `node_modules`, `.env*`, `dist`, logs, coverage, and editor files from the frontend build context.

- [ ] **Step 4: Run the contract test**

Run: `bash deploy/test-docker-config.sh`

Expected: FAIL because Compose and its environment example do not exist.

### Task 4: Compose topology and environment contract

**Files:**
- Create: `compose.yaml`
- Create: `.env.example`

**Interfaces:**
- Consumes: The frontend and backend Dockerfiles.
- Produces: Services `frontend`, `backend`, and `postgres`; named volume `postgres_data`; internal service discovery names `backend` and `postgres`.

- [ ] **Step 1: Add the environment example**

Define PostgreSQL, application, OAuth, AI provider, CORS, and frontend URL variables with non-secret placeholders. Set local defaults to `http://localhost` and frontend API path to `/api`.

- [ ] **Step 2: Add Compose services**

Add health checks, `restart: unless-stopped`, bounded JSON logs, dependency health conditions, named-volume persistence, and only `80:80` on the frontend.

- [ ] **Step 3: Verify GREEN**

Run: `bash deploy/test-docker-config.sh`

Expected: PASS with all assertions.

### Task 5: Image and runtime verification

**Files:**
- Modify only if verification identifies a concrete defect in the Docker artifacts.

**Interfaces:**
- Consumes: Complete Docker configuration.
- Produces: Evidence that images build and the application routes through Nginx.

- [ ] **Step 1: Build images**

Run: `docker compose --env-file .env.example build frontend backend`

Expected: both images build successfully using `npm ci`.

- [ ] **Step 2: Start PostgreSQL and apply migrations**

Run: `docker compose --env-file .env.example up -d postgres`

Run: `docker compose --env-file .env.example run --rm backend npx prisma migrate deploy`

Expected: PostgreSQL becomes healthy and migrations complete.

- [ ] **Step 3: Start the application**

Run: `docker compose --env-file .env.example up -d backend frontend`

Expected: all services become healthy.

- [ ] **Step 4: Verify routing**

Run: `curl --fail http://localhost/healthz`

Run: `curl --fail http://localhost/api/health`

Expected: both return HTTP 200, with backend JSON containing `{"status":"ok"}`.

- [ ] **Step 5: Verify database persistence**

Run: `docker compose --env-file .env.example exec -T postgres psql -U logit -d logit -c "CREATE TABLE IF NOT EXISTS docker_persistence_probe (id integer primary key); INSERT INTO docker_persistence_probe VALUES (1) ON CONFLICT DO NOTHING;"`

Run: `docker compose --env-file .env.example down && docker compose --env-file .env.example up -d postgres`

Run: `docker compose --env-file .env.example exec -T postgres psql -U logit -d logit -tAc "SELECT count(*) FROM docker_persistence_probe WHERE id = 1;"`

Expected: `1`. Do not use `down -v`.

- [ ] **Step 6: Final verification**

Run: `bash deploy/test-docker-config.sh`

Run: `git diff --check`

Expected: both commands exit 0.

### Task 6: Local runbook

**Files:**
- Create: `docs/docker-local.md`

**Interfaces:**
- Consumes: The verified Docker Compose workflow.
- Produces: Exact build, migration, startup, health-check, log, and shutdown commands for developers.

- [ ] **Step 1: Document the safe local workflow**

Document `.env` creation, image builds, PostgreSQL startup, `prisma migrate deploy`, application startup, health checks, logs, and shutdown. Explicitly warn that `docker compose down -v` deletes the local database volume.
