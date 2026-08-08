#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

PUBLIC_HOST="${PUBLIC_HOST:-rpi.local}"
FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-http://${PUBLIC_HOST}}"
BACKEND_ORIGIN="${BACKEND_ORIGIN:-http://${PUBLIC_HOST}:4000}"
FRONTEND_API_URL="${FRONTEND_API_URL:-$BACKEND_ORIGIN}"
WEB_ROOT="${WEB_ROOT:-/var/www/logit}"
NGINX_SITE_NAME="${NGINX_SITE_NAME:-logit}"
BACKEND_ENV_FILE="$PROJECT_DIR/logic-arena-backend/.env"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This deploy script is intended to run on the Raspberry Pi." >&2
  exit 1
fi

if [[ ! -f "$BACKEND_ENV_FILE" ]]; then
  echo "Missing backend env file: $BACKEND_ENV_FILE" >&2
  echo "Copy deploy/raspberry-pi/backend.env.example to logic-arena-backend/.env and fill secrets first." >&2
  exit 1
fi

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "node and npm are required. Run deploy/raspberry-pi/setup-system.sh first." >&2
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

cd "$PROJECT_DIR/logic-arena-backend"
npm ci
npx prisma migrate deploy
npx prisma generate

cd "$PROJECT_DIR/logic-arena-frontend"
npm ci
VITE_API_URL="$FRONTEND_API_URL" npm run build

sudo mkdir -p "$WEB_ROOT"
sudo rsync -a --delete "$PROJECT_DIR/logic-arena-frontend/dist/" "$WEB_ROOT/"

tmp_nginx="$(mktemp)"
sed \
  -e "s|__SERVER_NAME__|${PUBLIC_HOST} _|g" \
  -e "s|__WEB_ROOT__|${WEB_ROOT}|g" \
  "$SCRIPT_DIR/nginx-logit.conf.template" > "$tmp_nginx"

sudo cp "$tmp_nginx" "/etc/nginx/sites-available/$NGINX_SITE_NAME"
rm -f "$tmp_nginx"
sudo ln -sfn "/etc/nginx/sites-available/$NGINX_SITE_NAME" "/etc/nginx/sites-enabled/$NGINX_SITE_NAME"
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

cd "$PROJECT_DIR"
LOGIT_PROJECT_DIR="$PROJECT_DIR" pm2 startOrReload "$SCRIPT_DIR/ecosystem.config.cjs" --env production

if command -v systemctl >/dev/null 2>&1; then
  sudo env PATH="$PATH" "$(command -v pm2)" startup systemd -u "$USER" --hp "$HOME"
fi
pm2 save

echo
echo "Deploy complete."
echo "Frontend: $FRONTEND_ORIGIN"
echo "Backend:  $BACKEND_ORIGIN"
echo "Frontend API build target: $FRONTEND_API_URL"
echo "Health:   ${BACKEND_ORIGIN}/health"
