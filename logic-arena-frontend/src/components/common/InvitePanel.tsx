import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface InvitePanelProps {
  code: string;
  joinUrl: string;
  codeLabel?: string;
  hint?: string;
}

export function InvitePanel({ code, joinUrl, codeLabel = '코드', hint }: InvitePanelProps) {
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(joinUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <>
      <div className="invite-panel">
        <div className="invite-panel__qr">
          <QRCodeSVG value={joinUrl} size={88} bgColor="#ffffff" fgColor="#1e1c2e" level="M" />
        </div>

        <div className="invite-panel__info">
          <div className="invite-panel__row">
            <span className="invite-panel__label">{codeLabel}</span>
            <span className="invite-panel__code">{code}</span>
          </div>
          <div className="invite-panel__row">
            <span className="invite-panel__label">접속 링크</span>
            <span className="invite-panel__link" title={joinUrl}>{joinUrl}</span>
            <button type="button" className="invite-panel__copy-btn" onClick={handleCopy}>
              {copied ? '✓ 복사됨' : '링크 복사'}
            </button>
          </div>
        </div>

        <button
          type="button"
          className="invite-panel__expand-btn"
          onClick={() => setFullscreen(true)}
        >
          화면 크게 보기
        </button>
      </div>

      {fullscreen && (
        <InvitePanelFullscreen
          code={code}
          codeLabel={codeLabel}
          joinUrl={joinUrl}
          hint={hint ?? 'QR 코드를 스캔하거나 코드로 직접 입장하세요'}
          onClose={() => setFullscreen(false)}
        />
      )}
    </>
  );
}

interface InvitePanelFullscreenProps {
  code: string;
  codeLabel: string;
  joinUrl: string;
  hint: string;
  onClose: () => void;
}

function InvitePanelFullscreen({ code, codeLabel, joinUrl, hint, onClose }: InvitePanelFullscreenProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="invite-panel-fullscreen" role="dialog" aria-modal="true" aria-label="QR 코드 크게 보기">
      <div className="invite-panel-fullscreen__overlay" onClick={onClose} />
      <div className="invite-panel-fullscreen__card">
        <button
          type="button"
          className="invite-panel-fullscreen__close"
          onClick={onClose}
          aria-label="닫기"
        >
          ✕
        </button>

        <div className="invite-panel-fullscreen__qr">
          <QRCodeSVG value={joinUrl} size={512} bgColor="#ffffff" fgColor="#1e1c2e" level="M" />
        </div>

        <div className="invite-panel-fullscreen__code-label">{codeLabel}</div>
        <div className="invite-panel-fullscreen__code">{code}</div>
        <p className="invite-panel-fullscreen__hint">{hint}</p>
      </div>
    </div>
  );
}
