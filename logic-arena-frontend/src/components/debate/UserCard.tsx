import type { RoomUser } from '../../types/room';

interface Props {
  user: RoomUser;
  isMe: boolean;
  showVote: boolean;
}

const roleLabel: Record<RoomUser['userRole'], string> = {
  host: '방장',
  participant: '참가자',
  observer: '관전자',
  ai: 'AI',
};

export function UserCard({ user, isMe, showVote }: Props) {
  return (
    <div className={`user-card${isMe ? ' user-card--me' : ''}`}>
      <div className="user-card__name">
        <span>{user.username}</span>
        <span className={`badge badge--${user.userRole === 'participant' ? 'participant' : user.userRole}`}>{roleLabel[user.userRole]}</span>
      </div>
      {showVote && user.vote && (
        <div className={`user-card__vote user-card__vote--${user.vote}`}>
          {user.vote === 'pro' ? '찬성' : '반대'}
        </div>
      )}
    </div>
  );
}
