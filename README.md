# Logit

토론방 생성, 실시간 토론, AI 논제·주장 생성 기능을 제공하는 웹 애플리케이션입니다. 프론트엔드, 백엔드, PostgreSQL을 Docker Compose로 실행하며 운영 환경은 AWS EC2 한 대에서 관리합니다.

## 현재 운영 상태

| 항목 | 현재 설정 |
| --- | --- |
| 운영 주소 | <https://logit.woo-zu.com> |
| 운영 브랜치 | `main` |
| 배포 방식 | GitHub Actions → EC2 SSH → Docker Compose |
| 서버 | AWS EC2 `t3.medium`, gp3 40GB |
| 서버 경로 | `/opt/logit` |
| HTTPS | 호스트 Nginx + Let's Encrypt 자동 갱신 |
| 데이터베이스 | PostgreSQL 16 Docker volume |
| AI | OpenAI, 운영 모델 `gpt-5.5` |

현재 프론트엔드, 백엔드, PostgreSQL 컨테이너에는 health check가 적용되어 있습니다.

```mermaid
flowchart LR
    U[사용자] --> R[Route 53]
    R --> N[EC2 호스트 Nginx<br/>HTTPS 종료]
    N --> F[프론트엔드 Nginx<br/>React 정적 파일]
    F --> B[Node.js 백엔드<br/>REST + Socket.IO]
    B --> P[(PostgreSQL)]
    B --> O[OpenAI API]
```

외부에는 EC2의 80/443 포트만 애플리케이션용으로 공개됩니다. 프론트엔드 컨테이너는 `127.0.0.1:3000`에만 연결되고 백엔드와 PostgreSQL은 Docker 내부 네트워크에서만 접근됩니다.

## 프로젝트 구조

```text
.
├── logic-arena-frontend/       # React + Vite 프론트엔드
├── logic-arena-backend/        # Express + Socket.IO + Prisma 백엔드
├── deploy/
│   ├── ec2/                    # EC2 Nginx, SSH, 자동 배포 설정
│   ├── raspberry-pi/           # Raspberry Pi 배포 자료
│   ├── test-docker-config.sh   # Docker 구성 검사
│   └── test-cicd-config.sh     # CI/CD 구성 검사
├── .github/workflows/          # GitHub Actions
├── compose.yaml
└── .env.example
```

## 로컬 Docker 실행

필요한 도구는 Git과 Docker Desktop입니다.

```bash
git clone https://github.com/Logic-Arena/Logit.git
cd Logit
cp .env.example .env
```

로컬 `.env`에서 최소한 다음 값을 변경합니다.

```dotenv
HTTP_PORT=3000
POSTGRES_PASSWORD=로컬_DB_비밀번호
DATABASE_URL=postgresql://logit:로컬_DB_비밀번호@postgres:5432/logit
CORS_ORIGIN=http://localhost:3000
FRONTEND_URL=http://localhost:3000
JWT_SECRET=충분히_긴_임의값
SESSION_SECRET=충분히_긴_임의값
TEACHER_CODE=원하는_교사코드
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
KAKAO_CALLBACK_URL=http://localhost:3000/api/auth/kakao/callback
```

AI 기능을 사용하려면 한 공급자의 키를 추가합니다.

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=발급받은_키
OPENAI_MODEL=gpt-5.5
```

실행과 확인:

```bash
docker compose up -d --build
docker compose ps
```

- 로컬 서비스: <http://localhost:3000>
- 프론트 health: <http://localhost:3000/healthz>
- 백엔드 health: <http://localhost:3000/api/health>

로그 확인과 종료:

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose down
```

`docker compose down -v`는 PostgreSQL volume까지 삭제하므로 데이터 초기화가 확실히 필요한 경우에만 사용합니다.

## 환경변수와 비밀값 관리

- `.env`와 `*.env`는 Git에 커밋하지 않습니다. 공유용 `.env.example`만 예외입니다.
- 공유 가능한 변수 이름과 예시는 `.env.example`에만 추가합니다.
- 운영 환경변수는 EC2의 `/opt/logit/.env`에서 관리합니다.
- GitHub Actions는 운영 `.env`를 생성하거나 덮어쓰지 않습니다.
- OpenAI, Google, Kakao 등의 애플리케이션 키는 GitHub Actions SSH Secrets와 별개입니다.
- 키를 Slack, 이슈, PR, Actions 로그에 붙여 넣지 않습니다.

운영 OpenAI 설정은 현재 다음 형태입니다. 실제 키 값은 EC2에만 있습니다.

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=비공개
OPENAI_MODEL=gpt-5.5
```

## 개발 및 배포 흐름

`main`은 운영 브랜치입니다. `main`에 push되면 운영 배포가 즉시 시작되므로 일반 작업은 개인 브랜치에서 진행하고 팀 확인 후 `main`에 반영하는 것을 권장합니다.

```bash
git switch main
git pull --ff-only origin main
git switch -c 이름/feat-작업명
```

배포 흐름:

```text
main push
  → 프론트엔드 설치 및 프로덕션 빌드
  → 백엔드 설치 및 JavaScript 문법 검사
  → Docker/CI·CD 구성 검사
  → EC2 SSH 접속
  → origin/main fast-forward
  → Docker 이미지 빌드
  → Prisma migration
  → 컨테이너 재생성 및 health check
  → 공개 HTTPS health check
