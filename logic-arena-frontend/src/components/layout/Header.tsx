import { Link, useNavigate } from "react-router-dom";
import { useSidebar } from "../../context/SidebarContext";
import { useUserStore } from "../../store/useUserStore";

export function Header() {
  const { toggleSidebar } = useSidebar();
  const { user, logout } = useUserStore();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

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

      {/* 우측: 유저 정보 + 로그아웃 */}
      <div className="header-user">
        {user && (
          <>
            <span className="header-user__name">{user.name}</span>
            <button
              id="header-logout-btn"
              className="btn btn--ghost header-user__logout"
              onClick={handleLogout}
              aria-label="로그아웃"
            >
              로그아웃
            </button>
          </>
        )}
      </div>
    </header>
  );
}
