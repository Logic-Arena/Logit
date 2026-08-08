# Raspberry Pi / Cloudflare Migration Notes

## 목표

- Raspberry Pi 한 대에서 프론트엔드 정적 파일, Node 백엔드, PostgreSQL DB를 운영하도록 구성했다.
- LAN 접속은 `http://172.21.101.205` 기준으로 확인했다.
- 외부 접속은 Cloudflare Quick Tunnel로 임시 URL을 열어 확인했다.

## 주요 변경 사항

- `deploy/raspberry-pi/` 배포 자산을 추가했다.
  - `setup-system.sh`: Pi에 PostgreSQL, Nginx, Node 22, PM2 설치 및 DB/유저 생성
  - `deploy-app.sh`: 백엔드 마이그레이션, 프론트 빌드, Nginx 설정, PM2 등록
  - `restore-render-db.sh`: Render Postgres 데이터를 Pi Postgres로 복원
  - `nginx-logit.conf.template`: 프론트 정적 서빙, `/api`, `/socket.io` 프록시
  - `ecosystem.config.cjs`: PM2 백엔드 실행 설정
  - `.env.example` 파일들: Pi 운영 환경변수 샘플
- 루트 `package.json`에 Pi 운영용 스크립트를 추가했다.
  - `npm run pi:setup`
  - `npm run pi:deploy`
  - `npm run pi:restore-db`
- 백엔드 CORS 설정이 콤마로 여러 origin을 받을 수 있게 수정했다.
- Google/Kakao OAuth 환경변수가 비어 있어도 서버가 죽지 않고 503 응답을 반환하도록 수정했다.
- 백엔드에 `/api/*` 라우트를 추가해 Nginx 프록시와 같은 origin 배포를 지원했다.
- 프론트 기본 API 경로를 `/api`로 바꿔 Cloudflare Tunnel/도메인 환경에서도 같은 주소에서 API를 호출하게 했다.
- Socket.IO는 같은 origin 배포 시 현재 host의 `/socket.io`로 연결되도록 수정했다.
- 프론트 타입/빌드 오류를 정리했다.
  - Popover 타이머 ref 타입 수정
  - 사용자 stats 타입에 `score_average` 추가
  - 사용하지 않는 `StatDelta` 컴포넌트 제거
- `backups/`를 `.gitignore`에 추가했다.

## Pi 적용 상태

- Pi에 PostgreSQL, Nginx, Node v22.22.3, PM2, cloudflared 설치 완료.
- Pi의 앱 경로는 `~/logit`.
- Postgres DB는 `debate_game_db`, 앱 유저는 `logit_user`.
- DB 비밀번호와 API 키 등 민감한 값은 Pi의 `.env`에만 설정했고 repo에는 커밋하지 않는다.
- PM2 앱 이름은 `logit-backend`.
- Nginx는 `/var/www/logit`의 프론트 빌드 파일을 서빙한다.

## 확인한 동작

- LAN 프론트: `http://172.21.101.205`
- LAN API health: `http://172.21.101.205/api/health`
- 백엔드 직접 health: `http://172.21.101.205:4000/health`
- Cloudflare Quick Tunnel:
  - `https://doom-scope-truly-shadows.trycloudflare.com`
  - `/api/health` 정상 응답 확인
  - Socket.IO polling 응답 확인

## 주의 사항

- 현재 Cloudflare 주소는 Quick Tunnel 임시 URL이다.
- Pi 전원, 네트워크, `cloudflared` 프로세스가 유지되는 동안은 계속 접근 가능할 수 있지만, Cloudflare가 uptime을 보장하지 않는다.
- Pi 재부팅 또는 `cloudflared` 재시작 시 임시 URL은 바뀔 수 있다.
- 안정적인 운영 주소가 필요하면 도메인을 Cloudflare에 연결하고 named tunnel을 systemd 서비스로 등록해야 한다.
- Render DB 데이터 복원은 아직 하지 않았다. Render Postgres 외부 URL이 필요하다.

## 다음 단계

- 도메인을 구매하거나 기존 도메인을 Cloudflare에 추가한다.
- Cloudflare Dashboard에서 named tunnel을 만들고 Pi의 `cloudflared`를 서비스로 등록한다.
- tunnel public hostname을 Nginx origin `http://localhost:80`에 연결한다.
- 새 도메인을 백엔드 `CORS_ORIGIN`, `FRONTEND_URL`, OAuth callback URL에 반영한다.
- Render Postgres URL을 확보하면 `npm run pi:restore-db`로 데이터를 복원한다.
