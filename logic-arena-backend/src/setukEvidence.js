export const SETUK_EVIDENCE_LIMIT = 10;

// 점수 설명을 잘라 관찰 사실처럼 만들지 않고 해당 후보 전체를 제외한다.
// 이 필터는 사실 검증이 아니므로 남은 요약도 교사의 직접 확인이 필요하다.
const PLATFORM_RESULT = /점수|득점|만점|\d+(?:\.\d+)?\s*점|승리|패배|승패|무승부|승률|순위|등수|\d+\s*위|성장률|랭크|랭킹|티어|\b(?:score|rank|ranking|win|loss|tier)\b/i;

export function collectSetukEvidence(histories) {
  const items = [];
  let unavailableCount = 0;
  let excludedCount = 0;
  for (const history of histories) {
    const summary = history.teacher_summary;
    const candidates = [];
    const seen = new Set();
    if (summary && typeof summary === 'object' && !Array.isArray(summary)) {
      for (const kind of ['summary', 'strengths', 'improvements']) {
        const values = kind === 'summary' ? [summary[kind]] : Array.isArray(summary[kind]) ? summary[kind] : [];
        for (const [index, value] of values.entries()) {
          if (typeof value !== 'string' || !value.trim()) continue;
          const text = value.trim();
          if (PLATFORM_RESULT.test(text)) { excludedCount++; continue; }
          if (seen.has(text)) continue;
          seen.add(text);
          candidates.push({ id: `${history.id}:${kind}:${index}`, kind, text });
        }
      }
    }
    if (!candidates.length) { unavailableCount++; continue; }
    items.push({
      historyId: history.id,
      topic: history.topic,
      position: history.position,
      playedAt: history.played_at,
      candidates,
    });
  }
  return { items, recentLimit: SETUK_EVIDENCE_LIMIT, scannedCount: histories.length, unavailableCount, excludedCount };
}
