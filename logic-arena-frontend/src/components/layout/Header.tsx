import { Link } from 'react-router-dom';
import { useSidebar } from '../../hooks/useSidebar';
import { useAuthStore } from '../../store/useAuthStore';

export function Header() {
  const { toggleSidebar } = useSidebar();
  const user = useAuthStore((s) => s.user);

  return (
    <header className="app-header">
      <button
        className="header-sidebar-toggle"
        onClick={toggleSidebar}
        aria-label="사이드바 열기 또는 닫기"
        title="사이드바 열기 또는 닫기"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect x="3" y="5" width="18" height="2" rx="1" fill="currentColor" />
          <rect x="3" y="11" width="18" height="2" rx="1" fill="currentColor" />
          <rect x="3" y="17" width="18" height="2" rx="1" fill="currentColor" />
        </svg>
      </button>

      <Link to="/" className="app-header__logo">
        Logit
      </Link>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
        {user && (
          <Link to="/mypage" className="btn btn--ghost" style={{ padding: '7px 14px' }}>
            마이페이지
          </Link>
        )}
      </div>
    </header>
  );
}
