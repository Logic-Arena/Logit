import { useState } from 'react';
import type { ReactNode } from 'react';
import { SidebarContext } from './SidebarContextValue';

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen((value) => !value);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <SidebarContext.Provider value={{ sidebarOpen, toggleSidebar, closeSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
}
