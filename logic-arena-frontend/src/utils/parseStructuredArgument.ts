// 역파싱: 【주장】...【재반론】 형식 → 5개 섹션으로 복원
// StructuredArgumentPanel의 combineSections와 정확히 대칭

interface ArgumentSections {
  claim: string;
  evidence: string;
  explanation: string;
  counterArgument: string;
  rebuttal: string;
}

const SECTION_MARKERS = [
  { key: 'claim' as const, marker: '【주장】' },
  { key: 'evidence' as const, marker: '【근거】' },
  { key: 'explanation' as const, marker: '【예시】' },
  { key: 'counterArgument' as const, marker: '【예상 반론】' },
  { key: 'rebuttal' as const, marker: '【재반론】' },
];

export function parseStructuredArgument(combinedText: string): ArgumentSections | null {
  if (!combinedText || !combinedText.trim()) {
    return null;
  }

  const sections: ArgumentSections = {
    claim: '',
    evidence: '',
    explanation: '',
    counterArgument: '',
    rebuttal: '',
  };

  let success = false;

  for (let i = 0; i < SECTION_MARKERS.length; i++) {
    const { key, marker } = SECTION_MARKERS[i];
    const nextMarker = SECTION_MARKERS[i + 1]?.marker;

    const startIdx = combinedText.indexOf(marker);
    if (startIdx === -1) continue; // 이 섹션이 없으면 스킵

    const contentStart = startIdx + marker.length;
    const endIdx = nextMarker ? combinedText.indexOf(nextMarker, contentStart) : combinedText.length;

    if (endIdx === -1) {
      // 다음 마커가 없으면 끝까지
      sections[key] = combinedText.slice(contentStart).trim();
    } else {
      sections[key] = combinedText.slice(contentStart, endIdx).trim();
    }

    success = true;
  }

  // 하나라도 파싱됐으면 성공
  return success ? sections : null;
}
