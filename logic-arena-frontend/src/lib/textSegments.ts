/** 원문 보존이 필요한 인용·괄호·코드·URL 범위. 오프셋은 원본 문자열 기준이다. */
export function protectedRanges(text: string): Array<[number, number]> {
  const pairs: Record<string, string> = { '"': '"', "'": "'", '“': '”', '‘': '’', '「': '」', '『': '』', '(': ')', '[': ']', '{': '}', '`': '`' };
  const stack: string[] = [];
  const ranges: Array<[number, number]> = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (stack.at(-1) === ch) {
      stack.pop();
      if (!stack.length) ranges.push([start, i + 1]);
    } else if (pairs[ch]) {
      if (!stack.length) start = i;
      stack.push(pairs[ch]);
    }
  }
  if (stack.length) ranges.push([start, text.length]);
  for (const match of text.matchAll(/https?:\/\/[^\s]+|www\.[^\s]+|[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu)) {
    ranges.push([match.index, match.index + match[0].length]);
  }
  return ranges;
}
