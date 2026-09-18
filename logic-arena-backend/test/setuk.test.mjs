import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSetukContext, neisBytes } from '../src/setukPolicy.js';
import { createSetukService } from '../src/services/setuk.js';

const context = { schoolYear: 2026, schoolLevel: 'high', grade: 2, subject: '국어', activity: '9월 논증 수업', observations: '두 자료의 조사 시점을 대조하고 최신 자료로 근거를 수정함.', observedByTeacher: true, schoolCurriculum: true };
test('관찰 없는 구형 요청과 거짓 자료형·확인 누락을 서버에서 거부한다', () => {
  assert.equal(validateSetukContext(context), null);
  for (const input of [{}, { ...context, observations: '' }, { ...context, observations: ' '.repeat(10) }, { ...context, grade: '2' }, { ...context, schoolYear: 2025 }, { ...context, observedByTeacher: 'true' }, { ...context, schoolCurriculum: false }, { ...context, subject: [] }]) assert.ok(validateSetukContext(input));
});
test('점수·이름·개인 활동 이력을 전달하지 않고 교사 기록만 윤문한다', async () => {
  let prompt;
  const service = createSetukService(async p => { prompt = p; return JSON.stringify({ drafts: ['A', 'B', 'C'].map(version => ({ version, text: '자료의 조사 시점을 비교함.' })) }); });
  const drafts = await service.generateSetukDraft({ ...context, studentName: '절대보내지않을이름', avgScore: 97, growthRate: 12345 });
  assert.equal(drafts.length, 3);
  assert.ok(prompt.includes(context.observations));
  assert.ok(!prompt.includes('절대보내지않을이름'));
  assert.ok(!prompt.includes('12345'));
});
test('빈 응답·누락·실패에는 가짜 기본 문장을 생성하지 않는다', async () => {
  for (const raw of ['{}', '{"drafts":[]}', '{"drafts":[{"version":"A","text":""}]}', 'invalid']) {
    await assert.rejects(createSetukService(async () => raw).generateSetukDraft(context));
  }
  await assert.rejects(createSetukService(async () => { throw new Error('offline'); }).generateSetukDraft(context));
});
test('축약 실패·길이 초과는 원문을 잘라 반환하지 않고 실패 처리한다', async () => {
  const params = { ...context, text: '관찰한 사실을 기록함. '.repeat(100) };
  for (const result of ['', '가'.repeat(501)]) await assert.rejects(createSetukService(async () => result).summarizeSetuk(params));
  const result = await createSetukService(async () => '조사 시점을 대조함.').summarizeSetuk(params);
  assert.equal(result, '조사 시점을 대조함.');
  assert.equal(neisBytes('가A1\n나'), 9);
});
