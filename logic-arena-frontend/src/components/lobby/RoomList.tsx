import type { Room } from '../../types/room';
import { RoomCard } from './RoomCard';

interface Props {
  rooms: Room[];
}

export function RoomList({ rooms }: Props) {
  if (rooms.length === 0) {
    return <div className="empty-state">현재 열린 토론방이 없습니다</div>;
  }

  return (
    <div className="room-list">
      {rooms.map((room) => (
        <RoomCard key={room.id} room={room} />
      ))}
    </div>
  );
}
