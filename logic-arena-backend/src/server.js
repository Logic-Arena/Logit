import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import { PORT, CORS_ORIGIN } from './config.js';
import roomsRouter from './routes/rooms.js';
import { registerHandlers } from './socket/handlers.js';
import pkg from '@prisma/client';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const { PrismaClient } = pkg;
const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
console.log("현재 설정된 DB 주소:", connectionString);
const pool = new Pool({ connectionString });
// Prisma 전용 어댑터로 감싸기
const adapter = new PrismaPg(pool);
// PrismaClient에 어댑터 주입
const prisma = new PrismaClient({ adapter });

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.locals.io = io;

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/rooms', roomsRouter);

// 회원가입 API: 프론트엔드에서 사용자 정보를 보내면 DB에 저장
// 주소: http://localhost:PORT/api/users
app.post('/api/users', async (req, res) => {
  const { name, email, provider, login_id, password } = req.body;

  try {
    // 유저를 생성시 초기 능력치(UserStats)도 함께 생성
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        provider,
        login_id,
        password,
        // 능력치도 자동 생성
        stats: {
          create: {} 
          // UserStats 테이블에 기본값을 자동 생성
        }
      },
      // 결과를 돌려줄 때 능력치 정보도 같이 포함해서 달라고 요청
      include: {
        stats: true 
      }
    });

    res.status(201).json({
      success: true,
      message: "회원가입이 완료되었습니다!",
      user: newUser
    });
  } catch (error) {
    console.error("회원가입 에러:", error);
    res.status(500).json({
      success: false,
      error: "이미 가입된 계정이거나 데이터베이스 오류가 발생했습니다."
    });
  }
});

// 로그인 API: 아이디와 비번을 확인
app.post('/api/login', async (req, res) => {
  const { login_id, password } = req.body;

  try {
    // DB에서 해당 아이디를 가진 유저 찾기
    const user = await prisma.user.findUnique({
      where: { login_id: login_id },
      include: { stats: true } 
    });

    // 유저가 없거나 비밀번호 틀렸을 때
    if (!user || user.password !== password) {
      return res.status(401).json({
        success: false,
        message: "아이디 또는 비밀번호가 틀렸습니다."
      });
    }

    // 로그인 성공 시
    res.json({
      success: true,
      message: `${user.name}님 환영합니다!`,
      user: {
        id: user.id,
        name: user.name,
        stats: user.stats
      }
    });
  } catch (error) {
    console.error("로그인 에러:", error);
    res.status(500).json({ success: false, message: "서버 에러 발생" });
  }
});

io.use((socket, next) => {
  socket.data.roomId = null;
  socket.data.userId = null;
  socket.data.username = null;
  next();
});

io.on('connection', (socket) => {
  registerHandlers(io, socket);
});

httpServer.listen(PORT, () => {
  console.log(`Logic Arena Backend listening on port ${PORT}`);
});
