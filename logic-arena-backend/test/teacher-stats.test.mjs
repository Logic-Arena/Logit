import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isSoloRecord, DEBATE_WHERE } from '../src/utils/soloEssay.js';

// 실제 소스를 읽어 import만 제거하고, Prisma는 메모리 대역으로 주입해 실행한다.
function loadSource(relPath, exportNames, deps) {
  const source = readFileSync(new URL(relPath, import.meta.url), 'utf8')
    .replace(/^import [\s\S]*?;\r?\n/gm, '')
    .replace('export default router;', '')
    .replace(/^export /gm, '');
  const names = Object.keys(deps);
  return new Function(...names, `${source}\nreturn { ${exportNames.join(', ')} };`)(...names.map(n => deps[n]));
}

function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some(condition => matches(row, condition));
    if (key === 'NOT') return !matches(row, value);
    if (value && typeof value === 'object' && 'in' in value) return value.in.includes(row[key]);
    return row[key] === value;
  });
}

// played_at은 day 값으로 시간 순서를 만든다.
function h(user_id, day, score, result, position = 'pro') {
  return { id: `${user_id}-${day}`, user_id, played_at: new Date(2026, 0, day), score, result, position,
    topic: 't', logic: 0, evidence: 0, persuasion: 0, rebuttal: 0, consistency: 0, advice: null };
}

function makePrisma(histories, members = []) {
  return {
    debateClass: { async findUnique() { return { id: 1, teacher_id: 99 }; } },
    debateClassMember: { async findMany() { return members; } },
    debateHistory: {
      async findMany({ where }) {
        return histories.filter(r => matches(r, where))
          .sort((a, b) => b.played_at - a.played_at)
          .map(r => ({ ...r, user: { name: `학생${r.user_id}` } }));
      },
      async count({ where }) { return histories.filter(r => matches(r, where)).length; },
    },
  };
}

function teacherRoutes(prisma) {
  const routes = new Map();
  const route = (method) => (path, ...mw) => routes.set(`${method} ${path}`, mw.at(-1));
  const router = { get: route('GET'), post: route('POST'), put: route('PUT'), patch: route('PATCH'), delete: route('DELETE') };
  loadSource('../src/routes/teacher.js', [], {
    express: { Router: () => router }, prisma, isSoloRecord, requireAuth() {}, aiRequestLimit() {},
    validateSetukContext() {}, setukContext() {}, generateTeacherDebateSummary() {}, generateSetukDraft() {},
    summarizeSetuk() {}, TEACHER_SUBJECTS: [],
  });
  return routes;
}

async function call(handler, req) {
  let body;
  const res = { status() { return res; }, json(v) { body = v; return res; } };
  await handler({ user: { id: 99, role: 'teacher' }, params: { classId: '1' }, ...req }, res);
  return body;
}

const member = (id, total_games = 0) => ({ user_id: id, joined_at: new Date(2026, 0, 1),
  user: { name: `학생${id}`, stats: { tier: '브론즈 5', rank_point: 0, total_games, win_count: 0 } } });

test('학생 목록: 토론 수는 논술(legacy 포함)을 빼고 이력 기준으로 계산하고, 이력 없는 학생은 activityCount 0', async () => {
  const histories = [
    h(1, 1, 70, 'win'), h(1, 2, 60, 'lose'), h(1, 3, 80, 'solo'), h(1, 4, 75, 'solo', 'solo'),
  ];
  // 저장된 total_games(7)는 부풀려진 값이라고 가정
  const body = await call(teacherRoutes(makePrisma(histories, [member(1, 7), member(2)])).get('GET /classes/:classId/students'));
  const [s1, s2] = body;
  assert.equal(s1.totalGames, 2);
  assert.equal(s1.activityCount, 4);
  assert.equal(s1.debateRecordCount, 2);
  assert.equal(s1.essayRecordCount, 2);
  assert.equal(s2.totalGames, 0);
  assert.equal(s2.activityCount, 0);
  assert.equal(s2.debateGrowthRate, null);
  assert.equal(s2.essayGrowthRate, null);
});

