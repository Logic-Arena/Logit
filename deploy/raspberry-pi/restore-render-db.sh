#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [[ -z "${RENDER_DATABASE_URL:-}" ]]; then
  echo "RENDER_DATABASE_URL is required." >&2
  echo "Example: RENDER_DATABASE_URL='postgresql://...' $0" >&2
  exit 1
fi

PI_DATABASE_URL="${PI_DATABASE_URL:-${DATABASE_URL:-}}"
if [[ -z "$PI_DATABASE_URL" ]]; then
  LOGIT_DB_NAME="${LOGIT_DB_NAME:-debate_game_db}"
  LOGIT_DB_USER="${LOGIT_DB_USER:-logit_user}"
  LOGIT_DB_PASSWORD="${LOGIT_DB_PASSWORD:-}"
  if [[ -z "$LOGIT_DB_PASSWORD" ]]; then
    echo "Set PI_DATABASE_URL, DATABASE_URL, or LOGIT_DB_PASSWORD before restoring." >&2
    exit 1
  fi
  PI_DATABASE_URL="postgresql://${LOGIT_DB_USER}:${LOGIT_DB_PASSWORD}@localhost:5432/${LOGIT_DB_NAME}"
fi

if ! command -v pg_dump >/dev/null 2>&1 || ! command -v pg_restore >/dev/null 2>&1; then
  echo "pg_dump and pg_restore are required. Install postgresql-client or run setup-system.sh." >&2
  exit 1
fi

if [[ "${CONFIRM_RESTORE:-}" != "yes" ]]; then
  echo "This will restore Render data into the Pi database and may replace existing Pi data."
  echo "Target: $PI_DATABASE_URL"
  read -r -p "Type 'restore' to continue: " answer
  if [[ "$answer" != "restore" ]]; then
    echo "Restore cancelled."
    exit 1
  fi
fi

backup_dir="${BACKUP_DIR:-$PROJECT_DIR/backups}"
mkdir -p "$backup_dir"
backup_file="$backup_dir/render-$(date +%Y%m%d-%H%M%S).dump"

pg_dump --format=custom --no-owner --no-acl "$RENDER_DATABASE_URL" --file "$backup_file"
pg_restore --clean --if-exists --no-owner --no-acl --dbname "$PI_DATABASE_URL" "$backup_file"

cd "$PROJECT_DIR/logic-arena-backend"
DATABASE_URL="$PI_DATABASE_URL" npx prisma migrate deploy
DATABASE_URL="$PI_DATABASE_URL" npx prisma generate

echo
echo "Restore complete."
echo "Backup file: $backup_file"
