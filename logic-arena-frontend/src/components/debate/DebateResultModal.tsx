import { useNavigate } from 'react-router-dom';
import type { DebateResult, WinnerSide } from '../../types/room';

interface Props {
  result: DebateResult;
  myVote: 'pro' | 'con' | null;
}

const WINNER_LABEL: Record<WinnerSide, string> = {
  pro: '찬성 승리',
  con: '반대 승리',
  draw: '무승부',
};

export function DebateResultModal({ result }: Props) {
  const navigate = useNavigate();

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: '520px' }}>
        <div className="modal__header" style={{ textAlign: 'center', paddingBottom: '16px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800 }}>{WINNER_LABEL[result.winner]}</h2>
        </div>
        <div className="modal__body">
          <p style={{ lineHeight: 1.8 }}>{result.summary}</p>
        </div>
        <div className="modal__footer" style={{ justifyContent: 'center' }}>
          <button className="btn btn--primary" onClick={() => navigate('/')}>
            로비로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}
