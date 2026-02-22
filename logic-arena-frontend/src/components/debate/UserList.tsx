import type { Room } from '../../types/room';
import { UserCard } from './UserCard';

interface Props {
  room: Room;
  mySocketId: string;
}

export function UserList({ room, mySocketId }: Props) {
  const showVote = room.phase === 'voting';
  const entries = Object.entries(room.users);

  return (
    <div className="user-list">
      <div className="user-list__title">참가자 ({entries.length})</div>
      {entries.map(([socketId, user]) => (
        <UserCard
          key={socketId}
          socketId={socketId}
          user={user}
          isMe={socketId === mySocketId}
          showVote={showVote}
        />
      ))}
    </div>
  );
}
