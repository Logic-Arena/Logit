import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { socket } from '../lib/socket';
import { useSocket } from '../hooks/useSocket';
import { useRoomEvents } from '../hooks/useRoomEvents';
import { useRoomStore } from '../store/useRoomStore';
import { useUserStore } from '../store/useUserStore';
import { PhaseTimer } from '../components/debate/PhaseTimer';
import { SubmitPanel } from '../components/debate/SubmitPanel';
import type { Room, Phase, PlayerRole, RoomContent } from '../types/room';

// ─── 상수 ──────────────────────────────────────────────────────

const PHASE_LABELS: Record<Phase, string> = {
  waiting: '대기 중',
  topic_selection: '주제 선택 & 진영 배정',
  arguing: '주장 단계',
  pro_p_rebuttal: '찬성P 반론',
  pro_p_defense: '반대P 변론',
  pro_p_counter: '찬성P 재반론',
  con_p_rebuttal: '반대P 반론',
  con_p_defense: '찬성P 변론',
  con_p_counter: '반대P 재반론',
  pro_a_rebuttal: '찬성AI 반론 (자동)',
  pro_a_defense: '반대P 변론 (vs 찬성AI)',
  pro_a_counter: '찬성AI 재반론 (자동)',
  con_a_rebuttal: '반대AI 반론 (자동)',
  con_a_defense: '찬성P 변론 (vs 반대AI)',
  con_a_counter: '반대AI 재반론 (자동)',
  coaching: 'AI 훈수 (자동)',
  final_argument: '최종 변론',
  judging: 'AI 판정 중',
  ended: '토론 종료',
};

const PHASE_SUBMIT_MAP: Partial<Record<Phase, Partial<Record<PlayerRole, keyof RoomContent>>>> = {
  arguing:         { pro_player: 'pro_argument',        con_player: 'con_argument' },
  pro_p_rebuttal:  { pro_player: 'pro_p_rebuttal' },
  pro_p_defense:   { con_player: 'pro_p_defense_player' },
  pro_p_counter:   { pro_player: 'pro_p_counter' },
  con_p_rebuttal:  { con_player: 'con_p_rebuttal' },
  con_p_defense:   { pro_player: 'con_p_defense_player' },
  con_p_counter:   { con_player: 'con_p_counter' },
  pro_a_defense:   { con_player: 'pro_a_defense_player' },
  con_a_defense:   { pro_player: 'con_a_defense_player' },
  final_argument:  { pro_player: 'pro_final',            con_player: 'con_final' },
};

const PHASE_ACTIVE_ROLE: Partial<Record<Phase, string>> = {
  arguing:        '양쪽 플레이어 · 주장 작성 중',
  pro_p_rebuttal: '찬성P 차례',
  pro_p_defense:  '반대P 차례',
  pro_p_counter:  '찬성P 차례',
  con_p_rebuttal: '반대P 차례',
  con_p_defense:  '찬성P 차례',
  con_p_counter:  '반대P 차례',
  pro_a_defense:  '반대P 차례 (선택)',
  con_a_defense:  '찬성P 차례 (선택)',
  final_argument: '양쪽 플레이어 · 최종 변론',
};

type AlignSide = 'pro' | 'con';
type BubbleVariant = 'player' | 'ai' | 'coach';

