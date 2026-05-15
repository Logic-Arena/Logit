import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUserStore } from '../store/useUserStore';
import { useAuthStore } from '../store/useAuthStore';

export function RoomEntryPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user, setUser } = useUserStore();
  const authUser = useAuthStore((s) => s.user);

  const [username, setLocalUsername] = useState(authUser?.name ?? authUser?.username ?? user?.name ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleEnter = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      setError('닉네임을 입력해 주세요');
      return;
    }
    if (user) setUser({ ...user, name: trimmed });
    navigate(`/rooms/${roomId}/debate`, { state: { password: password.trim() || undefined } });
  };

  return (
    <div className="page form-page">
      <h1 className="page__title">토론방 입장</h1>
      <div className="form-card">
      <form className="form-card__body" onSubmit={handleEnter}>
        <div className="form-field">
          <label className="form-label" htmlFor="nickname">닉네임</label>
          <input
            id="nickname"
            className="form-input"
            placeholder="사용할 닉네임을 입력하세요"
            value={username}
            onChange={(e) => setLocalUsername(e.target.value)}
            autoFocus
          />
          {error && (
            <span style={{ fontSize: '12px', color: 'var(--color-danger)' }}>{error}</span>
          )}
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="room-password">비밀번호 (비공개 방인 경우)</label>
          <input
            id="room-password"
            className="form-input"
            type="password"
            placeholder="비밀번호 없으면 비워 두세요"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/')}>
            취소
          </button>
          <button type="submit" className="btn btn--primary">
            입장하기
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}
