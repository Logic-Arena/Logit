#!/usr/bin/env bash
set -Eeuo pipefail

# GitHub Secrets에서 전달된 .env.incoming을 서버의 .env에 병합한다.
# 전달된 키만 갱신/추가하고, 나머지 기존 항목은 그대로 둔다.
# 값은 절대 출력하지 않는다 (키 이름만 로그에 남긴다).

repo_dir="${LOGIT_REPO_DIR:-/opt/logit}"
env_file="$repo_dir/.env"
incoming_file="$repo_dir/.env.incoming"

cleanup() {
  rm -f "$incoming_file"
}
trap cleanup EXIT

if [[ ! -f "$incoming_file" ]]; then
  echo "Missing $incoming_file; nothing to sync" >&2
  exit 1
fi

if [[ ! -e "$env_file" ]]; then
  (umask 077 && : > "$env_file")
fi

if [[ ! -w "$env_file" ]]; then
  echo "Cannot write $env_file as $(id -un); run: sudo chown $(id -un) $env_file" >&2
  exit 1
fi

merged_file="$(mktemp "$repo_dir/.env.merged.XXXXXX")"
chmod 600 "$merged_file"
trap 'rm -f "$incoming_file" "$merged_file"' EXIT

awk '
  function key_of(line,   pos) {
    pos = index(line, "=")
    return pos > 1 ? substr(line, 1, pos - 1) : ""
  }

  # 첫 번째 파일: 들어온 값
  NR == FNR {
    if ($0 ~ /^[A-Za-z_][A-Za-z0-9_]*=/) {
      k = key_of($0)
      incoming[k] = $0
      order[++count] = k
    }
    next
  }

  # 두 번째 파일: 기존 .env. 주석과 빈 줄, 순서를 보존한다.
  {
    k = ($0 ~ /^[A-Za-z_][A-Za-z0-9_]*=/) ? key_of($0) : ""
    if (k != "" && k in incoming) {
      print incoming[k]
      replaced[k] = 1
    } else {
      print
    }
  }

  END {
    for (i = 1; i <= count; i++) {
      k = order[i]
      if (!(k in replaced)) {
        print incoming[k]
      }
    }
  }
' "$incoming_file" "$env_file" > "$merged_file"

updated=()
added=()
while IFS= read -r key; do
  if grep -qE "^${key}=" "$env_file"; then
    updated+=("$key")
  else
    added+=("$key")
  fi
done < <(sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' "$incoming_file")

mv "$merged_file" "$env_file"
chmod 600 "$env_file"
trap cleanup EXIT

echo "Updated keys: ${updated[*]:-none}"
echo "Added keys: ${added[*]:-none}"
echo "Environment sync completed"