const CONTENT_FLOW: Array<{
  key: keyof RoomContent; author: string; align: AlignSide; variant: BubbleVariant;
}> = [
  { key: 'pro_argument',          author: '찬성 플레이어', align: 'pro', variant: 'player' },
  { key: 'con_argument',          author: '반대 플레이어', align: 'con', variant: 'player' },
  { key: 'pro_ai_argument',       author: '찬성 AI',       align: 'pro', variant: 'ai' },
  { key: 'con_ai_argument',       author: '반대 AI',       align: 'con', variant: 'ai' },
  { key: 'pro_p_rebuttal',        author: '찬성 플레이어', align: 'pro', variant: 'player' },
  { key: 'pro_p_defense_player',  author: '반대 플레이어', align: 'con', variant: 'player' },
  { key: 'pro_p_defense_ai',      author: '반대 AI',       align: 'con', variant: 'ai' },
  { key: 'pro_p_counter',         author: '찬성 플레이어', align: 'pro', variant: 'player' },
  { key: 'con_p_rebuttal',        author: '반대 플레이어', align: 'con', variant: 'player' },
  { key: 'con_p_defense_player',  author: '찬성 플레이어', align: 'pro', variant: 'player' },
  { key: 'con_p_defense_ai',      author: '찬성 AI',       align: 'pro', variant: 'ai' },
  { key: 'con_p_counter',         author: '반대 플레이어', align: 'con', variant: 'player' },
  { key: 'pro_a_rebuttal',        author: '찬성 AI',       align: 'pro', variant: 'ai' },
  { key: 'pro_a_defense_player',  author: '반대 플레이어', align: 'con', variant: 'player' },
  { key: 'pro_a_defense_ai',      author: '반대 AI',       align: 'con', variant: 'ai' },
  { key: 'pro_a_counter',         author: '찬성 AI',       align: 'pro', variant: 'ai' },
  { key: 'con_a_rebuttal',        author: '반대 AI',       align: 'con', variant: 'ai' },
  { key: 'con_a_defense_player',  author: '찬성 플레이어', align: 'pro', variant: 'player' },
  { key: 'con_a_defense_ai',      author: '찬성 AI',       align: 'pro', variant: 'ai' },
  { key: 'con_a_counter',         author: '반대 AI',       align: 'con', variant: 'ai' },
  { key: 'coaching_pro',          author: '훈수 AI (찬성P)', align: 'pro', variant: 'coach' },
  { key: 'coaching_con',          author: '훈수 AI (반대P)', align: 'con', variant: 'coach' },
  { key: 'pro_final',             author: '찬성 플레이어', align: 'pro', variant: 'player' },
  { key: 'con_final',             author: '반대 플레이어', align: 'con', variant: 'player' },
];

const CONTENT_LABELS: Partial<Record<keyof RoomContent, string>> = {
  pro_argument: '최초 주장', con_argument: '최초 주장',
  pro_ai_argument: 'AI 주장', con_ai_argument: 'AI 주장',
  pro_p_rebuttal: '반론', pro_p_defense_player: '변론', pro_p_defense_ai: 'AI 변론', pro_p_counter: '재반론',
  con_p_rebuttal: '반론', con_p_defense_player: '변론', con_p_defense_ai: 'AI 변론', con_p_counter: '재반론',
  pro_a_rebuttal: 'AI 반론', pro_a_defense_player: '변론 (vs AI)', pro_a_defense_ai: 'AI 변론', pro_a_counter: 'AI 재반론',
  con_a_rebuttal: 'AI 반론', con_a_defense_player: '변론 (vs AI)', con_a_defense_ai: 'AI 변론', con_a_counter: 'AI 재반론',
  coaching_pro: '훈수 (찬성P)', coaching_con: '훈수 (반대P)', pro_final: '최종 변론', con_final: '최종 변론',
};

const SUBMIT_LABELS: Partial<Record<Phase, string>> = {
  arguing: '내 주장 작성',
  pro_p_rebuttal: '반론 작성 (찬성P)', pro_p_defense: '변론 작성 (반대P)', pro_p_counter: '재반론 작성 (찬성P)',
  con_p_rebuttal: '반론 작성 (반대P)', con_p_defense: '변론 작성 (찬성P)', con_p_counter: '재반론 작성 (반대P)',
  pro_a_defense: '변론 작성 (반대P, 선택사항)', con_a_defense: '변론 작성 (찬성P, 선택사항)',
  final_argument: '최종 변론 작성',
};

const OPTIONAL_PHASES = new Set<Phase>(['pro_a_defense', 'con_a_defense']);
const AUTO_PHASES = new Set<Phase>(['pro_a_rebuttal', 'pro_a_counter', 'con_a_rebuttal', 'con_a_counter', 'coaching', 'judging']);

// ─── 공통 UI ────────────────────────────────────────────────────

function StatusChip({ label, done, isMe }: { label: string; done: boolean; isMe?: boolean }) {
  return (
    <span style={{
      padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 500,
      background: done ? 'rgba(34,197,94,0.12)' : isMe ? 'rgba(108,99,255,0.1)' : 'var(--color-surface-2)',
      color: done ? 'var(--color-pro)' : isMe ? 'var(--color-primary)' : 'var(--color-text-muted)',
      border: `1px solid ${done ? 'rgba(34,197,94,0.3)' : isMe ? 'rgba(108,99,255,0.3)' : 'var(--color-border)'}`,
    }}>
      {done ? '✓' : '⏳'} {label}{isMe ? ' (나)' : ''}
    </span>
  );
}