test('성장률: 모드별로 분리하고, 4건 미만·초기 0점은 null, 변화 없음은 0, 홀수 건은 가운데 제외', async () => {
  const histories = [
    // 학생1 토론 5건: 앞 2건 평균 60, 뒤 2건 평균 80 → +33% (가운데 99 제외)
    h(1, 1, 60, 'win'), h(1, 2, 60, 'lose'), h(1, 3, 99, 'win'), h(1, 4, 80, 'win'), h(1, 5, 80, 'lose'),
    // 학생1 논술 3건 → 기록 부족
    h(1, 6, 50, 'solo'), h(1, 7, 90, 'solo'), h(1, 8, 90, 'solo'),
    // 학생2 토론 4건 모두 70 → 0%
    h(2, 1, 70, 'win'), h(2, 2, 70, 'win'), h(2, 3, 70, 'win'), h(2, 4, 70, 'win'),
    // 학생3 토론 4건, 앞 절반 0점 → 계산 불가
    h(3, 1, 0, 'draw'), h(3, 2, 0, 'draw'), h(3, 3, 70, 'win'), h(3, 4, 70, 'win'),
  ];
  const body = await call(teacherRoutes(makePrisma(histories, [member(1), member(2), member(3)])).get('GET /classes/:classId/students'));
  const byId = Object.fromEntries(body.map(s => [s.userId, s]));
  assert.equal(byId[1].debateGrowthRate, 33);
  assert.equal(byId[1].essayGrowthRate, null);
  assert.equal(byId[2].debateGrowthRate, 0);
  assert.equal(byId[3].debateGrowthRate, null);
  assert.equal(byId[3].debateRecordCount, 4);
});

test('TOP 5: 반올림 전 평균으로 정렬하고 avgScoreExact를 함께 반환', async () => {
  const histories = [
    h(1, 1, 72, 'win'), h(1, 2, 73, 'win'), h(1, 3, 73, 'win'), // 72.67 → 73
    h(2, 1, 73, 'win'), h(2, 2, 73, 'win'), h(2, 3, 74, 'win'), // 73.33 → 73
  ];
  const members = [{ user_id: 1 }, { user_id: 2 }];
  const body = await call(teacherRoutes(makePrisma(histories, members)).get('GET /classes/:classId/summary'));
  assert.deepEqual(body.topStudents.map(s => s.userId), [2, 1]);
  assert.deepEqual(body.topStudents.map(s => s.avgScore), [73, 73]);
  assert.ok(body.topStudents[0].avgScoreExact > body.topStudents[1].avgScoreExact);
});

test('updateStats: total_games는 개인 논술을 제외한 토론 이력 + 이번 판', async () => {
  const histories = [h(5, 1, 70, 'win'), h(5, 2, 60, 'lose'), h(5, 3, 80, 'solo'), h(5, 4, 80, 'solo', 'solo')];
  let updated;
  const prisma = {
    ...makePrisma(histories),
    userStats: {
      async findUnique() { return { rank_point: 100 }; },
      async update({ data }) { updated = data; },
    },
  };
  const { updateStats } = loadSource('../src/services/statsService.js', ['updateStats'], {
    prisma, DEBATE_WHERE, generateTeacherDebateSummary() {},
  });
  await updateStats([{ userId: '5', vote: 'pro' }], 'pro');
  assert.equal(updated.total_games, 3);
  assert.equal(updated.win_count, 2);
});

test('withDebateGameCount: 응답의 stats.total_games를 토론 이력 건수로 덮어씀', async () => {
  const histories = [h(5, 1, 70, 'win'), h(5, 2, 80, 'solo'), h(5, 3, 80, 'solo', 'solo')];
  const { withDebateGameCount } = loadSource('../src/services/authService.js', ['withDebateGameCount'], {
    prisma: makePrisma(histories), DEBATE_WHERE, bcrypt: {}, jwt: {}, JWT_SECRET: 'x',
  });
  const user = await withDebateGameCount({ user_id: 5, stats: { total_games: 9, win_count: 1 } });
  assert.equal(user.stats.total_games, 1);
  assert.equal(user.stats.win_count, 1);
  assert.equal(await withDebateGameCount({ user_id: 5, stats: null }).then(u => u.stats), null);
});
