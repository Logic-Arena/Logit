// 세특(생활기록부) 기재 금지 항목 룰 기반 탐지·일반화 처리
// AI 프롬프트만으로는 컴플라이언스를 보장할 수 없어 후처리 필터를 별도로 둠.
const BANNED_RULES = [
  {
    category: '사교육 기관명',
    pattern: /[가-힣A-Za-z0-9]{1,15}학원/g,
    replacement: '사교육 기관',
  },
  {
    category: '자격증·인증',
    pattern: /(토익|토플|텝스|HSK|JLPT|한자능력검정|컴퓨터활용능력|정보처리기사|공인중개사|자격증|인증서|[0-9]+급(?=\s|$))/g,
    replacement: '관련 자격 취득 이력',
  },
  {
    category: '해외 활동',
    pattern: /(해외\s*연수|해외\s*활동|유학|교환학생|어학연수)/g,
    replacement: '교외 활동',
  },
  {
    category: '부모 직업·재산 정보',
    pattern: /(아버지|어머니|부모님)(은|는|이|가)?\s*(직업|회사|대표|사장|의사|변호사|교수|공무원|연봉|재산)[가-힣]*/g,
    replacement: '가정환경 관련 언급',
  },
  {
    category: '수상·대회명',
    pattern: /[가-힣A-Za-z0-9]{0,15}(대회|콘테스트|올림피아드)에서\s*(금상|은상|동상|대상|최우수상|우수상|장려상|수상)/g,
    replacement: '교내외 활동에서 우수한 성과',
  },
];

/**
 * @param {string} text
 * @returns {{ text: string, flags: Array<{ category: string, matched: string }> }}
 */
export function filterBannedContent(text) {
  if (typeof text !== 'string' || !text) return { text: text ?? '', flags: [] };

  let result = text;
  const flags = [];

  for (const rule of BANNED_RULES) {
    result = result.replace(rule.pattern, (matched) => {
      flags.push({ category: rule.category, matched });
      return rule.replacement;
    });
  }

  return { text: result, flags };
}
