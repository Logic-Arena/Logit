import { useEffect, useRef, useState } from 'react';
import { socket } from '../../lib/socket';
import type { VoteOption } from '../../types/room';

export interface EssayFeedback {
  claim?: string;
  evidence?: string;
  example?: string;
  counterArgument?: string;
  rebuttal?: string;
  overall?: string;
}

type FeedbackKey = keyof EssayFeedback;

interface Props {
  roomId: string;
  alreadySubmitted?: boolean;
  submittedText?: string | null;
  phaseEndAt?: number | null;
  initialSections?: ArgumentSections;
  submitLabel?: string;
  stance?: VoteOption | null;
  // 있으면 각 카드 안에 해당 항목의 AI 피드백을 함께 표시한다 (퇴고 단계에서만 전달됨).
  feedback?: EssayFeedback | null;
}

interface ArgumentSections {
  claim: string;
  evidence: string;
  explanation: string;
  counterArgument: string;
  rebuttal: string;
}

// 백엔드(openai.js generateSoloFeedback)가 AI 호출/파싱에 실패했을 때 채워 넣는 안내 문구의 접두사.
const FAILURE_PREFIX = '피드백을 불러오지 못했어요';

const SECTION_CONFIG: {
  key: keyof ArgumentSections;
  feedbackKey: FeedbackKey;
  label: string;
  placeholder: string;
  minLength: number;
}[] = [
  { key: 'claim', feedbackKey: 'claim', label: '① 나의 주장', placeholder: '저는 ___에 찬성/반대합니다', minLength: 10 },
  { key: 'evidence', feedbackKey: 'evidence', label: '② 핵심 근거', placeholder: '그 이유는 ___이기 때문입니다', minLength: 10 },
  { key: 'explanation', feedbackKey: 'example', label: '③ 근거 설명 (예시)', placeholder: '예를 들어 ___한 상황을 생각해볼 수 있습니다', minLength: 10 },
  { key: 'counterArgument', feedbackKey: 'counterArgument', label: '④ 예상 반론', placeholder: '상대는 ___라고 주장할 수 있습니다', minLength: 10 },
  { key: 'rebuttal', feedbackKey: 'rebuttal', label: '⑤ 반론에 대한 답변', placeholder: '하지만 ___라는 점에서 제 주장이 더 타당합니다', minLength: 10 },
];

