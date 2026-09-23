import { Router } from 'express';
import { createRoom, getAllRooms, getRoom, canCreateRoom } from '../store/rooms.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(getAllRooms());
});

// 입장 전 최소 정보 조회 — 초대 링크로 로비를 거치지 않고 바로 들어온 경우에도
// 비밀번호 입력 필드를 정확히 렌더링하기 위해 필요 (내용은 노출하지 않음)
router.get('/:id', (req, res) => {
  const room = getRoom(req.params.id);
  if (!room) {
    return res.status(404).json({ error: '방을 찾을 수 없습니다' });
  }
  res.json({
    id: room.id,
    title: room.title,
    mode: room.mode,
    hasPassword: !!room.password,
    status: room.status,
  });
});

const VALID_MODES = ['ai_debate', 'human_debate', 'solo_essay'];
const VALID_TOPIC_MODES = ['manual', 'ai_auto'];

router.post('/', requireAuth, rateLimit(10, 10 * 60_000), (req, res) => {
  if (!canCreateRoom(req.user.id)) return res.status(429).json({ error: '열려 있는 방을 정리한 후 다시 시도해주세요.' });
  const { title, mode, topicMode, topic, password, handicap, coachingEnabled, structuredArgumentEnabled } = req.body;
  if (!title || typeof title !== 'string' || !title.trim() || title.length > 200) {
    return res.status(400).json({ error: 'title은 필수입니다' });
  }
  const resolvedMode = VALID_MODES.includes(mode) ? mode : 'ai_debate';
  const resolvedTopicMode = VALID_TOPIC_MODES.includes(topicMode) ? topicMode : 'ai_auto';
  if (resolvedTopicMode === 'manual') {
    if (!topic || typeof topic !== 'string' || !topic.trim() || topic.length > 2000) {
      return res.status(400).json({ error: '직접 입력 시 주제는 필수입니다' });
    }
  }
  const room = createRoom({
    ownerId: req.user.id,
    title: title.trim(),
    mode: resolvedMode,
    topicMode: resolvedTopicMode,
    topic: resolvedTopicMode === 'manual' ? topic.trim() : null,
    password: password && typeof password === 'string' ? password.trim() || null : null,
    handicap: handicap && typeof handicap === 'object' ? handicap : null,
    coachingEnabled: coachingEnabled ?? true,
    structuredArgumentEnabled: structuredArgumentEnabled ?? true,
  });
  const io = req.app.locals.io;
  io.emit('room_list', getAllRooms());

  res.status(201).json(room);
});

// 실제 입장(소켓 join) 전에 비밀번호만 미리 확인 — 틀렸을 때 방 목록/입장 폼에서 바로 재입력할 수 있게 함
router.post('/:id/verify-password', requireAuth, rateLimit(10, 60_000), (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  const room = getRoom(id);
  if (!room) {
    return res.status(404).json({ error: '방을 찾을 수 없습니다' });
  }
  if (room.password && room.password !== password) {
    return res.status(401).json({ error: '비밀번호가 틀렸습니다' });
  }
  res.json({ ok: true });
});

export default router;
