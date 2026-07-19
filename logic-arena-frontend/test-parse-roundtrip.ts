// 역파싱 왕복 테스트: 합본 생성 → 역파싱 → 재합본이 원문과 동일한지 검증

interface ArgumentSections {
  claim: string;
  evidence: string;
  explanation: string;
  counterArgument: string;
  rebuttal: string;
}

// StructuredArgumentPanel의 combineSections 복제
function combineSections(s: ArgumentSections): string {
  return [
    s.claim && `【주장】 ${s.claim}`,
    s.evidence && `【근거】 ${s.evidence}`,
    s.explanation && `【예시】 ${s.explanation}`,
    s.counterArgument && `【예상 반론】 ${s.counterArgument}`,
    s.rebuttal && `【재반론】 ${s.rebuttal}`,
  ].filter(Boolean).join('\n\n');
}

// parseStructuredArgument 복제
const SECTION_MARKERS = [
  { key: 'claim' as const, marker: '【주장】' },
  { key: 'evidence' as const, marker: '【근거】' },
  { key: 'explanation' as const, marker: '【예시】' },
  { key: 'counterArgument' as const, marker: '【예상 반론】' },
  { key: 'rebuttal' as const, marker: '【재반론】' },
];

function parseStructuredArgument(combinedText: string): ArgumentSections | null {
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
    if (startIdx === -1) continue;

    const contentStart = startIdx + marker.length;
    const endIdx = nextMarker ? combinedText.indexOf(nextMarker, contentStart) : combinedText.length;

    if (endIdx === -1) {
      sections[key] = combinedText.slice(contentStart).trim();
    } else {
      sections[key] = combinedText.slice(contentStart, endIdx).trim();
    }

    success = true;
  }

  return success ? sections : null;
}

// 테스트
const testSections: ArgumentSections = {
  claim: '저는 학교에서 스마트폰 사용을 허용해야 한다고 생각합니다',
  evidence: '스마트폰은 긴급 상황에서 부모님과 연락할 수 있는 중요한 도구입니다',
  explanation: '예를 들어 방과 후 활동이 취소되었을 때 즉시 보호자에게 알릴 수 있습니다',
  counterArgument: '상대는 수업 중 집중력이 떨어진다고 주장할 수 있습니다',
  rebuttal: '하지만 휴대폰 사용 시간을 점심시간과 쉬는 시간으로 제한하면 수업에는 영향을 주지 않습니다',
};

const combined = combineSections(testSections);
console.log('=== 합본 생성 결과 ===');
console.log(combined);
console.log('\n=== 역파싱 결과 ===');

const parsed = parseStructuredArgument(combined);
if (!parsed) {
  console.error('❌ 역파싱 실패!');
  process.exit(1);
}

console.log(JSON.stringify(parsed, null, 2));

console.log('\n=== 재합본 ===');
const recombined = combineSections(parsed);
console.log(recombined);

console.log('\n=== 검증 ===');
if (combined === recombined) {
  console.log('✅ 왕복 테스트 성공: 원문과 재합본이 동일합니다');
} else {
  console.error('❌ 왕복 테스트 실패: 원문과 재합본이 다릅니다');
  console.error('\n=== 원문 ===');
  console.error(combined);
  console.error('\n=== 재합본 ===');
  console.error(recombined);
  process.exit(1);
}
