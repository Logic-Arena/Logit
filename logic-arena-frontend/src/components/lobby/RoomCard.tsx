import { useNavigate } from 'react-router-dom';
import type { Room } from '../../types/room';
import { ROOM_MODES } from '../../constants/roomModes';

interface Props {
  room: Room;
}

export function RoomCard({ room }: Props) {
  const navigate = useNavigate();
  const playerCount = (room.proPlayer ? 1 : 0) + (room.conPlayer ? 1 : 0);
  const totalCount = playerCount + room.observers.length;
  const modeLabel = ROOM_MODES[room.mode ?? 'ai_debate']?.label ?? 'AI 모드';
  const isInProgress = room.phase !== 'waiting' && room.phase !== 'ended';

  return (
    <div className="room-card" onClick={() => navigate(`/rooms/${room.id}`)}>
      <div>
        <div className="room-card__title">
          {room.hasPassword && '🔒 '}
          {room.title}
          <span className="room-card__mode-badge">{modeLabel}</span>
        </div>
        <div className="room-card__meta">
          참가자 {playerCount}/2명{totalCount > playerCount ? ` (관전 ${room.observers.length}명)` : ''}
        </div>
      </div>
      <span className={`room-card__phase room-card__phase--${isInProgress ? 'voting' : room.phase}`}>
        {room.phase === 'waiting' ? '대기 중' : room.phase === 'ended' ? '종료' : '진행 중'}
      </span>
    </div>
  );
}
