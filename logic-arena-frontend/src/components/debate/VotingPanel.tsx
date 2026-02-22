import { socket } from '../../lib/socket';
import { useRoomStore } from '../../store/useRoomStore';
import type { VoteOption } from '../../types/room';

interface Props {
  roomId: string;
  myVote: VoteOption | null;
}

export function VotingPanel({ roomId, myVote }: Props) {
  const voteTally = useRoomStore((s) => s.voteTally);
  const total = voteTally.pro + voteTally.con;
  const proWidth = total > 0 ? (voteTally.pro / total) * 100 : 50;
  const conWidth = total > 0 ? (voteTally.con / total) * 100 : 50;

  const handleVote = (vote: VoteOption) => {
    socket.emit('cast_vote', { roomId, vote });
  };

  return (
    <div className="voting-panel">
      <div className="voting-panel__title">투표하기</div>
      <div className="voting-buttons">
        <button
          className={`vote-btn vote-btn--pro${myVote === 'pro' ? ' selected' : ''}`}
          onClick={() => handleVote('pro')}
        >
          찬성
        </button>
        <button
          className={`vote-btn vote-btn--con${myVote === 'con' ? ' selected' : ''}`}
          onClick={() => handleVote('con')}
        >
          반대
        </button>
      </div>
      <div className="tally-bar">
        <div className="tally-bar__pro" style={{ width: `${proWidth}%` }} />
        <div className="tally-bar__con" style={{ width: `${conWidth}%` }} />
      </div>
      <div className="tally-labels">
        <span>찬성 {voteTally.pro}</span>
        <span>반대 {voteTally.con}</span>
      </div>
    </div>
  );
}
