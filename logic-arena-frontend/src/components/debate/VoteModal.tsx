import { useState } from 'react';
import { socket } from '../../lib/socket';
import { useRoomStore } from '../../store/useRoomStore';
import { Modal } from '../common/Modal';
import type { VoteOption } from '../../types/room';

interface Props {
  roomId: string;
  topic: string | null;
  myVote: VoteOption | null;
  isOpen: boolean;
  onClose: () => void;
}

export function VoteModal({ roomId, topic, myVote, isOpen, onClose }: Props) {
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
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="modal__header">
        <div className="vote-modal__title">투표하기</div>
      </div>
      <div className="modal__body">
        {topic && (
          <div className="vote-modal__topic">{topic}</div>
        )}
        {hasVoted ? (
          <div className="voting-panel__done">투표 완료 ✓</div>
        ) : (
          <div className="vote-modal__buttons">
            <button
              className={`vote-btn vote-btn--pro${selected === 'pro' ? ' selected' : ''}`}
              onClick={() => setSelected('pro')}
            >
              찬성
            </button>
            <button
              className={`vote-btn vote-btn--con${selected === 'con' ? ' selected' : ''}`}
              onClick={() => setSelected('con')}
            >
              반대
            </button>
          </div>
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
      <div className="modal__footer">
        {hasVoted ? (
          <button className="btn btn--ghost" onClick={onClose}>닫기</button>
        ) : (
          <>
            <button className="btn btn--ghost" onClick={onClose}>나중에</button>
            <button
              className="btn btn--primary"
              onClick={handleSubmit}
              disabled={selected === null}
            >
              투표하기
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
