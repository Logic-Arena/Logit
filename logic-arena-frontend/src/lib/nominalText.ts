import { protectedRanges } from './textSegments.ts';

export interface NominalFinding {
  start: number;
  end: number;
  text: string;
  replacement: string | null;
  reason: string;
}

// 어휘 정보가 필요한 불규칙 활용만 어간 사전으로 관리한다.
// 근거: https://www.korean.go.kr/nkview/nknews/200502/79_3.html
const D_IRREGULAR = new Set(['듣', '깨닫', '싣', '일컫', '붇']);
const B_IRREGULAR = new Set(['돕', '곱', '눕', '줍', '쉽', '어렵', '가볍', '무겁', '아름답', '새롭', '즐겁', '괴롭', '두렵', '고맙', '가깝', '부드럽', '뜨겁', '차갑', '귀엽', '반갑', '흥미롭', '이롭', '해롭', '자유롭']);
const S_IRREGULAR = new Set(['짓', '잇', '낫', '젓']);
const L_STEMS = new Set(['알', '만들', '이끌', '베풀', '열', '멀', '길', '들', '거들', '일', '늘', '울', '풀', '돌', '기울']);
// 서로 다른 어간·뜻으로 분석될 수 있는 형태는 자동 선택하지 않는다.
const AMBIGUOUS_STEMS = new Set(['걷', '묻', '굽', '붓', '살', '사', '갈', '가', '놀', '노', '기']);
const PLAIN_VOWEL_STEMS = new Set(['보', '쓰', '크', '모르', '빠르', '다르', '나누', '펼치', '넓히', '밝히', '보이', '배우', '주', '세우', '기르', '따르', '아니', '모이', '보여주', '드러나', '나타나', '익히', '다루', '느끼']);
const PLAIN_FINAL_STEMS = new Set(['있', '없', '같', '좋', '많', '적', '높', '낮', '깊', '넓', '읽', '먹', '받', '찾', '믿', '얻', '웃', '벗', '씻', '잡', '작', '맞', '옳']);
const NON_PREDICATES = new Set(['바다', '사이다', '캐나다', '판다']);

function finalOf(stem: string): number {
  const code = stem.at(-1)?.charCodeAt(0) ?? 0;
  return code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 : -1;
}

function withFinal(stem: string, final: number): string {
  return stem.slice(0, -1) + String.fromCharCode(stem.charCodeAt(stem.length - 1) - finalOf(stem) + final);
}

function nominalizeStem(stem: string): string | null {
  if (!stem || AMBIGUOUS_STEMS.has(stem)) return null;
  if (D_IRREGULAR.has(stem)) return withFinal(stem, 8) + '음';
  if (B_IRREGULAR.has(stem)) return withFinal(stem, 0) + '움';
  if (S_IRREGULAR.has(stem)) return withFinal(stem, 0) + '음';
  const final = finalOf(stem);
  // 사전에 없는 불규칙 후보를 규칙 활용이라고 추정하지 않는다.
  if ([7, 17, 19, 27].includes(final) && !PLAIN_FINAL_STEMS.has(stem)) return null;
  if (final === 0) return withFinal(stem, 16);
  if (final === 8) return withFinal(stem, 10);
  return final > 0 ? stem + '음' : null;
}

function restoreLStem(surface: string): string | null {
  const restored = withFinal(surface, 8);
  return L_STEMS.has(restored) ? restored : null;
}

function recoverDroppedFinal(surface: string): string | null {
  const vowelStem = withFinal(surface, 0);
  if (AMBIGUOUS_STEMS.has(vowelStem)) return null;
  const lStem = restoreLStem(surface);
  if (lStem && isKnownStem(vowelStem)) return null;
  return lStem ?? (isKnownStem(vowelStem) ? vowelStem : null);
}

function isKnownStem(stem: string): boolean {
  return /(?:하|되)$/.test(stem) || PLAIN_VOWEL_STEMS.has(stem) || PLAIN_FINAL_STEMS.has(stem)
    || L_STEMS.has(stem) || D_IRREGULAR.has(stem) || B_IRREGULAR.has(stem) || S_IRREGULAR.has(stem);
}

