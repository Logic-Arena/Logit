import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useUserStore } from '../../store/useUserStore';

/** 로그인 안 된 경우 /login으로 리다이렉트 (로그인 후 원래 목적지로 돌아올 수 있도록 경로를 함께 전달) */
export function ProtectedRoute() {
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const location = useLocation();
  return isLoggedIn ? (
    <Outlet />
  ) : (
    <Navigate to="/login" state={{ from: `${location.pathname}${location.search}` }} replace />
  );
}
