import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  addPastTopic,
  addPlayerToRoom,
  AI_AUTO_PHASES,
  AI_DEFENSE_PHASES,
  bumpTopicGenerationSeq,
  createRoom,
  getAllRooms,
  getNextPhase,
  getPastTopics,
  getPhaseDuration,
  getPlayerRole,
  getRoom,
  getRoomSerialized,
  phaseTimers,
  PHASE_SUBMIT_KEY,
  removePlayerFromRoom,
  selectSide,
  setContent,
  setPhase,
  setPhaseEndAt,
  setResult,
  setTopic,
} from '../src/store/rooms.js';

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

async function loadHandlerInternals(overrides = {}) {
  let source = readFileSync(new URL('../src/socket/handlers.js', import.meta.url), 'utf8');
  source = source
    .replace(/import[\s\S]*?from '\.\.\/store\/rooms\.js';\s*/, '')
    .replace(/import[\s\S]*?from '\.\.\/services\/ai\.js';\s*/, '')
    .replace(/import[\s\S]*?from '\.\.\/services\/statsService\.js';\s*/, '')
    .replace('export function registerHandlers', 'function registerHandlers');

  const names = [
    'addPlayerToRoom',
    'removePlayerFromRoom',
    'getAllRooms',
    'getRoom',
    'getRoomSerialized',
    'getPlayerRole',
    'setPhase',
    'setPhaseEndAt',
    'setTopic',
    'setContent',
    'setResult',
    'selectSide',
    'getNextPhase',
    'getPhaseDuration',
    'AI_AUTO_PHASES',
    'AI_DEFENSE_PHASES',
    'PHASE_SUBMIT_KEY',
    'addPastTopic',
    'bumpTopicGenerationSeq',
    'getPastTopics',
    'phaseTimers',
    'generateTopic',
    'generateArgument',
    'generateRebuttal',
    'generateDefense',
    'generateCounter',
    'generateCoaching',
    'judgeDebate',
    'updateStats',
    'saveDebateHistory',
  ];

  const values = [
    addPlayerToRoom,
    removePlayerFromRoom,
    getAllRooms,
    getRoom,
    getRoomSerialized,
    getPlayerRole,
    setPhase,
    setPhaseEndAt,
    setTopic,
    setContent,
    setResult,
    selectSide,
    getNextPhase,
    getPhaseDuration,
    AI_AUTO_PHASES,
    AI_DEFENSE_PHASES,
    PHASE_SUBMIT_KEY,
    addPastTopic,
    bumpTopicGenerationSeq,
    getPastTopics,
    phaseTimers,
    async () => ({ topic: 'topic', source: 'test' }),
    async () => 'argument',
    async () => 'rebuttal',
    async () => 'defense',
    async () => 'counter',
    async () => ({ pro: 'pro coaching', con: 'con coaching' }),
    () => new Promise(() => {}),
    async () => {},
    async () => {},
  ];

  const factory = new AsyncFunction(...names, `${source}\nreturn { startPhase, advancePhase, registerHandlers };`);
  return factory(...values.map((value, index) => overrides[names[index]] ?? value));
}

function makeIo() {
  const events = [];
  return {
    events,
    to(roomId) {
      return {
        emit(event, payload) {
          events.push({ roomId, event, payload });
        },
      };
    },
    emit(event, payload) {
      events.push({ roomId: null, event, payload });
    },
  };
}

function makeActiveRoom() {
  const title = `judging race ${Date.now()} ${Math.random()}`;
  const room = createRoom({ title, mode: 'ai_debate', topicMode: 'manual', topic: 'test topic' });
  addPlayerToRoom(room.id, `${room.id}-pro`, { userId: `${room.id}-p`, username: `${title}-pro` });
  addPlayerToRoom(room.id, `${room.id}-con`, { userId: `${room.id}-c`, username: `${title}-con` });
  addPlayerToRoom(room.id, `${room.id}-obs`, { userId: `${room.id}-o`, username: `${title}-obs` });
  return room.id;
}

afterEach(() => {
  for (const timer of phaseTimers.values()) clearTimeout(timer);
  phaseTimers.clear();
});

test('startPhase keeps judging open without starting a countdown timer', async () => {
  const { startPhase } = await loadHandlerInternals();
  const roomId = makeActiveRoom();
  const io = makeIo();

  await startPhase(io, roomId, 'judging');

  const room = getRoom(roomId);
  assert.equal(room.phase, 'judging');
  assert.equal(room.phaseEndAt, null);
  assert.equal(phaseTimers.has(roomId), false);
});

test('advancePhase does not enter peer voting while judging result is missing', async () => {
  const { advancePhase } = await loadHandlerInternals();
  const roomId = makeActiveRoom();
  const io = makeIo();
  setPhase(roomId, 'judging');

  await advancePhase(io, roomId);

  const room = getRoom(roomId);
  assert.equal(room.phase, 'judging');
  assert.equal(room.result, null);
  assert.equal(io.events.some((event) => event.payload?.phase === 'peer_voting'), false);
});


