import { useEffect, useRef, useState } from 'react';
import { getSetukEvidence } from '../../lib/api';
import type { SetukEvidenceResponse } from '../../lib/api';
import { evidenceDate } from '../../lib/setukEvidence';
import type { SelectedSetukEvidence } from '../../lib/setukEvidence';
import ui from './SetukAssistant.module.css';

const kindLabels = { summary: '요약', strengths: '강점', improvements: '개선 제안 · 달성한 성과가 아님' };

export function SetukEvidencePicker({ token, userId, onAdd }: {
  token: string;
  userId: number;
  onAdd: (candidates: SelectedSetukEvidence[]) => void;
}) {
  const requestRef = useRef<AbortController | null>(null);
  const [data, setData] = useState<SetukEvidenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [added, setAdded] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => () => requestRef.current?.abort(), []);

  async function load() {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError('');
    setStatus('');
    try {
      const result = await getSetukEvidence(token, userId, controller.signal);
      if (controller.signal.aborted) return;
      setData(result);
      setSelected([]);
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '토론 관찰 후보를 불러오지 못했습니다.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  function add() {
    const candidates = data?.items.flatMap(record => record.candidates
      .filter(candidate => selected.includes(candidate.id) && !added.includes(candidate.id))
      .map(candidate => ({ ...candidate, topic: record.topic, playedAt: record.playedAt }))) ?? [];
    if (!candidates.length) return;
    try {
      onAdd(candidates);
      setAdded(previous => [...previous, ...candidates.map(candidate => candidate.id)]);
      setSelected([]);
      setError('');
      setStatus(`${candidates.length}개 후보를 관찰란에 추가했습니다. 실제 관찰에 맞게 수정하고 직접 관찰·교육과정 여부를 다시 확인하세요.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '관찰란에 추가하지 못했습니다.');
    }
  }

  return <section className={ui.evidence} aria-label="토론 기록의 관찰 후보">
    <h4>토론 기록에서 관찰 근거 찾기</h4>
    <p className={ui.hint}>최근 토론 10건의 저장된 AI 요약에서 후보를 불러옵니다. 발언 원문 전체가 아닌 요약 속 인용·서술이므로, 직접 관찰·평가한 사실과 일치하는 항목만 체크하세요. 개선 제안을 이미 이룬 성과로 적지 마세요.</p>
    <button type="button" className="btn btn--ghost" disabled={loading} onClick={() => void load()}>{loading ? '관찰 후보를 불러오는 중…' : data ? '관찰 후보 다시 불러오기' : '토론 기록에서 관찰 근거 불러오기'}</button>
    {loading && <p className={ui.hint} role="status">저장된 토론 요약을 확인하고 있습니다.</p>}
    {error && <p className={ui.evidenceError} role="alert">{error}</p>}
    {data && <>
      <p className={ui.hint} role="status">최근 토론 {data.scannedCount}건 중 후보가 있는 토론 {data.items.length}건{data.unavailableCount > 0 && ` · 요약이 없거나 사용할 후보가 없는 토론 ${data.unavailableCount}건`}{data.excludedCount > 0 && ` · 점수·승패·순위 등의 설명 ${data.excludedCount}개 제외`}</p>
      {data.items.length === 0 && <p className={ui.hint}>불러올 관찰 후보가 없습니다. 저장된 요약이 없거나 사용할 내용이 없는 경우 직접 관찰 내용을 작성하세요.</p>}
      {data.items.map(record => <details key={record.historyId} className={ui.evidenceRecord} open>
        <summary><time dateTime={record.playedAt}>{evidenceDate(record.playedAt)}</time> · {record.topic} {record.position === 'pro' ? '(찬성)' : record.position === 'con' ? '(반대)' : ''}</summary>
        {record.candidates.map(candidate => <label key={candidate.id} className={`${ui.check} ${ui.evidenceCandidate}`}>
          <input type="checkbox" disabled={loading || added.includes(candidate.id)} checked={selected.includes(candidate.id)} onChange={e => setSelected(previous => e.target.checked ? [...previous, candidate.id] : previous.filter(id => id !== candidate.id))} />
          <span><strong>{kindLabels[candidate.kind]}</strong><span className={ui.evidenceText}>{candidate.text}</span><span className={ui.hint}>{added.includes(candidate.id) ? '관찰란에 추가됨' : '직접 관찰·평가한 사실과 대조하여 확인했습니다.'}</span></span>
        </label>)}
      </details>)}
      {data.items.length > 0 && <button type="button" className="btn btn--ghost" disabled={loading || !selected.length} onClick={add}>확인한 {selected.length}개 후보를 관찰란에 추가</button>}
    </>}
    {status && <p className={ui.hint} role="status">{status}</p>}
  </section>;
}
