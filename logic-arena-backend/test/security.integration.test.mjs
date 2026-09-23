// Security regression: actual HTTP/socket handlers, synthetic DB and AI.
// All network traffic is restricted to a new loopback-only server.
import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks, createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';

const root = new URL('../../', import.meta.url);
const backend = new URL('logic-arena-backend/', root);
const requireBackend = createRequire(new URL('package.json', backend));
const requireFrontend = createRequire(new URL('logic-arena-frontend/package.json', root));
const bcrypt = requireBackend('bcrypt');
const jwt = requireBackend('jsonwebtoken');
const { io: connect } = requireFrontend('socket.io-client');
process.env.JWT_SECRET = randomUUID();
process.env.SESSION_SECRET = randomUUID();
process.env.TEACHER_CODE = randomUUID();
process.env.NODE_ENV = 'production';
process.env.PORT = '0';
process.env.CORS_ORIGIN = 'http://127.0.0.1';
process.env.GOOGLE_CLIENT_ID = '';
process.env.GOOGLE_CLIENT_SECRET = '';
process.env.KAKAO_REST_API_KEY = '';

const fixturePassword = randomUUID();
const users = [
  { user_id: 900001, login_id: 'audit_student', name: 'Audit Student', provider: 'local', role: 'student', password: await bcrypt.hash(fixturePassword, 10) },
  { user_id: 900002, login_id: 'audit_teacher', name: 'Audit Teacher', provider: 'local', role: 'teacher', password: await bcrypt.hash(fixturePassword, 10) },
  { user_id: 900003, login_id: 'audit_other', name: 'Audit Other', provider: 'local', role: 'student', password: await bcrypt.hash(fixturePassword, 10) },
];
const histories = [
  { id: 910001, user_id: 900001, topic: 'Private audit record A', score: 50, result: 'win', teacher_summary: { summary: 'Owned student summary' } },
  { id: 910003, user_id: 900003, topic: 'Private audit record B', score: 60, result: 'lose', teacher_summary: { summary: 'Other student summary' } },
];
const calls = { historyQueries: [], statsWrites: [], historyWrites: [], ai: [] };
const matches = (row, where = {}) => Object.entries(where).every(([k, v]) => v === undefined || row[k] === v);
const unsupported = new Proxy({}, { get: (_, model) => new Proxy({}, { get: (_, method) => async () => { throw new Error(`Unmocked DB operation ${String(model)}.${String(method)}`); } }) });
globalThis.__auditDb = Object.assign(unsupported, {});
const db = {
  user: {
    findFirst: async ({ where }) => users.find(u => matches(u, where)) ?? null,
    findUnique: async ({ where }) => users.find(u => matches(u, where)) ?? null,
    update: async ({ where, data }) => { const u = users.find(u => matches(u, where)); assert.ok(u); Object.assign(u, data); return u; },
    create: async ({ data }) => { const user = { ...data, user_id: 900010 + users.length, stats: null, teacher_settings: null }; users.push(user); return user; },
  },
  debateHistory: {
    findMany: async (query) => { calls.historyQueries.push(query); return histories.filter(h => matches(h, query.where)).slice(0, query.take ?? histories.length); },
    findUnique: async ({ where }) => histories.find(h => matches(h, where)) ?? null,
    create: async ({ data }) => { calls.historyWrites.push(data); return { id: 999000 + calls.historyWrites.length, ...data }; },
    update: async ({ data }) => data,
    count: async ({ where }) => histories.filter(h => matches(h, where)).length,
  },
  debateClassMember: {
    findFirst: async ({ where }) => where.user_id === 900001 && where.class.teacher_id === 900002 ? { class_id: 920001 } : null,
  },
  debateClass: { findUnique: async () => ({ id: 920001, teacher_id: 900002 }) },
  userStats: {
    findUnique: async () => ({ rank_point: 100 }),
    update: async ({ where, data }) => { calls.statsWrites.push({ where, data }); return data; },
  },
};
globalThis.__auditDb = new Proxy(db, { get: (t, p) => p in t ? t[p] : unsupported[p] });
globalThis.__auditAi = async (name, args) => {
  calls.ai.push({ name, args });
  if (name === 'generateTopic') return { topic: 'Synthetic audit topic', source: null };
  return { claim: 'Synthetic feedback', summary: 'Synthetic summary' };
};

