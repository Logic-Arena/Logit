import test from 'node:test';
import assert from 'node:assert/strict';
import { containsAiDraft, copyBlockReason, neisBytes } from '../src/lib/setukReview.ts';
import { analyzeForbidden, applyForbiddenFilter } from '../src/lib/setukText.ts';

test('AI 원문, 공백·기호·제로폭 변경, 원문에 문장 덧붙이기를 차단한다', () => {
  for (const text of ['근거를 비교함.', ' 근거를  비교함!\n', '근거를\u200b 비교함.', '근거를 비교함. 다른 내용 추가함.', '근거를 비교해.']) {
    assert.equal(containsAiDraft(text, ['근거를 비교함.']), true);
  }
  assert.equal(containsAiDraft('두 자료의 조사 시점을 대조하고 최신 자료로 근거를 수정함.', ['근거를 비교함.']), false);
});

test('빈 문장, 용량 초과, 미검토, 미해결 표현, AI 진행 중에는 복사 불가', () => {
  const ready = { text: '자료의 출처를 확인함.', aiTexts: [], contextReady: true, reviewed: true, unresolved: false, busy: false };
  assert.equal(copyBlockReason(ready), '');
  for (const change of [{ text: '' }, { text: ' \n!!' }, { text: '가'.repeat(501) }, { contextReady: false }, { reviewed: false }, { unresolved: true }, { busy: true }]) {
    assert.notEqual(copyBlockReason({ ...ready, ...change }), '');
  }
  assert.notEqual(copyBlockReason({ ...ready, aiTexts: [ready.text] }), '');
});

test('바이트는 한글·영문·줄바꿈을 구별하고 CRLF를 중복 계산하지 않는다', () => {
  assert.equal(neisBytes('가A1\n나'), 9);
  assert.equal(neisBytes('가A1\r\n나'), 9);
  assert.equal(neisBytes('가'.repeat(500)), 1500);
});

test('추가 유의사항을 탐지하고 금지 사실을 일반화하지 않는다', () => {
  for (const text of ['공인어학시험에 응시함.', '자격증을 취득함.', '교내 대회에 참가함.', '논문을 학회지에 등재함.', '장학금을 받음.', '특허를 출원함.', '책을 출간함.', '서울대학교에서 활동함.', '성장률 0%로 평가함.']) {
    assert.ok(analyzeForbidden(text).length > 0, text);
    assert.equal(applyForbiddenFilter(text).result, text);
  }
});
