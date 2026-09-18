import test from 'node:test';
import assert from 'node:assert/strict';
import { createSetukService } from '../src/services/setuk.js';
import { SUBJECT_STYLE_HINTS } from '../src/saedeuk.js';

const context = {
  schoolYear: 2026,
  schoolLevel: 'high',
  grade: 2,
  subject: '국어',
  activity: '9월 자료 비교와 논증 수업',
  observations: '두 자료의 조사 시점을 대조하고 최신 자료로 근거를 수정함.',
  observedByTeacher: true,
  schoolCurriculum: true,
};

const expectedDrafts = [
  { version: 'A', label: '학습 과정 중심', text: '두 자료의 조사 시점을 비교함.' },
  { version: 'B', label: '관찰된 변화 중심', text: '최신 자료를 확인하여 근거를 수정함.' },
  { version: 'C', label: '수업 참여 중심', text: '자료 비교 활동에서 근거의 시점을 확인함.' },
];
const summary = '자료의 조사 시점을 대조하고 근거를 수정함.';

async function capturePrompts(subject) {
  const prompts = [];
  const service = createSetukService(async prompt => {
    prompts.push(prompt);
    return prompts.length === 1
      ? JSON.stringify({ drafts: expectedDrafts.map(({ version, text }) => ({ version, text })) })
      : summary;
  });
  const params = { ...context, subject };
  const drafts = await service.generateSetukDraft(params);
  const summarized = await service.summarizeSetuk({ ...params, text: context.observations });
  assert.deepEqual(drafts, expectedDrafts);
  assert.equal(summarized, summary);
  assert.equal(prompts.length, 2);
  return prompts;
}

for (const subject of ['국어', '영어', '수학']) {
  test(`${subject}의 관찰 관점을 윤문과 축약 모두에 전달한다`, async () => {
    for (const prompt of await capturePrompts(subject)) {
      assert.ok(prompt.includes(SUBJECT_STYLE_HINTS[subject]));
      for (const other of ['국어', '영어', '수학'].filter(value => value !== subject)) {
        assert.ok(!prompt.includes(SUBJECT_STYLE_HINTS[other]), `${subject}에 ${other}의 관점을 혼합하지 않는다`);
      }
      assert.ok(prompt.includes(JSON.stringify(subject)));
      assert.ok(prompt.includes(context.activity));
      assert.ok(prompt.includes(context.observations));
      assert.match(prompt, /관찰/);
      assert.match(prompt, /근거/);
    }
  });
}

test('과목 선택만으로 외국어·계산·실험·실기 수행을 추정하지 않도록 두 작업에 안내한다', async () => {
  for (const prompt of await capturePrompts('영어')) {
    const lines = prompt.split('\n');
    for (const performance of [/외국어|영어/, /계산|수리/, /실험/, /실기|실습/]) {
      assert.ok(lines.some(line => performance.test(line) && /추론|추정|만들|보충|추가/.test(line)),
        `${performance}에 관한 근거 없는 수행 추가 금지 안내가 필요하다`);
    }
    assert.ok(lines.some(line => /성장|변화/.test(line) && /추론|추정|만들|보충|추가/.test(line)));
  }
});

for (const subject of ['영어 독해', 'constructor', 'toString']) {
  test(`목록 밖 실제 과목 ${subject}을 보존하고 상속된 속성을 힌트로 쓰지 않는다`, async () => {
    for (const prompt of await capturePrompts(subject)) {
      assert.ok(prompt.includes(JSON.stringify(subject)));
      assert.ok(prompt.includes(context.observations));
      assert.ok(!prompt.includes('[native code]'));
      for (const hint of Object.values(SUBJECT_STYLE_HINTS)) {
        assert.ok(!prompt.includes(hint), '목록 밖 과목에 다른 과목의 관점을 강제하지 않는다');
      }
      assert.match(prompt, /과목|교과/);
      assert.match(prompt, /관찰/);
      assert.match(prompt, /근거/);
    }
  });
}

test('실제 수업 과목이 비어 있으면 윤문과 축약 모두 AI 호출 전에 거부한다', async () => {
  let calls = 0;
  const service = createSetukService(async () => { calls += 1; throw new Error('unexpected AI call'); });
  for (const subject of ['', '   ', null, undefined]) {
    await assert.rejects(service.generateSetukDraft({ ...context, subject }), /과목/);
    await assert.rejects(service.summarizeSetuk({ ...context, subject, text: context.observations }), /과목/);
  }
  assert.equal(calls, 0);
});

test('과목별 지침을 추가해도 A/B/C 관점·순서와 AI가 반환한 관찰 문장을 유지한다', async () => {
  const service = createSetukService(async () => JSON.stringify({
    drafts: [...expectedDrafts].reverse().map(({ version, text }) => ({ version, text: `  ${text}  ` })),
  }));
  assert.deepEqual(await service.generateSetukDraft({ ...context, subject: '수학' }), expectedDrafts);
});

test('과목을 지정해도 AI 실패 시 관찰 사실을 꾸며 만든 기본 문장을 반환하지 않는다', async () => {
  const failure = new Error('local test: AI unavailable');
  const service = createSetukService(async () => { throw failure; });
  await assert.rejects(service.generateSetukDraft({ ...context, subject: '영어' }), error => error === failure);
  await assert.rejects(service.summarizeSetuk({ ...context, subject: '영어', text: context.observations }), error => error === failure);
});
