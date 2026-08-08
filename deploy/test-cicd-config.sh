#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
workflow="$repo_root/.github/workflows/deploy-production.yml"
deploy_script="$repo_root/deploy/ec2/deploy.sh"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  echo "PASS: $*"
}

[[ -x "$deploy_script" ]] || fail "missing executable deploy/ec2/deploy.sh"

test_root="$(mktemp -d)"
trap 'rm -rf "$test_root"' EXIT
fake_bin="$test_root/bin"
fake_repo="$test_root/repo"
call_log="$test_root/calls.log"
mkdir -p "$fake_bin" "$fake_repo"

cat >"$fake_bin/git" <<'FAKE_GIT'
#!/usr/bin/env bash
set -euo pipefail
printf 'git %s\n' "$*" >>"$TEST_CALL_LOG"
case "$*" in
  "rev-parse --abbrev-ref HEAD") printf 'main\n' ;;
  "status --porcelain --untracked-files=no") ;;
esac
FAKE_GIT

cat >"$fake_bin/docker" <<'FAKE_DOCKER'
#!/usr/bin/env bash
set -euo pipefail
printf 'docker %s\n' "$*" >>"$TEST_CALL_LOG"
if [[ "$*" == "compose ps -q "* ]]; then
  printf 'container-%s\n' "${*: -1}"
elif [[ "$*" == "inspect -f "* ]]; then
  printf 'healthy\n'
fi
FAKE_DOCKER

cat >"$fake_bin/curl" <<'FAKE_CURL'
#!/usr/bin/env bash
set -euo pipefail
printf 'curl %s\n' "$*" >>"$TEST_CALL_LOG"
FAKE_CURL

chmod +x "$fake_bin/git" "$fake_bin/docker" "$fake_bin/curl"

PATH="$fake_bin:$PATH" \
TEST_CALL_LOG="$call_log" \
LOGIT_REPO_DIR="$fake_repo" \
LOGIT_HEALTH_BASE_URL="https://logit.example.test" \
"$deploy_script"

assert_called() {
  local expected="$1"
  grep -Fxq "$expected" "$call_log" || fail "deployment did not call: $expected"
}

assert_called "git fetch origin main"
assert_called "git merge --ff-only origin/main"
assert_called "docker compose build --pull"
assert_called "docker compose up -d postgres"
assert_called "docker compose run --rm --no-deps backend npx prisma migrate deploy"
assert_called "docker compose up -d --remove-orphans"
assert_called "curl -fsS --retry 10 --retry-delay 3 --retry-all-errors https://logit.example.test/healthz"
assert_called "curl -fsS --retry 10 --retry-delay 3 --retry-all-errors https://logit.example.test/api/health"
pass "deployment performs update, build, migration, restart, and public health checks"

[[ -f "$workflow" ]] || fail "missing .github/workflows/deploy-production.yml"

ruby - "$workflow" <<'RUBY'
require "yaml"

workflow = YAML.safe_load(File.read(ARGV.fetch(0)), aliases: true)
triggers = workflow.fetch("on")
abort "main push trigger is missing" unless triggers.dig("push", "branches") == ["main"]
abort "manual trigger is missing" unless triggers.key?("workflow_dispatch")

concurrency = workflow.fetch("concurrency")
abort "production concurrency group is missing" unless concurrency["group"] == "logit-production"
abort "running deployments must not be cancelled" unless concurrency["cancel-in-progress"] == false

jobs = workflow.fetch("jobs")
ci = jobs.fetch("ci")
deploy = jobs.fetch("deploy")
abort "deploy must depend on CI" unless deploy["needs"] == "ci"

ci_commands = ci.fetch("steps").map { |step| step["run"] }.compact.join("\n")
[
  "npm --prefix logic-arena-frontend ci",
  "npm --prefix logic-arena-frontend run build",
  "npm --prefix logic-arena-backend ci",
  "node --check",
  "./deploy/test-docker-config.sh"
].each do |required|
  abort "CI command is missing: #{required}" unless ci_commands.include?(required)
end

deploy_yaml = YAML.dump(deploy)
%w[EC2_HOST EC2_USER EC2_SSH_PRIVATE_KEY EC2_KNOWN_HOSTS].each do |secret|
  abort "deployment secret is missing: #{secret}" unless deploy_yaml.include?("secrets.#{secret}")
end
abort "strict host-key checking is missing" unless deploy_yaml.include?("StrictHostKeyChecking=yes")
abort "versioned deployment script is not streamed to EC2" unless deploy_yaml.include?("deploy/ec2/deploy.sh")
RUBY
pass "workflow triggers, checks, dependencies, and SSH contract are valid"
