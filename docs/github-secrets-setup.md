# GitHub Secrets 설정 가이드

## 개요

이 문서는 EC2 배포 시 필요한 환경 변수를 GitHub Secrets에 등록하는 방법을 안내합니다.

## GitHub Secrets 등록 방법

### 1. GitHub 리포지토리 접속
1. https://github.com/Logic-Arena/Logit 접속
2. **Settings** 탭 클릭
3. 좌측 메뉴에서 **Secrets and variables** > **Actions** 클릭
4. **New repository secret** 버튼 클릭

### 2. 필수 Secrets 등록

아래 각 항목을 **Name**과 **Secret** 필드에 입력하여 하나씩 추가합니다.

#### 📌 EC2 접속 정보 (이미 등록되어 있음)
```
Name: EC2_HOST
Secret: 54.116.127.47

Name: EC2_USER
Secret: ubuntu

Name: EC2_SSH_PRIVATE_KEY
Secret: (EC2 SSH 개인키 전체 내용)

Name: EC2_KNOWN_HOSTS
Secret: (EC2 known_hosts 항목)
```

#### 📌 PostgreSQL 설정
```
Name: POSTGRES_DB
Secret: logit_db

Name: POSTGRES_USER
Secret: logit_user

Name: POSTGRES_PASSWORD
Secret: (강력한 비밀번호)
```

#### 📌 Backend 설정
```
Name: DATABASE_URL
Secret: postgresql://logit_user:(비밀번호)@postgres:5432/logit_db
참고: (비밀번호) 부분을 POSTGRES_PASSWORD와 동일하게 설정

Name: CORS_ORIGIN
Secret: https://logit.woo-zu.com

Name: FRONTEND_URL
Secret: https://logit.woo-zu.com

Name: JWT_SECRET
Secret: (최소 32자 이상의 랜덤 문자열)

Name: SESSION_SECRET
Secret: (최소 32자 이상의 랜덤 문자열)

Name: TEACHER_CODE
Secret: (선생님 회원가입용 코드)
```

#### 📌 AI Provider
```
Name: AI_PROVIDER
Secret: openai

Name: OPENAI_API_KEY
Secret: sk-...

Name: OPENAI_MODEL
Secret: gpt-4o-mini

Name: GEMINI_API_KEY
Secret: (있으면 입력, 없으면 빈 값)

Name: GEMINI_MODEL
Secret: gemini-2.0-flash
```

#### 📌 Social Login
```
Name: GOOGLE_CLIENT_ID
Secret: (Google Cloud Console에서 발급받은 ID)

Name: GOOGLE_CLIENT_SECRET
Secret: (Google Cloud Console에서 발급받은 Secret)

Name: GOOGLE_CALLBACK_URL
Secret: https://logit.woo-zu.com/api/auth/google/callback

Name: KAKAO_REST_API_KEY
Secret: (Kakao Developers에서 발급받은 REST API 키)

Name: KAKAO_CLIENT_SECRET
Secret: (Kakao Developers에서 발급받은 Client Secret)

Name: KAKAO_CALLBACK_URL
Secret: https://logit.woo-zu.com/api/auth/kakao/callback
```

#### 📌 Docker Compose
```
Name: HTTP_PORT
Secret: 80

Name: VITE_API_URL
Secret: /api
```

## 랜덤 비밀번호 생성 방법

### Mac/Linux
```bash
# JWT_SECRET 생성
openssl rand -base64 32

# SESSION_SECRET 생성
openssl rand -base64 32

# POSTGRES_PASSWORD 생성
openssl rand -base64 24
```

### Windows (PowerShell)
```powershell
# JWT_SECRET 생성
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# SESSION_SECRET 생성
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# POSTGRES_PASSWORD 생성
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 24 | ForEach-Object {[char]$_})
```

## EC2에서 현재 값 확인 방법

SSH 접속 후:
```bash
cd /opt/logit
cat .env
```

## 배포 확인

Secrets 등록 후:
1. GitHub Actions 탭에서 최신 workflow 확인
2. 또는 수동으로 워크플로우 실행:
   - Actions 탭 → Deploy production → Run workflow

## 문제 해결

### Q: DATABASE_URL 형식은?
A: `postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@postgres:5432/<POSTGRES_DB>`
   - 호스트명은 반드시 `postgres` (Docker Compose 서비스명)

### Q: 콜백 URL은 어떻게 확인하나요?
A: 
- Google: [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
- Kakao: [Kakao Developers](https://developers.kakao.com/) → 내 애플리케이션 → 카카오 로그인

### Q: TEACHER_CODE는 무엇인가요?
A: 선생님 회원가입 시 필요한 인증 코드입니다. 팀 내부에서 정한 값을 사용하세요.

## 참고

- Secrets는 한 번 저장하면 다시 볼 수 없으므로 안전한 곳에 백업하세요
- 값을 변경하려면 기존 Secret을 삭제하고 다시 추가하세요
- 배포할 때마다 이 Secrets가 EC2 `/opt/logit/.env`에 자동으로 동기화됩니다
