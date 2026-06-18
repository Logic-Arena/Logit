import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';

const router = express.Router();

function requireTeacher(req, res, next) {
  if (req.user?.role !== 'teacher') {
    return res.status(403).json({ error: '선생님 계정만 접근할 수 있습니다.' });
  }
  next();
}

function generateClassCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ─── AI 핸디캡 설정 ─────────────────────────────────────────────

router.get('/settings', requireAuth, requireTeacher, async (req, res) => {
  try {
    const userId = req.user.id;
    let settings = await prisma.teacherSettings.findUnique({ where: { user_id: userId } });
    if (!settings) {
      settings = await prisma.teacherSettings.create({ data: { user_id: userId } });
    }
    return res.json({
      enabled: settings.enabled,
      vocab: settings.vocab,
      evidenceLimit: settings.evidence_limit,
      rebuttalLimit: settings.rebuttal_limit,
      shortGameMode: settings.short_game_mode,
    });
  } catch {
    return res.status(500).json({ error: '설정을 불러오지 못했습니다.' });
  }
});

router.put('/settings', requireAuth, requireTeacher, async (req, res) => {
  try {
    const userId = req.user.id;
    const { enabled, vocab, evidenceLimit, rebuttalLimit, shortGameMode } = req.body;
    const settings = await prisma.teacherSettings.upsert({
      where: { user_id: userId },
      update: {
        enabled: Boolean(enabled),
        vocab: Boolean(vocab),
        evidence_limit: Boolean(evidenceLimit),
        rebuttal_limit: Boolean(rebuttalLimit),
        short_game_mode: Boolean(shortGameMode),
      },
      create: {
        user_id: userId,
        enabled: Boolean(enabled),
        vocab: Boolean(vocab),
        evidence_limit: Boolean(evidenceLimit),
        rebuttal_limit: Boolean(rebuttalLimit),
        short_game_mode: Boolean(shortGameMode),
      },
    });
    return res.json({
      enabled: settings.enabled,
      vocab: settings.vocab,
      evidenceLimit: settings.evidence_limit,
      rebuttalLimit: settings.rebuttal_limit,
      shortGameMode: settings.short_game_mode,
    });
  } catch {
    return res.status(500).json({ error: '설정 저장에 실패했습니다.' });
  }
});

// ─── 학급 관리 ───────────────────────────────────────────────────

router.get('/classes', requireAuth, requireTeacher, async (req, res) => {
  try {
    const classes = await prisma.debateClass.findMany({
      where: { teacher_id: req.user.id },
      include: { members: { select: { user_id: true } } },
      orderBy: { created_at: 'desc' },
    });
    return res.json(classes.map(c => ({
      id: c.id,
      name: c.name,
      classCode: c.class_code,
      memberCount: c.members.length,
      createdAt: c.created_at,
    })));
  } catch {
    return res.status(500).json({ error: '학급 목록을 불러오지 못했습니다.' });
  }
});

router.post('/classes', requireAuth, requireTeacher, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '학급 이름을 입력해주세요.' });

    let classCode;
    let attempts = 0;
    do {
      classCode = generateClassCode();
      const existing = await prisma.debateClass.findUnique({ where: { class_code: classCode } });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    const cls = await prisma.debateClass.create({
      data: { name: name.trim(), class_code: classCode, teacher_id: req.user.id },
    });
    return res.status(201).json({ id: cls.id, name: cls.name, classCode: cls.class_code, memberCount: 0 });
  } catch {
    return res.status(500).json({ error: '학급 생성에 실패했습니다.' });
  }
});

router.delete('/classes/:classId', requireAuth, requireTeacher, async (req, res) => {
  try {
    const classId = parseInt(req.params.classId, 10);
    const cls = await prisma.debateClass.findUnique({ where: { id: classId } });
    if (!cls || cls.teacher_id !== req.user.id) return res.status(404).json({ error: '학급을 찾을 수 없습니다.' });
    await prisma.debateClass.delete({ where: { id: classId } });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: '학급 삭제에 실패했습니다.' });
  }
});

