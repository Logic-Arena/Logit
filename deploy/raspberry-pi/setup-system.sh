#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This setup script must be run on Raspberry Pi OS or another Linux host." >&2
  exit 1
fi

LOGIT_DB_NAME="${LOGIT_DB_NAME:-debate_game_db}"
LOGIT_DB_USER="${LOGIT_DB_USER:-logit_user}"
LOGIT_DB_PASSWORD="${LOGIT_DB_PASSWORD:-}"

validate_identifier() {
  local value="$1"
  local label="$2"
  if [[ ! "$value" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    echo "$label must contain only letters, numbers, and underscores, and cannot start with a number." >&2
    exit 1
  fi
}

validate_identifier "$LOGIT_DB_NAME" "LOGIT_DB_NAME"
validate_identifier "$LOGIT_DB_USER" "LOGIT_DB_USER"

sudo apt update
sudo apt install -y \
  build-essential \
  ca-certificates \
  curl \
  git \
  nginx \
  openssl \
  postgresql \
  postgresql-contrib \
  rsync

sudo systemctl enable --now postgresql
sudo systemctl enable --now nginx

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi

# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
nvm install 22
nvm alias default 22
npm install -g pm2

if [[ -z "$LOGIT_DB_PASSWORD" ]]; then
  LOGIT_DB_PASSWORD="$(openssl rand -hex 24)"
  GENERATED_PASSWORD=1
else
  GENERATED_PASSWORD=0
fi

escape_sql_literal() {
  printf "%s" "$1" | sed "s/'/''/g"
}

escaped_password="$(escape_sql_literal "$LOGIT_DB_PASSWORD")"
encoded_password="$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$LOGIT_DB_PASSWORD")"

sudo -u postgres psql <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${LOGIT_DB_USER}') THEN
    CREATE ROLE "${LOGIT_DB_USER}" LOGIN PASSWORD '${escaped_password}';
  ELSE
    ALTER ROLE "${LOGIT_DB_USER}" WITH LOGIN PASSWORD '${escaped_password}';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE "${LOGIT_DB_NAME}" OWNER "${LOGIT_DB_USER}"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${LOGIT_DB_NAME}')\gexec

GRANT ALL PRIVILEGES ON DATABASE "${LOGIT_DB_NAME}" TO "${LOGIT_DB_USER}";
SQL

echo
echo "System setup complete."
echo "Postgres database: $LOGIT_DB_NAME"
echo "Postgres user:     $LOGIT_DB_USER"
if [[ "$GENERATED_PASSWORD" == "1" ]]; then
  echo "Generated password: $LOGIT_DB_PASSWORD"
fi
echo
echo "Backend DATABASE_URL:"
echo "postgresql://${LOGIT_DB_USER}:${encoded_password}@localhost:5432/${LOGIT_DB_NAME}"
