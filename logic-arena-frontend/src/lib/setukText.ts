export { analyzeNominal, convertToNominal, hasNonNominalEnding } from './nominalText.ts';
import { protectedRanges } from './textSegments.ts';

export interface ForbiddenFinding {
  start: number;
  end: number;
  text: string;
  label: string;
  category: string;
  replacement: string | null;
  reason: string;
}
type TermRule = { terms: string[]; category: string; replacement: string; context?: RegExp };
const COMPANY_CONTEXT = /기업|회사|입사|취업|채용|주식|브랜드|제품|자동차|전자|계열사/;
const RULES: TermRule[] = [
  { terms: ['삼성전자', '현대자동차', 'LG전자', 'SK하이닉스', '네이버', '포스코'], category: '기업명', replacement: '국내 기업' },
  { terms: ['삼성', '현대', 'LG', 'SK', '롯데', '카카오', '한화', '두산', 'CJ', 'GS'], category: '기업명', replacement: '국내 기업', context: COMPANY_CONTEXT },
  { terms: ['토익', '토플', 'TOEIC', 'TOEFL', 'HSK', 'JLPT', '텝스', 'TEPS', 'OPIc', 'JPT', 'IELTS'], category: '공인어학시험', replacement: '공인어학시험' },
  { terms: ['정보처리기사', '컴퓨터활용능력', '한국사능력검정시험', '한자능력검정시험', '워드프로세서'], category: '자격증', replacement: '관련 자격' },
];
const AWARDS = ['최우수상', '우수상', '장려상', '금상', '은상', '동상', '대상'];
const PARTICLES = /^(?:(?:으로부터|으로서|으로써|이라는|이라고|이라도|이랑|이나|이든|에게서|한테서|에서는|에서|에게|한테|께서|으로|부터|까지|처럼|보다|마저|조차|하고|라는|라고|라도|랑|든|은|는|이|가|을|를|의|에|로|과|와|도|만|께|나)){0,3}$/u;
const WORDS = /[\p{L}\p{N}]+/gu;

function lastBatchim(text: string): number {
  const last = text.at(-1)?.charCodeAt(0) ?? 0;
  return last >= 0xac00 && last <= 0xd7a3 ? (last - 0xac00) % 28 : 0;
}

function attachParticle(noun: string, particle: string): string {
  const batchim = lastBatchim(noun);
  const pairs = [
    ['으로', '로', batchim !== 0 && batchim !== 8],
    ['이라는', '라는', batchim !== 0], ['이라고', '라고', batchim !== 0],
    ['이라도', '라도', batchim !== 0], ['이랑', '랑', batchim !== 0],
    ['이나', '나', batchim !== 0], ['이든', '든', batchim !== 0],
    ['을', '를', batchim !== 0], ['은', '는', batchim !== 0],
    ['이', '가', batchim !== 0], ['과', '와', batchim !== 0],
  ] as const;
  for (const [closed, open, hasFinal] of pairs) {
    for (const form of [closed, open]) {
      if (particle.startsWith(form)) return noun + (hasFinal ? closed : open) + particle.slice(form.length);
    }
  }
  return noun + particle;
}

function suffixFor(word: string, term: string): string | null {
  if (!word.toLocaleLowerCase('en').startsWith(term.toLocaleLowerCase('en'))) return null;
  const suffix = word.slice(term.length);
  return PARTICLES.test(suffix) ? suffix : null;
}

function inAwardContext(text: string, start: number, end: number, suffix: string): boolean {
  if (/^(?:으로|로|처럼|보다)/.test(suffix)) return false;
  const before = text.slice(Math.max(0, start - 40), start);
  const after = text.slice(end, end + 30);
  return /^\s*(?:수상|수여|받|차지|획득)/.test(after)
    || /(?:대회|공모전|콘테스트|올림피아드)(?:에서|의)?\s*$/.test(before)
    || /(?:수상한|수여된)\s*$/.test(before);
}

