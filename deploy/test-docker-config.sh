#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  echo "PASS: $*"
}

required_files=(
  "compose.yaml"
  ".env.example"
  "logic-arena-backend/Dockerfile"
  "logic-arena-backend/.dockerignore"
  "logic-arena-frontend/Dockerfile"
  "logic-arena-frontend/.dockerignore"
  "logic-arena-frontend/nginx.conf"
)

for relative_path in "${required_files[@]}"; do
  [[ -f "$repo_root/$relative_path" ]] || fail "missing $relative_path"
done
pass "required Docker files exist"

command -v docker >/dev/null 2>&1 || fail "docker CLI is not installed"
command -v jq >/dev/null 2>&1 || fail "jq is not installed"

config_json="$(mktemp)"
trap 'rm -f "$config_json"' EXIT

docker compose \
  --env-file "$repo_root/.env.example" \
  -f "$repo_root/compose.yaml" \
  config --format json >"$config_json"

jq -e '.services | keys | sort == ["backend", "frontend", "postgres"]' "$config_json" >/dev/null \
  || fail "Compose must define exactly frontend, backend, and postgres"

jq -e '
  (.services.frontend.ports | length) == 1 and
  (.services.frontend.ports[0].target == 80) and
  (.services.frontend.ports[0].published | tostring) == "80" and
  ((.services.backend.ports // []) | length) == 0 and
  ((.services.postgres.ports // []) | length) == 0
' "$config_json" >/dev/null || fail "only frontend port 80 may be published"

jq -e '
  (.services.frontend.healthcheck != null) and
  (.services.backend.healthcheck != null) and
  (.services.postgres.healthcheck != null)
' "$config_json" >/dev/null || fail "all services must define health checks"

jq -e '
  any(.services.postgres.volumes[];
    .type == "volume" and
    .source == "postgres_data" and
    .target == "/var/lib/postgresql/data") and
  (.volumes.postgres_data != null)
' "$config_json" >/dev/null || fail "postgres_data must persist PostgreSQL data"

jq -e '
  .services.backend.depends_on.postgres.condition == "service_healthy" and
  .services.frontend.depends_on.backend.condition == "service_healthy"
' "$config_json" >/dev/null || fail "service startup must follow health conditions"

jq -e '
  .services.frontend.build.args.VITE_API_URL == "/api" and
  .services.backend.environment.NODE_ENV == "production"
' "$config_json" >/dev/null || fail "production build and runtime environment are required"

nginx_config="$repo_root/logic-arena-frontend/nginx.conf"
grep -Fq 'location /api/' "$nginx_config" || fail "Nginx must route /api/"
grep -Fq 'proxy_pass http://backend:4000/api/' "$nginx_config" || fail "Nginx API upstream is incorrect"
grep -Fq 'location /socket.io/' "$nginx_config" || fail "Nginx must route /socket.io/"
grep -Fq 'proxy_set_header Upgrade $http_upgrade' "$nginx_config" || fail "Nginx must forward WebSocket upgrades"
grep -Fq 'try_files $uri $uri/ /index.html' "$nginx_config" || fail "Nginx must support SPA fallback"

grep -Fq 'npm ci --omit=dev' "$repo_root/logic-arena-backend/Dockerfile" \
  || fail "backend image must install from its lockfile"
grep -Fq 'apt-get install -y --no-install-recommends openssl' "$repo_root/logic-arena-backend/Dockerfile" \
  || fail "backend image must install OpenSSL for Prisma"
grep -Fq 'npm ci' "$repo_root/logic-arena-frontend/Dockerfile" \
  || fail "frontend image must install from its lockfile"

if grep -Eq 'COPY[[:space:]].*\.env' \
  "$repo_root/logic-arena-backend/Dockerfile" \
  "$repo_root/logic-arena-frontend/Dockerfile"; then
  fail "Dockerfiles must not copy environment files"
fi

pass "Compose topology, persistence, health, and Nginx routing are valid"
