// Local DB required; the test starts and closes its own HTTP server (no AI scheduler).
// LOGIT_INTEGRATION_TESTS=1 node --env-file=.env --test test/teacher-settings.integration.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

test('담당 과목 저장·재조회·검증·초기화', { skip: process.env.LOGIT_INTEGRATION_TESTS !== '1' }, async (t) => {
  const dbUrl = new URL(process.env.DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(dbUrl.hostname), 'local DB required');
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const username = `qa_subject_${randomUUID()}`;
  let token, server, prisma, baseUrl;
  t.after(async () => {
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await prisma?.$disconnect();
    await db.end();
  });
  async function request(method, path, body) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10000),
    });
    return { status: res.status, body: await res.json() };
  }
  try {
    const { default: express } = await import('express');
    const { default: authRouter } = await import('../src/routes/auth.js');
    const { default: teacherRouter } = await import('../src/routes/teacher.js');
    ({ prisma } = await import('../src/db/prisma.js'));
    const app = express();
    app.use(express.json());
    app.use('/auth', authRouter);
    app.use('/teacher', teacherRouter);
    await new Promise((resolve, reject) => {
      server = app.listen(0, '127.0.0.1', resolve);
      server.once('error', reject);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    const signup = await request('POST', '/auth/signup', {
      username, password: randomUUID(), name: 'QA subject teacher',
      teacherCode: process.env.TEACHER_CODE || 'LOGIT_TEACHER_2025',
    });
    assert.equal(signup.status, 201);
    token = signup.body.token;
    const path = '/teacher/settings';

    await t.test('저장 성공 후 API와 DB 양쪽에서 같은 과목을 읽는다', async () => {
      const saved = await request('PUT', path, { subject: ' 국어 ', enabled: true, vocab: false, phaseDurations: { arguing: 60 } });
      assert.equal(saved.status, 200);
      assert.equal(saved.body.subject, '국어');
      assert.equal((await request('GET', path)).body.subject, '국어');
      const row = await db.query('SELECT subject FROM "TeacherSettings" JOIN "User" USING (user_id) WHERE login_id=$1', [username]);
      assert.equal(row.rows[0].subject, '국어');
    });
    await t.test('과목만 저장하면 기존 핸디캡과 시간을 유지한다', async () => {
      const saved = await request('PUT', path, { subject: '수학' });
      assert.equal(saved.status, 200);
      assert.equal(saved.body.subject, '수학');
      assert.equal(saved.body.enabled, true);
      assert.equal(saved.body.vocab, false);
      assert.deepEqual(saved.body.phaseDurations, { arguing: 60 });
    });
    await t.test('과목 필드가 없는 기존 클라이언트의 저장도 과목을 유지한다', async () => {
      assert.equal((await request('PUT', path, { vocab: true })).body.subject, '수학');
    });
    await t.test('허용되지 않는 과목과 자료형은 거부하고 기존 값을 유지한다', async () => {
      for (const subject of ['없는과목', 123, false, {}, []]) {
        assert.equal((await request('PUT', path, { subject })).status, 400);
      }
      assert.equal((await request('GET', path)).body.subject, '수학');
    });
    await t.test('빈 문자열과 null로 미설정 상태를 저장한다', async () => {
      assert.equal((await request('PUT', path, { subject: '' })).body.subject, null);
      await request('PUT', path, { subject: '국어' });
      assert.equal((await request('PUT', path, { subject: null })).body.subject, null);
      assert.equal((await request('GET', path)).body.subject, null);
    });
  } finally {
    // Remove only this test's uniquely named account and its own dependent rows.
    await db.query('BEGIN');
    try {
      await db.query('DELETE FROM "TeacherSettings" WHERE user_id IN (SELECT user_id FROM "User" WHERE login_id=$1)', [username]);
      await db.query('DELETE FROM "UserStats" WHERE user_id IN (SELECT user_id FROM "User" WHERE login_id=$1)', [username]);
      await db.query('DELETE FROM "User" WHERE login_id=$1', [username]);
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }
});
