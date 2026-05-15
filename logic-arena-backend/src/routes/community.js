import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { generateCommunityTopics } from '../services/ai.js';

const router = Router();

async function getOrCreateActiveTopics() {
  const now = new Date();
  const active = await prisma.communityTopic.findMany({
    where: { expires_at: { gt: now } },
    orderBy: { created_at: 'desc' },
    take: 3,
  });

  if (active.length >= 3) return active;

  const generated = await generateCommunityTopics();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const created = await Promise.all(
    generated.map((t) =>
      prisma.communityTopic.create({
        data: { question: t.question, category: t.category, badge: t.badge ?? null, expires_at: expiresAt },
      })
    )
  );

  return created;
}

router.get('/', optionalAuth, async (req, res) => {
  try {
    const topics = await getOrCreateActiveTopics();
    const userId = req.user?.id ?? null;

    let userVotes = {};
    if (userId) {
      const votes = await prisma.communityVote.findMany({
        where: { user_id: userId, topic_id: { in: topics.map((t) => t.id) } },
      });
      userVotes = Object.fromEntries(votes.map((v) => [v.topic_id, v.vote]));
    }

    res.json(topics.map((t) => ({ ...t, myVote: userVotes[t.id] ?? null })));
  } catch (error) {
    console.error('[Community] 주제 조회 실패:', error.message);
    res.status(500).json({ error: '주제를 불러오지 못했습니다.' });
  }
});

router.post('/:id/vote', requireAuth, async (req, res) => {
  try {
    const topicId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const { vote } = req.body;

    if (!['pro', 'con'].includes(vote)) {
      return res.status(400).json({ error: '잘못된 투표 값입니다.' });
    }

    const topic = await prisma.communityTopic.findUnique({ where: { id: topicId } });
    if (!topic) return res.status(404).json({ error: '주제를 찾을 수 없습니다.' });

    const existing = await prisma.communityVote.findFirst({ where: { topic_id: topicId, user_id: userId } });

    if (existing) {
      if (existing.vote === vote) {
        await prisma.communityVote.delete({ where: { id: existing.id } });
        await prisma.communityTopic.update({
          where: { id: topicId },
          data: vote === 'pro' ? { pro_votes: { decrement: 1 } } : { con_votes: { decrement: 1 } },
        });
        const updated = await prisma.communityTopic.findUnique({ where: { id: topicId } });
        return res.json({ myVote: null, topic: updated });
      } else {
        await prisma.communityVote.update({ where: { id: existing.id }, data: { vote } });
        await prisma.communityTopic.update({
          where: { id: topicId },
          data: vote === 'pro'
            ? { pro_votes: { increment: 1 }, con_votes: { decrement: 1 } }
            : { con_votes: { increment: 1 }, pro_votes: { decrement: 1 } },
        });
        const updated = await prisma.communityTopic.findUnique({ where: { id: topicId } });
        return res.json({ myVote: vote, topic: updated });
      }
    }

    await prisma.communityVote.create({ data: { topic_id: topicId, user_id: userId, vote } });
    await prisma.communityTopic.update({
      where: { id: topicId },
      data: vote === 'pro' ? { pro_votes: { increment: 1 } } : { con_votes: { increment: 1 } },
    });
    const updated = await prisma.communityTopic.findUnique({ where: { id: topicId } });
    res.json({ myVote: vote, topic: updated });
  } catch (error) {
    console.error('[Community] 투표 실패:', error.message);
    res.status(500).json({ error: '투표에 실패했습니다.' });
  }
});

export default router;
