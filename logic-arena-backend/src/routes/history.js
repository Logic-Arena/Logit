import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const histories = await prisma.debateHistory.findMany({
      where: { user_id: userId },
      orderBy: { played_at: 'desc' },
      take: 50,
    });
    res.json(histories);
  } catch (error) {
    res.status(500).json({ error: '이력을 불러오지 못했습니다.' });
  }
});

export default router;
