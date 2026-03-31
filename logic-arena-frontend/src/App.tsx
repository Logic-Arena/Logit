import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ToastProvider } from './components/layout/ToastProvider';
import { DebatePage } from './pages/DebatePage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { AuthPage } from './pages/AuthPage';
import { CreateRoomPage } from './pages/CreateRoomPage';
import { LobbyPage } from './pages/LobbyPage';
import { RoomEntryPage } from './pages/RoomEntryPage';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<LobbyPage />} />
            <Route path="rooms/new" element={<CreateRoomPage />} />
            <Route path="rooms/:roomId" element={<RoomEntryPage />} />
            <Route path="rooms/:roomId/debate" element={<DebatePage />} />
            <Route path="auth/login" element={<AuthPage />} />
            <Route path="auth/signup" element={<AuthPage />} />
            <Route path="auth/callback" element={<AuthCallbackPage />} />
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
