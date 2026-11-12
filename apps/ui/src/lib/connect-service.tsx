import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { ConnectServiceSheet } from '~/components/connect-service-sheet';

interface ConnectServiceContextValue {
  open: () => void;
  close: () => void;
}

const ConnectServiceContext = createContext<ConnectServiceContextValue | null>(null);

export function ConnectServiceProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <ConnectServiceContext.Provider value={{ open, close }}>
      {children}
      <ConnectServiceSheet open={isOpen} onClose={close} />
    </ConnectServiceContext.Provider>
  );
}

export function useConnectService() {
  const context = useContext(ConnectServiceContext);
  if (!context) throw new Error('useConnectService must be used within ConnectServiceProvider');
  return context;
}
