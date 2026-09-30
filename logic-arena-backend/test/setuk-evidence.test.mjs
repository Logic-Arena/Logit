import test from 'node:test';
import assert from 'node:assert/strict';
import { collectSetukEvidence } from '../src/setukEvidence.js';

const history = { id: 7, topic: '학교의 에너지 사용', position: 'pro', played_at: new Date('2026-09-29T15:30:00Z') };

test('저장된 요약·강점·개선 제안의 원문과 출처만 반환한다', () => {
  const summary = '두 자료의 조사 시점을 비교함.';
  const result = collectSetukEvidence([{ ...history, score: 99, advice: '제외할 총평', teacher_summary: {
    summary, strengths: ['“2025년 자료”를 들어 반론에 대응함.', summary],
    improvements: ['근거의 출처를 보완할 필요가 있음.'], coaching: '제외할 코칭',
  } }]);
  assert.deepEqual(result.items, [{ historyId: 7, topic: history.topic, position: 'pro', playedAt: history.played_at, candidates: [
    { id: '7:summary:0', kind: 'summary', text: summary },
    { id: '7:strengths:0', kind: 'strengths', text: '“2025년 자료”를 들어 반론에 대응함.' },
    { id: '7:improvements:0', kind: 'improvements', text: '근거의 출처를 보완할 필요가 있음.' },
  ] }]);
  assert.equal(result.scannedCount, 1);
  assert.equal(result.unavailableCount, 0);
  assert.equal(result.excludedCount, 0);
});

test('점수·승패·순위·성장률은 문장 일부를 윤문하지 않고 후보 전체를 제외한다', () => {
  const texts = ['90점을 획득하여 논리력이 높음.', '점수가 높음.', '승리함.', '패배했지만 성실함.', '순위가 상승함.', '성장률 20%임.', '학급 1위임.', '골드 티어임.', 'score 90'];
  const result = collectSetukEvidence([{ ...history, teacher_summary: { summary: texts[0], strengths: texts.slice(1), improvements: [] } }]);
  assert.equal(result.items.length, 0);
  assert.equal(result.excludedCount, texts.length);
  assert.equal(result.unavailableCount, 1);
});

test('없는 요약·구형 JSON·잘못된 필드를 건너뛰며 사실이나 인용을 생성하지 않는다', () => {
  const rows = [null, '구형 문자열', [], { summary: 42, strengths: {}, improvements: [null, {}, ' '] }, {}]
    .map((teacher_summary, id) => ({ ...history, id, teacher_summary }));
  const result = collectSetukEvidence(rows);
  assert.deepEqual(result.items, []);
  assert.equal(result.unavailableCount, rows.length);
  const partial = collectSetukEvidence([{ ...history, teacher_summary: { strengths: [null, '관찰 후보'] } }]);
  assert.equal(partial.items[0].candidates[0].text, '관찰 후보');
});