function convertPredicate(word: string): string | null {
  if ([...NON_PREDICATES].some(noun => word.endsWith(noun))) return null;
  if (word.endsWith('입니다')) return word.slice(0, -3) + '임';
  if (word.endsWith('습니다')) return nominalizeStem(word.slice(0, -3));
  if (word.endsWith('니다')) {
    const surface = word.slice(0, -2);
    if (finalOf(surface) === 17) {
      const stem = recoverDroppedFinal(surface);
      return stem ? nominalizeStem(stem) : null;
    }
  }
  if (word.endsWith('는다')) return nominalizeStem(word.slice(0, -2));
  if (!word.endsWith('다')) return null;
  const surface = word.slice(0, -1);
  // 과거·추측 선어말 어미는 이미 활용된 형태를 보존한다.
  if (finalOf(surface) === 20 || surface.endsWith('겠')) return nominalizeStem(surface);
  if (isKnownStem(surface)) return nominalizeStem(surface);
  // 현재형 -ㄴ다에서 ㄴ을 분리하고, 탈락한 ㄹ은 어간 사전으로 복원한다.
  if (finalOf(surface) === 4) {
    const stem = recoverDroppedFinal(surface);
    return stem ? nominalizeStem(stem) : null;
  }
  if (surface.endsWith('이') && surface.length >= 3) return surface.slice(0, -1) + '임';
  return null;
}

/** 인용/괄호/코드 내부와 소수점은 문장 경계로 사용하지 않는다. */
function sentenceRanges(text: string): Array<[number, number]> {
  const pairs: Record<string, string> = { '"': '"', "'": "'", '“': '”', '‘': '’', '「': '」', '『': '』', '(': ')', '[': ']', '{': '}', '`': '`' };
  const closers: string[] = [];
  const ranges: Array<[number, number]> = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (closers.at(-1) === ch) { closers.pop(); continue; }
    if (pairs[ch]) { closers.push(pairs[ch]); continue; }
    if (closers.length) continue;
    if ('\n.!?。！？'.includes(ch)) {
      if (ch === '.' && /\d/.test(text[i - 1] ?? '') && /\d/.test(text[i + 1] ?? '')) continue;
      ranges.push([start, i]);
      start = i + 1;
    }
  }
  if (!closers.length) ranges.push([start, text.length]);
  return ranges;
}

export function analyzeNominal(text: string): NominalFinding[] {
  const findings: NominalFinding[] = [];
  const protectedSpans = protectedRanges(text);
  for (const [start, end] of sentenceRanges(text)) {
    const match = /([가-힣]+)\s*$/u.exec(text.slice(start, end));
    if (!match) continue;
    const word = match[1];
    if ([...NON_PREDICATES].some(noun => word.endsWith(noun)) || !/(?:다|요|습니까|까요|하자|해라)$/.test(word)) continue;
    const wordStart = start + match.index;
    if (protectedSpans.some(([from, to]) => wordStart < to && wordStart + word.length > from)) continue;
    const replacement = /[?？]/.test(text[end] ?? '') ? null : convertPredicate(word);
    findings.push({ start: wordStart, end: wordStart + word.length, text: word, replacement,
      reason: replacement === null ? '어간이나 문장 유형이 모호하여 직접 검토가 필요함' : '어미를 분리하고 어간의 받침·활용 규칙을 적용함' });
  }
  return findings;
}

export function hasNonNominalEnding(text: string): boolean { return analyzeNominal(text).length > 0; }

export function convertToNominal(text: string): string {
  let result = '';
  let cursor = 0;
  for (const finding of analyzeNominal(text)) {
    if (finding.replacement === null) continue;
    result += text.slice(cursor, finding.start) + finding.replacement;
    cursor = finding.end;
  }
  return result + text.slice(cursor);
}
