#!/usr/bin/env bash
set -Eeuo pipefail

# GitHub Secrets를 EC2 .env 파일에 동기화하는 스크립트
# GitHub Actions에서 환경 변수로 전달받아 EC2에 안전하게 작성

repo_dir="${LOGIT_REPO_DIR:-/opt/logit}"
env_file="$repo_dir/.env"
backup_file="$repo_dir/.env.backup.$(date +%Y%m%d_%H%M%S)"

# 현재 .env 백업
if [[ -f "$env_file" ]]; then
  echo "Backing up existing .env to $backup_file"
  cp "$env_file" "$backup_file"
fi

# 새 .env 파일 생성
cat > "$env_file" <<'ENV_EOF'
# ========================================
# PostgreSQL Configuration
# ========================================
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# ========================================
# Backend Configuration
# ========================================
DATABASE_URL=${DATABASE_URL}
CORS_ORIGIN=${CORS_ORIGIN}
FRONTEND_URL=${FRONTEND_URL}

JWT_SECRET=${JWT_SECRET}
SESSION_SECRET=${SESSION_SECRET}
TEACHER_CODE=${TEACHER_CODE}

# ========================================
# AI Provider
# ========================================
AI_PROVIDER=${AI_PROVIDER:-openai}
OPENAI_API_KEY=${OPENAI_API_KEY:-}
OPENAI_MODEL=${OPENAI_MODEL:-gpt-4o-mini}
GEMINI_API_KEY=${GEMINI_API_KEY:-}
GEMINI_MODEL=${GEMINI_MODEL:-gemini-2.0-flash}

# ========================================
# Social Login
# ========================================
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-}
GOOGLE_CALLBACK_URL=${GOOGLE_CALLBACK_URL}

KAKAO_REST_API_KEY=${KAKAO_REST_API_KEY:-}
KAKAO_CLIENT_SECRET=${KAKAO_CLIENT_SECRET:-}
KAKAO_CALLBACK_URL=${KAKAO_CALLBACK_URL}

# ========================================
# Docker Compose
# ========================================
HTTP_PORT=${HTTP_PORT:-80}
VITE_API_URL=${VITE_API_URL:-/api}
ENV_EOF

# 환경 변수 치환 (envsubst가 없을 경우 대비)
if command -v envsubst >/dev/null 2>&1; then
  envsubst < "$env_file" > "$env_file.tmp"
  mv "$env_file.tmp" "$env_file"
else
  # Manual substitution using sed
  for var in POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD DATABASE_URL \
             CORS_ORIGIN FRONTEND_URL JWT_SECRET SESSION_SECRET TEACHER_CODE \
             AI_PROVIDER OPENAI_API_KEY OPENAI_MODEL GEMINI_API_KEY GEMINI_MODEL \
             GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GOOGLE_CALLBACK_URL \
             KAKAO_REST_API_KEY KAKAO_CLIENT_SECRET KAKAO_CALLBACK_URL \
             HTTP_PORT VITE_API_URL; do
    value="${!var:-}"
    sed -i "s|\${$var}|$value|g" "$env_file"
  done
fi

chmod 600 "$env_file"
echo "Environment variables synchronized successfully"
echo "Backup saved to: $backup_file"
