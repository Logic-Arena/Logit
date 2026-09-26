import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// 실제 소스를 읽어 import를 제거하고, import된 이름은 대역(기본: no-op)으로 주입해 실행한다.
function loadModule(relPath, exportNames, overrides = {}) {
  const raw = readFileSync(new URL(relPath, import.meta.url), 'utf8');
  const imported = new Set();
  for (const [, clause] of raw.matchAll(/^import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"];/gm)) {
    const braces = clause.match(/\{([\s\S]*)\}/);
    if (braces) braces[1].split(',').map(s => s.trim().split(/\s+as\s+/).pop()).filter(Boolean).forEach(n => imported.add(n));
    const def = clause.replace(/\{[\s\S]*\}/, '').replace(/,/g, '').trim();
    if (def) imported.add(def);
  }
  const source = raw.replace(/^import [\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
  const names = [...imported];
  const values = names.map(n => (n in overrides ? overrides[n] : () => {}));
  return new Function(...names, `${source}\nreturn { ${exportNames.join(', ')} };`)(...values);
}

function loadJudge() {
  let apiCalls = 0;
  const reply = JSON.stringify({ winner: 'pro', summary: '요약', scores: [
    { name: '찬성P', vote: 'pro', type: 'player', logic: 15, evidence: 15, persuasion: 15, rebuttal: 15, consistency: 15, total: 75, rank: 1, advice: 'a' },
    { name: '반대P', vote: 'con', type: 'player', logic: 10, evidence: 10, persuasion: 10, rebuttal: 10, consistency: 10, total: 50, rank: 2, advice: 'b' },
  ] });
  class OpenAI {
    constructor() {
      this.chat = { completions: { create: async () => { apiCalls++; return { choices: [{ message: { content: reply } }] }; } } };
    }
  }
  const mod = loadModule('../src/services/openai.js', ['judgeDebate'], {
    OpenAI, createSetukService: () => ({}), isSoloRecord: () => false,
  });
  return { judgeDebate: mod.judgeDebate, apiCalls: () => apiCalls };
}

const AI_ONLY_CONTENT = { pro_ai_argument: 'AI 찬성 입론', con_ai_argument: 'AI 반대 입론', pro_a_rebuttal: 'AI 반론' };

test('AI 모드에서 학생 양측 모두 무응답이면 AI 호출 없이 무효 판정', async () => {
  const { judgeDebate, apiCalls } = loadJudge();
  const result = await judgeDebate({ topic: '주제', content: { ...AI_ONLY_CONTENT, pro_argument: '   ', con_final: null }, mode: 'ai_debate' });
  assert.equal(result.voided, true);
  assert.equal(result.winner, 'draw');
  assert.equal(apiCalls(), 0);
});

test('사람끼리 모드도 양측 무응답이면 무효 판정', async () => {
  const { judgeDebate } = loadJudge();
  const result = await judgeDebate({ topic: '주제', content: {}, mode: 'human_debate' });
  assert.equal(result.voided, true);
});

test('한쪽이라도 발언이 있으면 정상 채점', async () => {
  const { judgeDebate, apiCalls } = loadJudge();
  const result = await judgeDebate({ topic: '주제', content: { ...AI_ONLY_CONTENT, pro_argument: '찬성 입론' }, mode: 'ai_debate' });
  assert.equal(result.voided, undefined);
  assert.equal(apiCalls(), 1);
});

function loadHandlers(room, judgeResult) {
  const calls = { updateStats: 0, saveDebateHistory: 0, phases: [], emitted: [] };
  const io = { to: () => ({ emit: (event) => calls.emitted.push(event) }), emit() {} };
  const mod = loadModule('../src/socket/handlers.js', ['finalizePeerVoting', 'handleAiAutoPhase'], {
    getRoom: () => room,
    setPhase: (_, phase) => { room.phase = phase; calls.phases.push(phase); },
    setResult: (_, result) => { room.result = result; },
    getRoomSerialized: () => ({}),
    getPhaseDuration: () => null,
    phaseTimers: new Map(),
    judgeDebate: async () => judgeResult,
    updateStats: async () => { calls.updateStats++; },
    saveDebateHistory: async () => { calls.saveDebateHistory++; },
  });
  return { ...mod, io, calls };
}

function makeRoom(observerCount) {
  return {
    mode: 'ai_debate', phase: 'judging', topic: '주제', content: {},
    proPlayer: { userId: '1' }, conPlayer: { userId: '2' },
    observers: new Set(Array.from({ length: observerCount }, (_, i) => `obs${i}`)),
    peerVotes: { pro: 0, con: 0, initialObserverCount: observerCount },
  };
}

const voidResult = () => ({ winner: 'draw', summary: '양측 모두 발언이 없어 무효 처리되었습니다.', voided: true,
  scores: [{ vote: 'pro', type: 'player', total: 0 }, { vote: 'con', type: 'player', total: 0 }] });

test('무효 판정은 관전자가 있어도 투표 없이 종료하고 이력·RP를 저장하지 않음', async () => {
  const room = makeRoom(2);
  const { handleAiAutoPhase, io, calls } = loadHandlers(room, voidResult());
  await handleAiAutoPhase(io, 'r1', 'judging');
  assert.ok(!calls.phases.includes('peer_voting'));
  assert.equal(room.phase, 'ended');
  assert.equal(calls.updateStats, 0);
  assert.equal(calls.saveDebateHistory, 0);
  assert.ok(calls.emitted.includes('debate_ended'));
});

test('정상 판정은 종료 시 이력·RP를 저장', async () => {
  const room = makeRoom(0);
  room.result = { winner: 'pro', summary: 's', scores: [{ vote: 'pro', type: 'player', total: 70 }, { vote: 'con', type: 'player', total: 50 }] };
  const { finalizePeerVoting, io, calls } = loadHandlers(room, null);
  await finalizePeerVoting(io, 'r1');
  assert.equal(calls.updateStats, 1);
  assert.equal(calls.saveDebateHistory, 1);
});
