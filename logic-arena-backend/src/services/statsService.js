import { prisma } from '../db/prisma.js';
import { generateTeacherDebateSummary } from './ai.js';
import { pendingSummaries } from '../store/pendingSummaries.js';
import { DEBATE_WHERE } from '../utils/soloEssay.js';

const TIERS = [
  { name: '브론즈 5', min: 0 },
  { name: '브론즈 4', min: 100 },
  { name: '브론즈 3', min: 200 },
  { name: '브론즈 2', min: 300 },
  { name: '브론즈 1', min: 400 },
  { name: '실버 5', min: 500 },
  { name: '실버 4', min: 650 },
  { name: '실버 3', min: 800 },
  { name: '실버 2', min: 950 },
  { name: '실버 1', min: 1100 },
  { name: '골드 5', min: 1300 },
  { name: '골드 4', min: 1500 },
  { name: '골드 3', min: 1750 },
  { name: '골드 2', min: 2000 },
  { name: '골드 1', min: 2300 },
  { name: '플래티넘 5', min: 2600 },
  { name: '플래티넘 4', min: 3000 },
  { name: '플래티넘 3', min: 3500 },
  { name: '플래티넘 2', min: 4000 },
  { name: '플래티넘 1', min: 4600 },
  { name: '다이아몬드', min: 5000 },
];

function calcTier(rankPoint) {
  let tier = TIERS[0].name;
  for (const t of TIERS) {
    if (rankPoint >= t.min) tier = t.name;
    else break;
  }
  return tier;
}

const WIN_RP = 20;
const LOSE_RP = 20;

/**
 * @param {Array<{userId: string, vote: 'pro'|'con', isSolo?: boolean}>} participants
 * @param {'pro'|'con'|'draw'} winner
 */
export async function saveDebateHistory(participants, result, topic) {
  const dbParticipants = participants.filter((p) => /^\d+$/.test(p.userId));
  if (dbParticipants.length === 0) return;

  const safeTopic = topic?.trim() || '(주제 없음)';

  await Promise.all(
    dbParticipants.map(async (p) => {
      const userId = parseInt(p.userId, 10);

      // solo_essay: position='pro'|'con'(실제 선택한 입장), result='solo', winner 없음
      // 2인 토론: position='pro'|'con', result='win'|'lose'|'draw'
      // solo/2인 구분은 result만으로 충분하므로 position은 항상 실제 입장을 그대로 저장한다.
      const isSolo = p.isSolo === true;
      const isWinner = !isSolo && result.winner !== 'draw' && p.vote === result.winner;
      const isDraw = !isSolo && result.winner === 'draw';
      const resultLabel = isSolo ? 'solo' : (isDraw ? 'draw' : isWinner ? 'win' : 'lose');

      const scoreData = result.scores?.find((s) => s.vote === p.vote && s.type === 'player');
      const score = scoreData?.total ?? 0;

      const created = await prisma.debateHistory.create({
        data: {
          user_id: userId,
          topic: safeTopic,
          position: p.vote,
          score,
          logic: scoreData?.logic ?? 0,
          evidence: scoreData?.evidence ?? 0,
          persuasion: scoreData?.persuasion ?? 0,
          rebuttal: scoreData?.rebuttal ?? 0,
          consistency: scoreData?.consistency ?? 0,
          advice: scoreData?.advice ?? null,
          result: resultLabel,
        },
      });

      // 교사 요약 비동기 생성 (토론 흐름 차단 안 함)
      // 생성 중에 교사가 조회하면 202만 반환하도록 저장 직후 잠금 등록
      pendingSummaries.add(created.id);
      ;(async () => {
        try {
          const user = await prisma.user.findUnique({ where: { user_id: userId }, select: { name: true } });
          const summary = await generateTeacherDebateSummary({
            studentName: user?.name ?? '학생',
            topic: safeTopic,
            position: p.vote,
            result: resultLabel,
            score,
            logic: scoreData?.logic ?? 0,
            evidence: scoreData?.evidence ?? 0,
            persuasion: scoreData?.persuasion ?? 0,
            rebuttal: scoreData?.rebuttal ?? 0,
            consistency: scoreData?.consistency ?? 0,
            advice: scoreData?.advice ?? null,
          });
          await prisma.debateHistory.update({
            where: { id: created.id },
            data: { teacher_summary: summary },
          });
        } catch (e) {
          console.error('[teacher_summary] 생성 실패:', e.message);
        } finally {
          pendingSummaries.delete(created.id);
        }
      })();

      // score_average 갱신 (실패해도 이력 생성은 유지)
      try {
        const allScores = await prisma.debateHistory.findMany({
          where: { user_id: userId },
          select: { score: true },
        });
        if (allScores.length > 0) {
          const avg = allScores.reduce((s, h) => s + h.score, 0) / allScores.length;
          await prisma.userStats.update({
            where: { user_id: userId },
            data: { score_average: Math.round(avg * 10) / 10 },
          });
        }
      } catch (e) {
        console.error('[saveDebateHistory] score_average 갱신 실패:', e.message);
      }
    })
  );
}

export async function updateStats(participants, winner) {
  const dbParticipants = participants.filter((p) => /^\d+$/.test(p.userId));
  if (dbParticipants.length === 0) return;

  await Promise.all(
    dbParticipants.map(async (p) => {
      const userId = parseInt(p.userId, 10);
      const isWinner = winner !== 'draw' && p.vote === winner;
      const isDraw = winner === 'draw';

      const stats = await prisma.userStats.findUnique({ where: { user_id: userId } });
      if (!stats) return;

      const rpDelta = isDraw ? 0 : isWinner ? WIN_RP : -LOSE_RP;
      const newRp = Math.max(0, stats.rank_point + rpDelta);
      const newTier = calcTier(newRp);

      // total_games / win_count는 DebateHistory 실제 건수 기준으로 계산 (stats 단독 카운트 시 불일치 방지)
      // 개인 논술(result='solo')은 토론 수에서 제외
      const [totalGames, winCount] = await Promise.all([
        prisma.debateHistory.count({ where: { user_id: userId, ...DEBATE_WHERE } }),
        prisma.debateHistory.count({ where: { user_id: userId, result: 'win' } }),
      ]);

      await prisma.userStats.update({
        where: { user_id: userId },
        data: {
          rank_point: newRp,
          total_games: totalGames + 1,
          win_count: winCount + (isWinner ? 1 : 0),
          tier: newTier,
        },
      });
    })
  );
}
