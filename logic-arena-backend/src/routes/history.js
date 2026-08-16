import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const emptyAverages = () => ({
  count: 0,
  logic: 0,
  evidence: 0,
  persuasion: 0,
  rebuttal: 0,
  consistency: 0,
});

async function getAverages(where = {}) {
  const aggregate = await prisma.debateHistory.aggregate({
    where,
    _count: { _all: true },
    _avg: {
      logic: true,
      evidence: true,
      persuasion: true,
      rebuttal: true,
      consistency: true,
    },
  });

  if (aggregate._count._all === 0) return emptyAverages();
  return {
    count: aggregate._count._all,
    logic: Math.round(aggregate._avg.logic ?? 0),
    evidence: Math.round(aggregate._avg.evidence ?? 0),
    persuasion: Math.round(aggregate._avg.persuasion ?? 0),
    rebuttal: Math.round(aggregate._avg.rebuttal ?? 0),
    consistency: Math.round(aggregate._avg.consistency ?? 0),
  };
}

router.get('/averages', requireAuth, async (_req, res) => {
  try {
    const [all, debate, soloEssay] = await Promise.all([
      getAverages(),
      getAverages({ position: { not: 'solo' } }),
      getAverages({ position: 'solo' }),
    ]);
    res.json({ all, debate, soloEssay });
  } catch (error) {
    console.error('[History averages] load failed:', error.message);
    res.status(500).json({ error: '전체 평균을 불러오지 못했습니다.' });
  }
});

router.get('/summary', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const [totalActivities, debateCount, soloEssayCount] = await Promise.all([
      prisma.debateHistory.count({ where: { user_id: userId } }),
      prisma.debateHistory.count({ where: { user_id: userId, position: { not: 'solo' } } }),
      prisma.debateHistory.count({ where: { user_id: userId, position: 'solo' } }),
    ]);
    res.json({ totalActivities, debateCount, soloEssayCount });
  } catch (error) {
    console.error('[History summary] load failed:', error.message);
    res.status(500).json({ error: '활동 통계를 불러오지 못했습니다.' });
  }
});

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
