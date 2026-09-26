import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';

interface SidebarContextValue {
  open: boolean;
  collapsed: boolean;
  toggle: () => void;
  close: () => void;
  toggleCollapsed: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const toggle = useCallback(() => setOpen((value) => !value), []);
  const close = useCallback(() => setOpen(false), []);
  const toggleCollapsed = useCallback(() => {
    setCollapsed((value) => {
      const next = !value;
      localStorage.setItem('soonwhy-sidebar-collapsed', next ? '1' : '0');
      return next;
    });
  }, []);

  useEffect(() => {
    setCollapsed(localStorage.getItem('soonwhy-sidebar-collapsed') === '1');
  }, []);

  return (
    <SidebarContext.Provider value={{ open, collapsed, toggle, close, toggleCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider');
  return ctx;
}
