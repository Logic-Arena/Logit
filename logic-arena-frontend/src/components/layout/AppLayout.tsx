import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { SidebarProvider } from '../../context/SidebarContext';
import { useUserStore } from '../../store/useUserStore';
import { getMe } from '../../lib/api';

export function AppLayout() {
  const token = useUserStore((s) => s.token);
  const setUser = useUserStore((s) => s.setUser);

  useEffect(() => {
    if (!token) return;
    getMe().then(setUser).catch(() => {});
  }, []);

  return (
    <SidebarProvider>
      <div className="app-layout">
        <Header />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
