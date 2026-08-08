
# DB setup
```
  "@prisma/client": "^7.5.0",
  "prisma": "^7.5.0",
```
DB version: psql (PostgreSQL) 16.13
### id: postgres
### pw: 0118
- - -
### 1. postresql 다운로드
```bash
  sudo apt update && sudo apt install -y postgresql postgresql-contrib
```

### 2. PostgreSQL 서비스 시작
```bash
  sudo service postgresql
  start
```

### 3. DB 및 유저 생성
```bash
  sudo -u postgres psql
```
#### db 접속 후:
```sql
  CREATE DATABASE debate_game_db;
  CREATE USER postgres WITH PASSWORD '0118';
  GRANT ALL PRIVILEGES ON DATABASE debate_game_db TO postgres;
  \q
```

### 4. backend .env 파일에 DB 연결 정보 추가
```bash
  DATABASE_URL="postgresql://postgres:0118@localhost:5432/debate_game_db"

  EX) DATABASE_URL="postgresql://root:1234@localhost:5432/logit"
```

- - -
### backend 디렉터리에서 실행
```bash
cd logic-arena-backend
```

### 5. root 유저에 DB 생성 권한 부여
```bash
  sudo -u postgres psql -c "ALTER USER root CREATEDB;"
```

### 6. public 스키마 권한 부여
```bash
  sudo -u postgres psql -c "GRANT ALL ON SCHEMA public TO postgres;" debate_game_db
```

### 7. migrate 실행(실제 테이블 생성)
```bash
  npx prisma migrate dev --name init
```
![alt text](image.png)

### 8. 클라이언트 코드 생성
```bash
  npx prisma generate
```

### 완료시 src/generated/prisma 생성됨
