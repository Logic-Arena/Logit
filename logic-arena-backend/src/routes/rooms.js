import { Router } from 'express';
import { createRoom, getAllRooms } from '../store/rooms.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(getAllRooms());
});

const VALID_MODES = ['free_debate', 'ai_debate'];

router.post('/', (req, res) => {
  const { title, mode } = req.body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title은 필수입니다' });
  }

  const resolvedMode = VALID_MODES.includes(mode) ? mode : 'free_debate';
  const room = createRoom({ title: title.trim(), mode: resolvedMode });
  const io = req.app.locals.io;
  io.emit('room_list', getAllRooms());

  res.status(201).json(room);
});

export default router;
