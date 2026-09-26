import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isSoloRecord, DEBATE_WHERE } from '../src/utils/soloEssay.js';

// 실제 소스를 읽어 import만 제거하고, 의존성은 대역으로 주입해 실행한다.
function loadSource(relPath, exportNames, deps) {
  const source = readFileSync(new URL(relPath, import.meta.url), 'utf8')
    .replace(/^import [\s\S]*?;\r?\n/gm, '')
    .replace('export default router;', '')
    .replace(/^export /gm, '');
  const names = Object.keys(deps);
  return new Function(...names, `${source}\nreturn { ${exportNames.join(', ')} };`)(...names.map(n => deps[n]));
}

function teacherRoutes({ prisma, pendingSummaries, generateTeacherDebateSummary }) {
  const routes = new Map();
  const route = (method) => (path, ...mw) => routes.set(`${method} ${path}`, mw.at(-1));
  const router = { get: route('GET'), post: route('POST'), put: route('PUT'), patch: route('PATCH'), delete: route('DELETE') };
  loadSource('../src/routes/teacher.js', [], {
    express: { Router: () => router }, prisma, isSoloRecord, pendingSummaries, generateTeacherDebateSummary,
    requireAuth() {}, aiRequestLimit(req, res, next) { next(); },
    validateSetukContext() {}, setukContext() {}, generateSetukDraft() {}, summarizeSetuk() {}, TEACHER_SUBJECTS: [],
  });
  return routes;
}

async function call(handler, req) {
  const out = {};
  const res = { status(code) { out.status = code; return res; }, json(v) { out.body = v; return res; } };
  await handler(req, res);
  return { status: out.status ?? 200, body: out.body };
}

const tick = () => new Promise(resolve => setImmediate(resolve));

test('토론 종료 시 요약 생성 중에는 교사가 조회해도 재생성하지 않고 202만 반환', async () => {
  const pendingSummaries = new Set();
  const rows = new Map();
  let aiCalls = 0;
  let finishSaveTimeSummary;
  const generateTeacherDebateSummary = () => {
    aiCalls++;
    return new Promise(resolve => { finishSaveTimeSummary = () => resolve('저장 시점 요약'); });
  };
  const prisma = {
    debateHistory: {
      async create({ data }) { const row = { id: 7, ...data, teacher_summary: null }; rows.set(7, row); return row; },
      async update({ where, data }) { Object.assign(rows.get(where.id), data); },
      async findMany() { return []; },
      async findUnique({ where }) { return rows.get(where.id); },
    },
    user: { async findUnique() { return { name: '학생' }; } },
    userStats: { async update() {} },
    debateClassMember: { async findFirst() { return { class_id: 1 }; } },
  };

  const { saveDebateHistory } = loadSource('../src/services/statsService.js', ['saveDebateHistory'], {
    prisma, DEBATE_WHERE, pendingSummaries, generateTeacherDebateSummary,
  });
  await saveDebateHistory([{ userId: '3', vote: 'pro' }], { winner: 'pro', scores: [] }, '주제');
  await tick();
  assert.equal(aiCalls, 1);
  assert.ok(pendingSummaries.has(7), '저장 시점 생성 중에는 잠금이 걸려 있어야 함');

  const routes = teacherRoutes({ prisma, pendingSummaries, generateTeacherDebateSummary });
  const req = { user: { id: 99, role: 'teacher' }, params: { historyId: '7' } };
  const viewed = await call(routes.get('GET /debate-summary/:historyId'), req);
  assert.equal(viewed.status, 202);
  assert.equal(aiCalls, 1, '조회로 인한 추가 AI 호출이 없어야 함');

  finishSaveTimeSummary();
  await tick(); await tick();
  assert.equal(pendingSummaries.has(7), false, '생성이 끝나면 잠금 해제');
  const done = await call(routes.get('GET /debate-summary/:historyId'), req);
  assert.equal(done.status, 200);
  assert.equal(done.body, '저장 시점 요약');
});

test('학급 참가: 교사 계정은 403으로 거절하고 학생은 참가', async () => {
  const created = [];
  const prisma = {
    debateClass: { async findUnique() { return { id: 1, name: '1반' }; } },
    debateClassMember: {
      async findUnique() { return null; },
      async create({ data }) { created.push(data); },
    },
  };
  const routes = teacherRoutes({ prisma, pendingSummaries: new Set(), generateTeacherDebateSummary() {} });
  const join = routes.get('POST /join');

  const teacher = await call(join, { user: { id: 10, role: 'teacher' }, body: { classCode: 'abc123' } });
  assert.equal(teacher.status, 403);
  assert.equal(created.length, 0);

  const student = await call(join, { user: { id: 11, role: 'student' }, body: { classCode: 'abc123' } });
  assert.equal(student.status, 201);
  assert.deepEqual(created, [{ class_id: 1, user_id: 11 }]);
});
