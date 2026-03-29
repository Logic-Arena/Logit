import { Navigate, Outlet } from 'react-router-dom';
import { useUserStore } from '../../store/useUserStore';

/** 로그인 안 된 경우 /login으로 리다이렉트 */
export function ProtectedRoute() {
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  return isLoggedIn ? <Outlet /> : <Navigate to="/login" replace />;
}