for (const [phase, keys] of [
  ['arguing', ['pro_argument', 'con_argument']],
  ['final_argument', ['pro_final', 'con_final']],
]) {
  test(`${phase} hides first submission in all room snapshots until both submit`, () => {
    const id = makeActiveRoom();
    setPhase(id, phase);
    setContent(id, keys[0], 'first private text');
    const snapshot = getRoomSerialized(id);
    assert.equal(snapshot.content[keys[0]], null);
    assert.ok(snapshot.submittedKeys.includes(keys[0]));
    assert.equal(getAllRooms().find(room => room.id === id).content, undefined);
    assert.equal(getRoom(id).content[keys[0]], 'first private text');
    setContent(id, keys[1], 'second text');
    assert.equal(getRoomSerialized(id).content[keys[0]], 'first private text');
  });
}

test('timeout commits drafts without overwriting submitted text and releases partial arguments', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { startPhase } = await loadHandlerInternals();
  const id = makeActiveRoom();
  const room = getRoom(id);
  room.mode = 'human_debate';
  room.drafts = { pro_argument: 'unfinished draft', con_argument: 'old draft' };
  setContent(id, 'con_argument', 'submitted text');
  await startPhase(makeIo(), id, 'arguing');
  t.mock.timers.tick(getPhaseDuration('arguing'));
  assert.equal(room.content.pro_argument, 'unfinished draft');
  assert.equal(room.content.con_argument, 'submitted text');
  assert.notEqual(room.phase, 'arguing');
  assert.equal(getRoomSerialized(id).content.pro_argument, 'unfinished draft');
});

test('coaching waits beyond former 10 second deadline and advances once', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const { startPhase } = await loadHandlerInternals({ generateCoaching: () => pending });
  const id = makeActiveRoom();
  const io = makeIo();
  await startPhase(io, id, 'coaching');
  t.mock.timers.tick(11_000);
  assert.equal(getRoom(id).phase, 'coaching');
  resolve({ pro: 'pro advice', con: 'con advice' });
  await new Promise(done => setImmediate(done));
  assert.equal(getRoom(id).phase, 'final_argument');
  assert.equal(getRoom(id).content.coaching_pro, 'pro advice');
  assert.equal(io.events.filter(e => e.payload?.phase === 'final_argument').length, 1);
});

test('late coaching result cannot advance an unrelated phase', async () => {
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const { startPhase } = await loadHandlerInternals({ generateCoaching: () => pending });
  const id = makeActiveRoom();
  await startPhase(makeIo(), id, 'coaching');
  setPhase(id, 'ended');
  resolve({ pro: 'late', con: 'late' });
  await new Promise(done => setImmediate(done));
  assert.equal(getRoom(id).phase, 'ended');
  assert.equal(getRoom(id).content.coaching_pro, null);
});


test('draft events reject observers and stale phases, and manual submissions cannot be overwritten', async () => {
  const { registerHandlers } = await loadHandlerInternals();
  const id = makeActiveRoom();
  setPhase(id, 'arguing');
  const events = {};
  const socket = { id: `${id}-pro`, data: {}, on: (event, handler) => { events[event] = handler; }, emit() {} };
  registerHandlers(makeIo(), socket);
  events.save_draft({ roomId: id, phase: 'final_argument', text: 'stale' });
  assert.equal(getRoom(id).drafts, undefined);
  socket.id = `${id}-obs`;
  events.save_draft({ roomId: id, phase: 'arguing', text: 'observer' });
  assert.equal(getRoom(id).drafts, undefined);
  socket.id = `${id}-pro`;
  events.save_draft({ roomId: id, phase: 'arguing', text: 'partial' });
  assert.equal(getRoom(id).drafts.pro_argument, 'partial');
  events.submit_content({ roomId: id, phase: 'arguing', text: 'submitted' });
  events.submit_content({ roomId: id, phase: 'arguing', text: 'replacement' });
  assert.equal(getRoom(id).content.pro_argument, 'submitted');
});

test('coaching timeout shows fallback and ignores later completion', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const { startPhase } = await loadHandlerInternals({ generateCoaching: () => pending });
  const id = makeActiveRoom();
  await startPhase(makeIo(), id, 'coaching');
  t.mock.timers.tick(60_000);
  await new Promise(done => setImmediate(done));
  const fallback = getRoom(id).content.coaching_pro;
  assert.ok(fallback);
  assert.equal(getRoom(id).phase, 'final_argument');
  resolve({ pro: 'late', con: 'late' });
  await new Promise(done => setImmediate(done));
  assert.equal(getRoom(id).phase, 'final_argument');
  assert.equal(getRoom(id).content.coaching_pro, fallback);
});
