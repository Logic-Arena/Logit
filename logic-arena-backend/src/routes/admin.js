import { Router } from 'express';
import { prisma } from '../db/prisma.js';

const router = Router();

// 개발 환경에서만 작동하는 미들웨어
router.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Admin API는 개발 환경에서만 사용 가능합니다.' });
  }
  next();
});

// 슬롯 초기화 (개발용)
router.post('/init-slots', async (req, res) => {
  try {
    const topics = await prisma.communityTopic.findMany({
      orderBy: { id: 'asc' },
    });

    const slots = ['A', 'B', 'C'];
    const categories = ['사회/정치', '경제/과학', '문화/환경'];

    for (let i = 0; i < topics.length; i++) {
      const slotIdx = i % 3;
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      await prisma.communityTopic.update({
        where: { id: topics[i].id },
        data: {
          slot: slots[slotIdx],
          category_fixed: categories[slotIdx],
          status: 'active',
          expires_at: expiresAt,
          display_order: slotIdx,
        },
      });
    }

    const updated = await prisma.communityTopic.findMany({
      orderBy: { display_order: 'asc' },
    });

    res.json({ message: '슬롯 초기화 완료', topics: updated });
  } catch (error) {
    console.error('[Admin] 슬롯 초기화 실패:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
