import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ToastProvider } from './components/layout/ToastProvider';
import { LobbyPage } from './pages/LobbyPage';
import { CreateRoomPage } from './pages/CreateRoomPage';
import { RoomEntryPage } from './pages/RoomEntryPage';
import { DebatePage } from './pages/DebatePage';

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
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
