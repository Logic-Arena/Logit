import type { RoomUser } from '../../types/room';

interface Props {
  socketId: string;
  user: RoomUser;
  isMe: boolean;
  showVote: boolean;
}

const roleLabel: Record<string, string> = {
  host: '방장',
  participant: '참가자',
  observer: '관전자',
};

export function UserCard({ user, isMe, showVote }: Props) {
  return (
    <div className={`user-card${isMe ? ' user-card--me' : ''}`}>
      <div className="user-card__name">
        <span>{user.username}</span>
        <span className={`badge badge--${user.userRole}`}>{roleLabel[user.userRole]}</span>
      </div>
      {showVote && user.userRole !== 'observer' && (
        <div className={`user-card__vote user-card__vote--${user.vote ?? 'none'}`}>
          {user.vote === 'pro' ? '👍 찬성' : user.vote === 'con' ? '👎 반대' : '미투표'}
        </div>
      )}
    </div>
  );
}
