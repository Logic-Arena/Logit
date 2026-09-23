import { verifyAccessToken } from '../middleware/auth.js';
import { createBudget } from '../middleware/rateLimit.js';
import { getPlayerRole } from '../store/rooms.js';

const messages = createBudget(240, 60_000);
const joins = createBudget(15, 60_000);
const starts = createBudget(6, 60 * 60_000);
const retries = createBudget(3, 60_000);
const events = new Set(['join_room', 'leave_room', 'start_game', 'select_side', 'continue_solo_revision', 'retry_essay_feedback', 'save_draft', 'submit_content', 'peer_vote']);

export function authenticateSocket(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    const user = verifyAccessToken(token);
    socket.data = { roomId: null, userId: String(user.id), username: user.name || user.username || '사용자', token };
    next();
  } catch {
    const error = new Error('로그인이 필요합니다. 다시 로그인해주세요.');
    error.data = { code: 'UNAUTHORIZED' };
    next(error);
  }
}

export function guardSocket(socket) {
  const expires = verifyAccessToken(socket.data.token).exp * 1000;
  const expiry = setTimeout(() => socket.disconnect(true), Math.max(1, expires - Date.now()));
  expiry.unref();
  socket.on('disconnect', () => clearTimeout(expiry));
  socket.use(([event, payload], next) => {
    const reject = (message, code = 'FORBIDDEN') => socket.emit('error', { message, code });
    try { verifyAccessToken(socket.data.token); } catch {
      reject('인증이 만료되었습니다. 다시 로그인해주세요.', 'UNAUTHORIZED');
      socket.disconnect(true);
      return;
    }
    if (!events.has(event)) return reject('지원하지 않는 요청입니다.', 'BAD_REQUEST');
    if (messages(socket.data.userId)) return reject('요청이 너무 많습니다.', 'RATE_LIMITED');
    if (event === 'leave_room') return next();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return reject('잘못된 요청입니다.', 'BAD_REQUEST');
    if (event === 'peer_vote') return next();
    if (typeof payload.roomId !== 'string' || payload.roomId.length > 64) return reject('잘못된 방 정보입니다.', 'BAD_REQUEST');
    if (payload.text !== undefined && (typeof payload.text !== 'string' || payload.text.length > 20_000)) return reject('내용은 20000자 이내로 입력해주세요.', 'BAD_REQUEST');
    if (event === 'join_room') {
      if (joins(socket.data.userId)) return reject('입장 요청이 너무 많습니다.', 'RATE_LIMITED');
      if (payload.password !== undefined && (typeof payload.password !== 'string' || payload.password.length > 128)) return reject('잘못된 비밀번호입니다.', 'BAD_REQUEST');
      return next();
    }
    if (socket.data.roomId !== payload.roomId || !getPlayerRole(payload.roomId, socket.id)) return reject('참여 중인 방에서만 요청할 수 있습니다.');
    if (event === 'start_game' && starts(socket.data.userId)) return reject('시간당 토론 시작 횟수를 초과했습니다.', 'RATE_LIMITED');
    if (event === 'retry_essay_feedback' && retries(socket.data.userId)) return reject('피드백 재요청은 분당 3회까지 가능합니다.', 'RATE_LIMITED');
    next();
  });
}
