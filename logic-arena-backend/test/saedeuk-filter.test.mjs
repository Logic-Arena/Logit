import test from 'node:test';
import assert from 'node:assert/strict';
import { filterBannedContent } from '../src/services/saedeukFilter.js';

test('대학원과 분석 대상은 원문을 유지한다', () => {
  const text = '교육대학원생의 연구를 분석 대상으로 삼음.';
  assert.deepEqual(filterBannedContent(text), { text, flags: [] });
});

test('같은 문장의 실제 학원과 수상은 계속 탐지한다', () => {
  const { text, flags } = filterBannedContent('대학원 자료와 메가학원 자료를 비교함. 수학대회에서 대상 수상함.');
  assert.ok(text.startsWith('대학원 자료와 사교육기관 자료를 비교함.'));
  assert.deepEqual(flags.map(flag => flag.category), ['사교육 기관명', '수상·대회명']);
  assert.equal(filterBannedContent(text).flags.length, 1);
  assert.equal(flags[1].reviewRequired, true);
});

for (const text of ['분석 대상을 찾음.', '동상을 관찰함.', '2급 태풍을 분석함.', 'TOEICish와 HSKILL을 설명함.', '부모의 의사소통을 분석함.', '해외 활동가를 조사함.']) {
  test(`단어 일부·일반 표현은 보존: ${text}`, () => {
    assert.deepEqual(filterBannedContent(text), { text, flags: [] });
  });
}

test('시험 이름과 조사 경계를 인식하고 반복 적용해도 바뀌지 않는다', () => {
  const result = filterBannedContent('toeic과 ＴＯＥＦＬ을 비교함.');
  assert.equal(result.text, '공인어학시험과 공인어학시험을 비교함.');
  assert.equal(result.flags.length, 2);
  assert.equal(filterBannedContent(result.text).text, result.text);
});

test('인용·주소의 이름은 자동 치환하지 않는다', () => {
  for (const text of ['“메가학원”을 인용함.', 'https://example.com/TOEIC']) {
    const result = filterBannedContent(text);
    assert.equal(result.text, text);
    assert.ok(result.flags.every(flag => flag.reviewRequired));
  }
});

test('가족과 해외활동은 사실을 임의로 변경하지 않고 검토를 요청한다', () => {
  const text = '아버지는 의사임. 해외 연수에 참여함.';
  const result = filterBannedContent(text);
  assert.equal(result.text, text);
  assert.equal(result.flags.length, 2);
  assert.ok(result.flags.every(flag => flag.reviewRequired));
});
