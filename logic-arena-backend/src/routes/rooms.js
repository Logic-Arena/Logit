import { Router } from 'express';
import { createRoom, getAllRooms, getRoom } from '../store/rooms.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(getAllRooms());
});

const VALID_MODES = ['ai_debate', 'human_debate'];
const VALID_TOPIC_MODES = ['manual', 'ai_auto'];

router.post('/', (req, res) => {
  const { title, mode, topicMode, topic, password, handicap, coachingEnabled } = req.body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title은 필수입니다' });
  }
  const resolvedMode = VALID_MODES.includes(mode) ? mode : 'ai_debate';
  const resolvedTopicMode = VALID_TOPIC_MODES.includes(topicMode) ? topicMode : 'ai_auto';
  if (resolvedTopicMode === 'manual') {
    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return res.status(400).json({ error: '직접 입력 시 주제는 필수입니다' });
    }
  }
  const room = createRoom({
    title: title.trim(),
    mode: resolvedMode,
    topicMode: resolvedTopicMode,
    topic: resolvedTopicMode === 'manual' ? topic.trim() : null,
    password: password && typeof password === 'string' ? password.trim() || null : null,
    handicap: handicap && typeof handicap === 'object' ? handicap : null,
    coachingEnabled: coachingEnabled !== false,
  });
  const io = req.app.locals.io;
  io.emit('room_list', getAllRooms());

  res.status(201).json(room);
});

// 실제 입장(소켓 join) 전에 비밀번호만 미리 확인 — 틀렸을 때 방 목록/입장 폼에서 바로 재입력할 수 있게 함
router.post('/:id/verify-password', (req, res) => {
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
