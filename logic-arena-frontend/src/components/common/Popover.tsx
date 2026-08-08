import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  content: React.ReactNode;
  children: React.ReactNode;
  width?: number;
}

export function Popover({ content, children, width = 280 }: Props) {
  const [visible, setVisible] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const show = () => {
    clearHideTimer();
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();

    // 사이드바가 오른쪽에 있으므로 팝오버는 왼쪽에 표시
    let left = rect.left - width - 10;
    // 왼쪽이 화면 밖이면 오른쪽에 표시
    if (left < 8) left = rect.right + 10;

    // 수직 위치: 트리거 상단 기준, 화면 아래로 넘치면 위로 올림
    const maxBottom = window.innerHeight - 16;
    let top = rect.top;
    // 팝오버 높이를 알 수 없으므로 최대 320px로 가정해 위치 보정
    if (top + 320 > maxBottom) top = Math.max(8, maxBottom - 320);

    setStyle({ position: 'fixed', top, left, width, zIndex: 2000 });
    setVisible(true);
  };

  const scheduleHide = () => {
    hideTimer.current = setTimeout(() => setVisible(false), 120);
  };

  return (
    <div ref={triggerRef} onMouseEnter={show} onMouseLeave={scheduleHide}>
      {children}
      {visible &&
        createPortal(
          <div
            className="popover"
            style={style}
            onMouseEnter={clearHideTimer}
            onMouseLeave={scheduleHide}
          >
            {content}
          </div>,
          document.body,
        )}
    </div>
  );
}
