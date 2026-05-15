# Raspberry Pi Deployment

이 폴더는 Logit을 Raspberry Pi 한 대에서 운영하기 위한 배포 자산입니다.

구성:

- Nginx: `logic-arena-frontend/dist` 정적 파일 서빙
- PM2: `logic-arena-backend/src/server.js` 상시 실행
- PostgreSQL: Pi 내부 DB
- 기본 LAN 주소: `http://rpi.local`

## 1. Pi 시스템 준비

Pi에 SSH로 접속한 뒤 repo 루트에서 실행합니다.

```bash
LOGIT_DB_PASSWORD='원하는_DB_비밀번호' \
  bash deploy/raspberry-pi/setup-system.sh
```

비밀번호를 생략하면 스크립트가 임시 비밀번호를 생성해서 마지막에 출력합니다.

## 2. 백엔드 env 작성

```bash
cp deploy/raspberry-pi/backend.env.example logic-arena-backend/.env
```

필수로 바꿀 값:

- `DATABASE_URL`
- `JWT_SECRET`
- `SESSION_SECRET`
- `OPENAI_API_KEY` 또는 `GEMINI_API_KEY`

`rpi.local`이 동작하지 않는 네트워크라면 Pi의 고정 IP로 바꿉니다.

```env
CORS_ORIGIN=http://192.168.0.20
FRONTEND_URL=http://192.168.0.20
```

여러 주소를 동시에 허용해야 하면 `CORS_ORIGIN`은 콤마로 구분합니다.

```env
CORS_ORIGIN=http://rpi.local,http://192.168.0.20
```

## 3. Render DB 데이터 복원

Render의 외부 Postgres URL을 준비한 뒤 Pi에서 실행합니다.

```bash
RENDER_DATABASE_URL='postgresql://render_user:render_pw@render_host/render_db' \
PI_DATABASE_URL='postgresql://logit_user:pi_pw@localhost:5432/debate_game_db' \
  bash deploy/raspberry-pi/restore-render-db.sh
```

자동 확인 없이 실행하려면 `CONFIRM_RESTORE=yes`를 추가합니다.

## 4. 앱 배포

```bash
PUBLIC_HOST=rpi.local bash deploy/raspberry-pi/deploy-app.sh
```

IP로 접속할 경우:

```bash
PUBLIC_HOST=192.168.0.20 bash deploy/raspberry-pi/deploy-app.sh
```

배포 스크립트가 수행하는 일:

- 백엔드 `npm ci`
- `prisma migrate deploy`
- `prisma generate`
- 프론트 `VITE_API_URL=<FRONTEND_API_URL> npm run build`
- `dist`를 `/var/www/logit`에 복사
- Nginx site 설정 설치 및 reload
- PM2에 `logit-backend` 등록 및 save

참고용 프론트 env 샘플은 `deploy/raspberry-pi/frontend.env.example`에 있습니다. 배포 스크립트는 이 파일을 복사하지 않고 `FRONTEND_API_URL` 값으로 `VITE_API_URL`을 직접 주입합니다. Cloudflare Tunnel처럼 프론트와 백엔드를 같은 도메인으로 운영할 때는 `FRONTEND_API_URL=/api`를 사용합니다.

## 5. 확인

```bash
systemctl status postgresql
pm2 status
curl http://localhost:4000/health
curl -I http://rpi.local
```

다른 기기에서 같은 Wi-Fi에 접속한 뒤 `http://rpi.local`을 열어 봅니다.

## 운영 메모

- 백엔드 로그: `pm2 logs logit-backend`
- 백엔드 재시작: `pm2 restart logit-backend`
- 프론트 재배포: `PUBLIC_HOST=rpi.local bash deploy/raspberry-pi/deploy-app.sh`
- Nginx 설정 테스트: `sudo nginx -t`
