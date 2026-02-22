import { socket } from '../../lib/socket';

interface Props {
  roomId: string;
}

export function HostControls({ roomId }: Props) {
  const handleStart = () => {
    socket.emit('start_debate', { roomId });
  };

  return (
    <div className="host-controls">
      <button className="host-controls__btn" onClick={handleStart}>
        토론 시작
      </button>
    </div>
  );
}