const aiNames = ['generateTopic','generateArgument','generateRebuttal','generateDefense','generateCounter','generateCoaching','generateSoloFeedback','judgeDebate','judgeSoloEssay','generateTrainingRecommendation','generateTeacherDebateSummary','generateSetukDraft','summarizeSetuk'];
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'dotenv') return { url: 'data:text/javascript,export default {config(){return {}}}', shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === new URL('src/db/prisma.js', backend).href) return { format: 'module', source: 'export const prisma = globalThis.__auditDb;', shortCircuit: true };
    if (url === new URL('src/services/ai.js', backend).href) return { format: 'module', source: aiNames.map(n => `export const ${n} = (...args) => globalThis.__auditAi('${n}', args);`).join('\n'), shortCircuit: true };
    if (url === new URL('src/scheduler/pollScheduler.js', backend).href) return { format: 'module', source: 'export async function initializeSlots(){}; export function startPollScheduler(){};', shortCircuit: true };
    if (url === new URL('src/server.js', backend).href) {
      const source = readFileSync(fileURLToPath(url), 'utf8').replace('httpServer.listen(PORT, async () => {', 'httpServer.listen(0, "127.0.0.1", async () => {') + '\nexport { app, httpServer, io };';
      return { format: 'module', source, shortCircuit: true };
    }
    return next(url, context);
  },
});

const { httpServer, io } = await import(new URL('src/server.js', backend));
if (!httpServer.listening) await once(httpServer, 'listening');
const base = `http://127.0.0.1:${httpServer.address().port}`;
const { createAccessToken } = await import(new URL('src/services/authService.js', backend));
const { createSession } = await import(new URL('src/store/sessionStore.js', backend));
const rooms = await import(new URL('src/store/rooms.js', backend));
let studentToken = createAccessToken(users[0], createSession(users[0].user_id));
const teacherToken = createAccessToken(users[1], createSession(users[1].user_id));
const sockets = [];


async function request(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    ...(body && { body: JSON.stringify(body) }), signal: AbortSignal.timeout(5000),
  });
  const text = await response.text();
  return { status: response.status, body: (() => { try { return JSON.parse(text); } catch { return text; } })() };
}
async function socketClient(token = studentToken, origin = 'http://127.0.0.1', expected = 'connect') {
  const s = connect(base, { transports: ['websocket'], reconnection: false, autoConnect: false, auth: { token }, extraHeaders: { Origin: origin } });
  sockets.push(s);
  const ready = once(s, expected, { signal: AbortSignal.timeout(5000) });
  s.connect(); await ready; return s;
}
async function event(s, eventName, payload, responseName) {
  const received = once(s, responseName, { signal: AbortSignal.timeout(5000) });
  s.emit(eventName, payload); return (await received)[0];
}

