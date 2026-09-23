import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { Server as SocketIOServer } from 'socket.io';
import { PORT, CORS_ORIGIN, SESSION_SECRET } from './config.js';
import roomsRouter from './routes/rooms.js';
import authRouter from './routes/auth.js';
import historyRouter from './routes/history.js';
import communityRouter from './routes/community.js';
import trainingRouter from './routes/training.js';
import adminRouter from './routes/admin.js';
import teacherRouter from './routes/teacher.js';
import { registerHandlers } from './socket/handlers.js';
import { authenticateSocket, guardSocket } from './socket/security.js';
import { sessionEvents } from './store/sessionStore.js';
import { initializeSlots, startPollScheduler } from './scheduler/pollScheduler.js';

const app = express();
const httpServer = createServer(app);
const allowedOrigins = new Set(Array.isArray(CORS_ORIGIN) ? CORS_ORIGIN : [CORS_ORIGIN]);
const io = new SocketIOServer(httpServer, {
  maxHttpBufferSize: 64 * 1024,
  allowRequest: (req, done) => done(null, !req.headers.origin || allowedOrigins.has(req.headers.origin)),
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());

app.locals.io = io;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/rooms', roomsRouter);
app.use('/auth', authRouter);
app.use('/debate-history', historyRouter);
app.use('/community-topics', communityRouter);
app.use('/training-recommendation', trainingRouter);
app.use('/admin', adminRouter);
app.use('/teacher', teacherRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/auth', authRouter);
app.use('/api/debate-history', historyRouter);
app.use('/api/community-topics', communityRouter);
app.use('/api/training-recommendation', trainingRouter);
app.use('/api/admin', adminRouter);
app.use('/api/teacher', teacherRouter);

io.use(authenticateSocket);
sessionEvents.on('revoked', userId => {
  io.in(`account:${userId}`).disconnectSockets(true);
});

io.on('connection', (socket) => {
  socket.join(`account:${socket.data.userId}`);
  guardSocket(socket);
  registerHandlers(io, socket);
});

httpServer.listen(PORT, async () => {
  console.log(`Logic Arena Backend listening on port ${PORT}`);

  // 빈 슬롯 AI 자동 초기화 후 스케줄러 등록
  await initializeSlots(io);
  startPollScheduler(io);
});
