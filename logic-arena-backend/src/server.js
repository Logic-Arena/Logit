import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import { PORT, CORS_ORIGIN } from './config.js';
import roomsRouter from './routes/rooms.js';
import { registerHandlers } from './socket/handlers.js';

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
