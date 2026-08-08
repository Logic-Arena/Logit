# Logit Subdomain HTTPS Deployment Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the production application at `https://logit.woo-zu.com` from the existing EC2 instance and Elastic IP `54.116.127.47`.

**Architecture:** Route 53 provides authoritative DNS for `woo-zu.com` and maps the `logit` subdomain to the EC2 Elastic IP. Host Nginx terminates TLS on ports 80/443 and proxies to the existing frontend Nginx container bound only to `127.0.0.1:3000`; the frontend container continues routing `/api` and `/socket.io` to the backend container. Certbot issues and renews the Let's Encrypt certificate.

**Tech Stack:** AWS Route 53, EC2, Docker Compose, Nginx, Certbot, Let's Encrypt

## Global Constraints

- Keep all application services on the existing EC2 instance.
- Keep PostgreSQL private inside the Docker network.
- Publish no application container port directly to the public internet.
- Use `logit.woo-zu.com` as the production origin and callback host.
- Preserve the existing `/opt/logit/.env` secrets and PostgreSQL volume.

---

### Task 1: Restore authoritative DNS and create the application record

**Files:**
- Modify: AWS Route 53 hosted zone and registered-domain name servers (external state)

**Interfaces:**
- Consumes: registered domain `woo-zu.com`, Elastic IP `54.116.127.47`
- Produces: public `A` record `logit.woo-zu.com -> 54.116.127.47`

- [x] **Step 1: Create a public hosted zone**

Create a Route 53 public hosted zone named `woo-zu.com` without a delegation set or additional tags.

- [x] **Step 2: Update the registered domain name servers**

Copy the four `NS` values generated for the new hosted zone into the Route 53 registered-domain name-server configuration for `woo-zu.com`.

- [x] **Step 3: Create the subdomain record**

Create a simple-routing `A` record named `logit` with value `54.116.127.47` and TTL `300`.

- [x] **Step 4: Verify public DNS**

Run:

```bash
dig +short NS woo-zu.com
dig +short A logit.woo-zu.com
```

Expected: four Route 53 name servers and `54.116.127.47`.

### Task 2: Restrict the frontend container and install the TLS edge

**Files:**
- Modify: `/opt/logit/.env` on EC2
- Create: `deploy/ec2/nginx-logit.conf`
- Create: `/etc/nginx/sites-available/logit` on EC2
- Modify: `/etc/nginx/sites-enabled/logit` symlink on EC2

**Interfaces:**
- Consumes: Docker frontend HTTP service, public ports 80/443
- Produces: host Nginx proxy to `http://127.0.0.1:3000`

- [x] **Step 1: Verify HTTPS in the EC2 security group**

Confirmed that inbound TCP port `443` from `0.0.0.0/0` was already present. The instance has no public IPv6 address, so no IPv6 rule was added. The existing SSH and HTTP rules were preserved.

- [x] **Step 2: Bind the frontend container to loopback**

Set this exact value in `/opt/logit/.env`:

```dotenv
HTTP_PORT=127.0.0.1:3000
```

Recreate the frontend service:

```bash
cd /opt/logit
docker compose up -d --force-recreate frontend
```

Verify that `127.0.0.1:3000` is listening and public port 80 is free.

- [x] **Step 3: Install host Nginx and Certbot**

Run:

```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

- [x] **Step 4: Configure the HTTP reverse proxy**

Create `/etc/nginx/sites-available/logit` with:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name logit.woo-zu.com;

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site, remove the default site, test configuration, and reload:

```bash
sudo ln -sfn /etc/nginx/sites-available/logit /etc/nginx/sites-enabled/logit
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

- [x] **Step 5: Verify HTTP routing**

Run:

```bash
curl -fsS http://logit.woo-zu.com/healthz
curl -fsS http://logit.woo-zu.com/api/health
```

Expected: frontend `ok` and a successful backend health response.

### Task 3: Issue HTTPS and update production origins

**Files:**
- Modify: `/opt/logit/.env` on EC2
- Modify: `/etc/nginx/sites-available/logit` automatically through Certbot

**Interfaces:**
- Consumes: working HTTP DNS route for `logit.woo-zu.com`
- Produces: trusted HTTPS endpoint and correct application origins

- [x] **Step 1: Issue and install the certificate**

Run:

```bash
sudo certbot --nginx -d logit.woo-zu.com --redirect --non-interactive --agree-tos --register-unsafely-without-email
```

- [x] **Step 2: Update application URLs without changing secrets**

Set these exact values in `/opt/logit/.env`:

```dotenv
CORS_ORIGIN=https://logit.woo-zu.com
FRONTEND_URL=https://logit.woo-zu.com
GOOGLE_CALLBACK_URL=https://logit.woo-zu.com/api/auth/google/callback
KAKAO_CALLBACK_URL=https://logit.woo-zu.com/api/auth/kakao/callback
```

- [x] **Step 3: Recreate services with the new environment**

Run:

```bash
cd /opt/logit
docker compose up -d --build
```

- [x] **Step 4: Verify service health and TLS**

Run:

```bash
docker compose ps
curl -fsSI http://logit.woo-zu.com
curl -fsS https://logit.woo-zu.com/healthz
curl -fsS https://logit.woo-zu.com/api/health
sudo certbot renew --dry-run
```

Expected: all containers healthy, HTTP redirects to HTTPS, HTTPS endpoints succeed, and certificate renewal dry-run succeeds.

- [x] **Step 5: Verify WebSocket upgrade**

Open the production application, enter a room flow that establishes Socket.IO, and confirm the browser network panel shows a successful WebSocket connection to `wss://logit.woo-zu.com/socket.io/`.
