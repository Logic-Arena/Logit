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

async function loadHandlerInternals() {
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

  const factory = new AsyncFunction(...names, `${source}\nreturn { startPhase, advancePhase };`);
  return factory(...values);
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
