import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUserStore } from '../store/useUserStore';

export function RoomEntryPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { username: storedName, setUsername } = useUserStore();

  const [username, setLocalUsername] = useState(storedName);
  const [role, setRole] = useState<'participant' | 'observer'>('participant');
  const [error, setError] = useState('');

  const handleEnter = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      setError('닉네임을 입력해 주세요');
      return;
    }
    setUsername(trimmed);
    navigate(`/rooms/${roomId}/debate`, { state: { requestedRole: role } });
  };

  return (
    <div className="page form-page">
      <h1 className="page__title">토론방 입장</h1>
      <form className="form-card" onSubmit={handleEnter}>
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
          <label className="form-label">역할 선택</label>
          <div className="role-options">
            <label className="role-option">
              <input
                type="radio"
                name="role"
                value="participant"
                checked={role === 'participant'}
                onChange={() => setRole('participant')}
              />
              <div>
                <div className="role-option__title">토론 참가자</div>
                <div className="role-option__desc">
                  찬반 투표에 참여하고 채팅 가능. 최대 4명 (초과 시 자동 관전자 배정)
                </div>
              </div>
            </label>
            <label className="role-option">
              <input
                type="radio"
                name="role"
                value="observer"
                checked={role === 'observer'}
                onChange={() => setRole('observer')}
              />
              <div>
                <div className="role-option__title">관전자</div>
                <div className="role-option__desc">
                  투표 없이 채팅만 참여 가능
                </div>
              </div>
            </label>
          </div>
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
  );
}
