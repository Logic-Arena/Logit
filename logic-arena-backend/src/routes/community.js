import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, async (req, res) => {
  try {
    const topics = await prisma.communityTopic.findMany({
      where: { status: 'active' },
      orderBy: { activated_at: 'desc' },
    });

    if (!topics || topics.length === 0) {
      return res.json([]);
    }

    const userId = req.user?.id ?? null;

    let userVotes = {};
    if (userId) {
      const votes = await prisma.communityVote.findMany({
        where: { user_id: userId, topic_id: { in: topics.map((t) => t.id) } },
      });
      userVotes = Object.fromEntries(votes.map((v) => [v.topic_id, v.vote]));
    }

    // activated_at 포함하여 응답
    res.json(topics.map((t) => ({ ...t, myVote: userVotes[t.id] ?? null })));
  } catch (error) {
    console.error('[Community] 주제 조회 실패:', error.message);

    if (error.code === 'P2002') {
      return res.status(500).json({ error: '데이터베이스 오류가 발생했습니다.' });
    }

    res.status(500).json({ error: '주제를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.' });
  }
});

router.post('/:id/vote', requireAuth, async (req, res) => {
  try {
    const topicId = parseInt(req.params.id, 10);

    if (isNaN(topicId) || topicId <= 0) {
      return res.status(400).json({ error: '유효하지 않은 주제 ID입니다.' });
    }

    const userId = req.user.id;
    const { vote } = req.body;

    if (!vote || !['pro', 'con'].includes(vote)) {
      return res.status(400).json({ error: '찬성(pro) 또는 반대(con)를 선택해주세요.' });
    }

    const topic = await prisma.communityTopic.findUnique({ where: { id: topicId } });
    if (!topic) {
      return res.status(404).json({ error: '투표 주제를 찾을 수 없습니다.' });
    }

    if (topic.status !== 'active') {
      return res.status(410).json({ error: '이 주제는 만료되었습니다.' });
    }

    const existing = await prisma.communityVote.findFirst({ where: { topic_id: topicId, user_id: userId } });

    if (existing) {
      if (existing.vote === vote) {
        await prisma.communityVote.delete({ where: { id: existing.id } });
        await prisma.communityTopic.update({
          where: { id: topicId },
          data: vote === 'pro' ? { pro_votes: { decrement: 1 } } : { con_votes: { decrement: 1 } },
        });
        const updated = await prisma.communityTopic.findUnique({ where: { id: topicId } });

        // 실시간 투표 업데이트 브로드캐스트 (투표 취소)
        req.app.locals.io.emit('community_vote_update', {
          topicId,
          topic: updated,
        });

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

        // 실시간 투표 업데이트 브로드캐스트 (투표 변경)
        req.app.locals.io.emit('community_vote_update', {
          topicId,
          topic: updated,
        });

        return res.json({ myVote: vote, topic: updated });
      }
    }

    await prisma.communityVote.create({ data: { topic_id: topicId, user_id: userId, vote } });
    await prisma.communityTopic.update({
      where: { id: topicId },
      data: vote === 'pro' ? { pro_votes: { increment: 1 } } : { con_votes: { increment: 1 } },
    });
    const updated = await prisma.communityTopic.findUnique({ where: { id: topicId } });

    // 실시간 투표 업데이트 브로드캐스트
    req.app.locals.io.emit('community_vote_update', {
      topicId,
      topic: updated,
    });

    res.json({ myVote: vote, topic: updated });
  } catch (error) {
    console.error('[Community] 투표 실패:', error);

    // Prisma 에러 처리
    if (error.code === 'P2025') {
      return res.status(404).json({ error: '주제를 찾을 수 없습니다.' });
    }

    if (error.code === 'P2002') {
      return res.status(409).json({ error: '이미 투표한 주제입니다.' });
    }

    // 데이터베이스 연결 오류
    if (error.code === 'P1001' || error.code === 'P1002') {
      return res.status(503).json({ error: '서버에 일시적인 문제가 발생했습니다.' });
    }

    res.status(500).json({ error: '투표 처리 중 오류가 발생했습니다. 다시 시도해주세요.' });
  }
});

export default router;
