# Local Docker Runbook

This setup runs Logit over local HTTP with three containers:

- `frontend`: Vite build served by Nginx on `http://localhost`
- `backend`: Express and Socket.IO on the private Compose network
- `postgres`: PostgreSQL 16 with named-volume persistence

HTTPS and Certbot are not part of this local stage.

## 1. Create the runtime environment file

```bash
cp .env.example .env
```

Replace every `CHANGE_ME` value in `.env`. Keep `DATABASE_URL` consistent with `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`. Do not commit `.env`.

AI and OAuth credentials may be left empty for basic health checks, but their related application features will not work.

## 2. Build the application images

```bash
docker compose build frontend backend
```

## 3. Start PostgreSQL and apply migrations

```bash
docker compose up -d --wait postgres
docker compose run --rm backend npx prisma migrate deploy
```

## 4. Start the application

```bash
docker compose up -d --wait backend frontend
```

Open `http://localhost` and verify both health endpoints:

```bash
curl --fail http://localhost/healthz
curl --fail http://localhost/api/health
```

## 5. Inspect or stop services

```bash
docker compose ps
docker compose logs --tail=200 backend frontend postgres
docker compose down
```

`docker compose down` retains the `postgres_data` volume. Do not run `docker compose down -v` unless permanent deletion of the local database is intended.

## Configuration validation

```bash
bash deploy/test-docker-config.sh
```

The script verifies service topology, published ports, health checks, database persistence configuration, lockfile installs, and Nginx API/WebSocket routing.