function NotMyTurnBanner({ message }: { message: string }) {
  return (
    <div style={{
      padding: '12px 16px', borderRadius: 'var(--radius-md)',
      background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
      fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', fontStyle: 'italic',
    }}>
      {message}
    </div>
  );
}

// ─── InitialClaimsBar ───────────────────────────────────────────

function InitialClaimsBar({ content }: { content: Room['content'] }) {
  const [open, setOpen] = useState(false);
  const hasAny = content.pro_argument || content.con_argument || content.pro_ai_argument || content.con_ai_argument;
  if (!hasAny) return null;
  return (
    <div style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 20px', background: 'transparent', border: 'none', cursor: 'pointer',
          fontSize: '12px', color: 'var(--color-text-muted)',
        }}
      >
        <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>최초 주장 보기</span>
        <span style={{ fontSize: '10px', transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none', display: 'inline-block' }}>▼</span>
      </button>
      {open && (
        <div style={{ padding: '0 20px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignItems: 'start' }}>
          {content.pro_argument && (
            <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)' }}>
              <div style={{ fontSize: '10px', color: 'var(--color-pro)', fontWeight: 700, marginBottom: '6px' }}>찬성P 주장</div>
              <div style={{ fontSize: '12px', lineHeight: 1.65, color: 'var(--color-text)' }}>{content.pro_argument}</div>
            </div>
          )}
          {content.con_argument && (
            <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <div style={{ fontSize: '10px', color: 'var(--color-con)', fontWeight: 700, marginBottom: '6px' }}>반대P 주장</div>
              <div style={{ fontSize: '12px', lineHeight: 1.65, color: 'var(--color-text)' }}>{content.con_argument}</div>
            </div>
          )}
          {content.pro_ai_argument && (
            <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.25)' }}>
              <div style={{ fontSize: '10px', color: '#06b6d4', fontWeight: 700, marginBottom: '6px' }}>찬성AI 주장</div>
              <div style={{ fontSize: '12px', lineHeight: 1.65, color: 'var(--color-text)' }}>{content.pro_ai_argument}</div>
            </div>
          )}
          {content.con_ai_argument && (
            <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.25)' }}>
              <div style={{ fontSize: '10px', color: '#06b6d4', fontWeight: 700, marginBottom: '6px' }}>반대AI 주장</div>
              <div style={{ fontSize: '12px', lineHeight: 1.65, color: 'var(--color-text)' }}>{content.con_ai_argument}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── DebateChatView ─────────────────────────────────────────────

function DebateChatView({ room, myRole }: { room: Room; myRole: PlayerRole | null }) {
  const { phase, content } = room;
  const myKey = myRole ? PHASE_SUBMIT_MAP[phase]?.[myRole] : undefined;
  const alreadySubmitted = myKey ? !!content[myKey] : false;
  const mySide: AlignSide | null = myRole === 'pro_player' ? 'pro' : myRole === 'con_player' ? 'con' : null;
  const isAutoPhase = AUTO_PHASES.has(phase);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  });

  const messages = CONTENT_FLOW.flatMap((item) => {
    const text = content[item.key];
    if (!text) return [];
    // During arguing: hide opponent's argument and AI arguments until both humans have submitted
    if (phase === 'arguing') {
      const both = !!(content.pro_argument && content.con_argument);
      if (!both) {
        if (item.key === 'pro_argument' && myRole !== 'pro_player') return [];
        if (item.key === 'con_argument' && myRole !== 'con_player') return [];
        if (item.key === 'pro_ai_argument' || item.key === 'con_ai_argument') return [];
      }
    }
    // 훈수: 플레이어는 자신의 진영 훈수만 표시, 관전자는 둘 다 표시
    if (item.key === 'coaching_pro' && myRole === 'con_player') return [];
    if (item.key === 'coaching_con' && myRole === 'pro_player') return [];
    return [{ ...item, text }];
  });

  const hasSubmitRole = Object.keys(PHASE_SUBMIT_MAP[phase] ?? {}).length > 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Scrollable chat */}
      <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Status chips for arguing / final */}
        {phase === 'arguing' && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <StatusChip label="찬성P" done={!!content.pro_argument} isMe={myRole === 'pro_player'} />
            <StatusChip label="반대P" done={!!content.con_argument} isMe={myRole === 'con_player'} />
            <StatusChip label="찬성AI" done={!!content.pro_ai_argument} />
            <StatusChip label="반대AI" done={!!content.con_ai_argument} />
          </div>
        )}
        {phase === 'final_argument' && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <StatusChip label="찬성P 최종" done={!!content.pro_final} isMe={myRole === 'pro_player'} />
            <StatusChip label="반대P 최종" done={!!content.con_final} isMe={myRole === 'con_player'} />
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: isAutoPhase ? '#67e8f9' : 'var(--color-text-muted)', padding: '40px 0', fontSize: '13px', fontStyle: 'italic' }}>
            {isAutoPhase ? 'AI가 자동으로 생성 중입니다... 잠시 기다려 주세요' : '아직 작성된 내용이 없습니다.'}
          </div>
        )}

        {/* Chat bubbles */}
        {messages.map((item) => (
          <article
            key={item.key}
            className={[
              'debate-bubble',
              `debate-bubble--${item.align}`,
              `debate-bubble--${item.variant}`,
              mySide === item.align ? 'debate-bubble--mine' : '',
            ].filter(Boolean).join(' ')}
          >
            <div className="debate-bubble__meta">
              <strong>{item.author}</strong>
              <span>{CONTENT_LABELS[item.key]}</span>
            </div>
            <div className="debate-bubble__body">
              {(item.key === 'coaching_pro' || item.key === 'coaching_con')
                ? item.text.split(/\n{2,}/).map((para, i) => (
                    <p key={i} style={{ margin: i === 0 ? 0 : '10px 0 0' }}>{para.trim()}</p>
                  ))
                : item.text}
            </div>
          </article>
        ))}
      </div>

      {/* Bottom panel */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--color-border)', padding: '10px 20px', background: 'var(--color-surface)' }}>
        {myKey ? (
          <SubmitPanel
            key={phase}
            roomId={room.id}
            label={SUBMIT_LABELS[phase] ?? '내용 제출'}
            placeholder={phase === 'arguing' ? '논리적으로 주장을 3~5문장으로 작성해 주세요...' : '내용을 입력하세요...'}
            alreadySubmitted={alreadySubmitted}
            submittedText={alreadySubmitted ? content[myKey] : null}
            optional={OPTIONAL_PHASES.has(phase)}
            phaseEndAt={room.phaseEndAt}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '8px 0', fontSize: '13px', color: isAutoPhase ? '#67e8f9' : 'var(--color-text-muted)' }}>
            {isAutoPhase
              ? 'AI가 자동으로 내용을 생성하고 있습니다.'
              : hasSubmitRole
              ? PHASE_ACTIVE_ROLE[phase] ?? '현재는 다른 참가자의 입력 차례입니다.'
              : '잠시 기다려 주세요.'}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Phase 별 뷰 (특수 케이스) ──────────────────────────────────

