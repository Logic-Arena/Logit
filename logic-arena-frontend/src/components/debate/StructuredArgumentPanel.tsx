import { useEffect, useRef, useState } from 'react';
import { socket } from '../../lib/socket';

interface Props {
  roomId: string;
  alreadySubmitted?: boolean;
  submittedText?: string | null;
  phaseEndAt?: number | null;
}

interface ArgumentSections {
  claim: string;
  evidence: string;
  explanation: string;
  counterArgument: string;
  rebuttal: string;
}

const SECTION_CONFIG = [
  {
    key: 'claim' as const,
    label: '① 나의 주장',
    placeholder: '저는 ___에 찬성/반대합니다',
    minLength: 10,
  },
  {
    key: 'evidence' as const,
    label: '② 핵심 근거',
    placeholder: '그 이유는 ___이기 때문입니다',
    minLength: 10,
  },
  {
    key: 'explanation' as const,
    label: '③ 근거 설명 (예시)',
    placeholder: '예를 들어 ___한 상황을 생각해볼 수 있습니다',
    minLength: 10,
  },
  {
    key: 'counterArgument' as const,
    label: '④ 예상 반론',
    placeholder: '상대는 ___라고 주장할 수 있습니다',
    minLength: 10,
  },
  {
    key: 'rebuttal' as const,
    label: '⑤ 반론에 대한 답변',
    placeholder: '하지만 ___라는 점에서 제 주장이 더 타당합니다',
    minLength: 10,
  },
];

export function StructuredArgumentPanel({
  roomId,
  alreadySubmitted = false,
  submittedText = null,
  phaseEndAt = null,
}: Props) {
  const [sections, setSections] = useState<ArgumentSections>({
    claim: '',
    evidence: '',
    explanation: '',
    counterArgument: '',
    rebuttal: '',
  });
  const [submitted, setSubmitted] = useState(alreadySubmitted);
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  useEffect(() => {
    if (!phaseEndAt || submitted || alreadySubmitted) return;
    const delay = phaseEndAt - Date.now();
    const fire = () => {
      const combined = combineSections(sectionsRef.current);
      if (combined.trim()) {
        socket.emit('submit_content', {
          roomId,
          text: combined,
          // 향후 백엔드 스키마 확장 시 구조화 데이터 전송
          // structured: sectionsRef.current,
        });
        setSubmitted(true);
      }
    };
    if (delay <= 0) { fire(); return; }
    const id = setTimeout(fire, delay);
    return () => clearTimeout(id);
  }, [phaseEndAt, submitted, alreadySubmitted, roomId]);

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
          <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#fff', margin: 0, fontWeight: 500, whiteSpace: 'pre-wrap' }}>
            {submittedText}
          </p>
        ) : (
          <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'rgba(255,255,255,0.85)', margin: 0 }}>
            입력 없이 이 단계를 넘겼습니다.
          </p>
        )}
      </div>
    );
  }

  const combineSections = (s: ArgumentSections): string => {
    return [
      s.claim && `【주장】 ${s.claim}`,
      s.evidence && `【근거】 ${s.evidence}`,
      s.explanation && `【예시】 ${s.explanation}`,
      s.counterArgument && `【예상 반론】 ${s.counterArgument}`,
      s.rebuttal && `【재반론】 ${s.rebuttal}`,
    ].filter(Boolean).join('\n\n');
  };

  const handleSubmit = () => {
    const combined = combineSections(sections);
    if (!combined.trim()) return;

    socket.emit('submit_content', {
      roomId,
      text: combined,
      // 향후 백엔드 스키마 확장 시 구조화 데이터 전송
      // structured: sections,
    });
    setSubmitted(true);
  };

  const updateSection = (key: keyof ArgumentSections, value: string) => {
    setSections(prev => ({ ...prev, [key]: value }));
  };

  const isValid = SECTION_CONFIG.every(
    ({ key, minLength }) => sections[key].trim().length >= minLength
  );

  const getInvalidSections = (): string[] => {
    return SECTION_CONFIG
      .filter(({ key, minLength }) => sections[key].trim().length < minLength)
      .map(({ label }) => label);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>입론 작성 (5단계 구조화)</span>
        <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
          각 항목 최소 10자 이상
        </span>
      </div>

      {SECTION_CONFIG.map(({ key, label, placeholder, minLength }) => {
        const currentLength = sections[key].trim().length;
        const isInvalid = currentLength > 0 && currentLength < minLength;

        return (
          <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--color-text)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span>{label}</span>
              <span style={{
                fontSize: '10px',
                fontWeight: 500,
                color: isInvalid ? 'var(--color-con)' : 'var(--color-text-muted)',
              }}>
                {currentLength}/{minLength}자
              </span>
            </label>
            <textarea
              style={{
                background: 'linear-gradient(180deg, rgba(106, 201, 130, 0.15) 0%, rgba(82, 160, 104, 0.2) 100%)',
                border: `1px solid ${isInvalid ? 'var(--color-con)' : 'rgba(82, 160, 104, 0.3)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                color: 'var(--color-text)',
                resize: 'vertical',
                minHeight: '60px',
                outline: 'none',
                lineHeight: 1.6,
                fontSize: '13px',
                fontFamily: 'inherit',
                transition: 'border-color var(--transition)',
              }}
              placeholder={placeholder}
              value={sections[key]}
              onChange={(e) => updateSection(key, e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-pro)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = isInvalid ? 'var(--color-con)' : 'rgba(82, 160, 104, 0.3)';
              }}
            />
          </div>
        );
      })}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
          {!isValid ? (
            <>
              부족한 항목: <span style={{ color: 'var(--color-con)', fontWeight: 600 }}>
                {getInvalidSections().join(', ')}
              </span>
            </>
          ) : (
            '모든 항목이 채워졌습니다. 제출하면 다음 단계로 진행됩니다.'
          )}
        </div>
        <button
          className="btn btn--primary"
          disabled={!isValid}
          onClick={handleSubmit}
          style={{
            alignSelf: 'flex-end',
            opacity: isValid ? 1 : 0.5,
            cursor: isValid ? 'pointer' : 'not-allowed',
          }}
        >
          제출하기
        </button>
      </div>
    </div>
  );
}