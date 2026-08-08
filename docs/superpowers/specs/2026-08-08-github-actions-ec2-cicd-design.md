# GitHub Actions EC2 CI/CD Design

## Goal

Automatically validate and deploy Logit whenever a commit is pushed to `main`, while keeping the existing single-EC2 Docker Compose architecture, production `.env`, PostgreSQL volume, host Nginx, and Let's Encrypt certificate intact.

## Selected Approach

Use a GitHub-hosted Actions runner for CI and connect directly to the existing EC2 instance over SSH for CD.

This approach matches the project's preference for a simple deployment model. It adds no self-hosted runner or image registry and requires no AWS OIDC integration. The GitHub repository is public, and the EC2 checkout at `/opt/logit` can already read `origin`, so the server can update with a normal fast-forward pull.

Alternatives not selected:

- A self-hosted GitHub runner on EC2 would remove the SSH deployment hop, but it would add a continuously running privileged agent and more maintenance.
- Building images into ECR would make deployments more immutable, but it would add AWS IAM, registry lifecycle, and image-pull configuration that are unnecessary for the current single-server setup.

## Trigger and Concurrency

The workflow runs on:

- pushes to `main`
- manual `workflow_dispatch` runs

Only one production deployment may run at a time. A newer queued deployment cancels an older in-progress run so that an older commit cannot finish after a newer one.

## CI Job

The CI job runs on a GitHub-hosted Ubuntu runner and performs these checks:

1. Check out the triggering commit.
2. Install the frontend lockfile dependencies with `npm ci`.
3. Build the frontend production bundle with `npm run build`.
4. Install the backend lockfile dependencies with `npm ci`.
5. Parse every backend source `.js` file with `node --check`.
6. Run `deploy/test-docker-config.sh` to validate the Compose topology, health checks, persistence, Dockerfiles, and container Nginx routing.

Frontend lint is intentionally excluded because the existing source currently has lint errors unrelated to deployment. Lint can become a blocking CI step after those errors are fixed in a separate change.

The deployment job cannot start unless every CI step succeeds.

## CD Job

The CD job uses these GitHub Actions repository secrets:

- `EC2_HOST`: `54.116.127.47`
- `EC2_USER`: `ubuntu`
- `EC2_SSH_PRIVATE_KEY`: the private key matching the EC2 instance's authorized key
- `EC2_KNOWN_HOSTS`: a trusted `known_hosts` entry collected from the existing verified EC2 connection

The job creates a temporary SSH key and `known_hosts` file on the GitHub runner and connects using strict host-key checking. It does not trust a host key discovered over the same untrusted deployment connection. Both temporary files exist only for the duration of the runner job.

On EC2, the deployment script runs with strict shell error handling and performs this sequence in `/opt/logit`:

1. Verify that the checkout is on `main` and has no tracked local modifications.
2. Fetch `origin/main` and update with a fast-forward-only merge.
3. Build the new Compose images.
4. Start PostgreSQL and wait for its health check.
5. Run `npx prisma migrate deploy` in a one-off backend container.
6. Recreate the application services with `docker compose up -d --remove-orphans`.
7. Wait for the backend and frontend containers to report healthy.
8. Verify `https://logit.woo-zu.com/healthz` and `https://logit.woo-zu.com/api/health`.
9. Print the final Compose status for the Actions log.

The server's `/opt/logit/.env` remains the only source of production secrets and runtime values. The workflow does not copy, replace, print, or upload that file. The named `postgres_data` volume is preserved.

## Failure Behavior

- A CI failure prevents all EC2 access and deployment.
- A Git fetch or fast-forward failure stops before rebuilding services.
- An image-build failure leaves the currently running containers unchanged.
- A migration failure stops before application containers are recreated.
- A container health or public HTTPS check failure marks the GitHub Actions run failed and leaves diagnostic service status in the log.
- No automatic database rollback is attempted because Prisma migrations may not be safely reversible.

The first version does not implement zero-downtime deployment or automatic application rollback. Docker Compose replaces containers after successful image builds and migrations, which may cause a short restart window.

## Repository Changes

Create:

- `.github/workflows/deploy-production.yml`: CI and production deployment workflow
- `deploy/ec2/deploy.sh`: idempotent EC2-side deployment and health-check script
- `deploy/test-cicd-config.sh`: static validation for workflow triggers, job dependencies, secret references, and deployment safety rules

Update:

- `README.md`: document the production URL, automatic deployment behavior, required GitHub Secrets, and manual workflow execution

## Verification and Acceptance Criteria

Before enabling the workflow:

- Shell syntax checks pass for deployment scripts.
- The static CI/CD configuration test passes.
- Frontend production build passes.
- Backend JavaScript syntax checks pass.
- Docker configuration test passes.
- The workflow YAML parses successfully.

The implementation is accepted when:

- all four repository secrets are present;
- a manual workflow run completes successfully;
- EC2 `/opt/logit` reaches the same commit as `origin/main`;
- all Compose services are healthy;
- both public HTTPS health endpoints succeed;
- a later push to `main` automatically starts the same CI/CD workflow.

## Security Notes

- The production private key is stored only as an encrypted GitHub Actions secret and a temporary mode-`600` file on the runner.
- The workflow never prints secret values.
- GitHub-hosted runner IP addresses vary, so the EC2 security group must permit TCP port `22` from `0.0.0.0/0` for this direct-SSH design. This is broader than the current user-IP-only rule. The host is hardened to public-key authentication only, password and keyboard-interactive authentication remain disabled, direct root login is disabled, and the workflow pins the server host key. The existing user-IP SSH rule becomes redundant and is removed after the public key-only rule is verified.
- Third-party deployment actions are avoided. The workflow uses standard shell, OpenSSH, official GitHub checkout/setup actions, Node, Docker, and the existing EC2 tooling.
