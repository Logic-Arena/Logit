import { useState } from 'react';
import { Modal } from '../common/Modal';
import type { VoteOption } from '../../types/room';

interface Props {
  roomId: string;
  topic: string | null;
  myVote: VoteOption | null;
  isOpen: boolean;
  onClose: () => void;
}

export function VoteModal({ topic, myVote, isOpen, onClose }: Props) {
  const [selected, setSelected] = useState<VoteOption | null>(myVote);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="modal__header">
        <div className="vote-modal__title">투표</div>
      </div>
      <div className="modal__body">
        {topic && <div className="vote-modal__topic">{topic}</div>}
        <div className="vote-modal__buttons">
          <button className={`vote-btn vote-btn--pro${selected === 'pro' ? ' selected' : ''}`} onClick={() => setSelected('pro')}>
            찬성
          </button>
          <button className={`vote-btn vote-btn--con${selected === 'con' ? ' selected' : ''}`} onClick={() => setSelected('con')}>
            반대
          </button>
        </div>
        <div className="chat-disabled-msg">현재 투표 기능은 사용하지 않습니다.</div>
      </div>
      <div className="modal__footer">
        <button className="btn btn--ghost" onClick={onClose}>닫기</button>
      </div>
    </Modal>
  );
}
