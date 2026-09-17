import { useEffect, useRef, useState } from 'react';
import { socket } from '../../lib/socket';

interface Props {
  roomId: string;
  label?: string;
  placeholder?: string;
  alreadySubmitted?: boolean;
  submittedText?: string | null;
  optional?: boolean;
  submitText?: string;
  skipText?: string;
  phaseEndAt?: number | null;
}

export function SubmitPanel({
  roomId,
  label = '내용 제출',
  placeholder = '내용을 입력해 주세요.',
  alreadySubmitted = false,
  submittedText = null,
  optional = false,
  submitText = '제출하기',
  skipText = '건너뛰기',
  phaseEndAt = null,
}: Props) {
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(alreadySubmitted);
  const textRef = useRef('');
  textRef.current = text;

  useEffect(() => {
    if (!phaseEndAt || submitted || alreadySubmitted) return;
    // 서버도 phaseEndAt과 같은 시각에 독립적으로 다음 단계로 강제 전환하는 타이머를 갖고 있다.
    // 클라이언트 제출이 그보다 늦게 도착하면 서버가 이미 다음 단계로 넘어간 뒤라 이 제출이
    // 거부되거나 엉뚱한 단계의 값으로 저장돼 "작성한 내용이 빈칸으로 제출"된 것처럼 보인다.
    // 약간 앞당겨 보내 서버 자체 타이머보다 먼저 도착하게 한다(도착 즉시 서버가 자체 타이머를 취소함).
    const CLIENT_SUBMIT_LEAD_MS = 400;
    const delay = phaseEndAt - Date.now() - CLIENT_SUBMIT_LEAD_MS;
    const fire = () => {
      // 시간 초과 시에는 내용이 비어 있어도(optional 여부와 무관하게) 반드시 제출해
      // 다음 단계로 넘어가야 한다 — 그렇지 않으면 진행이 영구히 멈춘다.
      const trimmed = textRef.current.trim();
      socket.emit('submit_content', { roomId, text: trimmed, skip: !trimmed });
      setSubmitted(true);
    };
    if (delay <= 0) { fire(); return; }
    const id = setTimeout(fire, delay);
    return () => clearTimeout(id);
  }, [phaseEndAt, submitted, alreadySubmitted, optional, roomId]);

  if (submitted || alreadySubmitted) {
    return (
      <div
        style={{
          background: 'linear-gradient(180deg, #6AC982 0%, #52A068 100%)',
          border: '1px solid rgba(82,160,104,0.4)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
        }}
      >
        <div style={{ fontSize: '11px', color: '#fff', fontWeight: 700, marginBottom: '6px', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
          제출 완료
        </div>
        {submittedText ? (
          <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#fff', margin: 0, fontWeight: 500 }}>{submittedText}</p>
        ) : (
          <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'rgba(255,255,255,0.85)', margin: 0 }}>
            입력 없이 이 단계를 넘겼습니다.
          </p>
        )}
      </div>
    );
  }

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed && !optional) return;
    socket.emit('submit_content', { roomId, text: trimmed, skip: optional && !trimmed });
    setSubmitted(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{label}</label>
      <textarea
        style={{
          background: 'linear-gradient(180deg, rgba(106, 201, 130, 0.15) 0%, rgba(82, 160, 104, 0.2) 100%)',
          border: '1px solid rgba(82, 160, 104, 0.3)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 14px',
          color: 'var(--color-text)',
          resize: 'vertical',
          minHeight: '120px',
          outline: 'none',
          lineHeight: 1.7,
          fontSize: '14px',
          fontFamily: 'inherit',
          transition: 'border-color var(--transition)',
        }}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-pro)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'rgba(82, 160, 104, 0.3)';
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
          {optional ? '비워 두면 그대로 넘길 수 있습니다.' : '작성 후 제출하면 다음 단계로 진행됩니다.'}
        </span>
        <button
          className="btn btn--primary"
          disabled={!text.trim() && !optional}
          onClick={handleSubmit}
          style={{ alignSelf: 'flex-end' }}
        >
          {optional && !text.trim() ? skipText : submitText}
        </button>
      </div>
    </div>
  );
}
