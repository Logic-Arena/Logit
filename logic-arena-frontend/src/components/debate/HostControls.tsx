import { socket } from '../../lib/socket';

interface Props {
  roomId: string;
  phase: 'waiting' | 'ended';
}

export function HostControls({ roomId, phase }: Props) {
  if (phase !== 'waiting') return null;

  return (
    <div className="host-controls">
      <button className="host-controls__btn" onClick={() => socket.emit('start_game', { roomId })}>
        토론 시작
      </button>
    </div>
  );
}
