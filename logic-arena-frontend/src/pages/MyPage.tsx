import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useDebateHistoryStore, type DebateHistoryItem } from '../store/useDebateHistoryStore';
import type { DebateResult } from '../types/room';

function winRate(winCount: number, totalGames: number) {
  if (!totalGames) return 0;
  return Math.round((winCount / totalGames) * 100);
}

// ─── Result display (mirrors EndedView in DebatePage) ──────────

const RANK_BADGE = ['🥇', '🥈', '🥉', '4위'];
const SCORE_CRITERIA: { key: 'logic' | 'evidence' | 'persuasion' | 'rebuttal'; label: string }[] = [
  { key: 'logic', label: '논리성' }, { key: 'evidence', label: '근거' },
  { key: 'persuasion', label: '설득력' }, { key: 'rebuttal', label: '반론' },
];

function ScoreBar({ value }: { value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ flex: 1, height: '6px', background: 'var(--color-surface-2)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(value / 25) * 100}%`, background: value >= 20 ? 'var(--color-pro)' : value >= 13 ? '#eab308' : 'var(--color-con)', borderRadius: '3px', transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: '12px', minWidth: '22px', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function HistoryResultModal({ item, onClose }: { item: DebateHistoryItem; onClose: () => void }) {
  const result: DebateResult = item.result;
  const winnerLabel = result.winner === 'pro' ? '찬성 팀 승리' : result.winner === 'con' ? '반대 팀 승리' : '무승부';
  const winnerColor = result.winner === 'pro' ? 'var(--color-pro)' : result.winner === 'con' ? 'var(--color-con)' : 'var(--color-text-muted)';
  const sorted = [...(result.scores ?? [])].sort((a, b) => a.rank - b.rank);
  const playerScores = sorted.filter((s) => s.type === 'player');

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', padding: '16px' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '680px', maxHeight: '88vh', overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>{item.topic ?? '주제 없음'}</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{new Date(item.endedAt).toLocaleString('ko-KR')}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--color-text-muted)', lineHeight: 1, padding: '2px 6px' }}>✕</button>
        </div>

        {/* Winner */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '6px' }}>⚖️</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: winnerColor }}>{winnerLabel}</div>
        </div>

        {/* Summary */}
        {result.summary && (
          <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '14px 18px', fontSize: '13px', lineHeight: 1.8 }}>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>AI 총평</div>
            {result.summary}
          </div>
        )}

        {/* Score table */}
        {sorted.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '10px' }}>참가자별 점수 (100점 만점)</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['순위', '참가자', '논리성', '근거', '설득력', '반론', '합계'].map((h) => (
                    <th key={h} style={{ padding: '8px 10px', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: h === '참가자' || h === '순위' ? 'left' : 'center', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => {
                  const sideColor = s.vote === 'pro' ? 'var(--color-pro)' : 'var(--color-con)';
                  return (
                    <tr key={s.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 10px', fontSize: '16px' }}>{RANK_BADGE[s.rank - 1] ?? s.rank}</td>
                      <td style={{ padding: '10px 10px' }}><span style={{ fontWeight: 600, color: sideColor }}>{s.name}</span>{s.type === 'player' && <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginLeft: '4px' }}>P</span>}</td>
                      {SCORE_CRITERIA.map(({ key }) => (
                        <td key={key} style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 600 }}>
                          <span style={{ color: s[key] >= 20 ? 'var(--color-pro)' : s[key] >= 13 ? '#eab308' : 'var(--color-con)' }}>{s[key]}</span>
                        </td>
                      ))}
                      <td style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 700, fontSize: '15px', color: sideColor }}>{s.total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Score bar cards */}
        {sorted.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            {sorted.map((s) => {
              const sideColor = s.vote === 'pro' ? 'var(--color-pro)' : 'var(--color-con)';
              return (
                <div key={s.name} style={{ background: s.vote === 'pro' ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${s.vote === 'pro' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`, borderRadius: 'var(--radius-md)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: sideColor }}>{RANK_BADGE[s.rank - 1]} {s.name}</span>
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>{s.total}점</span>
                  </div>
                  {SCORE_CRITERIA.map(({ key, label }) => (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{label}</span>
                      <ScoreBar value={s[key]} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Advice */}
        {playerScores.filter((s) => s.advice).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>플레이어 개인 조언</div>
            {playerScores.filter((s) => s.advice).map((s) => (
              <div key={s.name} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: s.vote === 'pro' ? 'var(--color-pro)' : 'var(--color-con)', marginBottom: '6px' }}>{s.name}에게</div>
                <p style={{ fontSize: '13px', lineHeight: 1.7, margin: 0 }}>{s.advice}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MyPage ────────────────────────────────────────────────────

export function MyPage() {
  const { user } = useAuthStore();
  const history = useDebateHistoryStore((s) => s.items);
  const [selected, setSelected] = useState<DebateHistoryItem | null>(null);

  const displayName = user?.name ?? user?.username ?? user?.email ?? '사용자';
  const stats = user?.stats;
  const recentHistory = useMemo(() => history.slice(0, 12), [history]);

  return (
    <div className="page">
      {selected && <HistoryResultModal item={selected} onClose={() => setSelected(null)} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page__title" style={{ marginBottom: '8px' }}>마이페이지</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>{displayName}님의 토론 기록과 등급을 한눈에 볼 수 있습니다.</p>
        </div>
        <Link className="btn btn--ghost" to="/">로비로 돌아가기</Link>
      </div>

      <div className="mypage-grid">
        <section className="card">
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>현재 등급</div>
          <div style={{ fontSize: '32px', fontWeight: 800, marginBottom: '10px' }}>{stats?.tier ?? '게스트'}</div>
          <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
            {stats ? '랭크 포인트와 전적은 로그인 계정 기준으로 누적됩니다.' : '로그인하면 계정 기반 등급과 전적을 함께 관리할 수 있습니다.'}
          </p>
        </section>

        <section className="card">
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>핵심 지표</div>
          <div className="mypage-stats-grid">
            <div className="mypage-stat-box">
              <span>랭크 포인트</span>
              <strong>{stats?.rank_point?.toLocaleString() ?? '-'}</strong>
            </div>
            <div className="mypage-stat-box">
              <span>총 토론 수</span>
              <strong>{stats?.total_games ?? recentHistory.length}</strong>
            </div>
            <div className="mypage-stat-box">
              <span>승리 수</span>
              <strong>{stats?.win_count ?? '-'}</strong>
            </div>
            <div className="mypage-stat-box">
              <span>승률</span>
              <strong>{stats ? `${winRate(stats.win_count, stats.total_games)}%` : '-'}</strong>
            </div>
          </div>
        </section>
      </div>

      <section className="card" style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800 }}>이전 토론 기록</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              기록을 클릭하면 상세 결과표를 볼 수 있습니다.
            </div>
          </div>
          <span className="badge badge--participant">{recentHistory.length}개 기록</span>
        </div>

        {recentHistory.length === 0 ? (
          <div style={{ color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
            아직 저장된 토론 기록이 없습니다. 토론이 끝나면 이곳에 자동으로 쌓입니다.
          </div>
        ) : (
          <div className="mypage-history-list">
            {recentHistory.map((item) => (
              <article
                key={item.id}
                className="mypage-history-card"
                onClick={() => setSelected(item)}
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = ''; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '16px' }}>{item.roomTitle}</div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>{item.topic ?? '주제 정보 없음'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>
                      {item.winner === 'pro' ? '찬성 승리' : item.winner === 'con' ? '반대 승리' : '무승부'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                      {new Date(item.endedAt).toLocaleString('ko-KR')}
                    </div>
                  </div>
                </div>
                <p style={{ margin: 0, color: 'var(--color-text)', lineHeight: 1.8 }}>{item.summary}</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px', alignItems: 'center' }}>
                  {item.mySide && <span className={`badge badge--${item.mySide}`}>내 진영: {item.mySide === 'pro' ? '찬성' : '반대'}</span>}
                  <span className="badge badge--ai">참가자 {item.result.scores.length}명</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>클릭하여 결과표 보기 →</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
