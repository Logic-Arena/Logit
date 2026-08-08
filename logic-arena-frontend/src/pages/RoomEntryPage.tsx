import { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useUserStore } from '../store/useUserStore';
import { verifyRoomPassword } from '../lib/api';

export function RoomEntryPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useUserStore();
  const hasPassword = (location.state as { hasPassword?: boolean } | null)?.hasPassword ?? false;

  const [username, setLocalUsername] = useState(user?.name ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleEnter = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      setError('닉네임을 입력해 주세요');
      return;
    }
    if (hasPassword && !password.trim()) {
      setPasswordError('비밀번호를 입력해 주세요');
      return;
    }
    if (hasPassword) {
      setVerifying(true);
      try {
        await verifyRoomPassword(roomId!, password.trim());
      } catch (err) {
        setPasswordError(err instanceof Error ? err.message : '비밀번호가 틀렸습니다.');
        setVerifying(false);
        return;
      }
      setVerifying(false);
    }
    if (user) setUser({ ...user, name: trimmed });
    navigate(`/rooms/${roomId}/debate`, { state: { password: password.trim() || undefined } });
  };

  return (
    <div className="page form-page">
      <div className="form-page__overlay" onClick={() => navigate('/')} />
      <div className="form-card">
        <form className="form-card__body" onSubmit={handleEnter}>
          <h1 className="page__title form-card__title">토론방 입장</h1>
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

          {hasPassword && (
            <div className="form-field">
              <label className="form-label" htmlFor="room-password">비밀번호</label>
              <input
                id="room-password"
                className="form-input"
                type="password"
                placeholder="방 비밀번호를 입력하세요"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError('');
                }}
                autoFocus={false}
              />
              {passwordError && (
                <span style={{ fontSize: '12px', color: 'var(--color-danger)' }}>{passwordError}</span>
              )}
            </div>
          )}

          <div className="form-card__footer">
            <button type="button" className="btn btn--ghost" onClick={() => navigate('/')}>
              취소
            </button>
            <button type="submit" className="btn btn--primary" disabled={verifying}>
              {verifying ? '확인 중...' : '입장하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
