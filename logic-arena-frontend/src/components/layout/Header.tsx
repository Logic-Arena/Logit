import { Link } from 'react-router-dom';
import { useSidebar } from '../../context/SidebarContext';

export function Header() {
  const { toggleSidebar } = useSidebar();

  return (
    <header className="app-header">
      {/* 반응형: 작은 화면에서만 표시되는 사이드바 토글 버튼 */}
      <button
        className="header-sidebar-toggle"
        onClick={toggleSidebar}
        aria-label="사이드바 열기/닫기"
        title="사이드바 열기/닫기"
      >
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="3" y="5" width="18" height="2" rx="1" fill="currentColor" />
          <rect x="3" y="11" width="18" height="2" rx="1" fill="currentColor" />
          <rect x="3" y="17" width="18" height="2" rx="1" fill="currentColor" />
        </svg>
      </button>

      <Link to="/" className="app-header__logo">Logit</Link>
    </header>
  );
}
