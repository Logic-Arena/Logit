// 서버 후처리: 확실한 이름만 일반화하고, 사실 판단이 필요한 항목은 검토 대상으로 남긴다.
// flags.reviewRequired는 자동 치환되지 않았음을 뜻하며 기재 적합성 판정을 뜻하지 않는다.
const PARTICLES = /^(?:(?:으로부터|으로서|으로써|이라는|이라고|이라도|이랑|이나|이든|에게서|한테서|에서는|에서|에게|한테|께서|으로|부터|까지|처럼|보다|마저|조차|하고|라는|라고|라도|랑|든|은|는|이|가|을|를|의|에|로|과|와|도|만|께|나)){0,3}$/u;
const TESTS = ['토익', '토플', 'TOEIC', 'TOEFL', '텝스', 'TEPS', 'HSK', 'JLPT', 'OPIc', 'JPT', 'IELTS'];
const CERTIFICATES = ['한자능력검정시험', '한국사능력검정시험', '컴퓨터활용능력', '정보처리기사', '공인중개사', '워드프로세서'];
const AWARDS = ['최우수상', '우수상', '장려상', '금상', '은상', '동상', '대상'];

function particleSuffix(word, term) {
  if (!word.toLowerCase().startsWith(term.toLowerCase())) return null;
  const suffix = word.slice(term.length);
  return PARTICLES.test(suffix) ? suffix : null;
}

function withParticle(noun, particle) {
  // 아래 자동 치환 명사는 모두 ㄹ 이외의 받침으로 끝난다.
  const pairs = [['로', '으로'], ['라는', '이라는'], ['라고', '이라고'], ['라도', '이라도'], ['랑', '이랑'], ['나', '이나'], ['든', '이든'], ['를', '을'], ['는', '은'], ['가', '이'], ['와', '과']];
  for (const [vowelForm, finalForm] of pairs) {
    if (particle.startsWith(finalForm)) return noun + particle;
    if (particle.startsWith(vowelForm)) return noun + finalForm + particle.slice(vowelForm.length);
  }
  return noun + particle;
}

function protectedRanges(text) {
  const pairs = { '"': '"', "'": "'", '“': '”', '‘': '’', '「': '」', '『': '』', '(': ')', '[': ']', '{': '}', '`': '`' };
  const stack = [], ranges = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (stack.at(-1) === text[i]) {
      stack.pop();
      if (!stack.length) ranges.push([start, i + 1]);
    } else if (pairs[text[i]]) {
      if (!stack.length) start = i;
      stack.push(pairs[text[i]]);
    }
  }
  if (stack.length) ranges.push([start, text.length]);
  for (const match of text.matchAll(/https?:\/\/[^\s]+|www\.[^\s]+|[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu)) {
    ranges.push([match.index, match.index + match[0].length]);
  }
  return ranges;
}

export function filterBannedContent(text) {
  if (typeof text !== 'string' || !text) return { text: typeof text === 'string' ? text : '', flags: [] };
  const candidates = [];
  const protectedSpans = protectedRanges(text);
  function add(start, end, category, replacement = null) {
    if (protectedSpans.some(([from, to]) => start < to && end > from)) replacement = null;
    candidates.push({ start, end, category, matched: text.slice(start, end), replacement });
  }
  for (const token of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    const word = token[0].normalize('NFKC'), start = token.index, end = start + token[0].length;
    const academy = /^(.*학원)(.*)$/u.exec(word);
    if (academy && academy[1] !== '학원' && !academy[1].endsWith('대학원') && PARTICLES.test(academy[2])) {
      add(start, end, '사교육 기관명', withParticle('사교육기관', academy[2]));
    }
    for (const [terms, replacement] of [[TESTS, '공인어학시험'], [CERTIFICATES, '관련 자격']]) {
      for (const term of terms) {
        const suffix = particleSuffix(word, term);
        if (suffix !== null) add(start, end, '자격증·인증', withParticle(replacement, suffix));
      }
    }
    for (const award of AWARDS) {
      const suffix = particleSuffix(word, award);
      if (suffix === null || /^(?:으로|로|처럼|보다)/.test(suffix)) continue;
      if (/^\s*(?:수상|수여|받|차지|획득)/.test(text.slice(end, end + 30))
        || /(?:대회|공모전|콘테스트|올림피아드)(?:에서|의)?\s*$/.test(text.slice(Math.max(0, start - 40), start))) {
        add(start, end, '수상·대회명');
      }
    }
  }
  const reviewPatterns = [
    ['해외 활동', /(?:해외\s*(?:연수|활동)|어학연수|교환학생)(?=$|[^\p{L}\p{N}]|(?:에서|으로|에는|은|는|이|가|을|를|에|의|도|임|이다|이었다)(?=$|[^\p{L}\p{N}]))/gu],
    ['부모 직업·재산 정보', /(?:아버지|어머니|부모님?)(?:은|는|이|가|의)?\s*(?:직업|회사|대표|사장|의사|변호사|교수|공무원|연봉|재산)(?=$|[^\p{L}\p{N}]|(?:임|이다|였다|인|이고|이며|로|은|는|이|가|을|를|에|의)(?=$|[^\p{L}\p{N}]))/gu],
  ];
  for (const [category, pattern] of reviewPatterns) {
    for (const match of text.matchAll(pattern)) {
      if (match.index > 0 && /[\p{L}\p{N}]/u.test(text[match.index - 1])) continue;
      add(match.index, match.index + match[0].length, category);
    }
  }
  candidates.sort((a, b) => a.start - b.start || b.end - a.end);
  const flags = [];
  let result = '', cursor = 0, lastEnd = 0;
  for (const item of candidates) {
    if (item.start < lastEnd) continue;
    lastEnd = item.end;
    flags.push({ category: item.category, matched: item.matched, reviewRequired: item.replacement === null });
    if (item.replacement === null) continue;
    result += text.slice(cursor, item.start) + item.replacement;
    cursor = item.end;
  }
  return { text: result + text.slice(cursor), flags };
}
