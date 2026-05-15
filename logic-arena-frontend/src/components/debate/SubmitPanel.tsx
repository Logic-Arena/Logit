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
    const delay = phaseEndAt - Date.now();
    const fire = () => {
      const trimmed = textRef.current.trim();
      if (trimmed || optional) {
        socket.emit('submit_content', { roomId, text: trimmed, skip: optional && !trimmed });
        setSubmitted(true);
      }
    };
    if (delay <= 0) { fire(); return; }
    const id = setTimeout(fire, delay);
    return () => clearTimeout(id);
  }, [phaseEndAt, submitted, alreadySubmitted, optional, roomId]);

  if (submitted || alreadySubmitted) {
    return (
      <div
        style={{
          background: 'rgba(34,197,94,0.08)',
          border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
        }}
      >
        <div style={{ fontSize: '11px', color: 'var(--color-pro)', fontWeight: 600, marginBottom: '6px' }}>
          제출 완료
        </div>
        {submittedText ? (
          <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--color-text)', margin: 0 }}>{submittedText}</p>
        ) : (
          <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--color-text-muted)', margin: 0 }}>
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
          background: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
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
          e.currentTarget.style.borderColor = 'var(--color-primary)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-border)';
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
