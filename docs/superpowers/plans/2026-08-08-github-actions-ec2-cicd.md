# GitHub Actions EC2 CI/CD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for configuration scripts and superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy every validated `main` push to the existing Logit EC2 Docker Compose stack through GitHub Actions.

**Architecture:** A GitHub-hosted runner performs build and static configuration checks, then connects to EC2 with a repository-secret SSH key. A versioned deployment script fast-forwards `/opt/logit`, builds images, applies Prisma migrations, recreates services, and verifies private container health plus public HTTPS endpoints.

**Tech Stack:** GitHub Actions, Bash, OpenSSH, Docker Compose, Prisma, EC2, GitHub CLI

---

### Task 1: Define CI/CD configuration tests

**Files:**
- Create: `deploy/test-cicd-config.sh`
- Test: `deploy/test-cicd-config.sh`

- [ ] Write a failing static test for the expected workflow triggers, concurrency, CI checks, CD dependency, secret references, strict SSH settings, and deployment safety commands.
- [ ] Run the test and confirm it fails because the workflow and deployment script do not exist.

### Task 2: Add the EC2 deployment script

**Files:**
- Create: `deploy/ec2/deploy.sh`
- Create: `deploy/ec2/00-logit-sshd-hardening.conf`
- Test: `deploy/test-cicd-config.sh`

- [ ] Implement strict shell handling, clean-main validation, fast-forward update, Docker image build, PostgreSQL health wait, Prisma migration, service recreation, health waits, and public HTTPS checks.
- [ ] Add an sshd drop-in that keeps public-key authentication enabled and disables password, keyboard-interactive, and root login.
- [ ] Run shell syntax and static tests; confirm workflow-specific assertions still fail.

### Task 3: Add the GitHub Actions workflow

**Files:**
- Create: `.github/workflows/deploy-production.yml`
- Test: `deploy/test-cicd-config.sh`

- [ ] Add `main` push and manual triggers with non-canceling production concurrency.
- [ ] Add a CI job for frontend install/build, backend install/syntax, and Docker config validation.
- [ ] Add a CD job that depends on CI, creates temporary SSH files from four secrets, pins the host key, and streams the versioned deployment script to EC2.
- [ ] Run the static CI/CD test and YAML parsing check; confirm they pass.

### Task 4: Document operation and verify locally

**Files:**
- Modify: `README.md`
- Test: frontend build, backend syntax, Docker config, CI/CD config

- [ ] Document the production URL, automatic and manual deployment, required GitHub Secrets, local `ssh logit` access, and known lint exclusion.
- [ ] Run the complete local verification suite and inspect the diff for secrets.

### Task 5: Configure local SSH, EC2, and GitHub Secrets

**Files:**
- Modify: `~/.ssh/config`
- Create on EC2: `/etc/ssh/sshd_config.d/00-logit-hardening.conf`
- Modify externally: EC2 security group and GitHub repository secrets

- [ ] Add an idempotent local `Host logit` alias and verify `ssh logit` works.
- [ ] Install and validate the sshd hardening drop-in before reloading SSH.
- [ ] Permit inbound TCP 22 from `0.0.0.0/0`, remove the redundant user-IP SSH rule, and verify key-only access remains functional.
- [ ] Register `EC2_HOST`, `EC2_USER`, `EC2_SSH_PRIVATE_KEY`, and trusted `EC2_KNOWN_HOSTS` with GitHub without printing values.

### Task 6: Commit, push, and prove automatic deployment

**Files:**
- Commit all repository changes on `main`

- [ ] Commit and push the implementation to `main`.
- [ ] Watch the triggered GitHub Actions run to completion and collect failure diagnostics if needed.
- [ ] Verify EC2 is on the pushed commit, all Compose services are healthy, migrations are current, and both HTTPS health endpoints succeed.
- [ ] Confirm the local branch, `origin/main`, and EC2 checkout are synchronized.
