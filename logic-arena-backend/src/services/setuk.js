import { validateSetukContext, setukContext, neisBytes, SETUK_RULES } from '../setukPolicy.js';
import { SUBJECT_STYLE_HINTS } from '../saedeuk.js';

const versions = [
  { version: 'A', label: '학습 과정 중심' },
  { version: 'B', label: '관찰된 변화 중심' },
  { version: 'C', label: '수업 참여 중심' },
];

function subjectGuide(subject) {
  const course = subject.trim();
  const hint = Object.hasOwn(SUBJECT_STYLE_HINTS, course)
    ? SUBJECT_STYLE_HINTS[course]
    : '교사 자료에 입력된 실제 개설 과목에 맞는 학습 과정과 표현';
  return `교과별 윤문 기준:
- 교사 자료의 과목명을 기준으로 표현을 다듬고, 구체적인 과목명을 임의로 다른 과목으로 바꾸지 않는다.
- 관찰 기록에서 확인되는 경우에만 다음 관점을 반영한다: ${hint}.
- 과목 선택만으로 외국어 능력, 계산·증명, 실험·실기 수행이나 교과 성취를 추정하지 않는다. 영어 과목이어도 영어 말하기·독해·작문 수행이 관찰 기록에 없으면 추가하지 않는다.
- 위 관점을 뒷받침하는 관찰이 없으면 입력된 사실만 유지한다. 교과에 맞추기 위해 새로운 활동·역량·성취기준을 만들어내지 않는다.
- 축약할 때도 원문과 관찰 기록의 과목·활동·의미를 유지한다.`;
}

export function createSetukService(ask) {
  return {
    async generateSetukDraft(params) {
      const error = validateSetukContext(params);
      if (error) throw new Error(error);
      const raw = await ask(`${SETUK_RULES}\n${subjectGuide(params.subject)}\n다음 교사 기록을 3가지 관점으로 윤문한다. 관점의 근거가 없으면 다른 관찰 사실만 유지하며 변화를 만들어내지 않는다.
각 제안은 200자 이내. 기재 가능한 관찰이 없으면 drafts를 빈 배열로 반환한다.
JSON만 반환: {"drafts":[{"version":"A","text":"..."},{"version":"B","text":"..."},{"version":"C","text":"..."}]}
관점: ${JSON.stringify(versions)}\n교사 자료: ${JSON.stringify(setukContext(params))}`);
      const match = raw.match(/\{[\s\S]*\}/);
      const parsed = match ? JSON.parse(match[0]) : null;
      if (!Array.isArray(parsed?.drafts)) throw new Error('윤문 응답 형식 오류');
      return versions.map(v => {
        const item = parsed.drafts.find(d => d.version === v.version);
        if (typeof item?.text !== 'string' || !item.text.trim() || item.text.length > 200) throw new Error('관찰 근거를 확인한 뒤 다시 윤문을 요청하세요.');
        return { ...v, text: item.text.trim() };
      });
    },
    async summarizeSetuk(params) {
      const error = validateSetukContext(params);
      if (error) throw new Error(error);
      if (typeof params.text !== 'string' || !params.text.trim() || params.text.length > 10000) throw new Error('축약할 내용을 확인하세요.');
      const raw = await ask(`${SETUK_RULES}\n${subjectGuide(params.subject)}\n교사의 문장을 핵심 관찰 사실과 의미를 유지하여 UTF-8 1500바이트(한글 500자 기준, 줄바꿈 1바이트) 이내로 축약한다. 새로운 사실을 추가하지 않는다. 문장만 반환한다.
교사 관찰: ${JSON.stringify(setukContext(params))}\n축약 대상: ${JSON.stringify(params.text)}`);
      const result = raw.trim();
      if (!result || neisBytes(result) > 1500) throw new Error('축약 결과가 입력 한도를 넘었습니다. 직접 줄이거나 다시 요청하세요.');
      return result;
    },
  };
}