function WaitingView({ room, myRole: _myRole, mySocketId }: { room: Room; myRole: PlayerRole | null; mySocketId: string }) {
  const isHost = room.host === mySocketId;
  const canStart = !!room.proPlayer && !!room.conPlayer;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>찬성P, 반대P 두 명이 모이면 방장이 게임을 시작합니다.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {[{ label: '플레이어 1 (방장)', player: room.proPlayer }, { label: '플레이어 2', player: room.conPlayer }].map(({ label, player }) => (
          <div key={label} style={{ background: player ? 'var(--color-surface-2)' : 'transparent', border: `1px solid ${player ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-md)', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
            <div style={{ fontWeight: 600, color: player ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{player ? player.username : '대기 중...'}</div>
          </div>
        ))}
      </div>
      {room.observers.length > 0 && <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>관전자 {room.observers.length}명</p>}
      {isHost ? (
        <button className="btn btn--primary" disabled={!canStart} onClick={() => socket.emit('start_game', { roomId: room.id })} style={{ alignSelf: 'flex-start' }}>
          {canStart ? '게임 시작하기' : '플레이어 2명 필요'}
        </button>
      ) : (
        <NotMyTurnBanner message="방장이 게임을 시작할 때까지 기다려 주세요" />
      )}
    </div>
  );
}

function TopicSelectionView({ room, myRole }: { room: Room; myRole: PlayerRole | null }) {
  const [mySelection, setMySelection] = useState<'pro' | 'con' | null>(null);
  const isPlayer = myRole === 'pro_player' || myRole === 'con_player';
  const attempts = room.sideSelectionAttempts;
  useEffect(() => { if (attempts > 0) setMySelection(null); }, [attempts]);
  const handleSelect = (side: 'pro' | 'con') => { setMySelection(side); socket.emit('select_side', { roomId: room.id, side }); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {room.topic ? (
        <div style={{ background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.3)', borderRadius: 'var(--radius-md)', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>토론 주제</div>
          <div style={{ fontSize: '17px', fontWeight: 700, lineHeight: 1.5 }}>{room.topic}</div>
        </div>
      ) : (
        <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
          AI가 주제를 생성 중입니다...
        </div>
      )}
      {isPlayer && !mySelection && !room.topic && (
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
          주제가 확정된 후 진영을 선택할 수 있습니다.
        </p>
      )}
      {isPlayer && !mySelection && !!room.topic && (
        <>
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
            원하는 진영을 선택하세요{attempts > 0 ? ` (충돌 ${attempts}/3회, 다시 선택해 주세요)` : ''}.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {(['pro', 'con'] as const).map((side) => {
              const label = side === 'pro' ? '찬성' : '반대';
              const color = side === 'pro' ? 'var(--color-pro)' : 'var(--color-con)';
              const bg = side === 'pro' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)';
              const border = side === 'pro' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)';
              return (
                <button key={side} onClick={() => handleSelect(side)} style={{ padding: '24px', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '18px', background: bg, border: `2px solid ${border}`, color, cursor: 'pointer' }}
                  onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.3)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
                >{label}</button>
              );
            })}
          </div>
        </>
      )}
      {isPlayer && mySelection && (
        <div style={{ padding: '20px', borderRadius: 'var(--radius-md)', textAlign: 'center', background: mySelection === 'pro' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `2px solid ${mySelection === 'pro' ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'}` }}>
          <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px', color: mySelection === 'pro' ? 'var(--color-pro)' : 'var(--color-con)' }}>{mySelection === 'pro' ? '찬성' : '반대'} 선택 완료</div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>상대방 선택을 기다리는 중...</div>
        </div>
      )}
      {!isPlayer && <NotMyTurnBanner message="플레이어들이 진영을 선택 중입니다..." />}
    </div>
  );
}

// ─── 결과 화면 ──────────────────────────────────────────────────

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

function EndedView({ room }: { room: Room }) {
  const result = room.result;
  const navigate = useNavigate();
  if (!result) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', paddingTop: '40px' }}>
      <p style={{ color: 'var(--color-text-muted)' }}>결과를 불러올 수 없습니다.</p>
      <button className="btn btn--ghost" onClick={() => navigate('/')}>로비로 돌아가기</button>
    </div>
  );
  const winnerLabel = result.winner === 'pro' ? '찬성 팀 승리' : result.winner === 'con' ? '반대 팀 승리' : '무승부';
  const winnerColor = result.winner === 'pro' ? 'var(--color-pro)' : result.winner === 'con' ? 'var(--color-con)' : 'var(--color-text-muted)';
  const sorted = [...(result.scores ?? [])].sort((a, b) => a.rank - b.rank);
  const playerScores = sorted.filter((s) => s.type === 'player');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      <div style={{ textAlign: 'center', paddingTop: '16px' }}>
        <div style={{ fontSize: '40px', marginBottom: '8px' }}>⚖️</div>
        <div style={{ fontSize: '24px', fontWeight: 700, color: winnerColor }}>{winnerLabel}</div>
      </div>
      {result.summary && (
        <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '16px 20px', fontSize: '14px', lineHeight: 1.8 }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>AI 총평</div>
          {result.summary}
        </div>
      )}
      {sorted.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '10px' }}>참가자별 점수 (100점 만점)</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['순위', '참가자', '논리성', '근거', '설득력', '반론', '합계'].map((h) => (
                  <th key={h} style={{ padding: '8px 12px', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: h === '참가자' || h === '순위' ? 'left' : 'center', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => {
                const sideColor = s.vote === 'pro' ? 'var(--color-pro)' : 'var(--color-con)';
                return (
                  <tr key={s.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 12px', fontSize: '16px' }}>{RANK_BADGE[s.rank - 1] ?? s.rank}</td>
                    <td style={{ padding: '10px 12px' }}><span style={{ fontWeight: 600, color: sideColor }}>{s.name}</span>{s.type === 'player' && <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginLeft: '4px' }}>P</span>}</td>
                    {SCORE_CRITERIA.map(({ key }) => (
                      <td key={key} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>
                        <span style={{ color: s[key] >= 20 ? 'var(--color-pro)' : s[key] >= 13 ? '#eab308' : 'var(--color-con)' }}>{s[key]}</span>
                      </td>
                    ))}
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, fontSize: '15px', color: sideColor }}>{s.total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {sorted.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {sorted.map((s) => {
            const sideColor = s.vote === 'pro' ? 'var(--color-pro)' : 'var(--color-con)';
            return (
              <div key={s.name} style={{ background: s.vote === 'pro' ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${s.vote === 'pro' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`, borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: sideColor }}>{RANK_BADGE[s.rank - 1]} {s.name}</span>
                  <span style={{ fontWeight: 700, fontSize: '15px' }}>{s.total}점</span>
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
      {playerScores.filter((s) => s.advice).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>플레이어 개인 조언</div>
          {playerScores.filter((s) => s.advice).map((s) => (
            <div key={s.name} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: s.vote === 'pro' ? 'var(--color-pro)' : 'var(--color-con)', marginBottom: '6px' }}>{s.name}에게</div>
              <p style={{ fontSize: '13px', lineHeight: 1.7, margin: 0 }}>{s.advice}</p>
            </div>
          ))}
        </div>
      )}
      <button className="btn btn--ghost" onClick={() => navigate('/')} style={{ alignSelf: 'center' }}>로비로 돌아가기</button>
    </div>
  );
}

// ─── 사이드바 ───────────────────────────────────────────────────

function PlayerSlot({ player, role, myRole, mySocketId }: {
  player: { socketId: string; username: string } | null;
  role: PlayerRole; myRole: PlayerRole | null; mySocketId: string;
}) {
  const isMe = (player?.socketId === mySocketId) || (myRole === role && !player);
  return (
    <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontWeight: 500, background: player ? 'var(--color-surface-2)' : 'transparent', border: `1px solid ${isMe ? 'var(--color-primary)' : player ? 'var(--color-border)' : 'rgba(255,255,255,0.05)'}`, color: player ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
      {!player ? '(대기 중)' : isMe ? `나 (${player.username})` : player.username}
    </div>
  );
}

function DebateSidebar({ room, myRole, mySocketId, sidebarOpen, onClose }: {
  room: Room; myRole: PlayerRole | null; mySocketId: string; sidebarOpen: boolean; onClose: () => void;
}) {
  return (
    <>
      <div className={`sidebar-backdrop${sidebarOpen ? ' is-open' : ''}`} onClick={onClose} />
      <div className={`debate-sidebar${sidebarOpen ? ' is-open' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#06b6d4', boxShadow: '0 0 6px #06b6d4', display: 'block', flexShrink: 0 }} />
          <span style={{ fontSize: '11px', fontWeight: 500, color: '#06b6d4' }}>AI 대전 모드</span>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-pro)', textTransform: 'uppercase', letterSpacing: '0.6px', padding: '8px 4px 4px' }}>찬성 팀</div>
          <PlayerSlot player={room.proPlayer} role="pro_player" myRole={myRole} mySocketId={mySocketId} />
          <div style={{ fontSize: '11px', color: '#06b6d4', padding: '6px 10px', background: 'rgba(6,182,212,0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(6,182,212,0.2)' }}>찬성AI</div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-con)', textTransform: 'uppercase', letterSpacing: '0.6px', padding: '12px 4px 4px' }}>반대 팀</div>
          <PlayerSlot player={room.conPlayer} role="con_player" myRole={myRole} mySocketId={mySocketId} />
          <div style={{ fontSize: '11px', color: '#06b6d4', padding: '6px 10px', background: 'rgba(6,182,212,0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(6,182,212,0.2)' }}>반대AI</div>
          {room.observers.length > 0 && (
            <>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', padding: '12px 4px 4px' }}>관전자 ({room.observers.length})</div>
              {room.observers.map((o) => (
                <div key={o.socketId} style={{ fontSize: '12px', color: 'var(--color-text-muted)', padding: '4px 6px' }}>
                  {o.socketId === mySocketId ? `나 (${o.username})` : o.username}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── 메인 DebatePage ────────────────────────────────────────────

interface LocationState { password?: string }

const DEBATE_PHASES = new Set<Phase>([
  'arguing', 'pro_p_rebuttal', 'pro_p_defense', 'pro_p_counter',
  'con_p_rebuttal', 'con_p_defense', 'con_p_counter',
  'pro_a_rebuttal', 'pro_a_defense', 'pro_a_counter',
  'con_a_rebuttal', 'con_a_defense', 'con_a_counter',
  'coaching', 'final_argument',
]);

export function DebatePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user: currentUser } = useUserStore();
  const userId = currentUser?.id;
  const username = currentUser?.name;
  const { room, myRole, mySocketId, resetRoom } = useRoomStore();
  const didJoin = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useSocket();
  useRoomEvents();

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = socket as any;
    const handlePreJoinError = ({ message }: { message: string }) => {
      if (!useRoomStore.getState().room) setJoinError(message);
    };
    s.on('error', handlePreJoinError);
    return () => s.off('error', handlePreJoinError);
  }, []);

  useEffect(() => {
    if (!roomId || !username) { navigate(`/rooms/${roomId}`, { replace: true }); return; }
    const { password } = (location.state as LocationState) ?? {};
    socket.connect();
    const onConnect = () => {
      if (didJoin.current) return;
      didJoin.current = true;
      socket.emit('join_room', { roomId, userId, username, password: password ?? undefined });
    };
    socket.on('connect', onConnect);

    if (socket.connected && !didJoin.current) {
      didJoin.current = true;
      socket.emit('join_room', { roomId, userId, username, password: password ?? undefined });
    }

    return () => {
      socket.off('connect', onConnect);
      socket.emit('leave_room');
      resetRoom();
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (joinError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px' }}>
        <div style={{ fontSize: '36px' }}>🚫</div>
        <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-danger)' }}>{joinError}</p>
        <button className="btn btn--ghost" onClick={() => navigate(`/rooms/${roomId}`)}>다시 입장하기</button>
        <button className="btn btn--ghost" onClick={() => navigate('/')}>로비로 돌아가기</button>
      </div>
    );
  }

  if (!room) return <div className="loading">방에 접속 중...</div>;

  const { phase } = room;
  const showTopicBanner = !!room.topic && phase !== 'waiting' && phase !== 'topic_selection';
  const showInitialClaims = !!(room.content.pro_argument && room.content.con_argument) && phase !== 'waiting' && phase !== 'topic_selection';
  const isDebatePhase = DEBATE_PHASES.has(phase);

  return (
    <div className="debate-page">
      <DebateSidebar room={room} myRole={myRole} mySocketId={mySocketId} sidebarOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="debate-main">
        {/* Mobile header */}
        <div className="debate-mobile-header">
          <button className="sidebar-toggle-btn" onClick={() => setSidebarOpen(v => !v)}>참가자</button>
          {room.topic && <span className="debate-mobile-header__topic">{room.topic}</span>}
        </div>

        {/* Phase header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', flexShrink: 0, gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{room.title}</span>
            <span style={{ fontSize: '15px', fontWeight: 700 }}>{PHASE_LABELS[phase]}</span>
          </div>
          <PhaseTimer phaseEndAt={room.phaseEndAt} />
        </div>

        {/* Prominent topic banner */}
        {showTopicBanner && (
          <div style={{ padding: '10px 20px', background: 'rgba(108,99,255,0.08)', borderBottom: '1px solid rgba(108,99,255,0.2)', flexShrink: 0 }}>
            <div style={{ fontSize: '10px', color: 'var(--color-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>토론 주제</div>
            <div style={{ fontSize: '15px', fontWeight: 700, lineHeight: 1.4 }}>{room.topic}</div>
          </div>
        )}

        {/* Initial claims accordion */}
        {showInitialClaims && <InitialClaimsBar content={room.content} />}

        {/* Main content */}
        {isDebatePhase ? (
          <DebateChatView room={room} myRole={myRole} />
        ) : phase === 'judging' ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
            <div style={{ fontSize: '56px' }}>⚖️</div>
            <p style={{ fontSize: '17px', fontWeight: 700 }}>AI가 토론을 분석하고 있습니다...</p>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>잠시만 기다려 주세요</p>
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
            {phase === 'waiting' && <WaitingView room={room} myRole={myRole} mySocketId={mySocketId} />}
            {phase === 'topic_selection' && <TopicSelectionView room={room} myRole={myRole} />}
            {phase === 'ended' && <EndedView room={room} />}
          </div>
        )}
      </div>
    </div>
  );
}