export function StructuredArgumentPanel({
  roomId,
  alreadySubmitted = false,
  submittedText = null,
  phaseEndAt = null,
  initialSections,
  submitLabel = '제출하기',
  stance = null,
  feedback = null,
}: Props) {
  const [sections, setSections] = useState<ArgumentSections>(
    initialSections ?? {
      claim: '',
      evidence: '',
      explanation: '',
      counterArgument: '',
      rebuttal: '',
    }
  );
  const [submitting, setSubmitting] = useState(false);
  const [timeExpired, setTimeExpired] = useState(false);
  const [retryingFields, setRetryingFields] = useState<Set<FeedbackKey>>(new Set());
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  // 새 피드백(재시도 결과 포함)이 도착하면 재시도 로딩 상태를 해제한다.
  useEffect(() => {
    setRetryingFields(new Set());
  }, [feedback]);

  // 타이머 만료 감지 및 자동 제출
  useEffect(() => {
    if (!phaseEndAt || submitting || alreadySubmitted) return;
    // 서버의 자체 타이머보다 먼저 도착하도록 살짝 앞당겨 제출한다.
    // (자세한 이유는 SubmitPanel.tsx의 동일 로직 주석 참고 — 늦게 도착하면 서버가 이미
    //  다음 단계로 넘어가 있어 제출이 거부되거나 엉뚱한 단계에 저장될 수 있다.)
    const CLIENT_SUBMIT_LEAD_MS = 400;
    const delay = phaseEndAt - Date.now() - CLIENT_SUBMIT_LEAD_MS;
    const fire = () => {
      const combined = combineSections(sectionsRef.current);
      // 내용이 있으면 제출, 없으면 skip으로 제출 (빈 제출도 허용)
      socket.emit('submit_content', {
        roomId,
        text: combined.trim() || '',
        skip: !combined.trim(), // 내용이 없으면 skip=true
      });
      setSubmitting(true);
      setTimeExpired(true); // 타이머 만료 표시
    };
    if (delay <= 0) { fire(); return; }
    const id = setTimeout(fire, delay);
    return () => clearTimeout(id);
  }, [phaseEndAt, submitting, alreadySubmitted, roomId]);

  useEffect(() => {
    if (!submitting || alreadySubmitted) return;
    const id = window.setTimeout(() => setSubmitting(false), 5000);
    return () => window.clearTimeout(id);
  }, [submitting, alreadySubmitted]);

  if (alreadySubmitted) {
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
    setSubmitting(true);
  };

  const updateSection = (key: keyof ArgumentSections, value: string) => {
    setSections(prev => ({ ...prev, [key]: value }));
  };

  const handleRetryFeedback = (feedbackKey: FeedbackKey) => {
    setRetryingFields((prev) => new Set(prev).add(feedbackKey));
    socket.emit('retry_essay_feedback', { roomId, field: feedbackKey });
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

      {SECTION_CONFIG.map(({ key, feedbackKey, label, placeholder, minLength }) => {
        const currentLength = sections[key].trim().length;
        const meetsMin = currentLength >= minLength;
        const isInvalid = currentLength > 0 && !meetsMin;
        const resolvedPlaceholder = key === 'claim' && stance
          ? `저는 이 주제에 ${stance === 'pro' ? '찬성' : '반대'}합니다`
          : placeholder;

        const feedbackText = feedback?.[feedbackKey];
        const isRetrying = retryingFields.has(feedbackKey);
        const isFailed = !!feedbackText && feedbackText.startsWith(FAILURE_PREFIX);

        return (
          <div
            key={key}
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>{label}</span>
              <span style={{
                fontSize: '11px',
                fontWeight: 500,
                color: isInvalid ? 'var(--color-con)' : 'var(--color-text-muted)',
              }}>
                {meetsMin ? `${currentLength}자 · 최소 ${minLength}자 충족` : `${currentLength}자 · 최소 ${minLength}자 중`}
              </span>
            </div>
            <textarea
              disabled={submitting || timeExpired}
              style={{
                background: 'var(--color-surface-2)',
                border: `1px solid ${isInvalid ? 'var(--color-con)' : 'var(--color-border)'}`,
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
                opacity: (submitting || timeExpired) ? 0.6 : 1,
                cursor: (submitting || timeExpired) ? 'not-allowed' : 'text',
              }}
              placeholder={resolvedPlaceholder}
              value={sections[key]}
              onChange={(e) => updateSection(key, e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-pro)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = isInvalid ? 'var(--color-con)' : 'var(--color-border)';
              }}
            />

            {feedback && (
              isRetrying ? (
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  AI 피드백을 다시 불러오는 중...
                </div>
              ) : isFailed ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                  }}
                >
                  <span style={{ fontSize: '13px' }}>ℹ️</span>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', flex: 1 }}>
                    피드백을 불러오지 못했어요
                  </span>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ fontSize: '11px', padding: '4px 10px', flexShrink: 0 }}
                    onClick={() => handleRetryFeedback(feedbackKey)}
                  >
                    다시 시도
                  </button>
                </div>
              ) : feedbackText ? (
                <div
                  style={{
                    fontSize: '12px',
                    lineHeight: 1.6,
                    color: 'var(--color-text-muted)',
                    background: 'var(--color-surface-2)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                  }}
                >
                  💡 {feedbackText}
                </div>
              ) : null
            )}
          </div>
        );
      })}

      {feedback?.overall && (
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            padding: '14px 16px',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '4px' }}>
            총평
          </div>
          <div style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--color-text-muted)' }}>
            {feedback.overall}
          </div>
        </div>
      )}

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
          disabled={!isValid || submitting || timeExpired}
          onClick={handleSubmit}
          style={{
            alignSelf: 'flex-end',
            opacity: (isValid && !timeExpired) ? 1 : 0.5,
            cursor: (isValid && !timeExpired) ? 'pointer' : 'not-allowed',
          }}
        >
          {submitting ? '제출 확인 중...' : timeExpired ? '시간 종료' : submitLabel}
        </button>
      </div>
    </div>
  );
}
