import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Exercise the actual HTTP handlers with an in-memory Prisma substitute.
const records = [
  { user_id: 1, position: 'pro', result: 'win', logic: 10 },
  { user_id: 1, position: 'con', result: 'lose', logic: 12 },
  { user_id: 1, position: 'pro', result: 'solo', logic: 18 },
  { user_id: 1, position: 'con', result: 'solo', logic: 20 },
  { user_id: 1, position: 'solo', result: 'solo', logic: 16 },
  { user_id: 2, position: 'con', result: 'solo', logic: 14 },
];
function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some(condition => matches(row, condition));
    if (key === 'NOT') return !matches(row, value);
    return row[key] === value;
  });
}
function handlers() {
  const routes = new Map();
  const router = { get(path, ...middleware) { routes.set(path, middleware.at(-1)); } };
  const prisma = { debateHistory: {
    async count({ where }) { return records.filter(row => matches(row, where)).length; },
    async aggregate({ where }) {
      const selected = records.filter(row => matches(row, where));
      return { _count: { _all: selected.length }, _avg: { logic: selected.reduce((sum, row) => sum + row.logic, 0) / selected.length } };
    },
  } };
  const SOLO_ESSAY_WHERE = { OR: [{ result: 'solo' }, { position: 'solo' }] };
  const DEBATE_WHERE = { NOT: SOLO_ESSAY_WHERE };
  const source = readFileSync(new URL('../src/routes/history.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace('export default router;', '');
  new Function('Router', 'prisma', 'requireAuth', 'SOLO_ESSAY_WHERE', 'DEBATE_WHERE', source)(
    () => router, prisma, () => {}, SOLO_ESSAY_WHERE, DEBATE_WHERE
  );
  return routes;
}
test('summary counts both stances and legacy solo records without counting another student', async () => {
  let response;
  await handlers().get('/summary')({ user: { id: 1 } }, { json(value) { response = value; } });
  assert.deepEqual(response, { totalActivities: 5, debateCount: 2, soloEssayCount: 3 });
});
test('type-specific averages use the same classification as activity counts', async () => {
  let response;
  await handlers().get('/averages')({}, { json(value) { response = value; } });
  assert.equal(response.all.count, 6);
  assert.equal(response.debate.count, 2);
  assert.equal(response.debate.logic, 11);
  assert.equal(response.soloEssay.count, 4);
  assert.equal(response.soloEssay.logic, 17);
});
