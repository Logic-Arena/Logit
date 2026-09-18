export function playerAuthor(mode: string, essaySide: 'pro' | 'con' | null | undefined, fallback: string): string {
  if (mode !== 'solo_essay') return fallback;
  return essaySide === 'pro' ? '찬성 논술 작성자' : essaySide === 'con' ? '반대 논술 작성자' : '논술 작성자';
}

export function stageStatus(index: number, activeIndex: number, ended: boolean): 'done' | 'active' | 'upcoming' {
  if (ended) return 'done';
  if (activeIndex < 0) return 'upcoming';
  return index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'upcoming';
}
