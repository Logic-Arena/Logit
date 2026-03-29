import { createContext } from 'react';

export interface ToastContextValue {
  show: (message: string, type?: 'info' | 'error') => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);
