import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ToastProvider } from './components/layout/ToastProvider';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';

import { LobbyPage } from './pages/LobbyPage';
import { CreateRoomPage } from './pages/CreateRoomPage';
import { RoomEntryPage } from './pages/RoomEntryPage';
import { DebatePage } from './pages/DebatePage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';


export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          {/* 인증 불필요 */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/*구글/카카오 로그인 후 백엔드가 브라우저를 보낼 도착지 */}
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          {/* 인증 필요 — AppLayout 내부 */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<LobbyPage />} />
              <Route path="rooms/new" element={<CreateRoomPage />} />
              <Route path="rooms/:roomId" element={<RoomEntryPage />} />
              <Route path="rooms/:roomId/debate" element={<DebatePage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
            </Route>
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
