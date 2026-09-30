import test from 'node:test';
import assert from 'node:assert/strict';
import { appendSetukEvidence, evidenceDate } from '../src/lib/setukEvidence.ts';
import type { SelectedSetukEvidence } from '../src/lib/setukEvidence.ts';

const candidate: SelectedSetukEvidence = { id: '1:strengths:0', kind: 'strengths', topic: '자료의 신뢰성', playedAt: '2026-09-29T15:30:00Z', text: '두 통계의 조사 시점을 비교함.' };

test('선택한 후보만 날짜·주제와 함께 추가하고 기존 관찰은 보존한다', () => {
  const original = '기존 관찰 내용\n';
  assert.equal(appendSetukEvidence(original, []), original);
  const result = appendSetukEvidence(original, [candidate]);
  assert.ok(result.startsWith(original));
  assert.ok(result.includes('[2026-09-30 · 자료의 신뢰성 · 관찰 근거]'));
  assert.ok(result.endsWith(candidate.text));
});

test('중복 선택·재추가를 막고 개선 제안을 성과로 바꾸지 않는다', () => {
  const result = appendSetukEvidence('', [candidate, candidate]);
  assert.equal(result.split(candidate.text).length, 2);
  assert.equal(appendSetukEvidence(result, [candidate]), result);
  const improvement = { ...candidate, id: '1:improvements:0', kind: 'improvements' as const, text: '출처를 보완할 필요가 있음.' };
  assert.ok(appendSetukEvidence('', [improvement]).endsWith('개선 제안 확인]\n출처를 보완할 필요가 있음.'));
});

test('4,000자 한도를 넘으면 일부를 자르거나 기존 내용을 덮어쓰지 않는다', () => {
  const addition = appendSetukEvidence('', [candidate]);
  assert.equal(appendSetukEvidence('가'.repeat(4000 - addition.length - 2), [candidate]).length, 4000);
  assert.throws(() => appendSetukEvidence('가'.repeat(4000 - addition.length - 1), [candidate]), /4,000자/);
});

test('날짜는 한국 시간으로 표시하고 손상된 날짜를 처리한다', () => {
  assert.equal(evidenceDate(candidate.playedAt), '2026-09-30');
  assert.equal(evidenceDate('invalid'), '날짜 미상');
});
