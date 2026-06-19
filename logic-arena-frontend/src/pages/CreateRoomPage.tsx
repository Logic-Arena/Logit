import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoom } from '../lib/api';
import { ROOM_MODES } from '../constants/roomModes';
import { TOPIC_MODES } from '../constants/topicModes';
import { useUserStore } from '../store/useUserStore';
import type { RoomMode, TopicMode } from '../types/room';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateRoomModal({ isOpen, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<RoomMode>('ai_debate');
  const [topicMode, setTopicMode] = useState<TopicMode>('ai_auto');
  const [topic, setTopic] = useState('');
  const [password, setPassword] = useState('');
  const [coachingEnabled, setCoachingEnabled] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const authUser = useUserStore((s) => s.user);

  // ESC 키로 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // 모달이 열릴 때마다 폼 리셋
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setMode('ai_debate');
      setTopicMode('ai_auto');
      setTopic('');
      setPassword('');
      setError('');
      setLoading(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError('방 제목을 입력해 주세요');
      return;
    }
    if (topicMode === 'manual' && !topic.trim()) {
      setError('주제를 입력해 주세요');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // teacher 계정이면 서버 저장 설정 사용, 아니면 null
      const handicap = authUser?.role === 'teacher' && authUser?.teacher_settings
        ? {
            enabled: authUser.teacher_settings.enabled,
            vocab: authUser.teacher_settings.vocab,
            evidenceLimit: authUser.teacher_settings.evidenceLimit,
            rebuttalLimit: authUser.teacher_settings.rebuttalLimit,
            phaseDurations: authUser.teacher_settings.phaseDurations ?? null,
          }
        : null;
      const room = await createRoom(
        trimmed,
        mode,
        topicMode,
        topicMode === 'manual' ? topic.trim() : undefined,
        password.trim() || undefined,
        handicap,
        coachingEnabled,
      );
      navigate(`/rooms/${room.id}/debate`, { state: { password: password.trim() || undefined } });
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="create-room-modal">
      <div className="create-room-modal__overlay" onClick={onClose} />
      <div className="create-room-modal__card">
        <form className="create-room-modal__body" onSubmit={handleSubmit}>
          <h1 className="create-room-modal__title">새 토론방 만들기</h1>

          {/* 첫 번째 줄: 방 제목 + 비밀번호 */}
          <div className="create-room-row1">
            <div className="form-field">
              <label className="form-label" htmlFor="title">방 제목</label>
              <input
                id="title"
                className="form-input"
                placeholder="예) AI는 인간의 일자리를 빼앗을 것인가?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
              {error && (
                <span style={{ fontSize: '12px', color: 'var(--color-danger)' }}>{error}</span>
              )}
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="password">
                비밀번호 <span className="form-label__opt">(선택)</span>
              </label>
              <input
                id="password"
                className="form-input"
                type="password"
                placeholder="비밀번호 없음"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {/* 두 번째 줄: 토론 모드 + 주제 방식 */}
          <div className="create-room-row2">
            <div className="form-field">
              <div className="form-label">토론 모드</div>
              <div className="mode-select mode-select--2col">
                {(Object.values(ROOM_MODES) as typeof ROOM_MODES[RoomMode][]).map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    disabled={!m.available}
                    className={`mode-card${mode === m.key ? ' mode-card--selected' : ''}${!m.available ? ' mode-card--disabled' : ''}`}
                    onClick={() => m.available && setMode(m.key)}
                  >
                    <span className="mode-card__label">{m.label}</span>
                    <span className="mode-card__desc">{m.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-field">
              <div className="form-label">주제 방식</div>
              <div className="mode-select mode-select--2col">
                {(Object.values(TOPIC_MODES) as typeof TOPIC_MODES[TopicMode][]).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`mode-card${topicMode === t.key ? ' mode-card--selected' : ''}`}
                    onClick={() => setTopicMode(t.key)}
                  >
                    <span className="mode-card__label">{t.label}</span>
                    <span className="mode-card__desc">{t.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {topicMode === 'manual' && (
            <div className="form-field">
              <label className="form-label" htmlFor="topic">토론 주제</label>
              <input
                id="topic"
                className="form-input"
                placeholder="예) AI는 인류에게 이롭다"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
          )}

          {/* 훈수 AI 토글 영역 */}
          <div className={`coaching-toggle-section${coachingEnabled ? ' coaching-toggle-section--on' : ''}`}>
            <div className="coaching-toggle-section__text">
              <label className="coaching-toggle-section__label" htmlFor="coachingToggle">
                훈수 AI <span className={`coaching-toggle-badge${coachingEnabled ? ' coaching-toggle-badge--on' : ''}`}>{coachingEnabled ? 'ON' : 'OFF'}</span>
              </label>
              <p className="coaching-toggle-section__desc">
                최종 변론 전, AI가 논점·근거 힌트를 제공합니다. 끄면 힌트 없이 바로 최종 변론으로 넘어갑니다.
              </p>
            </div>
            <button
              type="button"
              id="coachingToggle"
              className={`toggle-switch${coachingEnabled ? ' toggle-switch--on' : ''}`}
              onClick={() => setCoachingEnabled(!coachingEnabled)}
              aria-label="훈수 AI 토글"
            >
              <span className="toggle-switch__slider" />
            </button>
          </div>

          <div className="create-room-modal__footer">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? '생성 중...' : '방 만들기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 기존 페이지 컴포넌트는 라우트 호환성을 위해 유지
export function CreateRoomPage() {
  const navigate = useNavigate();

  return (
    <CreateRoomModal
      isOpen={true}
      onClose={() => navigate('/')}
    />
  );
}
