import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { SidebarProvider } from '../../context/SidebarContext';

export function AppLayout() {
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