/** 탐지와 치환은 같은 원문 범위를 사용한다. 새로 만든 문장을 재탐색하지 않는다. */
export function analyzeForbidden(text: string): ForbiddenFinding[] {
  const candidates: ForbiddenFinding[] = [];
  const protectedSpans = protectedRanges(text);
  const clauses = [...text.matchAll(/[^.!?。！？\n,;:]+/g)];
  let clauseIndex = 0;
  const add = (start: number, end: number, label: string, category: string, replacement: string | null, reason: string) => {
    if (protectedSpans.some(([from, to]) => start < to && end > from)) {
      replacement = null;
      reason = '인용·괄호·코드·주소에 포함된 원문이므로 직접 검토가 필요함';
    }
    candidates.push({ start, end, text: text.slice(start, end), label, category, replacement, reason });
  };
  for (const token of text.matchAll(WORDS)) {
    const start = token.index;
    const end = start + token[0].length;
    const word = token[0].normalize('NFKC');
    while (clauseIndex < clauses.length && clauses[clauseIndex].index + clauses[clauseIndex][0].length <= start) clauseIndex++;
    const clause = (clauses[clauseIndex]?.[0] ?? '').normalize('NFKC');
    for (const rule of RULES) {
      for (const term of rule.terms) {
        const suffix = suffixFor(word, term);
        if (suffix === null || (rule.context && !rule.context.test(clause))) continue;
        add(start, end, term, rule.category, rule.context ? null : attachParticle(rule.replacement, suffix), rule.context ? '기업명인지 문맥 확인이 필요함' : '이름과 조사 경계가 일치함');
      }
    }
    const academy = /^(.*학원)(.*)$/u.exec(word);
    if (academy && academy[1] !== '학원' && !academy[1].endsWith('대학원') && PARTICLES.test(academy[2])) {
      add(start, end, academy[1], '사교육 기관명', attachParticle('사교육기관', academy[2]), '기관 이름과 학원 접미부가 일치함');
    }
    for (const award of AWARDS) {
      const suffix = suffixFor(word, award);
      if (suffix !== null && inAwardContext(text, start, end, suffix)) {
        add(start, end, award, '수상 이력', null, '수상 사실의 기재 여부를 문장 전체에서 검토해야 함');
      }
    }
  }
  // 이름만 바꿔도 사실이 남는 항목은 임의 삭제·일반화 대신 검토 대상으로 표시한다.
  for (const match of text.matchAll(/(?:해외\s*(?:연수|활동)|어학연수|교환학생)(?=$|[^\p{L}\p{N}]|(?:에서|으로|에는|은|는|이|가|을|를|에|의|도|임|이다|이었다)(?=$|[^\p{L}\p{N}]))/gu)) {
    if (match.index > 0 && /[\p{L}\p{N}]/u.test(text[match.index - 1])) continue;
    add(match.index, match.index + match[0].length, match[0], '해외 활동', null, '학생 자신의 활동 이력인지 확인이 필요함');
  }
  for (const match of text.matchAll(/(?:아버지|어머니|부모님?)(?:은|는|이|가|의)?\s*(?:직업|회사|대표|사장|의사|변호사|교수|공무원|연봉|재산)(?=$|[^\p{L}\p{N}]|(?:임|이다|였다|인|이고|이며|로|은|는|이|가|을|를|에|의)(?=$|[^\p{L}\p{N}]))/gu)) {
    if (match.index > 0 && /[\p{L}\p{N}]/u.test(text[match.index - 1])) continue;
    add(match.index, match.index + match[0].length, match[0], '가족 정보', null, '가족의 직업·재산 정보인지 확인이 필요함');
  }
  candidates.sort((a, b) => a.start - b.start || b.end - a.end);
  const findings: ForbiddenFinding[] = [];
  for (const candidate of candidates) {
    if (candidate.start >= (findings.at(-1)?.end ?? 0)) findings.push(candidate);
  }
  return findings;
}

export function checkForbidden(text: string): string[] {
  return [...new Set(analyzeForbidden(text).map(item => item.label))];
}

export function applyForbiddenFilter(text: string): { result: string; log: string[] } {
  let result = '';
  let cursor = 0;
  const log: string[] = [];
  for (const finding of analyzeForbidden(text)) {
    if (finding.replacement === null) continue;
    result += text.slice(cursor, finding.start) + finding.replacement;
    cursor = finding.end;
    log.push(`"${finding.text}" → "${finding.replacement}"`);
  }
  return { result: result + text.slice(cursor), log };
}
