import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeForbidden, checkForbidden, applyForbiddenFilter, analyzeNominal, convertToNominal, hasNonNominalEnding } from '../src/lib/setukText.ts';

const preserved = [
  '교육대학원생의 연구를 분석 대상으로 삼음.', '현대 사회의 문제를 탐구함.',
  '카카오 열매의 특징을 조사함.', '동상을 관찰하고 느낌을 기록함.',
  '대회 자료를 비교 대상으로 삼음.', '금상첨화라는 표현을 학습함.',
  'SKILL과 TASK의 차이를 설명함.', 'LGS와 GSAT, TOEICish는 별도 문자열임.',
  '수학원리를 탐구함.', '대상자의 의견을 들음.', '영어학원과 대학원을 비교함.',
  '부모의 의사소통을 분석함.', '해외 활동가의 사례를 조사함.',
];
for (const text of preserved.filter(x => !x.includes('영어학원'))) {
  test(`일반 표현 보존: ${text}`, () => {
    assert.deepEqual(analyzeForbidden(text), []);
    assert.deepEqual(applyForbiddenFilter(text), { result: text, log: [] });
  });
}

const replacements = [
  ['삼성전자는 사례임.', '국내 기업은 사례임.'],
  ['현대자동차를 비교함.', '국내 기업을 비교함.'],
  ['네이버와 비교함.', '국내 기업과 비교함.'],
  ['정보처리기사로 역량을 인증함.', '관련 자격으로 역량을 인증함.'],
  ['메가학원에서 학습함.', '사교육기관에서 학습함.'],
  ['대학원과 영어학원을 비교함.', '대학원과 사교육기관을 비교함.'],
  ['toeic은 시험임.', '공인어학시험은 시험임.'],
  ['ＴＯＥＩＣ을 응시함.', '공인어학시험을 응시함.'],
  ['삼성전자와 삼성전자를 비교함.', '국내 기업과 국내 기업을 비교함.'],
] as const;
for (const [input, expected] of replacements) {
  test(`원문 범위와 조사 치환: ${input}`, () => {
    const findings = analyzeForbidden(input);
    for (const finding of findings) assert.equal(input.slice(finding.start, finding.end), finding.text);
    const { result, log } = applyForbiddenFilter(input);
    assert.equal(result, expected);
    assert.equal(log.length, findings.filter(item => item.replacement !== null).length);
    assert.deepEqual(applyForbiddenFilter(result), { result, log: [] });
  });
}

for (const text of [
  '과학대회에서 대상을 수상함.', '최우수상을 수상함.', '공모전 대상',
  '현대 기업에 입사함.', '아버지는 의사임.', '해외 연수에 참여함.',
  '“삼성전자”라는 인용을 분석함.', '`TOEIC`을 코드에 작성함.',
]) {
  test(`모호하거나 사실 판단이 필요한 항목 보존: ${text}`, () => {
    assert.ok(analyzeForbidden(text).length > 0);
    assert.ok(analyzeForbidden(text).every(item => item.replacement === null));
    assert.deepEqual(applyForbiddenFilter(text), { result: text, log: [] });
  });
}

test('확실한 이름만 치환해도 수상 검토 경고는 남는다', () => {
  const { result } = applyForbiddenFilter('메가학원에서 학습함. 대회에서 대상을 수상함.');
  assert.equal(result, '사교육기관에서 학습함. 대회에서 대상을 수상함.');
  assert.deepEqual(checkForbidden(result), ['대상']);
});

const nominalCases = [
  ['펼친다', '펼침'], ['넓힌다', '넓힘'], ['나눈다', '나눔'], ['쓴다', '씀'],
  ['보인다', '보임'], ['보여준다', '보여줌'], ['드러난다', '드러남'], ['나타난다', '나타남'],
  ['만든다', '만듦'], ['만듭니다', '만듦'], ['만들다', '만듦'],
  ['안다', '앎'], ['압니다', '앎'], ['알다', '앎'], ['이끈다', '이끎'], ['베푼다', '베풂'],
  ['읽는다', '읽음'], ['읽습니다', '읽음'], ['읽었다', '읽었음'],
  ['듣는다', '들음'], ['듣습니다', '들음'], ['깨닫는다', '깨달음'], ['싣는다', '실음'],
  ['돕는다', '도움'], ['쉽다', '쉬움'], ['어렵습니다', '어려움'], ['아름답다', '아름다움'],
  ['짓는다', '지음'], ['있다', '있음'], ['없습니다', '없음'],
  ['모른다', '모름'], ['빠르다', '빠름'], ['다르다', '다름'],
  ['펼쳤다', '펼쳤음'], ['설명하겠다', '설명하겠음'], ['학생입니다', '학생임'], ['학생이다', '학생임'], ['아니다', '아님'],
] as const;
for (const [input, expected] of nominalCases) {
  test(`어간·어미 활용: ${input}`, () => {
    const sentence = `학생이 ${input}.`;
    const result = convertToNominal(sentence);
    assert.equal(result, `학생이 ${expected}.`);
    assert.equal(convertToNominal(result), result);
    assert.equal(hasNonNominalEnding(result), false);
  });
}

for (const root of ['분석', '설명', '논증', '비교', '반박', '토론', '탐구', '제시', '정리', '기록', '협력', '계획', '관찰', '검토', '공유', '확인', '증명', '평가', '확장', '수정', '발표', '표현']) {
  for (const [ending, nominal] of [['한다', '함'], ['합니다', '함'], ['하였다', '하였음'], ['했다', '했음']]) {
    test(`생산적 하다 활용: ${root}${ending}`, () => {
      assert.equal(convertToNominal(`${root}${ending}.`), `${root}${nominal}.`);
    });
  }
}

for (const text of ['흙에 묻는다.', '길을 걷는다.', '집을 삽니다.', '빵을 굽는다.', '일을 머문다.', '도와주세요.', '함께 할까요?', '책을 읽는다?']) {
  test(`활용·문장 유형이 모호하면 검토로 남김: ${text}`, () => {
    assert.equal(convertToNominal(text), text);
    assert.ok(analyzeNominal(text).some(item => item.replacement === null));
  });
}

test('인용·괄호·코드·URL·명사·미완성 인용 원문을 보존한다', () => {
  for (const text of ['“분석한다.”', '"분석한다."', '(분석한다.)', '`분석한다.`', 'https://example.com/분석한다', '넓은 바다.', '시원한 사이다.', '캐나다.', '“끝나지 않은 인용을 분석한다.']) {
    assert.equal(convertToNominal(text), text);
  }
});

test('인용문 밖의 어미만 바꾸고 소수점·줄바꿈·문장부호를 보존한다', () => {
  const input = '“분석한다.”를 인용하고 주장을 펼친다.\r\n2.5점을 기록합니다!  논리를 설명했다。';
  const expected = '“분석한다.”를 인용하고 주장을 펼침.\r\n2.5점을 기록함!  논리를 설명했음。';
  assert.equal(convertToNominal(input), expected);
});

test('빈 입력과 긴 반복 입력에서도 원문 범위·반복 적용 특성을 유지한다', () => {
  assert.deepEqual(analyzeForbidden(''), []);
  assert.equal(convertToNominal(''), '');
  const input = '대학원 자료를 분석 대상으로 삼음. 삼성전자를 비교함. '.repeat(200);
  const result = applyForbiddenFilter(input).result;
  assert.equal(result, '대학원 자료를 분석 대상으로 삼음. 국내 기업을 비교함. '.repeat(200));
  assert.equal(applyForbiddenFilter(result).result, result);
});
