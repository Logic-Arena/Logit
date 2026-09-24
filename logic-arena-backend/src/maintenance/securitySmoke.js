// Production check: synthetic rows only, cleanup by returned IDs, no paid AI.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { prisma } from '../db/prisma.js';

const base = 'http://127.0.0.1:4000';
const ids = { users: [], classes: [], histories: [] };
const tokens = [];
const password = randomUUID();
const prefix = 'security-smoke-' + randomUUID();
const checks = [];
async function request(path, token, method = 'GET') {
  const response = await fetch(base + path, { method, headers: {
    'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}),
  }, ...(method === 'POST' ? { body: '{}' } : {}), signal: AbortSignal.timeout(10000) });
  return { status: response.status, body: await response.json() };
}
try {
  const hash = await bcrypt.hash(password, 10);
  for (const [index, role] of ['teacher', 'teacher', 'student', 'student'].entries()) {
    const user = await prisma.user.create({ data: { provider: 'local', login_id: prefix + '-' + index, name: 'Security smoke fixture', role, password: hash, stats: { create: {} } } });
    ids.users.push(user.user_id);
    const response = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user.login_id, password }), signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, 200);
    const login = await response.json();
    assert.ok(login.token);
    tokens.push(login.token);
  }
  for (let index = 0; index < 2; index++) {
    const cls = await prisma.debateClass.create({ data: { name: 'Security smoke fixture', teacher_id: ids.users[index], class_code: randomBytes(16).toString('hex') } });
    ids.classes.push(cls.id);
    await prisma.debateClassMember.create({ data: { class_id: cls.id, user_id: ids.users[index + 2] } });
    const history = await prisma.debateHistory.create({ data: { user_id: ids.users[index + 2], topic: 'Synthetic security smoke record', position: 'pro', result: 'draw', teacher_summary: { summary: 'Synthetic cached summary' } } });
    ids.histories.push(history.id);
  }
  const ownClass = await request('/api/teacher/classes/' + ids.classes[0] + '/students', tokens[0]);
  assert.equal(ownClass.status, 200); assert.equal(ownClass.body.length, 1);
  assert.equal((await request('/api/teacher/classes/' + ids.classes[1] + '/students', tokens[0])).status, 404);
  assert.equal((await request('/api/teacher/debate-summary/' + ids.histories[0], tokens[0])).status, 200);
  assert.equal((await request('/api/teacher/debate-summary/' + ids.histories[1], tokens[0])).status, 403);
  checks.push('teacher own-class access allowed; other-class students and summaries denied');
  assert.equal((await request('/api/teacher/debate-summary/' + ids.histories[0], tokens[2])).status, 403);
  assert.equal((await request('/api/teacher/debate-summary/' + ids.histories[0])).status, 401);
  checks.push('student role and anonymous teacher access denied');
  const own = await request('/api/debate-history', tokens[2]);
  assert.equal(own.status, 200); assert.deepEqual(own.body.map(row => row.id), [ids.histories[0]]);
  checks.push('student history scoped to authenticated account');
  assert.equal((await request('/api/auth/logout', tokens[2], 'POST')).status, 200);
  assert.equal((await request('/api/debate-history', tokens[2])).status, 401);
  checks.push('logout revokes access token');
  const exposed = await prisma.user.findMany({ where: { provider: 'local', login_id: { in: ['test01', 'testuser'] } }, select: { password: true } });
  assert.ok(exposed.every(user => user.password === null));
  checks.push('reported exposed local accounts have no enabled password');
} finally {
  for (const token of tokens) await request('/api/auth/logout', token, 'POST').catch(() => null);
  await prisma.debateHistory.deleteMany({ where: { id: { in: ids.histories } } });
  await prisma.debateClass.deleteMany({ where: { id: { in: ids.classes } } });
  await prisma.userStats.deleteMany({ where: { user_id: { in: ids.users } } });
  await prisma.teacherSettings.deleteMany({ where: { user_id: { in: ids.users } } });
  await prisma.user.deleteMany({ where: { user_id: { in: ids.users } } });
  assert.equal(await prisma.user.count({ where: { user_id: { in: ids.users } } }), 0);
  await prisma.$disconnect();
}
console.log(JSON.stringify({ securitySmoke: 'passed', revision: process.env.APP_REVISION, checks, fixtureCleanup: 'verified', paidAiCalls: 0 }));
