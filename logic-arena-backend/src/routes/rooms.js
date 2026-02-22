import { Router } from 'express';
import { createRoom, getAllRooms } from '../store/rooms.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(getAllRooms());
});

router.post('/', (req, res) => {
  const { title } = req.body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title은 필수입니다' });
  }

  const room = createRoom({ title: title.trim() });
  const io = req.app.locals.io;
  io.emit('room_list', getAllRooms());

  res.status(201).json(room);
});

export default router;
