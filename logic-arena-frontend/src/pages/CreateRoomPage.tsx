import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoom } from '../lib/api';

export function CreateRoomPage() {
  const [title, setTitle] = useState('');
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

    setLoading(true);
    setError('');
    try {
      const room = await createRoom(trimmed);
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
