import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { useUserStore } from "../../store/useUserStore";
import { useSidebar } from "../../hooks/useSidebar";
import { Modal } from "../common/Modal";

export function Header() {
  const { user, logout } = useUserStore();
  const { toggleSidebar } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const [showExitModal, setShowExitModal] = useState(false);

  const isDebatePage = /\/rooms\/[^/]+\/debate/.test(location.pathname);
  const hasLobbyShell = location.pathname === "/" || /^\/rooms\/[^/]+$/.test(location.pathname);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  function handleConfirmExit() {
    setShowExitModal(false);
    navigate('/');
  }

  return (
    <header className="app-header">
      {hasLobbyShell && (
        <button
          className="btn btn--ghost app-header__hamburger"
          onClick={toggleSidebar}
          aria-label="사이드바 열기/닫기"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
      )}

      {isDebatePage ? (
        <button
          className="app-header__logo app-header__logo--btn"
          onClick={() => setShowExitModal(true)}
          aria-label="홈으로 돌아가기"
        >
          <img src="/logit-logo.png" alt="Logit" className="app-header__logo-img" />
        </button>
      ) : (
        <Link to="/" className="app-header__logo">
          <img src="/logit-logo.png" alt="Logit" className="app-header__logo-img" />
        </Link>
      )}

      {!isDebatePage && (
        <div className="header-user">
          {user && (
            <>
              <Link to="/mypage" className="header-user__profile">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="header-user__avatar-img" />
                ) : (
                  <span className="header-user__avatar-fallback">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </Link>
              {user.role === 'teacher' && (
                <Link to="/teacher" className="btn btn--ghost header-user__teacher-btn">
                  대시보드
                </Link>
              )}
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
      )}

      <Modal isOpen={showExitModal} onClose={() => setShowExitModal(false)} className="modal--dialog">
        <div className="exit-modal">
          <div className="exit-modal__icon">⚠️</div>
          <p className="exit-modal__title">토론을 퇴장하시겠습니까?</p>
          <p className="exit-modal__desc">지금 나가면 현재 진행 중인 토론에서 퇴장됩니다.</p>
          <div className="exit-modal__actions">
            <button className="btn btn--ghost" onClick={() => setShowExitModal(false)}>
              계속 토론하기
            </button>
            <button className="btn btn--danger" onClick={handleConfirmExit}>
              퇴장하기
            </button>
          </div>
        </div>
      </Modal>
    </header>
  );
}
