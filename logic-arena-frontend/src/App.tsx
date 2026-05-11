import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ToastProvider } from './components/layout/ToastProvider';
import { DebatePage } from './pages/DebatePage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { AuthPage } from './pages/AuthPage';
import { CreateRoomPage } from './pages/CreateRoomPage';
import { LobbyPage } from './pages/LobbyPage';
import { MyPage } from './pages/MyPage';
import { RoomEntryPage } from './pages/RoomEntryPage';
import { useAuthStore } from './store/useAuthStore';

function PrivateRoute() {
  const { user } = useAuthStore();
  return user ? <Outlet /> : <Navigate to="/auth/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<LobbyPage />} />
            <Route path="auth/login" element={<AuthPage />} />
            <Route path="auth/signup" element={<AuthPage />} />
            <Route path="auth/callback" element={<AuthCallbackPage />} />

            <Route element={<PrivateRoute />}>
              <Route path="rooms/new" element={<CreateRoomPage />} />
              <Route path="rooms/:roomId" element={<RoomEntryPage />} />
              <Route path="rooms/:roomId/debate" element={<DebatePage />} />
              <Route path="mypage" element={<MyPage />} />
            </Route>
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
