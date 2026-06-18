import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { SidebarProvider } from '../../context/SidebarContext';
import { useUserStore } from '../../store/useUserStore';
import { getMe } from '../../lib/api';

export function AppLayout() {
  const token = useUserStore((s) => s.token);
  const setUser = useUserStore((s) => s.setUser);
  const location = useLocation();
  const hasLobbyShell = location.pathname === '/' || /^\/rooms\/[^/]+$/.test(location.pathname);

  useEffect(() => {
    if (!token) return;
    getMe().then(setUser).catch(() => {});
  }, []);

  return (
    <SidebarProvider>
      <div className={`app-layout${hasLobbyShell ? ' app-layout--lobby' : ''}`}>
        <Header />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
