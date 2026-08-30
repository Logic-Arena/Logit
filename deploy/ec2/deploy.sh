#!/usr/bin/env bash
set -Eeuo pipefail

repo_dir="${LOGIT_REPO_DIR:-/opt/logit}"
health_base_url="${LOGIT_HEALTH_BASE_URL:-https://logit.woo-zu.com}"

cd "$repo_dir"

on_error() {
  local exit_code=$?
  echo "Deployment failed; current Compose status:" >&2
  docker compose ps >&2 || true
  exit "$exit_code"
}
trap on_error ERR

branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" != "main" ]]; then
  echo "Expected /opt/logit to be on main, found: $branch" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "Tracked files in /opt/logit have local modifications; refusing to deploy" >&2
  exit 1
fi

wait_for_healthy_service() {
  local service="$1"
  local attempts="${2:-60}"
  local container_id status

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    container_id="$(docker compose ps -q "$service")"
    if [[ -n "$container_id" ]]; then
      status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")"
      if [[ "$status" == "healthy" || "$status" == "running" ]]; then
        return 0
      fi
    fi
    sleep 2
  done

  echo "Service did not become healthy: $service" >&2
  docker compose logs --tail=100 "$service" >&2 || true
  return 1
}

git fetch origin main
git merge --ff-only origin/main

docker compose build --pull
docker compose up -d postgres
wait_for_healthy_service postgres

docker compose run --rm --no-deps backend npx prisma migrate deploy
# backend/frontend는 .env 변경만으로는 이미지가 안 바뀌어 compose가 재생성을 건너뛸 수 있으므로 매번 강제 재생성한다.
docker compose up -d --remove-orphans --force-recreate backend frontend

wait_for_healthy_service backend
wait_for_healthy_service frontend

curl -fsS --retry 10 --retry-delay 3 --retry-all-errors "$health_base_url/healthz"
curl -fsS --retry 10 --retry-delay 3 --retry-all-errors "$health_base_url/api/health"

docker compose ps
echo "Deployment completed successfully"