```

워크플로 파일은 `.github/workflows/deploy-production.yml`, 서버에서 실행되는 배포 로직은 `deploy/ec2/deploy.sh`입니다.

### 수동 배포 실행

코드 push 없이 같은 배포를 다시 실행하려면:

1. GitHub 저장소의 **Actions** 탭으로 이동합니다.
2. 왼쪽에서 **Deploy production**을 선택합니다.
3. **Run workflow**에서 `main`을 선택해 실행합니다.

### GitHub Actions Secrets

다음 값은 이미 저장소에 등록되어 있으며 EC2 SSH 접속에만 사용됩니다.

- `EC2_HOST`
- `EC2_USER`
- `EC2_SSH_PRIVATE_KEY`
- `EC2_KNOWN_HOSTS`

운영 API 키는 이 목록에 넣지 않고 EC2 `/opt/logit/.env`에서 관리합니다.

## EC2 접속과 운영 점검

접근 권한과 개인키를 받은 팀원은 `~/.ssh/config`에 별칭을 등록할 수 있습니다.

```sshconfig
Host logit
  HostName 54.116.127.47
  User ubuntu
  IdentityFile ~/.ssh/logit-production-key.pem
  IdentitiesOnly yes
```

```bash
chmod 400 ~/.ssh/logit-production-key.pem
ssh logit
```

개인키는 저장소나 메신저에 올리지 말고 안전한 경로로 전달받아야 합니다. EC2는 SSH 공개키 인증만 허용하며 비밀번호 로그인과 루트 로그인을 차단합니다.

자주 사용하는 운영 명령:

```bash
ssh logit
cd /opt/logit

git status --short --branch
docker compose ps
docker compose logs --tail=200 backend
docker compose logs --tail=200 frontend
sudo nginx -t
sudo systemctl status nginx
```

운영 상태를 외부에서 확인하려면:

```bash
curl -fsS https://logit.woo-zu.com/healthz
curl -fsS https://logit.woo-zu.com/api/health
```

정상 응답은 각각 `ok`와 `{"status":"ok"}`입니다.

## 문제 발생 시 확인 순서

1. GitHub Actions의 실패한 단계와 로그를 확인합니다.
2. EC2에서 `git status --short --branch`로 `main` 동기화 상태를 확인합니다.
3. `docker compose ps`에서 세 서비스가 `healthy`인지 확인합니다.
4. `docker compose logs --tail=200 backend`로 API, migration, AI 오류를 확인합니다.
5. `docker compose logs --tail=200 frontend`와 `sudo nginx -t`로 프록시 오류를 확인합니다.
6. 공개 health URL 두 개를 확인합니다.

배포 스크립트는 EC2 저장소의 tracked 파일에 로컬 수정이 있으면 안전을 위해 중단됩니다. 서버에서 코드를 직접 수정하지 말고 저장소에 커밋한 뒤 `main`으로 배포합니다.

## 현재 알려진 사항

- 프론트엔드의 기존 ESLint 오류는 아직 CI 배포 차단 조건이 아닙니다.
- `npm audit`에 기존 의존성 경고가 남아 있으며 별도 정리가 필요합니다.
- 현재 Docker Compose 배포는 컨테이너 교체 중 짧은 재시작 시간이 발생할 수 있습니다.
- PostgreSQL 데이터는 Docker named volume에 유지되지만, 이것만으로 외부 백업이 되지는 않습니다.

## Git 규칙

### 브랜치 이름

`이름/할일` 형식을 사용하고 단어는 하이픈으로 연결합니다.

| 구분 | 형식 | 예시 |
| --- | --- | --- |
| 기능 개발 | `이름/feat-기능명` | `sowon/feat-login` |
| 버그 수정 | `이름/fix-오류명` | `sowon/fix-db-error` |
| 문서 수정 | `이름/docs-항목` | `sowon/docs-readme` |
| 리팩터링 | `이름/refactor-대상` | `sowon/refactor-ui` |
| 기타 | `이름/chore-작업명` | `sowon/chore-config` |

### 커밋 메시지

`Type: Subject` 형식을 사용합니다.

| 타입 | 용도 |
| --- | --- |
| `Feat` | 기능 추가 |
| `Fix` | 버그 수정 |
| `Docs` | 문서 수정 |
| `Style` | 코드 포맷팅 |
| `Refactor` | 기능 변화 없는 리팩터링 |
| `Test` | 테스트 추가·수정 |
| `Chore` | 빌드·설정 등 기타 작업 |

- 제목은 50자 이내로 작성하고 마침표를 붙이지 않습니다.
- 제목의 첫 글자는 대문자로 시작합니다.
- 필요한 경우 본문에 무엇을 왜 변경했는지 작성합니다.

### Pull Request

```markdown
## 개요
- 변경 사항 요약

## 주요 변경 사항
- 수정한 파일과 로직

## 관련 이슈
- #이슈번호
```
## test 