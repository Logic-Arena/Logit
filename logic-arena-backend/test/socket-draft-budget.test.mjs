import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBudget } from '../src/middleware/rateLimit.js';

// security.js를 실제 소스 그대로 불러오되, 토큰 검증·방 역할 조회만 대역으로 바꾼다.
function loadGuard() {
  const source = readFileSync(new URL('../src/socket/security.js', import.meta.url), 'utf8')
    .replace(/^import [\s\S]*?;\r?\n/gm, '')
    .replace(/^export /gm, '');
  return new Function('verifyAccessToken', 'createBudget', 'getPlayerRole', `${source}\nreturn { guardSocket };`)(
    () => ({ exp: Math.floor(Date.now() / 1000) + 3600 }), createBudget, () => 'pro_player',
  ).guardSocket;
}

function fakeSocket(userId) {
  const errors = [];
  let middleware;
  const socket = {
    data: { userId, token: 't', roomId: 'room1' },
    id: 's1',
    on() {},
    use(fn) { middleware = fn; },
    emit(event, payload) { if (event === 'error') errors.push(payload.code); },
    disconnect() {},
  };
  loadGuard()(socket);
  const send = (event, payload) => { let passed = false; middleware([event, payload], () => { passed = true; }); return passed; };
  return { send, errors };
}

test('임시저장이 많아도 제출 등 다른 요청은 한도에 걸리지 않음', () => {
  const { send, errors } = fakeSocket('u1');
  for (let i = 0; i < 280; i++) send('save_draft', { roomId: 'room1', phase: 'arguing', text: `초안 ${i}` });
  assert.equal(send('submit_content', { roomId: 'room1', phase: 'arguing', text: '최종' }), true);
  assert.deepEqual(errors, []);
});

test('임시저장 한도를 넘으면 알림 없이 버리고, 다른 요청은 계속 통과', () => {
  const { send, errors } = fakeSocket('u2');
  let passed = 0;
  for (let i = 0; i < 320; i++) if (send('save_draft', { roomId: 'room1', phase: 'arguing', text: 'x' })) passed++;
  assert.equal(passed, 300);
  assert.deepEqual(errors, [], '임시저장 초과는 오류 알림을 띄우지 않아야 함');
  assert.equal(send('submit_content', { roomId: 'room1', phase: 'arguing', text: '최종' }), true);
});

test('임시저장 외 요청은 기존처럼 분당 240회 한도와 오류 알림 유지', () => {
  const { send, errors } = fakeSocket('u3');
  for (let i = 0; i < 240; i++) send('get_peer_vote_status', { roomId: 'room1' });
  assert.equal(send('get_peer_vote_status', { roomId: 'room1' }), false);
  assert.deepEqual(errors, ['RATE_LIMITED']);
});
