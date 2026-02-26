import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoom } from '../lib/api';
import { ROOM_MODES } from '../constants/roomModes';
import { TOPIC_MODES } from '../constants/topicModes';
import type { RoomMode, TopicMode } from '../types/room';

export function CreateRoomPage() {
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<RoomMode>('free_debate');
  const [topicMode, setTopicMode] = useState<TopicMode>('ai_auto');
  const [topic, setTopic] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
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
      const room = await createRoom(
        trimmed,
        mode,
        topicMode,
        topicMode === 'manual' ? topic.trim() : undefined,
      );
      navigate(`/rooms/${room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page form-page">
      <h1 className="page__title">새 토론방 만들기</h1>
      <form className="form-card" onSubmit={handleSubmit}>
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
          <label className="form-label">토론 모드</label>
          <div className="mode-select">
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
          <label className="form-label">주제 방식</label>
          <div className="mode-select">
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

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/')}>
            취소
          </button>
          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? '생성 중...' : '방 만들기'}
          </button>
        </div>
      </form>
    </div>
  );
}
