export function neisBytes(text: string): number {
  return new TextEncoder().encode(text.replace(/\r\n?/g, '\n')).length;
}

export function normalizeSetuk(text: string): string {
  return text.normalize('NFKC').replace(/[\p{P}\p{Z}\p{C}\p{S}]/gu, '').toLowerCase();
}

// 공백·문장부호만 바꾸거나 AI 문장 전체를 붙인 뒤 덧붙이는 우회를 막는 제품 장치.
// 교육부가 정한 수정 비율이나 적법성 판정 기준은 아니다.
export function containsAiDraft(text: string, aiTexts: string[]): boolean {
  const normalized = normalizeSetuk(text);
  return aiTexts.some(draft => {
    const source = normalizeSetuk(draft);
    if (!source) return false;
    if (normalized.includes(source)) return true;
    // 단순 오탈자 변경을 걸러내는 보수적인 제품 기준이며 법정 수정 비율이 아니다.
    const tolerance = Math.max(1, Math.floor(source.length * 0.1));
    if (Math.abs(source.length - normalized.length) > tolerance) return false;
    let row = Array.from({ length: source.length + 1 }, (_, i) => i);
    for (let i = 1; i <= normalized.length; i++) {
      const next = [i];
      for (let j = 1; j <= source.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (normalized[i - 1] === source[j - 1] ? 0 : 1));
      row = next;
    }
    return row[source.length] <= tolerance;
  });
}

export function copyBlockReason({ text, aiTexts, contextReady, reviewed, unresolved, busy }: {
  text: string; aiTexts: string[]; contextReady: boolean; reviewed: boolean; unresolved: boolean; busy: boolean;
}): string {
  if (busy) return 'AI 작업이 끝난 뒤 검토하세요.';
  if (!contextReady) return '수업 정보와 직접 관찰 여부를 확인하세요.';
  if (!normalizeSetuk(text)) return '교사가 최종 검토할 문장을 작성하세요.';
  if (neisBytes(text) > 1500) return '1,500바이트(한글 500자 기준) 이내로 줄이세요.';
  if (containsAiDraft(text, aiTexts)) return 'AI 제안과 같거나 거의 같습니다. 공백·문장부호·일부 글자만 바꾸지 말고 관찰 근거에 따라 직접 작성하세요.';
  if (unresolved) return '탐지된 표현을 수정하거나 기재 가능한 문맥과 근거를 확인하세요.';
  if (!reviewed) return '최종 문장을 관찰 기록과 대조하고 아래 검토 항목을 확인하세요.';
  return '';
}
