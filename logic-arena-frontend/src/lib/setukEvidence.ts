import type { SetukEvidenceCandidate, SetukEvidenceRecord } from './api';

export type SelectedSetukEvidence = SetukEvidenceCandidate & Pick<SetukEvidenceRecord, 'topic' | 'playedAt'>;

export function evidenceDate(playedAt: string): string {
  const date = new Date(playedAt);
  if (Number.isNaN(date.getTime())) return '날짜 미상';
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

// 교사가 체크한 후보만 전달받아 원문과 출처를 함께 추가한다. 초과 시 일부를 자르지 않는다.
export function appendSetukEvidence(observations: string, selected: SelectedSetukEvidence[]): string {
  const seen = new Set<string>();
  const additions = selected.filter(candidate => {
    if (seen.has(candidate.id)) return false;
    seen.add(candidate.id);
    return true;
  }).map(candidate => {
    const kind = candidate.kind === 'improvements' ? '개선 제안 확인' : '관찰 근거';
    return `[${evidenceDate(candidate.playedAt)} · ${candidate.topic} · ${kind}]\n${candidate.text}`;
  }).filter(value => !observations.includes(value));
  if (!additions.length) return observations;
  const result = observations + (observations ? '\n\n' : '') + additions.join('\n\n');
  if (result.length > 4000) throw new Error('관찰 내용은 최대 4,000자입니다. 선택을 줄이거나 기존 내용을 정리한 뒤 다시 추가하세요.');
  return result;
}
