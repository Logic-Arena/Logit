import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { generateTrainingRecommendation } from '../services/ai.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const histories = await prisma.debateHistory.findMany({
      where: { user_id: userId },
      orderBy: { played_at: 'desc' },
      take: 10,
    });

    if (histories.length === 0) {
      return res.json({
        title: '첫 토론을 시작해보세요!',
        description: '아직 토론 이력이 없습니다. AI와의 토론에 참여하여 논리 능력을 키워보세요. 처음이라도 괜찮아요 — 지금 바로 도전해보세요!',
        topic: '인공지능이 인간의 일자리를 대체해야 한다',
      });
    }

    const avg = (key) => Math.round(histories.reduce((s, h) => s + (h[key] ?? 0), 0) / histories.length);

    const weakScores = [
      { axis: '논리력', score: avg('logic') },
      { axis: '근거 제시', score: avg('evidence') },
      { axis: '표현 명확성', score: avg('persuasion') },
      { axis: '반박 능력', score: avg('rebuttal') },
    ];

    const recentTopics = histories.slice(0, 5).map((h) => h.topic);
    const recommendation = await generateTrainingRecommendation({ weakScores, recentTopics });
    res.json(recommendation);
  } catch (error) {
    console.error('[Training] 추천 실패:', error.message);
    res.status(500).json({ error: '추천을 불러오지 못했습니다.' });
  }
});

export default router;
