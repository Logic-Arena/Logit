import type { Room } from '../../types/room';
import { UserCard } from './UserCard';

interface Props {
  room: Room;
  mySocketId: string;
}

export function UserList({ room, mySocketId }: Props) {
  const users = [
    room.proPlayer && {
      socketId: room.proPlayer.socketId,
      username: room.proPlayer.username,
      userRole: 'participant' as const,
      vote: 'pro' as const,
    },
    room.conPlayer && {
      socketId: room.conPlayer.socketId,
      username: room.conPlayer.username,
      userRole: 'participant' as const,
      vote: 'con' as const,
    },
    ...room.observers.map((observer) => ({
      socketId: observer.socketId,
      username: observer.username,
      userRole: 'observer' as const,
      vote: null,
    })),
  ].filter((user): user is NonNullable<typeof user> => Boolean(user));

  return (
    <div className="user-list">
      <div className="user-list__title">참가자 ({users.length})</div>
      {users.map((user) => (
        <UserCard
          key={user.socketId}
          user={user}
          isMe={user.socketId === mySocketId}
          showVote={Boolean(user.vote)}
        />
      ))}
    </div>
  );
}