router.get('/classes/:classId/students', requireAuth, requireTeacher, async (req, res) => {
  try {
    const classId = parseInt(req.params.classId, 10);
    const cls = await prisma.debateClass.findUnique({ where: { id: classId } });
    if (!cls || cls.teacher_id !== req.user.id) return res.status(404).json({ error: '학급을 찾을 수 없습니다.' });

    const members = await prisma.debateClassMember.findMany({
      where: { class_id: classId },
      include: { user: { include: { stats: true } } },
      orderBy: { joined_at: 'asc' },
    });

    const studentIds = members.map(m => m.user_id);
    const histories = await prisma.debateHistory.findMany({
      where: { user_id: { in: studentIds } },
      orderBy: { played_at: 'desc' },
    });

    const historyByStudent = {};
    histories.forEach(h => {
      if (!historyByStudent[h.user_id]) historyByStudent[h.user_id] = [];
      historyByStudent[h.user_id].push(h);
    });

    const avg = (arr, key) => arr.length > 0 ? Math.round(arr.reduce((s, h) => s + h[key], 0) / arr.length) : 0;

    return res.json(members.map(m => {
      const all = historyByStudent[m.user_id] ?? [];
      const recent = all.slice(0, 10);

      let growthRate = 0;
      if (all.length >= 4) {
        const sorted = [...all].sort((a, b) => new Date(a.played_at) - new Date(b.played_at));
        const half = Math.ceil(sorted.length / 2);
        const early = sorted.slice(0, half).reduce((s, h) => s + h.score, 0) / half;
        const late = sorted.slice(-half).reduce((s, h) => s + h.score, 0) / half;
        growthRate = early > 0 ? Math.round(((late - early) / early) * 100) : 0;
      }

      return {
        userId: m.user_id,
        name: m.user.name,
        joinedAt: m.joined_at,
        tier: m.user.stats?.tier ?? '브론즈 5',
        rankPoint: m.user.stats?.rank_point ?? 0,
        totalGames: m.user.stats?.total_games ?? 0,
        winCount: m.user.stats?.win_count ?? 0,
        avgScore: avg(recent, 'score'),
        avgLogic: avg(recent, 'logic'),
        avgEvidence: avg(recent, 'evidence'),
        avgPersuasion: avg(recent, 'persuasion'),
        avgRebuttal: avg(recent, 'rebuttal'),
        avgConsistency: avg(recent, 'consistency'),
        growthRate,
        recentDebates: recent.slice(0, 5).map(h => ({
          id: h.id,
          topic: h.topic,
          result: h.result,
          score: h.score,
          playedAt: h.played_at,
        })),
      };
    }));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '학생 목록을 불러오지 못했습니다.' });
  }
});

router.get('/classes/:classId/summary', requireAuth, requireTeacher, async (req, res) => {
  try {
    const classId = parseInt(req.params.classId, 10);
    const cls = await prisma.debateClass.findUnique({ where: { id: classId } });
    if (!cls || cls.teacher_id !== req.user.id) return res.status(404).json({ error: '학급을 찾을 수 없습니다.' });

    const members = await prisma.debateClassMember.findMany({ where: { class_id: classId } });
    const studentIds = members.map(m => m.user_id);
    if (studentIds.length === 0) {
      return res.json({ totalDebates: 0, avgScore: 0, topStudents: [], avgByCategory: {}, weakestCategory: null, recentDebates: [] });
    }

    const histories = await prisma.debateHistory.findMany({
      where: { user_id: { in: studentIds } },
      include: { user: { select: { name: true } } },
      orderBy: { played_at: 'desc' },
    });

    const totalDebates = histories.length;
    const n = totalDebates || 1;
    const avgScore = totalDebates > 0 ? Math.round(histories.reduce((s, h) => s + h.score, 0) / totalDebates) : 0;

    const scoreByStudent = {};
    histories.forEach(h => {
      if (!scoreByStudent[h.user_id]) scoreByStudent[h.user_id] = { name: h.user.name, total: 0, count: 0 };
      scoreByStudent[h.user_id].total += h.score;
      scoreByStudent[h.user_id].count++;
    });
    const topStudents = Object.entries(scoreByStudent)
      .map(([userId, d]) => ({ userId: parseInt(userId), name: d.name, avgScore: Math.round(d.total / d.count), debateCount: d.count }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 5);

    const avgByCategory = {
      logic: Math.round(histories.reduce((s, h) => s + h.logic, 0) / n),
      evidence: Math.round(histories.reduce((s, h) => s + h.evidence, 0) / n),
      persuasion: Math.round(histories.reduce((s, h) => s + h.persuasion, 0) / n),
      rebuttal: Math.round(histories.reduce((s, h) => s + h.rebuttal, 0) / n),
      consistency: Math.round(histories.reduce((s, h) => s + h.consistency, 0) / n),
    };

    const weakestEntry = Object.entries(avgByCategory).sort((a, b) => a[1] - b[1])[0];

    return res.json({
      totalDebates,
      avgScore,
      topStudents,
      avgByCategory,
      weakestCategory: { key: weakestEntry[0], avg: weakestEntry[1] },
      recentDebates: histories.slice(0, 10).map(h => ({
        topic: h.topic,
        result: h.result,
        score: h.score,
        studentName: h.user.name,
        playedAt: h.played_at,
      })),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '통계를 불러오지 못했습니다.' });
  }
});

// ─── 학생: 학급 참가 ─────────────────────────────────────────────

router.post('/join', requireAuth, async (req, res) => {
  try {
    const { classCode } = req.body;
    if (!classCode?.trim()) return res.status(400).json({ error: '학급 코드를 입력해주세요.' });

    const cls = await prisma.debateClass.findUnique({ where: { class_code: classCode.trim().toUpperCase() } });
    if (!cls) return res.status(404).json({ error: '유효하지 않은 학급 코드입니다.' });

    const existing = await prisma.debateClassMember.findUnique({
      where: { class_id_user_id: { class_id: cls.id, user_id: req.user.id } },
    });
    if (existing) return res.json({ ok: true, alreadyJoined: true, className: cls.name });

    await prisma.debateClassMember.create({ data: { class_id: cls.id, user_id: req.user.id } });
    return res.status(201).json({ ok: true, alreadyJoined: false, className: cls.name });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '학급 참가에 실패했습니다.' });
  }
});

export default router;
