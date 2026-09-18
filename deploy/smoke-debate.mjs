import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const require = createRequire(new URL('../logic-arena-frontend/package.json', import.meta.url));
const { io } = require('socket.io-client');
const base = process.argv[2];
if (!base) throw new Error('Usage: node deploy/smoke-debate.mjs <site URL>');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const password = randomUUID();
const clients = [];
let roomId;
async function waitFor(check, label, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (check()) return;
    await pause(50);
  }
  throw new Error(`Timed out: ${label}`);
}
function connect() {
  const client = { socket: io(base, { transports: ['websocket'] }), room: null, errors: [] };
  client.socket.onAny((event, payload) => {
    if (payload?.room?.id === roomId) client.room = payload.room;
    if (event === 'error') client.errors.push(payload.message);
  });
  clients.push(client);
  return client;
}
try {
  const response = await fetch(`${base}/api/rooms`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '[배포 검증] 자동 테스트', mode: 'human_debate',
      topicMode: 'manual', topic: '학교에서 일회용 플라스틱 사용을 제한해야 한다.', password,
      coachingEnabled: true, handicap: { phaseDurations: { arguing: 5, finalArgument: 30 } } }),
  });
  assert.equal(response.status, 201);
  roomId = (await response.json()).id;
  for (const name of ['찬성', '반대', '관전자']) {
    const client = connect();
    await waitFor(() => client.socket.connected, 'socket connection');
    client.socket.emit('join_room', { roomId, password, userId: `smoke-${randomUUID()}`, username: `검증-${name}` });
    await waitFor(() => client.room, 'join room');
  }
  const [pro, con, observer] = clients;
  pro.socket.emit('start_game', { roomId });
  await waitFor(() => clients.every(c => c.room.phase === 'arguing'), 'arguing');
  const proText = '일회용 플라스틱을 제한하면 쓰레기를 줄일 수 있습니다. 다회용 용기를 사용하도록 지원해야 합니다.';
  const conText = '일괄 제한보다 재활용과 점진적 전환이 필요합니다. 학생과 급식 운영의 비용도 고려해야 합니다.';
  con.socket.emit('save_draft', { roomId, phase: 'arguing', text: conText });
  pro.socket.emit('submit_content', { roomId, phase: 'arguing', text: proText });
  await waitFor(() => observer.room.submittedKeys?.includes('pro_argument'), 'first submission acknowledgement');
  assert.equal(con.room.content.pro_argument, null);
  assert.equal(observer.room.content.pro_argument, null);
  const listing = await (await fetch(`${base}/api/rooms`)).json();
  assert.equal(listing.find(r => r.id === roomId).content.pro_argument, null);
  console.log('PASS initial argument hidden from opponent, observer, room list');
  await waitFor(() => clients.every(c => c.room.phase === 'pro_p_rebuttal'), 'server timeout');
  assert.equal(pro.room.content.pro_argument, proText);
  assert.equal(pro.room.content.con_argument, conText);
  console.log('PASS server deadline auto-submits saved draft, preserves manual submission');
  const turns = [['pro_p_rebuttal', pro], ['pro_p_defense', con], ['pro_p_counter', pro],
    ['con_p_rebuttal', con], ['con_p_defense', pro], ['con_p_counter', con]];
  for (const [phase, client] of turns) {
    await waitFor(() => client.room.phase === phase, phase);
    client.socket.emit('submit_content', { roomId, phase,
      text: '비용 부담을 고려하되 다회용 용기 지원과 단계적 시행을 통해 환경 효과와 실현 가능성을 함께 높여야 합니다.' });
  }
  await waitFor(() => pro.room.phase === 'coaching', 'coaching');
  const started = Date.now();
  await waitFor(() => clients.every(c => c.room.phase === 'final_argument'), 'coaching completion', 70000);
  assert.ok(pro.room.content.coaching_pro);
  assert.ok(con.room.content.coaching_con);
  assert.ok(!pro.room.content.coaching_pro.includes('오류') && !pro.room.content.coaching_pro.includes('불러오지 못'));
  console.log(`PASS real AI coaching available before final argument (${Date.now() - started}ms)`);
  pro.socket.emit('submit_content', { roomId, phase: 'final_argument', text: proText });
  await waitFor(() => observer.room.submittedKeys?.includes('pro_final'), 'first final submission');
  assert.equal(con.room.content.pro_final, null);
  assert.equal(observer.room.content.pro_final, null);
  await pause(1000);
  assert.equal(pro.room.phase, 'final_argument');
  con.socket.emit('submit_content', { roomId, phase: 'final_argument', text: conText });
  await waitFor(() => observer.room.content.pro_final && observer.room.content.con_final, 'both final arguments revealed');
  assert.equal(observer.room.content.pro_final, proText);
  assert.equal(observer.room.content.con_final, conText);
  assert.ok(clients.every(c => c.errors.length === 0), JSON.stringify(clients.map(c => c.errors)));
  console.log('PASS final arguments revealed together after both submit');
  console.log('ALL PRODUCTION PROTOCOL CHECKS PASSED');
} finally {
  for (const client of clients) client.socket.emit('leave_room');
  await pause(300);
  for (const client of clients) client.socket.disconnect();
  console.log('Test clients left the temporary room');
}
