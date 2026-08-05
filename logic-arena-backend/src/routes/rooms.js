import { Router } from 'express';
import { createRoom, getAllRooms } from '../store/rooms.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(getAllRooms());
});

const VALID_MODES = ['ai_debate', 'human_debate', 'solo_essay'];
const VALID_TOPIC_MODES = ['manual', 'ai_auto'];

router.post('/', (req, res) => {
  const { title, mode, topicMode, topic, password, handicap, coachingEnabled, structuredArgumentEnabled } = req.body;
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
    structuredArgumentEnabled: structuredArgumentEnabled !== false,
  });
  const io = req.app.locals.io;
  io.emit('room_list', getAllRooms());

  res.status(201).json(room);
});

export default router;