test('security regression (loopback only, no real DB or paid AI)', async t => {
  let host, outsider, roomId;
  const roomPassword = 'synthetic-room-password';
  try {
    await t.test('normal login works and invalid credentials have identical responses', async () => {
      const login = await request('/api/auth/login', { method: 'POST', body: { username: users[0].login_id, password: fixturePassword } });
      assert.equal(login.status, 200);
      studentToken = login.body.token;
      const missing = await request('/api/auth/login', { method: 'POST', body: { username: 'synthetic_missing', password: 'incorrect' } });
      const wrong = await request('/api/auth/login', { method: 'POST', body: { username: users[0].login_id, password: 'incorrect' } });
      assert.equal(missing.status, wrong.status);
      assert.deepEqual(missing.body, wrong.body);
    });
    await t.test('missing, reset-purpose, expired and missing-identity tokens are rejected before DB access', async () => {
      const baseClaims = { type: 'access', id: 900001, role: 'student', nonce: jwt.decode(studentToken).nonce };
      const options = { issuer: 'logit', audience: 'logit-api', expiresIn: '10m' };
      const tokens = [undefined, 'invalid.token',
        jwt.sign({ type: 'password_reset', userId: 900001 }, process.env.JWT_SECRET, options),
        jwt.sign({ ...baseClaims, id: undefined }, process.env.JWT_SECRET, options),
        jwt.sign({ ...baseClaims, nonce: undefined }, process.env.JWT_SECRET, options),
        jwt.sign(baseClaims, process.env.JWT_SECRET, { ...options, expiresIn: -1 }),
        jwt.sign(baseClaims, process.env.JWT_SECRET, { ...options, algorithm: 'HS384' }),
      ];
      const before = calls.historyQueries.length;
      for (const token of tokens) assert.equal((await request('/api/debate-history', { token })).status, 401);
      assert.equal(calls.historyQueries.length, before);
      const own = await request('/api/debate-history', { token: studentToken });
      assert.equal(own.status, 200);
      assert.deepEqual(own.body.map(r => r.user_id), [900001]);
      assert.equal(calls.historyQueries.at(-1).where.user_id, 900001);
    });
    await t.test('public recovery routes cannot issue credentials or change passwords', async () => {
      const previous = users[0].password;
      for (const path of ['verify', 'confirm']) {
        const result = await request(`/api/auth/reset-password/${path}`, { method: 'POST', body: { loginId: users[0].login_id, name: users[0].name, resetToken: 'old-token', newPassword: randomUUID() } });
        assert.equal(result.status, 403);
        assert.equal(result.body.resetToken, undefined);
      }
      assert.equal(users[0].password, previous);
      assert.equal((await request('/api/auth/me', { token: studentToken })).status, 200);
    });
    await t.test('signup rejects weak passwords and accepts a strong password', async () => {
      const body = { username: 'synthetic_new_student', name: 'New Student', password: 'short' };
      assert.equal((await request('/api/auth/signup', { method: 'POST', body })).status, 400);
      body.password = randomUUID();
      const signup = await request('/api/auth/signup', { method: 'POST', body });
      assert.equal(signup.status, 201);
      assert.equal(signup.body.user.role, 'student');
      assert.equal((await request('/api/auth/me', { token: signup.body.token })).status, 200);
    });
    await t.test('teacher can read only owned student summaries', async () => {
      assert.equal((await request('/api/teacher/debate-summary/910003')).status, 401);
      assert.equal((await request('/api/teacher/debate-summary/910003', { token: studentToken })).status, 403);
      assert.equal((await request('/api/teacher/debate-summary/910003', { token: teacherToken })).status, 403);
      assert.equal((await request('/api/teacher/debate-summary/910001', { token: teacherToken })).status, 200);
    });
    await t.test('cached teacher summaries do not consume AI generation quota', async () => {
      const before = calls.ai.length;
      for (let i = 0; i < 25; i++) assert.equal((await request('/api/teacher/debate-summary/910001', { token: teacherToken })).status, 200);
      assert.equal(calls.ai.length, before);
    });
    await t.test('concurrent summary requests share a single AI generation', async () => {
      const saved = histories[0].teacher_summary;
      histories[0].teacher_summary = null;
      const previous = globalThis.__auditAi;
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      globalThis.__auditAi = async (...args) => { const result = await previous(...args); if (args[0] === 'generateTeacherDebateSummary') await gate; return result; };
      const before = calls.ai.length;
      try {
        assert.equal((await request('/api/teacher/debate-summary/910001', { token: teacherToken })).status, 202);
        assert.equal((await request('/api/teacher/debate-summary/910001', { token: teacherToken })).status, 202);
        assert.equal(calls.ai.length - before, 1);
      } finally {
        release();
        await new Promise(resolve => setImmediate(resolve));
        globalThis.__auditAi = previous;
        histories[0].teacher_summary = saved;
      }
    });
    await t.test('room creation requires authentication', async () => {
      const body = { title: 'Synthetic private room', mode: 'human_debate', topicMode: 'manual', topic: 'Synthetic topic', password: roomPassword };
      assert.equal((await request('/api/rooms', { method: 'POST', body })).status, 401);
      const created = await request('/api/rooms', { method: 'POST', body, token: studentToken });
      assert.equal(created.status, 201);
      roomId = created.body.id;
    });
    await t.test('socket requires a valid access token and allowed browser origin', async () => {
      for (const [token, origin] of [[null, 'http://127.0.0.1'], ['invalid', 'http://127.0.0.1'], [studentToken, 'https://untrusted.example']]) {
        const rejected = await socketClient(token, origin, 'connect_error');
        assert.equal(rejected.connected, false);
        rejected.disconnect();
      }
      host = await socketClient();
      outsider = await socketClient(teacherToken);
    });
    await t.test('server fixes participant identity to the authenticated account', async () => {
      const joined = await event(host, 'join_room', { roomId, password: roomPassword, userId: '900003', username: 'Untrusted name' }, 'room_state');
      assert.equal(joined.room.proPlayer.userId, '900001');
      assert.equal(joined.room.proPlayer.username, users[0].name);
      assert.equal(calls.statsWrites.length, 0);
      assert.equal(calls.historyWrites.length, 0);
    });
    await t.test('lobby exposes counts but no participant identities or content', async () => {
      rooms.setPhase(roomId, 'pro_p_rebuttal');
      rooms.setContent(roomId, 'pro_argument', 'PRIVATE_SYNTHETIC_CONTENT');
      const listed = (await request('/api/rooms')).body.find(r => r.id === roomId);
      assert.equal(listed.playerCount, 1);
      for (const field of ['content','proPlayer','conPlayer','observers','result','host','pendingSelections','topic']) assert.equal(listed[field], undefined);
      assert.ok(!JSON.stringify(listed).includes('PRIVATE_SYNTHETIC_CONTENT'));
    });
    await t.test('nonmembers cannot read private state through a stale-phase submission', async () => {
      const denied = await event(outsider, 'submit_content', { roomId, phase: 'waiting', text: 'test' }, 'error');
      assert.equal(denied.code, 'FORBIDDEN');
      assert.equal(denied.room, undefined);
      const wrongPassword = await event(outsider, 'join_room', { roomId, password: 'incorrect' }, 'error');
      assert.ok(wrongPassword.message);
      const joined = await event(outsider, 'join_room', { roomId, password: roomPassword }, 'room_state');
      assert.equal(joined.room.conPlayer.userId, '900002');
      const resync = await event(host, 'submit_content', { roomId, phase: 'waiting', text: 'test' }, 'room_state');
      assert.equal(resync.room.content.pro_argument, 'PRIVATE_SYNTHETIC_CONTENT');
      rooms.setPhase(roomId, 'waiting');
    });
    await t.test('malformed socket messages are rejected without crashing the connection', async () => {
      const invalid = await event(host, 'submit_content', null, 'error');
      assert.equal(invalid.code, 'BAD_REQUEST');
      const oversized = await event(host, 'submit_content', { roomId, text: 'a'.repeat(20_001) }, 'error');
      assert.equal(oversized.code, 'BAD_REQUEST');
      assert.equal(host.connected, true);
    });
    await t.test('authenticated participants can start a debate and submit normally', async () => {
      rooms.setContent(roomId, 'pro_argument', null);
      const started = await event(host, 'start_game', { roomId }, 'phase_changed');
      assert.equal(started.phase, 'arguing');
      const submitted = await event(host, 'submit_content', { roomId, phase: 'arguing', text: 'Synthetic valid argument' }, 'content_submitted');
      assert.equal(submitted.contentKey, 'pro_argument');
      assert.equal(rooms.getRoom(roomId).content.pro_argument, 'Synthetic valid argument');
      assert.equal(submitted.room.content.pro_argument, null);
      // Return this synthetic fixture to waiting before the room-switch test.
      rooms.setPhase(roomId, 'waiting');
    });
    await t.test('AI feedback permits normal requests and blocks excess requests', async () => {
      const created = await request('/api/rooms', { method: 'POST', token: studentToken, body: { title: 'Synthetic essay', mode: 'solo_essay', topicMode: 'manual', topic: 'Synthetic topic' } });
      assert.equal(created.status, 201);
      await event(host, 'join_room', { roomId: created.body.id }, 'room_state');
      rooms.setPhase(created.body.id, 'essay_feedback');
      rooms.setContent(created.body.id, 'pro_argument', 'Synthetic essay');
      const before = calls.ai.filter(c => c.name === 'generateSoloFeedback').length;
      for (let i = 0; i < 3; i++) await event(host, 'retry_essay_feedback', { roomId: created.body.id }, 'ai_content');
      const denied = await event(host, 'retry_essay_feedback', { roomId: created.body.id }, 'error');
      assert.equal(denied.code, 'RATE_LIMITED');
      assert.equal(calls.ai.filter(c => c.name === 'generateSoloFeedback').length - before, 3);
    });
    await t.test('active room quota prevents accumulation of pending rooms', async () => {
      const body = { title: 'Synthetic pending room', mode: 'human_debate', topicMode: 'manual', topic: 'Synthetic' };
      assert.equal((await request('/api/rooms', { method: 'POST', token: studentToken, body })).status, 201);
      assert.equal((await request('/api/rooms', { method: 'POST', token: studentToken, body })).status, 429);
    });
    await t.test('login attempts are limited across both route aliases', async () => {
      const statuses = [];
      for (let i = 0; i < 12; i++) {
        const result = await request(i % 2 ? '/auth/login' : '/api/auth/login', { method: 'POST', body: { username: 'synthetic_missing', password: 'incorrect' } });
        statuses.push(result.status);
      }
      assert.ok(statuses.includes(429));
    });
    await t.test('REST AI requests also stop at their account quota', async () => {
      for (let i = 0; i < 20; i++) assert.equal((await request('/api/training-recommendation', { token: studentToken })).status, 200);
      const before = calls.ai.length;
      assert.equal((await request('/api/training-recommendation', { token: studentToken })).status, 429);
      assert.equal(calls.ai.length, before);
    });
    await t.test('a new session invalidates old HTTP and socket sessions', async () => {
      const disconnected = once(host, 'disconnect', { signal: AbortSignal.timeout(5000) });
      const previous = studentToken;
      studentToken = createAccessToken(users[0], createSession(users[0].user_id));
      await disconnected;
      assert.equal((await request('/api/auth/me', { token: previous })).status, 401);
      assert.equal((await request('/api/auth/me', { token: studentToken })).status, 200);
    });
    await t.test('logout revokes the server session', async () => {
      assert.equal((await request('/api/auth/logout', { method: 'POST', token: studentToken })).status, 200);
      assert.equal((await request('/api/debate-history', { token: studentToken })).status, 401);
    });
    await t.test('admin endpoints remain unavailable in production', async () => {
      assert.equal((await request('/api/admin/init-slots', { method: 'POST', body: {} })).status, 403);
    });
    await t.test('global AI guard limits spend and releases concurrency slots after errors', async () => {
      const { createAiGuard } = await import(new URL('src/services/aiBudget.js', backend));
      const guard = createAiGuard({ hourlyLimit: 2, concurrency: 1 });
      let finish;
      const first = guard(() => new Promise(resolve => { finish = resolve; }))();
      await assert.rejects(guard(async () => 'blocked')());
      finish('complete');
      assert.equal(await first, 'complete');
      await assert.rejects(guard(async () => { throw new Error('synthetic failure'); })());
      await assert.rejects(guard(async () => 'over budget')());
    });
    await t.test('rate limits expire and do not block another account', async () => {
      const { createBudget } = await import(new URL('src/middleware/rateLimit.js', backend));
      let clock = 1000;
      const consume = createBudget(1, 1000, () => clock);
      assert.equal(consume('A'), 0);
      assert.equal(consume('A'), 1);
      assert.equal(consume('B'), 0);
      clock += 1000;
      assert.equal(consume('A'), 0);
    });
  } finally {
    for (const s of sockets) s.disconnect();
    for (const timer of rooms.phaseTimers.values()) clearTimeout(timer);
    await new Promise(resolve => io.close(resolve));
    if (httpServer.listening) await new Promise(resolve => httpServer.close(resolve));
  }
});
