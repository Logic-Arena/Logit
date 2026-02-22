import { useState } from 'react';
import { socket } from '../../lib/socket';
import { useRoomStore } from '../../store/useRoomStore';
import type { VoteOption } from '../../types/room';

interface Props {
  roomId: string;
  myVote: VoteOption | null;
}

export function VotingPanel({ roomId, myVote }: Props) {
  const voteTally = useRoomStore((s) => s.voteTally);
  const [selected, setSelected] = useState<VoteOption | null>(null);

  const total = voteTally.pro + voteTally.con;
  const proWidth = total > 0 ? (voteTally.pro / total) * 100 : 50;
  const conWidth = total > 0 ? (voteTally.con / total) * 100 : 50;

  const hasVoted = myVote !== null;

  const handleSubmit = () => {
    if (!selected || hasVoted) return;
    socket.emit('cast_vote', { roomId, vote: selected });
  };

  return (
    <div className="voting-panel">
      <div className="voting-panel__title">투표하기</div>
      <div className="voting-buttons">
        <button
          className={`vote-btn vote-btn--pro${(hasVoted ? myVote : selected) === 'pro' ? ' selected' : ''}`}
          onClick={() => { if (!hasVoted) setSelected('pro'); }}
          disabled={hasVoted}
        >
          찬성
        </button>
        <button
          className={`vote-btn vote-btn--con${(hasVoted ? myVote : selected) === 'con' ? ' selected' : ''}`}
          onClick={() => { if (!hasVoted) setSelected('con'); }}
          disabled={hasVoted}
        >
          반대
        </button>
      </div>
      {hasVoted ? (
        <div className="voting-panel__done">투표 완료</div>
      ) : (
        <button
          className="vote-submit-btn"
          onClick={handleSubmit}
          disabled={selected === null}
        >
          투표하기
        </button>
      )}
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
