import { useNavigate } from 'react-router-dom';
import type { Room } from '../../types/room';

interface Props {
  room: Room;
}

export function RoomCard({ room }: Props) {
  const navigate = useNavigate();
  const userCount = Object.keys(room.users).length;

  return (
    <div className="room-card" onClick={() => navigate(`/rooms/${room.id}`)}>
      <div>
        <div className="room-card__title">{room.title}</div>
        <div className="room-card__meta">참가자 {userCount}명</div>
      </div>
      <span className={`room-card__phase room-card__phase--${room.phase}`}>
        {room.phase === 'waiting' ? '대기 중' : '토론 중'}
      </span>
    </div>
  );
}
